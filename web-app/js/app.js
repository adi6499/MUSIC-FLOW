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

  async function init() {
    console.log('[MusicFlow] Starting clean 100% Android Replica...');
    showLoader(true);

    Player.init();
    setupPlayerEventListeners();
    setupDOMEventListeners();
    applyPreferences();
    UI.renderHomeGreeting();
    UI.renderRecentSearchChips();
    UI.renderLibraryTab('playlists');

    // Load Initial Home Page Feed with user languages
    await loadHomeFeed();

    // Check last session
    const last = Storage.restoreSession();
    if (last && last.queue && last.queue.length > 0) {
      Player.setQueue(last.queue, last.currentIndex || 0);
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
      const languages = Storage.getLanguages();
      homeFeedData = await API.getHomeFeed(languages);

      const quickPicks = (homeFeedData?.quickPicks || []).map(API.normalizeSong);
      const trendingSongs = (homeFeedData?.trending?.songs || []).map(API.normalizeSong);
      const charts = homeFeedData?.charts || [];
      const albums = homeFeedData?.albums || [];

      // 1. Quick picks (START RADIO FROM A SONG)
      if (quickPicks.length > 0) {
        UI.renderQuickPicks(quickPicks.slice(0, 16));
        UI.renderRecommendedTracks(quickPicks.slice(0, 8));
        UI.renderNewReleases(trendingSongs.length > 0 ? trendingSongs : quickPicks, isNewReleasesExpanded);
      } else {
        const fallback = await API.searchSongs('Top Bollywood Hits', 1, 24);
        UI.renderQuickPicks(fallback.slice(0, 16));
        UI.renderRecommendedTracks(fallback.slice(0, 8));
        UI.renderNewReleases(fallback, isNewReleasesExpanded);
      }

      // 2. Forgotten favorites (from listening history)
      const history = Storage.getHistory();
      UI.renderForgottenFavorites(history.slice(0, 8));

      // 3. Trending Charts
      if (charts.length > 0) {
        UI.renderTrendingCharts(charts);
      }

      // 4. Albums
      if (albums.length > 0) {
        UI.renderAlbums(albums);
      }
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

    Player.on('stateChange', ({ isPlaying }) => {
      UI.updatePlaybackState(isPlaying);
    });

    Player.on('timeUpdate', ({ currentTime, duration }) => {
      UI.updatePlaybackProgress(currentTime, duration);
      Lyrics.updateTime(currentTime);
    });

    Player.on('queueChange', (queue) => {
      UI.renderQueueSheet(queue, queue.findIndex(s => s.id === Player.getCurrentTrack()?.id));
    });

    Player.on('shuffleChange', (isShuffle) => {
      UI.updateShuffleState(isShuffle);
    });

    Player.on('repeatChange', (repeatMode) => {
      UI.updateRepeatState(repeatMode);
    });
  }

  // ==========================================================================
  // DOM EVENT LISTENERS & NAVIGATION
  // ==========================================================================
  function setupDOMEventListeners() {
    // 1. Seek Slider
    const seekSlider = document.getElementById('player-seek-slider');
    if (seekSlider) {
      seekSlider.addEventListener('input', (e) => {
        Player.seek(parseFloat(e.target.value));
      });
    }

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

    // 5. Search Bar Input
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
          performSearch(q);
        }, 350);
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          clearTimeout(searchDebounceTimer);
          const q = searchInput.value.trim();
          if (q) performSearch(q);
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
        libTabsContainer.querySelectorAll('.lib-tab-btn').forEach(b => b.classList.remove('active'));
        tabBtn.classList.add('active');
        UI.renderLibraryTab(tabBtn.dataset.tab);
      });
    }

    // 9. Create Playlist Button
    document.getElementById('btn-create-playlist')?.addEventListener('click', () => {
      const name = prompt('Enter playlist name:');
      if (name) {
        Storage.createPlaylist(name);
        UI.renderLibraryTab('playlists');
      }
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
  }

  // ==========================================================================
  // NAVIGATION ROUTER
  // ==========================================================================
  function navigate(targetScreen) {
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
    }
  }

  function goBack() {
    navigate('home');
  }

  // ==========================================================================
  // ARTIST PROFILE SCREEN
  // ==========================================================================
  async function openArtist(artistNameOrId) {
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

  async function startRadio(songOrArtist) {
    let artistName = '';
    if (typeof songOrArtist === 'string' && songOrArtist !== 'undefined' && songOrArtist.trim()) {
      artistName = songOrArtist.trim();
    } else if (songOrArtist && typeof songOrArtist === 'object') {
      artistName = songOrArtist.primaryArtist || songOrArtist.name || (typeof songOrArtist.artists === 'string' ? songOrArtist.artists.split(',')[0].trim() : '') || '';
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

    artistName = API.decodeHtml(String(artistName)).split(';')[0].split(',')[0].trim();
    if (!artistName || artistName === 'undefined') artistName = 'Top 50 Hits';

    showRadioToast(`📻 Starting ${artistName} Radio...`);

    // If currentArtistSongs are already loaded on the page, start playback immediately!
    if (currentArtistSongs && currentArtistSongs.length > 0 && 
       (activeArtistData?.name === artistName || document.getElementById('artist-main-name')?.textContent === artistName)) {
      const contextTag = document.getElementById('player-context-tag');
      const contextTitle = document.getElementById('player-context-title');
      if (contextTag) contextTag.textContent = 'ARTIST RADIO';
      if (contextTitle) contextTitle.textContent = `${artistName} Radio`;

      Player.setQueue(currentArtistSongs, 0);
      expandFullPlayer();
      return;
    }

    showLoader(true);

    try {
      let radioSongs = await API.getArtistSongs(artistName, 1, 20);
      let peerSongs = await API.searchSongs(`${artistName} Hits`, 1, 15);
      
      let allRadio = [...radioSongs, ...peerSongs]
        .filter(s => s && s.name && s.name.toLowerCase() !== 'undefined' && s.name.toLowerCase() !== 'trending')
        .filter((song, index, self) => index === self.findIndex(s => s.id === song.id));

      if (allRadio.length === 0) {
        allRadio = await API.searchSongs(`${artistName}`, 1, 25);
      }
      if (allRadio.length === 0) {
        allRadio = await API.searchSongs('Top Bollywood Hits 2024', 1, 25);
      }

      if (allRadio.length > 0) {
        const contextTag = document.getElementById('player-context-tag');
        const contextTitle = document.getElementById('player-context-title');
        if (contextTag) contextTag.textContent = 'ARTIST RADIO';
        if (contextTitle) contextTitle.textContent = `${artistName} Radio`;

        Player.setQueue(allRadio, 0);
        expandFullPlayer();
      } else {
        alert(`Could not start radio for ${artistName}.`);
      }
    } catch (e) {
      console.error('[Radio] startRadio error:', e);
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
  async function performSearch(query, category = 'All') {
    if (!query || !query.trim()) return;
    showLoader(true);

    searchCurrentQuery = query.trim();
    searchCurrentCategory = category;
    searchCurrentPage = 1;

    Storage.addSearchHistory(query);
    UI.renderRecentSearchChips();

    try {
      const results = await API.searchAll(query);
      currentSearchResults = results?.songs?.results?.map(API.normalizeSong) || [];
      UI.renderSearchResults(results, category);
    } catch (e) {
      console.error('[App] performSearch error:', e);
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
    if (q) performSearch(q, category);
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
      performSearch(term);
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

  // Seamless Radio: Keeps currently playing song playing without restarting!
  async function startRadio(targetSong) {
    const current = targetSong || Player.getCurrentTrack();
    if (!current) return;

    showLoader(true);
    try {
      const query = `${current.primaryArtist || current.artists} Hits`;
      const songs = await API.searchSongs(query, 1, 24);
      if (songs.length > 0) {
        Player.startRadioQueue(current, songs);
      }
    } catch (e) {
      console.warn('[Radio] Failed to load radio mix:', e);
    }
    showLoader(false);
  }

  function toggleFavoriteCurrent() {
    const song = Player.getCurrentTrack();
    if (!song) return;
    const isFav = Storage.toggleFavorite(song);
    UI.updatePlayerBar(song);

    // Dynamic tactile heart bounce and color lock
    const heartBtn = document.getElementById('btn-player-favorite');
    const heartIcon = document.getElementById('player-heart-icon');
    if (heartBtn) {
      heartBtn.classList.toggle('active', isFav);
      heartBtn.style.color = isFav ? '#FF2A4D' : 'rgba(255, 255, 255, 0.7)';
      heartBtn.style.transform = 'scale(1.35)';
      setTimeout(() => {
        if (heartBtn) heartBtn.style.transform = '';
      }, 200);
    }
    if (heartIcon) {
      heartIcon.textContent = isFav ? 'favorite' : 'favorite_border';
      heartIcon.classList.toggle('fill-icon', isFav);
      heartIcon.style.color = isFav ? '#FF2A4D' : 'rgba(255, 255, 255, 0.7)';
      heartIcon.style.fontVariationSettings = isFav ? "'FILL' 1, 'wght' 600" : "'FILL' 0, 'wght' 400";
    }
  }

  // ==========================================================================
  // DIRECT AUDIO DOWNLOAD (320KBPS MP3)
  // ==========================================================================
  async function downloadCurrentTrack() {
    const song = Player.getCurrentTrack();
    if (!song) {
      alert('No track currently playing.');
      return;
    }
    await downloadTrack(song);
  }

  async function downloadTrack(song) {
    if (!song) return;
    try {
      const preferredQuality = Storage.getAudioQuality() || '320kbps';
      let url = API.getDownloadUrl(song, preferredQuality);
      if (!url && song.id) {
        const details = await API.getSongDetails(song.id);
        if (details && details.length > 0) {
          url = API.getDownloadUrl(details[0], preferredQuality);
        }
      }
      if (!url) {
        alert('Download stream not available for this track.');
        return;
      }

      const cleanTitle = (song.name || 'track').replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
      const cleanArtist = (song.artists || 'artist').split(',')[0].replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
      const filename = `${cleanTitle} - ${cleanArtist}.mp3`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      alert(`Downloading "${song.name}" in ${preferredQuality}...`);
    } catch (e) {
      console.error('[Download] error:', e);
      alert('Failed to initiate download.');
    }
  }

  // ==========================================================================
  // FULL PLAYER & LYRICS EXPANSION (Single Header System)
  // ==========================================================================
  function expandFullPlayer() {
    const sheet = document.getElementById('full-player');
    if (sheet) sheet.classList.add('expanded');
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
  // AUDIO EQUALIZER (EqualizerScreen.kt in Android)
  // ==========================================================================
  function openEqualizer() {
    if (document.getElementById('sheet-settings')?.classList.contains('active')) {
      wasSettingsOpenBeforeDialog = true;
      closeBottomSheet('sheet-settings');
    } else {
      wasSettingsOpenBeforeDialog = false;
    }
    const eq = Storage.getEqualizer();
    UI.renderEqualizerUI(eq);
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
    UI.renderEqualizerUI(Storage.getEqualizer());
  }

  function selectEqPreset(presetName) {
    Player.setEqPreset(presetName);
    UI.renderEqualizerUI(Storage.getEqualizer());
  }

  function updateEqBand(index, value) {
    const val = parseFloat(value);
    Player.setEqBand(index, val);
    const valEl = document.getElementById(`eq-val-${index}`);
    if (valEl) valEl.textContent = `${val > 0 ? '+' + val : val}dB`;
  }

  function updateBassBoost(value) {
    const val = parseFloat(value);
    Player.setBassBoost(val);
    const bassVal = document.getElementById('eq-bass-val');
    if (bassVal) bassVal.textContent = `${val} dB`;
  }

  function updateVirtualizer(value) {
    const val = parseFloat(value);
    Player.setVirtualizerStrength(val);
    const virtVal = document.getElementById('eq-virtualizer-val');
    if (virtVal) virtVal.textContent = `${val}%`;
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
    openDialog('dialog-sleep-timer');
  }

  function setSleepPreset(minutes) {
    closeDialog('dialog-sleep-timer');
    if (minutes === 'end') {
      const current = Player.getCurrentTrack();
      const leftSec = (current?.duration || 180) - (document.getElementById('app-audio')?.currentTime || 0);
      const mins = Math.max(1, Math.round(leftSec / 60));
      Player.setSleepTimer(mins);
      alert(`Sleep timer set for end of track (~${mins} min).`);
    } else if (minutes > 0) {
      Player.setSleepTimer(minutes);
      alert(`Sleep timer set for ${minutes} minutes.`);
    } else {
      Player.setSleepTimer(0);
      alert('Sleep timer turned off.');
    }
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
      UI.renderLibraryTab('history');
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

  function openCustomPlaylist(playlistId) {
    const pl = Storage.getPlaylists().find(p => p.id === playlistId);
    if (pl && pl.songs.length > 0) {
      Player.setQueue(pl.songs, 0);
      expandFullPlayer();
    } else {
      alert('Playlist is empty.');
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
    updateEqBand,
    updateBassBoost,
    updateVirtualizer,
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
    openCustomPlaylist,
    openAlbumOrPlaylist
  };
})();

// Export globally on window
window.App = App;
