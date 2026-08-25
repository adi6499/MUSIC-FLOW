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
            .debounce(250)
            .distinctUntilChanged()
            .onEach { 
                if (it.isNotBlank()) {
                    search(it, saveToRecent = false)
                } else {
                    searchJob?.cancel()
                    _searchResults.value = emptyList()
                    _albumResults.value = emptyList()
                    _artistResults.value = emptyList()
                    _playlistResults.value = emptyList()
                    _isLoading.value = false
                    _error.value = null
                }
            }
            .launchIn(viewModelScope)
    }

    fun updateQuery(newQuery: String) {
        savedStateHandle["query"] = newQuery
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
            try {
                val songsDef = async { repository.searchComprehensiveSongs(cleanQuery) }
                val albumsDef = async { repository.searchAlbums(cleanQuery, limit = 20) }
                val artistsDef = async { repository.searchArtists(cleanQuery, limit = 20) }
                val playlistsDef = async { repository.searchPlaylists(cleanQuery, limit = 20) }
                
                val songs = songsDef.await()
                val albums = albumsDef.await()
                val artists = artistsDef.await()
                val playlists = playlistsDef.await()
                
                _searchResults.value = songs
                _albumResults.value = albums
                _artistResults.value = artists
                _playlistResults.value = playlists

                try {
                    savedStateHandle["songs_res"] = gson.toJson(songs)
                    savedStateHandle["albums_res"] = gson.toJson(albums)
                    savedStateHandle["artists_res"] = gson.toJson(artists)
                } catch (e: Exception) {
                    // Ignore caching error
                }
                
                if (songs.isEmpty() && albums.isEmpty() && artists.isEmpty() && playlists.isEmpty()) {
                    // Fallback to searching with broad keywords
                    val fallbackSongs = repository.searchSongs(cleanQuery.split(" ").firstOrNull() ?: cleanQuery, limit = 20)
                    if (fallbackSongs.isNotEmpty()) {
                        _searchResults.value = fallbackSongs
                    } else {
                        _error.value = "No results found for \"$cleanQuery\""
                    }
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
