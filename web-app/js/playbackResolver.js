// ============================================================================
// MUSICFLOW — CENTRALIZED MULTI-PROVIDER PLAYBACK RESOLVER
// Single Source of Truth for Cross-Provider Playback Resolution & Stream Validation
// Priority: Downloaded > Local > Cached > Origin Provider > Fallback Provider
// ============================================================================

const PlaybackResolver = (() => {
  const SourceType = {
    DOWNLOADED: 'DOWNLOADED',
    LOCAL: 'LOCAL',
    CACHED: 'CACHED',
    STREAMING: 'STREAMING',
    UNKNOWN: 'UNKNOWN'
  };

  const ErrorCode = {
    SOURCE_UNAVAILABLE: 'SOURCE_UNAVAILABLE',
    OFFLINE_UNAVAILABLE: 'OFFLINE_UNAVAILABLE',
    ABORTED: 'ABORTED',
    NETWORK_ERROR: 'NETWORK_ERROR'
  };

  // In-Memory Stream Cache with TTL (1 hour)
  const streamCache = new Map();
  const CACHE_TTL_MS = 60 * 60 * 1000;

  function getCachedStream(songId) {
    if (!songId) return null;
    const entry = streamCache.get(String(songId));
    if (entry && (Date.now() - entry.timestamp < CACHE_TTL_MS)) {
      return entry.streamUrl;
    }
    return null;
  }

  function setCachedStream(songId, streamUrl) {
    if (!songId || !streamUrl) return;
    streamCache.set(String(songId), { streamUrl, timestamp: Date.now() });
    if (streamCache.size > 200) {
      const oldest = streamCache.keys().next().value;
      streamCache.delete(oldest);
    }
  }

  /**
   * Safe helper to normalize artist strings without throwing TypeError
   */
  function safeArtistString(song) {
    if (typeof DataNormalizer !== 'undefined' && DataNormalizer.getArtistString) {
      return DataNormalizer.getArtistString(song);
    }
    if (!song) return '';
    if (typeof song.artists === 'string') return song.artists;
    if (Array.isArray(song.artists)) {
      return song.artists.map(a => (typeof a === 'object' ? a.name : a)).filter(Boolean).join(', ');
    }
    if (typeof song.artists === 'object' && song.artists !== null) {
      return song.artists.name || '';
    }
    return String(song.primaryArtist || song.artist || '');
  }

  /**
   * Safe helper to normalize track title
   */
  function safeTrackTitle(song) {
    if (typeof DataNormalizer !== 'undefined' && DataNormalizer.getTrackTitle) {
      return DataNormalizer.getTrackTitle(song);
    }
    return String(song?.name || song?.title || '').trim();
  }

  /**
   * Centralized resolvePlayableSource
   * Implements strict origin-aware provider hierarchy with automatic cross-provider fallback
   */
  async function resolvePlayableSource(song, options = {}) {
    if (!song) {
      return { type: SourceType.UNKNOWN, uri: '', error: ErrorCode.SOURCE_UNAVAILABLE, message: "Couldn't play this song" };
    }

    const signal = options.signal;
    if (signal?.aborted) {
      const abortErr = new Error('Playback request aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    const songId = String(song.id || '');
    const title = safeTrackTitle(song);
    const artists = safeArtistString(song);
    const primaryArtist = artists.split(/[,;&/]|feat\.|ft\./i)[0].trim();

    // 1. Downloaded Offline Audio Check
    if (song.source === 'DOWNLOADED' || (typeof Storage !== 'undefined' && Storage.isDownloaded && Storage.isDownloaded(song.id))) {
      try {
        const offlineUrl = await Storage.getDownloadedAudioUrl(song.id);
        if (offlineUrl) {
          console.log(`[PlaybackResolver] Selected: DOWNLOADED (${song.name || song.title})`);
          return { type: SourceType.DOWNLOADED, uri: offlineUrl, provider: 'local_offline', song };
        }
      } catch (e) {
        console.warn('[PlaybackResolver] Downloaded audio check warning:', e);
      }
    }

    // 2. Local User Audio Check (Blob URL / File / ID3)
    if (song.source === 'LOCAL' || song.localBlobUrl || (song.streamUrl && song.streamUrl.startsWith('blob:'))) {
      if (song.localBlobUrl) {
        return { type: SourceType.LOCAL, uri: song.localBlobUrl, provider: 'local_file', song };
      }
      if (song.fileBlob && typeof URL !== 'undefined') {
        song.localBlobUrl = URL.createObjectURL(song.fileBlob);
        return { type: SourceType.LOCAL, uri: song.localBlobUrl, provider: 'local_file', song };
      }
      if (song.streamUrl && song.streamUrl.startsWith('blob:')) {
        return { type: SourceType.LOCAL, uri: song.streamUrl, provider: 'local_file', song };
      }
    }

    // Check Online Connectivity for remote streams
    const isOnline = (typeof OfflineManager !== 'undefined')
      ? OfflineManager.isOnline()
      : (typeof navigator === 'undefined' || navigator.onLine !== false);

    if (!isOnline) {
      return {
        type: SourceType.STREAMING,
        uri: '',
        error: ErrorCode.OFFLINE_UNAVAILABLE,
        message: 'This track is available offline only if downloaded.'
      };
    }

    // 3. In-Memory Stream Cache Check
    const cachedUrl = getCachedStream(song.id);
    if (cachedUrl && cachedUrl.startsWith('http')) {
      console.log(`[PlaybackResolver] Selected: CACHED (${title})`);
      return { type: SourceType.CACHED, uri: cachedUrl, provider: song.provider || 'cached', song };
    }

    // 4. Already Available Direct Audio URL Check
    const preferredQuality = (typeof Storage !== 'undefined' && Storage.getAudioQuality) ? Storage.getAudioQuality() : '320kbps';
    let directUrl = (typeof API !== 'undefined' && API.getDownloadUrl) ? API.getDownloadUrl(song, preferredQuality) : (song.audioUrl || song.streamUrl || '');

    if (directUrl && typeof directUrl === 'string' && directUrl.trim().startsWith('http')) {
      const u = directUrl.trim();
      setCachedStream(song.id, u);
      return { type: SourceType.STREAMING, uri: u, provider: song.provider || 'direct', song };
    }

    const isYtOrigin = songId.startsWith('yt_') || song.provider === 'youtube_music' || Boolean(song.videoId || song.sourceYtVideoId);
    const ytVideoId = song.videoId || song.sourceYtVideoId || (songId.startsWith('yt_') ? songId.replace(/^yt_/, '') : null);

    console.log(`[PlaybackResolver] Resolving stream for "${title}" by "${artists}" (Origin: ${isYtOrigin ? 'YouTube Music' : 'JioSaavn'})`);

    // ========================================================================
    // PIPELINE A: YOUTUBE MUSIC ORIGIN TRACKS
    // 1. YouTube Music / YouTube Playback Source -> 2. JioSaavn Fallback -> 3. Offline/Local
    // ========================================================================
    if (isYtOrigin) {
      // Attempt 1: YouTube Music Direct Stream Resolution
      if (ytVideoId) {
        console.log(`[PlaybackResolver] Attempt 1 (YouTube Music): Resolving videoId ${ytVideoId}`);
        try {
          let ytStream = null;
          if (typeof youtubeMusicProvider !== 'undefined' && youtubeMusicProvider.resolveStream) {
            ytStream = await youtubeMusicProvider.resolveStream(ytVideoId, { signal });
          } else if (typeof YouTubeMusicService !== 'undefined' && typeof YouTubeMusicService.getStreamUrl === 'function') {
            ytStream = await YouTubeMusicService.getStreamUrl(ytVideoId);
          } else if (typeof fetch !== 'undefined' && (typeof ApiConfig === 'undefined' || !ApiConfig.isRunningInAndroid())) {
            const streamPath = `/api/providers/ytmusic/stream?videoId=${encodeURIComponent(ytVideoId)}`;
            const streamUrl = (typeof ApiConfig !== 'undefined' && typeof ApiConfig.buildUrl === 'function')
              ? ApiConfig.buildUrl(streamPath)
              : streamPath;
            if (!streamUrl.includes('spoton-trpn.vercel.app')) {
              const res = await fetch(streamUrl, { signal });
              if (res.ok) ytStream = await res.json();
            }
          }

          if (ytStream && ytStream.url && ytStream.url.startsWith('http')) {
            const u = ytStream.url.trim();
            song.audioUrl = u;
            song.streamUrl = u;
            song.playbackAvailable = true;
            song.isPlayable = true;
            setCachedStream(song.id, u);
            console.log(`[PlaybackResolver] Selected: YouTube Music Stream (${title})`);
            return { type: SourceType.STREAMING, uri: u, provider: 'youtube_music', song };
          }
        } catch (err) {
          if (err.name === 'AbortError') throw err;
          console.warn(`[PlaybackResolver] YouTube Music direct resolution failed:`, err.message);
        }
      }

      if (signal?.aborted) throw new Error('Playback request aborted');

      // Attempt 2: JioSaavn Catalog Match Fallback
      console.log(`[PlaybackResolver] Attempt 2 (JioSaavn Fallback): Searching for "${title} ${primaryArtist}"`);
      if (typeof API !== 'undefined' && API.searchSongs && (title || primaryArtist)) {
        try {
          const cleanQ = `${title.replace(/\(.*?\)|\[.*?\]/g, '')} ${primaryArtist}`.trim();
          const searchResults = await API.searchSongs(cleanQ, 1, 4);
          if (searchResults && searchResults.length > 0) {
            const matched = searchResults[0];
            const matchedUrl = API.getDownloadUrl(matched, preferredQuality);
            if (matchedUrl && typeof matchedUrl === 'string' && matchedUrl.trim().startsWith('http')) {
              const u = matchedUrl.trim();
              song.audioUrl = u;
              song.streamUrl = u;
              song.downloadUrl = matched.downloadUrl || [];
              song.playbackAvailable = true;
              song.isPlayable = true;
              setCachedStream(song.id, u);
              console.log(`[PlaybackResolver] Selected: JioSaavn Fallback Match (${matched.name})`);
              return { type: SourceType.STREAMING, uri: u, provider: 'jiosaavn', song };
            }
          }
        } catch (err) {
          if (err.name === 'AbortError') throw err;
          console.warn('[PlaybackResolver] JioSaavn fallback matching failed:', err.message);
        }
      }
    }

    // ========================================================================
    // PIPELINE B: JIOSAAVN ORIGIN TRACKS
    // 1. JioSaavn Details & Streams -> 2. YouTube Music Fallback -> 3. Offline/Local
    // ========================================================================
    else {
      // Attempt 1: JioSaavn Song Details by ID
      if (song.id && typeof API !== 'undefined' && API.getSongDetails) {
        console.log(`[PlaybackResolver] Attempt 1 (JioSaavn ID): Fetching details for ID ${song.id}`);
        try {
          const details = await API.getSongDetails(song.id);
          if (details && details.length > 0) {
            const resolved = details[0];
            Object.assign(song, resolved);
            const u = API.getDownloadUrl(resolved, preferredQuality);
            if (u && typeof u === 'string' && u.trim().startsWith('http')) {
              const cleanU = u.trim();
              song.audioUrl = cleanU;
              song.streamUrl = cleanU;
              song.playbackAvailable = true;
              song.isPlayable = true;
              setCachedStream(song.id, cleanU);
              console.log(`[PlaybackResolver] Selected: JioSaavn Direct Stream (${title})`);
              return { type: SourceType.STREAMING, uri: cleanU, provider: 'jiosaavn', song };
            }
          }
        } catch (err) {
          if (err.name === 'AbortError') throw err;
          console.warn('[PlaybackResolver] JioSaavn details resolution failed:', err.message);
        }
      }

      if (signal?.aborted) throw new Error('Playback request aborted');

      // Attempt 2: JioSaavn Search Match
      if (typeof API !== 'undefined' && API.searchSongs && (title || primaryArtist)) {
        console.log(`[PlaybackResolver] Attempt 2 (JioSaavn Search): Searching for "${title} ${primaryArtist}"`);
        try {
          const cleanQ = `${title.replace(/\(.*?\)|\[.*?\]/g, '')} ${primaryArtist}`.trim();
          const searchResults = await API.searchSongs(cleanQ, 1, 3);
          if (searchResults && searchResults.length > 0) {
            const matched = searchResults[0];
            const matchedUrl = API.getDownloadUrl(matched, preferredQuality);
            if (matchedUrl && typeof matchedUrl === 'string' && matchedUrl.trim().startsWith('http')) {
              const u = matchedUrl.trim();
              song.audioUrl = u;
              song.streamUrl = u;
              song.downloadUrl = matched.downloadUrl || [];
              song.playbackAvailable = true;
              song.isPlayable = true;
              setCachedStream(song.id, u);
              console.log(`[PlaybackResolver] Selected: JioSaavn Search Stream (${matched.name})`);
              return { type: SourceType.STREAMING, uri: u, provider: 'jiosaavn', song };
            }
          }
        } catch (err) {
          if (err.name === 'AbortError') throw err;
          console.warn('[PlaybackResolver] JioSaavn search stream resolution failed:', err.message);
        }
      }

      if (signal?.aborted) throw new Error('Playback request aborted');

      // Attempt 3: YouTube Music Fallback via Title + Artist Search
      console.log(`[PlaybackResolver] Attempt 3 (YouTube Music Fallback): Searching for "${title} ${primaryArtist}"`);
      try {
        let ytTrack = null;
        if (typeof youtubeMusicProvider !== 'undefined' && youtubeMusicProvider.search) {
          const ytSearch = await youtubeMusicProvider.search(`${title} ${primaryArtist}`.trim(), { limit: 3, signal });
          ytTrack = ytSearch?.songs?.[0];
        }

        if (ytTrack && ytTrack.videoId) {
          const ytStream = (typeof youtubeMusicProvider !== 'undefined' && youtubeMusicProvider.resolveStream)
            ? await youtubeMusicProvider.resolveStream(ytTrack.videoId, { signal })
            : null;

          if (ytStream && ytStream.url && ytStream.url.startsWith('http')) {
            const u = ytStream.url.trim();
            song.audioUrl = u;
            song.streamUrl = u;
            song.sourceYtVideoId = ytTrack.videoId;
            song.playbackAvailable = true;
            song.isPlayable = true;
            setCachedStream(song.id, u);
            console.log(`[PlaybackResolver] Selected: YouTube Music Fallback (${ytTrack.name})`);
            return { type: SourceType.STREAMING, uri: u, provider: 'youtube_music', song };
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        console.warn('[PlaybackResolver] YouTube Music fallback resolution failed:', err.message);
      }
    }

    // All Providers Failed
    console.warn(`[PlaybackResolver] All providers failed for "${title}" (${songId})`);
    return {
      type: SourceType.UNKNOWN,
      uri: '',
      error: ErrorCode.SOURCE_UNAVAILABLE,
      message: "Couldn't play this song"
    };
  }

  return {
    SourceType,
    ErrorCode,
    resolvePlayableSource,
    getCachedStream,
    setCachedStream
  };
})();

if (typeof window !== 'undefined') {
  window.PlaybackResolver = PlaybackResolver;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlaybackResolver;
}
