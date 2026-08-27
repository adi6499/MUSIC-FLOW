package com.example.musicflow.data.recommendation

import com.example.musicflow.data.model.Song
import com.example.musicflow.data.search.QueryNormalizer
import com.example.musicflow.data.search.StringSimilarity
import com.example.musicflow.data.search.TrackDeduplicator

data class ScoredRecommendation(
    val song: Song,
    val totalScore: Double,
    val artistSimilarity: Double,
    val contentSimilarity: Double,
    val userAffinity: Double,
    val cooccurrenceScore: Double,
    val freshnessBonus: Double
)

object RecommendationEngine {

    // Configurable Recommendation Weights (Embeat Hybrid Model)
    object Weights {
        var artistSimilarity = 0.25
        var contentSimilarity = 0.25
        var userAffinity = 0.20
        var cooccurrence = 0.20
        var freshness = 0.10
    }

    // Artist Relatedness Graph (Curated semantic peer mapping for high-quality recommendations)
    private val RELATED_ARTISTS_GRAPH = mapOf(
        "the weeknd" to listOf("drake", "travis scott", "post malone", "dua lipa", "daft punk", "kanye west", "sza", "charlie puth"),
        "arijit singh" to listOf("pritam", "shreya ghoshal", "atif aslam", "mohit chauhan", "kk", "darshan raval", "jubin nautiyal", "jasleen royal"),
        "ed sheeran" to listOf("shawn mendes", "charlie puth", "taylor swift", "justin bieber", "james arthur", "lewis capaldi", "sam smith"),
        "taylor swift" to listOf("olivia rodrigo", "ed sheeran", "billie eilish", "sabrina carpenter", "katy perry", "ariana grande", "selena gomez"),
        "drake" to listOf("travis scott", "the weeknd", "future", "21 savage", "kendrick lamar", "post malone", "kanye west", "lil baby"),
        "travis scott" to listOf("drake", "future", "don toliver", "playboi carti", "kanye west", "asap rocky", "metro boomin"),
        "shreya ghoshal" to listOf("arijit singh", "sonu nigam", "sunidhi chauhan", "alka yagnik", "pritam", "shaan", "mohit chauhan"),
        "pritam" to listOf("arijit singh", "kk", "mohit chauhan", "atif aslam", "shreya ghoshal", "badshah", "vishal-shekhar"),
        "badshah" to listOf("yo yo honey singh", "diljit dosanjh", "karan aujla", "raftaar", "divine", "neha kakkar", "guru randhawa"),
        "diljit dosanjh" to listOf("karan aujla", "sidhu moose wala", "ap dhillon", "badshah", "amrinder gill", "guru randhawa"),
        "atif aslam" to listOf("arijit singh", "rahat fateh ali khan", "mustafa zahid", "ali zafar", "kk", "mohit chauhan"),
        "karan aujla" to listOf("diljit dosanjh", "sidhu moose wala", "ap dhillon", "shubh", "ikky"),
        "sidhu moose wala" to listOf("karan aujla", "amrit maan", "premy", "ap dhillon", "bohemia"),
        "coldplay" to listOf("imagine dragons", "one republic", "the chainsmokers", "keane", "maroon 5", "u2"),
        "imagine dragons" to listOf("coldplay", "fall out boy", "one republic", "bastille", "twenty one pilots", "linkin park"),
        "ac/dc" to listOf("guns n roses", "led zeppelin", "aerosmith", "black sabbath", "metallica", "queen", "iron maiden"),
        "guns n roses" to listOf("ac/dc", "aerosmith", "bon jovi", "metallica", "def leppard", "queen")
    )

    /**
     * Computes the similarity between two artists based on exact match or related graph.
     */
    fun computeArtistSimilarity(artistA: String, artistB: String): Double {
        val a = QueryNormalizer.normalize(artistA)
        val b = QueryNormalizer.normalize(artistB)

        if (a.isBlank() || b.isBlank()) return 0.0
        if (a == b) return 1.0
        if (a.contains(b) || b.contains(a)) return 0.85

        // Check related graph
        val relatedToA = RELATED_ARTISTS_GRAPH[a] ?: emptyList()
        if (relatedToA.contains(b)) return 0.70

        val relatedToB = RELATED_ARTISTS_GRAPH[b] ?: emptyList()
        if (relatedToB.contains(a)) return 0.70

        // Substring / token match
        return StringSimilarity.computeMatchScore(a, b) * 0.50
    }

    /**
     * Computes content/metadata similarity between two songs (language, album, era).
     */
    fun computeContentSimilarity(songA: Song, songB: Song): Double {
        var score = 0.0
        var factors = 0

        // 1. Language matching (strong signal)
        if (songA.language.isNotBlank() && songB.language.isNotBlank()) {
            if (songA.language.equals(songB.language, ignoreCase = true)) {
                score += 1.0
            }
            factors++
        }

        // 2. Era / Year proximity
        val yearA = songA.year.toIntOrNull()
        val yearB = songB.year.toIntOrNull()
        if (yearA != null && yearB != null && yearA > 1900 && yearB > 1900) {
            val diff = kotlin.math.abs(yearA - yearB)
            val yearScore = (1.0 - (diff / 15.0)).coerceIn(0.0, 1.0)
            score += yearScore
            factors++
        }

        // 3. Album or Duration similarity
        if (songA.duration > 0 && songB.duration > 0) {
            val durDiff = kotlin.math.abs(songA.duration - songB.duration)
            val durScore = if (durDiff < 60) 1.0 else if (durDiff < 120) 0.6 else 0.2
            score += durScore
            factors++
        }

        return if (factors > 0) score / factors else 0.5
    }

