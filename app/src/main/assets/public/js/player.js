// ==========================================================================
// MUSICFLOW — AUDIO PLAYBACK ENGINE (PlayerViewModel.kt Replica + Equalizer & 3D Virtualizer)
// ==========================================================================

const Player = (() => {
  let audio = null;
  let queue = [];
  let currentIndex = -1;
  let isPlaying = false;
  let isShuffle = false;
  let repeatMode = 'OFF'; // 'OFF', 'ALL', 'ONE'
  let unShuffledQueue = [];
  let sleepTimerTimeout = null;
  let sleepTimerEnd = 0;

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
    eqChange: []
  };

  function init() {
    audio = document.getElementById('app-audio') || new Audio();
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';

    audio.addEventListener('play', () => {
      isPlaying = true;
      initWebAudio();
      notify('stateChange', { isPlaying: true });
      updateMediaSessionPlaybackState('playing');
    });

    audio.addEventListener('pause', () => {
      isPlaying = false;
      notify('stateChange', { isPlaying: false });
      updateMediaSessionPlaybackState('paused');
    });

    audio.addEventListener('timeupdate', () => {
      notify('timeUpdate', {
        currentTime: audio.currentTime,
        duration: audio.duration || (getCurrentTrack()?.duration) || 0
      });
    });

    audio.addEventListener('ended', () => {
      if (repeatMode === 'ONE') {
        audio.currentTime = 0;
        audio.play().catch(console.warn);
      } else {
        next();
      }
    });

    audio.addEventListener('error', (e) => {
      console.warn('[Player] Audio playback error:', e);
      if (queue.length > 1) {
        setTimeout(next, 1000);
      }
    });

    setupMediaSession();
  }

  function initWebAudio() {
    if (audioCtx || !audio) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      sourceNode = audioCtx.createMediaElementSource(audio);

      // Create Bass Boost Node (80Hz lowshelf)
      bassBoostNode = audioCtx.createBiquadFilter();
      bassBoostNode.type = 'lowshelf';
      bassBoostNode.frequency.value = 80;
      bassBoostNode.gain.value = 0;

      // Create 5-Band Filter Nodes
      eqBands = EQ_FREQS.map((freq, idx) => {
        const filter = audioCtx.createBiquadFilter();
        filter.type = idx === 0 ? 'lowshelf' : (idx === EQ_FREQS.length - 1 ? 'highshelf' : 'peaking');
        filter.frequency.value = freq;
        filter.gain.value = 0;
        filter.Q.value = 1.0;
        return filter;
      });

      // Create 3D Spatial Virtualizer Gain
      virtualizerGain = audioCtx.createGain();
      virtualizerGain.gain.value = 1.0;

      // Chain: Source -> BassBoost -> Band0..4 -> Virtualizer -> Destination
      let prev = sourceNode;
      prev.connect(bassBoostNode);
      prev = bassBoostNode;

      eqBands.forEach(band => {
        prev.connect(band);
        prev = band;
      });

      prev.connect(virtualizerGain);
      virtualizerGain.connect(audioCtx.destination);

      // Restore saved EQ
      const savedEq = Storage.getEqualizer();
      if (savedEq) {
        applyEqualizerSettings(savedEq);
      }
    } catch (e) {
      console.warn('[Player] Web Audio EQ setup error:', e);
    }
  }

  function applyEqualizerSettings(eqData) {
    if (!eqData) return;
    const isEnabled = eqData.enabled === true;

    if (bassBoostNode) {
      bassBoostNode.gain.value = isEnabled ? (eqData.bassBoost || 0) : 0;
    }

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

    notify('eqChange', eqData);
  }

  function setEqEnabled(enabled) {
    const eq = Storage.getEqualizer();
    eq.enabled = enabled;
    Storage.setEqualizer(eq);
    applyEqualizerSettings(eq);
  }

  function setEqBand(index, gainDb) {
    const eq = Storage.getEqualizer();
    eq.bands[index] = gainDb;
    eq.preset = 'Custom';
    Storage.setEqualizer(eq);
    applyEqualizerSettings(eq);
  }

  function setBassBoost(gainDb) {
    const eq = Storage.getEqualizer();
    eq.bassBoost = gainDb;
    Storage.setEqualizer(eq);
    applyEqualizerSettings(eq);
  }

  function setVirtualizerStrength(percent) {
    const eq = Storage.getEqualizer();
    eq.virtualizer = percent;
    Storage.setEqualizer(eq);
    applyEqualizerSettings(eq);
  }

  function setEqPreset(presetName) {
    const presetGains = EQ_PRESETS[presetName];
    if (!presetGains) return;
    const eq = Storage.getEqualizer();
    eq.preset = presetName;
    eq.bands = [...presetGains];
    if (presetName === 'Bass Boost') eq.bassBoost = 8;
    if (presetName === '3D Spatial Concert') eq.virtualizer = 60;
    Storage.setEqualizer(eq);
    applyEqualizerSettings(eq);
  }

  function notify(event, data) {
    (eventListeners[event] || []).forEach(cb => {
      try { cb(data); } catch (e) { console.error(e); }
    });
  }

  function setupMediaSession() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => play());
      navigator.mediaSession.setActionHandler('pause', () => pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => previous());
      navigator.mediaSession.setActionHandler('nexttrack', () => next());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime && audio) audio.currentTime = details.seekTime;
      });
    }
  }

  function updateMediaSession(song) {
    if (!('mediaSession' in navigator) || !song) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.name || 'Unknown Song',
      artist: song.artists || 'MusicFlow',
      album: song.album || 'MusicFlow',
      artwork: [
        { src: song.image, sizes: '96x96', type: 'image/png' },
        { src: song.image, sizes: '128x128', type: 'image/png' },
        { src: song.image, sizes: '256x256', type: 'image/png' },
        { src: song.image, sizes: '512x512', type: 'image/png' }
      ]
    });
  }

  function updateMediaSessionPlaybackState(state) {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = state;
    }
  }

  function getCurrentTrack() {
    return (currentIndex >= 0 && currentIndex < queue.length) ? queue[currentIndex] : null;
  }

  async function resolveStreamUrl(song) {
    if (!song) return '';
    const preferredQuality = Storage.getAudioQuality();

    const directUrl = API.getDownloadUrl(song, preferredQuality);
    if (directUrl && directUrl.startsWith('http')) return directUrl;

    if (song.id) {
      try {
        const details = await API.getSongDetails(song.id);
        if (details && details.length > 0) {
          const resolved = details[0];
          Object.assign(song, resolved);
          return API.getDownloadUrl(resolved, preferredQuality);
        }
      } catch (e) {
        console.error('[Player] Failed to resolve stream:', e);
      }
    }
    return song.audioUrl || song.streamUrl || '';
  }

  async function playTrackAtIndex(index, autoPlay = true) {
    if (index < 0 || index >= queue.length) return;
    currentIndex = index;
    const song = queue[currentIndex];

    notify('trackChange', song);
    updateMediaSession(song);
    Storage.addToHistory(song);

    try {
      const streamUrl = await resolveStreamUrl(song);
      if (!streamUrl) {
        throw new Error('No valid audio stream URL found for track');
      }

      audio.src = streamUrl;
      audio.load();

      if (autoPlay) {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          await playPromise.catch(err => {
            console.warn('[Player] Autoplay prevented:', err.message);
          });
        }
      }

      Storage.saveSession(queue, currentIndex, audio.currentTime);

      // If queue is short (1 or 2 tracks), auto-fetch recommendations in background
      if (queue.length <= 2) {
        autoPopulateContinuousQueue(song);
      }
    } catch (err) {
      console.warn('[Player] play error:', err.message);
    }
  }

  async function autoPopulateContinuousQueue(currentSong) {
    if (!currentSong) return;
    try {
      const query = `${currentSong.primaryArtist || currentSong.artists} Hits`;
      const related = await API.searchSongs(query, 1, 20);
      const newItems = related.filter(s => !queue.some(q => String(q.id) === String(s.id)));
      if (newItems.length > 0) {
        queue.push(...newItems);
        unShuffledQueue.push(...newItems);
        notify('queueChange', queue);
      }
    } catch (_) {}
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
        await playTrackAtIndex(queue.length - 1, true);
        autoPopulateContinuousQueue(song);
      }
    }
  }

  // Smooth Radio Queue: Keeps currently playing song playing seamlessly!
  function startRadioQueue(currentSong, relatedSongs) {
    if (!currentSong) return;
    const cleanRelated = relatedSongs.filter(s => String(s.id) !== String(currentSong.id));
    queue = [currentSong, ...cleanRelated];
    unShuffledQueue = [...queue];
    currentIndex = 0;
    notify('queueChange', queue);
  }

  function setQueue(newQueue, startIndex = 0) {
    queue = Array.isArray(newQueue) ? [...newQueue] : [];
    unShuffledQueue = [...queue];
    currentIndex = Math.max(0, Math.min(startIndex, queue.length - 1));
    notify('queueChange', queue);
    if (queue.length > 0) {
      playTrackAtIndex(currentIndex, true);
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
    }
    notify('queueChange', queue);
  }

  function removeFromQueue(index) {
    if (index < 0 || index >= queue.length) return;
    const removedCurrent = index === currentIndex;
    queue.splice(index, 1);
    if (currentIndex >= queue.length) {
      currentIndex = queue.length - 1;
    }
    notify('queueChange', queue);
    if (removedCurrent && queue.length > 0) {
      playTrackAtIndex(currentIndex, true);
    } else if (queue.length === 0) {
      pause();
      currentIndex = -1;
    }
  }

  function clearQueue() {
    const current = getCurrentTrack();
    queue = current ? [current] : [];
    currentIndex = current ? 0 : -1;
    notify('queueChange', queue);
  }

  function togglePlay() {
    if (!audio) return;
    if (audio.paused) {
      if (!audio.src && queue.length > 0) {
        playTrackAtIndex(currentIndex >= 0 ? currentIndex : 0, true);
      } else {
        audio.play().catch(console.warn);
      }
    } else {
      audio.pause();
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
    if (currentIndex + 1 < queue.length) {
      playTrackAtIndex(currentIndex + 1, true);
    } else if (repeatMode === 'ALL') {
      playTrackAtIndex(0, true);
    } else {
      // Auto continuous playback: fetch related tracks and continue!
      const current = getCurrentTrack();
      if (current) {
        try {
          const query = `${current.primaryArtist || current.artists} Hits`;
          const related = await API.searchSongs(query, 1, 20);
          const newItems = related.filter(s => !queue.some(q => String(q.id) === String(s.id)));
          if (newItems.length > 0) {
            queue.push(...newItems);
            unShuffledQueue.push(...newItems);
            notify('queueChange', queue);
            playTrackAtIndex(currentIndex + 1, true);
            return;
          }
        } catch (_) {}
      }
      playTrackAtIndex(0, true);
    }
  }

  function previous() {
    if (queue.length === 0) return;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    if (currentIndex - 1 >= 0) {
      playTrackAtIndex(currentIndex - 1, true);
    } else {
      playTrackAtIndex(queue.length - 1, true);
    }
  }

  function seek(percent) {
    if (!audio || !audio.duration) return;
    audio.currentTime = (percent / 100) * audio.duration;
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

    notify('queueChange', queue);
    return isShuffle;
  }

  function toggleRepeat() {
    if (repeatMode === 'OFF') repeatMode = 'ALL';
    else if (repeatMode === 'ALL') repeatMode = 'ONE';
    else repeatMode = 'OFF';
    return repeatMode;
  }

  function setSleepTimer(minutes) {
    if (sleepTimerTimeout) {
      clearTimeout(sleepTimerTimeout);
      sleepTimerTimeout = null;
      sleepTimerEnd = 0;
    }

    if (minutes > 0) {
      sleepTimerEnd = Date.now() + minutes * 60 * 1000;
      sleepTimerTimeout = setTimeout(() => {
        pause();
        sleepTimerTimeout = null;
        sleepTimerEnd = 0;
      }, minutes * 60 * 1000);
    }
  }

  function on(event, callback) {
    if (eventListeners[event]) {
      eventListeners[event].push(callback);
    }
  }

  return {
    init,
    playSong,
    setQueue,
    startRadioQueue,
    appendToQueue,
    playNext,
    removeFromQueue,
    clearQueue,
    togglePlay,
    play,
    pause,
    next,
    previous,
    seek,
    toggleShuffle,
    toggleRepeat,
    setSleepTimer,
    setEqEnabled,
    setEqBand,
    setBassBoost,
    setVirtualizerStrength,
    setEqPreset,
    getEqFrequencies: () => [...EQ_FREQS],
    getEqPresets: () => Object.keys(EQ_PRESETS),
    getCurrentTrack,
    getQueue: () => [...queue],
    getIsPlaying: () => isPlaying,
    getIsShuffle: () => isShuffle,
    getRepeatMode: () => repeatMode,
    on
  };
})();
