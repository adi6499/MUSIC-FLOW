package com.example.musicflow.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.example.musicflow.ui.components.*
import com.example.musicflow.ui.theme.*

@Composable
fun ProfileScreen(
    viewModel: ProfileViewModel,
    onBack: () -> Unit,
    onSettingsClick: () -> Unit,
    bottomPadding: androidx.compose.ui.unit.Dp
) {
    val userName by viewModel.userName.collectAsState()
    val playlists by viewModel.playlists.collectAsState()
    val favorites by viewModel.favorites.collectAsState()
    val followedArtists by viewModel.followedArtists.collectAsState()
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .statusBarsPadding()
    ) {
        // Top Bar
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Dimens.ScreenPadding, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Color.White)
            }
            Text("Profile", style = MaterialTheme.typography.headlineMedium, color = Color.White)
            IconButton(onClick = onSettingsClick) {
                Icon(Icons.Default.Settings, contentDescription = "Settings", tint = Color.White)
            }
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = bottomPadding + Dimens.PaddingLarge)
        ) {
            // Header Info
            item {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(vertical = Dimens.PaddingLarge),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    AsyncImage(
                        model = "https://api.dicebear.com/7.x/avataaars/svg?seed=$userName",
                        contentDescription = "Avatar",
                        modifier = Modifier
                            .size(100.dp)
                            .clip(CircleShape)
                            .background(SurfaceVariantDark),
                        contentScale = ContentScale.Crop
                    )
                    Spacer(modifier = Modifier.height(Dimens.PaddingLarge))
                    Text(
                        text = userName ?: "Adesh", 
                        style = MaterialTheme.typography.displayMedium, 
                        color = Color.White
                    )
                    Text(
                        text = "@${userName?.lowercase() ?: "adesh"}", 
                        style = MaterialTheme.typography.bodyMedium, 
                        color = Secondary
                    )
                }
            }

            // Stats Row
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Dimens.ScreenPadding, vertical = Dimens.PaddingLarge),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    ProfileStat("Liked", favorites.size.toString())
                    ProfileStat("Playlists", playlists.size.toString())
                    ProfileStat("Following", followedArtists.size.toString())
                }
            }

            // Liked songs
            item { SectionHeader("Liked songs") }
            if (favorites.isEmpty()) {
                item {
                    Text(
                        text = "No liked songs yet. Tap ♥ on songs to add them here.",
                        color = Secondary,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(horizontal = Dimens.ScreenPadding, vertical = Dimens.PaddingLarge)
                    )
                }
            } else {
                item {
                    Column(modifier = Modifier.padding(bottom = Dimens.PaddingLarge)) {
                        favorites.take(3).forEach { song ->
                            MFListRow(
                                title = song.name,
                                subtitle = song.artists,
                                imageUrl = song.image,
                                trailingIcon = Icons.Default.Favorite,
                                onTrailingClick = {},
                                onClick = {}
                            )
                        }
                    }
                }
            }

            // Playlists
            item {
                SectionHeader("Your Playlists")
                LazyRow(
                    contentPadding = PaddingValues(horizontal = Dimens.ScreenPadding),
                    horizontalArrangement = Arrangement.spacedBy(Dimens.PaddingLarge)
                ) {
                    items(playlists) { playlist ->
                        MFCard(
                            title = playlist.name,
                            subtitle = "Playlist",
                            imageUrl = null,
                            onClick = { /* Navigate */ }
                        )
                    }
                    if (playlists.isEmpty()) {
                        item {
                            ExploreGenreCard("Create Playlist", Color.DarkGray)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ProfileStat(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = value, style = MaterialTheme.typography.headlineMedium, color = Color.White)
        Text(text = label, style = MaterialTheme.typography.bodyMedium, color = Secondary)
    }
}

@Composable
fun SectionHeader(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.headlineSmall,
        color = Color.White,
        modifier = Modifier.padding(horizontal = Dimens.ScreenPadding, vertical = Dimens.PaddingLarge)
    )
}

@Composable
fun SettingsScreen(
    viewModel: ProfileViewModel,
    onBack: () -> Unit,
    onLogout: () -> Unit,
    bottomPadding: androidx.compose.ui.unit.Dp
) {
    val themeMode by viewModel.themeMode.collectAsState()
    val audioQuality by viewModel.audioQuality.collectAsState()
    val glassEffects by viewModel.glassEffects.collectAsState()

    var showAboutDialog by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).statusBarsPadding()
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Dimens.PaddingSmall, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Color.White)
            }
            Text("Settings", style = MaterialTheme.typography.headlineMedium, color = Color.White)
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = bottomPadding + Dimens.PaddingLarge)
        ) {
            item { SettingsSectionHeader("Appearance") }
            item { 
                SettingToggleRow(
                    label = "Dark Theme", 
                    isEnabled = themeMode == "dark",
                    onToggle = { viewModel.updateThemeMode(if (it) "dark" else "light") }
                )
            }
            item {
                SettingToggleRow(
                    label = "Glass Effects",
                    isEnabled = glassEffects,
                    onToggle = { viewModel.updateGlassEffects(it) }
                )
            }

            item { SettingsSectionHeader("Playback") }
            item {
                SettingActionRow(
                    label = "Audio Quality",
                    value = audioQuality,
                    onClick = {
                        val next = if (audioQuality == "320kbps") "160kbps" else "320kbps"
                        viewModel.updateAudioQuality(next)
                    }
                )
            }
            item { SettingRow("Equalizer", isEnabled = false) }
            item { SettingRow("Gapless Playback", isEnabled = false) }

            item { SettingsSectionHeader("General") }
            item { SettingRow("Language (English)") }
            item { SettingRow("Notifications (Enabled)") }
            item { SettingRow("About MusicFlow") { 
                showAboutDialog = true
            }}
            
            item {
                Spacer(modifier = Modifier.height(Dimens.PaddingTripleExtraLarge))
                Row(
                    modifier = Modifier.fillMaxWidth().height(56.dp).clickable(onClick = onLogout).padding(horizontal = Dimens.ScreenPadding),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Log out", style = MaterialTheme.typography.titleMedium, color = MusicAccent)
                }
            }
        }

        if (showAboutDialog) {
            AlertDialog(
                onDismissRequest = { showAboutDialog = false },
                title = { Text("About MusicFlow", color = Color.White) },
                text = {
                    Column {
                        Text("Version 1.0.0", color = Color.White)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Developed by Adesh", color = Secondary)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Powered by Media3 and JioSaavn API", color = Secondary)
                    }
                },
                confirmButton = {
                    TextButton(onClick = { showAboutDialog = false }) { Text("OK", color = MusicAccent) }
                }
            )
        }
    }
}

