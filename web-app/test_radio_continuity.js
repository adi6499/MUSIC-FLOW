// ============================================================================
// MUSICFLOW — START RADIO PLAYBACK CONTINUITY TEST SUITE
// 25 Comprehensive Test Cases for Uninterrupted Radio Transition
// ============================================================================

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// 1. Mock Environment
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
    src: '',
    textContent: '',
    innerHTML: '',
    value: 0,
    paused: true,
    currentTime: 0,
    duration: 320,
    loadCount: 0,
    playCount: 0,
    play() {
      this.paused = false;
      this.playCount++;
      return Promise.resolve();
    },
    pause() {
      this.paused = true;
    },
    load() {
      this.loadCount++;
    },
    setSinkId() {
      return Promise.resolve();
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
    this.duration = 320;
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
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
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

// Test Runner
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
console.log('⚡ MUSICFLOW: START RADIO PLAYBACK CONTINUITY TEST SUITE');
console.log('=======================================================\n');

(async () => {
  const songA = {
    id: 'song_a_101',
    name: 'Kesariya',
    artists: 'Arijit Singh',
    primaryArtist: 'Arijit Singh',
    audioUrl: 'https://example.com/kesariya.mp3',
    duration: 268
  };

  const songB = {
    id: 'song_b_102',
    name: 'Tum Hi Ho',
    artists: 'Arijit Singh',
    primaryArtist: 'Arijit Singh',
    audioUrl: 'https://example.com/tumhiho.mp3',
    duration: 262
  };

  const songC = {
    id: 'song_c_103',
    name: 'Chaleya',
    artists: 'Arijit Singh, Shilpa Rao',
    primaryArtist: 'Arijit Singh',
    audioUrl: 'https://example.com/chaleya.mp3',
    duration: 200
  };

  const songD = {
    id: 'song_d_104',
    name: 'Apna Bana Le',
    artists: 'Arijit Singh',
    primaryArtist: 'Arijit Singh',
    audioUrl: 'https://example.com/apnabanale.mp3',
    duration: 261
  };

  // Test 1-5: Active track playback continuity
  await itAsync('1. Start playing Song A and seek to 02:34 (154 seconds)', async () => {
    Player.init();
    await Player.playSong(songA);
    const audio = Player.getAudioElement();
    audio.currentTime = 154;
    assert.strictEqual(Player.getCurrentTrack().id, songA.id);
    assert.strictEqual(audio.currentTime, 154);
    assert.strictEqual(audio.paused, false);
  });

  await itAsync('2. Calling startRadioQueue with same active track does NOT reload audio source', async () => {
    const audio = Player.getAudioElement();
    const initialLoads = audio.loadCount;
    Player.startRadioQueue(songA, [songB, songC, songD]);
    assert.strictEqual(audio.loadCount, initialLoads, 'audio.load() should not be called when starting radio on active song');
  });

  it('3. Calling startRadioQueue with same active track preserves currentTime at 154s', () => {
    const audio = Player.getAudioElement();
    assert.strictEqual(audio.currentTime, 154, 'currentTime must remain 154s and not reset to 0:00');
  });

  it('4. Calling startRadioQueue preserves active playback (is not paused)', () => {
    const audio = Player.getAudioElement();
    assert.strictEqual(audio.paused, false, 'Audio should continue playing smoothly');
  });

  it('5. Radio queue is populated with Song A as first track and recommendations following', () => {
    const queue = Player.getQueue();
    assert.strictEqual(queue.length, 4);
    assert.strictEqual(queue[0].id, songA.id);
    assert.strictEqual(queue[1].id, songB.id);
    assert.strictEqual(queue[2].id, songC.id);
    assert.strictEqual(queue[3].id, songD.id);
    assert.strictEqual(Player.getCurrentIndex(), 0);
  });

  // Test 6-10: Queue hygiene & duplicate filtering
  it('6. startRadioQueue removes duplicate occurrences of the seed track from recommendations', () => {
    Player.startRadioQueue(songA, [songA, songB, songA, songC]);
    const queue = Player.getQueue();
    const songACount = queue.filter(s => s.id === songA.id).length;
    assert.strictEqual(songACount, 1, 'Seed song should appear only once at index 0');
  });

  it('7. startRadioQueue maintains currentIndex = 0', () => {
    assert.strictEqual(Player.getCurrentIndex(), 0);
  });

  it('8. startRadioQueue notifies queueChange event listeners', () => {
    let notified = false;
    const cb = (q) => { notified = true; };
    Player.on('queueChange', cb);
    Player.startRadioQueue(songA, [songB, songC]);
    assert.strictEqual(notified, true);
    Player.off('queueChange', cb);
  });

  await itAsync('9. startRadioQueue when audio is paused retains paused state and current timestamp', async () => {
    const audio = Player.getAudioElement();
    audio.pause();
    audio.currentTime = 88;
    Player.startRadioQueue(songA, [songB, songC]);
    assert.strictEqual(audio.currentTime, 88);
    assert.strictEqual(audio.paused, true);
  });

  await itAsync('10. startRadioQueue with a DIFFERENT seed song starts that new track from 0:00', async () => {
    await Player.startRadioQueue(songB, [songA, songC]);
    assert.strictEqual(Player.getCurrentTrack().id, songB.id);
    assert.strictEqual(Player.getCurrentIndex(), 0);
  });

  // Test 11-15: Queue transitions & playback flow
  it('11. startRadioQueue handles empty related songs list without error', () => {
    Player.startRadioQueue(songA, []);
    const queue = Player.getQueue();
    assert.strictEqual(queue.length, 1);
    assert.strictEqual(queue[0].id, songA.id);
  });

  it('12. startRadioQueue preserves Favorite status of the current song in Storage', () => {
    Storage.addFavorite(songA);
    Player.startRadioQueue(songA, [songB, songC]);
    assert.strictEqual(Storage.isFavorite(songA.id), true);
  });

  it('13. startRadioQueue preserves Downloaded status of the current song', () => {
    Storage.saveDownload({ ...songA, localBlobUrl: 'blob://local' });
    Player.startRadioQueue(songA, [songB, songC]);
    assert.strictEqual(Storage.isDownloaded(songA.id), true);
  });

  await itAsync('14. Calling next() moves smoothly to Radio Song B', async () => {
    Player.startRadioQueue(songA, [songB, songC]);
    await Player.next();
    assert.strictEqual(Player.getCurrentTrack().id, songB.id);
    assert.strictEqual(Player.getCurrentIndex(), 1);
  });

  await itAsync('15. Calling previous() returns to Song A', async () => {
    const audio = Player.getAudioElement();
    audio.currentTime = 0; // When position <= 3s, previous() goes to prior track
    await Player.previous();
    assert.strictEqual(Player.getCurrentTrack().id, songA.id);
    assert.strictEqual(Player.getCurrentIndex(), 0);
  });

  // Test 16-20: Auto queue continuous radio & rapid calls
  it('16. Setting repeat mode via toggleRepeat cycles repeat modes', () => {
    const initialMode = Player.getRepeatMode();
    Player.toggleRepeat();
    assert.notStrictEqual(Player.getRepeatMode(), initialMode);
  });

  it('17. Toggling shuffle during radio shuffles upcoming radio items', () => {
    Player.startRadioQueue(songA, [songB, songC, songD]);
    if (!Player.getIsShuffle()) Player.toggleShuffle();
    assert.strictEqual(Player.getIsShuffle(), true);
    const q = Player.getQueue();
    assert.strictEqual(q.length, 4);
    assert.strictEqual(q[0].id, songA.id, 'Current track must remain at index 0 when shuffle is toggled');
  });

  it('18. Disabling shuffle restores original radio order', () => {
    if (Player.getIsShuffle()) Player.toggleShuffle();
    assert.strictEqual(Player.getIsShuffle(), false);
    const q = Player.getQueue();
    assert.strictEqual(q[0].id, songA.id);
    assert.strictEqual(q[1].id, songB.id);
  });

  await itAsync('19. Rapid successive calls to startRadioQueue on the active track do not crash or reset audio', async () => {
    const audio = Player.getAudioElement();
    audio.currentTime = 200;
    audio.play();
    for (let i = 0; i < 5; i++) {
      Player.startRadioQueue(songA, [songB, songC, songD]);
    }
    assert.strictEqual(audio.currentTime, 200);
    assert.strictEqual(audio.paused, false);
    assert.strictEqual(Player.getQueue().length, 4);
  });

  it('20. getQueue returns an immutable or safe clone of current radio queue', () => {
    const q = Player.getQueue();
    q.pop();
    assert.strictEqual(Player.getQueue().length, 4, 'Directly mutating returned queue should not corrupt Player internal queue');
  });

  // Test 21-25: API & Storage Session Continuity
  it('21. Session state accurately reflects saved queue and track index', () => {
    Storage.saveSession(Player.getQueue(), Player.getCurrentIndex(), 200);
    const session = Storage.getSession();
    assert.ok(session);
    assert.strictEqual(session.currentIndex, 0);
    assert.strictEqual(session.queue.length, 4);
  });

  it('22. Removing a song from the active radio queue adjusts queue length', () => {
    Player.removeFromQueue(2); // Remove songC
    const q = Player.getQueue();
    assert.strictEqual(q.length, 3);
    assert.strictEqual(q.some(s => s.id === songC.id), false);
  });

  it('23. Reordering radio queue works without changing active track', () => {
    Player.reorderQueue(1, 2);
    const q = Player.getQueue();
    assert.strictEqual(q[0].id, songA.id);
    assert.strictEqual(q[1].id, songD.id);
    assert.strictEqual(q[2].id, songB.id);
  });

  it('24. Appending another song to radio queue adds to end', () => {
    Player.appendToQueue(songC);
    const q = Player.getQueue();
    assert.strictEqual(q.length, 4);
    assert.strictEqual(q[3].id, songC.id);
  });

  it('25. Play Next places new song immediately after active radio track', () => {
    const songE = { id: 'song_e_105', name: 'Deva Deva', artists: 'Arijit Singh', audioUrl: 'https://example.com/deva.mp3' };
    Player.playNext(songE);
    const q = Player.getQueue();
    assert.strictEqual(q[1].id, songE.id);
  });

  console.log('\n=======================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=======================================================\n');

  if (failed > 0) process.exit(1);
})();
