package com.example.musicflow

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
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
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import coil.compose.AsyncImage
import com.example.musicflow.data.MusicRepository
import com.example.musicflow.data.api.RetrofitClient
import com.example.musicflow.data.local.MusicDatabase
import com.example.musicflow.player.MusicController
import com.example.musicflow.ui.home.HomeViewModel
import com.example.musicflow.ui.navigation.NavGraph
import com.example.musicflow.ui.player.PlayerViewModel
import com.example.musicflow.ui.search.SearchViewModel
import com.example.musicflow.ui.theme.MUSICFLOWTheme
import com.example.musicflow.ui.theme.Dimens
import kotlinx.coroutines.launch

import com.example.musicflow.data.local.UserPreferences
import com.example.musicflow.ui.onboarding.OnboardingScreen
import com.example.musicflow.ui.onboarding.OnboardingViewModel
import androidx.work.WorkManager
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking

import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import android.content.Intent

class MainActivity : ComponentActivity() {

    private lateinit var musicController: MusicController
    private lateinit var playerViewModel: PlayerViewModel

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val database = MusicDatabase.getDatabase(this)
        val userPreferences = UserPreferences(this)
        val workManager = WorkManager.getInstance(this)
        val repository = MusicRepository(
            RetrofitClient.instance, 
            RetrofitClient.lrcLib,
            database.musicDao(), 
            workManager, 
            userPreferences
        )
        musicController = MusicController(this)

        val homeViewModel = HomeViewModel(repository, userPreferences, musicController)
        val searchViewModel = SearchViewModel(repository, userPreferences, musicController, androidx.lifecycle.SavedStateHandle())
        val libraryViewModel = com.example.musicflow.ui.library.LibraryViewModel(repository, musicController)
        playerViewModel = PlayerViewModel(musicController, repository)
        val profileViewModel = com.example.musicflow.ui.profile.ProfileViewModel(userPreferences, repository)
        val onboardingViewModel = OnboardingViewModel(userPreferences)
        val albumViewModel = com.example.musicflow.ui.album.AlbumViewModel(repository, musicController)
        val artistViewModel = com.example.musicflow.ui.artist.ArtistViewModel(repository, musicController)

        handleIntent(intent)
        checkBatteryOptimizations()

        val startDestination = runBlocking {
            if (userPreferences.userName.first() == null) "onboarding" else "main"
        }

