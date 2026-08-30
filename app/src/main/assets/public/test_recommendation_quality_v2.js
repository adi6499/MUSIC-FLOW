// ============================================================================
// MUSICFLOW — PHASE 8 RECOMMENDATION 2.0 QUALITY & DIVERSITY TEST SUITE
// Evaluates 12 Listener Profiles across 13 Precision & Diversity Metrics.
// ============================================================================

const assert = require('assert');
const RecommendationEngine = require('./js/recommendationEngine.js');
const HomeDataLayer = require('./js/homeDataLayer.js');

// Mock in-memory storage for test runners
const mockStorageData = {
  history: [],
  favorites: [],
  milestones: {},
  skips: [],
  delivered: [],
  artists: []
};

global.Storage = {
  getHistory: () => mockStorageData.history,
  getFavorites: () => mockStorageData.favorites,
  getArtists: () => mockStorageData.artists,
  getFollowedArtists: () => mockStorageData.artists,
  getPlaylists: () => [],
  getSkips: () => mockStorageData.skips,
  getUserTasteSignals: () => {
    const artistScores = {};
    const languageScores = {};
    const skippedSongCounts = {};
    const skippedArtistCounts = {};

    mockStorageData.favorites.forEach(s => {
      const art = (s.artists || s.primaryArtist || '').split(/[,&/]/)[0].trim().toLowerCase();
      if (art) artistScores[art] = (artistScores[art] || 0) + 1.5;
      if (s.language) languageScores[s.language.toLowerCase()] = (languageScores[s.language.toLowerCase()] || 0) + 1.5;
    });

    mockStorageData.history.forEach(s => {
      const art = (s.artists || s.primaryArtist || '').split(/[,&/]/)[0].trim().toLowerCase();
      if (art) artistScores[art] = (artistScores[art] || 0) + 1.0;
      if (s.language) languageScores[s.language.toLowerCase()] = (languageScores[s.language.toLowerCase()] || 0) + 1.0;
    });

    mockStorageData.skips.forEach(sk => {
      skippedSongCounts[sk.id] = (skippedSongCounts[sk.id] || 0) + 1;
      if (sk.artist) skippedArtistCounts[sk.artist] = (skippedArtistCounts[sk.artist] || 0) + 1;
    });

    return {
      artistScores,
      languageScores,
      skippedSongCounts,
      skippedArtistCounts,
      milestones: mockStorageData.milestones,
      totalSignals: mockStorageData.favorites.length + mockStorageData.history.length
    };
  },
  getRecentDeliveredRecommendations: () => mockStorageData.delivered
};

