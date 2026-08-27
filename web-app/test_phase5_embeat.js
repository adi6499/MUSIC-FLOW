// ============================================================================
// MUSICFLOW — PHASE 5 EMBEAT RECOMMENDATION ENGINE TEST SUITE
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

// Load modules in order
const qnCode = fs.readFileSync(path.join(__dirname, 'js', 'queryNormalizer.js'), 'utf8');
const ssCode = fs.readFileSync(path.join(__dirname, 'js', 'stringSimilarity.js'), 'utf8');
const tdCode = fs.readFileSync(path.join(__dirname, 'js', 'trackDeduplicator.js'), 'utf8');
const eaCode = fs.readFileSync(path.join(__dirname, 'js', 'embeatAdapter.js'), 'utf8');
const reCode = fs.readFileSync(path.join(__dirname, 'js', 'recommendationEngine.js'), 'utf8');
const stCode = fs.readFileSync(path.join(__dirname, 'js', 'storage.js'), 'utf8');

global.QueryNormalizer = eval(qnCode + '\nQueryNormalizer;');
global.StringSimilarity = eval(ssCode + '\nStringSimilarity;');
global.TrackDeduplicator = eval(tdCode + '\nTrackDeduplicator;');
global.EmbeatAdapter = eval(eaCode + '\nEmbeatAdapter;');
global.RecommendationEngine = eval(reCode + '\nRecommendationEngine;');
global.Storage = eval(stCode + '\nStorage;');

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

console.log('======================================================================');
console.log('🧪 PHASE 5: EMBEAT MUSIC RECOMMENDATION ENGINE TEST SUITE');
console.log('======================================================================\n');

// Mock Catalog
const catalog = [
  { id: 't1', name: 'Blinding Lights', artists: 'The Weeknd', album: 'After Hours', language: 'english', genre: 'synthpop', duration: 200, year: '2020', popularity: 95 },
  { id: 't2', name: 'Save Your Tears', artists: 'The Weeknd', album: 'After Hours', language: 'english', genre: 'synthpop', duration: 215, year: '2020', popularity: 90 },
  { id: 't3', name: 'Starboy', artists: 'The Weeknd, Daft Punk', album: 'Starboy', language: 'english', genre: 'pop', duration: 230, year: '2016', popularity: 88 },
  { id: 't4', name: 'Heartless', artists: 'The Weeknd', album: 'After Hours', language: 'english', genre: 'r&b', duration: 198, year: '2019', popularity: 82 },
  { id: 't5', name: 'In The Night', artists: 'The Weeknd', album: 'Beauty Behind The Madness', language: 'english', genre: 'pop', duration: 235, year: '2015', popularity: 80 },
  { id: 't6', name: 'One Dance', artists: 'Drake, WizKid, Kyla', album: 'Views', language: 'english', genre: 'dancehall', duration: 174, year: '2016', popularity: 89 },
  { id: 't7', name: 'God\'s Plan', artists: 'Drake', album: 'Scorpion', language: 'english', genre: 'hip-hop', duration: 198, year: '2018', popularity: 91 },
  { id: 't8', name: 'SICKO MODE', artists: 'Travis Scott, Drake', album: 'ASTROWORLD', language: 'english', genre: 'hip-hop', duration: 312, year: '2018', popularity: 92 },
  { id: 't9', name: 'Circles', artists: 'Post Malone', album: 'Hollywood\'s Bleeding', language: 'english', genre: 'pop', duration: 215, year: '2019', popularity: 87 },
  { id: 't10', name: 'Levitating', artists: 'Dua Lipa', album: 'Future Nostalgia', language: 'english', genre: 'dancepop', duration: 203, year: '2020', popularity: 89 },
  { id: 't11', name: 'Tum Hi Ho', artists: 'Arijit Singh', album: 'Aashiqui 2', language: 'hindi', genre: 'bollywood', duration: 262, year: '2013', popularity: 94 },
  { id: 't12', name: 'Kesariya', artists: 'Arijit Singh, Pritam', album: 'Brahmastra', language: 'hindi', genre: 'bollywood', duration: 268, year: '2022', popularity: 96 },
  { id: 't13', name: 'Channa Mereya', artists: 'Arijit Singh, Pritam', album: 'Ae Dil Hai Mushkil', language: 'hindi', genre: 'bollywood', duration: 289, year: '2016', popularity: 90 },
  { id: 't14', name: 'Agar Tum Saath Ho', artists: 'Alka Yagnik, Arijit Singh', album: 'Tamasha', language: 'hindi', genre: 'bollywood', duration: 341, year: '2015', popularity: 92 },
  { id: 't15', name: 'Shayad', artists: 'Arijit Singh, Pritam', album: 'Love Aaj Kal', language: 'hindi', genre: 'bollywood', duration: 247, year: '2020', popularity: 88 },
  { id: 't16', name: 'Shape of You', artists: 'Ed Sheeran', album: 'Divide', language: 'english', genre: 'pop', duration: 233, year: '2017', popularity: 95 },
  { id: 't17', name: 'Bad Habits', artists: 'Ed Sheeran', album: 'Equals', language: 'english', genre: 'dancepop', duration: 231, year: '2021', popularity: 88 },
  { id: 't18', name: 'Perfect', artists: 'Ed Sheeran', album: 'Divide', language: 'english', genre: 'pop', duration: 263, year: '2017', popularity: 93 }
];

