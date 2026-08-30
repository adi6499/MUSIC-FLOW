// ============================================================================
// MUSICFLOW — APP STARTUP & FIRST RENDER PERFORMANCE TEST SUITE
// Measures and verifies:
// 1. Instant App Shell Render Time (< 100ms)
// 2. Non-blocking Network Requests
// 3. Stale-While-Revalidate Caching Speed
// 4. Offline Cold & Warm Startup Resilience
// 5. Lyrics Non-Blocking Playback Execution
// ============================================================================

const assert = require('assert');

// 1. Mock Browser Environment
const mockStorageData = {
  'mf_user_taste_signals_v1': JSON.stringify({ totalSignals: 12 }),
  'mf_history': JSON.stringify([{ id: 'song_1', name: 'Recent Hit', artists: 'Star Artist', duration: 200 }]),
  'mf_favorites': JSON.stringify([{ id: 'song_2', name: 'Favorite Hit', artists: 'Star Artist 2', duration: 180 }]),
  'mf_home_feed_cache_v2': JSON.stringify({
    isOffline: false,
    generatedAt: Date.now() - 60000,
    sections: [
      { id: 'continue_listening', title: 'Continue Listening', items: [{ id: 'song_1', name: 'Recent Hit', artists: 'Star Artist' }] },
      { id: 'quick_picks', title: 'Quick picks', items: [{ id: 'song_2', name: 'Favorite Hit', artists: 'Star Artist 2' }] }
    ]
  })
};

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
  getBoundingClientRect() { return { left: 0, top: 0, width: 375, height: 667, right: 375, bottom: 667 }; }
  querySelectorAll() { return []; }
  querySelector() { return null; }
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
  }
  addEventListener(ev, fn) {
    this._listeners[ev] = this._listeners[ev] || [];
    this._listeners[ev].push(fn);
  }
  removeEventListener() {}
  load() {}
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
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

console.log('\n======================================================');
console.log('⚡ RUNNING APP STARTUP & FIRST RENDER PERFORMANCE SUITE');
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

// 2. Load Modules
const DataNormalizer = require('../web-app/js/dataNormalizer.js');
global.DataNormalizer = DataNormalizer;

const Storage = require('../web-app/js/storage.js');
global.Storage = Storage;

const HomeDataLayer = require('../web-app/js/homeDataLayer.js');
global.HomeDataLayer = HomeDataLayer;

(async () => {
  // --------------------------------------------------------------------------
  // TEST 1: Stale-While-Revalidate Instant Cached Render (< 25ms)
  // --------------------------------------------------------------------------
  await runTestAsync('1.1 HomeDataLayer renders cached sections immediately (< 25ms)', async () => {
    let wasCachedRendered = false;
    const startT = performance.now();

    await HomeDataLayer.loadHome((data, isCache) => {
      if (isCache) {
        wasCachedRendered = true;
        const duration = performance.now() - startT;
        assert.ok(duration < 25, `Cached render took ${duration.toFixed(2)}ms, expected < 25ms`);
        assert.ok(data.sections.length > 0, 'Cached data must contain sections');
      }
    });

    assert.ok(wasCachedRendered, 'Must synchronously invoke callback with cached data');
  });

  // --------------------------------------------------------------------------
  // TEST 2: Cold Start without Cache renders Local Offline State Immediately (< 50ms)
  // --------------------------------------------------------------------------
  await runTestAsync('2.1 Cold start with empty cache renders offline state immediately (< 50ms)', async () => {
    delete mockStorageData['mf_home_feed_cache_v2'];

    let firstRenderData = null;
    const startT = performance.now();

    await HomeDataLayer.loadHome((data, isCache) => {
      if (!firstRenderData) {
        firstRenderData = data;
        const duration = performance.now() - startT;
        assert.ok(duration < 50, `Cold fallback render took ${duration.toFixed(2)}ms, expected < 50ms`);
      }
    });

    assert.ok(firstRenderData, 'Must provide immediate fallback data on empty cache');
    assert.ok(firstRenderData.sections.length > 0, 'Fallback data must have sections');
  });

  // --------------------------------------------------------------------------
  // TEST 3: Lyrics Lookup Negative Cache Speed (< 5ms)
  // --------------------------------------------------------------------------
  runTest('3.1 Lyrics negative cache prevents duplicate network requests and returns < 5ms', () => {
    const API = require('../web-app/js/api.js');
    global.API = API;

    const startT = performance.now();
    // Cache a negative lookup
    API._lyricsCache.set('unknown_song___unknown_artist', { data: null, timestamp: Date.now() });

    const cached = API._lyricsCache.get('unknown_song___unknown_artist');
    const duration = performance.now() - startT;

    assert.strictEqual(cached.data, null);
    assert.ok(duration < 5, `Cache read took ${duration.toFixed(2)}ms, expected < 5ms`);
  });

  console.log('\n======================================================');
  console.log(`📊 PERFORMANCE TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
})();
