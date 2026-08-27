// ============================================================================
// MUSICFLOW — REAL HYBRID RECOMMENDATION & MULTI-CHANNEL RANKER (Phase 5.2)
// Combines 64-dim Vector ANN, Multi-Channel Recall, Short/Long-Term User Profiling,
// and Diversity Enforcement.
// ============================================================================

const RecommendationEngine = (() => {

  // Configurable Hybrid Ranker Weights
  const Weights = {
    vectorSimilarity: 0.30,
    artistRelevance: 0.20,
    genreRelevance: 0.15,
    userAffinity: 0.15,
    playlistRelevance: 0.10,
    popularity: 0.05,
    freshness: 0.05,
    skipPenaltyWeight: 0.25,
    repetitionPenaltyWeight: 0.15
  };

  const RELATED_ARTISTS_GRAPH = {
    'the weeknd': ['drake', 'travis scott', 'post malone', 'dua lipa', 'daft punk', 'kanye west', 'sza', 'charlie puth'],
    'arijit singh': ['pritam', 'shreya ghoshal', 'atif aslam', 'mohit chauhan', 'kk', 'darshan raval', 'jubin nautiyal', 'jasleen royal'],
    'ed sheeran': ['shawn mendes', 'charlie puth', 'taylor swift', 'justin bieber', 'james arthur', 'lewis capaldi', 'sam smith'],
    'taylor swift': ['olivia rodrigo', 'ed sheeran', 'billie eilish', 'sabrina carpenter', 'katy perry', 'ariana grande', 'selena gomez'],
    'drake': ['travis scott', 'the weeknd', 'future', '21 savage', 'kendrick lamar', 'post malone', 'kanye west', 'lil baby'],
    'travis scott': ['drake', 'future', 'don toliver', 'playboi carti', 'kanye west', 'asap rocky', 'metro boomin'],
    'shreya ghoshal': ['arijit singh', 'sonu nigam', 'sunidhi chauhan', 'alka yagnik', 'pritam', 'shaan', 'mohit chauhan'],
    'pritam': ['arijit singh', 'kk', 'mohit chauhan', 'atif aslam', 'shreya ghoshal', 'badshah', 'vishal-shekhar'],
    'badshah': ['yo yo honey singh', 'diljit dosanjh', 'karan aujla', 'raftaar', 'divine', 'neha kakkar', 'guru randhawa'],
    'diljit dosanjh': ['karan aujla', 'sidhu moose wala', 'ap dhillon', 'badshah', 'amrinder gill', 'guru randhawa'],
    'atif aslam': ['arijit singh', 'rahat fateh ali khan', 'mustafa zahid', 'ali zafar', 'kk', 'mohit chauhan'],
    'karan aujla': ['diljit dosanjh', 'sidhu moose wala', 'ap dhillon', 'shubh', 'ikky'],
    'sidhu moose wala': ['karan aujla', 'amrit maan', 'premy', 'ap dhillon', 'bohemia'],
    'coldplay': ['imagine dragons', 'one republic', 'the chainsmokers', 'keane', 'maroon 5', 'u2'],
    'imagine dragons': ['coldplay', 'fall out boy', 'one republic', 'bastille', 'twenty one pilots', 'linkin park'],
    'ac/dc': ['guns n roses', 'led zeppelin', 'aerosmith', 'black sabbath', 'metallica', 'queen', 'iron maiden'],
    'guns n roses': ['ac/dc', 'aerosmith', 'bon jovi', 'metallica', 'def leppard', 'queen']
  };

  function getEmbedder() {
    if (typeof MusicFlowEmbedder !== 'undefined') return MusicFlowEmbedder;
    if (typeof require !== 'undefined') {
      try { return require('./musicFlowEmbedder.js'); } catch (_) {}
      try { return require('./js/musicFlowEmbedder.js'); } catch (_) {}
    }
    return null;
  }

  function getFeatureStore() {
    if (typeof FeatureStore !== 'undefined') return FeatureStore;
    if (typeof require !== 'undefined') {
      try { return require('./featureStore.js'); } catch (_) {}
      try { return require('./js/featureStore.js'); } catch (_) {}
    }
    return null;
  }

  function getTrackDeduplicator() {
    return (typeof TrackDeduplicator !== 'undefined') ? TrackDeduplicator : {
      cleanArtistName: (a) => String(a || '').split(/[,&/]/)[0].trim().toLowerCase(),
      deduplicate: (arr) => arr
    };
  }

  function computeArtistSimilarity(artistA, artistB) {
    const TD = getTrackDeduplicator();
    const a = TD.cleanArtistName(artistA);
    const b = TD.cleanArtistName(artistB);

    if (!a || !b) return 0.0;
    if (a === b) return 1.0;
    if (a.includes(b) || b.includes(a)) return 0.85;

    const relA = RELATED_ARTISTS_GRAPH[a] || [];
    if (relA.includes(b)) return 0.75;

    const relB = RELATED_ARTISTS_GRAPH[b] || [];
    if (relB.includes(a)) return 0.75;

    return 0.0;
  }

  // Multi-Channel Candidate Generation
  function generateCandidates(seedTrack, candidatePool = [], options = {}) {
    if (!seedTrack || !Array.isArray(candidatePool) || candidatePool.length === 0) return [];
    const Embedder = getEmbedder();
    const Store = getFeatureStore();
    const TD = getTrackDeduplicator();
    const TD_clean = TD.cleanArtistName;

    const seedFeatures = Store ? Store.getFeatures(seedTrack.id) : null;
    const seedVector = Embedder ? Embedder.generateEmbedding(seedTrack, seedFeatures) : null;
    const seedArtist = TD_clean(seedTrack.artists || seedTrack.primaryArtist);
    const seedLang = (seedTrack.language || 'english').toLowerCase();
    const relatedList = (RELATED_ARTISTS_GRAPH[seedArtist] || []).map(a => a.toLowerCase());

    const candidateMap = new Map();

    function recordCandidate(song, channel, score) {
      if (!song || !song.id || String(song.id) === String(seedTrack.id)) return;
      const id = String(song.id);
      if (!candidateMap.has(id)) {
        candidateMap.set(id, { song, channels: new Set(), channelScores: {} });
      }
      const entry = candidateMap.get(id);
      entry.channels.add(channel);
      entry.channelScores[channel] = Math.max(entry.channelScores[channel] || 0, score);
    }

    candidatePool.forEach(cand => {
      if (String(cand.id) === String(seedTrack.id)) return;
      const candArtist = TD_clean(cand.artists || cand.primaryArtist);
      const candLang = (cand.language || 'english').toLowerCase();

      // Channel 1: 64-dim Vector Similarity (Qdrant / In-memory ANN)
      if (Embedder && seedVector) {
        const candFeatures = Store ? Store.getFeatures(cand.id) : null;
        const candVector = Embedder.generateEmbedding(cand, candFeatures);
        const sim = Embedder.cosineSimilarity(seedVector, candVector);
        if (sim > 0.40) {
          recordCandidate(cand, 'vector_ann', sim);
          recordCandidate(cand, 'acoustic', sim);
        }
      }

      // Channel 2: Same Artist
      if (candArtist === seedArtist || candArtist.includes(seedArtist) || seedArtist.includes(candArtist)) {
        recordCandidate(cand, 'same_artist', 0.95);
      }

      // Channel 3: Related Artist Graph
      if (relatedList.includes(candArtist)) {
        recordCandidate(cand, 'related_artist', 0.80);
      }

      // Channel 4: Genre / Language Cluster
      if (candLang === seedLang) {
        const pop = (cand.popularity ? Number(cand.popularity) : 60) / 100.0;
        recordCandidate(cand, 'genre_cluster', 0.65 + (pop * 0.25));
      }
    });

    return Array.from(candidateMap.values()).map(entry => ({
      song: entry.song,
      sources: Array.from(entry.channels),
      channelScores: entry.channelScores
    }));
  }

  // Hybrid Personalized Recommendations with Short/Long-Term Profiling
  function getPersonalizedRecommendations(
    userHistory = [],
    userFavorites = [],
    candidatePool = [],
    options = {}
  ) {
    if (!Array.isArray(candidatePool) || candidatePool.length === 0) return [];
    const limit = options.limit || 20;
    const Embedder = getEmbedder();
    const Store = getFeatureStore();
    const TD = getTrackDeduplicator();
    const TD_clean = TD.cleanArtistName;

    // Retrieve User Signals
    let userSignals = {
      artistScores: {},
      languageScores: {},
      skippedSongCounts: {},
      skippedArtistCounts: {},
      milestones: {},
      totalSignals: 0
    };
    let recentDelivered = [];
    if (typeof Storage !== 'undefined' && typeof Storage.getUserTasteSignals === 'function') {
      userSignals = Storage.getUserTasteSignals();
      recentDelivered = (Storage.getRecentDeliveredRecommendations() || []).map(r => String(r.id));
    }

    const { artistScores, languageScores, skippedSongCounts, skippedArtistCounts, milestones } = userSignals;

    // Cold-Start handling
    const isColdStart = (userHistory.length === 0 && userFavorites.length === 0 && userSignals.totalSignals === 0);
    if (isColdStart) {
      const sortedByPop = [...candidatePool].sort((a, b) => (b.popularity || 70) - (a.popularity || 70));
      const dedup = TD.deduplicate(sortedByPop);
      const coldResults = [];
      const artCount = {};
      for (const s of dedup) {
        const art = TD_clean(s.artists || s.primaryArtist);
        if ((artCount[art] || 0) < 2) {
          coldResults.push({
            song: s,
            score: 0.85,
            reason: 'Trending music in catalog',
            provenance: 'METADATA_DERIVED'
          });
          artCount[art] = (artCount[art] || 0) + 1;
        }
        if (coldResults.length >= limit) break;
      }
      return coldResults;
    }

    const recentDeliveredSet = new Set(recentDelivered);
    const knownSongIds = new Set([...userFavorites, ...userHistory].map(s => String(s.id)));
    const mostRecentSong = userHistory[0] || userFavorites[0] || null;
    const seedFeatures = (mostRecentSong && Store) ? Store.getFeatures(mostRecentSong.id) : null;
    const seedVector = (mostRecentSong && Embedder) ? Embedder.generateEmbedding(mostRecentSong, seedFeatures) : null;

    // Score all candidate tracks using Hybrid Multi-Weight Ranker
    const scoredCandidates = candidatePool.map(cand => {
      const candId = String(cand.id);
      const candArtist = TD_clean(cand.artists || cand.primaryArtist);
      const candLang = (cand.language || 'english').toLowerCase();
      const candFeatures = Store ? Store.getFeatures(candId) : null;

      // 1. Vector Similarity (64-dim embedding)
      let vecSim = 0.5;
      if (Embedder && seedVector) {
        const candVec = Embedder.generateEmbedding(cand, candFeatures);
        vecSim = Embedder.cosineSimilarity(seedVector, candVec);
      }

      // 2. Artist Relevance (Long-Term Library Affinity + Short-Term History)
      let artistScore = 0.0;
      if (artistScores[candArtist]) {
        artistScore = Math.min(1.0, artistScores[candArtist] / 5.0);
      } else if (mostRecentSong) {
        artistScore = computeArtistSimilarity(mostRecentSong.artists || mostRecentSong.primaryArtist, cand.artists || cand.primaryArtist);
      }

      // 3. Genre / Language Relevance
      let genreScore = 0.5;
      if (languageScores[candLang]) {
        genreScore = Math.min(1.0, 0.6 + (languageScores[candLang] / 10.0));
      }

      // 4. User Affinity (Likes + Completed Play milestone bonuses)
      const isFav = userFavorites.some(f => String(f.id) === candId);
      const milestone = milestones[candId];
      const completionBonus = (milestone && milestone.completions > 0) ? 0.3 : 0.0;
      const userAffinityScore = (isFav ? 0.8 : 0.2) + completionBonus;

      // 5. Popularity & Freshness
      const popScore = (cand.popularity ? Number(cand.popularity) : 65) / 100.0;
      const freshnessScore = !knownSongIds.has(candId) ? 1.0 : 0.2;

      // 6. Penalties: Repeated Skips & Repetition Suppression
      const skipsOnTrack = skippedSongCounts[candId] || 0;
      const skipsOnArtist = skippedArtistCounts[candArtist] || 0;
      const skipPenalty = (skipsOnTrack * 0.40) + Math.min(0.30, skipsOnArtist * 0.10);
      const repetitionPenalty = recentDeliveredSet.has(candId) ? 0.35 : 0.0;

      // Final Composite Hybrid Formula
      const totalScore = (vecSim * Weights.vectorSimilarity) +
        (artistScore * Weights.artistRelevance) +
        (genreScore * Weights.genreRelevance) +
        (userAffinityScore * Weights.userAffinity) +
        (popScore * Weights.popularity) +
        (freshnessScore * Weights.freshness) -
        (skipPenalty * Weights.skipPenaltyWeight) -
        (repetitionPenalty * Weights.repetitionPenaltyWeight);

      // Provenance & Reason
      const featureProv = candFeatures?.source || 'METADATA_DERIVED';
      let reason = 'Recommended for you';
      if (isFav) reason = 'From your Liked Songs';
      else if (artistScores[candArtist] > 2.0) reason = `From your top artist ${cand.artists || cand.primaryArtist}`;
      else if (mostRecentSong && vecSim > 0.7) reason = `Similar style to ${mostRecentSong.name}`;
      else if (languageScores[candLang] > 2.0) reason = `Popular in ${cand.language || 'your favorite style'}`;

      return {
        song: cand,
        score: Math.max(0.01, totalScore),
        reason,
        provenance: featureProv
      };
    });

    scoredCandidates.sort((a, b) => b.score - a.score);

    // Apply Track Deduplication & Artist Diversity Cap (Max 2 per artist in top picks)
    const deduplicated = TD.deduplicate(scoredCandidates.map(c => c.song));
    const finalRecs = [];
    const artistCount = {};

    for (const song of deduplicated) {
      const art = TD_clean(song.artists || song.primaryArtist);
      const count = artistCount[art] || 0;
      if (count < 2) {
        const item = scoredCandidates.find(c => String(c.song.id) === String(song.id));
        finalRecs.push(item || { song, score: 0.8, reason: 'Recommended for you', provenance: 'METADATA_DERIVED' });
        artistCount[art] = count + 1;
      }
      if (finalRecs.length >= limit) break;
    }

    return finalRecs;
  }

  // Similar Songs ("More Like This")
  function getSimilarTracks(seedSong, candidatePool = [], limit = 20) {
    if (!seedSong || !Array.isArray(candidatePool) || candidatePool.length === 0) return [];
    const candidates = generateCandidates(seedSong, candidatePool, { limit: 50 });
    const TD = getTrackDeduplicator();

    const scored = candidates.map(c => {
      const vecSim = c.channelScores['vector_ann'] || 0.5;
      const sameArt = c.channelScores['same_artist'] ? 0.25 : 0.0;
      const relArt = c.channelScores['related_artist'] ? 0.20 : 0.0;
      const genre = c.channelScores['genre_cluster'] ? 0.15 : 0.0;

      const score = (vecSim * 0.50) + sameArt + relArt + genre;
      let reason = `Similar style to ${seedSong.name}`;
      if (sameArt > 0) reason = `More from ${seedSong.artists || 'this artist'}`;
      else if (relArt > 0) reason = `From related artists`;

      return { song: c.song, score, reason };
    });

    scored.sort((a, b) => b.score - a.score);
    const dedup = TD.deduplicate(scored.map(s => s.song));
    const results = [];
    const artCount = {};

    for (const song of dedup) {
      const art = TD.cleanArtistName(song.artists || song.primaryArtist);
      if ((artCount[art] || 0) < 3) {
        const item = scored.find(s => String(s.song.id) === String(song.id));
        results.push(item || { song, score: 0.75, reason: `Similar to ${seedSong.name}` });
        artCount[art] = (artCount[art] || 0) + 1;
      }
      if (results.length >= limit) break;
    }

    return results;
  }

  // Continuous Song Radio Queue
  function getTrackRadio(seedSong, candidatePool = [], limit = 25) {
    if (!seedSong) return candidatePool.slice(0, limit);
    const similar = getSimilarTracks(seedSong, candidatePool, limit);
    const radioQueue = [seedSong];
    similar.forEach(item => {
      if (String(item.song.id) !== String(seedSong.id)) {
        radioQueue.push(item.song);
      }
    });
    return radioQueue;
  }

  function recordInteraction(eventType, payload = {}) {
    if (!eventType) return;
    if (typeof Storage !== 'undefined' && typeof Storage.recordTasteSignal === 'function') {
      Storage.recordTasteSignal(eventType, payload);
    }
  }

  return {
    Weights,
    computeArtistSimilarity,
    generateCandidates,
    getPersonalizedRecommendations,
    getSimilarTracks,
    getTrackRadio,
    buildRadioQueue: getTrackRadio,
    recordInteraction
  };
})();

if (typeof window !== 'undefined') {
  window.RecommendationEngine = RecommendationEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RecommendationEngine;
}
