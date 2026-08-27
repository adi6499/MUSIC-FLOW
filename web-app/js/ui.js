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
    if (!imgUrl || typeof Image === 'undefined' || typeof document === 'undefined') return;
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

  function escapeHtml(str) {
    if (!str || typeof str !== 'string') return str || '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr(str) {
    if (!str || typeof str !== 'string') return str || '';
    return str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '&quot;');
  }

  return {
    formatTime,
    formatListeners,
    formatArtists,
    escapeHtml,
    escapeAttr,
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

    renderContinueListening(songs) {
      const section = document.getElementById('shelf-continue-listening-section');
      const container = document.getElementById('shelf-continue-listening-container');
      if (!section || !container) return;

      if (!songs || songs.length === 0) {
        section.style.display = 'none';
        return;
      }

      section.style.display = 'block';
      container.innerHTML = songs.map(song => {
        const prog = song.playbackProgress || 0;
        return `
          <div class="music-square-card" onclick="App.playSongWithQueue('${song.id}')">
            <div class="square-card-art-wrap">
              <img src="${song.image}" onerror="this.src='assets/logo.png'" alt="${song.name}">
              <div class="square-card-play-overlay">
                <span class="material-symbols-outlined fill-icon" style="font-size: 20px;">play_arrow</span>
              </div>
              ${prog > 0 ? `
                <div class="continue-card-progress-bar">
                  <div class="continue-card-progress-fill" style="width: ${prog}%;"></div>
                </div>
              ` : ''}
            </div>
            <div class="square-card-title">${song.name}</div>
            <div class="square-card-sub">${song.reason || song.artists}</div>
          </div>
        `;
      }).join('');
    },

    renderMadeForYou(songs) {
      const section = document.getElementById('shelf-made-for-you-section');
      const container = document.getElementById('shelf-made-for-you-container');
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
          <div class="square-card-sub">${song.reason || song.artists}</div>
        </div>
      `).join('');
    },

    renderBecauseYouListened(seedTitle, songs) {
      const section = document.getElementById('shelf-because-listened-section');
      const container = document.getElementById('shelf-because-listened-container');
      const titleEl = document.getElementById('because-listened-title');
      if (!section || !container) return;

      if (!songs || songs.length === 0) {
        section.style.display = 'none';
        return;
      }

      if (titleEl && seedTitle) {
        titleEl.textContent = `Because you listened to ${seedTitle}`;
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

    renderFavoriteArtists(artists) {
      const section = document.getElementById('shelf-favorite-artists-section');
      const container = document.getElementById('shelf-favorite-artists-container');
      if (!section || !container) return;

      if (!artists || artists.length === 0) {
        section.style.display = 'none';
        return;
      }

      section.style.display = 'block';
      container.innerHTML = artists.map(artist => {
        const name = typeof artist === 'string' ? artist : (artist.name || artist.artist || 'Artist');
        const img = artist.image || 'assets/logo.png';
        return `
          <div class="artist-circle-card" onclick="App.openArtist('${name.replace(/'/g, "\\'")}')">
            <div class="artist-circle-img-wrap">
              <img src="${img}" onerror="this.src='assets/logo.png'" alt="${name}">
            </div>
            <div class="artist-circle-name">${name}</div>
            <div class="artist-circle-sub">Artist</div>
          </div>
        `;
      }).join('');
    },

    renderDiscoverNew(songs) {
      const section = document.getElementById('shelf-discover-section');
      const container = document.getElementById('shelf-discover-container');
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

      // Did You Mean Banner
      if (results?.didYouMean) {
        html += `
          <div class="did-you-mean-banner" onclick="App.setSearchQuery('${results.didYouMean.replace(/'/g, "\\'")}')" style="display:flex; align-items:center; gap:8px; padding:10px 16px; margin-bottom:14px; background:rgba(255,46,84,0.12); border: 1px solid rgba(255,46,84,0.25); border-radius:12px; cursor:pointer;">
            <span class="material-symbols-outlined" style="font-size:18px; color:#ff2e54;">auto_awesome</span>
            <span style="font-size:13px; color:rgba(255,255,255,0.7);">Did you mean: <strong style="color:#ff2e54;">${results.didYouMean}</strong></span>
          </div>
        `;
      }

      // Empty Search State
      if (songs.length === 0 && artists.length === 0 && albums.length === 0 && playlists.length === 0) {
        html += `
          <div class="empty-search-recovery" style="text-align:center; padding:32px 16px;">
            <span class="material-symbols-outlined" style="font-size:48px; color:var(--text-secondary); margin-bottom:8px;">search_off</span>
            <h3 style="font-size:18px; font-weight:800; color:#FFFFFF; margin-bottom:6px;">No exact results found</h3>
            <p style="font-size:13px; color:var(--text-secondary); margin-bottom:20px;">Try searching for a different song, artist, album, or explore trending genres.</p>
            <div class="search-chips-row" style="justify-content:center; gap:8px; margin-bottom:24px;">
              <button class="search-pill-btn" onclick="App.searchCategory('Arijit Singh')">Arijit Singh</button>
              <button class="search-pill-btn" onclick="App.searchCategory('The Weeknd')">The Weeknd</button>
              <button class="search-pill-btn" onclick="App.searchCategory('Ed Sheeran')">Ed Sheeran</button>
              <button class="search-pill-btn" onclick="App.searchCategory('Bollywood')">Bollywood</button>
              <button class="search-pill-btn" onclick="App.searchCategory('Lo-Fi Chill')">Lo-Fi Chill</button>
            </div>
          </div>
        `;
        container.innerHTML = html;
        return;
      }

      // BEST MATCH CARD (Driven by Deterministic Search Intent & Scoring)
      if (activeCategory === 'All') {
        const SE = (typeof SearchEngine !== 'undefined') ? SearchEngine : (typeof require !== 'undefined' ? require('./searchEngine.js') : null);
        const bestMatch = SE ? SE.evaluateBestMatch(results, results.query || results.normalizedQuery || '') : null;

        if (bestMatch && bestMatch.type === 'artist') {
          const art = bestMatch.item;
          html += `
            <div class="best-match-card" onclick="App.openArtist('${(art.name || art.title || '').replace(/'/g, "\\'")}')">
              <div class="best-match-art-wrap artist-circle">
                <img src="${API.getImageUrl(art)}" onerror="this.src='assets/logo.png'" alt="${art.title || art.name}">
              </div>
              <div class="best-match-info">
                <span class="best-match-badge">BEST MATCH • ARTIST</span>
                <div class="best-match-title">${art.title || art.name}</div>
                <div class="best-match-sub">${bestMatch.reason || 'Artist • Tap to view discography'}</div>
              </div>
              <div class="best-match-actions" onclick="event.stopPropagation();">
                <button class="best-match-play-btn" onclick="App.startArtistRadio('${(art.name || art.title || '').replace(/'/g, "\\'")}')" title="Start Artist Radio">
                  <span class="material-symbols-outlined">radio</span>
                </button>
              </div>
            </div>
          `;
        } else if (bestMatch && bestMatch.type === 'song') {
          const song = bestMatch.item;
          const sIdx = bestMatch.index || 0;
          html += `
            <div class="best-match-card" onclick="App.playSongFromSearch(${sIdx})">
              <div class="best-match-art-wrap">
                <img src="${song.image}" onerror="this.src='assets/logo.png'" alt="${song.name}">
              </div>
              <div class="best-match-info">
                <span class="best-match-badge">BEST MATCH • SONG</span>
                <div class="best-match-title">${song.name}</div>
                <div class="best-match-sub">${song.artists}</div>
              </div>
              <div class="best-match-actions" onclick="event.stopPropagation();">
                <button class="best-match-play-btn" onclick="App.playSongFromSearch(${sIdx})" title="Play">
                  <span class="material-symbols-outlined fill-icon">play_arrow</span>
                </button>
              </div>
            </div>
          `;
        } else if (bestMatch && bestMatch.type === 'album') {
          const alb = bestMatch.item;
          html += `
            <div class="best-match-card" onclick="App.openAlbumOrPlaylist('${alb.id}', 'album')">
              <div class="best-match-art-wrap">
                <img src="${API.getImageUrl(alb)}" onerror="this.src='assets/logo.png'" alt="${alb.title || alb.name}">
              </div>
              <div class="best-match-info">
                <span class="best-match-badge">BEST MATCH • ALBUM</span>
                <div class="best-match-title">${alb.title || alb.name}</div>
                <div class="best-match-sub">${formatArtists(alb.artists || alb.artist || 'Album')}</div>
              </div>
              <div class="best-match-actions" onclick="event.stopPropagation();">
                <button class="best-match-play-btn" onclick="App.openAlbumOrPlaylist('${alb.id}', 'album')" title="Open Album">
                  <span class="material-symbols-outlined fill-icon">album</span>
                </button>
              </div>
            </div>
          `;
        }
      }

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

      // Songs List (with Search -> Discovery bridge)
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
                  <div class="square-card-sub">${formatArtists(pl.subtitle || pl.artists || 'Playlist')}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      container.innerHTML = html;
    },

    // Render Dedicated Genre Detail Screen
    renderGenrePage(genreData) {
      const titleEl = document.getElementById('genre-screen-title');
      const headerBanner = document.getElementById('genre-header-banner');
      const songsContainer = document.getElementById('genre-songs-container');
      const artistsSection = document.getElementById('genre-artists-section');
      const artistsContainer = document.getElementById('genre-artists-container');

      if (titleEl) titleEl.textContent = genreData.title;
      if (headerBanner && genreData.gradient) {
        headerBanner.style.background = `${genreData.gradient}`;
      }

      if (songsContainer) {
        songsContainer.innerHTML = (genreData.songs || []).map((song, idx) => `
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
      }

      if (artistsContainer && artistsSection) {
        if (!genreData.topArtists || genreData.topArtists.length === 0) {
          artistsSection.style.display = 'none';
        } else {
          artistsSection.style.display = 'block';
          artistsContainer.innerHTML = genreData.topArtists.map(art => `
            <div class="artist-circle-card" onclick="App.openArtist('${art.name.replace(/'/g, "\\'")}')">
              <div class="artist-circle-img-wrap">
                <img src="${art.image}" onerror="this.src='assets/logo.png'" alt="${art.name}">
              </div>
              <div class="artist-circle-name">${art.name}</div>
              <div class="artist-circle-sub">Artist</div>
            </div>
          `).join('');
        }
      }
    },

    // Render Explore Feed (Charts & Playlists in Explore)
    renderExploreFeed(exploreData) {
      const chartsContainer = document.getElementById('explore-charts-container');
      if (!chartsContainer || !exploreData) return;

      const charts = exploreData.charts || [];
      if (charts.length > 0) {
        chartsContainer.innerHTML = charts.map(item => `
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
      }
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
    // ========================================================================
    // LIBRARY SCREEN 2.0 RENDERING (LibraryScreen.kt)
    // ========================================================================
    renderLibraryTab(tab = 'playlists', searchQuery = '', sortMode = 'recent') {
      const container = document.getElementById('library-tab-content');
      if (!container) return;

      const q = (searchQuery || '').toLowerCase().trim();

      // Update Quick Access counts
      const favs = Storage.getFavorites();
      const downloads = Storage.getDownloads();
      const quickLiked = document.getElementById('quick-liked-count');
      const quickDl = document.getElementById('quick-downloads-count');
      if (quickLiked) quickLiked.textContent = `${favs.length} tracks`;
      if (quickDl) quickDl.textContent = `${downloads.length} songs`;

      // 1. PLAYLISTS TAB
      if (tab === 'playlists') {
        let customPlaylists = Storage.getPlaylists();
        if (q) {
          customPlaylists = customPlaylists.filter(p => p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q)));
        }

        let html = `
          <div class="library-sort-bar">
            <span style="font-size:14px; font-weight:700; color:#fff;">Your Playlists (${customPlaylists.length})</span>
            <button class="lib-action-pill-btn" onclick="App.openCreatePlaylistModal()">
              <span class="material-symbols-outlined" style="font-size:16px;">add</span>
              <span>New</span>
            </button>
          </div>
        `;

        if (customPlaylists.length === 0) {
          html += `
            <div class="library-empty-state">
              <span class="material-symbols-outlined library-empty-icon">queue_music</span>
              <h4 class="library-empty-title">No playlists yet</h4>
              <p class="library-empty-sub">Create your first custom playlist to group your favorite songs and mixes.</p>
              <button class="library-empty-cta-btn" onclick="App.openCreatePlaylistModal()">
                <span class="material-symbols-outlined" style="font-size:18px;">add</span>
                <span>Create Playlist</span>
              </button>
            </div>
          `;
        } else {
          html += `<div class="playlists-cards-grid">`;
          html += customPlaylists.map(pl => {
            const isLikedSongs = pl.id === 'favorites_pl';
            const count = isLikedSongs ? favs.length : (pl.songs?.length || 0);
            const firstImg = isLikedSongs ? (favs[0]?.image || '') : (pl.songs?.[0]?.image || pl.cover || '');
            return `
              <div class="playlist-rich-card" onclick="App.openCustomPlaylist('${pl.id}')">
                <div class="playlist-rich-cover-wrap">
                  ${firstImg ? `<img src="${firstImg}" class="playlist-rich-cover-img" alt="${pl.name}" onerror="this.style.display='none'">` : ''}
                  <div class="playlist-icon-square" style="${firstImg ? 'display:none;' : ''}">
                    <span class="material-symbols-outlined" style="font-size:28px;">${isLikedSongs ? 'favorite' : 'queue_music'}</span>
                  </div>
                </div>
                <div class="playlist-rich-info">
                  <div style="min-width:0; flex:1;">
                    <div class="playlist-rich-title">${pl.name}</div>
                    <div class="playlist-rich-sub">${count} ${count === 1 ? 'song' : 'songs'}</div>
                  </div>
                  ${!isLikedSongs ? `
                    <button class="icon-btn-mini" onclick="event.stopPropagation(); App.openPlaylistMenu('${pl.id}');" aria-label="Options">
                      <span class="material-symbols-outlined" style="font-size:18px; color:var(--text-secondary);">more_vert</span>
                    </button>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('');
          html += `</div>`;
        }

        container.innerHTML = html;
      }

      // 2. SONGS (LIKED SONGS) TAB
      else if (tab === 'songs') {
        let songs = [...favs];
        if (q) {
          songs = songs.filter(s => s.name.toLowerCase().includes(q) || (s.artists && s.artists.toLowerCase().includes(q)));
        }

        // Apply Sorting
        if (sortMode === 'alpha') {
          songs.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortMode === 'artist') {
          songs.sort((a, b) => (a.artists || '').localeCompare(b.artists || ''));
        } else if (sortMode === 'album') {
          songs.sort((a, b) => (a.album || '').localeCompare(b.album || ''));
        }

        let html = `
          <div class="library-sort-bar">
            <div style="display:flex; align-items:center; gap:8px;">
              <select class="lib-sort-select" onchange="App.setLibrarySort(this.value)">
                <option value="recent" ${sortMode === 'recent' ? 'selected' : ''}>Recently Added</option>
                <option value="alpha" ${sortMode === 'alpha' ? 'selected' : ''}>Alphabetical</option>
                <option value="artist" ${sortMode === 'artist' ? 'selected' : ''}>Artist</option>
                <option value="album" ${sortMode === 'album' ? 'selected' : ''}>Album</option>
              </select>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <button class="lib-action-pill-btn" onclick="App.playLikedSongs()">
                <span class="material-symbols-outlined fill-icon" style="font-size:16px;">play_arrow</span>
                <span>Play All</span>
              </button>
              <button class="lib-action-pill-btn" onclick="App.shuffleLikedSongs()">
                <span class="material-symbols-outlined" style="font-size:16px;">shuffle</span>
              </button>
            </div>
          </div>
        `;

        if (songs.length === 0) {
          html += `
            <div class="library-empty-state">
              <span class="material-symbols-outlined library-empty-icon">favorite_border</span>
              <h4 class="library-empty-title">Your liked songs will appear here</h4>
              <p class="library-empty-sub">Favorite tracks by searching songs, albums, and artist discographies.</p>
              <button class="library-empty-cta-btn" onclick="App.navigate('search')">
                <span class="material-symbols-outlined" style="font-size:18px;">search</span>
                <span>Discover Music</span>
              </button>
            </div>
          `;
        } else {
          html += songs.map((song, idx) => `
            <div class="vertical-track-row" onclick="App.playSongFromFavsList(${idx})">
              <img class="vertical-track-img" src="${song.image}" onerror="this.src='assets/logo.png'" alt="${song.name}">
              <div class="vertical-track-info">
                <div class="vertical-track-title">${song.name}</div>
                <div class="vertical-track-artist">${song.artists || 'Unknown Artist'}</div>
              </div>
              <button class="vertical-track-more" onclick="event.stopPropagation(); App.openSongMenu('${song.id}', 'songs');" aria-label="More">
                <span class="material-symbols-outlined">more_vert</span>
              </button>
            </div>
          `).join('');
        }

        container.innerHTML = html;
      }

      // 3. ALBUMS TAB
      else if (tab === 'albums') {
        let savedAlbums = Storage.getSavedAlbums();
        if (q) {
          savedAlbums = savedAlbums.filter(a => (a.title || a.name || '').toLowerCase().includes(q) || (a.artist || a.artists || '').toLowerCase().includes(q));
        }

        let html = `
          <div class="library-sort-bar">
            <span style="font-size:14px; font-weight:700; color:#fff;">Saved Albums (${savedAlbums.length})</span>
          </div>
        `;

        if (savedAlbums.length === 0) {
          html += `
            <div class="library-empty-state">
              <span class="material-symbols-outlined library-empty-icon">album</span>
              <h4 class="library-empty-title">No saved albums yet</h4>
              <p class="library-empty-sub">Save your favorite studio albums and compilations for quick one-tap listening.</p>
              <button class="library-empty-cta-btn" onclick="App.navigate('explore')">
                <span class="material-symbols-outlined" style="font-size:18px;">explore</span>
                <span>Browse Albums</span>
              </button>
            </div>
          `;
        } else {
          html += `<div class="albums-cards-grid">`;
          html += savedAlbums.map(alb => `
            <div class="album-rich-card" onclick="App.openAlbumOrPlaylist('${alb.id}', 'album')">
              <img src="${alb.image || 'assets/logo.png'}" class="album-rich-cover" alt="${alb.title || alb.name}" onerror="this.src='assets/logo.png'">
              <div class="album-rich-info">
                <div class="album-rich-title">${alb.title || alb.name}</div>
                <div class="album-rich-artist">${alb.artist || alb.artists || 'Artist'} • ${alb.year || 'Album'}</div>
              </div>
            </div>
          `).join('');
          html += `</div>`;
        }

        container.innerHTML = html;
      }

      // 4. ARTISTS TAB
      else if (tab === 'artists') {
        let followed = Storage.getFollowedArtists();
        if (q) {
          followed = followed.filter(a => a.name.toLowerCase().includes(q));
        }

        let html = `
          <div class="library-sort-bar">
            <span style="font-size:14px; font-weight:700; color:#fff;">Followed Artists (${followed.length})</span>
          </div>
        `;

        if (followed.length === 0) {
          html += `
            <div class="library-empty-state">
              <span class="material-symbols-outlined library-empty-icon">person</span>
              <h4 class="library-empty-title">No followed artists yet</h4>
              <p class="library-empty-sub">Follow artists you love to track new releases and personalized recommendations.</p>
              <button class="library-empty-cta-btn" onclick="App.navigate('search')">
                <span class="material-symbols-outlined" style="font-size:18px;">search</span>
                <span>Find Artists</span>
              </button>
            </div>
          `;
        } else {
          html += followed.map(art => `
            <div class="artist-library-row" onclick="App.openArtist('${art.id || art.name}')">
              <div class="artist-library-left">
                <img src="${art.image || 'assets/logo.png'}" class="artist-library-avatar" alt="${art.name}" onerror="this.src='assets/logo.png'">
                <div>
                  <div class="artist-library-name">${art.name}</div>
                  <span style="font-size:12px; color:var(--text-secondary);">Artist • Following</span>
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <button class="icon-btn-mini" onclick="event.stopPropagation(); App.startArtistRadioSeed('${art.name}');" title="Artist Radio">
                  <span class="material-symbols-outlined">radio</span>
                </button>
                <button class="icon-btn-mini" onclick="event.stopPropagation(); App.unfollowArtistAction('${art.id || art.name}');" title="Unfollow">
                  <span class="material-symbols-outlined" style="color:var(--color-primary);">check_circle</span>
                </button>
              </div>
            </div>
          `).join('');
        }

        container.innerHTML = html;
      }

      // 5. HISTORY TAB
      else if (tab === 'history') {
        let history = Storage.getHistory();
        if (q) {
          history = history.filter(s => s.name.toLowerCase().includes(q) || (s.artists && s.artists.toLowerCase().includes(q)));
        }

        let html = `
          <div class="library-sort-bar">
            <span style="font-size:14px; font-weight:700; color:#fff;">Recently Played (${history.length})</span>
            ${history.length > 0 ? `
              <button class="search-clear-all-btn" onclick="App.clearListeningHistory()">Clear All</button>
            ` : ''}
          </div>
        `;

        if (history.length === 0) {
          html += `
            <div class="library-empty-state">
              <span class="material-symbols-outlined library-empty-icon">history</span>
              <h4 class="library-empty-title">Nothing played yet</h4>
              <p class="library-empty-sub">Your listening history will automatically be tracked here as you stream tracks.</p>
              <button class="library-empty-cta-btn" onclick="App.navigate('home')">
                <span class="material-symbols-outlined" style="font-size:18px;">home</span>
                <span>Listen Now</span>
              </button>
            </div>
          `;
        } else {
          html += history.map(song => `
            <div class="vertical-track-row" onclick="App.playSongWithQueue('${song.id}')">
              <img class="vertical-track-img" src="${song.image}" onerror="this.src='assets/logo.png'" alt="${song.name}">
              <div class="vertical-track-info">
                <div class="vertical-track-title">${song.name}</div>
                <div class="vertical-track-artist">${song.artists || 'Unknown Artist'}</div>
              </div>
              <div style="display:flex; align-items:center; gap:4px;">
                <button class="icon-btn-mini" onclick="event.stopPropagation(); App.removeHistoryTrack('${song.id}');" title="Remove from History">
                  <span class="material-symbols-outlined" style="font-size:18px; color:var(--text-secondary);">close</span>
                </button>
                <button class="vertical-track-more" onclick="event.stopPropagation(); App.openSongMenu('${song.id}', 'history');" aria-label="More">
                  <span class="material-symbols-outlined">more_vert</span>
                </button>
              </div>
            </div>
          `).join('');
        }

        container.innerHTML = html;
      }

      // 6. DOWNLOADS TAB (Smart Downloads & Storage Management 2.0 - Phase 9.3)
      else if (tab === 'downloads') {
        const metrics = (typeof SmartDownloadManager !== 'undefined')
          ? SmartDownloadManager.getStorageMetrics()
          : { downloadedCount: Storage.getDownloads().length, downloadedMb: 0, localCount: Storage.getLocalSongs().length, localMb: 0, totalUsedMb: 0, limitMb: 2048, percentUsed: 0 };

        let dlSongs = Storage.getDownloads();
        const isSmartEnabled = Storage.isSmartDownloadsEnabled ? Storage.isSmartDownloadsEnabled() : false;
        const activeTasks = (typeof DownloadManager !== 'undefined') ? DownloadManager.getTasks() : [];
        const pendingTasks = activeTasks.filter(t => t.status === 'DOWNLOADING' || t.status === 'QUEUED' || t.status === 'PAUSED' || t.status === 'FAILED');

        if (q) {
          dlSongs = dlSongs.filter(s => s.name.toLowerCase().includes(q) || (s.artists && s.artists.toLowerCase().includes(q)));
        }

        let html = `
          <!-- Storage & Smart Downloads Dashboard Widget -->
          <div class="storage-dashboard-card" style="margin-bottom:16px; padding:14px; background:linear-gradient(135deg, rgba(30,30,36,0.9), rgba(18,18,22,0.9)); border:1px solid rgba(255,255,255,0.08); border-radius:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <div>
                <span style="font-size:13px; font-weight:800; color:#fff; letter-spacing:0.5px; text-transform:uppercase;">Offline Storage</span>
                <span style="display:block; font-size:11.5px; color:var(--text-secondary); margin-top:2px;">
                  ${metrics.totalUsedMb} MB used of ${metrics.limitMb} MB limit (${metrics.percentUsed}%)
                </span>
              </div>
              <div style="display:flex; gap:6px;">
                <button class="lib-action-pill-btn" style="font-size:11px; padding:4px 10px;" onclick="App.openSettings();" title="Smart Download Settings">
                  <span class="material-symbols-outlined" style="font-size:14px;">tune</span>
                  <span>Settings</span>
                </button>
                <button class="lib-action-pill-btn" style="font-size:11px; padding:4px 10px; border-color:rgba(255,42,77,0.3); color:#FF2A4D;" onclick="App.openStorageCleanupDialog();" title="Manage Storage">
                  <span class="material-symbols-outlined" style="font-size:14px;">cleaning_services</span>
                  <span>Cleanup</span>
                </button>
              </div>
            </div>

            <!-- Storage Progress Bar (0% - 100%) -->
            <div style="width:100%; height:6px; background:rgba(255,255,255,0.1); border-radius:4px; overflow:hidden; margin:8px 0 10px 0;">
              <div style="width:${metrics.percentUsed}%; height:100%; background:${metrics.percentUsed > 90 ? '#FF2A4D' : 'linear-gradient(90deg, #00F2FE, #4FACFE)'}; border-radius:4px; transition:width 0.3s ease;"></div>
            </div>

            <!-- Breakdown Badges -->
            <div style="display:flex; flex-wrap:wrap; gap:8px; font-size:11px; color:var(--text-secondary);">
              <span style="padding:3px 8px; background:rgba(255,255,255,0.04); border-radius:8px; border:1px solid rgba(255,255,255,0.06);">
                🎵 Downloads: <strong style="color:#fff;">${metrics.downloadedCount}</strong> (${metrics.downloadedMb} MB)
              </span>
              <span style="padding:3px 8px; background:rgba(255,255,255,0.04); border-radius:8px; border:1px solid rgba(255,255,255,0.06);">
                📱 Device Music: <strong style="color:#fff;">${metrics.localCount}</strong> (${metrics.localMb} MB)
              </span>
              <span style="padding:3px 8px; background:rgba(255,255,255,0.04); border-radius:8px; border:1px solid rgba(255,255,255,0.06);">
                ⚡ Smart Downloads: <strong style="color:${isSmartEnabled ? '#00F2FE' : 'var(--text-secondary)'};">${isSmartEnabled ? 'ON' : 'OFF'}</strong>
              </span>
            </div>
          </div>

          <div class="library-sort-bar" style="flex-direction:column; align-items:stretch; gap:10px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <span style="font-size:14px; font-weight:700; color:#fff;">Downloaded Songs (${dlSongs.length})</span>
              </div>
              <div style="display:flex; gap:6px;">
                ${dlSongs.length > 0 ? `
                  <button class="lib-action-pill-btn" onclick="App.playDownloadedSongs()" title="Play All Downloads">
                    <span class="material-symbols-outlined fill-icon" style="font-size:16px;">play_arrow</span>
                    <span>Play All</span>
                  </button>
                  <button class="lib-action-pill-btn" style="border-color:rgba(255,42,77,0.3); color:#FF2A4D;" onclick="App.clearAllDownloadsAction()" title="Clear All Downloads">
                    <span class="material-symbols-outlined" style="font-size:16px;">delete_sweep</span>
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        `;

        // 1. ACTIVE DOWNLOAD QUEUE SECTION (if any tasks are active / queued / paused / failed)
        if (pendingTasks.length > 0) {
          html += `
            <div class="download-queue-shelf" style="margin-bottom:18px; padding:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:14px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span style="font-size:12px; font-weight:800; letter-spacing:0.5px; color:#FF2A4D; text-transform:uppercase;">Download Queue (${pendingTasks.length})</span>
                <div style="display:flex; gap:4px;">
                  <button class="lib-action-pill-btn" style="font-size:10px; padding:2px 8px;" onclick="DownloadManager.pauseAll()">Pause All</button>
                  <button class="lib-action-pill-btn" style="font-size:10px; padding:2px 8px;" onclick="DownloadManager.resumeAll()">Resume All</button>
                  <button class="lib-action-pill-btn" style="font-size:10px; padding:2px 8px; color:#FF2A4D;" onclick="DownloadManager.cancelAll()">Cancel All</button>
                </div>
              </div>
              <div class="download-tasks-list">
          `;

          pendingTasks.forEach(task => {
            const isDl = task.status === 'DOWNLOADING';
            const isPsd = task.status === 'PAUSED';
            const isFailed = task.status === 'FAILED';
            html += `
              <div class="vertical-track-row" style="background:rgba(20,20,24,0.6); margin-bottom:6px; border-radius:10px;">
                <img class="vertical-track-img" src="${task.image || 'assets/logo.png'}" onerror="this.src='assets/logo.png'" alt="${task.name}">
                <div class="vertical-track-info">
                  <div class="vertical-track-title">${task.name}</div>
                  <div class="vertical-track-artist" style="font-size:11px;">
                    ${isDl ? `<span style="color:#00F2FE;">Downloading ${task.progress}%</span>` : (isPsd ? '<span style="color:#F59E0B;">Paused</span>' : (isFailed ? '<span style="color:#FF2A4D;">Failed</span>' : '<span style="color:var(--text-secondary);">Queued</span>'))}
                    ${task.priority === 'smart' ? ' • <span style="color:#A78BFA;">Smart</span>' : ''}
                    ${task.totalBytes > 0 ? ` • ${(task.bytesDownloaded / (1024 * 1024)).toFixed(1)} / ${(task.totalBytes / (1024 * 1024)).toFixed(1)} MB` : ''}
                  </div>
                </div>
                <div style="display:flex; align-items:center; gap:4px;">
                  ${isDl ? `
                    <button class="icon-btn-mini" onclick="DownloadManager.pause('${task.id}')" title="Pause"><span class="material-symbols-outlined" style="font-size:18px;">pause</span></button>
                  ` : (isPsd || isFailed ? `
                    <button class="icon-btn-mini" onclick="DownloadManager.resume('${task.id}')" title="Resume"><span class="material-symbols-outlined" style="font-size:18px;">play_arrow</span></button>
                  ` : '')}
                  <button class="icon-btn-mini" onclick="DownloadManager.cancel('${task.id}')" title="Cancel"><span class="material-symbols-outlined" style="font-size:18px; color:var(--text-secondary);">close</span></button>
                </div>
              </div>
            `;
          });

          html += `</div></div>`;
        }

        // 2. COMPLETED DOWNLOADS LIST
        if (dlSongs.length === 0 && pendingTasks.length === 0) {
          html += `
            <div class="library-empty-state">
              <span class="material-symbols-outlined library-empty-icon">download_for_offline</span>
              <h4 class="library-empty-title">No downloads yet</h4>
              <p class="library-empty-sub">Download tracks for lossless offline listening anywhere with zero data usage.</p>
              <button class="library-empty-cta-btn" onclick="App.navigate('search')">
                <span class="material-symbols-outlined" style="font-size:18px;">search</span>
                <span>Find Songs to Download</span>
              </button>
            </div>
          `;
        } else if (dlSongs.length > 0) {
          html += dlSongs.map(song => {
            const isProtected = Storage.isDownloadProtected ? Storage.isDownloadProtected(song.id) : false;
            return `
              <div class="vertical-track-row" onclick="App.playSongWithQueue('${song.id}')">
                <img class="vertical-track-img" src="${song.image}" onerror="this.src='assets/logo.png'" alt="${song.name}">
                <div class="vertical-track-info">
                  <div class="vertical-track-title">${song.name}</div>
                  <div class="vertical-track-artist">${song.artists || 'Unknown Artist'} • <span style="color:#00F2FE; font-weight:600;">⬇ Offline Ready</span></div>
                </div>
                <div style="display:flex; align-items:center; gap:4px;">
                  <button class="icon-btn-mini" onclick="event.stopPropagation(); App.toggleProtectedDownloadAction('${song.id}');" title="${isProtected ? 'Protected from auto-cleanup' : 'Pin download'}">
                    <span class="material-symbols-outlined" style="font-size:18px; color:${isProtected ? '#00F2FE' : 'var(--text-secondary)'};">${isProtected ? 'bookmark' : 'bookmark_border'}</span>
                  </button>
                  <button class="icon-btn-mini" onclick="event.stopPropagation(); App.removeDownloadTrack('${song.id}');" title="Delete Download">
                    <span class="material-symbols-outlined" style="font-size:18px; color:#FF2A4D;">delete</span>
                  </button>
                  <button class="vertical-track-more" onclick="event.stopPropagation(); App.openSongMenu('${song.id}', 'downloads');" aria-label="More">
                    <span class="material-symbols-outlined">more_vert</span>
                  </button>
                </div>
              </div>
            `;
          }).join('');
        }

        container.innerHTML = html;
      }

      // 7. LOCAL MUSIC TAB
      else if (tab === 'local') {
        const localSongs = Storage.getLocalSongs();
        const localAlbums = Storage.getLocalAlbums();
        const localArtists = Storage.getLocalArtists();
        const localFolders = Storage.getLocalFolders();
        const localSubTab = window.currentLocalSubTab || 'songs';

        let html = `
          <div class="library-sort-bar" style="flex-direction:column; align-items:stretch; gap:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <span style="font-size:14px; font-weight:700; color:#fff;">Local Device Music</span>
                <span style="display:block; font-size:11.5px; color:var(--text-secondary);">${localSongs.length} local files</span>
              </div>
              <div style="display:flex; gap:6px;">
                <button class="lib-action-pill-btn" onclick="App.triggerFolderImport()" title="Import entire music folder">
                  <span class="material-symbols-outlined" style="font-size:16px;">folder_open</span>
                  <span>Add Folder</span>
                </button>
                <button class="lib-action-pill-btn" onclick="App.triggerFilesImport()" title="Import individual audio files">
                  <span class="material-symbols-outlined" style="font-size:16px;">file_upload</span>
                  <span>Add Files</span>
                </button>
              </div>
            </div>
            <!-- Sub-Tabs: Songs, Albums, Artists, Folders -->
            <div class="local-sub-tabs-bar">
              <button class="local-sub-tab-btn ${localSubTab === 'songs' ? 'active' : ''}" onclick="App.setLocalSubTab('songs')">Songs (${localSongs.length})</button>
              <button class="local-sub-tab-btn ${localSubTab === 'albums' ? 'active' : ''}" onclick="App.setLocalSubTab('albums')">Albums (${localAlbums.length})</button>
              <button class="local-sub-tab-btn ${localSubTab === 'artists' ? 'active' : ''}" onclick="App.setLocalSubTab('artists')">Artists (${localArtists.length})</button>
              <button class="local-sub-tab-btn ${localSubTab === 'folders' ? 'active' : ''}" onclick="App.setLocalSubTab('folders')">Folders (${localFolders.length})</button>
            </div>
          </div>
        `;

        if (localSongs.length === 0) {
          html += `
            <div class="library-empty-state">
              <span class="material-symbols-outlined library-empty-icon">folder_open</span>
              <h4 class="library-empty-title">Device Audio Files</h4>
              <p class="library-empty-sub">Import and play MP3, M4A, AAC, WAV, FLAC, and OGG files with automatic ID3 metadata extraction.</p>
              <div style="display:flex; gap:8px; justify-content:center; margin-top:12px;">
                <button class="library-empty-cta-btn" onclick="App.triggerFolderImport()">
                  <span class="material-symbols-outlined" style="font-size:18px;">folder</span>
                  <span>Select Music Folder</span>
                </button>
                <button class="library-empty-cta-btn" style="background:var(--surface);" onclick="App.triggerFilesImport()">
                  <span class="material-symbols-outlined" style="font-size:18px;">audio_file</span>
                  <span>Select Files</span>
                </button>
              </div>
            </div>
          `;
        } else if (localSubTab === 'albums') {
          html += `<div class="playlists-grid">` + localAlbums.map(alb => `
            <div class="playlist-rich-card" onclick="App.playLocalCollection('${alb.id}', 'album')">
              <img class="playlist-rich-card-cover" src="${alb.image}" onerror="this.src='assets/logo.png'" alt="${alb.name}">
              <div class="playlist-rich-card-info">
                <div class="playlist-rich-card-name">${alb.name}</div>
                <div class="playlist-rich-card-count">${alb.artist} • ${alb.songCount} songs</div>
              </div>
            </div>
          `).join('') + `</div>`;
        } else if (localSubTab === 'artists') {
          html += localArtists.map(art => `
            <div class="vertical-track-row" onclick="App.playLocalCollection('${art.id}', 'artist')">
              <img class="vertical-track-img" style="border-radius:50%;" src="${art.image}" onerror="this.src='assets/logo.png'" alt="${art.name}">
              <div class="vertical-track-info">
                <div class="vertical-track-title">${art.name}</div>
                <div class="vertical-track-artist">${art.songCount} local tracks</div>
              </div>
              <span class="material-symbols-outlined" style="color:var(--text-secondary);">chevron_right</span>
            </div>
          `).join('');
        } else if (localSubTab === 'folders') {
          html += localFolders.map(fld => `
            <div class="vertical-track-row" onclick="App.playLocalCollection('${fld.id}', 'folder')">
              <div class="playlist-icon-square" style="width:48px; height:48px; border-radius:8px; background:rgba(5,150,105,0.2); color:#10B981;">
                <span class="material-symbols-outlined" style="font-size:24px;">folder</span>
              </div>
              <div class="vertical-track-info">
                <div class="vertical-track-title">${fld.name}</div>
                <div class="vertical-track-artist">${fld.songCount} songs in folder</div>
              </div>
              <span class="material-symbols-outlined" style="color:var(--text-secondary);">chevron_right</span>
            </div>
          `).join('');
        } else {
          // Default: Songs
          html += localSongs.map(song => `
            <div class="vertical-track-row" onclick="App.playLocalTrack('${song.id}')">
              <img class="vertical-track-img" src="${song.image || 'assets/logo.png'}" onerror="this.src='assets/logo.png'" alt="${song.name}">
              <div class="vertical-track-info">
                <div class="vertical-track-title">${song.name}</div>
                <div class="vertical-track-artist">${song.artists || 'Local File'} • <span style="color:#059669; font-weight:600;">📱 Local</span></div>
              </div>
              <div style="display:flex; align-items:center; gap:4px;">
                <button class="icon-btn-mini" onclick="event.stopPropagation(); App.removeLocalTrackAction('${song.id}');" title="Remove from Library">
                  <span class="material-symbols-outlined" style="font-size:18px; color:var(--text-secondary);">close</span>
                </button>
                <button class="vertical-track-more" onclick="event.stopPropagation(); App.openSongMenu('${song.id}', 'local');" aria-label="More">
                  <span class="material-symbols-outlined">more_vert</span>
                </button>
              </div>
            </div>
          `).join('');
        }

        container.innerHTML = html;
      }
    },

    // ========================================================================
    // PLAYLIST DETAIL SCREEN (PlaylistDetail.kt)
    // ========================================================================
    renderPlaylistDetail(playlistId, searchQuery = '', sortMode = 'custom') {
      const pl = Storage.getPlaylistById(playlistId);
      if (!pl) return;

      const container = document.getElementById('detail-tracks-container');
      const titleEl = document.getElementById('detail-title');
      const subEl = document.getElementById('detail-subtitle');
      const coverImg = document.getElementById('detail-cover-img');
      const playBtn = document.getElementById('btn-detail-play-all');

      let songs = pl.songs || [];
      const totalSec = songs.reduce((acc, s) => acc + (Number(s.duration) || 0), 0);
      const durStr = totalSec > 0 ? ` • ${Math.floor(totalSec / 60)} min` : '';

      if (titleEl) titleEl.textContent = pl.name;
      if (subEl) subEl.textContent = `${pl.description ? pl.description + ' • ' : ''}${songs.length} ${songs.length === 1 ? 'track' : 'tracks'}${durStr}`;
      if (coverImg) {
        coverImg.src = pl.cover || (songs[0] && songs[0].image) || 'assets/logo.png';
      }

      if (playBtn) {
        playBtn.onclick = () => App.playCustomPlaylist(playlistId);
      }

      // Filter by in-playlist search
      const q = (searchQuery || '').toLowerCase().trim();
      let filtered = [...songs];
      if (q) {
        filtered = filtered.filter(s => (s.name || '').toLowerCase().includes(q) || (s.artists || s.primaryArtist || '').toLowerCase().includes(q));
      }

      // Sort
      filtered = Storage.sortPlaylistTracks(filtered, sortMode);

      let html = `
        <div class="detail-action-bar" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="lib-action-pill-btn" onclick="App.shuffleCustomPlaylist('${pl.id}')" title="Shuffle Playlist">
              <span class="material-symbols-outlined" style="font-size:16px;">shuffle</span>
              <span>Shuffle</span>
            </button>
            <button class="lib-action-pill-btn" onclick="App.startPlaylistRadio('${pl.id}')" title="Playlist Radio">
              <span class="material-symbols-outlined" style="font-size:16px;">radio</span>
              <span>Radio</span>
            </button>
            <button class="lib-action-pill-btn" onclick="App.downloadPlaylistAction('${pl.id}')" title="Download Playlist">
              <span class="material-symbols-outlined" style="font-size:16px;">download</span>
              <span>Download</span>
            </button>
          </div>
          <div style="display:flex; align-items:center; gap:6px;">
            <button class="icon-btn-mini" onclick="App.openEditPlaylistModal('${pl.id}')" title="Edit Playlist">
              <span class="material-symbols-outlined" style="font-size:18px;">edit</span>
            </button>
            <button class="icon-btn-mini" onclick="App.exportPlaylistAction('${pl.id}')" title="Export Playlist">
              <span class="material-symbols-outlined" style="font-size:18px;">share</span>
            </button>
          </div>
        </div>

        <!-- In-Playlist Search & Filter -->
        <div class="playlist-filter-bar" style="display:flex; gap:8px; margin-bottom:14px;">
          <input type="text" class="search-input" style="height:36px; font-size:12.5px;" placeholder="Search in ${pl.name}..." value="${searchQuery}" oninput="App.filterCurrentPlaylist(this.value)">
        </div>
      `;

      if (filtered.length === 0) {
        html += `
          <div class="library-empty-state" style="padding:40px 10px;">
            <span class="material-symbols-outlined library-empty-icon">queue_music</span>
            <h4 class="library-empty-title">${q ? 'No matching tracks' : 'Playlist is empty'}</h4>
            <p class="library-empty-sub">${q ? 'Try a different search term.' : 'Discover music to add to this playlist.'}</p>
            <button class="library-empty-cta-btn" onclick="App.navigate('explore')">
              <span class="material-symbols-outlined" style="font-size:18px;">explore</span>
              <span>Discover Music</span>
            </button>
          </div>
        `;
      } else {
        html += `<div class="playlist-tracks-list">`;
        filtered.forEach((song, idx) => {
          const actualIdx = songs.findIndex(s => String(s.id) === String(song.id));
          html += `
            <div class="vertical-track-row" draggable="true" ondragstart="App.handlePlaylistDragStart(event, ${actualIdx})" ondragover="App.handlePlaylistDragOver(event)" ondrop="App.handlePlaylistDrop(event, '${pl.id}', ${actualIdx})" onclick="App.playCustomPlaylistTrack('${pl.id}', ${actualIdx})">
              <span class="material-symbols-outlined queue-drag-handle" title="Drag to reorder">drag_indicator</span>
              <img class="vertical-track-img" src="${song.image || 'assets/logo.png'}" onerror="this.src='assets/logo.png'" alt="${song.name}">
              <div class="vertical-track-info">
                <div class="vertical-track-title">${song.name}</div>
                <div class="vertical-track-artist">${song.artists || song.primaryArtist || 'Unknown Artist'}</div>
              </div>
              <div style="display:flex; align-items:center; gap:4px;">
                <button class="queue-delete-btn" onclick="event.stopPropagation(); App.removeTrackFromCustomPlaylist('${pl.id}', '${song.id}');" title="Remove from Playlist">
                  <span class="material-symbols-outlined" style="font-size:18px;">close</span>
                </button>
                <button class="vertical-track-more" onclick="event.stopPropagation(); App.openSongMenu('${song.id}', '${pl.id}');" aria-label="More">
                  <span class="material-symbols-outlined">more_vert</span>
                </button>
              </div>
            </div>
          `;
        });
        html += `</div>`;
      }

      if (container) container.innerHTML = html;
    },

    // ========================================================================
    // PLAYER SCREEN & FLOATING MINI PLAYER (PlayerScreen.kt & MiniPlayer.kt)
    // ========================================================================
    updatePlayerBar(song) {
      if (!song) return;

      const isFav = (typeof Storage !== 'undefined' && Storage.isFavorite) ? Storage.isFavorite(song.id || song) : false;
      const isDl = (typeof Storage !== 'undefined' && Storage.isDownloaded) ? Storage.isDownloaded(song.id) : false;
      const isLoc = song.source === 'LOCAL' || (song.streamUrl && song.streamUrl.startsWith('blob:'));

      // 1. Floating MiniPlayer
      const miniPlayer = document.getElementById('mini-player');
      const miniArt = document.getElementById('mini-player-art');
      const miniTitle = document.getElementById('mini-song-title');
      const miniArtist = document.getElementById('mini-artist-name');
      const miniBadge = document.getElementById('mini-source-badge');
      const miniLikeIcon = document.getElementById('mini-like-icon');

      if (miniPlayer) miniPlayer.style.display = 'flex';
      if (miniArt) miniArt.src = song.image || 'assets/logo.png';
      if (miniTitle) miniTitle.textContent = song.name || 'Unknown Track';
      if (miniArtist) miniArtist.textContent = song.artists || song.primaryArtist || 'MusicFlow';

      if (miniBadge) {
        if (isLoc) {
          miniBadge.textContent = '● LOCAL';
          miniBadge.style.display = 'inline-block';
          miniBadge.style.color = '#38EF7D';
          miniBadge.style.borderColor = 'rgba(56, 239, 125, 0.3)';
          miniBadge.style.background = 'rgba(56, 239, 125, 0.12)';
        } else if (isDl) {
          miniBadge.textContent = '● DOWNLOADED';
          miniBadge.style.display = 'inline-block';
          miniBadge.style.color = '#00F2FE';
          miniBadge.style.borderColor = 'rgba(0, 242, 254, 0.3)';
          miniBadge.style.background = 'rgba(0, 242, 254, 0.12)';
        } else {
          miniBadge.textContent = '320K';
          miniBadge.style.display = 'inline-block';
          miniBadge.style.color = '#FF2A4D';
          miniBadge.style.borderColor = 'rgba(255, 42, 77, 0.3)';
          miniBadge.style.background = 'rgba(255, 42, 77, 0.12)';
        }
      }

      if (miniLikeIcon) {
        miniLikeIcon.textContent = isFav ? 'favorite' : 'favorite_border';
        miniLikeIcon.style.color = isFav ? '#FF2A4D' : 'rgba(255, 255, 255, 0.7)';
        miniLikeIcon.style.fontVariationSettings = isFav ? "'FILL' 1, 'wght' 600" : "'FILL' 0, 'wght' 400";
      }

      // 2. Full Player Sheet
      const fullArt = document.getElementById('full-player-art');
      const fullTitle = document.getElementById('full-player-title');
      const fullArtist = document.getElementById('full-player-artist');
      const heartIcon = document.getElementById('player-heart-icon');
      const heartBtn = document.getElementById('btn-player-favorite');
      const curTime = document.getElementById('player-time-current');
      const totalTime = document.getElementById('player-time-total');
      const contextTitle = document.getElementById('player-context-title');
      const sourceBadge = document.getElementById('player-source-badge');
      const dlIcon = document.getElementById('player-download-icon');
      const dlLabel = document.getElementById('player-download-label');
      const qualityBadge = document.getElementById('player-quality-badge');

      if (fullArt) fullArt.src = song.image || 'assets/logo.png';
      if (fullTitle) fullTitle.textContent = song.name || 'Unknown Track';
      if (fullArtist) {
        fullArtist.textContent = song.artists || song.primaryArtist || 'MusicFlow';
        fullArtist.onclick = () => {
          App.collapseFullPlayer();
          App.openArtist(song.primaryArtist || song.artists);
        };
      }
      if (totalTime) totalTime.textContent = (song.duration && !isNaN(song.duration) && song.duration > 0) ? formatTime(song.duration) : '0:00';
      if (curTime && !window._isUserSeeking && typeof Player !== 'undefined') {
        const curPos = Player.getPosition ? Player.getPosition() : 0;
        curTime.textContent = formatTime(curPos);
      }

      if (qualityBadge) {
        const q = (typeof Storage !== 'undefined' && Storage.getAudioQuality) ? Storage.getAudioQuality() : '320kbps';
        qualityBadge.textContent = q.toUpperCase().replace('KBPS', ' KBPS');
      }

      if (contextTitle) {
        let cleanContext = (song.album || '').replace(/\(From .*\)/i, '').replace(/- .*/, '').trim();
        if (cleanContext.length > 24) cleanContext = cleanContext.substring(0, 24) + '...';
        contextTitle.textContent = cleanContext || (song.primaryArtist ? `${song.primaryArtist} Radio` : 'Top Hits');
      }

      if (sourceBadge) {
        if (isLoc) {
          sourceBadge.textContent = '● LOCAL';
          sourceBadge.style.display = 'inline-block';
          sourceBadge.style.color = '#38EF7D';
          sourceBadge.style.borderColor = 'rgba(56, 239, 125, 0.3)';
          sourceBadge.style.background = 'rgba(56, 239, 125, 0.12)';
        } else {
          // Avoid duplicate DOWNLOADED indicator in metadata row (indicated on bottom utility button)
          sourceBadge.style.display = 'none';
        }
      }

      if (heartBtn && heartIcon) {
        heartBtn.classList.toggle('active', isFav);
        heartBtn.setAttribute('aria-label', isFav ? 'Remove from Favorites' : 'Add to Favorites');
        heartIcon.textContent = isFav ? 'favorite' : 'favorite_border';
        heartIcon.style.color = isFav ? '#FF2A4D' : 'rgba(255, 255, 255, 0.7)';
        heartIcon.style.fontVariationSettings = isFav ? "'FILL' 1, 'wght' 600" : "'FILL' 0, 'wght' 400";
      }

      if (dlIcon && dlLabel) {
        if (isDl) {
          dlIcon.textContent = 'cloud_done';
          dlIcon.style.color = '#00F2FE';
          dlLabel.textContent = 'Downloaded';
        } else if (isLoc) {
          dlIcon.textContent = 'folder';
          dlIcon.style.color = '#38EF7D';
          dlLabel.textContent = 'Device File';
        } else {
          dlIcon.textContent = 'download';
          dlIcon.style.color = 'var(--text-secondary)';
          dlLabel.textContent = 'Download';
        }
      }

      // Sync Shuffle & Repeat UI state
      if (typeof Player !== 'undefined') {
        this.updateShuffleState(Player.getIsShuffle());
        this.updateRepeatState(Player.getRepeatMode());
      }

      // Update dynamic audio output device UI
      if (typeof AudioOutputManager !== 'undefined' && AudioOutputManager.updateUI) {
        AudioOutputManager.updateUI();
      }

      // Extract dynamic colors for ambient lighting
      setDynamicColor(song.image);
    },

    updatePlaybackState(isPlaying, playbackState = '') {
      const miniPlayIcon = document.getElementById('mini-play-icon');
      const playerMainPlayIcon = document.getElementById('player-main-play-icon');
      const miniPlayBtn = document.getElementById('btn-mini-play');
      const playerMainPlayBtn = document.getElementById('btn-player-play');

      const isBuffering = (playbackState === 'BUFFERING' || playbackState === 'LOADING');
      const isError = (playbackState === 'ERROR');

      if (miniPlayIcon) {
        if (isError) {
          miniPlayIcon.textContent = 'play_arrow';
          miniPlayIcon.style.animation = 'none';
        } else if (isBuffering) {
          miniPlayIcon.textContent = 'sync';
          miniPlayIcon.style.animation = 'spin 1.2s linear infinite';
        } else {
          miniPlayIcon.textContent = isPlaying ? 'pause' : 'play_arrow';
          miniPlayIcon.style.animation = 'none';
        }
      }

      if (playerMainPlayIcon) {
        if (isError) {
          playerMainPlayIcon.textContent = 'play_arrow';
          playerMainPlayIcon.style.animation = 'none';
        } else if (isBuffering) {
          playerMainPlayIcon.textContent = 'sync';
          playerMainPlayIcon.style.animation = 'spin 1.2s linear infinite';
        } else {
          playerMainPlayIcon.textContent = isPlaying ? 'pause' : 'play_arrow';
          playerMainPlayIcon.style.animation = 'none';
        }
      }

      if (miniPlayBtn) {
        miniPlayBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
      }
      if (playerMainPlayBtn) {
        playerMainPlayBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
      }
    },

    updatePlaybackProgress(currentTime, duration) {
      const curTimeEl = document.getElementById('player-time-current');
      const totTimeEl = document.getElementById('player-time-total');
      const seekFill = document.getElementById('player-seek-fill');
      const seekThumb = document.getElementById('player-seek-thumb');
      const seekBar = document.getElementById('player-seek-bar');

      const cleanCur = isNaN(currentTime) ? 0 : Math.max(0, currentTime);
      const cleanDur = (isNaN(duration) || duration <= 0) ? 0 : duration;

      if (!window._isUserSeeking) {
        if (curTimeEl) curTimeEl.textContent = formatTime(cleanCur);
        if (totTimeEl) totTimeEl.textContent = cleanDur > 0 ? formatTime(cleanDur) : '0:00';

        if (cleanDur > 0) {
          const pct = Math.min(100, Math.max(0, (cleanCur / cleanDur) * 100));
          if (seekFill) seekFill.style.width = `${pct.toFixed(2)}%`;
          if (seekThumb) seekThumb.style.left = `${pct.toFixed(2)}%`;
          if (seekBar) {
            seekBar.setAttribute('aria-valuenow', String(Math.round(pct)));
            seekBar.setAttribute('aria-valuetext', `${formatTime(cleanCur)} of ${formatTime(cleanDur)}`);
          }
        } else {
          if (seekFill) seekFill.style.width = '0%';
          if (seekThumb) seekThumb.style.left = '0%';
          if (seekBar) {
            seekBar.setAttribute('aria-valuenow', '0');
            seekBar.setAttribute('aria-valuetext', '0:00');
          }
        }
      } else {
        if (totTimeEl && cleanDur > 0) totTimeEl.textContent = formatTime(cleanDur);
      }
    },

    updateShuffleState(isShuffle) {
      const shuffleBtn = document.getElementById('btn-player-shuffle');
      const shuffleIcon = document.getElementById('player-shuffle-icon');
      if (shuffleBtn) {
        shuffleBtn.classList.toggle('active', isShuffle);
        shuffleBtn.setAttribute('aria-label', isShuffle ? 'Shuffle On' : 'Shuffle Off');
      }
      if (shuffleIcon) {
        shuffleIcon.style.color = isShuffle ? '#FF2A4D' : 'rgba(255, 255, 255, 0.7)';
      }
    },

    updateRepeatState(repeatMode) {
      const repeatBtn = document.getElementById('btn-player-repeat');
      const repeatIcon = document.getElementById('player-repeat-icon');
      const isActive = (repeatMode === 'ALL' || repeatMode === 'ONE');
      if (repeatBtn) {
        repeatBtn.classList.toggle('active', isActive);
        repeatBtn.setAttribute('aria-label', repeatMode === 'ONE' ? 'Repeat One' : (repeatMode === 'ALL' ? 'Repeat All' : 'Repeat Off'));
      }
      if (repeatIcon) {
        repeatIcon.textContent = repeatMode === 'ONE' ? 'repeat_one' : 'repeat';
        repeatIcon.style.color = isActive ? '#FF2A4D' : 'rgba(255, 255, 255, 0.7)';
      }
    },

    showToast(message) {
      let toast = document.getElementById('mf-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'mf-toast';
        toast.style.cssText = 'position:fixed; bottom:calc(136px + env(safe-area-inset-bottom, 12px)); left:50%; transform:translateX(-50%); background:rgba(20,20,24,0.94); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); color:#FFF; padding:10px 22px; border-radius:24px; font-size:13px; font-weight:600; box-shadow:0 8px 32px rgba(0,0,0,0.8), 0 0 16px rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.14); z-index:99999; pointer-events:none; transition:all 0.25s cubic-bezier(0.34,1.56,0.64,1); opacity:0; transform:translate(-50%, 15px) scale(0.9);';
        document.body.appendChild(toast);
      }
      toast.textContent = message;
      toast.style.opacity = '1';
      toast.style.transform = 'translate(-50%, 0) scale(1)';
      clearTimeout(this._toastTimeout);
      this._toastTimeout = setTimeout(() => {
        if (toast) {
          toast.style.opacity = '0';
          toast.style.transform = 'translate(-50%, 15px) scale(0.9)';
        }
      }, 2400);
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
          <div style="text-align:center; padding:50px 20px; color:var(--text-secondary);">
            <span class="material-symbols-outlined" style="font-size:48px; opacity:0.35; margin-bottom:12px;">queue_music</span>
            <h4 style="color:#FFF; font-size:16px; font-weight:700; margin-bottom:6px;">Queue is empty</h4>
            <p style="font-size:13px; margin-bottom:16px;">Discover songs to build your playback queue</p>
            <button class="library-empty-cta-btn" onclick="App.closeBottomSheet('sheet-queue'); App.navigate('explore');">
              <span class="material-symbols-outlined">explore</span>
              <span>Discover Music</span>
            </button>
          </div>
        `;
        return;
      }

      const currentSong = (currentIndex >= 0 && currentIndex < queue.length) ? queue[currentIndex] : null;
      const upcomingSongs = queue.slice(currentIndex + 1);

      let html = '';

      // 1. NOW PLAYING Section
      if (currentSong) {
        const isLoc = currentSong.source === 'LOCAL' || (currentSong.streamUrl && currentSong.streamUrl.startsWith('blob:'));
        const isDl = (typeof Storage !== 'undefined' && Storage.isDownloaded && Storage.isDownloaded(currentSong.id));
        html += `
          <div class="queue-section-header">NOW PLAYING</div>
          <div class="queue-track-row active" onclick="App.expandFullPlayer()">
            <img class="vertical-track-img" src="${currentSong.image || 'assets/logo.png'}" onerror="this.src='assets/logo.png'" alt="${currentSong.name}">
            <div class="vertical-track-info">
              <div class="vertical-track-title" style="color:#FF2A4D; font-weight:800;">${currentSong.name}</div>
              <div class="vertical-track-artist">${currentSong.artists || currentSong.primaryArtist || 'MusicFlow'}</div>
            </div>
            <span class="material-symbols-outlined fill-icon" style="color:#FF2A4D; font-size:22px; margin-right:8px;">graphic_eq</span>
          </div>
        `;
      }

      // 2. UP NEXT Section
      if (upcomingSongs.length > 0) {
        html += `<div class="queue-section-header">UP NEXT (${upcomingSongs.length})</div>`;
        upcomingSongs.forEach((song, i) => {
          const actualIdx = currentIndex + 1 + i;
          const songTitle = song.name || 'Track';
          const songArtist = song.artists || song.primaryArtist || 'MusicFlow';
          html += `
            <div class="queue-track-row" draggable="true" ondragstart="App.handleQueueDragStart(event, ${actualIdx})" ondragover="App.handleQueueDragOver(event)" ondrop="App.handleQueueDrop(event, ${actualIdx})" onclick="Player.playTrackAtIndex ? Player.playTrackAtIndex(${actualIdx}, true) : App.playSongWithQueue('${song.id}')">
              <span class="material-symbols-outlined queue-drag-handle" title="Drag to reorder">drag_indicator</span>
              <img class="vertical-track-img" src="${song.image || 'assets/logo.png'}" onerror="this.src='assets/logo.png'" alt="${songTitle}">
              <div class="vertical-track-info">
                <div class="vertical-track-title">${songTitle}</div>
                <div class="vertical-track-artist">${songArtist}</div>
              </div>
              <button class="queue-delete-btn" onclick="event.stopPropagation(); App.removeTrackFromQueue(${actualIdx});" aria-label="Remove from Queue" title="Remove">
                <span class="material-symbols-outlined" style="font-size:18px;">close</span>
              </button>
            </div>
          `;
        });
      }

      container.innerHTML = html;
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
      if (!eqData) return;
      const presetsContainer = document.getElementById('eq-presets-container');
      const bandsContainer = document.getElementById('eq-bands-container');
      const switchEl = document.getElementById('eq-switch');
      const spatialBadge = document.getElementById('eq-spatial-val-badge');
      const spatialButtons = document.querySelectorAll('#eq-spatial-levels .eq-seg-btn');
      const stereoMeter = document.getElementById('eq-stereo-meter');

      const bassSlider = document.getElementById('eq-bass-slider');
      const bassVal = document.getElementById('eq-bass-val');
      const trebleSlider = document.getElementById('eq-treble-slider');
      const trebleVal = document.getElementById('eq-treble-val');
      const vocalSlider = document.getElementById('eq-vocal-slider');
      const vocalVal = document.getElementById('eq-vocal-val');

      const normSwitch = document.getElementById('eq-norm-switch');
      const crossfadeSelect = document.getElementById('eq-crossfade-select');

      // Master switch
      if (switchEl) switchEl.checked = eqData.enabled !== false;

      // 3D Spatial Level
      const spatialLevel = eqData.spatial || (eqData.virtualizer > 0 ? (eqData.virtualizer >= 60 ? 'HIGH' : 'MEDIUM') : 'OFF');
      if (spatialBadge) {
        spatialBadge.textContent = spatialLevel;
        spatialBadge.style.color = spatialLevel === 'OFF' ? 'var(--text-secondary)' : '#FF2A4D';
      }
      if (spatialButtons && spatialButtons.length > 0) {
        spatialButtons.forEach(btn => {
          btn.classList.toggle('active', btn.dataset.level === spatialLevel);
        });
      }
      if (stereoMeter) {
        if (spatialLevel === 'HIGH') stereoMeter.textContent = '◀◀────●────▶▶';
        else if (spatialLevel === 'MEDIUM') stereoMeter.textContent = '◀───●───▶';
        else if (spatialLevel === 'LOW') stereoMeter.textContent = '◀──●──▶';
        else stereoMeter.textContent = '───●───';
      }

      // Sound Enhancements
      const bassBoost = eqData.bassBoost !== undefined ? eqData.bassBoost : 0;
      if (bassSlider) bassSlider.value = bassBoost;
      if (bassVal) bassVal.textContent = `${bassBoost > 0 ? '+' + bassBoost : bassBoost} dB`;

      const trebleBoost = eqData.trebleBoost !== undefined ? eqData.trebleBoost : 0;
      if (trebleSlider) trebleSlider.value = trebleBoost;
      if (trebleVal) trebleVal.textContent = `${trebleBoost > 0 ? '+' + trebleBoost : trebleBoost} dB`;

      const vocalBoost = eqData.vocalBoost !== undefined ? eqData.vocalBoost : 0;
      if (vocalSlider) vocalSlider.value = vocalBoost;
      if (vocalVal) vocalVal.textContent = `${vocalBoost > 0 ? '+' + vocalBoost : vocalBoost} dB`;

      if (normSwitch) normSwitch.checked = eqData.normalization !== false;
      if (crossfadeSelect) crossfadeSelect.value = String(eqData.crossfade || 0);

      // Presets (Built-in + User Saved)
      if (presetsContainer) {
        const builtIn = ['Flat', 'Bass Boost', 'Treble', 'Vocal', 'Rock', 'Pop', 'Hip-Hop', 'Classical', 'Jazz', 'Electronic', 'Bollywood', 'Lo-Fi', 'Acoustic'];
        const userPresets = (typeof Storage !== 'undefined' && typeof Storage.getUserPresets === 'function') ? Object.keys(Storage.getUserPresets()) : [];
        const allPresets = [...builtIn, ...userPresets];

        presetsContainer.innerHTML = allPresets.map(p => {
          const isUser = userPresets.includes(p);
          const isSelected = eqData.preset === p;
          return `
            <div style="position:relative; display:inline-flex; align-items:center;">
              <button class="eq-preset-chip ${isSelected ? 'active' : ''}" onclick="App.selectEqPreset('${p}')" style="white-space:nowrap; padding:6px 14px; font-size:12px; font-weight:700;">
                ${p}
              </button>
              ${isUser ? `
                <button onclick="event.stopPropagation(); App.deleteCustomPreset('${p}')" title="Delete preset" style="background:transparent; border:none; color:var(--text-secondary); cursor:pointer; margin-left:-8px; margin-right:4px;">
                  <span class="material-symbols-outlined" style="font-size:14px;">close</span>
                </button>
              ` : ''}
            </div>
          `;
        }).join('');
      }

      // 7-Band Equalizer Sliders (60Hz, 150Hz, 400Hz, 1kHz, 2.4kHz, 6kHz, 15kHz)
      if (bandsContainer) {
        const labels = ['60Hz\nSub', '150Hz\nBass', '400Hz\nLow-Mid', '1kHz\nMid', '2.4kHz\nPres', '6kHz\nBrill', '15kHz\nAir'];
        const bands = (Array.isArray(eqData.bands) && eqData.bands.length >= 5)
          ? (eqData.bands.length === 7 ? eqData.bands : [...eqData.bands, 0, 0].slice(0, 7))
          : [0, 0, 0, 0, 0, 0, 0];

        bandsContainer.innerHTML = labels.map((lbl, idx) => {
          const val = Number(bands[idx]) || 0;
          return `
            <div class="eq-band-col" style="display:flex; flex-direction:column; align-items:center; gap:6px;">
              <span class="eq-band-val" id="eq-val-${idx}" style="font-size:10px; font-weight:800; color:${val > 0 ? '#FF2A4D' : (val < 0 ? '#4da6ff' : 'var(--text-secondary)')};">${val > 0 ? '+' + val : val}dB</span>
              <input type="range" class="eq-band-slider" min="-12" max="12" step="1" value="${val}" oninput="App.updateEqBand(${idx}, this.value)" style="height:120px; -webkit-appearance:slider-vertical; writing-mode:bt-lr; width:24px;">
              <span class="eq-band-label" style="font-size:9.5px; text-align:center; color:var(--text-secondary); line-height:1.2;">${lbl.replace('\n', '<br>')}</span>
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
    },

    renderSleepTimerDialog(state) {
      const container = document.getElementById('dialog-sleep-timer-body');
      if (!container) return;

      const timerState = state || (typeof Player !== 'undefined' && Player.getSleepTimerState ? Player.getSleepTimerState() : { active: false });

      let activeBannerHtml = '';
      if (timerState.active) {
        activeBannerHtml = `
          <div class="sleep-active-banner">
            <div class="sleep-active-left">
              <span class="material-symbols-outlined sleep-pulse-icon">bedtime</span>
              <div class="sleep-active-info">
                <div class="sleep-time-left" id="sleep-timer-live-remaining">${timerState.formattedRemaining}</div>
                <div class="sleep-sub">${timerState.mode === 'end_of_track' ? 'Playback stops after current song finishes' : 'Remaining until music pauses'}</div>
              </div>
            </div>
            <div class="sleep-active-actions">
              ${timerState.mode === 'duration' ? `<button class="sleep-action-btn-pill" onclick="App.addSleepMinutes(15)">+15 min</button>` : ''}
              <button class="sleep-action-btn-pill cancel" onclick="App.cancelSleepTimer()">Turn Off</button>
            </div>
          </div>
        `;
      }

      const presets = [
        { label: '15 Minutes', value: 15 },
        { label: '30 Minutes', value: 30 },
        { label: '45 Minutes', value: 45 },
        { label: '60 Minutes', value: 60 },
        { label: '90 Minutes', value: 90 },
        { label: 'End of Song', value: 'end' }
      ];

      const chipsHtml = presets.map(p => {
        const isSelected = timerState.active && (
          (p.value === 'end' && timerState.mode === 'end_of_track') ||
          (typeof p.value === 'number' && timerState.mode === 'duration' && timerState.durationMinutes === p.value)
        );
        return `
          <button class="sleep-chip-btn ${isSelected ? 'active' : ''}" onclick="App.setSleepPreset(${typeof p.value === 'string' ? `'${p.value}'` : p.value})">
            ${isSelected ? '<span class="material-symbols-outlined" style="font-size:16px; margin-right:4px;">check</span>' : ''}
            <span>${p.label}</span>
          </button>
        `;
      }).join('');

      container.innerHTML = `
        ${activeBannerHtml}
        <div class="sleep-section-title">Presets</div>
        <div class="sleep-chips-grid">
          ${chipsHtml}
        </div>
        <div class="sleep-section-title" style="margin-top:12px;">Custom Duration</div>
        <div class="sleep-custom-wrap">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-size:12px; color:var(--text-secondary);">Set timer (5 – 180 min)</span>
            <span id="sleep-custom-val" style="font-size:13px; font-weight:800; color:#FF2A4D;">45 min</span>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <input type="range" class="player-seek-slider" id="sleep-custom-slider" min="5" max="180" step="5" value="45" oninput="App.onCustomSleepInput(this.value)" style="flex:1;">
            <button class="sleep-chip-btn primary" onclick="App.setCustomSleepTimer()" style="padding:6px 14px; font-size:12px; font-weight:700;">Set</button>
          </div>
        </div>
        ${timerState.active ? `
          <div style="margin-top:12px; text-align:center;">
            <button class="sleep-turn-off-btn" onclick="App.cancelSleepTimer()">
              <span class="material-symbols-outlined" style="font-size:18px;">timer_off</span>
              <span>Cancel Active Timer</span>
            </button>
          </div>
        ` : ''}
      `;
    },

    updateSleepTimerUI(state) {
      const timerState = state || (typeof Player !== 'undefined' && Player.getSleepTimerState ? Player.getSleepTimerState() : { active: false });

      // 1. Update Full Player Utility Button
      const btn = document.getElementById('btn-player-timer');
      const label = document.getElementById('player-timer-label');
      const icon = document.getElementById('player-timer-icon');

      if (btn && label) {
        if (timerState.active) {
          btn.classList.add('active');
          const displayText = timerState.mode === 'end_of_track' ? 'End Song' : (timerState.formattedRemaining || 'Active');
          label.textContent = displayText;
          btn.setAttribute('aria-label', `Sleep timer active, ${displayText} remaining`);
          if (icon) icon.style.color = '#FF2A4D';
        } else {
          btn.classList.remove('active');
          label.textContent = 'Timer';
          btn.setAttribute('aria-label', 'Sleep timer');
          if (icon) icon.style.color = '';
        }
      }

      // 2. Update Live Countdown in Open Dialog (if open)
      const liveEl = document.getElementById('sleep-timer-live-remaining');
      if (liveEl) {
        liveEl.textContent = timerState.formattedRemaining || '0:00';
      }
    }
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UI;
}
