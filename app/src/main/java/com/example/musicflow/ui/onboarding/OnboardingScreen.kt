package com.example.musicflow.ui.onboarding

import androidx.compose.animation.*
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.musicflow.ui.components.MFPillButton
import com.example.musicflow.ui.theme.*

@Composable
fun OnboardingScreen(
    viewModel: OnboardingViewModel,
    onComplete: () -> Unit
) {
    var step by remember { mutableStateOf(1) }
    var name by remember { mutableStateOf("") }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
    ) {
        AnimatedContent(
            targetState = step,
            transitionSpec = {
                fadeIn() togetherWith fadeOut()
            },
            label = "onboarding_step"
        ) { currentStep ->
            when (currentStep) {
                1 -> SplashScreen(onNext = { step = 2 })
                2 -> LoginScreen(name = name, onNameChange = { name = it }, onNext = { step = 3 })
                3 -> GenreSelectionScreen(onNext = { step = 4 })
                4 -> ArtistSelectionScreen(onNext = { viewModel.saveUserName(name, onComplete) })
            }
        }
    }
}

@Composable
fun SplashScreen(onNext: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize().clickable(onClick = onNext),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = "MUSIC FLOW",
            style = MaterialTheme.typography.displayLarge.copy(
                fontSize = 40.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 4.sp,
                color = Color.White.copy(alpha = 0.1f)
            )
        )
    }
    
    LaunchedEffect(Unit) {
        kotlinx.coroutines.delay(1500)
        onNext()
    }
}

@Composable
fun LoginScreen(name: String, onNameChange: (String) -> Unit, onNext: () -> Unit) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(Dimens.ScreenPadding)
                .clip(RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp))
                .background(SurfaceDark)
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            AsyncImage(
                model = "https://api.dicebear.com/7.x/avataaars/svg?seed=${name.ifBlank { "user" }}",
                contentDescription = null,
                modifier = Modifier.size(80.dp).clip(CircleShape).background(SurfaceVariantDark),
                contentScale = ContentScale.Crop
            )
            Spacer(modifier = Modifier.height(24.dp))
            Text(
                text = if (name.isNotBlank()) "Hi, $name" else "What's your name?",
                style = MaterialTheme.typography.displayMedium,
                color = Color.White
            )
            Spacer(modifier = Modifier.height(24.dp))

            // Name input field
            androidx.compose.material3.OutlinedTextField(
                value = name,
                onValueChange = onNameChange,
                placeholder = { Text("Enter your name", color = Secondary) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = MusicAccent,
                    unfocusedBorderColor = Color.White.copy(alpha = 0.1f),
                    cursorColor = MusicAccent,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White
                )
            )

            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = { if (name.isNotBlank()) onNext() },
                modifier = Modifier.fillMaxWidth().height(56.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (name.isNotBlank()) MusicAccent else MusicAccent.copy(alpha = 0.4f)
                ),
                enabled = name.isNotBlank()
            ) {
                Text("Continue", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
        }
    }
}

@Composable
fun GenreSelectionScreen(onNext: () -> Unit) {
    val genres = listOf(
        "Pop" to GenrePurple, "Hip Hop" to GenreBlue, "R&B" to GenrePink,
        "Rock" to GenreMint, "Electronic" to GenreYellow, "Jazz" to GenreTeal,
        "Latin" to GenrePurple, "Country" to GenreBlue, "Classical" to GenrePink
    )
    var selectedGenres by remember { mutableStateOf(setOf<String>()) }

    Column(modifier = Modifier.fillMaxSize().padding(Dimens.ScreenPadding)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            TextButton(onClick = onNext) {
                Text("Skip", color = Color.White)
            }
        }
        
        Text(text = "Select genres", style = MaterialTheme.typography.displayLarge, color = Color.White)
        Text(text = "Select your favorite music genres", style = MaterialTheme.typography.bodyLarge, color = Secondary)
        
        Spacer(modifier = Modifier.height(32.dp))
        
        LazyVerticalGrid(
            columns = GridCells.Fixed(3),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            modifier = Modifier.weight(1f)
        ) {
            items(genres) { (name, color) ->
                val isSelected = selectedGenres.contains(name)
                GenreTile(name, color, isSelected) {
                    selectedGenres = if (isSelected) selectedGenres - name else selectedGenres + name
                }
            }
        }
        
        Button(
            onClick = onNext,
            modifier = Modifier.fillMaxWidth().height(56.dp).padding(vertical = 8.dp),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(containerColor = MusicAccent)
        ) {
            Text("Next", fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun GenreTile(name: String, color: Color, isSelected: Boolean, onClick: () -> Unit) {
    Surface(
        modifier = Modifier.aspectRatio(1f).clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        color = if (isSelected) color else SurfaceVariantDark,
        border = if (isSelected) null else androidx.compose.foundation.BorderStroke(0.5.dp, Color.White.copy(alpha = 0.1f))
    ) {
        Column(
            modifier = Modifier.padding(8.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Icon(
                imageVector = if (isSelected) Icons.Default.Check else Icons.Default.Add,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(16.dp).align(Alignment.End)
            )
            Text(text = name, style = MaterialTheme.typography.titleMedium, color = Color.White)
        }
    }
}

@Composable
fun ArtistSelectionScreen(onNext: () -> Unit) {
    val artists = listOf("Taylor Swift", "The Weeknd", "Drake", "Drake", "Ariana Grande", "Post Malone", "Ed Sheeran", "Justin Bieber", "Bad Bunny")
    var selectedArtists by remember { mutableStateOf(setOf<String>()) }

    Column(modifier = Modifier.fillMaxSize().padding(Dimens.ScreenPadding)) {
        Text(text = "Select artists", style = MaterialTheme.typography.displayLarge, color = Color.White)
        Text(text = "Select your favorite artists", style = MaterialTheme.typography.bodyLarge, color = Secondary)
        
        Spacer(modifier = Modifier.height(32.dp))
        
        LazyVerticalGrid(
            columns = GridCells.Fixed(3),
            verticalArrangement = Arrangement.spacedBy(24.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            modifier = Modifier.weight(1f)
        ) {
            items(artists) { name ->
                val isSelected = selectedArtists.contains(name)
                ArtistCircleTile(name, isSelected) {
                    selectedArtists = if (isSelected) selectedArtists - name else selectedArtists + name
                }
            }
        }
        
        Button(
            onClick = onNext,
            modifier = Modifier.fillMaxWidth().height(56.dp).padding(vertical = 8.dp),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(containerColor = MusicAccent)
        ) {
            Text("Start listening", fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun ArtistCircleTile(name: String, isSelected: Boolean, onClick: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.clickable(onClick = onClick)
    ) {
        Box {
            AsyncImage(
                model = "https://api.dicebear.com/7.x/avataaars/svg?seed=$name",
                contentDescription = null,
                modifier = Modifier.aspectRatio(1f).clip(CircleShape).background(SurfaceVariantDark),
                contentScale = ContentScale.Crop
            )
            if (isSelected) {
                Box(
                    modifier = Modifier.matchParentSize().clip(CircleShape).background(MusicAccent.copy(alpha = 0.4f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(32.dp))
                }
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(text = name, style = MaterialTheme.typography.bodyMedium, color = Color.White, maxLines = 1)
    }
}
