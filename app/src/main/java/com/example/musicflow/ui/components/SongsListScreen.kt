package com.example.musicflow.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.example.musicflow.data.model.Song
import com.example.musicflow.ui.theme.BackgroundDark
import com.example.musicflow.ui.theme.Dimens
import com.example.musicflow.ui.theme.Secondary

@Composable
fun SongsListScreen(
    title: String,
    songs: List<Song>,
    playlists: List<com.example.musicflow.data.local.PlaylistEntity>,
    onBack: () -> Unit,
    onSongClick: (Song) -> Unit,
    onPlayNext: (Song) -> Unit,
    onAddToQueue: (Song) -> Unit,
    onAddToPlaylist: (String, Song) -> Unit,
    onStartRadio: (Song) -> Unit,
    onToggleLike: (Song) -> Unit,
    onCreatePlaylist: (String) -> Unit,
    bottomPadding: androidx.compose.ui.unit.Dp
) {
    var selectedSongForMenu by remember { mutableStateOf<Song?>(null) }
    var selectedSongForPlaylist by remember { mutableStateOf<Song?>(null) }
    var showCreatePlaylistDialog by remember { mutableStateOf(false) }
    var newPlaylistName by remember { mutableStateOf("") }

    Box(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        Column(modifier = Modifier.fillMaxSize().statusBarsPadding()) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = Dimens.PaddingSmall),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = MaterialTheme.colorScheme.onBackground)
                }
                Text(
                    text = title,
                    style = MaterialTheme.typography.headlineMedium,
                    color = MaterialTheme.colorScheme.onBackground
                )
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = bottomPadding + Dimens.PaddingLarge)
            ) {
                items(songs.distinctBy { it.id }, key = { "song_${it.id}" }) { song ->
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

        selectedSongForMenu?.let { song ->
            val context = androidx.compose.ui.platform.LocalContext.current
            SongContextMenu(
                song = song,
                onDismiss = { selectedSongForMenu = null },
                onPlayNext = { onPlayNext(song); selectedSongForMenu = null },
                onAddToQueue = { onAddToQueue(song); selectedSongForMenu = null },
                onAddToPlaylist = { selectedSongForPlaylist = song; selectedSongForMenu = null },
                onStartRadio = { onStartRadio(song); selectedSongForMenu = null },
                onLike = { onToggleLike(song); selectedSongForMenu = null },
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
                    onAddToPlaylist(playlistId, song)
                    selectedSongForPlaylist = null
                },
                onCreateNew = { showCreatePlaylistDialog = true }
            )
        }

        if (showCreatePlaylistDialog) {
            AlertDialog(
                onDismissRequest = { showCreatePlaylistDialog = false },
                containerColor = MaterialTheme.colorScheme.surface,
                title = { Text("New Playlist", color = MaterialTheme.colorScheme.onSurface) },
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
                            onCreatePlaylist(newPlaylistName)
                            newPlaylistName = ""
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
