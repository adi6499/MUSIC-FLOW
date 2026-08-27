// ==========================================================================
// TEST SUITE: Professional Audio Effects Engine (30 Verification Tests)
// Real 7-Band Equalizer, 3D Spatial Audio, Bass/Treble/Vocal, Limiter, Presets
// ==========================================================================

const assert = require('assert');

// Mock Web Audio Nodes & AudioContext
class MockAudioNode {
  constructor(name) {
    this.name = name;
    this.connectedTo = [];
    this.gain = { value: 1.0, setTargetAtTime: (val) => { this.gain.value = val; } };
    this.frequency = { value: 1000, setTargetAtTime: (val) => { this.frequency.value = val; } };
    this.Q = { value: 1.0, setTargetAtTime: (val) => { this.Q.value = val; } };
    this.threshold = { value: -0.5 };
    this.knee = { value: 0 };
    this.ratio = { value: 20 };
    this.attack = { value: 0.003 };
    this.release = { value: 0.1 };
  }

  connect(targetNode, outputIndex = 0, inputIndex = 0) {
    this.connectedTo.push({ targetNode, outputIndex, inputIndex });
    return targetNode;
  }
}

class MockAudioContext {
  constructor() {
    this.state = 'running';
    this.currentTime = 0;
    this.destination = new MockAudioNode('destination');
  }

  createMediaElementSource(element) {
    return new MockAudioNode('mediaElementSource');
  }

  createGain() {
    return new MockAudioNode('gain');
  }

  createBiquadFilter() {
    return new MockAudioNode('biquadFilter');
  }

  createChannelSplitter(channels) {
    return new MockAudioNode('channelSplitter');
  }

  createChannelMerger(channels) {
    return new MockAudioNode('channelMerger');
  }

  createDynamicsCompressor() {
    return new MockAudioNode('dynamicsCompressor');
  }

  async resume() {
    this.state = 'running';
  }
}

// Set global mocks
global.window = {
  AudioContext: MockAudioContext,
  webkitAudioContext: MockAudioContext
};

global.localStorage = {
  store: {},
  getItem: (key) => global.localStorage.store[key] || null,
  setItem: (key, val) => { global.localStorage.store[key] = String(val); },
  removeItem: (key) => { delete global.localStorage.store[key]; },
  clear: () => { global.localStorage.store = {}; }
};

const Storage = require('./js/storage.js');
global.Storage = Storage;

const AudioEffectsEngine = require('./js/audioEffectsEngine.js');
global.AudioEffectsEngine = AudioEffectsEngine;

