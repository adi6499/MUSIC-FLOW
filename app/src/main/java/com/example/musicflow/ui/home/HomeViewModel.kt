package com.example.musicflow.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.musicflow.data.MusicRepository
import com.example.musicflow.data.local.UserPreferences
import com.example.musicflow.data.model.*
import com.example.musicflow.player.MusicController
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class HomeViewModel(
    private val repository: MusicRepository,
    private val userPreferences: UserPreferences,
    private val musicController: MusicController
) : ViewModel() {

    private val _recentlyPlayed = MutableStateFlow<List<Song>>(emptyList())
    val recentlyPlayed: StateFlow<List<Song>> = _recentlyPlayed.asStateFlow()

    private val _trendingSongs = MutableStateFlow<List<Song>>(emptyList())
    val trendingSongs: StateFlow<List<Song>> = _trendingSongs.asStateFlow()

    private val _newReleases = MutableStateFlow<List<Song>>(emptyList())
    val newReleases: StateFlow<List<Song>> = _newReleases.asStateFlow()

    private val _trendingAlbums = MutableStateFlow<List<com.example.musicflow.data.model.Album>>(emptyList())
    val trendingAlbums: StateFlow<List<com.example.musicflow.data.model.Album>> = _trendingAlbums.asStateFlow()

    private val _topCharts = MutableStateFlow<List<com.example.musicflow.data.model.Playlist>>(emptyList())
    val topCharts: StateFlow<List<com.example.musicflow.data.model.Playlist>> = _topCharts.asStateFlow()

    val favorites: StateFlow<List<Song>> = repository.getFavorites()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _recommendations = MutableStateFlow<List<Song>>(emptyList())
    val recommendations: StateFlow<List<Song>> = _recommendations.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    val userName: StateFlow<String?> = userPreferences.userName
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val playlists: StateFlow<List<com.example.musicflow.data.local.PlaylistEntity>> = repository.getPlaylists()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    init {
        loadHomeData()
        observeHistory()
    }

    private fun observeHistory() {
        repository.getHistory()
            .onEach { _recentlyPlayed.value = it.take(8) }
            .launchIn(viewModelScope)
    }

    fun loadHomeData() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                val quality = repository.getPreferredQuality()
                try {
                    val modules = repository.getHomeModules()
                    if (modules != null) {
                        _trendingSongs.value = modules.trending?.songs?.map { it.toDomain(quality) } ?: emptyList()
                        _trendingAlbums.value = modules.trending?.albums?.map { it.toDomain(quality) } ?: emptyList()
                        _newReleases.value = modules.albums?.map { it.toDomain(quality) }?.flatMap { it.songs }?.take(20) 
                            ?: modules.trending?.songs?.map { it.toDomain(quality) } ?: emptyList()
                        _topCharts.value = modules.charts?.map { it.toDomain(quality) } ?: emptyList()
                        _recommendations.value = _trendingSongs.value.shuffled().take(10)
                        
                        if (_trendingSongs.value.isEmpty() && _trendingAlbums.value.isEmpty()) {
                             loadFallbackData()
                        }
                        return@launch
                    }
                } catch (e: Exception) {
                    android.util.Log.e("HomeViewModel", "API Error: ${e.message}", e)
                    loadFallbackData()
                }
            } catch (e: Exception) {
                _error.value = "Connection Error: ${e.localizedMessage ?: "Please check your internet connection."}"
            } finally {
                _isLoading.value = false
            }
        }
    }

    private suspend fun loadFallbackData() {
        try {
            kotlinx.coroutines.coroutineScope {
                val trendingSearch = async { repository.searchSongs("trending", limit = 20) }
                val newSearch = async { repository.searchSongs("2026 hits", limit = 20) }
                val albumSearch = async { repository.searchAlbums("top hits", limit = 10) }
                
                _trendingSongs.value = trendingSearch.await()
                _newReleases.value = newSearch.await()
                _trendingAlbums.value = albumSearch.await()
                _recommendations.value = _trendingSongs.value.shuffled().take(10)
            }
            
            if (_trendingSongs.value.isEmpty()) {
                _error.value = "No music data available at the moment."
            }
        } catch (e: Exception) {
            _error.value = "Fallback failed: ${e.localizedMessage}"
        }
    }

    fun addToQueue(song: Song) {
        musicController.addToQueue(song)
    }

    fun playNext(song: Song) {
        musicController.playNext(song)
    }

    fun toggleFavorite(song: Song) {
        viewModelScope.launch {
            repository.toggleFavorite(song)
        }
    }

    fun startRadio(song: Song) {
        viewModelScope.launch {
            try {
                val related = repository.searchSongs(song.name, limit = 20)
                if (related.isNotEmpty()) {
                    musicController.playQueue(listOf(song) + related.filter { it.id != song.id })
                }
            } catch (e: Exception) {
                // Fallback to just playing the song
                musicController.playSong(song)
            }
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

    fun playPlaylist(playlist: Playlist) {
        viewModelScope.launch {
            val songs = if (playlist.songs.isNotEmpty()) playlist.songs else {
                repository.getPlaylistDetails(playlist.id)?.songs ?: emptyList()
            }
            if (songs.isNotEmpty()) {
                musicController.playQueue(songs, 0)
            }
        }
    }
}
