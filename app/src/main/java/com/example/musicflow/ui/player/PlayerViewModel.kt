package com.example.musicflow.ui.player

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.musicflow.data.MusicRepository
import com.example.musicflow.data.model.Song
import com.example.musicflow.player.MusicController
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class PlayerViewModel(
    private val musicController: MusicController,
    private val repository: MusicRepository
) : ViewModel() {

    val currentSong: StateFlow<Song?> = musicController.currentSong
    val isPlaying: StateFlow<Boolean> = musicController.isPlaying
    val currentPosition: StateFlow<Long> = musicController.currentPosition
    val duration: StateFlow<Long> = musicController.duration
    val shuffleMode: StateFlow<Boolean> = musicController.shuffleMode
    val repeatMode: StateFlow<Int> = musicController.repeatMode
    val queue: StateFlow<List<Song>> = musicController.queue
    val sleepTimerRemaining: StateFlow<Long?> = musicController.sleepTimerRemaining

    val playlists: StateFlow<List<com.example.musicflow.data.local.PlaylistEntity>> = repository.getPlaylists()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _isFavorite = MutableStateFlow(false)
    val isFavorite: StateFlow<Boolean> = _isFavorite.asStateFlow()

    private val _isDownloaded = MutableStateFlow(false)
    val isDownloaded: StateFlow<Boolean> = _isDownloaded.asStateFlow()

    private val _lyrics = MutableStateFlow<String?>(null)
    val lyrics: StateFlow<String?> = _lyrics.asStateFlow()

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
                }
            }
        }
    }

    private var lyricsJob: kotlinx.coroutines.Job? = null

    private fun fetchLyrics(song: Song) {
        lyricsJob?.cancel()
        lyricsJob = viewModelScope.launch {
            _lyrics.value = "Loading lyrics..."
            _lyrics.value = repository.getLyrics(song)
        }
    }

    fun playSong(song: Song) {
        musicController.playSong(song)
    }

    fun playSongById(id: String) {
        viewModelScope.launch {
            repository.getSongDetails(id)?.let { song ->
                playSong(song)
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
