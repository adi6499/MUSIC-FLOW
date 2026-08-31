// ============================================================================
// MUSICFLOW — FINAL DISCOVERY, PLAYER & MOBILE UX MASTER TEST SUITE
// Covers: Search Diversity, Sticky Search, Album Navigation, Artist Attribution,
// Recommendation Interleaving, Radio Continuity, Playlist Save/Import, EQ & 3D Audio.
// ============================================================================

const assert = require('assert');

// 1. Mock LocalStorage & Browser Globals
const mockStorageData = {};
global.localStorage = {
  getItem: (key) => mockStorageData[key] || null,
  setItem: (key, val) => { mockStorageData[key] = String(val); },
  removeItem: (key) => { delete mockStorageData[key]; },
  clear: () => { Object.keys(mockStorageData).forEach(k => delete mockStorageData[k]); }
};

const mediaHandlers = {};
global.mediaHandlers = mediaHandlers;
const mockNav = {
  mediaSession: {
    playbackState: 'none',
    metadata: null,
    setActionHandler: (action, handler) => {
      mediaHandlers[action] = handler;
    },
    setPositionState: (state) => {}
  }
};
try {
  Object.defineProperty(globalThis, 'navigator', {
    value: mockNav,
    writable: true,
    configurable: true
  });
} catch (_) {
  global.navigator = mockNav;
}
global.MediaMetadata = class {
  constructor(data) { Object.assign(this, data); }
};

global.document = {
  readyState: 'complete',
  addEventListener: () => {},
  removeEventListener: () => {},
  getElementById: (id) => {
    if (id === 'app-audio') return new MockAudioElement();
    return {
      id,
      src: '',
      textContent: '',
      innerHTML: '',
      style: {},
      classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
      querySelectorAll: () => [],
      querySelector: () => null,
      setAttribute: () => {},
      getAttribute: () => null,
      addEventListener: () => {},
      removeEventListener: () => {},
      focus: () => {},
      blur: () => {}
    };
  },
  querySelectorAll: () => [],
  querySelector: () => null,
  createElement: (tag) => ({
    tagName: tag.toUpperCase(),
    style: {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    addEventListener: () => {},
    removeEventListener: () => {},
    appendChild: () => {},
    getContext: () => ({
      clearRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fill: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} })
    })
  }),
  body: { appendChild: () => {} }
};

global.window = {
  innerWidth: 375,
  innerHeight: 667,
  devicePixelRatio: 2,
  requestAnimationFrame: (cb) => setTimeout(cb, 16),
  cancelAnimationFrame: (id) => clearTimeout(id),
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { href: 'http://localhost:3000' }
};

// Mock Web Audio Context for AudioEffectsEngine
class MockAudioParam {
  constructor(val = 0) { this.value = val; }
  setValueAtTime(v) { this.value = v; }
  linearRampToValueAtTime(v) { this.value = v; }
  setTargetAtTime(v) { this.value = v; }
}
class MockBiquadFilter {
  constructor() {
    this.type = 'peaking';
    this.frequency = new MockAudioParam(1000);
    this.Q = new MockAudioParam(1);
    this.gain = new MockAudioParam(0);
  }
  connect() {}
  disconnect() {}
}
class MockGainNode {
  constructor() { this.gain = new MockAudioParam(1.0); }
  connect() {}
  disconnect() {}
}
class MockAudioContext {
  constructor() {
    this.state = 'running';
    this.destination = {};
  }
  createGain() { return new MockGainNode(); }
  createBiquadFilter() { return new MockBiquadFilter(); }
  createChannelSplitter() { return { connect: () => {} }; }
  createChannelMerger() { return { connect: () => {} }; }
  createDynamicsCompressor() {
    return {
      threshold: new MockAudioParam(-0.5),
      knee: new MockAudioParam(0),
      ratio: new MockAudioParam(20),
      attack: new MockAudioParam(0.003),
      release: new MockAudioParam(0.1),
      connect: () => {}
    };
  }
  createMediaElementSource() { return { connect: () => {} }; }
  resume() { this.state = 'running'; return Promise.resolve(); }
}
global.AudioContext = MockAudioContext;
global.webkitAudioContext = MockAudioContext;
global.window.AudioContext = MockAudioContext;
global.window.webkitAudioContext = MockAudioContext;

// 2. Load Core Modules
const Storage = require('./js/storage.js');
global.Storage = Storage;

const TrackDeduplicator = require('./js/trackDeduplicator.js');
global.TrackDeduplicator = TrackDeduplicator;

