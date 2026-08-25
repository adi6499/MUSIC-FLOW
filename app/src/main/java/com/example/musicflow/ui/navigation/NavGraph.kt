package com.example.musicflow.ui.navigation

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
    onLogout: () -> Unit = {},
    bottomPadding: androidx.compose.ui.unit.Dp,
    modifier: Modifier = Modifier
) {
    NavHost(
        navController = navController,
        startDestination = "home",
        modifier = modifier
    ) {
        composable("home") {
            HomeScreen(
                viewModel = homeViewModel,
                onSongClick = onSongClick,
                onAlbumClick = { navController.navigate("album/$it") },
                onArtistClick = { navController.navigate("artist/$it") },
                onProfileClick = { navController.navigate("profile") },
                onSettingsClick = { navController.navigate("settings") },
                onNavigate = { navController.navigate(it) },
                bottomPadding = bottomPadding
            )
        }
        composable("explore") {
            com.example.musicflow.ui.explore.ExploreScreen(
                viewModel = homeViewModel,
                onSongClick = onSongClick,
                onNavigate = { navController.navigate(it) },
                bottomPadding = bottomPadding
            )
        }
        composable("search") {
            SearchScreen(
                viewModel = searchViewModel,
                onSongClick = onSongClick,
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
                bottomPadding = bottomPadding
            )
        }
        composable("settings") {
            com.example.musicflow.ui.profile.SettingsScreen(
                viewModel = profileViewModel,
                onBack = { navController.popBackStack() },
                onLogout = onLogout,
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
            val title = backStackEntry.arguments?.getString("title") ?: "Songs"
            val songs by when(title) {
                "New for you" -> homeViewModel.newReleases.collectAsState()
                "New songs", "Trending Now" -> homeViewModel.trendingSongs.collectAsState()
                "Recommend" -> homeViewModel.recommendations.collectAsState()
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
            val artistId = backStackEntry.arguments?.getString("artistId") ?: ""
            com.example.musicflow.ui.artist.ArtistScreen(
                artistId = artistId,
                viewModel = artistViewModel,
                onBack = { navController.popBackStack() },
                onSongClick = onSongClick,
                onAlbumClick = { navController.navigate("album/$it") },
                bottomPadding = bottomPadding
            )
        }
    }
}
