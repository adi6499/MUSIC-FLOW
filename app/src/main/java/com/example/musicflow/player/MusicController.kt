package com.example.musicflow.player

import android.content.ComponentName
import android.content.Context
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.common.Timeline
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.example.musicflow.data.model.Song
import com.example.musicflow.service.MusicService
import com.google.common.util.concurrent.ListenableFuture
import com.google.common.util.concurrent.MoreExecutors
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class MusicController(
    private val context: Context,
    private val userPreferences: com.example.musicflow.data.local.UserPreferences = com.example.musicflow.data.local.UserPreferences(context)
) {

    private var controllerFuture: ListenableFuture<MediaController>? = null
    private var controller: MediaController? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private val _currentSong = MutableStateFlow<Song?>(null)
    val currentSong: StateFlow<Song?> = _currentSong.asStateFlow()

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying.asStateFlow()

    private val _currentPosition = MutableStateFlow(0L)
    val currentPosition: StateFlow<Long> = _currentPosition.asStateFlow()

    private val _duration = MutableStateFlow(0L)
    val duration: StateFlow<Long> = _duration.asStateFlow()

    private val _shuffleMode = MutableStateFlow(false)
    val shuffleMode: StateFlow<Boolean> = _shuffleMode.asStateFlow()

    private val _repeatMode = MutableStateFlow(Player.REPEAT_MODE_OFF)
    val repeatMode: StateFlow<Int> = _repeatMode.asStateFlow()

    private val _queue = MutableStateFlow<List<Song>>(emptyList())
    val queue: StateFlow<List<Song>> = _queue.asStateFlow()

    private val _sleepTimerRemaining = MutableStateFlow<Long?>(null) // in milliseconds
    val sleepTimerRemaining: StateFlow<Long?> = _sleepTimerRemaining.asStateFlow()

    private var sleepTimerJob: kotlinx.coroutines.Job? = null

    init {
        val sessionToken = SessionToken(context, ComponentName(context, MusicService::class.java))
        controllerFuture = MediaController.Builder(context, sessionToken).buildAsync()
        controllerFuture?.addListener({
            controller = controllerFuture?.get()
            setupController()
        }, MoreExecutors.directExecutor())
    }

    private var positionJob: Job? = null
    private var lastSavedSec = 0L

    private fun setupController() {
        controller?.let {
            val mediaItem = it.currentMediaItem
            if (mediaItem != null) {
                _currentSong.value = mediaItem.toDomain()
                _isPlaying.value = it.isPlaying
                _shuffleMode.value = it.shuffleModeEnabled
                _repeatMode.value = it.repeatMode
                _duration.value = it.duration.coerceAtLeast(0L)
                updateQueue()
                if (it.isPlaying) startPositionPolling()
            } else {
                // Restore last played song and seek position on app startup
                scope.launch {
                    try {
                        val lastSong = userPreferences.lastSavedSong.first()
                        val lastPos = userPreferences.lastPositionMs.first()
                        if (lastSong != null && lastSong.streamUrl.isNotBlank()) {
                            _currentSong.value = lastSong
                            _currentPosition.value = lastPos
                            _duration.value = (lastSong.duration * 1000L).coerceAtLeast(0L)
                            _queue.value = listOf(lastSong)
                            val mItem = lastSong.toMediaItem()
                            controller?.setMediaItem(mItem, lastPos)
                            controller?.prepare()
                        }
                    } catch (e: Exception) {
                        android.util.Log.e("MusicController", "Restore playback state error: ${e.message}")
                    }
                }
            }
        }

        controller?.addListener(object : Player.Listener {
            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                val song = mediaItem?.toDomain()
                _currentSong.value = song
                _duration.value = controller?.duration?.coerceAtLeast(0L) ?: 0L
                if (song != null) {
                    val pos = controller?.currentPosition?.coerceAtLeast(0L) ?: 0L
                    scope.launch { userPreferences.saveLastPlaybackState(song, pos) }
                }
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                _isPlaying.value = isPlaying
                if (isPlaying) {
                    startPositionPolling()
                } else {
                    stopPositionPolling()
                    _currentSong.value?.let { song ->
                        val pos = controller?.currentPosition?.coerceAtLeast(0L) ?: _currentPosition.value
                        scope.launch { userPreferences.updateLastPlaybackPosition(pos) }
                    }
                }
            }

            override fun onShuffleModeEnabledChanged(shuffleModeEnabled: Boolean) {
                _shuffleMode.value = shuffleModeEnabled
            }

            override fun onRepeatModeChanged(repeatMode: Int) {
                _repeatMode.value = repeatMode
            }

            override fun onTimelineChanged(timeline: Timeline, reason: Int) {
                updateQueue()
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_READY) {
                    _duration.value = controller?.duration?.coerceAtLeast(0L) ?: 0L
                    updateQueue()
                }
            }
        })
    }

    private fun updateQueue() {
        controller?.let {
            val items = mutableListOf<Song>()
            for (i in 0 until it.mediaItemCount) {
                items.add(it.getMediaItemAt(i).toDomain())
            }
            _queue.value = items
        }
    }

    private fun startPositionPolling() {
        positionJob?.cancel()
        positionJob = scope.launch {
            while (isActive) {
                val pos = controller?.currentPosition ?: 0L
                _currentPosition.value = pos
                val currentSec = pos / 4000L
                if (currentSec != lastSavedSec) {
                    lastSavedSec = currentSec
                    userPreferences.updateLastPlaybackPosition(pos)
                }
                delay(250)
            }
        }
    }

    private fun stopPositionPolling() {
        positionJob?.cancel()
    }

    fun toggleShuffle() {
        controller?.shuffleModeEnabled = !(controller?.shuffleModeEnabled ?: false)
    }

    fun toggleRepeat() {
        controller?.repeatMode = when (controller?.repeatMode) {
            Player.REPEAT_MODE_OFF -> Player.REPEAT_MODE_ONE
            Player.REPEAT_MODE_ONE -> Player.REPEAT_MODE_ALL
            else -> Player.REPEAT_MODE_OFF
        }
    }

    private fun showToast(message: String) {
        android.os.Handler(android.os.Looper.getMainLooper()).post {
            android.widget.Toast.makeText(context, message, android.widget.Toast.LENGTH_SHORT).show()
        }
    }

    fun playSong(song: Song) {
        if (song.streamUrl.isBlank()) {
            showToast("Couldn't load this track")
            return
        }
        val mediaItem = song.toMediaItem()
        controller?.run {
            setMediaItem(mediaItem)
            prepare()
            play()
        }
    }

    fun switchSongStream(song: Song) {
        if (song.streamUrl.isBlank()) {
            showToast("Couldn't load this track")
            return
        }
        val currentPos = controller?.currentPosition ?: 0L
        val wasPlaying = controller?.isPlaying == true
        val mediaItem = song.toMediaItem()
        _currentSong.value = song
        controller?.run {
            setMediaItem(mediaItem, currentPos)
            prepare()
            if (wasPlaying) play()
        }
    }

    fun playQueue(songs: List<Song>, startIndex: Int = 0) {
        val validSongs = songs.filter { it.streamUrl.isNotBlank() }
        if (validSongs.isEmpty()) {
            showToast("Couldn't load tracks")
            return
        }
        val safeIndex = if (startIndex in validSongs.indices) startIndex else 0
        val mediaItems = validSongs.map { it.toMediaItem() }
        controller?.run {
            setMediaItems(mediaItems)
            seekTo(safeIndex, 0L)
            prepare()
            play()
        }
    }

    fun setRadioQueueKeepPlaying(songs: List<Song>) {
        val validSongs = songs.filter { it.streamUrl.isNotBlank() }
        if (validSongs.isEmpty()) return
        val currentCtrl = controller ?: return
        
        val currentIdx = currentCtrl.currentMediaItemIndex
        val totalCount = currentCtrl.mediaItemCount
        
        // Remove old upcoming queue items after current playing song
        if (totalCount > currentIdx + 1) {
            currentCtrl.removeMediaItems(currentIdx + 1, totalCount)
        }
        
        // Add new radio tracks (excluding the first one if it matches currently playing song)
        val songsToAdd = if (validSongs.firstOrNull()?.id == _currentSong.value?.id) {
            validSongs.drop(1)
        } else {
            validSongs
        }
        
        val mediaItems = songsToAdd.map { it.toMediaItem() }
        if (mediaItems.isNotEmpty()) {
            currentCtrl.addMediaItems(mediaItems)
        }
        showToast("Radio mode active • Playing endlessly")
    }

    fun togglePlayPause() {
        controller?.run {
            if (isPlaying) pause() else play()
        }
    }

    fun seekTo(position: Long) {
        controller?.seekTo(position)
    }

    fun skipNext() {
        controller?.run {
            seekToNext()
            play()
        }
    }

    fun skipPrevious() {
        controller?.run {
            seekToPrevious()
            play()
        }
    }

    // --- Queue Management ---

    fun addToQueue(song: Song) {
        if (song.streamUrl.isBlank()) {
            showToast("Couldn't load this track")
            return
        }
        controller?.addMediaItem(song.toMediaItem())
    }

    fun addMultipleToQueue(songs: List<Song>) {
        val validSongs = songs.filter { it.streamUrl.isNotBlank() }
        if (validSongs.isEmpty()) return
        val currentCtrl = controller ?: return
        val existingIds = mutableSetOf<String>()
        for (i in 0 until currentCtrl.mediaItemCount) {
            existingIds.add(currentCtrl.getMediaItemAt(i).mediaId)
        }
        val itemsToAdd = validSongs.filter { !existingIds.contains(it.id) }.map { it.toMediaItem() }
        if (itemsToAdd.isNotEmpty()) {
            currentCtrl.addMediaItems(itemsToAdd)
        }
    }

    fun playNext(song: Song) {
        if (song.streamUrl.isBlank()) {
            showToast("Couldn't load this track")
            return
        }
        controller?.let {
            val nextIndex = if (it.mediaItemCount > 0) it.currentMediaItemIndex + 1 else 0
            it.addMediaItem(nextIndex, song.toMediaItem())
        }
    }

    fun removeFromQueue(index: Int) {
        controller?.removeMediaItem(index)
    }

    fun moveInQueue(fromIndex: Int, toIndex: Int) {
        controller?.moveMediaItem(fromIndex, toIndex)
    }

    // --- Playback Settings ---

    fun setPlaybackSpeed(speed: Float) {
        controller?.setPlaybackSpeed(speed)
    }

    // --- Sleep Timer ---

    fun setSleepTimer(minutes: Int) {
        sleepTimerJob?.cancel()
        if (minutes <= 0) {
            _sleepTimerRemaining.value = null
            return
        }

        val totalMs = minutes * 60 * 1000L
        _sleepTimerRemaining.value = totalMs
        
        sleepTimerJob = scope.launch {
            var remaining = totalMs
            val initialVol = controller?.volume ?: 1.0f
            while (remaining > 0) {
                delay(1000)
                remaining -= 1000
                _sleepTimerRemaining.value = remaining
                if (remaining <= 60000L) {
                    val fadeFactor = (remaining.toFloat() / 60000f).coerceIn(0.05f, 1f)
                    controller?.volume = initialVol * fadeFactor
                }
            }
            _sleepTimerRemaining.value = null
            controller?.pause()
            controller?.volume = initialVol
        }
    }

    fun release() {
        sleepTimerJob?.cancel()
        scope.cancel()
        MediaController.releaseFuture(controllerFuture!!)
        controller = null
    }
}

// --- Extensions ---

fun Song.toMediaItem(): MediaItem {
    val uri = if (streamUrl.isNotBlank()) android.net.Uri.parse(streamUrl) else android.net.Uri.EMPTY
    return MediaItem.Builder()
        .setMediaId(id ?: "")
        .setUri(uri)
        .setMediaMetadata(
            MediaMetadata.Builder()
                .setTitle(name ?: "")
                .setArtist(artists ?: "")
                .setAlbumTitle(album ?: "")
                .setArtworkUri(if (!image.isNullOrBlank()) android.net.Uri.parse(image) else android.net.Uri.EMPTY)
                .build()
        )
        .build()
}

fun MediaItem.toDomain(): Song {
    val metadata = mediaMetadata
    return Song(
        id = mediaId,
        name = metadata.title?.toString() ?: "",
        artists = metadata.artist?.toString() ?: "",
        album = metadata.albumTitle?.toString() ?: "",
        duration = 0, // Duration handled by state polling
        image = metadata.artworkUri?.toString() ?: "",
        streamUrl = localConfiguration?.uri?.toString() ?: ""
    )
}
