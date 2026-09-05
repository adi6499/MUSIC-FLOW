# Walkthrough - Related Songs Playback & Drawer Upgrades

## Overview
1. **Listen Again & Single Track Queue Auto-Population**: Tapping any song in "Listen Again" or individual track cards supplies recent history context and immediately initiates `autoPopulateContinuousQueue(song)`, ensuring `UP NEXT` is populated with continuous recommendations rather than ending after 1 song.
2. **Resilient RELATED Tab Multi-Channel Retrieval**: Eliminated the "Play a track to see related music" blank state. `renderDrawerRelated` now resolves the current track across Player active track, active queue index, queue fallback, and playback history. Recommendations are retrieved across 6 parallel channels (`API.getArtistSongs`, `API.searchSongs` hits, `API.getSimilarSongs`, automix candidates, artist plain search, and catalog pool) alongside dynamic similar artists.
3. **Endless Queue Playback Continuity**: In `player.js`, playback never runs dry or ends abruptly. When within `<= 4` tracks of queue end or when `next()` is called at the boundary, new recommendations are automatically fetched and appended to keep playback flowing infinitely.
4. **UP NEXT vs RELATED Deduplication**: Strictly separated recommendations from the active queue. Filtered out the currently playing track and all tracks in `UP NEXT` from appearing in `RELATED`.
5. **Auto-Skip on Unplayable / Missing Songs**: Implemented rapid 350ms auto-skipping when audio sources fail or are missing, along with toast notifications. Added queue pre-filtering (`isValidQueueTrack`) to ensure corrupt or empty tracks never enter the queue.
6. **Header Collapse Button Relocation (`RELATEDv` Fix)**: Relocated `#btn-collapse-drawer` into `.drawer-drag-bar`, ensuring the 3 tabs (`UP NEXT`, `LYRICS`, `RELATED`) have 100% equal flex symmetry and zero overlap.
7. **App Update Redirection Fix**: Fixed the issue where updating the app redirected users to the GitHub repository instead of the official website where the Android APK is hosted.
8. **Playlist & Chart Song List Navigation Fix**: Fixed the issue where tapping a playlist or trending chart card directly started playing song #1 instead of opening the playlist's full song list screen.

---

## Changes

