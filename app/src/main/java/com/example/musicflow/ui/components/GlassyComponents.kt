package com.example.musicflow.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Authentic Apple Liquid Glass Surface:
 * Clean, modern, frosted glass with crisp 1px specular lighting border,
 * rich backdrop opacity (no text bleed-through), and soft ambient depth shadow.
 */
@Composable
fun LiquidGlassSurface(
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(24.dp),
    enabled: Boolean = LocalGlassEffects.current,
    borderWidth: Dp = 1.dp,
    content: @Composable BoxScope.() -> Unit
) {
    if (enabled) {
        Box(
            modifier = modifier
                .clip(shape)
                .background(
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            Color(0xFF222228).copy(alpha = 0.96f),
                            Color(0xFF121216).copy(alpha = 0.98f)
                        )
                    )
                )
                .border(
                    width = borderWidth,
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            Color.White.copy(alpha = 0.22f), // Crisp top specular rim
                            Color.White.copy(alpha = 0.06f)  // Ambient lower rim
                        )
                    ),
                    shape = shape
                )
        ) {
            content()
        }
    } else {
        Surface(
            modifier = modifier,
            shape = shape,
            color = MaterialTheme.colorScheme.surface,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f))
        ) {
            Box(content = content)
        }
    }
}

@Composable
fun GlassyBox(
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 24.dp,
    enabled: Boolean = LocalGlassEffects.current,
    content: @Composable BoxScope.() -> Unit
) {
    LiquidGlassSurface(
        modifier = modifier,
        shape = RoundedCornerShape(cornerRadius),
        enabled = enabled,
        content = content
    )
}

@Composable
fun GlassyCard(
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 24.dp,
    enabled: Boolean = LocalGlassEffects.current,
    content: @Composable ColumnScope.() -> Unit
) {
    LiquidGlassSurface(
        modifier = modifier,
        shape = RoundedCornerShape(cornerRadius),
        enabled = enabled
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            content = content
        )
    }
}
