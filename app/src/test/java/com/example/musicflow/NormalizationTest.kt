package com.example.musicflow

import com.example.musicflow.data.model.*
import org.junit.Assert.assertEquals
import org.junit.Test

class NormalizationTest {

    @Test
    fun `SongDto toDomain maps name and artists correctly`() {
        val dto = SongDto(
            id = "1",
            name = "Test Song &amp; More",
            title = null,
            artists = "Test Artist",
            primaryArtists = null,
            album = "Test Album",
            duration = "180",
            image = "http://example.com/image.jpg",
            downloadUrl = emptyList(),
            year = "2024",
            language = "English",
            hasLyrics = true
        )

        val song = dto.toDomain()

        assertEquals("1", song.id)
        assertEquals("Test Song & More", song.name)
        assertEquals("Test Artist", song.artists)
        assertEquals("Test Album", song.album)
        assertEquals(180, song.duration)
        assertEquals("2024", song.year)
        assertEquals(true, song.hasLyrics)
    }

    @Test
    fun `getHighResImage replaces low quality dimensions`() {
        val dto = SongDto(
            id = "1",
            name = "Song",
            title = null,
            artists = "Artist",
            primaryArtists = null,
            album = "Album",
            duration = "180",
            image = "http://example.com/50x50/cover.jpg",
            downloadUrl = emptyList(),
            year = "2024",
            language = "English",
            hasLyrics = false
        )

        val song = dto.toDomain()
        assertEquals("https://example.com/500x500/cover.jpg", song.image)
        
        val dto2 = dto.copy(image = "http://example.com/150x150/cover.jpg")
        assertEquals("https://example.com/500x500/cover.jpg", dto2.toDomain().image)
    }

    @Test
    fun `streamUrl selection picks preferred quality or fallback`() {
        val downloadUrls = listOf(
            DownloadUrlDto(quality = "12kbps", url = "url12", link = null),
            DownloadUrlDto(quality = "160kbps", url = "url160", link = null),
            DownloadUrlDto(quality = "320kbps", url = "url320", link = null)
        )
        
        val dto = SongDto(
            id = "1",
            name = "Song",
            title = null,
            artists = "Artist",
            primaryArtists = null,
            album = "Album",
            duration = "180",
            image = null,
            downloadUrl = downloadUrls,
            year = "2024",
            language = "English",
            hasLyrics = false
        )

        // Default preferred is 320kbps
        assertEquals("url320", dto.toDomain().streamUrl)
        
        // Custom preferred
        assertEquals("url160", dto.toDomain("160kbps").streamUrl)
        
        // Fallback to 320 if preferred not found
        assertEquals("url320", dto.toDomain("999kbps").streamUrl)
        
        // Fallback to last if others not found
        val limitedUrls = listOf(DownloadUrlDto(quality = "12kbps", url = "url12", link = null))
        val dtoLimited = dto.copy(downloadUrl = limitedUrls)
        assertEquals("url12", dtoLimited.toDomain().streamUrl)
    }

    @Test
    fun `getArtistsString handles complex artist structures`() {
        // List of maps
        val artistsList = listOf(
            mapOf("name" to "Artist 1"),
            mapOf("name" to "Artist 2")
        )
        val dto = SongDto(
            id = "1",
            name = "Song",
            title = null,
            artists = artistsList,
            primaryArtists = null,
            album = "Album",
            duration = "180",
            image = null,
            downloadUrl = emptyList(),
            year = "2024",
            language = "English",
            hasLyrics = false
        )
        
        assertEquals("Artist 1, Artist 2", dto.toDomain().artists)
        
        // Map with primary list
        val artistsMap = mapOf(
            "primary" to listOf(mapOf("name" to "Primary 1")),
            "all" to listOf(mapOf("name" to "All 1"))
        )
        val dto2 = dto.copy(artists = artistsMap)
        assertEquals("Primary 1", dto2.toDomain().artists)
    }
}
