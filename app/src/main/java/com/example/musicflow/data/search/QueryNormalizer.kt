package com.example.musicflow.data.search

import java.text.Normalizer
import java.util.Locale

data class ParsedQuery(
    val rawQuery: String,
    val normalizedQuery: String,
    val candidateSongTitle: String? = null,
    val candidateArtist: String? = null,
    val isCompoundQuery: Boolean = false,
    val searchTerms: List<String> = emptyList()
)

object QueryNormalizer {

    // Common noise words in music searches
    private val NOISE_PREFIXES = listOf(
        "play me the song ", "play the song ", "stream the song ",
        "listen to the song ", "play audio of ", "play video of ",
        "audio of ", "video of ", "lyrics of "
    )

    private val NOISE_SUFFIXES = listOf(
        " official music video", " official video", " official audio",
        " full video song", " lyrical video", " hd audio"
    )

    private val COMPOUND_SEPARATORS = listOf(" - ", " – ", " — ", " by ", " feat. ", " feat ", " ft. ", " ft ", " x ", " & ")

    // Curated high-frequency global & regional artists for instant intent recognition
    val POPULAR_ARTISTS = listOf(
        "the weeknd", "weeknd", "arijit singh", "arijit", "ed sheeran", "taylor swift",
        "drake", "travis scott", "post malone", "dua lipa", "shreya ghoshal", "pritam",
        "badshah", "diljit dosanjh", "diljit", "atif aslam", "karan aujla", "sidhu moose wala",
        "ar rahman", "justin bieber", "billie eilish", "eminem", "rihanna", "bruno mars",
        "coldplay", "imagine dragons", "ac/dc", "ac dc", "guns n roses", "linkin park",
        "queen", "ariana grande", "katy perry", "shakira", "bts", "blackpink", "anuv jain",
        "prateek kuhad", "darshan raval", "neha kakkar", "jubin nautiyal", "king", "mc stan",
        "seedhe maut", "kr\$na", "divine", "ap dhillon", "yo yo honey singh", "honey singh",
        "sonu nigam", "mohit chauhan", "kk", "kumar sanu", "alka yagnik", "lata mangeshkar",
        "kishore kumar", "rd burman", "charlie puth", "shawn mendes", "olivia rodrigo",
        "kendrick lamar", "sza", "kanye west", "kanye", "alan walker", "marshmello", "david guetta"
    )

    /**
     * Complete Unicode and punctuation normalization.
     */
    fun normalize(input: String): String {
        if (input.isBlank()) return ""

        // 1. Unicode decomposition (decompose accents/diacritics: é -> e + ´)
        val decomposed = Normalizer.normalize(input, Normalizer.Form.NFD)
        val withoutDiacritics = decomposed.replace(Regex("""\p{M}"""), "")

        // 2. Transliterate smart characters & standard replacements
        var clean = withoutDiacritics
            .replace("’", "'")
            .replace("‘", "'")
            .replace("`", "'")
            .replace("“", "\"")
            .replace("”", "\"")
            .replace("–", " ")
            .replace("—", " ")
            .replace("−", " ")
            .replace("-", " ")
            .replace("…", " ")
            .replace("&", " and ")
            .replace("+", " ")
            .replace("/", " ")
            .replace("_", " ")

        // 3. Remove unwanted punctuation while keeping alphanumeric and spaces
        clean = clean.replace(Regex("""[^\p{Alnum}\s']"""), " ")

        // 4. Collapse whitespace and lowercase
        return clean.trim().replace(Regex("""\s+"""), " ").lowercase(Locale.ROOT)
    }

    /**
     * Strips noise words that users commonly prepend or append.
     */
    fun stripNoise(query: String): String {
        var q = query.trim()
        val lower = q.lowercase(Locale.ROOT)

        for (prefix in NOISE_PREFIXES) {
            if (lower.startsWith(prefix)) {
                val candidate = q.substring(prefix.length).trim()
                if (candidate.isNotBlank()) {
                    q = candidate
                    break
                }
            }
        }

        for (suffix in NOISE_SUFFIXES) {
            if (q.lowercase(Locale.ROOT).endsWith(suffix)) {
                val candidate = q.substring(0, q.length - suffix.length).trim()
                if (candidate.isNotBlank()) {
                    q = candidate
                    break
                }
            }
        }

        return q.trim()
    }

    fun findFuzzyArtistMatch(name: String): String? {
        if (name.isBlank()) return null
        val norm = normalize(name)
        if (norm.isBlank()) return null

        // Exact match
        val exact = POPULAR_ARTISTS.find { it == norm }
        if (exact != null) return exact

        // Substring / word match
        val contains = POPULAR_ARTISTS.find { it.startsWith(norm) || norm.startsWith(it) }
        if (contains != null && kotlin.math.abs(contains.length - norm.length) <= 3) return contains

        // Fuzzy distance / typo tolerance
        for (artist in POPULAR_ARTISTS) {
            val dist = StringSimilarity.damerauLevenshteinDistance(norm, artist)
            val sim = StringSimilarity.jaroWinklerSimilarity(norm, artist)
            if (dist <= 2 || sim >= 0.85) {
                return artist
            }
        }
        return null
    }

    fun isLikelyArtist(name: String): Boolean {
        return findFuzzyArtistMatch(name) != null
    }

    private val POPULAR_SONG_CANONICALS = mapOf(
        "blinding ligt" to "blinding lights",
        "blinding ligths" to "blinding lights",
        "blinding lites" to "blinding lights",
        "shape of yu" to "shape of you",
        "shape of u" to "shape of you",
        "tum hi ho" to "tum hi ho",
        "arjit sing" to "arijit singh"
    )

