package com.example.musicflow.ui.theme

import android.graphics.drawable.BitmapDrawable
import androidx.compose.runtime.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.palette.graphics.Palette
import coil.ImageLoader
import coil.request.ImageRequest
import coil.request.SuccessResult

@Composable
fun rememberDominantColor(imageUrl: String?): Color {
    val context = LocalContext.current
    var dominantColor by remember { mutableStateOf(Primary) }

    LaunchedEffect(imageUrl) {
        if (!imageUrl.isNullOrBlank()) {
            val loader = ImageLoader(context)
            val request = ImageRequest.Builder(context)
                .data(imageUrl)
                .allowHardware(false) // Required for Palette
                .build()

            val result = (loader.execute(request) as? SuccessResult)?.drawable
            if (result is BitmapDrawable) {
                val bitmap = result.bitmap
                Palette.from(bitmap).generate { palette ->
                    palette?.dominantSwatch?.rgb?.let { color ->
                        dominantColor = Color(color)
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
    var paletteState by remember { 
        mutableStateOf(MusicPalette(Primary, Surface, Secondary)) 
    }

    LaunchedEffect(imageUrl) {
        if (!imageUrl.isNullOrBlank()) {
            val loader = ImageLoader(context)
            val request = ImageRequest.Builder(context)
                .data(imageUrl)
                .allowHardware(false)
                .build()

            val result = (loader.execute(request) as? SuccessResult)?.drawable
            if (result is BitmapDrawable) {
                val bitmap = result.bitmap
                Palette.from(bitmap).generate { palette ->
                    palette?.let {
                        paletteState = MusicPalette(
                            dominant = Color(it.getDominantColor(Primary.toArgb())),
                            muted = Color(it.getMutedColor(Surface.toArgb())),
                            vibrant = Color(it.getVibrantColor(Secondary.toArgb()))
                        )
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