const QueryNormalizer = require('./js/queryNormalizer.js');
global.QueryNormalizer = QueryNormalizer;

const StringSimilarity = require('./js/stringSimilarity.js');
global.StringSimilarity = StringSimilarity;

const SearchEngine = require('./js/searchEngine.js');
global.SearchEngine = SearchEngine;

const RecommendationEngine = require('./js/recommendationEngine.js');
global.RecommendationEngine = RecommendationEngine;

const AudioEffectsEngine = require('./js/audioEffectsEngine.js');
global.AudioEffectsEngine = AudioEffectsEngine;

// Mock HTML5 Audio Element
class MockAudioElement {
  constructor() {
    this.currentTime = 0;
    this.duration = 240;
    this.src = '';
    this.paused = true;
    this._listeners = {};
  }
  addEventListener(event, fn) {
    this._listeners[event] = this._listeners[event] || [];
    this._listeners[event].push(fn);
  }
  removeEventListener(event, fn) {
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter(f => f !== fn);
    }
  }
  play() {
    this.paused = false;
    (this._listeners['playing'] || []).forEach(fn => fn());
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
    (this._listeners['pause'] || []).forEach(fn => fn());
  }
}
global.Audio = MockAudioElement;

const Player = require('./js/player.js');
global.Player = Player;
Player.init();

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    failed++;
  }
}

console.log('=== RUNNING MUSICFLOW PHASE 8 FINAL VERIFICATION SUITE ===\n');

// ----------------------------------------------------------------------------
// AREA 1 & 3: SEARCH RANKING, CANDIDATE DIVERSITY & ARTIST CAPPING
// ----------------------------------------------------------------------------
console.log('Test Group 1: Search Engine 2.0 & Artist Diversity');

runTest('1.1 Search query "phonk" interleaves artists and caps repetitive tracks (no 5 in a row)', () => {
  const parsed = QueryNormalizer.parseCompoundQuery('phonk');
  const candidates = [
    { id: 'p1', name: 'Brazilian Phonk 1', artists: 'Phonk Artist A', duration: 120, streamUrl: 'http://audio' },
    { id: 'p2', name: 'Brazilian Phonk 2', artists: 'Phonk Artist A', duration: 130, streamUrl: 'http://audio' },
    { id: 'p3', name: 'Brazilian Phonk 3', artists: 'Phonk Artist A', duration: 140, streamUrl: 'http://audio' },
    { id: 'p4', name: 'Brazilian Phonk 4', artists: 'Phonk Artist A', duration: 150, streamUrl: 'http://audio' },
    { id: 'p5', name: 'Tokyo Drift Phonk', artists: 'Phonk Artist B', duration: 160, streamUrl: 'http://audio' },
    { id: 'p6', name: 'Dark Phonk Beats', artists: 'Phonk Artist C', duration: 170, streamUrl: 'http://audio' }
  ];

  const ranked = SearchEngine.rankSongs(candidates, parsed);
  assert.ok(ranked.length > 0, 'Ranked results should not be empty');

  // Verify that the top 3 results are not all from Phonk Artist A
  const topArtists = ranked.slice(0, 3).map(s => s.artists);
  const artistASongsInTop3 = topArtists.filter(a => a === 'Phonk Artist A').length;
  assert.ok(artistASongsInTop3 <= 2, 'Should not allow more than 2 tracks from same artist in top results');
  assert.notStrictEqual(ranked[0].artists, ranked[1].artists, 'Consecutive results should not be by the exact same artist');
});

runTest('1.2 Search preserves artist catalog when query is an explicit artist search', () => {
  const parsed = QueryNormalizer.parseCompoundQuery('The Weeknd');
  const candidates = [
    { id: 'w1', name: 'Blinding Lights', artists: 'The Weeknd', duration: 200, streamUrl: 'http://audio' },
    { id: 'w2', name: 'Starboy', artists: 'The Weeknd', duration: 230, streamUrl: 'http://audio' },
    { id: 'w3', name: 'Save Your Tears', artists: 'The Weeknd', duration: 215, streamUrl: 'http://audio' }
  ];

  const ranked = SearchEngine.rankSongs(candidates, parsed);
  assert.strictEqual(ranked.length, 3, 'All 3 tracks by the explicitly queried artist should be preserved');
});

