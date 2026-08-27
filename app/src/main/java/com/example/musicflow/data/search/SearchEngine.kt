package com.example.musicflow.data.search

import com.example.musicflow.data.model.*
import kotlin.math.max

data class RankedSong(
    val song: Song,
    val score: Double,
    val matchType: String
)

data class EnhancedSearchResult(
    val query: String,
    val normalizedQuery: String,
    val songs: List<Song>,
    val artists: List<Artist>,
    val albums: List<Album>,
    val playlists: List<Playlist>,
    val didYouMean: String? = null,
    val suggestions: List<String> = emptyList()
)

object SearchEngine {

    // Configurable Ranking Weights
    object Weights {
        const val EXACT_TITLE_AND_ARTIST = 1000.0
        const val EXACT_TITLE = 900.0
        const val EXACT_ARTIST_PARTIAL_TITLE = 850.0
        const val PREFIX_TITLE_MATCH = 800.0
        const val SUBSTRING_TITLE_MATCH = 750.0
        const val HIGH_FUZZY_TITLE_MATCH = 650.0
        const val TOKEN_OVERLAP_MATCH = 600.0
        const val ARTIST_ONLY_MATCH = 450.0
        const val ALBUM_MATCH = 350.0
        const val LOW_FUZZY_MATCH = 200.0

        // Modifiers
        const val BONUS_320KBPS = 15.0
        const val BONUS_HAS_LYRICS = 10.0
        const val BONUS_HIGH_RES_ART = 10.0
        const val PENALTY_KARAOKE = -250.0
        const val PENALTY_COVER = -200.0
        const val PENALTY_SLOWED_REVERB = -150.0
    }

