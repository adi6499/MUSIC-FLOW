package com.example.musicflow.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.musicflow.data.model.Song
import com.example.musicflow.ui.theme.*

@Composable
fun MFCard(
    title: String,
    subtitle: String,
    imageUrl: String?,
    modifier: Modifier = Modifier,
    showPlayButton: Boolean = false,
    onClick: () -> Unit
) {
    Column(
        modifier = modifier
            .width(160.dp)
            .clickable(onClick = onClick)
    ) {
        Box(
            modifier = Modifier
                .aspectRatio(1f)
                .clip(RoundedCornerShape(Dimens.RadiusLarge))
                .background(SurfaceVariantDark)
        ) {
            AsyncImage(
                model = imageUrl,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )
            
            if (showPlayButton) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.2f))
                )
                
                Surface(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(Dimens.PaddingSmall)
                        .size(36.dp),
                    shape = CircleShape,
                    color = Color.White
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.Default.PlayArrow,
                            contentDescription = null,
                            tint = Color.Black,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
        }
        Spacer(modifier = Modifier.height(Dimens.PaddingSmall))
        Text(
            text = title,
            style = MaterialTheme.typography.titleLarge,
            color = Color.White,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        Text(
            text = subtitle,
            style = MaterialTheme.typography.bodyMedium,
            color = Secondary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
fun MFListRow(
    title: String,
    subtitle: String,
    imageUrl: String?,
    modifier: Modifier = Modifier,
    leadingContent: (@Composable () -> Unit)? = null,
    trailingIcon: ImageVector = Icons.Default.MoreVert,
    onTrailingClick: () -> Unit = {},
    onClick: () -> Unit
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(72.dp)
            .clickable(onClick = onClick)
            .padding(horizontal = Dimens.ScreenPadding),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (leadingContent != null) {
            Box(modifier = Modifier.width(32.dp), contentAlignment = Alignment.CenterStart) {
                leadingContent()
            }
            Spacer(modifier = Modifier.width(Dimens.PaddingSmall))
        }

        AsyncImage(
            model = imageUrl,
            contentDescription = null,
            modifier = Modifier
                .size(56.dp)
                .clip(RoundedCornerShape(Dimens.RadiusMedium))
                .background(SurfaceVariantDark),
            contentScale = ContentScale.Crop
        )
        Spacer(modifier = Modifier.width(Dimens.PaddingLarge))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleLarge,
                color = Color.White,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodyMedium,
                color = Secondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        IconButton(onClick = onTrailingClick) {
            Icon(
                imageVector = trailingIcon,
                contentDescription = null,
                tint = Secondary,
                modifier = Modifier.size(24.dp)
            )
        }
    }
}

@Composable
fun MFPillButton(
    text: String,
    modifier: Modifier = Modifier,
    containerColor: Color = MusicAccent,
    contentColor: Color = Color.White,
    outlineOnly: Boolean = false,
    onClick: () -> Unit
) {
    if (outlineOnly) {
        OutlinedButton(
            onClick = onClick,
            modifier = modifier,
            shape = CircleShape,
            border = BorderStroke(0.5.dp, MaterialTheme.colorScheme.outline),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = contentColor)
        ) {
            Text(text = text, style = MaterialTheme.typography.labelLarge)
        }
    } else {
        Button(
            onClick = onClick,
            modifier = modifier,
            shape = CircleShape,
            colors = ButtonDefaults.buttonColors(
                containerColor = containerColor,
                contentColor = contentColor
            )
        ) {
            Text(text = text, style = MaterialTheme.typography.labelLarge)
        }
    }
}

@Composable
fun MFMatchBadge(
    matchPercentage: Int,
    modifier: Modifier = Modifier
) {
    val color = if (matchPercentage >= 80) MusicAccent else MaterialTheme.colorScheme.outline
    Surface(
        modifier = modifier,
        color = Color.Black.copy(alpha = 0.6f),
        shape = RoundedCornerShape(Dimens.RadiusSmall),
        border = BorderStroke(0.5.dp, color)
    ) {
        Text(
            text = "$matchPercentage% Match",
            style = MaterialTheme.typography.labelSmall,
            color = color,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
        )
    }
}

