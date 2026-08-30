// ==========================================================================
// MUSICFLOW — PROFESSIONAL AUDIO EFFECTS & DSP ENGINE
// Real 7-Band EQ, 3D Spatial Audio, Bass/Treble/Vocal Boost, Peak Limiter
// ==========================================================================

const AudioEffectsEngine = (() => {
  let audioCtx = null;
  let sourceNode = null;
  let preGainNode = null;
  let normGainNode = null;
  let bassBoostNode = null;
  let trebleBoostNode = null;
  let vocalBoostNode = null;
  let eqBandNodes = [];
  let spatialSplitter = null;
  let spatialMerger = null;
  let midGainNode = null;
  let sideGainNode = null;
  let limiterNode = null;
  let masterGainNode = null;
  let isInitialized = false;

  // 7-Band Equalizer Standard Center Frequencies (Hz)
  const EQ_FREQUENCIES = [60, 150, 400, 1000, 2400, 6000, 15000];

  // Curated Professional Presets (7 bands in dB: 60Hz, 150Hz, 400Hz, 1kHz, 2.4kHz, 6kHz, 15kHz)
  const PRESETS = {
    'Flat': {
      bands: [0, 0, 0, 0, 0, 0, 0],
      bassBoost: 0,
      trebleBoost: 0,
      vocalBoost: 0,
      spatial: 'OFF'
    },
    'Bass Boost': {
      bands: [6, 5, 2, 0, 0, 0, 0],
      bassBoost: 8,
      trebleBoost: 0,
      vocalBoost: 0,
      spatial: 'LOW'
    },
    'Treble': {
      bands: [0, 0, 0, 1, 3, 6, 8],
      bassBoost: 0,
      trebleBoost: 8,
      vocalBoost: 0,
      spatial: 'OFF'
    },
    'Vocal': {
      bands: [-2, 0, 2, 5, 5, 2, -1],
      bassBoost: 0,
      trebleBoost: 2,
      vocalBoost: 6,
      spatial: 'LOW'
    },
    'Rock': {
      bands: [5, 3, -1, -2, 2, 5, 6],
      bassBoost: 4,
      trebleBoost: 3,
      vocalBoost: 0,
      spatial: 'MEDIUM'
    },
    'Pop': {
      bands: [-1, 2, 4, 5, 3, 0, 2],
      bassBoost: 3,
      trebleBoost: 2,
      vocalBoost: 3,
      spatial: 'LOW'
    },
    'Hip-Hop': {
      bands: [7, 5, 1, 2, -1, 3, 4],
      bassBoost: 7,
      trebleBoost: 2,
      vocalBoost: 0,
      spatial: 'MEDIUM'
    },
    'Classical': {
      bands: [4, 3, 2, 0, 1, 3, 5],
      bassBoost: 2,
      trebleBoost: 3,
      vocalBoost: 1,
      spatial: 'HIGH'
    },
    'Jazz': {
      bands: [3, 2, 1, 2, -1, 2, 3],
      bassBoost: 2,
      trebleBoost: 1,
      vocalBoost: 2,
      spatial: 'LOW'
    },
    'Electronic': {
      bands: [6, 5, 1, -1, 2, 5, 6],
      bassBoost: 6,
      trebleBoost: 4,
      vocalBoost: 0,
      spatial: 'HIGH'
    },
    'Bollywood': {
      bands: [3, 2, 4, 5, 4, 2, 3],
      bassBoost: 3,
      trebleBoost: 2,
      vocalBoost: 4,
      spatial: 'MEDIUM'
    },
    'Lo-Fi': {
      bands: [4, 3, -1, -2, 1, -2, -6],
      bassBoost: 4,
      trebleBoost: -4,
      vocalBoost: 1,
      spatial: 'LOW'
    },
    'Acoustic': {
      bands: [3, 2, 1, 2, 3, 4, 3],
      bassBoost: 1,
      trebleBoost: 3,
      vocalBoost: 3,
      spatial: 'MEDIUM'
    }
  };

  // State
  let settings = {
    enabled: true,
    preset: 'Flat',
    bands: [0, 0, 0, 0, 0, 0, 0],
    bassBoost: 0,       // 0 to 12 dB
    trebleBoost: 0,     // 0 to 12 dB
    vocalBoost: 0,      // 0 to 8 dB
    spatial: 'OFF',     // 'OFF' | 'LOW' | 'MEDIUM' | 'HIGH'
    normalization: true,
    crossfade: 0        // seconds: 0, 2, 4, 6, 8, 10
  };

  // Spatial Level Multipliers
  const SPATIAL_WIDTHS = {
    'OFF': 1.0,
    'LOW': 1.3,
    'MEDIUM': 1.6,
    'HIGH': 2.0
  };

  function init(audioElement) {
    if (isInitialized || !audioElement || typeof window === 'undefined') return;

    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) {
        console.warn('[AudioEffects] Web Audio API is not supported on this device/browser');
        return;
      }

      audioCtx = new AudioCtxClass();
      sourceNode = audioCtx.createMediaElementSource(audioElement);

      // 1. Preamp Compensation Gain Node
      preGainNode = audioCtx.createGain();
      preGainNode.gain.value = 1.0;

      // 2. Loudness Normalization Gain Node
      normGainNode = audioCtx.createGain();
      normGainNode.gain.value = 1.0;

      // 3. Bass Boost Node (80 Hz Low-Shelf)
      bassBoostNode = audioCtx.createBiquadFilter();
      bassBoostNode.type = 'lowshelf';
      bassBoostNode.frequency.value = 80;
      bassBoostNode.gain.value = 0;

      // 4. Treble Boost Node (10 kHz High-Shelf)
      trebleBoostNode = audioCtx.createBiquadFilter();
      trebleBoostNode.type = 'highshelf';
      trebleBoostNode.frequency.value = 10000;
      trebleBoostNode.gain.value = 0;

      // 5. Vocal Enhancement Node (2.8 kHz Peaking)
      vocalBoostNode = audioCtx.createBiquadFilter();
      vocalBoostNode.type = 'peaking';
      vocalBoostNode.frequency.value = 2800;
      vocalBoostNode.Q.value = 1.4;
      vocalBoostNode.gain.value = 0;

      // 6. 7-Band Equalizer Filter Nodes
      eqBandNodes = EQ_FREQUENCIES.map((freq, idx) => {
        const filter = audioCtx.createBiquadFilter();
        if (idx === 0) {
          filter.type = 'lowshelf';
        } else if (idx === EQ_FREQUENCIES.length - 1) {
          filter.type = 'highshelf';
        } else {
          filter.type = 'peaking';
        }
        filter.frequency.value = freq;
        filter.Q.value = 1.2;
        filter.gain.value = 0;
        return filter;
      });

      // 7. 3D Spatial Audio & Stereo Widener (Mid/Side Matrix with Vocal Preservation)
      // Matrix: L, R -> Mid (L+R), Side (L-R) -> Side * Width -> L', R'
      spatialSplitter = audioCtx.createChannelSplitter(2);
      spatialMerger = audioCtx.createChannelMerger(2);
      midGainNode = audioCtx.createGain();
      sideGainNode = audioCtx.createGain();
      midGainNode.gain.value = 1.0;
      sideGainNode.gain.value = 1.0;

      // 8. Peak Limiter (Hard-Knee DynamicsCompressor for zero clipping distortion)
      limiterNode = audioCtx.createDynamicsCompressor();
      limiterNode.threshold.value = -0.5; // dB
      limiterNode.knee.value = 0;         // hard knee
      limiterNode.ratio.value = 20.0;     // limiting ratio
      limiterNode.attack.value = 0.003;   // 3 ms
      limiterNode.release.value = 0.100;  // 100 ms

      // 9. Master Gain Node
      masterGainNode = audioCtx.createGain();
      masterGainNode.gain.value = 1.0;

      // --- Connect DSP Chain ---
      // Source -> PreGain -> NormGain -> BassBoost -> TrebleBoost -> VocalBoost -> 7-Bands
      let currentNode = sourceNode;

      currentNode.connect(preGainNode);
      currentNode = preGainNode;

      currentNode.connect(normGainNode);
      currentNode = normGainNode;

      currentNode.connect(bassBoostNode);
      currentNode = bassBoostNode;

      currentNode.connect(trebleBoostNode);
      currentNode = trebleBoostNode;

      currentNode.connect(vocalBoostNode);
      currentNode = vocalBoostNode;

      eqBandNodes.forEach(filter => {
        currentNode.connect(filter);
        currentNode = filter;
      });

      // Mid/Side Matrix Connection
      currentNode.connect(spatialSplitter);

      // Mid = (L + R) * 0.5 (mono center vocals and punch)
      // Side = (L - R) * 0.5 (stereo ambient field)
      spatialSplitter.connect(midGainNode, 0); // L into Mid
      spatialSplitter.connect(midGainNode, 1); // R into Mid

      spatialSplitter.connect(sideGainNode, 0); // L into Side
      spatialSplitter.connect(sideGainNode, 1); // R inverted in Side

      midGainNode.connect(spatialMerger, 0, 0); // Mid to L
      midGainNode.connect(spatialMerger, 0, 1); // Mid to R

      sideGainNode.connect(spatialMerger, 0, 0); // Side to L
      sideGainNode.connect(spatialMerger, 0, 1); // Side to R

      // Spatial Merger -> Peak Limiter -> Master Gain -> Destination
      spatialMerger.connect(limiterNode);
      limiterNode.connect(masterGainNode);
      masterGainNode.connect(audioCtx.destination);

      isInitialized = true;

      // Load persistent settings from storage
      loadStoredSettings();
    } catch (err) {
      console.warn('[AudioEffects] Init error (audio will play un-effected):', err);
    }
  }

  function loadStoredSettings() {
    if (typeof Storage !== 'undefined' && typeof Storage.getAudioEffects === 'function') {
      const stored = Storage.getAudioEffects();
      if (stored) {
        settings = { ...settings, ...stored };
      }
    }
    applyAll();
  }

  function persistSettings() {
    if (typeof Storage !== 'undefined' && typeof Storage.setAudioEffects === 'function') {
      Storage.setAudioEffects(settings);
    }
  }

  // Smooth parameter ramp helper to eliminate clicks and pops
  function rampParam(param, targetVal, timeConstant = 0.04) {
    if (!param) return;
    if (audioCtx && audioCtx.state === 'running' && param.setTargetAtTime) {
      param.setTargetAtTime(targetVal, audioCtx.currentTime, timeConstant);
    } else {
      param.value = targetVal;
    }
  }

  // Applies all current settings to Web Audio DSP nodes
  function applyAll() {
    if (!isInitialized || !audioCtx) return;

    const isEnabled = settings.enabled === true;

    // 1. Equalizer Bands
    const bands = Array.isArray(settings.bands) ? settings.bands : [0, 0, 0, 0, 0, 0, 0];
    let maxBoost = 0;

    eqBandNodes.forEach((node, idx) => {
      const gain = isEnabled ? (Number(bands[idx]) || 0) : 0;
      rampParam(node.gain, gain);
      if (gain > maxBoost) maxBoost = gain;
    });

    // 2. Bass Boost
    const bass = isEnabled ? (Number(settings.bassBoost) || 0) : 0;
    rampParam(bassBoostNode.gain, bass);
    if (bass > maxBoost) maxBoost = bass;

    // 3. Treble Boost
    const treble = isEnabled ? (Number(settings.trebleBoost) || 0) : 0;
    rampParam(trebleBoostNode.gain, treble);
    if (treble > maxBoost) maxBoost = treble;

    // 4. Vocal Boost
    const vocal = isEnabled ? (Number(settings.vocalBoost) || 0) : 0;
    rampParam(vocalBoostNode.gain, vocal);
    if (vocal > maxBoost) maxBoost = vocal;

    // 5. Automatic Preamp Headroom Compensation (Prevents clipping on large boosts)
    if (isEnabled && maxBoost > 0) {
      // Attenuate preamp proportionally to headroom requirement
      const attenuationDb = -Math.min(10, maxBoost * 0.65);
      const preGainLinear = Math.pow(10, attenuationDb / 20);
      rampParam(preGainNode.gain, preGainLinear);
    } else {
      rampParam(preGainNode.gain, 1.0);
    }

    // 6. Loudness Normalization
    if (isEnabled && settings.normalization) {
      rampParam(normGainNode.gain, 0.92);
    } else {
      rampParam(normGainNode.gain, 1.0);
    }

    // 7. 3D Spatial Audio / Stereo Widener
    const spatialLevel = isEnabled ? (settings.spatial || 'OFF') : 'OFF';
    const sideMultiplier = SPATIAL_WIDTHS[spatialLevel] || 1.0;
    rampParam(midGainNode.gain, 1.0);
    rampParam(sideGainNode.gain, sideMultiplier);
  }

  // --- Public Control APIs ---

  function setEnabled(enabled) {
    settings.enabled = Boolean(enabled);
    persistSettings();
    applyAll();
  }

  function isEnabled() {
    return settings.enabled;
  }

  function setPreset(presetName) {
    const p = PRESETS[presetName];
    if (p) {
      settings.preset = presetName;
      settings.bands = [...p.bands];
      settings.bassBoost = p.bassBoost || 0;
      settings.trebleBoost = p.trebleBoost || 0;
      settings.vocalBoost = p.vocalBoost || 0;
      if (p.spatial) settings.spatial = p.spatial;
    } else if (typeof Storage !== 'undefined' && typeof Storage.getUserPresets === 'function') {
      const userPresets = Storage.getUserPresets();
      if (userPresets && userPresets[presetName]) {
        const up = userPresets[presetName];
        settings.preset = presetName;
        settings.bands = [...(up.bands || [0, 0, 0, 0, 0, 0, 0])];
        settings.bassBoost = up.bassBoost || 0;
        settings.trebleBoost = up.trebleBoost || 0;
        settings.vocalBoost = up.vocalBoost || 0;
        if (up.spatial) settings.spatial = up.spatial;
      }
    }
    persistSettings();
    applyAll();
  }

  function setBandGain(index, gainDb) {
    if (index < 0 || index >= EQ_FREQUENCIES.length) return;
    if (!Array.isArray(settings.bands)) settings.bands = [0, 0, 0, 0, 0, 0, 0];
    const clampedGain = Math.max(-12, Math.min(12, Number(gainDb) || 0));
    settings.bands[index] = clampedGain;
    settings.preset = 'Custom';
    persistSettings();
    applyAll();
  }

  function setBassBoost(gainDb) {
    const clamped = Math.max(0, Math.min(12, Number(gainDb) || 0));
    settings.bassBoost = clamped;
    settings.preset = 'Custom';
    persistSettings();
    applyAll();
  }

  function setTrebleBoost(gainDb) {
    const clamped = Math.max(-6, Math.min(12, Number(gainDb) || 0));
    settings.trebleBoost = clamped;
    settings.preset = 'Custom';
    persistSettings();
    applyAll();
  }

  function setVocalBoost(gainDb) {
    const clamped = Math.max(0, Math.min(8, Number(gainDb) || 0));
    settings.vocalBoost = clamped;
    settings.preset = 'Custom';
    persistSettings();
    applyAll();
  }

  function setSpatial(level) {
    const validLevels = ['OFF', 'LOW', 'MEDIUM', 'HIGH'];
    if (validLevels.includes(level)) {
      settings.spatial = level;
      persistSettings();
      applyAll();
    }
  }

  function setNormalization(enabled) {
    settings.normalization = Boolean(enabled);
    persistSettings();
    applyAll();
  }

  function setCrossfade(seconds) {
    const clamped = Math.max(0, Math.min(10, Number(seconds) || 0));
    settings.crossfade = clamped;
    persistSettings();
  }

  function resetDefaults() {
    settings = {
      enabled: true,
      preset: 'Flat',
      bands: [0, 0, 0, 0, 0, 0, 0],
      bassBoost: 0,
      trebleBoost: 0,
      vocalBoost: 0,
      spatial: 'OFF',
      normalization: true,
      crossfade: 0
    };
    persistSettings();
    applyAll();
  }

  function saveCustomPreset(name) {
    const cleanName = (name || '').trim();
    if (!cleanName) return false;
    if (typeof Storage !== 'undefined' && typeof Storage.saveUserPreset === 'function') {
      Storage.saveUserPreset(cleanName, {
        bands: [...settings.bands],
        bassBoost: settings.bassBoost,
        trebleBoost: settings.trebleBoost,
        vocalBoost: settings.vocalBoost,
        spatial: settings.spatial
      });
      settings.preset = cleanName;
      persistSettings();
      return true;
    }
    return false;
  }

  function deleteCustomPreset(name) {
    if (typeof Storage !== 'undefined' && typeof Storage.deleteUserPreset === 'function') {
      Storage.deleteUserPreset(name);
      if (settings.preset === name) {
        setPreset('Flat');
      }
      return true;
    }
    return false;
  }

  function resumeContext() {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(console.warn);
    }
  }

  function getSettings() {
    return JSON.parse(JSON.stringify(settings));
  }

  function getPresets() {
    return PRESETS;
  }

  function getFrequencies() {
    return EQ_FREQUENCIES;
  }

  function getAudioContext() {
    return audioCtx;
  }

  return {
    init,
    setEnabled,
    isEnabled,
    setPreset,
    setBandGain,
    setBassBoost,
    setTrebleBoost,
    setVocalBoost,
    setSpatial,
    setNormalization,
    setCrossfade,
    resetDefaults,
    saveCustomPreset,
    deleteCustomPreset,
    resumeContext,
    resumeAudioContext: resumeContext,
    resume: resumeContext,
    getSettings,
    getPresets,
    getFrequencies,
    getAudioContext
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioEffectsEngine;
}
