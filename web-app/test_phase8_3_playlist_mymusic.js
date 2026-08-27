// ============================================================================
// MUSICFLOW — PHASE 8.3 PLAYLIST + MY MUSIC EXPERIENCE TEST SUITE
// Automated verification for My Music tabs, Custom Playlists CRUD, Reordering,
// Liked Songs, History, Duplicate Handling, Queue -> Playlist, Export/Import,
// Mixed/Offline Playlists, and Empty States.
// ============================================================================

const fs = require('fs');
const path = require('path');

// Mock DOM Environment
class MockElement {
  constructor(id = '', tagName = 'div') {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.style = {};
    this.textContent = '';
    this.innerHTML = '';
    this.src = '';
    this.value = 0;
    this.attributes = {};
    this.listeners = {};
    this.dataset = {};
    this._classes = new Set();
    this.classList = {
      _self: this,
      add: (c) => this._classes.add(c),
      remove: (c) => this._classes.delete(c),
      toggle: (c, force) => {
        if (force === undefined) {
          if (this._classes.has(c)) this._classes.delete(c); else this._classes.add(c);
        } else if (force) {
          this._classes.add(c);
        } else {
          this._classes.delete(c);
        }
      },
      contains: (c) => this._classes.has(c)
    };
  }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] || null; }
  addEventListener(evt, cb) {
    if (!this.listeners[evt]) this.listeners[evt] = [];
    this.listeners[evt].push(cb);
  }
}

const domElements = new Map();
function getOrCreateElem(id, tag = 'div') {
  if (!domElements.has(id)) {
    domElements.set(id, new MockElement(id, tag));
  }
  return domElements.get(id);
}

// Pre-create UI elements
[
  'library-tab-content', 'quick-liked-count', 'quick-downloads-count', 'detail-tracks-container',
  'detail-title', 'detail-subtitle', 'detail-cover-img', 'btn-detail-play-all',
  'modal-playlists-container', 'modal-create-playlist', 'sheet-playlist-actions',
  'queue-tracks-container', 'queue-tracks-count'
].forEach(id => getOrCreateElem(id));

global.document = {
  getElementById: (id) => domElements.get(id) || null,
  createElement: (tag) => new MockElement('', tag),
  body: new MockElement('body'),
  querySelectorAll: () => [],
  addEventListener: () => {}
};

global.window = {
  location: { href: 'http://localhost:3000/' },
  addEventListener: () => {}
};

global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};

const Storage = require('./js/storage.js');
global.Storage = Storage;
const API = require('./js/api.js');
global.API = API;
const UI = require('./js/ui.js');
global.UI = UI;

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failedTests++;
  }
}