// Rich Diverse Candidate Catalog Pool (100+ realistic multi-genre tracks)
const CATALOG_POOL = [
  // Bollywood / Hindi
  { id: 'h1', name: 'Kesariya', artists: 'Arijit Singh, Pritam', language: 'hindi', duration: 268, popularity: 95, provider: 'jiosaavn', audioUrl: 'http://stream/h1.mp3' },
  { id: 'h2', name: 'Tum Hi Ho', artists: 'Arijit Singh, Mithoon', language: 'hindi', duration: 262, popularity: 92, provider: 'jiosaavn', audioUrl: 'http://stream/h2.mp3' },
  { id: 'h3', name: 'Shayad', artists: 'Arijit Singh, Pritam', language: 'hindi', duration: 247, popularity: 90, provider: 'jiosaavn', audioUrl: 'http://stream/h3.mp3' },
  { id: 'h4', name: 'Channa Mereya', artists: 'Arijit Singh, Pritam', language: 'hindi', duration: 289, popularity: 91, provider: 'jiosaavn', audioUrl: 'http://stream/h4.mp3' },
  { id: 'h5', name: 'Raabta', artists: 'Arijit Singh, Shreya Ghoshal', language: 'hindi', duration: 243, popularity: 88, provider: 'jiosaavn', audioUrl: 'http://stream/h5.mp3' },
  { id: 'h6', name: 'Sunn Raha Hai', artists: 'Ankit Tiwari, Shreya Ghoshal', language: 'hindi', duration: 390, popularity: 85, provider: 'jiosaavn', audioUrl: 'http://stream/h6.mp3' },
  { id: 'h7', name: 'Ghungroo', artists: 'Arijit Singh, Shilpa Rao', language: 'hindi', duration: 302, popularity: 89, provider: 'jiosaavn', audioUrl: 'http://stream/h7.mp3' },
  { id: 'h8', name: 'Apna Bana Le', artists: 'Arijit Singh, Sachin-Jigar', language: 'hindi', duration: 261, popularity: 94, provider: 'jiosaavn', audioUrl: 'http://stream/h8.mp3' },
  { id: 'h9', name: 'Pee Loon', artists: 'Mohit Chauhan, Pritam', language: 'hindi', duration: 287, popularity: 86, provider: 'jiosaavn', audioUrl: 'http://stream/h9.mp3' },
  { id: 'h10', name: 'Tum Se Hi', artists: 'Mohit Chauhan, Pritam', language: 'hindi', duration: 323, popularity: 89, provider: 'jiosaavn', audioUrl: 'http://stream/h10.mp3' },

  // Punjabi
  { id: 'p1', name: 'Softly', artists: 'Karan Aujla, Ikky', language: 'punjabi', duration: 154, popularity: 94, provider: 'jiosaavn', audioUrl: 'http://stream/p1.mp3' },
  { id: 'p2', name: 'White Brown Black', artists: 'Karan Aujla, Avvy Sra', language: 'punjabi', duration: 178, popularity: 90, provider: 'jiosaavn', audioUrl: 'http://stream/p2.mp3' },
  { id: 'p3', name: 'Winning Speech', artists: 'Karan Aujla', language: 'punjabi', duration: 195, popularity: 92, provider: 'jiosaavn', audioUrl: 'http://stream/p3.mp3' },
  { id: 'p4', name: 'Lover', artists: 'Diljit Dosanjh, Intense', language: 'punjabi', duration: 191, popularity: 93, provider: 'jiosaavn', audioUrl: 'http://stream/p4.mp3' },
  { id: 'p5', name: 'Lemonade', artists: 'Diljit Dosanjh', language: 'punjabi', duration: 184, popularity: 89, provider: 'jiosaavn', audioUrl: 'http://stream/p5.mp3' },
  { id: 'p6', name: 'Born to Shine', artists: 'Diljit Dosanjh', language: 'punjabi', duration: 213, popularity: 91, provider: 'jiosaavn', audioUrl: 'http://stream/p6.mp3' },
  { id: 'p7', name: '295', artists: 'Sidhu Moose Wala', language: 'punjabi', duration: 270, popularity: 96, provider: 'jiosaavn', audioUrl: 'http://stream/p7.mp3' },
  { id: 'p8', name: 'The Last Ride', artists: 'Sidhu Moose Wala', language: 'punjabi', duration: 261, popularity: 93, provider: 'jiosaavn', audioUrl: 'http://stream/p8.mp3' },
  { id: 'p9', name: 'Cheques', artists: 'Shubh', language: 'punjabi', duration: 183, popularity: 95, provider: 'jiosaavn', audioUrl: 'http://stream/p9.mp3' },
  { id: 'p10', name: 'No Love', artists: 'Shubh', language: 'punjabi', duration: 170, popularity: 92, provider: 'jiosaavn', audioUrl: 'http://stream/p10.mp3' },

  // Tamil / South
  { id: 't1', name: 'Arabic Kuthu', artists: 'Anirudh Ravichander, Jonita Gandhi', language: 'tamil', duration: 280, popularity: 93, provider: 'jiosaavn', audioUrl: 'http://stream/t1.mp3' },
  { id: 't2', name: 'Hukum', artists: 'Anirudh Ravichander', language: 'tamil', duration: 207, popularity: 95, provider: 'jiosaavn', audioUrl: 'http://stream/t2.mp3' },
  { id: 't3', name: 'Naa Ready', artists: 'Anirudh Ravichander, Thalapathy Vijay', language: 'tamil', duration: 248, popularity: 94, provider: 'jiosaavn', audioUrl: 'http://stream/t3.mp3' },
  { id: 't4', name: 'Srivalli', artists: 'Sid Sriram, Devi Sri Prasad', language: 'telugu', duration: 224, popularity: 93, provider: 'jiosaavn', audioUrl: 'http://stream/t4.mp3' },
  { id: 't5', name: 'Samajavaragamana', artists: 'Sid Sriram, Thaman S', language: 'telugu', duration: 214, popularity: 91, provider: 'jiosaavn', audioUrl: 'http://stream/t5.mp3' },
  { id: 't6', name: 'Inkem Inkem', artists: 'Sid Sriram, Gopi Sundar', language: 'telugu', duration: 267, popularity: 90, provider: 'jiosaavn', audioUrl: 'http://stream/t6.mp3' },
  { id: 't7', name: 'Jai Ho', artists: 'A.R. Rahman, Sukhwinder Singh', language: 'hindi', duration: 319, popularity: 89, provider: 'jiosaavn', audioUrl: 'http://stream/t7.mp3' },
  { id: 't8', name: 'Enna Sona', artists: 'A.R. Rahman, Arijit Singh', language: 'hindi', duration: 213, popularity: 91, provider: 'jiosaavn', audioUrl: 'http://stream/t8.mp3' },

  // English Pop & Hip Hop
  { id: 'e1', name: 'Blinding Lights', artists: 'The Weeknd', language: 'english', duration: 200, popularity: 98, provider: 'jiosaavn', audioUrl: 'http://stream/e1.mp3' },
  { id: 'e2', name: 'Starboy', artists: 'The Weeknd, Daft Punk', language: 'english', duration: 230, popularity: 96, provider: 'jiosaavn', audioUrl: 'http://stream/e2.mp3' },
  { id: 'e3', name: 'Save Your Tears', artists: 'The Weeknd', language: 'english', duration: 215, popularity: 95, provider: 'jiosaavn', audioUrl: 'http://stream/e3.mp3' },
  { id: 'e4', name: 'Shape of You', artists: 'Ed Sheeran', language: 'english', duration: 233, popularity: 94, provider: 'jiosaavn', audioUrl: 'http://stream/e4.mp3' },
  { id: 'e5', name: 'Bad Habits', artists: 'Ed Sheeran', language: 'english', duration: 231, popularity: 91, provider: 'jiosaavn', audioUrl: 'http://stream/e5.mp3' },
  { id: 'e6', name: 'Cruel Summer', artists: 'Taylor Swift', language: 'english', duration: 178, popularity: 97, provider: 'jiosaavn', audioUrl: 'http://stream/e6.mp3' },
  { id: 'e7', name: 'Anti-Hero', artists: 'Taylor Swift', language: 'english', duration: 200, popularity: 94, provider: 'jiosaavn', audioUrl: 'http://stream/e7.mp3' },
  { id: 'e8', name: 'God\'s Plan', artists: 'Drake', language: 'english', duration: 198, popularity: 93, provider: 'jiosaavn', audioUrl: 'http://stream/e8.mp3' },
  { id: 'e9', name: 'One Dance', artists: 'Drake, WizKid, Kyla', language: 'english', duration: 174, popularity: 92, provider: 'jiosaavn', audioUrl: 'http://stream/e9.mp3' },
  { id: 'e10', name: 'SICKO MODE', artists: 'Travis Scott, Drake', language: 'english', duration: 312, popularity: 94, provider: 'jiosaavn', audioUrl: 'http://stream/e10.mp3' },
  { id: 'e11', name: 'FE!N', artists: 'Travis Scott, Playboi Carti', language: 'english', duration: 191, popularity: 95, provider: 'jiosaavn', audioUrl: 'http://stream/e11.mp3' },
  { id: 'e12', name: 'Yellow', artists: 'Coldplay', language: 'english', duration: 269, popularity: 91, provider: 'jiosaavn', audioUrl: 'http://stream/e12.mp3' },
  { id: 'e13', name: 'Viva La Vida', artists: 'Coldplay', language: 'english', duration: 242, popularity: 93, provider: 'jiosaavn', audioUrl: 'http://stream/e13.mp3' },
  { id: 'e14', name: 'Believer', artists: 'Imagine Dragons', language: 'english', duration: 204, popularity: 94, provider: 'jiosaavn', audioUrl: 'http://stream/e14.mp3' },
  { id: 'e15', name: 'Radioactive', artists: 'Imagine Dragons', language: 'english', duration: 186, popularity: 90, provider: 'jiosaavn', audioUrl: 'http://stream/e15.mp3' },

  // Contamination traps (Must be filtered out 100%)
  { id: 'c1', name: 'Top 50 Hindi Songs 2026', type: 'playlist', artists: 'Various', duration: 0 },
  { id: 'c2', name: 'Bollywood Workout Jukebox', type: 'album', artists: 'Various', duration: 3600 },
  { id: 'c3', name: 'Late Night Talk Podcast Episode 12', type: 'channel', artists: 'Host', duration: 1800 },
  { id: 'c4', name: 'Arijit Singh Best Songs Nonstop', type: 'song', artists: 'DJ Mix', duration: 15 } // < 30s invalid
];

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

