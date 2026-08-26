// ==========================================================================
// MUSICFLOW — API CLIENT (JioSaavn & Saavn + LRCLib Lyrics API)
// ==========================================================================

const API = (() => {
  // Live Working Hosts (Android App host spoton-trpn)
  const PRIMARY_HOSTS = [
    'https://spoton-trpn.vercel.app/api'
  ];

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
    const path = `${endpoint}${query ? '?' + query : ''}`;

    for (let i = 0; i < PRIMARY_HOSTS.length; i++) {
      const idx = (currentHostIndex + i) % PRIMARY_HOSTS.length;
      const url = `${PRIMARY_HOSTS[idx]}${path}`;

      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        currentHostIndex = idx;
        return data;
      } catch (err) {
        console.warn(`[API] Host ${PRIMARY_HOSTS[idx]} failed for ${endpoint}:`, err.message);
      }
    }
    throw new Error(`[API] All hosts failed for ${endpoint}`);
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
  function normalizeSong(raw) {
    if (!raw) return null;

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

    return {
      id: String(raw.id || raw._id || Math.random()),
      name: cleanTitle,
      album: cleanAlbum,
      albumId: raw.album?.id || raw.albumId || '',
      artists: cleanArtists,
      primaryArtist: (cleanArtists || '').split(',')[0].split(';')[0].trim(),
      image: getImageUrl(raw),
      audioUrl: getDownloadUrl(raw),
      duration: Number(raw.duration || 0),
      rawDuration: raw.duration,
      year: raw.year || '',
      language: raw.language || 'hindi',
      downloadUrl: raw.downloadUrl || []
    };
  }

  return {
    decodeHtml,
    getImageUrl,
    getDownloadUrl,
    normalizeSong,

    // Home feed recommendations & charts (curated high quality queries)
    async getHomeFeed(languages = ['hindi', 'english', 'punjabi']) {
      try {
        const primaryLang = (languages && languages[0]) ? (languages[0].charAt(0).toUpperCase() + languages[0].slice(1)) : 'Hindi';

        const [songsRes, newRelRes, albumsRes, playlistsRes] = await Promise.allSettled([
          this.searchSongs(`Top 50 ${primaryLang} Hits 2024`, 1, 24),
          this.searchSongs(`Latest Bollywood Songs 2024`, 1, 24),
          fetchWithFallback('/search/albums', { query: `Top Albums ${primaryLang}`, limit: 12 }),
          fetchWithFallback('/search/playlists', { query: `Top 50 Hits ${primaryLang}`, limit: 12 })
        ]);

        const quickPicks = songsRes.status === 'fulfilled' ? songsRes.value : [];
        const freshReleases = newRelRes.status === 'fulfilled' ? newRelRes.value : [];
        const albums = albumsRes.status === 'fulfilled' ? (albumsRes.value?.data?.results || []) : [];
        const charts = playlistsRes.status === 'fulfilled' ? (playlistsRes.value?.data?.results || []) : [];

        const filteredFresh = (freshReleases.length > 0 ? freshReleases : quickPicks).filter(s => s.name.toLowerCase() !== 'trending');

        return {
          quickPicks: quickPicks.filter(s => s.name.toLowerCase() !== 'trending'),
          trending: { songs: filteredFresh.length > 0 ? filteredFresh : quickPicks },
          charts,
          albums
        };
      } catch (e) {
        console.warn('[API] Home feed fallback:', e);
        const fallback = await this.searchSongs('Top Bollywood Hits 2024', 1, 24);
        return { quickPicks: fallback, trending: { songs: fallback }, charts: [], albums: [] };
      }
    },

    // Search unified (with full 30-song deep fetch for rich results)
    async searchAll(query) {
      try {
        const [searchRes, songsRes, artistsRes, albumsRes, playlistsRes] = await Promise.allSettled([
          fetchWithFallback('/search', { query }),
          this.searchSongs(query, 1, 30),
          fetchWithFallback('/search/artists', { query, limit: 10 }),
          fetchWithFallback('/search/albums', { query, limit: 10 }),
          fetchWithFallback('/search/playlists', { query, limit: 10 })
        ]);

        const federated = searchRes.status === 'fulfilled' ? (searchRes.value?.data || searchRes.value) : {};
        const deepSongs = songsRes.status === 'fulfilled' ? songsRes.value : [];

        const federatedSongs = (federated?.songs?.results || []).map(normalizeSong);
        const finalSongs = deepSongs.length > 0 ? deepSongs : federatedSongs;

        const artists = artistsRes.status === 'fulfilled' ? (artistsRes.value?.data?.results || []) : (federated?.artists?.results || []);
        const albums = albumsRes.status === 'fulfilled' ? (albumsRes.value?.data?.results || []) : (federated?.albums?.results || []);
        const playlists = playlistsRes.status === 'fulfilled' ? (playlistsRes.value?.data?.results || []) : (federated?.playlists?.results || []);

        return {
          songs: { results: finalSongs },
          artists: { results: artists },
          albums: { results: albums },
          playlists: { results: playlists }
        };
      } catch (e) {
        const fallbackSongs = await this.searchSongs(query, 1, 30);
        return {
          songs: { results: fallbackSongs },
          artists: { results: [] },
          albums: { results: [] },
          playlists: { results: [] }
        };
      }
    },

    // Search songs specifically (limit up to 30)
    async searchSongs(query, page = 1, limit = 30) {
      try {
        const res = await fetchWithFallback('/search/songs', { query, page, limit });
        const items = res?.data?.results || res?.results || [];
        return items.map(normalizeSong);
      } catch (e) {
        console.error('[API] searchSongs error:', e);
        return [];
      }
    },

    // Search artists
    async searchArtists(query, page = 1, limit = 10) {
      try {
        const res = await fetchWithFallback('/search/artists', { query, page, limit });
        return res?.data?.results || res?.results || [];
      } catch (e) {
        return [];
      }
    },

    // Get Song Details (including audio download streams)
    async getSongDetails(id) {
      try {
        const res = await fetchWithFallback(`/songs/${id}`);
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
    }
  };
})();
