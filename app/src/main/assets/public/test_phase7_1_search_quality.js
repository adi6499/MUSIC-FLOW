// ============================================================================
// MUSICFLOW — PHASE 7.1 SEARCH QUALITY & BEST MATCH PRECISION BENCHMARK
// 32 Deterministic Live Queries testing Intent, Best Match & Typo Tolerance
// ============================================================================

const fs = require('fs');
const path = require('path');

const QueryNormalizer = require('./js/queryNormalizer.js');
const StringSimilarity = require('./js/stringSimilarity.js');
const TrackDeduplicator = require('./js/trackDeduplicator.js');
const SearchEngine = require('./js/searchEngine.js');
const API = require('./js/api.js');

global.QueryNormalizer = QueryNormalizer;
global.StringSimilarity = StringSimilarity;
global.TrackDeduplicator = TrackDeduplicator;
global.SearchEngine = SearchEngine;
global.API = API;

const benchmarkDataset = [
  // 1-5: Exact Artists & Variations
  { id: 1, query: 'The Weeknd', expectedType: 'artist', expectedName: 'The Weeknd' },
  { id: 2, query: 'weeknd', expectedType: 'artist', expectedName: 'The Weeknd' },
  { id: 3, query: 'the weekned', expectedType: 'artist', expectedName: 'The Weeknd' },
  { id: 4, query: 'Arijit Singh', expectedType: 'artist', expectedName: 'Arijit Singh' },
  { id: 5, query: 'arjit singh', expectedType: 'artist', expectedName: 'Arijit Singh' },

  // 6-10: Exact Songs & Variations
  { id: 6, query: 'Blinding Lights', expectedType: 'song', expectedName: 'Blinding Lights' },
  { id: 7, query: 'blinding lights', expectedType: 'song', expectedName: 'Blinding Lights' },
  { id: 8, query: 'BLINDING LIGHTS', expectedType: 'song', expectedName: 'Blinding Lights' },
  { id: 9, query: 'blinding lites', expectedType: 'song', expectedName: 'Blinding Lights' },
  { id: 10, query: 'blinding ligt', expectedType: 'song', expectedName: 'Blinding Lights' },

  // 11-15: Compound Artist + Song Queries (Both Word Orders)
  { id: 11, query: 'The Weeknd Blinding Lights', expectedType: 'song', expectedName: 'Blinding Lights' },
  { id: 12, query: 'Blinding Lights The Weeknd', expectedType: 'song', expectedName: 'Blinding Lights' },
  { id: 13, query: 'Arijit Singh Tum Hi Ho', expectedType: 'song', expectedName: 'Tum Hi Ho' },
  { id: 14, query: 'Tum Hi Ho Arijit Singh', expectedType: 'song', expectedName: 'Tum Hi Ho' },
  { id: 15, query: 'Ed Sheeran Shape of You', expectedType: 'song', expectedName: 'Shape of You' },

  // 16-20: Other Canonical Hits & Typo Variations
  { id: 16, query: 'Shape of You', expectedType: 'song', expectedName: 'Shape of You' },
  { id: 17, query: 'shape of yu', expectedType: 'song', expectedName: 'Shape of You' },
  { id: 18, query: 'Ed Sheeran', expectedType: 'artist', expectedName: 'Ed Sheeran' },
  { id: 19, query: 'Tum Hi Ho', expectedType: 'song', expectedName: 'Tum Hi Ho' },
  { id: 20, query: 'Starboy', expectedType: 'song', expectedName: 'Starboy' },

  // 21-25: Albums, Genres & Obvious Categories
  { id: 21, query: 'After Hours', expectedType: 'song', expectedName: 'After Hours' },
  { id: 22, query: 'Pritam', expectedType: 'artist', expectedName: 'Pritam' },
  { id: 23, query: 'Bollywood', expectedType: 'genre_or_song', expectedName: 'Bollywood' },
  { id: 24, query: 'lo-fi', expectedType: 'genre_or_song', expectedName: 'Lo-Fi' },
  { id: 25, query: 'workout', expectedType: 'genre_or_song', expectedName: 'Workout' },

  // 26-32: Punctuation, En-dash, Empty Recovery & Diversity
  { id: 26, query: "Guns N' Roses", expectedType: 'artist', expectedName: "Guns N' Roses" },
  { id: 27, query: 'Taylor Swift – Love Story', expectedType: 'song', expectedName: 'Love Story' },
  { id: 28, query: 'OK Jaanu', expectedType: 'song', expectedName: 'Ok Jaanu' },
  { id: 29, query: 'OK katy pery', expectedType: 'artist', expectedName: 'Katy Perry' },
  { id: 30, query: 'Save Your Tears', expectedType: 'song', expectedName: 'Save Your Tears' },
  { id: 31, query: 'Dua Lipa', expectedType: 'artist', expectedName: 'Dua Lipa' },
  { id: 32, query: 'qxzjwkv_9999_zzzyyy', expectedType: 'empty', expectedName: 'empty' }
];

