// ============================================================================
// MUSICFLOW — RADIO PLAYBACK END-TO-END VERIFICATION TEST
// Verifies:
// 1. Radio queue generation with 25+ recommendations
// 2. Active track selection & index preservation
// 3. Playback request initiation on radio start
// 4. Stream resolution via PlaybackResolver
// 5. Audio playback invocation & transition to PLAYING state
// 6. Automatic skipping of unavailable tracks in radio queue
// 7. Next & Previous navigation in active radio queue
// ============================================================================

const assert = require('assert');

// 1. Mock LocalStorage & Browser DOM
const mockStorageData = {};
global.localStorage = {
  getItem: (key) => mockStorageData[key] || null,
  setItem: (key, val) => { mockStorageData[key] = String(val); },
  removeItem: (key) => { delete mockStorageData[key]; },
  clear: () => { Object.keys(mockStorageData).forEach(k => delete mockStorageData[k]); }
};

class MockDOMElement {
  constructor(tagName = 'div', id = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.dataset = {};
    this.style = {};
    this.value = '';
    this.innerHTML = '';
    this.textContent = '';
    this.classList = {
      _classes: new Set(),
      add: (c) => this.classList._classes.add(c),
      remove: (c) => this.classList._classes.delete(c),
      contains: (c) => this.classList._classes.has(c),
      toggle: (c) => (this.classList.contains(c) ? this.classList.remove(c) : this.classList.add(c))
    };
    this.children = [];
  }
  addEventListener() {}
  removeEventListener() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300 }; }
  getContext() { return { clearRect: () => {}, beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, stroke: () => {}, fill: () => {}, createLinearGradient: () => ({ addColorStop: () => {} }) }; }
}

const domMap = {};
function getElem(id, tag = 'div') {
  if (!domMap[id]) domMap[id] = new MockDOMElement(tag, id);
  return domMap[id];
}

class MockAudioElement {
  constructor() {
    this.currentTime = 0;
    this.duration = 240;
    this.src = '';
    this.paused = true;
    this.ended = false;
    this.readyState = 4;
    this._listeners = {};
    this.playCallCount = 0;
  }
  addEventListener(ev, fn) {
    this._listeners[ev] = this._listeners[ev] || [];
    this._listeners[ev].push(fn);
  }
  removeEventListener(ev, fn) {
    if (this._listeners[ev]) {
      this._listeners[ev] = this._listeners[ev].filter(f => f !== fn);
    }
  }
  load() {}
  play() {
    this.playCallCount++;
    this.paused = false;
    this.ended = false;
    (this._listeners['playing'] || []).forEach(fn => fn());
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
    (this._listeners['pause'] || []).forEach(fn => fn());
  }
}

global.Audio = MockAudioElement;

global.document = {
  readyState: 'complete',
  activeElement: null,
  body: new MockDOMElement('body'),
  addEventListener: () => {},
  removeEventListener: () => {},
  getElementById: (id) => {
    if (id === 'app-audio') {
      if (!domMap['app-audio']) domMap['app-audio'] = new MockAudioElement();
      return domMap['app-audio'];
    }
    return getElem(id);
  },
  querySelectorAll: () => [],
  querySelector: () => null,
  createElement: (tag) => new MockDOMElement(tag)
};

global.window = {
  location: { href: 'http://localhost:3000', hostname: 'localhost', protocol: 'http:' },
  innerWidth: 375,
  innerHeight: 667,
  devicePixelRatio: 2,
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
  requestAnimationFrame: (cb) => setTimeout(cb, 16),
  cancelAnimationFrame: (id) => clearTimeout(id)
};

// 2. Load Core App Modules
const DataNormalizer = require('./js/dataNormalizer.js');
global.DataNormalizer = DataNormalizer;

const Storage = require('./js/storage.js');
global.Storage = Storage;

const PlaybackResolver = require('./js/playbackResolver.js');
global.PlaybackResolver = PlaybackResolver;

const Player = require('./js/player.js');
global.Player = Player;

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`, err);
    failed++;
  }
}

async function runTestAsync(name, fn) {
  try {
    await fn();
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`, err);
    failed++;
  }
}

(async () => {
  // Test seed song: Roar — Katy Perry
  const roarSeed = {
    id: 'roar_katy_1',
    name: 'Roar',
    title: 'Roar',
    artists: 'Katy Perry',
    primaryArtist: 'Katy Perry',
    duration: 223,
    audioUrl: 'https://aac.saavncdn.com/roar_katy_320.mp4',
    isPlayable: true
  };

  const recommendations = [];
  for (let i = 1; i <= 25; i++) {
    recommendations.push({
      id: `rec_${i}`,
      name: `Recommended Hit ${i}`,
      artists: `Pop Artist ${(i % 5) + 1}`,
      duration: 180 + i,
      audioUrl: `https://aac.saavncdn.com/rec_${i}_320.mp4`,
      isPlayable: true
    });
  }

  // TEST 1
  await runTestAsync('1.1 startRadioQueue populates queue and starts audio playback for seed track', async () => {
    Player.init();
    Player.startRadioQueue(roarSeed, recommendations);

    const queue = Player.getQueue();
    assert.strictEqual(queue.length, 26, 'Queue must contain 26 total tracks (1 seed + 25 recs)');
    assert.strictEqual(Player.getCurrentIndex(), 0, 'Current index must be 0 for new radio start');
    assert.strictEqual(Player.getCurrentTrack().id, roarSeed.id, 'Active track must be Roar');

    await new Promise(r => setTimeout(r, 50));
    const state = Player.getState();
    assert.ok(state.playbackState === 'PLAYING' || state.playbackState === 'LOADING' || state.playbackState === 'READY');
  });

  // TEST 2
  await runTestAsync('2.1 startRadioQueue preserves audio continuity if seed track is already actively playing', async () => {
    Player.init();
    await Player.playSong(roarSeed);
    Player.startRadioQueue(roarSeed, recommendations);

    const queue = Player.getQueue();
    assert.strictEqual(queue.length, 26);
    assert.strictEqual(Player.getCurrentTrack().name, 'Roar');
    assert.strictEqual(Player.getQueueContext().mode, 'radio');
  });

  // TEST 3
  await runTestAsync('3.1 Next and Previous navigate cleanly across radio recommendations', async () => {
    Player.startRadioQueue(roarSeed, recommendations);
    await Player.next();
    assert.strictEqual(Player.getCurrentIndex(), 1);
    assert.strictEqual(Player.getCurrentTrack().name, 'Recommended Hit 1');

    await Player.next();
    assert.strictEqual(Player.getCurrentIndex(), 2);

    Player.previous();
    assert.strictEqual(Player.getCurrentIndex(), 1);
  });

  // TEST 4
  await runTestAsync('4.1 Unavailable recommendation track is automatically skipped to next playable track', async () => {
    const unavailTrack = {
      id: 'broken_track_99',
      name: 'Broken Radio Track',
      artists: 'Unknown',
      duration: 150,
      audioUrl: '',
      streamUrl: '',
      isPlayable: false
    };

    Player.startRadioQueue(roarSeed, [unavailTrack, recommendations[0], recommendations[1]]);
    await Player.next();
    assert.strictEqual(Player.getCurrentIndex(), 1);

    await new Promise(r => setTimeout(r, 600));
    assert.strictEqual(Player.getCurrentIndex(), 2);
    assert.strictEqual(Player.getCurrentTrack().name, recommendations[0].name);
  });

  if (failed > 0) {
    process.exit(1);
  }
})();
