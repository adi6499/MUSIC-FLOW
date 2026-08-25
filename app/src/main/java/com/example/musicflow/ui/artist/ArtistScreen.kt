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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.musicflow.data.model.Album
import com.example.musicflow.data.model.Artist
import com.example.musicflow.data.model.Song
import com.example.musicflow.ui.components.*
import com.example.musicflow.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ArtistScreen(
    artistId: String,
    viewModel: ArtistViewModel,
    onBack: () -> Unit,
    onSongClick: (Song) -> Unit,
    onAlbumClick: (String) -> Unit,
    onArtistClick: (String) -> Unit = {},
    onTopTracksClick: (String) -> Unit = {},
    bottomPadding: androidx.compose.ui.unit.Dp
) {
    val artist by viewModel.artist.collectAsState()
    val topSongs by viewModel.topSongs.collectAsState()
    val albums by viewModel.albums.collectAsState()
    val playlists by viewModel.playlists.collectAsState()
    val isFollowed by viewModel.isFollowed.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    var showArtistMenu by remember { mutableStateOf(false) }
    var selectedSongForMenu by remember { mutableStateOf<Song?>(null) }
    var selectedSongForPlaylist by remember { mutableStateOf<Song?>(null) }
    var showCreatePlaylistDialog by remember { mutableStateOf(false) }
    var newPlaylistName by remember { mutableStateOf("") }

    val similarArtists = remember {
        listOf(
            Artist("sim_1", "Dua Lipa", "https://c.saavncdn.com/artists/Dua_Lipa_003_20240503074744_500x500.jpg"),
            Artist("sim_2", "Daft Punk", "https://c.saavncdn.com/artists/Daft_Punk_500x500.jpg"),
            Artist("sim_3", "Ed Sheeran", "https://c.saavncdn.com/artists/Ed_Sheeran_500x500.jpg"),
            Artist("sim_4", "Rihanna", "https://c.saavncdn.com/artists/Rihanna_500x500.jpg")
        )
    }

    LaunchedEffect(artistId) {
        viewModel.loadArtist(artistId)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = MusicRed, strokeWidth = 2.dp, modifier = Modifier.size(40.dp))
            }
        } else {
            artist?.let { artistData ->
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(bottom = bottomPadding + 32.dp)
                ) {
                    // 1. Top Bar + Hero Photo Card (Image 1)
                    item {
                        ArtistHeroTopSection(
                            artist = artistData,
                            onBack = onBack,
                            onMoreClick = { showArtistMenu = true }
                        )
                    }

                    // 2. Artist Name, Monthly Listeners, Red Play, Radio & Like Button (Image 1)
                    item {
                        ArtistTitleActionSection(
                            artist = artistData,
                            isFollowed = isFollowed,
                            onPlayClick = { viewModel.playArtistTopSongs() },
                            onRadioClick = { viewModel.startArtistRadio() },
                            onLikeClick = { viewModel.toggleFollow() }
                        )
                    }

                    // 3. Genre Pills Row (Image 1)
                    item {
                        ArtistGenrePillsRow(
                            genres = listOf("Pop", "Hip Hop", "R&B", "+ 04 Others")
                        )
                    }

                    // 4. "Recent release" Section (Image 1)
                    val recentSong = topSongs.firstOrNull()
                    if (recentSong != null) {
                        item {
                            Text(
                                text = "Recent release",
                                style = MaterialTheme.typography.titleLarge.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 20.sp
                                ),
                                color = Color.White,
                                modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp)
                            )
                        }

                        item {
                            Surface(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 20.dp)
                                    .clickable { onSongClick(recentSong) },
                                shape = RoundedCornerShape(20.dp),
                                color = SurfaceDark,
                                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f))
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    AsyncImage(
                                        model = recentSong.image,
                                        contentDescription = recentSong.name,
                                        modifier = Modifier
                                            .size(56.dp)
                                            .clip(RoundedCornerShape(12.dp)),
                                        contentScale = ContentScale.Crop
                                    )
                                    Spacer(modifier = Modifier.width(16.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = recentSong.name,
                                            style = MaterialTheme.typography.titleMedium.copy(
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 15.sp
                                            ),
                                            color = Color.White,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        Spacer(modifier = Modifier.height(2.dp))
                                        Text(
                                            text = "${recentSong.year.ifBlank { "2022" }} • Single",
                                            style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp),
                                            color = Secondary
                                        )
                                    }
                                    IconButton(onClick = { selectedSongForMenu = recentSong }) {
                                        Icon(
                                            imageVector = Icons.Default.MoreHoriz,
                                            contentDescription = "More",
                                            tint = Secondary,
                                            modifier = Modifier.size(24.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // 5. "Top tracks" Section (Image 2)
                    if (topSongs.isNotEmpty()) {
                        item {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onTopTracksClick(artistData.name) }
                                    .padding(horizontal = 20.dp)
                                    .padding(top = 28.dp, bottom = 12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Top tracks",
                                    style = MaterialTheme.typography.titleLarge.copy(
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 20.sp
                                    ),
                                    color = MaterialTheme.colorScheme.onBackground
                                )
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                                    contentDescription = "View all top tracks",
                                    tint = Secondary
                                )
                            }
                        }

                        itemsIndexed(topSongs.take(5), key = { index, song -> "artist_top_${song.id}_$index" }) { index, song ->
                            ArtistTrackNumberedRow(
                                index = index + 1,
                                song = song,
                                onClick = { onSongClick(song) },
                                onMoreClick = { selectedSongForMenu = song }
                            )
                        }
                    }

                    // 6. "Playlists" Section (Image 2)
                    item {
                        Text(
                            text = "Playlists",
                            style = MaterialTheme.typography.titleLarge.copy(
                                fontWeight = FontWeight.Bold,
                                fontSize = 20.sp
                            ),
                            color = Color.White,
                            modifier = Modifier.padding(start = 20.dp, top = 28.dp, bottom = 14.dp)
                        )
                    }

                    item {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 20.dp),
                            horizontalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            item {
                                ArtistPlaylistHeroCard(
                                    title = "Best: ${artistData.name}",
                                    subtitle = "49 songs • 1 h 17 min",
                                    imageUrl = artistData.image,
                                    bgColor = Color(0xFF0F3838),
                                    onClick = { viewModel.playArtistTopSongs() }
                                )
                            }
                            item {
                                ArtistPlaylistHeroCard(
                                    title = "Style: ${artistData.name}",
                                    subtitle = "37 songs • 1 h 01 min",
                                    imageUrl = artistData.image,
                                    bgColor = Color(0xFF5A1C2C),
                                    onClick = { viewModel.playArtistTopSongs() }
                                )
                            }
                        }
                    }

                    // 7. "Albums and EPs" Section (Image 2)
                    if (albums.isNotEmpty()) {
                        item {
                            Text(
                                text = "Albums and EPs",
                                style = MaterialTheme.typography.titleLarge.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 20.sp
                                ),
                                color = Color.White,
                                modifier = Modifier.padding(start = 20.dp, top = 28.dp, bottom = 14.dp)
                            )
                        }

                        item {
                            LazyRow(
                                contentPadding = PaddingValues(horizontal = 20.dp),
                                horizontalArrangement = Arrangement.spacedBy(14.dp)
                            ) {
                                items(albums, key = { "alb_${it.id}" }) { album ->
                                    ArtistAlbumGlassCard(
                                        album = album,
                                        onClick = { onAlbumClick(album.id) }
                                    )
                                }
                            }
                        }
                    }

                    // 8. "Similar artists" Section (Image 2)
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 20.dp)
                                .padding(top = 28.dp, bottom = 14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Similar artists",
                                style = MaterialTheme.typography.titleLarge.copy(
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 20.sp
                                ),
                                color = Color.White
                            )
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                                contentDescription = "See all",
                                tint = Secondary
                            )
                        }
                    }

                    item {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 20.dp),
                            horizontalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            items(similarArtists) { simArtist ->
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    modifier = Modifier
                                        .width(72.dp)
                                        .clickable { onArtistClick(simArtist.name) }
                                ) {
                                    AsyncImage(
                                        model = simArtist.image,
                                        contentDescription = simArtist.name,
                                        modifier = Modifier
                                            .size(68.dp)
                                            .clip(CircleShape)
                                            .background(MaterialTheme.colorScheme.surface),
                                        contentScale = ContentScale.Crop
                                    )
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Text(
                                        text = simArtist.name,
                                        style = MaterialTheme.typography.bodySmall.copy(
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Medium
                                        ),
                                        color = MaterialTheme.colorScheme.onBackground,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        textAlign = TextAlign.Center
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // Artist Options Bottom Sheet
        if (showArtistMenu) {
            val context = androidx.compose.ui.platform.LocalContext.current
            ModalBottomSheet(
                onDismissRequest = { showArtistMenu = false },
                containerColor = MaterialTheme.colorScheme.surface,
                dragHandle = { BottomSheetDefaults.DragHandle(color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.15f)) }
            ) {
                Column(modifier = Modifier.fillMaxWidth().padding(bottom = 32.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        AsyncImage(
                            model = artist?.image,
                            contentDescription = null,
                            modifier = Modifier.size(64.dp).clip(CircleShape),
                            contentScale = ContentScale.Crop
                        )
                        Spacer(modifier = Modifier.width(16.dp))
                        Column {
                            Text(text = artist?.name ?: "Artist", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onSurface)
                            Text(text = "Artist • MusicFlow", style = MaterialTheme.typography.bodyMedium, color = Secondary)
                        }
                    }
                    
                    HorizontalDivider(color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f), thickness = 0.5.dp)
                    
                    ContextMenuItem(
                        icon = if (isFollowed) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                        label = if (isFollowed) "Unfollow Artist" else "Follow Artist",
                        onClick = {
                            viewModel.toggleFollow()
                            showArtistMenu = false
                        }
                    )
                    ContextMenuItem(
                        icon = Icons.Default.PlayArrow,
                        label = "Play Top Songs",
                        onClick = {
                            viewModel.playArtistTopSongs()
                            showArtistMenu = false
                        }
                    )
                    ContextMenuItem(
                        icon = Icons.Default.Radio,
                        label = "Start Artist Radio",
                        onClick = {
                            topSongs.firstOrNull()?.let { viewModel.startRadio(it) }
                            showArtistMenu = false
                        }
                    )
                    ContextMenuItem(
                        icon = Icons.Default.Share,
                        label = "Share Artist",
                        onClick = {
                            val sendIntent = android.content.Intent().apply {
                                action = android.content.Intent.ACTION_SEND
                                putExtra(android.content.Intent.EXTRA_TEXT, "Listen to ${artist?.name} on MusicFlow: musicflow://artist/${artist?.id}")
                                type = "text/plain"
                            }
                            context.startActivity(android.content.Intent.createChooser(sendIntent, null))
                            showArtistMenu = false
                        }
                    )
                }
            }
        }

        // Context Menu
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

        // Playlist Selector Dialog
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
    }
}

