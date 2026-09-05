// ============================================================================
// MUSICFLOW 2.7.1 — YOUTUBE PLAYLIST IMPORT IOS REGRESSION TEST SUITE
// Tests iOS production endpoint resolution, URL normalization, WKWebView fetch,
// response parsing, track normalization, matching results, and error differentiation.
// ============================================================================

const assert = require('assert');

console.log('\n=============================================================');
console.log('🧪 RUNNING YOUTUBE PLAYLIST IMPORT IOS REGRESSION SUITE');
console.log('=============================================================\n');

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

// Global Mocks for Storage and DOM
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
const handleImportPlaylist = require('../api/providers/ytmusic/import-playlist.js');
const handleImportTrack = require('../api/providers/ytmusic/import-track.js');

global.DataNormalizer = DataNormalizer;
global.ApiConfig = ApiConfig;
global.YouTubeMusicService = YouTubeMusicService;
global.Storage = Storage;

(async () => {
  // --------------------------------------------------------------------------
  // 1. IOS ENVIRONMENT DETECTION & PRODUCTION ENDPOINT RESOLUTION
  // --------------------------------------------------------------------------
  it('1.1 ApiConfig identifies iOS WKWebView (iPhone UserAgent + localhost) as iOS native app', () => {
    const originalWindow = global.window;
    const originalNavigator = global.navigator;

    global.window = {
      location: {
        protocol: 'https:',
        hostname: 'localhost',
        origin: 'https://localhost',
        href: 'https://localhost/index.html'
      },
      webkit: {
        messageHandlers: {
          nativeMedia: { postMessage: () => {} }
        }
      }
    };
    global.navigator = {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
      platform: 'iPhone',
      maxTouchPoints: 5
    };

    assert.strictEqual(ApiConfig.isRunningInIOS(), true, 'Must identify iPhone WKWebView as iOS');
    assert.strictEqual(ApiConfig.isNativeApp(), true, 'Must be native app');
    assert.strictEqual(ApiConfig.isLocalDevelopment(), false, 'Must NOT be considered local development');
    assert.strictEqual(ApiConfig.getApiBaseUrl(), 'https://spoton-sigma.vercel.app', 'Base URL must be production');
    assert.strictEqual(ApiConfig.getYouTubeMusicApiBase(), 'https://spoton-sigma.vercel.app/api/providers/ytmusic');
    assert.strictEqual(ApiConfig.buildUrl('/api/providers/ytmusic/import-playlist'), 'https://spoton-sigma.vercel.app/api/providers/ytmusic/import-playlist');

    global.window = originalWindow;
    global.navigator = originalNavigator;
  });

  it('1.2 ApiConfig identifies iPadOS Desktop-Class WKWebView as iOS native app', () => {
    const originalWindow = global.window;
    const originalNavigator = global.navigator;

    global.window = {
      location: {
        protocol: 'https:',
        hostname: 'localhost',
        origin: 'https://localhost',
        href: 'https://localhost/'
      },
      webkit: {
        messageHandlers: {
          nativeMedia: { postMessage: () => {} }
        }
      }
    };
    global.navigator = {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 5 // iPadOS touch screen
    };

    assert.strictEqual(ApiConfig.isRunningInIOS(), true, 'Must identify iPadOS desktop useragent as iOS');
    assert.strictEqual(ApiConfig.getApiBaseUrl(), 'https://spoton-sigma.vercel.app');
    assert.strictEqual(ApiConfig.buildUrl('/api/providers/ytmusic/import-playlist'), 'https://spoton-sigma.vercel.app/api/providers/ytmusic/import-playlist');

    global.window = originalWindow;
    global.navigator = originalNavigator;
  });

  it('1.3 ApiConfig identifies Capacitor scheme (capacitor://localhost) as iOS native app', () => {
    const originalWindow = global.window;
    const originalNavigator = global.navigator;

    global.window = {
      location: {
        protocol: 'capacitor:',
        hostname: 'localhost',
        origin: 'capacitor://localhost',
        href: 'capacitor://localhost/index.html'
      },
      Capacitor: {
        getPlatform: () => 'ios'
      }
    };
    global.navigator = {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15',
      platform: 'iPhone',
      maxTouchPoints: 5
    };

    assert.strictEqual(ApiConfig.isRunningInIOS(), true);
    assert.strictEqual(ApiConfig.getApiBaseUrl(), 'https://spoton-sigma.vercel.app');
    assert.strictEqual(ApiConfig.buildUrl('/api/providers/ytmusic/import-playlist'), 'https://spoton-sigma.vercel.app/api/providers/ytmusic/import-playlist');

    global.window = originalWindow;
    global.navigator = originalNavigator;
  });

  it('1.4 ApiConfig preserves desktop local dev server on http://localhost:3000', () => {
    const originalWindow = global.window;
    const originalNavigator = global.navigator;

    global.window = {
      location: {
        protocol: 'http:',
        hostname: 'localhost',
        port: '3000',
        origin: 'http://localhost:3000',
        href: 'http://localhost:3000/'
      }
    };
    global.navigator = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0',
      platform: 'Win32',
      maxTouchPoints: 0
    };

    assert.strictEqual(ApiConfig.isRunningInIOS(), false);
    assert.strictEqual(ApiConfig.isLocalDevelopment(), true);
    assert.strictEqual(ApiConfig.getApiBaseUrl(), 'http://localhost:3000');

    global.window = originalWindow;
    global.navigator = originalNavigator;
  });

  // --------------------------------------------------------------------------
  // 2. PLAYLIST URL NORMALIZATION & PARAMETER HANDLING
  // --------------------------------------------------------------------------
  it('2.1 DataNormalizer and YouTubeMusicService normalize all YouTube / YouTube Music playlist formats', () => {
    const testCases = [
      {
        url: 'https://www.youtube.com/playlist?list=PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI',
        expectedId: 'PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI'
      },
      {
        url: 'https://music.youtube.com/playlist?list=PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI&si=AbCdEfGhIjKlMnOp&index=1',
        expectedId: 'PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI'
      },
      {
        url: 'https://www.youtube.com/playlist?list=OLAK5uy_k1234567890abcdefghijklmnopqrstuv',
        expectedId: 'OLAK5uy_k1234567890abcdefghijklmnopqrstuv'
      },
      {
        url: 'https://music.youtube.com/browse/VLPL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI',
        expectedId: 'VLPL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI'
      },
      {
        url: 'PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI',
        expectedId: 'PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI'
      }
    ];

    testCases.forEach(({ url, expectedId }) => {
      const parsed = DataNormalizer.parseYouTubeUrl(url);
      assert.ok(parsed, `Failed to parse: ${url}`);
      assert.strictEqual(parsed.type, 'playlist');
      assert.strictEqual(parsed.id, expectedId);
    });
  });

  // --------------------------------------------------------------------------
  // 3. BACKEND API ENDPOINT & CORS HEADERS (WKWebView Compatibility)
  // --------------------------------------------------------------------------
  await itAsync('3.1 import-playlist endpoint provides full CORS headers for WKWebView preflight and POST', async () => {
    const headers = {};
    let statusCode = 0;
    let responseBody = '';

    const req = {
      method: 'OPTIONS',
      headers: {
        'origin': 'https://localhost',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'Content-Type, Accept'
      }
    };
    const res = {
      setHeader: (k, v) => { headers[k] = v; },
      writeHead: (code) => { statusCode = code; },
      end: (b) => { responseBody = b || ''; }
    };

    await handleImportPlaylist(req, res);

    assert.strictEqual(statusCode, 200, 'Preflight must return HTTP 200');
    assert.strictEqual(headers['Access-Control-Allow-Origin'], '*');
    assert.ok(headers['Access-Control-Allow-Methods'].includes('POST'));
    assert.ok(headers['Access-Control-Allow-Headers'].includes('Content-Type'));
  });

  await itAsync('3.2 import-playlist handles query params and body payloads identically', async () => {
    let capturedCode = 0;
    let capturedBody = '';

    const req = {
      method: 'POST',
      query: { url: 'https://music.youtube.com/playlist?list=PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI' },
      body: {}
    };
    const res = {
      setHeader: () => {},
      writeHead: (code) => { capturedCode = code; },
      end: (b) => { capturedBody = b; }
    };

    await handleImportPlaylist(req, res);
    assert.strictEqual(capturedCode, 200);
    const parsed = JSON.parse(capturedBody);
    assert.strictEqual(parsed.success, true);
    assert.ok(parsed.totalFound > 0);
  });

  // --------------------------------------------------------------------------
  // 4. RESPONSE PARSING & TRACK NORMALIZATION DEFENSIVENESS
  // --------------------------------------------------------------------------
  it('4.1 DataNormalizer.normalizeTrack handles Unicode, multiple artists, and missing artwork safely', () => {
    const complexTrack = {
      id: 'yt_test123',
      name: '🎵 Arijit Singh & Pritam — Kesariya (केसरिया) [From "Brahmastra"]',
      title: '🎵 Arijit Singh & Pritam — Kesariya (केसरिया) [From "Brahmastra"]',
      artists: ['Arijit Singh', 'Pritam', { name: 'Amitabh Bhattacharya', role: 'lyricist' }],
      image: null,
      audioUrl: 'https://example.com/audio.mp3',
      streamUrl: 'https://example.com/audio.mp3',
      duration: 268
    };

    const normalized = DataNormalizer.normalizeTrack(complexTrack);
    assert.ok(normalized, 'Track must normalize without throwing');
    assert.ok(normalized.name.includes('Kesariya'), 'Name must be preserved');
    assert.strictEqual(typeof normalized.artists, 'string', 'Artists must normalize to string');
    assert.ok(normalized.artists.includes('Arijit Singh'));
    assert.strictEqual(normalized.playbackAvailable, true, 'Track must be marked playable');
  });

  // --------------------------------------------------------------------------
  // 5. SEPARATION OF EXTRACTION VS MATCHING
  // --------------------------------------------------------------------------
  await itAsync('5.1 YouTubeMusicService.importAndMatchPlaylist returns accurate Found, Matched, and Unavailable counts', async () => {
    const result = await YouTubeMusicService.importAndMatchPlaylist('PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI');
    assert.ok(result.totalFound > 0, 'Must extract tracks from YouTube');
    assert.strictEqual(result.matchedCount, result.totalFound, 'All tracks should be matched or have playable fallback');
    assert.strictEqual(result.unmatchedCount, 0);
    assert.strictEqual(result.allTracks.length, result.totalFound);
  });

  // --------------------------------------------------------------------------
  // 6. ERROR MESSAGE DIFFERENTIATION
  // --------------------------------------------------------------------------
  await itAsync('6.1 import-playlist returns structured error with EMPTY_PLAYLIST code for invalid/empty playlist', async () => {
    let capturedCode = 0;
    let capturedBody = '';

    const req = {
      method: 'POST',
      body: { url: 'https://music.youtube.com/playlist?list=PLnonexistent_playlist_0000000' }
    };
    const res = {
      setHeader: () => {},
      writeHead: (code) => { capturedCode = code; },
      end: (b) => { capturedBody = b; }
    };

    await handleImportPlaylist(req, res);
    assert.strictEqual(capturedCode, 200);
    const parsed = JSON.parse(capturedBody);
    assert.strictEqual(parsed.success, false);
    assert.ok(parsed.error);
    assert.ok(parsed.error.message.includes('accessible tracks') || parsed.error.code === 'EMPTY_PLAYLIST');
  });

  // --------------------------------------------------------------------------
  // 7. SAVE TO MY MUSIC & PLAYLIST PLAYBACK READINESS
  // --------------------------------------------------------------------------
  it('7.1 Storage.createPlaylist atomically saves imported playlist with all tracks', () => {
    const mockTracks = [
      { id: 'track_1', name: 'Song One', title: 'Song One', artists: 'Artist A', audioUrl: 'https://cdn.example.com/1.mp3', playbackAvailable: true },
      { id: 'track_2', name: 'Song Two', title: 'Song Two', artists: 'Artist B', audioUrl: 'https://cdn.example.com/2.mp3', playbackAvailable: true }
    ];

    const pl = Storage.createPlaylist('iOS Imported Playlist', 'Imported from YouTube', 'assets/logo.png', mockTracks);
    assert.ok(pl && pl.id, 'Playlist must be created with ID');
    assert.strictEqual(pl.songs.length, 2, 'Must contain 2 tracks');

    const retrieved = Storage.getPlaylistById(pl.id);
    assert.ok(retrieved, 'Must retrieve saved playlist from storage');
    assert.strictEqual(retrieved.songs.length, 2);
    assert.strictEqual(retrieved.songs[0].name, 'Song One');
  });

  console.log('\n=============================================================');
  console.log(`📊 TEST SUITE RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
})();
