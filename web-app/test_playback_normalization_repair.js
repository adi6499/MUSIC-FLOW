// ============================================================================
// MUSICFLOW — PLAYBACK & DATA NORMALIZATION MASTER REPAIR TEST SUITE
// Tests all 18 architectural repair scenarios:
// 1. DataNormalizer Artist Extraction (6 input shapes)
// 2. DataNormalizer Artist Names Array
// 3. Canonical Song Schema (18 fields)
// 4. Storage Favorite Resolution with Object Artists
// 5. Storage recordSkip & Milestones Graceful Handling
// 6. MusicFlowEmbedder Artist Robustness
// 7. RecommendationEngine Song-First Quality & Graph Similarity
// 8. Player requestTrackPlayback Unified Pipeline
// 9. Rapid Playback Race Condition ("Latest Request Wins")
// 10. Player insertNext (Single Track)
// 11. Player insertNext (Array of Tracks)
// 12. Player playNext Alias
// 13. Queue Deduplication on Play Next
// 14. Playlist Context & Boundary Preservation
// 15. Radio Queue Continuity
// 16. Artwork Dynamic Color In-Memory Cache
// 17. UpdateManager Non-JSON Response Handling
// 18. YouTube Track Fallback Resolution
// ============================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

// 1. Load DataNormalizer
const DataNormalizer = require('./js/dataNormalizer.js');

// Setup mock DOM sandbox for Player testing
function createPlayerSandbox() {
  const mockAudio = {
    src: '',
    currentTime: 0,
    duration: 200,
    paused: true,
    buffered: { length: 1, end: () => 100 },
    listeners: {},
    addEventListener(evt, fn) {
      if (!this.listeners[evt]) this.listeners[evt] = [];
      this.listeners[evt].push(fn);
    },
    removeEventListener(evt, fn) {
      if (!this.listeners[evt]) return;
      this.listeners[evt] = this.listeners[evt].filter(f => f !== fn);
    },
    load() {},
    play() {
      this.paused = false;
      return Promise.resolve();
    },
    pause() {
      this.paused = true;
    }
  };

  const sandbox = {
    window: {
      addEventListener() {},
      removeEventListener() {},
      location: { href: 'http://localhost:3000/' }
    },
    document: {
      getElementById(id) {
        if (id === 'app-audio') return mockAudio;
        return null;
      },
      addEventListener() {},
      removeEventListener() {},
      visibilityState: 'visible'
    },
    navigator: {
      onLine: true
    },
    Audio: function() { return mockAudio; },
    DataNormalizer: DataNormalizer,
    OfflineManager: { isOnline: () => true },
    API: {
      getDownloadUrl(s) { return s.audioUrl || s.streamUrl || 'https://example.com/audio.mp3'; },
      getSongDetails(id) { return Promise.resolve([{ id, audioUrl: 'https://example.com/audio.mp3' }]); },
      searchSongs(q) { return Promise.resolve([{ id: 'matched_1', audioUrl: 'https://example.com/audio.mp3' }]); }
    },
    Storage: {
      saveSession() {},
      getAudioQuality() { return '320kbps'; },
      recordSkip() {},
      recordPlayMilestone() {}
    },
    AbortController: global.AbortController || class {
      constructor() { this.signal = { aborted: false }; }
      abort() { this.signal.aborted = true; }
    },
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout,
    console: { log() {}, warn() {}, error() {} },
    mockAudio
  };

  sandbox.window.DataNormalizer = DataNormalizer;
  sandbox.window.API = sandbox.API;
  sandbox.window.Storage = sandbox.Storage;

  vm.createContext(sandbox);
  const resolverCode = fs.readFileSync(path.join(__dirname, 'js/playbackResolver.js'), 'utf8');
  vm.runInContext(resolverCode, sandbox);
  sandbox.window.PlaybackResolver = sandbox.PlaybackResolver;

  const playerCode = fs.readFileSync(path.join(__dirname, 'js/player.js'), 'utf8');
  vm.runInContext(playerCode, sandbox);
  const Player = sandbox.Player || sandbox.window.Player;
  return { Player, sandbox, mockAudio };
}

