// ==========================================================================
// MUSICFLOW — TYPESENSE CATALOG INDEXER & SYNC SERVICE
// ==========================================================================

const fs = require('fs');
const path = require('path');
const QueryNormalizer = require('../web-app/js/queryNormalizer.js');

const CONFIG = {
  host: process.env.TYPESENSE_HOST || 'localhost',
  port: parseInt(process.env.TYPESENSE_PORT || '8108', 10),
  protocol: process.env.TYPESENSE_PROTOCOL || 'http',
  apiKey: process.env.TYPESENSE_ADMIN_KEY || process.env.TYPESENSE_API_KEY || 'mf_admin_dev_key',
  timeout: 10000
};

const baseUrl = `${CONFIG.protocol}://${CONFIG.host}:${CONFIG.port}`;

async function typesenseRequest(endpoint, method = 'GET', body = null) {
  const headers = {
    'X-TYPESENSE-API-KEY': CONFIG.apiKey,
    'Content-Type': 'application/json'
  };

  const url = `${baseUrl}${endpoint}`;
  const options = { method, headers };
  if (body) {
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const res = await fetch(url, options);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (_) {
    return text;
  }
}

async function initCollections() {
  console.log(`[Typesense Indexer] Connecting to Typesense at ${baseUrl}...`);
  const schemaPath = path.join(__dirname, 'typesense_schema.json');
  const schemaData = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

  for (const col of schemaData.collections) {
    try {
      const existing = await typesenseRequest(`/collections/${col.name}`);
      if (existing && existing.name === col.name) {
        console.log(`[Typesense Indexer] Collection '${col.name}' already exists.`);
      } else {
        console.log(`[Typesense Indexer] Creating collection '${col.name}'...`);
        const created = await typesenseRequest('/collections', 'POST', col);
        console.log(`[Typesense Indexer] Created collection '${col.name}':`, created.name || created);
      }
    } catch (e) {
      console.warn(`[Typesense Indexer] Error checking collection '${col.name}':`, e.message);
    }
  }
}

function documentFromSong(song) {
  if (!song) return null;
  const title = song.name || song.title || '';
  const artist = song.artists || song.primaryArtist || song.artist || 'Unknown Artist';
  const album = song.album || '';

  return {
    id: String(song.id || Math.random().toString(36).substring(2)),
    title: title,
    artist: artist,
    artist_id: String(song.artist_id || ''),
    album: album,
    album_id: String(song.album_id || ''),
    genre: song.genre || 'Music',
    language: song.language || 'hindi',
    release_date: song.release_date || song.year || '2024',
    year: parseInt(song.year || '2024', 10) || 2024,
    duration: parseInt(song.duration || '200', 10) || 200,
    popularity: parseInt(song.popularity || (song.hasLyrics ? '90' : '75'), 10) || 75,
    cover_art: song.image || '',
    audio_url: song.audioUrl || song.streamUrl || '',
    stream_url: song.streamUrl || song.audioUrl || '',
    has_lyrics: Boolean(song.hasLyrics),
    provider: song.provider || 'JioSaavn',
    provider_track_id: String(song.id || ''),
    normalized_title: QueryNormalizer.normalize(title),
    normalized_artist: QueryNormalizer.normalize(artist),
    normalized_album: QueryNormalizer.normalize(album)
  };
}

function documentFromArtist(artist) {
  if (!artist) return null;
  const name = artist.name || artist.title || '';
  return {
    id: String(artist.id || Math.random().toString(36).substring(2)),
    name: name,
    normalized_name: QueryNormalizer.normalize(name),
    image: artist.image || '',
    role: artist.role || 'Singer',
    popularity: parseInt(artist.popularity || '80', 10) || 80
  };
}

function documentFromAlbum(album) {
  if (!album) return null;
  const title = album.title || album.name || '';
  return {
    id: String(album.id || Math.random().toString(36).substring(2)),
    title: title,
    artist: album.artist || '',
    image: album.image || '',
    year: parseInt(album.year || '2024', 10) || 2024,
    popularity: parseInt(album.popularity || '80', 10) || 80
  };
}

async function indexSongsBatch(songs = []) {
  if (!Array.isArray(songs) || songs.length === 0) return { success: 0 };
  const docs = songs.map(documentFromSong).filter(Boolean);
  const jsonl = docs.map(d => JSON.stringify(d)).join('\n');

  try {
    const res = await fetch(`${baseUrl}/collections/songs/documents/import?action=upsert`, {
      method: 'POST',
      headers: {
        'X-TYPESENSE-API-KEY': CONFIG.apiKey,
        'Content-Type': 'text/plain'
      },
      body: jsonl
    });
    const text = await res.text();
    const imported = text.split('\n').filter(line => line.includes('"success":true')).length;
    return { total: docs.length, success: imported };
  } catch (e) {
    console.error('[Typesense Indexer] Batch import error:', e.message);
    return { total: docs.length, success: 0, error: e.message };
  }
}

async function upsertSingleSong(song) {
  const doc = documentFromSong(song);
  if (!doc) return null;
  return typesenseRequest(`/collections/songs/documents/${doc.id}?action=upsert`, 'POST', doc);
}

// Bulk Indexing from Active Music API (Bollywood, English, Pop, Punjabi, Classics)
async function bulkIndexActiveCatalog() {
  const API = require('../web-app/js/api.js');
  console.log('\n[Typesense Indexer] Starting active catalog harvest & indexing...');

  const queries = [
    'Top 50 Hindi Hits 2024',
    'Top 50 English Hits 2024',
    'Top 50 Punjabi Hits 2024',
    'The Weeknd Hits',
    'Arijit Singh Best Songs',
    'Ed Sheeran Greatest Hits',
    'Taylor Swift All Songs',
    'Drake Top Tracks',
    'Diljit Dosanjh Hits',
    'Shreya Ghoshal Hits',
    'AC/DC Classics',
    'Guns N Roses Best Of',
    'Coldplay Top Hits',
    'Imagine Dragons Hits',
    'Kishore Kumar Classics',
    'Lata Mangeshkar Best'
  ];

  let totalIndexed = 0;
  for (const q of queries) {
    try {
      console.log(`Harvesting "${q}"...`);
      const songs = await API.searchSongs(q, 1, 30);
      if (songs && songs.length > 0) {
        const res = await indexSongsBatch(songs);
        console.log(`  -> Indexed ${res.success} / ${res.total} tracks.`);
        totalIndexed += (res.success || 0);
      }
    } catch (e) {
      console.warn(`  Failed for "${q}":`, e.message);
    }
  }

  console.log(`\n✅ Bulk Indexing Completed! Total Songs Ingested: ${totalIndexed}`);
}

module.exports = {
  CONFIG,
  initCollections,
  documentFromSong,
  documentFromArtist,
  documentFromAlbum,
  indexSongsBatch,
  upsertSingleSong,
  bulkIndexActiveCatalog
};

if (require.main === module) {
  (async () => {
    try {
      await initCollections();
      await bulkIndexActiveCatalog();
    } catch (e) {
      console.error('[Typesense Indexer] Failed:', e);
    }
  })();
}
