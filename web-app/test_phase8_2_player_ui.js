// ============================================================================
// MUSICFLOW — PHASE 8.2 PLAYER UI + QUEUE EXPERIENCE TEST SUITE
// Automated verification for Mini Player, Full Player, Queue Sheet,
// Transport Controls, Metadata Badges, Accessibility, Buffering & Error States.
// ============================================================================

const fs = require('fs');
const path = require('path');

// Mock DOM Environment
class MockElement {
  constructor(id = '', tagName = 'div') {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.style = {};
    this.textContent = '';
    this.innerHTML = '';
    this.src = '';
    this.value = 0;
    this.attributes = {};
    this.listeners = {};
    this.dataset = {};
    this._classes = new Set();
    this.classList = {
      _self: this,
      add: (c) => this._classes.add(c),
      remove: (c) => this._classes.delete(c),
      toggle: (c, force) => {
        if (force === undefined) {
          if (this._classes.has(c)) this._classes.delete(c); else this._classes.add(c);
        } else if (force) {
          this._classes.add(c);
        } else {
          this._classes.delete(c);
        }
      },
      contains: (c) => this._classes.has(c)
    };
  }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] || null; }
  addEventListener(evt, cb) {
    if (!this.listeners[evt]) this.listeners[evt] = [];
    this.listeners[evt].push(cb);
  }
}

const domElements = new Map();
function getOrCreateElem(id, tag = 'div') {
  if (!domElements.has(id)) {
    domElements.set(id, new MockElement(id, tag));
  }
  return domElements.get(id);
}

// Pre-create Player elements
[
  'mini-player', 'mini-player-art', 'mini-song-title', 'mini-artist-name', 'mini-source-badge',
  'btn-mini-like', 'mini-like-icon', 'btn-mini-play', 'mini-play-icon', 'btn-mini-next',
  'full-player', 'full-player-art', 'full-player-title', 'full-player-artist', 'player-source-badge',
  'player-quality-badge', 'btn-player-favorite', 'player-heart-icon', 'player-seek-slider',
  'player-seek-bar', 'player-seek-track', 'player-seek-fill', 'player-seek-thumb',
  'player-time-current', 'player-time-total', 'btn-player-shuffle', 'player-shuffle-icon',
  'btn-player-prev', 'btn-player-play', 'player-main-play-icon', 'btn-player-next',
  'btn-player-repeat', 'player-repeat-icon', 'player-download-icon', 'player-download-label',
  'player-context-tag', 'player-context-title', 'sheet-queue', 'queue-tracks-container', 'queue-tracks-count'
].forEach(id => getOrCreateElem(id));

global.document = {
  getElementById: (id) => domElements.get(id) || null,
  createElement: (tag) => new MockElement('', tag),
  body: new MockElement('body'),
  querySelectorAll: () => [],
  addEventListener: () => {}
};

global.window = {
  location: { href: 'http://localhost:3000/' },
  addEventListener: () => {}
};

global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};

const Storage = require('./js/storage.js');
global.Storage = Storage;
const API = require('./js/api.js');
global.API = API;
const UI = require('./js/ui.js');
global.UI = UI;

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failedTests++;
  }
}