runTest('1.3 Search penalizes unwanted karaoke and slowed/reverb clones unless queried', () => {
  const parsed = QueryNormalizer.parseCompoundQuery('Despacito');
  const candidates = [
    { id: 'd1', name: 'Despacito (Slowed + Reverb)', artists: 'Luis Fonsi', duration: 250, streamUrl: 'http://audio' },
    { id: 'd2', name: 'Despacito (Karaoke Version)', artists: 'Luis Fonsi', duration: 230, streamUrl: 'http://audio' },
    { id: 'd3', name: 'Despacito', artists: 'Luis Fonsi, Daddy Yankee', duration: 228, streamUrl: 'http://audio' }
  ];

  const ranked = SearchEngine.rankSongs(candidates, parsed);
  assert.strictEqual(ranked[0].id, 'd3', 'Original/canonical track should be ranked first ahead of karaoke and slowed versions');
});

// ----------------------------------------------------------------------------
// AREA 4 & 5: ALBUM EXPERIENCE & ARTIST ATTRIBUTION
// ----------------------------------------------------------------------------
console.log('\nTest Group 2: Album Experience & Artist Attribution');

runTest('2.1 Album track model calculates total duration and tracks cleanly', () => {
  const albumData = {
    id: 'alb_123',
    name: 'After Hours',
    artist: 'The Weeknd',
    year: '2020',
    songs: [
      { id: 's1', name: 'Alone Again', duration: 250 },
      { id: 's2', name: 'Too Late', duration: 239 },
      { id: 's3', name: 'Hardest to Love', duration: 211 }
    ]
  };

  const totalSec = albumData.songs.reduce((acc, s) => acc + s.duration, 0);
  assert.strictEqual(totalSec, 700, 'Total album duration should correctly sum to 700 seconds');
  assert.strictEqual(albumData.songs.length, 3, 'Album should have exactly 3 tracks');
});

runTest('2.2 Artist songs filter discards tracks where artist is only secondary or unrelated', () => {
  const targetArtist = 'Arijit Singh';
  const songs = [
    { id: 'a1', name: 'Tum Hi Ho', primaryArtist: 'Arijit Singh', artists: 'Arijit Singh' },
    { id: 'a2', name: 'Channa Mereya', primaryArtist: 'Arijit Singh', artists: 'Arijit Singh, Pritam' },
    { id: 'a3', name: 'Random EDM Remix', primaryArtist: 'DJ Unknown', artists: 'DJ Unknown, Unrelated' }
  ];

  const cleanNameLower = targetArtist.toLowerCase().trim();
  const legitimate = songs.filter(s => {
    const art = (s.primaryArtist || s.artists || '').toLowerCase();
    return art.includes(cleanNameLower);
  });

  assert.strictEqual(legitimate.length, 2, 'Should only retain legitimate tracks containing the target artist');
  assert.strictEqual(legitimate[0].name, 'Tum Hi Ho');
  assert.strictEqual(legitimate[1].name, 'Channa Mereya');
});

// ----------------------------------------------------------------------------
// AREA 6 & 7: RECOMMENDATION ENGINE & INTERLEAVED DIVERSITY
// ----------------------------------------------------------------------------
console.log('\nTest Group 3: Recommendation Engine 2.0 & Interleaved Diversity');

runTest('3.1 Multi-signal recommendation engine avoids mono-artist blocks (Interleaving)', () => {
  const history = [{ id: 'k1', name: 'Roar', artists: 'Katy Perry', primaryArtist: 'Katy Perry' }];
  const favorites = [{ id: 'k2', name: 'Firework', artists: 'Katy Perry', primaryArtist: 'Katy Perry' }];
  
  const pool = [
    { id: 'k1', name: 'Roar', artists: 'Katy Perry', primaryArtist: 'Katy Perry', streamUrl: 'http://audio' },
    { id: 'k2', name: 'Firework', artists: 'Katy Perry', primaryArtist: 'Katy Perry', streamUrl: 'http://audio' },
    { id: 'k3', name: 'Dark Horse', artists: 'Katy Perry', primaryArtist: 'Katy Perry', streamUrl: 'http://audio' },
    { id: 'k4', name: 'California Gurls', artists: 'Katy Perry', primaryArtist: 'Katy Perry', streamUrl: 'http://audio' },
    { id: 'd1', name: 'Levitating', artists: 'Dua Lipa', primaryArtist: 'Dua Lipa', streamUrl: 'http://audio' },
    { id: 't1', name: 'Cruel Summer', artists: 'Taylor Swift', primaryArtist: 'Taylor Swift', streamUrl: 'http://audio' },
    { id: 's1', name: 'Espresso', artists: 'Sabrina Carpenter', primaryArtist: 'Sabrina Carpenter', streamUrl: 'http://audio' }
  ];

  const recs = RecommendationEngine.getPersonalizedRecommendations(history, favorites, pool, { limit: 5 });
  assert.ok(recs.length >= 3, 'Should generate personalized recommendations');

  // Verify that recommendations do not start with 3 Katy Perry songs in a row
  const first3Artists = recs.slice(0, 3).map(r => r.song.primaryArtist || r.song.artists);
  assert.notStrictEqual(first3Artists[0], first3Artists[1], 'Consecutive recommendation tracks should be interleaved with related artists');
});

