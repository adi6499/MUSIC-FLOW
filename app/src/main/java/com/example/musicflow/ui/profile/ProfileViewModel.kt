package com.example.musicflow.ui.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.musicflow.data.local.UserPreferences
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class ProfileViewModel(
    private val userPreferences: UserPreferences,
    private val repository: com.example.musicflow.data.MusicRepository
) : ViewModel() {

    val userName: StateFlow<String?> = userPreferences.userName
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val playlists: StateFlow<List<com.example.musicflow.data.local.PlaylistEntity>> = repository.getPlaylists()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val favorites: StateFlow<List<com.example.musicflow.data.model.Song>> = repository.getFavorites()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val followedArtists: StateFlow<List<com.example.musicflow.data.model.Artist>> = repository.getFollowedArtists()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val themeMode: StateFlow<String> = userPreferences.themeMode
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "dark")

    val audioQuality: StateFlow<String> = userPreferences.audioQuality
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "320kbps")

    val glassEffects: StateFlow<Boolean> = userPreferences.glassEffects
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

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
}
