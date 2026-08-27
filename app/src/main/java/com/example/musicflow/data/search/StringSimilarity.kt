package com.example.musicflow.data.search

import kotlin.math.max
import kotlin.math.min

object StringSimilarity {

    /**
     * Damerau-Levenshtein distance (insertions, deletions, substitutions, and transpositions).
     */
    fun damerauLevenshteinDistance(s1: String, s2: String): Int {
        val len1 = s1.length
        val len2 = s2.length

        if (len1 == 0) return len2
        if (len2 == 0) return len1

        val d = Array(len1 + 1) { IntArray(len2 + 1) }

        for (i in 0..len1) d[i][0] = i
        for (j in 0..len2) d[0][j] = j

        for (i in 1..len1) {
            for (j in 1..len2) {
                val cost = if (s1[i - 1] == s2[j - 1]) 0 else 1
                d[i][j] = min(
                    min(d[i - 1][j] + 1, d[i][j - 1] + 1),
                    d[i - 1][j - 1] + cost
                )
                if (i > 1 && j > 1 && s1[i - 1] == s2[j - 2] && s1[i - 2] == s2[j - 1]) {
                    d[i][j] = min(d[i][j], d[i - 2][j - 2] + cost)
                }
            }
        }

        return d[len1][len2]
    }

    /**
     * Normalized edit similarity [0.0, 1.0].
     */
    fun normalizedLevenshtein(s1: String, s2: String): Double {
        if (s1 == s2) return 1.0
        val maxLen = max(s1.length, s2.length)
        if (maxLen == 0) return 1.0
        val dist = damerauLevenshteinDistance(s1, s2)
        return (1.0 - (dist.toDouble() / maxLen)).coerceIn(0.0, 1.0)
    }

    /**
     * Jaro-Winkler string similarity [0.0, 1.0].
     */
    fun jaroWinklerSimilarity(s1: String, s2: String): Double {
        if (s1 == s2) return 1.0
        if (s1.isEmpty() || s2.isEmpty()) return 0.0

        val matchDistance = (max(s1.length, s2.length) / 2) - 1
        val s1Matches = BooleanArray(s1.length)
        val s2Matches = BooleanArray(s2.length)

        var matches = 0
        for (i in s1.indices) {
            val start = max(0, i - matchDistance)
            val end = min(i + matchDistance + 1, s2.length)
            for (j in start until end) {
                if (s2Matches[j] || s1[i] != s2[j]) continue
                s1Matches[i] = true
                s2Matches[j] = true
                matches++
                break
            }
        }

        if (matches == 0) return 0.0

        var transpositions = 0.0
        var k = 0
        for (i in s1.indices) {
            if (!s1Matches[i]) continue
            while (!s2Matches[k]) k++
            if (s1[i] != s2[k]) transpositions++
            k++
        }
        val t = transpositions / 2.0

        val jaro = ((matches.toDouble() / s1.length) +
                (matches.toDouble() / s2.length) +
                ((matches - t) / matches)) / 3.0

        // Prefix bonus (up to 4 chars)
        var prefixLength = 0
        val maxPrefix = min(4, min(s1.length, s2.length))
        for (i in 0 until maxPrefix) {
            if (s1[i] == s2[i]) prefixLength++ else break
        }

        val scalingFactor = 0.1
        return (jaro + (prefixLength * scalingFactor * (1.0 - jaro))).coerceIn(0.0, 1.0)
    }

    /**
     * Jaccard token overlap similarity.
     */
    fun tokenSetSimilarity(s1: String, s2: String): Double {
        val t1 = s1.split(" ").filter { it.isNotBlank() }.toSet()
        val t2 = s2.split(" ").filter { it.isNotBlank() }.toSet()

        if (t1.isEmpty() && t2.isEmpty()) return 1.0
        if (t1.isEmpty() || t2.isEmpty()) return 0.0

        val intersection = t1.intersect(t2).size
        val union = t1.union(t2).size
        return intersection.toDouble() / union
    }

    /**
     * Phonetic transliteration key generator.
     * Maps common English & Indian transliteration spelling variations:
     * - "arjit" <-> "arijit"
     * - "sing" <-> "singh"
     * - "lites" <-> "lights"
     * - "yu" <-> "you"
     */
    fun phoneticKey(input: String): String {
        if (input.isBlank()) return ""
        var k = input.lowercase()

        // Replace digraphs and diphthongs
        k = k.replace("ph", "f")
            .replace("gh", "g")
            .replace("kh", "k")
            .replace("dh", "d")
            .replace("bh", "b")
            .replace("th", "t")
            .replace("jh", "j")
            .replace("sh", "s")
            .replace("ch", "c")
            .replace("ck", "k")
            .replace("qu", "k")
            .replace("x", "ks")
            .replace("c", "k")
            .replace("z", "s")

        // Vowel harmonization
        k = k.replace("ee", "i")
            .replace("ea", "i")
            .replace("oo", "u")
            .replace("ou", "u")
            .replace("yu", "u")
            .replace("ie", "i")
            .replace("y", "i")
            .replace("w", "v")

        // Collapse silent trailing 'h' or 'e'
        k = k.replace(Regex("""h\b"""), "")
            .replace(Regex("""e\b"""), "")

        // Collapse duplicate letters: "arijjit" -> "arijit"
        val sb = java.lang.StringBuilder()
        var prev = ' '
        for (c in k) {
            if (c != prev || !c.isLetter()) {
                sb.append(c)
                prev = c
            }
        }

        return sb.toString().trim()
    }

    /**
     * Phonetic similarity comparison.
     */
    fun phoneticSimilarity(s1: String, s2: String): Double {
        val p1 = phoneticKey(s1)
        val p2 = phoneticKey(s2)
        if (p1 == p2 && p1.isNotEmpty()) return 1.0
        return jaroWinklerSimilarity(p1, p2)
    }

    /**
     * Composite score blending edit distance, Jaro-Winkler, token overlap, and phonetic similarity.
     */
    fun computeMatchScore(query: String, target: String): Double {
        if (query.isBlank() || target.isBlank()) return 0.0
        if (query == target) return 1.0

        val qNorm = QueryNormalizer.normalize(query)
        val tNorm = QueryNormalizer.normalize(target)

        if (qNorm == tNorm) return 1.0

        // Exact substring / prefix
        if (tNorm.startsWith(qNorm)) {
            val ratio = qNorm.length.toDouble() / tNorm.length
            return (0.85 + (0.15 * ratio)).coerceIn(0.0, 1.0)
        }

        if (tNorm.contains(qNorm)) {
            val ratio = qNorm.length.toDouble() / tNorm.length
            return (0.75 + (0.20 * ratio)).coerceIn(0.0, 1.0)
        }

        val dist = damerauLevenshteinDistance(qNorm, tNorm)
        val jw = jaroWinklerSimilarity(qNorm, tNorm)
        val lev = normalizedLevenshtein(qNorm, tNorm)
        val tokens = tokenSetSimilarity(qNorm, tNorm)
        val phone = phoneticSimilarity(qNorm, tNorm)

        if (dist <= 2 || phone >= 0.95 || lev >= 0.85) {
            return maxOf(0.85, maxOf(jw, (jw * 0.4 + lev * 0.4 + phone * 0.2))).coerceIn(0.0, 1.0)
        }

        return (jw * 0.35 + lev * 0.25 + tokens * 0.25 + phone * 0.15).coerceIn(0.0, 1.0)
    }
}
