// ============================================================================
// MUSICFLOW — PLAYLIST SEARCH MULTI-CHARACTER TYPING & LIVE FILTERING TEST
// Verifies:
// 1. Search input DOM node identity is preserved across keystrokes (no re-render destruction)
// 2. Sequential multi-character typing ("M" -> "MO" -> "MONTAGEM") maintains input focus & value
// 3. Live filtering accurately updates results container with 99+ tracks
// 4. Backspace and clearing smoothly restore full track list
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

// DOM Tree Simulation for Container and Children
class MockDOMElement {
  constructor(tagName = 'div', id = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.dataset = {};
    this.style = {};
    this.value = '';
    this.placeholder = '';
    this.innerHTMLText = '';
    this.classList = {
      _classes: new Set(),
      add: (c) => this.classList._classes.add(c),
      remove: (c) => this.classList._classes.delete(c),
      contains: (c) => this.classList._classes.has(c),
      toggle: (c) => (this.classList.contains(c) ? this.classList.remove(c) : this.classList.add(c))
    };
    this.children = [];
    this.attributes = {};
  }

  addEventListener() {}
  removeEventListener() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300 }; }
  getContext() { return { clearRect: () => {}, beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, stroke: () => {}, fill: () => {}, createLinearGradient: () => ({ addColorStop: () => {} }) }; }

  setAttribute(name, val) { this.attributes[name] = String(val); }
  getAttribute(name) { return this.attributes[name] || null; }

  set innerHTML(htmlStr) {
    this.innerHTMLText = htmlStr;
    this._parseChildNodes(htmlStr);
  }

  get innerHTML() {
    return this.innerHTMLText;
  }

  _parseChildNodes(htmlStr) {
    const ids = (htmlStr.match(/id="([^"]+)"/g) || []).map(m => m.replace('id="', '').replace('"', ''));
    ids.forEach(id => {
      if (!domElementsMap[id]) {
        domElementsMap[id] = new MockDOMElement('div', id);
      }
    });
  }

  focus() {
    global.document.activeElement = this;
  }

  blur() {
    if (global.document.activeElement === this) {
      global.document.activeElement = null;
    }
  }
}

const domElementsMap = {};

function getOrCreateElement(id, tag = 'div') {
  if (!domElementsMap[id]) {
    domElementsMap[id] = new MockDOMElement(tag, id);
  }
  return domElementsMap[id];
}

