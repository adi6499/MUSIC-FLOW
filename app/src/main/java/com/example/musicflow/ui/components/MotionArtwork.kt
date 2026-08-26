package com.example.musicflow.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.example.musicflow.ui.theme.Dimens
import com.example.musicflow.ui.theme.MusicAccent

/**
 * Clean, elegant, high-fidelity Album Artwork card.
 * Simple, crisp presentation without distracting simulated animations.
 */
@Composable
fun MotionArtwork(
    imageUrl: String?,
    modifier: Modifier = Modifier,
    isPlaying: Boolean = true,
    enabled: Boolean = true,
    dominantColor: Color = MusicAccent,
    secondaryColor: Color = Color(0xFF00F2FE),
    shape: Shape = RoundedCornerShape(Dimens.RadiusExtraLarge),
    cornerRadius: Dp = Dimens.RadiusExtraLarge,
    showBadge: Boolean = false,
    contentScale: ContentScale = ContentScale.Crop
) {
    Box(
        modifier = modifier,
        contentAlignment = Alignment.Center
    ) {
        // Clean, crisp, premium Album Artwork container
        Box(
            modifier = Modifier
                .fillMaxSize()
                .shadow(
                    elevation = 20.dp,
                    shape = shape,
                    clip = false
                )
                .clip(shape)
                .background(MaterialTheme.colorScheme.surface)
                .border(
                    BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
                    shape = shape
                )
        ) {
            AsyncImage(
                model = imageUrl,
                contentDescription = "Album Artwork",
                modifier = Modifier.fillMaxSize(),
                contentScale = contentScale
            )
        }
    }
}
