package com.example.musicflow.ui.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.musicflow.data.local.UserPreferences
import kotlinx.coroutines.launch

class OnboardingViewModel(private val userPreferences: UserPreferences) : ViewModel() {

    fun saveUserName(name: String, onComplete: () -> Unit) {
        viewModelScope.launch {
            userPreferences.updateUserName(name)
            onComplete()
        }
    }
}