### 1. Playlist Detail Navigation Controller (`app.js`)
- [app.js](file:///c:/Users/PC/AndroidStudioProjects/MUSICFLOW/web-app/js/app.js#L4511-L4575)
  - Implemented `openPlaylist(playlistId, playlistTitle, addToHistory = true)`.
  - Replaced the direct `Player.setQueue(); expandFullPlayer();` autoplay behavior in `openAlbumOrPlaylist()` with `openPlaylist(id, title)`.
  - Configured `openPlaylist()` to check custom storage playlists first, fetch full playlist details with track lists via `API.getPlaylistDetails()`, and fallback to title matching if needed.
  - Activated `screen-detail` and pushed history for seamless back navigation (`App.goBack()`).
  - Exported `openPlaylist` on the `App` object.

### 2. Universal Detail View & Card Click Handlers (`ui.js`)
- [ui.js](file:///c:/Users/PC/AndroidStudioProjects/MUSICFLOW/web-app/js/ui.js#L438-L470)
  - Updated `renderTrendingCharts` and `renderAlbums` to pass sanitized title and artist parameters to `App.openAlbumOrPlaylist()`.
  - Updated `renderAlbumDetail` to detect playlists (`isPlaylist`), displaying the `PLAYLIST` source tag, formatted playlist metadata, and complete track list with individual track click-to-play, shuffle, radio, and download buttons.

### 3. Update Redirection Protection (`updateManager.js`)
- [updateManager.js](file:///c:/Users/PC/AndroidStudioProjects/MUSICFLOW/web-app/js/updateManager.js#L275-L335)
  - Configured `OFFICIAL_WEBSITE_URL = 'https://adi6499.github.io/MUSICFLOW/'`.
  - Added strict URL sanitization (`sanitizeTargetUrl`) that rejects any `github.com` URLs and redirects users to the official website where the Android APK download is hosted.
  - Implemented `openWebsite()` and updated `openUpdate()` and `openReleasePage()` to always open the official website instead of GitHub releases.

### 4. Update Actions & UI Integration (`index.html`, `app.js`, `ui.js`)
- [index.html](file:///c:/Users/PC/AndroidStudioProjects/MUSICFLOW/web-app/index.html#L1993)
  - Replaced the "View Release / View on GitHub" button with an "Official Website" button invoking `App.openWebsite()`.
- [app.js](file:///c:/Users/PC/AndroidStudioProjects/MUSICFLOW/web-app/js/app.js#L4820-L4835)
  - Updated `openUpdateDownload()`, `openGitHubRelease()`, and `openWebsite()` to redirect users safely to the website.
- [ui.js](file:///c:/Users/PC/AndroidStudioProjects/MUSICFLOW/web-app/js/ui.js#L3009)
  - Changed checking indicator text from `"Checking GitHub Releases..."` to `"Checking for updates..."`.

### 5. Update Metadata & APIs (`api/update.js`, `version.json`, `update.json`)
- [api/update.js](file:///c:/Users/PC/AndroidStudioProjects/MUSICFLOW/api/update.js#L195)
  - Configured `releaseUrl` and fallback download endpoints to direct users to the official website and `https://adi6499.github.io/MUSICFLOW/downloads/MusicFlow.apk`.
- [version.json](file:///c:/Users/PC/AndroidStudioProjects/MUSICFLOW/website/version.json#L18) and [update.json](file:///c:/Users/PC/AndroidStudioProjects/MUSICFLOW/website/api/update.json#L18)
  - Updated `releaseUrl` to `https://adi6499.github.io/MUSICFLOW/`.

### 6. Player Module & Related Songs Drawer (`player.js`, `app.js`)
- [player.js](file:///c:/Users/PC/AndroidStudioProjects/MUSICFLOW/web-app/js/player.js#L1523)
  - Exported `playTrack: playSong` in the Player return object.
- [app.js](file:///c:/Users/PC/AndroidStudioProjects/MUSICFLOW/web-app/js/app.js#L3253-L3350)
  - Added safe index-based handler `playRelatedTrack(idx)`.
  - Replaced inline JSON stringification in DOM onclick attributes with `onclick="App.playRelatedTrack(${idx})"`.

### 7. Queue Filtering & Swift Auto-Skip (`player.js`)
- [player.js](file:///c:/Users/PC/AndroidStudioProjects/MUSICFLOW/web-app/js/player.js)
  - Added `isValidQueueTrack(t)` filter to `setQueue`, `appendToQueue`, `insertNext`, and `startRadioQueue` so unplayable, null, or empty tracks never enter the playback queue.
  - Implemented fast 350ms auto-skip in audio `error` event listener and `requestTrackPlayback` catch block with informative toast message (`"${title}" unavailable, skipping...`).
  - Updated `next()` and `previous()` to search ahead for the next playable track (`track.isPlayable !== false`), skipping corrupt or unplayable items smoothly.

### 8. Related Tab Deduplication & Queue Actions (`app.js`, `index.html`, `app.css`)
- [app.js](file:///c:/Users/PC/AndroidStudioProjects/MUSICFLOW/web-app/js/app.js)
  - Implemented `isAlreadyInQueueOrCurrent(item)` in `renderDrawerRelated()`, checking ID, providerId, videoId, and normalized title against `Player.getCurrentTrack()` and `Player.getQueue()`.
  - Enriched related tracks with artist top hits when candidates are low (< 8).
  - Added "Play Next" (`playlist_play` icon) and "Add to Queue" (`playlist_add` icon) action buttons to each related track row.
  - Exported `queueRelatedTrackNext` and `queueRelatedTrackEnd` on `App`.
  - Updated `playRelatedTrack(idx)` to use `Player.insertNext(track); Player.next();` to preserve existing queue.
- [index.html](file:///c:/Users/PC/AndroidStudioProjects/MUSICFLOW/web-app/index.html) & [app.css](file:///c:/Users/PC/AndroidStudioProjects/MUSICFLOW/web-app/css/app.css)
  - Relocated `#btn-collapse-drawer` into `.drawer-drag-bar` to eliminate `RELATEDv` overlap.
  - Gave all 3 drawer tabs equal flex distribution and centered indicator underlines.

---

## Verification Results
- **All User Fixes Suite (Queue, Related, Albums, Filters, Local Playback, Continuous Queue)**:
  - `node web-app/test_all_user_fixes.js`: 23/23 PASSED (100%)
- **Listen Again & Continuous Playback Queue Verification**:
  - `node web-app/test_listen_again_and_continuous_queue.js`: 5/5 PASSED (100%)
- **Drawer Closability & Playback Tests**:
  - `node web-app/test_ytm_drawer_fix.js`: 12/12 PASSED (100%)
- **In-App Update System Tests**:
  - `node web-app/test_update_system.js`: 24/24 PASSED (100%)
- **Full Comprehensive Regression Suite**:
  - `node web-app/test_comprehensive_pass.js`: 20/20 PASSED (100%)

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
| [`test_ytm_player_drawer.js`](file:///c:/Users/PC/AndroidStudioProjects/MUSICFLOW/web-app/test_ytm_player_drawer.js) | 7 | **PASSED (100%)** ✅ |
| [`test_ytm_drawer_fix.js`](file:///c:/Users/PC/AndroidStudioProjects/MUSICFLOW/web-app/test_ytm_drawer_fix.js) | 12 | **PASSED (100%)** ✅ |
| *All 26 Test Suites in `web-app/`* | **654 / 654** | **PASSED (100%)** ✅ |

---

## 7. YouTube Music Up Next Drawer & Real Comments Integration

### 1. Up Next Drawer Closability & Gesture Support
- **Dedicated Collapse Button**: Added `#btn-collapse-drawer` in the drawer header with `keyboard_arrow_down` icon and smooth click/active animations.
- **Backdrop Dismissal**: Added `#player-drawer-backdrop` (`position: absolute; inset: 0; background: rgba(0,0,0,0.65); backdrop-filter: blur(2px)`) that closes the drawer when tapped.
- **Re-tap Active Tab to Collapse**: Tapping the active drawer tab (e.g. UP NEXT) while expanded now collapses the drawer instantly.
- **Touch Gesture Pull-Down**: Added touch event tracking on drawer handle/nav header (`initDrawerGestures`) allowing users to swipe downward (>40px) to collapse.
- **Android Back Navigation**: Integrated `collapsePlayerDrawer()` into `handlePlayerBack()` so pressing the back button or hardware back collapses the drawer first before dismissing the player.

### 2. Queue Cover Thumbnail Constraints
- Fixed `.queue-track-thumb` with strict sizing:
  ```css
  .queue-track-thumb {
    width: 44px;
    height: 44px;
    min-width: 44px;
    max-width: 44px;
    border-radius: 6px;
    object-fit: cover;
    background: #222;
  }
  ```
- Eliminates the oversized album image issue and establishes clean horizontal queue rows.

### 5. Full Player Height Clearance & Transport Visibility
- Fixed `.player-3d-deck-container` hardcoded `height: 320px` which pushed the transport row off the viewport edge.
- Replaced with dynamic responsive clamp: `width: min(72vw, min(32vh, 280px)); height: min(72vw, min(32vh, 280px));` with breakpoints at `max-height: 720px` (220px) and `max-height: 600px` (170px).
- Ensured `.player-transport-row` and play button always sit comfortably above the 48px collapsed drawer without any overlap or cut-off.

### 6. Server-Backed Related Recommendations & Similar Artists Shelf
- Wired `renderDrawerRelated()` to query the server-side `/api/providers/ytmusic/radio` endpoint directly, bypassing browser CORS issues.
- Added graceful fallbacks to YouTube Music Search, local song pool, and JioSaavn candidates.
- Added dynamic rendering for `#drawer-related-artists` showing circular artist cards with single-click navigation.


