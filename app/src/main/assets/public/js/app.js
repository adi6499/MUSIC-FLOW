// ==========================================================================
// MUSICFLOW — MAIN APPLICATION CONTROLLER (MainActivity.kt Replica)
// ==========================================================================

const App = (() => {
  let activeTab = 'home';
  let activeSongForMenu = null;
  let activeArtistData = null;
  let homeFeedData = null;
  let currentArtistSongs = [];
  let currentDetailSongs = [];
  let searchDebounceTimer = null;
  let audioContext = null;
  let activeSoundscapeNode = null;
  let currentSoundscape = null;
  let tempSelectedLanguages = [];
  let isNewReleasesExpanded = false;
  let isArtistTracksExpanded = false;

  // Library 2.0 State
  let activeLibraryTab = 'playlists';
  let librarySearchQuery = '';
  let librarySortMode = 'recent';
  let selectedMenuSong = null;
  let selectedMenuPlaylistId = null;
  let editingPlaylistId = null;
  let localUploadedSongs = [];

  async function init() {
    console.log('[MusicFlow] Starting clean 100% Android Replica...');
    showLoader(true);

    Player.init();
    if (typeof OfflineManager !== 'undefined') {
      OfflineManager.init();
      OfflineManager.on('networkChange', (state) => {
        if (state === 'ONLINE') {
          UI.showToast('Back online 🌐');
          loadHomeFeed();
        } else {
          UI.showToast('You are offline ✈️');
          loadHomeFeed();
        }
      });
    }
    if (typeof SmartDownloadManager !== 'undefined') {
      SmartDownloadManager.init();
    }
    setupPlayerEventListeners();
    setupDOMEventListeners();
    applyPreferences();
    UI.renderHomeGreeting();
    UI.renderRecentSearchChips();
    UI.renderLibraryTab('playlists');

    // Load Initial Home Page Feed with user languages
    await loadHomeFeed();

    // Initialize Audio Output & Bluetooth/Cast Engine
    if (typeof AudioOutputManager !== 'undefined' && AudioOutputManager.init) {
      AudioOutputManager.init();
    }

    // Check last session (restore queue and metadata in paused state without autoplaying)
    const last = Storage.restoreSession();
    if (last && last.queue && last.queue.length > 0) {
      Player.setQueue(last.queue, last.currentIndex || 0, false);
      Player.pause();
    }

    showLoader(false);
  }

  function applyPreferences() {
    // 1. Performance Mode
    const mode = Storage.getPerformanceMode();
    document.body.classList.toggle('perf-lite', mode === 'lite');

    // 2. Ambient Glow
    const glow = Storage.getAmbientLighting();
    const bg = document.getElementById('dynamic-bg');
    if (bg) bg.style.display = glow ? 'block' : 'none';

    // 3. User Avatar
    const avatar = Storage.getUserAvatar();
    const homeAvatar = document.getElementById('home-user-avatar');
    if (homeAvatar) homeAvatar.src = avatar;

    // 4. Smart Downloads & Offline Settings (Phase 9.3)
    if (typeof Storage !== 'undefined' && Storage.getSmartDownloadsSettings) {
      const smartSettings = Storage.getSmartDownloadsSettings();
      const smartSwitch = document.getElementById('settings-smart-dl-switch');
      if (smartSwitch) smartSwitch.checked = !!smartSettings.enabled;
      const wifiSwitch = document.getElementById('settings-wifi-only-switch');
      if (wifiSwitch) wifiSwitch.checked = smartSettings.wifiOnly !== false;
      const likesSwitch = document.getElementById('settings-auto-likes-switch');
      if (likesSwitch) likesSwitch.checked = !!smartSettings.autoDownloadLikes;

      const storageLimitVal = document.getElementById('settings-storage-limit-val');
      const storageLimitSub = document.getElementById('settings-storage-limit-sub');
      if (storageLimitVal) storageLimitVal.textContent = `${(smartSettings.storageLimitMb / 1024).toFixed(0)} GB`;
      if (storageLimitSub) storageLimitSub.textContent = `${smartSettings.storageLimitMb} MB max storage limit`;

      const cleanupVal = document.getElementById('settings-cleanup-val');
      const cleanupSub = document.getElementById('settings-cleanup-sub');
      if (cleanupVal) cleanupVal.textContent = smartSettings.autoCleanupPolicy === 'never' ? 'Never' : (smartSettings.autoCleanupPolicy === 'older_30_days' ? '30 Days' : (smartSettings.autoCleanupPolicy === 'older_90_days' ? '90 Days' : 'Least Played'));
      if (cleanupSub) cleanupSub.textContent = smartSettings.autoCleanupPolicy === 'never' ? 'Never remove downloads' : `Policy: ${smartSettings.autoCleanupPolicy}`;
    }
  }

  function showLoader(show) {
    const loader = document.getElementById('app-loader');
    if (loader) loader.classList.toggle('active', show);
  }

  // ==========================================================================
  // HOME FEED LOADER
  // ==========================================================================
  async function loadHomeFeed() {
    try {
      if (typeof HomeDataLayer !== 'undefined') {
        HomeDataLayer.loadHome((data, isCache) => {
          if (!data || !data.sections) return;
          homeFeedData = data;

          data.sections.forEach(sec => {
            if (sec.id === 'continue_listening') {
              UI.renderContinueListening(sec.items);
            } else if (sec.id === 'quick_picks') {
              UI.renderQuickPicks(sec.items);
              UI.renderRecommendedTracks(sec.items.slice(0, 8));
            } else if (sec.id === 'made_for_you') {
              UI.renderMadeForYou(sec.items);
            } else if (sec.id === 'because_you_listened') {
              const seedTitle = sec.seedTrack?.primaryArtist || sec.seedTrack?.artists || sec.seedTrack?.name || '';
              UI.renderBecauseYouListened(seedTitle, sec.items);
            } else if (sec.id === 'favorite_artists') {
              UI.renderFavoriteArtists(sec.items);
            } else if (sec.id === 'discover_new') {
              UI.renderDiscoverNew(sec.items);
            } else if (sec.id === 'new_releases') {
              UI.renderNewReleases(sec.items, isNewReleasesExpanded);
            } else if (sec.id === 'trending_charts') {
              UI.renderTrendingCharts(sec.items);
            } else if (sec.id === 'top_albums') {
              UI.renderAlbums(sec.items);
            }
          });
        });
        return;
      }

      const languages = Storage.getLanguages();
      homeFeedData = await API.getHomeFeed(languages);

      const quickPicks = (homeFeedData?.quickPicks || []).map(API.normalizeSong);
      const trendingSongs = (homeFeedData?.trending?.songs || []).map(API.normalizeSong);
      const charts = homeFeedData?.charts || [];
      const albums = homeFeedData?.albums || [];

      // Quick picks
      if (quickPicks.length > 0) {
        UI.renderQuickPicks(quickPicks.slice(0, 16));
        UI.renderRecommendedTracks(quickPicks.slice(0, 8));
        UI.renderNewReleases(trendingSongs.length > 0 ? trendingSongs : quickPicks, isNewReleasesExpanded);
      }
      if (charts.length > 0) UI.renderTrendingCharts(charts);
      if (albums.length > 0) UI.renderAlbums(albums);
    } catch (e) {
      console.warn('[App] Failed to load home feed:', e);
    }
  }

  function toggleAllNewReleases() {
    isNewReleasesExpanded = !isNewReleasesExpanded;
    const songs = (homeFeedData?.trending?.songs || homeFeedData?.quickPicks || []);
    UI.renderNewReleases(songs, isNewReleasesExpanded);
  }

  // ==========================================================================
  // PLAYER EVENT LISTENERS
  // ==========================================================================
  function setupPlayerEventListeners() {
    Player.on('trackChange', (song) => {
      UI.updatePlayerBar(song);
      Lyrics.loadLyricsForTrack(song);
    });

    Player.on('stateChange', ({ isPlaying, state, error }) => {
      UI.updatePlaybackState(isPlaying, state);
      if (state === 'ERROR' && error) {
        UI.showToast(`Unable to play track: ${error.message || 'Error occurred'}`);
      }
    });

    Player.on('timeUpdate', ({ currentTime, duration }) => {
      UI.updatePlaybackProgress(currentTime, duration);
      Lyrics.updateTime(currentTime);
    });

    Player.on('queueChange', (queue) => {
      const idx = (typeof Player.getCurrentIndex === 'function') ? Player.getCurrentIndex() : queue.findIndex(s => s.id === Player.getCurrentTrack()?.id);
      UI.renderQueueSheet(queue, idx);
    });

    Player.on('shuffleChange', (isShuffle) => {
      UI.updateShuffleState(isShuffle);
    });

    Player.on('repeatChange', (repeatMode) => {
      UI.updateRepeatState(repeatMode);
    });

    // Sleep Timer Engine Events
    Player.on('sleepTimerChange', (timerState) => {
      UI.updateSleepTimerUI(timerState);
    });

    Player.on('sleepTimerTick', (timerState) => {
      UI.updateSleepTimerUI(timerState);
    });

    Player.on('sleepTimerExpired', () => {
      UI.updateSleepTimerUI(typeof Player !== 'undefined' && Player.getSleepTimerState ? Player.getSleepTimerState() : { active: false });
      UI.showToast('🌙 Sleep timer ended — playback stopped');
    });

    // DownloadManager Events (Observable Download Queue)
    if (typeof DownloadManager !== 'undefined') {
      DownloadManager.on('statusChange', () => {
        if (activeLibraryTab === 'downloads') {
          UI.renderLibraryTab('downloads', librarySearchQuery, librarySortMode);
        }
        const cur = Player.getCurrentTrack();
        if (cur) UI.updatePlayerBar(cur);
      });

      DownloadManager.on('completed', (task) => {
        UI.showToast(`Downloaded "${task.name}" for Offline Playback 🎵`);
        if (activeLibraryTab === 'downloads') {
          UI.renderLibraryTab('downloads', librarySearchQuery, librarySortMode);
        }
        const cur = Player.getCurrentTrack();
        if (cur) UI.updatePlayerBar(cur);
      });

      DownloadManager.on('failed', (task) => {
        UI.showToast(`Download failed for "${task.name}": ${task.error?.message || 'Error'}`);
        if (activeLibraryTab === 'downloads') {
          UI.renderLibraryTab('downloads', librarySearchQuery, librarySortMode);
        }
      });
    }
  }

  // ==========================================================================
  // DOM EVENT LISTENERS & NAVIGATION
  // ==========================================================================
  function setupDOMEventListeners() {
    // 1. Custom Interactive Seek Bar (Design 1 Touch & Pointer Engine)
    initSeekBar();

    // 2. Mood Chips Bar
    const moodContainer = document.getElementById('mood-chips-container');
    if (moodContainer) {
      moodContainer.addEventListener('click', async (e) => {
        const chip = e.target.closest('.mood-chip');
        if (!chip) return;

        moodContainer.querySelectorAll('.mood-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        const mood = chip.dataset.mood;
        showLoader(true);
        try {
          const query = mood === 'All' ? 'Top Hits' : `${mood} Music`;
          const songs = await API.searchSongs(query, 1, 16);
          UI.renderQuickPicks(songs);
        } catch (_) {}
        showLoader(false);
      });
    }

    // 3. Quick Picks "Play All"
    const playAllQuick = document.getElementById('btn-quick-picks-play-all');
    if (playAllQuick) {
      playAllQuick.addEventListener('click', () => {
        const items = document.querySelectorAll('.quick-pick-item');
        if (items.length > 0) items[0].click();
      });
    }

    // 4. Daily Mix Cards
    document.getElementById('card-mix-supermix')?.addEventListener('click', () => playMix('Arijit Singh Supermix'));
    document.getElementById('card-mix-phonk')?.addEventListener('click', () => playMix('Phonk Drift Workout'));
    document.getElementById('card-mix-lofi')?.addEventListener('click', () => playMix('Lo-Fi Chill Beats'));

    // 5. Search Bar Input & Autocomplete
    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('btn-search-clear');

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim();
        if (searchClear) searchClear.style.display = q.length > 0 ? 'flex' : 'none';

        if (!q) {
          document.getElementById('search-discovery-hub').style.display = 'block';
          document.getElementById('search-results-container').style.display = 'none';
          return;
        }

        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
          performSearch(q, searchCurrentCategory, false);
        }, 300);
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          clearTimeout(searchDebounceTimer);
          const q = searchInput.value.trim();
          if (q) performSearch(q, searchCurrentCategory, true);
        }
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', () => {
        if (searchInput) {
          searchInput.value = '';
          searchInput.focus();
        }
        searchClear.style.display = 'none';
        document.getElementById('search-discovery-hub').style.display = 'block';
        document.getElementById('search-results-container').style.display = 'none';
      });
    }

    // 6. Search Filter Category Chips
    const searchCatContainer = document.getElementById('search-category-chips');
    if (searchCatContainer) {
      searchCatContainer.addEventListener('click', (e) => {
        const chip = e.target.closest('.search-cat-chip');
        if (!chip) return;
        searchCatContainer.querySelectorAll('.search-cat-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        const q = searchInput ? searchInput.value.trim() : '';
        if (q) performSearch(q, chip.dataset.cat);
      });
    }

    // 7. Clear search history
    document.getElementById('btn-clear-search-history')?.addEventListener('click', () => {
      clearSearchData();
    });

    // 8. Library Tabs Bar
    const libTabsContainer = document.getElementById('library-tabs-bar');
    if (libTabsContainer) {
      libTabsContainer.addEventListener('click', (e) => {
        const tabBtn = e.target.closest('.lib-tab-btn');
        if (!tabBtn) return;
        openLibraryTab(tabBtn.dataset.tab);
      });
    }

    // Library Search Bar Toggle & Live Input
    const libSearchToggle = document.getElementById('btn-lib-search-toggle');
    const libSearchWrap = document.getElementById('lib-search-bar-wrap');
    const libSearchInput = document.getElementById('lib-search-input');
    const libSearchClear = document.getElementById('btn-lib-search-clear');
    if (libSearchToggle && libSearchWrap) {
      libSearchToggle.addEventListener('click', () => {
        const isHidden = libSearchWrap.style.display === 'none';
        libSearchWrap.style.display = isHidden ? 'flex' : 'none';
        if (isHidden && libSearchInput) libSearchInput.focus();
      });
    }
    if (libSearchInput) {
      libSearchInput.addEventListener('input', (e) => {
        librarySearchQuery = e.target.value;
        if (libSearchClear) libSearchClear.style.display = librarySearchQuery ? 'inline-flex' : 'none';
        UI.renderLibraryTab(activeLibraryTab, librarySearchQuery, librarySortMode);
      });
    }
    if (libSearchClear && libSearchInput) {
      libSearchClear.addEventListener('click', () => {
        libSearchInput.value = '';
        librarySearchQuery = '';
        libSearchClear.style.display = 'none';
        UI.renderLibraryTab(activeLibraryTab, librarySearchQuery, librarySortMode);
      });
    }

    // 9. Create Playlist Button
    document.getElementById('btn-create-playlist')?.addEventListener('click', openCreatePlaylistModal);

    // Song Action Sheet Listeners
    document.getElementById('btn-song-act-play')?.addEventListener('click', () => {
      if (selectedMenuSong) {
        Player.setQueue([selectedMenuSong], 0);
        expandFullPlayer();
      }
      closeSongMenu();
    });
    document.getElementById('btn-song-act-radio')?.addEventListener('click', () => {
      if (selectedMenuSong) {
        startRadio(selectedMenuSong);
      }
      closeSongMenu();
    });
    document.getElementById('btn-song-act-play-next')?.addEventListener('click', () => {
      if (selectedMenuSong) Player.insertNext(selectedMenuSong);
      closeSongMenu();
    });
    document.getElementById('btn-song-act-queue')?.addEventListener('click', () => {
      if (selectedMenuSong) Player.addToQueue(selectedMenuSong);
      closeSongMenu();
    });
    document.getElementById('btn-song-act-fav')?.addEventListener('click', () => {
      if (selectedMenuSong) {
        Storage.toggleFavorite(selectedMenuSong);
        UI.renderLibraryTab(activeLibraryTab, librarySearchQuery, librarySortMode);
      }
      closeSongMenu();
    });
    document.getElementById('btn-song-act-add-pl')?.addEventListener('click', () => {
      const song = selectedMenuSong;
      closeSongMenu();
      if (song) openAddToPlaylistModal(song);
    });
    document.getElementById('btn-song-act-download')?.addEventListener('click', () => {
      if (selectedMenuSong) {
        downloadTrack(selectedMenuSong);
        Storage.addDownload(selectedMenuSong);
        UI.renderLibraryTab(activeLibraryTab, librarySearchQuery, librarySortMode);
      }
      closeSongMenu();
    });
    document.getElementById('btn-song-act-artist')?.addEventListener('click', () => {
      const artist = selectedMenuSong?.artists || selectedMenuSong?.primaryArtist;
      closeSongMenu();
      if (artist) openArtist(artist);
    });
    document.getElementById('btn-song-act-remove-pl')?.addEventListener('click', () => {
      if (selectedMenuPlaylistId && selectedMenuSong) {
        Storage.removeFromPlaylist(selectedMenuPlaylistId, selectedMenuSong.id);
        UI.renderLibraryTab(activeLibraryTab, librarySearchQuery, librarySortMode);
      }
      closeSongMenu();
    });

    // Playlist Action Sheet Listeners
    document.getElementById('btn-pl-act-play')?.addEventListener('click', () => {
      if (selectedMenuPlaylistId) playCustomPlaylist(selectedMenuPlaylistId);
      closePlaylistMenu();
    });
    document.getElementById('btn-pl-act-shuffle')?.addEventListener('click', () => {
      if (selectedMenuPlaylistId) shuffleCustomPlaylist(selectedMenuPlaylistId);
      closePlaylistMenu();
    });
    document.getElementById('btn-pl-act-play-next')?.addEventListener('click', () => {
      if (selectedMenuPlaylistId) playNextPlaylist(selectedMenuPlaylistId);
      closePlaylistMenu();
    });
    document.getElementById('btn-pl-act-queue')?.addEventListener('click', () => {
      if (selectedMenuPlaylistId) addPlaylistToQueue(selectedMenuPlaylistId);
      closePlaylistMenu();
    });
    document.getElementById('btn-pl-act-edit')?.addEventListener('click', () => {
      const plId = selectedMenuPlaylistId;
      closePlaylistMenu();
      if (plId) openEditPlaylistModal(plId);
    });
    document.getElementById('btn-pl-act-duplicate')?.addEventListener('click', () => {
      if (selectedMenuPlaylistId) duplicateCustomPlaylist(selectedMenuPlaylistId);
      closePlaylistMenu();
    });
    document.getElementById('btn-pl-act-delete')?.addEventListener('click', () => {
      if (selectedMenuPlaylistId) deleteCustomPlaylist(selectedMenuPlaylistId);
      closePlaylistMenu();
    });

    // 10. Settings Trigger (Both top button & avatar)
    document.getElementById('btn-open-settings')?.addEventListener('click', openSettings);
    document.getElementById('btn-user-profile')?.addEventListener('click', openSettings);

    // 11. Artist Screen Menu Trigger
    document.getElementById('btn-artist-menu')?.addEventListener('click', openArtistMenu);

    // 12. Artist Genre Pills Bar (All, Top Hits, Romantic, Melody, etc.)
    const artistGenreContainer = document.getElementById('artist-genre-pills');
    if (artistGenreContainer) {
      artistGenreContainer.addEventListener('click', async (e) => {
        const pill = e.target.closest('.artist-genre-pill');
        if (!pill) return;
        artistGenreContainer.querySelectorAll('.artist-genre-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        const genre = pill.dataset.genre || pill.textContent.trim();
        const artistName = activeArtistData?.name || document.getElementById('artist-main-name')?.textContent || '';
        if (!artistName) return;

        showLoader(true);
        try {
          const query = genre === 'All' ? artistName : `${artistName} ${genre}`;
          currentArtistSongs = await API.getArtistSongs(query, 25);
          isArtistTracksExpanded = false;
          UI.renderArtistTopTracks(currentArtistSongs, false);
        } catch (_) {}
        showLoader(false);
      });
    }

    // 13. Full Player Favorite Toggle
    document.getElementById('btn-player-favorite')?.addEventListener('click', () => {
      toggleFavoriteCurrent();
    });

    // 14. Keyboard Shortcuts for Playback
    window.addEventListener('keydown', (e) => {
      const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        Player.togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const cur = Player.getState().position;
        Player.seek(Math.max(0, cur - 5));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        const cur = Player.getState().position;
        Player.seek(cur + 5);
      } else if (e.key === 'n' || e.key === 'N') {
        Player.next();
      } else if (e.key === 'p' || e.key === 'P') {
        Player.previous();
      } else if (e.key === 'l' || e.key === 'L') {
        toggleFavoriteCurrent();
      } else if (e.key === 'Escape') {
        const fullPlayer = document.getElementById('full-player');
        if (fullPlayer && fullPlayer.classList.contains('expanded')) {
          collapseFullPlayer();
        } else {
          document.querySelectorAll('.bottom-sheet-backdrop.active, .dialog-backdrop.active').forEach(el => {
            el.classList.remove('active');
          });
        }
      }
    });

    // 15. Touch Gestures for Full Player (Swipe Down to Collapse, Swipe Left/Right to Skip)
    const fullPlayerEl = document.getElementById('full-player');
    if (fullPlayerEl) {
      let touchStartY = 0;
      let touchStartX = 0;

      fullPlayerEl.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          touchStartY = e.touches[0].clientY;
          touchStartX = e.touches[0].clientX;
        }
      }, { passive: true });

      fullPlayerEl.addEventListener('touchend', (e) => {
        if (e.changedTouches.length === 1) {
          const deltaY = e.changedTouches[0].clientY - touchStartY;
          const deltaX = e.changedTouches[0].clientX - touchStartX;

          // Swipe down from top header area to collapse
          if (touchStartY < 180 && deltaY > 70 && Math.abs(deltaX) < 80) {
            collapseFullPlayer();
          }
          // Horizontal swipe on artwork view to skip track
          else if (e.target.closest('#player-art-view') && Math.abs(deltaX) > 80 && Math.abs(deltaY) < 60) {
            if (deltaX < 0) {
              Player.next();
            } else {
              Player.previous();
            }
          }
        }
      }, { passive: true });
    }
  }

  // Queue Drag & Drop Reordering Support
  let draggedQueueIndex = -1;

  function handleQueueDragStart(e, index) {
    draggedQueueIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    }
  }

  function handleQueueDragOver(e) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  }

  function handleQueueDrop(e, targetIndex) {
    e.preventDefault();
    if (draggedQueueIndex >= 0 && targetIndex >= 0 && draggedQueueIndex !== targetIndex) {
      Player.reorderQueue(draggedQueueIndex, targetIndex);
    }
    draggedQueueIndex = -1;
  }

  function removeTrackFromQueue(index) {
    if (typeof Player !== 'undefined' && Player.removeFromQueue) {
      Player.removeFromQueue(index);
    }
  }

  // ==========================================================================
  // AUTHORITATIVE NAVIGATION ROUTER & BACK GESTURE ENGINE
  // ==========================================================================
  const navHistory = [{ screen: 'home', state: null, timestamp: Date.now() }];
  const MAX_HISTORY_LENGTH = 35;

  function pushHistory(screen, state = null) {
    if (!screen) return;
    const current = navHistory[navHistory.length - 1];
    // Prevent duplicate consecutive history entries (Part 8 tab reselection & Part 49)
    if (current && current.screen === screen && JSON.stringify(current.state) === JSON.stringify(state)) {
      return;
    }
    navHistory.push({ screen, state, timestamp: Date.now() });
    if (navHistory.length > MAX_HISTORY_LENGTH) {
      navHistory.shift();
    }
  }

  function navigate(targetScreen, addToHistory = true, state = null) {
    if (!targetScreen) return;
    if (addToHistory) {
      pushHistory(targetScreen, state);
    }
    activeTab = targetScreen;

    // Update Bottom Nav Tab Highlights
    document.querySelectorAll('.floating-bottom-nav .nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.target === targetScreen);
    });

    // Switch Visible Screen
    document.querySelectorAll('.screen').forEach(scr => {
      scr.classList.remove('active');
    });

    const activeEl = document.getElementById(`screen-${targetScreen}`);
    if (activeEl) {
      activeEl.classList.add('active');
    }

    // Refresh contents if needed
    if (targetScreen === 'library') {
      const activeLibTab = document.querySelector('.lib-tab-btn.active')?.dataset.tab || 'playlists';
      UI.renderLibraryTab(activeLibTab);
    } else if (targetScreen === 'explore') {
      loadExplore();
    }
  }

  function restoreScreen(screen, state) {
    if (screen === 'artist' && state && state.artistName) {
      openArtist(state.artistName, false);
    } else if (screen === 'genre' && state && state.genreName) {
      openGenre(state.genreName, false);
    } else if (screen === 'detail' && state) {
      if (state.playlistId) openCustomPlaylist(state.playlistId, false);
      else if (state.item) openAlbumOrPlaylist(state.item, false);
      else navigate('library', false);
    } else {
      navigate(screen, false);
    }
  }

  function handleBack() {
    // 1. Keyboard / Text Input Dismissal (Priority 1)
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
      document.activeElement.blur();
      return true;
    }

    // 2. Open Modal Dialogs (Priority 2)
    const openModals = [
      'modal-create-playlist',
      'modal-add-to-playlist',
      'dialog-language-picker',
      'dialog-playlist-picker',
      'dialog-quality',
      'dialog-storage-limit',
      'dialog-auto-cleanup'
    ];
    for (const modalId of openModals) {
      const el = document.getElementById(modalId);
      if (el) {
        const isVisible = (el.classList.contains('active') || el.style.display === 'flex' || el.style.display === 'block');
        if (isVisible) {
          if (modalId === 'modal-create-playlist') closeCreatePlaylistModal();
          else if (modalId === 'modal-add-to-playlist') closeAddToPlaylistModal();
          else closeDialog(modalId);
          return true;
        }
      }
    }

    // 3. Open Bottom Sheets (Priority 3)
    const openSheets = [
      'sheet-audio-output',
      'sheet-song-menu',
      'sheet-artist-menu',
      'sheet-equalizer',
      'sheet-sleep-timer',
      'sheet-storage-cleanup',
      'sheet-queue',
      'sheet-settings'
    ];
    for (const sheetId of openSheets) {
      const el = document.getElementById(sheetId);
      if (el && el.classList.contains('active')) {
        closeBottomSheet(sheetId);
        return true;
      }
    }

    // 4. Live Synced Lyrics Overlay inside Player (Priority 4)
    const lyricsView = document.getElementById('player-lyrics-view');
    if (lyricsView && lyricsView.style.display === 'flex') {
      toggleLyricsView();
      return true;
    }

    // 5. Full Player Sheet Dismissal (Priority 5)
    const fullPlayer = document.getElementById('full-player');
    if (fullPlayer && fullPlayer.classList.contains('expanded')) {
      collapseFullPlayer();
      return true;
    }

    // 6. Navigation History Stack Unwind (Priority 6 & 7)
    if (navHistory.length > 1) {
      navHistory.pop(); // Remove current top
      const prev = navHistory[navHistory.length - 1];
      if (prev) {
        restoreScreen(prev.screen, prev.state);
        return true;
      }
    }

    // 7. If currently on a non-home screen with empty history, return to Home
    if (activeTab !== 'home') {
      navigate('home', false);
      return true;
    }

    // 8. At Root Home Screen with no overlays -> Return false (Signals Android OS to exit/minimize)
    return false;
  }

  function goBack() {
    return handleBack();
  }

  // ==========================================================================
  // EXPLORE & GENRE NAVIGATION (Phase 7)
  // ==========================================================================
  let activeGenreData = null;

  async function loadExplore() {
    if (typeof ExploreDataLayer !== 'undefined') {
      try {
        ExploreDataLayer.loadExplore((data, isCache) => {
          if (data) {
            UI.renderExploreFeed(data);
          }
        });
      } catch (e) {
        console.warn('[App] Explore feed load error:', e);
      }
    }
  }

  async function openGenre(genreName, addToHistory = true) {
    if (!genreName) return;
    if (addToHistory) {
      pushHistory('genre', { genreName });
    }
    showLoader(true);
    try {
      if (typeof ExploreDataLayer !== 'undefined') {
        const genreData = await ExploreDataLayer.getGenreDetails(genreName);
        activeGenreData = genreData;
        UI.renderGenrePage(genreData);
        navigate('genre', false);
      } else {
        searchCategory(genreName);
      }
    } catch (e) {
      console.warn('[App] Failed to open genre:', e);
      searchCategory(genreName);
    } finally {
      showLoader(false);
    }
  }

  function playAllGenreSongs() {
    if (!activeGenreData || !activeGenreData.songs || activeGenreData.songs.length === 0) return;
    Player.setQueue(activeGenreData.songs, 0);
    Player.play();
  }

  async function startGenreRadio() {
    if (!activeGenreData || !activeGenreData.songs || activeGenreData.songs.length === 0) return;
    const seedSong = activeGenreData.songs[0];
    if (typeof RecommendationEngine !== 'undefined') {
      try {
        const radioQueue = await RecommendationEngine.buildRadioQueue(seedSong, activeGenreData.songs);
        Player.setQueue(radioQueue, 0);
        Player.play();
        UI.showToast(`Starting ${activeGenreData.title} Radio`);
      } catch (_) {
        Player.setQueue(activeGenreData.songs, 0);
        Player.play();
      }
    } else {
      Player.setQueue(activeGenreData.songs, 0);
      Player.play();
    }
  }

  // ==========================================================================
  // ARTIST PROFILE SCREEN
  // ==========================================================================
  async function openArtist(artistNameOrId, addToHistory = true) {
    if (!artistNameOrId) return;
    showLoader(true);

    try {
      const artistData = await API.getArtistDetails(artistNameOrId);
      let name = (artistData?.name || artistData?.title || '').split(';')[0].split(',')[0].trim();

      // If name is still numeric or empty, resolve cleanly
      if (!name || /^[0-9]+$/.test(name)) {
        if (!/^[0-9]+$/.test(String(artistNameOrId).trim())) {
          name = String(artistNameOrId).trim();
        } else {
          name = Player.getCurrentTrack()?.primaryArtist || 'Top Artist';
        }
      }

      if (addToHistory) {
        pushHistory('artist', { artistName: name });
      }

      activeArtistData = { ...(artistData || {}), name };

      const heroImg = document.getElementById('artist-hero-img');
      const heroName = document.getElementById('artist-hero-name');
      const mainName = document.getElementById('artist-main-name');
      const navTitle = document.getElementById('artist-top-nav-title');
      const listenersText = document.getElementById('artist-listeners-text');

      const img = API.getImageUrl(activeArtistData);

      if (heroImg) heroImg.src = img;
      if (heroName) heroName.textContent = name.toUpperCase();
      if (mainName) mainName.textContent = name;
      if (navTitle) navTitle.textContent = name;
      if (listenersText) {
        const rawCount = String(artistData?.fanCount || artistData?.playCount || '3234900');
        const numCount = parseInt(rawCount.replace(/[^0-9]/g, ''), 10) || 3234900;
        listenersText.textContent = `${numCount.toLocaleString()} listeners per month`;
      }

      // Reset Genre Pills to 'All'
      const pillsContainer = document.getElementById('artist-genre-pills');
      if (pillsContainer) {
        pillsContainer.querySelectorAll('.artist-genre-pill').forEach((p, idx) => {
          p.classList.toggle('active', idx === 0);
        });
      }

      // Fetch Top Songs
      currentArtistPage = 1;
      isArtistTracksExpanded = false;
      currentArtistSongs = await API.getArtistSongs(name, 1, 25);
      UI.renderArtistTopTracks(currentArtistSongs, false);

      // Hook Recent Release Card
      const recentSection = document.getElementById('artist-recent-section');
      const recentImg = document.getElementById('artist-recent-img');
      const recentTitle = document.getElementById('artist-recent-title');
      const recentSub = document.getElementById('artist-recent-sub');
      const recentCard = document.getElementById('artist-recent-card');

      if (currentArtistSongs.length > 0) {
        const first = currentArtistSongs[0];
        if (recentSection) recentSection.style.display = 'block';
        if (recentImg) recentImg.src = first.image || img;
        if (recentTitle) recentTitle.textContent = first.name;
        if (recentSub) recentSub.textContent = `${first.year || '2024'} • Top Track`;
        if (recentCard) recentCard.onclick = () => playSongWithQueue(first.id);
      }

      // Hook "Best of Artist" and "Artist Radio" playlist cards
      const plTitle1 = document.getElementById('artist-pl-title-1');
      const plTitle2 = document.getElementById('artist-pl-title-2');
      const plCard1 = document.getElementById('artist-pl-best');
      const plCard2 = document.getElementById('artist-pl-radio');

      if (plTitle1) plTitle1.textContent = `Best of ${name}`;
      if (plTitle2) plTitle2.textContent = `${name} Radio`;
      if (plCard1) plCard1.onclick = () => {
        if (currentArtistSongs.length > 0) {
          Player.setQueue(currentArtistSongs, 0);
          expandFullPlayer();
        }
      };
      if (plCard2) plCard2.onclick = () => startArtistRadio();

      // Fetch & Render Similar Artists
      const similarContainer = document.getElementById('artist-similar-container');
      if (similarContainer) {
        const artistQuery = (name || '').split(' ')[0] || 'Arijit';
        const simRes = await API.searchArtists(artistQuery, 1, 8);
        const filteredSim = (simRes || []).filter(a => (a.name || a.title || '').toLowerCase() !== name.toLowerCase());

        if (filteredSim.length > 0) {
          similarContainer.innerHTML = filteredSim.map(sim => `
            <div class="similar-artist-item" onclick="App.openArtist('${(sim.name || sim.title || '').replace(/'/g, "\\'")}')">
              <img class="similar-artist-avatar" src="${API.getImageUrl(sim)}" onerror="this.src='assets/logo.png'" alt="${sim.name || sim.title}">
              <span class="similar-artist-name">${sim.name || sim.title}</span>
            </div>
          `).join('');
        } else {
          const defaultPeers = [
            { name: 'Arijit Singh', img: 'https://c.saavncdn.com/artists/Arijit_Singh_002_20230323062147_500x500.jpg' },
            { name: 'Shreya Ghoshal', img: 'https://c.saavncdn.com/artists/Shreya_Ghoshal_004_20230323062147_500x500.jpg' },
            { name: 'Pritam', img: 'https://c.saavncdn.com/artists/Pritam_003_20230323062147_500x500.jpg' },
            { name: 'Diljit Dosanjh', img: 'https://c.saavncdn.com/artists/Diljit_Dosanjh_004_20221014163908_500x500.jpg' },
            { name: 'Atif Aslam', img: 'https://c.saavncdn.com/artists/Atif_Aslam_500x500.jpg' },
            { name: 'Badshah', img: 'https://c.saavncdn.com/artists/Badshah_005_20230609081822_500x500.jpg' }
          ];
          similarContainer.innerHTML = defaultPeers.map(p => `
            <div class="similar-artist-item" onclick="App.openArtist('${p.name}')">
              <img class="similar-artist-avatar" src="${p.img}" onerror="this.src='assets/logo.png'" alt="${p.name}">
              <span class="similar-artist-name">${p.name}</span>
            </div>
          `).join('');
        }
      }

      // Hook Artist Play All
      const playAllBtn = document.getElementById('btn-artist-play-all');
      if (playAllBtn) {
        playAllBtn.onclick = () => {
          if (currentArtistSongs.length > 0) {
            Player.setQueue(currentArtistSongs, 0);
            expandFullPlayer();
          }
        };
      }

      // Switch to Artist Screen
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.getElementById('screen-artist')?.classList.add('active');

    } catch (err) {
      console.error('[App] openArtist error:', err);
    }
    showLoader(false);
  }

  function showRadioToast(message) {
    const toast = document.getElementById('radio-toast');
    const toastText = document.getElementById('radio-toast-text');
    if (!toast) return;
    if (toastText) toastText.textContent = message;

    toast.style.display = 'flex';
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.style.display = 'none';
      }, 350);
    }, 2800);
  }

  let currentRadioSessionId = 0;

  async function startRadio(songOrArtist) {
    const radioSessionId = ++currentRadioSessionId;
    let seedSong = null;
    let artistName = '';

    if (songOrArtist && typeof songOrArtist === 'object') {
      seedSong = songOrArtist;
      artistName = seedSong.primaryArtist || (typeof seedSong.artists === 'string' ? seedSong.artists.split(/[,;&/]/)[0].trim() : '') || seedSong.name || '';
    } else if (typeof songOrArtist === 'string' && songOrArtist.trim()) {
      artistName = songOrArtist.trim();
      const cur = Player.getCurrentTrack();
      if (cur && (cur.primaryArtist === artistName || (cur.artists && cur.artists.includes(artistName)))) {
        seedSong = cur;
      }
    } else {
      seedSong = Player.getCurrentTrack();
      if (seedSong) {
        artistName = seedSong.primaryArtist || (typeof seedSong.artists === 'string' ? seedSong.artists.split(/[,;&/]/)[0].trim() : '') || '';
      }
    }

    if (!artistName || artistName === 'undefined' || artistName === 'Artist' || artistName === 'Track') {
      const mainNameEl = document.getElementById('artist-main-name');
      const topTitleEl = document.getElementById('artist-top-nav-title');
      if (mainNameEl && mainNameEl.textContent && mainNameEl.textContent !== 'Artist Name' && mainNameEl.textContent !== 'undefined') {
        artistName = mainNameEl.textContent.trim();
      } else if (topTitleEl && topTitleEl.textContent && topTitleEl.textContent !== 'Artist' && topTitleEl.textContent !== 'undefined') {
        artistName = topTitleEl.textContent.trim();
      } else {
        artistName = Player.getCurrentTrack()?.primaryArtist || 'Top 50 Hits';
      }
    }

    artistName = API.decodeHtml(String(artistName || '')).split(';')[0].split(',')[0].trim();
    if (!artistName || artistName === 'undefined') artistName = 'Top 50 Hits';

    const radioTitle = seedSong ? `${seedSong.name} Radio` : `${artistName} Radio`;
    showRadioToast(`📻 Starting ${radioTitle}...`);

    showLoader(true);

    try {
      // Parallel Multi-Channel Candidate Retrieval
      const fetchPromises = [];

      // Channel 1: Artist Top Songs & Artist Hits Search
      if (artistName && artistName !== 'Top 50 Hits') {
        fetchPromises.push(API.getArtistSongs(artistName, 1, 25).catch(() => []));
        fetchPromises.push(API.searchSongs(`${artistName} Hits`, 1, 20).catch(() => []));
      }

      // Channel 2: Seed Song Similar Tracks
      if (seedSong && seedSong.id) {
        fetchPromises.push(API.getSimilarSongs(seedSong.id, 25).catch(() => []));
      }

      // Channel 3: Related Artists from Graph
      const cleanArtKey = artistName.toLowerCase();
      const relatedKeys = (typeof RecommendationEngine !== 'undefined' && RecommendationEngine.RELATED_ARTISTS_GRAPH)
        ? (RecommendationEngine.RELATED_ARTISTS_GRAPH[cleanArtKey] || [])
        : [];
      if (relatedKeys.length > 0) {
        fetchPromises.push(API.searchSongs(`${relatedKeys[0]} Hits`, 1, 15).catch(() => []));
        if (relatedKeys.length > 1) {
          fetchPromises.push(API.searchSongs(`${relatedKeys[1]} Hits`, 1, 15).catch(() => []));
        }
      }

      // Channel 4: Local Storage context (favorites & history)
      if (typeof Storage !== 'undefined') {
        const favs = Storage.getFavorites() || [];
        const history = Storage.getHistory() || [];
        fetchPromises.push(Promise.resolve(favs));
        fetchPromises.push(Promise.resolve(history));
      }

      const results = await Promise.allSettled(fetchPromises);

      // Verify Session ID to prevent race conditions
      if (radioSessionId !== currentRadioSessionId) {
        console.log(`[Radio] Stale session #${radioSessionId} discarded in favor of #${currentRadioSessionId}`);
        showLoader(false);
        return;
      }

      let allCandidates = [];
      results.forEach(res => {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          allCandidates.push(...res.value);
        }
      });

      // Filter invalid items and normalize
      allCandidates = allCandidates.filter(s => s && s.id && s.name && s.name.toLowerCase() !== 'undefined' && s.name.toLowerCase() !== 'trending');

      // If still low, search general catalog for artist name
      if (allCandidates.length < 6) {
        const fallbacks = await API.searchSongs(`${artistName}`, 1, 25).catch(() => []);
        if (radioSessionId === currentRadioSessionId && Array.isArray(fallbacks)) {
          allCandidates.push(...fallbacks);
        }
      }

      // If seedSong is not set, choose first candidate
      if (!seedSong && allCandidates.length > 0) {
        seedSong = allCandidates[0];
      }

      if (!seedSong) {
        UI.showToast(`Couldn't find songs for ${artistName} Radio`);
        showLoader(false);
        return;
      }

      // Deduplicate using TrackDeduplicator & Filter out seed itself
      const TD = (typeof TrackDeduplicator !== 'undefined') ? TrackDeduplicator : { deduplicate: arr => arr };
      const uniqueCandidates = TD.deduplicate(allCandidates.filter(s => String(s.id) !== String(seedSong.id)));

      // Rank via Recommendation Engine
      let rankedRecommendations = [];
      if (typeof RecommendationEngine !== 'undefined' && uniqueCandidates.length > 0) {
        const scored = RecommendationEngine.getSimilarTracks(seedSong, uniqueCandidates, 25);
        rankedRecommendations = scored.map(r => r.song);
      } else {
        rankedRecommendations = uniqueCandidates.slice(0, 25);
      }

      if (rankedRecommendations.length > 0) {
        // Update context titles in Full Player
        const contextTag = document.getElementById('player-context-tag');
        const contextTitle = document.getElementById('player-context-title');
        if (contextTag) contextTag.textContent = 'ARTIST RADIO';
        if (contextTitle) contextTitle.textContent = radioTitle;

        // Populate Player Queue with current track + all recommendations
        Player.startRadioQueue(seedSong, rankedRecommendations);
        UI.showToast(`Started Radio for ${seedSong.name} 📻`);
      } else {
        UI.showToast(`Couldn't find more songs for ${seedSong.name} Radio`);
      }
    } catch (e) {
      console.error('[Radio] startRadio error:', e);
      UI.showToast(`Couldn't find more songs for Radio`);
    }
    showLoader(false);
  }

  function startArtistRadio() {
    let name = activeArtistData?.name || activeArtistData?.title || '';
    if (!name || name === 'undefined' || name === 'Artist') {
      const mainNameEl = document.getElementById('artist-main-name');
      const topTitleEl = document.getElementById('artist-top-nav-title');
      name = (mainNameEl && mainNameEl.textContent !== 'Artist Name' ? mainNameEl.textContent.trim() : '') || 
             (topTitleEl && topTitleEl.textContent !== 'Artist' ? topTitleEl.textContent.trim() : '') || '';
    }
    if (!name || name === 'undefined') {
      name = Player.getCurrentTrack()?.primaryArtist || 'Top 50 Hits';
    }
    startRadio(name);
  }

  function toggleFollowArtist() {
    const artist = activeArtistData;
    const name = artist?.name || 'Artist';
    const followIcon = document.getElementById('artist-follow-icon');
    const isFollowed = followIcon?.textContent === 'thumb_up';
    if (followIcon) {
      followIcon.textContent = isFollowed ? 'thumb_up_off_alt' : 'thumb_up';
      followIcon.classList.toggle('fill-icon', !isFollowed);
    }
    alert(isFollowed ? `Unfollowed ${name}` : `Followed ${name}!`);
  }

  let currentArtistPage = 1;

  function toggleAllArtistTracks() {
    isArtistTracksExpanded = !isArtistTracksExpanded;
    UI.renderArtistTopTracks(currentArtistSongs, isArtistTracksExpanded);
  }

  async function loadMoreArtistSongs() {
    const artist = activeArtistData;
    const name = artist?.name || document.getElementById('artist-main-name')?.textContent;
    if (!name) return;

    currentArtistPage++;
    showLoader(true);
    try {
      const moreSongs = await API.getArtistSongs(name, currentArtistPage, 25);
      if (moreSongs && moreSongs.length > 0) {
        currentArtistSongs.push(...moreSongs);
        isArtistTracksExpanded = true;
        UI.renderArtistTopTracks(currentArtistSongs, true);
      } else {
        alert('No more songs found for this artist.');
      }
    } catch (e) {
      console.error('[Artist] loadMore error:', e);
    }
    showLoader(false);
  }

  function openArtistMenu() {
    const artist = activeArtistData;
    const name = artist?.name || artist?.title || document.getElementById('artist-main-name')?.textContent || 'Artist';
    const img = API.getImageUrl(artist) || document.getElementById('artist-hero-img')?.src || 'assets/logo.png';

    const menuImg = document.getElementById('sheet-artist-menu-img');
    const menuTitle = document.getElementById('sheet-artist-menu-title');

    if (menuImg) menuImg.src = img;
    if (menuTitle) menuTitle.textContent = name;

    openBottomSheet('sheet-artist-menu');
  }

  function artistMenuAction(action) {
    const artist = activeArtistData;
    const name = artist?.name || artist?.title || 'Artist';
    closeBottomSheet('sheet-artist-menu');

    switch (action) {
      case 'start-radio':
        playMix(`${name} Radio Hits`);
        break;
      case 'follow':
        alert(`Followed ${name}!`);
        break;
      case 'share':
        if (navigator.share) {
          navigator.share({ title: name, text: `Check out ${name} on MusicFlow`, url: window.location.href });
        } else {
          navigator.clipboard.writeText(`${name} on MusicFlow`);
          alert('Artist profile link copied!');
        }
        break;
    }
  }

  let currentSearchResults = [];
  let searchCurrentPage = 1;
  let searchCurrentQuery = '';
  let searchCurrentCategory = 'All';

  // ==========================================================================
  // SEARCH DISPATCHER
  // ==========================================================================
  async function performSearch(query, category = 'All', saveToHistory = false) {
    if (!query || !query.trim()) return;
    showLoader(true);

    searchCurrentQuery = query.trim();
    searchCurrentCategory = category;
    searchCurrentPage = 1;

    if (saveToHistory) {
      Storage.addSearchHistory(query.trim());
      UI.renderRecentSearchChips();
    }

    const isOffline = (typeof OfflineManager !== 'undefined')
      ? OfflineManager.isOffline()
      : (typeof navigator !== 'undefined' && !navigator.onLine);

    if (isOffline) {
      // Offline Search mode
      const offlineRes = (typeof SearchEngine !== 'undefined' && SearchEngine.searchOffline)
        ? SearchEngine.searchOffline(query)
        : (typeof OfflineManager !== 'undefined' ? OfflineManager.searchOffline(query) : { songs: [], artists: [], albums: [], playlists: [] });
      currentSearchResults = offlineRes.songs || [];
      UI.renderSearchResults({
        songs: { results: currentSearchResults },
        artists: { results: offlineRes.artists || [] },
        albums: { results: offlineRes.albums || [] },
        playlists: { results: offlineRes.playlists || [] }
      }, category);
      showLoader(false);
      return;
    }

    try {
      const results = await API.searchAll(query);
      currentSearchResults = results?.songs?.results?.map(API.normalizeSong) || [];
      UI.renderSearchResults(results, category);
    } catch (e) {
      console.warn('[App] Online search failed, attempting offline catalog fallback:', e);
      const offlineRes = (typeof SearchEngine !== 'undefined' && SearchEngine.searchOffline)
        ? SearchEngine.searchOffline(query)
        : (typeof OfflineManager !== 'undefined' ? OfflineManager.searchOffline(query) : { songs: [], artists: [], albums: [], playlists: [] });
      currentSearchResults = offlineRes.songs || [];
      UI.renderSearchResults({
        songs: { results: currentSearchResults },
        artists: { results: offlineRes.artists || [] },
        albums: { results: offlineRes.albums || [] },
        playlists: { results: offlineRes.playlists || [] }
      }, category);
    }
    showLoader(false);
  }

  function filterSearchCategory(category) {
    const searchCatContainer = document.getElementById('search-category-chips');
    if (searchCatContainer) {
      searchCatContainer.querySelectorAll('.search-cat-chip').forEach(c => {
        c.classList.toggle('active', c.dataset.cat === category);
      });
    }
    const q = document.getElementById('search-input')?.value.trim() || searchCurrentQuery;
    if (q) performSearch(q, category, false);
  }

  async function loadMoreSearchSongs() {
    const q = searchCurrentQuery || document.getElementById('search-input')?.value.trim();
    if (!q) return;

    searchCurrentPage++;
    showLoader(true);
    try {
      const moreSongs = await API.searchSongs(q, searchCurrentPage, 30);
      if (moreSongs && moreSongs.length > 0) {
        const startIdx = currentSearchResults.length;
        currentSearchResults.push(...moreSongs);
        UI.appendSearchSongs(moreSongs, startIdx);
      } else {
        alert('No more songs found for this query.');
      }
    } catch (e) {
      console.error('[Search] loadMore error:', e);
    }
    showLoader(false);
  }

  function setSearchQuery(term) {
    const searchInput = document.getElementById('search-input');
    navigate('search');
    if (searchInput) {
      searchInput.value = term;
      performSearch(term, 'All', true);
    }
  }

  function searchCategory(cat) {
    setSearchQuery(cat);
  }

  function clearSearchData() {
    Storage.clearSearchHistory();
    UI.renderRecentSearchChips();
  }

  // ==========================================================================
  // PLAYBACK & SEAMLESS RADIO DISPATCHERS
  // ==========================================================================
  function playSongFromSearch(index) {
    if (currentSearchResults.length > 0 && index >= 0 && index < currentSearchResults.length) {
      const clicked = currentSearchResults[index];
      if (searchCurrentQuery) {
        Storage.addSearchHistory(searchCurrentQuery);
        UI.renderRecentSearchChips();
      }
      try {
        console.log(`[Analytics] Search Interaction: query="${searchCurrentQuery}", clicked="${clicked?.name}", artist="${clicked?.artists}", pos=${index}`);
      } catch (_) {}
      Player.setQueue(currentSearchResults, index);
      expandFullPlayer();
    }
  }

  function playSongWithQueue(songId) {
    const song = (homeFeedData?.quickPicks || homeFeedData?.trending?.songs || []).find(s => s.id === songId);
    if (song) {
      Player.playSong(song, homeFeedData?.quickPicks || homeFeedData?.trending?.songs || [song]);
    } else {
      API.getSongDetails(songId).then(details => {
        if (details && details.length > 0) {
          Player.playSong(details[0], details);
        }
      });
    }
    expandFullPlayer();
  }

  function playSongFromArtistList(index) {
    if (currentArtistSongs.length > 0 && index >= 0 && index < currentArtistSongs.length) {
      Player.setQueue(currentArtistSongs, index);
      expandFullPlayer();
    }
  }

  function playSongFromFavs(index) {
    const favs = Storage.getFavorites();
    if (favs.length > 0 && index >= 0 && index < favs.length) {
      Player.setQueue(favs, index);
      expandFullPlayer();
    }
  }

  async function playMix(query) {
    showLoader(true);
    try {
      const songs = await API.searchSongs(query, 1, 24);
      if (songs.length > 0) {
        Player.setQueue(songs, 0);
        expandFullPlayer();
      }
    } catch (_) {}
    showLoader(false);
  }



  // ==========================================================================
  // CUSTOM HIGH-PRECISION SEEK INTERACTION ENGINE (Design 1 Replica)
  // ==========================================================================
  function initSeekBar() {
    const seekBar = document.getElementById('player-seek-bar');
    const seekTrack = document.getElementById('player-seek-track');
    const seekFill = document.getElementById('player-seek-fill');
    const seekThumb = document.getElementById('player-seek-thumb');
    const curTimeEl = document.getElementById('player-time-current');

    if (!seekBar) return;
    if (seekBar._isSeekInitialized) return;
    seekBar._isSeekInitialized = true;

    let isPointerDown = false;

    function getProgressFromCoord(clientX) {
      const targetEl = seekTrack || seekBar;
      const rect = targetEl.getBoundingClientRect();
      if (rect.width <= 0) return 0;
      const rawProgress = (clientX - rect.left) / rect.width;
      return Math.max(0, Math.min(1, rawProgress));
    }

    function updateVisualSeek(progress) {
      const pct = (progress * 100).toFixed(2);
      if (seekFill) seekFill.style.width = `${pct}%`;
      if (seekThumb) seekThumb.style.left = `${pct}%`;

      const duration = (typeof Player !== 'undefined' && Player.getDuration) ? Player.getDuration() : 0;
      if (curTimeEl && duration > 0) {
        curTimeEl.textContent = (typeof UI !== 'undefined' && UI.formatTime) ? UI.formatTime(progress * duration) : `${Math.floor(progress * duration / 60)}:${String(Math.floor(progress * duration % 60)).padStart(2, '0')}`;
      }
      seekBar.setAttribute('aria-valuenow', String(Math.round(pct)));
    }

    function onPointerDown(e) {
      isPointerDown = true;
      window._isUserSeeking = true;
      seekBar.classList.add('seeking');
      try {
        if (e.pointerId !== undefined && seekBar.setPointerCapture) {
          seekBar.setPointerCapture(e.pointerId);
        }
      } catch (_) {}

      const clientX = (e.clientX !== undefined) ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const progress = getProgressFromCoord(clientX);
      updateVisualSeek(progress);
    }

    function onPointerMove(e) {
      if (!isPointerDown) return;
      if (e.cancelable) e.preventDefault();
      const clientX = (e.clientX !== undefined) ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const progress = getProgressFromCoord(clientX);
      updateVisualSeek(progress);
    }

    function onPointerUp(e) {
      if (!isPointerDown) return;
      isPointerDown = false;
      seekBar.classList.remove('seeking');
      try {
        if (e.pointerId !== undefined && seekBar.releasePointerCapture) {
          seekBar.releasePointerCapture(e.pointerId);
        }
      } catch (_) {}

      const clientX = (e.clientX !== undefined) ? e.clientX : (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0));
      const progress = getProgressFromCoord(clientX);
      updateVisualSeek(progress);

      const duration = (typeof Player !== 'undefined' && Player.getDuration) ? Player.getDuration() : 0;
      if (duration > 0 && typeof Player !== 'undefined' && Player.seek) {
        const targetSeconds = progress * duration;
        Player.seek(targetSeconds);
      }

      setTimeout(() => {
        window._isUserSeeking = false;
      }, 60);
    }

    // Pointer Events (Desktop Mouse + Touch + Android WebView)
    seekBar.addEventListener('pointerdown', onPointerDown, { passive: false });
    seekBar.addEventListener('pointermove', onPointerMove, { passive: false });
    seekBar.addEventListener('pointerup', onPointerUp);
    seekBar.addEventListener('pointercancel', onPointerUp);

    // Fallback touch events for environments without PointerEvent support
    if (typeof window !== 'undefined' && !window.PointerEvent) {
      seekBar.addEventListener('touchstart', onPointerDown, { passive: false });
      seekBar.addEventListener('touchmove', onPointerMove, { passive: false });
      seekBar.addEventListener('touchend', onPointerUp);
      seekBar.addEventListener('touchcancel', onPointerUp);
    }
  }

  // ==========================================================================
  // SINGLE AUTHORITATIVE LIKE / FAVORITES SYSTEM
  // ==========================================================================
  let isTogglingFavorite = false;
  async function toggleFavoriteCurrent() {
    if (isTogglingFavorite) return;
    isTogglingFavorite = true;

    try {
      const song = Player.getCurrentTrack();
      if (!song || !song.id) {
        isTogglingFavorite = false;
        return;
      }

      const isFav = Storage.toggleFavorite(song);
      UI.updatePlayerBar(song);
      UI.showToast(isFav ? 'Added to Favorites ❤️' : 'Removed from Favorites');

      if (isFav && typeof SmartDownloadManager !== 'undefined' && SmartDownloadManager.handleLikeEvent) {
        SmartDownloadManager.handleLikeEvent(song);
      }

      if (activeLibraryTab === 'liked' || activeLibraryTab === 'playlists') {
        UI.renderLibraryTab(activeLibraryTab, librarySearchQuery, librarySortMode);
      }
    } catch (err) {
      console.warn('[App] toggleFavoriteCurrent error:', err);
    } finally {
      setTimeout(() => {
        isTogglingFavorite = false;
      }, 100);
    }
  }

  function openCurrentSongMenu() {
    const cur = Player.getCurrentTrack();
    if (cur && cur.id) {
      openSongMenu(cur.id);
    } else {
      UI.showToast('No track currently playing.');
    }
  }

  function openAudioOutputSheet() {
    if (typeof AudioOutputManager !== 'undefined') {
      AudioOutputManager.refreshDevices().then(() => {
        AudioOutputManager.renderOutputSheet();
        openBottomSheet('sheet-audio-output');
      }).catch(() => {
        openBottomSheet('sheet-audio-output');
      });
    } else {
      openBottomSheet('sheet-audio-output');
    }
  }

  function openCastOutputDialog() {
    openAudioOutputSheet();
  }

  // ==========================================================================
  // DIRECT AUDIO DOWNLOAD (NATIVE IN-BROWSER / IN-APP BLOB SAVE)
  // ==========================================================================
  async function downloadCurrentTrack() {
    const song = Player.getCurrentTrack();
    if (!song) {
      UI.showToast('No track currently playing.');
      return;
    }
    await downloadTrack(song);
  }

  async function downloadTrack(song) {
    if (!song) return;

    // Deduplication check
    if (typeof DownloadManager !== 'undefined') {
      const status = DownloadManager.getStatus(song.id);
      if (status === 'COMPLETED') {
        UI.showToast(`"${song.name}" is already downloaded ⬇️`);
        return;
      }
      DownloadManager.enqueue(song);
      UI.showToast(`Queued "${song.name}" for download ⏳`);
      return;
    }

    if (Storage.isDownloaded(song.id)) {
      UI.showToast(`"${song.name}" is already downloaded ⬇️`);
      return;
    }
  }

  // ==========================================================================
  // FULL PLAYER & LYRICS EXPANSION (Single Header System)
  // ==========================================================================
  function expandFullPlayer() {
    const sheet = document.getElementById('full-player');
    if (sheet) sheet.classList.add('expanded');
    UI.updateShuffleState(Player.getIsShuffle());
    UI.updateRepeatState(Player.getRepeatMode());
    const cur = Player.getCurrentTrack();
    if (cur) UI.updatePlayerBar(cur);
  }

  function collapseFullPlayer() {
    const sheet = document.getElementById('full-player');
    if (sheet) sheet.classList.remove('expanded');
  }

  function handlePlayerBack() {
    const lyricsView = document.getElementById('player-lyrics-view');
    if (lyricsView && lyricsView.style.display === 'flex') {
      toggleLyricsView();
    } else {
      collapseFullPlayer();
    }
  }

  function handlePlayerRightAction() {
    const lyricsView = document.getElementById('player-lyrics-view');
    if (lyricsView && lyricsView.style.display === 'flex') {
      openEqualizer();
    } else {
      openCurrentSongMenu();
    }
  }

  function toggleLyricsView() {
    const artView = document.getElementById('player-art-view');
    const lyricsView = document.getElementById('player-lyrics-view');
    const toggleBtn = document.getElementById('btn-toggle-lyrics');
    const backIcon = document.getElementById('player-back-icon');
    const rightIcon = document.getElementById('player-right-icon');
    const contextTag = document.getElementById('player-context-tag');
    const contextTitle = document.getElementById('player-context-title');

    if (!artView || !lyricsView) return;
    const isLyricsActive = lyricsView.style.display === 'flex';

    if (isLyricsActive) {
      lyricsView.style.display = 'none';
      artView.style.display = 'flex';
      toggleBtn?.classList.remove('active');
      if (backIcon) backIcon.textContent = 'keyboard_arrow_down';
      if (rightIcon) rightIcon.textContent = 'more_vert';
      if (contextTag) contextTag.textContent = 'PLAYING FROM';
      if (contextTitle) contextTitle.textContent = Player.getCurrentTrack()?.album || 'Top Hits';
    } else {
      artView.style.display = 'none';
      lyricsView.style.display = 'flex';
      toggleBtn?.classList.add('active');
      if (backIcon) backIcon.textContent = 'arrow_back';
      if (rightIcon) rightIcon.textContent = 'equalizer';
      if (contextTag) contextTag.textContent = 'SYNCHRONIZED';
      if (contextTitle) contextTitle.textContent = 'Live Lyrics';
    }
  }

  // ==========================================================================
  // PROCEDURAL WEB AUDIO SOUNDSCAPES
  // ==========================================================================
  function toggleSoundscape(soundType) {
    if (currentSoundscape === soundType) {
      stopSoundscape();
      return;
    }
    stopSoundscape();
    currentSoundscape = soundType;

    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const bufferSize = audioContext.sampleRate * 3;
      const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = audioContext.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = audioContext.createBiquadFilter();
      if (soundType === 'rain') {
        filter.type = 'lowpass';
        filter.frequency.value = 800;
      } else if (soundType === 'waves') {
        filter.type = 'bandpass';
        filter.frequency.value = 400;
        filter.Q.value = 1.2;
      } else {
        filter.type = 'lowpass';
        filter.frequency.value = 1200;
      }

      const gain = audioContext.createGain();
      gain.gain.value = 0.15;

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(audioContext.destination);

      noise.start();
      activeSoundscapeNode = { source: noise, gain };

      document.querySelectorAll('.soundscape-card').forEach(c => {
        c.classList.toggle('active', c.dataset.sound === soundType);
      });
    } catch (e) {
      console.warn('[Soundscape] error:', e);
    }
  }

  function stopSoundscape() {
    if (activeSoundscapeNode) {
      try {
        activeSoundscapeNode.source.stop();
        activeSoundscapeNode.source.disconnect();
      } catch (_) {}
      activeSoundscapeNode = null;
    }
    currentSoundscape = null;
    document.querySelectorAll('.soundscape-card').forEach(c => c.classList.remove('active'));
  }

  // ==========================================================================
  // MODALS & SHEETS DISPATCHERS
  // ==========================================================================
  let wasSettingsOpenBeforeDialog = false;

  function openBottomSheet(sheetId) {
    const el = document.getElementById(sheetId);
    if (el) el.classList.add('active');
  }

  function closeBottomSheet(sheetId) {
    const el = document.getElementById(sheetId);
    if (el) el.classList.remove('active');
  }

  function openDialog(dialogId) {
    const el = document.getElementById(dialogId);
    if (el) el.classList.add('active');
  }

  function closeDialog(dialogId) {
    const el = document.getElementById(dialogId);
    if (el) el.classList.remove('active');
    if (wasSettingsOpenBeforeDialog) {
      wasSettingsOpenBeforeDialog = false;
      openBottomSheet('sheet-settings');
    }
  }

  async function openSongMenu(songId) {
    let song = (homeFeedData?.quickPicks || homeFeedData?.trending?.songs || []).find(s => s.id === songId);
    if (!song) {
      const details = await API.getSongDetails(songId);
      if (details && details.length > 0) song = details[0];
    }
    if (!song) return;

    activeSongForMenu = song;
    document.getElementById('sheet-song-img').src = song.image || 'assets/logo.png';
    document.getElementById('sheet-song-title').textContent = song.name;
    document.getElementById('sheet-song-artist').textContent = song.artists;

    const isFav = Storage.isFavorite(song.id);
    document.getElementById('sheet-like-icon').textContent = isFav ? 'favorite' : 'favorite_border';
    document.getElementById('sheet-like-label').textContent = isFav ? 'Unlike' : 'Like';

    openBottomSheet('sheet-song-menu');
  }

  function openCurrentSongMenu() {
    const track = Player.getCurrentTrack();
    if (track) openSongMenu(track.id);
  }

  function sheetAction(action) {
    const song = activeSongForMenu;
    closeBottomSheet('sheet-song-menu');
    if (!song) return;

    switch (action) {
      case 'play-next':
        Player.playNext(song);
        break;
      case 'add-queue':
        Player.appendToQueue(song);
        break;
      case 'start-radio':
        startRadio(song);
        break;
      case 'download':
        downloadTrack(song);
        break;
      case 'go-artist':
        collapseFullPlayer();
        openArtist(song.primaryArtist || song.artists);
        break;
      case 'go-album':
        if (song.albumId) openAlbumOrPlaylist(song.albumId, 'album');
        break;
      case 'add-playlist':
        openPlaylistPicker(song);
        break;
      case 'open-equalizer':
        openEqualizer();
        break;
      case 'toggle-like':
        Storage.toggleFavorite(song);
        if (Player.getCurrentTrack()?.id === song.id) UI.updatePlayerBar(song);
        break;
      case 'share':
        if (navigator.share) {
          navigator.share({ title: song.name, text: `Listen to ${song.name} by ${song.artists} on MusicFlow`, url: window.location.href });
        } else {
          navigator.clipboard.writeText(`${song.name} by ${song.artists}`);
          alert('Song info copied to clipboard!');
        }
        break;
    }
  }

  // ==========================================================================
  // MUSIC LANGUAGES PICKER (Immediate Live Reflection)
  // ==========================================================================
  function openLanguagesDialog() {
    if (document.getElementById('sheet-settings')?.classList.contains('active')) {
      wasSettingsOpenBeforeDialog = true;
      closeBottomSheet('sheet-settings');
    } else {
      wasSettingsOpenBeforeDialog = false;
    }
    tempSelectedLanguages = [...Storage.getLanguages()];
    UI.renderLanguagesPicker(tempSelectedLanguages);
    openDialog('dialog-language-picker');
  }

  function toggleLanguageSelection(langKey) {
    if (tempSelectedLanguages.includes(langKey)) {
      if (tempSelectedLanguages.length > 1) {
        tempSelectedLanguages = tempSelectedLanguages.filter(l => l !== langKey);
      }
    } else {
      tempSelectedLanguages.push(langKey);
    }
    // Reflect immediately in Storage & UI
    Storage.setLanguages(tempSelectedLanguages);
    UI.renderLanguagesPicker(tempSelectedLanguages);
    UI.renderSettingsSheet();
    // Live update home feed in background
    loadHomeFeed();
  }

  async function saveLanguagesAndRefresh() {
    Storage.setLanguages(tempSelectedLanguages);
    closeDialog('dialog-language-picker');
    UI.renderSettingsSheet();
    showLoader(true);
    await loadHomeFeed();
    showLoader(false);
  }

  // ==========================================================================
  // PLAYLIST MODAL PICKER
  // ==========================================================================
  function openPlaylistPicker(song) {
    activeSongForMenu = song || Player.getCurrentTrack();
    UI.renderPlaylistPicker(Storage.getPlaylists(), activeSongForMenu);
    openDialog('dialog-playlist-picker');
  }

  function promptCreatePlaylistAndAdd() {
    const name = prompt('Enter new playlist name:');
    if (name && activeSongForMenu) {
      const pl = Storage.createPlaylist(name);
      Storage.addSongToPlaylist(pl.id, activeSongForMenu);
      closeDialog('dialog-playlist-picker');
      alert(`Added "${activeSongForMenu.name}" to "${name}"`);
    }
  }

  function addSongToSpecificPlaylist(playlistId) {
    if (activeSongForMenu) {
      Storage.addSongToPlaylist(playlistId, activeSongForMenu);
      closeDialog('dialog-playlist-picker');
      const pl = Storage.getPlaylists().find(p => p.id === playlistId);
      alert(`Added "${activeSongForMenu.name}" to "${pl?.name || 'Playlist'}"`);
    }
  }

  // ==========================================================================
  // AUDIO EFFECTS & EQUALIZER 2.0 (EqualizerScreen.kt in Android)
  // ==========================================================================
  function openEqualizer() {
    if (document.getElementById('sheet-settings')?.classList.contains('active')) {
      wasSettingsOpenBeforeDialog = true;
      closeBottomSheet('sheet-settings');
    } else {
      wasSettingsOpenBeforeDialog = false;
    }
    const fx = Storage.getAudioEffects();
    UI.renderEqualizerUI(fx);
    openBottomSheet('sheet-equalizer');
  }

  function closeEqualizer() {
    closeBottomSheet('sheet-equalizer');
    if (wasSettingsOpenBeforeDialog) {
      wasSettingsOpenBeforeDialog = false;
      openBottomSheet('sheet-settings');
    }
  }

  function toggleEq(enabled) {
    Player.setEqEnabled(enabled);
    UI.renderEqualizerUI(Storage.getAudioEffects());
  }

  function selectEqPreset(presetName) {
    Player.setEqPreset(presetName);
    UI.renderEqualizerUI(Storage.getAudioEffects());
  }

  function setSpatialLevel(level) {
    Player.setSpatial(level);
    UI.renderEqualizerUI(Storage.getAudioEffects());
  }

  function updateEqBand(index, value) {
    const val = parseFloat(value);
    Player.setEqBand(index, val);
    const valEl = document.getElementById(`eq-val-${index}`);
    if (valEl) {
      valEl.textContent = `${val > 0 ? '+' + val : val}dB`;
      valEl.style.color = val > 0 ? '#FF2A4D' : (val < 0 ? '#4da6ff' : 'var(--text-secondary)');
    }
  }

  function updateBassBoost(value) {
    const val = parseFloat(value);
    Player.setBassBoost(val);
    const bassVal = document.getElementById('eq-bass-val');
    if (bassVal) bassVal.textContent = `${val > 0 ? '+' + val : val} dB`;
  }

  function updateTrebleBoost(value) {
    const val = parseFloat(value);
    Player.setTrebleBoost(val);
    const trebleVal = document.getElementById('eq-treble-val');
    if (trebleVal) trebleVal.textContent = `${val > 0 ? '+' + val : val} dB`;
  }

  function updateVocalBoost(value) {
    const val = parseFloat(value);
    Player.setVocalBoost(val);
    const vocalVal = document.getElementById('eq-vocal-val');
    if (vocalVal) vocalVal.textContent = `${val > 0 ? '+' + val : val} dB`;
  }

  function updateVirtualizer(value) {
    const val = parseFloat(value);
    Player.setVirtualizerStrength(val);
  }

  function toggleNormalization(enabled) {
    Player.setNormalization(enabled);
  }

  function selectCrossfade(seconds) {
    Player.setCrossfade(parseInt(seconds, 10));
  }

  function promptSaveCustomPreset() {
    const name = prompt('Enter a name for your custom preset:');
    if (name && name.trim()) {
      const cleanName = name.trim().slice(0, 30);
      if (typeof AudioEffectsEngine !== 'undefined') {
        AudioEffectsEngine.saveCustomPreset(cleanName);
      }
      UI.renderEqualizerUI(Storage.getAudioEffects());
      UI.showToast(`Saved preset "${cleanName}"`);
    }
  }

  function deleteCustomPreset(name) {
    if (confirm(`Delete custom preset "${name}"?`)) {
      if (typeof AudioEffectsEngine !== 'undefined') {
        AudioEffectsEngine.deleteCustomPreset(name);
      }
      UI.renderEqualizerUI(Storage.getAudioEffects());
      UI.showToast(`Deleted preset "${name}"`);
    }
  }

  function resetAudioEffects() {
    Player.resetAudioEffects();
    UI.renderEqualizerUI(Storage.getAudioEffects());
    UI.showToast('Audio effects reset to defaults');
  }

  // ==========================================================================
  // SLEEP TIMER
  // ==========================================================================
  function openSleepTimerDialog() {
    if (document.getElementById('sheet-settings')?.classList.contains('active')) {
      wasSettingsOpenBeforeDialog = true;
      closeBottomSheet('sheet-settings');
    } else {
      wasSettingsOpenBeforeDialog = false;
    }
    const state = (typeof Player !== 'undefined' && Player.getSleepTimerState) ? Player.getSleepTimerState() : { active: false };
    UI.renderSleepTimerDialog(state);
    openDialog('dialog-sleep-timer');
  }

  function setSleepPreset(option) {
    closeDialog('dialog-sleep-timer');
    const state = Player.setSleepTimer(option);
    if (state.active) {
      if (state.mode === 'end_of_track') {
        UI.showToast('🌙 Sleep timer set for end of current song');
      } else {
        UI.showToast(`🌙 Sleep timer set for ${state.durationMinutes} minutes`);
      }
    } else {
      UI.showToast('Sleep timer turned off');
    }
    UI.updateSleepTimerUI(state);
  }

  function addSleepMinutes(extraMins) {
    const state = Player.addSleepTimerMinutes(extraMins || 15);
    UI.renderSleepTimerDialog(state);
    UI.updateSleepTimerUI(state);
    UI.showToast(`+${extraMins || 15} min added to sleep timer`);
  }

  function cancelSleepTimer() {
    closeDialog('dialog-sleep-timer');
    const state = Player.setSleepTimer(0);
    UI.updateSleepTimerUI(state);
    UI.showToast('Sleep timer cancelled');
  }

  function onCustomSleepInput(val) {
    const valEl = document.getElementById('sleep-custom-val');
    if (valEl) valEl.textContent = `${val} min`;
  }

  function setCustomSleepTimer() {
    const slider = document.getElementById('sleep-custom-slider');
    const mins = parseInt(slider?.value || '45', 10);
    if (isNaN(mins) || mins < 5 || mins > 180) {
      UI.showToast('Please select between 5 and 180 minutes');
      return;
    }
    setSleepPreset(mins);
  }

  // ==========================================================================
  // QUEUE MANAGEMENT
  // ==========================================================================
  function openQueueSheet() {
    UI.renderQueueSheet(Player.getQueue(), Player.getQueue().findIndex(s => s.id === Player.getCurrentTrack()?.id));
    openBottomSheet('sheet-queue');
  }

  function removeTrackFromQueue(index) {
    Player.removeFromQueue(index);
  }

  // ==========================================================================
  // SETTINGS & PROFILE
  // ==========================================================================
  function openSettings() {
    UI.renderSettingsSheet();
    openBottomSheet('sheet-settings');
  }

  function openQualityDialog() {
    if (document.getElementById('sheet-settings')?.classList.contains('active')) {
      wasSettingsOpenBeforeDialog = true;
      closeBottomSheet('sheet-settings');
    } else {
      wasSettingsOpenBeforeDialog = false;
    }
    UI.renderQualityOptions(Storage.getAudioQuality());
    openDialog('dialog-quality');
  }

  function selectQuality(quality) {
    Storage.setAudioQuality(quality);
    closeDialog('dialog-quality');
    const badge = document.getElementById('player-quality-badge');
    if (badge) badge.textContent = quality === '320kbps' ? 'LOSSLESS • 320 KBPS' : `STREAM • ${quality.toUpperCase()}`;
    const setVal = document.getElementById('settings-quality-val');
    if (setVal) setVal.textContent = quality;
  }

  function promptChangeName() {
    const newName = prompt('Enter your name for greeting:', Storage.getUserName());
    if (newName) {
      Storage.setUserName(newName);
      UI.renderHomeGreeting();
      const nameVal = document.getElementById('settings-name-val');
      if (nameVal) nameVal.textContent = newName;
    }
  }

  function promptChangeAvatar() {
    const newAvatar = prompt('Enter image URL for avatar:', Storage.getUserAvatar());
    if (newAvatar && newAvatar.trim().startsWith('http')) {
      Storage.setUserAvatar(newAvatar.trim());
      applyPreferences();
      const setImg = document.getElementById('settings-avatar-img');
      if (setImg) setImg.src = newAvatar.trim();
    }
  }

  function cyclePerformanceMode() {
    const current = Storage.getPerformanceMode();
    const nextMode = current === 'auto' ? 'high' : (current === 'high' ? 'lite' : 'auto');
    Storage.setPerformanceMode(nextMode);
    applyPreferences();
    UI.renderSettingsSheet();
  }

  function toggleAmbientGlow(enabled) {
    Storage.setAmbientLighting(enabled);
    applyPreferences();
  }

  function clearListeningHistory() {
    if (confirm('Clear all listening history?')) {
      Storage.clearHistory();
      UI.renderLibraryTab('history', librarySearchQuery, librarySortMode);
      loadHomeFeed();
    }
  }

  function openLikedSongs() {
    const favs = Storage.getFavorites();
    if (favs.length > 0) {
      Player.setQueue(favs, 0);
      expandFullPlayer();
    } else {
      alert('No liked songs in your library yet.');
    }
  }

  function playLikedSongs() {
    const favs = Storage.getFavorites();
    if (favs.length > 0) {
      Player.setQueue(favs, 0);
      expandFullPlayer();
    }
  }

  function shuffleLikedSongs() {
    const favs = Storage.getFavorites();
    if (favs.length > 0) {
      const shuffled = [...favs].sort(() => Math.random() - 0.5);
      Player.setQueue(shuffled, 0);
      expandFullPlayer();
    }
  }

  function playSongFromFavsList(idx) {
    const favs = Storage.getFavorites();
    if (favs.length > 0) {
      Player.setQueue(favs, idx || 0);
      expandFullPlayer();
    }
  }

  function playDownloadedSongs() {
    const dl = Storage.getDownloads();
    if (dl.length > 0) {
      Player.setQueue(dl, 0);
      expandFullPlayer();
    }
  }

  function removeDownloadTrack(songId) {
    Storage.removeDownload(songId);
    UI.renderLibraryTab('downloads', librarySearchQuery, librarySortMode);
  }

  // --- Smart Downloads & Storage Management (Phase 9.3) ---
  function toggleSmartDownloads(enabled) {
    Storage.setSmartDownloadsEnabled(enabled);
    if (enabled && typeof SmartDownloadManager !== 'undefined') {
      SmartDownloadManager.evaluateAndEnqueueSmartDownloads();
      UI.showToast('Smart Downloads enabled ⚡');
    }
    applyPreferences();
    if (activeLibraryTab === 'downloads') {
      UI.renderLibraryTab('downloads', librarySearchQuery, librarySortMode);
    }
  }

  function toggleDownloadWifiOnly(wifiOnly) {
    Storage.setDownloadWifiOnly(wifiOnly);
    applyPreferences();
  }

  function toggleAutoDownloadLikes(enabled) {
    Storage.setAutoDownloadLikesEnabled(enabled);
    if (enabled && typeof SmartDownloadManager !== 'undefined') {
      SmartDownloadManager.evaluateAndEnqueueSmartDownloads();
      UI.showToast('Auto-download for Liked Songs enabled 💖');
    }
    applyPreferences();
  }

  function openStorageLimitDialog() {
    const current = Storage.getDownloadStorageLimitMb();
    const promptText = `Set Maximum Offline Storage Limit (in MB):\n• 1024 (1 GB)\n• 2048 (2 GB)\n• 5120 (5 GB)\n• 10240 (10 GB)\n• 20480 (20 GB)\n\nEnter MB limit:`;
    const input = prompt(promptText, String(current));
    if (input && !isNaN(Number(input)) && Number(input) > 0) {
      Storage.setDownloadStorageLimitMb(Number(input));
      applyPreferences();
      if (activeLibraryTab === 'downloads') {
        UI.renderLibraryTab('downloads', librarySearchQuery, librarySortMode);
      }
    }
  }

  function openAutoCleanupDialog() {
    const promptText = `Select Auto-Cleanup Policy:\n1. never (Never delete)\n2. older_30_days (Older than 30 days)\n3. older_90_days (Older than 90 days)\n4. least_played (Least played / oldest)\n\nEnter choice (1, 2, 3, or 4):`;
    const input = prompt(promptText, '1');
    let policy = 'never';
    if (input === '2') policy = 'older_30_days';
    else if (input === '3') policy = 'older_90_days';
    else if (input === '4') policy = 'least_played';
    Storage.setAutoCleanupPolicy(policy);
    applyPreferences();
  }

  function toggleProtectedDownloadAction(songId) {
    if (!songId) return;
    const isNowProt = Storage.toggleProtectedDownload(songId);
    UI.showToast(isNowProt ? 'Download pinned (Protected from auto-cleanup) 📌' : 'Download unpinned');
    if (activeLibraryTab === 'downloads') {
      UI.renderLibraryTab('downloads', librarySearchQuery, librarySortMode);
    }
  }

  async function openStorageCleanupDialog() {
    if (typeof SmartDownloadManager === 'undefined') return;
    const preview = SmartDownloadManager.previewCleanup('least_played');
    if (preview.willRemoveCount === 0) {
      UI.showToast('No unpinned/unliked downloads to clean up! ✨');
      return;
    }
    const msg = `Storage Cleanup Preview:\n\n• Will remove: ${preview.willRemoveCount} unpinned tracks (${preview.willRemoveMb} MB)\n• Will keep: ${preview.willKeepCount} tracks (${preview.willKeepMb} MB)\n\nProceed with cleanup?`;
    if (confirm(msg)) {
      const removed = await SmartDownloadManager.executeCleanup(preview.candidatesToRemove);
      UI.showToast(`Cleaned up ${removed} tracks (${preview.willRemoveMb} MB freed) 🧹`);
      UI.renderLibraryTab('downloads', librarySearchQuery, librarySortMode);
    }
  }

  function removeHistoryTrack(songId) {
    Storage.removeHistoryItem(songId);
    UI.renderLibraryTab('history', librarySearchQuery, librarySortMode);
  }

  function startArtistRadioSeed(artistName) {
    startArtistRadio(artistName);
  }

  function unfollowArtistAction(artistId) {
    Storage.unfollowArtist(artistId);
    UI.renderLibraryTab('artists', librarySearchQuery, librarySortMode);
  }

  function handleLocalAudioUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const streamUrl = URL.createObjectURL(file);
      const name = file.name.replace(/\.[^/.]+$/, '');
      localUploadedSongs.push({
        id: `local_${Date.now()}_${i}`,
        name,
        artists: 'Local File',
        streamUrl,
        image: 'assets/logo.png',
        duration: 0,
        isLocal: true
      });
    }
    UI.renderLibraryTab('local', librarySearchQuery, librarySortMode);
  }

  function playLocalTrack(songId) {
    const track = localUploadedSongs.find(s => s.id === songId);
    if (track) {
      Player.setQueue(localUploadedSongs, localUploadedSongs.indexOf(track));
      expandFullPlayer();
    }
  }

  function getLocalSongs() {
    return localUploadedSongs;
  }

  function openLibraryTab(tabName) {
    activeLibraryTab = tabName || 'playlists';
    const libTabsContainer = document.getElementById('library-tabs-bar');
    if (libTabsContainer) {
      libTabsContainer.querySelectorAll('.lib-tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === activeLibraryTab);
      });
    }
    UI.renderLibraryTab(activeLibraryTab, librarySearchQuery, librarySortMode);
  }

  function setLibrarySort(sortMode) {
    librarySortMode = sortMode;
    UI.renderLibraryTab(activeLibraryTab, librarySearchQuery, librarySortMode);
  }

  function openCreatePlaylistModal() {
    editingPlaylistId = null;
    const titleEl = document.getElementById('modal-playlist-editor-title');
    const nameInp = document.getElementById('input-edit-pl-name');
    const descInp = document.getElementById('input-edit-pl-desc');
    if (titleEl) titleEl.textContent = 'Create Playlist';
    if (nameInp) nameInp.value = '';
    if (descInp) descInp.value = '';
    const modal = document.getElementById('modal-create-playlist');
    if (modal) modal.style.display = 'flex';
  }

  function openEditPlaylistModal(playlistId) {
    const pl = Storage.getPlaylists().find(p => p.id === playlistId);
    if (!pl) return;
    editingPlaylistId = playlistId;
    const titleEl = document.getElementById('modal-playlist-editor-title');
    const nameInp = document.getElementById('input-edit-pl-name');
    const descInp = document.getElementById('input-edit-pl-desc');
    if (titleEl) titleEl.textContent = 'Edit Playlist';
    if (nameInp) nameInp.value = pl.name || '';
    if (descInp) descInp.value = pl.description || '';
    const modal = document.getElementById('modal-create-playlist');
    if (modal) modal.style.display = 'flex';
  }

  function closeCreatePlaylistModal() {
    const modal = document.getElementById('modal-create-playlist');
    if (modal) modal.style.display = 'none';
    editingPlaylistId = null;
  }

  function submitPlaylistEditor() {
    const nameInp = document.getElementById('input-edit-pl-name');
    const descInp = document.getElementById('input-edit-pl-desc');
    const name = nameInp ? nameInp.value.trim() : '';
    const desc = descInp ? descInp.value.trim() : '';
    if (!name) {
      alert('Please enter a playlist name');
      return;
    }
    if (editingPlaylistId) {
      Storage.editPlaylist(editingPlaylistId, { name, description: desc });
    } else {
      Storage.createPlaylist(name, desc);
    }
    closeCreatePlaylistModal();
    UI.renderLibraryTab('playlists', librarySearchQuery, librarySortMode);
  }

  function openPlaylistMenu(playlistId) {
    const pl = Storage.getPlaylists().find(p => p.id === playlistId);
    if (!pl) return;
    selectedMenuPlaylistId = playlistId;
    const titleEl = document.getElementById('pl-action-title');
    const subEl = document.getElementById('pl-action-sub');
    if (titleEl) titleEl.textContent = pl.name;
    if (subEl) subEl.textContent = `${pl.songs?.length || 0} tracks`;
    const sheet = document.getElementById('sheet-playlist-actions');
    if (sheet) sheet.style.display = 'flex';
  }

  function closePlaylistMenu() {
    const sheet = document.getElementById('sheet-playlist-actions');
    if (sheet) sheet.style.display = 'none';
  }

  let activeDetailPlaylistId = null;
  let draggedPlaylistTrackIndex = -1;

  function playCustomPlaylistTrack(playlistId, trackIndex = 0) {
    const pl = Storage.getPlaylistById(playlistId);
    if (pl && pl.songs && pl.songs.length > 0) {
      const idx = Math.max(0, Math.min(trackIndex, pl.songs.length - 1));
      Player.setQueue(pl.songs, idx);
      expandFullPlayer();
    } else {
      UI.showToast('Playlist is empty.');
    }
  }

  function playCustomPlaylist(playlistId) {
    playCustomPlaylistTrack(playlistId, 0);
  }

  function shuffleCustomPlaylist(playlistId) {
    const pl = Storage.getPlaylistById(playlistId);
    if (pl && pl.songs && pl.songs.length > 0) {
      Player.setQueue(pl.songs, 0);
      if (!Player.getIsShuffle()) Player.toggleShuffle();
      expandFullPlayer();
    } else {
      UI.showToast('Playlist is empty.');
    }
  }

  function playNextPlaylist(playlistId) {
    const pl = Storage.getPlaylistById(playlistId);
    if (pl && pl.songs && pl.songs.length > 0) {
      pl.songs.forEach(s => Player.insertNext(s));
      UI.showToast(`Playing ${pl.songs.length} tracks next`);
    }
  }

  function addPlaylistToQueue(playlistId) {
    const pl = Storage.getPlaylistById(playlistId);
    if (pl && pl.songs && pl.songs.length > 0) {
      pl.songs.forEach(s => Player.addToQueue(s));
      UI.showToast(`Added ${pl.songs.length} tracks to queue`);
    }
  }

  function duplicateCustomPlaylist(playlistId) {
    Storage.duplicatePlaylist(playlistId);
    UI.showToast('Playlist duplicated');
    UI.renderLibraryTab('playlists', librarySearchQuery, librarySortMode);
  }

  function deleteCustomPlaylist(playlistId) {
    if (confirm('Delete this playlist?')) {
      Storage.deletePlaylist(playlistId);
      UI.showToast('Playlist deleted');
      if (activeDetailPlaylistId === playlistId) {
        navigate('library');
      }
      UI.renderLibraryTab('playlists', librarySearchQuery, librarySortMode);
    }
  }

  function openSongMenu(songId, context = '') {
    let song = null;
    if (typeof songId === 'object') song = songId;
    else {
      song = Storage.getFavorites().find(s => String(s.id) === String(songId)) ||
             Storage.getHistory().find(s => String(s.id) === String(songId)) ||
             Storage.getDownloads().find(s => String(s.id) === String(songId)) ||
             localUploadedSongs.find(s => String(s.id) === String(songId)) ||
             currentArtistSongs.find(s => String(s.id) === String(songId)) ||
             Player.getCurrentTrack();
    }
    if (!song) return;
    selectedMenuSong = song;
    selectedMenuPlaylistId = context && context.startsWith('pl_') ? context : null;

    const titleEl = document.getElementById('song-action-title');
    const subEl = document.getElementById('song-action-sub');
    const artEl = document.getElementById('song-action-img');
    const favIcon = document.getElementById('song-act-fav-icon');
    const favText = document.getElementById('song-act-fav-text');
    const removePlBtn = document.getElementById('btn-song-act-remove-pl');

    if (titleEl) titleEl.textContent = song.name;
    if (subEl) subEl.textContent = song.artists || song.primaryArtist || 'Unknown Artist';
    if (artEl) artEl.src = song.image || 'assets/logo.png';

    const isFav = Storage.isFavorite(song);
    if (favIcon) favIcon.textContent = isFav ? 'favorite' : 'favorite_border';
    if (favIcon) favIcon.style.color = isFav ? '#FF2A4D' : '';
    if (favText) favText.textContent = isFav ? 'Unlike' : 'Favorite';

    if (removePlBtn) removePlBtn.style.display = selectedMenuPlaylistId ? 'flex' : 'none';

    const sheet = document.getElementById('sheet-song-actions');
    if (sheet) sheet.style.display = 'flex';
  }

  function closeSongMenu() {
    const sheet = document.getElementById('sheet-song-actions');
    if (sheet) sheet.style.display = 'none';
  }

  function openAddToPlaylistModal(song) {
    if (song) selectedMenuSong = song;
    const modal = document.getElementById('modal-add-to-playlist');
    const container = document.getElementById('modal-playlists-container');
    const pls = Storage.getPlaylists().filter(p => p.id !== 'favorites_pl');
    if (container) {
      if (pls.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-secondary); padding:10px 0; font-size:13px;">No custom playlists yet. Create one above!</p>';
      } else {
        container.innerHTML = pls.map(p => `
          <div class="modal-pl-item" onclick="App.addSongToSpecificPlaylist('${p.id}')">
            <span class="material-symbols-outlined" style="color:#FF2A4D;">queue_music</span>
            <div>
              <div style="font-weight:700; font-size:14px; color:#fff;">${p.name}</div>
              <div style="font-size:11.5px; color:var(--text-secondary);">${p.songs?.length || 0} songs</div>
            </div>
          </div>
        `).join('');
      }
    }
    if (modal) modal.style.display = 'flex';
  }

  function closeAddToPlaylistModal() {
    const modal = document.getElementById('modal-add-to-playlist');
    if (modal) modal.style.display = 'none';
  }

  function createAndAddSongToPlaylist() {
    const input = document.getElementById('input-modal-new-pl-name');
    const name = input ? input.value.trim() : '';
    if (!name) return;
    const newPl = Storage.createPlaylist(name);
    if (selectedMenuSong) {
      Storage.addToPlaylist(newPl.id, selectedMenuSong);
      UI.showToast(`Added to "${newPl.name}"`);
    }
    if (input) input.value = '';
    closeAddToPlaylistModal();
    UI.renderLibraryTab('playlists', librarySearchQuery, librarySortMode);
  }

  function addSongToSpecificPlaylist(playlistId) {
    if (selectedMenuSong) {
      const added = Storage.addToPlaylist(playlistId, selectedMenuSong);
      const pl = Storage.getPlaylistById(playlistId);
      if (added) {
        UI.showToast(`Added to "${pl ? pl.name : 'Playlist'}"`);
      } else {
        UI.showToast('Song is already in this playlist');
      }
    }
    closeAddToPlaylistModal();
    UI.renderLibraryTab('playlists', librarySearchQuery, librarySortMode);
  }

  function openCustomPlaylist(playlistId, addToHistory = true) {
    if (playlistId === 'favorites_pl' || playlistId === 'liked') {
      openLikedSongs();
      return;
    }
    const pl = Storage.getPlaylistById(playlistId);
    if (!pl) return;
    activeDetailPlaylistId = playlistId;

    if (addToHistory) {
      pushHistory('detail', { playlistId });
    }

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const detailScreen = document.getElementById('screen-detail');
    if (detailScreen) detailScreen.classList.add('active');

    UI.renderPlaylistDetail(playlistId);
  }

  function startPlaylistRadio(playlistId) {
    const pl = Storage.getPlaylistById(playlistId);
    if (pl && pl.songs && pl.songs.length > 0) {
      startArtistRadioSeed(pl.songs[0].artists || pl.songs[0].name);
    } else {
      UI.showToast('Add songs to start playlist radio');
    }
  }

  function filterCurrentPlaylist(query) {
    if (activeDetailPlaylistId) {
      UI.renderPlaylistDetail(activeDetailPlaylistId, query);
    }
  }

  function removeTrackFromCustomPlaylist(playlistId, songId) {
    Storage.removeFromPlaylist(playlistId, songId);
    UI.showToast('Removed track from playlist');
    if (activeDetailPlaylistId === playlistId) {
      UI.renderPlaylistDetail(playlistId);
    }
    UI.renderLibraryTab('playlists', librarySearchQuery, librarySortMode);
  }

  function handlePlaylistDragStart(e, idx) {
    draggedPlaylistTrackIndex = idx;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(idx));
    }
  }

  function handlePlaylistDragOver(e) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  }

  function handlePlaylistDrop(e, playlistId, targetIdx) {
    e.preventDefault();
    if (draggedPlaylistTrackIndex >= 0 && targetIdx >= 0 && draggedPlaylistTrackIndex !== targetIdx) {
      const pl = Storage.getPlaylistById(playlistId);
      if (pl && Array.isArray(pl.songs)) {
        const reordered = [...pl.songs];
        const [moved] = reordered.splice(draggedPlaylistTrackIndex, 1);
        reordered.splice(targetIdx, 0, moved);
        Storage.reorderPlaylist(playlistId, reordered);
        UI.renderPlaylistDetail(playlistId);
      }
    }
    draggedPlaylistTrackIndex = -1;
  }

  function saveQueueAsPlaylistAction() {
    const queue = Player.getQueue ? Player.getQueue() : [];
    if (!queue || queue.length === 0) {
      UI.showToast('Queue is currently empty');
      return;
    }
    const pl = Storage.saveQueueAsPlaylist(queue);
    if (pl) {
      UI.showToast(`Saved ${queue.length} tracks as "${pl.name}" ✨`);
      UI.renderLibraryTab('playlists', librarySearchQuery, librarySortMode);
    }
  }

  function exportPlaylistAction(playlistId) {
    const jsonStr = Storage.exportPlaylist(playlistId, 'json');
    if (jsonStr) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(jsonStr).then(() => {
          UI.showToast('Copied playlist JSON to clipboard 📋');
        }).catch(() => {
          UI.showToast('Exported playlist JSON');
        });
      } else {
        UI.showToast('Exported playlist JSON');
      }
    }
  }

  // ==========================================================================
  // PHASE 4 — LOCAL MUSIC & OFFLINE ENGINE HELPERS
  // ==========================================================================
  function triggerFolderImport() {
    const input = document.getElementById('local-folder-input');
    if (input) input.click();
  }

  function triggerFilesImport() {
    const input = document.getElementById('local-file-input');
    if (input) input.click();
  }

  async function handleLocalFilesImport(event) {
    const files = event?.target?.files;
    if (!files || files.length === 0) return;
    showLoader(true);
    let imported = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('audio/') && !/\.(mp3|m4a|aac|wav|flac|ogg|opus)$/i.test(file.name)) continue;
      try {
        const meta = (typeof ID3Parser !== 'undefined') ? await ID3Parser.parse(file) : { title: file.name, artist: 'Local Artist' };
        const track = {
          id: `loc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          name: meta.title || file.name,
          artists: meta.artist || 'Local Artist',
          album: meta.album || 'Local Music',
          albumArtist: meta.albumArtist || meta.artist || '',
          year: meta.year || '',
          genre: meta.genre || '',
          folderName: 'Device Files',
          image: meta.artwork || 'assets/logo.png',
          duration: 0,
          source: 'LOCAL',
          filename: file.name,
          localBlobUrl: URL.createObjectURL(file)
        };
        Storage.saveLocalSong(track, file);
        if (typeof AudioFeatureExtractor !== 'undefined' && typeof FeatureStore !== 'undefined') {
          AudioFeatureExtractor.extractFromBlob(file, track).then(features => {
            FeatureStore.saveFeatures(track.id, features);
            FeatureStore.setIndexingState(track.id, FeatureStore.INDEXING_STATE.INDEXED);
          }).catch(() => {});
        }
        imported++;
      } catch (err) {
        console.warn('[LocalImport] file error:', err);
      }
    }
    showLoader(false);
    UI.showToast(`Imported ${imported} local tracks 🎵`);
    UI.renderLibraryTab('local', librarySearchQuery, librarySortMode);
  }

  async function handleLocalFolderImport(event) {
    const files = event?.target?.files;
    if (!files || files.length === 0) return;
    showLoader(true);
    let imported = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('audio/') && !/\.(mp3|m4a|aac|wav|flac|ogg|opus)$/i.test(file.name)) continue;
      try {
        const meta = (typeof ID3Parser !== 'undefined') ? await ID3Parser.parse(file) : { title: file.name, artist: 'Local Artist' };
        const relPath = file.webkitRelativePath || '';
        const folderName = relPath ? relPath.split('/')[0] : 'Music Folder';
        const track = {
          id: `loc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          name: meta.title || file.name,
          artists: meta.artist || 'Local Artist',
          album: meta.album || folderName,
          albumArtist: meta.albumArtist || meta.artist || '',
          year: meta.year || '',
          genre: meta.genre || '',
          folderName: folderName,
          image: meta.artwork || 'assets/logo.png',
          duration: 0,
          source: 'LOCAL',
          filename: file.name,
          localBlobUrl: URL.createObjectURL(file)
        };
        Storage.saveLocalSong(track, file);
        if (typeof AudioFeatureExtractor !== 'undefined' && typeof FeatureStore !== 'undefined') {
          AudioFeatureExtractor.extractFromBlob(file, track).then(features => {
            FeatureStore.saveFeatures(track.id, features);
            FeatureStore.setIndexingState(track.id, FeatureStore.INDEXING_STATE.INDEXED);
          }).catch(() => {});
        }
        imported++;
      } catch (err) {
        console.warn('[LocalFolderImport] file error:', err);
      }
    }
    showLoader(false);
    UI.showToast(`Imported ${imported} songs from folder 📁`);
    UI.renderLibraryTab('local', librarySearchQuery, librarySortMode);
  }

  function setLocalSubTab(subTab) {
    window.currentLocalSubTab = subTab;
    UI.renderLibraryTab('local', librarySearchQuery, librarySortMode);
  }

  function playLocalTrack(songId) {
    const localSongs = Storage.getLocalSongs();
    const idx = localSongs.findIndex(s => String(s.id) === String(songId));
    if (idx >= 0) {
      Player.setQueue(localSongs, idx);
      expandFullPlayer();
    }
  }

  function playLocalCollection(id, type) {
    let songs = [];
    if (type === 'album') {
      const albums = Storage.getLocalAlbums();
      const alb = albums.find(a => a.id === id);
      if (alb) songs = alb.songs;
    } else if (type === 'artist') {
      const artists = Storage.getLocalArtists();
      const art = artists.find(a => a.id === id);
      if (art) songs = art.songs;
    } else if (type === 'folder') {
      const folders = Storage.getLocalFolders();
      const fld = folders.find(f => f.id === id);
      if (fld) songs = fld.songs;
    }

    if (songs.length > 0) {
      Player.setQueue(songs, 0);
      expandFullPlayer();
    } else {
      UI.showToast('No playable songs in this collection.');
    }
  }

  function removeLocalTrackAction(songId) {
    Storage.removeLocalSong(songId);
    UI.showToast('Removed track from local library');
    UI.renderLibraryTab('local', librarySearchQuery, librarySortMode);
  }

  async function clearAllDownloadsAction() {
    if (confirm('Clear all downloaded offline music? This will free storage space.')) {
      if (typeof DownloadManager !== 'undefined') {
        await DownloadManager.clearAllDownloads();
      } else {
        await Storage.clearAllDownloads();
      }
      UI.showToast('Cleared all offline downloads');
      UI.renderLibraryTab('downloads', librarySearchQuery, librarySortMode);
    }
  }

  function downloadPlaylistAction(playlistId) {
    const pl = Storage.getPlaylists().find(p => p.id === playlistId) || (typeof Storage.getPlaylistById === 'function' ? Storage.getPlaylistById(playlistId) : null);
    if (!pl || !pl.songs || pl.songs.length === 0) {
      UI.showToast('Playlist has no tracks to download.');
      return;
    }
    if (typeof DownloadManager !== 'undefined') {
      DownloadManager.enqueueMultiple(pl.songs);
      UI.showToast(`Queued ${pl.songs.length} tracks for download ⏳`);
    } else {
      pl.songs.forEach(s => downloadTrack(s));
    }
  }

  async function downloadAlbumAction(albumId) {
    let songs = [];
    if (typeof albumId === 'object' && albumId.songs) {
      songs = albumId.songs;
    } else if (typeof API !== 'undefined' && API.getAlbumDetails) {
      const data = await API.getAlbumDetails(albumId);
      if (data && data.songs) songs = data.songs;
    }
    if (songs.length === 0) {
      UI.showToast('Album has no tracks to download.');
      return;
    }
    if (typeof DownloadManager !== 'undefined') {
      DownloadManager.enqueueMultiple(songs);
      UI.showToast(`Queued ${songs.length} album tracks for download ⏳`);
    } else {
      songs.forEach(s => downloadTrack(s));
    }
  }

  function downloadLikedSongsAction() {
    const favs = Storage.getFavorites();
    if (!favs || favs.length === 0) {
      UI.showToast('No liked songs to download.');
      return;
    }
    if (typeof DownloadManager !== 'undefined') {
      DownloadManager.enqueueMultiple(favs);
      UI.showToast(`Queued ${favs.length} liked songs for download ⏳`);
    } else {
      favs.forEach(s => downloadTrack(s));
    }
  }

  async function openAlbumOrPlaylist(id, type) {
    showLoader(true);
    try {
      const data = type === 'album' ? await API.getAlbumDetails(id) : await API.getPlaylistDetails(id);
      if (data && data.songs && data.songs.length > 0) {
        Player.setQueue(data.songs, 0);
        expandFullPlayer();
      }
    } catch (e) {
      console.error('[App] openAlbumOrPlaylist error:', e);
    }
    showLoader(false);
  }

  // Auto initialize when DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    init,
    navigate,
    goBack,
    openArtist,
    openArtistPage: openArtist,
    openArtistMenu,
    artistMenuAction,
    startArtistRadio,
    toggleFollowArtist,
    toggleAllArtistTracks,
    loadMoreArtistSongs,
    toggleAllNewReleases,
    performSearch,
    filterSearchCategory,
    loadMoreSearchSongs,
    setSearchQuery,
    searchCategory,
    clearSearchData,
    playSongFromSearch,
    playSongWithQueue,
    playSongFromArtistList,
    playSongFromFavs,
    playMix,
    startRadio,
    toggleFavoriteCurrent,
    downloadCurrentTrack,
    downloadTrack,
    expandFullPlayer,
    collapseFullPlayer,
    handlePlayerBack,
    handlePlayerRightAction,
    toggleLyricsView,
    toggleSoundscape,
    openBottomSheet,
    closeBottomSheet,
    openDialog,
    closeDialog,
    openSongMenu,
    closeSongMenu,
    openCurrentSongMenu,
    sheetAction,
    openLanguagesDialog,
    toggleLanguageSelection,
    saveLanguagesAndRefresh,
    openPlaylistPicker,
    promptCreatePlaylistAndAdd,
    addSongToSpecificPlaylist,
    openEqualizer,
    closeEqualizer,
    toggleEq,
    selectEqPreset,
    setSpatialLevel,
    updateEqBand,
    updateBassBoost,
    updateTrebleBoost,
    updateVocalBoost,
    updateVirtualizer,
    toggleNormalization,
    selectCrossfade,
    promptSaveCustomPreset,
    deleteCustomPreset,
    resetAudioEffects,
    openSleepTimerDialog,
    setSleepPreset,
    openQueueSheet,
    removeTrackFromQueue,
    openSettings,
    openQualityDialog,
    selectQuality,
    promptChangeName,
    promptChangeAvatar,
    cyclePerformanceMode,
    toggleAmbientGlow,
    clearListeningHistory,
    openLikedSongs,
    playLikedSongs,
    shuffleLikedSongs,
    playSongFromFavsList,
    playDownloadedSongs,
    removeDownloadTrack,
    removeHistoryTrack,
    startArtistRadioSeed,
    unfollowArtistAction,
    handleLocalAudioUpload,
    playLocalTrack,
    getLocalSongs,
    openLibraryTab,
    setLibrarySort,
    openCreatePlaylistModal,
    openEditPlaylistModal,
    closeCreatePlaylistModal,
    submitPlaylistEditor,
    openPlaylistMenu,
    closePlaylistMenu,
    playCustomPlaylist,
    shuffleCustomPlaylist,
    playNextPlaylist,
    addPlaylistToQueue,
    duplicateCustomPlaylist,
    deleteCustomPlaylist,
    openAddToPlaylistModal,
    closeAddToPlaylistModal,
    createAndAddSongToPlaylist,
    openCustomPlaylist,
    openAlbumOrPlaylist,
    triggerFolderImport,
    triggerFilesImport,
    handleLocalFilesImport,
    handleLocalFolderImport,
    setLocalSubTab,
    playLocalCollection,
    removeLocalTrackAction,
    downloadPlaylistAction,
    openGenre,
    playAllGenreSongs,
    startGenreRadio,
    loadExplore,
    handleQueueDragStart,
    handleQueueDragOver,
    handleQueueDrop,
    removeTrackFromQueue,
    playCustomPlaylistTrack,
    startPlaylistRadio,
    filterCurrentPlaylist,
    removeTrackFromCustomPlaylist,
    handlePlaylistDragStart,
    handlePlaylistDragOver,
    handlePlaylistDrop,
    saveQueueAsPlaylistAction,
    exportPlaylistAction,
    downloadAlbumAction,
    downloadLikedSongsAction,
    clearAllDownloadsAction,
    toggleSmartDownloads,
    toggleDownloadWifiOnly,
    toggleAutoDownloadLikes,
    openStorageLimitDialog,
    openAutoCleanupDialog,
    toggleProtectedDownloadAction,
    openStorageCleanupDialog,
    openSleepTimerDialog,
    setSleepPreset,
    addSleepMinutes,
    cancelSleepTimer,
    onCustomSleepInput,
    setCustomSleepTimer,
    openCastOutputDialog,
    openAudioOutputSheet,
    initSeekBar,
    handleBack,
    pushHistory,
    getNavHistory: () => [...navHistory]
  };
})();

// Export globally on window
if (typeof window !== 'undefined') {
  window.App = App;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = App;
}
