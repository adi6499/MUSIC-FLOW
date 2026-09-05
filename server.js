const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const handleUpdateRequest = require('./api/update.js');
const jiosaavnService = require('./jiosaavnService');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'web-app');

// ============================================================================
// TYPESENSE SERVER-SIDE ENVIRONMENT & CREDENTIAL MANAGEMENT
// ============================================================================
const TYPESENSE_HOST = process.env.TYPESENSE_HOST || 'localhost';
const TYPESENSE_PORT = parseInt(process.env.TYPESENSE_PORT || '8108', 10);
const TYPESENSE_PROTOCOL = process.env.TYPESENSE_PROTOCOL || 'http';
const TYPESENSE_ADMIN_KEY = process.env.TYPESENSE_ADMIN_KEY || 'mf_admin_dev_key';
const TYPESENSE_SEARCH_ONLY_KEY = process.env.TYPESENSE_SEARCH_ONLY_KEY || 'mf_search_dev_key';

const TYPESENSE_BASE_URL = `${TYPESENSE_PROTOCOL}://${TYPESENSE_HOST}:${TYPESENSE_PORT}`;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

async function handleTypesenseSyncTrack(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    try {
      const { doc } = JSON.parse(body || '{}');
      if (!doc || !doc.id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid document' }));
        return;
      }

      // Upsert using server-side ADMIN key only
      const tsRes = await fetch(`${TYPESENSE_BASE_URL}/collections/songs/documents/${doc.id}?action=upsert`, {
        method: 'POST',
        headers: {
          'X-TYPESENSE-API-KEY': TYPESENSE_ADMIN_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(doc)
      });

      const responseData = await tsRes.json().catch(() => ({}));
      res.writeHead(tsRes.status, { 'Content-Type': 'application/json' });
    } catch (e) {
      // Return 200 with offline state to prevent console spam when local Typesense instance is not running
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, offline: true, message: e.message }));
    }
  });
}

