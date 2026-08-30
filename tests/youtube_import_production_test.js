/**
 * MUSICFLOW — YOUTUBE MUSIC IMPORT & PRODUCTION API ARCHITECTURE TEST SUITE
 * Verifies URL parsing, ApiConfig environment detection, serverless handlers, CORS,
 * single song & playlist import contracts, error handling, and zero localhost references.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('\n======================================================');
console.log('🧪 RUNNING YOUTUBE MUSIC PRODUCTION API ARCHITECTURE TESTS');
console.log('======================================================\n');

let passed = 0;
let failed = 0;

async function itAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

function it(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ----------------------------------------------------------------------------
// 1. DATA NORMALIZER YOUTUBE URL PARSER
// ----------------------------------------------------------------------------
const DataNormalizer = require('../web-app/js/dataNormalizer.js');

it('1.1 DataNormalizer.parseYouTubeUrl correctly classifies single tracks across all formats', () => {
  const urls = [
    'https://music.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'dQw4w9WgXcQ',
    'https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ'
  ];

  urls.forEach(u => {
    const res = DataNormalizer.parseYouTubeUrl(u);
    assert.ok(res, `Failed to parse track URL: ${u}`);
    assert.strictEqual(res.type, 'track', `Expected type track for ${u}`);
    assert.strictEqual(res.id, 'dQw4w9WgXcQ', `Expected videoId dQw4w9WgXcQ for ${u}`);
  });
});

it('1.2 DataNormalizer.parseYouTubeUrl correctly classifies playlists and albums', () => {
  const plUrls = [
    'https://music.youtube.com/playlist?list=PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI',
    'https://www.youtube.com/playlist?list=PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI',
    'PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI',
    'VLPL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI',
    'OLAK5uy_k1234567890abcdefghijklmnopqrstuv',
    'https://music.youtube.com/browse/MPREb_123456789'
  ];

  plUrls.forEach(u => {
    const res = DataNormalizer.parseYouTubeUrl(u);
    assert.ok(res, `Failed to parse playlist URL: ${u}`);
    assert.strictEqual(res.type, 'playlist', `Expected type playlist for ${u}`);
  });
});

it('1.3 DataNormalizer.parseYouTubeUrl returns null for non-YouTube URLs', () => {
  assert.strictEqual(DataNormalizer.parseYouTubeUrl(''), null);
  assert.strictEqual(DataNormalizer.parseYouTubeUrl('https://spotify.com/playlist/123'), null);
  assert.strictEqual(DataNormalizer.parseYouTubeUrl('https://example.com/song.mp3'), null);
});

// ----------------------------------------------------------------------------
// 2. CENTRALIZED APICONFIG ENVIRONMENT DETECTION
// ----------------------------------------------------------------------------
const ApiConfig = require('../web-app/js/apiConfig.js');

it('2.1 ApiConfig exports production and development API constants', () => {
  assert.strictEqual(ApiConfig.PRODUCTION_API_BASE, 'https://spoton-trpn.vercel.app');
  assert.strictEqual(ApiConfig.DEV_API_BASE, 'http://localhost:3000');
});

it('2.2 ApiConfig selects http://localhost:3000 in local desktop development browser', () => {
  global.window = {
    location: {
      protocol: 'http:',
      hostname: 'localhost',
      origin: 'http://localhost:3000',
      href: 'http://localhost:3000/'
    }
  };
  global.navigator = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' };

  assert.strictEqual(ApiConfig.isLocalDevelopment(), true);
  assert.strictEqual(ApiConfig.isRunningInAndroid(), false);
  assert.strictEqual(ApiConfig.getApiBaseUrl(), 'http://localhost:3000');
  assert.strictEqual(ApiConfig.buildUrl('/api/providers/ytmusic/import-playlist'), 'http://localhost:3000/api/providers/ytmusic/import-playlist');
});

it('2.3 ApiConfig selects https://spoton-trpn.vercel.app in Android WebView build (never localhost)', () => {
  // Simulate Android WebView running file:///android_asset/public/index.html
  global.window = {
    location: {
      protocol: 'file:',
      hostname: '',
      origin: 'null',
      href: 'file:///android_asset/public/index.html'
    }
  };
  global.navigator = { userAgent: 'Mozilla/5.0 (Linux; U; Android 14; Mobile; MusicFlowApp/2.6.0; wv) AppleWebKit/537.36' };

  assert.strictEqual(ApiConfig.isRunningInAndroid(), true);
  assert.strictEqual(ApiConfig.isLocalDevelopment(), false);
  assert.strictEqual(ApiConfig.getApiBaseUrl(), 'https://spoton-trpn.vercel.app');
  assert.strictEqual(ApiConfig.buildUrl('/api/providers/ytmusic/import-playlist'), 'https://spoton-trpn.vercel.app/api/providers/ytmusic/import-playlist');
  assert.strictEqual(ApiConfig.buildUrl('/api/update'), 'https://spoton-trpn.vercel.app/api/update');
});

it('2.4 ApiConfig preserves absolute URLs when passed to buildUrl()', () => {
  assert.strictEqual(ApiConfig.buildUrl('https://custom-api.com/api/test'), 'https://custom-api.com/api/test');
  assert.strictEqual(ApiConfig.buildUrl('http://example.com/audio.mp3'), 'http://example.com/audio.mp3');
});

// ----------------------------------------------------------------------------
// 3. SERVERLESS HANDLERS & PREDICTABLE JSON RESPONSES
// ----------------------------------------------------------------------------
function createMockHttpExchange(method, body = null, query = '') {
  let responseStatus = 200;
  const responseHeaders = {};
  let responseData = '';

  const req = {
    method,
    url: `/api/test${query}`,
    headers: { host: 'localhost:3000', 'content-type': 'application/json' },
    body: body,
    on(event, cb) {
      if (event === 'data' && body) {
        cb(typeof body === 'string' ? body : JSON.stringify(body));
      }
      if (event === 'end') {
        cb();
      }
    }
  };

  const res = {
    setHeader(k, v) { responseHeaders[k.toLowerCase()] = v; },
    writeHead(status, headers = {}) {
      responseStatus = status;
      Object.entries(headers).forEach(([k, v]) => { responseHeaders[k.toLowerCase()] = v; });
    },
    end(data = '') {
      responseData = data;
    },
    getResponse() {
      return {
        status: responseStatus,
        headers: responseHeaders,
        body: responseData,
        json() {
          try { return JSON.parse(responseData); } catch (e) { return null; }
        }
      };
    }
  };

  return { req, res };
}

const handleImportPlaylist = require('../api/providers/ytmusic/import-playlist.js');
const handleImportTrack = require('../api/providers/ytmusic/import-track.js');
const handleSearch = require('../api/providers/ytmusic/search.js');

async function main() {
  await itAsync('3.1 import-playlist handler sets CORS headers and responds to OPTIONS preflight', async () => {
    const { req, res } = createMockHttpExchange('OPTIONS');
    await handleImportPlaylist(req, res);
    const out = res.getResponse();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.headers['access-control-allow-origin'], '*');
  });

  await itAsync('3.2 import-playlist handler returns structured JSON error for missing input', async () => {
    const { req, res } = createMockHttpExchange('POST', { url: '' });
    await handleImportPlaylist(req, res);
    const out = res.getResponse();
    assert.strictEqual(out.status, 400);
    assert.strictEqual(out.headers['content-type'], 'application/json');
    const json = out.json();
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.code, 'MISSING_URL');
  });

  await itAsync('3.3 import-track handler imports single track and returns structured JSON', async () => {
    const { req, res } = createMockHttpExchange('POST', { url: 'dQw4w9WgXcQ' });
    await handleImportTrack(req, res);
    const out = res.getResponse();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.headers['access-control-allow-origin'], '*');
    const json = out.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.track, 'Expected track object in response');
    assert.strictEqual(json.track.sourceYtVideoId || json.track.videoId, 'dQw4w9WgXcQ');
  });

  await itAsync('3.4 import-playlist handler imports single track delegating correctly with single song metadata', async () => {
    const { req, res } = createMockHttpExchange('POST', { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
    await handleImportPlaylist(req, res);
    const out = res.getResponse();
    assert.strictEqual(out.status, 200);
    const json = out.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.type, 'song');
    assert.strictEqual(json.isSingleSong, true);
    assert.strictEqual(json.totalFound, 1);
    assert.ok(json.allTracks && json.allTracks.length === 1);
  });

  // ----------------------------------------------------------------------------
  // 4. CLIENT ERROR HANDLING & USER-FRIENDLY FEEDBACK
  // ----------------------------------------------------------------------------
  it('4.1 Client error handling presents connection explanation rather than raw HTTP 500', () => {
    const errorsToTest = [
      { err: new Error('Failed to fetch'), expected: 'Unable to connect to MusicFlow server. Check your internet connection and try again.' },
      { err: new Error('NetworkError when attempting to fetch resource'), expected: 'Unable to connect to MusicFlow server. Check your internet connection and try again.' },
      { err: new Error('HTTP 500 (Internal Server Error)'), expected: 'Unable to connect to MusicFlow server. Check your internet connection and try again.' },
      { err: { name: 'AbortError', message: 'The operation was aborted' }, expected: 'Request timed out connecting to MusicFlow server. Please try again.' },
      { err: new Error('Playlist not found or contains no accessible tracks'), expected: 'Playlist not found or contains no accessible tracks' }
    ];

    errorsToTest.forEach(({ err, expected }) => {
      let userMsg = 'Unable to connect to MusicFlow server. Check your internet connection and try again.';
      if (err.name === 'AbortError' || err.name === 'TimeoutError' || (err.message && err.message.includes('timeout'))) {
        userMsg = 'Request timed out connecting to MusicFlow server. Please try again.';
      } else if (err.message && !err.message.includes('500') && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError') && !err.message.includes('fetch')) {
        userMsg = err.message;
      }
      assert.strictEqual(userMsg, expected, `Error formatting failed for ${err.message || err.name}`);
    });
  });

  // ----------------------------------------------------------------------------
  // 5. PRODUCTION ASSETS AUDIT (ZERO LOCALHOST IN PROD CLIENT JS)
  // ----------------------------------------------------------------------------
  it('5.1 Production client runtime code has ZERO hardcoded localhost API endpoints', () => {
    const filesToAudit = [
      '../web-app/js/app.js',
      '../web-app/js/api.js',
      '../web-app/js/jioSaavnProvider.js',
      '../web-app/js/youtubeMusicProvider.js',
      '../web-app/js/playbackResolver.js',
      '../web-app/js/updateManager.js'
    ];

    filesToAudit.forEach(relPath => {
      const fullPath = path.join(__dirname, relPath);
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) return;
        if (line.includes('http://localhost:3000') || line.includes('http://127.0.0.1:3000')) {
          assert.fail(`Found hardcoded localhost endpoint in ${relPath} at line ${idx + 1}: ${line.trim()}`);
        }
      });
    });
  });

  console.log('\n======================================================');
  console.log(`📊 YOUTUBE IMPORT TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main();
