# MusicFlow — GitHub Actions iOS IPA Build Walkthrough

### 1. GitHub Actions Build Triggered 🚀
The code and workflow have been pushed to GitHub on branch `main` ([commit `eaf6623`](https://github.com/adi6499/MUSIC-FLOW/commit/eaf6623)).

### 2. Workflow Details
- **Repository**: [https://github.com/adi6499/MUSIC-FLOW](https://github.com/adi6499/MUSIC-FLOW)
- **Actions Page**: [https://github.com/adi6499/MUSIC-FLOW/actions](https://github.com/adi6499/MUSIC-FLOW/actions)
- **Workflow**: `Build iOS IPA`
- **Runner**: `macos-14` (Apple Silicon M1/M2)
- **Steps Executed**:
  1. Checks out repository with full assets.
  2. Sets up Node.js 20.
  3. Runs `npm ci` and prepares Capacitor iOS.
  4. Configures background audio playback in `Info.plist`.
  5. Compiles native Mach-O Xcode release archive with `xcodebuild`.
  6. Packages into sideloadable unsigned `MusicFlow.ipa`.
  7. Uploads `MusicFlow-iOS-IPA` build artifact for direct download.

---

### 3. How to Download Your IPA File
1. Go to [https://github.com/adi6499/MUSIC-FLOW/actions](https://github.com/adi6499/MUSIC-FLOW/actions).
2. Click on the latest **"Build iOS IPA"** workflow run (under commit `feat: complete 100% web & android ui sync...`).
3. Once the green checkmark appears (typically ~2-3 minutes on macOS-14), scroll down to the **Artifacts** section.
4. Click **`MusicFlow-iOS-IPA`** to download your ready-to-sideload `.ipa` file (compatible with AltStore, Sideloadly, TrollStore, or Scarlet)!
