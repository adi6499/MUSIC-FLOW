/**
 * TEST SUITE: Final Player / Swipe / Playlist / YouTube Music Repair
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Setup mock browser DOM environment
global.window = global;
global.window.addEventListener = () => {};
global.window.removeEventListener = () => {};
const mockDOMMap = {};
global.document = {
  getElementById: (id) => {
    if (!mockDOMMap[id]) {
      mockDOMMap[id] = {
        id,
        style: {},
        classList: {
          contains: () => false,
          add: () => {},
          remove: () => {},
          toggle: () => {}
        },
        setAttribute: () => {},
        getAttribute: () => null,
        addEventListener: () => {},
        removeEventListener: () => {},
        innerHTML: '',
        textContent: '',
        offsetWidth: 100,
        offsetHeight: 100,
        getBoundingClientRect: () => ({ width: 300, height: 300, left: 0, top: 0 })
      };
    }
    return mockDOMMap[id];
  },
  querySelectorAll: () => [],
  body: {
    classList: {
      contains: () => false,
      add: () => {},
      remove: () => {},
      toggle: () => {}
    },
    style: {}
  },
  documentElement: {
    style: {
      setProperty: () => {}
    }
  },
  addEventListener: () => {}
};
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; },
  clear() { this._store = {}; }
};
global.navigator = { userAgent: 'NodeTest', clipboard: { writeText: async () => {} } };
global.Audio = class {
  constructor() {
    this.src = '';
    this.currentTime = 0;
    this.duration = 200;
    this.paused = true;
  }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  addEventListener() {}
  removeEventListener() {}
};
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);

// Load required modules
const DataNormalizer = require('./js/dataNormalizer.js');
global.DataNormalizer = DataNormalizer;

const Storage = require('./js/storage.js');
global.Storage = Storage;

const UI = require('./js/ui.js');
global.UI = UI;

const Player = require('./js/player.js');
global.Player = Player;

const App = require('./js/app.js');
global.App = App;

const YouTubeMusicService = require('../youtubeMusicService.js');

async function runTests() {
  console.log('\n======================================================');
  console.log('  RUNNING FINAL PLAYER / SWIPE / PLAYLIST REPAIR TESTS');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function it(desc, fn) {
    try {
      fn();
      console.log(`  ✓ ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${desc}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  async function itAsync(desc, fn) {
    try {
      await fn();
      console.log(`  ✓ ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${desc}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  // 1. YouTube URL Parser
  it('DataNormalizer.parseYouTubeUrl correctly identifies single tracks and playlists', () => {
    const track1 = DataNormalizer.parseYouTubeUrl('https://music.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.strictEqual(track1.type, 'track');
    assert.strictEqual(track1.id, 'dQw4w9WgXcQ');

    const track2 = DataNormalizer.parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ');
    assert.strictEqual(track2.type, 'track');
    assert.strictEqual(track2.id, 'dQw4w9WgXcQ');

    const playlist1 = DataNormalizer.parseYouTubeUrl('https://music.youtube.com/playlist?list=PL1234567890');
    assert.strictEqual(playlist1.type, 'playlist');
    assert.strictEqual(playlist1.id, 'PL1234567890');

    const rawId = DataNormalizer.parseYouTubeUrl('dQw4w9WgXcQ');
    assert.strictEqual(rawId.type, 'track');
    assert.strictEqual(rawId.id, 'dQw4w9WgXcQ');
  });

  // 2. YouTube Single Track Import Service
  await itAsync('YouTubeMusicService.importTrack returns normalized track structure', async () => {
    const result = await YouTubeMusicService.importTrack('dQw4w9WgXcQ');
    assert.ok(result.success, 'Import should succeed');
    assert.ok(result.track, 'Result must contain track object');
    assert.strictEqual(typeof result.track.name, 'string', 'Track must have title string');
    assert.strictEqual(typeof result.track.artists, 'string', 'Track must have artists string');
    assert.ok(result.track.image, 'Track must have artwork image URL');
  });

  await itAsync('YouTubeMusicService.importTrack throws for invalid input', async () => {
    let threw = false;
    try {
      await YouTubeMusicService.importTrack('');
    } catch (_) {
      threw = true;
    }
    assert.ok(threw, 'Should throw error on invalid YouTube input');
  });

  // 3. Player.next() and Player.previous() Scope Safety
  await itAsync('Player.next() and Player.previous() operate cleanly on canonical state without ReferenceError', async () => {
    const testQueue = [
      { id: 'song-1', name: 'Song One', artists: 'Artist A', streamUrl: 'https://example.com/1.mp3' },
      { id: 'song-2', name: 'Song Two', artists: 'Artist B', streamUrl: 'https://example.com/2.mp3' },
      { id: 'song-3', name: 'Song Three', artists: 'Artist C', streamUrl: 'https://example.com/3.mp3' }
    ];

    Player.setQueue(testQueue, 0, false);
    assert.strictEqual(Player.getCurrentIndex(), 0);
    assert.strictEqual(Player.getCurrentTrack().id, 'song-1');

    await Player.next();
    assert.strictEqual(Player.getCurrentIndex(), 1);
    assert.strictEqual(Player.getCurrentTrack().id, 'song-2');

    await Player.previous();
    assert.strictEqual(Player.getCurrentIndex(), 0);
    assert.strictEqual(Player.getCurrentTrack().id, 'song-1');
  });

  // 4. Unified Card Transition Methods Exist on App
  it('App exports animateToNext and animateToPrevious', () => {
    assert.strictEqual(typeof App.animateToNext, 'function', 'animateToNext must be exported');
    assert.strictEqual(typeof App.animateToPrevious, 'function', 'animateToPrevious must be exported');
  });

  // 5. Artist Navigation Isolation
  it('UI.renderArtistLinks defaults to plain text in compact views, clickable only in Full Player', () => {
    const song = { id: 's1', name: 'Track', artists: 'Arijit Singh, Pritam' };
    
    const compactText = UI.renderArtistLinks(song);
    assert.ok(!compactText.includes('onclick'), 'Compact artist view must NOT contain onclick handler');
    assert.ok(compactText.includes('Arijit Singh'), 'Compact view must contain formatted artist name');

    const fullPlayerLinks = UI.renderFullPlayerArtistLinks(song);
    assert.ok(fullPlayerLinks.includes('onclick="event.stopPropagation(); App.navigateToArtist'), 'Full Player artist view must contain navigation link');
  });

  // 6. Playlist Detail Navigation Separation
  it('Playlist card click opens playlist detail without starting audio playback', () => {
    Storage.createPlaylist('Chill Vibes', 'My chill playlist');
    const pl = Storage.getPlaylists().find(p => p.name === 'Chill Vibes');
    assert.ok(pl, 'Playlist must be created');

    Storage.addToPlaylist(pl.id, { id: 'track-10', name: 'Ambient Wave', artists: 'Flow Artist' });

    // Initial player state
    Player.setQueue([], 0, false);
    assert.strictEqual(Player.getQueue().length, 0);

    // Call openCustomPlaylist (simulating card click)
    App.openCustomPlaylist(pl.id);

    // Player queue should NOT be auto-played by simply opening the playlist card
    assert.strictEqual(Player.getQueue().length, 0, 'Opening playlist card must NOT start audio playback');

    // Clicking a song row inside playlist should load the playlist queue and start playback
    App.playCustomPlaylistTrack(pl.id, 0);
    assert.strictEqual(Player.getQueue().length, 1, 'Clicking song row must set playlist queue');
    assert.strictEqual(Player.getCurrentTrack().id, 'track-10');
  });

  // 7. Disambiguated Player Menus
  await itAsync('App exports openCurrentSongMenu and openSongMenu with normalized data handling', async () => {
    assert.strictEqual(typeof App.openCurrentSongMenu, 'function');
    assert.strictEqual(typeof App.openSongMenu, 'function');

    const song = { id: 'track-99', name: 'Menu Song', artists: 'Artist One, Artist Two' };
    await App.openSongMenu(song);

    const titleEl = document.getElementById('sheet-song-title');
    const artistEl = document.getElementById('sheet-song-artist');
    assert.strictEqual(titleEl.textContent, 'Menu Song');
    if (artistEl) {
      assert.ok(artistEl.textContent.includes('Artist One'));
    }
  });

  // 8. Index.html Audit
  it('index.html contains synchronized transport controls and deduplicated menus', () => {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    assert.ok(html.includes('id="btn-player-next" onclick="App.animateToNext()"'), 'Next button must call App.animateToNext()');
    assert.ok(html.includes('id="btn-player-prev" onclick="App.animateToPrevious()"'), 'Previous button must call App.animateToPrevious()');
    assert.ok(html.includes('id="btn-mini-next" onclick="event.stopPropagation(); App.animateToNext();"'), 'Mini Next button must call App.animateToNext()');
    assert.ok(html.includes('id="btn-player-song-more" onclick="App.openCurrentSongMenu()"'), 'Song more button must call App.openCurrentSongMenu()');
    assert.ok(html.includes('queue_music</span>'), 'Top right header button must show queue_music icon');
  });

  console.log('\n------------------------------------------------------');
  console.log(`  TEST RESULTS: ${passed} passed, ${failed} failed`);
  console.log('------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
