package com.example.musicflow.ui.artist

import androidx.compose.animation.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.musicflow.data.model.Song
import com.example.musicflow.ui.components.*
import com.example.musicflow.ui.home.ArtistAvatarRow
import com.example.musicflow.ui.theme.*

@Composable
fun ArtistScreen(
    artistId: String,
    viewModel: ArtistViewModel,
    onBack: () -> Unit,
    onSongClick: (Song) -> Unit,
    onAlbumClick: (String) -> Unit,
    bottomPadding: androidx.compose.ui.unit.Dp
) {
    val artist by viewModel.artist.collectAsState()
    val topSongs by viewModel.topSongs.collectAsState()
    val albums by viewModel.albums.collectAsState()
    val playlists by viewModel.playlists.collectAsState()
    val isFollowed by viewModel.isFollowed.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    var selectedSongForMenu by remember { mutableStateOf<Song?>(null) }
    var selectedSongForPlaylist by remember { mutableStateOf<Song?>(null) }
    var showCreatePlaylistDialog by remember { mutableStateOf(false) }
    var newPlaylistName by remember { mutableStateOf("") }

    LaunchedEffect(artistId) {
        viewModel.loadArtist(artistId)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
    ) {
        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = com.example.musicflow.ui.theme.MusicAccent)
            }
        } else {
            artist?.let { artistData ->
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(bottom = bottomPadding + Dimens.PaddingLarge)
                ) {
                    item {
                        ArtistHeroHeader(artistData, onBack)
                    }

                    item {
                        ArtistActionsSection(
                            artist = artistData, 
                            isFollowed = isFollowed,
                            onPlayClick = { viewModel.playArtistTopSongs() },
                            onFollowClick = { viewModel.toggleFollow() }
                        )
                    }

                    item {
                        GenrePillsRow(listOf("Pop", "Hip Hop", "R&B", "+04 Others"))
                    }

                    if (topSongs.isNotEmpty()) {
                        item { SectionHeader(title = "Top tracks") }
                        itemsIndexed(topSongs.take(10), key = { index, song -> "${song.id}_$index" }) { index, song ->
                            MFListRow(
                                title = song.name,
                                subtitle = song.artists,
                                imageUrl = song.image,
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
                    }

                    if (albums.isNotEmpty()) {
                        item { SectionHeader(title = "Albums and EPs") }
                        val chunked = albums.chunked(2)
                        items(chunked) { rowAlbums ->
                            Row(
                                modifier = Modifier.padding(horizontal = Dimens.ScreenPadding, vertical = Dimens.PaddingSmall),
                                horizontalArrangement = Arrangement.spacedBy(Dimens.PaddingLarge)
                            ) {
                                rowAlbums.forEach { album ->
                                    MFCard(
                                        title = album.name,
                                        subtitle = "${album.year} • Album",
                                        imageUrl = album.image,
                                        modifier = Modifier.weight(1f),
                                        onClick = { onAlbumClick(album.id) }
                                    )
                                }
                                if (rowAlbums.size == 1) Spacer(modifier = Modifier.weight(1f))
                            }
                        }
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
fun ArtistHeroHeader(artist: com.example.musicflow.data.model.Artist, onBack: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(300.dp)
    ) {
        AsyncImage(
            model = artist.image,
            contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color.Transparent, BackgroundDark),
                        startY = 0.6f
                    )
                )
        )
        
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = Dimens.PaddingSmall, vertical = Dimens.PaddingSmall),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Color.White)
            }
            IconButton(onClick = { /* More */ }) {
                Icon(Icons.Default.MoreVert, contentDescription = "More", tint = Color.White)
            }
        }
    }
}

@Composable
fun ArtistActionsSection(
    artist: com.example.musicflow.data.model.Artist,
    isFollowed: Boolean,
    onPlayClick: () -> Unit,
    onFollowClick: () -> Unit
) {
    Column(modifier = Modifier.padding(horizontal = Dimens.ScreenPadding)) {
        Text(
            text = artist.name, 
            style = MaterialTheme.typography.displayLarge, 
            color = Color.White,
            modifier = Modifier.padding(vertical = Dimens.PaddingSmall)
        )
        Text(
            text = "Artist • MusicFlow", 
            style = MaterialTheme.typography.bodyMedium, 
            color = Secondary
        )
        
        Spacer(modifier = Modifier.height(Dimens.PaddingLarge))
        
        Row(verticalAlignment = Alignment.CenterVertically) {
            Button(
                onClick = onPlayClick,
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
                onClick = onFollowClick,
                modifier = Modifier
                    .height(48.dp)
                    .weight(1f),
                shape = CircleShape,
                border = BorderStroke(1.dp, if (isFollowed) MusicAccent.copy(alpha = 0.5f) else Color.White.copy(alpha = 0.2f)),
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = if (isFollowed) MusicAccent else Color.White
                )
            ) {
                Text(if (isFollowed) "Following" else "Follow")
            }
        }
    }
}

@Composable
fun GenrePillsRow(genres: List<String>) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = Dimens.ScreenPadding, vertical = 24.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(genres) { genre ->
            Surface(
                color = SurfaceVariantDark,
                shape = CircleShape,
                border = androidx.compose.foundation.BorderStroke(0.5.dp, Color.White.copy(alpha = 0.1f))
            ) {
                Text(
                    text = genre,
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                )
            }
        }
    }
}

@Composable
fun SectionHeader(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.headlineMedium,
        color = Color.White,
        modifier = Modifier.padding(horizontal = Dimens.ScreenPadding, vertical = Dimens.PaddingLarge)
    )
}
