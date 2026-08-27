package com.example.musicflow.ui.library

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.musicflow.data.MusicRepository
import com.example.musicflow.data.local.PlaylistEntity
import com.example.musicflow.data.model.Song
import com.example.musicflow.data.model.Album
import com.example.musicflow.data.model.Artist
import com.example.musicflow.player.MusicController
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class LibraryViewModel(
    private val repository: MusicRepository,
    private val musicController: MusicController
) : ViewModel() {

    val favorites: StateFlow<List<Song>> = repository.getFavorites()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val allSongs: StateFlow<List<Song>> = repository.getAllSongs()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val history: StateFlow<List<Song>> = repository.getHistory()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val playlists: StateFlow<List<PlaylistEntity>> = repository.getPlaylists()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val downloads: StateFlow<List<Song>> = repository.getDownloads()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val savedAlbums: StateFlow<List<Album>> = repository.getSavedAlbums()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val followedArtists: StateFlow<List<Artist>> = repository.getFollowedArtists()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val localTracks: StateFlow<List<Song>> = repository.getLocalTracks()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun scanLocalDeviceMusic(context: android.content.Context? = null) {
        viewModelScope.launch {
            repository.scanLocalAudio(context)
        }
    }

    fun deleteLocalTrack(id: String) {
        viewModelScope.launch {
            repository.deleteLocalTrack(id)
        }
    }

    fun batchDownloadPlaylist(songs: List<Song>) {
        repository.batchDownloadSongs(songs)
    }

    fun removeFromHistory(songId: String) {
        viewModelScope.launch {
            repository.removeFromHistory(songId)
        }
    }

    fun deleteDownload(songId: String) {
        viewModelScope.launch {
            repository.deleteDownload(songId)
        }
    }

    fun toggleFollowArtist(artist: Artist) {
        viewModelScope.launch {
            repository.toggleFollowArtist(artist)
        }
    }

    fun toggleSaveAlbum(album: Album) {
        viewModelScope.launch {
            repository.toggleSaveAlbum(album)
        }
    }

    fun shufflePlaylist(songs: List<Song>) {
        if (songs.isNotEmpty()) {
            musicController.playQueue(songs.shuffled(), 0)
        }
    }

    fun toggleFavorite(song: Song) {
        viewModelScope.launch {
            repository.toggleFavorite(song)
        }
    }

    fun getPlaylistSongs(playlistId: String): Flow<List<Song>> = repository.getPlaylistSongs(playlistId)

    fun deletePlaylist(playlistId: String) {
        viewModelScope.launch {
            repository.removePlaylist(playlistId)
        }
    }

    fun renamePlaylist(playlistId: String, newName: String) {
        viewModelScope.launch {
            repository.renamePlaylist(playlistId, newName)
        }
    }

    fun clearHistory() {
        viewModelScope.launch {
            repository.clearHistory()
        }
    }

    fun playPlaylist(songs: List<Song>) {
        if (songs.isNotEmpty()) {
            musicController.playQueue(songs)
        }
    }

    fun createPlaylist(name: String) {
        viewModelScope.launch {
            val id = System.currentTimeMillis().toString()
            repository.addPlaylist(PlaylistEntity(id, name, "", ""))
        }
    }

    fun addToPlaylist(playlistId: String, song: Song) {
        viewModelScope.launch {
            repository.addSongToPlaylist(playlistId, song)
        }
    }

    fun removeSongFromPlaylist(playlistId: String, songId: String) {
        viewModelScope.launch {
            repository.removeSongFromPlaylist(playlistId, songId)
        }
    }

    fun addToQueue(song: Song) {
        viewModelScope.launch {
            val fullSong = if (song.streamUrl.isNotBlank()) song else repository.getSongDetails(song.id) ?: song
            musicController.addToQueue(fullSong)
        }
    }

    fun playNext(song: Song) {
        viewModelScope.launch {
            val fullSong = if (song.streamUrl.isNotBlank()) song else repository.getSongDetails(song.id) ?: song
            musicController.playNext(fullSong)
        }
    }

    fun startRadio(song: Song) {
        viewModelScope.launch {
            try {
                val fullSong = if (song.streamUrl.isNotBlank()) song else repository.getSongDetails(song.id) ?: song
                val artistQuery = fullSong.artists.split(",", "&", "feat.", "ft.").firstOrNull()?.trim()?.takeIf { it.isNotBlank() && it != "Unknown Artist" }
                val related = if (!artistQuery.isNullOrBlank()) {
                    repository.searchComprehensiveSongs(artistQuery)
                } else {
                    repository.searchComprehensiveSongs(fullSong.name)
                }
                val validRelated = related.filter { it.id != fullSong.id && it.streamUrl.isNotBlank() }
                val queue = (listOf(fullSong) + validRelated).distinctBy { it.id }

                val isCurrent = musicController.currentSong.value?.id == fullSong.id
                if (isCurrent && musicController.isPlaying.value) {
                    musicController.setRadioQueueKeepPlaying(queue)
                } else {
                    musicController.playQueue(queue, 0)
                }
            } catch (e: Exception) {
                val fullSong = if (song.streamUrl.isNotBlank()) song else repository.getSongDetails(song.id) ?: song
                musicController.playSong(fullSong)
            }
        }
    }
}
