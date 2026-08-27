// ==========================================================================
// LIVE BENCHMARK & REAL SEARCH RELEVANCE VERIFICATION
// ==========================================================================

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

const API = require('./js/api.js');

async function testLiveSearches() {
  console.log('======================================================================');
  console.log('🚀 RUNNING LIVE PRODUCTION SEARCH RELEVANCE & BENCHMARK SUITE');
  console.log('======================================================================\n');

  const testQueries = [
    { query: 'Blinding Lights', expectedTitle: 'Blinding Lights', expectedArtist: 'The Weeknd' },
    { query: 'blinding lights', expectedTitle: 'Blinding Lights', expectedArtist: 'The Weeknd' },
    { query: 'BLINDING LIGHTS', expectedTitle: 'Blinding Lights', expectedArtist: 'The Weeknd' },
    { query: 'blinding lites', expectedTitle: 'Blinding Lights', expectedArtist: 'The Weeknd' },
    { query: 'blinding ligt', expectedTitle: 'Blinding Lights', expectedArtist: 'The Weeknd' },
    { query: 'blinding', expectedTitle: 'Blinding Lights', expectedArtist: 'The Weeknd' },
    { query: 'The Weeknd', expectedArtistMatch: 'The Weeknd' },
    { query: 'weeknd', expectedArtistMatch: 'The Weeknd' },
    { query: 'The Weeknd Blinding Lights', expectedTitle: 'Blinding Lights', expectedArtist: 'The Weeknd' },
    { query: 'Blinding Lights The Weeknd', expectedTitle: 'Blinding Lights', expectedArtist: 'The Weeknd' },
    { query: 'Arijit Singh', expectedArtistMatch: 'Arijit Singh' },
    { query: 'arjit singh', expectedArtistMatch: 'Arijit Singh' },
    { query: 'Arijit Singh Tum Hi Ho', expectedTitle: 'Tum Hi Ho', expectedArtist: 'Arijit Singh' },
    { query: 'Tum Hi Ho Arijit', expectedTitle: 'Tum Hi Ho', expectedArtist: 'Arijit Singh' },
    { query: 'Shape of You', expectedTitle: 'Shape of You', expectedArtist: 'Ed Sheeran' },
    { query: 'shape of yu', expectedTitle: 'Shape of You', expectedArtist: 'Ed Sheeran' },
    { query: 'Ed Sheeran Shape of You', expectedTitle: 'Shape of You', expectedArtist: 'Ed Sheeran' },
    { query: 'Tum Hi Ho', expectedTitle: 'Tum Hi Ho', expectedArtist: 'Arijit Singh' },
    { query: 'tum hi ho', expectedTitle: 'Tum Hi Ho', expectedArtist: 'Arijit Singh' },
    { query: 'OK Jaanu', expectedTitle: 'Ok Jaanu', expectedArtist: 'A.R. Rahman' },
    { query: 'OK katy pery', expectedArtistMatch: 'Katy Perry' },
    { query: "Guns N' Roses", expectedArtistMatch: "Guns N' Roses" },
    { query: 'Taylor Swift – Love Story', expectedTitle: 'Love Story', expectedArtist: 'Taylor Swift' }
  ];

  const benchmarkResults = [];

  for (const t of testQueries) {
    const start = Date.now();
    try {
      const res = await API.searchAll(t.query);
      const elapsed = Date.now() - start;
      const topSong = res?.songs?.results?.[0];
      const topArtist = res?.artists?.results?.[0];

      const songTitle = topSong?.name || 'N/A';
      const songArtist = topSong?.artists || topSong?.primaryArtist || 'N/A';
      const artistName = topArtist?.name || topArtist?.title || 'N/A';

      let passed = false;
      if (t.expectedTitle) {
        passed = songTitle.toLowerCase().includes(t.expectedTitle.toLowerCase());
      } else if (t.expectedArtistMatch) {
        passed = artistName.toLowerCase().includes(t.expectedArtistMatch.toLowerCase()) ||
                 songArtist.toLowerCase().includes(t.expectedArtistMatch.toLowerCase());
      }

      console.log(`[QUERY] "${t.query}" (${elapsed}ms)`);
      console.log(`  Top Song:   ${songTitle} — ${songArtist}`);
      console.log(`  Top Artist: ${artistName}`);
      console.log(`  DidYouMean: ${res.didYouMean || 'None'}`);
      console.log(`  Status:     ${passed ? '✅ PASSED' : '⚠️ REVIEW'}\n`);

      benchmarkResults.push({
        query: t.query,
        topResult: `${songTitle} — ${songArtist}`,
        latencyMs: elapsed,
        passed
      });
    } catch (e) {
      console.error(`Error searching "${t.query}":`, e.message);
    }
  }

  // Recommendation Test
  console.log('\n======================================================================');
  console.log('🎵 TESTING HYBRID RECOMMENDATION ENGINE & DIVERSITY');
  console.log('======================================================================');

  try {
    const home = await API.getHomeFeed(['hindi', 'english']);
    const quickPicks = home.quickPicks || [];
    console.log(`Generated ${quickPicks.length} Personalized Recommendations.`);
    quickPicks.slice(0, 8).forEach((song, idx) => {
      console.log(`  ${idx + 1}. ${song.name} — ${song.artists} (${song.language || 'hindi'})`);
    });

    const artistMap = {};
    quickPicks.forEach(s => {
      const a = s.primaryArtist || s.artists;
      artistMap[a] = (artistMap[a] || 0) + 1;
    });

    const maxPerArtist = Math.max(...Object.values(artistMap));
    console.log(`Max songs per artist: ${maxPerArtist} (Diversity constraint satisfied: ${maxPerArtist <= 2})`);
  } catch (e) {
    console.error('Home feed error:', e.message);
  }

  console.log('\n======================================================================');
  console.log('📊 BENCHMARK SUMMARY TABLE');
  console.log('======================================================================');
  console.table(benchmarkResults);
}

testLiveSearches();