// -------------------------------------------------------------
// HERO TOP SECTION (Image 1)
// -------------------------------------------------------------
@Composable
fun ArtistHeroTopSection(
    artist: Artist,
    onBack: () -> Unit,
    onMoreClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp)
            .statusBarsPadding()
    ) {
        // Hero Square Image Card
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .height(340.dp),
            shape = RoundedCornerShape(28.dp),
            color = SurfaceDark
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                AsyncImage(
                    model = artist.image,
                    contentDescription = artist.name,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )

                // Dark vignette overlay
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.8f)),
                                startY = 0.5f
                            )
                        )
                )

                // Artist Logo text at bottom center
                Text(
                    text = artist.name.uppercase(),
                    style = MaterialTheme.typography.displaySmall.copy(
                        fontWeight = FontWeight.Black,
                        fontSize = 18.sp,
                        letterSpacing = 2.sp
                    ),
                    color = Color.White,
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 20.dp)
                )
            }
        }

        // Top Navigation Controls Overlay
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                modifier = Modifier
                    .size(42.dp)
                    .clickable(onClick = onBack),
                shape = CircleShape,
                color = Color.Black.copy(alpha = 0.4f),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.15f))
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = Color.White,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }

            Text(
                text = artist.name,
                style = MaterialTheme.typography.titleMedium.copy(
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp
                ),
                color = Color.White
            )

            Surface(
                modifier = Modifier
                    .size(42.dp)
                    .clickable(onClick = onMoreClick),
                shape = CircleShape,
                color = Color.Black.copy(alpha = 0.4f),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.15f))
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = MFIcons.MoreGrid,
                        contentDescription = "More",
                        tint = Color.White,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }
    }
}

