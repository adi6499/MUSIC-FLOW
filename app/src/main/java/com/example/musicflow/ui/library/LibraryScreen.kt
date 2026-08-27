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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.example.musicflow.data.model.Song
import com.example.musicflow.data.model.Album
import com.example.musicflow.data.model.Artist
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
    val allSongs by viewModel.allSongs.collectAsState()
    val history by viewModel.history.collectAsState()
    val downloads by viewModel.downloads.collectAsState()
    val savedAlbums by viewModel.savedAlbums.collectAsState()
    val followedArtists by viewModel.followedArtists.collectAsState()
    val localTracks by viewModel.localTracks.collectAsState()

    var searchQuery by remember { mutableStateOf("") }
    var isSearchActive by remember { mutableStateOf(false) }
    var selectedTab by remember { mutableStateOf(0) }
    var sortMode by remember { mutableStateOf("recent") }
    var localSubTab by remember { mutableStateOf("songs") } // songs, albums, artists, folders

    val filteredLocalTracks = remember(localTracks, searchQuery) {
        if (searchQuery.isBlank()) localTracks
        else localTracks.filter {
            it.name.contains(searchQuery, ignoreCase = true) || it.artists.contains(searchQuery, ignoreCase = true)
        }
    }

    val filteredPlaylists = remember(playlists, searchQuery) {
        if (searchQuery.isBlank()) playlists
        else playlists.filter { it.name.contains(searchQuery, ignoreCase = true) }
    }

    val filteredFavorites = remember(favorites, searchQuery, sortMode) {
        val list = if (searchQuery.isBlank()) favorites else favorites.filter {
            it.name.contains(searchQuery, ignoreCase = true) || it.artists.contains(searchQuery, ignoreCase = true)
        }
        when (sortMode) {
            "alpha" -> list.sortedBy { it.name.lowercase() }
            "artist" -> list.sortedBy { it.artists.lowercase() }
            else -> list
        }
    }

    val filteredHistory = remember(history, searchQuery) {
        if (searchQuery.isBlank()) history.distinctBy { it.id }
        else history.distinctBy { it.id }.filter {
            it.name.contains(searchQuery, ignoreCase = true) || it.artists.contains(searchQuery, ignoreCase = true)
        }
    }

    val filteredDownloads = remember(downloads, searchQuery) {
        if (searchQuery.isBlank()) downloads.distinctBy { it.id }
        else downloads.distinctBy { it.id }.filter {
            it.name.contains(searchQuery, ignoreCase = true) || it.artists.contains(searchQuery, ignoreCase = true)
        }
    }

    val filteredAlbums = remember(savedAlbums, searchQuery) {
        if (searchQuery.isBlank()) savedAlbums
        else savedAlbums.filter {
            it.name.contains(searchQuery, ignoreCase = true) || it.artist.contains(searchQuery, ignoreCase = true)
        }
    }

    val filteredArtists = remember(followedArtists, searchQuery) {
        if (searchQuery.isBlank()) followedArtists
        else followedArtists.filter {
            it.name.contains(searchQuery, ignoreCase = true)
        }
    }

    val uniqueSongs = remember(allSongs, searchQuery) {
        val list = allSongs.distinctBy { it.id }
        if (searchQuery.isBlank()) list
        else list.filter {
            it.name.contains(searchQuery, ignoreCase = true) || it.artists.contains(searchQuery, ignoreCase = true)
        }
    }
    
    var selectedSongForMenu by remember { mutableStateOf<Song?>(null) }
    var selectedSongForPlaylist by remember { mutableStateOf<Song?>(null) }
    var showCreateDialog by remember { mutableStateOf(false) }
    var newPlaylistName by remember { mutableStateOf("") }
    var showCreatePlaylistDialog by remember { mutableStateOf(false) }
    var newPlaylistNameDialog by remember { mutableStateOf("") }
    
    val tabs = listOf("Playlists", "Songs", "Albums", "Artists", "History", "Downloads", "Local")

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
            .background(MaterialTheme.colorScheme.background)
            .statusBarsPadding()
    ) {
        // 1. Top Header Row (My Music, Search Toggle, Add Playlist)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Dimens.ScreenPadding, vertical = Dimens.PaddingMedium),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "My Music",
                style = MaterialTheme.typography.displayLarge,
                color = MaterialTheme.colorScheme.onBackground
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                IconButton(
                    onClick = { isSearchActive = !isSearchActive },
                    modifier = Modifier.background(MaterialTheme.colorScheme.surface, CircleShape)
                ) {
                    Icon(
                        imageVector = if (isSearchActive) Icons.Filled.Close else Icons.Filled.Search,
                        contentDescription = "Search Library",
                        tint = MaterialTheme.colorScheme.onSurface
                    )
                }
                IconButton(
                    onClick = { showCreateDialog = true },
                    modifier = Modifier.background(MaterialTheme.colorScheme.surface, CircleShape)
                ) {
                    Icon(Icons.Filled.Add, contentDescription = "Add Playlist", tint = MaterialTheme.colorScheme.onSurface)
                }
            }
        }

        // 2. Expandable Search Bar in Library
        if (isSearchActive) {
            TextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = { Text("Search in your library...", color = Secondary) },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Dimens.ScreenPadding, vertical = 4.dp),
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = MaterialTheme.colorScheme.surface,
                    unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent
                ),
                shape = RoundedCornerShape(Dimens.RadiusFull)
            )
        }

        // 3. Quick Access 4-Card Grid
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Dimens.ScreenPadding, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            QuickAccessCard(
                title = "Liked Songs",
                subtitle = "${favorites.size} tracks",
                icon = Icons.Default.Favorite,
                gradient = Brush.linearGradient(listOf(Color(0xFFFF2A4D), Color(0xFF750014))),
                modifier = Modifier.weight(1f),
                onClick = { selectedTab = 1 }
            )
            QuickAccessCard(
                title = "Downloads",
                subtitle = "${downloads.size} songs",
                icon = Icons.Default.Download,
                gradient = Brush.linearGradient(listOf(Color(0xFF4338CA), Color(0xFF1E1B4B))),
                modifier = Modifier.weight(1f),
                onClick = { selectedTab = 5 }
            )
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Dimens.ScreenPadding, vertical = 2.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            QuickAccessCard(
                title = "Local Music",
                subtitle = "Device files",
                icon = Icons.Default.Folder,
                gradient = Brush.linearGradient(listOf(Color(0xFF059669), Color(0xFF064E3B))),
                modifier = Modifier.weight(1f),
                onClick = { selectedTab = 6 }
            )
            QuickAccessCard(
                title = "Recent Plays",
                subtitle = "${history.size} tracks",
                icon = Icons.Default.History,
                gradient = Brush.linearGradient(listOf(Color(0xFFD97706), Color(0xFF78350F))),
                modifier = Modifier.weight(1f),
                onClick = { selectedTab = 4 }
            )
        }

        Spacer(modifier = Modifier.height(Dimens.PaddingMedium))

        // 4. Scrollable 7 Filter Tabs
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
                            .background(MusicAccent.copy(alpha = 0.12f), CircleShape)
                            .border(1.dp, MusicAccent.copy(alpha = 0.3f), CircleShape)
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
                            style = if (selectedTab == index) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyMedium,
                            color = if (selectedTab == index) MaterialTheme.colorScheme.onBackground else Secondary
                        )
                    }
                )
            }
        }

        Spacer(modifier = Modifier.height(Dimens.PaddingSmall))

        // 5. Dynamic Tab Content Body
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = bottomPadding + Dimens.PaddingLarge)
        ) {
            when (selectedTab) {
                // 0. PLAYLISTS TAB
                0 -> {
                    item {
                        MFListRow(
                            title = "Liked Songs",
                            subtitle = "Playlist • ${favorites.size} songs",
                            imageUrl = null,
                            trailingIcon = Icons.Default.Favorite,
                            onTrailingClick = { /* Liked songs root */ },
                            onClick = { onPlaylistClick("liked") }
                        )
                    }
                    if (filteredPlaylists.isEmpty() && playlists.isEmpty()) {
                        item {
                            EmptyState(
                                message = "No custom playlists yet.\nCreate your first playlist with the + button above.",
                                icon = Icons.Filled.QueueMusic
                            )
                        }
                    } else {
                        items(filteredPlaylists, key = { it.id }) { playlist ->
                            MFListRow(
                                title = playlist.name,
                                subtitle = "Playlist • Created by you",
                                imageUrl = null,
                                trailingIcon = Icons.Default.MoreVert,
                                onTrailingClick = { /* Playlist menu */ },
                                onClick = { onPlaylistClick(playlist.id) }
                            )
                        }
                    }
                }

                // 1. SONGS (LIKED SONGS) TAB
                1 -> {
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = Dimens.ScreenPadding, vertical = 6.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Liked Songs (${filteredFavorites.size})",
                                style = MaterialTheme.typography.titleMedium,
                                color = Color.White
                            )
                            if (filteredFavorites.isNotEmpty()) {
                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    IconButton(
                                        onClick = { viewModel.playPlaylist(filteredFavorites) },
                                        modifier = Modifier.size(36.dp).background(MusicAccent, CircleShape)
                                    ) {
                                        Icon(Icons.Default.PlayArrow, contentDescription = "Play All", tint = Color.White, modifier = Modifier.size(20.dp))
                                    }
                                    IconButton(
                                        onClick = { viewModel.shufflePlaylist(filteredFavorites) },
                                        modifier = Modifier.size(36.dp).background(SurfaceDark, CircleShape)
                                    ) {
                                        Icon(Icons.Default.Shuffle, contentDescription = "Shuffle", tint = Color.White, modifier = Modifier.size(18.dp))
                                    }
                                }
                            }
                        }
                    }

                    if (filteredFavorites.isEmpty()) {
                        item {
                            EmptyState(
                                message = "Your liked songs will appear here.\nFavorite tracks while exploring music.",
                                icon = Icons.Filled.FavoriteBorder
                            )
                        }
                    } else {
                        items(filteredFavorites, key = { "fav_${it.id}" }) { song ->
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

                // 2. ALBUMS TAB
                2 -> {
                    if (filteredAlbums.isEmpty()) {
                        item {
                            EmptyState(
                                message = "No saved albums yet.\nSave albums from explore and search.",
                                icon = Icons.Filled.Album
                            )
                        }
                    } else {
                        items(filteredAlbums, key = { "alb_${it.id}" }) { album ->
                            MFListRow(
                                title = album.name,
                                subtitle = "${album.artist} • ${album.year}",
                                imageUrl = album.image,
                                onTrailingClick = { /* Album menu */ },
                                onClick = { /* Open album detail */ }
                            )
                        }
                    }
                }

                // 3. ARTISTS TAB
                3 -> {
                    if (filteredArtists.isEmpty()) {
                        item {
                            EmptyState(
                                message = "No followed artists yet.\nFollow artists to receive personalized updates.",
                                icon = Icons.Filled.Person
                            )
                        }
                    } else {
                        items(filteredArtists, key = { "art_${it.id}" }) { artist ->
                            MFListRow(
                                title = artist.name,
                                subtitle = "Artist • Following",
                                imageUrl = artist.image,
                                onTrailingClick = { viewModel.toggleFollowArtist(artist) },
                                onClick = { /* Open artist */ }
                            )
                        }
                    }
                }

                // 4. HISTORY TAB
                4 -> {
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = Dimens.ScreenPadding, vertical = 6.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Listening History (${filteredHistory.size})",
                                style = MaterialTheme.typography.titleMedium,
                                color = Color.White
                            )
                            if (filteredHistory.isNotEmpty()) {
                                TextButton(onClick = { viewModel.clearHistory() }) {
                                    Text("Clear All", color = MusicAccent)
                                }
                            }
                        }
                    }

                    if (filteredHistory.isEmpty()) {
                        item {
                            EmptyState(
                                message = "Nothing played yet.\nStart streaming music to track history.",
                                icon = Icons.Filled.History
                            )
                        }
                    } else {
                        items(filteredHistory, key = { "hist_${it.id}" }) { song ->
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

                // 5. DOWNLOADS TAB
                5 -> {
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = Dimens.ScreenPadding, vertical = 6.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Offline Downloads (${filteredDownloads.size})",
                                style = MaterialTheme.typography.titleMedium,
                                color = Color.White
                            )
                            if (filteredDownloads.isNotEmpty()) {
                                Button(
                                    onClick = { viewModel.playPlaylist(filteredDownloads) },
                                    shape = CircleShape,
                                    colors = ButtonDefaults.buttonColors(containerColor = MusicAccent),
                                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)
                                ) {
                                    Icon(Icons.Default.PlayArrow, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Play Offline", style = MaterialTheme.typography.labelMedium)
                                }
                            }
                        }
                    }

                    if (filteredDownloads.isEmpty()) {
                        item {
                            EmptyState(
                                message = "No downloaded tracks.\nDownload music for zero-data offline playback.",
                                icon = Icons.Filled.Download
                            )
                        }
                    } else {
                        items(filteredDownloads, key = { "dl_${it.id}" }) { song ->
                            MFListRow(
                                title = song.name,
                                subtitle = "${song.artists} • Downloaded",
                                imageUrl = song.image,
                                onTrailingClick = { selectedSongForMenu = song },
                                onClick = { onSongClick(song) }
                            )
                        }
                    }
                }

                // 6. LOCAL MUSIC TAB
                6 -> {
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = Dimens.ScreenPadding, vertical = 6.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Local Device Tracks (${filteredLocalTracks.size})",
                                style = MaterialTheme.typography.titleMedium,
                                color = Color.White
                            )
                            val context = androidx.compose.ui.platform.LocalContext.current
                            Button(
                                onClick = { viewModel.scanLocalDeviceMusic(context) },
                                shape = CircleShape,
                                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.surface),
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)
                            ) {
                                Icon(Icons.Default.Refresh, contentDescription = "Scan", tint = MusicAccent, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Scan Device", style = MaterialTheme.typography.labelSmall, color = Color.White)
                            }
                        }
                    }

                    if (filteredLocalTracks.isEmpty()) {
                        item {
                            EmptyState(
                                message = "No local audio found on device.\nTap 'Scan Device' to discover local songs.",
                                icon = Icons.Filled.Folder
                            )
                        }
                    } else {
                        items(filteredLocalTracks, key = { "loc_${it.id}" }) { song ->
                            MFListRow(
                                title = song.name,
                                subtitle = "${song.artists} • Local",
                                imageUrl = song.image,
                                onTrailingClick = { selectedSongForMenu = song },
                                onClick = { onSongClick(song) }
                            )
                        }
                    }
                }
            }
        }

        // Context menu and dialogs
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
                    val sendIntent = android.content.Intent().apply {
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
fun QuickAccessCard(
    title: String,
    subtitle: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    gradient: Brush,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Surface(
        modifier = modifier
            .height(72.dp)
            .clip(RoundedCornerShape(Dimens.RadiusLarge))
            .clickable { onClick() },
        color = Color.Transparent
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(gradient)
                .padding(horizontal = 12.dp, vertical = 10.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxSize(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = title,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        maxLines = 1
                    )
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White.copy(alpha = 0.75f),
                        maxLines = 1
                    )
                }
            }
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
                .size(100.dp)
                .clip(CircleShape)
                .background(Color.White.copy(alpha = 0.03f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(48.dp),
                tint = Color.White.copy(alpha = 0.2f)
            )
        }
        Spacer(modifier = Modifier.height(Dimens.PaddingLarge))
        Text(
            text = message,
            style = MaterialTheme.typography.titleSmall,
            color = Secondary,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
        )
    }
}
