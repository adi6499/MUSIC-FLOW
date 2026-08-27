// ============================================================================
// MUSICFLOW — QDRANT VECTOR MANAGER & ANN RETRIEVAL ENGINE (Phase 5.2)
// Connects to Qdrant Vector DB with zero-crash in-memory ANN fallback.
// ============================================================================

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || '';
const COLLECTION_NAME = 'musicflow_tracks';
const VECTOR_DIM = 64;

class QdrantManager {
  constructor() {
    this.isQdrantAvailable = false;
    this.inMemoryVectorStore = new Map(); // trackId -> { vector: Float32Array, payload: Object }
    this.init();
  }

  async init() {
    try {
      const res = await fetch(`${QDRANT_URL}/collections`, {
        headers: QDRANT_API_KEY ? { 'api-key': QDRANT_API_KEY } : {},
        signal: AbortSignal.timeout(2000)
      });
      if (res.ok) {
        this.isQdrantAvailable = true;
        await this.ensureCollectionExists();
      } else {
        this.isQdrantAvailable = false;
      }
    } catch (_) {
      this.isQdrantAvailable = false;
    }
  }

  async ensureCollectionExists() {
    if (!this.isQdrantAvailable) return;
    try {
      const checkRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
        headers: QDRANT_API_KEY ? { 'api-key': QDRANT_API_KEY } : {}
      });
      if (checkRes.status === 404) {
        await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(QDRANT_API_KEY ? { 'api-key': QDRANT_API_KEY } : {})
          },
          body: JSON.stringify({
            vectors: {
              size: VECTOR_DIM,
              distance: 'Cosine'
            }
          })
        });
      }
    } catch (e) {
      console.warn('[QdrantManager] Collection creation warning:', e.message);
    }
  }

  // Upsert track vector and searchable payload
  async upsertTrackVector(trackId, vector, payload = {}) {
    if (!trackId || !vector || vector.length !== VECTOR_DIM) return false;
    const id = String(trackId);

    // 1. Always update in-memory store for instant fallback
    const vecArray = Array.from(vector);
    this.inMemoryVectorStore.set(id, {
      vector: new Float32Array(vector),
      payload: { ...payload, trackId: id, updatedAt: Date.now() }
    });

    // 2. Sync to Qdrant if available
    if (this.isQdrantAvailable) {
      try {
        const pointId = Math.abs(this._hashString(id));
        await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points?wait=true`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(QDRANT_API_KEY ? { 'api-key': QDRANT_API_KEY } : {})
          },
          body: JSON.stringify({
            points: [{
              id: pointId,
              vector: vecArray,
              payload: { ...payload, originalTrackId: id }
            }]
          })
        });
      } catch (e) {
        console.warn('[QdrantManager] Upsert to Qdrant failed, in-memory updated:', e.message);
      }
    }
    return true;
  }

  // Search top K nearest neighbors using Cosine similarity
  async searchNearestNeighbors(queryVector, limit = 20, filter = null) {
    if (!queryVector || queryVector.length !== VECTOR_DIM) return [];

    // Path A: Qdrant Server Query
    if (this.isQdrantAvailable) {
      try {
        const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(QDRANT_API_KEY ? { 'api-key': QDRANT_API_KEY } : {})
          },
          body: JSON.stringify({
            vector: Array.from(queryVector),
            limit,
            with_payload: true,
            filter: filter || undefined
          })
        });
        if (res.ok) {
          const json = await res.json();
          return (json.result || []).map(r => ({
            trackId: r.payload?.originalTrackId || String(r.id),
            score: r.score,
            payload: r.payload
          }));
        }
      } catch (e) {
        console.warn('[QdrantManager] Qdrant search failed, falling back to in-memory:', e.message);
      }
    }

    // Path B: In-Memory Cosine ANN Fallback
    const results = [];
    for (const [id, entry] of this.inMemoryVectorStore.entries()) {
      let dot = 0.0;
      for (let i = 0; i < VECTOR_DIM; i++) {
        dot += queryVector[i] * entry.vector[i];
      }
      const score = Math.max(0.0, Math.min(1.0, (dot + 1.0) / 2.0));
      results.push({
        trackId: id,
        score,
        payload: entry.payload
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  // Delete track vector
  async deleteTrackVector(trackId) {
    const id = String(trackId);
    this.inMemoryVectorStore.delete(id);
    if (this.isQdrantAvailable) {
      try {
        const pointId = Math.abs(this._hashString(id));
        await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(QDRANT_API_KEY ? { 'api-key': QDRANT_API_KEY } : {})
          },
          body: JSON.stringify({ points: [pointId] })
        });
      } catch (_) {}
    }
  }

  getStatus() {
    return {
      collection: COLLECTION_NAME,
      vectorDim: VECTOR_DIM,
      distanceMetric: 'Cosine',
      qdrantOnline: this.isQdrantAvailable,
      indexedTracksCount: this.inMemoryVectorStore.size,
      storageMode: this.isQdrantAvailable ? 'Qdrant + Memory Mirror' : 'In-Memory Vector Store (Zero-Crash Fallback)'
    };
  }

  _hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}

module.exports = new QdrantManager();