function runPlayerUITestSuite() {
  console.log('======================================================================');
  console.log('🧪 PHASE 8.2: PLAYER UI + QUEUE EXPERIENCE TEST SUITE');
  console.log('======================================================================\n');

  // 1. Mini Player & Source Badges
  console.log('--- 1. Mini Player Metadata & Source Badges ---');
  const streamingSong = {
    id: 's_stream_1',
    name: 'Starboy',
    artists: 'The Weeknd, Daft Punk',
    image: 'https://cdn.example.com/starboy.jpg',
    duration: 230,
    source: 'STREAMING'
  };

  UI.updatePlayerBar(streamingSong);

  const miniPlayer = document.getElementById('mini-player');
  const miniTitle = document.getElementById('mini-song-title');
  const miniArtist = document.getElementById('mini-artist-name');
  const miniBadge = document.getElementById('mini-source-badge');

  assert(miniPlayer.style.display === 'flex', 'Mini Player becomes visible on track update');
  assert(miniTitle.textContent === 'Starboy', `Mini player title is "Starboy" (got "${miniTitle.textContent}")`);
  assert(miniArtist.textContent.includes('The Weeknd'), 'Mini player displays artist');
  assert(miniBadge.textContent === '320K', `Streaming badge displays 320K (got "${miniBadge.textContent}")`);

  // Local song check
  const localSong = {
    id: 's_local_1',
    name: 'Get Lucky',
    artists: 'Daft Punk',
    image: 'assets/logo.png',
    duration: 248,
    source: 'LOCAL'
  };
  UI.updatePlayerBar(localSong);
  assert(miniBadge.textContent === '● LOCAL', `Local song displays "● LOCAL" badge (got "${miniBadge.textContent}")`);

  // Downloaded song check
  Storage.saveDownload({ id: 's_dl_1', name: 'Instant Crush', artists: 'Daft Punk' });
  const downloadedSong = {
    id: 's_dl_1',
    name: 'Instant Crush',
    artists: 'Daft Punk',
    duration: 337
  };
  UI.updatePlayerBar(downloadedSong);
  assert(miniBadge.textContent === '● DOWNLOADED', `Downloaded song displays "● DOWNLOADED" badge (got "${miniBadge.textContent}")`);

  // 2. Full Player Presentation
  console.log('\n--- 2. Full Player Presentation & Metadata ---');
  const fullTitle = document.getElementById('full-player-title');
  const fullArtist = document.getElementById('full-player-artist');
  const totalTime = document.getElementById('player-time-total');
  const sourceBadge = document.getElementById('player-source-badge');

  assert(fullTitle.textContent === 'Instant Crush', 'Full player title updated');
  assert(fullArtist.textContent === 'Daft Punk', 'Full player artist updated');
  assert(totalTime.textContent === '5:37', `Duration formatted to "5:37" (got "${totalTime.textContent}")`);
  assert(sourceBadge.style.display === 'none', `Duplicate downloaded indicator removed from metadata row`);

  // 3. Playback State & Buffering Animations
  console.log('\n--- 3. Playback State & Buffering ---');
  const miniPlayIcon = document.getElementById('mini-play-icon');
  const fullPlayIcon = document.getElementById('player-main-play-icon');
  const miniPlayBtn = document.getElementById('btn-mini-play');
  const fullPlayBtn = document.getElementById('btn-player-play');

  // Playing state
  UI.updatePlaybackState(true, 'PLAYING');
  assert(miniPlayIcon.textContent === 'pause', 'Mini player play button toggles to "pause" when playing');
  assert(fullPlayIcon.textContent === 'pause', 'Full player play button toggles to "pause" when playing');
  assert(miniPlayIcon.textContent !== 'sync', 'Not buffering when PLAYING');

  // Buffering state
  UI.updatePlaybackState(true, 'BUFFERING');
  assert(miniPlayIcon.textContent === 'sync', 'Mini play icon activates sync spinner');
  assert(fullPlayIcon.textContent === 'sync', 'Full play icon activates sync spinner');

  // Paused state
  UI.updatePlaybackState(false, 'PAUSED');
  assert(miniPlayIcon.textContent === 'play_arrow', 'Mini player toggles to "play_arrow" when paused');
  assert(miniPlayIcon.textContent !== 'sync', 'Buffering cleared when paused');

  // 4. Progress Scrubber Formatting (No NaN)
  console.log('\n--- 4. Progress Scrubber Formatting ---');
  const curTimeEl = document.getElementById('player-time-current');
  const totTimeEl = document.getElementById('player-time-total');
  const seekFill = document.getElementById('player-seek-fill');

  UI.updatePlaybackProgress(84, 217); // 1:24 of 3:37
  assert(curTimeEl.textContent === '1:24', `Current time formatted to "1:24" (got "${curTimeEl.textContent}")`);
  assert(totTimeEl.textContent === '3:37', `Total duration formatted to "3:37" (got "${totTimeEl.textContent}")`);
  assert(seekFill.style.width.includes('39%') || seekFill.style.width.includes('38.'), `Seek fill width set to ~39% (got ${seekFill.style.width})`);

  // Boundary & NaN handling
  UI.updatePlaybackProgress(NaN, 0);
  assert(curTimeEl.textContent === '0:00', 'NaN time handled safely as "0:00"');
  assert(totTimeEl.textContent === '0:00' || totTimeEl.textContent === '--:--', '0 duration handled safely as "0:00"');

  // 5. Shuffle & Repeat UI State
  console.log('\n--- 5. Shuffle & Repeat UI States ---');
  const shuffleBtn = document.getElementById('btn-player-shuffle');
  const repeatBtn = document.getElementById('btn-player-repeat');
  const repeatIcon = document.getElementById('player-repeat-icon');

  UI.updateShuffleState(true);
  assert(shuffleBtn.classList.contains('active'), 'Shuffle button marked active');
  assert(shuffleBtn.getAttribute('aria-label') === 'Shuffle On', 'Accessible label updated for Shuffle On');

  UI.updateRepeatState('ONE');
  assert(repeatBtn.classList.contains('active'), 'Repeat button marked active');
  assert(repeatIcon.textContent === 'repeat_one', 'Repeat icon switched to "repeat_one"');
  assert(repeatBtn.getAttribute('aria-label') === 'Repeat One', 'Accessible label updated for Repeat One');

  // 6. Queue Sheet (Now Playing + Up Next + Empty State)
  console.log('\n--- 6. Queue Sheet Layout & Empty State ---');
  const queueContainer = document.getElementById('queue-tracks-container');
  const queueCount = document.getElementById('queue-tracks-count');

  const testQueue = [
    { id: 'q_1', name: 'Song One', artists: 'Artist One' },
    { id: 'q_2', name: 'Song Two', artists: 'Artist Two' },
    { id: 'q_3', name: 'Song Three', artists: 'Artist Three' }
  ];

  UI.renderQueueSheet(testQueue, 0);
  assert(queueCount.textContent === '3 tracks', 'Queue count updated to "3 tracks"');
  assert(queueContainer.innerHTML.includes('NOW PLAYING'), 'Queue contains NOW PLAYING header');
  assert(queueContainer.innerHTML.includes('UP NEXT (2)'), 'Queue contains UP NEXT (2) header');
  assert(queueContainer.innerHTML.includes('drag_indicator'), 'Queue contains drag reorder handles');
  assert(queueContainer.innerHTML.includes('Song Two'), 'Upcoming track Song Two rendered');

  // Empty queue
  UI.renderQueueSheet([], -1);
  assert(queueContainer.innerHTML.includes('Queue is empty'), 'Empty state rendered when queue is empty');
  assert(queueContainer.innerHTML.includes('Discover Music'), 'Empty state CTA button present');

  console.log('\n======================================================================');
  console.log(`📊 PHASE 8.2 RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('======================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPlayerUITestSuite();