// 1. Embeat Track Adapter & Encoder
console.log('--- 1. Embeat Track Adapter & 64-dim Encoder ---');
const embeatTrack = EmbeatAdapter.MusicFlowTrackAdapter.toEmbeatTrack(catalog[0]);
assert(embeatTrack && embeatTrack.track_name === 'Blinding Lights', 'Adapter extracts track name');
assert(embeatTrack.artist_name === 'The Weeknd', 'Adapter extracts clean primary artist');
assert(embeatTrack.acoustic_features.continuous.length === 7, 'Adapter produces 7 continuous EmbeatMLP features');

const vec1 = EmbeatAdapter.EmbeatEncoder.encodeTrack(embeatTrack);
assert(vec1 instanceof Float32Array && vec1.length === 64, 'EmbeatEncoder generates 64-dimensional Float32 vector');

let normSum = 0;
for (let i = 0; i < 64; i++) normSum += vec1[i] * vec1[i];
assert(Math.abs(normSum - 1.0) < 0.001, 'Vector is strictly L2-normalized (norm = 1.0)');

const embeatTrack2 = EmbeatAdapter.MusicFlowTrackAdapter.toEmbeatTrack(catalog[1]); // Save Your Tears
const vec2 = EmbeatAdapter.EmbeatEncoder.encodeTrack(embeatTrack2);
const sim12 = EmbeatAdapter.EmbeatEncoder.cosineSimilarity(vec1, vec2);
assert(sim12 >= 0.0 && sim12 <= 1.0, `Cosine similarity in [0, 1] range: ${sim12.toFixed(3)}`);

// 2. Multi-Channel Candidate Recall
console.log('\n--- 2. Multi-Channel Candidate Recall ---');
const candidates = RecommendationEngine.generateCandidates(catalog[0], catalog); // Seed: Blinding Lights
assert(candidates.length > 5, `Multi-channel recall generated ${candidates.length} unique candidates`);

const candidateWithAcoustic = candidates.find(c => c.sources.includes('acoustic'));
assert(candidateWithAcoustic !== undefined, 'Acoustic recall channel successfully populated candidates');

const candidateWithSameArtist = candidates.find(c => c.sources.includes('same_artist'));
assert(candidateWithSameArtist !== undefined, 'Same-artist recall channel successfully populated candidates');

const candidateWithRelatedArtist = candidates.find(c => c.sources.includes('related_artist'));
assert(candidateWithRelatedArtist !== undefined, 'Related-artist graph recall channel successfully populated candidates');

// 3. User Taste Profile, Milestones & Skip Penalties
console.log('\n--- 3. User Taste Profile, Milestones & Skip Penalties ---');
localStorage.clear();

