// ============================================================================
// TEST SUITE: IMPORT, SEARCH, STORAGE & PLAYBACK STABILITY TESTS
// ============================================================================

const assert = require('assert');
const fs = require('fs');

console.log('\n======================================================');
console.log('🧪 RUNNING IMPORT, SEARCH & STORAGE STABILITY TESTS');
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

// Mock DOM & Storage environment
global.window = {
  location: { protocol: 'http:', hostname: 'localhost', origin: 'http://localhost:3001' }
};

const memoryStorage = {};
global.localStorage = {
  getItem: (k) => memoryStorage[k] || null,
  setItem: (k, v) => { memoryStorage[k] = String(v); },
  removeItem: (k) => { delete memoryStorage[k]; },
  clear: () => { Object.keys(memoryStorage).forEach(k => delete memoryStorage[k]); }
};

global.document = {
  getElementById: () => ({ innerHTML: '', textContent: '', style: {}, classList: { add: () => {}, remove: () => {} } }),
  querySelectorAll: () => [],
  documentElement: { style: { setProperty: () => {} } }
};

const Storage = require('../web-app/js/storage.js');
const DataNormalizer = require('../web-app/js/dataNormalizer.js');
const UI = require('../web-app/js/ui.js');
const YouTubeMusicService = require('../youtubeMusicService.js');

it('1. Storage.addToFavorites and Storage.addFavorite exist and save tracks', () => {
  assert.strictEqual(typeof Storage.addFavorite, 'function', 'addFavorite must be a function');
  assert.strictEqual(typeof Storage.addToFavorites, 'function', 'addToFavorites alias must be a function');
  
  const sampleTrack = { id: 'test_song_1', name: 'Test Song', artists: 'Test Artist', image: 'test.jpg' };
  Storage.addToFavorites(sampleTrack);
  
  const favs = Storage.getFavorites();
  assert.strictEqual(favs.length, 1, 'Favorite count must be 1');
  assert.strictEqual(favs[0].id, 'test_song_1', 'Saved track ID must match');
  assert.strictEqual(Storage.isFavorite('test_song_1'), true, 'isFavorite must return true');
});

it('2. Storage API exposes all required client helpers and aliases', () => {
  assert.strictEqual(typeof Storage.getStreamingQuality, 'function', 'getStreamingQuality must be defined');
  assert.strictEqual(typeof Storage.isPerformanceMode, 'function', 'isPerformanceMode must be defined');
  assert.strictEqual(typeof Storage.getAutoCleanupDays, 'function', 'getAutoCleanupDays must be defined');
  assert.strictEqual(typeof Storage.getStorageLimitMb, 'function', 'getStorageLimitMb must be defined');
  assert.strictEqual(typeof Storage.getItem, 'function', 'getItem must be defined');
  assert.strictEqual(typeof Storage.setItem, 'function', 'setItem must be defined');
  assert.strictEqual(typeof Storage.removeItem, 'function', 'removeItem must be defined');
  assert.strictEqual(typeof Storage.saveDownloadedAudio, 'function', 'saveDownloadedAudio must be defined');
  assert.strictEqual(typeof Storage.saveAudioBlob, 'function', 'saveAudioBlob must be defined');
  assert.strictEqual(typeof Storage.getDownloadedAudio, 'function', 'getDownloadedAudio must be defined');
  assert.strictEqual(typeof Storage.getAudioBlob, 'function', 'getAudioBlob must be defined');
  assert.strictEqual(typeof Storage.deleteDownloadedAudio, 'function', 'deleteDownloadedAudio must be defined');
  assert.strictEqual(typeof Storage.deleteAudioBlob, 'function', 'deleteAudioBlob must be defined');
  assert.strictEqual(typeof Storage.clearAllDownloadedAudio, 'function', 'clearAllDownloadedAudio must be defined');
  assert.strictEqual(typeof Storage.clearAllAudioBlobs, 'function', 'clearAllAudioBlobs must be defined');
});

it('3. UI album rendering handles array and object artist structures without .replace crash', () => {
  // Test case: album with array artists
  const albumWithArrayArtists = {
    id: 'alb_1',
    title: "DJ SXD's Special Album",
    artists: ['DJ SXD', 'MC Menor'],
    image: 'cover.jpg'
  };

  // Test case: album with object artist
  const albumWithObjectArtist = {
    id: 'alb_2',
    title: 'Phonk Comp 2024',
    artists: { id: 'art_1', name: 'Brazilian Phonk Collective' },
    image: 'cover2.jpg'
  };

  assert.doesNotThrow(() => {
    UI.renderSearchResults({
      songs: [],
      albums: [albumWithArrayArtists, albumWithObjectArtist],
      artists: [],
      playlists: []
    }, 'All');
  }, 'renderSearchResults must not throw TypeError on complex artist structures');
});

it('4. DataNormalizer safely formats complex and exotic artist values', () => {
  const norm1 = DataNormalizer.getArtistString({ artists: ['Artist A', 'Artist B'] });
  assert.strictEqual(norm1, 'Artist A, Artist B');

  const norm2 = DataNormalizer.getArtistString({ artists: { name: 'Solo Producer' } });
  assert.strictEqual(norm2, 'Solo Producer');

  const norm3 = DataNormalizer.getArtistString({ primaryArtist: 'Lead Singer' });
  assert.strictEqual(norm3, 'Lead Singer');
});

it('5. YouTubeMusicService.importTrack guarantees matched = true for valid YouTube single tracks', async () => {
  const sampleUrl = 'https://music.youtube.com/watch?v=EV5982RVl6w';
  const res = await YouTubeMusicService.importTrack(sampleUrl);
  assert.strictEqual(res.success, true, 'Import track response must be successful');
  assert.strictEqual(res.matched, true, 'Track must be matched and marked available');
  assert.ok(res.track.id.startsWith('yt_') || res.track.providerId, 'Must have valid ID');
  assert.strictEqual(res.track.playbackAvailable, true, 'Track must be marked playable');
});

it('6. YouTubeMusicService.importAndMatchPlaylist single song delegate marks 1 found, 1 matched, 0 unmatched', async () => {
  const sampleUrl = 'https://youtu.be/EV5982RVl6w';
  const res = await YouTubeMusicService.importAndMatchPlaylist(sampleUrl);
  assert.strictEqual(res.type, 'song', 'Type must be song');
  assert.strictEqual(res.isSingleSong, true, 'isSingleSong must be true');
  assert.strictEqual(res.totalFound, 1, 'Total found must be 1');
  assert.strictEqual(res.matchedCount, 1, 'Matched count must be 1');
  assert.strictEqual(res.unmatchedCount, 0, 'Unmatched count must be 0');
  assert.strictEqual(res.matchedTracks.length, 1, 'matchedTracks length must be 1');
});

(async () => {
  console.log('\n======================================================');
  console.log(`📊 STABILITY TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');
  if (failed > 0) process.exit(1);
})();
