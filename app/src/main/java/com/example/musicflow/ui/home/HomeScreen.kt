package com.example.musicflow.ui.home

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
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.musicflow.data.model.Song
import com.example.musicflow.data.model.Album
import com.example.musicflow.data.model.Playlist
import com.example.musicflow.ui.components.*
import com.example.musicflow.ui.theme.*
import java.util.Calendar

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
    val recentlyPlayed by viewModel.recentlyPlayed.collectAsState()
    val trendingSongs by viewModel.trendingSongs.collectAsState()
    val trendingAlbums by viewModel.trendingAlbums.collectAsState()
    val topCharts by viewModel.topCharts.collectAsState()
    val newReleases by viewModel.newReleases.collectAsState()
    val recommendations by viewModel.recommendations.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val userName by viewModel.userName.collectAsState()
    val playlists by viewModel.playlists.collectAsState()

    var selectedSongForMenu by remember { mutableStateOf<Song?>(null) }
    var selectedSongForPlaylist by remember { mutableStateOf<Song?>(null) }
    var showCreatePlaylistDialog by remember { mutableStateOf(false) }
    var newPlaylistName by remember { mutableStateOf("") }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = MusicAccent, strokeWidth = 2.dp, modifier = Modifier.size(40.dp))
            }
        } else if (error != null) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally, 
                    modifier = Modifier.padding(Dimens.PaddingLarge)
                ) {
                    Icon(
                        imageVector = Icons.Default.ErrorOutline, 
                        contentDescription = null, 
                        tint = Color.White.copy(alpha = 0.1f),
                        modifier = Modifier.size(64.dp)
                    )
                    Spacer(modifier = Modifier.height(Dimens.PaddingLarge))
                    Text(
                        text = error!!, 
                        color = Secondary, 
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        style = MaterialTheme.typography.bodyLarge
                    )
                    Spacer(modifier = Modifier.height(Dimens.PaddingDoubleExtraLarge))
                    MFPillButton(
                        text = "Try Again", 
                        onClick = { viewModel.loadHomeData() }
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = bottomPadding + Dimens.PaddingLarge)
            ) {
                // Header
                item {
                    HomeHeader(
                        name = userName ?: "Adesh",
                        onProfileClick = onProfileClick,
                        onSettingsClick = onSettingsClick,
                        onNavigate = onNavigate
                    )
                }

                // Main Greeting
                item {
                    Column(modifier = Modifier.padding(horizontal = Dimens.ScreenPadding, vertical = Dimens.PaddingLarge)) {
                        Text(
                            text = "Recommendations",
                            style = MaterialTheme.typography.labelMedium,
                            color = Secondary
                        )
                        Text(
                            text = "${userName ?: "Adesh"}, we have prepared several mixes for you",
                            style = MaterialTheme.typography.displayLarge,
                            modifier = Modifier.padding(top = Dimens.PaddingExtraSmall)
                        )
                    }
                }

                // Large Hero Cards (Your mix / Genre mix)
                if (topCharts.isNotEmpty()) {
                    item {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = Dimens.ScreenPadding),
                            horizontalArrangement = Arrangement.spacedBy(Dimens.PaddingLarge)
                        ) {
                            items(topCharts.take(3), key = { "mix_${it.id}" }) { playlist ->
                                HeroMixCard(playlist, onClick = { viewModel.playPlaylist(playlist) })
                            }
                        }
                    }
                }

                // New for you carousel
                if (newReleases.isNotEmpty()) {
                    item { SectionTitle("New for you") }
                    item {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = Dimens.ScreenPadding),
                            horizontalArrangement = Arrangement.spacedBy(Dimens.PaddingLarge)
                        ) {
                            items(newReleases.take(8), key = { "new_${it.id}" }) { song ->
                                CompactNewForYouCard(song, onClick = { onSongClick(song) })
                            }
                        }
                    }
                }

                // Recommend section
                if (recommendations.isNotEmpty()) {
                    item { SectionTitle("Recommend") }
                    item {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = Dimens.ScreenPadding),
                            horizontalArrangement = Arrangement.spacedBy(Dimens.PaddingLarge)
                        ) {
                            items(recommendations.take(6), key = { "rec_${it.id}" }) { song ->
                                MFCard(
                                    title = song.name,
                                    subtitle = song.artists,
                                    imageUrl = song.image,
                                    showPlayButton = true,
                                    onClick = { onSongClick(song) }
                                )
                            }
                        }
                    }
                }

                // New songs
                if (trendingSongs.isNotEmpty()) {
                    item { SectionTitle("New songs", onSeeAll = { onNavigate("songs_list/New songs") }) }
                    items(trendingSongs.take(4), key = { "trending_${it.id}" }) { song ->
                        MFListRow(
                            title = song.name,
                            subtitle = song.artists,
                            imageUrl = song.image,
                            onTrailingClick = { selectedSongForMenu = song },
                            onClick = { onSongClick(song) }
                        )
                    }
                }

                // Recommended playlists
                if (topCharts.isNotEmpty()) {
                    item { SectionTitle("Recommended playlists") }
                    item {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = Dimens.ScreenPadding),
                            horizontalArrangement = Arrangement.spacedBy(Dimens.PaddingLarge)
                        ) {
                            items(topCharts.drop(3).take(5), key = { "plist_${it.id}" }) { playlist ->
                                MFCard(
                                    title = playlist.name,
                                    subtitle = playlist.subtitle,
                                    imageUrl = playlist.image,
                                    onClick = { viewModel.playPlaylist(playlist) }
                                )
                            }
                        }
                    }
                }

                // Top Albums
                if (trendingAlbums.isNotEmpty()) {
                    item { SectionTitle("Top albums") }
                    item {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = Dimens.ScreenPadding),
                            horizontalArrangement = Arrangement.spacedBy(Dimens.PaddingLarge)
                        ) {
                            items(trendingAlbums.take(6), key = { "album_${it.id}" }) { album ->
                                MFCard(
                                    title = album.name,
                                    subtitle = album.artist,
                                    imageUrl = album.image,
                                    onClick = { onAlbumClick(album.id) }
                                )
                            }
                        }
                    }
                }

                // Popular artists
                if (newReleases.isNotEmpty()) {
                    item { SectionTitle("Popular artists") }
                    item {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = Dimens.ScreenPadding),
                            horizontalArrangement = Arrangement.spacedBy(Dimens.PaddingLarge)
                        ) {
                            val artists = newReleases.distinctBy { it.artists }
                            items(artists.take(6), key = { "artist_${it.id}" }) { song ->
                                ArtistAvatarRow(
                                    name = song.artists, 
                                    imageUrl = song.image,
                                    onClick = { onNavigate("songs_list/${song.artists}") }
                                )
                            }
                        }
                    }
                }

                // In trends
                if (recentlyPlayed.isNotEmpty()) {
                    item { SectionTitle("In trends") }
                    itemsIndexed(recentlyPlayed.take(5), key = { _, s -> "trend_${s.id}" }) { index, song ->
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
                
                item { Spacer(modifier = Modifier.height(Dimens.PaddingTripleExtraLarge)) }
            }

            selectedSongForMenu?.let { song ->
                val context = androidx.compose.ui.platform.LocalContext.current
                val favorites by viewModel.favorites.collectAsState()
                val isLiked = favorites.any { it.id == song.id }
                
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
                        // Keep selectedSongForPlaylist so we can add to it after creation if we want
                        // Or just let user create and manually add.
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
}

@Composable
fun HomeHeader(
    name: String,
    onProfileClick: () -> Unit,
    onSettingsClick: () -> Unit,
    onNavigate: (String) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = Dimens.ScreenPadding, vertical = Dimens.PaddingLarge),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            AsyncImage(
                model = "https://api.dicebear.com/7.x/avataaars/svg?seed=$name",
                contentDescription = "Profile",
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .clickable(onClick = onProfileClick),
                contentScale = ContentScale.Crop
            )
            Spacer(modifier = Modifier.width(Dimens.PaddingMedium))
            Column {
                Text(
                    text = "Welcome back,",
                    style = MaterialTheme.typography.labelSmall,
                    color = Secondary
                )
                Text(
                    text = name,
                    style = MaterialTheme.typography.titleMedium,
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )
            }
        }
        
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(
                onClick = { onNavigate("search") },
                modifier = Modifier.background(SurfaceVariantDark, CircleShape).size(40.dp)
            ) {
                Icon(Icons.Filled.Search, contentDescription = "Search", tint = Color.White, modifier = Modifier.size(20.dp))
            }
            Spacer(modifier = Modifier.width(Dimens.PaddingSmall))
            IconButton(
                onClick = onSettingsClick,
                modifier = Modifier.background(SurfaceVariantDark, CircleShape).size(40.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.GridView,
                    contentDescription = "Menu",
                    tint = Color.White,
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}

@Composable
fun SectionTitle(title: String, onSeeAll: (() -> Unit)? = null) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = Dimens.ScreenPadding)
            .padding(top = Dimens.SectionSpacing, bottom = Dimens.PaddingLarge),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.displayMedium,
            color = Color.White
        )
        if (onSeeAll != null) {
            IconButton(onClick = onSeeAll) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                    contentDescription = "See all",
                    tint = Secondary
                )
            }
        }
    }
}

