package com.example.musicflow.data.model

import com.example.musicflow.data.model.*
import java.net.URLDecoder

fun SongDto.toDomain(preferredQuality: String = "320kbps"): Song {
    val name = (this.name?.takeIf { it.isNotBlank() } ?: this.title?.takeIf { it.isNotBlank() } ?: "Unknown").decodeHtml()
    val artists = getArtistsString(this.artists, this.primaryArtists)
    val albumName = when (val album = this.album) {
        is String -> if (album.isNotBlank()) album else ""
        is Map<*, *> -> (album["name"] as? String)?.takeIf { it.isNotBlank() } ?: ""
        else -> ""
    }.decodeHtml()

    val image = getHighResImage(this.image)
    val downloadUrls = this.downloadUrl?.map { it.toDomain() } ?: emptyList()
    val streamUrl = downloadUrls.find { it.quality == preferredQuality }?.url
        ?: downloadUrls.find { it.quality == "320kbps" }?.url
        ?: downloadUrls.find { it.quality == "160kbps" }?.url
        ?: downloadUrls.lastOrNull()?.url
        ?: ""

    return Song(
        id = this.id ?: "",
        name = name,
        artists = artists,
        album = albumName,
        duration = this.duration?.toIntOrNull() ?: 0,
        image = image,
        streamUrl = streamUrl,
        downloadUrls = downloadUrls,
        year = this.year ?: "",
        language = this.language ?: "",
        hasLyrics = this.hasLyrics ?: false
    )
}

fun DownloadUrlDto.toDomain(): DownloadUrl {
    return DownloadUrl(
        quality = this.quality ?: "",
        url = this.url ?: this.link ?: ""
    )
}

fun AlbumDto.toDomain(preferredQuality: String = "320kbps"): Album {
    val name = (this.name ?: this.title ?: "Unknown Album").decodeHtml()
    val artist = (this.artist ?: this.primaryArtists ?: "Various Artists").decodeHtml()
    val image = getHighResImage(this.image)
    
    return Album(
        id = this.id ?: "",
        name = name,
        artist = artist,
        image = image,
        year = this.year ?: this.releaseDate ?: "",
        songCount = this.songCount ?: this.songs?.size ?: 0,
        songs = this.songs?.map { it.toDomain(preferredQuality) } ?: emptyList()
    )
}

fun ArtistDto.toDomain(): Artist {
    val name = (this.name ?: this.title ?: "Unknown Artist").decodeHtml()
    val image = getHighResImage(this.image)
    
    return Artist(
        id = this.id ?: "",
        name = name,
        image = image,
        role = this.role ?: "Artist"
    )
}

fun PlaylistDto.toDomain(preferredQuality: String = "320kbps"): Playlist {
    val name = (this.name ?: this.title ?: "Untitled Playlist").decodeHtml()
    val image = getHighResImage(this.image)
    
    return Playlist(
        id = this.id ?: "",
        name = name,
        subtitle = (this.subtitle ?: "").decodeHtml(),
        image = image,
        songCount = this.songCount ?: this.songs?.size ?: 0,
        songs = this.songs?.map { it.toDomain(preferredQuality) } ?: emptyList()
    )
}

// --- Helper Functions ---

private fun getArtistsString(artists: Any?, primaryArtists: Any?): String {
    fun extractName(a: Any?): String? {
        return when (a) {
            is String -> if (a != "[object Object]") a else null
            is Map<*, *> -> (a["name"] ?: a["title"] ?: a["artist"] ?: a["role"]) as? String
            else -> null
        }
    }

    val results = mutableListOf<String>()
    
    when (artists) {
        is String -> if (artists != "[object Object]") results.add(artists)
        is List<*> -> artists.forEach { extractName(it)?.let { name -> results.add(name) } }
        is Map<*, *> -> {
            val primary = artists["primary"]
            if (primary is List<*>) primary.forEach { extractName(it)?.let { name -> results.add(name) } }
            else extractName(primary)?.let { results.add(it) }
            
            if (results.isEmpty()) {
                val all = artists["all"]
                if (all is List<*>) all.forEach { extractName(it)?.let { name -> results.add(name) } }
            }
        }
    }

    if (results.isEmpty()) {
        when (primaryArtists) {
            is String -> if (primaryArtists != "[object Object]") results.add(primaryArtists)
            is List<*> -> primaryArtists.forEach { extractName(it)?.let { name -> results.add(name) } }
        }
    }

    return results.filter { it.isNotBlank() }.joinToString(", ").ifBlank { "Unknown Artist" }.decodeHtml()
}

private fun getHighResImage(image: Any?): String {
    val url = when (image) {
        is String -> image
        is List<*> -> {
            val last = image.lastOrNull()
            when (last) {
                is String -> last
                is Map<*, *> -> (last["url"] ?: last["link"]) as? String
                else -> ""
            }
        }
        is Map<*, *> -> (image["url"] ?: image["link"]) as? String
        else -> ""
    } ?: ""

    return if (url.isBlank()) ""
    else url.replace("50x50", "500x500")
        .replace("150x150", "500x500")
        .replace("175x175", "500x500")
}

private fun String.decodeHtml(): String {
    return this.replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#039;", "'")
        .replace("&apos;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .trim()
}
