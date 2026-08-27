package com.example.musicflow

import com.example.musicflow.data.typesense.MultiSearchRequest
import com.example.musicflow.data.typesense.SearchQueryItem
import com.example.musicflow.data.typesense.SongDocument
import com.example.musicflow.data.typesense.TypesenseConfig
import com.example.musicflow.data.typesense.TypesenseSearchEngine
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class TypesenseSearchTest {

    @Test
    fun `SongDocument converts accurately to domain Song`() {
        val doc = SongDocument(
            id = "ts_123",
            title = "Blinding Lights",
            artist = "The Weeknd",
            album = "After Hours",
            year = 2020,
            duration = 200,
            coverArt = "https://example.com/500x500.jpg",
            streamUrl = "https://audio.example.com/stream.mp3",
            hasLyrics = true,
            language = "english",
            provider = "Typesense"
        )

        val song = doc.toDomain()

        assertEquals("ts_123", song.id)
        assertEquals("Blinding Lights", song.name)
        assertEquals("The Weeknd", song.artists)
        assertEquals("After Hours", song.album)
        assertEquals("2020", song.year)
        assertEquals(200, song.duration)
        assertEquals("https://example.com/500x500.jpg", song.image)
        assertEquals("https://audio.example.com/stream.mp3", song.streamUrl)
        assertTrue(song.hasLyrics)
        assertEquals("english", song.language)
    }

    @Test
    fun `MultiSearchRequest constructs multi-field weighted queries with typo tolerance`() {
        val queryItem = SearchQueryItem(
            collection = "songs",
            q = "blinding lites",
            queryBy = "title,artist,album,normalized_title,normalized_artist,normalized_album",
            queryByWeights = "12,8,4,10,7,3",
            sortBy = "_text_match:desc,popularity:desc",
            numTypos = "2",
            typoTokensThreshold = 1,
            dropTokensThreshold = 1,
            prioritizeExactMatch = true,
            prefix = true,
            infix = "always",
            perPage = 30
        )

        val request = MultiSearchRequest(searches = listOf(queryItem))

        assertEquals(1, request.searches.size)
        assertEquals("songs", request.searches[0].collection)
        assertEquals("blinding lites", request.searches[0].q)
        assertEquals("2", request.searches[0].numTypos)
        assertTrue(request.searches[0].prioritizeExactMatch == true)
        assertTrue(request.searches[0].prefix == true)
    }

    @Test
    fun `TypesenseSearchEngine falls back safely when disabled or unreachable`() = runBlocking {
        TypesenseConfig.isEnabled = false
        val results = TypesenseSearchEngine.searchSongs("Blinding Lights")
        assertNull("When Typesense is disabled, engine must return null to trigger graceful fallback", results)

        TypesenseConfig.isEnabled = true
        // Point to invalid port to test network timeout fallback
        TypesenseConfig.port = 9999
        val offlineResult = TypesenseSearchEngine.searchSongs("Blinding Lights")
        assertNull("When Typesense host is unreachable, engine must return null without crashing", offlineResult)

        // Reset config
        TypesenseConfig.port = 8108
    }
}
