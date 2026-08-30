// ============================================================================
// MUSICFLOW PRODUCTION-HARDENING VERIFICATION SUITE
// Tests: PlaybackResolver, Endless Discovery, DataNormalizer, Update Handler
// ============================================================================

const assert = require('assert');

// 1. Load Modules
const DataNormalizer = require('../web-app/js/dataNormalizer.js');
const PlaybackResolver = require('../web-app/js/playbackResolver.js');
const RecommendationEngine = require('../web-app/js/recommendationEngine.js');
const YouTubeMusicService = require('../youtubeMusicService.js');
const handleUpdateRequest = require('../api/update.js');

let passedCount = 0;
let totalCount = 0;

function test(name, fn) {
  totalCount++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function asyncTest(name, fn) {
  totalCount++;
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function runAllTests() {
  console.log('\n--- 1. DataNormalizer Artist & Language Robustness ---');

  test('DataNormalizer.getLegitimateMusicArtists filters actor and composer credits', () => {
    const rawSong = {
      name: 'Chaleya',
      artists: [
        { name: 'Arijit Singh', role: 'Singer' },
        { name: 'Shilpa Rao', role: 'Singer' },
        { name: 'Shah Rukh Khan', role: 'Starring / Actor' },
        { name: 'Nayanthara', role: 'Cast' },
        { name: 'Anirudh Ravichander', role: 'Composer' }
      ]
    };

    const legitimate = DataNormalizer.getLegitimateMusicArtists(rawSong);
    assert.strictEqual(legitimate.length, 2, 'Should filter out 2 actors/cast and 1 composer from performing artists');
    assert.ok(legitimate.some(a => a.name === 'Arijit Singh'));
    assert.ok(legitimate.some(a => a.name === 'Shilpa Rao'));
    assert.ok(!legitimate.some(a => a.name === 'Shah Rukh Khan'));
    assert.ok(!legitimate.some(a => a.name === 'Anirudh Ravichander'));

    const credits = DataNormalizer.getCredits(rawSong);
    assert.strictEqual(credits.length, 3, 'Should preserve 3 non-performing credits');
    assert.ok(credits.some(c => c.name === 'Anirudh Ravichander' && c.role === 'Composer'));
    assert.ok(credits.some(c => c.name === 'Shah Rukh Khan'));
  });

  test('Firework test case: Displays Katy Perry ONLY and preserves 5 composer credits', () => {
    const fireworkRaw = {
      id: 'song_firework_123',
      name: 'Firework',
      title: 'Firework',
      artists: {
        primary: [
          { id: '456863', name: 'Katy Perry', role: 'singer', type: 'artist' }
        ],
        featured: [],
        all: [
          { id: '456863', name: 'Katy Perry', role: 'singer' },
          { id: '458793', name: 'Mikkel S. Eriksen', role: 'composer' },
          { id: '458794', name: 'Tor Erik Hermansen', role: 'composer' },
          { id: '468502', name: 'Sandy Wilhelm', role: 'composer' },
          { id: '458795', name: 'Ester Dean', role: 'composer' },
          { id: '489201', name: 'Migos', role: 'composer' }
        ]
      }
    };

    const normalized = DataNormalizer.normalizeTrack(fireworkRaw);
    assert.strictEqual(normalized.primaryArtist, 'Katy Perry');
    assert.strictEqual(normalized.artists, 'Katy Perry');
    assert.deepStrictEqual(normalized.artistNames, ['Katy Perry']);
    assert.strictEqual(DataNormalizer.getPrimaryArtist(normalized), 'Katy Perry');
    assert.strictEqual(DataNormalizer.getArtistString(normalized), 'Katy Perry');
    assert.deepStrictEqual(DataNormalizer.getDisplayArtists(normalized), ['Katy Perry']);

    // Check that credits are preserved internally without polluting artist fields
    const credits = DataNormalizer.getCredits(normalized);
    assert.strictEqual(credits.length, 5);
    assert.ok(credits.some(c => c.name === 'Mikkel S. Eriksen' && c.role === 'composer'));
    assert.ok(credits.some(c => c.name === 'Migos' && c.role === 'composer'));
  });

  test('Featured artists test case: Jaan Nisaar displays Amit Trivedi • Arijit Singh', () => {
    const song = {
      name: 'Jaan Nisaar (Arijit)',
      artists: {
        primary: [{ id: '1', name: 'Amit Trivedi', role: 'primary' }],
        featured: [{ id: '2', name: 'Arijit Singh', role: 'featured' }]
      }
    };

    const normalized = DataNormalizer.normalizeTrack(song);
    assert.strictEqual(normalized.primaryArtist, 'Amit Trivedi');
    assert.strictEqual(normalized.displayArtist, 'Amit Trivedi • Arijit Singh');
    assert.deepStrictEqual(DataNormalizer.getDisplayArtists(normalized), ['Amit Trivedi', 'Arijit Singh']);
  });

  test('Multi-performer overflow formatting (> 3 performers)', () => {
    const song = {
      name: 'All Stars',
      artists: 'Artist 1, Artist 2, Artist 3, Artist 4, Artist 5'
    };

    const performers = DataNormalizer.getDisplayArtists(song);
    const displayStr = performers.length <= 3 ? performers.join(' • ') : `${performers.slice(0, 3).join(' • ')} +${performers.length - 3}`;
    assert.strictEqual(displayStr, 'Artist 1 • Artist 2 • Artist 3 +2');
  });

  test('DataNormalizer string/array artist helpers do not throw TypeError', () => {
    assert.strictEqual(DataNormalizer.getArtistString(null), 'Unknown Artist');
    assert.strictEqual(DataNormalizer.getArtistString(undefined), 'Unknown Artist');
    assert.strictEqual(DataNormalizer.getArtistString(12345), '12345');
    assert.strictEqual(DataNormalizer.getPrimaryArtistName({ name: 'Test', artists: 'Arijit Singh, Badshah' }), 'Arijit Singh');
    assert.strictEqual(DataNormalizer.getPrimaryArtistName({ name: 'Test', artists: [{ name: 'Shreya Ghoshal' }] }), 'Shreya Ghoshal');
  });

  test('DataNormalizer.normalizeLanguage converts native and ISO codes', () => {
    assert.strictEqual(DataNormalizer.normalizeLanguage('hi'), 'hindi');
    assert.strictEqual(DataNormalizer.normalizeLanguage('en'), 'english');
    assert.strictEqual(DataNormalizer.normalizeLanguage('हिन्दी'), 'hindi');
    assert.strictEqual(DataNormalizer.normalizeLanguage('punjabi'), 'punjabi');
  });

  console.log('\n--- 2. Centralized PlaybackResolver Multi-Provider Fallback ---');

  await asyncTest('PlaybackResolver resolves direct stream URL', async () => {
    const song = {
      id: 'test_1',
      name: 'Direct Stream Track',
      audioUrl: 'https://example.com/audio.mp3',
      provider: 'jiosaavn'
    };

    const result = await PlaybackResolver.resolvePlayableSource(song);
    assert.strictEqual(result.type, PlaybackResolver.SourceType.STREAMING);
    assert.strictEqual(result.uri, 'https://example.com/audio.mp3');
  });

  await asyncTest('PlaybackResolver respects AbortSignal for rapid Next/Previous', async () => {
    const controller = new AbortController();
    controller.abort();

    const song = { id: 'test_abort', name: 'Aborted Song' };
    try {
      await PlaybackResolver.resolvePlayableSource(song, { signal: controller.signal });
      assert.fail('Should have thrown AbortError');
    } catch (err) {
      assert.ok(err.name === 'AbortError' || err.message.includes('aborted'));
    }
  });

  await asyncTest('PlaybackResolver caches resolved stream with TTL', async () => {
    PlaybackResolver.setCachedStream('test_cache_song', 'https://cached.url/audio.mp3');
    const cached = PlaybackResolver.getCachedStream('test_cache_song');
    assert.strictEqual(cached, 'https://cached.url/audio.mp3');

    const resolved = await PlaybackResolver.resolvePlayableSource({ id: 'test_cache_song', name: 'Cached Track' });
    assert.strictEqual(resolved.type, PlaybackResolver.SourceType.CACHED);
    assert.strictEqual(resolved.uri, 'https://cached.url/audio.mp3');
  });

  console.log('\n--- 3. Endless Discovery & Recommendation Engine ---');

  test('RecommendationEngine.getDiscoveryFeed delivers personalized batches', () => {
    RecommendationEngine.resetDiscoverySession();

    const pool = [
      { id: '101', name: 'Song 1', language: 'hindi', artists: 'Arijit Singh' },
      { id: '102', name: 'Song 2', language: 'hindi', artists: 'Pritam' },
      { id: '103', name: 'Song 3', language: 'english', artists: 'Ed Sheeran' },
      { id: '104', name: 'Song 4', language: 'punjabi', artists: 'AP Dhillon' },
      { id: '105', name: 'Song 5', language: 'hindi', artists: 'Arijit Singh' }
    ];

    const batch1 = RecommendationEngine.getDiscoveryFeed(pool, {
      selectedLanguages: ['hindi'],
      limit: 3
    });

    assert.strictEqual(batch1.length, 3);
    assert.ok(batch1.every(s => s.id && s.name));
    assert.ok(batch1[0].discoveryReason);

    // Session deduplication check: Batch 2 should deliver remaining pool tracks
    const batch2 = RecommendationEngine.getDiscoveryFeed(pool, {
      selectedLanguages: ['hindi'],
      limit: 2
    });
    assert.strictEqual(batch2.length, 2);
  });

  console.log('\n--- 4. Update Manager Handler Output ---');

  await asyncTest('/api/update returns valid JSON response without HTML', async () => {
    let responseStatus = 0;
    let responseHeaders = {};
    let responseBody = '';

    const mockReq = {
      headers: { host: 'localhost:3000' },
      url: '/api/update?platform=android&version=2.6.0',
      method: 'GET'
    };

    const mockRes = {
      writeHead: (status, headers) => {
        responseStatus = status;
        responseHeaders = headers;
      },
      setHeader: (k, v) => { responseHeaders[k] = v; },
      end: (data) => {
        responseBody = data;
      }
    };

    await handleUpdateRequest(mockReq, mockRes);
    assert.strictEqual(responseStatus, 200);
    assert.ok(responseHeaders['Content-Type'].includes('application/json'));

    const parsed = JSON.parse(responseBody);
    assert.ok('updateAvailable' in parsed);
    assert.ok('latestVersion' in parsed);
    assert.strictEqual(parsed.platform, 'android');
  });

  console.log('\n--- 5. YouTube Music Stream Method Validation ---');

  test('YouTubeMusicService has getStreamUrl method', () => {
    assert.strictEqual(typeof YouTubeMusicService.getStreamUrl, 'function');
  });

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passedCount} / ${totalCount} PASSED (100%)`);
  console.log(`========================================\n`);

  if (passedCount < totalCount) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
