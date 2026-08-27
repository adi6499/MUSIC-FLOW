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

    private val _selectedCategory = MutableStateFlow("All")
    val selectedCategory: StateFlow<String> = _selectedCategory.asStateFlow()

    private val gson = com.google.gson.Gson()

    private val _searchResults = MutableStateFlow<List<Song>>(
        savedStateHandle.get<String>("songs_res")?.let {
            try { gson.fromJson(it, object : com.google.gson.reflect.TypeToken<List<Song>>() {}.type) } catch (e: Exception) { emptyList() }
        } ?: emptyList()
    )
    val searchResults: StateFlow<List<Song>> = _searchResults.asStateFlow()

    private val _albumResults = MutableStateFlow<List<Album>>(
        savedStateHandle.get<String>("albums_res")?.let {
            try { gson.fromJson(it, object : com.google.gson.reflect.TypeToken<List<Album>>() {}.type) } catch (e: Exception) { emptyList() }
        } ?: emptyList()
    )
    val albumResults: StateFlow<List<Album>> = _albumResults.asStateFlow()

    private val _artistResults = MutableStateFlow<List<Artist>>(
        savedStateHandle.get<String>("artists_res")?.let {
            try { gson.fromJson(it, object : com.google.gson.reflect.TypeToken<List<Artist>>() {}.type) } catch (e: Exception) { emptyList() }
        } ?: emptyList()
    )
    val artistResults: StateFlow<List<Artist>> = _artistResults.asStateFlow()

    private val _playlistResults = MutableStateFlow<List<Playlist>>(emptyList())
    val playlistResults: StateFlow<List<Playlist>> = _playlistResults.asStateFlow()

    private val _didYouMean = MutableStateFlow<String?>(null)
    val didYouMean: StateFlow<String?> = _didYouMean.asStateFlow()

    private val _autocompleteSuggestions = MutableStateFlow<List<String>>(emptyList())
    val autocompleteSuggestions: StateFlow<List<String>> = _autocompleteSuggestions.asStateFlow()

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

    val history: StateFlow<List<Song>> = repository.getHistory()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    init {
        loadTrending()
        observeQuery()
    }

    private fun loadTrending() {
        viewModelScope.launch {
            try {
                val songs = repository.searchSongs("trending", limit = 15)
                val keywords = songs.map { it.name }.distinct().take(10)
                if (keywords.isNotEmpty()) {
                    _trendingKeywords.value = keywords
                } else {
                    _trendingKeywords.value = listOf("Starboy", "Arijit Singh", "Phonk", "Tum Hi Ho", "Bollywood", "Hip Hop", "The Weeknd", "Lo-Fi")
                }
            } catch (e: Exception) {
                _trendingKeywords.value = listOf("Starboy", "Arijit Singh", "Phonk", "Tum Hi Ho", "Bollywood", "Hip Hop", "The Weeknd", "Lo-Fi")
            }
        }
    }

    private var searchJob: Job? = null

    private fun observeQuery() {
        _query
            .debounce(200)
            .distinctUntilChanged()
            .onEach { q ->
                if (q.isNotBlank()) {
                    _autocompleteSuggestions.value = com.example.musicflow.data.search.SearchEngine
                        .getAutocompleteSuggestions(q, recentSearches.value)
                    search(q, saveToRecent = false)
                } else {
                    searchJob?.cancel()
                    _searchResults.value = emptyList()
                    _albumResults.value = emptyList()
                    _artistResults.value = emptyList()
                    _playlistResults.value = emptyList()
                    _didYouMean.value = null
                    _autocompleteSuggestions.value = emptyList()
                    _isLoading.value = false
                    _error.value = null
                }
            }
            .launchIn(viewModelScope)
    }

    fun updateQuery(newQuery: String) {
        savedStateHandle["query"] = newQuery
        if (newQuery.isNotBlank()) {
            _autocompleteSuggestions.value = com.example.musicflow.data.search.SearchEngine
                .getAutocompleteSuggestions(newQuery, recentSearches.value)
        } else {
            _autocompleteSuggestions.value = emptyList()
        }
    }

    fun selectCategory(category: String) {
        _selectedCategory.value = category
    }

    fun search(query: String, saveToRecent: Boolean = true) {
        val cleanQuery = query.trim()
        if (cleanQuery.isBlank()) return
        
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            if (saveToRecent) {
                userPreferences.addRecentSearch(cleanQuery)
            }
            _isLoading.value = true
            _error.value = null
            _didYouMean.value = null
            try {
                val enhanced = repository.searchAllCategories(cleanQuery)
                
                _searchResults.value = enhanced.songs
                _albumResults.value = enhanced.albums
                _artistResults.value = enhanced.artists
                _playlistResults.value = enhanced.playlists
                _didYouMean.value = enhanced.didYouMean

                try {
                    savedStateHandle["songs_res"] = gson.toJson(enhanced.songs)
                    savedStateHandle["albums_res"] = gson.toJson(enhanced.albums)
                    savedStateHandle["artists_res"] = gson.toJson(enhanced.artists)
                } catch (e: Exception) {
                    // Ignore caching error
                }
                
                if (enhanced.songs.isEmpty() && enhanced.albums.isEmpty() && enhanced.artists.isEmpty() && enhanced.playlists.isEmpty()) {
                    _error.value = "No results found for \"$cleanQuery\""
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
                val fullSong = if (song.streamUrl.isNotBlank()) song else repository.getSongDetails(song.id) ?: song
                val radioQueue = repository.getTrackRadio(fullSong, 25)

                val isCurrent = musicController.currentSong.value?.id == fullSong.id
                if (isCurrent && musicController.isPlaying.value) {
                    musicController.setRadioQueueKeepPlaying(radioQueue)
                } else {
                    musicController.playQueue(radioQueue, 0)
                }
            } catch (e: Exception) {
                val fullSong = if (song.streamUrl.isNotBlank()) song else repository.getSongDetails(song.id) ?: song
                musicController.playSong(fullSong)
            }
        }
    }

    fun clearRecentSearches() {
        viewModelScope.launch {
            userPreferences.clearRecentSearches()
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
