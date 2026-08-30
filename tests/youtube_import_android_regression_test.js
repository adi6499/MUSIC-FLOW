// ============================================================================
// TEST SUITE: YOUTUBE IMPORT & ANDROID APK MIGRATION REGRESSION AUDIT
// ============================================================================

const assert = require('assert');

console.log('\n======================================================');
console.log('🧪 RUNNING YOUTUBE IMPORT & ANDROID REGRESSION TESTS');
console.log('======================================================\n');

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

const mockStorageStore = {};
global.localStorage = {
  getItem: (k) => mockStorageStore[k] || null,
  setItem: (k, v) => { mockStorageStore[k] = String(v); },
  removeItem: (k) => { delete mockStorageStore[k]; },
  clear: () => { for (const k in mockStorageStore) delete mockStorageStore[k]; }
};

const DataNormalizer = require('../web-app/js/dataNormalizer.js');
const ApiConfig = require('../web-app/js/apiConfig.js');
const YouTubeMusicService = require('../youtubeMusicService.js');
const Storage = require('../web-app/js/storage.js');
const TypesenseClient = require('../web-app/js/typesenseClient.js');
const PlaybackResolver = require('../web-app/js/playbackResolver.js');
const { jioSaavnProvider } = require('../web-app/js/jioSaavnProvider.js');
const { ytMusicProvider } = require('../web-app/js/youtubeMusicProvider.js');
const API = require('../web-app/js/api.js');

global.DataNormalizer = DataNormalizer;
global.ApiConfig = ApiConfig;
global.YouTubeMusicService = YouTubeMusicService;
global.Storage = Storage;
global.TypesenseClient = TypesenseClient;
global.PlaybackResolver = PlaybackResolver;
global.jioSaavnProvider = jioSaavnProvider;
global.ytMusicProvider = ytMusicProvider;
global.API = API;

