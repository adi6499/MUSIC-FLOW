package com.example.musicflow.ui.library

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.example.musicflow.data.model.Song
import com.example.musicflow.ui.components.*
import com.example.musicflow.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlaylistDetailScreen(
    playlistId: String,
    viewModel: LibraryViewModel,
    onSongClick: (Song) -> Unit,
    onBack: () -> Unit,
    bottomPadding: androidx.compose.ui.unit.Dp
) {
    val isLikedSongs = playlistId == "liked"
    val songs by (if (isLikedSongs) viewModel.favorites else viewModel.getPlaylistSongs(playlistId)).collectAsState(initial = emptyList())
    val playlists by viewModel.playlists.collectAsState()
    val playlist = if (isLikedSongs) {
        com.example.musicflow.data.local.PlaylistEntity("liked", "Liked Songs", "", "")
    } else {
        playlists.find { it.id == playlistId }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        var showMenu by remember { mutableStateOf(false) }
        var showRenameDialog by remember { mutableStateOf(false) }
        var newName by remember { mutableStateOf(playlist?.name ?: "") }
        var selectedSongForMenu by remember { mutableStateOf<Song?>(null) }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = bottomPadding + Dimens.PaddingLarge)
        ) {
            item {
                PlaylistHeader(
                    title = if (isLikedSongs) "Liked Songs" else (playlist?.name ?: "Playlist"),
                    subtitle = "${songs.size} songs",
                    onBack = onBack,
                    onMenuClick = if (isLikedSongs) null else { { showMenu = true } }
                )
            }
            
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(Dimens.PaddingExtraLarge),
                    horizontalArrangement = Arrangement.spacedBy(Dimens.PaddingLarge),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Button(
                        onClick = { viewModel.playPlaylist(songs) },
                        modifier = Modifier.weight(1f),
                        shape = CircleShape,
                        colors = ButtonDefaults.buttonColors(containerColor = MusicAccent)
                    ) {
                        Icon(Icons.Default.PlayArrow, contentDescription = null, tint = Color.White)
                        Spacer(modifier = Modifier.width(Dimens.PaddingSmall))
                        Text("Play", fontWeight = FontWeight.Bold)
                    }
                    OutlinedButton(
                        onClick = { viewModel.playPlaylist(songs.shuffled()) },
                        modifier = Modifier.weight(1f),
                        shape = CircleShape,
                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.2f)),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)
                    ) {
                        Icon(Icons.Default.Shuffle, contentDescription = null, modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(Dimens.PaddingSmall))
                        Text("Shuffle")
                    }
                }
            }

            items(
                items = songs,
                key = { it.id }
            ) { song ->
                MFListRow(
                    title = song.name,
                    subtitle = song.artists,
                    imageUrl = song.image,
                    onTrailingClick = { selectedSongForMenu = song },
                    onClick = { onSongClick(song) }
                )
            }
        }

        selectedSongForMenu?.let { song ->
            val context = androidx.compose.ui.platform.LocalContext.current
            SongContextMenu(
                song = song,
                onDismiss = { selectedSongForMenu = null },
                onPlayNext = { viewModel.playNext(song); selectedSongForMenu = null },
                onAddToQueue = { viewModel.addToQueue(song); selectedSongForMenu = null },
                onAddToPlaylist = { /* already in a playlist, but handled in SongContextMenu if we want */ selectedSongForMenu = null },
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
                },
                onRemoveFromPlaylist = {
                    viewModel.removeSongFromPlaylist(playlistId, song.id)
                    selectedSongForMenu = null
                }
            )
        }

        if (showMenu) {
            ModalBottomSheet(
                onDismissRequest = { showMenu = false },
                containerColor = SurfaceDark
            ) {
                Column(modifier = Modifier.fillMaxWidth().padding(bottom = 32.dp)) {
                    ListItem(
                        headlineContent = { Text("Rename Playlist") },
                        leadingContent = { Icon(Icons.Default.Edit, contentDescription = null) },
                        modifier = Modifier.clickable { 
                            showMenu = false
                            showRenameDialog = true 
                        }
                    )
                    ListItem(
                        headlineContent = { Text("Delete Playlist", color = Color.Red) },
                        leadingContent = { Icon(Icons.Default.Delete, contentDescription = null, tint = Color.Red) },
                        modifier = Modifier.clickable { 
                            viewModel.deletePlaylist(playlistId)
                            showMenu = false
                            onBack()
                        }
                    )
                }
            }
        }

        if (showRenameDialog) {
            AlertDialog(
                onDismissRequest = { showRenameDialog = false },
                title = { Text("Rename Playlist") },
                text = {
                    TextField(
                        value = newName,
                        onValueChange = { newName = it },
                        singleLine = true
                    )
                },
                confirmButton = {
                    Button(onClick = {
                        if (newName.isNotBlank()) {
                            viewModel.renamePlaylist(playlistId, newName)
                            showRenameDialog = false
                        }
                    }) { Text("Rename") }
                },
                dismissButton = {
                    TextButton(onClick = { showRenameDialog = false }) { Text("Cancel") }
                }
            )
        }
    }
}

@Composable
fun PlaylistHeader(
    title: String,
    subtitle: String,
    onBack: () -> Unit,
    onMenuClick: (() -> Unit)? = null
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(340.dp)
    ) {
        // Gradient background
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                brush = Brush.verticalGradient(
                    colors = listOf(
                        Color.DarkGray.copy(alpha = 0.5f),
                        BackgroundDark
                    ),
                    startY = 0.3f
                )
            )
        )
        
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .padding(Dimens.ScreenPadding),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                IconButton(
                    onClick = onBack,
                    modifier = Modifier.background(Color.Black.copy(alpha = 0.2f), CircleShape)
                ) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Color.White)
                }
                if (onMenuClick != null) {
                    IconButton(
                        onClick = onMenuClick,
                        modifier = Modifier.background(Color.Black.copy(alpha = 0.2f), CircleShape)
                    ) {
                        Icon(Icons.Default.MoreVert, contentDescription = "Menu", tint = Color.White)
                    }
                } else {
                    Spacer(modifier = Modifier.size(48.dp))
                }
            }
            
            Spacer(modifier = Modifier.height(Dimens.PaddingLarge))
            
            Surface(
                modifier = Modifier
                    .size(160.dp)
                    .clip(RoundedCornerShape(Dimens.RadiusExtraLarge)),
                color = SurfaceVariantDark
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.MusicNote, contentDescription = null, modifier = Modifier.size(64.dp), tint = MusicAccent)
                }
            }
            
            Spacer(modifier = Modifier.height(Dimens.PaddingLarge))
            
            Text(
                text = title,
                style = MaterialTheme.typography.displayMedium,
                color = Color.White,
                textAlign = TextAlign.Center,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodyMedium,
                color = Secondary
            )
        }
    }
}
