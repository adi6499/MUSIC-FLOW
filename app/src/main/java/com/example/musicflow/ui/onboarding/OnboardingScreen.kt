package com.example.musicflow.ui.onboarding

import androidx.compose.animation.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.musicflow.ui.components.LiquidGlassSurface
import com.example.musicflow.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun OnboardingScreen(
    viewModel: OnboardingViewModel,
    onComplete: () -> Unit
) {
    // Stage: 0 = Walkthrough Pager (Slides 1-4), 1 = Welcome/Name Screen, 2 = Select Genres, 3 = Select Artists
    var stage by remember { mutableIntStateOf(0) }
    var userName by remember { mutableStateOf("Music Lover") }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        AnimatedContent(
            targetState = stage,
            transitionSpec = {
                fadeIn() togetherWith fadeOut()
            },
            label = "onboarding_stage"
        ) { currentStage ->
            when (currentStage) {
                0 -> WalkthroughPager(
                    onSkip = { stage = 1 },
                    onFinish = { stage = 1 }
                )
                1 -> WelcomeProfileScreen(
                    currentName = userName,
                    onNameChange = { userName = it },
                    onContinue = { stage = 2 }
                )
                2 -> SelectGenresScreen(
                    onSkip = { stage = 3 },
                    onNext = { stage = 3 }
                )
                3 -> SelectArtistsScreen(
                    onSkip = { viewModel.saveUserName(userName, onComplete) },
                    onFinish = { viewModel.saveUserName(userName, onComplete) }
                )
            }
        }
    }
}

// -------------------------------------------------------------
// STAGE 0: WALKTHROUGH PAGER (Slides 1 to 4)
// -------------------------------------------------------------
@Composable
fun WalkthroughPager(
    onSkip: () -> Unit,
    onFinish: () -> Unit
) {
    val pagerState = rememberPagerState(pageCount = { 4 })
    val coroutineScope = rememberCoroutineScope()

    Box(modifier = Modifier.fillMaxSize()) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxSize()
        ) { page ->
            when (page) {
                0 -> IntroSlide1(onTap = {
                    coroutineScope.launch { pagerState.animateScrollToPage(1) }
                })
                1 -> IntroSlide2(
                    onSkip = onSkip,
                    onNext = {
                        coroutineScope.launch { pagerState.animateScrollToPage(2) }
                    }
                )
                2 -> IntroSlide3(
                    onSkip = onSkip,
                    onNext = {
                        coroutineScope.launch { pagerState.animateScrollToPage(3) }
                    }
                )
                3 -> IntroSlide4(
                    onSkip = onSkip,
                    onGetStarted = onFinish
                )
            }
        }
    }
}

@Composable
fun IntroSlide1(onTap: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                brush = androidx.compose.ui.graphics.Brush.verticalGradient(
                    colors = listOf(Color(0xFF26124A), Color(0xFF130826))
                )
            )
            .clickable(onClick = onTap)
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(24.dp)
    ) {
        Column(
            modifier = Modifier.align(Alignment.Center),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            androidx.compose.foundation.Image(
                painter = androidx.compose.ui.res.painterResource(id = com.example.musicflow.R.drawable.app_logo),
                contentDescription = "MusicFlow Logo",
                modifier = Modifier
                    .size(180.dp)
                    .clip(RoundedCornerShape(36.dp))
            )
            Spacer(modifier = Modifier.height(24.dp))
            Text(
                text = "MusicFlow",
                style = MaterialTheme.typography.displayMedium.copy(
                    fontWeight = FontWeight.Black,
                    color = Color.White,
                    letterSpacing = (-1).sp
                )
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Feel Every Beat In High Fidelity",
                style = MaterialTheme.typography.bodyMedium.copy(
                    color = Color.White.copy(alpha = 0.75f),
                    fontWeight = FontWeight.Normal
                )
            )
        }

        Text(
            text = "Tap anywhere to begin",
            style = MaterialTheme.typography.bodySmall.copy(
                color = Color.White.copy(alpha = 0.5f),
                fontWeight = FontWeight.Medium
            ),
            modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 32.dp)
        )
    }
}