async function runAll() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING PLAYBACK & DATA NORMALIZATION REPAIR TESTS');
  console.log('======================================================\n');

  // Test 1: Artist Extraction Across 6 Input Shapes
  runTest('Scenario 1: DataNormalizer.getArtistString handles all 6 input shapes without .toLowerCase error', () => {
    assert.strictEqual(DataNormalizer.getArtistString('Arijit Singh'), 'Arijit Singh');
    assert.strictEqual(DataNormalizer.getArtistString(['Arijit Singh', 'Pritam']), 'Arijit Singh, Pritam');
    assert.strictEqual(DataNormalizer.getArtistString([{ name: 'A.R. Rahman' }, { name: 'Shreya Ghoshal' }]), 'A.R. Rahman, Shreya Ghoshal');
    const struct = { primary: [{ name: 'Badshah' }], featured: [{ name: 'Diljit Dosanjh' }] };
    assert.strictEqual(DataNormalizer.getArtistString(struct), 'Badshah, Diljit Dosanjh');
    const track = { id: '1', title: 'Kesariya', artists: [{ name: 'Arijit Singh' }, { name: 'Pritam' }] };
    assert.strictEqual(DataNormalizer.getArtistString(track), 'Arijit Singh, Pritam');
    assert.strictEqual(DataNormalizer.getArtistString(null), 'Unknown Artist');
    assert.strictEqual(DataNormalizer.getArtistString(undefined), 'Unknown Artist');
  });

  // Test 2: Artist Names Array
  runTest('Scenario 2: DataNormalizer.getArtistNames returns string array', () => {
    const names = DataNormalizer.getArtistNames([{ name: 'Arijit Singh' }, { name: 'Pritam' }]);
    assert.ok(Array.isArray(names), 'Should return array');
    assert.strictEqual(names.length, 2);
    assert.strictEqual(names[0], 'Arijit Singh');
    assert.strictEqual(names[1], 'Pritam');
  });

  // Test 3: Canonical Song Schema (18 fields)
  runTest('Scenario 3: DataNormalizer.normalizeSong returns all canonical schema fields', () => {
    const raw = {
      id: '12345',
      title: 'Apna Bana Le',
      artists: 'Arijit Singh, Sachin-Jigar',
      album: 'Bhediya',
      albumId: 'alb_1',
      image: 'https://c.saavncdn.com/123-500x500.jpg',
      duration: '260',
      audioUrl: 'https://aac.saavncdn.com/123.mp4',
      provider: 'jiosaavn'
    };

    const song = DataNormalizer.normalizeSong(raw);
    assert.strictEqual(song.id, '12345');
    assert.strictEqual(song.name, 'Apna Bana Le');
    assert.strictEqual(song.title, 'Apna Bana Le');
    assert.strictEqual(song.artists, 'Arijit Singh, Sachin-Jigar');
    assert.ok(Array.isArray(song.artistNames), 'artistNames should be array');
    assert.strictEqual(song.primaryArtist, 'Arijit Singh');
    assert.ok(Array.isArray(song.artistsList), 'artistsList should be array');
    assert.strictEqual(song.album, 'Bhediya');
    assert.strictEqual(song.albumId, 'alb_1');
    assert.strictEqual(song.image, 'https://c.saavncdn.com/123-500x500.jpg');
    assert.strictEqual(song.duration, 260);
    assert.strictEqual(song.durationSeconds, 260);
    assert.strictEqual(song.streamUrl, 'https://aac.saavncdn.com/123.mp4');
    assert.strictEqual(song.streamType, 'mp4');
    assert.strictEqual(song.provider, 'jiosaavn');
    assert.strictEqual(song.source, 'jiosaavn');
    assert.strictEqual(song.isPlayable, true);
    assert.strictEqual(song.metadataAvailable, true);
  });

  // Test 4: Storage Favorite Resolution with Object Artists
  runTest('Scenario 4: Storage.isFavorite and toggleFavorite work seamlessly with object artists', () => {
    const sandbox = {
      window: {},
      localStorage: {
        _data: {},
        getItem(k) { return this._data[k] || null; },
        setItem(k, v) { this._data[k] = String(v); },
        removeItem(k) { delete this._data[k]; }
      },
      DataNormalizer: DataNormalizer,
      console: console
    };
    sandbox.window.DataNormalizer = DataNormalizer;
    vm.createContext(sandbox);

    const storageCode = fs.readFileSync(path.join(__dirname, 'js/storage.js'), 'utf8');
    vm.runInContext(storageCode, sandbox);
    const Storage = sandbox.Storage || sandbox.window.Storage;

    const complexSong = {
      id: 's_101',
      name: 'Tum Hi Ho',
      artists: [{ name: 'Arijit Singh' }, { name: 'Mithoon' }]
    };

    assert.strictEqual(Storage.isFavorite(complexSong), false);
    const toggled = Storage.toggleFavorite(complexSong);
    assert.strictEqual(toggled, true);
    assert.strictEqual(Storage.isFavorite(complexSong), true);
    assert.strictEqual(Storage.isFavorite('s_101'), true);

    const toggledOff = Storage.toggleFavorite(complexSong);
    assert.strictEqual(toggledOff, false);
    assert.strictEqual(Storage.isFavorite(complexSong), false);
  });

  // Test 5: Storage recordSkip & Milestones
  runTest('Scenario 5: Storage.recordSkip and recordPlayMilestone handle complex track shapes safely', () => {
    const sandbox = {
      window: {},
      localStorage: {
        _data: {},
        getItem(k) { return this._data[k] || null; },
        setItem(k, v) { this._data[k] = String(v); }
      },
      DataNormalizer: DataNormalizer,
      console: console
    };
    sandbox.window.DataNormalizer = DataNormalizer;
    vm.createContext(sandbox);
    const storageCode = fs.readFileSync(path.join(__dirname, 'js/storage.js'), 'utf8');
    vm.runInContext(storageCode, sandbox);
    const Storage = sandbox.Storage || sandbox.window.Storage;

    const complexTrack = {
      id: 's_999',
      name: 'Chaleya',
      artists: [{ name: 'Arijit Singh' }, { name: 'Shilpa Rao' }]
    };

    Storage.recordSkip(complexTrack);
    const skips = Storage.getSkips();
    assert.strictEqual(skips.length, 1);
    assert.strictEqual(skips[0].id, 's_999');
    assert.strictEqual(skips[0].artist, 'arijit singh, shilpa rao');
  });

  // Test 6: MusicFlowEmbedder Artist Robustness
  runTest('Scenario 6: MusicFlowEmbedder.generateEmbedding handles songs with object/array artists without throwing', () => {
    const sandbox = {
      window: {},
      DataNormalizer: DataNormalizer,
      Float32Array: Float32Array,
      Math: Math,
      parseInt: parseInt,
      Number: Number,
      String: String
    };
    sandbox.window.DataNormalizer = DataNormalizer;
    vm.createContext(sandbox);
    const embedderCode = fs.readFileSync(path.join(__dirname, 'js/musicFlowEmbedder.js'), 'utf8');
    vm.runInContext(embedderCode, sandbox);
    const MusicFlowEmbedder = sandbox.MusicFlowEmbedder || sandbox.window.MusicFlowEmbedder;

    const songWithObjArtists = {
      id: 'emb_1',
      name: 'Raabta',
      artists: [{ name: 'Arijit Singh' }]
    };

    const vec = MusicFlowEmbedder.generateEmbedding(songWithObjArtists);
    assert.ok(vec instanceof Float32Array, 'Should return Float32Array');
    assert.strictEqual(vec.length, 64);
  });

  // Test 7: RecommendationEngine Song-First Quality & Graph Similarity
  runTest('Scenario 7: RecommendationEngine evaluates songs with object artists safely', () => {
    const sandbox = {
      window: {},
      DataNormalizer: DataNormalizer,
      Float32Array: Float32Array,
      Math: Math,
      parseInt: parseInt,
      Number: Number,
      String: String,
      Map: Map,
      Set: Set,
      Array: Array,
      console: console
    };
    sandbox.window.DataNormalizer = DataNormalizer;
    vm.createContext(sandbox);
    const mfeCode = fs.readFileSync(path.join(__dirname, 'js/musicFlowEmbedder.js'), 'utf8');
    const recCode = fs.readFileSync(path.join(__dirname, 'js/recommendationEngine.js'), 'utf8');
    vm.runInContext(mfeCode, sandbox);
    vm.runInContext(recCode, sandbox);
    const RecommendationEngine = sandbox.RecommendationEngine || sandbox.window.RecommendationEngine;

    const seed = {
      id: 'seed_1',
      name: 'Kesariya',
      artists: [{ name: 'Arijit Singh' }, { name: 'Pritam' }],
      duration: 260
    };

    const candidates = [
      { id: 'c_1', name: 'Apna Bana Le', artists: [{ name: 'Arijit Singh' }], duration: 250, audioUrl: 'http://example.com/1.mp3' },
      { id: 'c_2', name: 'Pritam Jukebox', artists: 'Pritam', duration: 1800, type: 'playlist' }
    ];

    const recs = RecommendationEngine.getSimilarTracks(seed, candidates, 5);
    assert.strictEqual(recs.length, 1);
    assert.strictEqual(recs[0].song.id, 'c_1');
  });

  // Test 8: Player requestTrackPlayback Unified Pipeline
  await runAsyncTest('Scenario 8: Player.requestTrackPlayback resolves track and updates state', async () => {
    const { Player } = createPlayerSandbox();
    Player.init();

    const trackA = { id: 't_a', name: 'Song A', artists: 'Artist A', audioUrl: 'https://example.com/a.mp3' };
    const trackB = { id: 't_b', name: 'Song B', artists: 'Artist B', audioUrl: 'https://example.com/b.mp3' };

    Player.setQueue([trackA, trackB], 0, false);
    await Player.requestTrackPlayback(1, { autoPlay: true });

    assert.strictEqual(Player.getCurrentIndex(), 1);
    assert.strictEqual(Player.getCurrentTrack().id, 't_b');
    assert.strictEqual(Player.getAudioElement().src, 'https://example.com/b.mp3');
    assert.strictEqual(Player.getPlaybackRequestId(), 2);
  });

  // Test 9: Rapid Playback Race Condition ("Latest Request Wins")
  await runAsyncTest('Scenario 9: Rapid consecutive playback requests ensure only the latest request wins', async () => {
    const { Player } = createPlayerSandbox();
    Player.init();

    const tracks = [
      { id: 't_1', name: 'Song 1', audioUrl: 'https://example.com/1.mp3' },
      { id: 't_2', name: 'Song 2', audioUrl: 'https://example.com/2.mp3' },
      { id: 't_3', name: 'Song 3', audioUrl: 'https://example.com/3.mp3' },
      { id: 't_4', name: 'Song 4', audioUrl: 'https://example.com/4.mp3' },
      { id: 't_5', name: 'Song 5', audioUrl: 'https://example.com/5.mp3' }
    ];

    Player.setQueue(tracks, 0, false);

    const p1 = Player.requestTrackPlayback(0);
    const p2 = Player.requestTrackPlayback(1);
    const p3 = Player.requestTrackPlayback(2);
    const p4 = Player.requestTrackPlayback(3);
    const p5 = Player.requestTrackPlayback(4);

    await Promise.all([p1, p2, p3, p4, p5]);

    assert.strictEqual(Player.getCurrentIndex(), 4);
    assert.strictEqual(Player.getCurrentTrack().id, 't_5');
    assert.strictEqual(Player.getAudioElement().src, 'https://example.com/5.mp3');
  });

  // Test 10: Player insertNext (Single Track)
  runTest('Scenario 10: Player.insertNext inserts track immediately after current index', () => {
    const { Player } = createPlayerSandbox();

    const trackA = { id: 't_a', name: 'Song A' };
    const trackB = { id: 't_b', name: 'Song B' };
    const trackC = { id: 't_c', name: 'Song C' };
    const trackX = { id: 't_x', name: 'Song X (Next)' };

    Player.setQueue([trackA, trackB, trackC], 0, false);
    Player.insertNext(trackX);

    const q = Player.getQueue();
    assert.strictEqual(q.length, 4);
    assert.strictEqual(q[0].id, 't_a');
    assert.strictEqual(q[1].id, 't_x');
    assert.strictEqual(q[2].id, 't_b');
    assert.strictEqual(q[3].id, 't_c');
  });

  // Test 11: Player insertNext (Array of Tracks)
  runTest('Scenario 11: Player.insertNext handles array of tracks preserving order', () => {
    const { Player } = createPlayerSandbox();

    const trackA = { id: 't_a', name: 'Song A' };
    const trackB = { id: 't_b', name: 'Song B' };
    const trackX = { id: 't_x', name: 'Song X' };
    const trackY = { id: 't_y', name: 'Song Y' };

    Player.setQueue([trackA, trackB], 0, false);
    Player.insertNext([trackX, trackY]);

    const q = Player.getQueue();
    assert.strictEqual(q.length, 4);
    assert.strictEqual(q[0].id, 't_a');
    assert.strictEqual(q[1].id, 't_x');
    assert.strictEqual(q[2].id, 't_y');
    assert.strictEqual(q[3].id, 't_b');
  });

  // Test 12: Player playNext Alias
  runTest('Scenario 12: Player.playNext functions as alias to insertNext', () => {
    const { Player } = createPlayerSandbox();

    const trackA = { id: 't_a', name: 'Song A' };
    const trackB = { id: 't_b', name: 'Song B' };
    const trackZ = { id: 't_z', name: 'Song Z' };

    Player.setQueue([trackA, trackB], 0, false);
    Player.playNext(trackZ);

    const q = Player.getQueue();
    assert.strictEqual(q[1].id, 't_z');
  });

  // Test 13: Queue Deduplication on Play Next
  runTest('Scenario 13: Player.insertNext moves duplicate track if already present further down queue', () => {
    const { Player } = createPlayerSandbox();

    const trackA = { id: 't_a', name: 'Song A' };
    const trackB = { id: 't_b', name: 'Song B' };
    const trackC = { id: 't_c', name: 'Song C' };

    Player.setQueue([trackA, trackB, trackC], 0, false);
    Player.insertNext(trackC);

    const q = Player.getQueue();
    assert.strictEqual(q.length, 3);
    assert.strictEqual(q[0].id, 't_a');
    assert.strictEqual(q[1].id, 't_c');
    assert.strictEqual(q[2].id, 't_b');
  });

  // Test 14: Playlist Context & Boundary Preservation
  await runAsyncTest('Scenario 14: Next track at end of playlist stops playback and does not inject radio', async () => {
    const { Player } = createPlayerSandbox();
    Player.init();

    const plTrack1 = { id: 'pl_1', name: 'PL Song 1', audioUrl: 'https://example.com/pl1.mp3' };
    const plTrack2 = { id: 'pl_2', name: 'PL Song 2', audioUrl: 'https://example.com/pl2.mp3' };

    Player.setQueue([plTrack1, plTrack2], 1, false, { source: 'playlist', mode: 'playlist', sourceId: 'pl_100' });
    assert.strictEqual(Player.getCurrentIndex(), 1);

    await Player.next();
    assert.strictEqual(Player.getState().playbackState, Player.PlaybackState.COMPLETED);
    assert.strictEqual(Player.getQueue().length, 2, 'Queue should not be replaced with auto-radio items');
  });

  // Test 15: Radio Queue Continuity
  runTest('Scenario 15: Player.startRadioQueue preserves active song and replaces upcoming queue', () => {
    const { Player } = createPlayerSandbox();

    const current = { id: 'seed_song', name: 'Active Song' };
    const related = [
      { id: 'rel_1', name: 'Related 1' },
      { id: 'rel_2', name: 'Related 2' },
      { id: 'rel_3', name: 'Related 3' }
    ];

    Player.setQueue([current], 0, false);
    Player.startRadioQueue(current, related);

    const q = Player.getQueue();
    assert.strictEqual(q.length, 4);
    assert.strictEqual(q[0].id, 'seed_song');
    assert.strictEqual(q[1].id, 'rel_1');
    assert.strictEqual(Player.getQueueContext().source, 'radio');
  });

  // Test 16: Artwork Dynamic Color In-Memory Cache
  runTest('Scenario 16: UI setDynamicColor cache prevents duplicate extraction', () => {
    const sandbox = {
      window: {},
      document: {
        documentElement: {
          style: {
            properties: {},
            setProperty(k, v) { this.properties[k] = v; }
          }
        },
        createElement() {
          return {
            getContext() {
              return {
                drawImage() {},
                getImageData() { return { data: [255, 42, 77, 100] }; }
              };
            }
          };
        }
      },
      Image: function() {
        this.onload = null;
        Object.defineProperty(this, 'src', {
          set(url) {
            if (this.onload) this.onload();
          }
        });
      },
      DataNormalizer: DataNormalizer,
      console: console
    };

    sandbox.window.DataNormalizer = DataNormalizer;
    vm.createContext(sandbox);
    const uiCode = fs.readFileSync(path.join(__dirname, 'js/ui.js'), 'utf8');
    vm.runInContext(uiCode, sandbox);
    const UI = sandbox.UI || sandbox.window.UI;

    UI.setDynamicColor('https://example.com/art.jpg');
    assert.strictEqual(sandbox.document.documentElement.style.properties['--dynamic-color'], 'rgba(255, 42, 77, 0.40)');

    UI.setDynamicColor('https://example.com/art.jpg');
    assert.strictEqual(sandbox.document.documentElement.style.properties['--dynamic-color'], 'rgba(255, 42, 77, 0.40)');
  });

  // Test 17: UpdateManager Non-JSON Response Handling
  await runAsyncTest('Scenario 17: UpdateManager handles non-JSON / HTML server response gracefully without throwing', async () => {
    const sandbox = {
      window: {},
      document: {},
      navigator: { userAgent: 'Mozilla/5.0' },
      fetch() {
        return Promise.resolve({
          ok: true,
          headers: {
            get(h) { return h === 'content-type' ? 'text/html; charset=utf-8' : null; }
          },
          json() { throw new Error('Unexpected token < in JSON'); }
        });
      },
      Storage: {
        getLastUpdateCheck() { return null; },
        setLastUpdateCheck() {}
      },
      console: { log() {}, warn() {}, error() {} }
    };

    vm.createContext(sandbox);
    const updateCode = fs.readFileSync(path.join(__dirname, 'js/updateManager.js'), 'utf8');
    vm.runInContext(updateCode, sandbox);
    const UpdateManager = sandbox.UpdateManager || sandbox.window.UpdateManager;

    const result = await UpdateManager.checkForUpdates({ manual: false, silent: true });
    assert.strictEqual(result.isChecking, false);
    assert.ok(result.error !== null, 'Error state should be captured gracefully');
  });

  // Test 18: YouTube Track Fallback Resolution
  await runAsyncTest('Scenario 18: resolvePlaybackSource falls back to search matching for yt_ tracks', async () => {
    const { Player } = createPlayerSandbox();

    const ytTrack = {
      id: 'yt_dQw4w9WgXcQ',
      name: 'Never Gonna Give You Up',
      artists: 'Rick Astley',
      provider: 'youtube_music'
    };

    const resolved = await Player.resolvePlaybackSource(ytTrack);
    assert.strictEqual(resolved.type, Player.SourceType.STREAMING);
    assert.strictEqual(resolved.uri, 'https://example.com/audio.mp3');
  });

  console.log('\n======================================================');
  console.log(`📊 MASTER TEST RESULTS: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAll().catch(err => {
  console.error('Unhandled test runner failure:', err);
  process.exit(1);
});