async function handleTypesenseInitCollections(req, res) {
  try {
    const collections = [
      {
        name: 'songs',
        fields: [
          { name: 'id', type: 'string' },
          { name: 'title', type: 'string' },
          { name: 'artist', type: 'string' },
          { name: 'primary_artist', type: 'string', optional: true },
          { name: 'album', type: 'string', optional: true },
          { name: 'year', type: 'int32', optional: true },
          { name: 'duration', type: 'int32', optional: true },
          { name: 'popularity', type: 'int32', optional: true },
          { name: 'language', type: 'string', optional: true },
          { name: 'cover_art', type: 'string', optional: true },
          { name: 'audio_url', type: 'string', optional: true },
          { name: 'stream_url', type: 'string', optional: true },
          { name: 'has_lyrics', type: 'bool', optional: true },
          { name: 'provider', type: 'string', optional: true },
          { name: 'normalized_title', type: 'string', optional: true },
          { name: 'normalized_artist', type: 'string', optional: true },
          { name: 'normalized_album', type: 'string', optional: true }
        ],
        default_sorting_field: 'popularity'
      },
      {
        name: 'artists',
        fields: [
          { name: 'id', type: 'string' },
          { name: 'name', type: 'string' },
          { name: 'role', type: 'string', optional: true },
          { name: 'image', type: 'string', optional: true },
          { name: 'popularity', type: 'int32', optional: true },
          { name: 'normalized_name', type: 'string', optional: true }
        ],
        default_sorting_field: 'popularity'
      },
      {
        name: 'albums',
        fields: [
          { name: 'id', type: 'string' },
          { name: 'title', type: 'string' },
          { name: 'artist', type: 'string' },
          { name: 'image', type: 'string', optional: true },
          { name: 'year', type: 'int32', optional: true },
          { name: 'popularity', type: 'int32', optional: true }
        ],
        default_sorting_field: 'popularity'
      }
    ];

    for (const col of collections) {
      await fetch(`${TYPESENSE_BASE_URL}/collections`, {
        method: 'POST',
        headers: {
          'X-TYPESENSE-API-KEY': TYPESENSE_ADMIN_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(col)
      }).catch(() => {});
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Collections checked/initialized' }));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
}

// ============================================================================
// REAL MUSIC RECOMMENDATION INFRASTRUCTURE (Phase 5.2)
// ============================================================================
const QueryNormalizer = require('./web-app/js/queryNormalizer.js');
const StringSimilarity = require('./web-app/js/stringSimilarity.js');
const TrackDeduplicator = require('./web-app/js/trackDeduplicator.js');
const AudioFeatureExtractor = require('./web-app/js/audioFeatureExtractor.js');
const FeatureStore = require('./web-app/js/featureStore.js');
const MusicFlowEmbedder = require('./web-app/js/musicFlowEmbedder.js');
const QdrantManager = require('./qdrantManager.js');
const RecommendationEngine = require('./web-app/js/recommendationEngine.js');
const HomeDataLayer = require('./web-app/js/homeDataLayer.js');
const ExploreDataLayer = require('./web-app/js/exploreDataLayer.js');
const YouTubeMusicService = require('./web-app/js/youtubeMusicService.js');

// In-Memory Recommendation Cache (5-minute TTL)
const recCache = new Map();
function getCachedRec(key) {
  const item = recCache.get(key);
  if (item && (Date.now() - item.time < 300000)) return item.data;
  return null;
}
function setCachedRec(key, data) {
  recCache.set(key, { data, time: Date.now() });
  if (recCache.size > 200) {
    const oldestKey = recCache.keys().next().value;
    recCache.delete(oldestKey);
  }
}

async function handleGetSimilarTracks(trackId, req, res) {
  try {
    const cacheKey = `track_${trackId}`;
    const cached = getCachedRec(cacheKey);
    if (cached) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(cached));
      return;
    }

    // Resolve seed track from Typesense or JioSaavn
    let seedTrack = null;
    try {
      const tsRes = await fetch(`${TYPESENSE_BASE_URL}/collections/songs/documents/${trackId}`, {
        headers: { 'X-TYPESENSE-API-KEY': TYPESENSE_SEARCH_ONLY_KEY }
      });
      if (tsRes.ok) {
        seedTrack = await tsRes.json();
      }
    } catch (_) {}

    if (!seedTrack) {
      seedTrack = { id: trackId, name: 'Current Track', artists: 'Artist' };
    }

    // Query candidate tracks from Typesense catalog
    let candidates = [];
    try {
      const qRes = await fetch(`${TYPESENSE_BASE_URL}/collections/songs/documents/search?q=*&per_page=60`, {
        headers: { 'X-TYPESENSE-API-KEY': TYPESENSE_SEARCH_ONLY_KEY }
      });
      if (qRes.ok) {
        const json = await qRes.json();
        candidates = (json.hits || []).map(h => h.document);
      }
    } catch (_) {}

    // Index seed and candidates into Qdrant in-memory / daemon
    const seedFeatures = FeatureStore.getFeatures(seedTrack.id) || AudioFeatureExtractor.createMetadataOnlyFeatures(seedTrack);
    const seedVector = MusicFlowEmbedder.generateEmbedding(seedTrack, seedFeatures);
    QdrantManager.upsertTrackVector(seedTrack.id, seedVector, seedTrack);

    candidates.forEach(c => {
      const cFeats = FeatureStore.getFeatures(c.id) || AudioFeatureExtractor.createMetadataOnlyFeatures(c);
      const cVec = MusicFlowEmbedder.generateEmbedding(c, cFeats);
      QdrantManager.upsertTrackVector(c.id, cVec, c);
    });

    const recommendations = RecommendationEngine.getSimilarTracks(seedTrack, candidates, 20);
    const responsePayload = {
      seedTrackId: trackId,
      recommendations,
      engine: 'MusicFlow 64-dim Hybrid Ranker',
      embeddingModel: MusicFlowEmbedder.MODEL_NAME,
      vectorStore: QdrantManager.getStatus().storageMode,
      timestamp: Date.now()
    };

    setCachedRec(cacheKey, responsePayload);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(responsePayload));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
}

async function handlePersonalizedRecs(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    try {
      const payload = JSON.parse(body || '{}');
      const history = payload.history || [];
      const favorites = payload.favorites || [];
      const candidatePool = payload.candidatePool || [];

      const recommendations = RecommendationEngine.getPersonalizedRecommendations(
        history,
        favorites,
        candidatePool,
        { limit: payload.limit || 20 }
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        recommendations,
        engine: 'MusicFlow Real Personalized Ranker',
        count: recommendations.length
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
  });
}

async function handleIndexTrack(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    try {
      const { song, features } = JSON.parse(body || '{}');
      if (!song || !song.id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Song object required' }));
        return;
      }

      if (features) {
        FeatureStore.saveFeatures(song.id, features);
      }
      const activeFeatures = FeatureStore.getFeatures(song.id) || AudioFeatureExtractor.createMetadataOnlyFeatures(song);
      const vector = MusicFlowEmbedder.generateEmbedding(song, activeFeatures);
      await QdrantManager.upsertTrackVector(song.id, vector, song);
      FeatureStore.setIndexingState(song.id, FeatureStore.INDEXING_STATE.INDEXED);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, trackId: song.id, status: 'INDEXED' }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
  });
}

