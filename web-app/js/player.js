// ==========================================================================
// MUSICFLOW — HARDENED AUDIO PLAYBACK ENGINE (Phase 8.1)
// Unified source resolution, deterministic state machine, gapless queue,
// media session integration, audio focus, Web Audio EQ & 3D Spatial Graph.
// ==========================================================================

const Player = (() => {
  // Playback States (Single Source of Truth)
  const PlaybackState = {
    IDLE: 'IDLE',
    LOADING: 'LOADING',
    READY: 'READY',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    BUFFERING: 'BUFFERING',
    COMPLETED: 'COMPLETED',
    ERROR: 'ERROR'
  };

  // Audio Source Types
  const SourceType = {
    DOWNLOADED: 'DOWNLOADED',
    LOCAL: 'LOCAL',
    CACHED: 'CACHED',
    STREAMING: 'STREAMING',
    UNKNOWN: 'UNKNOWN'
  };

  // Playback Error Codes
  const ErrorCode = {
    SOURCE_UNAVAILABLE: 'SOURCE_UNAVAILABLE',
    NETWORK_ERROR: 'NETWORK_ERROR',
    FORMAT_UNSUPPORTED: 'FORMAT_UNSUPPORTED',
    FILE_MISSING: 'FILE_MISSING',
    DECODE_ERROR: 'DECODE_ERROR',
    OFFLINE_UNAVAILABLE: 'OFFLINE_UNAVAILABLE',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
  };

  let audio = null;
  let queue = [];
  let currentIndex = -1;
  let playbackState = PlaybackState.IDLE;
  let currentSourceType = null;
  let isShuffle = false;
  let repeatMode = 'OFF'; // 'OFF', 'ALL', 'ONE'
  let unShuffledQueue = [];
  let sleepTimerState = {
    active: false,
    mode: 'off', // 'off' | 'duration' | 'end_of_track'
    durationMinutes: 0,
    expiresAt: 0,
    trackIdWhenSet: null
  };
  let sleepTimerTimeout = null;
  let sleepTimerInterval = null;

  // Race condition token
  let playbackGeneration = 0;
  let retryCount = 0;
  const MAX_RETRIES = 2;

  // Tracking milestones & history debounce
  let hasAddedToHistory = false;
  let recordedMilestones = new Set();
  let lastError = null;

  // Web Audio Context, 5-Band Equalizer & 3D Spatial Audio Graph
  let audioCtx = null;
  let sourceNode = null;
  let eqBands = [];
  let bassBoostNode = null;
  let virtualizerGain = null;

  const EQ_FREQS = [60, 230, 910, 3600, 14000];
  const EQ_PRESETS = {
    'Flat': [0, 0, 0, 0, 0],
    'Bass Boost': [6, 4, 1, 0, -1],
    'Pop': [-1, 2, 4, 3, 1],
    'Rock': [4, 2, -1, 2, 5],
    'Electronic': [4, 3, 0, 2, 4],
    'Hip Hop': [5, 3, 0, 1, 3],
    'Classical': [3, 2, -1, 2, 3],
    'Acoustic': [2, 1, 2, 3, 2],
    'Vocal Booster': [-2, 1, 5, 3, -1],
    '3D Spatial Concert': [3, 2, 1, 3, 4]
  };

  const eventListeners = {
    trackChange: [],
    stateChange: [],
    timeUpdate: [],
    queueChange: [],
    eqChange: [],
    shuffleChange: [],
    repeatChange: [],
    sleepTimerChange: [],
    sleepTimerTick: [],
    sleepTimerExpired: [],
    error: []
  };

  function transitionTo(newState, payload = {}) {
    playbackState = newState;
    const isPlaying = (newState === PlaybackState.PLAYING);

    const statePayload = {
      state: newState,
      playbackState: newState,
      isPlaying,
      currentTrack: getCurrentTrack(),
      position: audio ? audio.currentTime : 0,
      duration: audio ? (audio.duration || 0) : 0,
      bufferedPosition: getBufferedPosition(),
      sourceType: currentSourceType,
      queueIndex: currentIndex,
      repeatMode,
      shuffleEnabled: isShuffle,
      error: lastError,
      ...payload
    };

    notify('stateChange', statePayload);

    if (newState === PlaybackState.PLAYING) {
      updateMediaSessionPlaybackState('playing');
    } else if (newState === PlaybackState.PAUSED || newState === PlaybackState.BUFFERING) {
      updateMediaSessionPlaybackState('paused');
    } else if (newState === PlaybackState.IDLE || newState === PlaybackState.COMPLETED || newState === PlaybackState.ERROR) {
      updateMediaSessionPlaybackState('none');
    }
  }

  function getBufferedPosition() {
    if (!audio || !audio.buffered || audio.buffered.length === 0) return 0;
    try {
      return audio.buffered.end(audio.buffered.length - 1);
    } catch (_) {
      return 0;
    }
  }

  function init() {
    if (typeof document === 'undefined') return;

    if (!audio) {
      audio = document.getElementById('app-audio') || new Audio();
      audio.id = 'app-audio';
      audio.preload = 'auto';
      audio.crossOrigin = 'anonymous';
    }

    // Attach core audio lifecycle listeners
    audio.addEventListener('loadstart', () => {
      transitionTo(PlaybackState.LOADING);
    });

    audio.addEventListener('canplay', () => {
      if (playbackState === PlaybackState.LOADING) {
        transitionTo(PlaybackState.READY);
      }
    });

    audio.addEventListener('waiting', () => {
      if (playbackState === PlaybackState.PLAYING) {
        transitionTo(PlaybackState.BUFFERING);
      }
    });

    audio.addEventListener('playing', () => {
      retryCount = 0;
      transitionTo(PlaybackState.PLAYING);
      updatePositionState();

      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(console.warn);
      }
    });

    audio.addEventListener('pause', () => {
      if (playbackState !== PlaybackState.COMPLETED && playbackState !== PlaybackState.ERROR) {
        transitionTo(PlaybackState.PAUSED);
      }
      updatePositionState();
    });

    audio.addEventListener('timeupdate', () => {
      const curTime = audio.currentTime || 0;
      const dur = audio.duration || (getCurrentTrack()?.duration) || 0;

      notify('timeUpdate', {
        currentTime: curTime,
        duration: dur
      });

      if (Math.floor(curTime) % 2 === 0) {
        updatePositionState();
      }

      const cur = getCurrentTrack();
      if (!cur || !dur || isNaN(dur) || dur <= 0) return;

      const pct = Math.floor((curTime / dur) * 100);

      // Add to listening history only after meaningful listening (10s or 25%)
      if (!hasAddedToHistory && (curTime >= 10 || pct >= 25)) {
        hasAddedToHistory = true;
        if (typeof Storage !== 'undefined' && Storage.addToHistory) {
          Storage.addToHistory(cur);
        }
      }

      // Record recommendation milestone signals (25%, 50%, 75%, 100%)
      if (pct >= 25 && !recordedMilestones.has(25)) {
        recordedMilestones.add(25);
        if (typeof Storage !== 'undefined' && Storage.recordPlayMilestone) Storage.recordPlayMilestone(cur, 25);
      }
      if (pct >= 50 && !recordedMilestones.has(50)) {
        recordedMilestones.add(50);
        if (typeof Storage !== 'undefined' && Storage.recordPlayMilestone) Storage.recordPlayMilestone(cur, 50);
      }
      if (pct >= 75 && !recordedMilestones.has(75)) {
        recordedMilestones.add(75);
        if (typeof Storage !== 'undefined' && Storage.recordPlayMilestone) Storage.recordPlayMilestone(cur, 75);
      }
      if (pct >= 90 && !recordedMilestones.has(100)) {
        recordedMilestones.add(100);
        if (typeof Storage !== 'undefined' && Storage.recordPlayMilestone) Storage.recordPlayMilestone(cur, 100);
      }

      // Sleep timer timestamp-based background verification
      if (sleepTimerState.active && sleepTimerState.mode === 'duration' && sleepTimerState.expiresAt > 0) {
        if (Date.now() >= sleepTimerState.expiresAt) {
          handleSleepTimerExpiration();
        }
      }
    });

    audio.addEventListener('ended', () => {
      transitionTo(PlaybackState.COMPLETED);
      // End of Current Track Sleep Timer Mode
      if (sleepTimerState.active && sleepTimerState.mode === 'end_of_track') {
        handleSleepTimerExpiration();
        return;
      }
      if (repeatMode === 'ONE') {
        audio.currentTime = 0;
        audio.play().catch(console.warn);
      } else {
        next();
      }
    });

    if (typeof document !== 'undefined' && !document._sleepTimerVisibilityAttached) {
      document._sleepTimerVisibilityAttached = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && sleepTimerState.active && sleepTimerState.mode === 'duration') {
          if (Date.now() >= sleepTimerState.expiresAt) {
            handleSleepTimerExpiration();
          } else {
            notify('sleepTimerChange', getSleepTimerState());
          }
        }
      });
    }

    audio.addEventListener('error', (e) => {
      const err = audio.error;
      let code = ErrorCode.UNKNOWN_ERROR;
      let msg = 'Playback failed to decode audio source.';

      if (err) {
        if (err.code === MediaError.MEDIA_ERR_NETWORK) {
          code = ErrorCode.NETWORK_ERROR;
          msg = 'Network connection failed during playback.';
        } else if (err.code === MediaError.MEDIA_ERR_DECODE) {
          code = ErrorCode.DECODE_ERROR;
          msg = 'Audio format cannot be decoded.';
        } else if (err.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
          code = ErrorCode.FORMAT_UNSUPPORTED;
          msg = 'Audio source or format is unsupported.';
        }
      }

      lastError = { code, message: msg, track: getCurrentTrack() };
      console.warn('[Player] Audio playback error:', lastError);
      notify('error', lastError);
      transitionTo(PlaybackState.ERROR, { error: lastError });

      // Handle transient recovery or auto-skip
      if (retryCount < MAX_RETRIES && code === ErrorCode.NETWORK_ERROR) {
        retryCount++;
        console.log(`[Player] Retrying stream playback (${retryCount}/${MAX_RETRIES})...`);
        setTimeout(() => {
          if (audio) {
            audio.load();
            audio.play().catch(console.warn);
          }
        }, 1200);
      } else if (queue.length > 1) {
        // Auto-skip failed track after notification
        setTimeout(() => {
          next();
        }, 1500);
      }
    });

    // Auto-resume audio context & background lifecycle
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && playbackState === PlaybackState.PLAYING && audio) {
        if (audio.paused) audio.play().catch(console.warn);
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(console.warn);
      }
    });

    window.addEventListener('pageshow', () => {
      if (playbackState === PlaybackState.PLAYING && audio && audio.paused) {
        audio.play().catch(console.warn);
      }
    });

    setupMediaSession();
  }

  function initWebAudio() {
    if (audioCtx || !audio || typeof window === 'undefined') return;
    try {
      if (typeof AudioEffectsEngine !== 'undefined' && typeof AudioEffectsEngine.init === 'function') {
        AudioEffectsEngine.init(audio);
        audioCtx = AudioEffectsEngine.getAudioContext();
      } else {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (AudioCtxClass) {
          audioCtx = new AudioCtxClass();
          sourceNode = audioCtx.createMediaElementSource(audio);
          bassBoostNode = audioCtx.createBiquadFilter();
          bassBoostNode.type = 'lowshelf';
          bassBoostNode.frequency.value = 80;
          bassBoostNode.gain.value = 0;

          eqBands = EQ_FREQS.map((freq, idx) => {
            const filter = audioCtx.createBiquadFilter();
            filter.type = idx === 0 ? 'lowshelf' : (idx === EQ_FREQS.length - 1 ? 'highshelf' : 'peaking');
            filter.frequency.value = freq;
            filter.gain.value = 0;
            filter.Q.value = 1.0;
            return filter;
          });

          virtualizerGain = audioCtx.createGain();
          virtualizerGain.gain.value = 1.0;

          let prev = sourceNode;
          prev.connect(bassBoostNode);
          prev = bassBoostNode;
          eqBands.forEach(band => {
            prev.connect(band);
            prev = band;
          });
          prev.connect(virtualizerGain);
          virtualizerGain.connect(audioCtx.destination);
        }
      }
    } catch (e) {
      console.warn('[Player] Web Audio setup error:', e);
    }
  }

  function applyEqualizerSettings(eqData) {
    if (!eqData) return;
    if (typeof AudioEffectsEngine !== 'undefined') {
      if (eqData.enabled !== undefined) AudioEffectsEngine.setEnabled(eqData.enabled);
      if (eqData.preset) AudioEffectsEngine.setPreset(eqData.preset);
      if (Array.isArray(eqData.bands)) {
        eqData.bands.forEach((g, idx) => AudioEffectsEngine.setBandGain(idx, g));
      }
      if (eqData.bassBoost !== undefined) AudioEffectsEngine.setBassBoost(eqData.bassBoost);
      if (eqData.trebleBoost !== undefined) AudioEffectsEngine.setTrebleBoost(eqData.trebleBoost);
      if (eqData.vocalBoost !== undefined) AudioEffectsEngine.setVocalBoost(eqData.vocalBoost);
      if (eqData.spatial !== undefined) AudioEffectsEngine.setSpatial(eqData.spatial);
    } else {
      const isEnabled = eqData.enabled === true;
      if (bassBoostNode) bassBoostNode.gain.value = isEnabled ? (eqData.bassBoost || 0) : 0;
      if (eqBands && eqBands.length === 5) {
        const bands = eqData.bands || [0, 0, 0, 0, 0];
        eqBands.forEach((band, idx) => {
          band.gain.value = isEnabled ? (bands[idx] || 0) : 0;
        });
      }
      if (virtualizerGain) {
        const v = isEnabled ? (eqData.virtualizer || 0) : 0;
        virtualizerGain.gain.value = 1.0 + (v / 200);
      }
    }
    notify('eqChange', eqData);
  }

  function setEqEnabled(enabled) {
    if (typeof AudioEffectsEngine !== 'undefined') {
      AudioEffectsEngine.setEnabled(enabled);
    }
    if (typeof Storage !== 'undefined') {
      const eq = Storage.getEqualizer ? Storage.getEqualizer() : {};
      eq.enabled = enabled;
      if (Storage.setEqualizer) Storage.setEqualizer(eq);
    }
    notify('eqChange', { enabled });
  }

  function setEqBand(index, gainDb) {
    if (typeof AudioEffectsEngine !== 'undefined') {
      AudioEffectsEngine.setBandGain(index, gainDb);
    }
    if (typeof Storage !== 'undefined') {
      const eq = Storage.getEqualizer ? Storage.getEqualizer() : { bands: [0, 0, 0, 0, 0] };
      if (!eq.bands) eq.bands = [0, 0, 0, 0, 0];
      eq.bands[index] = gainDb;
      eq.preset = 'Custom';
      if (Storage.setEqualizer) Storage.setEqualizer(eq);
    }
    notify('eqChange', { band: index, gain: gainDb });
  }

  function setBassBoost(gainDb) {
    if (typeof AudioEffectsEngine !== 'undefined') {
      AudioEffectsEngine.setBassBoost(gainDb);
    }
    if (typeof Storage !== 'undefined') {
      const eq = Storage.getEqualizer ? Storage.getEqualizer() : {};
      eq.bassBoost = gainDb;
      if (Storage.setEqualizer) Storage.setEqualizer(eq);
    }
    notify('eqChange', { bassBoost: gainDb });
  }

  function setTrebleBoost(gainDb) {
    if (typeof AudioEffectsEngine !== 'undefined') {
      AudioEffectsEngine.setTrebleBoost(gainDb);
    }
    if (typeof Storage !== 'undefined' && Storage.setAudioEffects) {
      Storage.setAudioEffects({ trebleBoost: gainDb, preset: 'Custom' });
    }
    notify('eqChange', { trebleBoost: gainDb });
  }

  function setVocalBoost(gainDb) {
    if (typeof AudioEffectsEngine !== 'undefined') {
      AudioEffectsEngine.setVocalBoost(gainDb);
    }
    if (typeof Storage !== 'undefined' && Storage.setAudioEffects) {
      Storage.setAudioEffects({ vocalBoost: gainDb, preset: 'Custom' });
    }
    notify('eqChange', { vocalBoost: gainDb });
  }

  function setSpatial(level) {
    if (typeof AudioEffectsEngine !== 'undefined') {
      AudioEffectsEngine.setSpatial(level);
    }
    if (typeof Storage !== 'undefined' && Storage.setAudioEffects) {
      Storage.setAudioEffects({ spatial: level });
    }
    notify('eqChange', { spatial: level });
  }

  function setVirtualizerStrength(percent) {
    const level = percent >= 75 ? 'HIGH' : (percent >= 45 ? 'MEDIUM' : (percent >= 15 ? 'LOW' : 'OFF'));
    setSpatial(level);
  }

  function setNormalization(enabled) {
    if (typeof AudioEffectsEngine !== 'undefined') {
      AudioEffectsEngine.setNormalization(enabled);
    }
    if (typeof Storage !== 'undefined' && Storage.setAudioEffects) {
      Storage.setAudioEffects({ normalization: enabled });
    }
    notify('eqChange', { normalization: enabled });
  }

  function setCrossfade(seconds) {
    if (typeof AudioEffectsEngine !== 'undefined') {
      AudioEffectsEngine.setCrossfade(seconds);
    }
    if (typeof Storage !== 'undefined' && Storage.setAudioEffects) {
      Storage.setAudioEffects({ crossfade: seconds });
    }
  }

  function setEqPreset(presetName) {
    if (typeof AudioEffectsEngine !== 'undefined') {
      AudioEffectsEngine.setPreset(presetName);
    }
    if (typeof Storage !== 'undefined') {
      const eq = Storage.getEqualizer ? Storage.getEqualizer() : {};
      eq.preset = presetName;
      const presetGains = EQ_PRESETS[presetName];
      if (presetGains) eq.bands = [...presetGains];
      if (Storage.setEqualizer) Storage.setEqualizer(eq);
    }
    notify('eqChange', { preset: presetName });
  }

  function resetAudioEffects() {
    if (typeof AudioEffectsEngine !== 'undefined') {
      AudioEffectsEngine.resetDefaults();
    }
    if (typeof Storage !== 'undefined' && Storage.resetAudioEffects) {
      Storage.resetAudioEffects();
    }
    notify('eqChange', { reset: true });
  }

  function notify(event, data) {
    (eventListeners[event] || []).forEach(cb => {
      try { cb(data); } catch (e) { console.error(e); }
    });
  }

  function setupMediaSession() {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      const actions = [
        ['play', () => play()],
        ['pause', () => pause()],
        ['previoustrack', () => previous()],
        ['nexttrack', () => next()],
        ['seekforward', () => next()],
        ['seekbackward', () => previous()],
        ['seekto', (details) => {
          if (details && details.seekTime !== undefined && audio && !isNaN(details.seekTime)) {
            seek(details.seekTime);
          }
        }],
        ['stop', () => {
          pause();
          if (audio) audio.currentTime = 0;
        }]
      ];

      actions.forEach(([action, handler]) => {
        try {
          navigator.mediaSession.setActionHandler(action, handler);
        } catch (e) {
          console.warn(`[MediaSession] Action ${action} not supported:`, e);
        }
      });
    }
  }

  function updatePositionState() {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator && 'setPositionState' in navigator.mediaSession && audio && audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: Math.max(0, audio.duration),
          playbackRate: audio.playbackRate || 1.0,
          position: Math.max(0, Math.min(audio.currentTime, audio.duration))
        });
      } catch (_) {}
    }
  }

  function getAbsoluteImageUrl(url) {
    if (!url) url = 'assets/logo.png';
    if (url.startsWith('//')) return 'https:' + url;
    if (url.startsWith('http://')) return url.replace('http://', 'https://');
    if (url.startsWith('https://')) return url;
    try {
      return (typeof window !== 'undefined') ? new URL(url, window.location.href).href : url;
    } catch (_) {
      return url;
    }
  }

  function updateMediaSession(song) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !song) return;

    const artUrl = getAbsoluteImageUrl(song.image || 'assets/logo.png');

    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.name || 'Unknown Track',
      artist: song.artists || song.primaryArtist || 'MusicFlow',
      album: song.album || 'MusicFlow Lossless',
      artwork: [
        { src: artUrl, sizes: '96x96', type: 'image/png' },
        { src: artUrl, sizes: '128x128', type: 'image/png' },
        { src: artUrl, sizes: '256x256', type: 'image/png' },
        { src: artUrl, sizes: '512x512', type: 'image/png' }
      ]
    });

    updatePositionState();
  }

  function updateMediaSessionPlaybackState(state) {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = state;
    }
  }

  function getCurrentTrack() {
    return (currentIndex >= 0 && currentIndex < queue.length) ? queue[currentIndex] : null;
  }

  // Unified Source Resolution Pipeline with strict Priority: Downloaded > Local > Cached > Streaming
  async function resolvePlaybackSource(song) {
    if (!song) {
      return { type: SourceType.UNKNOWN, uri: '', error: ErrorCode.SOURCE_UNAVAILABLE };
    }

    // 1. Downloaded Offline Audio Check
    if (song.source === 'DOWNLOADED' || (typeof Storage !== 'undefined' && Storage.isDownloaded && Storage.isDownloaded(song.id))) {
      try {
        const offlineUrl = await Storage.getDownloadedAudioUrl(song.id);
        if (offlineUrl) {
          return { type: SourceType.DOWNLOADED, uri: offlineUrl, song };
        }
      } catch (e) {
        console.warn('[Player] Downloaded audio resolution failed:', e);
      }
    }

    // 2. Local User Audio Check (Blob URL / File / ID3)
    if (song.source === 'LOCAL' || song.localBlobUrl || (song.streamUrl && song.streamUrl.startsWith('blob:'))) {
      if (song.localBlobUrl) {
        return { type: SourceType.LOCAL, uri: song.localBlobUrl, song };
      }
      if (song.fileBlob && typeof URL !== 'undefined') {
        song.localBlobUrl = URL.createObjectURL(song.fileBlob);
        return { type: SourceType.LOCAL, uri: song.localBlobUrl, song };
      }
      if (song.streamUrl && song.streamUrl.startsWith('blob:')) {
        return { type: SourceType.LOCAL, uri: song.streamUrl, song };
      }
    }

    // 3. Cached Audio URL
    if (song.cachedAudioUrl && typeof song.cachedAudioUrl === 'string' && song.cachedAudioUrl.startsWith('http')) {
      return { type: SourceType.CACHED, uri: song.cachedAudioUrl, song };
    }

    // 4. Online Streaming Audio Resolution
    const isOnline = (typeof OfflineManager !== 'undefined')
      ? OfflineManager.isOnline()
      : (typeof navigator === 'undefined' || navigator.onLine !== false);

    const preferredQuality = (typeof Storage !== 'undefined' && Storage.getAudioQuality) ? Storage.getAudioQuality() : '320kbps';
    let directUrl = (typeof API !== 'undefined' && API.getDownloadUrl) ? API.getDownloadUrl(song, preferredQuality) : (song.audioUrl || song.streamUrl || '');

    if (directUrl && typeof directUrl === 'string' && directUrl.trim().startsWith('http')) {
      if (!isOnline) {
        return { type: SourceType.STREAMING, uri: '', error: ErrorCode.OFFLINE_UNAVAILABLE, message: 'This track is available offline only if downloaded.' };
      }
      return { type: SourceType.STREAMING, uri: directUrl.trim(), song };
    }

    if (!isOnline) {
      return { type: SourceType.STREAMING, uri: '', error: ErrorCode.OFFLINE_UNAVAILABLE, message: 'This track is available offline only if downloaded.' };
    }

    // Attempt Resolution with Retry
    for (let attempt = 0; attempt < 2; attempt++) {
      // Fetch Details by ID
      if (song.id && typeof API !== 'undefined' && API.getSongDetails) {
        try {
          const details = await API.getSongDetails(song.id);
          if (details && details.length > 0) {
            const resolved = details[0];
            Object.assign(song, resolved);
            const u = API.getDownloadUrl(resolved, preferredQuality);
            if (u && typeof u === 'string' && u.trim().startsWith('http')) {
              song.audioUrl = u.trim();
              song.streamUrl = u.trim();
              return { type: SourceType.STREAMING, uri: u.trim(), song };
            }
          }
        } catch (e) {
          console.warn(`[Player] Detail stream resolution attempt ${attempt + 1} failed:`, e);
        }
      }

      // Search Fallback
      if ((song.name || song.title) && typeof API !== 'undefined' && API.searchSongs) {
        try {
          const q = `${song.name || song.title} ${song.artists || song.primaryArtist || ''}`.trim();
          const searchResults = await API.searchSongs(q, 1, 3);
          if (searchResults && searchResults.length > 0) {
            const matched = searchResults[0];
            const matchedUrl = API.getDownloadUrl(matched, preferredQuality);
            if (matchedUrl && typeof matchedUrl === 'string' && matchedUrl.trim().startsWith('http')) {
              song.audioUrl = matchedUrl.trim();
              song.streamUrl = matchedUrl.trim();
              song.downloadUrl = matched.downloadUrl || [];
              return { type: SourceType.STREAMING, uri: matchedUrl.trim(), song };
            }
          }
        } catch (err) {
          console.warn(`[Player] Search fallback stream resolution attempt ${attempt + 1} failed:`, err);
        }
      }

      if (attempt === 0) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    return {
      type: SourceType.UNKNOWN,
      uri: '',
      error: ErrorCode.SOURCE_UNAVAILABLE,
      message: 'No valid audio stream URL found for track'
    };
  }

  // Play Track at Index with Generation Protection against Race Conditions
  async function playTrackAtIndex(index, autoPlay = true) {
    if (index < 0 || index >= queue.length) return;

    const currentReqGen = ++playbackGeneration;
    currentIndex = index;
    const song = queue[currentIndex];

    // Reset tracking flags for new track
    hasAddedToHistory = false;
    recordedMilestones.clear();
    lastError = null;

    notify('trackChange', song);
    setupMediaSession();
    updateMediaSession(song);
    transitionTo(PlaybackState.LOADING);

    try {
      const resolved = await resolvePlaybackSource(song);

      // Race condition check: ensure a newer track request has not superseded this one
      if (currentReqGen !== playbackGeneration) {
        console.log(`[Player] Discarding stale playback request #${currentReqGen} in favor of #${playbackGeneration}`);
        return;
      }

      if (resolved.error || !resolved.uri) {
        throw new Error(resolved.message || 'No valid audio stream URL available');
      }

      currentSourceType = resolved.type;

      if (!audio) init();
      if (!audio) return;

      audio.src = resolved.uri;
      audio.load();

      if (autoPlay) {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          await playPromise.catch(err => {
            console.warn('[Player] Autoplay interrupted/prevented:', err.message);
          });
        }
      }

      if (typeof Storage !== 'undefined' && Storage.saveSession) {
        Storage.saveSession(queue, currentIndex, audio.currentTime);
      }

      // Auto-populate continuous queue when near queue end
      if (queue.length - currentIndex <= 3 && autoPlay) {
        autoPopulateContinuousQueue(song);
      }
    } catch (err) {
      if (currentReqGen !== playbackGeneration) return;
      lastError = { code: ErrorCode.SOURCE_UNAVAILABLE, message: err.message, track: song };
      console.warn('[Player] play error:', err.message);
      notify('error', lastError);
      transitionTo(PlaybackState.ERROR, { error: lastError });

      // Auto-advance if offline error and more songs in queue
      if (queue.length > 1) {
        setTimeout(() => {
          if (currentReqGen === playbackGeneration) next();
        }, 1500);
      }
    }
  }

  let isAutoPopulatingQueue = false;

  async function autoPopulateContinuousQueue(currentSong) {
    if (!currentSong || isAutoPopulatingQueue) return;
    isAutoPopulatingQueue = true;
    try {
      let recs = [];
      const primaryArtist = (typeof API !== 'undefined' && API.decodeHtml) 
        ? API.decodeHtml(currentSong.primaryArtist || currentSong.artists || '').split(/[,;&/]/)[0].trim()
        : String(currentSong.primaryArtist || currentSong.artists || '').split(/[,;&/]/)[0].trim();

      if (typeof API !== 'undefined' && API.getSimilarSongs) {
        recs = await API.getSimilarSongs(currentSong.id, 20);
      }
      if (!recs || recs.length < 5) {
        if (primaryArtist && typeof API !== 'undefined' && API.searchSongs) {
          const searchRecs = await API.searchSongs(`${primaryArtist} Hits`, 1, 20);
          if (Array.isArray(searchRecs)) {
            recs = [...(recs || []), ...searchRecs];
          }
        }
      }

      const TD = (typeof TrackDeduplicator !== 'undefined') ? TrackDeduplicator : { deduplicate: arr => arr };
      const uniqueRecs = TD.deduplicate(recs || []);
      const newItems = uniqueRecs.filter(s => s && s.id && !queue.some(q => String(q.id) === String(s.id)));

      if (newItems.length > 0) {
        queue.push(...newItems);
        unShuffledQueue.push(...newItems);
        notify('queueChange', queue);
      }
    } catch (_) {
    } finally {
      isAutoPopulatingQueue = false;
    }
  }

  async function playSong(song, newQueue = null) {
    if (!song) return;
    if (newQueue && Array.isArray(newQueue) && newQueue.length > 0) {
      const idx = newQueue.findIndex(s => String(s.id) === String(song.id));
      setQueue(newQueue, idx >= 0 ? idx : 0);
    } else {
      const existingIdx = queue.findIndex(s => String(s.id) === String(song.id));
      if (existingIdx >= 0) {
        await playTrackAtIndex(existingIdx, true);
      } else {
        queue.push(song);
        unShuffledQueue.push(song);
        notify('queueChange', queue);
        await playTrackAtIndex(queue.length - 1, true);
        autoPopulateContinuousQueue(song);
      }
    }
  }

  function startRadioQueue(currentSong, relatedSongs = []) {
    if (!currentSong) return;
    const cleanRelated = relatedSongs.filter(s => s && s.id && String(s.id) !== String(currentSong.id));
    const activeTrack = getCurrentTrack();
    const isSameActiveTrack = activeTrack && (String(activeTrack.id) === String(currentSong.id));

    // If currentSong is the active playing track in the queue:
    // Keep history intact, keep active track in place at currentIndex, and replace all future upcoming tracks!
    if (isSameActiveTrack) {
      const pastTracks = queue.slice(0, currentIndex);
      queue = [...pastTracks, activeTrack, ...cleanRelated];
      unShuffledQueue = [...queue];
      notify('queueChange', queue);
      console.log(`[Player] Radio queue populated: ${queue.length} total tracks (${cleanRelated.length} upcoming) preserving active track "${activeTrack.name}" at index ${currentIndex}`);
      return;
    }

    // Otherwise, set new queue with currentSong at index 0
    queue = [currentSong, ...cleanRelated];
    unShuffledQueue = [...queue];
    currentIndex = 0;
    notify('queueChange', queue);
    playTrackAtIndex(0, true);
  }

  function setQueue(newQueue, startIndex = 0, autoPlay = true) {
    queue = Array.isArray(newQueue) ? [...newQueue] : [];
    unShuffledQueue = [...queue];
    currentIndex = Math.max(0, Math.min(startIndex, queue.length - 1));
    notify('queueChange', queue);
    if (queue.length > 0) {
      playTrackAtIndex(currentIndex, autoPlay);
    } else {
      transitionTo(PlaybackState.IDLE);
    }
  }

  function appendToQueue(song) {
    if (!song) return;
    queue.push(song);
    unShuffledQueue.push(song);
    notify('queueChange', queue);
  }

  function playNext(song) {
    if (!song) return;
    if (currentIndex >= 0 && currentIndex < queue.length) {
      queue.splice(currentIndex + 1, 0, song);
      unShuffledQueue.push(song);
    } else {
      queue.push(song);
      unShuffledQueue.push(song);
    }
    notify('queueChange', queue);
  }

  function removeFromQueue(index) {
    if (index < 0 || index >= queue.length) return;
    const removedCurrent = index === currentIndex;
    queue.splice(index, 1);
    unShuffledQueue = unShuffledQueue.filter((_, idx) => idx !== index);

    if (currentIndex >= queue.length) {
      currentIndex = queue.length - 1;
    }
    notify('queueChange', queue);

    if (removedCurrent && queue.length > 0) {
      playTrackAtIndex(currentIndex, true);
    } else if (queue.length === 0) {
      pause();
      currentIndex = -1;
      transitionTo(PlaybackState.IDLE);
    }
  }

  function reorderQueue(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= queue.length || toIndex < 0 || toIndex >= queue.length) return;
    const item = queue.splice(fromIndex, 1)[0];
    queue.splice(toIndex, 0, item);
    if (currentIndex === fromIndex) {
      currentIndex = toIndex;
    } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
      currentIndex--;
    } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
      currentIndex++;
    }
    notify('queueChange', queue);
  }

  function clearQueue() {
    const current = getCurrentTrack();
    queue = current ? [current] : [];
    unShuffledQueue = [...queue];
    currentIndex = current ? 0 : -1;
    notify('queueChange', queue);
  }

  function togglePlay() {
    if (!audio) {
      init();
    }
    if (!audio) return;

    if (audio.paused) {
      if (!audio.src && queue.length > 0) {
        playTrackAtIndex(currentIndex >= 0 ? currentIndex : 0, true);
      } else {
        play();
      }
    } else {
      pause();
    }
  }

  function play() {
    if (audio && audio.paused) {
      audio.play().catch(console.warn);
    }
  }

  function pause() {
    if (audio && !audio.paused) {
      audio.pause();
    }
  }

  async function next() {
    if (queue.length === 0) return;

    // Track skip behavior if skipped early (< 20s or < 25%)
    const current = getCurrentTrack();
    if (current && audio && audio.currentTime < 20 && typeof Storage !== 'undefined' && Storage.recordSkip) {
      Storage.recordSkip(current);
    }

    if (repeatMode === 'ONE') {
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(console.warn);
      }
      return;
    }

    if (currentIndex + 1 < queue.length) {
      playTrackAtIndex(currentIndex + 1, true);
    } else if (repeatMode === 'ALL') {
      playTrackAtIndex(0, true);
    } else {
      if (current) {
        try {
          await autoPopulateContinuousQueue(current);
          if (currentIndex + 1 < queue.length) {
            playTrackAtIndex(currentIndex + 1, true);
            return;
          }
        } catch (_) {}
      }
      transitionTo(PlaybackState.COMPLETED);
    }
  }

  function previous() {
    if (queue.length === 0) return;
    if (audio && audio.currentTime > 3.0) {
      audio.currentTime = 0;
      return;
    }
    if (currentIndex - 1 >= 0) {
      playTrackAtIndex(currentIndex - 1, true);
    } else if (repeatMode === 'ALL') {
      playTrackAtIndex(queue.length - 1, true);
    } else {
      if (audio) audio.currentTime = 0;
    }
  }

  function seek(seconds) {
    if (!audio || isNaN(seconds) || seconds < 0) return;
    const dur = audio.duration || (getCurrentTrack()?.duration) || 0;
    const target = Math.max(0, Math.min(seconds, dur || Infinity));
    audio.currentTime = target;
    updatePositionState();
  }

  function seekPercent(percent) {
    if (!audio || !audio.duration || isNaN(percent)) return;
    const p = Math.max(0, Math.min(percent, 100));
    audio.currentTime = (p / 100) * audio.duration;
    updatePositionState();
  }

  function toggleShuffle() {
    isShuffle = !isShuffle;
    const current = getCurrentTrack();

    if (isShuffle) {
      const remaining = queue.filter((_, idx) => idx !== currentIndex);
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
      }
      queue = current ? [current, ...remaining] : remaining;
      currentIndex = 0;
    } else {
      queue = [...unShuffledQueue];
      currentIndex = current ? queue.findIndex(s => String(s.id) === String(current.id)) : 0;
    }

    notify('shuffleChange', isShuffle);
    notify('queueChange', queue);
    return isShuffle;
  }

  function toggleRepeat() {
    if (repeatMode === 'OFF') repeatMode = 'ALL';
    else if (repeatMode === 'ALL') repeatMode = 'ONE';
    else repeatMode = 'OFF';
    notify('repeatChange', repeatMode);
    return repeatMode;
  }

  function formatTimeRemaining(ms) {
    if (ms <= 0) return '0:00';
    const totalSec = Math.ceil(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  function getSleepTimerState() {
    const remainingMs = (sleepTimerState.active && sleepTimerState.mode === 'duration' && sleepTimerState.expiresAt > 0)
      ? Math.max(0, sleepTimerState.expiresAt - Date.now())
      : 0;
    return {
      active: sleepTimerState.active,
      mode: sleepTimerState.mode,
      durationMinutes: sleepTimerState.durationMinutes,
      expiresAt: sleepTimerState.expiresAt,
      remainingMs,
      formattedRemaining: sleepTimerState.mode === 'end_of_track' ? 'End of song' : formatTimeRemaining(remainingMs)
    };
  }

  function handleSleepTimerExpiration() {
    if (!sleepTimerState.active) return;
    const prevMode = sleepTimerState.mode;
    if (sleepTimerTimeout) {
      clearTimeout(sleepTimerTimeout);
      sleepTimerTimeout = null;
    }
    if (sleepTimerInterval) {
      clearInterval(sleepTimerInterval);
      sleepTimerInterval = null;
    }
    sleepTimerState = {
      active: false,
      mode: 'off',
      durationMinutes: 0,
      expiresAt: 0,
      trackIdWhenSet: null
    };
    pause();
    notify('sleepTimerChange', getSleepTimerState());
    notify('sleepTimerExpired', { mode: prevMode });
  }

  function setSleepTimer(option) {
    // 1. Clear any existing timer (Duplicate timer prevention)
    if (sleepTimerTimeout) {
      clearTimeout(sleepTimerTimeout);
      sleepTimerTimeout = null;
    }
    if (sleepTimerInterval) {
      clearInterval(sleepTimerInterval);
      sleepTimerInterval = null;
    }

    // 2. End of Current Track Mode
    if (option === 'end' || option === 'end_of_track') {
      sleepTimerState = {
        active: true,
        mode: 'end_of_track',
        durationMinutes: 0,
        expiresAt: 0,
        trackIdWhenSet: getCurrentTrack()?.id || null
      };
      notify('sleepTimerChange', getSleepTimerState());
      return getSleepTimerState();
    }

    // 3. Duration Timer Mode (minutes: 5 -> 180)
    const mins = Number(option);
    if (!isNaN(mins) && mins > 0) {
      const clampedMins = Math.min(180, Math.max(1, mins));
      const expiresAt = Date.now() + (clampedMins * 60 * 1000);
      sleepTimerState = {
        active: true,
        mode: 'duration',
        durationMinutes: clampedMins,
        expiresAt,
        trackIdWhenSet: getCurrentTrack()?.id || null
      };

      // Set timeout for expiration
      sleepTimerTimeout = setTimeout(() => {
        handleSleepTimerExpiration();
      }, clampedMins * 60 * 1000);

      // Set 1-second ticker for UI countdown updates
      sleepTimerInterval = setInterval(() => {
        if (!sleepTimerState.active || sleepTimerState.mode !== 'duration') {
          clearInterval(sleepTimerInterval);
          sleepTimerInterval = null;
          return;
        }
        if (Date.now() >= sleepTimerState.expiresAt) {
          handleSleepTimerExpiration();
        } else {
          notify('sleepTimerTick', getSleepTimerState());
        }
      }, 1000);

      notify('sleepTimerChange', getSleepTimerState());
      return getSleepTimerState();
    }

    // 4. Cancel / Turn OFF Mode
    sleepTimerState = {
      active: false,
      mode: 'off',
      durationMinutes: 0,
      expiresAt: 0,
      trackIdWhenSet: null
    };
    notify('sleepTimerChange', getSleepTimerState());
    return getSleepTimerState();
  }

  function addSleepTimerMinutes(extraMinutes) {
    if (!sleepTimerState.active || sleepTimerState.mode !== 'duration') {
      return setSleepTimer(extraMinutes || 15);
    }
    const extraMs = (Number(extraMinutes) || 15) * 60 * 1000;
    const newExpiresAt = Math.max(Date.now() + 60000, sleepTimerState.expiresAt + extraMs);
    const addedMins = Number(extraMinutes) || 15;
    
    sleepTimerState.expiresAt = newExpiresAt;
    sleepTimerState.durationMinutes += addedMins;

    if (sleepTimerTimeout) clearTimeout(sleepTimerTimeout);
    const remainingMs = Math.max(0, sleepTimerState.expiresAt - Date.now());
    sleepTimerTimeout = setTimeout(() => {
      handleSleepTimerExpiration();
    }, remainingMs);

    notify('sleepTimerChange', getSleepTimerState());
    return getSleepTimerState();
  }

  async function setAudioSink(sinkId) {
    if (!audio) init();
    if (!audio) return false;
    if (typeof audio.setSinkId === 'function') {
      try {
        await audio.setSinkId(sinkId || '');
        return true;
      } catch (err) {
        console.warn('[Player] setSinkId error:', err);
        return false;
      }
    }
    return false;
  }

  function on(event, callback) {
    if (!eventListeners[event]) {
      eventListeners[event] = [];
    }
    // Prevent duplicate listener attachments
    if (!eventListeners[event].includes(callback)) {
      eventListeners[event].push(callback);
    }
  }

  function off(event, callback) {
    if (!eventListeners[event]) return;
    eventListeners[event] = eventListeners[event].filter(cb => cb !== callback);
  }

  function getState() {
    return {
      playbackState,
      isPlaying: playbackState === PlaybackState.PLAYING,
      currentTrack: getCurrentTrack(),
      currentIndex,
      sourceType: currentSourceType,
      position: audio ? audio.currentTime : 0,
      duration: audio ? (audio.duration || 0) : 0,
      bufferedPosition: getBufferedPosition(),
      isShuffle,
      repeatMode,
      queueLength: queue.length,
      lastError,
      sleepTimer: getSleepTimerState()
    };
  }

  return {
    PlaybackState,
    SourceType,
    ErrorCode,
    init,
    initWebAudio,
    playSong,
    setQueue,
    startRadioQueue,
    appendToQueue,
    playNext,
    removeFromQueue,
    reorderQueue,
    clearQueue,
    togglePlay,
    play,
    pause,
    next,
    previous,
    seek,
    seekPercent,
    setAudioSink,
    getAudioElement: () => audio,
    toggleShuffle,
    toggleRepeat,
    setSleepTimer,
    addSleepTimerMinutes,
    getSleepTimerState,
    formatTimeRemaining,
    setEqEnabled,
    setEqBand,
    setBassBoost,
    setTrebleBoost,
    setVocalBoost,
    setSpatial,
    setVirtualizerStrength,
    setNormalization,
    setCrossfade,
    setEqPreset,
    resetAudioEffects,
    getEqFrequencies: () => (typeof AudioEffectsEngine !== 'undefined' ? AudioEffectsEngine.getFrequencies() : [...EQ_FREQS]),
    getEqPresets: () => (typeof AudioEffectsEngine !== 'undefined' ? Object.keys(AudioEffectsEngine.getPresets()) : Object.keys(EQ_PRESETS)),
    getAudioEffectsSettings: () => (typeof AudioEffectsEngine !== 'undefined' ? AudioEffectsEngine.getSettings() : null),
    getCurrentTrack,
    getCurrentIndex: () => currentIndex,
    getQueue: () => [...queue],
    getIsPlaying: () => playbackState === PlaybackState.PLAYING,
    getIsShuffle: () => isShuffle,
    getRepeatMode: () => repeatMode,
    getDuration: () => (audio ? (audio.duration || getCurrentTrack()?.duration || 0) : (getCurrentTrack()?.duration || 0)),
    getPosition: () => (audio ? audio.currentTime : 0),
    getState,
    resolvePlaybackSource,
    on,
    off
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Player;
}
