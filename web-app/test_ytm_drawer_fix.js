const fs = require('fs');
const path = require('path');
const assert = require('assert');

function runTests() {
  console.log('======================================================================');
  console.log('🧪 VERIFYING DRAWER FIXES, CLOSING INTERACTIONS & REAL COMMENTS');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  function it(desc, fn) {
    try {
      fn();
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${desc}:`, err.message);
      failed++;
    }
  }

  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
  const css = fs.readFileSync(path.join(__dirname, 'css', 'app.css'), 'utf-8');
  const appJs = fs.readFileSync(path.join(__dirname, 'js', 'app.js'), 'utf-8');
  const serverJs = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf-8');

  // 1. Drawer Closability Elements in HTML
  console.log('--- 1. Drawer Closability in HTML ---');
  it('1.1 Backdrop exists with App.collapsePlayerDrawer()', () => {
    assert.ok(html.includes('id="player-drawer-backdrop"'), 'Must have #player-drawer-backdrop');
    assert.ok(html.includes('App.collapsePlayerDrawer()'), 'Backdrop must trigger App.collapsePlayerDrawer()');
  });

  it('1.2 Dedicated collapse button exists in drawer header', () => {
    assert.ok(html.includes('id="btn-collapse-drawer"'), 'Must have #btn-collapse-drawer');
    assert.ok(html.includes('keyboard_arrow_down'), 'Close button must display collapse chevron');
  });

  it('1.3 Interactive comment input row exists in comments sheet', () => {
    assert.ok(html.includes('id="comment-input-row"'), 'Must have #comment-input-row');
    assert.ok(html.includes('id="input-new-comment"'), 'Must have #input-new-comment');
    assert.ok(html.includes('App.postUserComment()'), 'Must have App.postUserComment()');
  });

  // 2. Queue Cover Thumbnails & CSS
  console.log('\n--- 2. Queue Item Thumbnails & Drawer Styling ---');
  it('2.1 .queue-track-thumb has fixed 44px size to prevent giant images', () => {
    assert.ok(css.includes('.queue-track-thumb'), 'Must style .queue-track-thumb');
    assert.ok(css.includes('width: 44px;') || css.includes('width:44px;'), 'Must have width 44px');
    assert.ok(css.includes('height: 44px;') || css.includes('height:44px;'), 'Must have height 44px');
    assert.ok(css.includes('object-fit: cover;'), 'Must have object-fit: cover');
  });

  it('2.2 .drawer-backdrop and .drawer-close-btn are styled', () => {
    assert.ok(css.includes('.drawer-backdrop'), 'Must style .drawer-backdrop');
    assert.ok(css.includes('.drawer-close-btn'), 'Must style .drawer-close-btn');
  });

  // 3. JavaScript Logic in app.js
  console.log('\n--- 3. JavaScript Drawer & Comments Logic ---');
  it('3.1 collapsePlayerDrawer and openPlayerDrawer are defined', () => {
    assert.ok(appJs.includes('function collapsePlayerDrawer()'), 'Must define collapsePlayerDrawer');
    assert.ok(appJs.includes('function openPlayerDrawer()'), 'Must define openPlayerDrawer');
  });

  it('3.2 switchDrawerTab toggles/collapses when tapping active tab', () => {
    assert.ok(appJs.includes('currentDrawerTab === tab'), 'Must detect tapping already active tab');
    assert.ok(appJs.includes('collapsePlayerDrawer()'), 'Must call collapsePlayerDrawer');
  });

  it('3.3 Swipe pull-down gesture is attached to drawer', () => {
    assert.ok(appJs.includes('initDrawerGestures'), 'Must define initDrawerGestures');
    assert.ok(appJs.includes('endY - startY > 40'), 'Must measure pull-down distance to collapse');
  });

  it('3.4 renderDrawerRelated unpacks candidates array', () => {
    assert.ok(appJs.includes('Array.isArray(rRes) ? rRes : (rRes?.candidates || [])'), 'Must unpack candidates array from getRadioCandidates');
  });

  it('3.5 openCommentsSheet loads real YouTube comments endpoint', () => {
    assert.ok(appJs.includes('/api/youtube/comments?videoId='), 'Must fetch real comments from /api/youtube/comments');
    assert.ok(!appJs.includes('@AcousticVibes'), 'Fake hardcoded comment @AcousticVibes must be removed');
    assert.ok(appJs.includes('function postUserComment()'), 'Must define postUserComment');
  });

  it('3.6 App exports drawer controls and comment actions', () => {
    assert.ok(appJs.includes('collapsePlayerDrawer,'), 'App must export collapsePlayerDrawer');
    assert.ok(appJs.includes('openPlayerDrawer,'), 'App must export openPlayerDrawer');
    assert.ok(appJs.includes('postUserComment,'), 'App must export postUserComment');
  });

  // 4. Server Endpoint in server.js
  console.log('\n--- 4. Server Real YouTube Comments Endpoint ---');
  it('4.1 server.js routes /api/youtube/comments', () => {
    assert.ok(serverJs.includes('/api/youtube/comments'), 'server.js must have /api/youtube/comments route');
    assert.ok(serverJs.includes('handleGetYouTubeComments'), 'server.js must define handleGetYouTubeComments');
    assert.ok(serverJs.includes('commentEntityPayload'), 'server.js must parse real YouTube commentEntityPayload');
  });

  console.log('\n======================================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED (${failed} FAILED)`);
  console.log('======================================================================\n');

  if (failed > 0) process.exit(1);
}

runTests();
