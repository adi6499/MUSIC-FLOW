package com.example.musicflow.data.local

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface MusicDao {

    // --- Favorites ---
    @Query("SELECT * FROM favorites ORDER BY addedAt DESC")
    fun getFavorites(): Flow<List<FavoriteSongEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertFavorite(song: FavoriteSongEntity)

    @Query("DELETE FROM favorites WHERE id = :songId")
    suspend fun deleteFavorite(songId: String)

    @Query("SELECT EXISTS(SELECT 1 FROM favorites WHERE id = :songId)")
    suspend fun isFavorite(songId: String): Boolean

    // --- History ---
    @Query("SELECT * FROM history ORDER BY playedAt DESC LIMIT 100")
    fun getHistory(): Flow<List<HistorySongEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertHistory(song: HistorySongEntity)

    @Query("DELETE FROM history")
    suspend fun clearHistory()

    @Query("DELETE FROM history WHERE id = :songId")
    suspend fun deleteHistorySong(songId: String)

    // --- Saved Albums ---
    @Query("SELECT * FROM saved_albums ORDER BY savedAt DESC")
    fun getSavedAlbums(): Flow<List<SavedAlbumEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSavedAlbum(album: SavedAlbumEntity)

    @Query("DELETE FROM saved_albums WHERE id = :albumId")
    suspend fun deleteSavedAlbum(albumId: String)

    @Query("SELECT EXISTS(SELECT 1 FROM saved_albums WHERE id = :albumId)")
    suspend fun isAlbumSaved(albumId: String): Boolean

    // --- Playlists ---
    @Query("SELECT * FROM playlists ORDER BY createdAt DESC")
    fun getPlaylists(): Flow<List<PlaylistEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPlaylist(playlist: PlaylistEntity)

    @Update
    suspend fun updatePlaylist(playlist: PlaylistEntity)

    @Query("UPDATE playlists SET name = :newName WHERE id = :playlistId")
    suspend fun renamePlaylist(playlistId: String, newName: String)

    @Query("DELETE FROM playlists WHERE id = :playlistId")
    suspend fun deletePlaylist(playlistId: String)

    // --- Playlist Songs ---
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPlaylistSong(crossRef: PlaylistSongCrossRef)

    @Query("DELETE FROM playlist_songs WHERE playlistId = :playlistId AND songId = :songId")
    suspend fun deletePlaylistSong(playlistId: String, songId: String)

    @Query("""
        SELECT * FROM song_metadata 
        INNER JOIN playlist_songs ON song_metadata.id = playlist_songs.songId 
        WHERE playlist_songs.playlistId = :playlistId
        ORDER BY playlist_songs.addedAt ASC
    """)
    fun getPlaylistSongs(playlistId: String): Flow<List<SongMetadataEntity>>

    // --- Song Metadata Cache ---
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSongMetadata(metadata: SongMetadataEntity)

    @Query("SELECT * FROM song_metadata WHERE id = :songId")
    suspend fun getSongMetadata(songId: String): SongMetadataEntity?

    @Query("SELECT * FROM song_metadata ORDER BY lastUpdated DESC")
    fun getAllSongs(): Flow<List<SongMetadataEntity>>

    // --- Downloads ---
    @Query("SELECT * FROM downloads ORDER BY downloadedAt DESC")
    fun getDownloads(): Flow<List<DownloadedSongEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDownload(song: DownloadedSongEntity)

    @Query("DELETE FROM downloads WHERE id = :songId")
    suspend fun deleteDownload(songId: String)

    @Query("SELECT EXISTS(SELECT 1 FROM downloads WHERE id = :songId)")
    suspend fun isDownloaded(songId: String): Boolean

    // --- Followed Artists ---
    @Query("SELECT * FROM followed_artists ORDER BY followedAt DESC")
    fun getFollowedArtists(): Flow<List<FollowedArtistEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertFollowedArtist(artist: FollowedArtistEntity)

    @Query("DELETE FROM followed_artists WHERE id = :artistId")
    suspend fun deleteFollowedArtist(artistId: String)

    @Query("SELECT EXISTS(SELECT 1 FROM followed_artists WHERE id = :artistId)")
    suspend fun isArtistFollowed(artistId: String): Boolean

    // --- Lyrics Cache ---
    @Query("SELECT * FROM lyrics_cache WHERE cacheKey = :cacheKey LIMIT 1")
    suspend fun getLyricsCache(cacheKey: String): LyricsCacheEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLyricsCache(lyrics: LyricsCacheEntity)

    // --- Local Tracks ---
    @Query("SELECT * FROM local_tracks ORDER BY addedAt DESC")
    fun getLocalTracks(): Flow<List<LocalTrackEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLocalTracks(tracks: List<LocalTrackEntity>)

    @Query("DELETE FROM local_tracks WHERE id = :id")
    suspend fun deleteLocalTrack(id: String)

    @Query("DELETE FROM local_tracks")
    suspend fun clearLocalTracks()

    @Query("SELECT * FROM local_tracks WHERE title LIKE '%' || :query || '%' OR artist LIKE '%' || :query || '%' OR album LIKE '%' || :query || '%'")
    suspend fun searchLocalTracks(query: String): List<LocalTrackEntity>

    // --- Download Tasks ---
    @Query("SELECT * FROM download_tasks ORDER BY updatedAt DESC")
    fun getDownloadTasks(): Flow<List<DownloadTaskEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDownloadTask(task: DownloadTaskEntity)

    @Query("UPDATE download_tasks SET status = :status, progress = :progress, updatedAt = :timestamp WHERE id = :id")
    suspend fun updateDownloadProgress(id: String, status: String, progress: Int, timestamp: Long = System.currentTimeMillis())

    @Query("DELETE FROM download_tasks WHERE id = :id")
    suspend fun deleteDownloadTask(id: String)
}
