package com.example.musicflow.ui.search

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.musicflow.data.model.Song
import com.example.musicflow.ui.components.*
import com.example.musicflow.ui.theme.Dimens
import com.example.musicflow.ui.theme.Secondary

@Composable
fun SearchScreen(
    viewModel: SearchViewModel,
    onSongClick: (Song) -> Unit,
    onAlbumClick: (String) -> Unit,
    onArtistClick: (String) -> Unit,
    bottomPadding: androidx.compose.ui.unit.Dp
) {
    val searchQuery by viewModel.query.collectAsState()
    val searchResults by viewModel.searchResults.collectAsState()
    val albumResults by viewModel.albumResults.collectAsState()
    val artistResults by viewModel.artistResults.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val recentSearches by viewModel.recentSearches.collectAsState()
    val playlists by viewModel.playlists.collectAsState()
    val trendingKeywords by viewModel.trendingKeywords.collectAsState()

    var selectedSongForMenu by remember { mutableStateOf<Song?>(null) }
    var selectedSongForPlaylist by remember { mutableStateOf<Song?>(null) }
    var showCreatePlaylistDialog by remember { mutableStateOf(false) }
    var newPlaylistName by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .statusBarsPadding()
    ) {
        // Page Title
        Text(
            text = "Search",
            style = MaterialTheme.typography.displayLarge,
            modifier = Modifier.padding(horizontal = Dimens.ScreenPadding, vertical = Dimens.PaddingLarge)
        )

        // Search Bar
        MFSearchBar(
            query = searchQuery,
            onQueryChange = { viewModel.updateQuery(it) },
            modifier = Modifier.padding(horizontal = Dimens.ScreenPadding, vertical = Dimens.PaddingSmall)
        )

        if (searchQuery.isEmpty()) {
            if (recentSearches.isEmpty()) {
                // Empty state
                Box(modifier = Modifier.fillMaxSize().padding(Dimens.PaddingTripleExtraLarge), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.Default.Search, 
                            contentDescription = null, 
                            tint = Color.White.copy(alpha = 0.05f),
                            modifier = Modifier.size(80.dp)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "Over time, the history of your requests\nwill appear here",
                            style = MaterialTheme.typography.bodyLarge,
                            color = Secondary,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                }
            } else {
                // Idle state
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(bottom = bottomPadding + Dimens.PaddingLarge)
                ) {
                    item {
                        SearchSectionHeader("Recently played", onSeeAll = { viewModel.clearRecentSearches() })
                    }
                    
                    items(recentSearches.take(5)) { query ->
                        MFListRow(
                            title = query,
                            subtitle = "History",
                            imageUrl = null,
                            trailingIcon = Icons.Default.History,
                            onClick = { viewModel.updateQuery(query); viewModel.search(query) }
                        )
                    }

                    item {
                        Spacer(modifier = Modifier.height(Dimens.SectionSpacing))
                        SearchSectionHeader("Popular queries")
                    }

                    items(trendingKeywords) { keyword ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(56.dp)
                                .clickable { viewModel.updateQuery(keyword); viewModel.search(keyword) }
                                .padding(horizontal = Dimens.ScreenPadding),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.TrendingUp, contentDescription = null, tint = Secondary, modifier = Modifier.size(20.dp))
                            Spacer(modifier = Modifier.width(16.dp))
                            Text(text = keyword, style = MaterialTheme.typography.titleMedium, color = Color.White)
                        }
                    }
                }
            }
        } else {
            // Typing / Results state
            if (isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = com.example.musicflow.ui.theme.MusicAccent)
                }
            } else if (error != null) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(text = error!!, color = Color.White, textAlign = androidx.compose.ui.text.style.TextAlign.Center, modifier = Modifier.padding(Dimens.ScreenPadding))
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(bottom = bottomPadding + Dimens.PaddingLarge)
                ) {
                    // Mixed Results
                    items(artistResults, key = { "artist_${it.id}" }) { artist ->
                        MFListRow(
                            title = artist.name,
                            subtitle = "Artist",
                            imageUrl = artist.image,
                            onClick = { onArtistClick(artist.id) }
                        )
                    }

                    items(searchResults, key = { "song_${it.id}" }) { song ->
                        MFListRow(
                            title = song.name,
                            subtitle = "${song.artists} • ${song.album}",
                            imageUrl = song.image,
                            onTrailingClick = { selectedSongForMenu = song },
                            onClick = { onSongClick(song) }
                        )
                    }

                    items(albumResults, key = { "album_${it.id}" }) { album ->
                        MFListRow(
                            title = album.name,
                            subtitle = "Album • ${album.artist}",
                            imageUrl = album.image,
                            onClick = { onAlbumClick(album.id) }
                        )
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
                onCreateNew = {
                    showCreatePlaylistDialog = true
                }
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
fun SearchSectionHeader(title: String, onSeeAll: (() -> Unit)? = null) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = Dimens.ScreenPadding, vertical = Dimens.PaddingLarge),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.headlineMedium,
            color = Color.White
        )
        if (onSeeAll != null) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = null,
                tint = Secondary,
                modifier = Modifier.clickable(onClick = onSeeAll)
            )
        }
    }
}
