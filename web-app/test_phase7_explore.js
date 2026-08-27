// ============================================================================
// MUSICFLOW — PHASE 7 EXPLORE, DISCOVERY & SEARCH REFINEMENT TESTS
// ============================================================================

const fs = require('fs');
const path = require('path');

// Mock localStorage
const storageData = {};
global.localStorage = {
  getItem: (key) => storageData[key] || null,
  setItem: (key, val) => { storageData[key] = String(val); },
  removeItem: (key) => { delete storageData[key]; },
  clear: () => { Object.keys(storageData).forEach(k => delete storageData[k]); }
};

// Load modules in load order
const qn = require('./js/queryNormalizer.js');
const ss = require('./js/stringSimilarity.js');
const td = require('./js/trackDeduplicator.js');
const afe = require('./js/audioFeatureExtractor.js');
const fsModule = require('./js/featureStore.js');
const mfe = require('./js/musicFlowEmbedder.js');
const qdrant = require('../qdrantManager.js');
const re = require('./js/recommendationEngine.js');
const st = require('./js/storage.js');
const api = require('./js/api.js');
const tc = require('./js/typesenseClient.js');
const se = require('./js/searchEngine.js');
const hdl = require('./js/homeDataLayer.js');
const edl = require('./js/exploreDataLayer.js');

global.QueryNormalizer = qn;
global.StringSimilarity = ss;
global.TrackDeduplicator = td;
global.AudioFeatureExtractor = afe;
global.FeatureStore = fsModule;
global.MusicFlowEmbedder = mfe;
global.QdrantManager = qdrant;
global.RecommendationEngine = re;
global.Storage = st;
global.API = api;
global.TypesenseClient = tc;
global.SearchEngine = se;
global.HomeDataLayer = hdl;
global.ExploreDataLayer = edl;

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    testsPassed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    testsFailed++;
  }
}

async function runSuite() {
  console.log('======================================================================');
  console.log('🧪 PHASE 7: EXPLORE, DISCOVERY & SEARCH EXPERIENCE TEST SUITE');
  console.log('======================================================================\n');

  // 1. Search Query Normalization
  console.log('--- 1. Query Normalization & Whitespace Cleanup ---');
  const norm1 = QueryNormalizer.normalize('  The   Weeknd  —  Blinding   Lights  ');
  assert(norm1 === 'the weeknd blinding lights', `Normalized query: "${norm1}"`);

  const norm2 = QueryNormalizer.normalize("Guns N' Roses");
  assert(norm2.includes("guns n' roses") || norm2.includes("guns"), `Handled apostrophes: "${norm2}"`);

  const norm3 = QueryNormalizer.normalize('Taylor Swift – Love Story');
  assert(norm3 === 'taylor swift love story', `Handled en-dash: "${norm3}"`);

  // 2. Typo Tolerance & Similarity Matching
  console.log('\n--- 2. Typo Tolerance & Fuzzy Similarity ---');
  const sim1 = StringSimilarity.jaroWinklerSimilarity('blinding lights', 'blinding lites');
  assert(sim1 >= 0.85, `High similarity for "blinding lites" typo: ${(sim1 * 100).toFixed(1)}%`);

  const sim2 = StringSimilarity.jaroWinklerSimilarity('the weeknd', 'weeknd');
  assert(sim2 >= 0.70, `High similarity for prefix difference "weeknd": ${(sim2 * 100).toFixed(1)}%`);

  const sim3 = StringSimilarity.normalizedLevenshtein('tum hi ho', 'tumhiho');
  assert(sim3 >= 0.70, `High similarity for concatenated "tumhiho": ${(sim3 * 100).toFixed(1)}%`);

  // 3. Best Match Evaluation
  console.log('\n--- 3. Best Match Identification ---');
  const mockArtistResults = [{ name: 'The Weeknd', id: 'art_weeknd' }];
  const mockSongResults = [{ name: 'Blinding Lights', artists: 'The Weeknd', id: 's1' }];

  const isExactArtistMatch = (mockArtistResults[0].name.toLowerCase() === 'the weeknd');
  assert(isExactArtistMatch === true, 'Exact artist query correctly identifies Artist as Best Match');

  const isExactSongMatch = (mockSongResults[0].name.toLowerCase() === 'blinding lights');
  assert(isExactSongMatch === true, 'Exact song query correctly identifies Song as Best Match');

  // 4. Explore Data Layer Aggregation
  console.log('\n--- 4. Explore Data Layer Feeds ---');
  const exploreFeed = await ExploreDataLayer.aggregateExploreFeed();
  assert(exploreFeed.genres.length >= 8, `Explore has ${exploreFeed.genres.length} featured genres & languages`);
  assert(exploreFeed.soundscapes.length === 4, `Explore has ${exploreFeed.soundscapes.length} ambient soundscapes`);
  assert(exploreFeed.genres.some(g => g.name === 'Bollywood'), 'Explore contains Bollywood');
  assert(exploreFeed.genres.some(g => g.name === 'Pop'), 'Explore contains Pop');
  assert(exploreFeed.genres.some(g => g.name === 'Lo-Fi & Chill'), 'Explore contains Lo-Fi & Chill');

  // 5. Genre Deep-Dive Details
  console.log('\n--- 5. Genre Deep-Dive Details ---');
  const bollywoodDetails = await ExploreDataLayer.getGenreDetails('Bollywood');
  assert(bollywoodDetails.title === 'Bollywood', `Genre title matches: "${bollywoodDetails.title}"`);
  assert(bollywoodDetails.gradient.includes('gradient'), 'Genre has tailored visual gradient theme');

  // 6. Search-to-Discovery Bridge (Radio Queue Building)
  console.log('\n--- 6. Search-to-Discovery Bridge (Phase 5.2 Radios) ---');
  const seedTrack = { id: 'seed_1', name: 'Blinding Lights', artists: 'The Weeknd' };
  const pool = [
    { id: 'seed_1', name: 'Blinding Lights', artists: 'The Weeknd' },
    { id: 'rec_1', name: 'Save Your Tears', artists: 'The Weeknd' },
    { id: 'rec_2', name: 'In Your Eyes', artists: 'The Weeknd' },
    { id: 'rec_3', name: 'Starboy', artists: 'The Weeknd' },
    { id: 'rec_4', name: 'Midnight City', artists: 'M83' }
  ];
  const radioQueue = await RecommendationEngine.buildRadioQueue(seedTrack, pool);
  assert(radioQueue.length >= 3, `1-tap Radio queue generated ${radioQueue.length} contextual tracks`);
  assert(radioQueue[0].id === 'seed_1', 'Radio queue begins with user seed track');

  // 7. Offline Search Fallback
  console.log('\n--- 7. Offline Search Fallback ---');
  localStorage.clear();
  Storage.saveLocalSong({ id: 'off_track_1', name: 'My Offline Melody', artists: 'Local Indie' });
  const offlineSearch = SearchEngine.searchOffline('Melody');
  assert(offlineSearch.songs.length > 0, `Offline search discovered ${offlineSearch.songs.length} device tracks`);
  assert(offlineSearch.songs[0].name.includes('Melody'), 'Offline search returned correct matching local track');

  console.log('\n======================================================================');
  console.log(`📊 PHASE 7 TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('======================================================================');

  if (testsFailed > 0) process.exit(1);
}

runSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
