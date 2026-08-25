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

fun ArtistDto.toDomain(preferredQuality: String = "320kbps"): Artist {
    val name = (this.name ?: this.title ?: "Unknown Artist").decodeHtml()
    val image = getHighResImage(this.image)
    val parsedSongs = (this.topSongs ?: this.songs)?.map { it.toDomain(preferredQuality) } ?: emptyList()
    val parsedAlbums = (this.topAlbums ?: this.albums)?.map { it.toDomain(preferredQuality) } ?: emptyList()
    
    return Artist(
        id = this.id ?: "",
        name = name,
        image = image,
        role = this.role ?: "Artist",
        topSongs = parsedSongs,
        topAlbums = parsedAlbums
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
            is String -> a.trim().takeIf { it.isNotBlank() && it != "[object Object]" }
            is Map<*, *> -> {
                val n = (a["name"] ?: a["title"] ?: a["artist"]) as? String
                n?.trim()?.takeIf { it.isNotBlank() && it != "[object Object]" }
            }
            else -> null
        }
    }

    val results = mutableListOf<String>()
    
    when (artists) {
        is String -> extractName(artists)?.let { results.add(it) }
        is List<*> -> artists.forEach { extractName(it)?.let { name -> results.add(name) } }
        is Map<*, *> -> {
            val primary = artists["primary"]
            if (primary is List<*>) primary.forEach { extractName(it)?.let { name -> results.add(name) } }
            else extractName(primary)?.let { results.add(it) }

            val featured = artists["featured"]
            if (featured is List<*>) featured.forEach { extractName(it)?.let { name -> results.add(name) } }
            else extractName(featured)?.let { results.add(it) }
            
            if (results.isEmpty()) {
                val all = artists["all"]
                if (all is List<*>) all.forEach { extractName(it)?.let { name -> results.add(name) } }
                else extractName(all)?.let { results.add(it) }
            }
        }
    }

    if (results.isEmpty()) {
        when (primaryArtists) {
            is String -> extractName(primaryArtists)?.let { results.add(it) }
            is List<*> -> primaryArtists.forEach { extractName(it)?.let { name -> results.add(name) } }
            is Map<*, *> -> extractName(primaryArtists)?.let { results.add(it) }
        }
    }

    return results.filter { it.isNotBlank() }.distinct().joinToString(", ").ifBlank { "Unknown Artist" }.decodeHtml()
}

private fun getHighResImage(image: Any?): String {
    fun extractUrl(item: Any?): String? {
        return when (item) {
            is String -> item.takeIf { it.isNotBlank() && (it.startsWith("http://") || it.startsWith("https://")) }
            is Map<*, *> -> {
                val u = (item["url"] ?: item["link"] ?: item["image"]) as? String
                u?.takeIf { it.isNotBlank() && (it.startsWith("http://") || it.startsWith("https://")) }
            }
            else -> null
        }
    }

    val url = when (image) {
        is String -> extractUrl(image)
        is List<*> -> {
            val urls = image.mapNotNull { extractUrl(it) }
            urls.firstOrNull { it.contains("500x500") }
                ?: urls.firstOrNull { it.contains("150x150") }
                ?: urls.lastOrNull()
        }
        is Map<*, *> -> extractUrl(image)
        else -> null
    } ?: ""

    return if (url.isBlank()) ""
    else url.replace("50x50", "500x500")
        .replace("150x150", "500x500")
        .replace("175x175", "500x500")
        .replace("http://", "https://")
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
