// ==========================================================================
// MUSICFLOW — LOCAL STORAGE & STATE REPOSITORY
// ==========================================================================

const Storage = (() => {
  const KEYS = {
    FAVORITES: 'mf_favorites',
    HISTORY: 'mf_history',
    PLAYLISTS: 'mf_playlists',
    SEARCH_HISTORY: 'mf_search_history',
    AUDIO_QUALITY: 'mf_audio_quality',
    USER_NAME: 'mf_user_name',
    USER_AVATAR: 'mf_user_avatar',
    LAST_SESSION: 'mf_last_session',
    EQUALIZER: 'mf_equalizer',
    PERFORMANCE_MODE: 'mf_perf_mode',
    AMBIENT_LIGHTING: 'mf_ambient_glow',
    LANGUAGES: 'mf_music_languages'
  };

  function getJSON(key, fallback = []) {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function setJSON(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.warn(`[Storage] Failed to save ${key}:`, e);
    }
  }

  return {
    // Favorites
    getFavorites() {
      return getJSON(KEYS.FAVORITES, []);
    },

    isFavorite(songId) {
      if (!songId) return false;
      const favs = this.getFavorites();
      const targetId = String(songId).trim();
      return favs.some(s => String(s.id || s.songId || '').trim() === targetId);
    },

    toggleFavorite(song) {
      if (!song) return false;
      const rawId = song.id || song.songId || song._id;
      if (!rawId) return false;
      const targetId = String(rawId).trim();
      const favs = this.getFavorites();
      const idx = favs.findIndex(s => String(s.id || s.songId || '').trim() === targetId);
      let isFav = false;

      if (idx >= 0) {
        favs.splice(idx, 1);
        isFav = false;
      } else {
        const fullSong = { ...song, id: targetId };
        favs.unshift(fullSong);
        isFav = true;
      }

      setJSON(KEYS.FAVORITES, favs);
      return isFav;
    },

    // Listening History
    getHistory() {
      return getJSON(KEYS.HISTORY, []);
    },

    addToHistory(song) {
      if (!song || !song.id) return;
      let history = this.getHistory();
      history = history.filter(s => String(s.id) !== String(song.id));
      history.unshift(song);
      if (history.length > 50) history = history.slice(0, 50);
      setJSON(KEYS.HISTORY, history);
    },

    clearHistory() {
      setJSON(KEYS.HISTORY, []);
    },

    // Search History
    getSearchHistory() {
      return getJSON(KEYS.SEARCH_HISTORY, []);
    },

    addSearchHistory(term) {
      if (!term || !term.trim()) return;
      const q = term.trim();
      let hist = this.getSearchHistory().filter(t => t.toLowerCase() !== q.toLowerCase());
      hist.unshift(q);
      if (hist.length > 15) hist = hist.slice(0, 15);
      setJSON(KEYS.SEARCH_HISTORY, hist);
    },

    clearSearchHistory() {
      setJSON(KEYS.SEARCH_HISTORY, []);
    },

    // User Playlists
    getPlaylists() {
      return getJSON(KEYS.PLAYLISTS, []);
    },

    createPlaylist(name) {
      const list = this.getPlaylists();
      const newPl = {
        id: 'pl_' + Date.now(),
        name: name || 'My Playlist',
        songs: [],
        createdAt: Date.now()
      };
      list.unshift(newPl);
      setJSON(KEYS.PLAYLISTS, list);
      return newPl;
    },

    addSongToPlaylist(playlistId, song) {
      const list = this.getPlaylists();
      const pl = list.find(p => p.id === playlistId);
      if (pl && song) {
        if (!pl.songs.some(s => String(s.id) === String(song.id))) {
          pl.songs.unshift(song);
          setJSON(KEYS.PLAYLISTS, list);
          return true;
        }
      }
      return false;
    },

    removePlaylist(playlistId) {
      let list = this.getPlaylists();
      list = list.filter(p => p.id !== playlistId);
      setJSON(KEYS.PLAYLISTS, list);
    },

    // Music Languages (Android UserPreferences.kt match)
    getLanguages() {
      return getJSON(KEYS.LANGUAGES, ['hindi', 'english', 'punjabi']);
    },

    setLanguages(langs) {
      setJSON(KEYS.LANGUAGES, langs);
    },

    // Audio Quality (320kbps, 256kbps, 160kbps, 128kbps, 96kbps, 48kbps)
    getAudioQuality() {
      return localStorage.getItem(KEYS.AUDIO_QUALITY) || '320kbps';
    },

    setAudioQuality(quality) {
      localStorage.setItem(KEYS.AUDIO_QUALITY, quality);
    },

    // User Profile
    getUserName() {
      return localStorage.getItem(KEYS.USER_NAME) || 'Adesh';
    },

    setUserName(name) {
      localStorage.setItem(KEYS.USER_NAME, name);
    },

    getUserAvatar() {
      return localStorage.getItem(KEYS.USER_AVATAR) || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
    },

    setUserAvatar(url) {
      localStorage.setItem(KEYS.USER_AVATAR, url);
    },

    // Equalizer Settings with 3D Spatial Virtualizer & Presets
    getEqualizer() {
      return getJSON(KEYS.EQUALIZER, {
        enabled: false,
        preset: 'Flat',
        bands: [0, 0, 0, 0, 0],
        bassBoost: 0,
        virtualizer: 0
      });
    },

    setEqualizer(eqData) {
      setJSON(KEYS.EQUALIZER, eqData);
    },

    // Performance Mode ('auto', 'high', 'lite')
    getPerformanceMode() {
      return localStorage.getItem(KEYS.PERFORMANCE_MODE) || 'auto';
    },

    setPerformanceMode(mode) {
      localStorage.setItem(KEYS.PERFORMANCE_MODE, mode);
    },

    // Ambient Glow ('on', 'off')
    getAmbientLighting() {
      return localStorage.getItem(KEYS.AMBIENT_LIGHTING) !== 'off';
    },

    setAmbientLighting(enabled) {
      localStorage.setItem(KEYS.AMBIENT_LIGHTING, enabled ? 'on' : 'off');
    },

    // Session State (Queue & Current Track for Instant Restore)
    saveSession(queue, currentIndex, currentTime) {
      try {
        const session = {
          queue: (queue || []).slice(0, 50),
          currentIndex: currentIndex || 0,
          currentTime: currentTime || 0
        };
        setJSON(KEYS.LAST_SESSION, session);
      } catch (_) {}
    },

    restoreSession() {
      return getJSON(KEYS.LAST_SESSION, null);
    }
  };
})();
