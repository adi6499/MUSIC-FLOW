package com.example.musicflow.ui.artist

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.musicflow.data.MusicRepository
import com.example.musicflow.data.model.Artist
import com.example.musicflow.data.model.Song
import com.example.musicflow.data.model.Album
import com.example.musicflow.player.MusicController
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class ArtistViewModel(
    private val repository: MusicRepository,
    private val musicController: MusicController
) : ViewModel() {

    private val _artist = MutableStateFlow<Artist?>(null)
    val artist: StateFlow<Artist?> = _artist.asStateFlow()

    private val _topSongs = MutableStateFlow<List<Song>>(emptyList())
    val topSongs: StateFlow<List<Song>> = _topSongs.asStateFlow()

    private val _albums = MutableStateFlow<List<Album>>(emptyList())
    val albums: StateFlow<List<Album>> = _albums.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _isFollowed = MutableStateFlow(false)
    val isFollowed: StateFlow<Boolean> = _isFollowed.asStateFlow()

    val playlists: StateFlow<List<com.example.musicflow.data.local.PlaylistEntity>> = repository.getPlaylists()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun loadArtist(id: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                _isFollowed.value = repository.isArtistFollowed(id)
                
                val artistDef = async { repository.getArtistDetails(id) }
                val songsDef = async { repository.getArtistSongs(id) }
                val albumsDef = async { repository.getArtistAlbums(id) }

                val artistResult = artistDef.await()
                _artist.value = artistResult
                _topSongs.value = songsDef.await()
                _albums.value = albumsDef.await()

                if (artistResult == null) {
                    _error.value = "Artist not found"
                }
            } catch (e: Exception) {
                _error.value = e.message ?: "Failed to load artist"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun toggleFollow() {
        viewModelScope.launch {
            _artist.value?.let { artist ->
                repository.toggleFollowArtist(artist)
                _isFollowed.value = repository.isArtistFollowed(artist.id)
            }
        }
    }

    fun playSong(song: Song) {
        musicController.playSong(song)
    }

    fun playArtistTopSongs() {
        if (_topSongs.value.isNotEmpty()) {
            musicController.playQueue(_topSongs.value)
        }
    }

    fun playNext(song: Song) {
        musicController.playNext(song)
    }

    fun addToQueue(song: Song) {
        musicController.addToQueue(song)
    }

    fun startRadio(song: Song) {
        viewModelScope.launch {
            try {
                val related = repository.searchSongs(song.name, limit = 20)
                if (related.isNotEmpty()) {
                    musicController.playQueue(listOf(song) + related.filter { it.id != song.id })
                }
            } catch (e: Exception) {
                musicController.playSong(song)
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