@Composable
fun SettingsSectionHeader(title: String) {
    Text(
        text = title.uppercase(),
        style = MaterialTheme.typography.labelMedium,
        color = MusicAccent,
        modifier = Modifier.padding(start = Dimens.ScreenPadding, top = 24.dp, bottom = 8.dp)
    )
}

@Composable
fun SettingToggleRow(label: String, isEnabled: Boolean, onToggle: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().height(56.dp).padding(horizontal = Dimens.ScreenPadding),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = label, style = MaterialTheme.typography.titleMedium, color = Color.White)
        Switch(
            checked = isEnabled,
            onCheckedChange = onToggle,
            colors = SwitchDefaults.colors(checkedThumbColor = MusicAccent, checkedTrackColor = MusicAccent.copy(alpha = 0.5f))
        )
    }
    HorizontalDivider(color = DividerColor, thickness = 0.5.dp)
}

@Composable
fun SettingActionRow(label: String, value: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().height(56.dp).clickable(onClick = onClick).padding(horizontal = Dimens.ScreenPadding),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column {
            Text(text = label, style = MaterialTheme.typography.titleMedium, color = Color.White)
            Text(text = value, style = MaterialTheme.typography.bodySmall, color = Secondary)
        }
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = Secondary)
    }
    HorizontalDivider(color = DividerColor, thickness = 0.5.dp)
}

@Composable
fun SettingRow(label: String, isEnabled: Boolean = true, onClick: () -> Unit = {}) {
    val contentColor = if (isEnabled) Color.White else Secondary.copy(alpha = 0.5f)
    Column {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(64.dp)
                .then(if (isEnabled) Modifier.clickable(onClick = onClick) else Modifier)
                .padding(horizontal = Dimens.ScreenPadding),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = if (isEnabled) label else "$label (Coming Soon)", 
                style = MaterialTheme.typography.titleMedium, 
                color = contentColor
            )
            if (isEnabled) {
                Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = Secondary, modifier = Modifier.size(20.dp))
            }
        }
        HorizontalDivider(color = DividerColor, thickness = 0.5.dp)
    }
}