    /**
     * Scores a song against a parsed query.
     */
    fun scoreSong(song: Song, parsed: ParsedQuery): RankedSong {
        val qNorm = parsed.normalizedQuery
        val sTitleNorm = QueryNormalizer.normalize(song.name)
        val sArtistNorm = QueryNormalizer.normalize(song.artists)
        val sAlbumNorm = QueryNormalizer.normalize(song.album)

        val cleanTitle = TrackDeduplicator.cleanTrackTitle(song.name)
        val cleanArtist = TrackDeduplicator.cleanArtistName(song.artists)

        var score = 0.0
        var matchType = "fuzzy"

        val wantsKaraoke = qNorm.contains("karaoke") || qNorm.contains("instrumental")
        val wantsCover = qNorm.contains("cover") || qNorm.contains("tribute")
        val wantsRemix = qNorm.contains("remix") || qNorm.contains("mix")
        val wantsSlowed = qNorm.contains("slowed") || qNorm.contains("reverb")

        // 1. Compound Query: Candidate Song + Candidate Artist
        if (parsed.isCompoundQuery && !parsed.candidateSongTitle.isNullOrBlank() && !parsed.candidateArtist.isNullOrBlank()) {
            val targetSong = parsed.candidateSongTitle
            val targetArtist = parsed.candidateArtist

            val titleScore = StringSimilarity.computeMatchScore(targetSong, cleanTitle)
            val artistScore = StringSimilarity.computeMatchScore(targetArtist, cleanArtist)

            if (titleScore >= 0.90 && artistScore >= 0.85) {
                score = Weights.EXACT_TITLE_AND_ARTIST + (titleScore * 50.0) + (artistScore * 50.0)
                matchType = "exact_title_and_artist"
            } else if (titleScore >= 0.85) {
                score = Weights.EXACT_TITLE + (titleScore * 40.0) + (artistScore * 30.0)
                matchType = "compound_title_match"
            } else if (artistScore >= 0.90 && titleScore >= 0.60) {
                score = Weights.EXACT_ARTIST_PARTIAL_TITLE + (titleScore * 50.0)
                matchType = "artist_partial_title"
            }
        }

        // 2. Direct Matching if not resolved by compound logic
        if (score == 0.0) {
            // A. Exact Song Title Match
            if (cleanTitle == qNorm || sTitleNorm == qNorm) {
                score = Weights.EXACT_TITLE
                matchType = "exact_title"

                // Extra boost if artist also partially matches
                val artistMatch = StringSimilarity.computeMatchScore(qNorm, sArtistNorm)
                if (artistMatch > 0.5) score += 50.0
            }
            // B. Starts With / Prefix Match
            else if (cleanTitle.startsWith(qNorm) || sTitleNorm.startsWith(qNorm)) {
                val ratio = qNorm.length.toDouble() / max(1, cleanTitle.length)
                val artistBonus = if (QueryNormalizer.POPULAR_ARTISTS.any { it == cleanArtist || cleanArtist.contains(it) }) 120.0 else 0.0
                score = Weights.PREFIX_TITLE_MATCH + (ratio * 50.0) + artistBonus
                matchType = "prefix_title"
            }
            // C. Substring Match on Title
            else if (cleanTitle.contains(qNorm) || sTitleNorm.contains(qNorm)) {
                val ratio = qNorm.length.toDouble() / max(1, cleanTitle.length)
                score = Weights.SUBSTRING_TITLE_MATCH + (ratio * 40.0)
                matchType = "substring_title"
            }
            // D. High Fuzzy Similarity on Title (Typo Tolerance)
            else {
                val simTitle = StringSimilarity.computeMatchScore(qNorm, cleanTitle)
                val simArtist = StringSimilarity.computeMatchScore(qNorm, cleanArtist)
                val simCombined = StringSimilarity.computeMatchScore(qNorm, "$cleanTitle $cleanArtist")

                if (simTitle >= 0.82) {
                    score = Weights.HIGH_FUZZY_TITLE_MATCH + (simTitle * 80.0)
                    matchType = "fuzzy_title_typo"
                } else if (simCombined >= 0.80) {
                    score = Weights.TOKEN_OVERLAP_MATCH + (simCombined * 80.0)
                    matchType = "fuzzy_combined"
                } else if (simArtist >= 0.85) {
                    score = Weights.ARTIST_ONLY_MATCH + (simArtist * 50.0)
                    matchType = "artist_match"
                } else if (simTitle >= 0.65) {
                    score = Weights.LOW_FUZZY_MATCH + (simTitle * 100.0)
                    matchType = "low_fuzzy_title"
                } else if (sAlbumNorm.contains(qNorm)) {
                    score = Weights.ALBUM_MATCH
                    matchType = "album_match"
                } else {
                    score = max(50.0, simCombined * 150.0)
                    matchType = "generic_match"
                }
            }
        }

        // 3. Apply Quality Boosters
        if (song.streamUrl.isNotBlank()) score += 10.0
        if (song.downloadUrls.any { it.quality == "320kbps" }) score += Weights.BONUS_320KBPS
        if (song.hasLyrics) score += Weights.BONUS_HAS_LYRICS
        if (song.image.contains("500x500")) score += Weights.BONUS_HIGH_RES_ART

        // 4. Apply Version Penalties (Karaoke, Unofficial Cover, Slowed+Reverb)
        val nameLower = song.name.lowercase()
        if ((nameLower.contains("karaoke") || nameLower.contains("instrumental")) && !wantsKaraoke) {
            score += Weights.PENALTY_KARAOKE
        }
        if ((nameLower.contains("cover") || nameLower.contains("tribute")) && !wantsCover) {
            score += Weights.PENALTY_COVER
        }
        if ((nameLower.contains("slowed") || nameLower.contains("reverb") || nameLower.contains("8d audio")) && !wantsSlowed) {
            score += Weights.PENALTY_SLOWED_REVERB
        }
        if (nameLower.contains("remix") && !wantsRemix && !qNorm.contains("remix")) {
            score -= 120.0
        }

        return RankedSong(song, score, matchType)
    }

