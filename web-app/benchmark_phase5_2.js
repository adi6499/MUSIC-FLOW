// ============================================================================
// MUSICFLOW — PHASE 5.2 REAL BENCHMARK & QUALITY EVALUATION
// ============================================================================

const API = require('./js/api.js');
const RecommendationEngine = require('./js/recommendationEngine.js');
const AudioFeatureExtractor = require('./js/audioFeatureExtractor.js');
const FeatureStore = require('./js/featureStore.js');
const MusicFlowEmbedder = require('./js/musicFlowEmbedder.js');
const QdrantManager = require('../qdrantManager.js');

const benchmarkSeeds = [
  { title: 'Blinding Lights', artist: 'The Weeknd' },
  { title: 'Shape of You', artist: 'Ed Sheeran' },
  { title: 'Tum Hi Ho', artist: 'Arijit Singh' },
  { title: 'Starboy', artist: 'The Weeknd' }
];

async function runBenchmarks() {
  console.log('======================================================================');
  console.log('⚡ PHASE 5.2 REAL RECOMMENDATION INFRASTRUCTURE BENCHMARK');
  console.log('======================================================================\n');

  const summary = [];

  for (const item of benchmarkSeeds) {
    const t0 = Date.now();
    const search = await API.searchSongs(`${item.title} ${item.artist}`, 1, 10);
    const seed = search[0] || { id: `seed_${Date.now()}`, name: item.title, artists: item.artist };

    // Fetch catalog candidates
    const candidateSongs = await API.searchSongs(`${item.artist} Hits`, 1, 30);
    const tFetch = Date.now() - t0;

    // Feature extraction & Embedding
    const tFeat0 = Date.now();
    const seedFeatures = FeatureStore.getFeatures(seed.id) || AudioFeatureExtractor.createMetadataOnlyFeatures(seed);
    const seedVector = MusicFlowEmbedder.generateEmbedding(seed, seedFeatures);
    const tEmbed = Date.now() - tFeat0;

    // Index into Qdrant / in-memory vector store
    const tQdrant0 = Date.now();
    await QdrantManager.upsertTrackVector(seed.id, seedVector, seed);
    for (const c of candidateSongs) {
      const cFeat = FeatureStore.getFeatures(c.id) || AudioFeatureExtractor.createMetadataOnlyFeatures(c);
      const cVec = MusicFlowEmbedder.generateEmbedding(c, cFeat);
      await QdrantManager.upsertTrackVector(c.id, cVec, c);
    }
    const qdrantResults = await QdrantManager.searchNearestNeighbors(seedVector, 20);
    const tQdrant = Date.now() - tQdrant0;

    // Candidate generation & Hybrid Ranking
    const tRank0 = Date.now();
    const candidates = RecommendationEngine.generateCandidates(seed, candidateSongs);
    const topRecs = RecommendationEngine.getSimilarTracks(seed, candidateSongs, 10);
    const tRank = Date.now() - tRank0;

    const totalLatency = Date.now() - t0;

    console.log(`[SEED] "${seed.name}" — ${seed.artists} (ID: ${seed.id})`);
    console.log(`  • Candidate Pool   : ${candidates.length} tracks`);
    console.log(`  • Vector ANN Time  : ${tQdrant}ms`);
    console.log(`  • Ranking Time     : ${tRank}ms`);
    console.log(`  • Total Latency    : ${totalLatency}ms`);
    console.log(`  • Top 3 Results    :`);
    topRecs.slice(0, 3).forEach((r, idx) => {
      console.log(`     ${idx + 1}. ${r.song.name} — ${r.song.artists} (Score: ${r.score.toFixed(3)} | ${r.reason})`);
    });
    console.log('');

    summary.push({
      seedTrack: `${seed.name} — ${seed.artists}`,
      candidates: candidates.length,
      qdrantLatencyMs: tQdrant,
      rankingLatencyMs: tRank,
      totalLatencyMs: totalLatency,
      topRecommendation: topRecs[0] ? `${topRecs[0].song.name} — ${topRecs[0].song.artists}` : 'N/A'
    });
  }

  console.log('======================================================================');
  console.log('📊 BENCHMARK SUMMARY TABLE');
  console.log('======================================================================');
  console.table(summary);
}

runBenchmarks().catch(console.error);
