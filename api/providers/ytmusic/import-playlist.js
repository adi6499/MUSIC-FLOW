// ============================================================================
// MUSICFLOW — VERCEL SERVERLESS FUNCTION: YOUTUBE PLAYLIST / ALBUM IMPORT
// Endpoint: POST /api/providers/ytmusic/import-playlist
// Always returns standardized JSON: { success: true, ... } or { success: false, error, code }
// ============================================================================

const YouTubeMusicService = require('../../../youtubeMusicService.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Method Not Allowed', code: 'METHOD_NOT_ALLOWED' }));
    return;
  }

  let body = '';
  let url = '';

  if (req.body && typeof req.body === 'object') {
    url = req.body.url || req.body.playlistUrl || req.body.id;
  } else {
    await new Promise(resolve => {
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          url = parsed.url || parsed.playlistUrl || parsed.id;
        } catch (_) {}
        resolve();
      });
    });
  }

  if (!url || typeof url !== 'string' || !url.trim()) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'YouTube URL or Playlist ID is required', code: 'MISSING_URL' }));
    return;
  }

  try {
    const result = await YouTubeMusicService.importAndMatchPlaylist(url.trim());
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, ...result }));
  } catch (err) {
    console.error('[ImportPlaylistAPI] Execution failed:', err.message);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: {
        code: 'IMPORT_FAILED',
        message: err.message || 'Failed to import YouTube playlist',
        details: String(err.stack || '')
      }
    }));
  }
};
