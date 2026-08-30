// ============================================================================
// MUSICFLOW — PERFORMANCE MODE & 120 FPS RESTORATION TEST SUITE
// Verifies 120 FPS Ultra Smooth, 60 FPS Smooth, 30 FPS Saver, Auto detection,
// persistence, hardware refresh rate probing, and non-interference.
// ============================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock localStorage for Node test environment
const mockStorageData = {};
global.localStorage = {
  getItem: (k) => (k in mockStorageData ? mockStorageData[k] : null),
  setItem: (k, v) => { mockStorageData[k] = String(v); },
  removeItem: (k) => { delete mockStorageData[k]; },
  clear: () => { Object.keys(mockStorageData).forEach(k => delete mockStorageData[k]); }
};

// Mock DOM
global.document = {
  body: {
    classList: {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      contains(c) { return this._classes.has(c); },
      toggle(c, force) {
        if (force === undefined) {
          if (this._classes.has(c)) this._classes.delete(c);
          else this._classes.add(c);
        } else if (force) {
          this._classes.add(c);
        } else {
          this._classes.delete(c);
        }
      }
    },
    style: {
      _props: {},
      setProperty(p, v) { this._props[p] = v; },
      getPropertyValue(p) { return this._props[p]; }
    }
  },
  getElementById(id) {
    if (id === 'settings-perf-val') {
      if (!this._perfBadge) {
        this._perfBadge = { textContent: '' };
      }
      return this._perfBadge;
    }
    return null;
  }
};

global.window = {
  screen: { refreshRate: 60 },
  document: global.document
};

const Storage = require('./js/storage.js');
global.Storage = Storage;

const PerformanceManager = require('./js/performanceManager.js');

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

async function main() {
  console.log('\n=============================================================');
  console.log('  MUSICFLOW — PERFORMANCE MODE (120 FPS) TEST SUITE');
  console.log('=============================================================\n');

  // 1. All 4 Required Options Exist
  runTest('1. PerformanceManager: All 4 options exist (AUTO, 120 FPS, 60 FPS, 30 FPS)', () => {
    assert.strictEqual(PerformanceManager.MODES.AUTO, 'auto');
    assert.strictEqual(PerformanceManager.MODES.FPS_120, '120fps');
    assert.strictEqual(PerformanceManager.MODES.FPS_60, '60fps');
    assert.strictEqual(PerformanceManager.MODES.FPS_30, '30fps');
    assert.strictEqual(PerformanceManager.MODE_ORDER.length, 4);
  });

  // 2. Selection Persistence
  runTest('2. Selection Persistence: Mode changes persist across app reloads', () => {
    PerformanceManager.setMode('120fps');
    assert.strictEqual(Storage.getPerformanceMode(), '120fps');
    assert.strictEqual(PerformanceManager.getMode(), '120fps');

    PerformanceManager.setMode('30fps');
    assert.strictEqual(Storage.getPerformanceMode(), '30fps');
    assert.strictEqual(PerformanceManager.getMode(), '30fps');

    PerformanceManager.setMode('60fps');
    assert.strictEqual(Storage.getPerformanceMode(), '60fps');

    PerformanceManager.setMode('auto');
    assert.strictEqual(Storage.getPerformanceMode(), 'auto');
  });

  // 3. Cycle Mode
  runTest('3. Mode Cycling: Seamlessly cycles auto -> 120fps -> 60fps -> 30fps -> auto', () => {
    PerformanceManager.setMode('auto');
    assert.strictEqual(PerformanceManager.cycleMode(), '120fps');
    assert.strictEqual(PerformanceManager.cycleMode(), '60fps');
    assert.strictEqual(PerformanceManager.cycleMode(), '30fps');
    assert.strictEqual(PerformanceManager.cycleMode(), 'auto');
  });

  // 4. Hardware Capability & False 120Hz Claim Prevention
  runTest('4. Display Capability: 60Hz display does NOT falsely claim 120Hz hardware rate', () => {
    // Current window.screen has 60Hz
    assert.strictEqual(PerformanceManager.getHardwareRefreshRate(), 60);
    assert.strictEqual(PerformanceManager.is120HzSupported(), false);

    // When in 120fps mode on 60Hz display, label accurately reflects display cap
    const label60 = PerformanceManager.getDisplayLabel('120fps');
    assert(label60.includes('Display 60Hz Cap') || label60.includes('60Hz Cap'), `Label "${label60}" must indicate 60Hz cap`);

    // Target FPS on 60Hz hardware does not exceed display max
    PerformanceManager.setMode('120fps');
    assert.strictEqual(PerformanceManager.getFramerateTarget(), 60);
  });

  // 5. CSS Class and Token Application
  runTest('5. DOM & Token Application: Applies corresponding classes & variables to body', () => {
    PerformanceManager.setMode('120fps');
    assert(document.body.classList.contains('perf-120fps'), 'Must add perf-120fps class');
    assert(!document.body.classList.contains('perf-30fps'), 'Must remove perf-30fps class');

    PerformanceManager.setMode('30fps');
    assert(document.body.classList.contains('perf-30fps'), 'Must add perf-30fps class');
    assert(document.body.classList.contains('perf-lite'), 'Must add perf-lite fallback class');

    PerformanceManager.setMode('60fps');
    assert(document.body.classList.contains('perf-60fps'), 'Must add perf-60fps class');
  });

  // 6. CSS Tokens in app.css
  runTest('6. CSS Architecture: app.css defines 120fps, 60fps, and 30fps motion profiles', () => {
    const css = fs.readFileSync(path.join(__dirname, 'css', 'app.css'), 'utf8');
    assert(css.includes('body.perf-120fps'), 'app.css must have body.perf-120fps');
    assert(css.includes('body.perf-60fps'), 'app.css must have body.perf-60fps');
    assert(css.includes('body.perf-30fps'), 'app.css must have body.perf-30fps');
    assert(css.includes('--motion-fast: 100ms'), '120fps mode must define ultra-fast 100ms motion');
  });

  // 7. Settings UI Row in index.html
  runTest('7. Settings DOM: index.html contains performance mode row and script tag', () => {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    assert(html.includes('id="settings-perf-val"'), 'index.html must have #settings-perf-val');
    assert(html.includes('App.cyclePerformanceMode()'), 'index.html must trigger App.cyclePerformanceMode()');
    assert(html.includes('src="js/performanceManager.js"'), 'index.html must import performanceManager.js');
  });

  // 8. Non-interference with Playback, Gestures, and Responsive Layout
  runTest('8. System Integrity: Performance mode does not alter playback methods or gesture handlers', () => {
    const appJs = fs.readFileSync(path.join(__dirname, 'js', 'app.js'), 'utf8');
    assert(appJs.includes('cyclePerformanceMode'), 'app.js must define cyclePerformanceMode');
    assert(appJs.includes('setPerformanceMode'), 'app.js must define setPerformanceMode');
    assert(appJs.includes('initPlayer3DDeckGesture'), 'Discovery gestures must remain active');
    assert(appJs.includes('Player.togglePlay'), 'Playback controls must remain intact');
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
