// ============================================================================
// MUSICFLOW — 3D TINDER/APPLE MUSIC-STYLE SWIPE PLAYER AUTOMATED TEST SUITE
// Tests gestures, spring returns, queue commits, transition locking, and race conditions
// ============================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

function createFullPlayerSandbox() {
  const mockAudio = {
    src: '',
    currentTime: 0,
    duration: 240,
    paused: true,
    load() {},
    play() { this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; },
    addEventListener(evt, fn) { this[`on_${evt}`] = fn; },
    removeEventListener(evt) { delete this[`on_${evt}`]; }
  };

  const elements = {};
  function getOrCreateElement(id) {
    if (!elements[id]) {
      elements[id] = {
        id,
        style: { transform: '', opacity: '1', transition: '', display: 'block' },
        classList: {
          classes: new Set(),
          add(c) { this.classes.add(c); },
          remove(c) { this.classes.delete(c); },
          contains(c) { return this.classes.has(c); },
          toggle(c, force) {
            if (force === undefined) {
              if (this.classes.has(c)) this.classes.delete(c);
              else this.classes.add(c);
            } else if (force) {
              this.classes.add(c);
            } else {
              this.classes.delete(c);
            }
          }
        },
        src: '',
        textContent: '',
        innerHTML: '',
        offsetWidth: 320,
        offsetHeight: 320,
        getBoundingClientRect() { return { left: 0, top: 0, width: 320, height: 320 }; },
        closest(sel) { return null; },
        addEventListener(evt, fn) { this[`on_${evt}`] = fn; },
        removeEventListener(evt) { delete this[`on_${evt}`]; }
      };
    }
    return elements[id];
  }

  // Pre-populate core player deck elements matching index.html
  getOrCreateElement('app-loader');
  getOrCreateElement('player-3d-deck-container');
  getOrCreateElement('player-art-card');
  getOrCreateElement('player-deck-next');
  getOrCreateElement('player-deck-prev');
  getOrCreateElement('full-player-art');
  getOrCreateElement('player-art-prev');
  getOrCreateElement('player-art-next');
  getOrCreateElement('app-audio');

  const sandbox = {
    window: {},
    document: {
      body: getOrCreateElement('body'),
      getElementById(id) {
        if (id === 'app-audio') return mockAudio;
        if (id === 'player-deck-front') return getOrCreateElement('player-art-card');
        return getOrCreateElement(id);
      },
      createElement(tag) { return getOrCreateElement(`elem_${Math.random().toString(36).substring(2, 6)}`); },
      addEventListener(evt, fn) { this[`on_${evt}`] = fn; },
      removeEventListener(evt) { delete this[`on_${evt}`]; },
      visibilityState: 'visible',
      readyState: 'complete'
    },
    addEventListener(evt, fn) { this[`on_${evt}`] = fn; },
    removeEventListener(evt) { delete this[`on_${evt}`]; },
    navigator: { onLine: true, userAgent: 'Mozilla/5.0' },
    localStorage: {
      _data: {},
      getItem(k) { return this._data[k] || null; },
      setItem(k, v) { this._data[k] = String(v); },
      removeItem(k) { delete this._data[k]; },
      clear() { this._data = {}; }
    },
    Audio: function() { return mockAudio; },
    Image: function() { this.src = ''; },
    requestAnimationFrame: (cb) => setTimeout(cb, 0),
    cancelAnimationFrame: (id) => clearTimeout(id),
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout,
    Date: global.Date,
    console: { log() {}, warn() {}, error() {} }
  };

  sandbox.window = sandbox;

  vm.createContext(sandbox);

  // Load modules in order
  const dataNormalizerCode = fs.readFileSync(path.join(__dirname, '../web-app/js/dataNormalizer.js'), 'utf8');
  vm.runInContext(dataNormalizerCode, sandbox);

  const storageCode = fs.readFileSync(path.join(__dirname, '../web-app/js/storage.js'), 'utf8');
  vm.runInContext(storageCode, sandbox);

  const playbackResolverCode = fs.readFileSync(path.join(__dirname, '../web-app/js/playbackResolver.js'), 'utf8');
  vm.runInContext(playbackResolverCode, sandbox);

  const playerCode = fs.readFileSync(path.join(__dirname, '../web-app/js/player.js'), 'utf8');
  vm.runInContext(playerCode, sandbox);

  const uiCode = fs.readFileSync(path.join(__dirname, '../web-app/js/ui.js'), 'utf8');
  vm.runInContext(uiCode, sandbox);

  const appCode = fs.readFileSync(path.join(__dirname, '../web-app/js/app.js'), 'utf8');
  vm.runInContext(appCode, sandbox);

  const Player = sandbox.Player || sandbox.window.Player;
  const UI = sandbox.UI || sandbox.window.UI;
  const App = sandbox.App || sandbox.window.App;

  if (App && App.initPlayer3DDeckGesture) {
    App.initPlayer3DDeckGesture();
  }

  return { sandbox, Player, UI, App, elements, mockAudio };
}