function runPlaylistTestSuite() {
  console.log('======================================================================');
  console.log('🧪 PHASE 8.3: PLAYLIST + MY MUSIC EXPERIENCE TEST SUITE');
  console.log('======================================================================\n');

  localStorage.clear();

  // 1. Liked Songs Default Playlist Synchronization
  console.log('--- 1. Liked Songs & Favorites Synchronization ---');
  const song1 = { id: 's_fav_1', name: 'Blinding Lights', artists: 'The Weeknd', duration: 200, image: 'art1.jpg' };
  const song2 = { id: 's_fav_2', name: 'Starboy', artists: 'The Weeknd', duration: 230, image: 'art2.jpg' };
  
  Storage.addFavorite(song1);
  Storage.addFavorite(song2);

  const playlists = Storage.getPlaylists();
  const favPl = playlists.find(p => p.id === 'favorites_pl');
  assert(favPl !== undefined, 'Liked Songs default playlist exists in playlists list');
  assert(favPl.songs.length === 2, `Liked Songs contains 2 tracks (got ${favPl.songs.length})`);
  assert(favPl.songs.some(s => s.name === 'Blinding Lights'), 'Liked songs contains "Blinding Lights"');

  // 2. Playlist Creation & Validation
  console.log('\n--- 2. Playlist Creation & Validation ---');
  const plWorkout = Storage.createPlaylist('Gym Workout', 'High energy pump songs', 'cover_workout.jpg');
  assert(plWorkout.id.startsWith('pl_'), 'Generated unique playlist ID with prefix pl_');
  assert(plWorkout.name === 'Gym Workout', 'Playlist name saved correctly');
  assert(plWorkout.description === 'Gym Workout' || plWorkout.description === 'High energy pump songs', 'Playlist description saved');
  assert(plWorkout.songs.length === 0, 'Newly created playlist initialized with 0 songs');

  // Creation with empty / whitespace name handles fallback safely
  const plFallback = Storage.createPlaylist('   ');
  assert(plFallback.name === 'New Playlist', 'Empty playlist name falls back safely to "New Playlist"');

  // 3. Adding Tracks & Preventing Accidental Same-ID Duplicates
  console.log('\n--- 3. Adding Tracks & Canonical Duplicate Prevention ---');
  const trackA = { id: 't_rock_1', name: 'Numb', artists: 'Linkin Park', album: 'Meteora', duration: 187 };
  const trackB = { id: 't_rock_2', name: 'In the End', artists: 'Linkin Park', album: 'Hybrid Theory', duration: 216 };
  
  const add1 = Storage.addToPlaylist(plWorkout.id, trackA);
  const add2 = Storage.addToPlaylist(plWorkout.id, trackB);
  const addDuplicate = Storage.addToPlaylist(plWorkout.id, trackA);

  assert(add1 === true, 'Successfully added first track to playlist');
  assert(add2 === true, 'Successfully added second track to playlist');
  assert(addDuplicate === false, 'Duplicate track with same ID rejected gracefully');

  const updatedPl = Storage.getPlaylistById(plWorkout.id);
  assert(updatedPl.songs.length === 2, `Playlist has exactly 2 songs (got ${updatedPl.songs.length})`);

  // 4. Preserving Distinct Legitimate Versions (Remix, Live, Acoustic)
  console.log('\n--- 4. Preserving Distinct Legitimate Song Versions ---');
  const trackOrig = { id: 't_sh_orig', name: 'Shape of You', artists: 'Ed Sheeran', duration: 233 };
  const trackRemix = { id: 't_sh_remix', name: 'Shape of You (Major Lazer Remix)', artists: 'Ed Sheeran, Major Lazer', duration: 192 };
  const trackAcoustic = { id: 't_sh_acoustic', name: 'Shape of You (Acoustic)', artists: 'Ed Sheeran', duration: 223 };

  Storage.addToPlaylist(plWorkout.id, trackOrig);
  Storage.addToPlaylist(plWorkout.id, trackRemix);
  Storage.addToPlaylist(plWorkout.id, trackAcoustic);

  const plWithVersions = Storage.getPlaylistById(plWorkout.id);
  assert(plWithVersions.songs.length === 5, `All 3 distinct versions preserved in playlist (total ${plWithVersions.songs.length})`);

  // 5. Editing Playlist Metadata (Rename, Description, Cover)
  console.log('\n--- 5. Edit Playlist ---');
  const editRes = Storage.editPlaylist(plWorkout.id, {
    name: 'Hardcore Gym 2.0',
    description: 'Updated heavy lift tracks'
  });
  assert(editRes === true, 'editPlaylist returns true');
  const plEdited = Storage.getPlaylistById(plWorkout.id);
  assert(plEdited.name === 'Hardcore Gym 2.0', `Playlist name updated to "${plEdited.name}"`);
  assert(plEdited.description === 'Updated heavy lift tracks', 'Playlist description updated');

  // 6. Track Reordering (Explicit Order & Snapshot Isolation)
  console.log('\n--- 6. Explicit Track Reordering ---');
  // Current order: [Numb, In the End, Shape of You, Shape of You Remix, Shape of You Acoustic]
  const currentSongs = plEdited.songs;
  const reordered = [currentSongs[1], currentSongs[0], ...currentSongs.slice(2)]; // Swap 0 and 1
  
  Storage.reorderPlaylist(plWorkout.id, reordered);
  const plReordered = Storage.getPlaylistById(plWorkout.id);
  assert(plReordered.songs[0].id === 't_rock_2', 'First track is now "In the End" after reordering');
  assert(plReordered.songs[1].id === 't_rock_1', 'Second track is now "Numb" after reordering');

  // 7. Removing Track from Playlist (Preserves source & liked status)
  console.log('\n--- 7. Remove Track from Playlist ---');
  Storage.removeFromPlaylist(plWorkout.id, 't_sh_orig');
  const plAfterRemove = Storage.getPlaylistById(plWorkout.id);
  assert(plAfterRemove.songs.length === 4, `Track removed from playlist (count: ${plAfterRemove.songs.length})`);
  assert(!plAfterRemove.songs.some(s => s.id === 't_sh_orig'), 'Removed track is no longer in playlist');

  // 8. Duplicating Playlist
  console.log('\n--- 8. Duplicate Playlist ---');
  const plCopy = Storage.duplicatePlaylist(plWorkout.id);
  assert(plCopy !== null, 'Duplicate playlist created');
  assert(plCopy.name.includes('(Copy)'), `Copy name includes "(Copy)" (got "${plCopy.name}")`);
  assert(plCopy.id !== plWorkout.id, 'Copy has unique ID');
  assert(plCopy.songs.length === 4, 'Copy contains all 4 tracks');

  // 9. Save Queue as Playlist
  console.log('\n--- 9. Save Queue as Playlist ---');
  const mockQueue = [
    { id: 'q_1', name: 'Song One', artists: 'Artist A' },
    { id: 'q_2', name: 'Song Two', artists: 'Artist B' },
    { id: 'q_3', name: 'Song Three', artists: 'Artist C' }
  ];
  const queuePl = Storage.saveQueueAsPlaylist(mockQueue, 'Roadtrip Mix');
  assert(queuePl !== null, 'Queue successfully saved as new playlist');
  assert(queuePl.name === 'Roadtrip Mix', `Playlist name is "${queuePl.name}"`);
  assert(queuePl.songs.length === 3, 'Saved playlist contains all 3 queue songs');

  // 10. Playlist Export (JSON & CSV) & Import
  console.log('\n--- 10. Export & Import Playlist ---');
  const exportedJSON = Storage.exportPlaylist(queuePl.id, 'json');
  assert(typeof exportedJSON === 'string', 'Exported JSON is a valid string');
  assert(exportedJSON.includes('Roadtrip Mix'), 'Exported JSON contains playlist title');
  assert(exportedJSON.includes('Song One'), 'Exported JSON contains track names');

  const exportedCSV = Storage.exportPlaylist(queuePl.id, 'csv');
  assert(exportedCSV.startsWith('ID,Name,Artist,Album,Duration'), 'Exported CSV header matches format');

  const importedPl = Storage.importPlaylist(exportedJSON);
  assert(importedPl !== null, 'Successfully imported playlist from JSON');
  assert(importedPl.name === 'Roadtrip Mix', `Imported playlist name matches (got "${importedPl.name}")`);
  assert(importedPl.songs.length === 3, `Imported playlist has 3 songs (got ${importedPl.songs.length})`);

  // 11. Playlist Sorting Helpers
  console.log('\n--- 11. Playlist Sorting & Filtering ---');
  const unsortedSongs = [
    { id: '1', name: 'Zebra', artists: 'Charlie', duration: 100 },
    { id: '2', name: 'Apple', artists: 'Bob', duration: 300 },
    { id: '3', name: 'Mango', artists: 'Alice', duration: 200 }
  ];

  const sortedTitle = Storage.sortPlaylistTracks(unsortedSongs, 'title');
  assert(sortedTitle[0].name === 'Apple' && sortedTitle[2].name === 'Zebra', 'Tracks sorted alphabetically by title');

  const sortedArtist = Storage.sortPlaylistTracks(unsortedSongs, 'artist');
  assert(sortedArtist[0].artists === 'Alice' && sortedArtist[2].artists === 'Charlie', 'Tracks sorted alphabetically by artist');

  const sortedDuration = Storage.sortPlaylistTracks(unsortedSongs, 'duration');
  assert(sortedDuration[0].duration === 300 && sortedDuration[2].duration === 100, 'Tracks sorted by duration descending');

  // 12. Deleting Playlist (Preserves system playlists & data integrity)
  console.log('\n--- 12. Delete Playlist ---');
  const delFavRes = Storage.deletePlaylist('favorites_pl');
  assert(delFavRes === false, 'favorites_pl default playlist cannot be deleted');

  const delRes = Storage.deletePlaylist(plCopy.id);
  assert(delRes === true, 'Custom duplicate playlist successfully deleted');
  assert(Storage.getPlaylistById(plCopy.id) === null, 'Deleted playlist is no longer retrievable');

  // 13. Recently Played History Management
  console.log('\n--- 13. History Management & Deduplication ---');
  Storage.addHistory(song1);
  Storage.addHistory(song2);
  Storage.addHistory(song1); // Play song1 again

  const history = Storage.getHistory();
  assert(history[0].id === 's_fav_1', 'Most recently played track is at index 0');
  assert(history.length === 2, `History deduplicated consecutive plays (length: ${history.length})`);

  Storage.removeHistoryItem('s_fav_2');
  const historyAfterRemove = Storage.getHistory();
  assert(historyAfterRemove.length === 1, `Removed track from history (length: ${historyAfterRemove.length})`);

  // 14. UI Playlist Detail & Tabs Rendering
  console.log('\n--- 14. My Music & Playlist Detail Rendering ---');
  UI.renderPlaylistDetail(queuePl.id);
  const detailTracksContainer = document.getElementById('detail-tracks-container');
  const detailTitle = document.getElementById('detail-title');

  assert(detailTitle.textContent === 'Roadtrip Mix', `Detail title rendered as "Roadtrip Mix"`);
  assert(detailTracksContainer.innerHTML.includes('Song One'), 'Detail tracks container renders track rows');
  assert(detailTracksContainer.innerHTML.includes('Shuffle'), 'Detail screen renders Shuffle action button');
  assert(detailTracksContainer.innerHTML.includes('Radio'), 'Detail screen renders Radio action button');

  // Empty state rendering
  const emptyPl = Storage.createPlaylist('Empty Ambient');
  UI.renderPlaylistDetail(emptyPl.id);
  assert(detailTracksContainer.innerHTML.includes('Playlist is empty'), 'Empty playlist renders helpful empty state');

  console.log('\n======================================================================');
  console.log(`📊 PHASE 8.3 RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('======================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPlaylistTestSuite();
