// ==========================================================================
// MUSICFLOW — API CLIENT (JioSaavn & Saavn + LRCLib Lyrics API)
// ==========================================================================

const API = (() => {
  // Live Working Hosts (Android App host spoton-trpn)
  const DEFAULT_PRIMARY_HOSTS = [
    'https://spoton-trpn.vercel.app/api'
  ];

  function getPrimaryHosts() {
    if (typeof ApiConfig !== 'undefined' && typeof ApiConfig.getJioSaavnApiBase === 'function') {
      return [ApiConfig.getJioSaavnApiBase()];
    }
    return DEFAULT_PRIMARY_HOSTS;
  }

  let currentHostIndex = 0;

  function decodeHtml(str) {
    if (!str || typeof str !== 'string') return str || '';
    return str
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&apos;/g, "'");
  }

  async function fetchWithFallback(endpoint, params = {}) {
    const query = new URLSearchParams(params).toString();
    const cleanEndpoint = endpoint.startsWith('/api/')
      ? endpoint.replace(/^\/api/, '')
      : (endpoint.startsWith('/') ? endpoint : `/${endpoint}`);
    const path = `${cleanEndpoint}${query ? '?' + query : ''}`;
    const hosts = getPrimaryHosts();

    for (let i = 0; i < hosts.length; i++) {
      const idx = (currentHostIndex + i) % hosts.length;
      const url = `${hosts[idx]}${path}`;

      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        currentHostIndex = idx;
        return data;
      } catch (err) {
        console.warn(`[API] Host ${hosts[idx]} failed for ${cleanEndpoint}:`, err.message);
      }
    }
    throw new Error(`[API] All hosts failed for ${cleanEndpoint}`);
  }

  // Helper to extract highest quality image (500x500 HD)
  function getImageUrl(item) {
    if (!item) return 'assets/logo.png';
    let url = '';

    if (typeof item === 'string') {
      url = item.startsWith('http') ? item : '';
    } else if (typeof item.image === 'string' && item.image.startsWith('http')) {
      url = item.image;
    } else if (Array.isArray(item.image) && item.image.length > 0) {
      const hi = item.image.find(i => i.quality === '500x500') || item.image[item.image.length - 1];
      url = hi?.url || hi?.link || item.image[0]?.url || item.image[0]?.link || '';
    } else if (Array.isArray(item.images) && item.images.length > 0) {
      const hi = item.images.find(i => i.quality === '500x500') || item.images[item.images.length - 1];
      url = hi?.url || hi?.link || item.images[0]?.url || '';
    } else if (item.image && typeof item.image === 'object') {
      url = item.image.url || item.image.link || '';
    } else if (item.album && typeof item.album === 'object' && item.album.image) {
      return getImageUrl(item.album);
    } else if (typeof item.cover === 'string' && item.cover.startsWith('http')) {
      url = item.cover;
    } else if (typeof item.thumbnail === 'string' && item.thumbnail.startsWith('http')) {
      url = item.thumbnail;
    }

    if (url && typeof url === 'string' && url.startsWith('http')) {
      return url.replace(/50x50|150x150/, '500x500');
    }
    return 'assets/logo.png';
  }

  // Helper to extract highest quality download audio URL
  function getDownloadUrl(item, preferredBitrate = '320kbps') {
    if (!item) return '';
    if (typeof item.streamUrl === 'string' && item.streamUrl) return item.streamUrl;
    if (typeof item.audioUrl === 'string' && item.audioUrl) return item.audioUrl;
    if (Array.isArray(item.downloadUrl) && item.downloadUrl.length > 0) {
      const matched = item.downloadUrl.find(u => (u.quality || '').toLowerCase() === preferredBitrate.toLowerCase());
      if (matched) return matched.url || matched.link;
      const last = item.downloadUrl[item.downloadUrl.length - 1];
      return last?.url || last?.link || '';
    }
    return item.url || '';
  }

  // Normalizes any song object into a standard schema matching Android Song.kt
  // Normalizes any song object into standard canonical schema
  function normalizeSong(raw) {
    if (!raw) return null;
    if (typeof DataNormalizer !== 'undefined' && DataNormalizer.normalizeTrack) {
      return DataNormalizer.normalizeTrack(raw, raw.provider || 'jiosaavn');
    }

    let artistsStr = '';
    if (typeof raw.artists === 'string' && raw.artists.trim()) {
      artistsStr = raw.artists.trim();
    } else if (typeof raw.primaryArtists === 'string' && raw.primaryArtists.trim()) {
      artistsStr = raw.primaryArtists.trim();
    } else if (typeof raw.singers === 'string' && raw.singers.trim()) {
      artistsStr = raw.singers.trim();
    } else if (Array.isArray(raw.artists?.primary) && raw.artists.primary.length > 0) {
      artistsStr = raw.artists.primary.map(a => a.name || a).join(', ');
    } else if (Array.isArray(raw.artists) && raw.artists.length > 0) {
      artistsStr = raw.artists.map(a => a.name || a).join(', ');
    } else if (typeof raw.artist === 'string' && raw.artist.trim()) {
      artistsStr = raw.artist.trim();
    } else if (typeof raw.subtitle === 'string' && raw.subtitle.trim()) {
      artistsStr = raw.subtitle.trim();
    } else if (typeof raw.description === 'string' && raw.description.includes('·')) {
      artistsStr = raw.description.split('·')[0].trim();
    } else {
      artistsStr = 'MusicFlow';
    }

    if (artistsStr.toLowerCase() === 'unknown artist' || !artistsStr) {
      artistsStr = raw.name ? `${raw.name} Artist` : 'MusicFlow';
    }

    let titleStr = raw.name || raw.title || raw.song || 'Unknown Track';
    if (titleStr.toLowerCase() === 'trending' && raw.album && typeof raw.album === 'string') {
      titleStr = raw.album;
    }

    const cleanTitle = decodeHtml(titleStr);
    const cleanAlbum = decodeHtml(typeof raw.album === 'object' ? (raw.album.name || '') : (raw.album || ''));
    const cleanArtists = decodeHtml(artistsStr);

    const audioUrl = getDownloadUrl(raw);
    const provider = raw.provider || 'jiosaavn';
    const providerId = String(raw.providerId || raw.id || raw.videoId || raw._id || Math.random());
    const isPlayable = Boolean(audioUrl || raw.streamUrl || raw.playbackAvailable || provider === 'jiosaavn' || provider === 'local');

    return {
      id: String(raw.id || raw._id || (provider === 'youtube_music' ? `yt_${providerId}` : providerId)),
      name: cleanTitle,
      title: cleanTitle,
      album: cleanAlbum,
      albumId: raw.album?.id || raw.albumId || '',
      artists: cleanArtists,
      artistNames: [cleanArtists],
      primaryArtist: (cleanArtists || '').split(',')[0].split(';')[0].trim(),
      image: getImageUrl(raw),
      audioUrl: audioUrl,
      streamUrl: raw.streamUrl || audioUrl,
      duration: Number(raw.duration || 0),
      rawDuration: raw.duration,
      year: raw.year || '',
      language: raw.language || 'hindi',
      downloadUrl: raw.downloadUrl || [],
      provider: provider,
      providerId: providerId,
      metadataAvailable: true,
      playbackAvailable: isPlayable
    };
  }

  return {
    decodeHtml,
    getImageUrl,
    getDownloadUrl,
    normalizeSong,

    // Home feed recommendations & charts (curated high quality queries + personalization)
    async getHomeFeed(languages = ['hindi', 'english', 'punjabi']) {
      try {
        const langList = Array.isArray(languages) && languages.length > 0 ? languages : ['hindi', 'english'];
        const searchPromises = [];

        langList.slice(0, 3).forEach(lang => {
          const capLang = String(lang).charAt(0).toUpperCase() + String(lang).slice(1);
          searchPromises.push(this.searchSongs(`Top ${capLang} Hits 2024`, 1, 16));
        });

        const primaryLang = String(langList[0]).charAt(0).toUpperCase() + String(langList[0]).slice(1);
        const [albumRes, playlistRes] = await Promise.allSettled([
          fetchWithFallback('/search/albums', { query: `Top Albums ${primaryLang}`, limit: 12 }),
          fetchWithFallback('/search/playlists', { query: `Top 50 Hits ${primaryLang}`, limit: 12 })
        ]);

        const songSettled = await Promise.allSettled(searchPromises);
        let candidatePool = [];
        songSettled.forEach(res => {
          if (res.status === 'fulfilled' && Array.isArray(res.value)) {
            candidatePool.push(...res.value);
          }
        });

        if (candidatePool.length === 0) {
          candidatePool = await this.searchSongs('Top Songs 2024', 1, 24);
        }

        const albums = albumRes.status === 'fulfilled' ? (albumRes.value?.data?.results || []) : [];
        const charts = playlistRes.status === 'fulfilled' ? (playlistRes.value?.data?.results || []) : [];

        let personalizedPicks = candidatePool;
        let diverseTrending = candidatePool;
        if (typeof RecommendationEngine !== 'undefined') {
          const userHistory = (typeof Storage !== 'undefined') ? Storage.getHistory() : [];
          const userFavs = (typeof Storage !== 'undefined') ? Storage.getFavorites() : [];
          const rawPicks = RecommendationEngine.getPersonalizedRecommendations(userHistory, userFavs, candidatePool, { limit: 16, selectedLanguages: langList });
          personalizedPicks = rawPicks.map(r => r.song || r);
          const rawTrending = RecommendationEngine.getPersonalizedRecommendations([], [], candidatePool, { limit: 20, selectedLanguages: langList });
          diverseTrending = rawTrending.map(r => r.song || r);
        }

        return {
          quickPicks: personalizedPicks.length > 0 ? personalizedPicks : candidatePool.slice(0, 16),
          trending: { songs: diverseTrending.length > 0 ? diverseTrending : candidatePool.slice(0, 20) },
          charts,
          albums
        };
      } catch (e) {
        console.warn('[API] Home feed fallback:', e);
        const fallback = await this.searchSongs('Top Bollywood Hits 2024', 1, 24);
        return { quickPicks: fallback, trending: { songs: fallback }, charts: [], albums: [] };
      }
    },

    // Search unified (with Typesense Search Layer as primary + resilient fallback)
    async searchAll(query) {
      try {
        const QN = (typeof QueryNormalizer !== 'undefined') ? QueryNormalizer : (typeof require !== 'undefined' ? require('./queryNormalizer.js') : null);
        const SE = (typeof SearchEngine !== 'undefined') ? SearchEngine : (typeof require !== 'undefined' ? require('./searchEngine.js') : null);
        const TD = (typeof TrackDeduplicator !== 'undefined') ? TrackDeduplicator : (typeof require !== 'undefined' ? require('./trackDeduplicator.js') : null);

        const parsed = QN
          ? QN.parseCompoundQuery(query)
          : { normalizedQuery: query.trim(), isCompoundQuery: false, rawQuery: query };

        // 1. Primary Indexed Search via Typesense
        if (typeof TypesenseClient !== 'undefined') {
          const tsResult = await TypesenseClient.searchAll(query);
          if (tsResult && tsResult.candidateSongs && tsResult.candidateSongs.length > 0) {
            let rankedSongs = tsResult.candidateSongs;
            let rankedArtists = tsResult.candidateArtists || [];
            let rankedAlbums = tsResult.candidateAlbums || [];

            if (SE) {
              rankedSongs = SE.rankSongs(tsResult.candidateSongs, parsed);
              rankedArtists = SE.rankArtists(rankedArtists, parsed);
              rankedAlbums = SE.rankAlbums(rankedAlbums, parsed);
            }
            if (TD) {
              rankedSongs = TD.deduplicate(rankedSongs, query);
            }

            const didYouMean = SE ? SE.detectDidYouMean(query) : null;

            return {
              query,
              normalizedQuery: parsed.normalizedQuery,
              songs: { results: rankedSongs },
              artists: { results: rankedArtists },
              albums: { results: rankedAlbums },
              playlists: { results: [] },
              didYouMean,
              suggestions: [],
              provider: 'typesense'
            };
          }
        }

        // 2. Resilient Multi-Cluster Fallback: Query decomposition + Smart Ranking
        const targetArtist = parsed.candidateArtist || (QN && QN.isLikelyArtist(parsed.normalizedQuery) ? parsed.normalizedQuery : null);

        const promises = [
          fetchWithFallback('/search', { query: parsed.normalizedQuery }),
          this.searchSongs(parsed.normalizedQuery, 1, 30),
          fetchWithFallback('/search/artists', { query: targetArtist || parsed.normalizedQuery, limit: 10 }),
          fetchWithFallback('/search/albums', { query: parsed.candidateSongTitle || parsed.normalizedQuery, limit: 10 }),
          fetchWithFallback('/search/playlists', { query: parsed.candidateSongTitle || parsed.normalizedQuery, limit: 10 }),
          // Parallel secondary query to YouTube Music provider
          fetch((typeof ApiConfig !== 'undefined' && typeof ApiConfig.buildUrl === 'function') ? ApiConfig.buildUrl('/api/providers/ytmusic/search') : '/api/providers/ytmusic/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: parsed.normalizedQuery, limit: 20 }),
            signal: AbortSignal.timeout(3500)
          }).then(r => r.ok ? r.json() : { songs: [] }).catch(() => ({ songs: [] }))
        ];

        if (parsed.isCompoundQuery && parsed.candidateSongTitle) {
          promises.push(this.searchSongs(parsed.candidateSongTitle, 1, 30));
        }

        if (targetArtist && targetArtist !== parsed.normalizedQuery) {
          promises.push(this.searchSongs(targetArtist, 1, 30));
        }

        const results = await Promise.allSettled(promises);

        const searchRes = results[0];
        const songsRes = results[1];
        const artistsRes = results[2];
        const albumsRes = results[3];
        const playlistsRes = results[4];
        const ytRes = results[5];
        const subSongRes = results[6];
        const artistSongsRes = results[7];

        const federated = searchRes.status === 'fulfilled' ? (searchRes.value?.data || searchRes.value) : {};
        const deepSongs = songsRes.status === 'fulfilled' ? songsRes.value : [];
        const ytData = ytRes && ytRes.status === 'fulfilled' ? ytRes.value : { songs: [], artists: [], albums: [], playlists: [] };
        const ytSongs = (ytData?.songs || []).map(normalizeSong);
        const subSongs = (subSongRes && subSongRes.status === 'fulfilled') ? subSongRes.value : [];
        const artistSongs = (artistSongsRes && artistSongsRes.status === 'fulfilled') ? artistSongsRes.value : [];

        const federatedSongs = (federated?.songs?.results || []).map(normalizeSong);
        const allCandidateSongs = [...deepSongs, ...ytSongs, ...subSongs, ...artistSongs, ...federatedSongs];

        const rawArtists = artistsRes.status === 'fulfilled' ? (artistsRes.value?.data?.results || []) : (federated?.artists?.results || []);
        const rawAlbums = albumsRes.status === 'fulfilled' ? (albumsRes.value?.data?.results || []) : (federated?.albums?.results || []);
        const rawPlaylists = playlistsRes.status === 'fulfilled' ? (playlistsRes.value?.data?.results || []) : (federated?.playlists?.results || []);

        // Apply Multi-Signal Ranking
        let rankedSongs = allCandidateSongs;
        let rankedArtists = rawArtists;
        let rankedAlbums = rawAlbums;
        let didYouMean = null;
        let suggestions = [];

        if (SE) {
          rankedSongs = SE.rankSongs(allCandidateSongs, parsed);
          rankedArtists = SE.rankArtists(rawArtists, parsed);
          rankedAlbums = SE.rankAlbums(rawAlbums, parsed);
          didYouMean = SE.detectDidYouMean(query);
          const recents = (typeof Storage !== 'undefined') ? Storage.getSearchHistory() : [];
          suggestions = SE.getAutocompleteSuggestions(query, recents);
        } else if (TD) {
          rankedSongs = TD.deduplicate(allCandidateSongs, query);
        }

        // Asynchronously sync discovered tracks into Typesense in background
        if (typeof TypesenseClient !== 'undefined' && rankedSongs.length > 0) {
          rankedSongs.slice(0, 8).forEach(s => TypesenseClient.syncTrack(s));
        }

        return {
          query,
          normalizedQuery: parsed.normalizedQuery,
          songs: { results: rankedSongs },
          artists: { results: rankedArtists },
          albums: { results: rankedAlbums },
          playlists: { results: rawPlaylists },
          didYouMean,
          suggestions,
          provider: 'live_fallback'
        };
      } catch (e) {
        console.error('[API] searchAll error:', e);
        const fallbackSongs = await this.searchSongs(query, 1, 30);
        return {
          query,
          songs: { results: fallbackSongs },
          artists: { results: [] },
          albums: { results: [] },
          playlists: { results: [] },
          didYouMean: null,
          suggestions: []
        };
      }
    },

    // Search songs specifically (with multi-page deep aggregation & smart ranking)
    async searchSongs(query, page = 1, limit = 30) {
      try {
        const QN = (typeof QueryNormalizer !== 'undefined') ? QueryNormalizer : (typeof require !== 'undefined' ? require('./queryNormalizer.js') : null);
        const SE = (typeof SearchEngine !== 'undefined') ? SearchEngine : (typeof require !== 'undefined' ? require('./searchEngine.js') : null);
        const TD = (typeof TrackDeduplicator !== 'undefined') ? TrackDeduplicator : (typeof require !== 'undefined' ? require('./trackDeduplicator.js') : null);

        const parsed = QN
          ? QN.parseCompoundQuery(query)
          : { normalizedQuery: query.trim(), isCompoundQuery: false, rawQuery: query };

        const targetArtist = parsed.candidateArtist || (QN && QN.isLikelyArtist(parsed.normalizedQuery) ? parsed.normalizedQuery : null);

        // Fetch multiple pages in parallel to gather 30+ distinct, unique tracks after deduplication
        const pagesToFetch = page === 1 ? [1, 2, 3, 4, 5, 6, 7] : [page, page + 1, page + 2];
        const promises = [];

        for (const p of pagesToFetch) {
          promises.push(fetchWithFallback('/search/songs', { query: parsed.normalizedQuery, page: p, limit: 30 }));
          if (targetArtist && targetArtist !== parsed.normalizedQuery) {
            promises.push(fetchWithFallback('/search/songs', { query: targetArtist, page: p, limit: 30 }));
          }
          if (parsed.isCompoundQuery && parsed.candidateSongTitle) {
            promises.push(fetchWithFallback('/search/songs', { query: parsed.candidateSongTitle, page: p, limit: 30 }));
          }
        }

        // Also query YouTube Music provider in parallel for rich catalog coverage
        promises.push(
          fetch((typeof ApiConfig !== 'undefined' && typeof ApiConfig.buildUrl === 'function') ? ApiConfig.buildUrl('/api/providers/ytmusic/search') : '/api/providers/ytmusic/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: parsed.normalizedQuery, limit: 30 }),
            signal: AbortSignal.timeout(3500)
          }).then(r => r.ok ? r.json() : { songs: [] }).then(d => d?.songs || []).catch(() => [])
        );

        // For page 1, also fetch top albums and their songs to enrich discography with iconic hits
        if (page === 1) {
          promises.push(
            fetchWithFallback('/search/albums', { query: targetArtist || parsed.normalizedQuery, limit: 8 })
              .then(async albRes => {
                const albList = albRes?.data?.results || albRes?.results || [];
                const topAlbs = albList.slice(0, 5);
                const albSongPromises = topAlbs.map(a =>
                  fetchWithFallback('/albums', { id: a.id })
                    .then(det => det?.data?.songs || det?.songs || [])
                    .catch(() => [])
                );
                const allAlbSongs = await Promise.all(albSongPromises);
                return allAlbSongs.flat();
              })
              .catch(() => [])
          );
        }

        const responses = await Promise.allSettled(promises);
        let items = [];
        for (const r of responses) {
          if (r.status === 'fulfilled' && r.value) {
            if (Array.isArray(r.value)) {
              items.push(...r.value);
            } else {
              const list = r.value?.data?.results || r.value?.results || [];
              items.push(...list);
            }
          }
        }

        const normalized = items.map(normalizeSong);

        let ranked = normalized;
        if (SE) {
          ranked = SE.rankSongs(normalized, parsed);
        } else if (TD) {
          ranked = TD.deduplicate(normalized, query);
        }

        return ranked;
      } catch (e) {
        console.error('[API] searchSongs error:', e);
        return [];
      }
    },

    // Search artists
    async searchArtists(query, page = 1, limit = 10) {
      try {
        const parsed = (typeof QueryNormalizer !== 'undefined')
          ? QueryNormalizer.parseCompoundQuery(query)
          : { normalizedQuery: query.trim(), rawQuery: query };

        const target = parsed.candidateArtist || parsed.normalizedQuery;
        const res = await fetchWithFallback('/search/artists', { query: target, page, limit });
        const items = res?.data?.results || res?.results || [];

        if (typeof SearchEngine !== 'undefined') {
          return SearchEngine.rankArtists(items, parsed);
        }
        return items;
      } catch (e) {
        console.error('[API] searchArtists error:', e);
        return [];
      }
    },

    // Search albums
    async searchAlbums(query, page = 1, limit = 10) {
      try {
        const parsed = (typeof QueryNormalizer !== 'undefined')
          ? QueryNormalizer.parseCompoundQuery(query)
          : { normalizedQuery: query.trim(), rawQuery: query };

        const target = (parsed.isCompoundQuery && parsed.candidateSongTitle) ? parsed.candidateSongTitle : parsed.normalizedQuery;
        const res = await fetchWithFallback('/search/albums', { query: target, page, limit });
        const items = res?.data?.results || res?.results || [];
        return items;
      } catch (e) {
        console.error('[API] searchAlbums error:', e);
        return [];
      }
    },

    // Get Song Details (including audio download streams)
    async getSongDetails(id) {
      if (!id) return [];
      const idStr = String(id).trim();

      // Handle YouTube Music track IDs without querying JioSaavn
      if (idStr.startsWith('yt_')) {
        const videoId = idStr.replace(/^yt_/, '');
        try {
          if (typeof youtubeMusicProvider !== 'undefined' && typeof youtubeMusicProvider.getSong === 'function') {
            const ytTrack = await youtubeMusicProvider.getSong(videoId);
            if (ytTrack) return [ytTrack];
          }
          const songUrl = (typeof ApiConfig !== 'undefined' && typeof ApiConfig.buildUrl === 'function')
            ? ApiConfig.buildUrl('/api/providers/ytmusic/song')
            : '/api/providers/ytmusic/song';
          const res = await fetch(songUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoId }),
            signal: AbortSignal.timeout(4000)
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.track) return [normalizeSong(data.track)];
          }
        } catch (_) {}
        return [];
      }

      try {
        const res = await fetchWithFallback(`/songs/${idStr}`);
        const list = Array.isArray(res?.data) ? res.data : (res?.data ? [res.data] : (Array.isArray(res) ? res : []));
        return list.map(normalizeSong);
      } catch (e) {
        return [];
      }
    },

    // Get Artist Details (with numeric ID handler)
    async getArtistDetails(idOrName) {
      try {
        // If numeric ID (e.g. '3791131', '22604928')
        if (/^[0-9]+$/.test(String(idOrName).trim())) {
          try {
            const res = await fetchWithFallback('/artists', { id: idOrName });
            const data = res?.data || res;
            if (data && data.name) {
              const cleanName = data.name.split(';')[0].split(',')[0].trim();
              return {
                id: data.id,
                name: cleanName,
                image: getImageUrl(data),
                fanCount: data.fanCount || data.followerCount || '3 234 900'
              };
            }
          } catch (_) {}
        }

        // Search by artist name
        const cleanQuery = decodeHtml(String(idOrName)).split(';')[0].split(',')[0].trim();
        const searchRes = await this.searchArtists(cleanQuery, 1, 3);
        if (searchRes && searchRes.length > 0) {
          const art = searchRes[0];
          return {
            id: art.id,
            name: art.name || art.title || cleanQuery,
            image: getImageUrl(art),
            fanCount: art.fanCount || '3 234 900'
          };
        }
        return { name: cleanQuery, image: 'assets/logo.png', fanCount: '3 234 900' };
      } catch (e) {
        console.warn('[API] getArtistDetails fallback:', e);
        return { name: idOrName, image: 'assets/logo.png', fanCount: '3 234 900' };
      }
    },

    // Get Artist Songs by query
    async getArtistSongs(artistName, limit = 30) {
      const clean = decodeHtml(artistName).split(';')[0].split(',')[0].trim();
      let songs = await this.searchSongs(clean, 1, limit);
      if (songs.length === 0) {
        songs = await this.searchSongs(`${clean} Hits`, 1, limit);
      }
      return songs;
    },

    // Get Album Details
    async getAlbumDetails(id) {
      try {
        const res = await fetchWithFallback('/albums', { id });
        const data = res?.data || res;
        if (data && Array.isArray(data.songs)) {
          data.songs = data.songs.map(normalizeSong);
        }
        return data;
      } catch (e) {
        return null;
      }
    },

    // Get Playlist Details
    async getPlaylistDetails(id) {
      try {
        const res = await fetchWithFallback('/playlists', { id });
        const data = res?.data || res;
        if (data && Array.isArray(data.songs)) {
          data.songs = data.songs.map(normalizeSong);
        }
        return data;
      } catch (e) {
        return null;
      }
    },

    // Fetch Synchronized Karaoke Lyrics via LRCLib
    async getLyrics(songTitle, artistName, durationSec = 0) {
      try {
        const cleanTitle = songTitle.replace(/\([^)]*\)|\[[^\]]*\]|- .*/g, '').trim();
        const cleanArtist = (artistName || '').split(',')[0].split(';')[0].trim();

        const params = new URLSearchParams({
          track_name: cleanTitle,
          artist_name: cleanArtist
        });
        if (durationSec > 0) params.append('duration', Math.round(durationSec));

        const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
          signal: AbortSignal.timeout(6000)
        });

        if (res.ok) {
          const data = await res.json();
          if (data && (data.syncedLyrics || data.plainLyrics)) {
            return {
              synced: data.syncedLyrics || null,
              plain: data.plainLyrics || null
            };
          }
        }
      } catch (_) {}

      // Fallback search endpoint on LRCLib
      try {
        const cleanTitle = songTitle.replace(/\([^)]*\)|\[[^\]]*\]/g, '').trim();
        const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(cleanTitle + ' ' + (artistName || ''))}`, {
          signal: AbortSignal.timeout(6000)
        });
        if (res.ok) {
          const results = await res.json();
          if (Array.isArray(results) && results.length > 0) {
            const best = results.find(r => r.syncedLyrics) || results[0];
            return {
              synced: best.syncedLyrics || null,
              plain: best.plainLyrics || null
            };
          }
        }
      } catch (_) {}

      return null;
    },

    // --- Embeat Recommendation Engine APIs ---
    async getSimilarSongs(trackId, limit = 20) {
      if (!trackId) return [];
      try {
        const trackUrl = (typeof ApiConfig !== 'undefined' && typeof ApiConfig.buildUrl === 'function')
          ? ApiConfig.buildUrl(`/api/recommendations/track/${trackId}`)
          : `/api/recommendations/track/${trackId}`;
        const res = await fetch(trackUrl);
        if (res.ok) {
          const data = await res.json();
          const recs = data?.recommendations?.map(r => r.song) || [];
          if (recs.length >= 5) return recs;
        }
      } catch (_) {}

      // Fallback: multi-channel client-side recommendation engine
      try {
        const current = (typeof Player !== 'undefined') ? Player.getCurrentTrack() : null;
        if (current) {
          const primaryArtist = API.decodeHtml(current.primaryArtist || current.artists || '').split(/[,;&/]/)[0].trim();
          let candidatePool = [];
          
          if (primaryArtist && primaryArtist !== 'undefined') {
            const radioUrl = (typeof ApiConfig !== 'undefined' && typeof ApiConfig.buildUrl === 'function')
              ? ApiConfig.buildUrl('/api/providers/ytmusic/radio')
              : '/api/providers/ytmusic/radio';
            const [artistSongs, searchSongs, ytRadio] = await Promise.allSettled([
              API.getArtistSongs(primaryArtist, 1, limit),
              API.searchSongs(`${primaryArtist} Hits`, 1, limit),
              fetch(radioUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  videoId: current.providerId || (String(current.id).startsWith('yt_') ? current.id.replace('yt_', '') : undefined),
                  title: current.name || current.title,
                  artist: primaryArtist,
                  limit: 25
                }),
                signal: AbortSignal.timeout(3500)
              }).then(r => r.ok ? r.json() : { candidates: [] }).then(d => (d?.candidates || []).map(normalizeSong)).catch(() => [])
            ]);
            if (artistSongs.status === 'fulfilled' && Array.isArray(artistSongs.value)) {
              candidatePool.push(...artistSongs.value);
            }
            if (searchSongs.status === 'fulfilled' && Array.isArray(searchSongs.value)) {
              candidatePool.push(...searchSongs.value);
            }
            if (ytRadio.status === 'fulfilled' && Array.isArray(ytRadio.value)) {
              candidatePool.push(...ytRadio.value);
            }
          }

          if (typeof Storage !== 'undefined') {
            const favs = Storage.getFavorites() || [];
            const history = Storage.getHistory() || [];
            candidatePool.push(...favs, ...history);
          }

          if (typeof RecommendationEngine !== 'undefined' && candidatePool.length > 0) {
            const similar = RecommendationEngine.getSimilarTracks(current, candidatePool, limit);
            if (similar.length > 0) return similar.map(r => r.song);
          }
          if (candidatePool.length > 0) {
            const dedup = candidatePool.filter((s, idx, arr) => s && s.id && String(s.id) !== String(current.id) && arr.findIndex(x => String(x.id) === String(s.id)) === idx);
            return dedup.slice(0, limit);
          }
        }
      } catch (_) {}
      return [];
    },

    async getPersonalizedRecommendations(candidatePool = [], limit = 20) {
      try {
        const history = (typeof Storage !== 'undefined') ? Storage.getHistory() : [];
        const favorites = (typeof Storage !== 'undefined') ? Storage.getFavorites() : [];
        const recUrl = (typeof ApiConfig !== 'undefined' && typeof ApiConfig.buildUrl === 'function')
          ? ApiConfig.buildUrl('/api/recommendations/personalized')
          : '/api/recommendations/personalized';
        
        const res = await fetch(recUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ history, favorites, candidatePool, limit })
        });
        if (res.ok) {
          const data = await res.json();
          return data?.recommendations || [];
        }
      } catch (_) {}

      // Fallback: client-side recommendation engine
      if (typeof RecommendationEngine !== 'undefined') {
        const history = (typeof Storage !== 'undefined') ? Storage.getHistory() : [];
        const favorites = (typeof Storage !== 'undefined') ? Storage.getFavorites() : [];
        return RecommendationEngine.getPersonalizedRecommendations(history, favorites, candidatePool, { limit });
      }
      return [];
    }
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = API;
}