async function run() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING 3D TINDER-STYLE SWIPE PLAYER TEST SUITE');
  console.log('======================================================\n');

  // Test 1: 3-Card Stack Population
  test('1. UI.renderPlayer3DDeck initializes 3-card stack (Prev, Current, Next)', () => {
    const { Player, UI, elements } = createFullPlayerSandbox();
    const tracks = [
      { id: 't1', name: 'Song 1', image: 'https://example.com/art1.jpg', artists: 'Artist 1' },
      { id: 't2', name: 'Song 2', image: 'https://example.com/art2.jpg', artists: 'Artist 2' },
      { id: 't3', name: 'Song 3', image: 'https://example.com/art3.jpg', artists: 'Artist 3' }
    ];

    Player.setQueue(tracks, 1, false);
    UI.renderPlayer3DDeck(tracks[1]);

    const frontArt = elements['full-player-art'];
    const prevArt = elements['player-art-prev'];
    const nextArt = elements['player-art-next'];
    const prevCard = elements['player-deck-prev'];
    const nextCard = elements['player-deck-next'];

    assert.strictEqual(frontArt.src, 'https://example.com/art2.jpg');
    assert.strictEqual(prevArt.src, 'https://example.com/art1.jpg');
    assert.strictEqual(nextArt.src, 'https://example.com/art3.jpg');
    assert.strictEqual(prevCard.style.display, 'block');
    assert.strictEqual(nextCard.style.display, 'block');
  });

  // Test 2: Stack Boundaries (First Song in Queue has no Previous Card)
  test('2. First song in queue hides Previous card and shows Next card', () => {
    const { Player, UI, elements } = createFullPlayerSandbox();
    const tracks = [
      { id: 't1', name: 'Song 1', image: 'https://example.com/art1.jpg' },
      { id: 't2', name: 'Song 2', image: 'https://example.com/art2.jpg' }
    ];

    Player.setQueue(tracks, 0, false);
    UI.renderPlayer3DDeck(tracks[0]);

    const prevCard = elements['player-deck-prev'];
    const nextCard = elements['player-deck-next'];

    assert.strictEqual(prevCard.style.display, 'none');
    assert.strictEqual(nextCard.style.display, 'block');
  });

  // Test 3: Stack Boundaries with Repeat ALL (First Song wraps Previous to Last Song)
  test('3. Repeat ALL wraps stack correctly across queue boundaries', () => {
    const { Player, UI, elements } = createFullPlayerSandbox();
    const tracks = [
      { id: 't1', name: 'Song 1', image: 'https://example.com/art1.jpg' },
      { id: 't2', name: 'Song 2', image: 'https://example.com/art2.jpg' },
      { id: 't3', name: 'Song 3', image: 'https://example.com/art3.jpg' }
    ];

    Player.setQueue(tracks, 0, false);
    Player.toggleRepeat(); // ALL
    UI.renderPlayer3DDeck(tracks[0]);

    const prevCard = elements['player-deck-prev'];
    const prevArt = elements['player-art-prev'];

    assert.strictEqual(prevCard.style.display, 'block');
    assert.strictEqual(prevArt.src, 'https://example.com/art3.jpg');
  });

  // Test 4: App.animateToNext Executes 3D Card Exit and Commits Next Song
  await testAsync('4. App.animateToNext applies 3D exit transform and advances queue', async () => {
    const { Player, App, elements } = createFullPlayerSandbox();
    const tracks = [
      { id: 't1', name: 'Song 1', audioUrl: 'https://example.com/1.mp3' },
      { id: 't2', name: 'Song 2', audioUrl: 'https://example.com/2.mp3' }
    ];

    Player.setQueue(tracks, 0, false);
    assert.strictEqual(Player.getCurrentIndex(), 0);

    App.animateToNext();

    const frontCard = elements['player-art-card'];
    assert.ok(frontCard.classList.contains('committing'), 'Should apply committing class');
    assert.strictEqual(frontCard.style.transform, 'translate3d(-120%, 0, 0) rotate(-14deg)');

    // Wait for commit transition timer
    await new Promise(r => setTimeout(r, 320));

    assert.strictEqual(Player.getCurrentIndex(), 1);
    assert.strictEqual(Player.getCurrentTrack().id, 't2');
  });

  // Test 5: App.animateToPrevious Executes Symmetrical 3D Exit to the Right
  await testAsync('5. App.animateToPrevious applies symmetrical right exit transform and retreats queue', async () => {
    const { Player, App, elements } = createFullPlayerSandbox();
    const tracks = [
      { id: 't1', name: 'Song 1', audioUrl: 'https://example.com/1.mp3' },
      { id: 't2', name: 'Song 2', audioUrl: 'https://example.com/2.mp3' }
    ];

    Player.setQueue(tracks, 1, false);
    assert.strictEqual(Player.getCurrentIndex(), 1);

    App.animateToPrevious();

    const frontCard = elements['player-art-card'];
    assert.ok(frontCard.classList.contains('committing'), 'Should apply committing class');
    assert.strictEqual(frontCard.style.transform, 'translate3d(120%, 0, 0) rotate(14deg)');

    await new Promise(r => setTimeout(r, 320));

    assert.strictEqual(Player.getCurrentIndex(), 0);
    assert.strictEqual(Player.getCurrentTrack().id, 't1');
  });

  // Test 6: Rapid Consecutive Clicks Are Locked and Do NOT Skip Tracks
  await testAsync('6. Rapid consecutive Next clicks respect transition lock without skipping tracks', async () => {
    const { Player, App } = createFullPlayerSandbox();
    const tracks = [
      { id: 't1', name: 'Song 1' },
      { id: 't2', name: 'Song 2' },
      { id: 't3', name: 'Song 3' },
      { id: 't4', name: 'Song 4' }
    ];

    Player.setQueue(tracks, 0, false);

    // Click Next rapidly 5 times in 10ms
    App.animateToNext();
    App.animateToNext();
    App.animateToNext();
    App.animateToNext();
    App.animateToNext();

    await new Promise(r => setTimeout(r, 350));

    // Exactly 1 transition committed (t1 -> t2)
    assert.strictEqual(Player.getCurrentIndex(), 1, 'Should commit exactly 1 index change under rapid clicks');
    assert.strictEqual(Player.getCurrentTrack().id, 't2');
  });

  // Test 7: Playlist Queue Boundary Isolation (Last track does not start radio)
  await testAsync('7. Playlist queue context stops at end of playlist on Next', async () => {
    const { Player, App } = createFullPlayerSandbox();
    const tracks = [
      { id: 'pl_1', name: 'Playlist Song 1', audioUrl: 'https://example.com/pl1.mp3' },
      { id: 'pl_2', name: 'Playlist Song 2', audioUrl: 'https://example.com/pl2.mp3' }
    ];

    Player.setQueue(tracks, 1, false, { source: 'playlist', mode: 'playlist' });
    await new Promise(r => setTimeout(r, 50));

    App.animateToNext();
    await new Promise(r => setTimeout(r, 300));

    assert.strictEqual(Player.getCurrentIndex(), 1);
    assert.strictEqual(Player.getState().playbackState, 'COMPLETED');
  });

  // Test 8: Tap Album Card has NO navigation side effects
  test('8. Tapping album card does not change track, queue or trigger navigation', () => {
    const { Player, elements, sandbox } = createFullPlayerSandbox();
    const tracks = [{ id: 't1', name: 'Song 1' }, { id: 't2', name: 'Song 2' }];
    Player.setQueue(tracks, 0, false);

    const deckContainer = elements['player-3d-deck-container'];
    assert.ok(deckContainer.on_mousedown, 'Mousedown listener should be attached');

    // Simulate tap (mousedown followed by mouseup without horizontal movement)
    deckContainer.on_mousedown({ clientX: 100, clientY: 100, target: deckContainer });
    sandbox.on_mouseup();

    assert.strictEqual(Player.getCurrentIndex(), 0);
    assert.strictEqual(Player.getCurrentTrack().id, 't1');
  });

  console.log('\n======================================================');
  console.log(`📊 3D SWIPE PLAYER TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

run().catch(err => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
