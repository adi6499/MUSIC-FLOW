package com.example.musicflow.ui.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.musicflow.data.MusicRepository
import com.example.musicflow.data.local.UserPreferences
import com.example.musicflow.data.model.*
import com.example.musicflow.player.MusicController
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.async
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

@OptIn(FlowPreview::class)
class SearchViewModel(
    private val repository: MusicRepository,
    private val userPreferences: UserPreferences,
    private val musicController: MusicController,
    private val savedStateHandle: androidx.lifecycle.SavedStateHandle
) : ViewModel() {

    private val _query = savedStateHandle.getStateFlow("query", "")
    val query: StateFlow<String> = _query

    private val gson = com.google.gson.Gson()

    private val _searchResults = MutableStateFlow<List<Song>>(
        savedStateHandle.get<String>("songs_res")?.let {
            gson.fromJson(it, object : com.google.gson.reflect.TypeToken<List<Song>>() {}.type)
        } ?: emptyList()
    )
    val searchResults: StateFlow<List<Song>> = _searchResults.asStateFlow()

    private val _albumResults = MutableStateFlow<List<Album>>(
        savedStateHandle.get<String>("albums_res")?.let {
            gson.fromJson(it, object : com.google.gson.reflect.TypeToken<List<Album>>() {}.type)
        } ?: emptyList()
    )
    val albumResults: StateFlow<List<Album>> = _albumResults.asStateFlow()

    private val _artistResults = MutableStateFlow<List<Artist>>(
        savedStateHandle.get<String>("artists_res")?.let {
            gson.fromJson(it, object : com.google.gson.reflect.TypeToken<List<Artist>>() {}.type)
        } ?: emptyList()
    )
    val artistResults: StateFlow<List<Artist>> = _artistResults.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    val playlists: StateFlow<List<com.example.musicflow.data.local.PlaylistEntity>> = repository.getPlaylists()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _trendingKeywords = MutableStateFlow<List<String>>(emptyList())
    val trendingKeywords: StateFlow<List<String>> = _trendingKeywords.asStateFlow()

    val recentSearches: StateFlow<List<String>> = userPreferences.recentSearches
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    init {
        loadTrending()
        observeQuery()
    }

    private fun loadTrending() {
        viewModelScope.launch {
            try {
                val songs = repository.searchSongs("trending")
                _trendingKeywords.value = songs.map { it.name }.distinct().take(10)
            } catch (e: Exception) {
                // Ignore
            }
        }
    }

    private var searchJob: Job? = null

    private fun observeQuery() {
        _query
            .debounce(600)
            .distinctUntilChanged()
            .onEach { 
                if (it.isNotBlank()) {
                    search(it, saveToRecent = false)
                } else {
                    searchJob?.cancel()
                    _searchResults.value = emptyList()
                    _albumResults.value = emptyList()
                    _artistResults.value = emptyList()
                    _isLoading.value = false
                }
            }
            .launchIn(viewModelScope)
    }

    fun updateQuery(newQuery: String) {
        savedStateHandle["query"] = newQuery
    }

    fun search(query: String, saveToRecent: Boolean = true) {
        if (query.isBlank()) return
        
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            if (saveToRecent) {
                userPreferences.addRecentSearch(query)
            }
            _isLoading.value = true
            _error.value = null
            try {
                val songsDef = async { repository.searchSongs(query) }
                val albumsDef = async { repository.searchAlbums(query) }
                val artistsDef = async { repository.searchArtists(query) }
                
                val songs = songsDef.await()
                val albums = albumsDef.await()
                val artists = artistsDef.await()
                
                _searchResults.value = songs
                _albumResults.value = albums
                _artistResults.value = artists

                savedStateHandle["songs_res"] = gson.toJson(songs)
                savedStateHandle["albums_res"] = gson.toJson(albums)
                savedStateHandle["artists_res"] = gson.toJson(artists)
                
                if (songs.isEmpty() && albums.isEmpty() && artists.isEmpty()) {
                    _error.value = "No results found for \"$query\""
                }
            } catch (e: Exception) {
                _error.value = "Search failed: ${e.localizedMessage ?: "Network error"}"
            } finally {
                _isLoading.value = false
            }
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
                musicController.playSong(song)
            }
        }
    }

    fun clearRecentSearches() {
        viewModelScope.launch {
            userPreferences.clearRecentSearches()
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
