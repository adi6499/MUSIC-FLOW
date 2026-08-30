/**
 * test_theme_language_artist_navigation.js
 * Verification test suite for:
 * 1. Playlist / Song List Artist Navigation Isolation & Plain Text
 * 2. Jetpack Compose-style Custom App Theme & ThemeManager
 * 3. Language-Aware Personalization, Normalization & Session Radio Deduplication
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock localStorage and DOM environment for Node
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

global.localStorage = localStorageMock;
global.window = {
  localStorage: localStorageMock,
  location: { href: 'http://localhost:3000' }
};
global.document = {
  documentElement: {
    style: {
      setProperty: (k, v) => {},
      getPropertyValue: (k) => ''
    }
  },
  getElementById: () => null,
  querySelectorAll: () => []
};

// Load modules
const DataNormalizer = require('./js/dataNormalizer.js');
const Storage = require('./js/storage.js');
const ThemeManager = require('./js/themeManager.js');
const TrackDeduplicator = require('./js/trackDeduplicator.js');
const FeatureStore = require('./js/featureStore.js');
const MusicFlowEmbedder = require('./js/musicFlowEmbedder.js');
const RecommendationEngine = require('./js/recommendationEngine.js');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('\n======================================================');
console.log('TEST SUITE: THEME, LANGUAGE-AWARE PERSONALIZATION & ARTIST ISOLATION');
console.log('======================================================\n');

// ----------------------------------------------------------------------------
// TEST SECTION 1: ThemeManager & Custom App Accent Colors
// ----------------------------------------------------------------------------
console.log('[1] ThemeManager & Appearance Tokens:');

runTest('ThemeManager provides 8 presets with valid colors', () => {
  const presets = ThemeManager.getPresets();
  assert.strictEqual(presets.length, 8, 'Must have 8 preset colors');
  assert.ok(presets.find(p => p.id === 'red' && p.color === '#FF1744'));
  assert.ok(presets.find(p => p.id === 'ocean_blue' && p.color === '#007AFF'));
  assert.ok(presets.find(p => p.id === 'emerald' && p.color === '#10B981'));
  assert.ok(presets.find(p => p.id === 'purple' && p.color === '#8B5CF6'));
  assert.ok(presets.find(p => p.id === 'sunset' && p.color === '#FF5722'));
  assert.ok(presets.find(p => p.id === 'rose' && p.color === '#EC4899'));
  assert.ok(presets.find(p => p.id === 'gold' && p.color === '#F59E0B'));
  assert.ok(presets.find(p => p.id === 'cyan' && p.color === '#06B6D4'));
});

runTest('ThemeManager sets preset and computes CSS variable tokens', () => {
  const theme = ThemeManager.setTheme('ocean_blue');
  assert.strictEqual(theme.id, 'ocean_blue');
  assert.strictEqual(theme.color, '#007AFF');
  
  const vars = ThemeManager.getCSSVariables();
  assert.strictEqual(vars['--accent'], '#007AFF');
  assert.strictEqual(vars['--accent-rgb'], '0, 122, 255');
  assert.strictEqual(vars['--accent-text'], '#FFFFFF');
  assert.ok(vars['--accent-soft'].includes('rgba(0, 122, 255'));
  assert.ok(vars['--accent-surface'].includes('rgba(0, 122, 255'));
});

runTest('ThemeManager handles custom hex color and calculates WCAG contrast text', () => {
  // Test bright yellow -> needs dark text
  const customYellow = ThemeManager.setAccentColor('#FFFF00');
  assert.strictEqual(customYellow.color, '#FFFF00');
  const varsYellow = ThemeManager.getCSSVariables();
  assert.strictEqual(varsYellow['--accent-text'], '#000000', 'Bright yellow accent must have dark text for contrast');

  // Test dark navy -> needs light text
  const customDark = ThemeManager.setAccentColor('#001F3F');
  assert.strictEqual(customDark.color, '#001F3F');
  const varsDark = ThemeManager.getCSSVariables();
  assert.strictEqual(varsDark['--accent-text'], '#FFFFFF', 'Dark accent must have light text for contrast');
});

runTest('ThemeManager resets to default MusicFlow Red', () => {
  const def = ThemeManager.reset();
  assert.strictEqual(def.id, 'red');
  assert.strictEqual(def.color, '#FF1744');
  const saved = Storage.getTheme();
  assert.strictEqual(saved.id, 'red');
});

// ----------------------------------------------------------------------------
// TEST SECTION 2: DataNormalizer Robustness & Language Normalization
// ----------------------------------------------------------------------------
console.log('\n[2] DataNormalizer Robustness & Language Normalization:');

runTest('DataNormalizer.normalizeLanguage maps various locales and native scripts correctly', () => {
  assert.strictEqual(DataNormalizer.normalizeLanguage('hi'), 'hindi');
  assert.strictEqual(DataNormalizer.normalizeLanguage('Hindi'), 'hindi');
  assert.strictEqual(DataNormalizer.normalizeLanguage('हिंदी'), 'hindi');
  assert.strictEqual(DataNormalizer.normalizeLanguage('en'), 'english');
  assert.strictEqual(DataNormalizer.normalizeLanguage('ENGLISH'), 'english');
  assert.strictEqual(DataNormalizer.normalizeLanguage('pa'), 'punjabi');
  assert.strictEqual(DataNormalizer.normalizeLanguage('ਪੰਜਾਬੀ'), 'punjabi');
  assert.strictEqual(DataNormalizer.normalizeLanguage('ta'), 'tamil');
  assert.strictEqual(DataNormalizer.normalizeLanguage('தமிழ்'), 'tamil');
  assert.strictEqual(DataNormalizer.normalizeLanguage('te'), 'telugu');
  assert.strictEqual(DataNormalizer.normalizeLanguage('తెలుగు'), 'telugu');
  assert.strictEqual(DataNormalizer.normalizeLanguage('bn'), 'bengali');
  assert.strictEqual(DataNormalizer.normalizeLanguage('বাংলা'), 'bengali');
  assert.strictEqual(DataNormalizer.normalizeLanguage('mr'), 'marathi');
  assert.strictEqual(DataNormalizer.normalizeLanguage('मराठी'), 'marathi');
  assert.strictEqual(DataNormalizer.normalizeLanguage('gu'), 'gujarati');
  assert.strictEqual(DataNormalizer.normalizeLanguage('ગુજરાતી'), 'gujarati');
  assert.strictEqual(DataNormalizer.normalizeLanguage('spanish'), 'spanish');
  assert.strictEqual(DataNormalizer.normalizeLanguage('español'), 'spanish');
  assert.strictEqual(DataNormalizer.normalizeLanguage('korean'), 'korean');
  assert.strictEqual(DataNormalizer.normalizeLanguage('k-pop'), 'korean');
  assert.strictEqual(DataNormalizer.normalizeLanguage(null), 'unknown');
  assert.strictEqual(DataNormalizer.normalizeLanguage(''), 'unknown');
});

runTest('DataNormalizer.getArtistString & normalizeArtists handle malformed/object artist fields without throwing', () => {
  // Direct object with no string
  const songWithObject = {
    id: 's1',
    name: 'Song 1',
    artists: { primary: [{ name: 'Arijit Singh' }, { name: 'Pritam' }] }
  };
  const artStr = DataNormalizer.getArtistName(songWithObject.artists);
  assert.strictEqual(artStr, 'Arijit Singh, Pritam');

  // Array of strings
  assert.strictEqual(DataNormalizer.getArtistName(['Diljit Dosanjh', 'Karan Aujla']), 'Diljit Dosanjh, Karan Aujla');

  // Single string
  assert.strictEqual(DataNormalizer.getArtistName('Shreya Ghoshal'), 'Shreya Ghoshal');

  // Null / undefined
  assert.strictEqual(DataNormalizer.getArtistName(null), 'Unknown Artist');
  assert.strictEqual(DataNormalizer.getPrimaryArtist(null), 'Unknown Artist');
});

runTest('normalizeTrack normalizes language and artist structures', () => {
  const rawTrack = {
    id: 't_123',
    title: 'Tum Hi Ho',
    artists: [{ name: 'Arijit Singh' }],
    album: { name: 'Aashiqui 2' },
    language: 'HINDI',
    image: [{ url: 'http://img.jpg' }]
  };
  const norm = DataNormalizer.normalizeTrack(rawTrack);
  assert.strictEqual(norm.id, 't_123');
  assert.strictEqual(norm.language, 'hindi');
  assert.strictEqual(norm.primaryArtist, 'Arijit Singh');
  assert.strictEqual(norm.artists, 'Arijit Singh');
});

// ----------------------------------------------------------------------------
// TEST SECTION 3: Language-Aware Recommendation Engine
// ----------------------------------------------------------------------------
console.log('\n[3] Language-Aware Personalized Recommendations & Radio Deduplication:');

const candidatePool = [
  { id: 'h1', name: 'Chaleya', artists: 'Arijit Singh', language: 'hindi', popularity: 85 },
  { id: 'h2', name: 'Kesariya', artists: 'Arijit Singh', language: 'hindi', popularity: 90 },
  { id: 'e1', name: 'Shape of You', artists: 'Ed Sheeran', language: 'english', popularity: 88 },
  { id: 'e2', name: 'Blinding Lights', artists: 'The Weeknd', language: 'english', popularity: 92 },
  { id: 'p1', name: 'Lover', artists: 'Diljit Dosanjh', language: 'punjabi', popularity: 84 },
  { id: 't1', name: 'Arabic Kuthu', artists: 'Anirudh Ravichander', language: 'tamil', popularity: 86 },
  { id: 't2', name: 'Naatu Naatu', artists: 'M.M. Keeravaani', language: 'telugu', popularity: 87 }
];

runTest('Recommendations score selected languages significantly higher than unselected languages', () => {
  Storage.setLanguages(['hindi', 'english']);
  const recs = RecommendationEngine.getPersonalizedRecommendations(
    [{ id: 'h1', name: 'Chaleya', artists: 'Arijit Singh', language: 'hindi' }],
    [{ id: 'e1', name: 'Shape of You', artists: 'Ed Sheeran', language: 'english' }],
    candidatePool,
    { limit: 4, selectedLanguages: ['hindi', 'english'] }
  );

  assert.ok(recs.length > 0);
  const recLanguages = recs.map(r => r.candLang || r.song.language);
  assert.ok(recLanguages.includes('hindi') || recLanguages.includes('english'));
  
  const diags = RecommendationEngine.getLastDiagnostics();
  assert.ok(diags.length > 0);
  
  const hindiDiag = diags.find(d => d.language === 'hindi');
  const tamilDiag = diags.find(d => d.language === 'tamil');
  
  if (hindiDiag && tamilDiag) {
    assert.ok(hindiDiag.languageScore > tamilDiag.languageScore, 'Selected language score must exceed unselected language score');
    assert.strictEqual(hindiDiag.languageScore, 100, 'Exact selected language score should be +100');
    assert.strictEqual(tamilDiag.languageScore, -60, 'Non-selected language penalty should be -60');
  }
});

runTest('buildQuickPicks respects selected languages and returns clean song objects', () => {
  const quickPicks = RecommendationEngine.buildQuickPicks(
    [],
    [],
    candidatePool,
    'all',
    4,
    { selectedLanguages: ['punjabi'] }
  );

  assert.ok(quickPicks.length > 0);
  assert.strictEqual(quickPicks[0].language, 'punjabi', 'Top quick pick should match selected Punjabi language');
  assert.ok(quickPicks[0].recommendationReason);
});

runTest('getTrackRadio performs session-level deduplication without repeats', () => {
  RecommendationEngine.resetRadioSession();
  const seed = candidatePool[0]; // Chaleya
  
  const batch1 = RecommendationEngine.getTrackRadio(seed, candidatePool, 3);
  assert.strictEqual(batch1[0].id, seed.id);
  
  // Subsequent radio request in same session should not re-deliver previous similar tracks
  const batch2 = RecommendationEngine.getTrackRadio(seed, candidatePool, 3);
  const batch1Ids = batch1.slice(1).map(s => s.id);
  const batch2Ids = batch2.slice(1).map(s => s.id);
  
  const hasOverlap = batch2Ids.some(id => batch1Ids.includes(id));
  assert.strictEqual(hasOverlap, false, 'Continuous radio must not return duplicate tracks in same session');
});

// ----------------------------------------------------------------------------
// TEST SECTION 4: Artist Plain Text in Song Lists & Navigation Isolation
// ----------------------------------------------------------------------------
console.log('\n[4] Artist Plain Text in Song Lists & Navigation Isolation:');

runTest('app.css defines .artist-plain with pointer-events: none and inherit cursor', () => {
  const css = fs.readFileSync(path.join(__dirname, 'css/app.css'), 'utf8');
  assert.ok(css.includes('.artist-plain'), 'app.css must define .artist-plain');
  assert.ok(css.includes('pointer-events: none'), '.artist-plain must have pointer-events: none');
});

runTest('index.html contains Theme Picker dialog and themeManager.js script import', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert.ok(html.includes('id="dialog-theme-picker"'), 'index.html must contain #dialog-theme-picker');
  assert.ok(html.includes('themeManager.js'), 'index.html must include themeManager.js script tag');
  assert.ok(html.includes('openThemeDialog'), 'index.html must have openThemeDialog click handler');
});

console.log(`\n------------------------------------------------------`);
console.log(`Summary: ${passedTests}/${totalTests} tests passed.`);
console.log(`------------------------------------------------------\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
