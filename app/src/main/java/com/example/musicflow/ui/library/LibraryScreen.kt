package com.example.musicflow.ui.library

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material3.*
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.example.musicflow.data.model.Song
import com.example.musicflow.ui.components.*
import com.example.musicflow.ui.theme.*

@Composable
fun LibraryScreen(
    viewModel: LibraryViewModel,
    onSongClick: (Song) -> Unit,
    onPlaylistClick: (String) -> Unit,
    bottomPadding: androidx.compose.ui.unit.Dp
) {
    val playlists by viewModel.playlists.collectAsState()
    val favorites by viewModel.favorites.collectAsState()
    val history by viewModel.history.collectAsState()
    val downloads by viewModel.downloads.collectAsState()
    
    var selectedSongForMenu by remember { mutableStateOf<Song?>(null) }
    var selectedTab by remember { mutableStateOf(0) }
    var showCreateDialog by remember { mutableStateOf(false) }
    var newPlaylistName by remember { mutableStateOf("") }
    
    var selectedSongForPlaylist by remember { mutableStateOf<Song?>(null) }
    var showCreatePlaylistDialog by remember { mutableStateOf(false) }
    var newPlaylistNameDialog by remember { mutableStateOf("") }
    
    val tabs = listOf("Playlists", "Songs", "History", "Downloads")

    if (showCreateDialog) {
        AlertDialog(
            onDismissRequest = { showCreateDialog = false },
            title = { Text("New Playlist", color = Color.White) },
            text = {
                TextField(
                    value = newPlaylistName,
                    onValueChange = { newPlaylistName = it },
                    placeholder = { Text("Playlist Name") },
                    singleLine = true
                )
            },
            confirmButton = {
                Button(onClick = {
                    if (newPlaylistName.isNotBlank()) {
                        viewModel.createPlaylist(newPlaylistName)
                        newPlaylistName = ""
                        showCreateDialog = false
                    }
                }) { Text("Create") }
            },
            dismissButton = {
                TextButton(onClick = { showCreateDialog = false }) { Text("Cancel", color = Secondary) }
            }
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
            .statusBarsPadding()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Dimens.ScreenPadding, vertical = Dimens.PaddingLarge),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Library",
                style = MaterialTheme.typography.displayLarge,
                color = Color.White
            )
            IconButton(
                onClick = { showCreateDialog = true },
                modifier = Modifier.background(SurfaceVariantDark, CircleShape)
            ) {
                Icon(Icons.Filled.Add, contentDescription = "Add", tint = Color.White)
            }
        }

        ScrollableTabRow(
            selectedTabIndex = selectedTab,
            containerColor = Color.Transparent,
            contentColor = MusicAccent,
            edgePadding = Dimens.ScreenPadding,
            divider = {},
            indicator = { tabPositions ->
                if (selectedTab < tabPositions.size) {
                    Box(
                        modifier = Modifier
                            .tabIndicatorOffset(tabPositions[selectedTab])
                            .fillMaxWidth()
                            .height(32.dp)
                            .padding(horizontal = 4.dp, vertical = 4.dp)
                            .background(MusicAccent.copy(alpha = 0.1f), CircleShape)
                            .border(1.dp, MusicAccent.copy(alpha = 0.2f), CircleShape)
                    )
                }
            }
        ) {
            tabs.forEachIndexed { index, title ->
                Tab(
                    selected = selectedTab == index,
                    onClick = { selectedTab = index },
                    text = {
                        Text(
                            text = title,
                            style = if (selectedTab == index) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyLarge,
                            color = if (selectedTab == index) Color.White else Secondary
                        )
                    }
                )
            }
        }

        Spacer(modifier = Modifier.height(Dimens.PaddingLarge))

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = bottomPadding + Dimens.PaddingLarge)
        ) {
            when (selectedTab) {
                0 -> { // Playlists
                    item {
                        MFListRow(
                            title = "Liked Songs",
                            subtitle = "Playlist • ${favorites.size} songs",
                            imageUrl = null,
                            trailingIcon = Icons.Default.Favorite,
                            onTrailingClick = { /* No menu for Liked Songs */ },
                            onClick = { selectedTab = 1 }
                        )
                    }
                    items(playlists, key = { it.id }) { playlist ->
                        MFListRow(
                            title = playlist.name,
                            subtitle = "Playlist • Created by you",
                            imageUrl = null,
                            trailingIcon = Icons.Default.MoreVert,
                            onTrailingClick = { /* Playlist Menu */ },
                            onClick = { onPlaylistClick(playlist.id) }
                        )
                    }
                    // No empty state here if we always show Liked Songs?
                    // Or only show a small hint if NO playlists exist.
                    if (playlists.isEmpty()) {
                        item {
                            Spacer(modifier = Modifier.height(Dimens.PaddingLarge))
                            Text(
                                text = "Create playlists using the + button",
                                color = Secondary,
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.padding(horizontal = Dimens.ScreenPadding)
                            )
                        }
                    }
                }
                1 -> { // Songs
                    if (favorites.isEmpty()) {
                        item {
                            EmptyState(
                                message = "No liked songs yet.",
                                icon = Icons.Default.FavoriteBorder
                            )
                        }
                    } else {
                        items(favorites, key = { it.id }) { song ->
                            MFListRow(
                                title = song.name,
                                subtitle = song.artists,
                                imageUrl = song.image,
                                onTrailingClick = { selectedSongForMenu = song },
                                onClick = { onSongClick(song) }
                            )
                        }
                    }
                }
                2 -> { // History
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(horizontal = Dimens.ScreenPadding, vertical = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(text = "Recent listening", style = MaterialTheme.typography.titleMedium, color = Color.White)
                            if (history.isNotEmpty()) {
                                TextButton(onClick = { viewModel.clearHistory() }) {
                                    Text("Clear All", color = MusicAccent)
                                }
                            }
                        }
                    }
                    if (history.isEmpty()) {
                        item {
                            EmptyState(
                                message = "Your recently played songs will appear here.",
                                icon = Icons.Filled.History
                            )
                        }
                    } else {
                        items(history, key = { it.id }) { song ->
                            MFListRow(
                                title = song.name,
                                subtitle = song.artists,
                                imageUrl = song.image,
                                onTrailingClick = { selectedSongForMenu = song },
                                onClick = { onSongClick(song) }
                            )
                        }
                    }
                }
                3 -> { // Downloads
                    if (downloads.isEmpty()) {
                        item {
                            EmptyState(
                                message = "Downloaded songs will appear here.",
                                icon = Icons.Filled.Download
                            )
                        }
                    } else {
                        items(downloads, key = { it.id }) { song ->
                            MFListRow(
                                title = song.name,
                                subtitle = song.artists,
                                imageUrl = song.image,
                                onTrailingClick = { selectedSongForMenu = song },
                                onClick = { onSongClick(song) }
                            )
                        }
                    }
                }
            }
        }

        selectedSongForMenu?.let { song ->
            val context = androidx.compose.ui.platform.LocalContext.current
            SongContextMenu(
                song = song,
                onDismiss = { selectedSongForMenu = null },
                onPlayNext = { viewModel.playNext(song); selectedSongForMenu = null },
                onAddToQueue = { viewModel.addToQueue(song); selectedSongForMenu = null },
                onAddToPlaylist = { selectedSongForPlaylist = song; selectedSongForMenu = null },
                onStartRadio = { viewModel.startRadio(song); selectedSongForMenu = null },
                onLike = { viewModel.toggleFavorite(song); selectedSongForMenu = null },
                onShare = {
                    val sendIntent: android.content.Intent = android.content.Intent().apply {
                        action = android.content.Intent.ACTION_SEND
                        putExtra(android.content.Intent.EXTRA_TEXT, "Check out ${song.name} on MusicFlow: musicflow://song/${song.id}")
                        type = "text/plain"
                    }
                    context.startActivity(android.content.Intent.createChooser(sendIntent, null))
                    selectedSongForMenu = null
                }
            )
        }

        selectedSongForPlaylist?.let { song ->
            PlaylistSelectionDialog(
                playlists = playlists,
                onDismiss = { selectedSongForPlaylist = null },
                onPlaylistSelected = { playlistId ->
                    viewModel.addToPlaylist(playlistId, song)
                    selectedSongForPlaylist = null
                },
                onCreateNew = { showCreatePlaylistDialog = true }
            )
        }

        if (showCreatePlaylistDialog) {
            AlertDialog(
                onDismissRequest = { showCreatePlaylistDialog = false },
                title = { Text("New Playlist", color = Color.White) },
                text = {
                    TextField(
                        value = newPlaylistNameDialog,
                        onValueChange = { newPlaylistNameDialog = it },
                        placeholder = { Text("Playlist Name") },
                        singleLine = true
                    )
                },
                confirmButton = {
                    Button(onClick = {
                        if (newPlaylistNameDialog.isNotBlank()) {
                            viewModel.createPlaylist(newPlaylistNameDialog)
                            newPlaylistNameDialog = ""
                            showCreatePlaylistDialog = false
                        }
                    }) { Text("Create") }
                },
                dismissButton = {
                    TextButton(onClick = { showCreatePlaylistDialog = false }) { Text("Cancel", color = Secondary) }
                }
            )
        }
    }
}

@Composable
fun EmptyState(message: String, icon: androidx.compose.ui.graphics.vector.ImageVector) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(Dimens.PaddingTripleExtraLarge),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier
                .size(120.dp)
                .clip(CircleShape)
                .background(Color.White.copy(alpha = 0.03f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(56.dp),
                tint = Color.White.copy(alpha = 0.1f)
            )
        }
        Spacer(modifier = Modifier.height(Dimens.PaddingDoubleExtraLarge))
        Text(
            text = message,
            style = MaterialTheme.typography.titleMedium,
            color = Secondary,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
        )
    }
}