const Player = require('./js/player.js');

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function runTests() {
  console.log('=== PROFESSIONAL AUDIO EFFECTS ENGINE TESTS ===\n');

  // Initialize
  const mockAudioEl = { addEventListener: () => {} };
  AudioEffectsEngine.init(mockAudioEl);

  it('1. AudioEffectsEngine initializes single DSP chain successfully', () => {
    assert.strictEqual(AudioEffectsEngine.isEnabled(), true);
    assert.ok(AudioEffectsEngine.getAudioContext() !== null);
  });

  it('2. Standard 7-band frequencies match audio engineering standards', () => {
    const freqs = AudioEffectsEngine.getFrequencies();
    assert.deepStrictEqual(freqs, [60, 150, 400, 1000, 2400, 6000, 15000]);
  });

  it('3. Default preset is "Flat" with zero gains across all 7 bands', () => {
    AudioEffectsEngine.setPreset('Flat');
    const s = AudioEffectsEngine.getSettings();
    assert.strictEqual(s.preset, 'Flat');
    assert.deepStrictEqual(s.bands, [0, 0, 0, 0, 0, 0, 0]);
    assert.strictEqual(s.bassBoost, 0);
    assert.strictEqual(s.trebleBoost, 0);
    assert.strictEqual(s.vocalBoost, 0);
    assert.strictEqual(s.spatial, 'OFF');
  });

  it('4. Bass Boost preset correctly sets low frequencies and bass boost gain', () => {
    AudioEffectsEngine.setPreset('Bass Boost');
    const s = AudioEffectsEngine.getSettings();
    assert.strictEqual(s.preset, 'Bass Boost');
    assert.strictEqual(s.bassBoost, 8);
    assert.strictEqual(s.bands[0], 6); // 60Hz
  });

  it('5. Treble Boost preset amplifies high-frequency bands (2.4kHz, 6kHz, 15kHz)', () => {
    AudioEffectsEngine.setPreset('Treble');
    const s = AudioEffectsEngine.getSettings();
    assert.strictEqual(s.preset, 'Treble');
    assert.strictEqual(s.trebleBoost, 8);
    assert.strictEqual(s.bands[6], 8); // 15kHz
  });

  it('6. Vocal Boost preset lifts 1kHz - 2.4kHz presence frequencies', () => {
    AudioEffectsEngine.setPreset('Vocal');
    const s = AudioEffectsEngine.getSettings();
    assert.strictEqual(s.preset, 'Vocal');
    assert.strictEqual(s.vocalBoost, 6);
    assert.strictEqual(s.bands[3], 5); // 1kHz
    assert.strictEqual(s.bands[4], 5); // 2.4kHz
  });

  it('7. Individual band gain update clamps values between -12 dB and +12 dB', () => {
    AudioEffectsEngine.setBandGain(0, 18); // clamp to 12
    assert.strictEqual(AudioEffectsEngine.getSettings().bands[0], 12);
    AudioEffectsEngine.setBandGain(0, -20); // clamp to -12
    assert.strictEqual(AudioEffectsEngine.getSettings().bands[0], -12);
  });

  it('8. Modifying any individual band switches preset to "Custom"', () => {
    AudioEffectsEngine.setPreset('Rock');
    AudioEffectsEngine.setBandGain(2, 4);
    assert.strictEqual(AudioEffectsEngine.getSettings().preset, 'Custom');
  });

  it('9. Studio Bass Boost updates 80Hz gain safely between 0 dB and 12 dB', () => {
    AudioEffectsEngine.setBassBoost(10);
    assert.strictEqual(AudioEffectsEngine.getSettings().bassBoost, 10);
    AudioEffectsEngine.setBassBoost(20); // clamp to 12
    assert.strictEqual(AudioEffectsEngine.getSettings().bassBoost, 12);
  });

  it('10. Crisp Treble boost updates 10kHz gain safely', () => {
    AudioEffectsEngine.setTrebleBoost(6);
    assert.strictEqual(AudioEffectsEngine.getSettings().trebleBoost, 6);
  });

  it('11. Vocal clarity enhancement updates 2.8kHz peaking filter gain', () => {
    AudioEffectsEngine.setVocalBoost(5);
    assert.strictEqual(AudioEffectsEngine.getSettings().vocalBoost, 5);
  });

  it('12. 3D Spatial Audio supports OFF, LOW, MEDIUM, HIGH levels', () => {
    AudioEffectsEngine.setSpatial('LOW');
    assert.strictEqual(AudioEffectsEngine.getSettings().spatial, 'LOW');
    AudioEffectsEngine.setSpatial('HIGH');
    assert.strictEqual(AudioEffectsEngine.getSettings().spatial, 'HIGH');
    AudioEffectsEngine.setSpatial('OFF');
    assert.strictEqual(AudioEffectsEngine.getSettings().spatial, 'OFF');
  });

  it('13. 3D Spatial Audio ignores invalid levels', () => {
    AudioEffectsEngine.setSpatial('OFF');
    AudioEffectsEngine.setSpatial('SUPER_ULTRA_MAX');
    assert.strictEqual(AudioEffectsEngine.getSettings().spatial, 'OFF');
  });

  it('14. Loudness Normalization toggle updates correctly', () => {
    AudioEffectsEngine.setNormalization(false);
    assert.strictEqual(AudioEffectsEngine.getSettings().normalization, false);
    AudioEffectsEngine.setNormalization(true);
    assert.strictEqual(AudioEffectsEngine.getSettings().normalization, true);
  });

  it('15. Crossfade duration setting clamps between 0s and 10s', () => {
    AudioEffectsEngine.setCrossfade(6);
    assert.strictEqual(AudioEffectsEngine.getSettings().crossfade, 6);
    AudioEffectsEngine.setCrossfade(25); // clamped to 10
    assert.strictEqual(AudioEffectsEngine.getSettings().crossfade, 10);
  });

  it('16. Master bypass toggle cleanly disables and re-enables all audio effects', () => {
    AudioEffectsEngine.setEnabled(false);
    assert.strictEqual(AudioEffectsEngine.isEnabled(), false);
    AudioEffectsEngine.setEnabled(true);
    assert.strictEqual(AudioEffectsEngine.isEnabled(), true);
  });

  it('17. User can create, save, retrieve, and delete custom audio presets', () => {
    AudioEffectsEngine.setBandGain(0, 7);
    AudioEffectsEngine.setBandGain(1, 4);
    AudioEffectsEngine.setBassBoost(6);
    AudioEffectsEngine.setSpatial('MEDIUM');

    const saved = AudioEffectsEngine.saveCustomPreset('My Late Night Preset');
    assert.strictEqual(saved, true);
    assert.strictEqual(AudioEffectsEngine.getSettings().preset, 'My Late Night Preset');

    const userPresets = Storage.getUserPresets();
    assert.ok(userPresets['My Late Night Preset']);
    assert.strictEqual(userPresets['My Late Night Preset'].bassBoost, 6);
    assert.strictEqual(userPresets['My Late Night Preset'].spatial, 'MEDIUM');

    // Delete custom preset
    AudioEffectsEngine.deleteCustomPreset('My Late Night Preset');
    const updatedPresets = Storage.getUserPresets();
    assert.strictEqual(updatedPresets['My Late Night Preset'], undefined);
  });

  it('18. Reset Defaults restores all 7 bands, boosts, and spatial to initial Flat state', () => {
    AudioEffectsEngine.setBassBoost(12);
    AudioEffectsEngine.setSpatial('HIGH');
    AudioEffectsEngine.resetDefaults();

    const s = AudioEffectsEngine.getSettings();
    assert.strictEqual(s.preset, 'Flat');
    assert.deepStrictEqual(s.bands, [0, 0, 0, 0, 0, 0, 0]);
    assert.strictEqual(s.bassBoost, 0);
    assert.strictEqual(s.spatial, 'OFF');
  });

  it('19. Curated genre presets include Rock, Pop, Hip-Hop, Classical, Jazz, Electronic, Bollywood, Lo-Fi, Acoustic', () => {
    const presets = AudioEffectsEngine.getPresets();
    const required = ['Rock', 'Pop', 'Hip-Hop', 'Classical', 'Jazz', 'Electronic', 'Bollywood', 'Lo-Fi', 'Acoustic'];
    required.forEach(p => {
      assert.ok(presets[p], `Preset ${p} must exist in presets bank`);
      assert.strictEqual(presets[p].bands.length, 7);
    });
  });

  it('20. Storage persists audio effects and loads on startup', () => {
    Storage.setAudioEffects({
      enabled: true,
      preset: 'Bollywood',
      bands: [3, 2, 4, 5, 4, 2, 3],
      bassBoost: 3,
      spatial: 'MEDIUM'
    });
    const loaded = Storage.getAudioEffects();
    assert.strictEqual(loaded.preset, 'Bollywood');
    assert.strictEqual(loaded.bands[3], 5);
  });

  it('21. Backward compatibility: Storage.getEqualizerSettings maps to 7 bands', () => {
    const eq = Storage.getEqualizerSettings();
    assert.ok(eq.bands !== undefined);
    assert.ok(eq.bassBoost !== undefined);
  });

  it('22. Player.setEqBand routes to AudioEffectsEngine smoothly', () => {
    Player.setEqBand(4, 5);
    const s = AudioEffectsEngine.getSettings();
    assert.strictEqual(s.bands[4], 5);
  });

  it('23. Player.setBassBoost routes to AudioEffectsEngine', () => {
    Player.setBassBoost(7);
    assert.strictEqual(AudioEffectsEngine.getSettings().bassBoost, 7);
  });

  it('24. Player.setTrebleBoost routes to AudioEffectsEngine', () => {
    Player.setTrebleBoost(5);
    assert.strictEqual(AudioEffectsEngine.getSettings().trebleBoost, 5);
  });

  it('25. Player.setVocalBoost routes to AudioEffectsEngine', () => {
    Player.setVocalBoost(4);
    assert.strictEqual(AudioEffectsEngine.getSettings().vocalBoost, 4);
  });

  it('26. Player.setSpatial routes to AudioEffectsEngine', () => {
    Player.setSpatial('HIGH');
    assert.strictEqual(AudioEffectsEngine.getSettings().spatial, 'HIGH');
  });

  it('27. Player.setVirtualizerStrength backward compatibility routes to correct Spatial level', () => {
    Player.setVirtualizerStrength(80);
    assert.strictEqual(AudioEffectsEngine.getSettings().spatial, 'HIGH');
    Player.setVirtualizerStrength(0);
    assert.strictEqual(AudioEffectsEngine.getSettings().spatial, 'OFF');
  });

  it('28. Player.setNormalization and Player.setCrossfade route to AudioEffectsEngine and Storage', () => {
    Player.setNormalization(true);
    Player.setCrossfade(4);
    assert.strictEqual(AudioEffectsEngine.getSettings().normalization, true);
    assert.strictEqual(AudioEffectsEngine.getSettings().crossfade, 4);
  });

  it('29. Player.setEqPreset activates genre presets', () => {
    Player.setEqPreset('Jazz');
    assert.strictEqual(AudioEffectsEngine.getSettings().preset, 'Jazz');
  });

  it('30. Player.resetAudioEffects resets all parameters cleanly', () => {
    Player.resetAudioEffects();
    const s = AudioEffectsEngine.getSettings();
    assert.strictEqual(s.preset, 'Flat');
    assert.strictEqual(s.bassBoost, 0);
    assert.strictEqual(s.trebleBoost, 0);
    assert.strictEqual(s.vocalBoost, 0);
    assert.strictEqual(s.spatial, 'OFF');
  });

  console.log(`\nResults: ${passed} Passed, ${failed} Failed\n`);
  if (failed > 0) process.exit(1);
}

runTests();
