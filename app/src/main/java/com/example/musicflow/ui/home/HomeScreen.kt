package com.example.musicflow.ui.home

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
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
import com.example.musicflow.data.model.Album
import com.example.musicflow.data.model.Playlist
import com.example.musicflow.data.model.Song
import com.example.musicflow.ui.components.*
import com.example.musicflow.ui.theme.*

@Composable
fun HomeScreen(
    viewModel: HomeViewModel,
    onSongClick: (Song) -> Unit,
    onAlbumClick: (String) -> Unit,
    onArtistClick: (String) -> Unit,
    onProfileClick: () -> Unit,
    onSettingsClick: () -> Unit,
    onNavigate: (String) -> Unit,
    bottomPadding: androidx.compose.ui.unit.Dp
) {
    val selectedMood by viewModel.selectedMood.collectAsState()
    val quickPicks by viewModel.quickPicks.collectAsState()
    val recentlyPlayed by viewModel.recentlyPlayed.collectAsState()
    val trendingSongs by viewModel.trendingSongs.collectAsState()
    val topCharts by viewModel.topCharts.collectAsState()
    val newReleases by viewModel.newReleases.collectAsState()
    val recommendations by viewModel.recommendations.collectAsState()
    val trendingAlbums by viewModel.trendingAlbums.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val userName by viewModel.userName.collectAsState()
    val playlists by viewModel.playlists.collectAsState()

    var selectedSongForMenu by remember { mutableStateOf<Song?>(null) }
    var selectedSongForPlaylist by remember { mutableStateOf<Song?>(null) }
    var showCreatePlaylistDialog by remember { mutableStateOf(false) }
    var newPlaylistName by remember { mutableStateOf("") }

    val displayName = userName?.takeIf { it.isNotBlank() } ?: "Music Lover"

    val displayQuickPicks = remember(quickPicks, trendingSongs) {
        if (quickPicks.isNotEmpty()) quickPicks else trendingSongs
    }
    val quickPickChunks = remember(displayQuickPicks) { displayQuickPicks.take(16).chunked(4) }
    val uniqueRecent = remember(recentlyPlayed) { recentlyPlayed.distinctBy { it.id } }
    val displayRecommendations = remember(recommendations, trendingSongs) {
        if (recommendations.isNotEmpty()) recommendations else trendingSongs
    }
    val uniqueRecs = remember(displayRecommendations) { displayRecommendations.distinctBy { it.id }.take(12) }
    val displayNewSongs = remember(newReleases, trendingSongs) {
        if (newReleases.isNotEmpty()) newReleases else trendingSongs
    }
    val uniqueNewSongs = remember(displayNewSongs) { displayNewSongs.distinctBy { it.id }.take(6) }
    val uniqueCharts = remember(topCharts) { topCharts.distinctBy { it.id }.take(8) }
    val uniqueAlbums = remember(trendingAlbums) { trendingAlbums.distinctBy { it.id }.take(8) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        if (isLoading && trendingSongs.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = MusicRed, strokeWidth = 2.dp, modifier = Modifier.size(40.dp))
            }
        } else if (error != null && trendingSongs.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(24.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.ErrorOutline,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.15f),
                        modifier = Modifier.size(64.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = error!!,
                        color = Secondary,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        style = MaterialTheme.typography.bodyLarge
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                    Button(
                        onClick = { viewModel.loadHomeData() },
                        colors = ButtonDefaults.buttonColors(containerColor = MusicRed),
                        shape = RoundedCornerShape(24.dp)
                    ) {
                        Text("Try Again", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = bottomPadding + 24.dp)
            ) {
                // 1. Top Bar (Avatar Left, Hi Name Center, Settings Right)
                item {
                    HomeTopBarReplica(
                        name = displayName,
                        onProfileClick = onProfileClick,
                        onMoreClick = onSettingsClick
                    )
                }

                // 2. YouTube Music Mood & Activity Filter Chips Bar
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 20.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.padding(vertical = 8.dp)
                    ) {
                        items(viewModel.moods) { mood ->
                            val isSelected = selectedMood == mood
                            Surface(
                                shape = RoundedCornerShape(20.dp),
                                color = if (isSelected) MusicRed else MaterialTheme.colorScheme.surface,
                                border = BorderStroke(
                                    1.dp,
                                    if (isSelected) MusicRed else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.1f)
                                ),
                                modifier = Modifier.clickable { viewModel.setMood(mood) }
                            ) {
                                Text(
                                    text = mood,
                                    style = MaterialTheme.typography.bodyMedium.copy(
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                        fontSize = 13.sp
                                    ),
                                    color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurface,
                                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                                )
                            }
                        }
                    }
                }

                // 3. YouTube Music Signature "Quick Picks" (4-Row Multi-Column Horizontal Carousel)
                if (displayQuickPicks.isNotEmpty()) {
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 20.dp, vertical = 12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = "START RADIO FROM A SONG",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontWeight = FontWeight.Bold,
                                        letterSpacing = 1.sp
                                    ),
                                    color = Secondary
                                )
                                Text(
                                    text = "Quick picks",
                                    style = MaterialTheme.typography.headlineMedium.copy(
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 22.sp
                                    ),
                                    color = MaterialTheme.colorScheme.onBackground
                                )
                            }
                            Surface(
                                shape = RoundedCornerShape(20.dp),
                                color = MaterialTheme.colorScheme.surface,
                                border = BorderStroke(1.dp, MaterialTheme.colorScheme.onSurface.copy(alpha = 0.12f)),
                                modifier = Modifier.clickable { viewModel.playQuickPicks() }
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.PlayArrow,
                                        contentDescription = "Play all",
                                        tint = MusicRed,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = "Play all",
                                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                                        color = MaterialTheme.colorScheme.onBackground
                                    )
                                }
                            }
                        }
                    }

                    item {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 20.dp),
                            horizontalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            items(quickPickChunks) { chunk ->
                                Column(
                                    modifier = Modifier.width(320.dp),
                                    verticalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    chunk.forEach { song ->
                                        QuickPickSongRow(
                                            song = song,
                                            onClick = { onSongClick(song) },
                                            onMoreClick = { selectedSongForMenu = song }
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // 4. Hero Mixes Carousel (Red Ripple "Your mix", Teal "Phonk mix", Purple "Chill mix")
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 14.dp)
                    ) {
                        Text(
                            text = "MIXED FOR YOU",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp
                            ),
                            color = Secondary
                        )
                        Text(
                            text = "Daily Mixes",
                            style = MaterialTheme.typography.headlineMedium.copy(
                                fontWeight = FontWeight.Bold,
                                fontSize = 22.sp
                            ),
                            color = MaterialTheme.colorScheme.onBackground
                        )
                    }
                }

                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 20.dp),
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        item {
                            RedRippleHeroCard(
                                title = "Supermix",
                                subtitle = "Personalized for you",
                                onClick = { viewModel.playYourMix() }
                            )
                        }
                        item {
                            TealPhonkHeroCard(
                                title = "Phonk Waves",
                                subtitle = "High energy phonk",
                                onClick = { viewModel.playPhonkMix() }
                            )
                        }
                        item {
                            PurpleChillHeroCard(
                                title = "Lo-Fi Beats",
                                subtitle = "Study & chill mix",
                                onClick = { viewModel.playLoFiMix() }
                            )
                        }
                    }
                }

                // 5. "Listen Again" / Recent History Shelf (if history exists)
                if (uniqueRecent.isNotEmpty()) {
                    item {
                        SectionHeaderWithAction(
                            label = "LISTEN AGAIN",
                            title = "Forgotten favorites",
                            onActionClick = { onNavigate("library") }
                        )
                    }

                    item {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 20.dp),
                            horizontalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            itemsIndexed(uniqueRecent, key = { index, song -> "recent_${song.id}_$index" }) { _, song ->
                                Column(
                                    modifier = Modifier
                                        .width(130.dp)
                                        .clickable { onSongClick(song) }
                                ) {
                                    AsyncImage(
                                        model = song.image,
                                        contentDescription = song.name,
                                        modifier = Modifier
                                            .size(130.dp)
                                            .clip(RoundedCornerShape(18.dp))
                                            .background(MaterialTheme.colorScheme.surface),
                                        contentScale = ContentScale.Crop
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(
                                        text = song.name,
                                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                                        color = MaterialTheme.colorScheme.onBackground,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Text(
                                        text = song.artists,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = Secondary,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                            }
                        }
                    }
                }

                // 6. "Recommend" Section (Glass Overlay Cards)
                if (uniqueRecs.isNotEmpty()) {
                    item {
                        SectionHeaderWithAction(
                            label = "DISCOVER",
                            title = "Recommended tracks",
                            onActionClick = { onNavigate("recommend_more") }
                        )
                    }

                    item {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 20.dp),
                            horizontalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            itemsIndexed(uniqueRecs, key = { index, song -> "rec_${song.id}_$index" }) { _, song ->
                                RecommendGlassCard(
                                    song = song,
                                    onClick = { onSongClick(song) },
                                    onPlayClick = { onSongClick(song) }
                                )
                            }
                        }
                    }
                }

                // 7. "New Releases" Section
                if (uniqueNewSongs.isNotEmpty()) {
                    item {
                        SectionHeaderWithAction(
                            label = "FRESH MUSIC",
                            title = "New releases",
                            onActionClick = { onNavigate("new_releases") }
                        )
                    }

                    itemsIndexed(uniqueNewSongs, key = { index, song -> "new_song_${song.id}_$index" }) { _, song ->
                        NewSongVerticalRow(
                            song = song,
                            onClick = { onSongClick(song) },
                            onMoreClick = { selectedSongForMenu = song }
                        )
                    }
                }

                // 8. "Top Charts & Playlists" Section
                if (uniqueCharts.isNotEmpty()) {
                    item {
                        SectionHeaderWithAction(
                            label = "EXPLORE",
                            title = "Trending Charts & Playlists",
                            onActionClick = { onNavigate("charts") }
                        )
                    }

                    item {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 20.dp),
                            horizontalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            itemsIndexed(uniqueCharts, key = { index, playlist -> "playlist_${playlist.id}_$index" }) { _, playlist ->
                                RecommendedPlaylistCard(
                                    playlist = playlist,
                                    onClick = {
                                        if (playlist.songs.isNotEmpty()) {
                                            viewModel.playYourMix()
                                        }
                                    }
                                )
                            }
                        }
                    }
                }

                // 9. "Popular Albums" Section
                if (uniqueAlbums.isNotEmpty()) {
                    item {
                        SectionHeaderWithAction(
                            label = "DISCOGRAPHY",
                            title = "Top Albums & EPs",
                            onActionClick = { onNavigate("albums") }
                        )
                    }

                    item {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 20.dp),
                            horizontalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            itemsIndexed(uniqueAlbums, key = { index, album -> "alb_${album.id}_$index" }) { _, album ->
                                Column(
                                    modifier = Modifier
                                        .width(140.dp)
                                        .clickable { onAlbumClick(album.id) }
                                ) {
                                    AsyncImage(
                                        model = album.image,
                                        contentDescription = album.name,
                                        modifier = Modifier
                                            .size(140.dp)
                                            .clip(RoundedCornerShape(18.dp))
                                            .background(MaterialTheme.colorScheme.surface),
                                        contentScale = ContentScale.Crop
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(
                                        text = album.name,
                                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                                        color = MaterialTheme.colorScheme.onBackground,
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
                }
            }
        }

        // Context Menu
        selectedSongForMenu?.let { song ->
            val isLiked = viewModel.favorites.collectAsState().value.any { it.id == song.id }
            val context = androidx.compose.ui.platform.LocalContext.current
            SongContextMenu(
                song = song,
                isLiked = isLiked,
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
                title = { Text("New Playlist", color = MaterialTheme.colorScheme.onSurface) },
                text = {
                    TextField(
                        value = newPlaylistName,
                        onValueChange = { newPlaylistName = it },
                        placeholder = { Text("Playlist Name", color = Secondary) },
                        colors = TextFieldDefaults.colors(
                            focusedContainerColor = Color.Transparent,
                            unfocusedContainerColor = Color.Transparent,
                            focusedTextColor = MaterialTheme.colorScheme.onSurface,
                            unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
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
// HELPER COMPOSABLES
// -------------------------------------------------------------

@Composable
fun SectionHeaderWithAction(
    label: String,
    title: String,
    onActionClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp)
            .padding(top = 28.dp, bottom = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column {
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall.copy(
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                ),
                color = Secondary
            )
            Text(
                text = title,
                style = MaterialTheme.typography.headlineMedium.copy(
                    fontWeight = FontWeight.Bold,
                    fontSize = 22.sp
                ),
                color = MaterialTheme.colorScheme.onBackground
            )
        }
        Icon(
            imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
            contentDescription = "See more",
            tint = Secondary,
            modifier = Modifier
                .size(24.dp)
                .clickable(onClick = onActionClick)
        )
    }
}

@Composable
fun QuickPickSongRow(
    song: Song,
    onClick: () -> Unit,
    onMoreClick: () -> Unit
) {
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = Color.Transparent,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            AsyncImage(
                model = song.image,
                contentDescription = song.name,
                modifier = Modifier
                    .size(52.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.surface),
                contentScale = ContentScale.Crop
            )
            Spacer(modifier = Modifier.width(14.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = song.name,
                    style = MaterialTheme.typography.bodyLarge.copy(
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 15.sp
                    ),
                    color = MaterialTheme.colorScheme.onBackground,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = song.artists,
                    style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp),
                    color = Secondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            IconButton(
                onClick = onMoreClick,
                modifier = Modifier.size(36.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.MoreVert,
                    contentDescription = "More",
                    tint = Secondary,
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}

@Composable
fun HomeTopBarReplica(
    name: String,
    onProfileClick: () -> Unit,
    onMoreClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .statusBarsPadding()
            .padding(horizontal = 20.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Surface(
            modifier = Modifier
                .size(44.dp)
                .clickable(onClick = onProfileClick),
            shape = CircleShape,
            color = MaterialTheme.colorScheme.surface,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f))
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = MFIcons.Profile,
                    contentDescription = "Profile",
                    tint = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.size(20.dp)
                )
            }
        }

        Text(
            text = "Hi, $name",
            style = MaterialTheme.typography.titleMedium.copy(
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp
            ),
            color = MaterialTheme.colorScheme.onBackground
        )

        Surface(
            modifier = Modifier
                .size(44.dp)
                .clickable(onClick = onMoreClick),
            shape = CircleShape,
            color = MaterialTheme.colorScheme.surface,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f))
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = MFIcons.MoreGrid,
                    contentDescription = "Menu",
                    tint = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}

@Composable
fun RedRippleHeroCard(
    title: String,
    subtitle: String,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .width(220.dp)
            .height(200.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(26.dp),
        color = MusicRed
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            Box(
                modifier = Modifier
                    .size(240.dp)
                    .align(Alignment.BottomEnd)
                    .offset(x = 40.dp, y = 40.dp)
                    .border(1.5.dp, Color.White.copy(alpha = 0.25f), CircleShape)
            )
            Box(
                modifier = Modifier
                    .size(170.dp)
                    .align(Alignment.BottomEnd)
                    .offset(x = 40.dp, y = 40.dp)
                    .border(1.5.dp, Color.White.copy(alpha = 0.35f), CircleShape)
            )
            Box(
                modifier = Modifier
                    .size(100.dp)
                    .align(Alignment.BottomEnd)
                    .offset(x = 40.dp, y = 40.dp)
                    .border(1.5.dp, Color.White.copy(alpha = 0.45f), CircleShape)
            )

            Column(
                modifier = Modifier
                    .padding(20.dp)
                    .align(Alignment.TopStart)
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.headlineMedium.copy(
                        fontWeight = FontWeight.Bold,
                        fontSize = 24.sp
                    ),
                    color = Color.White
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodyMedium.copy(fontSize = 13.sp),
                    color = Color.White.copy(alpha = 0.8f)
                )
            }

            Surface(
                modifier = Modifier
                    .padding(16.dp)
                    .size(42.dp)
                    .align(Alignment.BottomEnd),
                shape = CircleShape,
                color = Color.White
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Default.PlayArrow,
                        contentDescription = "Play",
                        tint = MusicRed,
                        modifier = Modifier.size(22.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun TealPhonkHeroCard(
    title: String,
    subtitle: String,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .width(220.dp)
            .height(200.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(26.dp),
        color = Color(0xFF0C3D38)
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            AsyncImage(
                model = "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&q=80",
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
                alpha = 0.4f
            )
            Column(
                modifier = Modifier
                    .padding(20.dp)
                    .align(Alignment.TopStart)
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.headlineMedium.copy(
                        fontWeight = FontWeight.Bold,
                        fontSize = 24.sp
                    ),
                    color = Color.White
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodyMedium.copy(fontSize = 13.sp),
                    color = Color.White.copy(alpha = 0.8f)
                )
            }

            Surface(
                modifier = Modifier
                    .padding(16.dp)
                    .size(42.dp)
                    .align(Alignment.BottomEnd),
                shape = CircleShape,
                color = Color.White
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Default.PlayArrow,
                        contentDescription = "Play",
                        tint = Color(0xFF0C3D38),
                        modifier = Modifier.size(22.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun PurpleChillHeroCard(
    title: String,
    subtitle: String,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .width(220.dp)
            .height(200.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(26.dp),
        color = Color(0xFF4A1A40)
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            AsyncImage(
                model = "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&q=80",
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
                alpha = 0.4f
            )
            Column(
                modifier = Modifier
                    .padding(20.dp)
                    .align(Alignment.TopStart)
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.headlineMedium.copy(
                        fontWeight = FontWeight.Bold,
                        fontSize = 24.sp
                    ),
                    color = Color.White
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodyMedium.copy(fontSize = 13.sp),
                    color = Color.White.copy(alpha = 0.8f)
                )
            }

            Surface(
                modifier = Modifier
                    .padding(16.dp)
                    .size(42.dp)
                    .align(Alignment.BottomEnd),
                shape = CircleShape,
                color = Color.White
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Default.PlayArrow,
                        contentDescription = "Play",
                        tint = Color(0xFF4A1A40),
                        modifier = Modifier.size(22.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun RecommendGlassCard(
    song: Song,
    onClick: () -> Unit,
    onPlayClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .width(160.dp)
            .height(210.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(22.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f))
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            AsyncImage(
                model = song.image,
                contentDescription = song.name,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )

            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.85f)),
                            startY = 0.35f
                        )
                    )
            )

            Surface(
                modifier = Modifier
                    .padding(12.dp)
                    .size(36.dp)
                    .align(Alignment.TopEnd)
                    .clickable(onClick = onPlayClick),
                shape = CircleShape,
                color = MusicRed
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Default.PlayArrow,
                        contentDescription = "Play",
                        tint = Color.White,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            Column(
                modifier = Modifier
                    .padding(14.dp)
                    .align(Alignment.BottomStart)
            ) {
                Text(
                    text = song.name,
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    ),
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = song.artists,
                    style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
                    color = Color.White.copy(alpha = 0.7f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

@Composable
fun NewSongVerticalRow(
    song: Song,
    onClick: () -> Unit,
    onMoreClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        AsyncImage(
            model = song.image,
            contentDescription = song.name,
            modifier = Modifier
                .size(54.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(MaterialTheme.colorScheme.surface),
            contentScale = ContentScale.Crop
        )

        Spacer(modifier = Modifier.width(14.dp))

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
                text = song.artists,
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp),
                color = Secondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }

        IconButton(onClick = onMoreClick) {
            Icon(
                imageVector = Icons.Default.MoreVert,
                contentDescription = "More",
                tint = Secondary,
                modifier = Modifier.size(20.dp)
            )
        }
    }
}

@Composable
fun RecommendedPlaylistCard(
    playlist: Playlist,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .width(150.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(20.dp),
        color = Color.Transparent
    ) {
        Column {
            Box(
                modifier = Modifier
                    .size(150.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(MaterialTheme.colorScheme.surface)
            ) {
                AsyncImage(
                    model = playlist.image,
                    contentDescription = playlist.name,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )
                Surface(
                    modifier = Modifier
                        .padding(10.dp)
                        .size(34.dp)
                        .align(Alignment.BottomEnd),
                    shape = CircleShape,
                    color = MusicRed
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.Default.PlayArrow,
                            contentDescription = "Play",
                            tint = Color.White,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = playlist.name,
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp
                ),
                color = MaterialTheme.colorScheme.onBackground,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Text(
                text = playlist.subtitle.ifBlank { "${playlist.songCount} tracks" },
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
                color = Secondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}
