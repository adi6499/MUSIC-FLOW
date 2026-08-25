package com.example.musicflow.ui.album

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.musicflow.data.model.Song
import com.example.musicflow.ui.components.*
import com.example.musicflow.ui.theme.*

@Composable
fun AlbumScreen(
    albumId: String,
    viewModel: AlbumViewModel,
    onBack: () -> Unit,
    onSongClick: (Song) -> Unit,
    bottomPadding: androidx.compose.ui.unit.Dp
) {
    val album by viewModel.album.collectAsState()
    val playlists by viewModel.playlists.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()

    var selectedSongForMenu by remember { mutableStateOf<Song?>(null) }
    var selectedSongForPlaylist by remember { mutableStateOf<Song?>(null) }
    var showCreatePlaylistDialog by remember { mutableStateOf(false) }
    var newPlaylistName by remember { mutableStateOf("") }

    LaunchedEffect(albumId) {
        viewModel.loadAlbum(albumId)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = com.example.musicflow.ui.theme.MusicAccent)
            }
        } else if (error != null) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(text = error!!, color = Color.White, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            }
        } else {
            album?.let { albumData ->
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(bottom = bottomPadding + Dimens.PaddingLarge)
                ) {
                    item {
                        AlbumHeroHeader(
                            album = albumData, 
                            onBack = onBack, 
                            onPlayAll = { viewModel.playAlbum() },
                            onShuffle = { viewModel.playAlbum(shuffle = true) }
                        )
                    }
                    
                    itemsIndexed(albumData.songs, key = { index, song -> "${song.id}_$index" }) { index, song ->
                        MFListRow(
                            title = song.name,
                            subtitle = song.artists,
                            imageUrl = null, 
                            leadingContent = {
                                Text(
                                    text = (index + 1).toString().padStart(2, '0'),
                                    style = MaterialTheme.typography.labelMedium,
                                    color = Secondary,
                                    modifier = Modifier.width(24.dp)
                                )
                            },
                            onTrailingClick = { selectedSongForMenu = song },
                            onClick = { onSongClick(song) }
                        )
                    }
                    
                    item { Spacer(modifier = Modifier.height(Dimens.PaddingTripleExtraLarge)) }
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
fun AlbumHeroHeader(
    album: com.example.musicflow.data.model.Album,
    onBack: () -> Unit,
    onPlayAll: () -> Unit,
    onShuffle: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(340.dp)
    ) {
        AsyncImage(
            model = album.image,
            contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color.Transparent, MaterialTheme.colorScheme.background),
                        startY = 0.5f
                    )
                )
        )
        
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(Dimens.ScreenPadding),
            verticalArrangement = Arrangement.Bottom
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                IconButton(
                    onClick = onBack,
                    modifier = Modifier.background(Color.Black.copy(alpha = 0.2f), CircleShape)
                ) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Color.White)
                }
            }
            
            Spacer(modifier = Modifier.weight(1f))
            
            Text(
                text = album.name,
                style = MaterialTheme.typography.displayLarge,
                color = Color.White,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = "${album.artist} • ${album.year}",
                style = MaterialTheme.typography.bodyLarge,
                color = Secondary
            )
            
            Spacer(modifier = Modifier.height(Dimens.PaddingLarge))
            
            Row(verticalAlignment = Alignment.CenterVertically) {
                Button(
                    onClick = onPlayAll,
                    modifier = Modifier
                        .height(48.dp)
                        .weight(1f),
                    shape = CircleShape,
                    colors = ButtonDefaults.buttonColors(containerColor = MusicAccent)
                ) {
                    Icon(Icons.Default.PlayArrow, contentDescription = null, tint = Color.White)
                    Spacer(modifier = Modifier.width(Dimens.PaddingSmall))
                    Text("Play", fontWeight = FontWeight.Bold)
                }
                Spacer(modifier = Modifier.width(Dimens.PaddingLarge))
                OutlinedButton(
                    onClick = onShuffle,
                    modifier = Modifier
                        .height(48.dp)
                        .weight(1f),
                    shape = CircleShape,
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.2f)),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)
                ) {
                    Icon(Icons.Default.Shuffle, contentDescription = "Shuffle", modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(Dimens.PaddingSmall))
                    Text("Shuffle")
                }
            }
        }
    }
}
