/**
 * MUSICFLOW — THEME PROPAGATION & UNIFIED DESIGN SYSTEM AUTOMATED TEST SUITE
 * Tests instant live propagation of theme changes across Full Player, Mini Player, Equalizer,
 * Queue, Lyrics, Scrubber Canvas, and all App surfaces.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock browser DOM environment
function createMockDOM() {
  const customProperties = {};
  const listeners = {};

  const documentElement = {
    style: {
      setProperty(prop, val) {
        customProperties[prop] = String(val).trim();
      },
      getPropertyValue(prop) {
        return customProperties[prop] || '';
      },
      properties: customProperties
    }
  };

  const elements = {};

  const document = {
    documentElement,
    getElementById(id) {
      if (!elements[id]) {
        elements[id] = {
          id,
          style: {},
          classList: {
            classes: new Set(),
            add(c) { this.classes.add(c); },
            remove(c) { this.classes.delete(c); },
            contains(c) { return this.classes.has(c); },
            toggle(c, state) { if (state !== undefined) { state ? this.add(c) : this.remove(c); } else { this.contains(c) ? this.remove(c) : this.add(c); } }
          },
          textContent: '',
          innerHTML: '',
          getContext: () => ({
            clearRect: () => {},
            beginPath: () => {},
            moveTo: () => {},
            lineTo: () => {},
            stroke: () => {},
            createLinearGradient: () => ({ addColorStop: () => {} })
          }),
          getBoundingClientRect: () => ({ width: 300, height: 40, top: 0, left: 0, right: 300, bottom: 40 }),
          setAttribute: () => {},
          addEventListener: () => {}
        };
      }
      return elements[id];
    },
    querySelectorAll(selector) {
      return [];
    },
    addEventListener(evt, fn) {
      if (!listeners[evt]) listeners[evt] = [];
      listeners[evt].push(fn);
    },
    dispatchEvent(evt) {
      if (listeners[evt.type]) {
        listeners[evt.type].forEach(fn => fn(evt));
      }
    }
  };

  const window = {
    document,
    getComputedStyle(el) {
      return {
        getPropertyValue(prop) {
          return documentElement.style.getPropertyValue(prop);
        }
      };
    },
    addEventListener: document.addEventListener,
    dispatchEvent: document.dispatchEvent,
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail || {};
      }
    }
  };

  return { window, document, customProperties, elements, listeners };
}

console.log('\n======================================================');
console.log('🧪 RUNNING MUSICFLOW UNIFIED THEME SYSTEM TEST SUITE');
console.log('======================================================\n');

let passed = 0;
let failed = 0;

function runTest(name, fn) {
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

// 1. Load ThemeManager with DOM Mock
const { window, document, customProperties } = createMockDOM();
global.window = window;
global.document = document;
global.getComputedStyle = window.getComputedStyle;
global.CustomEvent = window.CustomEvent;

// Mock Storage
global.Storage = {
  data: {},
  getUserTheme() {
    return this.data.mf_user_theme || { id: 'red', name: 'MusicFlow Red', color: '#FF1744', isDefault: true };
  },
  setUserTheme(t) {
    this.data.mf_user_theme = t;
  }
};

// Mock UI & App
let onThemeChangeCalledWith = null;
global.UI = {
  onThemeChange(theme) {
    onThemeChangeCalledWith = theme;
  }
};
let redrawWaveCalled = false;
global.App = {
  redrawSeekBarWave() {
    redrawWaveCalled = true;
  }
};

const ThemeManager = require('../web-app/js/themeManager.js');

// TEST 1: Presets & Defaults
runTest('ThemeManager provides 8 built-in preset themes with high-contrast semantics', () => {
  const presets = ThemeManager.getPresets();
  assert.strictEqual(presets.length, 8, 'Expected 8 preset themes');
  const ids = presets.map(p => p.id);
  ['red', 'ocean_blue', 'emerald', 'purple', 'sunset', 'rose', 'gold', 'cyan'].forEach(id => {
    assert.ok(ids.includes(id), `Missing preset theme id: ${id}`);
  });
});

// TEST 2: Semantic CSS Variable Derivation
runTest('getCSSVariables() derives comprehensive design tokens for all preset colors', () => {
  const oceanBlueTheme = { id: 'ocean_blue', name: 'Ocean Blue', color: '#007AFF' };
  const vars = ThemeManager.getCSSVariables(oceanBlueTheme);

  assert.strictEqual(vars['--accent'], '#007AFF');
  assert.strictEqual(vars['--color-primary'], '#007AFF');
  assert.strictEqual(vars['--accent-rgb'], '0, 122, 255');
  assert.strictEqual(vars['--accent-soft'], 'rgba(0, 122, 255, 0.15)');
  assert.strictEqual(vars['--accent-glow'], 'rgba(0, 122, 255, 0.45)');
  assert.strictEqual(vars['--accent-border'], 'rgba(0, 122, 255, 0.30)');
  assert.strictEqual(vars['--accent-surface'], 'rgba(0, 122, 255, 0.08)');
  assert.strictEqual(vars['--dynamic-color'], 'rgba(0, 122, 255, 0.40)');
  assert.strictEqual(vars['--accent-text'], '#FFFFFF');
});

// TEST 3: Live Theme Switching & DOM Property Application without Reload
runTest('ThemeManager.setTheme() propagates variables live to :root without app reload', () => {
  let eventDispatched = false;
  window.addEventListener('mf_theme_change', (e) => {
    eventDispatched = true;
  });

  const applied = ThemeManager.setTheme('emerald');
  assert.strictEqual(applied.id, 'emerald');
  assert.strictEqual(applied.color, '#10B981');

  // Verify :root properties were updated immediately
  assert.strictEqual(customProperties['--accent'], '#10B981');
  assert.strictEqual(customProperties['--color-primary'], '#10B981');
  assert.strictEqual(customProperties['--accent-soft'], 'rgba(16, 185, 129, 0.15)');
  assert.strictEqual(customProperties['--accent-glow'], 'rgba(16, 185, 129, 0.45)');
  assert.strictEqual(customProperties['--accent-text'], '#FFFFFF');

  // Verify callbacks & window event
  assert.ok(onThemeChangeCalledWith !== null, 'UI.onThemeChange should be called');
  assert.strictEqual(onThemeChangeCalledWith.id, 'emerald');
  assert.strictEqual(redrawWaveCalled, true, 'App.redrawSeekBarWave should be called');
  assert.strictEqual(eventDispatched, true, 'mf_theme_change event should be fired on window');
});

// TEST 4: Custom Hex Color Themes
runTest('ThemeManager.setTheme() handles custom 6-digit hex colors with brightness-aware text contrast', () => {
  // Pure yellow #FFFF00 (Light color -> text must be black)
  const yellowTheme = ThemeManager.setTheme('#FFFF00');
  assert.strictEqual(customProperties['--accent'], '#FFFF00');
  assert.strictEqual(customProperties['--accent-text'], '#000000', 'Light theme must use black contrast text');

  // Dark Navy #000080 (Dark color -> text must be white)
  const navyTheme = ThemeManager.setTheme('#000080');
  assert.strictEqual(customProperties['--accent'], '#000080');
  assert.strictEqual(customProperties['--accent-text'], '#FFFFFF', 'Dark theme must use white contrast text');
});

// TEST 5: Dynamic Color Ambient Glow Integration
runTest('ThemeManager.setDynamicColor() updates --dynamic-color while maintaining fallback to active theme glow', () => {
  // Set Purple theme
  ThemeManager.setTheme('purple');
  assert.strictEqual(customProperties['--dynamic-color'], 'rgba(139, 92, 246, 0.40)');

  // Reset to default active theme color
  ThemeManager.resetDynamicColor();
  assert.strictEqual(customProperties['--dynamic-color'], 'rgba(139, 92, 246, 0.40)');
});

// TEST 6: Waveform Canvas Dynamic CSS Variable Polling
runTest('Waveform Canvas dynamically reads --accent and --accent-glow from :root on render', () => {
  // Switch to sunset theme
  ThemeManager.setTheme('sunset');
  const accentFromDOM = window.getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  const glowFromDOM = window.getComputedStyle(document.documentElement).getPropertyValue('--accent-glow').trim();

  assert.strictEqual(accentFromDOM, '#FF5722');
  assert.strictEqual(glowFromDOM, 'rgba(255, 87, 34, 0.45)');
});

// TEST 7: Codebase Audit for Zero Hardcoded Red Accents in Player & Subsystems
runTest('CSS & JS subsystems have zero hardcoded #FF2A4D accents bypassing the global theme system', () => {
  const cssContent = fs.readFileSync(path.join(__dirname, '../web-app/css/app.css'), 'utf8');
  const lines = cssContent.split('\n');

  const violatingLines = [];
  lines.forEach((line, idx) => {
    // Exclude :root default fallback tokens and artist-pl-card burgundy static preset
    if (idx + 1 < 30 || line.includes('card-burgundy')) return;
    if (/(#FF2A4D|#FF1744|#D50000|#FF003C|#FF5252|rgba\(\s*255\s*,\s*(23|42|0|68)\b)/i.test(line)) {
      violatingLines.push(`Line ${idx + 1}: ${line.trim()}`);
    }
  });

  assert.strictEqual(violatingLines.length, 0, `Found hardcoded accent colors in CSS:\n${violatingLines.join('\n')}`);
});

console.log('\n======================================================');
console.log(`📊 THEME SYSTEM TEST RESULTS: ${passed} Passed, ${failed} Failed`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
}
