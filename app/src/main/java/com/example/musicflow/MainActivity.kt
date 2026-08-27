package com.example.musicflow

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import com.example.musicflow.ui.theme.MUSICFLOWTheme

class MainActivity : ComponentActivity() {

    private var webView: WebView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            MUSICFLOWTheme(themeMode = "dark") {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color(0xFF08080A))
                ) {
                    WebMusicFlowScreen(
                        onWebViewCreated = { wv -> webView = wv }
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        intent.data?.let { uri ->
            if (uri.scheme == "musicflow" && uri.host == "song") {
                val songId = uri.lastPathSegment
                if (songId != null) {
                    webView?.evaluateJavascript("App.playSongWithQueue('$songId')", null)
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        webView?.destroy()
        webView = null
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun WebMusicFlowScreen(
    onWebViewCreated: (WebView) -> Unit
) {
    var webViewInstance by remember { mutableStateOf<WebView?>(null) }
    val context = androidx.compose.ui.platform.LocalContext.current

    // Authoritative Smart Back Button Handler:
    // Follows strict priority (Keyboard -> Dialog -> Sheet -> Lyrics -> Full Player -> History Stack -> Home -> Minimize)
    BackHandler {
        webViewInstance?.evaluateJavascript("App && typeof App.handleBack === 'function' ? App.handleBack() : false") { result ->
            if (result == "false" || result == "null") {
                (context as? android.app.Activity)?.moveTaskToBack(true)
            }
        }
    }

    AndroidView(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF08080A)),
        factory = { ctx ->
            WebView(ctx).apply {
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
                setBackgroundColor(android.graphics.Color.parseColor("#08080A"))
                
                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    databaseEnabled = true
                    mediaPlaybackRequiresUserGesture = false
                    allowFileAccess = true
                    allowContentAccess = true
                    loadsImagesAutomatically = true
                    cacheMode = WebSettings.LOAD_DEFAULT
                    useWideViewPort = true
                    loadWithOverviewMode = true
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        safeBrowsingEnabled = false
                    }
                    mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                }

                setLayerType(View.LAYER_TYPE_HARDWARE, null)
                isVerticalScrollBarEnabled = false
                isHorizontalScrollBarEnabled = false

                webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                        val url = request?.url?.toString() ?: return false
                        if (url.startsWith("file:///android_asset/") || url.startsWith("http://") || url.startsWith("https://")) {
                            return false
                        }
                        return false
                    }
                }

                webChromeClient = WebChromeClient()

                loadUrl("file:///android_asset/public/index.html")
                webViewInstance = this
                onWebViewCreated(this)
            }
        }
    )
}