// ============================================================================
// YOUTUBE MUSIC INNERTUBE REVERSE PROXY (Local Web Dev CORS Bypass)
// ============================================================================
async function handleInnertubeProxy(req, res, parsedUrl) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-YouTube-Client-Name, X-YouTube-Client-Version, Authorization, Range');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const endpoint = parsedUrl.searchParams.get('endpoint') || 'next';
  if (!/^[a-zA-Z0-9_\/]+$/.test(endpoint)) {
    res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: 'Invalid Innertube endpoint parameter' }));
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    try {
      const targetUrl = `https://music.youtube.com/youtubei/v1/${endpoint}`;
      const forwardHeaders = {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'X-YouTube-Client-Name': '67',
        'X-YouTube-Client-Version': '1.20240101.01.00',
        'Origin': 'https://music.youtube.com',
        'Referer': 'https://music.youtube.com/'
      };

      let jsonPayload;
      try {
        jsonPayload = JSON.parse(body || '{}');
      } catch (_) {
        jsonPayload = {};
      }

      if (!jsonPayload.context) {
        jsonPayload.context = {
          client: {
            clientName: 'WEB_REMIX',
            clientVersion: '1.20240101.01.00',
            hl: 'en',
            gl: 'US'
          }
        };
      }

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: forwardHeaders,
        body: JSON.stringify(jsonPayload),
        signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(10000) : undefined
      });

      const responseText = await response.text();
      res.writeHead(response.status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(responseText);
    } catch (proxyErr) {
      console.warn('[InnertubeProxy] Error proxying to YouTube Music:', proxyErr.message);
      res.writeHead(502, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ error: 'Innertube proxy failed', message: proxyErr.message }));
    }
  });
}

// ============================================================================
// REAL YOUTUBE COMMENTS SERVICE
// ============================================================================
const commentsCache = new Map();

