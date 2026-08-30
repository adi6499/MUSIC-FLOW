package com.example.musicflow.service

import android.app.Activity
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject
import java.lang.ref.WeakReference

/**
 * Android JavaScript Media Bridge
 * Connects the web player to the Native Android MediaSession and System Notification/Lock Screen.
 */
class MediaSessionBridge(
    private val context: Context,
    webView: WebView?
) {

    init {
        activeWebView = WeakReference(webView)
        appContext = context.applicationContext
    }

    @JavascriptInterface
    fun updateMetadata(jsonStr: String) {
        try {
            val json = JSONObject(jsonStr)
            val id = json.optString("id", "")
            val title = json.optString("title", "Unknown Track")
            val artist = json.optString("artist", "Unknown Artist")
            val album = json.optString("album", "MusicFlow Lossless")
            val artwork = json.optString("artwork", "")
            val duration = json.optDouble("duration", 0.0)
            val position = json.optDouble("position", 0.0)
            val isPlaying = json.optBoolean("isPlaying", true)

            currentTrackInfo = TrackMetadata(
                id = id,
                title = title,
                artist = artist,
                album = album,
                artworkUrl = artwork,
                duration = duration,
                position = position,
                isPlaying = isPlaying
            )

            MusicService.startOrUpdateNotification(
                context = context,
                title = title,
                artist = artist,
                album = album,
                artworkUrl = artwork,
                isPlaying = isPlaying,
                duration = duration,
                position = position
            )
        } catch (e: Exception) {
            android.util.Log.e("MediaSessionBridge", "updateMetadata parse error", e)
        }
    }

    @JavascriptInterface
    fun setPlaybackState(isPlaying: Boolean, positionSec: Double, durationSec: Double, playbackRate: Float) {
        try {
            currentTrackInfo?.let { current ->
                currentTrackInfo = current.copy(
                    isPlaying = isPlaying,
                    position = positionSec,
                    duration = if (durationSec > 0) durationSec else current.duration
                )

                MusicService.updatePlaybackState(
                    context = context,
                    isPlaying = isPlaying,
                    positionSec = positionSec,
                    durationSec = durationSec
                )
            }
        } catch (e: Exception) {
            android.util.Log.e("MediaSessionBridge", "setPlaybackState error", e)
        }
    }

    @JavascriptInterface
    fun setQueue(queueJson: String, currentIndex: Int) {
        // Saved for lock-screen queue browsing where supported
        lastQueueIndex = currentIndex
    }

    @JavascriptInterface
    fun releaseSession() {
        MusicService.stopMediaService(context)
        currentTrackInfo = null
    }

    data class TrackMetadata(
        val id: String,
        val title: String,
        val artist: String,
        val album: String,
        val artworkUrl: String,
        val duration: Double,
        val position: Double,
        val isPlaying: Boolean
    )

    companion object {
        private var activeWebView: WeakReference<WebView>? = null
        private var appContext: Context? = null
        private val mainHandler = Handler(Looper.getMainLooper())

        var currentTrackInfo: TrackMetadata? = null
        var lastQueueIndex: Int = 0

        fun registerWebView(webView: WebView?) {
            activeWebView = WeakReference(webView)
        }

        fun sendPlay() {
            executeJS("if (window.Player && typeof window.Player.play === 'function') { window.Player.play(); }")
        }

        fun sendPause() {
            executeJS("if (window.Player && typeof window.Player.pause === 'function') { window.Player.pause(); }")
        }

        fun sendTogglePlay() {
            executeJS("if (window.Player && typeof window.Player.togglePlay === 'function') { window.Player.togglePlay(); }")
        }

        fun sendNext() {
            executeJS("if (window.Player && typeof window.Player.next === 'function') { window.Player.next(); }")
        }

        fun sendPrevious() {
            executeJS("if (window.Player && typeof window.Player.previous === 'function') { window.Player.previous(); }")
        }

        fun sendSeek(positionSec: Double) {
            executeJS("if (window.Player && typeof window.Player.seek === 'function') { window.Player.seek($positionSec); }")
        }

        private fun executeJS(jsCode: String) {
            mainHandler.post {
                try {
                    val wv = activeWebView?.get()
                    if (wv != null) {
                        wv.evaluateJavascript(jsCode, null)
                    }
                } catch (e: Exception) {
                    android.util.Log.e("MediaSessionBridge", "executeJS error: ${e.message}")
                }
            }
        }
    }
}
