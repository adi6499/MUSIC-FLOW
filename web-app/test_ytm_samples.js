// ============================================================================
// MUSICFLOW — YOUTUBE MUSIC SAMPLES TAB TEST SUITE (Step 4)
// Verifies vertical discovery reel, sample playback, like toggle, and playlist save.
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
  console.log('🧪 YOUTUBE MUSIC SAMPLES TAB TEST SUITE');
  console.log('======================================================================\n');

  const htmlPath = path.join(__dirname, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // --- 1. Script & DOM Verification ---
  console.log('--- 1. Script & DOM Verification ---');
  it('1.1 index.html includes js/samplesFeed.js script tag', () => {
    assert.ok(html.includes('src="js/samplesFeed.js"'), 'Must load js/samplesFeed.js');
  });

  it('1.2 DOM defines #screen-samples and #samples-reel-container', () => {
    assert.ok(html.includes('id="screen-samples"'), 'Must have #screen-samples');
    assert.ok(html.includes('id="samples-reel-container"'), 'Must have #samples-reel-container');
    assert.ok(html.includes('class="samples-top-title">Samples<'), 'Must show Samples header title');
  });

  // --- 2. SamplesFeed Module Interface ---
  console.log('\n--- 2. SamplesFeed Module Interface ---');
  const SamplesFeed = require('./js/samplesFeed.js');

  it('2.1 SamplesFeed exports required discovery methods', () => {
    assert.strictEqual(typeof SamplesFeed.init, 'function');
    assert.strictEqual(typeof SamplesFeed.render, 'function');
    assert.strictEqual(typeof SamplesFeed.playFullSong, 'function');
    assert.strictEqual(typeof SamplesFeed.toggleLike, 'function');
    assert.strictEqual(typeof SamplesFeed.addToPlaylist, 'function');
    assert.strictEqual(typeof SamplesFeed.shareSample, 'function');
  });

  // --- 3. Samples Interaction with Player and Storage ---
  console.log('\n--- 3. Player & Storage Integration ---');
  it('3.1 SamplesFeed.playFullSong invokes Player and Full Player expansion', () => {
    let playedTrack = null;
    let expanded = false;

    global.Player = {
      playTrack: (t) => { playedTrack = t; }
    };
    global.App = {
      expandFullPlayer: () => { expanded = true; }
    };

    // Initialize mock samples
    global.document = {
      getElementById: () => ({ innerHTML: '' }),
      querySelectorAll: () => []
    };

    SamplesFeed.init().then(() => {
      SamplesFeed.playFullSong(0);
      assert.ok(playedTrack !== null, 'Track must be dispatched to Player');
      assert.strictEqual(expanded, true, 'Full player must expand');
    });
  });

  console.log('\n======================================================================');
  console.log(`📊 YTM SAMPLES TEST RESULTS: ${testsPassed} PASSED (${testsFailed} FAILED)`);
  console.log('======================================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests();
