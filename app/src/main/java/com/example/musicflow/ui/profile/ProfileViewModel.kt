package com.example.musicflow.ui.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.musicflow.data.MusicRepository
import com.example.musicflow.data.local.PlaylistEntity
import com.example.musicflow.data.local.UserPreferences
import com.example.musicflow.data.model.Artist
import com.example.musicflow.data.model.Song
import com.example.musicflow.player.MusicController
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class ProfileViewModel(
    private val userPreferences: UserPreferences,
    private val repository: MusicRepository,
    private val musicController: MusicController
) : ViewModel() {

    val userName: StateFlow<String?> = userPreferences.userName
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val playlists: StateFlow<List<PlaylistEntity>> = repository.getPlaylists()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val favorites: StateFlow<List<Song>> = repository.getFavorites()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val followedArtists: StateFlow<List<Artist>> = repository.getFollowedArtists()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val themeMode: StateFlow<String> = userPreferences.themeMode
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "dark")

    val audioQuality: StateFlow<String> = userPreferences.audioQuality
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "320kbps")

    val glassEffects: StateFlow<Boolean> = userPreferences.glassEffects
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    val languages: StateFlow<Set<String>> = userPreferences.languages
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), setOf("hindi", "english"))

    fun updateLanguages(langs: Set<String>) {
        viewModelScope.launch {
            userPreferences.updateLanguages(langs)
        }
    }

    fun updateName(newName: String) {
        viewModelScope.launch {
            userPreferences.updateUserName(newName)
        }
    }

    fun updateThemeMode(mode: String) {
        viewModelScope.launch {
            userPreferences.updateThemeMode(mode)
        }
    }

    fun updateAudioQuality(quality: String) {
        viewModelScope.launch {
            userPreferences.updateAudioQuality(quality)
        }
    }

    fun updateGlassEffects(enabled: Boolean) {
        viewModelScope.launch {
            userPreferences.updateGlassEffects(enabled)
        }
    }

    fun addToQueue(song: Song) {
        viewModelScope.launch {
            val fullSong = if (song.streamUrl.isNotBlank()) song else repository.getSongDetails(song.id) ?: song
            musicController.addToQueue(fullSong)
        }
    }

    fun playNext(song: Song) {
        viewModelScope.launch {
            val fullSong = if (song.streamUrl.isNotBlank()) song else repository.getSongDetails(song.id) ?: song
            musicController.playNext(fullSong)
        }
    }

    fun toggleFavorite(song: Song) {
        viewModelScope.launch {
            repository.toggleFavorite(song)
        }
    }

    fun startRadio(song: Song) {
        viewModelScope.launch {
            try {
                val fullSong = if (song.streamUrl.isNotBlank()) song else repository.getSongDetails(song.id) ?: song
                val artistQuery = fullSong.artists.split(",", "&", "feat.", "ft.").firstOrNull()?.trim()?.takeIf { it.isNotBlank() && it != "Unknown Artist" }
                val related = if (!artistQuery.isNullOrBlank()) {
                    repository.searchComprehensiveSongs(artistQuery)
                } else {
                    repository.searchComprehensiveSongs(fullSong.name)
                }
                val validRelated = related.filter { it.id != fullSong.id && it.streamUrl.isNotBlank() }
                val queue = (listOf(fullSong) + validRelated).distinctBy { it.id }

                val isCurrent = musicController.currentSong.value?.id == fullSong.id
                if (isCurrent && musicController.isPlaying.value) {
                    musicController.setRadioQueueKeepPlaying(queue)
                } else {
                    musicController.playQueue(queue, 0)
                }
            } catch (e: Exception) {
                val fullSong = if (song.streamUrl.isNotBlank()) song else repository.getSongDetails(song.id) ?: song
                musicController.playSong(fullSong)
            }
        }
    }

    fun addToPlaylist(playlistId: String, song: Song) {
        viewModelScope.launch {
            repository.addSongToPlaylist(playlistId, song)
        }
    }

    fun createPlaylist(name: String) {
        viewModelScope.launch {
            val id = System.currentTimeMillis().toString()
            repository.addPlaylist(PlaylistEntity(id, name, "", ""))
        }
    }
}
