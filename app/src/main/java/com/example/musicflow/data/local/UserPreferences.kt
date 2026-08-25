package com.example.musicflow.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "settings")

class UserPreferences(private val context: Context) {

    companion object {
        val VOLUME = floatPreferencesKey("volume")
        val AUDIO_QUALITY = stringPreferencesKey("audio_quality")
        val REPEAT_MODE = stringPreferencesKey("repeat_mode")
        val SHUFFLE_MODE = booleanPreferencesKey("shuffle_mode")
        val THEME_MODE = stringPreferencesKey("theme_mode")
        val LANGUAGES = stringSetPreferencesKey("languages")
        val USER_NAME = stringPreferencesKey("user_name")
        val RECENT_SEARCHES = stringSetPreferencesKey("recent_searches")
        val GLASS_EFFECTS = booleanPreferencesKey("glass_effects")
    }

    val volume: Flow<Float> = context.dataStore.data.map { it[VOLUME] ?: 0.8f }
    val audioQuality: Flow<String> = context.dataStore.data.map { it[AUDIO_QUALITY] ?: "320kbps" }
    val repeatMode: Flow<String> = context.dataStore.data.map { it[REPEAT_MODE] ?: "off" }
    val shuffleMode: Flow<Boolean> = context.dataStore.data.map { it[SHUFFLE_MODE] ?: false }
    val themeMode: Flow<String> = context.dataStore.data.map { it[THEME_MODE] ?: "dark" }
    val glassEffects: Flow<Boolean> = context.dataStore.data.map { it[GLASS_EFFECTS] ?: false }
    val languages: Flow<Set<String>> = context.dataStore.data.map { it[LANGUAGES] ?: setOf("hindi", "english") }
    val userName: Flow<String?> = context.dataStore.data.map { it[USER_NAME] }
    val recentSearches: Flow<List<String>> = context.dataStore.data.map { 
        it[RECENT_SEARCHES]?.toList()?.reversed() ?: emptyList() 
    }

    suspend fun updateUserName(name: String) {
        context.dataStore.edit { it[USER_NAME] = name }
    }

    suspend fun updateGlassEffects(enabled: Boolean) {
        context.dataStore.edit { it[GLASS_EFFECTS] = enabled }
    }

    suspend fun addRecentSearch(query: String) {
        context.dataStore.edit { prefs ->
            val current = prefs[RECENT_SEARCHES] ?: emptySet()
            val updated = (listOf(query) + current.filter { it != query }).take(10).toSet()
            prefs[RECENT_SEARCHES] = updated
        }
    }

    suspend fun clearRecentSearches() {
        context.dataStore.edit { it.remove(RECENT_SEARCHES) }
    }

    suspend fun updateVolume(value: Float) {
        context.dataStore.edit { it[VOLUME] = value }
    }

    suspend fun updateAudioQuality(value: String) {
        context.dataStore.edit { it[AUDIO_QUALITY] = value }
    }

    suspend fun updateRepeatMode(value: String) {
        context.dataStore.edit { it[REPEAT_MODE] = value }
    }

    suspend fun updateShuffleMode(value: Boolean) {
        context.dataStore.edit { it[SHUFFLE_MODE] = value }
    }

    suspend fun updateThemeMode(value: String) {
        context.dataStore.edit { it[THEME_MODE] = value }
    }

    suspend fun updateLanguages(value: Set<String>) {
        context.dataStore.edit { it[LANGUAGES] = value }
    }
}
