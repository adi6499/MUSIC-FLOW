package com.example.musicflow.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.support.v4.media.session.MediaSessionCompat
import androidx.core.app.NotificationCompat
import androidx.media.app.NotificationCompat.MediaStyle
import com.example.musicflow.MainActivity
import com.example.musicflow.R
import kotlinx.coroutines.*
import java.net.HttpURLConnection
import java.net.URL

class MediaNotificationManager(private val service: MusicService) {

    private val notificationManager = service.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private var currentBitmap: Bitmap? = null
    private var lastArtworkUrl: String? = null

    init {
        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "MusicFlow Playback",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "MusicFlow Lock Screen & Media Controls"
                setShowBadge(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            notificationManager.createNotificationChannel(channel)
        }
    }

    fun buildNotification(
        title: String,
        artist: String,
        album: String,
        artworkUrl: String,
        isPlaying: Boolean,
        sessionToken: MediaSessionCompat.Token? = null,
        onBitmapReady: ((Notification) -> Unit)? = null
    ): Notification {
        val openAppIntent = Intent(service, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val contentPendingIntent = PendingIntent.getActivity(
            service,
            0,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val prevIntent = Intent(service, MusicService::class.java).apply { action = MusicService.ACTION_PREV }
        val prevPendingIntent = PendingIntent.getService(
            service,
            1,
            prevIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val toggleIntent = Intent(service, MusicService::class.java).apply { action = MusicService.ACTION_TOGGLE_PLAY }
        val togglePendingIntent = PendingIntent.getService(
            service,
            2,
            toggleIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val nextIntent = Intent(service, MusicService::class.java).apply { action = MusicService.ACTION_NEXT }
        val nextPendingIntent = PendingIntent.getService(
            service,
            3,
            nextIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val playPauseIcon = if (isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play
        val playPauseTitle = if (isPlaying) "Pause" else "Play"

        val mediaStyle = MediaStyle()
            .setShowActionsInCompactView(0, 1, 2)
        if (sessionToken != null) {
            mediaStyle.setMediaSession(sessionToken)
        }

        val builder = NotificationCompat.Builder(service, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(artist)
            .setSubText(album)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(contentPendingIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(isPlaying)
            .setOnlyAlertOnce(true)
            .setStyle(mediaStyle)
            .addAction(android.R.drawable.ic_media_previous, "Previous", prevPendingIntent)
            .addAction(playPauseIcon, playPauseTitle, togglePendingIntent)
            .addAction(android.R.drawable.ic_media_next, "Next", nextPendingIntent)

        // Set cached artwork if URL matches
        if (currentBitmap != null && lastArtworkUrl == artworkUrl) {
            builder.setLargeIcon(currentBitmap)
        } else {
            // Load artwork asynchronously without blocking notification display
            if (artworkUrl.isNotBlank() && onBitmapReady != null) {
                lastArtworkUrl = artworkUrl
                scope.launch {
                    val bmp = fetchBitmap(artworkUrl)
                    if (bmp != null) {
                        currentBitmap = bmp
                        builder.setLargeIcon(bmp)
                        onBitmapReady(builder.build())
                    }
                }
            }
        }

        return builder.build()
    }

    private suspend fun fetchBitmap(urlStr: String): Bitmap? = withContext(Dispatchers.IO) {
        try {
            val url = URL(urlStr)
            val connection = url.openConnection() as HttpURLConnection
            connection.doInput = true
            connection.connectTimeout = 4000
            connection.readTimeout = 4000
            connection.connect()
            val input = connection.inputStream
            val original = BitmapFactory.decodeStream(input)
            if (original != null) {
                // Scale to 512x512 max for system notification
                Bitmap.createScaledBitmap(original, 512, 512, true)
            } else null
        } catch (e: Exception) {
            null
        }
    }

    fun cancelNotification() {
        scope.cancel()
        notificationManager.cancel(NOTIFICATION_ID)
    }

    companion object {
        const val CHANNEL_ID = "musicflow_media_playback"
        const val NOTIFICATION_ID = 1001
    }
}
