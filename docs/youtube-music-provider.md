# MusicFlow — Hybrid YouTube Music Provider Integration (Phase 6)

## 1. Executive Summary & Architecture Overview

MusicFlow integrates **YouTube Music** as a **secondary music provider** to dramatically expand long-tail catalog coverage, rich album discographies, automix radio mixes, and playlist imports, while strictly maintaining **JioSaavn** as the **primary playback provider** (delivering lossless 320kbps streams).

```
                      MUSICFLOW CLIENT
                    (Web / Android / iOS)
                             │
                      Provider Layer
                      (ProviderManager)
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
   JioSaavn Provider  YouTube Music Provider  Local Music Provider
   (PRIMARY Playback) (SECONDARY Coverage)     (Device / Downloads)
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                     Track Normalizer
                             │
                     Track Deduplicator
                             │
                      Typesense Search
                             │
                   Embeat Hybrid Ranker
                             │
                    Single Canonical Queue
                             │
                    MusicFlow Player
```

---

## 2. Component Roles & Guarantees

| Provider | Role | Playback Availability | Capabilities |
| :--- | :--- | :--- | :--- |
| **JioSaavn** | **Primary** | Full 320kbps Streams, Downloads | Instant playback, lossless streams, high-res covers, Hindi/Regional focus |
| **YouTube Music** | **Secondary** | Metadata & Fallback Matching | Global long-tail catalog, 50-track automix radio, playlist import, rich discographies |
| **Local Music** | **Offline/Local** | Local Blobs / ID3 Files | Device audio files, offline playback, gapless audio |

---

## 3. Provider Abstraction (`MusicProvider` & `ProviderManager`)

All providers implement the `MusicProvider` interface:

```javascript
class MusicProvider {
  search(query, options)
  getTrack(trackId)
  getArtist(artistIdOrName)
  getAlbum(albumId)
  getPlaylist(playlistId)
  getRelatedTracks(trackId, limit)
  getRadio(seedTrack, options)
  getLyrics(trackName, artistName, duration)
  checkHealth()
}
```

### Canonical Normalized Track Schema

Every track returned across all providers normalizes into the standard MusicFlow schema:

```typescript
interface MusicFlowTrack {
  id: string;                 // Canonical MusicFlow ID (e.g., "3791131" or "yt_NJAv_7lHUIU")
  name: string;               // Clean track title
  title: string;              // Alias
  artists: string;            // Formatted artist list
  primaryArtist: string;      // Main lead artist
  album: string;              // Album name
  albumId: string;            // Album identifier
  duration: number;           // Duration in seconds
  rawDuration: number|string; // Original duration string
  image: string;              // High-resolution artwork (500x500 HD)
  audioUrl: string;           // Direct playable audio stream URL (or empty)
  streamUrl: string;          // Direct stream URL
  downloadUrl: Array<{ quality: string, url: string }>;
  year: string;               // Release year
  language: string;           // Track language
  hasLyrics: boolean;         // Synchronized lyrics indicator
  provider: 'jiosaavn' | 'youtube_music' | 'local';
  providerId: string;         // Original provider ID
  metadataAvailable: boolean; // True across all valid metadata hits
  playbackAvailable: boolean; // True only when valid playback stream exists
}
```

---

## 4. Search Pipeline & Deduplication

### Parallel Federated Search
When a user searches in MusicFlow:
1. `ProviderManager` queries JioSaavn and YouTube Music in parallel with a strict 4-second timeout to prevent network stalls.
2. If JioSaavn responds quickly, results are immediately presented. If one provider fails or is degraded, the other provider continues seamlessly.

### Cross-Provider Deduplication
`TrackDeduplicator` clusters tracks by `cleanTitle:::cleanArtist`.
When duplicate recordings are detected between JioSaavn and YouTube Music:
- **JioSaavn is given priority** because it contains a verified 320kbps playback stream.
- The JioSaavn track is selected as canonical, avoiding visually identical duplicate search cards.

### YouTube Long-Tail Expansion
If a song is absent from JioSaavn but present in YouTube Music (e.g. niche covers, international tracks, indie singles):
- The YouTube Music result is displayed with full metadata and artist credits.
- `playbackAvailable` is determined when the user requests playback.

---

## 5. Playback Source Resolution & Fallback Strategy

> [!IMPORTANT]
> **Metadata Availability != Playback Availability**
> MusicFlow does not decipher or scrape protected YouTube audio streams, and adheres to MIT/open API standards.

When a user taps play on a YouTube Music track:
1. `resolvePlaybackSource` in `Player` checks for a cached or local stream.
2. If none is found, it performs an automatic high-confidence query on the JioSaavn catalog (matching on `cleanTitle` and `primaryArtist`).
3. If a matching recording exists on JioSaavn, its high-quality 320kbps stream is dynamically attached.
4. If no legitimate stream exists, `playbackAvailable: false` is gracefully reported to the user without crashing the playback queue or advancing unexpectedly.

---

## 6. Continuous Radio Mixes & Playback Continuity

### Zero-Restart Playback Preservation (Critical Rule)
When a user starts Radio for the currently playing track:
- **The currently playing song continues uninterrupted.**
- `currentTime` is strictly preserved.
- `play()` is never called unnecessarily.
- The upcoming queue is populated with 10–25 automix candidates (`RDAMVM...` Innertube automix), deduplicated and ranked via the Embeat recommendation engine.

### Continuous Queue Refill
When remaining upcoming tracks fall to $\le 3$, `autoPopulateContinuousQueue` requests additional candidates in the background and appends them to the queue.

---

## 7. YouTube Playlist Import

Users can import public YouTube / YouTube Music playlists:
1. **Flow**: Library > Playlists > "Import YT" button.
2. **URL Matching**: User pastes YouTube playlist link (e.g., `https://music.youtube.com/playlist?list=...` or playlist ID).
3. **Server-Side Matching**: Backend retrieves tracklist and matches each item against the catalog using title, artist, and duration.
4. **Summary**: UI displays:
   - Found: $N$ tracks
   - Matched: $M$ playable tracks
   - Unavailable: $K$ metadata-only tracks
5. **Playlist Creation**: User saves the imported playlist to their local storage. The playlist supports Play All, Shuffle, Queue, and Radio.
6. **Recommendation Signal**: Imported tracks are recorded as an `imported` taste profile signal (weighed appropriately below direct `played` and `liked` signals).

---

## 8. Security & Credentials Protection

- **Server-Side Only**: All Innertube API and upstream communication occurs in `server.js` and `youtubeMusicService.js`.
- **Zero Token Leakage**: No API keys, OAuth tokens, private cookies, or internal session headers are transmitted to Web, Android, or iOS clients.
- **Health Monitoring**: `/api/providers/health` provides real-time health checks without leaking backend credentials.

---

## 9. Licensing & Intellectual Property Audit

- **SimpMusic (GPL-3.0)**: Zero source code from SimpMusic or maxrave-dev/core was copied or ported.
- **ytmusicapi (MIT)**: Architecture and public WEB_REMIX Innertube API schemas referenced only as MIT-compliant specifications.
- **LRCLIB**: Synced lyrics integration remains independent.
