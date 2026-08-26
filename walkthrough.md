# MusicFlow — iPhone Edge-to-Edge & Lock Screen Controls Walkthrough

### 1. Fixed iPhone Bottom Black Area (Edge-to-Edge Layout)
- **Viewport & Insets**:
  - Updated `capacitor.config.json` with `"contentInset": "never"` and `"backgroundColor": "#050505"`.
  - Configured `html, body, .app-container` with `100dvh`, `-webkit-fill-available`, and `position: fixed; inset: 0;` to stretch across the physical display without leaving any black gap below the home bar.
  - Recalculated `.floating-bottom-nav` (`calc(12px + env(safe-area-inset-bottom, 10px))`) and `.mini-player-dock` (`calc(82px + env(safe-area-inset-bottom, 10px))`) to float above the iPhone home indicator seamlessly.

### 2. Lock Screen Background Playback & Full Media Controls (iOS & Android)
- **Non-blocking Audio Pipeline**:
  - Prevented automatic WebAudio API suspension from pausing audio when the device is locked.
  - HTML5 audio streams run natively through the hardware audio pipeline with `UIBackgroundModes: ["audio"]`.
- **Full Lock Screen Controls & Scrubber**:
  - Registered full MediaSession handlers (`play`, `pause`, `previoustrack`, `nexttrack`, `seekto`, `seekbackward`, `seekforward`, `stop`).
  - Added real-time `navigator.mediaSession.setPositionState()` for the lock screen scrubber and Dynamic Island widget.
  - Added visibility and page lifecycle listeners to ensure audio never pauses when switching apps or locking the device.

---

### 3. Live GitHub Actions Build Link
👉 **[View Live iOS Build Run (Run #32998416682)](https://github.com/adi6499/MUSIC-FLOW/actions/runs/32998416682)**
