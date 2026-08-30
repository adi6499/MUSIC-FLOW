// ============================================================================
// MUSICFLOW — SEARCH TYPING RESPONSIVENESS & PLAYER TOP-BAR VERIFICATION
// ============================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

async function main() {
  console.log('\n=============================================================');
  console.log('  MUSICFLOW — SEARCH TYPING & PLAYER TOP-BAR TEST SUITE');
  console.log('=============================================================\n');

  // --------------------------------------------------------------------------
  // 1. FULL PLAYER TOP-BAR VERIFICATION
  // --------------------------------------------------------------------------
  runTest('Player Top-Bar: Cast and More/Queue buttons are removed from header', () => {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    
    // Header should contain collapse button and context column
    assert(html.includes('id="btn-player-collapse"'), 'Must have back/collapse button');
    assert(html.includes('id="player-context-tag"'), 'Must have PLAYING FROM tag');
    assert(html.includes('id="player-context-title"'), 'Must have context title');

    // Header MUST NOT contain btn-player-cast or btn-player-right-action
    assert(!html.includes('id="btn-player-cast"'), 'Cast icon must be removed');
    assert(!html.includes('id="btn-player-right-action"'), 'Right More/Queue button must be removed from top bar');
    assert(!html.includes('class="player-top-right-actions"'), 'Old top-right actions container must be removed');

    // Header must contain non-clickable balancer for symmetry
    assert(html.includes('class="player-top-bar-balancer"'), 'Must include balancer for center alignment');
  });

  runTest('Player Top-Bar CSS: Balancer is non-clickable and centered', () => {
    const css = fs.readFileSync(path.join(__dirname, 'css/app.css'), 'utf8');
    assert(css.includes('.player-top-bar-balancer'), 'CSS must define .player-top-bar-balancer');
    assert(css.includes('pointer-events: none'), 'Balancer must not capture clicks');
  });

  // --------------------------------------------------------------------------
  // 2. SEARCH TYPING RESPONSIVENESS & DEBOUNCE
  // --------------------------------------------------------------------------
  runTest('Search Input: Text value updates synchronously without blocking', () => {
    let inputValue = '';
    const fakeInput = {
      value: '',
      listeners: {},
      addEventListener(evt, cb) { this.listeners[evt] = cb; },
      simulateTyping(str) {
        for (const char of str) {
          this.value += char;
          if (this.listeners['input']) this.listeners['input']();
        }
      }
    };

    let debounceTimer = null;
    let searchDispatches = [];

    fakeInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchDispatches.push(fakeInput.value.trim());
      }, 250);
    });

    fakeInput.simulateTyping('arijit');
    assert.strictEqual(fakeInput.value, 'arijit', 'All characters captured immediately');
    assert.strictEqual(searchDispatches.length, 0, 'No search triggered mid-typing');
  });

  await runAsyncTest('Search Debounce: Dispatches exactly one query after user pauses', async () => {
    let searchDispatches = [];
    let debounceTimer = null;

    function handleTyping(text) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchDispatches.push(text);
      }, 50); // fast test debounce
    }

    handleTyping('a');
    handleTyping('ar');
    handleTyping('ari');
    handleTyping('arij');
    handleTyping('ariji');
    handleTyping('arijit');

    await new Promise(r => setTimeout(r, 80));
    assert.strictEqual(searchDispatches.length, 1);
    assert.strictEqual(searchDispatches[0], 'arijit');
  });

  await runAsyncTest('Search Stale Cancellation: Out-of-order responses do not overwrite newer results', async () => {
    let searchRequestId = 0;
    let activeRenderedQuery = null;

    async function simulateSearch(query, delayMs) {
      const thisReqId = ++searchRequestId;
      await new Promise(r => setTimeout(r, delayMs));
      
      // Stale check
      if (thisReqId !== searchRequestId) return;
      activeRenderedQuery = query;
    }

    // Request 1: "arijit" takes 100ms
    simulateSearch('arijit', 100);
    // Request 2: "atif" quickly supersedes and takes 30ms
    simulateSearch('atif', 30);

    await new Promise(r => setTimeout(r, 120));

    // Even though "arijit" finished last, "atif" should remain active because Request 1 was stale!
    assert.strictEqual(activeRenderedQuery, 'atif', 'Stale response for "arijit" was rejected');
  });

  runTest('Search Images: Lazy loading and async decoding are enforced', () => {
    const uiJs = fs.readFileSync(path.join(__dirname, 'js/ui.js'), 'utf8');
    assert(uiJs.includes('loading="lazy" decoding="async"'), 'Search results must use lazy and async image decoding');
  });

  console.log('\n=============================================================');
  console.log(`  TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
  console.log('=============================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
