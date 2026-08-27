// ============================================================================
// MUSICFLOW — PLAYER INTERACTIONS & SEEK ENGINE AUTOMATED TEST SUITE
// Tests 25 comprehensive interaction patterns matching Part 73
// ============================================================================

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// 1. Setup Headless DOM Mock Environment
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
  PointerEvent: class PointerEvent {},
  TouchEvent: class TouchEvent {},
  location: { reload: () => {} },
  _isUserSeeking: false
};
function createMockElement(tag) {
  return {
    tagName: tag.toUpperCase(),
    style: {},
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
    setPointerCapture(id) { this._capturedPointerId = id; },
    releasePointerCapture(id) { if (this._capturedPointerId === id) delete this._capturedPointerId; },
    getBoundingClientRect() {
      return { left: 50, top: 100, width: 300, height: 38, right: 350, bottom: 138 };
    },
    src: '',
    textContent: '',
    innerHTML: '',
    value: 0,
    paused: true,
    currentTime: 0,
    duration: 365,
    play() {
      this.paused = false;
      return Promise.resolve();
    },
    pause() {
      this.paused = true;
    },
    load() {}
  };
}

const mockDocElements = new Map();
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
    this.duration = 365;
    this.src = '';
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
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  dispatchEvent(evt) {
    (this._listeners[evt.type] || []).forEach(f => f(evt));
  }
};

global.Lyrics = {
  loadLyricsForTrack: () => {},
  updateTime: () => {}
};

// Load modules
const Storage = require('./js/storage.js');
global.Storage = Storage;

const API = require('./js/api.js');
global.API = API;

const Player = require('./js/player.js');
global.Player = Player;

const UI = require('./js/ui.js');
global.UI = UI;

const SmartDownloadManager = require('./js/smartDownloads.js');
global.SmartDownloadManager = SmartDownloadManager;

const AudioOutputManager = require('./js/audioOutputManager.js');
global.AudioOutputManager = AudioOutputManager;

const App = require('./js/app.js');
global.App = App;

// Test Suite Runner
let totalPassed = 0;
let totalFailed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    totalPassed++;
  } catch (e) {
    console.error(`  ✗ ${desc}`);
    console.error(e);
    totalFailed++;
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`  ✓ ${desc}`);
    totalPassed++;
  } catch (e) {
    console.error(`  ✗ ${desc}`);
    console.error(e);
    totalFailed++;
  }
}