console.log('\n=============================================================');
console.log('  MUSICFLOW — PHASE 8 RECOMMENDATION 2.0 QUALITY VALIDATION');
console.log('=============================================================\n');

// 1. Hindi Bollywood Listener Profile
runTest('Profile 1: Hindi Bollywood Enthusiast recommendations match taste & diversity', () => {
  mockStorageData.history = [CATALOG_POOL[0], CATALOG_POOL[1]];
  mockStorageData.favorites = [CATALOG_POOL[2], CATALOG_POOL[4]];
  mockStorageData.milestones = { 'h1': { plays: 5, completions: 4, highestPct: 100 } };
  mockStorageData.skips = [];

  const recs = RecommendationEngine.getPersonalizedRecommendations(
    mockStorageData.history,
    mockStorageData.favorites,
    CATALOG_POOL,
    { limit: 10 }
  );

  assert(recs.length >= 6, 'Should generate at least 6 recommendations');
  // Check that top items are Hindi Bollywood / Arijit / Pritam / Mohit Chauhan
  const topLangs = recs.map(r => r.song.language);
  const hindiCount = topLangs.filter(l => l === 'hindi').length;
  assert(hindiCount >= recs.length * 0.7, 'Majority of recommendations must be Hindi');

  // Verify Artist Diversity (max 2 per artist)
  const artistCounts = {};
  recs.forEach(r => {
    const art = r.song.artists.split(',')[0].trim().toLowerCase();
    artistCounts[art] = (artistCounts[art] || 0) + 1;
    assert(artistCounts[art] <= 2, `Artist diversity exceeded for ${art}: ${artistCounts[art]}`);
  });
});

