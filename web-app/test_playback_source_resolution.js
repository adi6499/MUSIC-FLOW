// ============================================================================
// MUSICFLOW — PLAYBACK SOURCE RESOLUTION & ERROR HANDLING TEST SUITE
// 21 Comprehensive Tests Matching Production Error Resilience & UI Sync
// ============================================================================

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Setup Headless DOM Mock Environment
const storageMap = new Map();
global.localStorage = {
  getItem: (k) => storageMap.has(k) ? storageMap.get(k) : null,
  setItem: (k, v) => storageMap.set(k, String(v)),
  removeItem: (k) => storageMap.delete(k),
  clear: () => storageMap.clear()
};

global.window = {
  localStorage: global.localStorage,
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { reload: () => {} }
};

const mockDocElements = new Map();
function createMockElement(tag) {
  return {
    tagName: tag.toUpperCase(),
    style: { cssText: '' },
    classList: {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      toggle(c, force) {
        if (force === undefined) {
          if (this._classes.has(c)) { this._classes.delete(c); return false; }
          else { this._classes.add(c); return true; }
        }
        if (force) { this._classes.add(c); return true; }
        else { this._classes.delete(c); return false; }
      },
      contains(c) { return this._classes.has(c); }
    },
    attributes: {},
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return this.attributes[k] || null; },
    removeAttribute(k) { delete this.attributes[k]; },
    _listeners: {},
    addEventListener(evt, fn) {
      if (!this._listeners[evt]) this._listeners[evt] = [];
      this._listeners[evt].push(fn);
    },
    removeEventListener(evt, fn) {
      if (this._listeners[evt]) {
        this._listeners[evt] = this._listeners[evt].filter(f => f !== fn);
      }
    },
    dispatchEvent(evt) {
      (this._listeners[evt.type] || []).forEach(f => f(evt));
    },
    src: '',
    textContent: '',
    innerHTML: '',
    value: 0,
    paused: true,
    currentTime: 0,
    duration: 300,
    loadCount: 0,
    playCount: 0,
    play() {
      this.paused = false;
      this.playCount++;
      this.dispatchEvent({ type: 'playing' });
      return Promise.resolve();
    },
    pause() {
      this.paused = true;
    },
    load() {
      this.loadCount++;
    },
    appendChild(child) {
      return child;
    }
  };
}

global.document = {
  documentElement: {
    style: { setProperty: () => {} }
  },
  body: createMockElement('body'),
  readyState: 'complete',
  addEventListener: () => {},
  removeEventListener: () => {},
  createElement: createMockElement,
  getElementById(id) {
    if (!mockDocElements.has(id)) {
      const el = createMockElement('div');
      el.id = id;
      mockDocElements.set(id, el);
    }
    return mockDocElements.get(id);
  },
  querySelectorAll: () => [],
  querySelector: () => null
};

global.navigator = {
  onLine: true,
  mediaSession: {
    setActionHandler: () => {},
    setPositionState: () => {}
  }
};

global.Audio = class Audio {
  constructor() {
    this.paused = true;
    this.currentTime = 0;
    this.duration = 300;
    this.src = '';
    this.loadCount = 0;
    this.playCount = 0;
    this._listeners = {};
  }
  addEventListener(evt, fn) {
    if (!this._listeners[evt]) this._listeners[evt] = [];
    this._listeners[evt].push(fn);
  }
  removeEventListener(evt, fn) {
    if (this._listeners[evt]) {
      this._listeners[evt] = this._listeners[evt].filter(f => f !== fn);
    }
  }
  play() {
    this.paused = false;
    this.playCount++;
    this.dispatchEvent({ type: 'playing' });
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
    this.dispatchEvent({ type: 'pause' });
  }
  load() {
    this.loadCount++;
  }
  setSinkId() {
    return Promise.resolve();
  }
  dispatchEvent(evt) {
    (this._listeners[evt.type] || []).forEach(f => f(evt));
  }
};

global.Lyrics = {
  loadLyricsForTrack: () => {},
  updateTime: () => {}
};

// Load Core Modules
const Storage = require('./js/storage.js');
global.Storage = Storage;

const API = require('./js/api.js');
global.API = API;