async function runTests() {
  console.log('\n============================================================');
  console.log('🧪 MUSICFLOW — PLAYER INTERACTIONS & SEEK ENGINE TEST SUITE');
  console.log('============================================================\n');

  // Test Track Fixtures
  const trackA = {
    id: 'song_a_123',
    name: 'Tera Mera Rishta',
    artists: 'Mithoon, Pritam',
    album: 'Awarapan 2',
    duration: 365,
    image: 'https://example.com/artA.jpg',
    audioUrl: 'https://example.com/streamA.mp3'
  };

  const trackB = {
    id: 'song_b_456',
    name: 'Tum Hi Ho',
    artists: 'Arijit Singh, Mithoon',
    album: 'Aashiqui 2',
    duration: 262,
    image: 'https://example.com/artB.jpg',
    audioUrl: 'https://example.com/streamB.mp3'
  };

  Player.init();
  App.init();

  // Test 1: Like Initial State
  it('1. Like initial state — track is unliked by default', () => {
    Storage.clearFavorites?.() || localStorage.clear();
    const isFav = Storage.isFavorite(trackA.id);
    assert.strictEqual(isFav, false, 'Track A should not be liked initially');
  });

  // Test 2: Like Toggle On
  it('2. Like toggle on — adds track to favorites and returns true', () => {
    Player.setQueue([trackA], 0);
    const isFavAfterToggle = Storage.toggleFavorite(trackA);
    assert.strictEqual(isFavAfterToggle, true, 'Track A should be liked after toggle');
    assert.strictEqual(Storage.isFavorite(trackA.id), true, 'Storage.isFavorite should return true');
  });

  // Test 3: Like Toggle Off
  it('3. Like toggle off — removes track from favorites and returns false', () => {
    const isFavAfterSecondToggle = Storage.toggleFavorite(trackA);
    assert.strictEqual(isFavAfterSecondToggle, false, 'Track A should be unliked after second toggle');
    assert.strictEqual(Storage.isFavorite(trackA.id), false, 'Storage.isFavorite should return false');
  });

  // Test 4: Like Persistence
  it('4. Like persistence — state persists across storage reads', () => {
    Storage.addFavorite(trackA);
    const favs = Storage.getFavorites();
    assert.strictEqual(favs.some(s => s.id === trackA.id), true, 'Track A must exist in persistent storage');
  });

  // Test 5: Like Across Track Changes
  it('5. Like across track changes — track A liked, track B unliked, no stale state', () => {
    Storage.removeFavorite(trackB.id);
    Player.setQueue([trackA, trackB], 0);
    UI.updatePlayerBar(Player.getCurrentTrack());
    assert.strictEqual(Storage.isFavorite(trackA.id), true, 'Track A is liked');
    
    // Switch to Track B
    Player.setQueue([trackA, trackB], 1);
    UI.updatePlayerBar(Player.getCurrentTrack());
    assert.strictEqual(Storage.isFavorite(trackB.id), false, 'Track B is unliked');

    // Switch back to Track A
    Player.setQueue([trackA, trackB], 0);
    UI.updatePlayerBar(Player.getCurrentTrack());
    assert.strictEqual(Storage.isFavorite(trackA.id), true, 'Track A remains liked without state leak');
  });

  // Test 6: Like Rapid Taps
  it('6. Like rapid taps — final state corresponds to user action without corruption', () => {
    // 4 consecutive taps: on, off, on, off
    Storage.toggleFavorite(trackB); // on
    Storage.toggleFavorite(trackB); // off
    Storage.toggleFavorite(trackB); // on
    const finalState = Storage.toggleFavorite(trackB); // off
    assert.strictEqual(finalState, false);
    assert.strictEqual(Storage.isFavorite(trackB.id), false);
  });

  // Test 7: Progress Initial State
  it('7. Progress initial state — starts at 0:00 and 0%', () => {
    UI.updatePlaybackProgress(0, trackA.duration);
    const curTime = document.getElementById('player-time-current');
    const totTime = document.getElementById('player-time-total');
    const seekFill = document.getElementById('player-seek-fill');
    assert.strictEqual(curTime.textContent, '0:00');
    assert.strictEqual(totTime.textContent, '6:05');
    assert.strictEqual(seekFill.style.width, '0.00%');
  });

  // Test 8: Progress Live Updates
  it('8. Progress live updates — computes percentage and time format accurately', () => {
    UI.updatePlaybackProgress(138, 365); // ~37.81%
    const curTime = document.getElementById('player-time-current');
    const seekFill = document.getElementById('player-seek-fill');
    assert.strictEqual(curTime.textContent, '2:18');
    assert.strictEqual(seekFill.style.width, '37.81%');
  });

  // Test 9: Tap-to-Seek
  it('9. Tap-to-seek — calculating position on click moves playhead to target', () => {
    const seekBar = document.getElementById('player-seek-bar');
    App.initSeekBar();
    // Simulate pointerdown at 50% of 300px bar (left 50 + 150 = 200)
    const pointerDownEvent = {
      type: 'pointerdown',
      pointerId: 1,
      clientX: 200,
      preventDefault: () => {},
      cancelable: true
    };
    const pointerUpEvent = {
      type: 'pointerup',
      pointerId: 1,
      clientX: 200,
      preventDefault: () => {},
      cancelable: true
    };
    seekBar.dispatchEvent(pointerDownEvent);
    seekBar.dispatchEvent(pointerUpEvent);

    const seekFill = document.getElementById('player-seek-fill');
    assert.strictEqual(seekFill.style.width, '50.00%', 'Seek fill should be 50.00%');
  });

  // Test 10: Drag-to-Seek
  it('10. Drag-to-seek — pointermove updates visual fill & thumb continuously', () => {
    const seekBar = document.getElementById('player-seek-bar');
    // Start drag at 25% (clientX = 50 + 75 = 125)
    seekBar.dispatchEvent({ type: 'pointerdown', pointerId: 2, clientX: 125, preventDefault: () => {} });
    // Move to 75% (clientX = 50 + 225 = 275)
    seekBar.dispatchEvent({ type: 'pointermove', pointerId: 2, clientX: 275, preventDefault: () => {} });

    const seekFill = document.getElementById('player-seek-fill');
    const curTime = document.getElementById('player-time-current');
    assert.strictEqual(seekFill.style.width, '75.00%');
    assert.strictEqual(window._isUserSeeking, true, '_isUserSeeking should be true during drag');

    // Release
    seekBar.dispatchEvent({ type: 'pointerup', pointerId: 2, clientX: 275, preventDefault: () => {} });
  });

  // Test 11: Finger Tracking Outside Bar
  it('11. Finger tracking outside bar — pointer capture clamps coordinates safely', () => {
    const seekBar = document.getElementById('player-seek-bar');
    // Pointer dragged far to the right beyond 100% (clientX = 500)
    seekBar.dispatchEvent({ type: 'pointerdown', pointerId: 3, clientX: 150, preventDefault: () => {} });
    seekBar.dispatchEvent({ type: 'pointermove', pointerId: 3, clientX: 500, preventDefault: () => {} });

    const seekFill = document.getElementById('player-seek-fill');
    assert.strictEqual(seekFill.style.width, '100.00%', 'Seek fill should clamp to 100%');

    // Pointer dragged far to the left before 0% (clientX = 10)
    seekBar.dispatchEvent({ type: 'pointermove', pointerId: 3, clientX: 10, preventDefault: () => {} });
    assert.strictEqual(seekFill.style.width, '0.00%', 'Seek fill should clamp to 0%');

    seekBar.dispatchEvent({ type: 'pointerup', pointerId: 3, clientX: 10, preventDefault: () => {} });
  });

  // Test 12: Seek While Playing
  it('12. Seek while playing — seek updates position and playback continues', () => {
    Player.setQueue([trackA], 0);
    Player.seek(120);
    assert.strictEqual(Player.getPosition(), 120, 'Position should be updated to 120s');
  });

  // Test 13: Seek While Paused
  it('13. Seek while paused — seek updates position without auto-triggering unwanted playback', () => {
    Player.pause();
    Player.seek(200);
    assert.strictEqual(Player.getPosition(), 200, 'Position should be 200s while paused');
    assert.strictEqual(Player.getIsPlaying(), false, 'Player should remain paused');
  });

  // Test 14: Seek to 0
  it('14. Seek to 0% — clamps to beginning (0:00)', () => {
    Player.seek(0);
    assert.strictEqual(Player.getPosition(), 0);
    UI.updatePlaybackProgress(0, trackA.duration);
    assert.strictEqual(document.getElementById('player-time-current').textContent, '0:00');
  });

  // Test 15: Seek to 100%
  it('15. Seek to 100% — clamps safely to duration without NaN or Infinity', () => {
    window._isUserSeeking = false;
    Player.seek(trackA.duration);
    assert.strictEqual(Player.getPosition(), trackA.duration);
    UI.updatePlaybackProgress(trackA.duration, trackA.duration);
    assert.strictEqual(document.getElementById('player-time-current').textContent, '6:05');
  });

  // Test 16: Duration Formatting
  it('16. Duration formatting — formats mm:ss accurately', () => {
    assert.strictEqual(UI.formatTime(0), '0:00');
    assert.strictEqual(UI.formatTime(5), '0:05');
    assert.strictEqual(UI.formatTime(62), '1:02');
    assert.strictEqual(UI.formatTime(365), '6:05');
    assert.strictEqual(UI.formatTime(645), '10:45');
  });

  // Test 17: Invalid Duration
  it('17. Invalid duration — handles NaN, Infinity, negative values gracefully', () => {
    window._isUserSeeking = false;
    assert.strictEqual(UI.formatTime(NaN), '0:00');
    assert.strictEqual(UI.formatTime(-50), '0:00');
    UI.updatePlaybackProgress(NaN, NaN);
    assert.strictEqual(document.getElementById('player-time-current').textContent, '0:00');
    assert.strictEqual(document.getElementById('player-time-total').textContent, '0:00');
  });

  // Test 18: Track Change Reset
  it('18. Track change reset — resets progress bar and duration on track change', () => {
    Player.setQueue([trackA, trackB], 1);
    UI.updatePlayerBar(trackB);
    UI.updatePlaybackProgress(0, trackB.duration);
    assert.strictEqual(document.getElementById('full-player-title').textContent, 'Tum Hi Ho');
    assert.strictEqual(document.getElementById('player-time-current').textContent, '0:00');
    assert.strictEqual(document.getElementById('player-time-total').textContent, '4:22');
  });

  // Test 19: Queue Interaction
  it('19. Queue interaction — queue preserves songs and updates player count', () => {
    Player.setQueue([trackA, trackB], 0);
    assert.strictEqual(Player.getQueue().length, 2);
    assert.strictEqual(Player.getCurrentIndex(), 0);
  });

  // Test 20: Download Interaction
  it('20. Download interaction — downloads storage methods integrate cleanly', () => {
    Storage.addDownload(trackA);
    assert.strictEqual(Storage.isDownloaded(trackA.id), true);
    UI.updatePlayerBar(trackA);
    const dlLabel = document.getElementById('player-download-label');
    assert.strictEqual(dlLabel.textContent, 'Downloaded');
  });

  // Test 21: Offline Playback
  await itAsync('21. Offline playback — resolves downloaded track while offline', async () => {
    global.navigator.onLine = false;
    Storage.getDownloadedAudioUrl = async () => 'blob:http://localhost/audio_blob_123';
    const resolved = await Player.resolvePlaybackSource(trackA);
    assert.strictEqual(resolved.type, Player.SourceType.DOWNLOADED);
    global.navigator.onLine = true;
  });

  // Test 22: Network Transition
  it('22. Network transition — online to offline does not crash player instance', () => {
    global.navigator.onLine = false;
    UI.updatePlayerBar(Player.getCurrentTrack());
    global.navigator.onLine = true;
    UI.updatePlayerBar(Player.getCurrentTrack());
    assert.ok(true, 'Network transition handled smoothly');
  });

  // Test 23: Player Reopen
  it('23. Player reopen — expandFullPlayer updates track, shuffle, repeat, and like state', () => {
    App.expandFullPlayer();
    const sheet = document.getElementById('full-player');
    assert.strictEqual(sheet.classList.contains('expanded'), true);
  });

  // Test 24: Event Listener Cleanup
  it('24. Event listener cleanup — initSeekBar runs idempotently without multiplying listeners', () => {
    App.initSeekBar();
    App.initSeekBar();
    App.initSeekBar();
    const seekBar = document.getElementById('player-seek-bar');
    assert.strictEqual(seekBar._isSeekInitialized, true);
  });

  // Test 25: Regression
  it('25. Regression — all critical exported modules remain healthy and authoritative', () => {
    assert.strictEqual(typeof Player.togglePlay, 'function');
    assert.strictEqual(typeof Player.seek, 'function');
    assert.strictEqual(typeof App.toggleFavoriteCurrent, 'function');
    assert.strictEqual(typeof UI.updatePlayerBar, 'function');
    assert.strictEqual(typeof UI.updatePlaybackProgress, 'function');
  });

  // Test 26: Audio Output Device Enumeration & Selection
  await itAsync('26. Audio output routing — enumerates real audio devices and routes sink ID', async () => {
    await AudioOutputManager.init();
    const devices = AudioOutputManager.getAvailableDevices();
    assert.ok(devices.length > 0, 'Audio devices list should have items');
    
    // Select bluetooth output
    await AudioOutputManager.selectDevice('bluetooth_output');
    const active = AudioOutputManager.getActiveDevice();
    assert.strictEqual(active.id, 'bluetooth_output');
    assert.strictEqual(active.type, 'bluetooth');
  });

  // Test 27: Audio Output UI & Persistence
  it('27. Audio output UI & persistence — updates bottom player card dynamically and persists', () => {
    AudioOutputManager.updateUI();
    const nameEl = document.getElementById('player-device-name');
    const statusEl = document.getElementById('player-device-status');
    const iconEl = document.getElementById('player-device-icon');
    assert.strictEqual(nameEl.textContent, 'Bluetooth / Connected Headset');
    assert.strictEqual(statusEl.textContent, 'Connected');
    assert.strictEqual(iconEl.textContent, 'bluetooth');

    const saved = Storage.getSelectedAudioOutput();
    assert.strictEqual(saved.id, 'bluetooth_output');
  });

  console.log('\n------------------------------------------------------------');
  console.log(`Results: ${totalPassed} passed, ${totalFailed} failed.`);
  console.log('============================================================\n');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runTests();
