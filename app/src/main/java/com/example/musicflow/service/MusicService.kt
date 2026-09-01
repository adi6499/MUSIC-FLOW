package com.example.musicflow.service

import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.content.ContextCompat

class MusicService : Service() {

    private var mediaSession: MediaSessionCompat? = null
    private var notificationManager: MediaNotificationManager? = null

    private var currentTitle: String = "MusicFlow"
    private var currentArtist: String = "Unknown Artist"
    private var currentAlbum: String = "MusicFlow Lossless"
    private var currentArtworkUrl: String = ""
    private var currentIsPlaying: Boolean = false
    private var currentDurationSec: Double = 0.0
    private var currentPositionSec: Double = 0.0

    private var isNoisyReceiverRegistered = false
    private val becomingNoisyReceiver = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == android.media.AudioManager.ACTION_AUDIO_BECOMING_NOISY) {
                android.util.Log.i("MusicService", "Headphones/Bluetooth disconnected -> Pausing audio playback")
                MediaSessionBridge.sendPause()
            }
        }
    }

    private fun registerNoisyReceiver() {
        if (!isNoisyReceiverRegistered) {
            try {
                registerReceiver(
                    becomingNoisyReceiver,
                    android.content.IntentFilter(android.media.AudioManager.ACTION_AUDIO_BECOMING_NOISY)
                )
                isNoisyReceiverRegistered = true
            } catch (e: Exception) {
                android.util.Log.e("MusicService", "Failed to register noisy receiver", e)
            }
        }
    }

    private fun unregisterNoisyReceiver() {
        if (isNoisyReceiverRegistered) {
            try {
                unregisterReceiver(becomingNoisyReceiver)
                isNoisyReceiverRegistered = false
            } catch (_: Exception) {}
        }
    }

    override fun onCreate() {
        super.onCreate()

        notificationManager = MediaNotificationManager(this)

        mediaSession = MediaSessionCompat(this, "MusicFlowMediaSession").apply {
            setFlags(MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS or MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS)
            setCallback(object : MediaSessionCompat.Callback() {
                override fun onPlay() {
                    MediaSessionBridge.sendPlay()
                }

                override fun onPause() {
                    MediaSessionBridge.sendPause()
                }

                override fun onSkipToNext() {
                    MediaSessionBridge.sendNext()
                }

                override fun onSkipToPrevious() {
                    MediaSessionBridge.sendPrevious()
                }

                override fun onSeekTo(pos: Long) {
                    val posSec = pos / 1000.0
                    MediaSessionBridge.sendSeek(posSec)
                }

                override fun onStop() {
                    MediaSessionBridge.sendPause()
                    stopForeground(false)
                }
            })
            isActive = true
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: return START_STICKY

        when (action) {
            ACTION_UPDATE_METADATA -> {
                currentTitle = intent.getStringExtra(EXTRA_TITLE) ?: currentTitle
                currentArtist = intent.getStringExtra(EXTRA_ARTIST) ?: currentArtist
                currentAlbum = intent.getStringExtra(EXTRA_ALBUM) ?: currentAlbum
                currentArtworkUrl = intent.getStringExtra(EXTRA_ARTWORK) ?: currentArtworkUrl
                currentIsPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, true)
                currentDurationSec = intent.getDoubleExtra(EXTRA_DURATION, 0.0)
                currentPositionSec = intent.getDoubleExtra(EXTRA_POSITION, 0.0)

                updateMediaSessionMetadata()
                updatePlaybackStateCompat()
                publishNotification()
                if (currentIsPlaying) registerNoisyReceiver() else unregisterNoisyReceiver()
            }

            ACTION_UPDATE_STATE -> {
                currentIsPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, currentIsPlaying)
                currentPositionSec = intent.getDoubleExtra(EXTRA_POSITION, currentPositionSec)
                val newDur = intent.getDoubleExtra(EXTRA_DURATION, currentDurationSec)
                if (newDur > 0) currentDurationSec = newDur

                updatePlaybackStateCompat()
                publishNotification()
                if (currentIsPlaying) registerNoisyReceiver() else unregisterNoisyReceiver()
            }

            ACTION_TOGGLE_PLAY -> {
                MediaSessionBridge.sendTogglePlay()
            }

            ACTION_PLAY -> {
                MediaSessionBridge.sendPlay()
            }

            ACTION_PAUSE -> {
                MediaSessionBridge.sendPause()
            }

            ACTION_NEXT -> {
                MediaSessionBridge.sendNext()
            }

            ACTION_PREV -> {
                MediaSessionBridge.sendPrevious()
            }

            ACTION_SEEK -> {
                val posSec = intent.getDoubleExtra(EXTRA_POSITION, 0.0)
                MediaSessionBridge.sendSeek(posSec)
            }

            ACTION_STOP -> {
                unregisterNoisyReceiver()
                stopForeground(true)
                stopSelf()
            }
        }

        return START_STICKY
    }

    private fun updateMediaSessionMetadata() {
        val metadata = MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, currentAlbum)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, (currentDurationSec * 1000).toLong())
            .build()

        mediaSession?.setMetadata(metadata)
    }

    private fun updatePlaybackStateCompat() {
        val state = if (currentIsPlaying) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED
        val playbackSpeed = if (currentIsPlaying) 1.0f else 0.0f
        val posMs = (currentPositionSec * 1000).toLong()

        val playbackState = PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY or
                PlaybackStateCompat.ACTION_PAUSE or
                PlaybackStateCompat.ACTION_PLAY_PAUSE or
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                PlaybackStateCompat.ACTION_SEEK_TO or
                PlaybackStateCompat.ACTION_STOP
            )
            .setState(state, posMs, playbackSpeed)
            .build()

        mediaSession?.setPlaybackState(playbackState)
    }

    private fun publishNotification() {
        val sessionToken = mediaSession?.sessionToken ?: return
        val notif = notificationManager?.buildNotification(
            title = currentTitle,
            artist = currentArtist,
            album = currentAlbum,
            artworkUrl = currentArtworkUrl,
            isPlaying = currentIsPlaying,
            sessionToken = sessionToken
        ) { updatedNotif ->
            try {
                startForeground(MediaNotificationManager.NOTIFICATION_ID, updatedNotif)
            } catch (e: Exception) {}
        }

        if (notif != null) {
            try {
                startForeground(MediaNotificationManager.NOTIFICATION_ID, notif)
            } catch (e: Exception) {}
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        unregisterNoisyReceiver()
        notificationManager?.cancelNotification()
        mediaSession?.run {
            isActive = false
            release()
        }
        mediaSession = null
        super.onDestroy()
    }

    companion object {
        const val ACTION_UPDATE_METADATA = "com.example.musicflow.ACTION_UPDATE_METADATA"
        const val ACTION_UPDATE_STATE = "com.example.musicflow.ACTION_UPDATE_STATE"
        const val ACTION_TOGGLE_PLAY = "com.example.musicflow.ACTION_TOGGLE_PLAY"
        const val ACTION_PLAY = "com.example.musicflow.ACTION_PLAY"
        const val ACTION_PAUSE = "com.example.musicflow.ACTION_PAUSE"
        const val ACTION_NEXT = "com.example.musicflow.ACTION_NEXT"
        const val ACTION_PREV = "com.example.musicflow.ACTION_PREV"
        const val ACTION_SEEK = "com.example.musicflow.ACTION_SEEK"
        const val ACTION_STOP = "com.example.musicflow.ACTION_STOP"

        const val EXTRA_TITLE = "extra_title"
        const val EXTRA_ARTIST = "extra_artist"
        const val EXTRA_ALBUM = "extra_album"
        const val EXTRA_ARTWORK = "extra_artwork"
        const val EXTRA_IS_PLAYING = "extra_is_playing"
        const val EXTRA_DURATION = "extra_duration"
        const val EXTRA_POSITION = "extra_position"

        fun startOrUpdateNotification(
            context: Context,
            title: String,
            artist: String,
            album: String,
            artworkUrl: String,
            isPlaying: Boolean,
            duration: Double,
            position: Double
        ) {
            val intent = Intent(context, MusicService::class.java).apply {
                action = ACTION_UPDATE_METADATA
                putExtra(EXTRA_TITLE, title)
                putExtra(EXTRA_ARTIST, artist)
                putExtra(EXTRA_ALBUM, album)
                putExtra(EXTRA_ARTWORK, artworkUrl)
                putExtra(EXTRA_IS_PLAYING, isPlaying)
                putExtra(EXTRA_DURATION, duration)
                putExtra(EXTRA_POSITION, position)
            }
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    ContextCompat.startForegroundService(context, intent)
                } else {
                    context.startService(intent)
                }
            } catch (e: Exception) {
                android.util.Log.e("MusicService", "startOrUpdateNotification error", e)
            }
        }

        fun updatePlaybackState(
            context: Context,
            isPlaying: Boolean,
            positionSec: Double,
            durationSec: Double
        ) {
            val intent = Intent(context, MusicService::class.java).apply {
                action = ACTION_UPDATE_STATE
                putExtra(EXTRA_IS_PLAYING, isPlaying)
                putExtra(EXTRA_POSITION, positionSec)
                putExtra(EXTRA_DURATION, durationSec)
            }
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && isPlaying) {
                    ContextCompat.startForegroundService(context, intent)
                } else {
                    context.startService(intent)
                }
            } catch (e: Exception) {
                android.util.Log.e("MusicService", "updatePlaybackState error", e)
            }
        }

        fun stopMediaService(context: Context) {
            val intent = Intent(context, MusicService::class.java).apply {
                action = ACTION_STOP
            }
            try {
                context.startService(intent)
            } catch (e: Exception) {}
        }
    }
}