        setContent {
            val themeMode by userPreferences.themeMode.collectAsState(initial = "dark")
            val glassEffects by userPreferences.glassEffects.collectAsState(initial = false)
            var currentScreen by remember { mutableStateOf(startDestination) }
            val scope = rememberCoroutineScope()
            
            MUSICFLOWTheme(themeMode = themeMode) {
                CompositionLocalProvider(com.example.musicflow.ui.components.LocalGlassEffects provides glassEffects) {
                    AnimatedContent(
                        targetState = currentScreen,
                        transitionSpec = {
                            fadeIn(animationSpec = tween(500)) togetherWith 
                            fadeOut(animationSpec = tween(500))
                        },
                        label = "screen_transition"
                    ) { screen ->
                        if (screen == "onboarding") {
                            OnboardingScreen(
                                viewModel = onboardingViewModel,
                                onComplete = { currentScreen = "main" }
                            )
                        } else {
                            MainScreen(
                                homeViewModel, 
                                searchViewModel, 
                                libraryViewModel, 
                                profileViewModel,
                                playerViewModel,
                                albumViewModel,
                                artistViewModel,
                                scope,
                                onLogout = {
                                    scope.launch {
                                        userPreferences.updateUserName("")
                                        currentScreen = "onboarding"
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        intent?.data?.let { uri ->
            if (uri.scheme == "musicflow" && uri.host == "song") {
                val songId = uri.lastPathSegment
                if (songId != null) {
                    playerViewModel.playSongById(songId)
                }
            }
        }
    }

    private fun checkBatteryOptimizations() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            val intent = Intent()
            val packageName = packageName
            val pm = getSystemService(android.content.Context.POWER_SERVICE) as android.os.PowerManager
            if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                // We should ideally show a dialog first explaining why we need this
                // but for now we'll just log it or provide a setting.
                // context.startActivity(Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName")))
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        musicController.release()
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    homeViewModel: HomeViewModel,
    searchViewModel: SearchViewModel,
    libraryViewModel: com.example.musicflow.ui.library.LibraryViewModel,
    profileViewModel: com.example.musicflow.ui.profile.ProfileViewModel,
    playerViewModel: PlayerViewModel,
    albumViewModel: com.example.musicflow.ui.album.AlbumViewModel,
    artistViewModel: com.example.musicflow.ui.artist.ArtistViewModel,
    scope: kotlinx.coroutines.CoroutineScope,
    onLogout: () -> Unit
) {
    val currentSong by playerViewModel.currentSong.collectAsState()
    val isPlaying by playerViewModel.isPlaying.collectAsState()
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    val sheetState = rememberStandardBottomSheetState(
        initialValue = SheetValue.PartiallyExpanded,
        skipHiddenState = false
    )
    val scaffoldState = rememberBottomSheetScaffoldState(
        bottomSheetState = sheetState
    )

    BottomSheetScaffold(
        scaffoldState = scaffoldState,
        sheetContent = {
            if (currentSong != null) {
                com.example.musicflow.ui.player.PlayerScreen(
                    viewModel = playerViewModel,
                    onCollapse = {
                        scope.launch { sheetState.partialExpand() }
                    }
                )
            } else {
                Box(Modifier.fillMaxWidth().height(1.dp))
            }
        },
        sheetPeekHeight = if (currentSong != null) 80.dp else 0.dp,
        sheetDragHandle = null,
        sheetSwipeEnabled = currentSong != null,
        sheetContainerColor = MaterialTheme.colorScheme.background
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            NavGraph(
                navController = navController,
                homeViewModel = homeViewModel,
                searchViewModel = searchViewModel,
                libraryViewModel = libraryViewModel,
                profileViewModel = profileViewModel,
                albumViewModel = albumViewModel,
                artistViewModel = artistViewModel,
                onSongClick = { playerViewModel.playSong(it) },
                onLogout = onLogout,
                bottomPadding = (if (currentSong != null) 190.dp else 112.dp) + WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
            )

            // Mini Player & Bottom Nav Container
            Column(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .windowInsetsPadding(WindowInsets.navigationBars)
                    .padding(horizontal = 16.dp, vertical = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                androidx.compose.animation.AnimatedVisibility(
                    visible = currentSong != null && sheetState.currentValue == SheetValue.PartiallyExpanded,
                    enter = fadeIn() + expandVertically(),
                    exit = fadeOut() + shrinkVertically()
                ) {
                    MiniPlayer(
                        song = currentSong!!,
                        isPlaying = isPlaying,
                        onTogglePlayPause = { playerViewModel.togglePlayPause() },
                        onSkipNext = { playerViewModel.skipNext() },
                        onClick = {
                            scope.launch { sheetState.expand() }
                        }
                    )
                }

                FloatingNavBar(
                    currentRoute = currentRoute,
                    onNavigate = { route ->
                        navController.navigate(route) {
                            popUpTo("home") { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                )
            }
        }
    }
}

@Composable
fun MiniPlayer(
    song: com.example.musicflow.data.model.Song,
    isPlaying: Boolean,
    onTogglePlayPause: () -> Unit,
    onSkipNext: () -> Unit,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .height(64.dp)
            .clickable(onClick = onClick),
        color = com.example.musicflow.ui.theme.SurfaceDark,
        shape = RoundedCornerShape(Dimens.RadiusLarge),
        border = BorderStroke(0.5.dp, Color.White.copy(alpha = 0.05f))
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            AsyncImage(
                model = song.image,
                contentDescription = "Artwork",
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(Dimens.RadiusMedium)),
                contentScale = ContentScale.Crop
            )
            Spacer(modifier = Modifier.width(Dimens.PaddingMedium))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = song.name,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = Color.White
                )
                Text(
                    text = song.artists,
                    style = MaterialTheme.typography.bodySmall,
                    color = com.example.musicflow.ui.theme.Secondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onTogglePlayPause) {
                    Icon(
                        imageVector = if (isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                        contentDescription = if (isPlaying) "Pause" else "Play",
                        tint = Color.White,
                        modifier = Modifier.size(28.dp)
                    )
                }
                IconButton(onClick = onSkipNext) {
                    Icon(
                        imageVector = Icons.Filled.SkipNext,
                        contentDescription = "Next",
                        tint = Color.White,
                        modifier = Modifier.size(28.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun FloatingNavBar(
    currentRoute: String?,
    onNavigate: (String) -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth(),
        color = com.example.musicflow.ui.theme.BackgroundDark.copy(alpha = 0.98f),
        border = BorderStroke(0.5.dp, Color.White.copy(alpha = 0.05f)),
        shape = RoundedCornerShape(Dimens.RadiusLarge)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(64.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            NavBarItem(
                isSelected = currentRoute == "home",
                icon = if (currentRoute == "home") Icons.Filled.Home else Icons.Default.Home,
                label = "Home",
                onClick = { onNavigate("home") }
            )
            NavBarItem(
                isSelected = currentRoute == "explore",
                icon = if (currentRoute == "explore") Icons.Filled.Explore else Icons.Default.Explore,
                label = "Explore",
                onClick = { onNavigate("explore") }
            )
            NavBarItem(
                isSelected = currentRoute == "search",
                icon = Icons.Filled.Search,
                label = "Search",
                onClick = { onNavigate("search") }
            )
            NavBarItem(
                isSelected = currentRoute == "library",
                icon = if (currentRoute == "library") Icons.Filled.LibraryMusic else Icons.Default.LibraryMusic,
                label = "Library",
                onClick = { onNavigate("library") }
            )
        }
    }
}

@Composable
fun RowScope.NavBarItem(
    isSelected: Boolean,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit
) {
    val contentColor = if (isSelected) com.example.musicflow.ui.theme.MusicAccent else com.example.musicflow.ui.theme.Secondary

    Column(
        modifier = Modifier
            .weight(1f)
            .clickable(onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            tint = contentColor,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = contentColor
        )
    }
}
