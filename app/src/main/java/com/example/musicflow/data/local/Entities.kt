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
    streamUrl = localPath ?: "" // Use local path for offline playback
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