    /**
     * Builds personalized user recommendations combining history, favorites, diversity rules, and negative skip signals.
     */
    fun getPersonalizedRecommendations(
        userHistory: List<Song>,
        userFavorites: List<Song>,
        candidatePool: List<Song>,
        skippedSongIds: Set<String> = emptySet(),
        limit: Int = 20
    ): List<Song> {
        if (candidatePool.isEmpty()) return emptyList()

        // 1. Build User Profile / Affinity Vectors
        val userSongs = (userFavorites + userHistory.take(25)).distinctBy { it.id }
        val favoriteArtistCounts = mutableMapOf<String, Int>()
        val favoriteLanguages = mutableMapOf<String, Int>()

        for (s in userSongs) {
            val normArt = TrackDeduplicator.cleanArtistName(s.artists)
            if (normArt.isNotBlank()) {
                favoriteArtistCounts[normArt] = (favoriteArtistCounts[normArt] ?: 0) + 1
            }
            if (s.language.isNotBlank()) {
                val lang = s.language.lowercase()
                favoriteLanguages[lang] = (favoriteLanguages[lang] ?: 0) + 1
            }
        }

        val totalArtistListens = favoriteArtistCounts.values.sum().coerceAtLeast(1)
        val knownSongIds = userSongs.map { it.id }.toSet()

        // 2. Score each candidate
        val scoredList = candidatePool
            .filter { !skippedSongIds.contains(it.id) }
            .map { candidate ->
                val candArtist = TrackDeduplicator.cleanArtistName(candidate.artists)

                // A. User Affinity Score
                var userAffinity = 0.0
                if (favoriteArtistCounts.containsKey(candArtist)) {
                    userAffinity = (favoriteArtistCounts[candArtist]!!.toDouble() / totalArtistListens).coerceIn(0.0, 1.0)
                } else {
                    // Check if related to any favorite artist
                    for ((favArt, count) in favoriteArtistCounts) {
                        val rel = computeArtistSimilarity(favArt, candArtist)
                        if (rel > 0.4) {
                            userAffinity = maxOf(userAffinity, rel * (count.toDouble() / totalArtistListens))
                        }
                    }
                }

                // B. Content / Language Score
                var contentScore = 0.5
                if (candidate.language.isNotBlank() && favoriteLanguages.containsKey(candidate.language.lowercase())) {
                    contentScore = 0.9
                }

                // C. Artist Similarity with most recent listen
                val mostRecent = userHistory.firstOrNull()
                val artistSim = if (mostRecent != null) computeArtistSimilarity(mostRecent.artists, candidate.artists) else 0.5

                // D. Freshness Bonus (Higher for songs not yet played by user)
                val freshness = if (!knownSongIds.contains(candidate.id)) 1.0 else 0.2

                // E. Co-occurrence / Popularity baseline
                val cooccurrence = if (candidate.streamUrl.isNotBlank()) 0.8 else 0.4

                val totalScore = (artistSim * Weights.artistSimilarity) +
                        (contentScore * Weights.contentSimilarity) +
                        (userAffinity * Weights.userAffinity) +
                        (cooccurrence * Weights.cooccurrence) +
                        (freshness * Weights.freshness)

                ScoredRecommendation(candidate, totalScore, artistSim, contentScore, userAffinity, cooccurrence, freshness)
            }
            .sortedByDescending { it.totalScore }

        // 3. Apply Diversity & Anti-Fatigue Filtering (Max 2 songs per artist in the top output)
        val deduplicatedCandidates = TrackDeduplicator.deduplicate(scoredList.map { it.song })
        val finalRecommendations = mutableListOf<Song>()
        val artistFrequency = mutableMapOf<String, Int>()

        for (song in deduplicatedCandidates) {
            val art = TrackDeduplicator.cleanArtistName(song.artists)
            val currentCount = artistFrequency[art] ?: 0

            if (currentCount < 2) {
                finalRecommendations.add(song)
                artistFrequency[art] = currentCount + 1
            }

            if (finalRecommendations.size >= limit) break
        }

        return finalRecommendations
    }

    /**
     * Generates a dynamic Artist / Track Radio queue from a seed track.
     */
    fun getTrackRadio(
        seedSong: Song,
        candidatePool: List<Song>,
        limit: Int = 25
    ): List<Song> {
        val seedArtist = TrackDeduplicator.cleanArtistName(seedSong.artists)
        val validCandidates = candidatePool.filter { it.id != seedSong.id }

        val scored = validCandidates.map { candidate ->
            val artSim = computeArtistSimilarity(seedArtist, candidate.artists)
            val contentSim = computeContentSimilarity(seedSong, candidate)
            val score = (artSim * 0.60) + (contentSim * 0.40)
            candidate to score
        }.sortedByDescending { it.second }

        val deduplicated = TrackDeduplicator.deduplicate(scored.map { it.first })

        // Apply diversity: max 3 from same artist
        val radioQueue = mutableListOf(seedSong)
        val artistCount = mutableMapOf(seedArtist to 1)

        for (song in deduplicated) {
            val art = TrackDeduplicator.cleanArtistName(song.artists)
            val count = artistCount[art] ?: 0
            if (count < 3) {
                radioQueue.add(song)
                artistCount[art] = count + 1
            }
            if (radioQueue.size >= limit) break
        }

        return radioQueue
    }
}