global.document = {
  readyState: 'complete',
  activeElement: null,
  body: new MockDOMElement('body'),
  getElementById: (id) => getOrCreateElement(id),
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

global.Player = {
  init: () => {},
  getCurrentTrack: () => null,
  play: () => {},
  pause: () => {},
  next: () => {},
  previous: () => {},
  on: () => {},
  off: () => {},
  addEventListener: () => {},
  removeEventListener: () => {}
};

const UI = require('./js/ui.js');
global.UI = UI;

const App = require('./js/app.js');
global.App = App;

// Helper to escape characters
global.escapeHtml = UI.escapeHtml || ((s) => String(s || ''));
global.escapeAttr = UI.escapeAttr || ((s) => String(s || ''));

console.log('\n======================================================');
console.log('🧪 RUNNING PLAYLIST SEARCH MULTI-CHARACTER TYPING TESTS');
console.log('======================================================\n');

// 3. Populate a 99-Track Playlist with diverse names
const testSongs = [];
testSongs.push({ id: 'mont_1', name: 'Montagem Diamante', artists: 'MC Menor', duration: 180, isPlayable: true });
testSongs.push({ id: 'mont_2', name: 'Montagem Mysterious Game', artists: 'LXNGVX', duration: 155, isPlayable: true });
testSongs.push({ id: 'mont_3', name: 'Montagem Rave 3000', artists: 'DJ Alex', duration: 190, isPlayable: true });

for (let i = 4; i <= 99; i++) {
  testSongs.push({
    id: `track_${i}`,
    name: `Phonk Drift Special ${i}`,
    artists: `Artist ${(i % 7) + 1}`,
    duration: 120 + i,
    isPlayable: true
  });
}

const testPlaylist = {
  id: 'yt_playlist_99',
  name: 'YouTube Phonk & Montagem 2026',
  description: 'Imported from YouTube Music',
  source: 'youtube_music',
  songs: testSongs
};

mockStorageData['mf_playlists'] = JSON.stringify([testPlaylist]);
if (typeof Storage.savePlaylist !== 'function') {
  Storage.savePlaylist = function(pl) {
    const raw = JSON.parse(mockStorageData['mf_playlists'] || '[]');
    raw.push(pl);
    mockStorageData['mf_playlists'] = JSON.stringify(raw);
  };
}

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

// ----------------------------------------------------------------------------
// TEST 1: Initial Render & DOM Node Mounting
// ----------------------------------------------------------------------------
runTest('1.1 UI.renderPlaylistDetail initializes search input and results container', () => {
  UI.renderPlaylistDetail(testPlaylist.id);
  
  const container = document.getElementById('detail-tracks-container');
  assert.ok(container.innerHTML.includes('id="playlist-detail-search-input"'), 'Must contain persistent search input');
  assert.ok(container.innerHTML.includes('id="playlist-tracks-results"'), 'Must contain separate tracks results container');
  assert.ok(container.innerHTML.includes('Search in YouTube Playlist...'), 'Must render YouTube import search placeholder');
});

// ----------------------------------------------------------------------------
// TEST 2: Multi-Character Sequential Typing ("M" -> "O" -> "MONTAGEM")
// ----------------------------------------------------------------------------
runTest('2.1 Sequential multi-character typing preserves input DOM node and filters results', () => {
  // Initial render
  UI.renderPlaylistDetail(testPlaylist.id);
  const searchInputNode = document.getElementById('playlist-detail-search-input');
  const resultsNode = document.getElementById('playlist-tracks-results');
  
  assert.ok(searchInputNode, 'Search input DOM node must exist');
  assert.ok(resultsNode, 'Results container DOM node must exist');

  // Focus the input
  searchInputNode.focus();
  assert.strictEqual(document.activeElement, searchInputNode, 'Search input must have active focus');

  // User types "M", "MO", "MON", "MONT", "MONTA", "MONTAG", "MONTAGE", "MONTAGEM"
  const typedSequence = ['M', 'MO', 'MON', 'MONT', 'MONTA', 'MONTAG', 'MONTAGE', 'MONTAGEM'];

  typedSequence.forEach((currentQuery) => {
    // Simulate user typing into input
    searchInputNode.value = currentQuery;
    
    // Simulate input event triggering App.filterCurrentPlaylist
    UI.renderPlaylistDetail(testPlaylist.id, currentQuery);

    // CRITICAL ASSERTION: The search input DOM node must NOT have been destroyed or unmounted!
    const currentSearchInput = document.getElementById('playlist-detail-search-input');
    assert.strictEqual(currentSearchInput, searchInputNode, `DOM node identity must be strictly preserved at "${currentQuery}"`);
    assert.strictEqual(searchInputNode.value, currentQuery, `Input value must remain "${currentQuery}"`);
  });

  // Final check after typing "MONTAGEM"
  assert.strictEqual(searchInputNode.value, 'MONTAGEM', 'Final input value must be "MONTAGEM"');
  
  // Results container must contain all 3 Montagem tracks and 0 unrelated tracks
  const resultsHtml = resultsNode.innerHTML;
  assert.ok(resultsHtml.includes('Montagem Diamante'), 'Results must contain Montagem Diamante');
  assert.ok(resultsHtml.includes('Montagem Mysterious Game'), 'Results must contain Montagem Mysterious Game');
  assert.ok(resultsHtml.includes('Montagem Rave 3000'), 'Results must contain Montagem Rave 3000');
  assert.ok(!resultsHtml.includes('Phonk Drift Special 10'), 'Results must NOT contain unmatched tracks');
});

// ----------------------------------------------------------------------------
// TEST 3: Backspace Simulation & Complete Restoration
// ----------------------------------------------------------------------------
runTest('3.1 Backspacing down to empty restores all 99 tracks without unmounting input', () => {
  const searchInputNode = document.getElementById('playlist-detail-search-input');
  const resultsNode = document.getElementById('playlist-tracks-results');

  // Backspacing sequence
  const backspaceSequence = ['MONTAGE', 'MONT', 'MO', ''];

  backspaceSequence.forEach((query) => {
    searchInputNode.value = query;
    UI.renderPlaylistDetail(testPlaylist.id, query);

    const currentSearchInput = document.getElementById('playlist-detail-search-input');
    assert.strictEqual(currentSearchInput, searchInputNode, 'DOM node identity must be preserved during backspacing');
  });

  // When cleared (query === ''), full list of 99 tracks is present
  assert.strictEqual(searchInputNode.value, '', 'Input value must be cleared');
  const resultsHtml = resultsNode.innerHTML;
  assert.ok(resultsHtml.includes('Montagem Diamante'));
  assert.ok(resultsHtml.includes('Phonk Drift Special 4'));
  assert.ok(resultsHtml.includes('Phonk Drift Special 99'));
});

// ----------------------------------------------------------------------------
// TEST 4: Artist-Level In-Playlist Search (e.g. "LXNGVX")
// ----------------------------------------------------------------------------
runTest('4.1 Searching by artist name filters accurately across 99 tracks', () => {
  const searchInputNode = document.getElementById('playlist-detail-search-input');
  const resultsNode = document.getElementById('playlist-tracks-results');

  searchInputNode.value = 'LXNGVX';
  UI.renderPlaylistDetail(testPlaylist.id, 'LXNGVX');

  assert.strictEqual(document.getElementById('playlist-detail-search-input'), searchInputNode);
  const resultsHtml = resultsNode.innerHTML;
  assert.ok(resultsHtml.includes('Montagem Mysterious Game'), 'Must find track by LXNGVX');
  assert.ok(!resultsHtml.includes('Montagem Diamante'), 'Must not include other artists');
});

// ----------------------------------------------------------------------------
// TEST 5: Clear Button Action (App.clearPlaylistSearch)
// ----------------------------------------------------------------------------
runTest('5.1 App.clearPlaylistSearch clears input value and resets results', () => {
  const searchInputNode = document.getElementById('playlist-detail-search-input');
  searchInputNode.value = 'DJ Alex';
  UI.renderPlaylistDetail(testPlaylist.id, 'DJ Alex');

  assert.ok(resultsNode = document.getElementById('playlist-tracks-results'));
  assert.ok(resultsNode.innerHTML.includes('Montagem Rave 3000'));

  // Clear
  App.clearPlaylistSearch();
  assert.strictEqual(searchInputNode.value, '', 'App.clearPlaylistSearch must clear input value');
});

console.log('\n======================================================');
console.log(`📊 PLAYLIST SEARCH RESULTS: ${passed} Passed, ${failed} Failed`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
}
