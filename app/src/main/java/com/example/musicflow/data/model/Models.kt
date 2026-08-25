package com.example.musicflow.data.model

import androidx.compose.runtime.Immutable
import com.google.gson.annotations.SerializedName

// --- Domain Models ---

@Immutable
data class Song(
    val id: String,
    val name: String,
    val artists: String,
    val album: String,
    val duration: Int,
    val image: String,
    val streamUrl: String,
    val downloadUrls: List<DownloadUrl> = emptyList(),
    val year: String = "",
    val language: String = "",
    val hasLyrics: Boolean = false
)

@Immutable
data class Album(
    val id: String,
    val name: String,
    val artist: String,
    val image: String,
    val year: String = "",
    val songCount: Int = 0,
    val songs: List<Song> = emptyList()
)

@Immutable
data class Artist(
    val id: String,
    val name: String,
    val image: String,
    val role: String = "Artist"
)

@Immutable
data class Playlist(
    val id: String,
    val name: String,
    val subtitle: String = "",
    val image: String,
    val songCount: Int = 0,
    val songs: List<Song> = emptyList()
)

@Immutable
data class DownloadUrl(
    val quality: String,
    val url: String
)

// --- API DTOs ---

data class SongDto(
    @SerializedName("id") val id: String?,
    @SerializedName("name") val name: String?,
    @SerializedName("title") val title: String?,
    @SerializedName("artists") val artists: Any?, // Can be string, list, or object
    @SerializedName("primaryArtists") val primaryArtists: Any?,
    @SerializedName("album") val album: Any?, // Can be string or object
    @SerializedName("duration") val duration: String?,
    @SerializedName("image") val image: Any?, // Can be string or list of objects
    @SerializedName("downloadUrl") val downloadUrl: List<DownloadUrlDto>?,
    @SerializedName("year") val year: String?,
    @SerializedName("language") val language: String?,
    @SerializedName("hasLyrics") val hasLyrics: Boolean?
)

data class AlbumDto(
    @SerializedName("id") val id: String?,
    @SerializedName("name") val name: String?,
    @SerializedName("title") val title: String?,
    @SerializedName("artist") val artist: String?,
    @SerializedName("primaryArtists") val primaryArtists: String?,
    @SerializedName("image") val image: Any?,
    @SerializedName("year") val year: String?,
    @SerializedName("releaseDate") val releaseDate: String?,
    @SerializedName("songCount") val songCount: Int?,
    @SerializedName("songs") val songs: List<SongDto>?
)

data class ArtistDto(
    @SerializedName("id") val id: String?,
    @SerializedName("name") val name: String?,
    @SerializedName("title") val title: String?,
    @SerializedName("image") val image: Any?,
    @SerializedName("role") val role: String?
)

data class PlaylistDto(
    @SerializedName("id") val id: String?,
    @SerializedName("name") val name: String?,
    @SerializedName("title") val title: String?,
    @SerializedName("subtitle") val subtitle: String?,
    @SerializedName("image") val image: Any?,
    @SerializedName("songCount") val songCount: Int?,
    @SerializedName("songs") val songs: List<SongDto>?
)

data class DownloadUrlDto(
    @SerializedName("quality") val quality: String?,
    @SerializedName("url") val url: String?,
    @SerializedName("link") val link: String?
)

data class ImageDto(
    @SerializedName("quality") val quality: String?,
    @SerializedName("url") val url: String?,
    @SerializedName("link") val link: String?
)

data class ApiResponse<T>(
    @SerializedName("success") val success: Boolean?,
    @SerializedName("message") val message: String?,
    @SerializedName("data") val data: T?
)

data class SearchResultDto<T>(
    @SerializedName("total") val total: Int?,
    @SerializedName("start") val start: Int?,
    @SerializedName("results") val results: List<T>?
)

data class FederatedSearchDto(
    @SerializedName("songs") val songs: SearchResultDto<SongDto>?,
    @SerializedName("albums") val albums: SearchResultDto<AlbumDto>?,
    @SerializedName("artists") val artists: SearchResultDto<ArtistDto>?,
    @SerializedName("playlists") val playlists: SearchResultDto<PlaylistDto>?
)

data class LyricsDto(
    @SerializedName("lyrics") val lyrics: String?,
    @SerializedName("snippet") val snippet: String?,
    @SerializedName("copyright") val copyright: String?
)

data class HomeModulesDto(
    @SerializedName("albums") val albums: List<AlbumDto>?,
    @SerializedName("playlists") val playlists: List<PlaylistDto>?,
    @SerializedName("charts") val charts: List<PlaylistDto>?,
    @SerializedName("trending") val trending: TrendingDto?
)

data class TrendingDto(
    @SerializedName("songs") val songs: List<SongDto>?,
    @SerializedName("albums") val albums: List<AlbumDto>?
)
