// ==========================================================================
// TEST SUITE: JavaScript Search & Recommendation Engine
// ==========================================================================

const assert = require('assert');
const QueryNormalizer = require('./js/queryNormalizer.js');
const StringSimilarity = require('./js/stringSimilarity.js');
const TrackDeduplicator = require('./js/trackDeduplicator.js');
const SearchEngine = require('./js/searchEngine.js');
const RecommendationEngine = require('./js/recommendationEngine.js');

global.QueryNormalizer = QueryNormalizer;
global.StringSimilarity = StringSimilarity;
global.TrackDeduplicator = TrackDeduplicator;
global.SearchEngine = SearchEngine;
global.RecommendationEngine = RecommendationEngine;

console.log('--- Running JS Search & Recommendation Test Suite ---');

// 1. Normalization
console.log('1. Testing QueryNormalizer...');
assert.strictEqual(QueryNormalizer.normalize('  Blinding   Lights  '), 'blinding lights');
assert.strictEqual(QueryNormalizer.normalize('BLINDING-LIGHTS'), 'blinding lights');
assert.strictEqual(QueryNormalizer.normalize('AC/DC'), 'ac dc');
assert.strictEqual(QueryNormalizer.normalize('Guns N’ Roses'), "guns n' roses");
assert.strictEqual(QueryNormalizer.normalize('Taylor Swift – Love Story'), 'taylor swift love story');
assert.strictEqual(QueryNormalizer.normalize('Beyoncé'), 'beyonce');

// 2. Compound query parsing
const compound1 = QueryNormalizer.parseCompoundQuery('Blinding Lights Weeknd');
assert.strictEqual(compound1.isCompoundQuery, true);
assert.strictEqual(compound1.candidateSongTitle, 'blinding lights');
assert.strictEqual(compound1.candidateArtist, 'weeknd');

const compound2 = QueryNormalizer.parseCompoundQuery('Arijit Singh Tum Hi Ho');
assert.strictEqual(compound2.isCompoundQuery, true);
assert.strictEqual(compound2.candidateSongTitle, 'tum hi ho');
assert.strictEqual(compound2.candidateArtist, 'arijit singh');

console.log('✓ QueryNormalizer tests passed.');

// 3. String Similarity & Typo Tolerance
console.log('2. Testing StringSimilarity & Typo Distance...');
const sim1 = StringSimilarity.computeMatchScore('arjit sing', 'arijit singh');
assert.ok(sim1 >= 0.85, `Expected >= 0.85, got ${sim1}`);

const sim2 = StringSimilarity.computeMatchScore('blinding lites', 'blinding lights');
assert.ok(sim2 >= 0.85, `Expected >= 0.85, got ${sim2}`);

const sim3 = StringSimilarity.computeMatchScore('shape of yu', 'shape of you');
assert.ok(sim3 >= 0.85, `Expected >= 0.85, got ${sim3}`);

console.log('✓ StringSimilarity tests passed.');

// 4. Search Ranking
console.log('3. Testing SearchEngine Ranking & Deduplication...');
const song1 = { id: '1', name: 'Blinding Lights', artists: 'The Weeknd', audioUrl: 'http://audio', duration: 200, image: '500x500.jpg' };
const song2 = { id: '2', name: 'Blinding', artists: 'Various Artists', audioUrl: 'http://audio', duration: 200 };
const song3 = { id: '3', name: 'Blinding Lights (Karaoke Version)', artists: 'The Hit Crew', audioUrl: 'http://audio' };

const ranked = SearchEngine.rankSongs([song3, song2, song1], QueryNormalizer.parseCompoundQuery('Blinding Lights'));
assert.strictEqual(ranked[0].id, '1', 'Exact match song must be ranked #1');
assert.strictEqual(ranked[0].name, 'Blinding Lights');

// Typo query ranking
const rankedTypo = SearchEngine.rankSongs([song2, song1], QueryNormalizer.parseCompoundQuery('blinding lites'));
assert.strictEqual(rankedTypo[0].id, '1', 'Typo search must rank original Blinding Lights at #1');

// Did you mean
const didYouMean = SearchEngine.detectDidYouMean('weeknd');
assert.strictEqual(didYouMean, 'The Weeknd');

console.log('✓ SearchEngine ranking tests passed.');

// 5. Recommendation Engine
console.log('4. Testing RecommendationEngine Hybrid & Diversity...');
const sameArt = RecommendationEngine.computeArtistSimilarity('The Weeknd', 'The Weeknd');
assert.strictEqual(sameArt, 1.0);

const relArt = RecommendationEngine.computeArtistSimilarity('The Weeknd', 'Drake');
assert.ok(relArt >= 0.70, `Expected >= 0.70, got ${relArt}`);

const candidatePool = [
  { id: '1', name: 'Song 1', artists: 'The Weeknd', language: 'english', audioUrl: 'http://a' },
  { id: '2', name: 'Song 2', artists: 'The Weeknd', language: 'english', audioUrl: 'http://a' },
  { id: '3', name: 'Song 3', artists: 'The Weeknd', language: 'english', audioUrl: 'http://a' },
  { id: '4', name: 'Song 4', artists: 'Drake', language: 'english', audioUrl: 'http://a' },
  { id: '5', name: 'Song 5', artists: 'Post Malone', language: 'english', audioUrl: 'http://a' }
];

const recs = RecommendationEngine.getPersonalizedRecommendations(
  [{ id: '10', name: 'Blinding Lights', artists: 'The Weeknd' }],
  [],
  candidatePool,
  { limit: 10 }
);

const recSongs = recs.map(r => r.song || r);
const weekndCount = recSongs.filter(r => r.artists === 'The Weeknd').length;
assert.ok(weekndCount <= 2, `Diversity violated: Weeknd count is ${weekndCount}`);
assert.ok(recSongs.some(r => r.artists === 'Drake'), 'Related artist Drake should be included');

console.log('✓ RecommendationEngine tests passed.');
console.log('\n ALL JAVASCRIPT UNIT TESTS PASSED SUCCESSFULLY! \n');
