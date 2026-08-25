package com.example.musicflow.ui.player

import androidx.compose.animation.animateColorAsState
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
    onCollapse: () -> Unit
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

    var showQueueSheet by remember { mutableStateOf(false) }
    var showLyrics by remember { mutableStateOf(false) }
    var showSongMenu by remember { mutableStateOf(false) }
    var showSpeedDialog by remember { mutableStateOf(false) }
    var showSleepTimerDialog by remember { mutableStateOf(false) }
    var showPlaylistDialog by remember { mutableStateOf(false) }
    var showCreatePlaylistDialog by remember { mutableStateOf(false) }
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
                    lyrics = lyrics,
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

                    Spacer(modifier = Modifier.weight(1f))

                    // Large Album Artwork
                    AsyncImage(
                        model = song.image,
                        contentDescription = "Album Artwork",
                        modifier = Modifier
                            .fillMaxWidth(0.95f)
                            .aspectRatio(1f)
                            .clip(RoundedCornerShape(Dimens.RadiusExtraLarge)),
                        contentScale = ContentScale.Crop
                    )

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
                                    color = Secondary,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                            IconButton(
                                onClick = { viewModel.toggleFavorite() },
                                modifier = Modifier.size(48.dp)
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
                        
                        // Large white filled circular play/pause button (center)
                        Surface(
                            onClick = { viewModel.togglePlayPause() },
                            shape = CircleShape,
                            color = Color.White,
                            modifier = Modifier.size(72.dp)
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
                    onLike = { viewModel.toggleFavorite(); showSongMenu = false },
                    onShare = {
                        viewModel.shareSong(context)
                        showSongMenu = false
                    }
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
    lyrics: String?,
    onBack: () -> Unit
) {
    val glassEnabled = com.example.musicflow.ui.components.LocalGlassEffects.current
    
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark.copy(alpha = 0.95f))
            .statusBarsPadding()
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = Dimens.ScreenPadding)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = Dimens.PaddingLarge),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = onBack,
                    modifier = Modifier.background(Color.White.copy(alpha = 0.05f), CircleShape)
                ) {
                    Icon(Icons.Default.KeyboardArrowDown, contentDescription = "Back", tint = Color.White)
                }
                Column(modifier = Modifier.padding(start = Dimens.PaddingLarge)) {
                    Text(text = songName, style = MaterialTheme.typography.titleLarge, color = Color.White, maxLines = 1)
                    Text(text = artistName, style = MaterialTheme.typography.bodyMedium, color = Secondary, maxLines = 1)
                }
            }
            
            Spacer(modifier = Modifier.height(Dimens.PaddingLarge))
            
            Box(modifier = Modifier.weight(1f)) {
                LyricsContent(lyrics)
            }
        }
    }
}

@Composable
fun LyricsContent(lyrics: String?) {
    val scrollState = rememberScrollState()
    
    Box(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(vertical = Dimens.PaddingTripleExtraLarge)
    ) {
        Text(
            text = lyrics ?: "Lyrics are not available for this song.",
            style = MaterialTheme.typography.displayMedium.copy(
                fontWeight = FontWeight.Bold,
                lineHeight = 44.sp,
                color = if (lyrics != null) Color.White else Secondary
            ),
            modifier = Modifier.alpha(if (lyrics != null) 1f else 0.5f)
        )
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
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = SurfaceDark,
        dragHandle = { BottomSheetDefaults.DragHandle(color = Color.White.copy(alpha = 0.1f)) }
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(bottom = 32.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = Dimens.ScreenPadding, vertical = Dimens.PaddingLarge),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "Up Next",
                    style = MaterialTheme.typography.displaySmall,
                    color = Color.White
                )
                TextButton(onClick = onClear) {
                    Text("Clear Queue", color = MusicAccent)
                }
            }
            
            LazyColumn(modifier = Modifier.fillMaxWidth()) {
                itemsIndexed(queue, key = { _, s -> s.id }) { index, song ->
                    val isCurrent = song.id == currentSongId
                    MFListRow(
                        title = song.name,
                        subtitle = song.artists,
                        imageUrl = song.image,
                        leadingContent = {
                            if (isCurrent) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.VolumeUp, 
                                    contentDescription = "Playing", 
                                    tint = MusicAccent, 
                                    modifier = Modifier.size(20.dp)
                                )
                            } else {
                                Text(
                                    text = (index + 1).toString(),
                                    style = MaterialTheme.typography.labelMedium,
                                    color = Secondary,
                                    modifier = Modifier.width(20.dp),
                                    textAlign = TextAlign.Center
                                )
                            }
                        },
                        trailingIcon = if (isCurrent) Icons.Default.MoreVert else Icons.Default.RemoveCircleOutline,
                        onTrailingClick = { if (!isCurrent) onRemove(index) },
                        onClick = { onItemClick(index) }
                    )
                }
            }
        }
    }
}

@Composable
fun PlaybackProgress(viewModel: PlayerViewModel) {
    val position by viewModel.currentPosition.collectAsState()
    val duration by viewModel.duration.collectAsState()
    
    val progress by remember {
        derivedStateOf {
            if (duration > 0) position.toFloat() / duration.toFloat() else 0f
        }
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        Slider(
            value = progress,
            onValueChange = { viewModel.seekTo((it * duration).toLong()) },
            colors = SliderDefaults.colors(
                thumbColor = com.example.musicflow.ui.theme.MusicAccent,
                activeTrackColor = com.example.musicflow.ui.theme.MusicAccent,
                inactiveTrackColor = Color.White.copy(alpha = 0.1f)
            ),
            modifier = Modifier.height(4.dp)
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = formatTime(position),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = formatTime(duration),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

private fun formatTime(millis: Long): String {
    val seconds = (millis / 1000) % 60
    val minutes = (millis / (1000 * 60)) % 60
    return "%d:%02d".format(minutes, seconds)
}