@Composable
fun MFSearchBar(
    query: String,
    onQueryChange: (String) -> Unit,
    placeholder: String = "Find music or podcasts",
    modifier: Modifier = Modifier,
    onClear: () -> Unit = { onQueryChange("") }
) {
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .height(48.dp),
        color = SurfaceDark,
        shape = CircleShape,
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f))
    ) {
        Row(
            modifier = Modifier.fillMaxSize().padding(horizontal = Dimens.PaddingLarge),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Search,
                contentDescription = null,
                tint = Secondary,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(Dimens.PaddingSmall))
            Box(modifier = Modifier.weight(1f)) {
                if (query.isEmpty()) {
                    Text(
                        text = placeholder,
                        style = MaterialTheme.typography.bodyLarge,
                        color = Secondary
                    )
                }
                BasicTextField(
                    value = query,
                    onValueChange = onQueryChange,
                    modifier = Modifier.fillMaxWidth(),
                    textStyle = MaterialTheme.typography.bodyLarge.copy(color = Color.White),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    cursorBrush = Brush.verticalGradient(listOf(MusicAccent, MusicAccent))
                )
            }
            if (query.isNotEmpty()) {
                IconButton(onClick = onClear) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Clear",
                        tint = Color.White,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SongContextMenu(
    song: Song,
    isLiked: Boolean = false,
    onDismiss: () -> Unit,
    onPlayNext: () -> Unit = {},
    onAddToQueue: () -> Unit = {},
    onAddToPlaylist: () -> Unit = {},
    onStartRadio: () -> Unit = {},
    onLike: () -> Unit = {},
    onShare: () -> Unit = {},
    onRemoveFromPlaylist: (() -> Unit)? = null
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = SurfaceDark,
        dragHandle = { BottomSheetDefaults.DragHandle(color = Color.White.copy(alpha = 0.1f)) }
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(bottom = 32.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(Dimens.ScreenPadding),
                verticalAlignment = Alignment.CenterVertically
            ) {
                AsyncImage(
                    model = song.image,
                    contentDescription = null,
                    modifier = Modifier.size(64.dp).clip(RoundedCornerShape(Dimens.RadiusMedium)),
                    contentScale = ContentScale.Crop
                )
                Spacer(modifier = Modifier.width(Dimens.PaddingLarge))
                Column {
                    Text(text = song.name, style = MaterialTheme.typography.titleLarge, color = Color.White)
                    Text(text = song.artists, style = MaterialTheme.typography.bodyMedium, color = Secondary)
                }
            }
            
            HorizontalDivider(color = DividerColor, thickness = 0.5.dp)
            
            LazyColumn(modifier = Modifier.fillMaxWidth()) {
                item { ContextMenuItem(Icons.AutoMirrored.Filled.PlaylistPlay, "Play next", onPlayNext) }
                item { ContextMenuItem(Icons.AutoMirrored.Filled.QueueMusic, "Add to queue", onAddToQueue) }
                item { ContextMenuItem(Icons.Default.Radio, "Start Radio", onStartRadio) }
                item { ContextMenuItem(Icons.AutoMirrored.Filled.PlaylistAdd, "Add to playlist", onAddToPlaylist) }
                item { 
                    ContextMenuItem(
                        icon = if (isLiked) Icons.Default.Favorite else Icons.Default.FavoriteBorder, 
                        label = if (isLiked) "Unlike" else "Like", 
                        onLike
                    ) 
                }
                item { ContextMenuItem(Icons.Default.Share, "Share", onShare) }
                onRemoveFromPlaylist?.let {
                    item { ContextMenuItem(Icons.Default.Delete, "Remove from playlist", it) }
                }
            }
        }
    }
}

@Composable
fun PlaylistSelectionDialog(
    playlists: List<com.example.musicflow.data.local.PlaylistEntity>,
    onDismiss: () -> Unit,
    onPlaylistSelected: (String) -> Unit,
    onCreateNew: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = MaterialTheme.colorScheme.surface,
        title = { Text("Add to Playlist", color = Color.White) },
        text = {
            LazyColumn(modifier = Modifier.fillMaxWidth().heightIn(max = 400.dp)) {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth().height(56.dp).clickable(onClick = onCreateNew),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null, tint = MusicAccent)
                        Spacer(modifier = Modifier.width(16.dp))
                        Text("New Playlist", color = MusicAccent)
                    }
                }
                items(playlists) { playlist ->
                    Row(
                        modifier = Modifier.fillMaxWidth().height(56.dp).clickable { onPlaylistSelected(playlist.id) },
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(modifier = Modifier.size(40.dp).clip(RoundedCornerShape(Dimens.RadiusSmall)).background(Color.White.copy(alpha = 0.05f)))
                        Spacer(modifier = Modifier.width(16.dp))
                        Text(playlist.name, color = Color.White, maxLines = 1)
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel", color = Secondary) }
        }
    )
}

@Composable
private fun ContextMenuItem(icon: ImageVector, label: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(56.dp)
            .clickable(onClick = onClick)
            .padding(horizontal = Dimens.ScreenPadding),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(24.dp))
        Spacer(modifier = Modifier.width(16.dp))
        Text(text = label, style = MaterialTheme.typography.titleMedium, color = Color.White)
    }
}

@Composable
fun ExploreGenreCard(name: String, color: Color, modifier: Modifier = Modifier, onClick: () -> Unit = {}) {
    Surface(
        modifier = modifier
            .height(100.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(Dimens.RadiusLarge),
        color = color.copy(alpha = 0.8f)
    ) {
        Box(modifier = Modifier.padding(Dimens.PaddingLarge)) {
            Text(
                text = name,
                style = MaterialTheme.typography.titleLarge,
                color = Color.White,
                modifier = Modifier.align(Alignment.BottomStart)
            )
        }
    }
}
