package com.example.musicflow.ui.profile

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.musicflow.ui.components.AudioQualityDialog
import com.example.musicflow.ui.theme.*

@Composable
fun SettingsScreen(
    viewModel: ProfileViewModel,
    onBack: () -> Unit,
    onEqualizerClick: () -> Unit = {},
    onRestartOnboarding: () -> Unit = {},
    bottomPadding: androidx.compose.ui.unit.Dp = 0.dp
) {
    val userName by viewModel.userName.collectAsState()
    val audioQuality by viewModel.audioQuality.collectAsState()
    val themeMode by viewModel.themeMode.collectAsState()
    val glassEffects by viewModel.glassEffects.collectAsState()
    val motionArtworkEnabled by viewModel.motionArtworkEnabled.collectAsState()
    val languages by viewModel.languages.collectAsState()

    var showQualityDialog by remember { mutableStateOf(false) }
    var showLanguageDialog by remember { mutableStateOf(false) }
    var showThemeDialog by remember { mutableStateOf(false) }

    val displayName = userName?.takeIf { it.isNotBlank() } ?: "Egor Polyakoff"
    val handle = "spikoff"

    val languagesDisplay = if (languages.isNotEmpty()) {
        languages.joinToString(", ") { it.replaceFirstChar { c -> c.uppercase() } }
    } else {
        "Hindi, English"
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .statusBarsPadding()
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Top Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = onBack,
                    modifier = Modifier
                        .size(42.dp)
                        .background(MaterialTheme.colorScheme.surface, CircleShape)
                        .border(1.dp, MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f), CircleShape)
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.size(20.dp)
                    )
                }

                Spacer(modifier = Modifier.weight(1f))

                Text(
                    text = "Setting",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 18.sp
                    ),
                    color = MaterialTheme.colorScheme.onBackground
                )

                Spacer(modifier = Modifier.weight(1f))
                Spacer(modifier = Modifier.size(42.dp))
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Settings Items List
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(horizontal = 20.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // 1. Music Languages
                item {
                    SettingsCardItem(
                        title = "Music Languages",
                        subtitle = languagesDisplay,
                        onClick = { showLanguageDialog = true }
                    )
                }

                // 2. Audio Quality
                item {
                    SettingsCardItem(
                        title = "Audio Quality",
                        subtitle = audioQuality,
                        onClick = { showQualityDialog = true }
                    )
                }

                // 3. Audio Equalizer & Spatial Audio
                item {
                    SettingsCardItem(
                        title = "Equalizer & Spatial Audio",
                        subtitle = "5-band master EQ, bass boost, 3D soundstage",
                        onClick = onEqualizerClick
                    )
                }

                // 4. Theme Mode
                item {
                    SettingsCardItem(
                        title = "Theme Mode",
                        subtitle = themeMode.replaceFirstChar { it.uppercase() },
                        onClick = { showThemeDialog = true }
                    )
                }

                // 4. Glassmorphism Effects Switch
                item {
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(18.dp),
                        color = SurfaceDark,
                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.06f))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 20.dp, vertical = 14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "Glassmorphism Effects",
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        fontWeight = FontWeight.Medium,
                                        fontSize = 15.sp
                                    ),
                                    color = Color.White
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = if (glassEffects) "Enabled (Translucent frost)" else "Disabled (Pure surfaces)",
                                    style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
                                    color = Secondary
                                )
                            }
                            Switch(
                                checked = glassEffects,
                                onCheckedChange = { viewModel.updateGlassEffects(it) },
                                colors = SwitchDefaults.colors(
                                    checkedThumbColor = Color.White,
                                    checkedTrackColor = MusicRed,
                                    uncheckedThumbColor = Color.White.copy(alpha = 0.6f),
                                    uncheckedTrackColor = Color.White.copy(alpha = 0.1f)
                                )
                            )
                        }
                    }
                }

                // 5. Album Motion Artwork Switch
                item {
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(18.dp),
                        color = SurfaceDark,
                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.06f))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 20.dp, vertical = 14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "Motion Artwork",
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        fontWeight = FontWeight.Medium,
                                        fontSize = 15.sp
                                    ),
                                    color = Color.White
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = if (motionArtworkEnabled) "Animate album art on the Now Playing screen" else "Disabled (Static artwork)",
                                    style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
                                    color = Secondary
                                )
                            }
                            Switch(
                                checked = motionArtworkEnabled,
                                onCheckedChange = { viewModel.setMotionArtworkEnabled(it) },
                                colors = SwitchDefaults.colors(
                                    checkedThumbColor = Color.White,
                                    checkedTrackColor = MusicAccent,
                                    uncheckedThumbColor = Color.White.copy(alpha = 0.6f),
                                    uncheckedTrackColor = Color.White.copy(alpha = 0.1f)
                                )
                            )
                        }
                    }
                }

                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    // Account Card
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onRestartOnboarding() },
                        shape = RoundedCornerShape(18.dp),
                        color = SurfaceDark,
                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.06f))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 20.dp, vertical = 16.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = displayName,
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 15.sp
                                    ),
                                    color = Color.White
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = handle,
                                    style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp),
                                    color = Secondary
                                )
                            }
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                                contentDescription = null,
                                tint = Secondary
                            )
                        }
                    }
                }
            }

            // Red Log Out Button at Bottom
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = bottomPadding + 16.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "Log out",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp
                    ),
                    color = MusicRed,
                    modifier = Modifier
                        .clickable { onRestartOnboarding() }
                        .padding(16.dp)
                )
            }
        }

        // Dialogs
        if (showQualityDialog) {
            AudioQualityDialog(
                currentQuality = audioQuality,
                onDismiss = { showQualityDialog = false },
                onQualitySelected = { quality ->
                    viewModel.updateAudioQuality(quality)
                    showQualityDialog = false
                }
            )
        }

        if (showLanguageDialog) {
            MusicLanguageSelectionDialog(
                currentLanguages = languages,
                onDismiss = { showLanguageDialog = false },
                onLanguagesSaved = { selected ->
                    viewModel.updateLanguages(selected)
                    showLanguageDialog = false
                }
            )
        }

        if (showThemeDialog) {
            ThemeSelectionDialog(
                currentTheme = themeMode,
                onDismiss = { showThemeDialog = false },
                onThemeSelected = { mode ->
                    viewModel.updateThemeMode(mode)
                    showThemeDialog = false
                }
            )
        }
    }
}