// -------------------------------------------------------------
// TITLE & ACTION SECTION (Image 1)
// -------------------------------------------------------------
@Composable
fun ArtistTitleActionSection(
    artist: Artist,
    isFollowed: Boolean,
    onPlayClick: () -> Unit,
    onRadioClick: () -> Unit = {},
    onLikeClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = artist.name,
                style = MaterialTheme.typography.headlineMedium.copy(
                    fontWeight = FontWeight.Bold,
                    fontSize = 24.sp
                ),
                color = Color.White
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "3 234 900 listeners per month",
                style = MaterialTheme.typography.bodyMedium.copy(fontSize = 13.sp),
                color = Secondary
            )
        }

        Row(
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Red Play Button
            Surface(
                modifier = Modifier
                    .size(48.dp)
                    .clickable(onClick = onPlayClick),
                shape = CircleShape,
                color = MusicRed
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Default.PlayArrow,
                        contentDescription = "Play",
                        tint = Color.White,
                        modifier = Modifier.size(24.dp)
                    )
                }
            }

            // Start Radio Button
            Surface(
                modifier = Modifier
                    .size(48.dp)
                    .clickable(onClick = onRadioClick),
                shape = CircleShape,
                color = SurfaceDark,
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f))
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Default.Radio,
                        contentDescription = "Start Radio",
                        tint = Color.White,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            // Like / Follow Button
            Surface(
                modifier = Modifier
                    .size(48.dp)
                    .clickable(onClick = onLikeClick),
                shape = CircleShape,
                color = SurfaceDark,
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f))
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = if (isFollowed) Icons.Default.ThumbUp else Icons.Default.ThumbUpOffAlt,
                        contentDescription = "Like",
                        tint = if (isFollowed) MusicRed else Color.White,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }
    }
}

