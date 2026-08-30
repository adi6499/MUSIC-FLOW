// ============================================================================
// TEST SUITE: SETTINGS & RUNTIME STABILIZATION TEST (Phase 1 to 20)
// ============================================================================

const assert = require('assert');
const fs = require('fs');

console.log('\n======================================================');
console.log('🧪 RUNNING MUSICFLOW SETTINGS & RUNTIME STABILIZATION TESTS');
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
    console.error(`    ${err.message}`);
    failed++;
  }
}

// Mock DOM
global.window = {
  location: { protocol: 'http:', hostname: 'localhost', origin: 'http://localhost:3001' }
};

const domStore = {};
global.document = {
  getElementById: (id) => {
    if (!domStore[id]) {
      domStore[id] = {
        id,
        innerHTML: '',
        textContent: '',
        style: { setProperty: (k, v) => { domStore[id].style[k] = v; } },
        classList: {
          contains: (cls) => Boolean(domStore[id]?._classes?.has(cls)),
          add: (cls) => { if (!domStore[id]._classes) domStore[id]._classes = new Set(); domStore[id]._classes.add(cls); },
          remove: (cls) => { if (domStore[id]._classes) domStore[id]._classes.delete(cls); }
        },
        querySelectorAll: () => [],
        dataset: {}
      };
    }
    return domStore[id];
  },
  querySelectorAll: () => [],
  documentElement: {
    style: {
      vars: {},
      setProperty: function(k, v) { this.vars[k] = v; }
    }
  }
};

const ThemeManager = require('../web-app/js/themeManager.js');
const UI = require('../web-app/js/ui.js');
const AudioEffectsEngine = require('../web-app/js/audioEffectsEngine.js');

it('1. ThemeManager provides 8 presets and updates CSS variables', () => {
  const presets = ThemeManager.getPresets();
  assert.strictEqual(presets.length, 8, 'Must have 8 native presets');
  
  ThemeManager.setTheme('ocean_blue');
  const active = ThemeManager.getTheme();
  assert.strictEqual(active.color, '#007AFF', 'Ocean blue hex must match');
  assert.strictEqual(document.documentElement.style.vars['--accent'], '#007AFF', '--accent variable must be set on :root');
});

it('2. UI.renderThemePicker is a valid function and populates presets container', () => {
  assert.strictEqual(typeof UI.renderThemePicker, 'function', 'UI.renderThemePicker must be defined');
  const container = document.getElementById('theme-presets-container');
  UI.renderThemePicker();
  assert.ok(container.innerHTML.includes('theme-preset-card'), 'Presets grid must contain preset cards');
  assert.ok(container.innerHTML.includes('MusicFlow Red'), 'Must contain default preset name');
  assert.ok(container.innerHTML.includes('Ocean Blue'), 'Must contain Ocean Blue preset name');
});

it('3. UI.renderSleepTimerDialog populates dialog-sleep-timer-body correctly', () => {
  assert.strictEqual(typeof UI.renderSleepTimerDialog, 'function', 'UI.renderSleepTimerDialog must be defined');
  const body = document.getElementById('dialog-sleep-timer-body');
  UI.renderSleepTimerDialog({ active: false });
  assert.ok(body.innerHTML.includes('15 Minutes'), 'Must include 15 Minutes chip');
  assert.ok(body.innerHTML.includes('End of Track'), 'Must include End of Track chip');
  assert.ok(body.innerHTML.includes('sleep-custom-slider'), 'Must include custom duration slider');
});

it('4. UI.renderQualityOptions renders 320kbps, 160kbps, and 96kbps with active state', () => {
  assert.strictEqual(typeof UI.renderQualityOptions, 'function', 'UI.renderQualityOptions must be defined');
  const container = document.getElementById('quality-options-list');
  UI.renderQualityOptions('320kbps');
  assert.ok(container.innerHTML.includes('Lossless / High Quality (320 kbps)'), 'Must include 320 kbps');
  assert.ok(container.innerHTML.includes('Standard Quality (160 kbps)'), 'Must include 160 kbps');
  assert.ok(container.innerHTML.includes('Data Saver (96 kbps)'), 'Must include 96 kbps');
});

it('5. UI.renderLanguagesPicker renders selectable language checkboxes', () => {
  assert.strictEqual(typeof UI.renderLanguagesPicker, 'function', 'UI.renderLanguagesPicker must be defined');
  const container = document.getElementById('lang-selection-list');
  UI.renderLanguagesPicker(['hindi', 'english']);
  assert.ok(container.innerHTML.includes('Hindi'), 'Must include Hindi');
  assert.ok(container.innerHTML.includes('English'), 'Must include English');
  assert.ok(container.innerHTML.includes('Punjabi'), 'Must include Punjabi');
});

it('6. AudioEffectsEngine exports resumeContext and resumeAudioContext', () => {
  assert.strictEqual(typeof AudioEffectsEngine.resumeContext, 'function', 'Must export resumeContext');
  assert.strictEqual(typeof AudioEffectsEngine.resumeAudioContext, 'function', 'Must export resumeAudioContext alias');
  assert.strictEqual(typeof AudioEffectsEngine.resume, 'function', 'Must export resume alias');
});

it('7. app.css and ui.js contain zero instances of deprecated -webkit-appearance: slider-vertical', () => {
  const uiJs = fs.readFileSync('web-app/js/ui.js', 'utf8');
  const appCss = fs.readFileSync('web-app/css/app.css', 'utf8');
  assert.ok(!uiJs.includes('appearance:slider-vertical') && !uiJs.includes('appearance: slider-vertical'), 'ui.js must not contain slider-vertical');
  assert.ok(!appCss.includes('appearance:slider-vertical') && !appCss.includes('appearance: slider-vertical'), 'app.css must not contain slider-vertical');
});

console.log('\n======================================================');
console.log(`📊 SETTINGS TEST RESULTS: ${passed} Passed, ${failed} Failed`);
console.log('======================================================\n');

if (failed > 0) process.exit(1);
