package com.example.musicflow.data.search

import com.example.musicflow.data.model.Song

object TrackDeduplicator {

    /**
     * Deduplicates a list of songs into a clean list of canonical, highest-quality tracks.
     */
    fun deduplicate(songs: List<Song>, query: String = ""): List<Song> {
        if (songs.isEmpty()) return emptyList()

        val qNorm = QueryNormalizer.normalize(query)
        val wantsRemix = qNorm.contains("remix") || qNorm.contains("mix")
        val wantsLive = qNorm.contains("live") || qNorm.contains("concert")
        val wantsAcoustic = qNorm.contains("acoustic") || qNorm.contains("unplugged")
        val wantsKaraoke = qNorm.contains("karaoke") || qNorm.contains("instrumental")

        val clusters = linkedMapOf<String, MutableList<Song>>()

        for (song in songs) {
            val titleNorm = cleanTrackTitle(song.name)
            val artistNorm = cleanArtistName(song.artists)
            val fingerprint = "$titleNorm:::$artistNorm"

            clusters.getOrPut(fingerprint) { mutableListOf() }.add(song)
        }

        val result = mutableListOf<Song>()

        for ((_, group) in clusters) {
            if (group.size == 1) {
                result.add(group[0])
            } else {
                // Select the best canonical track from the cluster
                val best = group.maxByOrNull { song ->
                    scoreTrackQuality(song, wantsRemix, wantsLive, wantsAcoustic, wantsKaraoke)
                } ?: group[0]

                result.add(best)

                // If a user asked for all versions or if there's a distinct legitimate remix, include it
                if (!wantsRemix) {
                    val distinctRemixes = group.filter { s ->
                        s.id != best.id && s.name.contains("remix", ignoreCase = true)
                    }
                    if (distinctRemixes.isNotEmpty() && distinctRemixes.size <= 2) {
                        result.addAll(distinctRemixes.take(1))
                    }
                }
            }
        }

        return result
    }

    private fun scoreTrackQuality(
        song: Song,
        wantsRemix: Boolean,
        wantsLive: Boolean,
        wantsAcoustic: Boolean,
        wantsKaraoke: Boolean
    ): Double {
        var score = 100.0
        val nameLower = song.name.lowercase()
        val albumLower = song.album.lowercase()

        // 1. Bitrate / Stream URL Quality
        if (song.streamUrl.isNotBlank()) score += 20.0
        if (song.downloadUrls.any { it.quality == "320kbps" }) score += 15.0

        // 2. High Resolution Artwork
        if (song.image.contains("500x500")) score += 10.0
        if (song.image.isNotBlank() && !song.image.contains("default")) score += 5.0

        // 3. Lyrics availability
        if (song.hasLyrics) score += 5.0

        // 4. Album context
        if (song.album.isNotBlank() && !albumLower.contains("compilation") && !albumLower.contains("best of")) {
            score += 10.0
        }

        // 5. Version modifiers
        val isKaraoke = nameLower.contains("karaoke") || nameLower.contains("instrumental")
        val isCover = nameLower.contains("cover") || nameLower.contains("tribute") || nameLower.contains("originally performed")
        val isLive = nameLower.contains("live") || nameLower.contains("concert")
        val isRemix = nameLower.contains("remix") || nameLower.contains("mix")
        val isSlowed = nameLower.contains("slowed") || nameLower.contains("reverb")

        if (isKaraoke && !wantsKaraoke) score -= 80.0
        if (isCover) score -= 70.0
        if (isLive && !wantsLive) score -= 30.0
        if (isRemix && !wantsRemix) score -= 20.0
        if (isSlowed) score -= 40.0

        // Duration sanity check (tracks between 1m30s and 8m)
        if (song.duration in 90..480) score += 5.0

        return score
    }

    fun cleanTrackTitle(name: String): String {
        return QueryNormalizer.normalize(
            name.replace(Regex("""\(.*?\)""", RegexOption.DOT_MATCHES_ALL), "")
                .replace(Regex("""\[.*?\]""", RegexOption.DOT_MATCHES_ALL), "")
                .replace(Regex("""(?i)feat\..*|ft\..*|prod\..*|official.*|slowed.*|reverb.*"""), "")
        )
    }

    fun cleanArtistName(artists: String): String {
        val first = artists.split(",", "&", "feat.", "ft.", ";", "/").firstOrNull()?.trim() ?: ""
        return QueryNormalizer.normalize(
            first.replace(Regex("""(?i)feat\..*|ft\..*"""), "")
        )
    }
}