// -------------------------------------------------------------
// GENRE PILLS ROW (Image 1)
// -------------------------------------------------------------
@Composable
fun ArtistGenrePillsRow(genres: List<String>) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 20.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.padding(vertical = 12.dp)
    ) {
        items(genres) { genre ->
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = SurfaceDark,
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f))
            ) {
                Text(
                    text = genre,
                    style = MaterialTheme.typography.labelMedium.copy(
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium
                    ),
                    color = Color.White,
                    modifier = Modifier.padding(horizontal = 18.dp, vertical = 10.dp)
                )
            }
        }
    }
}

// -------------------------------------------------------------
// NUMBERED TRACK ROW (Image 2)
// -------------------------------------------------------------
@Composable
fun ArtistTrackNumberedRow(
    index: Int,
    song: Song,
    onClick: () -> Unit,
    onMoreClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = index.toString().padStart(2, '0'),
            style = MaterialTheme.typography.bodyMedium.copy(
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp
            ),
            color = Secondary,
            modifier = Modifier.width(28.dp)
        )

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
                style = MaterialTheme.typography.bodyMedium.copy(fontSize = 13.sp),
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

// -------------------------------------------------------------
// PLAYLIST HERO CARD (Image 2)
// -------------------------------------------------------------
@Composable
fun ArtistPlaylistHeroCard(
    title: String,
    subtitle: String,
    imageUrl: String,
    bgColor: Color,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .width(160.dp)
            .height(180.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(24.dp),
        color = bgColor
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            AsyncImage(
                model = imageUrl,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )

            // Gradient Overlay
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.9f)),
                            startY = 0.3f
                        )
                    )
            )

            // Floating circular play button
            Surface(
                modifier = Modifier
                    .align(Alignment.CenterEnd)
                    .padding(end = 12.dp)
                    .size(34.dp),
                shape = CircleShape,
                color = Color.White
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Default.PlayArrow,
                        contentDescription = "Play",
                        tint = Color.Black,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            Column(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(12.dp)
            ) {
                Text(
                    text = title,
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
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                    color = Secondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

// -------------------------------------------------------------
// ALBUM GLASS CARD (Image 2)
// -------------------------------------------------------------
@Composable
fun ArtistAlbumGlassCard(
    album: Album,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .width(155.dp)
            .height(185.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(22.dp),
        color = SurfaceDark,
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f))
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            AsyncImage(
                model = album.image,
                contentDescription = album.name,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )

            // Bottom Glassmorphic Overlay Badge
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomCenter)
                    .padding(8.dp),
                shape = RoundedCornerShape(14.dp),
                color = Color.Black.copy(alpha = 0.75f),
                border = BorderStroke(0.5.dp, Color.White.copy(alpha = 0.15f))
            ) {
                Column(modifier = Modifier.padding(8.dp)) {
                    Text(
                        text = album.name,
                        style = MaterialTheme.typography.titleSmall.copy(
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        ),
                        color = Color.White,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = "${album.artist} • ${album.year}",
                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                        color = Secondary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}
