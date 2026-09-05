// ============================================================================
// MUSICFLOW — YOUTUBE MUSIC HOME FEED PARITY TEST SUITE (Step 3)
// Verifies 1:1 Mood Chips, Listen Again 2x3 Grid, and Quick Picks Shelves.
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

async function runTests() {
  console.log('\n======================================================================');
  console.log('🧪 YOUTUBE MUSIC HOME FEED PARITY TEST SUITE');
  console.log('======================================================================\n');

  const htmlPath = path.join(__dirname, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  const cssPath = path.join(__dirname, 'css', 'app.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // --- 1. Canonical Mood & Activity Chips ---
  console.log('--- 1. Canonical Mood & Activity Chips ---');
  it('1.1 Mood container includes Energize, Workout, Relax, Focus, and Commute chips', () => {
    assert.ok(html.includes('data-mood="Energize"'), 'Must include Energize chip');
    assert.ok(html.includes('data-mood="Workout"'), 'Must include Workout chip');
    assert.ok(html.includes('data-mood="Relax"'), 'Must include Relax chip');
    assert.ok(html.includes('data-mood="Focus"'), 'Must include Focus chip');
    assert.ok(html.includes('data-mood="Commute"'), 'Must include Commute chip');
  });

  // --- 2. Listen Again & Quick Picks Shelves ---
  console.log('\n--- 2. Listen Again & Quick Picks Shelves ---');
  it('2.1 Listen again 2x3 shelf section and container exist', () => {
    assert.ok(html.includes('id="shelf-listen-again-section"'), 'Must have #shelf-listen-again-section');
    assert.ok(html.includes('id="ytm-listen-again-container"'), 'Must have #ytm-listen-again-container');
    assert.ok(html.includes('Listen again'), 'Must have "Listen again" shelf title');
  });

  it('2.2 Quick picks shelf section and Play All button exist', () => {
    assert.ok(html.includes('id="quick-picks-section"'), 'Must have #quick-picks-section');
    assert.ok(html.includes('id="quick-picks-container"'), 'Must have #quick-picks-container');
    assert.ok(html.includes('id="btn-quick-picks-play-all"'), 'Must have Play all button');
  });

  // --- 3. CSS Rules ---
  console.log('\n--- 3. CSS Rules ---');
  it('3.1 CSS defines .ytm-listen-again-grid and .listen-again-item', () => {
    assert.ok(css.includes('.ytm-listen-again-grid'), 'Must style .ytm-listen-again-grid');
    assert.ok(css.includes('.listen-again-item'), 'Must style .listen-again-item');
    assert.ok(css.includes('.quick-picks-carousel'), 'Must style .quick-picks-carousel');
  });

  // --- 4. UI.renderListenAgain Method ---
  console.log('\n--- 4. UI.renderListenAgain Implementation ---');
  it('4.1 ui.js defines renderListenAgain method', () => {
    const uiJs = fs.readFileSync(path.join(__dirname, 'js', 'ui.js'), 'utf8');
    assert.ok(uiJs.includes('renderListenAgain('), 'ui.js must implement renderListenAgain');
  });

  console.log('\n======================================================================');
  console.log(`📊 YTM HOME FEED TEST RESULTS: ${testsPassed} PASSED (${testsFailed} FAILED)`);
  console.log('======================================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests();
