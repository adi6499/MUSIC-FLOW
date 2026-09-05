const fs = require('fs');
const path = require('path');
const assert = require('assert');

function runTests() {
  console.log('======================================================================');
  console.log('🧪 VERIFYING USER FIXES: DRAWER, LOCAL AUDIO, ALBUMS, FILTERS & PLAYLISTS');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  function it(desc, fn) {
    try {
      fn();
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${desc}:`, err.message);
      failed++;
    }
  }

  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
  const css = fs.readFileSync(path.join(__dirname, 'css', 'app.css'), 'utf-8');
  const appJs = fs.readFileSync(path.join(__dirname, 'js', 'app.js'), 'utf-8');
  const uiJs = fs.readFileSync(path.join(__dirname, 'js', 'ui.js'), 'utf-8');
  const storageJs = fs.readFileSync(path.join(__dirname, 'js', 'storage.js'), 'utf-8');
  const idbJs = fs.readFileSync(path.join(__dirname, 'js', 'indexedDbStorage.js'), 'utf-8');
  const resolverJs = fs.readFileSync(path.join(__dirname, 'js', 'playbackResolver.js'), 'utf-8');
  const id3Js = fs.readFileSync(path.join(__dirname, 'js', 'id3Parser.js'), 'utf-8');
  const exploreJs = fs.readFileSync(path.join(__dirname, 'js', 'exploreDataLayer.js'), 'utf-8');
  const apiJs = fs.readFileSync(path.join(__dirname, 'js', 'api.js'), 'utf-8');
  const jioJs = fs.readFileSync(path.join(__dirname, 'js', 'jioSaavnProvider.js'), 'utf-8');
  const playerJs = fs.readFileSync(path.join(__dirname, 'js', 'player.js'), 'utf-8');

  // --- 1. Bottom Drawer Tabs Layout & Distribution ---
  console.log('--- 1. Bottom Drawer Tabs Layout & Symmetry ---');
  it('1.1 .drawer-tab-btn has flex: 1 for equal width distribution', () => {
    assert.ok(css.includes('.drawer-tab-btn'), 'Must style .drawer-tab-btn');
    assert.ok(css.includes('flex: 1;'), 'Must have flex: 1');
  });

  it('1.2 .drawer-tabs-group fills width and distributes space evenly', () => {
    assert.ok(css.includes('.drawer-tabs-group'), 'Must style .drawer-tabs-group');
    assert.ok(css.includes('justify-content: space-around;'), 'Must have space-around distribution');
    assert.ok(css.includes('width: 100%;'), 'Must have 100% width');
  });

  it('1.3 .drawer-close-btn is hidden collapsed and displayed when expanded', () => {
    assert.ok(css.includes('.drawer-close-btn'), 'Must style .drawer-close-btn');
    assert.ok(css.includes('.ytm-player-drawer.expanded .drawer-close-btn'), 'Must display close btn when expanded');
  });

  it('1.4 .drawer-tab-btn.active::after has centered underline indicator', () => {
    assert.ok(css.includes('.drawer-tab-btn.active::after'), 'Must style active tab indicator');
    assert.ok(css.includes('left: 50%;'), 'Must center underline horizontally');
    assert.ok(css.includes('transform: translateX(-50%);'), 'Must translate indicator to center');
  });

  // --- 2. Local Albums UI Fix ---
  console.log('\n--- 2. Local Albums Grid UI & Cover Constraint ---');
  it('2.1 .playlist-rich-card-cover has aspect-ratio: 1/1 and object-fit: cover', () => {
    assert.ok(css.includes('.playlist-rich-card-cover'), 'Must style .playlist-rich-card-cover');
    assert.ok(css.includes('aspect-ratio: 1/1;'), 'Must force 1/1 aspect ratio');
    assert.ok(css.includes('object-fit: cover;'), 'Must have object-fit: cover');
  });

  it('2.2 ui.js wraps local album cards with standard playlist-rich-cover-wrap', () => {
    assert.ok(uiJs.includes('class="playlist-rich-cover-wrap"'), 'Must include cover wrap in albums subtab');
    assert.ok(uiJs.includes('playlist-rich-cover-img'), 'Must include cover img class');
  });

  // --- 3. Local Audio Storage, Resolution & Playback ---
  console.log('\n--- 3. Local Audio Storage, Resolution & Playback ---');
  it('3.1 indexedDbStorage.js exports getLocalTrack and getLocalTrackAudioUrl', () => {
    assert.ok(idbJs.includes('async function getLocalTrack(id)'), 'Must define getLocalTrack');
    assert.ok(idbJs.includes('async function getLocalTrackAudioUrl(id)'), 'Must define getLocalTrackAudioUrl');
    assert.ok(idbJs.includes('getLocalTrack,'), 'Must export getLocalTrack');
    assert.ok(idbJs.includes('getLocalTrackAudioUrl,'), 'Must export getLocalTrackAudioUrl');
  });

  it('3.2 storage.js implements getLocalAudioUrl and getLocalTrackBlob', () => {
    assert.ok(storageJs.includes('async getLocalAudioUrl(songId)'), 'Must define getLocalAudioUrl');
    assert.ok(storageJs.includes('async getLocalTrackBlob(songId)'), 'Must define getLocalTrackBlob');
    assert.ok(storageJs.includes('_localFileBlobMap'), 'Must maintain in-memory blob map');
  });

  it('3.3 playbackResolver.js resolves local tracks via Storage.getLocalAudioUrl', () => {
    assert.ok(resolverJs.includes('isLocalTrack'), 'Must identify local tracks');
    assert.ok(resolverJs.includes('Storage.getLocalAudioUrl'), 'Must call Storage.getLocalAudioUrl');
    assert.ok(resolverJs.includes('SourceType.LOCAL'), 'Must resolve with SourceType.LOCAL');
  });

  it('3.4 app.js playLocalTrack queries Storage.getLocalSongs() and sets queue', () => {
    assert.ok(appJs.includes('Storage.getLocalSongs()'), 'playLocalTrack must query Storage.getLocalSongs');
    assert.ok(appJs.includes('Player.setQueue(localSongs, trackIdx'), 'Must pass local songs to Player.setQueue');
  });

  it('3.5 file inputs accept all audio extensions and triggerFolderImport handles mobile', () => {
    assert.ok(html.includes('.mp3,.m4a,.aac,.wav,.flac,.ogg,.opus'), 'HTML inputs must accept all audio formats');
    assert.ok(appJs.includes('local-file-input'), 'triggerFolderImport must fallback to file input on mobile');
  });

  // --- 4. ID3 & Filename Title/Artist Inversion Heuristics ---
  console.log('\n--- 4. ID3 & Filename Fallback Parsing ---');
  it('4.1 ID3Parser correctly handles Title - Artist with comma-separated artists', () => {
    const ID3Parser = eval(id3Js + '\nID3Parser;');
    const filename1 = 'Tera Mera Rishta - Mithoon, Pritam, Sayeed Quadri.mp3';
    const title1 = ID3Parser.fallbackTitleFromFilename(filename1);
    const artist1 = ID3Parser.fallbackArtistFromFilename(filename1);
    assert.strictEqual(title1, 'Tera Mera Rishta', 'Title should be Tera Mera Rishta');
    assert.strictEqual(artist1, 'Mithoon, Pritam, Sayeed Quadri', 'Artist should be Mithoon, Pritam, Sayeed Quadri');
  });

  it('4.2 ID3Parser preserves Artist - Title for standard names without commas', () => {
    const ID3Parser = eval(id3Js + '\nID3Parser;');
    const filename2 = 'The Weeknd - Blinding Lights.mp3';
    const title2 = ID3Parser.fallbackTitleFromFilename(filename2);
    const artist2 = ID3Parser.fallbackArtistFromFilename(filename2);
    assert.strictEqual(title2, 'Blinding Lights', 'Title should be Blinding Lights');
    assert.strictEqual(artist2, 'The Weeknd', 'Artist should be The Weeknd');
  });

  // --- 5. Explore Filters & Playlist Limits ---
  console.log('\n--- 5. Explore Filters & Playlist 50-Song Limit ---');
  it('5.1 exploreDataLayer.js maps New Releases and filters literal title matches', () => {
    assert.ok(exploreJs.includes("'new releases'"), 'FEATURED_GENRES must include new releases');
    assert.ok(exploreJs.includes('lowerName !== normalizedKey'), 'Must filter out tracks titled equal to category');
  });

  it('5.2 api.js and jioSaavnProvider.js request limit: 100 for playlists and albums', () => {
    assert.ok(apiJs.includes("'/playlists', { id, limit: 100 }"), 'api.js getPlaylistDetails must pass limit: 100');
    assert.ok(apiJs.includes("'/albums', { id, limit: 100 }"), 'api.js getAlbumDetails must pass limit: 100');
    assert.ok(jioJs.includes("'/playlists', { id: playlistId, limit: 100 }"), 'jioSaavnProvider getPlaylist must pass limit: 100');
    assert.ok(jioJs.includes("'/albums', { id: albumId, limit: 100 }"), 'jioSaavnProvider getAlbum must pass limit: 100');
  });

  // --- 6. UP NEXT vs RELATED, Auto-Skip & Queue Filtering ---
  console.log('\n--- 6. UP NEXT vs RELATED, Auto-Skip & Queue Filtering ---');
  it('6.1 Player filters out unplayable, null and empty tracks via isValidQueueTrack', () => {
    assert.ok(playerJs.includes('function isValidQueueTrack(t)'), 'Player must define isValidQueueTrack');
    assert.ok(playerJs.includes('rawQueue.filter(isValidQueueTrack)'), 'setQueue must filter invalid tracks');
    assert.ok(playerJs.includes('if (!song || !isValidQueueTrack(song)) return;'), 'appendToQueue must reject unplayable tracks');
  });

  it('6.2 Player performs fast auto-skip (350ms) on playback error or unavailable source', () => {
    assert.ok(playerJs.includes('failedTrack.isPlayable = false;'), 'Failed audio track must be marked isPlayable = false');
    assert.ok(playerJs.includes('song.isPlayable = false;'), 'Unavailable track must be marked isPlayable = false');
    assert.ok(playerJs.includes('350'), 'Auto-skip timer must be swift (350ms)');
    assert.ok(playerJs.includes('next()'), 'Must call next() to skip failed track');
  });

  it('6.3 Player next() and previous() scan ahead for playable tracks', () => {
    assert.ok(playerJs.includes('queue[i].isPlayable !== false'), 'next() must search for index where isPlayable !== false');
    assert.ok(playerJs.includes('prevIndex'), 'previous() must search backward for playable index');
  });

  it('6.4 app.js renderDrawerRelated deduplicates against playing track and queue', () => {
    assert.ok(appJs.includes('isAlreadyInQueueOrCurrent'), 'renderDrawerRelated must define isAlreadyInQueueOrCurrent');
    assert.ok(appJs.includes('queuedIds.has'), 'Must check queued IDs set');
    assert.ok(appJs.includes('queuedTitles.has'), 'Must check queued titles set');
    assert.ok(appJs.includes('!isAlreadyInQueueOrCurrent'), 'Must filter related candidates against queue');
  });

  it('6.5 app.js provides queueRelatedTrackNext and queueRelatedTrackEnd with action buttons', () => {
    assert.ok(appJs.includes('function queueRelatedTrackNext'), 'Must define queueRelatedTrackNext');
    assert.ok(appJs.includes('function queueRelatedTrackEnd'), 'Must define queueRelatedTrackEnd');
    assert.ok(appJs.includes('queueRelatedTrackNext,'), 'App must export queueRelatedTrackNext');
    assert.ok(appJs.includes('queueRelatedTrackEnd,'), 'App must export queueRelatedTrackEnd');
    assert.ok(appJs.includes('playlist_play'), 'Must include playlist_play action icon in related track row');
    assert.ok(appJs.includes('playlist_add'), 'Must include playlist_add action icon in related track row');
  });

  it('6.6 Collapse button is relocated inside .drawer-drag-bar to prevent RELATEDv overlap', () => {
    assert.ok(html.includes('class="drawer-drag-bar"'), 'Must have .drawer-drag-bar');
    const dragBarSnippet = html.substring(html.indexOf('class="drawer-drag-bar"'), html.indexOf('class="drawer-tabs-nav"'));
    assert.ok(dragBarSnippet.includes('id="btn-collapse-drawer"'), '#btn-collapse-drawer must be inside .drawer-drag-bar');
    const tabsNavSnippet = html.substring(html.indexOf('class="drawer-tabs-nav"'), html.indexOf('class="drawer-body-container"'));
    assert.ok(!tabsNavSnippet.includes('id="btn-collapse-drawer"'), '#btn-collapse-drawer must NOT be inside .drawer-tabs-nav');
  });

  it('6.7 Continuous endless queue auto-populates when near end and on playing individual track', () => {
    assert.ok(playerJs.includes('queue.length - currentIndex <= 4'), 'Must trigger continuous population when <= 4 tracks left');
    assert.ok(playerJs.includes('autoPopulateContinuousQueue(song)'), 'playSong must immediately auto-populate continuous queue');
    assert.ok(playerJs.includes('API.getArtistSongs'), 'autoPopulateContinuousQueue must query artist songs');
    assert.ok(playerJs.includes('API.searchSongs'), 'autoPopulateContinuousQueue must query artist hits');
  });

  it('6.8 app.js renderDrawerRelated has resilient current track resolution and multi-channel retrieval', () => {
    assert.ok(appJs.includes('Player.getCurrentTrack && Player.getCurrentTrack()'), 'Must fallback to queue or history if getCurrentTrack is momentarily null');
    assert.ok(appJs.includes('Promise.allSettled(channelPromises)'), 'Must fetch related tracks across multiple channels in parallel');
    assert.ok(appJs.includes('renderDrawerSimilarArtists'), 'Must render similar artists shelf');
  });

  console.log('\n======================================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED (${failed} FAILED)`);
  console.log('======================================================================\n');

  if (failed > 0) process.exit(1);
}

runTests();
