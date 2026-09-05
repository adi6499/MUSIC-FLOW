// ============================================================================
// TEST SUITE: YouTube Music Radio Builder & Search Parity (Step 5)
// ============================================================================

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}: ${err.message}`);
    failed++;
  }
}

console.log('\n======================================================================');
console.log('🧪 YOUTUBE MUSIC RADIO BUILDER & SEARCH TEST SUITE');
console.log('======================================================================\n');

// 1. Static HTML & Script Verification
it('index.html contains #btn-search-voice in search input bar', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert(html.includes('id="btn-search-voice"'), 'Missing #btn-search-voice');
  assert(html.includes('App.startVoiceSearch()'), 'Missing onclick startVoiceSearch');
});

it('index.html contains #banner-radio-builder in discovery hub', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert(html.includes('id="banner-radio-builder"'), 'Missing #banner-radio-builder');
  assert(html.includes('Create a radio'), 'Missing Create a radio title');
  assert(html.includes('RadioBuilder.open()'), 'Missing onclick RadioBuilder.open()');
});

it('index.html contains #sheet-radio-builder with controls', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert(html.includes('id="sheet-radio-builder"'), 'Missing #sheet-radio-builder');
  assert(html.includes('id="radio-artist-grid"'), 'Missing #radio-artist-grid');
  assert(html.includes('id="radio-builder-step-label"'), 'Missing #radio-builder-step-label');
  assert(html.includes('data-variety="familiar"'), 'Missing variety selector');
  assert(html.includes('data-mood="chill"'), 'Missing mood selector');
  assert(html.includes('id="btn-launch-radio"'), 'Missing #btn-launch-radio');
});

it('index.html loads js/radioBuilder.js before js/app.js', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const rbIndex = html.indexOf('src="js/radioBuilder.js"');
  const appIndex = html.indexOf('src="js/app.js"');
  assert(rbIndex !== -1, 'radioBuilder.js script tag missing');
  assert(appIndex !== -1, 'app.js script tag missing');
  assert(rbIndex < appIndex, 'radioBuilder.js must be loaded before app.js');
});

// 2. RadioBuilder Module Functional Tests
const RadioBuilder = require('./js/radioBuilder.js');

it('RadioBuilder exports all required methods', () => {
  assert(typeof RadioBuilder.open === 'function', 'open is missing');
  assert(typeof RadioBuilder.toggleArtist === 'function', 'toggleArtist is missing');
  assert(typeof RadioBuilder.setVariety === 'function', 'setVariety is missing');
  assert(typeof RadioBuilder.setMood === 'function', 'setMood is missing');
  assert(typeof RadioBuilder.launch === 'function', 'launch is missing');
  assert(typeof RadioBuilder.getSelectedArtists === 'function', 'getSelectedArtists is missing');
});

it('RadioBuilder artist toggling works correctly', () => {
  // Global document mocks
  global.document = {
    getElementById: (id) => ({
      textContent: '',
      classList: {
        toggle: () => {}
      }
    }),
    querySelectorAll: () => []
  };

  RadioBuilder.toggleArtist('Taylor Swift');
  assert(RadioBuilder.getSelectedArtists().includes('Taylor Swift'), 'Taylor Swift should be selected');

  RadioBuilder.toggleArtist('The Weeknd');
  assert(RadioBuilder.getSelectedArtists().length === 2, 'Should have 2 selected artists');

  // Toggle off
  RadioBuilder.toggleArtist('Taylor Swift');
  assert(!RadioBuilder.getSelectedArtists().includes('Taylor Swift'), 'Taylor Swift should be unselected');
  assert(RadioBuilder.getSelectedArtists().length === 1, 'Should have 1 selected artist');
});

it('RadioBuilder enforces max 10 artists limit', () => {
  for (let i = 0; i < 15; i++) {
    RadioBuilder.toggleArtist(`Artist_${i}`);
  }
  assert(RadioBuilder.getSelectedArtists().length <= 10, 'Must not allow more than 10 artists');
});

it('RadioBuilder variety and mood setters update state', () => {
  RadioBuilder.setVariety('discover');
  assert.strictEqual(RadioBuilder.getVariety(), 'discover', 'Variety should be discover');

  RadioBuilder.setMood('upbeat');
  assert.strictEqual(RadioBuilder.getMood(), 'upbeat', 'Mood should be upbeat');
});

console.log('\n======================================================================');
console.log(`📊 RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('======================================================================\n');

if (failed > 0) process.exit(1);
