# MUSICFLOW — PROFESSIONAL AUDIO EFFECTS ENGINE & LYRICS SYNC FIX

## Overview

Upgraded MusicFlow with a high-fidelity, real Web Audio DSP processing engine, 7-band parametric equalizer, 3D Spatial Audio / stereo widener, dynamic range limiter, auto preamp headroom compensation, crossfade transitions, customizable presets, and real-time synchronized karaoke lyrics with accurate click-to-seek and millisecond timestamp alignment.

---

## 1. Professional Web Audio DSP Engine Architecture

```
HTML5 <audio> (Lossless/Web Audio source)
   ↓
[createMediaElementSource]
   ↓
[Pre-Gain Headroom Compensation Node] (P = -min(10, maxBoost * 0.65) dB)
   ↓
[Loudness Normalization GainNode] (0.92x perceptual level)
   ↓
[Studio Bass Boost BiquadFilter] (80 Hz Low-Shelf, 0 to +12 dB)
   ↓
[Crisp Treble Boost BiquadFilter] (10 kHz High-Shelf, -6 to +12 dB)
   ↓
[Vocal Clarity Boost BiquadFilter] (2.8 kHz Peaking, Q=1.4, 0 to +8 dB)
   ↓
[7-Band Graphic EQ BiquadFilters]
  • 60 Hz (Sub-Bass Low-Shelf, ±12 dB)
  • 150 Hz (Bass Peaking, ±12 dB)
  • 400 Hz (Low-Mid Peaking, ±12 dB)
  • 1000 Hz (Mid Peaking, ±12 dB)
  • 2400 Hz (Presence Peaking, ±12 dB)
  • 6000 Hz (Brilliance Peaking, ±12 dB)
  • 15000 Hz (Air High-Shelf, ±12 dB)
   ↓
[3D Spatial / Stereo Widener Mid-Side Matrix]
  • ChannelSplitter (L / R)
  • Mid Gain (L+R, center vocal & kick preserved)
  • Side Gain (L-R, scaled by 1.0x / 1.3x / 1.6x / 2.0x for OFF / LOW / MEDIUM / HIGH)
  • ChannelMerger (L' / R')
   ↓
[DynamicsCompressor Peak Limiter] (Threshold: -0.5 dB, Knee: 0, Ratio: 20:1, Attack: 3ms, Release: 100ms)
   ↓
[Master Destination & Audio Sink Output]
```

---

## 2. Key Components Built & Enhanced

### 1. `web-app/js/audioEffectsEngine.js`
- **Real Web Audio Nodes**: Zero fake mock filters or placebo controls.
- **Auto Preamp Headroom Compensation**: Prevents clipping before signals hit the limiter when large EQ boosts are applied.
- **Click-Free Transitions**: All `AudioParam` updates utilize `setTargetAtTime(target, audioCtx.currentTime, 0.04)` for smooth, artifact-free ramping.
- **13 Built-in Professional Presets**: Flat, Bass Boost, Treble, Vocal, Rock, Pop, Hip-Hop, Classical, Jazz, Electronic, Bollywood, Lo-Fi, Acoustic.
- **Custom User Presets (CRUD)**: Save, load, and delete user presets with custom names.
- **Crossfade Engine**: Configurable (0s, 2s, 4s, 6s, 8s, 10s) with seamless track transitions.

### 2. `web-app/js/lyrics.js`
- **Multi-Format Timestamp Parser**: Supports `[mm:ss.xx]`, `[mm:ss.xxx]`, `[mm:ss:xx]`, `[m:ss.xx]`, and global `[offset: +/-ms]` tags.
- **Multi-Timestamp Lines**: Extracts duplicated chorus lines like `[00:15.00][00:45.00] Chorus text`.
- **Absolute Time Seek Fix**: Fixed click-to-seek bug by invoking `Player.seek(timeInSeconds)` directly instead of percentage.
- **Karaoke Flow & Smooth Scroll**: 200ms lookahead with `.active` highlight, `.past` dimming, and manual scroll detection that pauses auto-scroll during user interaction.

### 3. `web-app/js/storage.js`
- Added persistent storage schemas for `mf_audio_effects_v2` and `mf_user_audio_presets` with backward compatibility for legacy 5-band structures.

### 4. `web-app/index.html` & `web-app/js/ui.js`
- Redesigned `#sheet-equalizer` with master ON/OFF switch, 3D Spatial Audio selector with stereo width meter, 7 vertical slider faders, Studio Bass Boost, Crisp Treble, Vocal Clarity, Loudness Normalization, Crossfade selector, and Reset Defaults.

---

## 4. Full Player Small-Screen Responsive Optimization

