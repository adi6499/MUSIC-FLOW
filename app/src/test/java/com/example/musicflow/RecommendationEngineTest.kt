package com.example.musicflow

import com.example.musicflow.data.model.Song
import com.example.musicflow.data.recommendation.RecommendationEngine
import org.junit.Assert.*
import org.junit.Test

class RecommendationEngineTest {

    private fun createSong(
        id: String,
        name: String,
        artists: String,
        language: String = "hindi",
        streamUrl: String = "http://stream.url"
    ) = Song(
        id = id,
        name = name,
        artists = artists,
        album = "Album",
        duration = 210,
        image = "https://example.com/500x500/cover.jpg",
        streamUrl = streamUrl,
        downloadUrls = emptyList(),
        year = "2023",
        language = language,
        hasLyrics = true
    )

    @Test
    fun `RecommendationEngine computes semantic artist similarity`() {
        val sameArtist = RecommendationEngine.computeArtistSimilarity("The Weeknd", "The Weeknd")
        assertEquals(1.0, sameArtist, 0.01)

        val relatedArtist = RecommendationEngine.computeArtistSimilarity("The Weeknd", "Drake")
        assertTrue("Expected related similarity >= 0.70, got $relatedArtist", relatedArtist >= 0.70)

        val arijitPritam = RecommendationEngine.computeArtistSimilarity("Arijit Singh", "Pritam")
        assertTrue("Expected related similarity >= 0.70, got $arijitPritam", arijitPritam >= 0.70)

        val unrelated = RecommendationEngine.computeArtistSimilarity("Arijit Singh", "AC/DC")
        assertTrue("Expected low similarity <= 0.35, got $unrelated", unrelated <= 0.35)
    }

    @Test
    fun `RecommendationEngine enforces artist diversity limit of max 2 per artist`() {
        val candidatePool = listOf(
            createSong("1", "Song 1", "The Weeknd"),
            createSong("2", "Song 2", "The Weeknd"),
            createSong("3", "Song 3", "The Weeknd"),
            createSong("4", "Song 4", "The Weeknd"),
            createSong("5", "Song 5", "Drake"),
            createSong("6", "Song 6", "Post Malone"),
            createSong("7", "Song 7", "Dua Lipa")
        )

        val userHistory = listOf(createSong("10", "Blinding Lights", "The Weeknd"))

        val recs = RecommendationEngine.getPersonalizedRecommendations(
            userHistory = userHistory,
            userFavorites = emptyList(),
            candidatePool = candidatePool,
            limit = 10
        )

        val weekndCount = recs.count { it.artists == "The Weeknd" }
        assertTrue("Expected at most 2 Weeknd songs, got $weekndCount", weekndCount <= 2)
        assertTrue(recs.any { it.artists == "Drake" })
    }

    @Test
    fun `RecommendationEngine excludes skipped song IDs`() {
        val song1 = createSong("1", "Song 1", "Artist 1")
        val song2 = createSong("2", "Song 2", "Artist 2")
        val song3 = createSong("3", "Song 3", "Artist 3")

        val recs = RecommendationEngine.getPersonalizedRecommendations(
            userHistory = emptyList(),
            userFavorites = emptyList(),
            candidatePool = listOf(song1, song2, song3),
            skippedSongIds = setOf("2"),
            limit = 5
        )

        assertFalse(recs.any { it.id == "2" })
        assertTrue(recs.any { it.id == "1" })
        assertTrue(recs.any { it.id == "3" })
    }

    @Test
    fun `RecommendationEngine personalizes recommendations based on user favorites`() {
        val userFavorites = listOf(
            createSong("10", "Tum Hi Ho", "Arijit Singh", language = "hindi")
        )

        val candidatePool = listOf(
            createSong("1", "Channa Mereya", "Arijit Singh", language = "hindi"),
            createSong("2", "Kesariya", "Pritam", language = "hindi"),
            createSong("3", "Unrelated English Track", "Unknown Rock Band", language = "english")
        )

        val recs = RecommendationEngine.getPersonalizedRecommendations(
            userHistory = emptyList(),
            userFavorites = userFavorites,
            candidatePool = candidatePool,
            limit = 5
        )

        assertEquals("1", recs[0].id)
        assertEquals("2", recs[1].id)
    }

    @Test
    fun `RecommendationEngine generates track radio with seed song and peer artists`() {
        val seed = createSong("seed", "Starboy", "The Weeknd")
        val candidates = listOf(
            createSong("1", "God's Plan", "Drake"),
            createSong("2", "Circles", "Post Malone"),
            createSong("3", "Levitating", "Dua Lipa"),
            createSong("4", "Save Your Tears", "The Weeknd"),
            createSong("5", "Blinding Lights", "The Weeknd"),
            createSong("6", "In The Night", "The Weeknd"),
            createSong("7", "I Feel It Coming", "The Weeknd")
        )

        val radio = RecommendationEngine.getTrackRadio(seed, candidates, limit = 6)

        assertEquals("seed", radio[0].id)
        val weekndCountInRadio = radio.count { it.artists == "The Weeknd" }
        assertTrue("Expected at most 3 Weeknd songs in radio, got $weekndCountInRadio", weekndCountInRadio <= 3)
        assertTrue(radio.any { it.artists == "Drake" || it.artists == "Post Malone" })
    }
}