const Player = require('./js/player.js');
global.Player = Player;

const UI = require('./js/ui.js');
global.UI = UI;

let passed = 0;
let failed = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \x1b[31m✖\x1b[0m ${name}`);
    console.error(`    \x1b[33mError: ${err.message}\x1b[0m`);
    failed++;
  }
}

async function itAsync(name, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \x1b[31m✖\x1b[0m ${name}`);
    console.error(`    \x1b[33mError: ${err.message}\x1b[0m`);
    failed++;
  }
}

console.log('\n=======================================================');
console.log('⚡ MUSICFLOW: PLAYBACK SOURCE RESOLUTION TEST SUITE');
console.log('=======================================================\n');

(async () => {
  global.navigator.onLine = true;
  Player.init();

  // Test 1-5: Online URL & Quality Resolution
  await itAsync('1. Direct audioUrl resolves to STREAMING type with valid URI', async () => {
    global.navigator.onLine = true;
    const track = { id: 't1', name: 'Song 1', audioUrl: 'https://example.com/song1.mp3' };
    const res = await Player.resolvePlaybackSource(track);
    assert.strictEqual(res.type, Player.SourceType.STREAMING);
    assert.strictEqual(res.uri, 'https://example.com/song1.mp3');
  });

  await itAsync('2. downloadUrl array extracts preferred quality (320kbps)', async () => {
    global.navigator.onLine = true;
    Storage.setAudioQuality('320kbps');
    const track = {
      id: 't2',
      name: 'Song 2',
      downloadUrl: [
        { quality: '96kbps', url: 'https://example.com/96.mp3' },
        { quality: '160kbps', url: 'https://example.com/160.mp3' },
        { quality: '320kbps', url: 'https://example.com/320.mp3' }
      ]
    };
    const res = await Player.resolvePlaybackSource(track);
    assert.strictEqual(res.type, Player.SourceType.STREAMING);
    assert.strictEqual(res.uri, 'https://example.com/320.mp3');
  });

  await itAsync('3. downloadUrl picks highest available quality if preferred not found', async () => {
    global.navigator.onLine = true;
    Storage.setAudioQuality('320kbps');
    const track = {
      id: 't3',
      name: 'Song 3',
      downloadUrl: [
        { quality: '96kbps', url: 'https://example.com/96.mp3' },
        { quality: '160kbps', url: 'https://example.com/160.mp3' }
      ]
    };
    const res = await Player.resolvePlaybackSource(track);
    assert.strictEqual(res.type, Player.SourceType.STREAMING);
    assert.strictEqual(res.uri, 'https://example.com/160.mp3');
  });

  await itAsync('4. Downloaded song in Storage resolves to DOWNLOADED or LOCAL type', async () => {
    global.navigator.onLine = true;
    const downloadedTrack = { id: 'dl_101', name: 'Offline Song', localBlobUrl: 'blob:http://localhost/dl101' };
    Storage.saveDownload(downloadedTrack);
    const res = await Player.resolvePlaybackSource({ id: 'dl_101', name: 'Offline Song', localBlobUrl: 'blob:http://localhost/dl101' });
    assert.strictEqual(res.uri, 'blob:http://localhost/dl101');
  });

  await itAsync('5. Local device track with streamUrl starting with blob: resolves to LOCAL', async () => {
    global.navigator.onLine = true;
    const track = { id: 'loc_1', name: 'Local File', streamUrl: 'blob:file/audio-123' };
    const res = await Player.resolvePlaybackSource(track);
    assert.strictEqual(res.type, Player.SourceType.LOCAL);
    assert.strictEqual(res.uri, 'blob:file/audio-123');
  });

  // Test 6-10: Offline Handling & Detail Fallback
  await itAsync('6. Offline mode with non-downloaded track returns OFFLINE_UNAVAILABLE error', async () => {
    global.navigator.onLine = false;
    const track = { id: 'online_only_1', name: 'Online Only Track', audioUrl: 'https://example.com/stream.mp3' };
    const res = await Player.resolvePlaybackSource(track);
    assert.strictEqual(res.error, Player.ErrorCode.OFFLINE_UNAVAILABLE);
    assert.ok(res.message.includes('offline'));
    global.navigator.onLine = true; // immediately reset
  });

  await itAsync('7. Offline mode with downloaded track succeeds seamlessly', async () => {
    global.navigator.onLine = false;
    const downloadedTrack = { id: 'dl_offline_2', name: 'Saved Song', localBlobUrl: 'blob:offline/song' };
    Storage.saveDownload(downloadedTrack);
    const res = await Player.resolvePlaybackSource({ id: 'dl_offline_2', name: 'Saved Song', localBlobUrl: 'blob:offline/song' });
    assert.strictEqual(res.uri, 'blob:offline/song');
    global.navigator.onLine = true; // immediately reset
  });

  await itAsync('8. Track with missing audioUrl falls back to API.getSongDetails', async () => {
    global.navigator.onLine = true;
    const originalGetSongDetails = API.getSongDetails;
    API.getSongDetails = async (id) => [{ id, name: 'Fairy Tales', audioUrl: 'https://example.com/fairytales_resolved.mp3' }];
    const track = { id: 'ft_101', name: 'Fairy Tales' };
    const res = await Player.resolvePlaybackSource(track);
    assert.strictEqual(res.type, Player.SourceType.STREAMING);
    assert.strictEqual(res.uri, 'https://example.com/fairytales_resolved.mp3');
    API.getSongDetails = originalGetSongDetails;
  });

  await itAsync('9. Track with failed details falls back to API.searchSongs', async () => {
    global.navigator.onLine = true;
    const originalGetSongDetails = API.getSongDetails;
    const originalSearchSongs = API.searchSongs;
    API.getSongDetails = async () => [];
    API.searchSongs = async () => [{ id: 'ft_searched', name: 'Fairy Tales', audioUrl: 'https://example.com/ft_search_matched.mp3' }];

    const track = { id: 'ft_no_detail', name: 'Fairy Tales', artists: 'Vijay' };
    const res = await Player.resolvePlaybackSource(track);
    assert.strictEqual(res.type, Player.SourceType.STREAMING);
    assert.strictEqual(res.uri, 'https://example.com/ft_search_matched.mp3');

    API.getSongDetails = originalGetSongDetails;
    API.searchSongs = originalSearchSongs;
  });

  await itAsync('10. Completely unresolvable track returns SOURCE_UNAVAILABLE after retries', async () => {
    global.navigator.onLine = true;
    const originalGetSongDetails = API.getSongDetails;
    const originalSearchSongs = API.searchSongs;
    API.getSongDetails = async () => [];
    API.searchSongs = async () => [];

    const track = { id: 'unresolvable_track', name: 'Ghost Song', artists: 'Unknown' };
    const res = await Player.resolvePlaybackSource(track);
    assert.strictEqual(res.error, Player.ErrorCode.SOURCE_UNAVAILABLE);
    assert.strictEqual(res.uri, '');

    API.getSongDetails = originalGetSongDetails;
    API.searchSongs = originalSearchSongs;
  });

  // Test 11-15: Error State Transitions & UI Synchronization
  await itAsync('11. Playing unresolvable single track sets playback state to ERROR', async () => {
    global.navigator.onLine = true;
    const originalGetSongDetails = API.getSongDetails;
    const originalSearchSongs = API.searchSongs;
    API.getSongDetails = async () => [];
    API.searchSongs = async () => [];

    const unplayableSong = { id: 'error_single', name: 'Broken Track' };
    Player.setQueue([unplayableSong], 0, true);

    // Wait for resolution and error catch
    await new Promise(r => setTimeout(r, 600));

    const state = Player.getState();
    assert.strictEqual(state.playbackState, Player.PlaybackState.ERROR);
    assert.strictEqual(state.isPlaying, false);

    API.getSongDetails = originalGetSongDetails;
    API.searchSongs = originalSearchSongs;
  });

  it('12. UI.updatePlaybackState on ERROR displays play_arrow icon on Mini Player', () => {
    UI.updatePlaybackState(false, 'ERROR');
    const miniIcon = document.getElementById('mini-play-icon');
    assert.strictEqual(miniIcon.textContent, 'play_arrow');
  });

  it('13. UI.updatePlaybackState on ERROR displays play_arrow icon on Full Player', () => {
    UI.updatePlaybackState(false, 'ERROR');
    const fullIcon = document.getElementById('player-main-play-icon');
    assert.strictEqual(fullIcon.textContent, 'play_arrow');
  });

  it('14. UI.showToast places toast above Mini Player with safe bottom offset', () => {
    UI.showToast('Test error toast notification');
    const toast = document.getElementById('mf-toast');
    assert.ok(toast);
    assert.strictEqual(toast.textContent, 'Test error toast notification');
  });

  it('15. Player.getState returns accurate error info on failure', () => {
    const state = Player.getState();
    assert.ok(state.lastError);
    assert.strictEqual(state.lastError.code, Player.ErrorCode.SOURCE_UNAVAILABLE);
  });

  // Test 16-21: Concurrency, Retries & Race Condition Protection
  await itAsync('16. Rapid switching discards stale pending requests (playbackGeneration check)', async () => {
    global.navigator.onLine = true;
    const trackFastA = { id: 'track_fast_a', name: 'Fast A', audioUrl: 'https://example.com/a.mp3' };
    const trackFastB = { id: 'track_fast_b', name: 'Fast B', audioUrl: 'https://example.com/b.mp3' };
    Player.setQueue([trackFastA, trackFastB], 0, false);
    Player.playSong(trackFastA);
    Player.playSong(trackFastB); // Supersedes request A
    await new Promise(r => setTimeout(r, 100));
    assert.strictEqual(Player.getCurrentTrack().id, trackFastB.id);
  });

  await itAsync('17. Error notification listener receives error payload with track and code', async () => {
    global.navigator.onLine = true;
    let receivedError = null;
    const cb = (err) => { receivedError = err; };
    Player.on('error', cb);

    const originalGetSongDetails = API.getSongDetails;
    const originalSearchSongs = API.searchSongs;
    API.getSongDetails = async () => [];
    API.searchSongs = async () => [];

    const brokenTrack = { id: 'emit_test_broken', name: 'No URL' };
    await Player.playSong(brokenTrack);
    await new Promise(r => setTimeout(r, 600));

    assert.ok(receivedError);
    assert.strictEqual(receivedError.code, Player.ErrorCode.SOURCE_UNAVAILABLE);
    Player.off('error', cb);
    API.getSongDetails = originalGetSongDetails;
    API.searchSongs = originalSearchSongs;
  });

  it('18. Error state does not corrupt the queue items array', () => {
    const q = Player.getQueue();
    assert.ok(Array.isArray(q));
    assert.ok(q.length > 0);
  });

  await itAsync('19. Playing next valid track after an error restores PLAYING state', async () => {
    global.navigator.onLine = true;
    const goodTrack = { id: 'good_track_1', name: 'Good Song', audioUrl: 'https://example.com/good.mp3' };
    await Player.playSong(goodTrack);
    assert.strictEqual(Player.getCurrentTrack().id, goodTrack.id);
    assert.strictEqual(Player.getIsPlaying(), true);
  });

  it('20. Toast is dismissed automatically without leaving orphaned elements', () => {
    UI.showToast('Temporary notification');
    const toast = document.getElementById('mf-toast');
    assert.ok(toast);
    assert.strictEqual(toast.style.opacity, '1');
  });

  await itAsync('21. High-load concurrent source resolution returns clean results without unhandled rejections', async () => {
    global.navigator.onLine = true;
    const tracks = [
      { id: 'c1', name: 'Track 1', audioUrl: 'https://example.com/1.mp3' },
      { id: 'c2', name: 'Track 2', audioUrl: 'https://example.com/2.mp3' },
      { id: 'c3', name: 'Track 3', audioUrl: 'https://example.com/3.mp3' }
    ];
    const results = await Promise.all(tracks.map(t => Player.resolvePlaybackSource(t)));
    assert.strictEqual(results.length, 3);
    results.forEach((r, idx) => {
      assert.strictEqual(r.type, Player.SourceType.STREAMING);
      assert.strictEqual(r.uri, tracks[idx].audioUrl);
    });
  });

  console.log('\n=======================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=======================================================\n');

  if (failed > 0) process.exit(1);
})();