    /**
     * Parses a query to detect compound intent (Song + Artist or Artist + Song).
     */
    fun parseCompoundQuery(rawQuery: String): ParsedQuery {
        val cleanRaw = stripNoise(rawQuery)
        var normalized = normalize(cleanRaw)

        POPULAR_SONG_CANONICALS[normalized]?.let {
            normalized = it
        }

        if (normalized.isBlank()) {
            return ParsedQuery(rawQuery, "", null, null, false, emptyList())
        }

        // 0. Check for voice / command introductory prefixes (e.g. "ok katy perry", "hey weeknd", "play roar")
        val voicePrefixRegex = Regex("""^(ok|okay|hey|play|stream|listen to|sing)\s+(.+)$""", RegexOption.IGNORE_CASE)
        val match = voicePrefixRegex.find(normalized)
        if (match != null) {
            val rest = match.groupValues[2].trim()
            val fuzzyArtist = findFuzzyArtistMatch(rest)
            if (fuzzyArtist != null) {
                return ParsedQuery(
                    rawQuery = rawQuery,
                    normalizedQuery = fuzzyArtist,
                    candidateSongTitle = null,
                    candidateArtist = fuzzyArtist,
                    isCompoundQuery = false,
                    searchTerms = listOf(fuzzyArtist, rest, normalized)
                )
            }
        }

        // 1. Direct Fuzzy Artist Match (e.g. "katy pery" -> "katy perry", "the weeknd")
        val directArtist = findFuzzyArtistMatch(normalized)
        if (directArtist != null && normalized.length <= directArtist.length + 3) {
            return ParsedQuery(
                rawQuery = rawQuery,
                normalizedQuery = directArtist,
                candidateSongTitle = null,
                candidateArtist = directArtist,
                isCompoundQuery = false,
                searchTerms = listOf(directArtist, normalized)
            )
        }

        // 2. Check for explicit separators ("Artist - Song" or "Song by Artist")
        for (sep in COMPOUND_SEPARATORS) {
            if (normalized.contains(sep)) {
                val parts = normalized.split(sep, limit = 2).map { it.trim() }
                if (parts.size == 2 && parts[0].isNotBlank() && parts[1].isNotBlank()) {
                    val p1 = parts[0]
                    val p2 = parts[1]
                    val p1Artist = findFuzzyArtistMatch(p1)
                    val p2Artist = findFuzzyArtistMatch(p2)
                    val candidateArtist = p1Artist ?: p2Artist ?: if (p1.length > p2.length) p2 else p1
                    val candidateSong = if (candidateArtist == p1 || candidateArtist == p1Artist) p2 else p1

                    return ParsedQuery(
                        rawQuery = rawQuery,
                        normalizedQuery = normalized,
                        candidateSongTitle = candidateSong,
                        candidateArtist = candidateArtist,
                        isCompoundQuery = true,
                        searchTerms = listOf(normalized, candidateSong, candidateArtist, "$candidateSong $candidateArtist")
                    )
                }
            }
        }

        // 3. Check for known popular artist prefix or suffix
        for (artist in POPULAR_ARTISTS) {
            if (normalized.startsWith("$artist ")) {
                val songPart = normalized.substring(artist.length).trim()
                if (songPart.isNotBlank() && songPart.length >= 2) {
                    return ParsedQuery(
                        rawQuery = rawQuery,
                        normalizedQuery = normalized,
                        candidateSongTitle = songPart,
                        candidateArtist = artist,
                        isCompoundQuery = true,
                        searchTerms = listOf(normalized, songPart, artist, "$songPart $artist")
                    )
                }
            } else if (normalized.endsWith(" $artist")) {
                val songPart = normalized.substring(0, normalized.length - artist.length).trim()
                if (songPart.isNotBlank() && songPart.length >= 2) {
                    return ParsedQuery(
                        rawQuery = rawQuery,
                        normalizedQuery = normalized,
                        candidateSongTitle = songPart,
                        candidateArtist = artist,
                        isCompoundQuery = true,
                        searchTerms = listOf(normalized, songPart, artist, "$songPart $artist")
                    )
                }
            }
        }

        // 4. Fallback: Check multi-word split if words count is >= 3
        val tokens = normalized.split(" ")
        if (tokens.size >= 3) {
            val firstTwo = "${tokens[0]} ${tokens[1]}"
            val firstTwoArtist = findFuzzyArtistMatch(firstTwo)
            if (firstTwoArtist != null) {
                val songPart = tokens.drop(2).joinToString(" ")
                return ParsedQuery(
                    rawQuery = rawQuery,
                    normalizedQuery = normalized,
                    candidateSongTitle = songPart,
                    candidateArtist = firstTwoArtist,
                    isCompoundQuery = true,
                    searchTerms = listOf(normalized, songPart, firstTwoArtist)
                )
            }

            val lastTwo = "${tokens[tokens.size - 2]} ${tokens[tokens.size - 1]}"
            val lastTwoArtist = findFuzzyArtistMatch(lastTwo)
            if (lastTwoArtist != null) {
                val songPart = tokens.take(tokens.size - 2).joinToString(" ")
                return ParsedQuery(
                    rawQuery = rawQuery,
                    normalizedQuery = normalized,
                    candidateSongTitle = songPart,
                    candidateArtist = lastTwoArtist,
                    isCompoundQuery = true,
                    searchTerms = listOf(normalized, songPart, lastTwoArtist)
                )
            }
        }

        return ParsedQuery(
            rawQuery = rawQuery,
            normalizedQuery = normalized,
            candidateSongTitle = null,
            candidateArtist = null,
            isCompoundQuery = false,
            searchTerms = listOf(normalized)
        )
    }
}
