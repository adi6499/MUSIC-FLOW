package com.example.musicflow.ui.album

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.musicflow.data.MusicRepository
import com.example.musicflow.data.model.Album
import com.example.musicflow.data.model.Song
import com.example.musicflow.player.MusicController
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class AlbumViewModel(
    private val repository: MusicRepository,
    private val musicController: MusicController
) : ViewModel() {

    private val _album = MutableStateFlow<Album?>(null)
    val album: StateFlow<Album?> = _album.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    val playlists: StateFlow<List<com.example.musicflow.data.local.PlaylistEntity>> = repository.getPlaylists()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun loadAlbum(id: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                _album.value = repository.getAlbumDetails(id)
            } catch (e: Exception) {
                _error.value = e.message ?: "Failed to load album"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun playSong(song: Song) {
        musicController.playSong(song)
    }

    fun playAlbum(shuffle: Boolean = false) {
        _album.value?.songs?.let { songs ->
            if (songs.isNotEmpty()) {
                val listToPlay = if (shuffle) songs.shuffled() else songs
                musicController.playQueue(listToPlay)
            }
        }
    }

    fun playNext(song: Song) {
        viewModelScope.launch {
            val fullSong = if (song.streamUrl.isNotBlank()) song else repository.getSongDetails(song.id) ?: song
            musicController.playNext(fullSong)
        }
    }

    fun addToQueue(song: Song) {
        viewModelScope.launch {
            val fullSong = if (song.streamUrl.isNotBlank()) song else repository.getSongDetails(song.id) ?: song
            musicController.addToQueue(fullSong)
        }
    }

    fun startRadio(song: Song) {
        viewModelScope.launch {
            try {
                val fullSong = if (song.streamUrl.isNotBlank()) song else repository.getSongDetails(song.id) ?: song
                val artistQuery = fullSong.artists.split(",").firstOrNull()?.trim()?.takeIf { it.isNotBlank() && it != "Unknown Artist" }
                val related = if (!artistQuery.isNullOrBlank()) {
                    repository.searchSongs(artistQuery, limit = 25)
                } else {
                    repository.searchSongs(fullSong.name, limit = 25)
                }
                val validRelated = related.filter { it.id != fullSong.id && it.streamUrl.isNotBlank() }
                val queue = if (validRelated.isNotEmpty()) {
                    listOf(fullSong) + validRelated
                } else {
                    listOf(fullSong)
                }
                musicController.playQueue(queue, 0)
            } catch (e: Exception) {
                val fullSong = if (song.streamUrl.isNotBlank()) song else repository.getSongDetails(song.id) ?: song
                musicController.playSong(fullSong)
            }
        }
    }

    fun toggleFavorite(song: Song) {
        viewModelScope.launch {
            repository.toggleFavorite(song)
        }
    }

    fun addToPlaylist(playlistId: String, song: Song) {
        viewModelScope.launch {
            repository.addSongToPlaylist(playlistId, song)
        }
    }

    fun createPlaylist(name: String) {
        viewModelScope.launch {
            val id = System.currentTimeMillis().toString()
            repository.addPlaylist(com.example.musicflow.data.local.PlaylistEntity(id, name, "", ""))
        }
    }
}
