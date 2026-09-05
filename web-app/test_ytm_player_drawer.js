// ============================================================================
// MUSICFLOW — YOUTUBE MUSIC PLAYER & 3-TAB DRAWER TEST SUITE (Step 2)
// Verifies 1:1 YouTube Music Player, [Song | Video] Switcher, Action Strip,
// 3-Tab Sliding Drawer (UP NEXT, LYRICS, RELATED), and Comments Bottom Sheet.
// ============================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let testsPassed = 0;
let testsFailed = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    testsFailed++;
  }
}

async function itAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    testsFailed++;
  }
}

async function runTests() {
  console.log('\n======================================================================');
  console.log('🧪 YOUTUBE MUSIC PLAYER & 3-TAB DRAWER TEST SUITE');
  console.log('======================================================================\n');

  const htmlPath = path.join(__dirname, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  const cssPath = path.join(__dirname, 'css', 'app.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // --- 1. [ Song | Video ] Segmented Switcher ---
  console.log('--- 1. [ Song | Video ] Segmented Switcher ---');
  it('1.1 Player DOM contains Song/Video toggle buttons', () => {
    assert.ok(html.includes('id="ytm-player-switch-pill"'), 'Must have #ytm-player-switch-pill');
    assert.ok(html.includes('id="btn-switch-song"'), 'Must have #btn-switch-song');
    assert.ok(html.includes('id="btn-switch-video"'), 'Must have #btn-switch-video');
  });

  it('1.2 Player DOM contains synchronized YouTube video view', () => {
    assert.ok(html.includes('id="player-video-view"'), 'Must have #player-video-view');
    assert.ok(html.includes('id="player-yt-iframe"'), 'Must have #player-yt-iframe');
  });

  // --- 2. YouTube Music 6-Button Action Strip ---
  console.log('\n--- 2. YouTube Music 6-Button Action Strip ---');
  it('2.1 Action strip contains Dislike, Like, Comments, Save, Share, and Download', () => {
    assert.ok(html.includes('id="ytm-player-action-strip"'), 'Must have #ytm-player-action-strip');
    assert.ok(html.includes('id="btn-player-dislike"'), 'Must have #btn-player-dislike');
    assert.ok(html.includes('id="btn-player-like"'), 'Must have #btn-player-like');
    assert.ok(html.includes('id="btn-player-comments"'), 'Must have #btn-player-comments');
    assert.ok(html.includes('id="btn-player-save"'), 'Must have #btn-player-save');
    assert.ok(html.includes('id="btn-player-share"'), 'Must have #btn-player-share');
    assert.ok(html.includes('id="btn-player-download"'), 'Must have #btn-player-download');
  });

  // --- 3. 3-Tab Bottom Sliding Drawer ---
  console.log('\n--- 3. 3-Tab Bottom Sliding Drawer (UP NEXT, LYRICS, RELATED) ---');
  it('3.1 Drawer defines UP NEXT, LYRICS, and RELATED tabs', () => {
    assert.ok(html.includes('id="player-sliding-drawer"'), 'Must have #player-sliding-drawer');
    assert.ok(html.includes('id="drawer-tab-queue"'), 'Must have #drawer-tab-queue');
    assert.ok(html.includes('id="drawer-tab-lyrics"'), 'Must have #drawer-tab-lyrics');
    assert.ok(html.includes('id="drawer-tab-related"'), 'Must have #drawer-tab-related');
    assert.ok(html.includes('UP NEXT'), 'Must display "UP NEXT" label');
    assert.ok(html.includes('LYRICS'), 'Must display "LYRICS" label');
    assert.ok(html.includes('RELATED'), 'Must display "RELATED" label');
  });

  it('3.2 Drawer contains Autoplay toggle switch and queue container', () => {
    assert.ok(html.includes('id="autoplay-switch"'), 'Must have #autoplay-switch');
    assert.ok(html.includes('id="drawer-pane-queue"'), 'Must have #drawer-pane-queue');
    assert.ok(html.includes('id="drawer-pane-lyrics"'), 'Must have #drawer-pane-lyrics');
    assert.ok(html.includes('id="drawer-pane-related"'), 'Must have #drawer-pane-related');
  });

  // --- 4. YouTube Comments Bottom Sheet ---
  console.log('\n--- 4. YouTube Comments Bottom Sheet ---');
  it('4.1 Comments sheet exists with interactive comment list container', () => {
    assert.ok(html.includes('id="sheet-comments"'), 'Must have #sheet-comments');
    assert.ok(html.includes('id="comments-list-container"'), 'Must have #comments-list-container');
    assert.ok(html.includes('id="comments-count-label"'), 'Must have #comments-count-label');
  });

  // --- 5. CSS Rules ---
  console.log('\n--- 5. CSS Rules for Player & Drawer ---');
  it('5.1 CSS includes styles for switcher, video, strip, drawer, and comments', () => {
    assert.ok(css.includes('.ytm-player-switch-pill'), 'Must style .ytm-player-switch-pill');
    assert.ok(css.includes('.player-video-view'), 'Must style .player-video-view');
    assert.ok(css.includes('.ytm-action-strip'), 'Must style .ytm-action-strip');
    assert.ok(css.includes('.ytm-player-drawer'), 'Must style .ytm-player-drawer');
    assert.ok(css.includes('.comment-item'), 'Must style .comment-item');
  });

  console.log('\n======================================================================');
  console.log(`📊 YTM PLAYER & DRAWER TEST RESULTS: ${testsPassed} PASSED (${testsFailed} FAILED)`);
  console.log('======================================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests();
