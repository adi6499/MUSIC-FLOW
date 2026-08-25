package com.example.musicflow.ui.theme

import android.graphics.drawable.BitmapDrawable
import androidx.compose.runtime.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.palette.graphics.Palette
import coil.ImageLoader
import coil.request.ImageRequest
import coil.request.SuccessResult

private val paletteMemoryCache = java.util.concurrent.ConcurrentHashMap<String, MusicPalette>()
private val dominantColorMemoryCache = java.util.concurrent.ConcurrentHashMap<String, Color>()

@Composable
fun rememberDominantColor(imageUrl: String?): Color {
    val context = LocalContext.current
    val cached = imageUrl?.let { dominantColorMemoryCache[it] }
    var dominantColor by remember(imageUrl) { mutableStateOf(cached ?: Primary) }

    LaunchedEffect(imageUrl) {
        if (!imageUrl.isNullOrBlank()) {
            dominantColorMemoryCache[imageUrl]?.let {
                dominantColor = it
                return@LaunchedEffect
            }
            kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                val loader = coil.Coil.imageLoader(context)
                val request = ImageRequest.Builder(context)
                    .data(imageUrl)
                    .size(100, 100) // Downsample for 10x faster palette extraction
                    .allowHardware(false)
                    .build()

                val result = (loader.execute(request) as? SuccessResult)?.drawable
                if (result is BitmapDrawable) {
                    val bitmap = result.bitmap
                    Palette.from(bitmap).generate { palette ->
                        palette?.dominantSwatch?.rgb?.let { color ->
                            val c = Color(color)
                            dominantColorMemoryCache[imageUrl] = c
                            dominantColor = c
                        }
                    }
                }
            }
        }
    }

    return dominantColor
}

data class MusicPalette(
    val dominant: Color,
    val muted: Color,
    val vibrant: Color
)

@Composable
fun rememberMusicPalette(imageUrl: String?): MusicPalette {
    val context = LocalContext.current
    val cached = imageUrl?.let { paletteMemoryCache[it] }
    var paletteState by remember(imageUrl) { 
        mutableStateOf(cached ?: MusicPalette(Primary, Surface, Secondary)) 
    }

    LaunchedEffect(imageUrl) {
        if (!imageUrl.isNullOrBlank()) {
            paletteMemoryCache[imageUrl]?.let {
                paletteState = it
                return@LaunchedEffect
            }
            kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                val loader = coil.Coil.imageLoader(context)
                val request = ImageRequest.Builder(context)
                    .data(imageUrl)
                    .size(100, 100) // Downsample for 10x faster palette extraction
                    .allowHardware(false)
                    .build()

                val result = (loader.execute(request) as? SuccessResult)?.drawable
                if (result is BitmapDrawable) {
                    val bitmap = result.bitmap
                    Palette.from(bitmap).generate { palette ->
                        palette?.let {
                            val pal = MusicPalette(
                                dominant = Color(it.getDominantColor(Primary.toArgb())),
                                muted = Color(it.getMutedColor(Surface.toArgb())),
                                vibrant = Color(it.getVibrantColor(Secondary.toArgb()))
                            )
                            paletteMemoryCache[imageUrl] = pal
                            paletteState = pal
                        }
                    }
                }
            }
        }
    }

    return paletteState
}

private fun Color.toArgb(): Int {
    return (this.alpha * 255.0f + 0.5f).toInt() shl 24 or
           ((this.red * 255.0f + 0.5f).toInt() shl 16) or
           ((this.green * 255.0f + 0.5f).toInt() shl 8) or
           (this.blue * 255.0f + 0.5f).toInt()
}
