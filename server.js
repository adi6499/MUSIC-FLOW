const http = require('http');
const fs = require('fs');
const path = require('path');

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
      res.end(JSON.stringify({ success: tsRes.ok, data: responseData }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
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

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-TYPESENSE-API-KEY');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const urlPath = req.url.split('?')[0];

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

  let reqPath = urlPath;
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const filePath = path.join(PUBLIC_DIR, reqPath);
  const resolvedPath = path.resolve(filePath);
  const resolvedPublicDir = path.resolve(PUBLIC_DIR);

  // Path Traversal Security Hardening (P1 fix)
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
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
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
        res.writeHead(200, { 'Content-Type': contentType });
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
