// ============================================================================
// MUSICFLOW — PHASE 4 LOCAL MUSIC & OFFLINE ENGINE UNIT TESTS
// ============================================================================

const fs = require('fs');
const path = require('path');

// Mock localStorage & IndexedDB for Node environment
const storageData = {};
global.localStorage = {
  getItem: (key) => storageData[key] || null,
  setItem: (key, val) => { storageData[key] = String(val); },
  removeItem: (key) => { delete storageData[key]; },
  clear: () => { Object.keys(storageData).forEach(k => delete storageData[k]); }
};

// Mock IndexedDbStorage in-memory
const inMemoryIdb = {
  downloaded_audio: new Map(),
  local_tracks: new Map(),
  download_tasks: new Map()
};

global.IndexedDbStorage = {
  saveDownloadedAudio: async (id, blob, meta = {}) => {
    inMemoryIdb.downloaded_audio.set(String(id), { id, blob, size: blob?.length || 1024 * 1024 * 8, ...meta });
    return true;
  },
  getDownloadedAudio: async (id) => inMemoryIdb.downloaded_audio.get(String(id)) || null,
  getDownloadedAudioUrl: async (id) => inMemoryIdb.downloaded_audio.has(String(id)) ? `blob:local-audio-${id}` : null,
  deleteDownloadedAudio: async (id) => inMemoryIdb.downloaded_audio.delete(String(id)),
  clearAllDownloadedAudio: async () => inMemoryIdb.downloaded_audio.clear(),
  saveLocalTrack: async (track, blob) => {
    inMemoryIdb.local_tracks.set(String(track.id), { ...track, blob });
    return track;
  },
  getAllLocalTracks: async () => Array.from(inMemoryIdb.local_tracks.values()),
  removeLocalTrack: async (id) => inMemoryIdb.local_tracks.delete(String(id)),
  clearAllLocalTracks: async () => inMemoryIdb.local_tracks.clear(),
  getStorageBreakdown: async () => ({
    totalBytes: 8500000,
    totalMb: '8.1',
    downloadedCount: inMemoryIdb.downloaded_audio.size,
    localCount: inMemoryIdb.local_tracks.size
  })
};

// Load modules
const id3Code = fs.readFileSync(path.join(__dirname, 'js', 'id3Parser.js'), 'utf8');
const idbCode = fs.readFileSync(path.join(__dirname, 'js', 'indexedDbStorage.js'), 'utf8');
const qnCode = fs.readFileSync(path.join(__dirname, 'js', 'queryNormalizer.js'), 'utf8');
const ssCode = fs.readFileSync(path.join(__dirname, 'js', 'stringSimilarity.js'), 'utf8');
const tdCode = fs.readFileSync(path.join(__dirname, 'js', 'trackDeduplicator.js'), 'utf8');
const seCode = fs.readFileSync(path.join(__dirname, 'js', 'searchEngine.js'), 'utf8');
const stCode = fs.readFileSync(path.join(__dirname, 'js', 'storage.js'), 'utf8');

global.ID3Parser = eval(id3Code + '\nID3Parser;');
global.QueryNormalizer = eval(qnCode + '\nQueryNormalizer;');
global.StringSimilarity = eval(ssCode + '\nStringSimilarity;');
global.TrackDeduplicator = eval(tdCode + '\nTrackDeduplicator;');
global.SearchEngine = eval(seCode + '\nSearchEngine;');
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
console.log('🧪 PHASE 4: LOCAL MUSIC + OFFLINE ENGINE AUTOMATED TEST SUITE');
console.log('======================================================================\n');

// 1. ID3 Parser & Format Discovery
console.log('--- 1. ID3 Parser & Formats ---');
assert(ID3Parser.extractFormat('song.mp3') === 'mp3', 'extractFormat identifies mp3');
assert(ID3Parser.extractFormat('track.FLAC') === 'flac', 'extractFormat identifies flac');
assert(ID3Parser.extractFormat('audio.opus') === 'opus', 'extractFormat identifies opus');
assert(ID3Parser.extractFormat('music.m4a') === 'm4a', 'extractFormat identifies m4a');
assert(ID3Parser.fallbackTitleFromFilename('01 - Blinding Lights.mp3') === 'Blinding Lights', 'fallbackTitle strips track numbers and extension');
assert(ID3Parser.fallbackArtistFromFilename('The Weeknd - Blinding Lights.mp3') === 'The Weeknd', 'fallbackArtist extracts artist before dash');

// Test synthetic ID3 tag parsing
const syntheticTagBuffer = Buffer.alloc(128);
syntheticTagBuffer.write('TAG', 0, 3);
syntheticTagBuffer.write('Starboy', 3, 30);
syntheticTagBuffer.write('The Weeknd', 33, 30);
syntheticTagBuffer.write('Starboy Album', 63, 30);
syntheticTagBuffer.write('2016', 93, 4);

