// ============================================================================
// MUSICFLOW — YOUTUBE MUSIC SHELL & 4-TAB NAVIGATION TEST SUITE (Step 1)
// Verifies 1:1 YouTube Music App Shell, Top Bar, and 4-Tab Bottom Navigation.
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
  console.log('🧪 YOUTUBE MUSIC SHELL & 4-TAB NAVIGATION TEST SUITE');
  console.log('======================================================================\n');

  const htmlPath = path.join(__dirname, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  const cssPath = path.join(__dirname, 'css', 'app.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // --- 1. YouTube Music Signature Top Bar ---
  console.log('--- 1. YouTube Music Signature Top Bar ---');
  it('1.1 Top app bar contains YTM logo icon and Music brand text', () => {
    assert.ok(html.includes('id="ytm-top-bar"'), 'Must have #ytm-top-bar element');
    assert.ok(html.includes('class="ytm-brand-wrap"'), 'Must have .ytm-brand-wrap');
    assert.ok(html.includes('class="ytm-brand-text"'), 'Must have .ytm-brand-text');
    assert.ok(html.includes('>Music<'), 'Must display "Music" text');
  });

  it('1.2 Top app bar contains Cast, Search, and Avatar buttons', () => {
    assert.ok(html.includes('id="btn-top-cast"'), 'Must have #btn-top-cast button');
    assert.ok(html.includes('id="btn-top-search"'), 'Must have #btn-top-search button');
    assert.ok(html.includes('id="btn-user-profile"'), 'Must have #btn-user-profile button');
    assert.ok(html.includes('id="home-user-avatar"'), 'Must retain #home-user-avatar image');
  });

  // --- 2. Canonical 4-Tab Bottom Navigation ---
  console.log('\n--- 2. Canonical 4-Tab Bottom Navigation ---');
  it('2.1 Bottom nav defines exactly 4 canonical tabs: Home, Samples, Explore, Library', () => {
    assert.ok(html.includes('data-target="home"'), 'Must include Home tab');
    assert.ok(html.includes('data-target="samples"'), 'Must include Samples tab');
    assert.ok(html.includes('data-target="explore"'), 'Must include Explore tab');
    assert.ok(html.includes('data-target="library"'), 'Must include Library tab');
  });

  it('2.2 Tab labels match official YouTube Music naming', () => {
    assert.ok(html.includes('<span class="nav-label">Home</span>'), 'Tab 1 label must be Home');
    assert.ok(html.includes('<span class="nav-label">Samples</span>'), 'Tab 2 label must be Samples');
    assert.ok(html.includes('<span class="nav-label">Explore</span>'), 'Tab 3 label must be Explore');
    assert.ok(html.includes('<span class="nav-label">Library</span>'), 'Tab 4 label must be Library');
  });

  // --- 3. Screen Structure ---
  console.log('\n--- 3. Screen Structure & Backwards Compatibility ---');
  it('3.1 Both #screen-samples and legacy #screen-search exist in DOM', () => {
    assert.ok(html.includes('id="screen-samples"'), 'Must contain #screen-samples');
    assert.ok(html.includes('id="screen-search"'), 'Must contain #screen-search for backwards compatibility');
    assert.ok(html.includes('id="screen-home"'), 'Must contain #screen-home');
    assert.ok(html.includes('id="screen-explore"'), 'Must contain #screen-explore');
    assert.ok(html.includes('id="screen-library"'), 'Must contain #screen-library');
  });

  // --- 4. CSS Design Tokens & Styles ---
  console.log('\n--- 4. CSS Design Tokens & YTM Theme ---');
  it('4.1 CSS defines YouTube Red accent and AMOLED obsidian background', () => {
    assert.ok(css.includes('--accent: #FF0000;'), 'Must have YouTube Red #FF0000 accent');
    assert.ok(css.includes('--bg-app: #030303;'), 'Must have AMOLED obsidian #030303 background');
    assert.ok(css.includes('.ytm-brand-wrap'), 'Must define .ytm-brand-wrap CSS');
    assert.ok(css.includes('.ytm-top-bar'), 'Must define .ytm-top-bar CSS');
    assert.ok(css.includes('#screen-samples'), 'Must define #screen-samples CSS');
    assert.ok(css.includes('.samples-reel-wrapper'), 'Must define .samples-reel-wrapper CSS');
  });

  console.log('\n======================================================================');
  console.log(`📊 YTM SHELL & NAV TEST RESULTS: ${testsPassed} PASSED (${testsFailed} FAILED)`);
  console.log('======================================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests();