### Overview of Small-Screen Strategy
- **Dynamic Viewport Height (`100dvh`)**: Used modern dynamic viewport units with fallbacks to avoid browser address bar clipping.
- **Artwork as Primary Flexible Dimension**: `.player-center-body` takes `flex: 1 1 0; min-height: 0;` absorbing remaining vertical space, while `.player-art-card` scales gracefully preserving its strict 1:1 aspect ratio (`max-width: min(76vw, min(42vh, 320px))`).
- **Compact Height Mode (`@media (max-height: 700px)`)**: Tailored for 375×667 (iPhone SE), 360×640, and 360×720 screens. Automatically tightens margins, scales play button to 52px, and ensures all controls, badges, and output card fit 100% without scroll.
- **Ultra-Compact Height Mode (`@media (max-height: 590px)`)**: Tailored for 320×568 (iPhone 5 / SE1). Artwork scales dynamically to ~160-180px, drag handle collapses, play button scales to 46px, with all 5 utility buttons and output card remaining comfortable to tap.
- **Narrow Width Mode (`@media (max-width: 340px)`)**: Optimized 8-10px side paddings with clean single-line truncation for song title, artist, badges (`white-space: nowrap`), and utility button labels.
- **Landscape Orientation (`@media (orientation: landscape) and (max-height: 520px)`)**: Pure CSS Grid 2-column layout (Artwork on left, controls and metadata on right) providing an elegant, scroll-free side-by-side experience.
- **Zero Functional Compromises**: Touch tracking for seek scrubbing, Like toggle, Shuffle/Repeat, secondary bottom sheets, and Android edge back navigation remain 100% intact.

---

## 5. Sleep Timer Engine Implementation (Phase 8.3)

### Core Capabilities
- **Canonical Single State**: Maintained inside `Player` with reactive events (`sleepTimerChange`, `sleepTimerTick`, `sleepTimerExpired`).
- **Timestamp-Driven Background Accuracy**: Derived directly from `Date.now()` and `expiresAt` without relying on interval accumulation, eliminating drift during mobile OS background throttling.
- **Full Presets & Custom Duration**: Supports 15m, 30m, 45m, 60m, 90m, Custom duration (5–180m with live slider feedback), and `+15 min` extension.
- **End of Current Song Mode**: Attaches cleanly to the `ended` event of HTML5 Audio, pausing only when the current song completes naturally.
- **Duplicate Timer Protection**: Setting any preset, custom duration, or cancellation immediately clears and replaces internal timeouts/intervals.
- **Non-Destructive Operations**: Changing tracks, starting radio, seeking, downloading, pausing/resuming, and app navigation never reset the sleep timer.
- **Full Player & Mini Player Sync**: Utility button `#btn-player-timer` dynamically reflects active remaining time (e.g. `14:32`) or `End Song` with red accent.

---

## 6. Comprehensive Regression Battery Results

| Test Suite | Tests | Result |
| :--- | :---: | :---: |
| [`test_sleep_timer.js`](file:///c:/Users/PC/AndroidStudioProjects/MUSICFLOW/web-app/test_sleep_timer.js) | 28 | **PASSED (100%)** ✅ |
| [`test_player_small_screen.js`](file:///c:/Users/PC/AndroidStudioProjects/MUSICFLOW/web-app/test_player_small_screen.js) | 25 | **PASSED (100%)** ✅ |
| [`test_audio_effects.js`](file:///c:/Users/PC/AndroidStudioProjects/MUSICFLOW/web-app/test_audio_effects.js) | 30 | **PASSED (100%)** ✅ |
| [`test_lyrics_sync.js`](file:///c:/Users/PC/AndroidStudioProjects/MUSICFLOW/web-app/test_lyrics_sync.js) | 20 | **PASSED (100%)** ✅ |
| [`test_back_navigation.js`](file:///c:/Users/PC/AndroidStudioProjects/MUSICFLOW/web-app/test_back_navigation.js) | 30 | **PASSED (100%)** ✅ |
| [`test_playback_source_resolution.js`](file:///c:/Users/PC/AndroidStudioProjects/MUSICFLOW/web-app/test_playback_source_resolution.js) | 21 | **PASSED (100%)** ✅ |
| [`test_player_interactions.js`](file:///c:/Users/PC/AndroidStudioProjects/MUSICFLOW/web-app/test_player_interactions.js) | 27 | **PASSED (100%)** ✅ |
| [`test_phase8_2_player_ui.js`](file:///c:/Users/PC/AndroidStudioProjects/MUSICFLOW/web-app/test_phase8_2_player_ui.js) | 34 | **PASSED (100%)** ✅ |
| *All 24 Test Suites in `web-app/`* | **615 / 615** | **PASSED (100%)** ✅ |

### Android Kotlin Build Verification
```powershell
gradlew.bat compileDebugKotlin
BUILD SUCCESSFUL in 2s
```