(async () => {
  const parsedTag = await ID3Parser.parse(syntheticTagBuffer.buffer);
  assert(parsedTag.title === 'Starboy', 'ID3v1 parsed title correctly');
  assert(parsedTag.artist === 'The Weeknd', 'ID3v1 parsed artist correctly');
  assert(parsedTag.album === 'Starboy Album', 'ID3v1 parsed album correctly');
  assert(parsedTag.year === '2016', 'ID3v1 parsed year correctly');

  // 2. Local Music Storage & Grouping
  console.log('\n--- 2. Local Music Storage & Grouping ---');
  Storage.clearAllLocalSongs();
  assert(Storage.getLocalSongs().length === 0, 'Local songs empty after clear');

  const local1 = Storage.saveLocalSong({
    name: 'Midnight City',
    artists: 'M83',
    album: 'Hurry Up, We\'re Dreaming',
    albumArtist: 'M83',
    folderName: 'Synthwave',
    year: '2011'
  });
  assert(local1.source === 'LOCAL', 'Local track has source: LOCAL');
  assert(Storage.getLocalSongs().length === 1, 'Local songs count is 1');

  const local2 = Storage.saveLocalSong({
    name: 'Reunion',
    artists: 'M83',
    album: 'Hurry Up, We\'re Dreaming',
    albumArtist: 'M83',
    folderName: 'Synthwave',
    year: '2011'
  });

  const local3 = Storage.saveLocalSong({
    name: 'Resonance',
    artists: 'HOME',
    album: 'Odyssey',
    albumArtist: 'HOME',
    folderName: 'Chillwave',
    year: '2014'
  });

  // Test Albums Grouping
  const albums = Storage.getLocalAlbums();
  assert(albums.length === 2, 'getLocalAlbums groups into 2 unique albums');
  const m83Album = albums.find(a => a.name === 'Hurry Up, We\'re Dreaming');
  assert(m83Album && m83Album.songCount === 2, 'M83 album contains 2 grouped tracks');

  // Test Artists Grouping
  const artists = Storage.getLocalArtists();
  assert(artists.length === 2, 'getLocalArtists groups into 2 unique artists (M83, HOME)');

  // Test Folders Grouping
  const folders = Storage.getLocalFolders();
  assert(folders.length === 2, 'getLocalFolders groups into 2 unique folders (Synthwave, Chillwave)');
  const synthFolder = folders.find(f => f.name === 'Synthwave');
  assert(synthFolder && synthFolder.songCount === 2, 'Synthwave folder has 2 tracks');

  // 3. Downloads & Deduplication
  console.log('\n--- 3. Downloads & Deduplication ---');
  await Storage.clearAllDownloads();
  const onlineSong = { id: 's_weeknd_1', name: 'Blinding Lights', artists: 'The Weeknd', album: 'After Hours' };
  assert(Storage.isDownloaded('s_weeknd_1') === false, 'Song not downloaded initially');
  Storage.addDownload(onlineSong);
  assert(Storage.isDownloaded('s_weeknd_1') === true, 'isDownloaded returns true');
  assert(Storage.getDownloads().length === 1, 'Downloads count is 1');

  // Duplicate add should not duplicate
  Storage.addDownload(onlineSong);
  assert(Storage.getDownloads().length === 1, 'Duplicate download prevented');

  // 4. Combined Offline Catalog & Offline Search
  console.log('\n--- 4. Combined Offline Catalog & Offline Search ---');
  const offlineCatalog = Storage.getOfflineCatalog();
  assert(offlineCatalog.length === 4, 'Combined offline catalog has 1 downloaded + 3 local tracks');

  // Offline Search for "M83"
  const search1 = SearchEngine.searchOffline('M83');
  assert(search1.songs.length >= 2, 'searchOffline finds M83 local songs');
  assert(search1.artists.some(a => a.name === 'M83'), 'searchOffline returns M83 artist');

  // Offline Search for "Blinding Lights" (Downloaded)
  const search2 = SearchEngine.searchOffline('Blinding Lights');
  assert(search2.songs.length >= 1 && search2.songs[0].id === 's_weeknd_1', 'searchOffline finds downloaded track');

  // 5. Storage Breakdown
  console.log('\n--- 5. Storage Usage Breakdown ---');
  const usage = Storage.getStorageUsage();
  assert(usage.count === 1, 'Usage downloaded count accurate');
  assert(Number(usage.mb) > 0, 'Usage MB calculated');

  console.log('\n======================================================================');
  console.log(`📊 PHASE 4 TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('======================================================================');

  if (testsFailed > 0) process.exit(1);
})();