@Composable
fun SettingsCardItem(
    title: String,
    subtitle: String? = null,
    onClick: () -> Unit
) {
    com.example.musicflow.ui.components.LiquidGlassSurface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(18.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 18.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Medium,
                        fontSize = 15.sp
                    ),
                    color = MaterialTheme.colorScheme.onSurface
                )
                if (!subtitle.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
                        color = MusicRed
                    )
                }
            }
            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = null,
                tint = Secondary
            )
        }
    }
}

@Composable
fun MusicLanguageSelectionDialog(
    currentLanguages: Set<String>,
    onDismiss: () -> Unit,
    onLanguagesSaved: (Set<String>) -> Unit
) {
    val availableLanguages = listOf(
        "hindi" to "Hindi",
        "english" to "English",
        "punjabi" to "Punjabi",
        "tamil" to "Tamil",
        "telugu" to "Telugu",
        "bhojpuri" to "Bhojpuri",
        "malayalam" to "Malayalam",
        "kannada" to "Kannada",
        "bengali" to "Bengali",
        "marathi" to "Marathi",
        "gujarati" to "Gujarati",
        "spanish" to "Spanish",
        "korean" to "Korean"
    )

    val selected = remember { mutableStateListOf<String>().apply { addAll(currentLanguages) } }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = SurfaceDark,
        title = {
            Text(
                text = "Music Languages",
                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                color = Color.White
            )
        },
        text = {
            LazyColumn(
                modifier = Modifier.fillMaxWidth().heightIn(max = 350.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                items(availableLanguages.size) { idx ->
                    val (key, label) = availableLanguages[idx]
                    val isChecked = selected.contains(key)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                if (isChecked) {
                                    if (selected.size > 1) selected.remove(key)
                                } else {
                                    selected.add(key)
                                }
                            }
                            .padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Checkbox(
                            checked = isChecked,
                            onCheckedChange = { check ->
                                if (check) selected.add(key)
                                else if (selected.size > 1) selected.remove(key)
                            },
                            colors = CheckboxDefaults.colors(
                                checkedColor = MusicRed,
                                checkmarkColor = Color.White,
                                uncheckedColor = Secondary
                            )
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = label,
                            style = MaterialTheme.typography.bodyLarge.copy(
                                fontWeight = if (isChecked) FontWeight.Bold else FontWeight.Normal
                            ),
                            color = Color.White
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onLanguagesSaved(selected.toSet()) },
                colors = ButtonDefaults.buttonColors(containerColor = MusicRed)
            ) {
                Text("Save", color = Color.White)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = Secondary)
            }
        }
    )
}

@Composable
fun ThemeSelectionDialog(
    currentTheme: String,
    onDismiss: () -> Unit,
    onThemeSelected: (String) -> Unit
) {
    val themes = listOf(
        "dark" to "Dark Mode (Default)",
        "light" to "Light Mode",
        "system" to "System Default"
    )

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = SurfaceDark,
        title = {
            Text(
                text = "Choose Theme",
                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                color = Color.White
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                themes.forEach { (mode, label) ->
                    val isSelected = currentTheme.equals(mode, ignoreCase = true)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onThemeSelected(mode) }
                            .padding(vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = isSelected,
                            onClick = { onThemeSelected(mode) },
                            colors = RadioButtonDefaults.colors(
                                selectedColor = MusicRed,
                                unselectedColor = Secondary
                            )
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = label,
                            style = MaterialTheme.typography.bodyLarge.copy(
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                            ),
                            color = Color.White
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Close", color = Secondary)
            }
        }
    )
}
