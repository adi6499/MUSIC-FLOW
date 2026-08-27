package com.example.musicflow.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.example.musicflow.data.model.Song

@Entity(tableName = "favorites")
data class FavoriteSongEntity(
    @PrimaryKey val id: String,
    val name: String,
    val artists: String,
    val album: String,
    val duration: Int,
    val image: String,
    val streamUrl: String,
    val addedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "history")
data class HistorySongEntity(
    @PrimaryKey(autoGenerate = true) val historyId: Long = 0,
    val id: String,
    val name: String,
    val artists: String,
    val album: String,
    val duration: Int,
    val image: String,
    val streamUrl: String,
    val playedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "playlists")
data class PlaylistEntity(
    @PrimaryKey val id: String,
    val name: String,
    val subtitle: String,
    val image: String,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "playlist_songs", primaryKeys = ["playlistId", "songId"])
data class PlaylistSongCrossRef(
    val playlistId: String,
    val songId: String,
    val addedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "downloads")
data class DownloadedSongEntity(
    @PrimaryKey val id: String,
    val name: String,
    val artists: String,
    val album: String,
    val duration: Int,
    val image: String,
    val localPath: String,
    val downloadedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "saved_albums")
data class SavedAlbumEntity(
    @PrimaryKey val id: String,
    val name: String,
    val artist: String,
    val year: String,
    val image: String,
    val songCount: Int = 0,
    val savedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "followed_artists")
data class FollowedArtistEntity(
    @PrimaryKey val id: String,
    val name: String,
    val image: String,
    val followedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "song_metadata")
data class SongMetadataEntity(
    @PrimaryKey val id: String,
    val name: String,
    val artists: String,
    val album: String,
    val duration: Int,
    val image: String,
    val streamUrl: String,
    val lastUpdated: Long = System.currentTimeMillis()
)

@Entity(tableName = "lyrics_cache")
data class LyricsCacheEntity(
    @PrimaryKey val cacheKey: String,
    val syncedLyrics: String?,
    val plainLyrics: String?,
    val cachedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "local_tracks")
data class LocalTrackEntity(
    @PrimaryKey val id: String,
    val title: String,
    val artist: String,
    val album: String,
    val albumArtist: String = "",
    val duration: Int = 0,
    val path: String,
    val folderName: String = "",
    val year: String = "",
    val genre: String = "",
    val trackNumber: Int = 0,
    val artworkUri: String = "",
    val lastModified: Long = 0L,
    val addedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "download_tasks")
data class DownloadTaskEntity(
    @PrimaryKey val id: String,
    val songName: String,
    val artists: String,
    val imageUrl: String,
    val status: String, // "QUEUED", "DOWNLOADING", "DOWNLOADED", "FAILED", "CANCELLED"
    val progress: Int = 0,
    val fileSize: Long = 0L,
    val localPath: String = "",
    val error: String? = null,
    val updatedAt: Long = System.currentTimeMillis()
)

fun Song.toFavoriteEntity() = FavoriteSongEntity(
    id = id ?: "",
    name = name ?: "",
    artists = artists ?: "",
    album = album ?: "",
    duration = duration ?: 0,
    image = image ?: "",
    streamUrl = streamUrl ?: ""
)

fun FavoriteSongEntity.toDomain() = Song(
    id = id ?: "",
    name = name ?: "",
    artists = artists ?: "",
    album = album ?: "",
    duration = duration ?: 0,
    image = image ?: "",
    streamUrl = streamUrl ?: ""
)

fun Song.toHistoryEntity() = HistorySongEntity(
    id = id ?: "",
    name = name ?: "",
    artists = artists ?: "",
    album = album ?: "",
    duration = duration ?: 0,
    image = image ?: "",
    streamUrl = streamUrl ?: ""
)

fun HistorySongEntity.toDomain() = Song(
    id = id ?: "",
    name = name ?: "",
    artists = artists ?: "",
    album = album ?: "",
    duration = duration ?: 0,
    image = image ?: "",
    streamUrl = streamUrl ?: ""
)

fun DownloadedSongEntity.toDomain() = Song(
    id = id ?: "",
    name = name ?: "",
    artists = artists ?: "",
    album = album ?: "",
    duration = duration ?: 0,
    image = image ?: "",
    streamUrl = localPath ?: "", // Use local path for offline playback
    localPath = localPath,
    source = "DOWNLOADED"
)

fun LocalTrackEntity.toDomain() = Song(
    id = id,
    name = title,
    artists = artist,
    album = album,
    albumArtist = albumArtist,
    duration = duration,
    image = artworkUri,
    streamUrl = path,
    localPath = path,
    folderName = folderName,
    year = year,
    genre = genre,
    trackNumber = trackNumber,
    source = "LOCAL"
)

fun Song.toMetadataEntity() = SongMetadataEntity(
    id = id ?: "",
    name = name ?: "",
    artists = artists ?: "",
    album = album ?: "",
    duration = duration ?: 0,
    image = image ?: "",
    streamUrl = streamUrl ?: ""
)

fun SongMetadataEntity.toDomain() = Song(
    id = id ?: "",
    name = name ?: "",
    artists = artists ?: "",
    album = album ?: "",
    duration = duration ?: 0,
    image = image ?: "",
    streamUrl = streamUrl ?: ""
)