// User favorites The Weeknd & completed plays
Storage.toggleFavorite(catalog[0]); // Blinding Lights
Storage.recordPlayMilestone(catalog[0], 100); // 100% completion
Storage.recordPlayMilestone(catalog[1], 100); // 100% completion

// User skips Ed Sheeran
Storage.recordSkip(catalog[15]); // Shape of You
Storage.recordSkip(catalog[16]); // Bad Habits

const signals = Storage.getUserTasteSignals();
assert(signals.artistScores['the weeknd'] > 2.0, 'User taste profile gives high weight to favorite artist');
assert(signals.skippedArtistCounts['ed sheeran'] >= 2, 'User taste profile records repeated skips on artist');

// 4. Hybrid Personalized Recommendation Ranking
console.log('\n--- 4. Hybrid Personalized Ranking & Recommendations ---');
const recs = RecommendationEngine.getPersonalizedRecommendations(
  [catalog[0], catalog[1]], // history
  [catalog[0]],            // favorites
  catalog,
  { limit: 10 }
);

assert(recs.length > 0, `Generated ${recs.length} personalized recommendations`);
assert(recs[0].song.artists.includes('The Weeknd') || recs[0].song.artists.includes('Drake') || recs[0].song.artists.includes('Travis Scott'),
  `Top recommendation is relevant artist (${recs[0].song.artists})`);

// Verify Skip Penalty: Ed Sheeran should be penalized below The Weeknd/Drake/Post Malone
const edSheeranRank = recs.findIndex(r => r.song.artists.includes('Ed Sheeran'));
const theWeekndRank = recs.findIndex(r => r.song.artists.includes('The Weeknd'));
assert(theWeekndRank < edSheeranRank || edSheeranRank === -1, 'Liked/played artist ranks higher than repeatedly skipped artist');

// 5. Artist Diversity Constraint
console.log('\n--- 5. Artist Diversity Constraint ---');
const artistFreq = {};
recs.forEach(r => {
  const art = TrackDeduplicator.cleanArtistName(r.song.artists);
  artistFreq[art] = (artistFreq[art] || 0) + 1;
});
const maxTracksPerArtist = Math.max(...Object.values(artistFreq));
assert(maxTracksPerArtist <= 2, `Artist diversity enforced: max ${maxTracksPerArtist} songs per artist (<= 2)`);

// 6. Transparent Recommendation Reasons
console.log('\n--- 6. Recommendation Reasons ---');
assert(typeof recs[0].reason === 'string' && recs[0].reason.length > 5, `Real transparent reason provided: "${recs[0].reason}"`);

// 7. Track Radio & Similar Tracks
console.log('\n--- 7. Track Radio & Similar Tracks ("More Like This") ---');
const similarTracks = RecommendationEngine.getSimilarTracks(catalog[0], catalog, 10);
assert(similarTracks.length > 0, `getSimilarTracks returned ${similarTracks.length} items`);
assert(similarTracks[0].song.id !== catalog[0].id, 'Seed track excluded from similar tracks output');

const radioQueue = RecommendationEngine.getTrackRadio(catalog[0], catalog, 15);
assert(radioQueue[0].id === catalog[0].id, 'Radio queue starts with seed song');
assert(radioQueue.length > 1, `Continuous radio queue populated with ${radioQueue.length} tracks`);

// 8. Cold Start Handling
console.log('\n--- 8. Cold Start Handling ---');
localStorage.clear();
const coldStartRecs = RecommendationEngine.getPersonalizedRecommendations([], [], catalog, { limit: 8 });
assert(coldStartRecs.length > 0, `Cold-start returns ${coldStartRecs.length} tracks for brand-new user with 0 history`);
assert(coldStartRecs[0].reason.includes('Trending') || coldStartRecs[0].reason.includes('Recommended'), `Cold start reason is transparent: "${coldStartRecs[0].reason}"`);

console.log('\n======================================================================');
console.log(`📊 PHASE 5 TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
console.log('======================================================================');

if (testsFailed > 0) process.exit(1);