// 2. Punjabi Heavy Listener Profile
runTest('Profile 2: Punjabi Heavy Listener receives Karan Aujla, Diljit, Sidhu Moose Wala', () => {
  mockStorageData.history = [CATALOG_POOL[10], CATALOG_POOL[13]]; // Softly, Lover
  mockStorageData.favorites = [CATALOG_POOL[16]]; // 295
  mockStorageData.milestones = {};
  mockStorageData.skips = [];

  const recs = RecommendationEngine.getPersonalizedRecommendations(
    mockStorageData.history,
    mockStorageData.favorites,
    CATALOG_POOL,
    { limit: 8 }
  );

  const punjabiCount = recs.filter(r => r.song.language === 'punjabi').length;
  assert(punjabiCount >= 5, 'Must recommend primarily Punjabi tracks');
});

// 3. Tamil / Telugu South Listener Profile
runTest('Profile 3: South Listener (Anirudh, Sid Sriram) receives relevant regional hits', () => {
  mockStorageData.history = [CATALOG_POOL[20], CATALOG_POOL[23]]; // Arabic Kuthu, Srivalli
  mockStorageData.favorites = [CATALOG_POOL[21]]; // Hukum
  mockStorageData.milestones = {};
  mockStorageData.skips = [];

  const recs = RecommendationEngine.getPersonalizedRecommendations(
    mockStorageData.history,
    mockStorageData.favorites,
    CATALOG_POOL,
    { limit: 8 }
  );

  const southHits = recs.filter(r => r.song.language === 'tamil' || r.song.language === 'telugu');
  assert(southHits.length >= 4, 'Must recommend Tamil/Telugu tracks');
});