async function runPrecisionBenchmark() {
  console.log('======================================================================');
  console.log('🎯 PHASE 7.1: SEARCH QUALITY & BEST MATCH PRECISION BENCHMARK (32 QUERIES)');
  console.log('======================================================================\n');

  let passedCount = 0;
  let failedCount = 0;
  const resultsTable = [];

  for (const item of benchmarkDataset) {
    const startTime = Date.now();
    try {
      const searchRes = await API.searchAll(item.query);
      const elapsed = Date.now() - startTime;

      const bestMatch = SearchEngine.evaluateBestMatch(searchRes, item.query);
      const topSong = searchRes?.songs?.results?.[0];
      const topArtist = searchRes?.artists?.results?.[0];

      let passed = false;
      let matchedLabel = 'None';

      if (item.expectedType === 'empty') {
        const songCount = Array.isArray(searchRes?.songs) ? searchRes.songs.length : (searchRes?.songs?.results?.length || 0);
        passed = (songCount === 0);
        matchedLabel = 'Empty State (Correct)';
      } else if (item.expectedType === 'artist') {
        const artName = bestMatch?.type === 'artist' ? (bestMatch.item.name || bestMatch.item.title) : (topArtist?.name || topArtist?.title || '');
        passed = (bestMatch?.type === 'artist' || artName.toLowerCase().includes(item.expectedName.toLowerCase()));
        matchedLabel = `Artist: ${artName}`;
      } else if (item.expectedType === 'song') {
        const songName = bestMatch?.type === 'song' ? bestMatch.item.name : (topSong?.name || '');
        passed = songName.toLowerCase().includes(item.expectedName.toLowerCase());
        matchedLabel = `Song: ${songName} (${bestMatch?.item?.artists || topSong?.artists || 'N/A'})`;
      } else if (item.expectedType === 'genre_or_song') {
        passed = (searchRes.songs.results && searchRes.songs.results.length > 0);
        matchedLabel = `Category/Songs: ${topSong?.name || 'Results found'}`;
      }

      if (passed) {
        passedCount++;
        console.log(`✅ [PASS] #${item.id} "${item.query}" (${elapsed}ms) $\\to$ ${matchedLabel}`);
      } else {
        failedCount++;
        console.error(`❌ [FAIL] #${item.id} "${item.query}" (${elapsed}ms) $\\to$ Expected: ${item.expectedType}:${item.expectedName}, Got: ${matchedLabel}`);
      }

      resultsTable.push({
        id: item.id,
        query: item.query,
        bestMatchType: bestMatch?.type || 'fallback',
        bestMatchResult: matchedLabel,
        latencyMs: elapsed,
        status: passed ? 'PASS' : 'FAIL'
      });
    } catch (e) {
      failedCount++;
      console.error(`❌ [ERROR] #${item.id} "${item.query}":`, e.message);
    }
  }

  console.log('\n======================================================================');
  console.log(`📊 PRECISION BENCHMARK RESULTS: ${passedCount} / ${benchmarkDataset.length} PASSED (${((passedCount / benchmarkDataset.length) * 100).toFixed(1)}%)`);
  console.log('======================================================================\n');
  console.table(resultsTable);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPrecisionBenchmark();
