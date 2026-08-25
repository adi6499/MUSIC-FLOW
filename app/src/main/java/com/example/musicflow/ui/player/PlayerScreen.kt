package com.example.musicflow.ui.player

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.musicflow.ui.components.*
import com.example.musicflow.ui.theme.*

@Composable
fun PlayerScreen(
    viewModel: PlayerViewModel,
    onCollapse: () -> Unit,
    onNavigateToArtist: (String) -> Unit = {},
    onNavigateToAlbum: (String) -> Unit = {},
    onEqualizerClick: () -> Unit = {}
) {
    val currentSong by viewModel.currentSong.collectAsState()
    val isPlaying by viewModel.isPlaying.collectAsState()
    val shuffleMode by viewModel.shuffleMode.collectAsState()
    val repeatMode by viewModel.repeatMode.collectAsState()
    val isFavorite by viewModel.isFavorite.collectAsState()
    val lyrics by viewModel.lyrics.collectAsState()
    val isDownloaded by viewModel.isDownloaded.collectAsState()
    val sleepTimerRemaining by viewModel.sleepTimerRemaining.collectAsState()
    val playbackSpeed by viewModel.playbackSpeed.collectAsState()
    val playlists by viewModel.playlists.collectAsState()
    val audioQuality by viewModel.audioQuality.collectAsState()

    var showQueueSheet by remember { mutableStateOf(false) }
    var showLyrics by remember { mutableStateOf(false) }
    var showSongMenu by remember { mutableStateOf(false) }
    var showSpeedDialog by remember { mutableStateOf(false) }
    var showSleepTimerDialog by remember { mutableStateOf(false) }
    var showPlaylistDialog by remember { mutableStateOf(false) }
    var showCreatePlaylistDialog by remember { mutableStateOf(false) }
    var showQualityDialog by remember { mutableStateOf(false) }
    var showStoryShareDialog by remember { mutableStateOf(false) }
    var newPlaylistNameDialog by remember { mutableStateOf("") }

    val palette = rememberMusicPalette(currentSong?.image)
    val animatedDominant by animateColorAsState(targetValue = palette.dominant, label = "dominant_color")

    currentSong?.let { song ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
        ) {
            // Immersive Dynamic Background
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        brush = Brush.verticalGradient(
                            colors = listOf(
                                animatedDominant.copy(alpha = 0.45f),
                                animatedDominant.copy(alpha = 0.1f),
                                MaterialTheme.colorScheme.background
                            )
                        )
                    )
            )

            if (showLyrics) {
                LyricsView(
                    songName = song.name,
                    artistName = song.artists,
                    viewModel = viewModel,
                    onEqualizerClick = {
                        showLyrics = false
                        onCollapse()
                        onEqualizerClick()
                    },
                    onQualityClick = { showQualityDialog = true },
                    onBack = { showLyrics = false }
                )
            } else {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .statusBarsPadding()
                        .padding(horizontal = Dimens.ScreenPadding),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Header
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = Dimens.PaddingLarge),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = onCollapse) {
                            Icon(Icons.Default.KeyboardArrowDown, contentDescription = "Collapse", tint = Color.White)
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "PLAYING FROM",
                                style = MaterialTheme.typography.labelSmall,
                                color = Secondary
                            )
                            Text(
                                text = song.album,
                                style = MaterialTheme.typography.titleMedium,
                                color = Color.White,
                                maxLines = 1,
                                modifier = Modifier.widthIn(max = 200.dp),
                                textAlign = TextAlign.Center
                            )
                        }
                        IconButton(onClick = { showSongMenu = true }) {
                            Icon(Icons.Filled.MoreVert, contentDescription = "More", tint = Color.White)
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // Large Album Artwork
                    AsyncImage(
                        model = song.image,
                        contentDescription = "Album Artwork",
                        modifier = Modifier
                            .fillMaxWidth(0.88f)
                            .aspectRatio(1f)
                            .clip(RoundedCornerShape(Dimens.RadiusExtraLarge)),
                        contentScale = ContentScale.Crop
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    // Live Reactive Glass Waveform Visualizer
                    val waveform by com.example.musicflow.player.AudioEffectsManager.waveformState.collectAsState()
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(0.88f)
                            .height(42.dp)
                            .clip(RoundedCornerShape(21.dp))
                            .background(Color.White.copy(alpha = 0.06f))
                            .padding(horizontal = 16.dp, vertical = 6.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Row(
                            modifier = Modifier.fillMaxSize(),
                            horizontalArrangement = Arrangement.SpaceEvenly,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            waveform.forEachIndexed { i, factor ->
                                val targetH = if (isPlaying) factor.coerceIn(0.18f, 1f) else 0.20f
                                val animatedHeight by androidx.compose.animation.core.animateFloatAsState(
                                    targetValue = targetH,
                                    animationSpec = androidx.compose.animation.core.spring(dampingRatio = 0.60f, stiffness = 450f),
                                    label = "wave_bar_$i"
                                )
                                Box(
                                    modifier = Modifier
                                        .width(3.5.dp)
                                        .fillMaxHeight(animatedHeight)
                                        .clip(RoundedCornerShape(2.dp))
                                        .background(
                                            brush = Brush.verticalGradient(
                                                listOf(
                                                    Color(0xFF00F2FE),
                                                    com.example.musicflow.ui.theme.MusicAccent,
                                                    Color.White
                                                )
                                            )
                                        )
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.weight(1f))

                    // Song Info
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
                        horizontalAlignment = Alignment.Start
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = song.name,
                                    style = MaterialTheme.typography.displayMedium,
                                    color = Color.White,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Text(
                                    text = song.artists,
                                    style = MaterialTheme.typography.headlineSmall,
                                    color = MusicRed,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    modifier = Modifier.clickable {
                                        val artistQuery = song.artists.split(",", "&", "feat.", "ft.").firstOrNull()?.trim() ?: song.artists
                                        onCollapse()
                                        onNavigateToArtist(artistQuery)
                                    }
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Surface(
                                    onClick = { showQualityDialog = true },
                                    shape = RoundedCornerShape(6.dp),
                                    color = Color.White.copy(alpha = 0.08f),
                                    border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.15f))
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.HighQuality,
                                            contentDescription = null,
                                            tint = MusicAccent,
                                            modifier = Modifier.size(13.dp)
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text(
                                            text = when (audioQuality) {
                                                "320kbps" -> "LOSSLESS • 320 KBPS"
                                                "160kbps" -> "HIGH • 160 KBPS"
                                                "96kbps" -> "NORMAL • 96 KBPS"
                                                "48kbps" -> "SAVER • 48 KBPS"
                                                else -> audioQuality.uppercase()
                                            },
                                            style = MaterialTheme.typography.labelSmall,
                                            color = Color.White,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 10.sp
                                        )
                                    }
                                }
                            }
                            val favScale by androidx.compose.animation.core.animateFloatAsState(
                                targetValue = if (isFavorite) 1.22f else 1.0f,
                                animationSpec = androidx.compose.animation.core.spring(dampingRatio = 0.4f, stiffness = 400f),
                                label = "fav_scale"
                            )
                            IconButton(
                                onClick = { viewModel.toggleFavorite() },
                                modifier = Modifier
                                    .size(48.dp)
                                    .scale(favScale)
                            ) {
                                Icon(
                                    imageVector = if (isFavorite) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                                    contentDescription = "Favorite",
                                    tint = if (isFavorite) MusicAccent else Color.White,
                                    modifier = Modifier.size(32.dp)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(Dimens.PaddingLarge))

                    // Progress Bar
                    PlaybackProgress(viewModel)

                    Spacer(modifier = Modifier.height(Dimens.PaddingLarge))

                    // Playback Controls (Transport Row)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = { viewModel.toggleShuffle() }) {
                            Icon(
                                imageVector = Icons.Filled.Shuffle,
                                contentDescription = "Shuffle",
                                tint = if (shuffleMode) MusicAccent else Color.White.copy(alpha = 0.5f),
                                modifier = Modifier.size(Dimens.IconMedium)
                            )
                        }
                        
                        IconButton(onClick = { viewModel.skipPrevious() }) {
                            Icon(
                                imageVector = Icons.Filled.SkipPrevious, 
                                contentDescription = "Previous", 
                                modifier = Modifier.size(44.dp),
                                tint = Color.White
                            )
                        }
                        
                        // Large white filled circular play/pause button (center) with spring micro-animation
                        val playButtonScale by androidx.compose.animation.core.animateFloatAsState(
                            targetValue = if (isPlaying) 1.04f else 1.0f,
                            animationSpec = androidx.compose.animation.core.spring(dampingRatio = 0.45f, stiffness = 350f),
                            label = "play_btn_scale"
                        )
                        Surface(
                            onClick = { viewModel.togglePlayPause() },
                            shape = CircleShape,
                            color = Color.White,
                            modifier = Modifier
                                .size(72.dp)
                                .scale(playButtonScale)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = if (isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                                    contentDescription = if (isPlaying) "Pause" else "Play",
                                    tint = Color.Black,
                                    modifier = Modifier.size(40.dp)
                                )
                            }
                        }
                        
                        IconButton(onClick = { viewModel.skipNext() }) {
                            Icon(
                                imageVector = Icons.Filled.SkipNext, 
                                contentDescription = "Next", 
                                modifier = Modifier.size(44.dp),
                                tint = Color.White
                            )
                        }

                        IconButton(onClick = { viewModel.toggleRepeat() }) {
                            Icon(
                                imageVector = when (repeatMode) {
                                    androidx.media3.common.Player.REPEAT_MODE_ONE -> Icons.Filled.RepeatOne
                                    else -> Icons.Filled.Repeat
                                },
                                contentDescription = "Repeat",
                                tint = if (repeatMode != androidx.media3.common.Player.REPEAT_MODE_OFF) MusicAccent else Color.White.copy(alpha = 0.5f),
                                modifier = Modifier.size(Dimens.IconMedium)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.weight(1f))

                    // Bottom Utility Row
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = Dimens.PaddingExtraLarge),
                        horizontalArrangement = Arrangement.SpaceEvenly,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = { showQueueSheet = true }) {
                            Icon(Icons.AutoMirrored.Filled.QueueMusic, contentDescription = "Queue", tint = Color.White.copy(alpha = 0.7f))
                        }
                        IconButton(onClick = { showLyrics = true }) {
                            Icon(Icons.Filled.Lyrics, contentDescription = "Lyrics", tint = Color.White.copy(alpha = 0.7f))
                        }
                        IconButton(onClick = { viewModel.downloadSong() }) {
                            Icon(
                                imageVector = if (isDownloaded) Icons.Filled.DownloadDone else Icons.Filled.Download,
                                contentDescription = "Download",
                                tint = if (isDownloaded) MusicAccent else Color.White.copy(alpha = 0.7f)
                            )
                        }
                        IconButton(onClick = { showSleepTimerDialog = true }) {
                            Icon(
                                imageVector = Icons.Filled.Timer,
                                contentDescription = "Sleep Timer",
                                tint = if (sleepTimerRemaining != null) MusicAccent else Color.White.copy(alpha = 0.7f)
                            )
                        }
                        IconButton(onClick = { showSpeedDialog = true }) {
                            Icon(
                                imageVector = Icons.Filled.Speed,
                                contentDescription = "Playback Speed",
                                tint = if (playbackSpeed != 1.0f) MusicAccent else Color.White.copy(alpha = 0.7f)
                            )
                        }
                    }
                }
            }

            if (showQueueSheet) {
                QueueBottomSheet(
                    queue = viewModel.queue.collectAsState().value,
                    currentSongId = song.id,
                    onDismiss = { showQueueSheet = false },
                    onItemClick = { index -> 
                        viewModel.playQueueItem(index)
                        showQueueSheet = false
                    },
                    onRemove = { viewModel.removeFromQueue(it) },
                    onClear = { viewModel.clearQueue() }
                )
            }

            if (showSongMenu) {
                val context = androidx.compose.ui.platform.LocalContext.current
                SongContextMenu(
                    song = song,
                    onDismiss = { showSongMenu = false },
                    onPlayNext = { viewModel.playNext(song); showSongMenu = false },
                    onAddToQueue = { viewModel.addToQueue(song); showSongMenu = false },
                    onAddToPlaylist = { showPlaylistDialog = true; showSongMenu = false },
                    onStartRadio = { viewModel.startRadio(song); showSongMenu = false },
                    onGoToArtist = {
                        showSongMenu = false
                        onCollapse()
                        val artistQuery = song.artists.split(",", "&", "feat.", "ft.").firstOrNull()?.trim() ?: song.artists
                        onNavigateToArtist(artistQuery)
                    },
                    onGoToAlbum = if (song.album.isNotBlank()) {
                        {
                            showSongMenu = false
                            onCollapse()
                            onNavigateToAlbum(song.album)
                        }
                    } else null,
                    onQualityClick = { showQualityDialog = true; showSongMenu = false },
                    onEqualizerClick = {
                        showSongMenu = false
                        onCollapse()
                        onEqualizerClick()
                    },
                    onLike = { viewModel.toggleFavorite(); showSongMenu = false },
                    onShare = {
                        viewModel.shareSong(context)
                        showSongMenu = false
                    },
                    onShareStory = {
                        showStoryShareDialog = true
                        showSongMenu = false
                    }
                )
            }

            if (showStoryShareDialog) {
                val currentLyricLine = lyrics?.lines()?.firstOrNull { it.isNotBlank() }
                StoryShareDialog(
                    song = song,
                    currentLyric = currentLyricLine,
                    onDismiss = { showStoryShareDialog = false }
                )
            }

            if (showQualityDialog) {
                AudioQualityDialog(
                    currentQuality = audioQuality,
                    onDismiss = { showQualityDialog = false },
                    onQualitySelected = { viewModel.updateAudioQuality(it) }
                )
            }

            if (showSpeedDialog) {
                AlertDialog(
                    onDismissRequest = { showSpeedDialog = false },
                    title = { Text("Playback Speed", color = Color.White) },
                    text = {
                        Column {
                            listOf(0.5f, 0.75f, 1.0f, 1.25f, 1.5f, 2.0f).forEach { speed ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { 
                                            viewModel.setPlaybackSpeed(speed)
                                            showSpeedDialog = false 
                                        }
                                        .padding(vertical = Dimens.PaddingLarge),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    RadioButton(
                                        selected = playbackSpeed == speed,
                                        onClick = null,
                                        colors = RadioButtonDefaults.colors(selectedColor = MusicAccent)
                                    )
                                    Spacer(modifier = Modifier.width(Dimens.PaddingLarge))
                                    Text("${speed}x", color = Color.White)
                                }
                            }
                        }
                    },
                    confirmButton = {
                        TextButton(onClick = { showSpeedDialog = false }) { Text("Close", color = Secondary) }
                    }
                )
            }

            if (showSleepTimerDialog) {
                AlertDialog(
                    onDismissRequest = { showSleepTimerDialog = false },
                    title = { Text("Sleep Timer", color = Color.White) },
                    text = {
                        Column {
                            if (sleepTimerRemaining != null) {
                                Text(
                                    "Timer active: ${sleepTimerRemaining!! / 60000} minutes remaining",
                                    color = MusicAccent,
                                    modifier = Modifier.padding(bottom = Dimens.PaddingLarge)
                                )
                                Button(
                                    onClick = { 
                                        viewModel.setSleepTimer(0)
                                        showSleepTimerDialog = false 
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = Color.Red.copy(alpha = 0.8f))
                                ) {
                                    Text("Cancel Timer")
                                }
                                Spacer(modifier = Modifier.height(Dimens.PaddingLarge))
                            }
                            
                            listOf(5, 10, 15, 30, 45, 60).forEach { mins ->
                                Text(
                                    text = "$mins minutes",
                                    color = Color.White,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { 
                                            viewModel.setSleepTimer(mins)
                                            showSleepTimerDialog = false 
                                        }
                                        .padding(vertical = Dimens.PaddingLarge)
                                )
                            }
                        }
                    },
                    confirmButton = {
                        TextButton(onClick = { showSleepTimerDialog = false }) { Text("Close", color = Secondary) }
                    }
                )
            }
            
            if (showPlaylistDialog) {
                PlaylistSelectionDialog(
                    playlists = playlists,
                    onDismiss = { showPlaylistDialog = false },
                    onPlaylistSelected = { playlistId ->
                        viewModel.addToPlaylist(playlistId)
                        showPlaylistDialog = false
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
}

@Composable
fun LyricsView(
    songName: String,
    artistName: String,
    viewModel: PlayerViewModel,
    onEqualizerClick: () -> Unit = {},
    onQualityClick: () -> Unit = {},
    onBack: () -> Unit
) {
    val currentSong by viewModel.currentSong.collectAsState()
    val isPlaying by viewModel.isPlaying.collectAsState()
    val shuffleMode by viewModel.shuffleMode.collectAsState()
    val repeatMode by viewModel.repeatMode.collectAsState()
    val lyricsData by viewModel.lyricsData.collectAsState()
    val parsedLrcLines by viewModel.parsedLrcLines.collectAsState()
    val activeLyricIndex by viewModel.activeLyricIndex.collectAsState()
    val isLyricsLoading by viewModel.isLyricsLoading.collectAsState()

    var lyricFontSizeMultiplier by remember { mutableFloatStateOf(1.0f) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 20.dp)
        ) {
            // Header (Image 3)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = onBack,
                    modifier = Modifier.size(36.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.KeyboardArrowDown,
                        contentDescription = "Collapse",
                        tint = MaterialTheme.colorScheme.onBackground,
                        modifier = Modifier.size(24.dp)
                    )
                }

                Spacer(modifier = Modifier.weight(1f))

                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = songName,
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 15.sp
                        ),
                        color = MaterialTheme.colorScheme.onBackground,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (parsedLrcLines.isNotEmpty()) {
                        Text(
                            text = "Synced by LRCLIB",
                            style = MaterialTheme.typography.bodySmall.copy(
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp
                            ),
                            color = MusicRed
                        )
                    }
                }

                Spacer(modifier = Modifier.weight(1f))
                Spacer(modifier = Modifier.size(36.dp))
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Flowing Synchronized Lyrics Content
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
            ) {
                LyricsContent(
                    lyricsData = lyricsData,
                    parsedLrcLines = parsedLrcLines,
                    activeLyricIndex = activeLyricIndex,
                    isLoading = isLyricsLoading,
                    songName = songName,
                    fontSizeMultiplier = lyricFontSizeMultiplier,
                    onSeekToLyric = { viewModel.seekToLyric(it) },
                    onRetry = {
                        currentSong?.let { viewModel.fetchLyrics(it, force = true) }
                    }
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Playback Progress Slider
            PlaybackProgress(viewModel)

            Spacer(modifier = Modifier.height(12.dp))

            // Player Controls Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = { viewModel.toggleShuffle() }) {
                    Icon(
                        imageVector = Icons.Default.Shuffle,
                        contentDescription = "Shuffle",
                        tint = if (shuffleMode) MusicRed else Secondary,
                        modifier = Modifier.size(22.dp)
                    )
                }

                IconButton(onClick = { viewModel.skipPrevious() }) {
                    Icon(
                        imageVector = Icons.Default.SkipPrevious,
                        contentDescription = "Previous",
                        tint = MaterialTheme.colorScheme.onBackground,
                        modifier = Modifier.size(32.dp)
                    )
                }

                Surface(
                    modifier = Modifier
                        .size(64.dp)
                        .clickable { viewModel.togglePlayPause() },
                    shape = CircleShape,
                    color = MaterialTheme.colorScheme.onBackground
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                            contentDescription = "Play/Pause",
                            tint = MaterialTheme.colorScheme.background,
                            modifier = Modifier.size(32.dp)
                        )
                    }
                }

                IconButton(onClick = { viewModel.skipNext() }) {
                    Icon(
                        imageVector = Icons.Default.SkipNext,
                        contentDescription = "Next",
                        tint = MaterialTheme.colorScheme.onBackground,
                        modifier = Modifier.size(32.dp)
                    )
                }

                IconButton(onClick = { viewModel.toggleRepeat() }) {
                    Icon(
                        imageVector = if (repeatMode == 1) Icons.Default.RepeatOne else Icons.Default.Repeat,
                        contentDescription = "Repeat",
                        tint = if (repeatMode > 0) MusicRed else Secondary,
                        modifier = Modifier.size(22.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Bottom Functional Utility Icons (Equalizer, Tt Font Scaler, Quality/Devices)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onEqualizerClick) {
                    Icon(
                        imageVector = Icons.Default.Equalizer,
                        contentDescription = "Equalizer",
                        tint = MusicRed,
                        modifier = Modifier.size(22.dp)
                    )
                }

                // Interactive 'Tt' Font Size Switcher (Normal -> Large -> XL)
                Surface(
                    modifier = Modifier
                        .clip(RoundedCornerShape(14.dp))
                        .clickable {
                            lyricFontSizeMultiplier = when (lyricFontSizeMultiplier) {
                                1.0f -> 1.25f
                                1.25f -> 1.5f
                                else -> 1.0f
                            }
                        },
                    shape = RoundedCornerShape(14.dp),
                    color = MaterialTheme.colorScheme.surface,
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.onSurface.copy(alpha = 0.12f))
                ) {
                    Text(
                        text = if (lyricFontSizeMultiplier > 1.25f) "Tt (XL)" else if (lyricFontSizeMultiplier > 1.0f) "Tt (L)" else "Tt",
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        ),
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp)
                    )
                }

                IconButton(onClick = onQualityClick) {
                    Icon(
                        imageVector = Icons.Default.HighQuality,
                        contentDescription = "Audio Quality & Output",
                        tint = MusicAccent,
                        modifier = Modifier.size(22.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun LyricsContent(
    lyricsData: com.example.musicflow.data.model.LyricsData?,
    parsedLrcLines: List<com.example.musicflow.data.model.LrcLine>,
    activeLyricIndex: Int,
    isLoading: Boolean,
    songName: String,
    fontSizeMultiplier: Float = 1.0f,
    onSeekToLyric: (Long) -> Unit,
    onRetry: () -> Unit
) {
    if (isLoading) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                CircularProgressIndicator(
                    color = MusicRed,
                    strokeWidth = 2.5.dp,
                    modifier = Modifier.size(32.dp)
                )
                Text(
                    text = "Searching lyrics on LRCLIB...",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Secondary
                )
            }
        }
        return
    }

    if (parsedLrcLines.isNotEmpty()) {
        val listState = androidx.compose.foundation.lazy.rememberLazyListState()

        LaunchedEffect(activeLyricIndex) {
            if (activeLyricIndex >= 0) {
                val scrollIndex = (activeLyricIndex - 2).coerceAtLeast(0)
                listState.animateScrollToItem(scrollIndex)
            }
        }

        LazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(vertical = 40.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            itemsIndexed(parsedLrcLines, key = { idx, line -> "${line.timeMs}_$idx" }) { index, line ->
                val isCurrent = index == activeLyricIndex
                val isPast = index < activeLyricIndex

                val baseSize = if (isCurrent) 22f else 17f
                val targetFontSize = baseSize * fontSizeMultiplier

                val fontSize by androidx.compose.animation.core.animateFloatAsState(
                    targetValue = targetFontSize,
                    label = "lyric_font_size"
                )
                val alpha by androidx.compose.animation.core.animateFloatAsState(
                    targetValue = if (isCurrent) 1.0f else if (isPast) 0.45f else 0.25f,
                    label = "lyric_alpha"
                )

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .clickable { onSeekToLyric(line.timeMs) }
                        .padding(vertical = 6.dp, horizontal = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (isCurrent) {
                        Box(
                            modifier = Modifier
                                .width(3.dp)
                                .height((22 * fontSizeMultiplier).dp)
                                .background(MusicRed, RoundedCornerShape(2.dp))
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                    }
                    Text(
                        text = line.text,
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Medium,
                            fontSize = fontSize.sp,
                            lineHeight = (fontSize * 1.4f).sp
                        ),
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = alpha)
                    )
                }
            }
        }
    } else {
        val plain = lyricsData?.plainLyrics
        if (!plain.isNullOrBlank()) {
            val scrollState = rememberScrollState()
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(scrollState)
                    .padding(vertical = 24.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    plain.lines().forEach { line ->
                        if (line.isNotBlank()) {
                            Text(
                                text = line,
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontWeight = FontWeight.Medium,
                                    fontSize = (18 * fontSizeMultiplier).sp,
                                    lineHeight = (28 * fontSizeMultiplier).sp
                                ),
                                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.85f)
                            )
                        } else {
                            Spacer(modifier = Modifier.height(10.dp))
                        }
                    }
                }
            }
        } else {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    modifier = Modifier.padding(horizontal = 24.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.MusicNote,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.2f),
                        modifier = Modifier.size(56.dp)
                    )
                    Text(
                        text = "No lyrics found for \"$songName\"",
                        style = MaterialTheme.typography.titleMedium,
                        color = Secondary,
                        textAlign = TextAlign.Center
                    )
                    OutlinedButton(
                        onClick = onRetry,
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.onBackground.copy(alpha = 0.15f)),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Retry", color = MaterialTheme.colorScheme.onBackground)
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QueueBottomSheet(
    queue: List<com.example.musicflow.data.model.Song>,
    currentSongId: String,
    onDismiss: () -> Unit,
    onItemClick: (Int) -> Unit,
    onRemove: (Int) -> Unit,
    onClear: () -> Unit
) {
    val currentSong = queue.find { it.id == currentSongId } ?: queue.firstOrNull()
    val upcomingQueue = queue.filter { it.id != currentSongId }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = BackgroundDark,
        dragHandle = { BottomSheetDefaults.DragHandle(color = Color.White.copy(alpha = 0.1f)) }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 32.dp)
        ) {
            // Header: Now Playing (Image 3 - Left phone)
            Text(
                text = "Now playing",
                style = MaterialTheme.typography.titleMedium.copy(
                    fontWeight = FontWeight.Medium,
                    fontSize = 13.sp
                ),
                color = Secondary,
                modifier = Modifier.padding(bottom = 8.dp)
            )

            // Current Playing Song Card
            currentSong?.let { song ->
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(18.dp),
                    color = SurfaceDark,
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.06f))
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(48.dp)
                                .clip(RoundedCornerShape(10.dp))
                        ) {
                            AsyncImage(
                                model = song.image,
                                contentDescription = song.name,
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.Crop
                            )
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(Color.Black.copy(alpha = 0.45f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Pause,
                                    contentDescription = "Playing",
                                    tint = Color.White,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.width(14.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = song.name,
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
                                text = song.artists,
                                style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp),
                                color = Secondary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }

                        Icon(
                            imageVector = Icons.Default.Check,
                            contentDescription = "Active",
                            tint = MusicRed,
                            modifier = Modifier.size(22.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Section: Next
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Next",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Medium,
                        fontSize = 13.sp
                    ),
                    color = Secondary
                )
                TextButton(onClick = onClear) {
                    Text("Clear", color = MusicRed, fontSize = 13.sp)
                }
            }

            LazyColumn(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                itemsIndexed(upcomingQueue, key = { idx, s -> "queue_${s.id}_$idx" }) { index, song ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onItemClick(index + 1) }
                            .padding(vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        AsyncImage(
                            model = song.image,
                            contentDescription = song.name,
                            modifier = Modifier
                                .size(46.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(SurfaceDark),
                            contentScale = ContentScale.Crop
                        )

                        Spacer(modifier = Modifier.width(14.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = song.name,
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontWeight = FontWeight.SemiBold,
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
                                color = Secondary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }

                        IconButton(
                            onClick = { onRemove(index + 1) },
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Add,
                                contentDescription = "Add/Remove",
                                tint = Secondary,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun PlaybackProgress(viewModel: PlayerViewModel) {
    val position by viewModel.currentPosition.collectAsState()
    val duration by viewModel.duration.collectAsState()
    var isDragging by remember { mutableStateOf(false) }
    var dragPosition by remember { mutableFloatStateOf(0f) }

    val currentFraction = if (isDragging) dragPosition else if (duration > 0) position.toFloat() / duration.toFloat() else 0f

    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp)) {
        Slider(
            value = currentFraction.coerceIn(0f, 1f),
            onValueChange = {
                isDragging = true
                dragPosition = it
            },
            onValueChangeFinished = {
                viewModel.seekTo((dragPosition * duration).toLong())
                isDragging = false
            },
            colors = SliderDefaults.colors(
                thumbColor = com.example.musicflow.ui.theme.MusicAccent,
                activeTrackColor = com.example.musicflow.ui.theme.MusicAccent,
                inactiveTrackColor = Color.White.copy(alpha = 0.15f)
            ),
            modifier = Modifier.fillMaxWidth()
        )
        
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = formatTime(if (isDragging) (dragPosition * duration).toLong() else position),
                style = MaterialTheme.typography.bodySmall.copy(
                    fontWeight = FontWeight.Medium,
                    fontSize = 12.sp
                ),
                color = Color.White.copy(alpha = 0.75f)
            )
            Text(
                text = formatTime(duration),
                style = MaterialTheme.typography.bodySmall.copy(
                    fontWeight = FontWeight.Medium,
                    fontSize = 12.sp
                ),
                color = Color.White.copy(alpha = 0.75f)
            )
        }
    }
}

private fun formatTime(millis: Long): String {
    val seconds = (millis / 1000) % 60
    val minutes = (millis / (1000 * 60)) % 60
    return "%d:%02d".format(minutes, seconds)
}
