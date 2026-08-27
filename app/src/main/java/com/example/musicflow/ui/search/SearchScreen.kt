package com.example.musicflow.ui.search

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
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.musicflow.data.model.Album
import com.example.musicflow.data.model.Artist
import com.example.musicflow.data.model.Playlist
import com.example.musicflow.data.model.Song
import com.example.musicflow.ui.components.*
import com.example.musicflow.ui.home.RecommendedPlaylistCard
import com.example.musicflow.ui.theme.*

@Composable
fun SearchScreen(
    viewModel: SearchViewModel,
    onSongClick: (Song) -> Unit,
    onAlbumClick: (String) -> Unit,
    onArtistClick: (String) -> Unit,
    bottomPadding: androidx.compose.ui.unit.Dp
) {
    val searchQuery by viewModel.query.collectAsState()
    val selectedCategory by viewModel.selectedCategory.collectAsState()
    val searchResults by viewModel.searchResults.collectAsState()
    val albumResults by viewModel.albumResults.collectAsState()
    val artistResults by viewModel.artistResults.collectAsState()
    val playlistResults by viewModel.playlistResults.collectAsState()
    val didYouMean by viewModel.didYouMean.collectAsState()
    val autocompleteSuggestions by viewModel.autocompleteSuggestions.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val recentSearches by viewModel.recentSearches.collectAsState()
    val history by viewModel.history.collectAsState()
    val playlists by viewModel.playlists.collectAsState()

    val focusManager = LocalFocusManager.current

    var selectedSongForMenu by remember { mutableStateOf<Song?>(null) }
    var selectedSongForPlaylist by remember { mutableStateOf<Song?>(null) }
    var showCreatePlaylistDialog by remember { mutableStateOf(false) }
    var newPlaylistName by remember { mutableStateOf("") }

    val displayRecent = remember(history) { history.distinctBy { it.id }.take(6) }
    val uniqueArtists = remember(artistResults) { artistResults.distinctBy { it.id } }
    val uniqueSongs = remember(searchResults) { searchResults.distinctBy { it.id } }
    val uniqueAlbums = remember(albumResults) { albumResults.distinctBy { it.id } }
    val uniquePlaylists = remember(playlistResults) { playlistResults.distinctBy { it.id } }

    val categories = listOf("All", "Songs", "Artists", "Albums", "Playlists")

    val popularQueries = remember {
        listOf("Kanye West", "NBSPLV", "Travis Scott", "What Was I Made For?", "The Weeknd", "LALA", "Katy Perry", "Arijit Singh")
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .statusBarsPadding()
    ) {
        // 1. Search Bar (Exact Replica from Image 5)
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp)
                .height(52.dp),
            shape = CircleShape,
            color = SurfaceDark,
            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f))
        ) {
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = MFIcons.Search,
                    contentDescription = "Search",
                    tint = Secondary,
                    modifier = Modifier.size(18.dp)
                )

                Spacer(modifier = Modifier.width(12.dp))

                Box(modifier = Modifier.weight(1f)) {
                    if (searchQuery.isEmpty()) {
                        Text(
                            text = "Find music or podcasts",
                            style = MaterialTheme.typography.bodyLarge.copy(
                                fontSize = 15.sp,
                                color = Secondary
                            )
                        )
                    }
                    BasicTextField(
                        value = searchQuery,
                        onValueChange = { viewModel.updateQuery(it) },
                        modifier = Modifier.fillMaxWidth(),
                        textStyle = MaterialTheme.typography.bodyLarge.copy(
                            color = Color.White,
                            fontSize = 15.sp
                        ),
                        singleLine = true,
                        cursorBrush = SolidColor(MusicRed),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                        keyboardActions = KeyboardActions(
                            onSearch = {
                                focusManager.clearFocus()
                                viewModel.search(searchQuery)
                            }
                        )
                    )
                }

                if (searchQuery.isNotEmpty()) {
                    IconButton(
                        onClick = { viewModel.updateQuery("") },
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Clear",
                            tint = Color.White,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }
        }

        // 2. Category Filter Pills Row (When searching)
        if (searchQuery.isNotEmpty()) {
            LazyRow(
                contentPadding = PaddingValues(horizontal = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(bottom = 6.dp)
            ) {
                items(categories) { category ->
                    val isSelected = selectedCategory == category
                    Surface(
                        modifier = Modifier
                            .clip(CircleShape)
                            .clickable { viewModel.selectCategory(category) },
                        shape = CircleShape,
                        color = if (isSelected) MusicRed else SurfaceDark,
                        border = if (isSelected) null else BorderStroke(1.dp, Color.White.copy(alpha = 0.08f))
                    ) {
                        Text(
                            text = category,
                            style = MaterialTheme.typography.labelMedium.copy(
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                fontSize = 13.sp
                            ),
                            color = Color.White,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                        )
                    }
                }
            }

            // Did You Mean Banner
            if (!didYouMean.isNullOrBlank()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 6.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(MusicRed.copy(alpha = 0.12f))
                        .clickable {
                            viewModel.updateQuery(didYouMean!!)
                            viewModel.search(didYouMean!!)
                        }
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.AutoAwesome,
                        contentDescription = "Correction",
                        tint = MusicRed,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Did you mean: ",
                        style = MaterialTheme.typography.bodySmall.copy(color = Secondary)
                    )
                    Text(
                        text = didYouMean!!,
                        style = MaterialTheme.typography.bodySmall.copy(
                            fontWeight = FontWeight.Bold,
                            color = MusicRed
                        )
                    )
                }
            }

            // Autocomplete suggestions chips (if typing and suggestions available)
            if (autocompleteSuggestions.isNotEmpty() && autocompleteSuggestions.any { it.lowercase() != searchQuery.lowercase() }) {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.padding(bottom = 6.dp)
                ) {
                    items(autocompleteSuggestions) { sug ->
                        Surface(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .clickable {
                                    viewModel.updateQuery(sug)
                                    viewModel.search(sug)
                                },
                            shape = RoundedCornerShape(8.dp),
                            color = SurfaceDark.copy(alpha = 0.6f),
                            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f))
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.TrendingUp,
                                    contentDescription = null,
                                    tint = Secondary,
                                    modifier = Modifier.size(12.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = sug,
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontSize = 11.sp,
                                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f)
                                    )
                                )
                            }
                        }
                    }
                }
            }
        }

        // 3. Main Content
        if (searchQuery.isEmpty()) {
            // Idle State: Exact Replica of Image 5 (Search Screen)
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = bottomPadding + 32.dp)
            ) {
                if (displayRecent.isNotEmpty()) {
                    // Section 1: "Recently played"
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 20.dp, vertical = 12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Recently played",
                                style = MaterialTheme.typography.titleLarge.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 20.sp
                                ),
                                color = MaterialTheme.colorScheme.onBackground
                            )
                        }
                    }

                    itemsIndexed(displayRecent, key = { index, song -> "recent_${song.id}_$index" }) { _, song ->
                        SearchSongRow(
                            song = song,
                            onClick = { onSongClick(song) },
                            onMoreClick = { selectedSongForMenu = song }
                        )
                    }
                }

                // Section 2: "Popular queries" (Dark Card Container from Image 5)
                item {
                    Spacer(modifier = Modifier.height(16.dp))
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp),
                        shape = RoundedCornerShape(24.dp),
                        color = MaterialTheme.colorScheme.surface,
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f))
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(20.dp)
                        ) {
                            Text(
                                text = "Popular queries",
                                style = MaterialTheme.typography.titleLarge.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 19.sp
                                ),
                                color = MaterialTheme.colorScheme.onSurface
                            )

                            Spacer(modifier = Modifier.height(14.dp))

                            popularQueries.forEach { query ->
                                Text(
                                    text = query,
                                    style = MaterialTheme.typography.bodyLarge.copy(
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.Normal
                                    ),
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.85f),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            viewModel.updateQuery(query)
                                            viewModel.search(query)
                                        }
                                        .padding(vertical = 8.dp)
                                )
                            }
                        }
                    }
                }
            }
        } else {
            // Active Search Results
            if (isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = MusicRed, strokeWidth = 2.dp, modifier = Modifier.size(36.dp))
                }
            } else if (error != null && searchResults.isEmpty() && artistResults.isEmpty() && albumResults.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
                    Text(
                        text = error!!,
                        color = Secondary,
                        textAlign = TextAlign.Center,
                        style = MaterialTheme.typography.bodyLarge
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(bottom = bottomPadding + 32.dp)
                ) {
                    // Filter: Artists
                    if ((selectedCategory == "All" || selectedCategory == "Artists") && artistResults.isNotEmpty()) {
                        item {
                            Text(
                                text = "Artists",
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                color = MaterialTheme.colorScheme.onBackground,
                                modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp)
                            )
                        }

                        item {
                            LazyRow(
                                contentPadding = PaddingValues(horizontal = 20.dp),
                                horizontalArrangement = Arrangement.spacedBy(14.dp),
                                modifier = Modifier.padding(bottom = 12.dp)
                            ) {
                                itemsIndexed(uniqueArtists, key = { index, artist -> "art_${artist.id}_$index" }) { _, artist ->
                                    SearchArtistCard(
                                        artist = artist,
                                        onClick = { onArtistClick(artist.id) }
                                    )
                                }
                            }
                        }
                    }

                    // Filter: Songs
                    if (selectedCategory == "All" || selectedCategory == "Songs") {
                        if (searchResults.isNotEmpty()) {
                            item {
                                Text(
                                    text = "Songs",
                                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                    color = MaterialTheme.colorScheme.onBackground,
                                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp)
                                )
                            }

                            itemsIndexed(uniqueSongs, key = { index, song -> "song_${song.id}_$index" }) { _, song ->
                                SearchSongRow(
                                    song = song,
                                    onClick = { onSongClick(song) },
                                    onMoreClick = { selectedSongForMenu = song }
                                )
                            }
                        }
                    }

                    // Filter: Albums
                    if ((selectedCategory == "All" || selectedCategory == "Albums") && albumResults.isNotEmpty()) {
                        item {
                            Text(
                                text = "Albums",
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                color = MaterialTheme.colorScheme.onBackground,
                                modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp)
                            )
                        }

                        item {
                            LazyRow(
                                contentPadding = PaddingValues(horizontal = 20.dp),
                                horizontalArrangement = Arrangement.spacedBy(14.dp),
                                modifier = Modifier.padding(bottom = 12.dp)
                            ) {
                                itemsIndexed(uniqueAlbums, key = { index, album -> "alb_${album.id}_$index" }) { _, album ->
                                    SearchAlbumCard(
                                        album = album,
                                        onClick = { onAlbumClick(album.id) }
                                    )
                                }
                            }
                        }
                    }

                    // Filter: Playlists
                    if ((selectedCategory == "All" || selectedCategory == "Playlists") && playlistResults.isNotEmpty()) {
                        item {
                            Text(
                                text = "Playlists",
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                color = MaterialTheme.colorScheme.onBackground,
                                modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp)
                            )
                        }

                        item {
                            LazyRow(
                                contentPadding = PaddingValues(horizontal = 20.dp),
                                horizontalArrangement = Arrangement.spacedBy(14.dp)
                            ) {
                                itemsIndexed(uniquePlaylists, key = { index, playlist -> "play_${playlist.id}_$index" }) { _, playlist ->
                                    RecommendedPlaylistCard(
                                        playlist = playlist,
                                        onClick = { /* play playlist */ }
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // Context Menu
        selectedSongForMenu?.let { song ->
            val isLiked = viewModel.playlists.collectAsState().value.any { it.name == song.name }
            SongContextMenu(
                song = song,
                isLiked = isLiked,
                onDismiss = { selectedSongForMenu = null },
                onPlayNext = { viewModel.playNext(song); selectedSongForMenu = null },
                onAddToQueue = { viewModel.addToQueue(song); selectedSongForMenu = null },
                onAddToPlaylist = { selectedSongForPlaylist = song; selectedSongForMenu = null },
                onStartRadio = { viewModel.startRadio(song); selectedSongForMenu = null },
                onGoToArtist = {
                    val artistQuery = song.artists.split(",", "&", "feat.", "ft.").firstOrNull()?.trim() ?: song.artists
                    onArtistClick(artistQuery)
                    selectedSongForMenu = null
                },
                onGoToAlbum = if (song.album.isNotBlank()) {
                    {
                        onAlbumClick(song.album)
                        selectedSongForMenu = null
                    }
                } else null,
                onLike = { viewModel.toggleFavorite(song); selectedSongForMenu = null },
                onShare = { selectedSongForMenu = null }
            )
        }

        // Playlist Selector Dialog
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

        // Create Playlist Dialog
        if (showCreatePlaylistDialog) {
            AlertDialog(
                onDismissRequest = { showCreatePlaylistDialog = false },
                title = { Text("New Playlist", color = Color.White) },
                text = {
                    TextField(
                        value = newPlaylistName,
                        onValueChange = { newPlaylistName = it },
                        placeholder = { Text("Playlist Name", color = Secondary) },
                        colors = TextFieldDefaults.colors(
                            focusedContainerColor = Color.Transparent,
                            unfocusedContainerColor = Color.Transparent,
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            cursorColor = MusicRed
                        )
                    )
                },
                confirmButton = {
                    TextButton(
                        onClick = {
                            if (newPlaylistName.isNotBlank()) {
                                viewModel.createPlaylist(newPlaylistName)
                                newPlaylistName = ""
                                showCreatePlaylistDialog = false
                            }
                        }
                    ) {
                        Text("Create", color = MusicRed)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showCreatePlaylistDialog = false }) {
                        Text("Cancel", color = Secondary)
                    }
                }
            )
        }
    }
}

// -------------------------------------------------------------
// SEARCH ROW & CARDS
// -------------------------------------------------------------
@Composable
fun SearchSongRow(
    song: Song,
    onClick: () -> Unit,
    onMoreClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        AsyncImage(
            model = song.image,
            contentDescription = song.name,
            modifier = Modifier
                .size(52.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(SurfaceDark),
            contentScale = ContentScale.Crop
        )

        Spacer(modifier = Modifier.width(16.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = song.name,
                style = MaterialTheme.typography.titleMedium.copy(
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 15.sp
                ),
                color = MaterialTheme.colorScheme.onBackground,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = "${song.artists} • ${song.album}",
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontSize = 13.sp
                ),
                color = Secondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }

        IconButton(onClick = onMoreClick) {
            Icon(
                imageVector = Icons.Default.MoreHoriz,
                contentDescription = "More",
                tint = Secondary,
                modifier = Modifier.size(24.dp)
            )
        }
    }
}

@Composable
fun SearchArtistCard(
    artist: Artist,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .width(84.dp)
            .clickable(onClick = onClick)
    ) {
        AsyncImage(
            model = artist.image,
            contentDescription = artist.name,
            modifier = Modifier
                .size(72.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.surface),
            contentScale = ContentScale.Crop
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = artist.name,
            style = MaterialTheme.typography.bodySmall.copy(
                fontWeight = FontWeight.Medium,
                fontSize = 12.sp
            ),
            color = MaterialTheme.colorScheme.onBackground,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center
        )
    }
}

@Composable
fun SearchAlbumCard(
    album: Album,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .width(140.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f))
    ) {
        Column {
            AsyncImage(
                model = album.image,
                contentDescription = album.name,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(130.dp)
                    .clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp)),
                contentScale = ContentScale.Crop
            )
            Column(modifier = Modifier.padding(10.dp)) {
                Text(
                    text = album.name,
                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = album.artist,
                    style = MaterialTheme.typography.bodySmall,
                    color = Secondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}
