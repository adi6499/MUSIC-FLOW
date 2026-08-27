package com.example.musicflow.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.musicflow.data.MusicRepository
import com.example.musicflow.data.local.UserPreferences
import com.example.musicflow.data.model.*
import com.example.musicflow.player.MusicController
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class HomeViewModel(
    private val repository: MusicRepository,
    private val userPreferences: UserPreferences,
    private val musicController: MusicController
) : ViewModel() {

    val moods = listOf("All", "Energize", "Relax", "Workout", "Focus", "Party", "Romance", "Sleep")
    
    private val _selectedMood = MutableStateFlow("All")
    val selectedMood: StateFlow<String> = _selectedMood.asStateFlow()

    private val _quickPicks = MutableStateFlow<List<Song>>(emptyList())
    val quickPicks: StateFlow<List<Song>> = _quickPicks.asStateFlow()

    private val _recentlyPlayed = MutableStateFlow<List<Song>>(emptyList())
    val recentlyPlayed: StateFlow<List<Song>> = _recentlyPlayed.asStateFlow()

    private val _trendingSongs = MutableStateFlow<List<Song>>(emptyList())
    val trendingSongs: StateFlow<List<Song>> = _trendingSongs.asStateFlow()

    private val _newReleases = MutableStateFlow<List<Song>>(emptyList())
    val newReleases: StateFlow<List<Song>> = _newReleases.asStateFlow()

    private val _trendingAlbums = MutableStateFlow<List<Album>>(emptyList())
    val trendingAlbums: StateFlow<List<Album>> = _trendingAlbums.asStateFlow()

    private val _topCharts = MutableStateFlow<List<Playlist>>(emptyList())
    val topCharts: StateFlow<List<Playlist>> = _topCharts.asStateFlow()

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

    val languages: StateFlow<Set<String>> = userPreferences.languages
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), setOf("hindi", "english"))

    val playlists: StateFlow<List<com.example.musicflow.data.local.PlaylistEntity>> = repository.getPlaylists()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    init {
        loadHomeData()
        observeHistory()
        observeLanguages()
    }

    private fun observeHistory() {
        repository.getHistory()
            .onEach { _recentlyPlayed.value = it.take(12) }
            .launchIn(viewModelScope)
    }

    private fun observeLanguages() {
        userPreferences.languages
            .drop(1)
            .distinctUntilChanged()
            .onEach {
                loadHomeData()
            }
            .launchIn(viewModelScope)
    }

    fun setMood(mood: String) {
        if (_selectedMood.value == mood) return
        _selectedMood.value = mood
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val query = when (mood) {
                    "Energize" -> "High Energy EDM Party Hits"
                    "Relax" -> "Chill Acoustic Relaxing Lo-Fi"
                    "Workout" -> "Gym Workout Motivation Phonk"
                    "Focus" -> "Deep Focus Ambient Study Beats"
                    "Party" -> "Party Dance Club Hits 2026"
                    "Romance" -> "Romantic Love Songs Acoustic"
                    "Sleep" -> "Sleep Ambient Calm Waves"
                    else -> null
                }
                
                if (query != null) {
                    val moodSongs = repository.searchComprehensiveSongs(query)
                    if (moodSongs.isNotEmpty()) {
                        _quickPicks.value = moodSongs.take(16)
                        _recommendations.value = moodSongs.drop(4).take(12)
                        _trendingSongs.value = moodSongs
                    }
                } else {
                    loadHomeData()
                }
            } catch (e: Exception) {
                // Keep current data
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun loadHomeData() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                val selectedLanguages = userPreferences.languages.first()
                val primaryLang = selectedLanguages.firstOrNull() ?: "hindi"
                val hourOfDay = (System.currentTimeMillis() / (1000 * 3600 * 4)).toInt()

                val searchQueries = listOf(
                    "$primaryLang top hits",
                    "$primaryLang trending 2026",
                    "$primaryLang new releases",
                    "$primaryLang pop",
                    "trending global hits"
                )
                val hourlyQuery = searchQueries[hourOfDay % searchQueries.size]

                coroutineScope {
                    val trendingDeferred = async {
                        try {
                            val res = repository.searchComprehensiveSongs(hourlyQuery)
                            if (res.isNotEmpty()) res else repository.searchSongs(primaryLang, limit = 25)
                        } catch (e: Exception) {
                            emptyList()
                        }
                    }

                    val newReleasesDeferred = async {
                        try {
                            repository.searchComprehensiveSongs("$primaryLang new releases 2026")
                        } catch (e: Exception) {
                            emptyList()
                        }
                    }

                    val albumsDeferred = async {
                        try {
                            repository.searchAlbums("$primaryLang hits", limit = 12)
                        } catch (e: Exception) {
                            emptyList()
                        }
                    }

                    val chartsDeferred = async {
                        try {
                            val charts = repository.searchPlaylists("$primaryLang top 50", limit = 8)
                            if (charts.isNotEmpty()) charts else repository.getTopCharts(limit = 8)
                        } catch (e: Exception) {
                            repository.getTopCharts(limit = 8)
                        }
                    }

                    val trending = trendingDeferred.await()
                    val newRel = newReleasesDeferred.await()
                    val albums = albumsDeferred.await()
                    val charts = chartsDeferred.await()

                    _trendingSongs.value = trending
                    _newReleases.value = if (newRel.isNotEmpty()) newRel else trending.shuffled()
                    _trendingAlbums.value = albums
                    _topCharts.value = charts
                    _quickPicks.value = trending.take(16)
                    
                    // Generate Personalized Hybrid Recommendations from User History & Favorites
                    val candidatePool = (trending + newRel).distinctBy { it.id }
                    _recommendations.value = repository.getPersonalizedRecommendations(candidatePool, limit = 16)
                }

                if (_trendingSongs.value.isEmpty()) {
                    loadFallbackData()
                }
            } catch (e: Exception) {
                android.util.Log.e("HomeViewModel", "Home load error: ${e.message}", e)
                loadFallbackData()
            } finally {
                _isLoading.value = false
            }
        }
    }

    private suspend fun loadFallbackData() {
        try {
            coroutineScope {
                val trendingSearch = async { repository.searchSongs("trending hits", limit = 20) }
                val newSearch = async { repository.searchSongs("top releases", limit = 20) }
                val albumSearch = async { repository.searchAlbums("top albums", limit = 10) }
                val chartsSearch = async { repository.getTopCharts(limit = 10) }

                _trendingSongs.value = trendingSearch.await()
                _newReleases.value = newSearch.await()
                _trendingAlbums.value = albumSearch.await()
                _topCharts.value = chartsSearch.await()
                _quickPicks.value = _trendingSongs.value.take(16)
                _recommendations.value = repository.getPersonalizedRecommendations(_trendingSongs.value + _newReleases.value, limit = 12)
            }
        } catch (e: Exception) {
            _error.value = "Unable to load music. Please check your connection."
        }
    }

    // --- Functional Hero Mix Actions ---

    fun playQuickPicks() {
        viewModelScope.launch {
            val songs = if (_quickPicks.value.isNotEmpty()) _quickPicks.value else _trendingSongs.value
            if (songs.isNotEmpty()) {
                musicController.playQueue(songs, 0)
            }
        }
    }

    fun playYourMix() {
        viewModelScope.launch {
            val songs = if (_recommendations.value.isNotEmpty()) _recommendations.value else _trendingSongs.value
            if (songs.isNotEmpty()) {
                musicController.playQueue(songs, 0)
            } else {
                val mix = repository.searchComprehensiveSongs("Top Hits 2026")
                if (mix.isNotEmpty()) musicController.playQueue(mix, 0)
            }
        }
    }

    fun playPhonkMix() {
        viewModelScope.launch {
            val phonkSongs = repository.searchComprehensiveSongs("Phonk")
            if (phonkSongs.isNotEmpty()) {
                musicController.playQueue(phonkSongs, 0)
            } else {
                val fallback = repository.searchSongs("Brazilian Phonk", limit = 25)
                if (fallback.isNotEmpty()) musicController.playQueue(fallback, 0)
            }
        }
    }

    fun playLoFiMix() {
        viewModelScope.launch {
            val lofiSongs = repository.searchComprehensiveSongs("Lo-Fi Chill")
            if (lofiSongs.isNotEmpty()) {
                musicController.playQueue(lofiSongs, 0)
            } else {
                val fallback = repository.searchSongs("Lofi Study Beats", limit = 25)
                if (fallback.isNotEmpty()) musicController.playQueue(fallback, 0)
            }
        }
    }

    fun playMoodMix(mood: String) {
        setMood(mood)
        viewModelScope.launch {
            kotlinx.coroutines.delay(200)
            playQuickPicks()
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
                val radioQueue = repository.getTrackRadio(song, 25)
                musicController.playQueue(radioQueue, 0)
            } catch (e: Exception) {
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
            val id = "pl_${System.currentTimeMillis()}"
            repository.addPlaylist(
                com.example.musicflow.data.local.PlaylistEntity(
                    id = id,
                    name = name,
                    subtitle = "User playlist",
                    image = ""
                )
            )
        }
    }
}
