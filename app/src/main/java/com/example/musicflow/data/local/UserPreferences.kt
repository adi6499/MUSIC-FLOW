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
        val LAST_SONG_ID = stringPreferencesKey("last_song_id")
        val LAST_SONG_NAME = stringPreferencesKey("last_song_name")
        val LAST_SONG_ARTISTS = stringPreferencesKey("last_song_artists")
        val LAST_SONG_ALBUM = stringPreferencesKey("last_song_album")
        val LAST_SONG_IMAGE = stringPreferencesKey("last_song_image")
        val LAST_SONG_STREAM_URL = stringPreferencesKey("last_song_stream_url")
        val LAST_SONG_DURATION = intPreferencesKey("last_song_duration")
        val LAST_POSITION_MS = longPreferencesKey("last_position_ms")
        val CROSSFADE_SECONDS = intPreferencesKey("crossfade_seconds")
        val LOUDNESS_NORMALIZATION = booleanPreferencesKey("loudness_normalization")
        val VISUALIZER_ENABLED = booleanPreferencesKey("visualizer_enabled")
    }

    val volume: Flow<Float> = context.dataStore.data.map { it[VOLUME] ?: 0.8f }
    val audioQuality: Flow<String> = context.dataStore.data.map { it[AUDIO_QUALITY] ?: "320kbps" }
    val repeatMode: Flow<String> = context.dataStore.data.map { it[REPEAT_MODE] ?: "off" }
    val shuffleMode: Flow<Boolean> = context.dataStore.data.map { it[SHUFFLE_MODE] ?: false }
    val themeMode: Flow<String> = context.dataStore.data.map { it[THEME_MODE] ?: "dark" }
    val glassEffects: Flow<Boolean> = context.dataStore.data.map { it[GLASS_EFFECTS] ?: true }
    val crossfadeSeconds: Flow<Int> = context.dataStore.data.map { it[CROSSFADE_SECONDS] ?: 3 }
    val loudnessNormalization: Flow<Boolean> = context.dataStore.data.map { it[LOUDNESS_NORMALIZATION] ?: true }
    val visualizerEnabled: Flow<Boolean> = context.dataStore.data.map { it[VISUALIZER_ENABLED] ?: true }
    val languages: Flow<Set<String>> = context.dataStore.data.map { it[LANGUAGES] ?: setOf("hindi", "english") }
    val userName: Flow<String?> = context.dataStore.data.map { it[USER_NAME] }
    val recentSearches: Flow<List<String>> = context.dataStore.data.map { 
        it[RECENT_SEARCHES]?.toList()?.reversed() ?: emptyList() 
    }

    val lastSavedSong: Flow<com.example.musicflow.data.model.Song?> = context.dataStore.data.map { prefs ->
        val id = prefs[LAST_SONG_ID]
        val name = prefs[LAST_SONG_NAME]
        val streamUrl = prefs[LAST_SONG_STREAM_URL]
        if (!id.isNullOrBlank() && !name.isNullOrBlank() && !streamUrl.isNullOrBlank()) {
            com.example.musicflow.data.model.Song(
                id = id,
                name = name,
                artists = prefs[LAST_SONG_ARTISTS] ?: "Unknown Artist",
                album = prefs[LAST_SONG_ALBUM] ?: "",
                duration = prefs[LAST_SONG_DURATION] ?: 0,
                image = prefs[LAST_SONG_IMAGE] ?: "",
                streamUrl = streamUrl
            )
        } else {
            null
        }
    }

    val lastPositionMs: Flow<Long> = context.dataStore.data.map { prefs ->
        prefs[LAST_POSITION_MS] ?: 0L
    }

    suspend fun saveLastPlaybackState(song: com.example.musicflow.data.model.Song, positionMs: Long) {
        context.dataStore.edit { prefs ->
            prefs[LAST_SONG_ID] = song.id
            prefs[LAST_SONG_NAME] = song.name
            prefs[LAST_SONG_ARTISTS] = song.artists
            prefs[LAST_SONG_ALBUM] = song.album
            prefs[LAST_SONG_IMAGE] = song.image
            prefs[LAST_SONG_STREAM_URL] = song.streamUrl
            prefs[LAST_SONG_DURATION] = song.duration
            prefs[LAST_POSITION_MS] = positionMs
        }
    }

    suspend fun updateLastPlaybackPosition(positionMs: Long) {
        context.dataStore.edit { prefs ->
            prefs[LAST_POSITION_MS] = positionMs
        }
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

    suspend fun updateCrossfadeSeconds(seconds: Int) {
        context.dataStore.edit { it[CROSSFADE_SECONDS] = seconds }
    }

    suspend fun updateLoudnessNormalization(enabled: Boolean) {
        context.dataStore.edit { it[LOUDNESS_NORMALIZATION] = enabled }
    }

    suspend fun updateVisualizerEnabled(enabled: Boolean) {
        context.dataStore.edit { it[VISUALIZER_ENABLED] = enabled }
    }
}
