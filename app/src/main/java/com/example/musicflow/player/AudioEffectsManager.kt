package com.example.musicflow.player

import android.content.Context
import android.media.audiofx.BassBoost
import android.media.audiofx.Equalizer
import android.media.audiofx.LoudnessEnhancer
import android.media.audiofx.Virtualizer
import android.os.Build
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class EqualizerState(
    val isEnabled: Boolean = false,
    val currentPreset: String = "Flat",
    val bandLevels: List<Int> = listOf(0, 0, 0, 0, 0), // milliBels (-1000 to +1000)
    val bassBoostStrength: Int = 0, // 0 to 1000
    val virtualizerStrength: Int = 0, // 0 to 1000
    val spatialAudioEnabled: Boolean = false
)

object AudioEffectsManager {
    private const val TAG = "AudioEffectsManager"

    private var virtualizer: Virtualizer? = null
    private var bassBoost: BassBoost? = null
    private var equalizer: Equalizer? = null
    private var loudnessEnhancer: LoudnessEnhancer? = null
    private var visualizer: android.media.audiofx.Visualizer? = null

    private val _waveformState = MutableStateFlow<List<Float>>(List(24) { 0.2f })
    val waveformState: StateFlow<List<Float>> = _waveformState.asStateFlow()

    private val _state = MutableStateFlow(EqualizerState())
    val state: StateFlow<EqualizerState> = _state.asStateFlow()

    val presets = listOf(
        "Bass Boost" to listOf(600, 300, 0, 100, 200),
        "Vocal Booster" to listOf(-100, 100, 500, 400, 100),
        "EDM / Electronic" to listOf(500, 200, -100, 200, 500),
        "Rock" to listOf(400, 200, -100, 300, 500),
        "Pop" to listOf(-100, 200, 400, 200, -100),
        "Hip-Hop" to listOf(600, 400, 0, 100, 300),
        "Acoustic" to listOf(300, 100, 100, 300, 400),
        "Flat" to listOf(0, 0, 0, 0, 0),
        "Custom" to listOf(0, 0, 0, 0, 0)
    )

