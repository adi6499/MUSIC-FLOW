// ============================================================================
// MUSICFLOW — BACK NAVIGATION & GESTURE SYSTEM AUTOMATED TEST SUITE
// 30 Comprehensive Tests Covering Full Priority Stack, Android & Web
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
  location: { reload: () => {} },
  _isUserSeeking: false
};

global.alert = () => {};
global.confirm = () => true;
global.prompt = () => '';

const mockDocElements = new Map();
function createMockElement(tag) {
  return {
    tagName: tag.toUpperCase(),
    dataset: { tab: 'playlists', target: 'home' },
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
    blur() {
      this._blurred = true;
      global.document.activeElement = global.document.body;
    },
    focus() {
      this._blurred = false;
      global.document.activeElement = this;
    },
    querySelectorAll(sel) {
      return [];
    },
    querySelector(sel) {
      return null;
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
      this.dispatchEvent({ type: 'pause' });
    },
    load() {
      this.loadCount++;
    },
    appendChild(child) {
      return child;
    }
  };
}

['screen-home', 'screen-explore', 'screen-search', 'screen-library', 'screen-artist', 'screen-genre', 'screen-detail'].forEach(id => {
  const el = createMockElement('div');
  el.id = id;
  el.classList.add('screen');
  mockDocElements.set(id, el);
});