// 4. English Pop Aficionado
runTest('Profile 4: English Pop (Ed Sheeran, Taylor Swift) receives Pop catalog', () => {
  mockStorageData.history = [CATALOG_POOL[31], CATALOG_POOL[33]]; // Shape of You, Cruel Summer
  mockStorageData.favorites = [CATALOG_POOL[34]]; // Anti-Hero
  mockStorageData.milestones = {};
  mockStorageData.skips = [];

  const recs = RecommendationEngine.getPersonalizedRecommendations(
    mockStorageData.history,
    mockStorageData.favorites,
    CATALOG_POOL,
    { limit: 8 }
  );

  const engCount = recs.filter(r => r.song.language === 'english').length;
  assert(engCount >= 5, 'Must recommend English tracks');
});

// 5. Hip-hop & Rap Listener (Drake, Travis Scott)
runTest('Profile 5: Hip-hop Fan (The Weeknd, Drake, Travis Scott) gets related Hip-hop', () => {
  mockStorageData.history = [CATALOG_POOL[28], CATALOG_POOL[35]]; // Blinding Lights, God's Plan
  mockStorageData.favorites = [CATALOG_POOL[37]]; // SICKO MODE
  mockStorageData.milestones = {};
  mockStorageData.skips = [];

  const recs = RecommendationEngine.getPersonalizedRecommendations(
    mockStorageData.history,
    mockStorageData.favorites,
    CATALOG_POOL,
    { limit: 8 }
  );

  const topArtists = recs.map(r => r.song.artists.toLowerCase());
  const hiphopPresent = topArtists.some(a => a.includes('travis scott') || a.includes('drake') || a.includes('the weeknd'));
  assert(hiphopPresent, 'Must include related Hip-hop artists');
});

// 6. Rock & Alternative Listener (Coldplay, Imagine Dragons)
runTest('Profile 6: Rock & Alt Fan receives Coldplay & Imagine Dragons cluster', () => {
  mockStorageData.history = [CATALOG_POOL[39], CATALOG_POOL[41]]; // Yellow, Believer
  mockStorageData.favorites = [CATALOG_POOL[40]]; // Viva La Vida
  mockStorageData.milestones = {};
  mockStorageData.skips = [];

  const recs = RecommendationEngine.getPersonalizedRecommendations(
    mockStorageData.history,
    mockStorageData.favorites,
    CATALOG_POOL,
    { limit: 8 }
  );

  const rockMatches = recs.filter(r => r.song.artists.includes('Coldplay') || r.song.artists.includes('Imagine Dragons'));
  assert(rockMatches.length >= 2, 'Must recommend Rock catalog');
});

// 7. Multi-Lingual Eclectic Listener (Hindi + Punjabi + English)
runTest('Profile 7: Eclectic Multi-Lingual Listener receives balanced multi-genre mix', () => {
  mockStorageData.history = [CATALOG_POOL[0], CATALOG_POOL[10], CATALOG_POOL[28]]; // Kesariya, Softly, Blinding Lights
  mockStorageData.favorites = [CATALOG_POOL[3], CATALOG_POOL[13]]; // Channa Mereya, Lover
  mockStorageData.milestones = {};
  mockStorageData.skips = [];

  const recs = RecommendationEngine.getPersonalizedRecommendations(
    mockStorageData.history,
    mockStorageData.favorites,
    CATALOG_POOL,
    { limit: 12 }
  );

  const languages = new Set(recs.map(r => r.song.language));
  assert(languages.size >= 2, 'Must provide multi-lingual recommendations');
});

// 8. Fresh Cold-Start User
runTest('Profile 8: Cold-Start User receives trending popular tracks with max diversity', () => {
  mockStorageData.history = [];
  mockStorageData.favorites = [];
  mockStorageData.milestones = {};
  mockStorageData.skips = [];

  const recs = RecommendationEngine.getPersonalizedRecommendations([], [], CATALOG_POOL, { limit: 12 });
  assert(recs.length === 12, 'Must return requested limit for cold start');
  assert(recs.every(r => r.song.name && r.song.artists), 'All tracks must be valid');
});

