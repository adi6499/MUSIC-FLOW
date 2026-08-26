package com.example.musicflow.ui.player

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.musicflow.data.MusicRepository
import com.example.musicflow.data.model.LrcLine
import com.example.musicflow.data.model.LrcParser
import com.example.musicflow.data.model.LyricsData
import com.example.musicflow.data.model.Song
import com.example.musicflow.player.MusicController
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class PlayerViewModel(
    private val musicController: MusicController,
    private val repository: MusicRepository,
    private val userPreferences: com.example.musicflow.data.local.UserPreferences
) : ViewModel() {

    val currentSong: StateFlow<Song?> = musicController.currentSong
    val isPlaying: StateFlow<Boolean> = musicController.isPlaying
    val currentPosition: StateFlow<Long> = musicController.currentPosition
    val duration: StateFlow<Long> = musicController.duration
    val shuffleMode: StateFlow<Boolean> = musicController.shuffleMode
    val repeatMode: StateFlow<Int> = musicController.repeatMode
    val queue: StateFlow<List<Song>> = musicController.queue
    val sleepTimerRemaining: StateFlow<Long?> = musicController.sleepTimerRemaining

    val audioQuality: StateFlow<String> = userPreferences.audioQuality
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "320kbps")

    val motionArtworkEnabled: StateFlow<Boolean> = userPreferences.motionArtworkEnabled
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), true)

    val playlists: StateFlow<List<com.example.musicflow.data.local.PlaylistEntity>> = repository.getPlaylists()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _isFavorite = MutableStateFlow(false)
    val isFavorite: StateFlow<Boolean> = _isFavorite.asStateFlow()

    private val _isDownloaded = MutableStateFlow(false)
    val isDownloaded: StateFlow<Boolean> = _isDownloaded.asStateFlow()

    private val _lyricsData = MutableStateFlow< LyricsData?>(null)
    val lyricsData: StateFlow<LyricsData?> = _lyricsData.asStateFlow()

    private val _parsedLrcLines = MutableStateFlow<List<LrcLine>>(emptyList())
    val parsedLrcLines: StateFlow<List<LrcLine>> = _parsedLrcLines.asStateFlow()

    private val _isLyricsLoading = MutableStateFlow(false)
    val isLyricsLoading: StateFlow<Boolean> = _isLyricsLoading.asStateFlow()

    val lyrics: StateFlow<String?> = _lyricsData.map {
        it?.plainLyrics ?: it?.syncedLyrics
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val activeLyricIndex: StateFlow<Int> = combine(currentPosition, _parsedLrcLines) { position, lines ->
        if (lines.isEmpty()) -1
        else {
            var idx = -1
            for (i in lines.indices) {
                if (position >= lines[i].timeMs) {
                    idx = i
                } else {
                    break
                }
            }
            idx
        }
    }
    .distinctUntilChanged()
    .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), -1)

    private val _playbackSpeed = MutableStateFlow(1.0f)
    val playbackSpeed: StateFlow<Float> = _playbackSpeed.asStateFlow()

    init {
        observeCurrentSong()
    }

    private fun observeCurrentSong() {
        viewModelScope.launch {
            currentSong.collect { song ->
                if (song != null) {
                    _isFavorite.value = repository.isFavorite(song.id)
                    _isDownloaded.value = repository.isDownloaded(song.id)
                    fetchLyrics(song)
                    repository.addHistory(song)

                    // Auto-fill upcoming endless music if queue is low
                    val currentQueue = musicController.queue.value
                    val currentIndex = currentQueue.indexOfFirst { it.id == song.id }
                    if (currentIndex == -1 || currentIndex >= currentQueue.size - 2) {
                        autoFillEndlessQueue(song)
                    }
                }
            }
        }
    }

    private var autoFillJob: kotlinx.coroutines.Job? = null

    fun autoFillEndlessQueue(song: Song) {
        autoFillJob?.cancel()
        autoFillJob = viewModelScope.launch {
            try {
                val primaryArtist = song.artists.split(",", "&", "feat.", "ft.").firstOrNull()?.trim() ?: ""
                val related = if (primaryArtist.isNotBlank() && primaryArtist != "Unknown Artist") {
                    repository.searchComprehensiveSongs(primaryArtist)
                } else {
                    repository.searchComprehensiveSongs(song.name)
                }
                val valid = related.filter { it.id != song.id && it.streamUrl.isNotBlank() }
                if (valid.isNotEmpty()) {
                    musicController.addMultipleToQueue(valid.take(20))
                }
            } catch (e: Exception) {
                android.util.Log.e("PlayerViewModel", "autoFillEndlessQueue error: ${e.message}")
            }
        }
    }

    private var lyricsJob: kotlinx.coroutines.Job? = null

    fun fetchLyrics(song: Song, force: Boolean = false) {
        lyricsJob?.cancel()
        lyricsJob = viewModelScope.launch {
            _isLyricsLoading.value = true
            if (force) {
                _lyricsData.value = null
                _parsedLrcLines.value = emptyList()
            }
            try {
                val data = repository.getLyrics(song)
                _lyricsData.value = data
                if (data != null && !data.syncedLyrics.isNullOrBlank()) {
                    _parsedLrcLines.value = LrcParser.parse(data.syncedLyrics)
                } else {
                    _parsedLrcLines.value = emptyList()
                }
            } catch (e: Exception) {
                android.util.Log.e("PlayerViewModel", "Error loading lyrics: ${e.message}")
            } finally {
                _isLyricsLoading.value = false
            }
        }
    }

    fun seekToLyric(timeMs: Long) {
        musicController.seekTo(timeMs)
    }

    fun playSong(song: Song) {
        viewModelScope.launch {
            val fullSong = if (song.streamUrl.isNotBlank()) song else repository.getSongDetails(song.id) ?: song
            musicController.playSong(fullSong)
            autoFillEndlessQueue(fullSong)
        }
    }

    fun playSongById(id: String) {
        viewModelScope.launch {
            repository.getSongDetails(id)?.let { song ->
                playSong(song)
            }
        }
    }

    fun updateAudioQuality(quality: String) {
        viewModelScope.launch {
            userPreferences.updateAudioQuality(quality)
            currentSong.value?.let { current ->
                val fullSong = if (current.downloadUrls.isNotEmpty()) current else repository.getSongDetails(current.id) ?: current
                val newStreamUrl = fullSong.downloadUrls.find { it.quality == quality }?.url
                    ?: fullSong.downloadUrls.find { it.quality == "320kbps" }?.url
                    ?: fullSong.downloadUrls.find { it.quality == "160kbps" }?.url
                    ?: fullSong.downloadUrls.lastOrNull()?.url
                    ?: fullSong.streamUrl
                
                if (newStreamUrl.isNotBlank() && newStreamUrl != current.streamUrl) {
                    val updatedSong = fullSong.copy(streamUrl = newStreamUrl)
                    musicController.switchSongStream(updatedSong)
                }
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

                val isCurrent = currentSong.value?.id == fullSong.id
                if (isCurrent && isPlaying.value) {
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

    fun togglePlayPause() {
        musicController.togglePlayPause()
    }

    fun toggleFavorite() {
        viewModelScope.launch {
            currentSong.value?.let { song ->
                repository.toggleFavorite(song)
                _isFavorite.value = repository.isFavorite(song.id)
            }
        }
    }

    fun downloadSong() {
        currentSong.value?.let { song ->
            repository.downloadSong(song)
            viewModelScope.launch {
                kotlinx.coroutines.delay(2000)
                _isDownloaded.value = repository.isDownloaded(song.id)
            }
        }
    }

    fun addToPlaylist(playlistId: String) {
        viewModelScope.launch {
            currentSong.value?.let { song ->
                repository.addSongToPlaylist(playlistId, song)
            }
        }
    }

    fun createPlaylist(name: String) {
        viewModelScope.launch {
            val id = System.currentTimeMillis().toString()
            repository.addPlaylist(com.example.musicflow.data.local.PlaylistEntity(id, name, "", ""))
        }
    }

    fun seekTo(position: Long) {
        musicController.seekTo(position)
    }

    fun toggleShuffle() {
        musicController.toggleShuffle()
    }

    fun toggleRepeat() {
        musicController.toggleRepeat()
    }

    fun skipNext() {
        musicController.skipNext()
    }

    fun skipPrevious() {
        musicController.skipPrevious()
    }

    fun addToQueue(song: Song) {
        musicController.addToQueue(song)
    }

    fun playNext(song: Song) {
        musicController.playNext(song)
    }

    fun removeFromQueue(index: Int) {
        musicController.removeFromQueue(index)
    }

    fun clearQueue() {
        val current = currentSong.value
        if (current != null) {
            musicController.playQueue(listOf(current))
        }
    }

    fun playQueueItem(index: Int) {
        musicController.playQueue(queue.value, index)
    }

    fun moveInQueue(fromIndex: Int, toIndex: Int) {
        musicController.moveInQueue(fromIndex, toIndex)
    }

    fun moveUp(index: Int) {
        if (index > 0) moveInQueue(index, index - 1)
    }

    fun moveDown(index: Int) {
        if (index < queue.value.size - 1) moveInQueue(index, index + 1)
    }

    fun setSleepTimer(minutes: Int) {
        musicController.setSleepTimer(minutes)
    }

    fun setPlaybackSpeed(speed: Float) {
        _playbackSpeed.value = speed
        musicController.setPlaybackSpeed(speed)
    }

    fun shareSong(context: android.content.Context) {
        currentSong.value?.let { song ->
            val sendIntent: android.content.Intent = android.content.Intent().apply {
                action = android.content.Intent.ACTION_SEND
                putExtra(android.content.Intent.EXTRA_TEXT, "Check out this song on MusicFlow: ${song.name} by ${song.artists} \n musicflow://song/${song.id}")
                type = "text/plain"
            }
            val shareIntent = android.content.Intent.createChooser(sendIntent, null)
            context.startActivity(shareIntent)
        }
    }
}