@Composable
fun IntroSlide2(onSkip: () -> Unit, onNext: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MusicRed)
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(horizontal = 24.dp, vertical = 16.dp)
    ) {
        Text(
            text = "Skip",
            style = MaterialTheme.typography.titleMedium.copy(
                color = Color.White.copy(alpha = 0.9f),
                fontWeight = FontWeight.SemiBold
            ),
            modifier = Modifier
                .align(Alignment.TopEnd)
                .clickable(onClick = onSkip)
                .padding(8.dp)
        )

        Text(
            text = "Stream",
            style = MaterialTheme.typography.displayLarge.copy(
                fontSize = 80.sp,
                fontWeight = FontWeight.Black,
                color = Color.White,
                letterSpacing = (-3).sp,
                lineHeight = 80.sp
            ),
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(top = 48.dp)
        )

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .padding(bottom = 16.dp)
        ) {
            Text(
                text = "Enjoy unlimited access to millions\nof songs across multiple languages\nand trending genres",
                style = MaterialTheme.typography.titleLarge.copy(
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    lineHeight = 28.sp
                )
            )

            Spacer(modifier = Modifier.height(24.dp))
            PagerDotsIndicator(selectedIndex = 0)
            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = onNext,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(28.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.White,
                    contentColor = Color.Black
                )
            ) {
                Text("Next", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color.Black)
            }
        }
    }
}

@Composable
fun IntroSlide3(onSkip: () -> Unit, onNext: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MusicRed)
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(horizontal = 24.dp, vertical = 16.dp)
    ) {
        Text(
            text = "Skip",
            style = MaterialTheme.typography.titleMedium.copy(
                color = Color.White.copy(alpha = 0.9f),
                fontWeight = FontWeight.SemiBold
            ),
            modifier = Modifier
                .align(Alignment.TopEnd)
                .clickable(onClick = onSkip)
                .padding(8.dp)
        )

        Text(
            text = "Beats",
            style = MaterialTheme.typography.displayLarge.copy(
                fontSize = 80.sp,
                fontWeight = FontWeight.Black,
                color = Color.White,
                letterSpacing = (-3).sp,
                lineHeight = 80.sp
            ),
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(top = 48.dp)
        )

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .padding(bottom = 16.dp)
        ) {
            Text(
                text = "Experience immersive spatial sound\nwith lossless 320 kbps streaming\nand synchronized lyrics",
                style = MaterialTheme.typography.titleLarge.copy(
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    lineHeight = 28.sp
                )
            )

            Spacer(modifier = Modifier.height(24.dp))
            PagerDotsIndicator(selectedIndex = 1)
            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = onNext,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(28.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.White,
                    contentColor = Color.Black
                )
            ) {
                Text("Next", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color.Black)
            }
        }
    }
}

@Composable
fun IntroSlide4(onSkip: () -> Unit, onGetStarted: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(horizontal = 24.dp, vertical = 16.dp)
    ) {
        Text(
            text = "Skip",
            style = MaterialTheme.typography.titleMedium.copy(
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
                fontWeight = FontWeight.SemiBold
            ),
            modifier = Modifier
                .align(Alignment.TopEnd)
                .clickable(onClick = onSkip)
                .padding(8.dp)
        )

        Text(
            text = "Explore",
            style = MaterialTheme.typography.displayLarge.copy(
                fontSize = 80.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onBackground,
                letterSpacing = (-3).sp,
                lineHeight = 80.sp
            ),
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(top = 48.dp)
        )

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .padding(bottom = 16.dp)
        ) {
            Text(
                text = "Discover personalized radios,\ncustom playlists, and endless\nmusic without interruptions",
                style = MaterialTheme.typography.titleLarge.copy(
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onBackground,
                    lineHeight = 28.sp
                )
            )

            Spacer(modifier = Modifier.height(24.dp))
            PagerDotsIndicator(selectedIndex = 2)
            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = onGetStarted,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(28.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MusicRed,
                    contentColor = Color.White
                )
            ) {
                Text("Get started", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color.White)
            }
        }
    }
}

@Composable
fun PagerDotsIndicator(selectedIndex: Int) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        repeat(3) { index ->
            val isSelected = index == selectedIndex
            Box(
                modifier = Modifier
                    .height(4.dp)
                    .width(if (isSelected) 24.dp else 4.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = if (isSelected) 1f else 0.4f))
            )
        }
    }
}