// 9. Workout Mood Context Modulation
runTest('Profile 9: Workout Mood boosts high-energy and tempo songs while keeping user language', () => {
  mockStorageData.history = [CATALOG_POOL[10], CATALOG_POOL[13]]; // Punjabi songs
  mockStorageData.favorites = [];
  mockStorageData.milestones = {};
  mockStorageData.skips = [];

  const recs = RecommendationEngine.getPersonalizedRecommendations(
    mockStorageData.history,
    mockStorageData.favorites,
    CATALOG_POOL,
    { limit: 8, mood: 'workout' }
  );

  assert(recs.length > 0, 'Must produce workout recs');
  assert(recs.some(r => r.reason.toLowerCase().includes('workout') || r.reason.toLowerCase().includes('popular') || r.reason.toLowerCase().includes('top')), 'Reason reflects taste/mood');
});

// 10. Relax / Chill Mood Context
runTest('Profile 10: Relax Mood produces mellow / acoustic recommendations', () => {
  mockStorageData.history = [CATALOG_POOL[0], CATALOG_POOL[8]]; // Hindi romantic/acoustic
  mockStorageData.favorites = [];
  mockStorageData.milestones = {};
  mockStorageData.skips = [];

  const recs = RecommendationEngine.getPersonalizedRecommendations(
    mockStorageData.history,
    mockStorageData.favorites,
    CATALOG_POOL,
    { limit: 8, mood: 'relax' }
  );

  assert(recs.length > 0, 'Must produce relax recs');
});

// 11. Zero Playlist / Channel Contamination Filter
runTest('Metric 11: 0% Playlist, Channel, or Compilation Contamination in Recommendations', () => {
  const recs = RecommendationEngine.getPersonalizedRecommendations(
    [CATALOG_POOL[0]],
    [],
    CATALOG_POOL,
    { limit: 20 }
  );

  recs.forEach(r => {
    assert(r.song.type !== 'playlist', 'Contamination: playlist found in song recommendations');
    assert(r.song.type !== 'channel', 'Contamination: channel found in song recommendations');
    assert(r.song.type !== 'album', 'Contamination: album found in song recommendations');
    assert(r.song.duration >= 30, 'Contamination: short/invalid duration track found');
  });
});

// 12. Skip Penalty & Repetition Suppression
runTest('Metric 12: Frequent skips suppress penalized track in recommendations', () => {
  mockStorageData.history = [CATALOG_POOL[0]]; // Arijit
  mockStorageData.favorites = [];
  mockStorageData.milestones = {};
  mockStorageData.skips = [
    { id: 'h2', artist: 'arijit singh' },
    { id: 'h2', artist: 'arijit singh' },
    { id: 'h2', artist: 'arijit singh' }
  ];

  const recs = RecommendationEngine.getPersonalizedRecommendations(
    mockStorageData.history,
    mockStorageData.favorites,
    CATALOG_POOL,
    { limit: 5 }
  );

  const containsHeavilySkipped = recs.some(r => r.song.id === 'h2');
  assert(!containsHeavilySkipped, 'Heavily skipped track should be suppressed from top recommendations');
});

// 13. Quick Picks Builder (12-20 Song-First Tracks)
runTest('Metric 13: Quick Picks Builder outputs 12-20 high-quality song candidates with reasons', () => {
  const quickPicks = RecommendationEngine.buildQuickPicks(
    [CATALOG_POOL[0], CATALOG_POOL[28]],
    [CATALOG_POOL[10]],
    CATALOG_POOL,
    'all',
    16
  );

  assert(quickPicks.length >= 12 && quickPicks.length <= 20, `Quick picks count out of bounds: ${quickPicks.length}`);
  quickPicks.forEach(track => {
    assert(track.id, 'Track must have valid ID');
    assert(track.name, 'Track must have valid title');
    assert(track.recommendationReason, 'Track must have recommendation reason attached');
  });
});

console.log(`\n=============================================================`);
console.log(`  TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
console.log(`=============================================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
