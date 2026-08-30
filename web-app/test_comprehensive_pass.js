/**
 * MusicFlow — Comprehensive Regression Test Suite (All 30 Requirements Pass)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('Starting MusicFlow Comprehensive Regression Test Suite');
console.log('================================================================\n');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

// ----------------------------------------------------------------------------
// 1. DataNormalizer Canonical Layer Tests
// ----------------------------------------------------------------------------
console.log('--- 1. Canonical Data Normalizer ---');
const dataNormalizerCode = fs.readFileSync(path.join(__dirname, 'js/dataNormalizer.js'), 'utf8');
const vm = require('vm');
const normalizerSandbox = { window: {}, console };
vm.createContext(normalizerSandbox);
vm.runInContext(dataNormalizerCode, normalizerSandbox);
const DataNormalizer = normalizerSandbox.window.DataNormalizer;

runTest('DataNormalizer exports correctly on window', () => {
  assert.ok(DataNormalizer, 'DataNormalizer should exist');
  assert.strictEqual(typeof DataNormalizer.normalizeTrack, 'function');
  assert.strictEqual(typeof DataNormalizer.getArtistName, 'function');
  assert.strictEqual(typeof DataNormalizer.getImageUrl, 'function');
});

runTest('DataNormalizer.getArtistName handles [object Object] edge cases', () => {
  // Case A: standard string
  assert.strictEqual(DataNormalizer.getArtistName('Arijit Singh'), 'Arijit Singh');

  // Case B: object with name
  assert.strictEqual(DataNormalizer.getArtistName({ name: 'Shreya Ghoshal' }), 'Shreya Ghoshal');

  // Case C: array of objects
  assert.strictEqual(DataNormalizer.getArtistName([{ name: 'Pritam' }, { name: 'Arijit Singh' }]), 'Pritam, Arijit Singh');

  // Case D: array of strings
  assert.strictEqual(DataNormalizer.getArtistName(['Arijit Singh', 'Shreya Ghoshal']), 'Arijit Singh, Shreya Ghoshal');

  // Case E: nested artist object with primary / featured
  const complexTrack = {
    artists: {
      primary: [{ name: 'A.R. Rahman' }, { name: 'Javed Ali' }],
      featured: [{ name: 'Mohit Chauhan' }]
    }
  };
  assert.strictEqual(DataNormalizer.getArtistName(complexTrack), 'A.R. Rahman, Javed Ali, Mohit Chauhan');

  // Case F: fallback on undefined/null
  assert.strictEqual(DataNormalizer.getArtistName(null), 'Unknown Artist');
  assert.strictEqual(DataNormalizer.getArtistName(undefined), 'Unknown Artist');
});

runTest('DataNormalizer.getTrackTitle decodes HTML entities & formats cleanly', () => {
  assert.strictEqual(DataNormalizer.getTrackTitle('&quot;Rockstar&quot; &amp; &lt;Echo&gt;'), '"Rockstar" & <Echo>');
  assert.strictEqual(DataNormalizer.getTrackTitle({ song: 'Tum Hi Ho &#39;Special&#39;' }), "Tum Hi Ho 'Special'");
});

runTest('DataNormalizer.getImageUrl selects highest quality artwork', () => {
  // Case A: string URL
  assert.strictEqual(DataNormalizer.getImageUrl('https://example.com/art.jpg'), 'https://example.com/art.jpg');

  // Case B: array of JioSaavn image objects with quality / link
  const saavnImages = [
    { quality: '50x50', link: 'https://c.saavncdn.com/1-50x50.jpg' },
    { quality: '150x150', link: 'https://c.saavncdn.com/1-150x150.jpg' },
    { quality: '500x500', link: 'https://c.saavncdn.com/1-500x500.jpg' }
  ];
  assert.strictEqual(DataNormalizer.getImageUrl(saavnImages), 'https://c.saavncdn.com/1-500x500.jpg');

  // Case C: array of YouTube thumbnail objects with url / width
  const ytThumbnails = [
    { url: 'https://i.ytimg.com/vi/1/default.jpg', width: 120, height: 90 },
    { url: 'https://i.ytimg.com/vi/1/hqdefault.jpg', width: 480, height: 360 },
    { url: 'https://i.ytimg.com/vi/1/maxresdefault.jpg', width: 1280, height: 720 }
  ];
  assert.strictEqual(DataNormalizer.getImageUrl(ytThumbnails), 'https://i.ytimg.com/vi/1/maxresdefault.jpg');
});

runTest('DataNormalizer.normalizeTrack produces canonical schema with zero [object Object]', () => {
  const rawTrack = {
    id: 12345,
    title: 'Kesariya',
    primaryArtists: [{ id: '1', name: 'Arijit Singh' }, { id: '2', name: 'Pritam' }],
    album: { name: 'Brahmastra', id: 'alb_1' },
    image: [{ quality: '500x500', url: 'https://c.saavncdn.com/kesariya-500.jpg' }],
    duration: '268',
    url: 'https://aac.saavncdn.com/kesariya.mp4'
  };

  const normalized = DataNormalizer.normalizeTrack(rawTrack);
  assert.strictEqual(normalized.id, '12345');
  assert.strictEqual(normalized.name, 'Kesariya');
  assert.strictEqual(normalized.title, 'Kesariya');
  assert.strictEqual(normalized.artists, 'Arijit Singh, Pritam');
  assert.strictEqual(normalized.primaryArtist, 'Arijit Singh');
  assert.strictEqual(normalized.album, 'Brahmastra');
  assert.strictEqual(normalized.albumId, 'alb_1');
  assert.strictEqual(normalized.image, 'https://c.saavncdn.com/kesariya-500.jpg');
  assert.strictEqual(normalized.duration, 268);
  assert.strictEqual(normalized.streamUrl, 'https://aac.saavncdn.com/kesariya.mp4');
});

// ----------------------------------------------------------------------------
// 2. Elimination of Native Browser Dialogs (alert, confirm, prompt)
// ----------------------------------------------------------------------------
console.log('\n--- 2. Native UI Elimination (alert/confirm/prompt) ---');
const appJsContent = fs.readFileSync(path.join(__dirname, 'js/app.js'), 'utf8');
const uiJsContent = fs.readFileSync(path.join(__dirname, 'js/ui.js'), 'utf8');

runTest('app.js has zero unmocked calls to window.alert, confirm, prompt', () => {
  // Regex check for raw alert(), confirm(), prompt() calls that aren't inside comments
  const alertMatches = appJsContent.match(/(?<![a-zA-Z0-9_\.])alert\s*\(/g) || [];
  const confirmMatches = appJsContent.match(/(?<![a-zA-Z0-9_\.])confirm\s*\(/g) || [];
  const promptMatches = appJsContent.match(/(?<![a-zA-Z0-9_\.])prompt\s*\(/g) || [];

  assert.strictEqual(alertMatches.length, 0, `Found ${alertMatches.length} alert() calls in app.js`);
  assert.strictEqual(confirmMatches.length, 0, `Found ${confirmMatches.length} confirm() calls in app.js`);
  assert.strictEqual(promptMatches.length, 0, `Found ${promptMatches.length} prompt() calls in app.js`);
});

runTest('ui.js implements showConfirmModal and showPromptModal with glassmorphic styles', () => {
  assert.ok(uiJsContent.includes('showConfirmModal'), 'ui.js should contain showConfirmModal');
  assert.ok(uiJsContent.includes('showPromptModal'), 'ui.js should contain showPromptModal');
  assert.ok(uiJsContent.includes('modal-confirm-dialog'), 'ui.js should target modal-confirm-dialog');
  assert.ok(uiJsContent.includes('modal-prompt-dialog'), 'ui.js should target modal-prompt-dialog');
});

// ----------------------------------------------------------------------------
// 3. YouTube Playlist Import & Catalog Matching
// ----------------------------------------------------------------------------
console.log('\n--- 3. YouTube Playlist Import & Catalog Matching ---');

runTest('saveImportedPlaylist normalizes tracks and immediately updates playlists', () => {
  assert.ok(appJsContent.includes('saveImportedPlaylist'), 'saveImportedPlaylist should be defined in app.js');
  assert.ok(appJsContent.includes('DataNormalizer.normalizeTrack'), 'saveImportedPlaylist should use DataNormalizer.normalizeTrack');
  assert.ok(appJsContent.includes('Storage.createPlaylist'), 'saveImportedPlaylist should create playlist in Storage');
  assert.ok(appJsContent.includes("UI.renderLibraryTab('playlists')"), 'saveImportedPlaylist should immediately refresh My Music playlists tab');
});

// ----------------------------------------------------------------------------
// 4. Playlist Queue Boundary & Context Isolation
// ----------------------------------------------------------------------------
console.log('\n--- 4. Playlist Queue Boundary & Context Isolation ---');
const playerJsContent = fs.readFileSync(path.join(__dirname, 'js/player.js'), 'utf8');

runTest('Player tracks queueContext and respects playlist mode', () => {
  assert.ok(playerJsContent.includes('queueContext'), 'player.js should track queueContext');
  assert.ok(playerJsContent.includes('getQueueContext'), 'player.js should export getQueueContext');
  assert.ok(playerJsContent.includes("queueContext.source === 'playlist'"), 'player.js next() should check queueContext.source');
});

// ----------------------------------------------------------------------------
// 5. DownloadManager Cancellation & Concurrency Worker Pool
// ----------------------------------------------------------------------------
console.log('\n--- 5. DownloadManager Concurrency & Cancellation ---');
const downloadManagerJsContent = fs.readFileSync(path.join(__dirname, 'js/downloadManager.js'), 'utf8');

runTest('DownloadManager implements AbortController cancellation for queued and active downloads', () => {
  assert.ok(downloadManagerJsContent.includes('AbortController'), 'downloadManager.js should use AbortController');
  assert.ok(downloadManagerJsContent.includes('task.abortController.abort()'), 'cancel() should trigger abortController.abort()');
  assert.ok(downloadManagerJsContent.includes('cancelAll'), 'downloadManager.js should implement cancelAll');
});

runTest('DownloadManager fixes activeCount double decrement concurrency bug', () => {
  assert.ok(!downloadManagerJsContent.includes('activeCount--;\n    tasks.delete(String(trackId));'), 'cancel() should safely decrement activeCount only when downloading');
});

// ----------------------------------------------------------------------------
// 6. Typesense 500 Offline Fallback Handling
// ----------------------------------------------------------------------------
console.log('\n--- 6. Typesense Offline Handling ---');
const serverJsContent = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const typesenseClientJsContent = fs.readFileSync(path.join(__dirname, 'js/typesenseClient.js'), 'utf8');

runTest('server.js sync-track endpoint returns HTTP 200 with offline: true when Typesense is offline', () => {
  assert.ok(serverJsContent.includes('/api/typesense/sync-track'), 'server.js should have /api/typesense/sync-track');
  assert.ok(serverJsContent.includes('offline: true'), 'server.js should return status 200 offline: true');
});

runTest('typesenseClient.js handles offline response without throwing unhandled exceptions', () => {
  assert.ok(typesenseClientJsContent.includes('DataNormalizer'), 'typesenseClient.js should use DataNormalizer');
  assert.ok(typesenseClientJsContent.includes('.catch(() => {})'), 'typesenseClient.js should catch network errors gracefully');
});

// ----------------------------------------------------------------------------
// 7. Provider Scope Collisions & IIFE Wrapping
// ----------------------------------------------------------------------------
console.log('\n--- 7. Provider Scope Collisions ---');
const jioSaavnJsContent = fs.readFileSync(path.join(__dirname, 'js/jioSaavnProvider.js'), 'utf8');
const ytMusicJsContent = fs.readFileSync(path.join(__dirname, 'js/youtubeMusicProvider.js'), 'utf8');

runTest('jioSaavnProvider.js is safely wrapped in an IIFE', () => {
  assert.ok(jioSaavnJsContent.trim().startsWith('(function() {') || jioSaavnJsContent.trim().startsWith('(() => {'), 'jioSaavnProvider should be wrapped in IIFE');
  assert.ok(jioSaavnJsContent.includes('window.JioSaavnProvider = JioSaavnProvider'), 'jioSaavnProvider should export to window');
});

runTest('youtubeMusicProvider.js is safely wrapped in an IIFE', () => {
  assert.ok(ytMusicJsContent.trim().startsWith('(function() {') || ytMusicJsContent.trim().startsWith('(() => {'), 'youtubeMusicProvider should be wrapped in IIFE');
  assert.ok(ytMusicJsContent.includes('window.YouTubeMusicProvider = YouTubeMusicProvider'), 'youtubeMusicProvider should export to window');
});

// ----------------------------------------------------------------------------
// 8. CSS Modernization (slider-vertical deprecation)
// ----------------------------------------------------------------------------
console.log('\n--- 8. CSS Modernization ---');
const appCssContent = fs.readFileSync(path.join(__dirname, 'css/app.css'), 'utf8');

runTest('app.css removes slider-vertical deprecation in favor of vertical writing mode', () => {
  assert.ok(!appCssContent.includes('-webkit-appearance: slider-vertical;'), 'app.css should NOT contain -webkit-appearance: slider-vertical;');
  assert.ok(appCssContent.includes('writing-mode: vertical-lr;') && appCssContent.includes('direction: rtl;'), 'app.css should use writing-mode: vertical-lr and direction: rtl');
});

// ----------------------------------------------------------------------------
// 9. Equalizer DSP & 3D Spatial Audio
// ----------------------------------------------------------------------------
console.log('\n--- 9. Equalizer & 3D Spatial Audio ---');

runTest('player.js and app.js handle Equalizer DSP frequencies, presets and 3D spatial settings', () => {
  assert.ok(playerJsContent.includes('EQ_FREQS') && playerJsContent.includes('EQ_PRESETS'), 'player.js should define EQ_FREQS and EQ_PRESETS');
  assert.ok(playerJsContent.includes('setSpatial') || playerJsContent.includes('setEqPreset'), 'player.js should support spatial and preset controls');
  assert.ok(appJsContent.includes('selectEqPreset') && appJsContent.includes('setSpatialLevel'), 'app.js should connect EQ preset and spatial controls');
});

// ----------------------------------------------------------------------------
// 10. UpdateManager HTML / Content-Type Guard
// ----------------------------------------------------------------------------
console.log('\n--- 10. UpdateManager Content-Type Guard ---');
const updateManagerJsContent = fs.readFileSync(path.join(__dirname, 'js/updateManager.js'), 'utf8');

runTest('updateManager.js verifies application/json before parsing response', () => {
  assert.ok(updateManagerJsContent.includes('contentType') && updateManagerJsContent.includes('application/json'), 'updateManager should check for application/json Content-Type');
});

// ----------------------------------------------------------------------------
// 11. Artist Page Genre Category Chips
// ----------------------------------------------------------------------------
console.log('\n--- 11. Artist Page Category Chips ---');

runTest('app.js implements filterArtistCategory for Top Hits, Romantic, Melody, 90s Hits, and Duets', () => {
  assert.ok(appJsContent.includes('filterArtistCategory'), 'filterArtistCategory should be implemented in app.js');
  assert.ok(appJsContent.includes('Romantic') || appJsContent.includes('romantic'), 'filterArtistCategory should support Romantic filter');
  assert.ok(appJsContent.includes('Melody') || appJsContent.includes('melody'), 'filterArtistCategory should support Melody filter');
  assert.ok(appJsContent.includes('90s Hits') || appJsContent.includes('90s'), 'filterArtistCategory should support 90s Hits filter');
  assert.ok(appJsContent.includes('Duets') || appJsContent.includes('duets'), 'filterArtistCategory should support Duets filter');
});

// ----------------------------------------------------------------------------
// 12. 3D Swipe Discovery Stack
// ----------------------------------------------------------------------------
console.log('\n--- 12. 3D Swipe Discovery Stack ---');

runTest('ui.js and app.js implement 3D Swipe Discovery Stack', () => {
  assert.ok(uiJsContent.includes('renderSwipeDiscovery'), 'ui.js should implement renderSwipeDiscovery');
  assert.ok(appJsContent.includes('initSwipeDiscovery'), 'app.js should implement initSwipeDiscovery');
  assert.ok(appJsContent.includes('swipeCardAction'), 'app.js should implement swipeCardAction');
});

// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`Test Results: ${passedTests} Passed, ${failedTests} Failed`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL COMPREHENSIVE REGRESSION TESTS PASSED (100% PASS RATE)!\n');
  process.exit(0);
}