// -------------------------------------------------------------
// STAGE 1: WELCOME PROFILE SCREEN
// -------------------------------------------------------------
@Composable
fun WelcomeProfileScreen(
    currentName: String,
    onNameChange: (String) -> Unit,
    onContinue: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        // Outline Music Typography in background
        Text(
            text = "MusicFlow",
            style = MaterialTheme.typography.displayLarge.copy(
                fontSize = 72.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f),
                letterSpacing = (-3).sp
            ),
            modifier = Modifier.padding(start = 24.dp, top = 40.dp)
        )

        // Bottom Card
        LiquidGlassSurface(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .padding(16.dp),
            shape = RoundedCornerShape(24.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // User Avatar
                Surface(
                    modifier = Modifier.size(68.dp),
                    shape = CircleShape,
                    color = MusicRed
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(
                            text = if (currentName.isNotBlank()) currentName.take(1).uppercase() else "M",
                            style = MaterialTheme.typography.headlineMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        )
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                Text(
                    text = "Welcome to MusicFlow",
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onBackground
                )

                Spacer(modifier = Modifier.height(6.dp))

                Text(
                    text = "Enjoy unlimited music with zero ads.\nEnter your name to get started:",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Secondary,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(20.dp))

                // Name Edit Input
                OutlinedTextField(
                    value = currentName,
                    onValueChange = onNameChange,
                    singleLine = true,
                    label = { Text("Your Name", color = Secondary) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = MusicRed,
                        unfocusedBorderColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.15f),
                        cursorColor = MusicRed,
                        focusedTextColor = MaterialTheme.colorScheme.onSurface,
                        unfocusedTextColor = MaterialTheme.colorScheme.onSurface
                    )
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Get Started Button
                Button(
                    onClick = {
                        if (currentName.isNotBlank()) {
                            onContinue()
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = RoundedCornerShape(26.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MusicRed,
                        contentColor = Color.White
                    )
                ) {
                    Text("Continue to MusicFlow", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                }
            }
        }
    }
}

// -------------------------------------------------------------
// STAGE 2: SELECT GENRES SCREEN
// -------------------------------------------------------------
data class GenreTile(
    val title: String,
    val color: Color
)

@Composable
fun SelectGenresScreen(
    onSkip: () -> Unit,
    onNext: () -> Unit
) {
    val genres = remember {
        listOf(
            GenreTile("Pop", GenrePurple),
            GenreTile("Hip-Hop", GenreCoral),
            GenreTile("Electronic", GenreMagenta),
            GenreTile("Rock", GenreEmerald),
            GenreTile("Chill", GenreDarkGray),
            GenreTile("Indie", GenreBlue),
            GenreTile("Dance", GenrePink),
            GenreTile("R&B", GenreMint),
            GenreTile("Soul", GenreYellow),
            GenreTile("Metal", GenreDarkGray),
            GenreTile("Classical", GenreTeal),
            GenreTile("Phonk", GenrePurple)
        )
    }

    var selectedGenres by remember {
        mutableStateOf(setOf("Pop", "Hip-Hop", "Rock", "Chill", "Phonk"))
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(horizontal = 20.dp, vertical = 12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Select genres",
                style = MaterialTheme.typography.headlineMedium.copy(
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onBackground
                )
            )
            Text(
                text = "Skip",
                style = MaterialTheme.typography.titleMedium.copy(
                    fontWeight = FontWeight.SemiBold,
                    color = Secondary
                ),
                modifier = Modifier
                    .clickable(onClick = onSkip)
                    .padding(8.dp)
            )
        }

        Text(
            text = "Select your favorite music styles\nto fine-tune recommendations",
            style = MaterialTheme.typography.bodyMedium,
            color = Secondary
        )

        Spacer(modifier = Modifier.height(24.dp))

        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.weight(1f)
        ) {
            items(genres) { genre ->
                val isSelected = selectedGenres.contains(genre.title)

                Surface(
                    modifier = Modifier
                        .height(90.dp)
                        .clickable {
                            selectedGenres = if (isSelected) selectedGenres - genre.title else selectedGenres + genre.title
                        },
                    shape = RoundedCornerShape(16.dp),
                    color = genre.color,
                    border = if (isSelected) BorderStroke(3.dp, Color.White) else null
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(14.dp),
                        contentAlignment = Alignment.BottomStart
                    ) {
                        Text(
                            text = genre.title,
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                                color = Color.White
                            )
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Button(
            onClick = onNext,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            shape = RoundedCornerShape(28.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MusicRed,
                contentColor = Color.White
            )
        ) {
            Text("Next", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        }
    }
}

// -------------------------------------------------------------
// STAGE 3: SELECT ARTISTS SCREEN
// -------------------------------------------------------------
data class ArtistItem(
    val name: String,
    val image: String
)

@Composable
fun SelectArtistsScreen(
    onSkip: () -> Unit,
    onFinish: () -> Unit
) {
    val artistList = remember {
        listOf(
            ArtistItem("Arijit Singh", "https://c.saavncdn.com/artists/Arijit_Singh_500x500.jpg"),
            ArtistItem("The Weeknd", "https://c.saavncdn.com/artists/The_Weeknd_500x500.jpg"),
            ArtistItem("Taylor Swift", "https://c.saavncdn.com/artists/Taylor_Swift_500x500.jpg"),
            ArtistItem("Drake", "https://c.saavncdn.com/artists/Drake_500x500.jpg"),
            ArtistItem("Justin Bieber", "https://c.saavncdn.com/artists/Justin_Bieber_500x500.jpg"),
            ArtistItem("Dua Lipa", "https://c.saavncdn.com/artists/Dua_Lipa_500x500.jpg"),
            ArtistItem("Eminem", "https://c.saavncdn.com/artists/Eminem_500x500.jpg"),
            ArtistItem("Post Malone", "https://c.saavncdn.com/artists/Post_Malone_500x500.jpg"),
            ArtistItem("Ed Sheeran", "https://c.saavncdn.com/artists/Ed_Sheeran_500x500.jpg"),
            ArtistItem("Billie Eilish", "https://c.saavncdn.com/artists/Billie_Eilish_500x500.jpg"),
            ArtistItem("Diljit Dosanjh", "https://c.saavncdn.com/artists/Diljit_Dosanjh_500x500.jpg"),
            ArtistItem("Shreya Ghoshal", "https://c.saavncdn.com/artists/Shreya_Ghoshal_500x500.jpg")
        )
    }

    var selectedArtists by remember {
        mutableStateOf(setOf("Arijit Singh", "The Weeknd", "Taylor Swift"))
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(horizontal = 20.dp, vertical = 12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Select artists",
                style = MaterialTheme.typography.headlineMedium.copy(
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onBackground
                )
            )
            Text(
                text = "Skip",
                style = MaterialTheme.typography.titleMedium.copy(
                    fontWeight = FontWeight.SemiBold,
                    color = Secondary
                ),
                modifier = Modifier
                    .clickable(onClick = onSkip)
                    .padding(8.dp)
            )
        }

        Text(
            text = "Select your favorite artists\nfrom the list",
            style = MaterialTheme.typography.bodyMedium,
            color = Secondary
        )

        Spacer(modifier = Modifier.height(20.dp))

        // 3x4 Grid
        LazyVerticalGrid(
            columns = GridCells.Fixed(3),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.weight(1f)
        ) {
            items(artistList) { artist ->
                val isSelected = selectedArtists.contains(artist.name)

                Surface(
                    modifier = Modifier
                        .aspectRatio(0.85f)
                        .clickable {
                            selectedArtists = if (isSelected) selectedArtists - artist.name else selectedArtists + artist.name
                        },
                    shape = RoundedCornerShape(20.dp),
                    color = if (isSelected) MusicRed else MaterialTheme.colorScheme.surface,
                    border = if (isSelected) null else BorderStroke(1.dp, MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f))
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(8.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        AsyncImage(
                            model = artist.image,
                            contentDescription = artist.name,
                            modifier = Modifier
                                .size(54.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.surfaceVariant),
                            contentScale = ContentScale.Crop
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = artist.name,
                            style = MaterialTheme.typography.bodySmall.copy(
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 11.sp
                            ),
                            color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurface,
                            textAlign = TextAlign.Center,
                            maxLines = 1
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Button(
            onClick = onFinish,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            shape = RoundedCornerShape(28.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MusicRed,
                contentColor = Color.White
            )
        ) {
            Text("Start listening", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        }
    }
}
