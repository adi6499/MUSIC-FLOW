package com.example.musicflow.ui.equalizer

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.Headphones
import androidx.compose.material.icons.filled.SurroundSound
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.musicflow.player.AudioEffectsManager
import com.example.musicflow.ui.components.LiquidGlassSurface
import com.example.musicflow.ui.theme.MusicAccent
import com.example.musicflow.ui.theme.MusicRed
import com.example.musicflow.ui.theme.Secondary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EqualizerScreen(
    onBack: () -> Unit,
    bottomPadding: androidx.compose.ui.unit.Dp = 180.dp
) {
    val state by AudioEffectsManager.state.collectAsState()
    val scrollState = rememberScrollState()

    val bandLabels = listOf("60Hz\nSub", "230Hz\nBass", "910Hz\nMid", "3.6kHz\nPres", "14kHz\nAir")

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.GraphicEq,
                            contentDescription = null,
                            tint = MusicRed,
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            "Audio Equalizer",
                            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                            color = MaterialTheme.colorScheme.onBackground
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = MaterialTheme.colorScheme.onBackground
                        )
                    }
                },
                actions = {
                    Switch(
                        checked = state.isEnabled,
                        onCheckedChange = { AudioEffectsManager.setEnabled(it) },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = MusicRed,
                            uncheckedThumbColor = Color.Gray,
                            uncheckedTrackColor = Color.DarkGray
                        ),
                        modifier = Modifier.padding(end = 12.dp)
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                )
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(scrollState)
                .padding(horizontal = 20.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // Presets Horizontal Row
            Text(
                text = "SOUND PRESETS",
                style = MaterialTheme.typography.labelMedium.copy(
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                ),
                color = Secondary
            )

            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                items(AudioEffectsManager.presets) { (name, _) ->
                    val isSelected = state.currentPreset == name
                    Surface(
                        shape = RoundedCornerShape(20.dp),
                        color = if (isSelected) MusicRed else MaterialTheme.colorScheme.surface,
                        border = BorderStroke(
                            1.dp,
                            if (isSelected) MusicRed else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.1f)
                        ),
                        modifier = Modifier.clickable {
                            AudioEffectsManager.setPreset(name)
                        }
                    ) {
                        Text(
                            text = name,
                            style = MaterialTheme.typography.bodyMedium.copy(
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                fontSize = 13.sp
                            ),
                            color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp)
                        )
                    }
                }
            }

            // 5-Band Graphic Equalizer Surface
            LiquidGlassSurface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "5-Band Master Equalizer",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            text = if (state.isEnabled) "ACTIVE" else "BYPASSED",
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                            color = if (state.isEnabled) MusicRed else Secondary
                        )
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    // 5 Vertical Slider Columns
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(220.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        state.bandLevels.forEachIndexed { index, milliBels ->
                            val currentDb = (milliBels / 100f)
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                modifier = Modifier.weight(1f)
                            ) {
                                Text(
                                    text = "%+.1fdB".format(currentDb),
                                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp),
                                    color = if (currentDb > 0) MusicRed else MaterialTheme.colorScheme.onSurfaceVariant
                                )

                                Spacer(modifier = Modifier.height(8.dp))

                                // Vertical Slider Box
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .width(36.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Slider(
                                        value = milliBels.toFloat().coerceIn(-1000f, 1000f),
                                        onValueChange = {
                                            AudioEffectsManager.setBandLevel(index, it.toInt())
                                        },
                                        valueRange = -1000f..1000f,
                                        enabled = state.isEnabled,
                                        colors = SliderDefaults.colors(
                                            thumbColor = MusicRed,
                                            activeTrackColor = MusicRed,
                                            inactiveTrackColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.15f)
                                        )
                                    )
                                }

                                Spacer(modifier = Modifier.height(8.dp))

                                Text(
                                    text = bandLabels.getOrElse(index) { "Band $index" },
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Medium
                                    ),
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    lineHeight = 13.sp
                                )
                            }
                        }
                    }
                }
            }

            // Studio Bass Boost Card
            LiquidGlassSurface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Headphones,
                                contentDescription = null,
                                tint = MusicAccent,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                Text(
                                    text = "Studio Bass Boost",
                                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                                Text(
                                    text = "Dynamic acoustic low-end enhancement",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Secondary
                                )
                            }
                        }
                        Text(
                            text = "${(state.bassBoostStrength / 10)}%",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                            color = MusicAccent
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Slider(
                        value = state.bassBoostStrength.toFloat(),
                        onValueChange = { AudioEffectsManager.setBassBoost(it.toInt()) },
                        valueRange = 0f..1000f,
                        enabled = state.isEnabled,
                        colors = SliderDefaults.colors(
                            thumbColor = MusicAccent,
                            activeTrackColor = MusicAccent,
                            inactiveTrackColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.15f)
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            // 3D Spatial Audio Virtualizer Card
            LiquidGlassSurface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.SurroundSound,
                                contentDescription = null,
                                tint = MusicRed,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                Text(
                                    text = "3D Spatial Audio Soundstage",
                                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                                Text(
                                    text = "Apple Spatial Audio wide stereo soundstage",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Secondary
                                )
                            }
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            if (state.spatialAudioEnabled) {
                                Text(
                                    text = "${(state.virtualizerStrength / 10)}%",
                                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                    color = MusicRed,
                                    modifier = Modifier.padding(end = 8.dp)
                                )
                            }
                            Switch(
                                checked = state.spatialAudioEnabled && state.isEnabled,
                                onCheckedChange = { AudioEffectsManager.toggleSpatialAudio(it) },
                                colors = SwitchDefaults.colors(
                                    checkedThumbColor = Color.White,
                                    checkedTrackColor = MusicRed
                                )
                            )
                        }
                    }

                    if (state.spatialAudioEnabled) {
                        Spacer(modifier = Modifier.height(16.dp))

                        Slider(
                            value = state.virtualizerStrength.toFloat(),
                            onValueChange = { AudioEffectsManager.setVirtualizer(it.toInt()) },
                            valueRange = 0f..1000f,
                            enabled = state.isEnabled && state.spatialAudioEnabled,
                            colors = SliderDefaults.colors(
                                thumbColor = MusicRed,
                                activeTrackColor = MusicRed,
                                inactiveTrackColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.15f)
                            ),
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(bottomPadding + 48.dp))
        }
    }
}