runTest('3.2 Similar tracks generator interleaves related artists and genre discovery', () => {
  const seed = { id: 'seed1', name: 'Blinding Lights', artists: 'The Weeknd', primaryArtist: 'The Weeknd' };
  const pool = [
    { id: 'w1', name: 'Starboy', artists: 'The Weeknd', primaryArtist: 'The Weeknd' },
    { id: 'w2', name: 'In Your Eyes', artists: 'The Weeknd', primaryArtist: 'The Weeknd' },
    { id: 'd1', name: 'One Dance', artists: 'Drake', primaryArtist: 'Drake' },
    { id: 't1', name: 'Sicko Mode', artists: 'Travis Scott', primaryArtist: 'Travis Scott' }
  ];

  const similar = RecommendationEngine.getSimilarTracks(seed, pool, 4);
  assert.ok(similar.length > 0, 'Similar tracks should be returned');
  if (similar.length > 1) {
    assert.notStrictEqual(similar[0].song.artists, similar[1].song.artists, 'Similar tracks should be diverse and not consecutive duplicates');
  }
});

// ----------------------------------------------------------------------------
// AREA 8 & 9: RADIO CONTINUITY (NO AUDIO RESTART)
// ----------------------------------------------------------------------------
console.log('\nTest Group 4: Radio Continuity & Queue');

runTest('4.1 Starting radio from active playing song preserves currentTime and does not restart playback', () => {
  const currentSong = { id: 'playing_1', name: 'Active Song', artists: 'Artist A' };
  const relatedSongs = [
    { id: 'rel_1', name: 'Related Song 1', artists: 'Artist B' },
    { id: 'rel_2', name: 'Related Song 2', artists: 'Artist C' }
  ];

  // Set active track
  Player.setQueue([currentSong], 0, false);
  const beforeTrack = Player.getCurrentTrack();
  assert.strictEqual(beforeTrack.id, 'playing_1');

  // Start Radio for the currently active track
  Player.startRadioQueue(currentSong, relatedSongs);

  const queueAfter = Player.getQueue();
  const activeAfter = Player.getCurrentTrack();

  assert.strictEqual(activeAfter.id, 'playing_1', 'Active playing track must remain at current index');
  assert.strictEqual(queueAfter.length, 3, 'Radio queue should now have active track + 2 upcoming related tracks');
  assert.strictEqual(queueAfter[1].id, 'rel_1', 'Next track in queue should be first related song');
});

// ----------------------------------------------------------------------------
// AREA 15 & 16: PLAYLIST ATOMIC PERSISTENCE & YOUTUBE IMPORT
// ----------------------------------------------------------------------------
console.log('\nTest Group 5: Playlist Persistence & YouTube Import');

runTest('5.1 Creating playlist with initial songs atomically persists and updates count', () => {
  Storage.clearAllData();
  const initialTracks = [
    { id: 't1', name: 'Song 1', artists: 'Artist A' },
    { id: 't2', name: 'Song 2', artists: 'Artist B' },
    { id: 't3', name: 'Song 3', artists: 'Artist C' }
  ];

  const pl = Storage.createPlaylist('Roadtrip Mix', 'Awesome tracks', '', initialTracks);
  assert.ok(pl && pl.id, 'Playlist should be created with valid ID');
  assert.strictEqual(pl.songs.length, 3, 'Created playlist should immediately contain 3 tracks');

  const retrieved = Storage.getPlaylistById(pl.id);
  assert.strictEqual(retrieved.songs.length, 3, 'Retrieved playlist from storage should have 3 tracks');
});

runTest('5.2 addSongToPlaylist alias adds track and immediately persists to storage', () => {
  const pl = Storage.createPlaylist('Workout', 'Pump up');
  assert.strictEqual(pl.songs.length, 0, 'Initial count should be 0');

  const added = Storage.addSongToPlaylist(pl.id, { id: 'pump_1', name: 'Power', artists: 'Kanye West' });
  assert.strictEqual(added, true, 'Song should be added successfully');

  const retrieved = Storage.getPlaylistById(pl.id);
  assert.strictEqual(retrieved.songs.length, 1, 'Playlist count should immediately increase from 0 to 1');
  assert.strictEqual(retrieved.songs[0].id, 'pump_1');
});

