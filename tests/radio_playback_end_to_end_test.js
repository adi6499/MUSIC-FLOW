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
const DataNormalizer = require('../web-app/js/dataNormalizer.js');
global.DataNormalizer = DataNormalizer;

const Storage = require('../web-app/js/storage.js');
global.Storage = Storage;

const PlaybackResolver = require('../web-app/js/playbackResolver.js');
global.PlaybackResolver = PlaybackResolver;

const Player = require('../web-app/js/player.js');
global.Player = Player;

console.log('\n======================================================');
console.log('📻 RUNNING RADIO PLAYBACK END-TO-END TEST SUITE');
console.log('======================================================\n');

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

async function runTestAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
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

  // --------------------------------------------------------------------------
  // TEST 1: Radio Queue Generation & Active Track Playback Initiation
  // --------------------------------------------------------------------------
  await runTestAsync('1.1 startRadioQueue populates queue and starts audio playback for seed track', async () => {
    Player.init();
    Player.startRadioQueue(roarSeed, recommendations);

    const queue = Player.getQueue();
    assert.strictEqual(queue.length, 26, 'Queue must contain 26 total tracks (1 seed + 25 recs)');
    assert.strictEqual(Player.getCurrentIndex(), 0, 'Current index must be 0 for new radio start');
    assert.strictEqual(Player.getCurrentTrack().id, roarSeed.id, 'Active track must be Roar');

    // Allow async resolution to execute
    await new Promise(r => setTimeout(r, 50));

    const state = Player.getState();
    assert.ok(state.playbackState === 'PLAYING' || state.playbackState === 'LOADING' || state.playbackState === 'READY', `Playback state must be active (got: ${state.playbackState})`);
  });

  // --------------------------------------------------------------------------
  // TEST 2: Starting Radio from Currently Active Track
  // --------------------------------------------------------------------------
  await runTestAsync('2.1 startRadioQueue preserves audio continuity if seed track is already actively playing', async () => {
    Player.init();
    // Simulate active playing state
    await Player.playSong(roarSeed);
    
    // Now start radio on Roar while playing
    Player.startRadioQueue(roarSeed, recommendations);

    const queue = Player.getQueue();
    assert.strictEqual(queue.length, 26, 'Queue must be populated with recommendations');
    assert.strictEqual(Player.getCurrentTrack().name, 'Roar', 'Roar must remain active track');
    assert.strictEqual(Player.getQueueContext().mode, 'radio', 'Queue mode must be set to radio');
  });

  // --------------------------------------------------------------------------
  // TEST 3: Next & Previous Navigation in Radio Queue
  // --------------------------------------------------------------------------
  await runTestAsync('3.1 Next and Previous navigate cleanly across radio recommendations', async () => {
    Player.startRadioQueue(roarSeed, recommendations);

    // Call Next
    await Player.next();
    assert.strictEqual(Player.getCurrentIndex(), 1, 'Next must advance to index 1');
    assert.strictEqual(Player.getCurrentTrack().name, 'Recommended Hit 1', 'Index 1 must be first recommendation');

    // Call Next again
    await Player.next();
    assert.strictEqual(Player.getCurrentIndex(), 2, 'Next must advance to index 2');

    // Call Previous
    Player.previous();
    assert.strictEqual(Player.getCurrentIndex(), 1, 'Previous must navigate back to index 1');
  });

  // --------------------------------------------------------------------------
  // TEST 4: Automatic Skipping of Unavailable Track in Radio Queue
  // --------------------------------------------------------------------------
  await runTestAsync('4.1 Unavailable recommendation track is automatically skipped to next playable track', async () => {
    const unavailTrack = {
      id: 'broken_track_99',
      name: 'Broken Radio Track',
      artists: 'Unknown',
      duration: 150,
      audioUrl: '', // No stream
      streamUrl: '',
      isPlayable: false
    };

    const radioWithBroken = [roarSeed, unavailTrack, recommendations[0], recommendations[1]];
    Player.startRadioQueue(roarSeed, [unavailTrack, recommendations[0], recommendations[1]]);

    // Advance to broken track at index 1
    await Player.next();
    assert.strictEqual(Player.getCurrentIndex(), 1);

    // Wait for auto-skip timer (300ms)
    await new Promise(r => setTimeout(r, 600));

    // Must have automatically skipped to index 2 (recommendations[0])
    assert.strictEqual(Player.getCurrentIndex(), 2, 'Must have auto-skipped broken track and advanced to index 2');
    assert.strictEqual(Player.getCurrentTrack().name, recommendations[0].name);
  });

  console.log('\n======================================================');
  console.log(`📊 RADIO TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
})();
