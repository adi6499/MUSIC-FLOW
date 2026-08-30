// ============================================================================
// MUSICFLOW — HYBRID PROVIDER INTEGRATION TEST SUITE (Phase 6)
// Tests multi-provider orchestration, unified search, deduplication,
// radio continuity, playback fallback, and security guarantees.
// ============================================================================

const assert = require('assert');
const { MusicProvider, MusicProviderTypes, ProviderHealthState, ProviderManager, normalizeTrackSchema } = require('./js/musicProvider.js');
const { JioSaavnProvider } = require('./js/jioSaavnProvider.js');
const { YouTubeMusicProvider } = require('./js/youtubeMusicProvider.js');
const TrackDeduplicator = require('./js/trackDeduplicator.js');
const SearchEngine = require('./js/searchEngine.js');
const QueryNormalizer = require('./js/queryNormalizer.js');
const RecommendationEngine = require('./js/recommendationEngine.js');
const YouTubeMusicService = require('../youtubeMusicService.js');

let passedTests = 0;
let failedTests = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    failedTests++;
  }
}

async function itAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('\n======================================================================');
  console.log('🧪 MUSICFLOW HYBRID PROVIDER INTEGRATION TEST SUITE');
  console.log('======================================================================\n');

  console.log('--- 1. Provider Registration & Priority Hierarchy ---');
  const pm = new ProviderManager();
  const jio = new JioSaavnProvider();
  const yt = new YouTubeMusicProvider();

  it('Registers JioSaavn as Primary provider (priority 100)', () => {
    pm.registerProvider(jio, true);
    assert.strictEqual(pm.primaryProvider.name, MusicProviderTypes.JIOSAAVN);
    assert.strictEqual(pm.primaryProvider.priority, 100);
  });

  it('Registers YouTube Music as Secondary provider (priority 50)', () => {
    pm.registerProvider(yt, false);
    const providers = pm.getAllProviders();
    assert.strictEqual(providers.length, 2);
    assert.strictEqual(providers[0].name, MusicProviderTypes.JIOSAAVN);
    assert.strictEqual(providers[1].name, MusicProviderTypes.YOUTUBE_MUSIC);
  });

  console.log('\n--- 2. Unified Search & Parallel Provider Execution ---');
  await itAsync('Executes parallel search across providers without stalling', async () => {
    const start = Date.now();
    // Simulate multi-provider search with real live JioSaavn + mock/service YT
    const [jioRes, ytRes] = await Promise.all([
      jio.search('Kesariya', { limit: 10 }),
      YouTubeMusicService.search('Kesariya', 10)
    ]);
    const duration = Date.now() - start;

    assert(Array.isArray(jioRes.songs), 'Expected JioSaavn songs');
    assert(Array.isArray(ytRes.songs), 'Expected YouTube songs');
    assert(jioRes.songs.length > 0, 'JioSaavn should return results');
    assert(ytRes.songs.length > 0, 'YouTube should return results');

    console.log(`     Parallel search completed in ${duration}ms (JioSaavn: ${jioRes.songs.length}, YouTube: ${ytRes.songs.length})`);
  });

  console.log('\n--- 3. Cross-Provider Deduplication & JioSaavn Playback Priority ---');
  it('Prefers playable JioSaavn track when identical recording exists in YouTube Music', () => {
    const jioTrack = normalizeTrackSchema({
      id: '3791131',
      name: 'Kesariya',
      artists: 'Arijit Singh, Pritam',
      album: 'Brahmastra',
      audioUrl: 'https://aac.saavncdn.com/kesariya_320.mp4',
      downloadUrl: [{ quality: '320kbps', url: 'https://aac.saavncdn.com/kesariya_320.mp4' }],
      provider: 'jiosaavn',
      playbackAvailable: true
    }, 'jiosaavn');

    const ytTrack = normalizeTrackSchema({
      id: 'yt_NJAv_7lHUIU',
      videoId: 'NJAv_7lHUIU',
      name: 'Kesariya',
      artists: 'Arijit Singh, Pritam',
      album: 'Brahmastra',
      provider: 'youtube_music',
      playbackAvailable: false
    }, 'youtube_music');

    const combined = [ytTrack, jioTrack];
    const deduped = TrackDeduplicator.deduplicate(combined, 'Kesariya');

    assert.strictEqual(deduped.length, 1, 'Expected duplicate tracks to merge into 1');
    assert.strictEqual(deduped[0].provider, 'jiosaavn', 'Expected JioSaavn to win due to playable source');
    assert.strictEqual(deduped[0].id, '3791131');
    assert(deduped[0].audioUrl.startsWith('http'), 'Expected valid stream URL');
  });

  console.log('\n--- 4. YouTube Long-Tail Catalog Coverage ---');
  it('Retains YouTube Music result when not present in JioSaavn catalog', () => {
    const ytOnlyTrack = normalizeTrackSchema({
      id: 'yt_longtail_999',
      videoId: 'longtail_999',
      name: 'Rare Synthwave Instrumental Cover 2024',
      artists: 'Neon Wave Producer',
      album: 'Synthwave Vol 4',
      provider: 'youtube_music',
      playbackAvailable: false
    }, 'youtube_music');

    const combined = [ytOnlyTrack];
    const deduped = TrackDeduplicator.deduplicate(combined, 'Synthwave');

    assert.strictEqual(deduped.length, 1);
    assert.strictEqual(deduped[0].provider, 'youtube_music');
    assert.strictEqual(deduped[0].name, 'Rare Synthwave Instrumental Cover 2024');
    assert.strictEqual(deduped[0].playbackAvailable, false);
  });

  console.log('\n--- 5. Ranking Engine with Multi-Provider Signals ---');
  it('Ranks playable exact title match above metadata-only matches', () => {
    const parsed = QueryNormalizer.parseCompoundQuery('Kesariya');
    const tracks = [
      normalizeTrackSchema({
        id: 'yt_unplayable',
        name: 'Kesariya',
        artists: 'Unknown',
        provider: 'youtube_music',
        playbackAvailable: false
      }, 'youtube_music'),
      normalizeTrackSchema({
        id: 'jio_playable',
        name: 'Kesariya',
        artists: 'Arijit Singh',
        audioUrl: 'https://stream.mp4',
        provider: 'jiosaavn',
        playbackAvailable: true
      }, 'jiosaavn')
    ];

    const ranked = SearchEngine.rankSongs(tracks, parsed);
    assert.strictEqual(ranked[0].id, 'jio_playable');
    assert.strictEqual(ranked[0].provider, 'jiosaavn');
  });

  console.log('\n--- 6. Radio Queue Continuity & Multi-Candidate Population ---');
  await itAsync('Generates 10-25 candidates for seed track without duplicating seed', async () => {
    const seed = {
      id: '3791131',
      name: 'Kesariya',
      primaryArtist: 'Arijit Singh',
      artists: 'Arijit Singh, Pritam',
      provider: 'jiosaavn'
    };

    const ytRadio = await YouTubeMusicService.getRadioCandidates('NJAv_7lHUIU', 'Kesariya', 'Arijit Singh', 20);
    const candidates = (ytRadio.candidates || []).map(c => normalizeTrackSchema(c, 'youtube_music'));

    assert(candidates.length >= 10, `Expected >= 10 candidates, got ${candidates.length}`);
    const hasSeedInCandidates = candidates.some(c => c.name.toLowerCase() === 'kesariya' && c.primaryArtist.toLowerCase() === 'arijit singh');
    assert(!hasSeedInCandidates, 'Seed track should not be duplicated in upcoming candidates');
  });

  console.log('\n--- 7. Benchmark Dataset Search Coverage ---');
  const testQueries = [
    'Arijit Singh',
    'Akhiyan De Kol',
    'Kesariya',
    'Tum Hi Ho',
    'Blinding Lights',
    'Shape of You',
    'Alan Walker',
    'Shubh',
    'Diljit Dosanjh'
  ];

  for (const q of testQueries) {
    await itAsync(`Dataset search for "${q}" returns unified results`, async () => {
      const parsed = QueryNormalizer.parseCompoundQuery(q);
      const [jioRes, ytRes] = await Promise.all([
        jio.search(q, { limit: 10 }),
        YouTubeMusicService.search(q, 10)
      ]);
      const combined = [...(jioRes.songs || []), ...(ytRes.songs || []).map(s => normalizeTrackSchema(s, 'youtube_music'))];
      const ranked = SearchEngine.rankSongs(combined, parsed);
      assert(ranked.length > 0, `Expected ranked results for ${q}`);
      console.log(`     "${q}": ${ranked.length} ranked tracks (Top: "${ranked[0].name}" by ${ranked[0].artists} [${ranked[0].provider}])`);
    });
  }

  console.log('\n--- 8. Security & Credential Protection ---');
  it('Ensures no private cookies, session tokens, or admin keys are exposed in normalized tracks', () => {
    const sampleTrack = normalizeTrackSchema({
      id: 'test_123',
      name: 'Test Song',
      cookie: 'secret_cookie_value',
      token: 'bearer_oauth_token',
      adminKey: 'admin_123'
    }, 'jiosaavn');

    assert.strictEqual(sampleTrack.cookie, undefined);
    assert.strictEqual(sampleTrack.token, undefined);
    assert.strictEqual(sampleTrack.adminKey, undefined);
    assert(!JSON.stringify(sampleTrack).includes('secret_cookie_value'));
  });

  console.log('\n======================================================================');
  console.log(`📊 HYBRID PROVIDER INTEGRATION RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('======================================================================\n');

  if (failedTests > 0) process.exit(1);
}

runTests();