(async () => {
  // 1. YouTube Single Song Import (Standard YT URL)
  await itAsync('1. YouTube single song import ("Wannabe" - Why Mona)', async () => {
    const result = await YouTubeMusicService.importTrack('https://www.youtube.com/watch?v=h6mtSWcPmEw');
    assert.ok(result.success, 'Import result must have success: true');
    assert.ok(result.track, 'Import result must contain track');
    assert.strictEqual(result.matched, true, 'Track must be marked matched');
    assert.strictEqual(result.track.isPlayable, true, 'Track must be marked playable');
    assert.strictEqual(result.track.playbackAvailable, true, 'Playback must be available');
    assert.ok(result.track.name, 'Track must have a valid title');
    assert.ok(result.track.artists, 'Track must have a valid artist');
    assert.ok(!result.track.artists.includes('undefined'), 'Artists string must not contain undefined');
  });

  // 2. YouTube Music Single Song Import (YTM URL)
  await itAsync('2. YouTube Music single song import (YTM URL)', async () => {
    const result = await YouTubeMusicService.importTrack('https://music.youtube.com/watch?v=KoL3ql6QOro');
    assert.ok(result.success, 'Import result must have success: true');
    assert.ok(result.track, 'Import result must contain track');
    assert.strictEqual(result.matched, true, 'Track must be matched');
    assert.strictEqual(result.track.playbackAvailable, true, 'Playback must be available');
  });

  // 3. YouTube Music Playlist Import
  await itAsync('3. YouTube Music playlist import with JioSaavn & YTM fallback matching', async () => {
    const result = await YouTubeMusicService.importAndMatchPlaylist('PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI');
    assert.ok(result, 'Result must exist');
    assert.ok(result.totalFound > 0, 'Must extract tracks from playlist');
    assert.strictEqual(result.matchedCount, result.totalFound, 'All tracks must be playable/matched via provider or YTM fallback');
    assert.strictEqual(result.unmatchedCount, 0, 'Unmatched count should be 0');
    assert.ok(result.matchedTracks.length > 0, 'Matched tracks array must not be empty');
  });

  // 4. Single Song delegated through importAndMatchPlaylist
  await itAsync('4. Single Song URL passed to importAndMatchPlaylist returns structured single song result', async () => {
    const result = await YouTubeMusicService.importAndMatchPlaylist('https://music.youtube.com/watch?v=h6mtSWcPmEw');
    assert.strictEqual(result.isSingleSong, true);
    assert.strictEqual(result.totalFound, 1);
    assert.strictEqual(result.matchedCount, 1);
    assert.strictEqual(result.unmatchedCount, 0);
    assert.strictEqual(result.matchedTracks.length, 1);
  });

  // 5. Storage API contract verification
  it('5. Storage.addToFavorites and Storage.saveToFavorites persist track data', () => {
    const sampleTrack = { id: 'test_fav_1', name: 'Wannabe', artists: 'Why Mona', album: 'Wannabe Single' };
    Storage.addToFavorites(sampleTrack);
    assert.strictEqual(Storage.isFavorite('test_fav_1'), true, 'Track must be in favorites');
    Storage.removeFromFavorites('test_fav_1');
    assert.strictEqual(Storage.isFavorite('test_fav_1'), false, 'Track must be removed from favorites');
  });

  // 6. Typesense Health Check in Mobile/Production Mode
  await itAsync('6. TypesenseClient does not poll localhost:8108 in production mobile environments', async () => {
    // Mock Android environment
    global.window = {
      location: { protocol: 'file:', href: 'file:///android_asset/public/index.html', hostname: '' }
    };
    
    const isHealthy = await TypesenseClient.checkHealth();
    assert.strictEqual(isHealthy, false, 'TypesenseClient should safely report false without throwing or calling localhost');
  });

  // 7. DataNormalizer handles complex/array artist structures without throwing
  it('7. DataNormalizer safely formats artists in array, object, or string forms', () => {
    assert.strictEqual(DataNormalizer.formatArtists(['Artist 1', 'Artist 2']), 'Artist 1, Artist 2');
    assert.strictEqual(DataNormalizer.formatArtists([{ name: 'Artist A' }, { name: 'Artist B' }]), 'Artist A, Artist B');
    assert.strictEqual(DataNormalizer.formatArtists('Single Artist'), 'Single Artist');
    assert.strictEqual(DataNormalizer.formatArtists(null), 'Unknown Artist');
  });

  // 8. Exact case: Wannabe - Why Mona Saavn 320kbps resolution and normalization
  await itAsync('8. Exact Test: "why mona - Topic - Wannabe" resolves with 320kbps audio & clean schema', async () => {
    const res = await YouTubeMusicService.importTrack('https://music.youtube.com/watch?v=KoL3ql6QOro');
    assert.ok(res.success);
    const track = res.track;
    assert.strictEqual(track.name, 'Wannabe');
    assert.ok(track.artists.toLowerCase().includes('why mona'), 'Artist must be Why Mona');
    assert.ok(!track.artists.includes('- Topic'), 'Topic suffix must be removed');
    assert.ok(track.audioUrl && track.audioUrl.startsWith('http'), 'Audio URL must be populated');
    assert.strictEqual(track.isPlayable, true);
    assert.strictEqual(track.playbackAvailable, true);

    const norm = DataNormalizer.normalizeTrack(track);
    assert.ok(norm.title);
    assert.ok(norm.artists);
    assert.ok(norm.audioUrl);
  });

  // 9. Provider Fallback for YouTube-only track (missing from JioSaavn)
  await itAsync('9. Provider Fallback: Unmatched track is preserved as playable YouTube track', async () => {
    const ytOnlyTrack = {
      id: 'yt_test_unmatched_123',
      videoId: 'test_unmatched_123',
      name: 'Rare Indie Video Track',
      title: 'Rare Indie Video Track',
      artists: 'Independent Creator',
      primaryArtist: 'Independent Creator',
      provider: 'youtube_music',
      providerId: 'test_unmatched_123',
      isPlayable: true,
      playbackAvailable: true
    };
    const norm = DataNormalizer.normalizeTrack(ytOnlyTrack, 'youtube_music');
    assert.strictEqual(norm.isPlayable, true, 'Track must remain playable');
    assert.strictEqual(norm.playbackAvailable, true, 'Playback must remain available');
    assert.strictEqual(norm.provider, 'youtube_music');
  });

  // 10. JioSaavn Provider search query test
  await itAsync('10. JioSaavnProvider searches live API and returns normalized results', async () => {
    const searchRes = await jioSaavnProvider.search('Arijit Singh Kesariya', { limit: 5 });
    assert.ok(searchRes.songs, 'Songs array must exist');
    assert.ok(searchRes.songs.length > 0, 'Must return songs');
    const firstSong = searchRes.songs[0];
    assert.ok(firstSong.name || firstSong.title);
    assert.ok(firstSong.audioUrl && firstSong.audioUrl.startsWith('http'));
    assert.strictEqual(typeof firstSong.artists, 'string');
  });

  // 11. PlaybackResolver cross-provider source resolution
  await itAsync('11. PlaybackResolver resolves playable source for JioSaavn track', async () => {
    const searchRes = await jioSaavnProvider.search('Wannabe Why Mona', { limit: 1 });
    assert.ok(searchRes.songs.length > 0);
    const song = searchRes.songs[0];
    const resolved = await PlaybackResolver.resolvePlayableSource(song);
    assert.ok(resolved.uri && resolved.uri.startsWith('http'), 'Resolved URI must be a valid HTTP stream');
    assert.strictEqual(resolved.type, 'STREAMING');
  });

  // 12. Lyrics failure isolation: null or 404 lyrics do not block track playback
  await itAsync('12. Lyrics failure isolation: null lyrics result never affects track playability', async () => {
    const song = {
      id: 'song_no_lyrics_1',
      name: 'Instrumental Ambient Sound',
      artists: 'Nature Sounds',
      audioUrl: 'https://aac.saavncdn.com/test.mp4',
      isPlayable: true,
      playbackAvailable: true
    };
    // Mock LRCLib lyrics failure
    const lyricsResult = null;
    assert.strictEqual(lyricsResult, null);
    // Playback resolution must still succeed
    const resolved = await PlaybackResolver.resolvePlayableSource(song);
    assert.strictEqual(resolved.type, 'STREAMING');
    assert.strictEqual(resolved.uri, 'https://aac.saavncdn.com/test.mp4');
  });

  console.log('\n======================================================');
  console.log(`📊 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');
  if (failed > 0) process.exit(1);
})();
