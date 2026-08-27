// ============================================================================
// MUSICFLOW — PHASE 5.2 REAL MUSIC RECOMMENDATION INFRASTRUCTURE TESTS
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
const qn = require('./js/queryNormalizer.js');
const ss = require('./js/stringSimilarity.js');
const td = require('./js/trackDeduplicator.js');
const afe = require('./js/audioFeatureExtractor.js');
const fsModule = require('./js/featureStore.js');
const mfe = require('./js/musicFlowEmbedder.js');
const qdrant = require('../qdrantManager.js');
const re = require('./js/recommendationEngine.js');
const st = require('./js/storage.js');

global.QueryNormalizer = qn;
global.StringSimilarity = ss;
global.TrackDeduplicator = td;
global.AudioFeatureExtractor = afe;
global.FeatureStore = fsModule;
global.MusicFlowEmbedder = mfe;
global.RecommendationEngine = re;
global.Storage = st;

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
  console.log('🧪 PHASE 5.2: REAL MUSIC RECOMMENDATION INFRASTRUCTURE TEST SUITE');
  console.log('======================================================================\n');

  // 1. Real Audio DSP Feature Extraction
  console.log('--- 1. Real Audio DSP Feature Extraction ---');
  const sampleRate = 44100;
  const durationSec = 3.0;
  const numSamples = Math.floor(sampleRate * durationSec);
  const pcmBuffer = new Float32Array(numSamples);
  const beatInterval = Math.floor(sampleRate * (60 / 120)); // 120 BPM beat interval

  for (let i = 0; i < numSamples; i++) {
    const isBeat = (i % beatInterval) < 1500;
    const env = isBeat ? 0.8 : 0.1;
    pcmBuffer[i] = Math.sin(2 * Math.PI * 440 * (i / sampleRate)) * env;
  }

  const realFeatures = AudioFeatureExtractor.extractFromPCM(pcmBuffer, sampleRate, { id: 'local_song_1', name: 'My Track' });
  assert(realFeatures.source === 'REAL_AUDIO', 'Real audio features labeled with REAL_AUDIO provenance');
  assert(realFeatures.tempo.source === 'REAL_AUDIO', 'Tempo labeled with REAL_AUDIO provenance');
  assert(realFeatures.tempo.value >= 60 && realFeatures.tempo.value <= 200, `Estimated tempo is realistic: ${realFeatures.tempo.value} BPM`);
  assert(realFeatures.energy.source === 'REAL_AUDIO' && realFeatures.energy.value > 0, `Real energy computed: ${realFeatures.energy.value.toFixed(3)}`);
  assert(realFeatures.key.source === 'REAL_AUDIO', `Real key identified: ${realFeatures.key.name}`);
  assert(realFeatures.acousticness.source === 'REAL_AUDIO', `Real acousticness computed: ${realFeatures.acousticness.value.toFixed(3)}`);

  // 2. Metadata-Derived Features & No Fake Claims
  console.log('\n--- 2. Metadata-Derived Features & Zero Fake Data ---');
  const metaFeatures = AudioFeatureExtractor.createMetadataOnlyFeatures({ id: 'saavn_123', name: 'Streaming Track', language: 'hindi' });
  assert(metaFeatures.source === 'METADATA_DERIVED', 'Streaming tracks labeled with METADATA_DERIVED provenance');
  assert(metaFeatures.tempo.source === 'UNKNOWN' && metaFeatures.tempo.value === null, 'Missing tempo explicitly labeled UNKNOWN (value: null)');
  assert(metaFeatures.energy.source === 'UNKNOWN' && metaFeatures.energy.value === null, 'Missing energy explicitly labeled UNKNOWN (value: null)');
  assert(metaFeatures.danceability.source === 'UNKNOWN' && metaFeatures.danceability.value === null, 'Missing danceability explicitly labeled UNKNOWN (value: null)');

  // 3. Feature Store Persistence & Versioning
  console.log('\n--- 3. Persistent Feature Store & Versioning ---');
  localStorage.clear();
  FeatureStore.saveFeatures('track_local_1', realFeatures);
  const retrieved = FeatureStore.getFeatures('track_local_1');
  assert(retrieved !== null && retrieved.trackId === 'track_local_1', 'FeatureStore saves and retrieves record');
  assert(retrieved.featureVersion === 'audio-analysis-v1', 'FeatureStore enforces featureVersion audio-analysis-v1');

  const byFingerprint = FeatureStore.getByFingerprint(realFeatures.audioFingerprint);
  assert(byFingerprint !== null && byFingerprint.trackId === 'track_local_1', 'FeatureStore retrieves by audioFingerprint');

  FeatureStore.setIndexingState('track_local_1', FeatureStore.INDEXING_STATE.INDEXED);
  assert(FeatureStore.getIndexingState('track_local_1') === 'INDEXED', 'FeatureStore tracks indexing state INDEXED');

  // 4. MusicFlow Custom 64-dim Embedder
  console.log('\n--- 4. MusicFlow Custom 64-dim Embedder ---');
  assert(MusicFlowEmbedder.MODEL_NAME === 'MusicFlow-Custom-Embedding-64d', 'Identified as MusicFlow-Custom-Embedding-64d');
  assert(MusicFlowEmbedder.EMBEDDING_DIM === 64, 'Embedding dimension is 64');

  const mockSongA = { id: 's1', name: 'Blinding Lights', artists: 'The Weeknd', language: 'english', genre: 'synthpop', year: '2020', popularity: 95 };
  const mockSongB = { id: 's2', name: 'Save Your Tears', artists: 'The Weeknd', language: 'english', genre: 'synthpop', year: '2020', popularity: 90 };
  const mockSongC = { id: 's3', name: 'Tum Hi Ho', artists: 'Arijit Singh', language: 'hindi', genre: 'bollywood', year: '2013', popularity: 94 };

  const vecA = MusicFlowEmbedder.generateEmbedding(mockSongA, realFeatures);
  assert(vecA instanceof Float32Array && vecA.length === 64, 'Generates 64-dimensional Float32Array vector');

  let normA = 0;
  for (let i = 0; i < 64; i++) normA += vecA[i] * vecA[i];
  assert(Math.abs(normA - 1.0) < 0.001, 'Vector is strictly L2 normalized (||v|| = 1.0)');

  const vecB = MusicFlowEmbedder.generateEmbedding(mockSongB);
  const vecC = MusicFlowEmbedder.generateEmbedding(mockSongC);
  const simAB = MusicFlowEmbedder.cosineSimilarity(vecA, vecB);
  const simAC = MusicFlowEmbedder.cosineSimilarity(vecA, vecC);
  assert(simAB > simAC, `Stylistically similar tracks have higher vector cosine similarity (${simAB.toFixed(3)} > ${simAC.toFixed(3)})`);

  // 5. Qdrant Vector Manager & In-Memory Fallback
  console.log('\n--- 5. Qdrant Vector Manager & In-Memory Fallback ---');
  const qdrantStatus = qdrant.getStatus();
  assert(qdrantStatus.collection === 'musicflow_tracks', 'Collection is musicflow_tracks');
  assert(qdrantStatus.vectorDim === 64, 'Vector dimension is 64');
  assert(qdrantStatus.distanceMetric === 'Cosine', 'Distance metric is Cosine');

  await qdrant.upsertTrackVector('s1', vecA, mockSongA);
  await qdrant.upsertTrackVector('s2', vecB, mockSongB);
  await qdrant.upsertTrackVector('s3', vecC, mockSongC);

  const searchResults = await qdrant.searchNearestNeighbors(vecA, 2);
  assert(searchResults.length === 2, 'Vector ANN retrieval returns top 2 nearest neighbors');
  assert(searchResults[0].trackId === 's1', 'Query vector retrieves exact match as top result');

  // 6. Multi-Channel Candidate Retrieval & Hybrid Ranker
  console.log('\n--- 6. Candidate Retrieval & Hybrid Ranking ---');
  const catalog = [mockSongA, mockSongB, mockSongC,
    { id: 's4', name: 'Starboy', artists: 'The Weeknd, Daft Punk', language: 'english', genre: 'pop', year: '2016', popularity: 88 },
    { id: 's5', name: 'In The Night', artists: 'The Weeknd', language: 'english', genre: 'pop', year: '2015', popularity: 80 },
    { id: 's6', name: 'One Dance', artists: 'Drake', language: 'english', genre: 'dancehall', year: '2016', popularity: 89 },
    { id: 's7', name: 'SICKO MODE', artists: 'Travis Scott, Drake', language: 'english', genre: 'hip-hop', year: '2018', popularity: 92 },
    { id: 's8', name: 'Kesariya', artists: 'Arijit Singh, Pritam', language: 'hindi', genre: 'bollywood', year: '2022', popularity: 96 }
  ];

  const candidates = RecommendationEngine.generateCandidates(mockSongA, catalog);
  assert(candidates.length >= 4, `Multi-channel generated ${candidates.length} candidates`);
  const vecANNSource = candidates.find(c => c.sources.includes('vector_ann'));
  assert(vecANNSource !== undefined, 'Candidates include vector_ann channel');

  // 7. User Taste Profiling & Diversity Constraint
  console.log('\n--- 7. User Taste Profile, Skip Penalties & Diversity ---');
  localStorage.clear();
  Storage.toggleFavorite(mockSongA); // Liked The Weeknd
  Storage.recordPlayMilestone(mockSongA, 100);
  Storage.recordSkip(mockSongC); // Skipped Arijit Singh

  const recs = RecommendationEngine.getPersonalizedRecommendations([mockSongA], [mockSongA], catalog, { limit: 6 });
  assert(recs.length > 0, `Generated ${recs.length} recommendations`);
  assert(recs[0].song.artists.includes('The Weeknd'), 'Top recommendation matches favorite artist');

  // Verify Artist Diversity Cap: Max 2 tracks per artist
  const artistCount = {};
  recs.forEach(r => {
    const art = TrackDeduplicator.cleanArtistName(r.song.artists);
    artistCount[art] = (artistCount[art] || 0) + 1;
  });
  const maxTracksPerArtist = Math.max(...Object.values(artistCount));
  assert(maxTracksPerArtist <= 2, `Artist diversity cap satisfied: max ${maxTracksPerArtist} tracks per artist (<= 2)`);

  // 8. Cold Start Handling
  console.log('\n--- 8. Cold Start Handling ---');
  localStorage.clear();
  const coldRecs = RecommendationEngine.getPersonalizedRecommendations([], [], catalog, { limit: 5 });
  assert(coldRecs.length > 0, `Cold start returns ${coldRecs.length} tracks for new user`);
  assert(coldRecs[0].reason.includes('Trending'), 'Cold start reason is transparent');

  console.log('\n======================================================================');
  console.log(`📊 PHASE 5.2 TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('======================================================================');

  if (testsFailed > 0) process.exit(1);
}

runSuite().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