async function handleGetYouTubeComments(req, res, parsedUrl) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const videoId = parsedUrl.searchParams.get('videoId');
  if (!videoId) {
    res.writeHead(400);
    res.end(JSON.stringify({ success: false, error: 'videoId parameter required' }));
    return;
  }

  const cached = commentsCache.get(videoId);
  if (cached && (Date.now() - cached.time < 10 * 60 * 1000)) {
    res.writeHead(200);
    res.end(JSON.stringify(cached.data));
    return;
  }

  try {
    const targetUrl = 'https://www.youtube.com/youtubei/v1/next';
    const webHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'X-YouTube-Client-Name': '1',
      'X-YouTube-Client-Version': '2.20240726.01.00',
      'Origin': 'https://www.youtube.com'
    };

    const payload = {
      context: { client: { clientName: 'WEB', clientVersion: '2.20240726.01.00', hl: 'en', gl: 'US' } },
      videoId: videoId
    };

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: webHeaders,
      body: JSON.stringify(payload),
      signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(8000) : undefined
    });

    if (!response.ok) {
      throw new Error(`YouTube API returned HTTP ${response.status}`);
    }

    const data = await response.json();
    const items = data.contents?.twoColumnWatchNextResults?.results?.results?.contents || [];
    const commentsItem = items.find(i => i.itemSectionRenderer?.targetId === 'comments-section');

    if (!commentsItem) {
      const result = {
        success: true,
        enabled: false,
        countText: '0 Comments',
        comments: [],
        message: 'Comments are turned off for this track by YouTube'
      };
      commentsCache.set(videoId, { data: result, time: Date.now() });
      res.writeHead(200);
      res.end(JSON.stringify(result));
      return;
    }

    const token = commentsItem.itemSectionRenderer?.contents?.[0]?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
    if (!token) {
      const result = {
        success: true,
        enabled: false,
        countText: '0 Comments',
        comments: [],
        message: 'Comments are unavailable for this track'
      };
      commentsCache.set(videoId, { data: result, time: Date.now() });
      res.writeHead(200);
      res.end(JSON.stringify(result));
      return;
    }

    const contRes = await fetch(targetUrl, {
      method: 'POST',
      headers: webHeaders,
      body: JSON.stringify({
        context: { client: { clientName: 'WEB', clientVersion: '2.20240726.01.00', hl: 'en', gl: 'US' } },
        continuation: token
      }),
      signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(8000) : undefined
    });

    const contData = await contRes.json();
    const eps = contData.onResponseReceivedEndpoints || [];
    const header = eps[0]?.reloadContinuationItemsCommand?.continuationItems?.[0]?.commentsHeaderRenderer;
    const countText = header?.countText?.runs?.map(r => r.text).join('') || 'Comments';

    const mutations = contData.frameworkUpdates?.entityBatchUpdate?.mutations || [];
    const comments = [];

    for (const m of mutations) {
      const p = m.payload?.commentEntityPayload;
      if (p && p.properties?.content?.content) {
        comments.push({
          author: p.author?.displayName || 'YouTube User',
          text: p.properties.content.content,
          time: p.properties?.publishedTime || 'Recently',
          avatar: p.author?.avatarThumbnailUrl || 'assets/logo.png',
          likes: p.toolbar?.likeCountNotliked || p.toolbar?.likeCount || '0'
        });
      }
    }

    const result = {
      success: true,
      enabled: true,
      countText,
      comments: comments.slice(0, 30)
    };
    commentsCache.set(videoId, { data: result, time: Date.now() });
    res.writeHead(200);
    res.end(JSON.stringify(result));
  } catch (err) {
    console.warn('[YouTubeComments] Error fetching comments:', err.message);
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      enabled: false,
      countText: '0 Comments',
      comments: [],
      message: 'Comments are unavailable for this track'
    }));
  }
}

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-TYPESENSE-API-KEY, X-YouTube-Client-Name, X-YouTube-Client-Version, Authorization, Range');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  const urlPath = parsedUrl.pathname.startsWith('/api/') ? parsedUrl.pathname.replace(/\.js$/, '') : parsedUrl.pathname;

  // ============================================================================
  // JIOSAAVN SERVICE ENDPOINTS (Local, Web & Native Parity)
  // ============================================================================
  if (urlPath === '/api/search/songs' && req.method === 'GET') {
    const q = parsedUrl.searchParams.get('query') || parsedUrl.searchParams.get('q') || '';
    const page = parseInt(parsedUrl.searchParams.get('page') || parsedUrl.searchParams.get('p') || '1', 10);
    const limit = parseInt(parsedUrl.searchParams.get('limit') || parsedUrl.searchParams.get('n') || '20', 10);
    (async () => {
      try {
        const data = await jiosaavnService.searchSongs(q, page, limit);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    })();
    return;
  }

  if (urlPath === '/api/search/albums' && req.method === 'GET') {
    const q = parsedUrl.searchParams.get('query') || parsedUrl.searchParams.get('q') || '';
    const page = parseInt(parsedUrl.searchParams.get('page') || '1', 10);
    const limit = parseInt(parsedUrl.searchParams.get('limit') || '20', 10);
    (async () => {
      try {
        const data = await jiosaavnService.searchAlbums(q, page, limit);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    })();
    return;
  }

  if (urlPath === '/api/search/playlists' && req.method === 'GET') {
    const q = parsedUrl.searchParams.get('query') || parsedUrl.searchParams.get('q') || '';
    const page = parseInt(parsedUrl.searchParams.get('page') || '1', 10);
    const limit = parseInt(parsedUrl.searchParams.get('limit') || '20', 10);
    (async () => {
      try {
        const data = await jiosaavnService.searchPlaylists(q, page, limit);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    })();
    return;
  }

  if (urlPath === '/api/search/artists' && req.method === 'GET') {
    const q = parsedUrl.searchParams.get('query') || parsedUrl.searchParams.get('q') || '';
    const page = parseInt(parsedUrl.searchParams.get('page') || '1', 10);
    const limit = parseInt(parsedUrl.searchParams.get('limit') || '20', 10);
    (async () => {
      try {
        const data = await jiosaavnService.searchArtists(q, page, limit);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    })();
    return;
  }

  if (urlPath === '/api/search' && req.method === 'GET') {
    const q = parsedUrl.searchParams.get('query') || parsedUrl.searchParams.get('q') || '';
    (async () => {
      try {
        const data = await jiosaavnService.searchAll(q);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    })();
    return;
  }

  if ((urlPath.startsWith('/api/songs/') || urlPath === '/api/songs') && req.method === 'GET') {
    const id = urlPath.startsWith('/api/songs/') ? urlPath.replace('/api/songs/', '').trim() : parsedUrl.searchParams.get('id');
    (async () => {
      try {
        const data = await jiosaavnService.getSongDetails(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    })();
    return;
  }

  if ((urlPath.startsWith('/api/albums/') || urlPath === '/api/albums') && req.method === 'GET') {
    const id = urlPath.startsWith('/api/albums/') ? urlPath.replace('/api/albums/', '').trim() : parsedUrl.searchParams.get('id');
    (async () => {
      try {
        const data = await jiosaavnService.getAlbumDetails(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    })();
    return;
  }

  if ((urlPath.startsWith('/api/playlists/') || urlPath === '/api/playlists') && req.method === 'GET') {
    const id = urlPath.startsWith('/api/playlists/') ? urlPath.replace('/api/playlists/', '').trim() : parsedUrl.searchParams.get('id');
    (async () => {
      try {
        const data = await jiosaavnService.getPlaylistDetails(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    })();
    return;
  }

  if ((urlPath.startsWith('/api/artists/') || urlPath === '/api/artists') && req.method === 'GET') {
    const id = urlPath.startsWith('/api/artists/') ? urlPath.replace('/api/artists/', '').trim() : parsedUrl.searchParams.get('id');
    (async () => {
      try {
        const data = await jiosaavnService.getArtistDetails(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    })();
    return;
  }

  if (urlPath === '/api/modules' && req.method === 'GET') {
    (async () => {
      try {
        const data = await jiosaavnService.getBrowseModules();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    })();
    return;
  }

  // API Routes
  if (urlPath === '/api/recommendations/status' && req.method === 'GET') {
    const qdrantStatus = QdrantManager.getStatus();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ready',
      engine: 'MusicFlow Real Recommendation Engine v2.0',
      embeddingModel: MusicFlowEmbedder.MODEL_NAME,
      vectorDim: MusicFlowEmbedder.EMBEDDING_DIM,
      qdrant: qdrantStatus,
      featureStoreVersion: FeatureStore.CURRENT_FEATURE_VERSION,
      channels: ['vector_ann', 'same_genre', 'same_artist', 'related_artist', 'playlist_cf']
    }));
    return;
  }

  if (urlPath.startsWith('/api/recommendations/track/') && req.method === 'GET') {
    const trackId = urlPath.replace('/api/recommendations/track/', '').trim();
    handleGetSimilarTracks(trackId, req, res);
    return;
  }

  if (urlPath === '/api/recommendations/personalized' && req.method === 'POST') {
    handlePersonalizedRecs(req, res);
    return;
  }

  if (urlPath === '/api/recommendations/index-track' && req.method === 'POST') {
    handleIndexTrack(req, res);
    return;
  }

  if (urlPath === '/api/home' && req.method === 'GET') {
    (async () => {
      try {
        const homeData = await HomeDataLayer.aggregateHomeFeed();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(homeData));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    })();
    return;
  }

  if (urlPath === '/api/explore' && req.method === 'GET') {
    (async () => {
      try {
        const exploreData = await ExploreDataLayer.aggregateExploreFeed();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(exploreData));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    })();
    return;
  }

  if (urlPath.startsWith('/api/explore/genre/') && req.method === 'GET') {
    const genre = decodeURIComponent(urlPath.replace('/api/explore/genre/', '').trim());
    (async () => {
      try {
        const genreData = await ExploreDataLayer.getGenreDetails(genre);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(genreData));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    })();
    return;
  }

  if (urlPath === '/api/typesense/config' && req.method === 'GET') {
    // Only expose public search key — NEVER admin key!
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      host: TYPESENSE_HOST,
      port: TYPESENSE_PORT,
      protocol: TYPESENSE_PROTOCOL,
      searchKey: TYPESENSE_SEARCH_ONLY_KEY
    }));
    return;
  }

  if (urlPath === '/api/typesense/sync-track' && req.method === 'POST') {
    handleTypesenseSyncTrack(req, res);
    return;
  }

  if (urlPath === '/api/typesense/init-collections' && req.method === 'POST') {
    handleTypesenseInitCollections(req, res);
    return;
  }

  // ============================================================================
  // HYBRID MUSIC PROVIDER INTEGRATION ENDPOINTS (Phase 6)
  // ============================================================================
  if (urlPath === '/api/providers/health' && req.method === 'GET') {
    (async () => {
      try {
        let tsStatus = 'UNAVAILABLE';
        try {
          const tsRes = await fetch(`${TYPESENSE_BASE_URL}/health`, {
            headers: { 'X-TYPESENSE-API-KEY': TYPESENSE_SEARCH_ONLY_KEY },
            signal: AbortSignal.timeout(2000)
          });
          if (tsRes.ok) tsStatus = 'AVAILABLE';
        } catch (_) {}

        let jioStatus = 'AVAILABLE';
        try {
          const jioRes = await fetch('https://spoton-trpn.vercel.app/api/search/songs?query=test&limit=1', {
            signal: AbortSignal.timeout(3000)
          });
          if (!jioRes.ok) jioStatus = 'DEGRADED';
        } catch (_) {
          jioStatus = 'UNAVAILABLE';
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          providers: {
            jiosaavn: jioStatus,
            youtube_music: 'AVAILABLE',
            typesense: tsStatus,
            qdrant: QdrantManager.getStatus().storageMode
          },
          timestamp: Date.now()
        }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    })();
    return;
  }

  // Update Endpoint (Vercel Serverless / Node Server Handler)
  if (urlPath === '/api/update') {
    try {
      const handleUpdate = require('./api/update.js');
      handleUpdate(req, res);
      return;
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        updateAvailable: false,
        updateRequired: false,
        latestVersion: '2.7.1',
        versionCode: 28,
        minimumVersion: '1.0.0'
      }));
      return;
    }
  }

  // YouTube Music Stream Resolution Endpoint
  if (urlPath === '/api/providers/ytmusic/stream') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { videoId } = JSON.parse(body || '{}');
          const streamData = await YouTubeMusicService.getStreamUrl(videoId);
          if (streamData && streamData.url) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(streamData));
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'STREAM_NOT_FOUND', message: 'No valid audio stream found for videoId' }));
          }
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    } else if (req.method === 'GET') {
      const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const videoId = urlObj.searchParams.get('videoId') || urlObj.searchParams.get('id');
      (async () => {
        try {
          const streamData = await YouTubeMusicService.getStreamUrl(videoId);
          if (streamData && streamData.url) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(streamData));
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'STREAM_NOT_FOUND', message: 'No valid audio stream found for videoId' }));
          }
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      })();
      return;
    }
  }

  if (urlPath === '/api/providers/ytmusic/search' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { query, limit } = JSON.parse(body || '{}');
        const results = await YouTubeMusicService.search(query, limit || 30);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(results));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message, songs: [], artists: [], albums: [], playlists: [] }));
      }
    });
    return;
  }

  if (urlPath === '/api/providers/ytmusic/radio' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { videoId, title, artist, limit } = JSON.parse(body || '{}');
        const results = await YouTubeMusicService.getRadioCandidates(videoId, title, artist, limit || 25);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(results));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message, candidates: [] }));
      }
    });
    return;
  }

  if (urlPath === '/api/providers/ytmusic/artist' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { browseId, name } = JSON.parse(body || '{}');
        const results = await YouTubeMusicService.getArtist(browseId, name);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(results));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message, artist: null }));
      }
    });
    return;
  }

  if (urlPath === '/api/providers/ytmusic/album' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { browseId } = JSON.parse(body || '{}');
        const results = await YouTubeMusicService.getAlbum(browseId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(results));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message, album: null }));
      }
    });
    return;
  }

  if (urlPath === '/api/providers/ytmusic/playlist' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { playlistId } = JSON.parse(body || '{}');
        const results = await YouTubeMusicService.getPlaylist(playlistId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(results));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message, playlist: null }));
      }
    });
    return;
  }

  if (urlPath === '/api/providers/ytmusic/import-track') {
    const handleImportTrack = require('./api/providers/ytmusic/import-track.js');
    handleImportTrack(req, res);
    return;
  }

  if (urlPath === '/api/providers/ytmusic/import-playlist') {
    const handleImportPlaylist = require('./api/providers/ytmusic/import-playlist.js');
    handleImportPlaylist(req, res);
    return;
  }

  if (urlPath === '/api/providers/health') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    (async () => {
      let saavnStatus = 'AVAILABLE';
      try {
        const saavnRes = await fetch('https://spoton-trpn.vercel.app/api/search/songs?query=test&limit=1', {
          signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(4000) : undefined
        });
        if (!saavnRes.ok) saavnStatus = 'SAAVN_PROVIDER_UNAVAILABLE';
      } catch (_) {
        saavnStatus = 'SAAVN_PROVIDER_UNAVAILABLE';
      }

      let tsStatus = 'UNAVAILABLE';
      try {
        const tsRes = await fetch(`${TYPESENSE_BASE_URL}/health`, {
          signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(1000) : undefined
        });
        if (tsRes.ok) tsStatus = 'AVAILABLE';
      } catch (_) {}

      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'OK',
        timestamp: Date.now(),
        providers: {
          jiosaavn: { status: saavnStatus },
          youtube_music: { status: 'AVAILABLE' },
          typesense: { status: tsStatus }
        }
      }));
    })();
    return;
  }

  if (urlPath === '/api/proxy/innertube') {
    handleInnertubeProxy(req, res, parsedUrl);
    return;
  }

  if (urlPath === '/api/youtube/comments' && req.method === 'GET') {
    handleGetYouTubeComments(req, res, parsedUrl);
    return;
  }

  if (urlPath === '/api/proxy/stream' && req.method === 'GET') {
    const targetUrl = parsedUrl.searchParams.get('url');
    if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Valid target url parameter required' }));
      return;
    }

    try {
      const isHttps = targetUrl.startsWith('https://');
      const client = isHttps ? https : http;
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'identity;q=1, *;q=0'
      };

      if (req.headers.range) {
        headers['Range'] = req.headers.range;
      }

      const proxyReq = client.get(targetUrl, { headers }, (proxyRes) => {
        const outHeaders = {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Range, Accept, Content-Type',
          'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
          'Accept-Ranges': 'bytes',
          'Content-Type': proxyRes.headers['content-type'] || 'audio/mp4'
        };

        if (proxyRes.headers['content-length']) {
          outHeaders['Content-Length'] = proxyRes.headers['content-length'];
        }
        if (proxyRes.headers['content-range']) {
          outHeaders['Content-Range'] = proxyRes.headers['content-range'];
        }

        res.writeHead(proxyRes.statusCode || 200, outHeaders);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: 'Audio stream proxy failed', details: err.message }));
        }
      });
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: err.message }));
      }
    }
    return;
  }

  if (urlPath === '/api/download/proxy' && req.method === 'GET') {
    const targetUrl = parsedUrl.searchParams.get('url');
    if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Valid target url parameter required' }));
      return;
    }
    try {
      const isHttps = targetUrl.startsWith('https://');
      const client = isHttps ? https : http;
      const proxyReq = client.get(targetUrl, (proxyRes) => {
        const headers = {
          'Content-Type': proxyRes.headers['content-type'] || 'audio/mpeg',
          'Access-Control-Allow-Origin': '*',
          'Accept-Ranges': 'bytes'
        };
        if (proxyRes.headers['content-length']) {
          headers['Content-Length'] = proxyRes.headers['content-length'];
        }
        res.writeHead(proxyRes.statusCode || 200, headers);
        proxyRes.pipe(res);
      });
      proxyReq.on('error', (err) => {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Proxy request failed', details: err.message }));
        }
      });
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    }
    return;
  }

  if (urlPath === '/api/update') {
    handleUpdateRequest(req, res);
    return;
  }

  let reqPath = urlPath;
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const filePath = path.join(PUBLIC_DIR, reqPath);
  const resolvedPath = path.resolve(filePath);
  const resolvedPublicDir = path.resolve(PUBLIC_DIR);

  // Path Traversal Security Hardening (P1 fix)
  // Guard: API routes must never return HTML
  if (urlPath.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ success: false, error: 'API route not found', path: urlPath }));
    return;
  }

  if (!resolvedPath.startsWith(resolvedPublicDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(resolvedPath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexPath, (indexErr, content) => {
        if (indexErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
        } else {
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          });
          res.end(content);
        }
      });
      return;
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(resolvedPath, (readErr, data) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      } else {
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        res.end(data);
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`\n========================================================`);
  console.log(`🎵 MUSICFLOW WEB APPLICATION RUNNING LOCALLY`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`========================================================\n`);
});