    fun initAudioEffects(audioSessionId: Int) {
        if (audioSessionId <= 0) return
        try {
            release()

            // 1. Equalizer
            equalizer = Equalizer(0, audioSessionId).apply {
                enabled = _state.value.isEnabled
                applyCurrentBandLevels(this)
            }

            // 2. Bass Boost
            bassBoost = BassBoost(0, audioSessionId).apply {
                if (strengthSupported) {
                    setStrength(_state.value.bassBoostStrength.toShort())
                }
                enabled = _state.value.isEnabled
            }

            // 3. 3D Spatial Virtualizer
            virtualizer = Virtualizer(0, audioSessionId).apply {
                if (strengthSupported) {
                    setStrength(_state.value.virtualizerStrength.toShort())
                }
                enabled = _state.value.isEnabled && _state.value.spatialAudioEnabled
            }

            // 4. Dynamic Loudness Enhancer
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                loudnessEnhancer = LoudnessEnhancer(audioSessionId).apply {
                    setTargetGain(150)
                    enabled = _state.value.isEnabled
                }
            }

            // 5. Audio Visualizer Spectrum
            try {
                visualizer = android.media.audiofx.Visualizer(audioSessionId).apply {
                    captureSize = android.media.audiofx.Visualizer.getCaptureSizeRange()[0]
                    setDataCaptureListener(object : android.media.audiofx.Visualizer.OnDataCaptureListener {
                        override fun onWaveFormDataCapture(v: android.media.audiofx.Visualizer?, waveform: ByteArray?, samplingRate: Int) {
                            if (waveform != null && waveform.isNotEmpty()) {
                                val bars = 24
                                val step = waveform.size / bars
                                val newValues = (0 until bars).map { i ->
                                    val idx = (i * step).coerceIn(waveform.indices)
                                    val raw = (waveform[idx].toInt() and 0xFF) - 128
                                    (Math.abs(raw) / 128f).coerceIn(0.1f, 1f)
                                }
                                _waveformState.value = newValues
                            }
                        }
                        override fun onFftDataCapture(v: android.media.audiofx.Visualizer?, fft: ByteArray?, samplingRate: Int) {}
                    }, android.media.audiofx.Visualizer.getMaxCaptureRate() / 2, true, false)
                    enabled = true
                }
            } catch (e: Exception) {
                Log.d(TAG, "Hardware visualizer init fallback: ${e.message}")
            }

            Log.d(TAG, "Hi-Fi Audio effects initialized on session $audioSessionId")
        } catch (e: Exception) {
            Log.e(TAG, "Error initializing audio effects: ${e.message}")
        }
    }

    private fun applyCurrentBandLevels(eq: Equalizer) {
        try {
            val numBands = eq.numberOfBands.toInt()
            val levels = _state.value.bandLevels
            for (i in 0 until minOf(numBands, levels.size)) {
                eq.setBandLevel(i.toShort(), levels[i].toShort())
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error applying band levels: ${e.message}")
        }
    }

    fun setEnabled(enabled: Boolean) {
        _state.value = _state.value.copy(isEnabled = enabled)
        try {
            equalizer?.enabled = enabled
            bassBoost?.enabled = enabled
            virtualizer?.enabled = enabled && _state.value.spatialAudioEnabled
            loudnessEnhancer?.enabled = enabled
        } catch (e: Exception) {
            Log.e(TAG, "Error toggling enabled: ${e.message}")
        }
    }

    fun setPreset(presetName: String) {
        val preset = presets.find { it.first == presetName }
        if (preset != null && presetName != "Custom") {
            _state.value = _state.value.copy(
                currentPreset = presetName,
                bandLevels = preset.second
            )
            equalizer?.let { applyCurrentBandLevels(it) }
        } else {
            _state.value = _state.value.copy(currentPreset = "Custom")
        }
    }

    fun setBandLevel(bandIndex: Int, levelMilliBels: Int) {
        val currentLevels = _state.value.bandLevels.toMutableList()
        if (bandIndex in currentLevels.indices) {
            currentLevels[bandIndex] = levelMilliBels
            _state.value = _state.value.copy(
                currentPreset = "Custom",
                bandLevels = currentLevels
            )
            try {
                equalizer?.setBandLevel(bandIndex.toShort(), levelMilliBels.toShort())
            } catch (e: Exception) {
                Log.e(TAG, "Error setting band level: ${e.message}")
            }
        }
    }

    fun setBassBoost(strength: Int) { // 0 to 1000
        _state.value = _state.value.copy(bassBoostStrength = strength)
        try {
            if (bassBoost?.strengthSupported == true) {
                bassBoost?.setStrength(strength.toShort())
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error setting bass boost: ${e.message}")
        }
    }

    fun setVirtualizer(strength: Int) { // 0 to 1000
        _state.value = _state.value.copy(virtualizerStrength = strength)
        try {
            if (virtualizer?.strengthSupported == true) {
                virtualizer?.setStrength(strength.toShort())
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error setting virtualizer: ${e.message}")
        }
    }

    fun toggleSpatialAudio(enabled: Boolean) {
        _state.value = _state.value.copy(spatialAudioEnabled = enabled)
        try {
            virtualizer?.enabled = _state.value.isEnabled && enabled
        } catch (e: Exception) {
            Log.e(TAG, "Error toggling spatial audio: ${e.message}")
        }
    }

    fun release() {
        try {
            visualizer?.release()
            equalizer?.release()
            bassBoost?.release()
            virtualizer?.release()
            loudnessEnhancer?.release()
        } catch (e: Exception) {
            // Ignore
        } finally {
            visualizer = null
            equalizer = null
            bassBoost = null
            virtualizer = null
            loudnessEnhancer = null
        }
    }
}