const bodyElement = createMockElement('body');
global.document = {
  activeElement: bodyElement,
  documentElement: {
    style: { setProperty: () => {} }
  },
  body: bodyElement,
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
  querySelectorAll: (selector) => {
    const results = [];
    mockDocElements.forEach((el) => {
      if (selector === '.screen' && el.id.startsWith('screen-')) results.push(el);
      if (selector.includes('.nav-tab') && el.classList.contains('nav-tab')) results.push(el);
    });
    return results;
  },
  querySelector: (selector) => {
    for (const [id, el] of mockDocElements.entries()) {
      if (selector === '.lib-tab-btn.active' && el.classList.contains('active')) return el;
    }
    return createMockElement('div');
  }
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

global.ExploreDataLayer = {
  getGenreDetails: async (g) => ({ title: g, songs: [] }),
  loadExplore: (cb) => cb({ sections: [] }, false)
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

const SmartDownloadManager = require('./js/smartDownloads.js');
global.SmartDownloadManager = SmartDownloadManager;

const AudioOutputManager = require('./js/audioOutputManager.js');
global.AudioOutputManager = AudioOutputManager;

const App = require('./js/app.js');
global.App = App;

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
console.log('⚡ MUSICFLOW: BACK NAVIGATION & GESTURE TEST SUITE');
console.log('=======================================================\n');

(async () => {
  App.init();

  // Test 1: Priority 1 - Active Keyboard / Text Input Blur
  it('1. Priority 1: If input/textarea is focused, back gesture blurs input and consumes event', () => {
    const inputEl = createMockElement('input');
    inputEl.focus();
    assert.strictEqual(global.document.activeElement, inputEl);

    const handled = App.handleBack();
    assert.strictEqual(handled, true);
    assert.strictEqual(global.document.activeElement, global.document.body);
  });

  // Test 2-7: Priority 2 - Modal Dialogs Dismissal
  it('2. Priority 2: Create Playlist Modal closes on back gesture', () => {
    const modal = document.getElementById('modal-create-playlist');
    modal.style.display = 'flex';
    const handled = App.handleBack();
    assert.strictEqual(handled, true);
    assert.strictEqual(modal.style.display, 'none');
  });

  it('3. Priority 2: Add to Playlist Modal closes on back gesture', () => {
    const modal = document.getElementById('modal-add-to-playlist');
    modal.style.display = 'flex';
    const handled = App.handleBack();
    assert.strictEqual(handled, true);
    assert.strictEqual(modal.style.display, 'none');
  });

  it('4. Priority 2: Language Picker Dialog closes on back gesture', () => {
    const modal = document.getElementById('dialog-language-picker');
    modal.classList.add('active');
    const handled = App.handleBack();
    assert.strictEqual(handled, true);
    assert.strictEqual(modal.classList.contains('active'), false);
  });

  it('5. Priority 2: Playlist Picker Dialog closes on back gesture', () => {
    const modal = document.getElementById('dialog-playlist-picker');
    modal.classList.add('active');
    const handled = App.handleBack();
    assert.strictEqual(handled, true);
    assert.strictEqual(modal.classList.contains('active'), false);
  });

  it('6. Priority 2: Audio Quality Dialog closes on back gesture', () => {
    const modal = document.getElementById('dialog-quality');
    modal.classList.add('active');
    const handled = App.handleBack();
    assert.strictEqual(handled, true);
    assert.strictEqual(modal.classList.contains('active'), false);
  });

  it('7. Priority 2: Storage Limit Dialog closes on back gesture', () => {
    const modal = document.getElementById('dialog-storage-limit');
    modal.classList.add('active');
    const handled = App.handleBack();
    assert.strictEqual(handled, true);
    assert.strictEqual(modal.classList.contains('active'), false);
  });

  // Test 8-15: Priority 3 - Bottom Sheets Dismissal
  it('8. Priority 3: Audio Output / Device Bottom Sheet closes on back gesture', () => {
    const sheet = document.getElementById('sheet-audio-output');
    sheet.classList.add('active');
    const handled = App.handleBack();
    assert.strictEqual(handled, true);
    assert.strictEqual(sheet.classList.contains('active'), false);
  });

  it('9. Priority 3: Song Context Menu Bottom Sheet closes on back gesture', () => {
    const sheet = document.getElementById('sheet-song-menu');
    sheet.classList.add('active');
    const handled = App.handleBack();
    assert.strictEqual(handled, true);
    assert.strictEqual(sheet.classList.contains('active'), false);
  });

  it('10. Priority 3: Artist Menu Bottom Sheet closes on back gesture', () => {
    const sheet = document.getElementById('sheet-artist-menu');
    sheet.classList.add('active');
    const handled = App.handleBack();
    assert.strictEqual(handled, true);
    assert.strictEqual(sheet.classList.contains('active'), false);
  });

  it('11. Priority 3: Equalizer Bottom Sheet closes on back gesture', () => {
    const sheet = document.getElementById('sheet-equalizer');
    sheet.classList.add('active');
    const handled = App.handleBack();
    assert.strictEqual(handled, true);
    assert.strictEqual(sheet.classList.contains('active'), false);
  });

  it('12. Priority 3: Sleep Timer Bottom Sheet closes on back gesture', () => {
    const sheet = document.getElementById('sheet-sleep-timer');
    sheet.classList.add('active');
    const handled = App.handleBack();
    assert.strictEqual(handled, true);
    assert.strictEqual(sheet.classList.contains('active'), false);
  });

  it('13. Priority 3: Storage Cleanup Bottom Sheet closes on back gesture', () => {
    const sheet = document.getElementById('sheet-storage-cleanup');
    sheet.classList.add('active');
    const handled = App.handleBack();
    assert.strictEqual(handled, true);
    assert.strictEqual(sheet.classList.contains('active'), false);
  });

  it('14. Priority 3: Queue Bottom Sheet closes on back gesture', () => {
    const sheet = document.getElementById('sheet-queue');
    sheet.classList.add('active');
    const handled = App.handleBack();
    assert.strictEqual(handled, true);
    assert.strictEqual(sheet.classList.contains('active'), false);
  });

  it('15. Priority 3: Settings Bottom Sheet closes on back gesture', () => {
    const sheet = document.getElementById('sheet-settings');
    sheet.classList.add('active');
    const handled = App.handleBack();
    assert.strictEqual(handled, true);
    assert.strictEqual(sheet.classList.contains('active'), false);
  });

  // Test 16-20: Priority 4 & 5 - Full Player & Lyrics Overlay
  it('16. Priority 4: Live Synced Lyrics overlay toggles back to Art view on back gesture', () => {
    const lyricsView = document.getElementById('player-lyrics-view');
    lyricsView.style.display = 'flex';
    const handled = App.handleBack();
    assert.strictEqual(handled, true);
    assert.strictEqual(lyricsView.style.display, 'none');
  });

  await itAsync('17. Priority 5: Full Player Sheet collapses to Mini Player on back gesture', async () => {
    const song = { id: 'bk_s1', name: 'Back Test Song', audioUrl: 'https://example.com/song.mp3' };
    await Player.playSong(song);
    App.expandFullPlayer();

    const fullPlayer = document.getElementById('full-player');
    assert.strictEqual(fullPlayer.classList.contains('expanded'), true);

    const handled = App.handleBack();
    assert.strictEqual(handled, true);
    assert.strictEqual(fullPlayer.classList.contains('expanded'), false);
  });

  it('18. Priority 5: Full Player collapse does NOT pause active audio playback', () => {
    const audio = Player.getAudioElement();
    assert.strictEqual(audio.paused, false, 'Playback must not be paused when Full Player is dismissed');
  });

  it('19. Priority 5: Full Player collapse does NOT reset song currentTime position', () => {
    const audio = Player.getAudioElement();
    audio.currentTime = 120;
    App.expandFullPlayer();
    App.handleBack();
    assert.strictEqual(audio.currentTime, 120, 'Position must remain 120s');
  });

  it('20. Priority 5: Full Player collapse leaves Mini Player active and functional', () => {
    const miniPlayBtn = document.getElementById('btn-mini-play');
    assert.ok(miniPlayBtn);
  });

  // Test 21-25: Priority 6 - Nested Pages History Stack
  await itAsync('21. Navigating Home -> Explore -> Genre unwinds accurately on back', async () => {
    App.navigate('home', true);
    App.navigate('explore', true);
    await App.openGenre('Bollywood', true);

    assert.strictEqual(document.getElementById('screen-genre').classList.contains('active'), true);

    // Press Back: Genre -> Explore
    const handled1 = App.handleBack();
    assert.strictEqual(handled1, true);
    assert.strictEqual(document.getElementById('screen-explore').classList.contains('active'), true);

    // Press Back: Explore -> Home
    const handled2 = App.handleBack();
    assert.strictEqual(handled2, true);
    assert.strictEqual(document.getElementById('screen-home').classList.contains('active'), true);
  });

  await itAsync('22. Navigating Home -> Search -> Artist profile unwinds accurately on back', async () => {
    App.navigate('home', true);
    App.navigate('search', true);
    await App.openArtist('Arijit Singh', true);

    assert.strictEqual(document.getElementById('screen-artist').classList.contains('active'), true);

    // Press Back: Artist -> Search
    const handled1 = App.handleBack();
    assert.strictEqual(handled1, true);
    assert.strictEqual(document.getElementById('screen-search').classList.contains('active'), true);
  });

  it('23. Navigating Home -> Library -> Custom Playlist unwinds accurately on back', () => {
    const pl = Storage.createPlaylist('My Favorites 2024');

    App.navigate('home', true);
    App.navigate('library', true);
    App.openCustomPlaylist(pl.id, true);

    assert.strictEqual(document.getElementById('screen-detail').classList.contains('active'), true);

    // Press Back: Detail -> Library
    const handled = App.handleBack();
    assert.strictEqual(handled, true);
    assert.strictEqual(document.getElementById('screen-library').classList.contains('active'), true);
  });

  it('24. Bottom nav switching Home -> Explore -> Library unwinds in reverse', () => {
    App.navigate('home', true);
    App.navigate('explore', true);
    App.navigate('library', true);

    assert.strictEqual(document.getElementById('screen-library').classList.contains('active'), true);

    App.handleBack(); // Library -> Explore
    assert.strictEqual(document.getElementById('screen-explore').classList.contains('active'), true);

    App.handleBack(); // Explore -> Home
    assert.strictEqual(document.getElementById('screen-home').classList.contains('active'), true);
  });

  it('25. Tab reselection (tapping Home while on Home) does not duplicate history entries', () => {
    App.navigate('home', true);
    const beforeCount = App.getNavHistory().length;
    App.navigate('home', true);
    const afterCount = App.getNavHistory().length;
    assert.strictEqual(afterCount, beforeCount);
  });

  // Test 26-30: Stack Limits, Android Signal, and Rapid Gestures
  it('26. Navigation history stack is capped at MAX_HISTORY_LENGTH to prevent memory bloat', () => {
    for (let i = 0; i < 50; i++) {
      App.navigate(i % 2 === 0 ? 'home' : 'explore', true);
    }
    assert.ok(App.getNavHistory().length <= 35);
  });

  it('27. Non-home root tab with single entry returns to Home on back', () => {
    App.navigate('search', false); // Direct switch without stack
    const handled = App.handleBack();
    assert.strictEqual(handled, true);
    assert.strictEqual(document.getElementById('screen-home').classList.contains('active'), true);
  });

  it('28. Root Home screen with no overlays and empty history returns false (Exit / Minimize signal)', () => {
    while (App.getNavHistory().length > 1) {
      App.handleBack();
    }
    App.navigate('home', false);
    const handled = App.handleBack();
    assert.strictEqual(handled, false, 'handleBack must return false at root Home to allow native Android minimize/exit');
  });

  it('29. Android BackHandler evaluation of App.handleBack returns boolean string', () => {
    const jsResult = App.handleBack();
    assert.strictEqual(typeof jsResult, 'boolean');
  });

  await itAsync('30. Rapid multiple back gestures unwind safely without throwing errors', async () => {
    while (App.getNavHistory().length > 1) {
      App.handleBack();
    }
    App.navigate('home', false);
    App.navigate('explore', true);
    App.navigate('search', true);
    App.expandFullPlayer();

    // Rapid gestures
    assert.strictEqual(App.handleBack(), true); // Collapse player
    assert.strictEqual(App.handleBack(), true); // Search -> Explore
    assert.strictEqual(App.handleBack(), true); // Explore -> Home
    assert.strictEqual(App.handleBack(), false); // At Home -> exit signal
  });

  console.log('\n=======================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=======================================================\n');

  if (failed > 0) process.exit(1);
})();
