package com.example.musicflow.ui.navigation

import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.example.musicflow.data.model.Song
import com.example.musicflow.ui.library.LibraryScreen
import com.example.musicflow.ui.library.LibraryViewModel
import com.example.musicflow.ui.library.PlaylistDetailScreen
import com.example.musicflow.ui.profile.ProfileScreen
import com.example.musicflow.ui.profile.ProfileViewModel
import com.example.musicflow.ui.home.HomeScreen
import com.example.musicflow.ui.home.HomeViewModel
import com.example.musicflow.ui.search.SearchScreen
import com.example.musicflow.ui.search.SearchViewModel

@Composable
fun NavGraph(
    navController: NavHostController,
    homeViewModel: HomeViewModel,
    searchViewModel: SearchViewModel,
    libraryViewModel: LibraryViewModel,
    profileViewModel: ProfileViewModel,
    albumViewModel: com.example.musicflow.ui.album.AlbumViewModel,
    artistViewModel: com.example.musicflow.ui.artist.ArtistViewModel,
    onSongClick: (Song) -> Unit,
    onSongIdClick: (String) -> Unit = {},
    onLogout: () -> Unit = {},
    bottomPadding: androidx.compose.ui.unit.Dp,
    modifier: Modifier = Modifier
) {
    NavHost(
        navController = navController,
        startDestination = "home",
        modifier = modifier,
        enterTransition = { fadeIn(tween(200)) },
        exitTransition = { fadeOut(tween(150)) },
        popEnterTransition = { fadeIn(tween(200)) },
        popExitTransition = { fadeOut(tween(150)) }
    ) {
        composable("home") {
            HomeScreen(
                viewModel = homeViewModel,
                onSongClick = onSongClick,
                onAlbumClick = { navController.navigate("album/${java.net.URLEncoder.encode(it, "UTF-8")}") },
                onArtistClick = { navController.navigate("artist/${java.net.URLEncoder.encode(it, "UTF-8")}") },
                onProfileClick = { navController.navigate("profile") },
                onSettingsClick = { navController.navigate("settings") },
                onNavigate = { route ->
                    when (route) {
                        "recommend_more" -> navController.navigate("songs_list/Recommend")
                        "new_releases" -> navController.navigate("songs_list/New for you")
                        "charts" -> navController.navigate("songs_list/Trending Now")
                        "albums" -> navController.navigate("search")
                        else -> {
                            try { navController.navigate(route) } catch (e: Exception) { /* safe fallback */ }
                        }
                    }
                },
                bottomPadding = bottomPadding
            )
        }
        composable("explore") {
            com.example.musicflow.ui.explore.ExploreScreen(
                viewModel = homeViewModel,
                onSongClick = onSongClick,
                onNavigate = { route ->
                    when (route) {
                        "recommend_more" -> navController.navigate("songs_list/Recommend")
                        "new_releases" -> navController.navigate("songs_list/New for you")
                        "charts" -> navController.navigate("songs_list/Trending Now")
                        else -> {
                            try { navController.navigate(route) } catch (e: Exception) { /* safe fallback */ }
                        }
                    }
                },
                bottomPadding = bottomPadding
            )
        }
        composable("search") {
            SearchScreen(
                viewModel = searchViewModel,
                onSongClick = { song -> onSongIdClick(song.id) },
                onAlbumClick = { navController.navigate("album/$it") },
                onArtistClick = { navController.navigate("artist/$it") },
                bottomPadding = bottomPadding
            )
        }
        composable("library") {
            LibraryScreen(
                viewModel = libraryViewModel,
                onSongClick = onSongClick,
                onPlaylistClick = { navController.navigate("playlist/$it") },
                bottomPadding = bottomPadding
            )
        }
        composable("profile") {
            ProfileScreen(
                viewModel = profileViewModel,
                onBack = { navController.popBackStack() },
                onSettingsClick = { navController.navigate("settings") },
                onSongClick = onSongClick,
                onPlaylistClick = { navController.navigate("playlist/$it") },
                onArtistClick = { navController.navigate("artist/$it") },
                onAlbumClick = { navController.navigate("album/$it") },
                bottomPadding = bottomPadding
            )
        }
        composable("settings") {
            com.example.musicflow.ui.profile.SettingsScreen(
                viewModel = profileViewModel,
                onBack = { navController.popBackStack() },
                onEqualizerClick = { navController.navigate("equalizer") },
                onRestartOnboarding = onLogout,
                bottomPadding = bottomPadding
            )
        }
        composable("equalizer") {
            com.example.musicflow.ui.equalizer.EqualizerScreen(
                onBack = { navController.popBackStack() },
                bottomPadding = bottomPadding
            )
        }
        composable("playlist/{playlistId}") { backStackEntry ->
            val playlistId = backStackEntry.arguments?.getString("playlistId") ?: ""
            PlaylistDetailScreen(
                playlistId = playlistId,
                viewModel = libraryViewModel,
                onSongClick = onSongClick,
                onBack = { navController.popBackStack() },
                bottomPadding = bottomPadding
            )
        }
        composable("album/{albumId}") { backStackEntry ->
            val albumId = backStackEntry.arguments?.getString("albumId") ?: ""
            com.example.musicflow.ui.album.AlbumScreen(
                albumId = albumId,
                viewModel = albumViewModel,
                onBack = { navController.popBackStack() },
                onSongClick = onSongClick,
                bottomPadding = bottomPadding
            )
        }
        composable("songs_list/{title}") { backStackEntry ->
            val rawTitle = backStackEntry.arguments?.getString("title") ?: "Songs"
            val title = try { java.net.URLDecoder.decode(rawTitle, "UTF-8") } catch (e: Exception) { rawTitle }
            val songs by when {
                title == "New for you" -> homeViewModel.newReleases.collectAsState()
                title == "New songs" || title == "Trending Now" -> homeViewModel.trendingSongs.collectAsState()
                title == "Recommend" -> homeViewModel.recommendations.collectAsState()
                title.startsWith("Top tracks") -> artistViewModel.topSongs.collectAsState()
                else -> homeViewModel.recommendations.collectAsState()
            }
            val playlists by homeViewModel.playlists.collectAsState()
            
            com.example.musicflow.ui.components.SongsListScreen(
                title = title,
                songs = songs,
                playlists = playlists,
                onBack = { navController.popBackStack() },
                onSongClick = onSongClick,
                onPlayNext = { homeViewModel.playNext(it) },
                onAddToQueue = { homeViewModel.addToQueue(it) },
                onAddToPlaylist = { pId, song -> homeViewModel.addToPlaylist(pId, song) },
                onStartRadio = { homeViewModel.startRadio(it) },
                onToggleLike = { homeViewModel.toggleFavorite(it) },
                onCreatePlaylist = { homeViewModel.createPlaylist(it) },
                bottomPadding = bottomPadding
            )
        }
        composable("artist/{artistId}") { backStackEntry ->
            val rawId = backStackEntry.arguments?.getString("artistId") ?: ""
            val artistId = try { java.net.URLDecoder.decode(rawId, "UTF-8") } catch (e: Exception) { rawId }
            com.example.musicflow.ui.artist.ArtistScreen(
                artistId = artistId,
                viewModel = artistViewModel,
                onBack = { navController.popBackStack() },
                onSongClick = onSongClick,
                onAlbumClick = { navController.navigate("album/${java.net.URLEncoder.encode(it, "UTF-8")}") },
                onArtistClick = { navController.navigate("artist/${java.net.URLEncoder.encode(it, "UTF-8")}") },
                onTopTracksClick = { navController.navigate("songs_list/${java.net.URLEncoder.encode("Top tracks - $it", "UTF-8")}") },
                bottomPadding = bottomPadding
            )
        }
    }
}