    /**
     * Ranks and deduplicates candidate songs.
     */
    fun rankSongs(candidates: List<Song>, parsed: ParsedQuery): List<Song> {
        if (candidates.isEmpty()) return emptyList()

        // 1. Score each candidate
        val scored = candidates.map { scoreSong(it, parsed) }

        // 2. Sort descending by score
        val sorted = scored.sortedByDescending { it.score }.map { it.song }

        // 3. Canonical Deduplication while preserving top rank order
        return TrackDeduplicator.deduplicate(sorted, parsed.rawQuery)
    }

    /**
     * Ranks artist search results based on query similarity.
     */
    fun rankArtists(artists: List<Artist>, parsed: ParsedQuery): List<Artist> {
        if (artists.isEmpty()) return emptyList()
        val qNorm = parsed.normalizedQuery

        return artists.distinctBy { it.id }.sortedByDescending { artist ->
            val aNorm = QueryNormalizer.normalize(artist.name)
            if (aNorm == qNorm) 1000.0
            else if (aNorm.startsWith(qNorm)) 800.0 + (qNorm.length.toDouble() / aNorm.length * 50.0)
            else StringSimilarity.computeMatchScore(qNorm, aNorm) * 600.0
        }
    }

    /**
     * Ranks album search results based on query similarity.
     */
    fun rankAlbums(albums: List<Album>, parsed: ParsedQuery): List<Album> {
        if (albums.isEmpty()) return emptyList()
        val qNorm = parsed.normalizedQuery

        return albums.distinctBy { it.id }.sortedByDescending { album ->
            val nameNorm = QueryNormalizer.normalize(album.name)
            val artistNorm = QueryNormalizer.normalize(album.artist)
            if (nameNorm == qNorm) 900.0
            else if (nameNorm.startsWith(qNorm)) 750.0
            else StringSimilarity.computeMatchScore(qNorm, "$nameNorm $artistNorm") * 500.0
        }
    }

    /**
     * Detects if the query had a typo that was corrected into a popular artist or song.
     */
    fun detectDidYouMean(rawQuery: String): String? {
        val qNorm = QueryNormalizer.normalize(rawQuery)
        if (qNorm.length < 3) return null

        for (artist in QueryNormalizer.POPULAR_ARTISTS) {
            val canonical = artist.split(" ").joinToString(" ") { word ->
                word.replaceFirstChar { if (it.isLowerCase()) it.titlecase(java.util.Locale.ROOT) else it.toString() }
            }

            // Handle "weeknd" -> "The Weeknd"
            if (artist.startsWith("the ") && artist.substring(4) == qNorm) {
                return canonical
            }

            val dist = StringSimilarity.damerauLevenshteinDistance(qNorm, artist)
            val sim = StringSimilarity.jaroWinklerSimilarity(qNorm, artist)
            if ((dist in 1..2 || sim >= 0.88) && qNorm != artist && !artist.equals(qNorm, ignoreCase = true)) {
                return canonical
            }
        }
        return null
    }

    /**
     * Generates fast autocomplete suggestions based on prefix.
     */
    fun getAutocompleteSuggestions(prefix: String, recentSearches: List<String> = emptyList()): List<String> {
        val pNorm = QueryNormalizer.normalize(prefix)
        if (pNorm.isBlank()) return recentSearches.take(6)

        val results = mutableListOf<String>()

        // 1. Check recent searches
        for (r in recentSearches) {
            if (QueryNormalizer.normalize(r).startsWith(pNorm)) {
                results.add(r)
            }
        }

        // 2. Check popular artists
        for (artist in QueryNormalizer.POPULAR_ARTISTS) {
            if (artist.startsWith(pNorm)) {
                results.add(artist.split(" ").joinToString(" ") { it.replaceFirstChar { c -> c.uppercase() } })
            }
        }

        return results.distinct().take(6)
    }
}
