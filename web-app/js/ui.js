// ==========================================================================
// MUSICFLOW — UI & DOM COMPONENT RENDERER (100% Jetpack Compose Replica)
// ==========================================================================

const UI = (() => {

  // Format seconds to mm:ss
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // Format listener numbers: 3234900 -> "3 234 900"
  function formatListeners(num) {
    const n = Number(num) || 3234900;
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  // Extract vibrant dominant color from image and set dynamic ambient background
  function setDynamicColor(imgUrl) {
    if (!imgUrl) return;
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        const color = `rgba(${r}, ${g}, ${b}, 0.40)`;
        document.documentElement.style.setProperty('--dynamic-color', color);
      } catch (_) {}
    };
    img.src = imgUrl;
  }

  // Format artists into clean string
  function formatArtists(artists) {
    if (!artists) return 'Various Artists';
    if (typeof artists === 'string') return API.decodeHtml(artists);
    if (Array.isArray(artists)) {
      return artists.map(a => typeof a === 'object' ? (a.name || a.title || '') : a).filter(Boolean).join(', ') || 'Various Artists';
    }
    if (typeof artists === 'object') {
      if (Array.isArray(artists.primary) && artists.primary.length > 0) {
        return artists.primary.map(a => a.name || a).join(', ');
      }
      if (Array.isArray(artists.all) && artists.all.length > 0) {
        return artists.all.map(a => a.name || a).join(', ');
      }
      if (artists.name) return artists.name;
    }
    return 'Various Artists';
  }

  return {
    formatTime,
    formatListeners,
    formatArtists,
    setDynamicColor,

    // ========================================================================
    // HOME SCREEN RENDERING (HomeScreen.kt)
    // ========================================================================
    renderHomeGreeting() {
      const hour = new Date().getHours();
      const name = Storage.getUserName();
      let greeting = 'Good morning';
      if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
      else if (hour >= 17 || hour < 4) greeting = 'Good evening';
      
      const greetingEl = document.getElementById('home-greeting');
      if (greetingEl) {
        greetingEl.textContent = name ? `Hi, ${name}` : greeting;
      }
    },

    renderQuickPicks(songs) {
      const container = document.getElementById('quick-picks-container');
      if (!container || !songs || songs.length === 0) return;

      // Group songs into columns of 4 rows (Jetpack Compose 4-row carousel)
      const columns = [];
      for (let i = 0; i < songs.length; i += 4) {
        columns.push(songs.slice(i, i + 4));
      }

      container.innerHTML = columns.map(col => `
        <div class="quick-picks-column">
          ${col.map(song => `
            <div class="quick-pick-item" onclick="App.playSongWithQueue('${song.id}')">
              <img class="quick-pick-thumb" src="${song.image}" onerror="this.src='assets/logo.png'" alt="${song.name}">
              <div class="quick-pick-info">
                <div class="quick-pick-title">${song.name}</div>
                <div class="quick-pick-artist">${song.artists}</div>
              </div>
              <button class="quick-pick-more" onclick="event.stopPropagation(); App.openSongMenu('${song.id}');" aria-label="More">
                <span class="material-symbols-outlined">more_vert</span>
              </button>
            </div>
          `).join('')}
        </div>
      `).join('');
    },

    renderForgottenFavorites(songs) {
      const section = document.getElementById('shelf-recent-section');
      const container = document.getElementById('shelf-recent-container');
      if (!section || !container) return;

      if (!songs || songs.length === 0) {
        section.style.display = 'none';
        return;
      }

      section.style.display = 'block';
      container.innerHTML = songs.map(song => `
        <div class="music-square-card" onclick="App.playSongWithQueue('${song.id}')">
          <div class="square-card-art-wrap">
            <img src="${song.image}" onerror="this.src='assets/logo.png'" alt="${song.name}">
            <div class="square-card-play-overlay">
              <span class="material-symbols-outlined fill-icon" style="font-size: 20px;">play_arrow</span>
            </div>
          </div>
          <div class="square-card-title">${song.name}</div>
          <div class="square-card-sub">${song.artists}</div>
        </div>
      `).join('');
    },

    renderRecommendedTracks(songs) {
      const container = document.getElementById('shelf-recommended-container');
      if (!container || !songs) return;

      container.innerHTML = songs.map(song => `
        <div class="music-square-card" onclick="App.playSongWithQueue('${song.id}')">
          <div class="square-card-art-wrap">
            <img src="${song.image}" onerror="this.src='assets/logo.png'" alt="${song.name}">
            <div class="square-card-play-overlay">
              <span class="material-symbols-outlined fill-icon" style="font-size: 20px;">play_arrow</span>
            </div>
          </div>
          <div class="square-card-title">${song.name}</div>
          <div class="square-card-sub">${song.artists}</div>
        </div>
      `).join('');
    },

    renderNewReleases(songs, isExpanded = false) {
      const container = document.getElementById('shelf-new-releases-container');
      const label = document.getElementById('new-releases-toggle-label');
      const chevron = document.getElementById('new-releases-chevron');
      if (!container || !songs) return;

      const displayList = isExpanded ? songs : songs.slice(0, 5);
      if (label) label.textContent = isExpanded ? 'Show less' : 'See all';
      if (chevron) chevron.textContent = isExpanded ? 'expand_less' : 'chevron_right';

      container.innerHTML = displayList.map(song => `
        <div class="vertical-track-row" onclick="App.playSongWithQueue('${song.id}')">
          <img class="vertical-track-img" src="${song.image}" onerror="this.src='assets/logo.png'" alt="${song.name}">
          <div class="vertical-track-info">
            <div class="vertical-track-title">${song.name}</div>
            <div class="vertical-track-artist">${song.artists}</div>
          </div>
          <button class="vertical-track-more" onclick="event.stopPropagation(); App.openSongMenu('${song.id}');" aria-label="More">
            <span class="material-symbols-outlined">more_vert</span>
          </button>
        </div>
      `).join('');
    },

    renderTrendingCharts(charts) {
      const container = document.getElementById('shelf-trending-container');
      if (!container || !charts) return;

      container.innerHTML = charts.map(item => `
        <div class="music-square-card" onclick="App.openAlbumOrPlaylist('${item.id}', '${item.type || 'playlist'}')">
          <div class="square-card-art-wrap">
            <img src="${API.getImageUrl(item)}" onerror="this.src='assets/logo.png'" alt="${item.title || item.name}">
            <div class="square-card-play-overlay">
              <span class="material-symbols-outlined fill-icon" style="font-size: 20px;">play_arrow</span>
            </div>
          </div>
          <div class="square-card-title">${item.title || item.name}</div>
          <div class="square-card-sub">${formatArtists(item.subtitle || item.artists || 'MusicFlow')}</div>
        </div>
      `).join('');
    },

    renderAlbums(albums) {
      const container = document.getElementById('shelf-albums-container');
      if (!container || !albums) return;

      container.innerHTML = albums.map(item => `
        <div class="music-square-card" onclick="App.openAlbumOrPlaylist('${item.id}', 'album')">
          <div class="square-card-art-wrap">
            <img src="${API.getImageUrl(item)}" onerror="this.src='assets/logo.png'" alt="${item.title || item.name}">
            <div class="square-card-play-overlay">
              <span class="material-symbols-outlined fill-icon" style="font-size: 20px;">play_arrow</span>
            </div>
          </div>
          <div class="square-card-title">${item.title || item.name}</div>
          <div class="square-card-sub">${formatArtists(item.artists || item.artist || item.subtitle || item.year || 'Album')}</div>
        </div>
      `).join('');
    },

    // ========================================================================
    // ARTIST SCREEN RENDERING (ArtistScreen.kt)
    // ========================================================================
    renderArtistProfile(artist, songs, albums) {
      if (!artist) return;

      const heroImg = API.getImageUrl(artist);
      const name = artist.name || artist.title || 'Artist';

      // 1. Hero Photo Card
      const heroImgEl = document.getElementById('artist-hero-img');
      const heroNameEl = document.getElementById('artist-hero-name');
      const topTitleEl = document.getElementById('artist-top-nav-title');
      const mainNameEl = document.getElementById('artist-main-name');
      const listenersEl = document.getElementById('artist-listeners-text');

      if (heroImgEl) heroImgEl.src = heroImg;
      if (heroNameEl) heroNameEl.textContent = name.toUpperCase();
      if (topTitleEl) topTitleEl.textContent = name;
      if (mainNameEl) mainNameEl.textContent = name;
      if (listenersEl) listenersEl.textContent = `${formatListeners(artist.fanCount || artist.listenerCount || 3234900)} listeners per month`;

      // 2. Play All Button
      const playAllBtn = document.getElementById('btn-artist-play-all');
      if (playAllBtn && songs && songs.length > 0) {
        playAllBtn.onclick = () => Player.setQueue(songs, 0);
      }

      // 3. Numbered Top Tracks (01, 02, 03...)
      this.renderArtistTopTracks(songs, false);

      // 4. Playlists "Best of" & "Style"
      const plImg1 = document.getElementById('artist-pl-img-1');
      const plImg2 = document.getElementById('artist-pl-img-2');
      const plTitle1 = document.getElementById('artist-pl-title-1');
      const plTitle2 = document.getElementById('artist-pl-title-2');

      if (plImg1) plImg1.src = heroImg;
      if (plImg2) plImg2.src = heroImg;
      if (plTitle1) plTitle1.textContent = `Best of ${name}`;
      if (plTitle2) plTitle2.textContent = `${name} Style Mix`;

      // 5. Similar Artists
      const similarContainer = document.getElementById('artist-similar-container');
      if (similarContainer && Array.isArray(artist.similarArtists) && artist.similarArtists.length > 0) {
        similarContainer.innerHTML = artist.similarArtists.map(sim => `
          <div class="similar-artist-item" onclick="App.openArtist('${sim.id || sim.name}')">
            <img class="similar-artist-avatar" src="${API.getImageUrl(sim)}" onerror="this.src='assets/logo.png'" alt="${sim.name}">
            <span class="similar-artist-name">${sim.name}</span>
          </div>
        `).join('');
      } else if (similarContainer) {
        // Fallback popular peers
        const peers = ['Arijit Singh', 'Pritam', 'Shreya Ghoshal', 'Atif Aslam', 'Badshah', 'Diljit Dosanjh'];
        similarContainer.innerHTML = peers.map(peer => `
          <div class="similar-artist-item" onclick="App.openArtist('${peer}')">
            <img class="similar-artist-avatar" src="assets/logo.png" alt="${peer}">
            <span class="similar-artist-name">${peer}</span>
          </div>
        `).join('');
      }

      // Set ambient dominant color
      setDynamicColor(heroImg);
    },

    renderArtistTopTracks(songs, isExpanded = false) {
      const tracksContainer = document.getElementById('artist-tracks-container');
      const label = document.getElementById('artist-tracks-toggle-label');
      const chevron = document.getElementById('artist-tracks-chevron');
      if (!tracksContainer || !songs) return;

      const displayList = isExpanded ? songs : songs.slice(0, 10);
      if (label) label.textContent = isExpanded ? 'Show less' : 'See all';
      if (chevron) chevron.textContent = isExpanded ? 'expand_less' : 'chevron_right';

      tracksContainer.innerHTML = displayList.map((song, idx) => `
        <div class="numbered-track-row" onclick="App.playSongFromArtistList('${song.id}')">
          <span class="track-index-num">${idx + 1 < 10 ? '0' + (idx + 1) : idx + 1}</span>
          <img class="track-thumb-img" src="${song.image}" onerror="this.src='assets/logo.png'" alt="${song.name}">
          <div class="track-info-col">
            <div class="track-name-text">${song.name}</div>
            <div class="track-artist-text">${song.artists}</div>
          </div>
          <button class="vertical-track-more" onclick="event.stopPropagation(); App.openSongMenu('${song.id}');" aria-label="More">
            <span class="material-symbols-outlined">more_vert</span>
          </button>
        </div>
      `).join('');
    },

    // ========================================================================
    // SEARCH SCREEN RENDERING (SearchScreen.kt)
    // ========================================================================
    renderSearchResults(results, activeCategory = 'All') {
      const container = document.getElementById('search-results-container');
      const discoveryHub = document.getElementById('search-discovery-hub');
      if (!container || !discoveryHub) return;

      discoveryHub.style.display = 'none';
      container.style.display = 'block';

      const songs = results?.songs?.results?.map(API.normalizeSong) || (Array.isArray(results) ? results : []);
      const artists = results?.artists?.results || [];
      const albums = results?.albums?.results || [];
      const playlists = results?.playlists?.results || [];

      let html = '';

      // Artists Carousel
      if ((activeCategory === 'All' || activeCategory === 'Artists') && artists.length > 0) {
        html += `
          <div class="shelf-section" style="margin-bottom:16px;">
            <div class="search-section-title">Artists</div>
            <div class="similar-artists-shelf">
              ${artists.map(art => `
                <div class="similar-artist-item" onclick="App.openArtist('${(art.name || art.title || art.id || '').replace(/'/g, "\\'")}')">
                  <img class="similar-artist-avatar" src="${API.getImageUrl(art)}" onerror="this.src='assets/logo.png'" alt="${art.title || art.name}">
                  <span class="similar-artist-name">${art.title || art.name}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      // Songs List
      if ((activeCategory === 'All' || activeCategory === 'Songs') && songs.length > 0) {
        html += `
          <div class="shelf-section">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <div class="search-section-title" style="margin-bottom:0;">Songs (${songs.length})</div>
              ${activeCategory === 'All' ? `<button class="search-clear-all-btn" onclick="App.filterSearchCategory('Songs')">See all songs &gt;</button>` : ''}
            </div>
            <div class="vertical-tracks-shelf" id="search-songs-list" style="padding:0;">
              ${songs.map((song, idx) => `
                <div class="vertical-track-row" onclick="App.playSongFromSearch(${idx})">
                  <img class="vertical-track-img" src="${song.image}" onerror="this.src='assets/logo.png'" alt="${song.name}">
                  <div class="vertical-track-info">
                    <div class="vertical-track-title">${song.name}</div>
                    <div class="vertical-track-artist">${song.artists}</div>
                  </div>
                  <button class="vertical-track-more" onclick="event.stopPropagation(); App.openSongMenu('${song.id}');" aria-label="More">
                    <span class="material-symbols-outlined">more_vert</span>
                  </button>
                </div>
              `).join('')}
            </div>
            <div style="text-align:center; padding: 14px 0 6px 0;">
              <button class="artist-genre-pill" onclick="App.loadMoreSearchSongs()" style="padding: 8px 24px; font-size: 13px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);">
                <span class="material-symbols-outlined" style="font-size:16px; vertical-align:middle; margin-right:4px;">expand_more</span>
                Load More Songs
              </button>
            </div>
          </div>
        `;
      }

      // Albums Carousel
      if ((activeCategory === 'All' || activeCategory === 'Albums') && albums.length > 0) {
        html += `
          <div class="shelf-section" style="margin-top:16px;">
            <div class="search-section-title">Albums</div>
            <div class="cards-horizontal-shelf" style="padding: 4px 0;">
              ${albums.map(alb => `
                <div class="music-square-card" onclick="App.openAlbumOrPlaylist('${alb.id}', 'album')">
                  <div class="square-card-art-wrap">
                    <img src="${API.getImageUrl(alb)}" onerror="this.src='assets/logo.png'" alt="${alb.title || alb.name}">
                    <div class="square-card-play-overlay"><span class="material-symbols-outlined fill-icon" style="font-size:20px;">play_arrow</span></div>
                  </div>
                  <div class="square-card-title">${alb.title || alb.name}</div>
                  <div class="square-card-sub">${formatArtists(alb.artists || alb.artist || alb.subtitle || 'Album')}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      // Playlists Carousel
      if ((activeCategory === 'All' || activeCategory === 'Playlists') && playlists.length > 0) {
        html += `
          <div class="shelf-section" style="margin-top:16px;">
            <div class="search-section-title">Playlists</div>
            <div class="cards-horizontal-shelf" style="padding: 4px 0;">
              ${playlists.map(pl => `
                <div class="music-square-card" onclick="App.openAlbumOrPlaylist('${pl.id}', 'playlist')">
                  <div class="square-card-art-wrap">
                    <img src="${API.getImageUrl(pl)}" onerror="this.src='assets/logo.png'" alt="${pl.title || pl.name}">
                    <div class="square-card-play-overlay"><span class="material-symbols-outlined fill-icon" style="font-size:20px;">play_arrow</span></div>
                  </div>
                  <div class="square-card-title">${pl.title || pl.name}</div>
                  <div class="square-card-sub">${formatArtists(pl.subtitle || pl.artists || '') || (pl.songCount ? pl.songCount + ' songs' : 'Playlist')}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      if (!html) {
        html = '<div style="text-align:center; padding: 40px 20px; color: var(--text-secondary);">No results found</div>';
      }

      container.innerHTML = html;
    },

    appendSearchSongs(moreSongs, startIndex) {
      const list = document.getElementById('search-songs-list');
      if (!list || !moreSongs) return;

      const newHtml = moreSongs.map((song, idx) => `
        <div class="vertical-track-row" onclick="App.playSongFromSearch(${startIndex + idx})">
          <img class="vertical-track-img" src="${song.image}" onerror="this.src='assets/logo.png'" alt="${song.name}">
          <div class="vertical-track-info">
            <div class="vertical-track-title">${song.name}</div>
            <div class="vertical-track-artist">${song.artists}</div>
          </div>
          <button class="vertical-track-more" onclick="event.stopPropagation(); App.openSongMenu('${song.id}');" aria-label="More">
            <span class="material-symbols-outlined">more_vert</span>
          </button>
        </div>
      `).join('');

      list.insertAdjacentHTML('beforeend', newHtml);
    },

    renderRecentSearchChips() {
      const section = document.getElementById('search-recent-section');
      const chipsContainer = document.getElementById('search-recent-chips');
      if (!section || !chipsContainer) return;

      const history = Storage.getSearchHistory();
      if (history.length === 0) {
        section.style.display = 'none';
        return;
      }

      section.style.display = 'block';
      chipsContainer.innerHTML = history.map(term => `
        <button class="search-pill-btn" onclick="App.setSearchQuery('${term}')">${term}</button>
      `).join('');
    },

    // ========================================================================
    // LIBRARY SCREEN RENDERING (LibraryScreen.kt)
    // ========================================================================
    renderLibraryTab(tab = 'playlists') {
      const container = document.getElementById('library-tab-content');
      if (!container) return;

      if (tab === 'playlists') {
        const favs = Storage.getFavorites();
        const customPlaylists = Storage.getPlaylists();

        let html = `
          <!-- Liked Songs Card -->
          <div class="liked-songs-card" onclick="App.openLikedSongs()">
            <span class="material-symbols-outlined fill-icon liked-songs-icon">favorite</span>
            <div>
              <h3 class="liked-songs-title">Liked Songs</h3>
              <p class="liked-songs-sub">${favs.length} tracks</p>
            </div>
          </div>
        `;

        if (customPlaylists.length > 0) {
          html += `<h3 class="shelf-title" style="font-size: 18px; margin: 16px 0 10px 0;">Your Playlists</h3>`;
          html += customPlaylists.map(pl => `
            <div class="vertical-track-row" onclick="App.openCustomPlaylist('${pl.id}')">
              <div style="width:56px; height:56px; border-radius:12px; background:#1E1E22; display:flex; align-items:center; justify-content:center; color:#FF2A4D;">
                <span class="material-symbols-outlined" style="font-size:28px;">queue_music</span>
              </div>
              <div class="vertical-track-info">
                <div class="vertical-track-title">${pl.name}</div>
                <div class="vertical-track-artist">${pl.songs.length} songs</div>
              </div>
            </div>
          `).join('');
        }

        container.innerHTML = html;
      } else if (tab === 'songs') {
        const favs = Storage.getFavorites();
        if (favs.length === 0) {
          container.innerHTML = '<div style="text-align:center; padding: 40px 20px; color: var(--text-secondary);">No liked songs yet</div>';
          return;
        }

        container.innerHTML = favs.map(song => `
          <div class="vertical-track-row" onclick="App.playSongFromFavs('${song.id}')">
            <img class="vertical-track-img" src="${song.image}" onerror="this.src='assets/logo.png'" alt="${song.name}">
            <div class="vertical-track-info">
              <div class="vertical-track-title">${song.name}</div>
              <div class="vertical-track-artist">${song.artists}</div>
            </div>
            <button class="vertical-track-more" onclick="event.stopPropagation(); App.openSongMenu('${song.id}');" aria-label="More">
              <span class="material-symbols-outlined">more_vert</span>
            </button>
          </div>
        `).join('');
      } else if (tab === 'history') {
        const history = Storage.getHistory();
        if (history.length === 0) {
          container.innerHTML = '<div style="text-align:center; padding: 40px 20px; color: var(--text-secondary);">Listening history is empty</div>';
          return;
        }

        container.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <span class="search-section-title" style="margin:0;">Recently Played</span>
            <button class="search-clear-all-btn" onclick="App.clearListeningHistory()">Clear</button>
          </div>
          ${history.map(song => `
            <div class="vertical-track-row" onclick="App.playSongWithQueue('${song.id}')">
              <img class="vertical-track-img" src="${song.image}" onerror="this.src='assets/logo.png'" alt="${song.name}">
              <div class="vertical-track-info">
                <div class="vertical-track-title">${song.name}</div>
                <div class="vertical-track-artist">${song.artists}</div>
              </div>
              <button class="vertical-track-more" onclick="event.stopPropagation(); App.openSongMenu('${song.id}');" aria-label="More">
                <span class="material-symbols-outlined">more_vert</span>
              </button>
            </div>
          `).join('')}
        `;
      } else if (tab === 'downloads') {
        container.innerHTML = '<div style="text-align:center; padding: 40px 20px; color: var(--text-secondary);">Offline downloads available in native app</div>';
      }
    },

    // ========================================================================
    // PLAYER SCREEN & FLOATING MINI PLAYER (PlayerScreen.kt & MiniPlayer.kt)
    // ========================================================================
    updatePlayerBar(song) {
      if (!song) return;

      // 1. Floating MiniPlayer
      const miniPlayer = document.getElementById('mini-player');
      const miniArt = document.getElementById('mini-player-art');
      const miniTitle = document.getElementById('mini-song-title');
      const miniArtist = document.getElementById('mini-artist-name');

      if (miniPlayer) miniPlayer.style.display = 'flex';
      if (miniArt) miniArt.src = song.image || 'assets/logo.png';
      if (miniTitle) miniTitle.textContent = song.name;
      if (miniArtist) miniArtist.textContent = song.artists;

      // 2. Full Player Sheet
      const fullArt = document.getElementById('full-player-art');
      const fullTitle = document.getElementById('full-player-title');
      const fullArtist = document.getElementById('full-player-artist');
      const heartIcon = document.getElementById('player-heart-icon');
      const heartBtn = document.getElementById('btn-player-favorite');
      const totalTime = document.getElementById('player-time-total');
      const contextTitle = document.getElementById('player-context-title');

      if (fullArt) fullArt.src = song.image || 'assets/logo.png';
      if (fullTitle) fullTitle.textContent = song.name;
      if (fullArtist) {
        fullArtist.textContent = song.artists;
        fullArtist.onclick = () => {
          App.collapseFullPlayer();
          App.openArtist(song.primaryArtist || song.artists);
        };
      }
      if (totalTime && song.duration) totalTime.textContent = formatTime(song.duration);
      if (contextTitle) {
        let cleanContext = (song.album || '').replace(/\(From .*\)/i, '').replace(/- .*/, '').trim();
        if (cleanContext.length > 24) cleanContext = cleanContext.substring(0, 24) + '...';
        contextTitle.textContent = cleanContext || (song.primaryArtist ? `${song.primaryArtist} Radio` : 'Top Hits');
      }

      const isFav = Storage.isFavorite(song.id);
      if (heartIcon) {
        heartIcon.textContent = isFav ? 'favorite' : 'favorite_border';
        heartIcon.classList.toggle('fill-icon', isFav);
      }
      if (heartBtn) heartBtn.classList.toggle('active', isFav);

      // Extract dynamic colors for ambient lighting
      setDynamicColor(song.image);
    },

    updatePlaybackState(isPlaying) {
      const miniPlayIcon = document.getElementById('mini-play-icon');
      const playerMainPlayIcon = document.getElementById('player-main-play-icon');

      if (miniPlayIcon) miniPlayIcon.textContent = isPlaying ? 'pause' : 'play_arrow';
      if (playerMainPlayIcon) playerMainPlayIcon.textContent = isPlaying ? 'pause' : 'play_arrow';
    },

    updatePlaybackProgress(currentTime, duration) {
      const curTimeEl = document.getElementById('player-time-current');
      const totTimeEl = document.getElementById('player-time-total');
      const seekSlider = document.getElementById('player-seek-slider');

      if (curTimeEl) curTimeEl.textContent = formatTime(currentTime);
      if (totTimeEl && duration > 0) totTimeEl.textContent = formatTime(duration);
      if (seekSlider && duration > 0) {
        seekSlider.value = (currentTime / duration) * 100;
      }
    },

    // ========================================================================
    // MODALS & BOTTOM SHEETS
    // ========================================================================
    renderQualityOptions(selectedQuality) {
      const list = document.getElementById('quality-options-list');
      if (!list) return;

      const tiers = [
        { key: '320kbps', name: 'Lossless & Hi-Res Master (320 kbps)', desc: 'Highest studio master fidelity, lossless dynamics' },
        { key: '256kbps', name: 'High Fidelity (256 kbps)', desc: 'Apple Music standard, ultra clean sound' },
        { key: '160kbps', name: 'High Quality (160 kbps)', desc: 'Crisp sound, balanced data usage' },
        { key: '128kbps', name: 'Standard (128 kbps)', desc: 'Smooth streaming, standard data usage' },
        { key: '96kbps', name: 'Normal / Data Saver (96 kbps)', desc: 'Low data consumption, quick buffering' },
        { key: '48kbps', name: 'Ultra Data Saver (48 kbps)', desc: 'Minimum data usage, ideal for slow networks' }
      ];

      list.innerHTML = tiers.map(t => {
        const isSel = t.key.toLowerCase() === (selectedQuality || '320kbps').toLowerCase();
        return `
          <div class="quality-option-row ${isSel ? 'selected' : ''}" onclick="App.selectQuality('${t.key}')">
            <div class="quality-radio-circle">
              <div class="quality-radio-inner"></div>
            </div>
            <div class="quality-text-col">
              <div class="quality-name">
                ${t.name}
                ${t.key === '320kbps' ? '<span class="lossless-badge" style="font-size:8px; padding:1px 4px;">LOSSLESS</span>' : ''}
              </div>
              <div class="quality-desc">${t.desc}</div>
            </div>
          </div>
        `;
      }).join('');
    },

    renderQueueSheet(queue, currentIndex) {
      const container = document.getElementById('queue-tracks-container');
      const countEl = document.getElementById('queue-tracks-count');
      if (countEl) countEl.textContent = `${queue.length} track${queue.length === 1 ? '' : 's'}`;
      if (!container || !queue) return;

      if (queue.length === 0) {
        container.innerHTML = `
          <div style="text-align:center; padding:40px 20px; color:var(--text-secondary);">
            <span class="material-symbols-outlined" style="font-size:48px; opacity:0.4; margin-bottom:8px;">queue_music</span>
            <p>Queue is empty</p>
          </div>
        `;
        return;
      }

      container.innerHTML = queue.map((song, idx) => {
        const isCurrent = idx === currentIndex;
        const songTitle = (song.name && song.name !== 'undefined') ? song.name : (song.title || 'Track');
        const songArtist = (song.artists && song.artists !== 'undefined') ? song.artists : (song.artist || 'MusicFlow');
        return `
          <div class="queue-track-row ${isCurrent ? 'active' : ''}" onclick="Player.playTrackAtIndex ? Player.playTrackAtIndex(${idx}, true) : App.playSongWithQueue('${song.id}')">
            <img class="vertical-track-img" src="${song.image || 'assets/logo.png'}" onerror="this.src='assets/logo.png'" alt="${songTitle}">
            <div class="vertical-track-info">
              <div class="vertical-track-title" style="${isCurrent ? 'color:#FF2A4D; font-weight:800;' : ''}">${songTitle}</div>
              <div class="vertical-track-artist">${songArtist}</div>
            </div>
            ${isCurrent ? '<span class="material-symbols-outlined" style="color:#FF2A4D; font-size:22px;">graphic_eq</span>' : ''}
            <button class="queue-delete-btn" onclick="event.stopPropagation(); App.removeTrackFromQueue(${idx});" aria-label="Remove">
              <span class="material-symbols-outlined" style="font-size:18px;">close</span>
            </button>
          </div>
        `;
      }).join('');
    },

    renderArtistTopTracks(songs, isExpanded = false) {
      const container = document.getElementById('artist-tracks-container');
      const label = document.getElementById('artist-tracks-toggle-label');
      const chevron = document.getElementById('artist-tracks-chevron');
      if (!container || !songs) return;
      if (songs.length === 0) {
        container.innerHTML = '<div style="padding:20px; color:var(--text-secondary);">No top tracks found</div>';
        return;
      }

      const displayList = isExpanded ? songs : songs.slice(0, 5);
      if (label) label.textContent = isExpanded ? 'Show less' : 'See all';
      if (chevron) chevron.textContent = isExpanded ? 'expand_less' : 'chevron_right';

      container.innerHTML = displayList.map((song, idx) => `
        <div class="numbered-track-row" onclick="App.playSongFromArtistList(${idx})">
          <span class="track-index-num">${String(idx + 1).padStart(2, '0')}</span>
          <img class="track-thumb-img" src="${song.image || 'assets/logo.png'}" onerror="this.src='assets/logo.png'" alt="${song.name}">
          <div class="track-info-col">
            <div class="track-name-text">${song.name}</div>
            <div class="track-artist-text">${song.artists}</div>
          </div>
          <button class="vertical-track-more" onclick="event.stopPropagation(); App.openSongMenu('${song.id}');" aria-label="More">
            <span class="material-symbols-outlined">more_vert</span>
          </button>
        </div>
      `).join('');
    },

    renderEqualizerUI(eqData) {
      const presetsContainer = document.getElementById('eq-presets-container');
      const bandsContainer = document.getElementById('eq-bands-container');
      const switchEl = document.getElementById('eq-switch');
      const bassSlider = document.getElementById('eq-bass-slider');
      const bassVal = document.getElementById('eq-bass-val');
      const virtualizerSlider = document.getElementById('eq-virtualizer-slider');
      const virtualizerVal = document.getElementById('eq-virtualizer-val');

      if (switchEl) switchEl.checked = eqData.enabled === true;
      if (bassSlider) bassSlider.value = eqData.bassBoost || 0;
      if (bassVal) bassVal.textContent = `${eqData.bassBoost || 0} dB`;
      if (virtualizerSlider) virtualizerSlider.value = eqData.virtualizer || 0;
      if (virtualizerVal) virtualizerVal.textContent = `${eqData.virtualizer || 0}%`;

      // Presets
      if (presetsContainer) {
        const presets = ['Flat', 'Bass Boost', 'Pop', 'Rock', 'Electronic', 'Hip Hop', 'Classical', 'Acoustic', 'Vocal Booster', '3D Spatial Concert'];
        presetsContainer.innerHTML = presets.map(p => `
          <button class="eq-preset-chip ${eqData.preset === p ? 'active' : ''}" onclick="App.selectEqPreset('${p}')">${p}</button>
        `).join('');
      }

      // 5-Bands
      if (bandsContainer) {
        const labels = ['60Hz\nSub', '230Hz\nBass', '910Hz\nMid', '3.6kHz\nPres', '14kHz\nAir'];
        const bands = eqData.bands || [0, 0, 0, 0, 0];

        bandsContainer.innerHTML = labels.map((lbl, idx) => {
          const val = bands[idx] || 0;
          return `
            <div class="eq-band-col">
              <span class="eq-band-val" id="eq-val-${idx}">${val > 0 ? '+' + val : val}dB</span>
              <input type="range" class="eq-band-slider" min="-12" max="12" step="1" value="${val}" oninput="App.updateEqBand(${idx}, this.value)">
              <span class="eq-band-label">${lbl.replace('\n', '<br>')}</span>
            </div>
          `;
        }).join('');
      }
    },

    renderLanguagesPicker(selectedLangs = ['hindi', 'english', 'punjabi']) {
      const container = document.getElementById('lang-selection-list');
      if (!container) return;

      const availableLanguages = [
        { key: 'hindi', label: 'Hindi' },
        { key: 'english', label: 'English' },
        { key: 'punjabi', label: 'Punjabi' },
        { key: 'tamil', label: 'Tamil' },
        { key: 'telugu', label: 'Telugu' },
        { key: 'bhojpuri', label: 'Bhojpuri' },
        { key: 'malayalam', label: 'Malayalam' },
        { key: 'kannada', label: 'Kannada' },
        { key: 'bengali', label: 'Bengali' },
        { key: 'marathi', label: 'Marathi' },
        { key: 'gujarati', label: 'Gujarati' },
        { key: 'spanish', label: 'Spanish' },
        { key: 'korean', label: 'Korean' }
      ];

      container.innerHTML = availableLanguages.map(l => {
        const isSel = selectedLangs.includes(l.key);
        return `
          <div class="lang-item-row ${isSel ? 'selected' : ''}" onclick="App.toggleLanguageSelection('${l.key}')">
            <div class="lang-item-left">
              <div class="lang-checkbox">
                <span class="material-symbols-outlined">check</span>
              </div>
              <span class="lang-label">${l.label}</span>
            </div>
          </div>
        `;
      }).join('');
    },

    renderPlaylistPicker(playlists, song) {
      const container = document.getElementById('dialog-playlists-list');
      if (!container) return;

      if (!playlists || playlists.length === 0) {
        container.innerHTML = `
          <div style="text-align:center; padding:20px 0; color:var(--text-secondary); font-size:13px;">
            No custom playlists yet. Tap "Create New Playlist" above.
          </div>
        `;
        return;
      }

      container.innerHTML = playlists.map(pl => `
        <div class="sheet-action-item" onclick="App.addSongToSpecificPlaylist('${pl.id}')" style="border-radius:12px; margin-bottom:4px; background:#141416;">
          <span class="material-symbols-outlined" style="color:#FF2A4D;">queue_music</span>
          <div style="flex:1;">
            <div style="font-weight:700; color:#FFFFFF; font-size:14px;">${pl.name}</div>
            <div style="font-size:11.5px; color:var(--text-secondary);">${pl.songs?.length || 0} songs</div>
          </div>
        </div>
      `).join('');
    },

    renderSettingsSheet() {
      const nameVal = document.getElementById('settings-name-val');
      const qualityVal = document.getElementById('settings-quality-val');
      const perfVal = document.getElementById('settings-perf-val');
      const glowSwitch = document.getElementById('settings-glow-switch');
      const avatarImg = document.getElementById('settings-avatar-img');
      const langSummary = document.getElementById('settings-languages-summary');

      if (nameVal) nameVal.textContent = Storage.getUserName();
      if (qualityVal) qualityVal.textContent = Storage.getAudioQuality();
      if (avatarImg) avatarImg.src = Storage.getUserAvatar();
      if (langSummary) {
        const langs = Storage.getLanguages();
        langSummary.textContent = langs.map(l => l.charAt(0).toUpperCase() + l.slice(1)).join(', ');
      }
      if (perfVal) {
        const mode = Storage.getPerformanceMode();
        perfVal.textContent = mode === 'lite' ? 'Lite (Fast & Smooth)' : (mode === 'high' ? 'High 120fps' : 'Auto (60fps)');
      }
      if (glowSwitch) glowSwitch.checked = Storage.getAmbientLighting();
    }
  };
})();
