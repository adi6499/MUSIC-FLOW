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
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class MusicController(context: Context) {

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

    private fun setupController() {
        controller?.let {
            _currentSong.value = it.currentMediaItem?.toDomain()
            _isPlaying.value = it.isPlaying
            _shuffleMode.value = it.shuffleModeEnabled
            _repeatMode.value = it.repeatMode
            _duration.value = it.duration.coerceAtLeast(0L)
            updateQueue()
            if (it.isPlaying) startPositionPolling()
        }

        controller?.addListener(object : Player.Listener {
            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                _currentSong.value = mediaItem?.toDomain()
                _duration.value = controller?.duration?.coerceAtLeast(0L) ?: 0L
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                _isPlaying.value = isPlaying
                if (isPlaying) {
                    startPositionPolling()
                } else {
                    stopPositionPolling()
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
                _currentPosition.value = controller?.currentPosition ?: 0L
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

    fun playSong(song: Song) {
        val mediaItem = song.toMediaItem()
        controller?.run {
            setMediaItem(mediaItem)
            prepare()
            play()
        }
    }

    fun playQueue(songs: List<Song>, startIndex: Int = 0) {
        val mediaItems = songs.map { it.toMediaItem() }
        controller?.run {
            setMediaItems(mediaItems)
            seekTo(startIndex, 0L)
            prepare()
            play()
        }
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
        controller?.seekToNext()
    }

    fun skipPrevious() {
        controller?.seekToPrevious()
    }

    // --- Queue Management ---

    fun addToQueue(song: Song) {
        controller?.addMediaItem(song.toMediaItem())
    }

    fun playNext(song: Song) {
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
            while (remaining > 0) {
                delay(1000)
                remaining -= 1000
                _sleepTimerRemaining.value = remaining
            }
            _sleepTimerRemaining.value = null
            controller?.pause()
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
    return MediaItem.Builder()
        .setMediaId(id ?: "")
        .setUri(streamUrl ?: "")
        .setMediaMetadata(
            MediaMetadata.Builder()
                .setTitle(name ?: "")
                .setArtist(artists ?: "")
                .setAlbumTitle(album ?: "")
                .setArtworkUri(if (image != null) android.net.Uri.parse(image) else android.net.Uri.EMPTY)
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
