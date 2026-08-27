// ==========================================================================
// TEST SUITE: Typesense Music Search Integration
// ==========================================================================

const assert = require('assert');
const QueryNormalizer = require('./js/queryNormalizer.js');
const StringSimilarity = require('./js/stringSimilarity.js');
const TrackDeduplicator = require('./js/trackDeduplicator.js');
const SearchEngine = require('./js/searchEngine.js');
const TypesenseClient = require('./js/typesenseClient.js');
const Indexer = require('../scripts/typesense_indexer.js');

global.QueryNormalizer = QueryNormalizer;
global.StringSimilarity = StringSimilarity;
global.TrackDeduplicator = TrackDeduplicator;
global.SearchEngine = SearchEngine;
global.TypesenseClient = TypesenseClient;

const API = require('./js/api.js');

console.log('--- Running Typesense Integration Test Suite ---\n');

// 1. Document generation
console.log('1. Testing Typesense Document Transformer...');
const sampleSong = {
  id: 'song_999',
  name: 'Blinding Lights',
  artists: 'The Weeknd',
  album: 'After Hours',
  duration: '200',
  year: '2020',
  image: 'https://example.com/500x500.jpg',
  audioUrl: 'https://stream.url',
  hasLyrics: true
};

const doc = Indexer.documentFromSong(sampleSong);
assert.strictEqual(doc.id, 'song_999');
assert.strictEqual(doc.title, 'Blinding Lights');
assert.strictEqual(doc.artist, 'The Weeknd');
assert.strictEqual(doc.normalized_title, 'blinding lights');
assert.strictEqual(doc.normalized_artist, 'the weeknd');
assert.strictEqual(doc.year, 2020);
assert.strictEqual(doc.has_lyrics, true);

console.log('✓ Document transformation passed.');

// 2. Typesense fallback
console.log('2. Testing Typesense Offline Fallback Mechanism...');
(async () => {
  // TypesenseClient should detect offline state and return null gracefully
  TypesenseClient.Config.port = 9999; // intentionally wrong port
  const healthy = await TypesenseClient.checkHealth();
  assert.strictEqual(healthy, false, 'Expected health check to return false when server is unreachable');

  const tsResult = await TypesenseClient.searchAll('Blinding Lights');
  assert.strictEqual(tsResult, null, 'Expected searchAll to return null when Typesense is offline');

  // API.searchAll should seamlessly switch to resilient fallback without throwing
  const apiResult = await API.searchAll('Blinding Lights');
  assert.ok(apiResult, 'API.searchAll must return valid result object');
  assert.ok(apiResult.songs.results.length > 0, 'API.searchAll fallback must provide search results');
  assert.strictEqual(apiResult.songs.results[0].name, 'Blinding Lights');
  assert.strictEqual(apiResult.provider, 'live_fallback');

  // Reset port
  TypesenseClient.Config.port = 8108;

  console.log('✓ Offline fallback mechanism passed.');
  console.log('\n ALL TYPESENSE INTEGRATION TESTS PASSED SUCCESSFULLY! \n');
})();
