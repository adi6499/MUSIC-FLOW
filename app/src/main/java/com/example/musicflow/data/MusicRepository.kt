package com.example.musicflow.data

import com.example.musicflow.data.api.MusicApiService
import com.example.musicflow.data.local.*
import com.example.musicflow.data.model.*
import androidx.work.*
import com.example.musicflow.worker.DownloadWorker
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

class MusicRepository(
    private val api: MusicApiService,
    private val lrcApi: com.example.musicflow.data.api.LrcLibApiService,
    private val dao: MusicDao,
    private val workManager: WorkManager,
    private val userPreferences: UserPreferences
) {
    
    suspend fun getPreferredQuality(): String {
        return userPreferences.audioQuality.first()
    }

    // --- API Calls ---

    suspend fun searchSongs(query: String, limit: Int = 50, page: Int = 1): List<Song> {
        val quality = getPreferredQuality()
        val response = api.searchSongs(query, limit, page)
        return response.body()?.data?.results?.map { it.toDomain(quality) } ?: emptyList()
    }

    suspend fun searchAlbums(query: String, limit: Int = 20, page: Int = 1): List<Album> {
        val quality = getPreferredQuality()
        val response = api.searchAlbums(query, limit, page)
        return response.body()?.data?.results?.map { it.toDomain(quality) } ?: emptyList()
    }

    suspend fun searchArtists(query: String, limit: Int = 20, page: Int = 1): List<Artist> {
        val response = api.searchArtists(query, limit, page)
        return response.body()?.data?.results?.map { it.toDomain() } ?: emptyList()
    }

    suspend fun searchPlaylists(query: String, limit: Int = 20, page: Int = 1): List<Playlist> {
        val quality = getPreferredQuality()
        val response = api.searchPlaylists(query, limit, page)
        return response.body()?.data?.results?.map { it.toDomain(quality) } ?: emptyList()
    }

    suspend fun getSongDetails(id: String): Song? {
        val quality = getPreferredQuality()
        val response = api.getSongDetails(id)
        return response.body()?.data?.firstOrNull()?.toDomain(quality)
    }

    suspend fun getAlbumDetails(id: String): Album? {
        val quality = getPreferredQuality()
        val response = api.getAlbumDetails(id)
        return response.body()?.data?.toDomain(quality)
    }

    suspend fun getPlaylistDetails(id: String): Playlist? {
        val quality = getPreferredQuality()
        val response = api.getPlaylistDetails(id)
        return response.body()?.data?.toDomain(quality)
    }

    suspend fun getArtistDetails(id: String): Artist? {
        val response = api.getArtistDetails(id)
        return response.body()?.data?.toDomain()
    }

    suspend fun getArtistSongs(id: String): List<Song> {
        val quality = getPreferredQuality()
        val response = api.getArtistSongs(id)
        return response.body()?.data?.map { it.toDomain(quality) } ?: emptyList()
    }

    suspend fun getArtistAlbums(id: String): List<Album> {
        val quality = getPreferredQuality()
        val response = api.getArtistAlbums(id)
        return response.body()?.data?.map { it.toDomain(quality) } ?: emptyList()
    }

    suspend fun getLyrics(song: Song): String? {
        // Try primary API first
        try {
            val response = api.getLyrics(song.id)
            val lyrics = response.body()?.data?.lyrics
            if (!lyrics.isNullOrBlank()) return lyrics
        } catch (e: Exception) {
            // Log error
        }

        // Try LrcLib as third party fallback
        val primaryArtist = song.artists.split(",").first().trim()
        
        var lyrics = fetchLyricsFromLrcLib(song.name, song.artists)
        if (lyrics == null && primaryArtist != song.artists) {
            lyrics = fetchLyricsFromLrcLib(song.name, primaryArtist)
        }
        
        return lyrics
    }

    private suspend fun fetchLyricsFromLrcLib(name: String, artists: String): String? {
        return try {
            val response = lrcApi.getLyrics(name, artists)
            if (response.isSuccessful) {
                response.body()?.syncedLyrics ?: response.body()?.plainLyrics
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }

    suspend fun getHomeModules(): HomeModulesDto? {
        val response = api.getHomeModules()
        if (response.isSuccessful) {
            val body = response.body()
            if (body?.success == true) {
                return body.data
            } else {
                throw Exception(body?.message ?: "API returned failure status")
            }
        } else {
            throw Exception("Network error: ${response.code()} ${response.message()}")
        }
    }

    // --- Local Storage (Favorites) ---

    fun getFavorites(): Flow<List<Song>> = dao.getFavorites().map { entities ->
        entities.map { it.toDomain() }
    }

    suspend fun addFavorite(song: Song) {
        dao.insertSongMetadata(song.toMetadataEntity())
        dao.insertFavorite(song.toFavoriteEntity())
    }

    suspend fun removeFavorite(songId: String) {
        dao.deleteFavorite(songId)
    }

    suspend fun isFavorite(songId: String): Boolean = dao.isFavorite(songId)

    suspend fun toggleFavorite(song: Song) {
        if (isFavorite(song.id)) {
            removeFavorite(song.id)
        } else {
            addFavorite(song)
        }
    }

    // --- History ---

    fun getHistory(): Flow<List<Song>> = dao.getHistory().map { entities ->
        entities.map { it.toDomain() }
    }

    suspend fun addHistory(song: Song) {
        dao.insertSongMetadata(song.toMetadataEntity())
        dao.insertHistory(song.toHistoryEntity())
    }

    suspend fun clearHistory() {
        dao.clearHistory()
    }

    // --- Playlists ---

    fun getPlaylists(): Flow<List<PlaylistEntity>> = dao.getPlaylists()

    suspend fun addPlaylist(playlist: PlaylistEntity) {
        dao.insertPlaylist(playlist)
    }

    suspend fun removePlaylist(playlistId: String) {
        dao.deletePlaylist(playlistId)
    }

    suspend fun renamePlaylist(playlistId: String, newName: String) {
        dao.renamePlaylist(playlistId, newName)
    }

    fun getPlaylistSongs(playlistId: String): Flow<List<Song>> = dao.getPlaylistSongs(playlistId).map { entities ->
        entities.map { it.toDomain() }
    }

    suspend fun addSongToPlaylist(playlistId: String, song: Song) {
        dao.insertSongMetadata(song.toMetadataEntity())
        dao.insertPlaylistSong(PlaylistSongCrossRef(playlistId, song.id))
    }

    suspend fun removeSongFromPlaylist(playlistId: String, songId: String) {
        dao.deletePlaylistSong(playlistId, songId)
    }

    fun getAllSongs(): Flow<List<Song>> = dao.getAllSongs().map { entities ->
        entities.map { it.toDomain() }
    }

    // --- Downloads ---

    fun getDownloads(): Flow<List<Song>> = dao.getDownloads().map { entities ->
        entities.map { it.toDomain() }
    }

    fun downloadSong(song: Song) {
        val downloadUrl = song.downloadUrls.lastOrNull()?.url ?: song.streamUrl
        if (downloadUrl.isBlank()) return

        val workRequest = OneTimeWorkRequestBuilder<DownloadWorker>()
            .setInputData(
                DownloadWorker.createInputData(
                    songId = song.id,
                    songName = song.name,
                    artists = song.artists,
                    album = song.album,
                    imageUrl = song.image,
                    downloadUrl = downloadUrl,
                    duration = song.duration
                )
            )
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .build()

        workManager.enqueueUniqueWork(
            "${DownloadWorker.WORK_NAME_PREFIX}${song.id}",
            ExistingWorkPolicy.KEEP,
            workRequest
        )
    }

    suspend fun isDownloaded(songId: String): Boolean = dao.isDownloaded(songId)

    suspend fun deleteDownload(songId: String) {
        dao.deleteDownload(songId)
        // Also delete the file (logic can be added here or in worker)
    }

    // --- Followed Artists ---

    fun getFollowedArtists(): Flow<List<Artist>> = dao.getFollowedArtists().map { entities ->
        entities.map { Artist(it.id, it.name, it.image) }
    }

    suspend fun isArtistFollowed(artistId: String): Boolean = dao.isArtistFollowed(artistId)

    suspend fun toggleFollowArtist(artist: Artist) {
        if (isArtistFollowed(artist.id)) {
            dao.deleteFollowedArtist(artist.id)
        } else {
            dao.insertFollowedArtist(FollowedArtistEntity(artist.id, artist.name, artist.image))
        }
    }
}
