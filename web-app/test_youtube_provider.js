// ============================================================================
// MUSICFLOW — YOUTUBE MUSIC PROVIDER TEST SUITE
// Unit tests for YouTube Music provider, Innertube adapter, and normalization.
// ============================================================================

const assert = require('assert');
const YouTubeMusicService = require('../youtubeMusicService.js');
const { YouTubeMusicProvider } = require('./js/youtubeMusicProvider.js');
const { normalizeTrackSchema } = require('./js/musicProvider.js');

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
  console.log('🧪 YOUTUBE MUSIC PROVIDER TEST SUITE');
  console.log('======================================================================\n');

  console.log('--- 1. Normalization Schema & Provider Attributes ---');
  it('Normalizes raw YouTube track into standard MusicFlow schema', () => {
    const raw = {
      videoId: 'NJAv_7lHUIU',
      title: 'Kesariya (From "Brahmastra")',
      artists: 'Arijit Singh, Pritam',
      album: 'Brahmastra',
      duration: '4:28',
      thumbnails: [{ url: 'https://i.ytimg.com/vi/NJAv_7lHUIU/hqdefault.jpg' }]
    };
    const track = normalizeTrackSchema(raw, 'youtube_music');
    assert.strictEqual(track.provider, 'youtube_music');
    assert.strictEqual(track.providerId, 'NJAv_7lHUIU');
    assert.strictEqual(track.id, 'yt_NJAv_7lHUIU');
    assert.strictEqual(track.name, 'Kesariya (From "Brahmastra")');
    assert.strictEqual(track.primaryArtist, 'Arijit Singh');
    assert.strictEqual(track.duration, 268);
    assert.strictEqual(track.metadataAvailable, true);
  });

  it('Duration parser converts mm:ss and hh:mm:ss correctly', () => {
    const track1 = normalizeTrackSchema({ id: '1', name: 'Song 1', duration: '3:45' });
    const track2 = normalizeTrackSchema({ id: '2', name: 'Song 2', duration: '1:02:10' });
    assert.strictEqual(track1.duration, 225);
    assert.strictEqual(track2.duration, 3730);
  });

  console.log('\n--- 2. YouTube Music Innertube Search ---');
  await itAsync('Performs search query for "Kesariya" returning structured results', async () => {
    const start = Date.now();
    const res = await YouTubeMusicService.search('Kesariya', 10);
    const latency = Date.now() - start;
    assert(Array.isArray(res.songs), 'Expected songs array');
    assert(res.songs.length > 0, 'Expected at least 1 song');
    const first = res.songs[0];
    assert(first.videoId, 'Expected videoId on song');
    assert(first.name.toLowerCase().includes('kesariya'), 'Expected track name to contain Kesariya');
    assert.strictEqual(first.provider, 'youtube_music');
    console.log(`     Latency: ${latency}ms | First match: "${first.name}" by ${first.artists}`);
  });

  await itAsync('Search caching returns sub-10ms response on second call', async () => {
    const start = Date.now();
    const res = await YouTubeMusicService.search('Kesariya', 10);
    const latency = Date.now() - start;
    assert(res.songs.length > 0);
    assert(latency < 10, `Expected cached latency < 10ms, got ${latency}ms`);
    console.log(`     Cached Latency: ${latency}ms`);
  });

  await itAsync('Search handles empty and special character queries gracefully', async () => {
    const emptyRes = await YouTubeMusicService.search('', 10);
    assert.strictEqual(emptyRes.songs.length, 0);
    const specialRes = await YouTubeMusicService.search('!@#$%^&*()', 5);
    assert(Array.isArray(specialRes.songs));
  });

  console.log('\n--- 3. Automix Radio Candidates ---');
  await itAsync('Retrieves automix radio candidates (RDAMVM...) for a seed videoId', async () => {
    const res = await YouTubeMusicService.getRadioCandidates('NJAv_7lHUIU', 'Kesariya', 'Arijit Singh', 20);
    assert(Array.isArray(res.candidates), 'Expected candidates array');
    assert(res.candidates.length >= 10, `Expected >= 10 candidates, got ${res.candidates.length}`);
    const sample = res.candidates.slice(0, 3).map(c => `${c.name} (${c.artists})`).join(', ');
    console.log(`     Found ${res.candidates.length} radio candidates. Sample: ${sample}`);
  });

  console.log('\n--- 4. Artist and Album Metadata ---');
  await itAsync('Retrieves artist discography for Arijit Singh', async () => {
    const res = await YouTubeMusicService.getArtist('UCDxKh1gFWeYsqePvgVzmPoQ', 'Arijit Singh');
    assert(res.artist, 'Expected artist object');
    assert.strictEqual(res.artist.name, 'Arijit Singh');
    assert(Array.isArray(res.artist.topSongs), 'Expected topSongs array');
    assert(res.artist.topSongs.length > 0, 'Expected > 0 topSongs');
  });

  console.log('\n--- 5. YouTube Playlist Browse & Import ---');
  await itAsync('Browses public YouTube playlist (Today\'s Top Hits)', async () => {
    const res = await YouTubeMusicService.getPlaylist('PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI');
    assert(res.playlist, 'Expected playlist object');
    assert(res.playlist.songs.length > 0, 'Expected > 0 tracks in playlist');
    console.log(`     Playlist "${res.playlist.name}": ${res.playlist.songs.length} tracks found`);
  });

  await itAsync('Import and match playlist pipeline returns matched and unmatched summary', async () => {
    const res = await YouTubeMusicService.importAndMatchPlaylist('PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI');
    assert(res.totalFound > 0, 'Expected totalFound > 0');
    assert(res.matchedCount >= 0, 'Expected matchedCount');
    assert(res.unmatchedCount >= 0, 'Expected unmatchedCount');
    assert.strictEqual(res.totalFound, res.matchedCount + res.unmatchedCount);
    console.log(`     Import Summary -> Found: ${res.totalFound} | Matched: ${res.matchedCount} | Unavailable: ${res.unmatchedCount}`);
  });

  console.log('\n======================================================================');
  console.log(`📊 YOUTUBE MUSIC PROVIDER RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('======================================================================\n');

  if (failedTests > 0) process.exit(1);
}

runTests();
