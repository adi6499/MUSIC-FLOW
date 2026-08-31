package com.example.musicflow.service

import android.app.Activity
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebView
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
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

    @JavascriptInterface
    fun executeHttpRequest(url: String, method: String, headersJson: String, bodyStr: String): String {
        return try {
            val client = okhttp3.OkHttpClient.Builder()
                .connectTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
                .readTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
                .build()

            val requestBuilder = okhttp3.Request.Builder().url(url)

            if (headersJson.isNotEmpty() && headersJson != "{}") {
                try {
                    val headersObj = JSONObject(headersJson)
                    val keys = headersObj.keys()
                    while (keys.hasNext()) {
                        val key = keys.next()
                        val value = headersObj.optString(key)
                        if (value.isNotEmpty()) {
                            requestBuilder.header(key, value)
                        }
                    }
                } catch (_: Exception) {}
            }

            if (method.equals("POST", ignoreCase = true)) {
                val mediaType = "application/json; charset=utf-8".toMediaTypeOrNull()
                val reqBody = (if (bodyStr.isEmpty()) "{}" else bodyStr).toRequestBody(mediaType)
                requestBuilder.post(reqBody)
            } else {
                requestBuilder.get()
            }

            val response = client.newCall(requestBuilder.build()).execute()
            val responseBody = response.body?.string() ?: ""
            val resObj = JSONObject().apply {
                put("status", response.code)
                put("success", response.isSuccessful)
                put("data", responseBody)
            }
            resObj.toString()
        } catch (e: Exception) {
            android.util.Log.e("MediaSessionBridge", "executeHttpRequest failed for $url", e)
            val errObj = JSONObject().apply {
                put("status", 500)
                put("success", false)
                put("error", e.message ?: "Network request failed")
                put("data", "")
            }
            errObj.toString()
        }
    }

    @JavascriptInterface
    fun saveAudioToDevice(fileName: String, base64Data: String, mimeType: String, title: String, artist: String, album: String): Boolean {
        return try {
            val decodedBytes = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                val contentValues = android.content.ContentValues().apply {
                    put(android.provider.MediaStore.Audio.Media.DISPLAY_NAME, fileName)
                    put(android.provider.MediaStore.Audio.Media.TITLE, if (title.isNotEmpty()) title else fileName)
                    put(android.provider.MediaStore.Audio.Media.ARTIST, if (artist.isNotEmpty()) artist else "MusicFlow")
                    put(android.provider.MediaStore.Audio.Media.ALBUM, if (album.isNotEmpty()) album else "MusicFlow Downloads")
                    put(android.provider.MediaStore.Audio.Media.MIME_TYPE, if (mimeType.isNotEmpty()) mimeType else "audio/mpeg")
                    put(android.provider.MediaStore.Audio.Media.RELATIVE_PATH, "Music/MusicFlow")
                    put(android.provider.MediaStore.Audio.Media.IS_PENDING, 1)
                }
                val resolver = context.contentResolver
                val uri = resolver.insert(android.provider.MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, contentValues)
                if (uri != null) {
                    resolver.openOutputStream(uri)?.use { outputStream ->
                        outputStream.write(decodedBytes)
                        outputStream.flush()
                    }
                    contentValues.clear()
                    contentValues.put(android.provider.MediaStore.Audio.Media.IS_PENDING, 0)
                    resolver.update(uri, contentValues, null, null)
                    android.util.Log.i("MediaSessionBridge", "Saved audio file to MediaStore Music/MusicFlow: $fileName")
                    true
                } else {
                    false
                }
            } else {
                val musicDir = java.io.File(
                    android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_MUSIC),
                    "MusicFlow"
                )
                if (!musicDir.exists()) musicDir.mkdirs()
                val destFile = java.io.File(musicDir, fileName)
                java.io.FileOutputStream(destFile).use { fos ->
                    fos.write(decodedBytes)
                    fos.flush()
                }
                android.media.MediaScannerConnection.scanFile(
                    context,
                    arrayOf(destFile.absolutePath),
                    arrayOf(if (mimeType.isNotEmpty()) mimeType else "audio/mpeg"),
                    null
                )
                android.util.Log.i("MediaSessionBridge", "Saved audio file to ${destFile.absolutePath}")
                true
            }
        } catch (e: Exception) {
            android.util.Log.e("MediaSessionBridge", "Failed to save audio to device storage", e)
            false
        }
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