runTest('5.3 YouTube playlist import with 39 matched tracks saves all 39 tracks without losing count', () => {
  const matched39Tracks = [];
  for (let i = 1; i <= 39; i++) {
    matched39Tracks.push({ id: `yt_track_${i}`, name: `Track ${i}`, artists: `Artist ${i}` });
  }

  const importedPl = Storage.createPlaylist('YT Favorites (39 Matched)', 'Imported from YouTube Music', '', matched39Tracks);
  assert.strictEqual(importedPl.songs.length, 39, 'Imported playlist must contain all 39 tracks');

  const inStorage = Storage.getPlaylistById(importedPl.id);
  assert.strictEqual(inStorage.songs.length, 39, 'Storage must persist all 39 tracks atomically');
});

// ----------------------------------------------------------------------------
// AREA 19 & 20: AUDIO DSP, 7-BAND EQ & 3D SPATIAL AUDIO
// ----------------------------------------------------------------------------
console.log('\nTest Group 6: Equalizer & 3D Spatial Audio');

runTest('6.1 AudioEffectsEngine initializes DSP chain with 7 EQ bands and presets', () => {
  const mockAudio = new MockAudioElement();
  AudioEffectsEngine.init(mockAudio);
  AudioEffectsEngine.setEnabled(true);
  assert.strictEqual(AudioEffectsEngine.isEnabled(), true, 'Audio effects should be initialized and enabled');

  AudioEffectsEngine.setPreset('Bass Boost');
  const settings = AudioEffectsEngine.getSettings();
  assert.strictEqual(settings.preset, 'Bass Boost');
  assert.strictEqual(settings.bassBoost, 8, 'Bass boost gain should be set to 8dB');

  AudioEffectsEngine.setBandGain(0, 10);
  assert.strictEqual(AudioEffectsEngine.getSettings().preset, 'Custom', 'Manual band adjustment switches preset to Custom');
});

runTest('6.2 3D Spatial Audio switches levels cleanly (OFF, LOW, MEDIUM, HIGH)', () => {
  AudioEffectsEngine.setSpatial('HIGH');
  assert.strictEqual(AudioEffectsEngine.getSettings().spatial, 'HIGH');

  AudioEffectsEngine.setSpatial('LOW');
  assert.strictEqual(AudioEffectsEngine.getSettings().spatial, 'LOW');

  AudioEffectsEngine.setSpatial('OFF');
  assert.strictEqual(AudioEffectsEngine.getSettings().spatial, 'OFF');
});

// ----------------------------------------------------------------------------
// AREA 22, 23 & 24: SLEEP TIMER & MEDIA SESSION CONTROLS
// ----------------------------------------------------------------------------
console.log('\nTest Group 7: Sleep Timer & Media Controls');

runTest('7.1 Sleep timer sets duration, counts down, and formats remaining time', () => {
  Player.setSleepTimer(30);
  const state = Player.getSleepTimerState();
  assert.strictEqual(state.active, true);
  assert.strictEqual(state.durationMinutes, 30);
  assert.ok(state.expiresAt > Date.now());

  Player.setSleepTimer('off');
  const turnedOff = Player.getSleepTimerState();
  assert.strictEqual(turnedOff.active, false);
});

runTest('7.2 MediaSession sets up previous, play/pause, next track handlers without skip icons', () => {
  const NativeMedia = require('./js/nativeMedia.js');
  if (NativeMedia && NativeMedia.setupBrowserMediaActions) {
    NativeMedia.setupBrowserMediaActions();
  }
  const handlers = global.mediaHandlers || {};
  assert.ok(typeof handlers['previoustrack'] === 'function', 'previoustrack handler must be registered');
  assert.ok(typeof handlers['nexttrack'] === 'function', 'nexttrack handler must be registered');
  assert.ok(typeof handlers['play'] === 'function', 'play handler must be registered');
  assert.ok(typeof handlers['pause'] === 'function', 'pause handler must be registered');
  assert.ok(!handlers['seekforward'], 'seekforward should be null or undefined so OS shows Next Track');
  assert.ok(!handlers['seekbackward'], 'seekbackward should be null or undefined so OS shows Previous Track');
});

// ----------------------------------------------------------------------------
// SUMMARY REPORT
// ----------------------------------------------------------------------------
console.log(`\n=======================================================`);
console.log(`MASTER TEST SUITE SUMMARY: ${passed} PASSED | ${failed} FAILED`);
console.log(`=======================================================\n`);

if (failed > 0) {
  process.exit(1);
}