@Composable
fun CompactNewForYouCard(song: Song, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .width(160.dp)
            .height(220.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(Dimens.RadiusLarge),
        color = SurfaceVariantDark,
        border = BorderStroke(0.5.dp, Color.White.copy(alpha = 0.1f))
    ) {
        Box {
            AsyncImage(
                model = song.image,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            listOf(Color.Transparent, Color.Black.copy(alpha = 0.9f)),
                            startY = 0.4f
                        )
                    )
            )
            Column(
                modifier = Modifier
                    .padding(Dimens.PaddingMedium)
                    .align(Alignment.BottomStart)
            ) {
                Text(
                    text = song.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    lineHeight = 20.sp
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = song.artists,
                    style = MaterialTheme.typography.labelSmall,
                    color = Secondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

@Composable
fun HeroMixCard(playlist: Playlist, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .width(280.dp)
            .height(180.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(Dimens.RadiusExtraLarge),
        color = Color.DarkGray
    ) {
        Box {
            AsyncImage(
                model = playlist.image,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            listOf(Color.Transparent, Color.Black.copy(alpha = 0.7f)),
                            startY = 0.3f
                        )
                    )
            )
            Text(
                text = "YOUR MIX",
                style = MaterialTheme.typography.labelSmall,
                color = MusicAccent,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(16.dp).align(Alignment.TopStart)
            )
            Text(
                text = playlist.name,
                style = MaterialTheme.typography.displayMedium,
                color = Color.White,
                modifier = Modifier.padding(16.dp).align(Alignment.BottomStart)
            )
            Surface(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(16.dp)
                    .size(48.dp),
                shape = CircleShape,
                color = Color.White
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Default.PlayArrow,
                        contentDescription = null,
                        tint = Color.Black,
                        modifier = Modifier.size(24.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun ArtistAvatarRow(name: String, imageUrl: String, onClick: () -> Unit = {}) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.width(80.dp).clickable(onClick = onClick)
    ) {
        AsyncImage(
            model = imageUrl,
            contentDescription = null,
            modifier = Modifier
                .size(80.dp)
                .clip(CircleShape)
                .background(SurfaceVariantDark),
            contentScale = ContentScale.Crop
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = name,
            style = MaterialTheme.typography.bodyMedium,
            color = Color.White,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
fun MusicCard(
    title: String,
    subtitle: String,
    imageUrl: String,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .width(140.dp)
            .clickable(onClick = onClick)
    ) {
        AsyncImage(
            model = imageUrl,
            contentDescription = null,
            modifier = Modifier
                .size(140.dp)
                .clip(RoundedCornerShape(Dimens.RadiusMedium)),
            contentScale = ContentScale.Crop
        )
        Spacer(modifier = Modifier.height(Dimens.PaddingSmall))
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            maxLines = 1,
            color = MaterialTheme.colorScheme.onBackground
        )
        Text(
            text = subtitle,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1
        )
    }
}

@Composable
fun LargeMusicCard(
    title: String,
    subtitle: String,
    imageUrl: String,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .width(200.dp)
            .clickable(onClick = onClick)
    ) {
        AsyncImage(
            model = imageUrl,
            contentDescription = null,
            modifier = Modifier
                .size(200.dp)
                .clip(RoundedCornerShape(Dimens.RadiusMedium)),
            contentScale = ContentScale.Crop
        )
        Spacer(modifier = Modifier.height(Dimens.PaddingSmall))
        Text(
            text = title,
            style = MaterialTheme.typography.titleLarge,
            maxLines = 1,
            color = MaterialTheme.colorScheme.onBackground
        )
        Text(
            text = subtitle,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1
        )
    }
}

@Composable
fun ArtistCircleCard(
    name: String,
    imageUrl: String,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .width(100.dp)
            .clickable(onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        AsyncImage(
            model = imageUrl,
            contentDescription = null,
            modifier = Modifier
                .size(100.dp)
                .clip(CircleShape),
            contentScale = ContentScale.Crop
        )
        Spacer(modifier = Modifier.height(Dimens.PaddingSmall))
        Text(
            text = name,
            style = MaterialTheme.typography.bodyMedium,
            maxLines = 1,
            color = MaterialTheme.colorScheme.onBackground
        )
    }
}

@Composable
fun SongRow(
    song: Song,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = Dimens.PaddingLarge, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        AsyncImage(
            model = song.image,
            contentDescription = null,
            modifier = Modifier
                .size(48.dp)
                .clip(RoundedCornerShape(Dimens.RadiusSmall)),
            contentScale = ContentScale.Crop
        )
        Spacer(modifier = Modifier.width(Dimens.PaddingLarge))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = song.name,
                style = MaterialTheme.typography.titleMedium,
                maxLines = 1,
                color = MaterialTheme.colorScheme.onBackground
            )
            Text(
                text = song.artists,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1
            )
        }
        IconButton(onClick = { /* Options */ }) {
            Icon(
                imageVector = Icons.Default.MoreVert, 
                contentDescription = "Options", 
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(20.dp)
            )
        }
    }
}
