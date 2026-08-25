package com.example.musicflow.ui.explore

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.example.musicflow.data.model.Song
import com.example.musicflow.ui.components.*
import com.example.musicflow.ui.home.HomeViewModel
import com.example.musicflow.ui.theme.*

@Composable
fun ExploreScreen(
    viewModel: HomeViewModel,
    onSongClick: (Song) -> Unit,
    onNavigate: (String) -> Unit = {},
    bottomPadding: androidx.compose.ui.unit.Dp
) {
    val trendingSongs by viewModel.trendingSongs.collectAsState()
    val playlists by viewModel.playlists.collectAsState()
    
    var selectedSongForMenu by remember { mutableStateOf<Song?>(null) }
    var selectedSongForPlaylist by remember { mutableStateOf<Song?>(null) }
    var showCreatePlaylistDialog by remember { mutableStateOf(false) }
    var newPlaylistNameDialog by remember { mutableStateOf("") }

    Box(modifier = Modifier.fillMaxSize().background(BackgroundDark)) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
        ) {
            Text(
                text = "Explore",
                style = MaterialTheme.typography.displayLarge,
                color = Color.White,
                modifier = Modifier.padding(horizontal = Dimens.ScreenPadding, vertical = Dimens.PaddingLarge)
            )

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = bottomPadding + Dimens.PaddingLarge)
            ) {
                item { SectionHeader(title = "Trending Now") }
                items(trendingSongs) { song ->
                    MFListRow(
                        title = song.name,
                        subtitle = song.artists,
                        imageUrl = song.image,
                        onTrailingClick = { selectedSongForMenu = song },
                        onClick = { onSongClick(song) }
                    )
                }
                
                item { SectionHeader(title = "Explore Genres") }
                val genrePairs = listOf(
                    "Pop" to GenrePurple, "Hip Hop" to GenreBlue, "R&B" to GenrePink,
                    "Rock" to GenreMint, "Electronic" to GenreYellow, "Jazz" to GenreTeal
                ).chunked(2)
                
                items(genrePairs) { pair ->
                    Row(
                        modifier = Modifier.padding(horizontal = Dimens.ScreenPadding, vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(Dimens.PaddingLarge)
                    ) {
                        pair.forEach { (name, color) ->
                            ExploreGenreCard(name, color, modifier = Modifier.weight(1f), onClick = { onNavigate("songs_list/$name") })
                        }
                    }
                }
                
                item { Spacer(modifier = Modifier.height(Dimens.PaddingTripleExtraLarge)) }
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
