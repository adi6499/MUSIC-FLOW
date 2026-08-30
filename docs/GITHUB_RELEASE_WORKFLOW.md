# MusicFlow GitHub Release & Sideload Distribution Workflow

This guide details the end-to-end release process for sideloaded Android APK and iOS IPA builds of MusicFlow, powering the automated In-App Update System via Vercel Serverless and GitHub Releases.

---

## 1. Release Architecture Overview

```
                        ┌───────────────────────────────┐
                        │        GitHub Releases        │
                        │  - Tag: vX.Y.Z                │
                        │  - MusicFlow-Android-vX.Y.Z.apk│
                        │  - MusicFlow-iOS-vX.Y.Z.ipa   │
                        │  - Markdown Release Notes     │
                        └───────────────▲───────────────┘
                                        │
                                        │ (HTTPS REST API / Cached 10 min)
                                        │
                        ┌───────────────┴───────────────┐
                        │      Vercel Serverless        │
                        │       GET /api/update         │
                        └───────────────▲───────────────┘
                                        │
                         (Asynchronous / Throttled 12h)
                                        │
          ┌─────────────────────────────┴─────────────────────────────┐
          │                                                           │
┌───────────────────────┐                                   ┌───────────────────────┐
│  Android APK Sideload │                                   │   iOS IPA Sideload    │
│  - Prompts Update     │                                   │  - Prompts Update     │
│  - Downloads APK      │                                   │  - Opens IPA / AltStore│
│  - Android Installer  │                                   │  - Sideload Refresh   │
└───────────────────────┘                                   └───────────────────────┘
```

---

## 2. Release Steps

### Step 1: Bump Version Numbers Across Platforms
Ensure the version number (e.g., `2.7.0`) is synchronized across all build configuration files:

1. **Android (`app/build.gradle.kts`)**:
   ```kotlin
   defaultConfig {
       versionCode = 27
       versionName = "2.7.0"
   }
   ```
2. **iOS (`ios/App/App.xcodeproj/project.pbxproj` & `Info.plist`)**:
   ```xml
   <key>CFBundleShortVersionString</key>
   <string>2.7.0</string>
   ```
3. **Web / Update Manager (`web-app/js/updateManager.js`)**:
   ```javascript
   const APP_VERSION = '2.7.0';
   const BUILD_NUMBER = 27;
   ```
4. **`package.json`**:
   ```json
   {
     "version": "2.7.0"
   }
   ```

---

### Step 2: Build Sideloaded Binaries

#### A. Build Android APK
Run Gradle assemble release:
```bash
./gradlew assembleRelease
```
Copy and rename the output artifact:
- Source: `app/build/outputs/apk/release/app-release.apk` (signed)
- Target: `MusicFlow-Android-v2.7.0.apk`

#### B. Build iOS IPA
Run the IPA packaging script or Xcode Archive:
```bash
npm run build:ipa
```
Target binary:
- `MusicFlow-iOS-v2.7.0.ipa`

---

### Step 3: Create GitHub Release

1. Navigate to repository: [https://github.com/adi6499/MUSIC-FLOW/releases/new](https://github.com/adi6499/MUSIC-FLOW/releases/new)
2. **Tag version**: `v2.7.0` (Must begin with `v`)
3. **Release title**: `MusicFlow 2.7.0`
4. **Release description (Markdown)**:
   Use clean bullet points for automated in-app parsing:
   ```markdown
   ## What's New in MusicFlow 2.7.0

   - ✨ Overhauled recommendation engine with multi-signal taste profile
   - 🔍 Faster multi-signal search with typo tolerance and category chips
   - 💿 Full interactive Album details page and artist linking
   - 📻 Zero-interruption continuous Radio playback
   - 🎛️ 7-Band Web Audio Equalizer with 3D Spatial Audio
   - 🌊 60fps real-time sinusoidal wavy seek bar
   - 💾 Instant playlist persistence and YouTube playlist import
   - 📱 Native Android & iOS lock-screen media controls
   ```
5. **Attach Release Binaries**:
   Drag and drop the exact compiled assets:
   - `MusicFlow-Android-v2.7.0.apk`
   - `MusicFlow-iOS-v2.7.0.ipa`
6. Click **Publish release**.

---

## 3. Asset Naming Conventions

The Vercel Serverless Update API (`api/update.js`) identifies platform downloads using the following regex patterns:

| Platform | Primary Asset Name | Accepted Regex Pattern |
|---|---|---|
| **Android** | `MusicFlow-Android-v2.7.0.apk` | `.*android.*\.apk$` or `.*\.apk$` |
| **iOS** | `MusicFlow-iOS-v2.7.0.ipa` | `.*ios.*\.ipa$` or `.*\.ipa$` |

---

## 4. Minimum Supported Version & Force Updates

To enforce a mandatory update for deprecated versions, set the Vercel Environment Variable:

```
MINIMUM_SUPPORTED_VERSION = 2.0.0
```

When a user on version `< 2.0.0` opens the app:
- The in-app update dialog will display **Update Required**.
- The "Later" button and backdrop dismissal are disabled.
- The user must tap **Update MusicFlow** to obtain the new release.
