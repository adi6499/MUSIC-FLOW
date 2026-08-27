// ============================================================================
// MUSICFLOW — PHASE 3 LIBRARY 2.0 AUTOMATED UNIT TESTS
// ============================================================================

const fs = require('fs');
const path = require('path');

// Mock localStorage for Node environment
const storageData = {};
global.localStorage = {
  getItem: (key) => storageData[key] || null,
  setItem: (key, val) => { storageData[key] = String(val); },
  removeItem: (key) => { delete storageData[key]; },
  clear: () => { Object.keys(storageData).forEach(k => delete storageData[k]); }
};

// Evaluate Storage module
const storageCode = fs.readFileSync(path.join(__dirname, 'js', 'storage.js'), 'utf8');
global.Storage = eval(storageCode + '\nStorage;');

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
console.log('🧪 TESTING MUSICFLOW LIBRARY 2.0 STORAGE & METHODS');
console.log('======================================================================\n');

// 1. Liked Songs / Favorites
console.log('--- 1. Liked Songs / Favorites ---');
const testSong = { id: 's101', name: 'Kesariya', artists: 'Arijit Singh', image: 'art.jpg' };
assert(Storage.getFavorites().length === 0, 'Initial favorites empty');
assert(Storage.isFavorite('s101') === false, 'Song not favorite initially');
const isFav = Storage.toggleFavorite(testSong);
assert(isFav === true, 'toggleFavorite returns true on add');
assert(Storage.isFavorite('s101') === true, 'isFavorite returns true after add');
assert(Storage.getFavorites().length === 1, 'Favorites has 1 song');
const isUnfav = Storage.toggleFavorite(testSong);
assert(isUnfav === false, 'toggleFavorite returns false on remove');
assert(Storage.isFavorite('s101') === false, 'isFavorite returns false after remove');
Storage.toggleFavorite(testSong);

// 2. Playlists CRUD & Reordering
console.log('\n--- 2. Playlists CRUD & Reordering ---');
const pl = Storage.createPlaylist('Late Night Vibes', 'Chill acoustic tracks');
assert(pl.name === 'Late Night Vibes', 'Playlist created with correct name');
assert(pl.description === 'Chill acoustic tracks', 'Playlist created with correct description');
assert(Storage.getPlaylists().length === 2, 'Playlists contains Liked Songs default + new custom playlist');

Storage.addToPlaylist(pl.id, testSong);
const updatedPl = Storage.getPlaylists().find(p => p.id === pl.id);
assert(updatedPl.songs.length === 1, 'addToPlaylist adds song');
assert(updatedPl.songs[0].name === 'Kesariya', 'Song in playlist has correct title');

const testSong2 = { id: 's102', name: 'Tum Hi Ho', artists: 'Arijit Singh', image: 'art2.jpg' };
Storage.addToPlaylist(pl.id, testSong2);
assert(Storage.getPlaylists().find(p => p.id === pl.id).songs.length === 2, 'Added second song');

// Test Reordering
Storage.reorderPlaylist(pl.id, [testSong2, testSong]);
const reordered = Storage.getPlaylists().find(p => p.id === pl.id);
assert(reordered.songs[0].id === 's102' && reordered.songs[1].id === 's101', 'reorderPlaylist persists custom song order');

// Test Duplicate
const dup = Storage.duplicatePlaylist(pl.id);
assert(dup.name === 'Late Night Vibes (Copy)', 'duplicatePlaylist creates copy');
assert(dup.songs.length === 2, 'duplicated playlist has same songs');

// Test Edit
Storage.editPlaylist(pl.id, { name: 'Late Night Vibes 2026', description: 'Updated desc' });
const edited = Storage.getPlaylists().find(p => p.id === pl.id);
assert(edited.name === 'Late Night Vibes 2026', 'editPlaylist updates name');

// Test Remove Song
Storage.removeFromPlaylist(pl.id, 's102');
assert(Storage.getPlaylists().find(p => p.id === pl.id).songs.length === 1, 'removeFromPlaylist removes single song');

// Test Delete Playlist
Storage.deletePlaylist(dup.id);
assert(Storage.getPlaylists().find(p => p.id === dup.id) === undefined, 'deletePlaylist removes playlist');

// 3. Saved Albums Library
console.log('\n--- 3. Saved Albums Library ---');
const testAlbum = { id: 'alb_1', name: 'Aashiqui 2', artist: 'Mithoon, Ankit Tiwari, Jeet Gannguli', year: '2013', image: 'alb.jpg' };
assert(Storage.getSavedAlbums().length === 0, 'Saved albums empty initially');
Storage.saveAlbum(testAlbum);
assert(Storage.isAlbumSaved('alb_1') === true, 'isAlbumSaved returns true');
assert(Storage.getSavedAlbums().length === 1, 'getSavedAlbums returns 1 album');
Storage.removeSavedAlbum('alb_1');
assert(Storage.isAlbumSaved('alb_1') === false, 'removeSavedAlbum removes album');

// 4. Followed Artists Library
console.log('\n--- 4. Followed Artists Library ---');
const testArtist = { id: 'art_1', name: 'Arijit Singh', image: 'arijit.jpg' };
assert(Storage.getFollowedArtists().length === 0, 'Followed artists empty initially');
Storage.followArtist(testArtist);
assert(Storage.isArtistFollowed('Arijit Singh') === true, 'isArtistFollowed returns true by name');
assert(Storage.isArtistFollowed('art_1') === true, 'isArtistFollowed returns true by id');
Storage.unfollowArtist('art_1');
assert(Storage.isArtistFollowed('art_1') === false, 'unfollowArtist removes artist');

// 5. Listening History
console.log('\n--- 5. Listening History ---');
Storage.addToHistory(testSong);
Storage.addToHistory(testSong2);
assert(Storage.getHistory().length === 2, 'addToHistory records tracks');
assert(Storage.getHistory()[0].id === 's102', 'Most recent song is first');
Storage.removeHistoryItem('s102');
assert(Storage.getHistory().length === 1, 'removeHistoryItem removes specific track');
Storage.clearHistory();
assert(Storage.getHistory().length === 0, 'clearHistory resets history array');

// 6. Downloads & Storage Calculation
console.log('\n--- 6. Downloads & Storage Calculation ---');
assert(Storage.getDownloads().length === 0, 'Downloads empty initially');
Storage.addDownload(testSong);
Storage.addDownload(testSong2);
assert(Storage.isDownloaded('s101') === true, 'isDownloaded returns true');
assert(Storage.getDownloads().length === 2, 'addDownload adds songs');
const storageInfo = Storage.getStorageUsage();
assert(storageInfo.count === 2, 'getStorageUsage returns correct count');
assert(Number(storageInfo.mb) > 0, 'getStorageUsage returns estimated MB');
Storage.removeDownload('s101');
assert(Storage.getDownloads().length === 1, 'removeDownload deletes song');

console.log('\n======================================================================');
console.log(`📊 TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
console.log('======================================================================');

if (testsFailed > 0) process.exit(1);
