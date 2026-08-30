// ==========================================================================
// MUSICFLOW — YOUTUBE MUSIC INNERTUBE SERVICE (Server-Side)
// MIT-compliant YouTube Music Innertube API adapter with in-memory caching.
// ==========================================================================

const YTM_BASE_URL = 'https://music.youtube.com/youtubei/v1';

const YTM_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'X-YouTube-Client-Name': '67',
  'X-YouTube-Client-Version': '1.20240101.01.00',
  'Origin': 'https://music.youtube.com',
  'Referer': 'https://music.youtube.com/'
};

const YTM_CONTEXT = {
  client: {
    clientName: 'WEB_REMIX',
    clientVersion: '1.20240101.01.00',
    hl: 'en',
    gl: 'US'
  }
};

// In-Memory Cache with TTL (5 minutes)
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getFromCache(key) {
  const item = cache.get(key);
  if (item && (Date.now() - item.time < CACHE_TTL_MS)) {
    return item.data;
  }
  return null;
}

function setInCache(key, data) {
  cache.set(key, { data, time: Date.now() });
  if (cache.size > 500) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

// Utility: Clean image URL to high resolution
function getHighResImage(thumbnails) {
  if (!thumbnails || !Array.isArray(thumbnails) || thumbnails.length === 0) {
    return 'assets/logo.png';
  }
  const last = thumbnails[thumbnails.length - 1];
  let url = last?.url || 'assets/logo.png';
  if (url.startsWith('//')) url = 'https:' + url;
  // Upgrade googleusercontent / ytimg size params to 500x500
  url = url.replace(/=w\d+-h\d+.*$/, '=w500-h500-l90-rj');
  return url;
}

// Utility: Parse duration string (e.g. "3:45", "1:02:15") to seconds
function parseDurationSec(durationStr) {
  if (!durationStr || typeof durationStr !== 'string') return 0;
  const parts = durationStr.split(':').map(p => parseInt(p.trim(), 10));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

// Utility: Extract playlist ID from various URL formats
function extractPlaylistId(input) {
  if (!input) return '';
  const str = String(input).trim();
  const match = str.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9_-]+$/.test(str)) return str;
  return str;
}

// Utility: Extract single Video ID from URL or string
function extractVideoId(input) {
  if (!input) return '';
  const str = String(input).trim();
  const shortMatch = str.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch && shortMatch[1]) return shortMatch[1];
  const vMatch = str.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (vMatch && vMatch[1]) return vMatch[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(str) && !str.startsWith('VL') && !str.startsWith('PL')) return str;
  return '';
}

/**
 * Execute YouTube Music Innertube API request
 */
async function callInnertube(endpoint, body) {
  const url = `${YTM_BASE_URL}/${endpoint}`;
  const payload = {
    context: YTM_CONTEXT,
    ...body
  };

  // If running in Android APK, route through native OkHttp to bypass all WebView CORS/origin restrictions
  if (typeof window !== 'undefined' && window.AndroidMediaBridge && typeof window.AndroidMediaBridge.executeHttpRequest === 'function') {
    try {
      const resStr = window.AndroidMediaBridge.executeHttpRequest(
        url,
        'POST',
        JSON.stringify(YTM_HEADERS),
        JSON.stringify(payload)
      );
      const resObj = JSON.parse(resStr || '{}');
      if (resObj.success && resObj.data) {
        return JSON.parse(resObj.data);
      } else if (resObj.status && resObj.status !== 200) {
        console.warn(`[YouTubeMusicService] Native OkHttp returned status ${resObj.status}`);
      }
    } catch (bridgeErr) {
      console.warn('[YouTubeMusicService] Native bridge fetch fallback:', bridgeErr.message);
    }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: YTM_HEADERS,
    body: JSON.stringify(payload),
    signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(9000) : undefined
  });

  if (!res.ok) {
    throw new Error(`Innertube HTTP ${res.status} for ${endpoint}`);
  }

  return res.json();
}

/**
 * Parse an item renderer (Song, Video, Artist, Album, Playlist)
 */
function parseMusicItem(item) {
  if (!item) return null;
  const renderer = item.musicResponsiveListItemRenderer || item.musicCardShelfRenderer;
  if (!renderer) return null;

  // Title
  const titleRuns = renderer.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
  const title = titleRuns?.[0]?.text || renderer.title?.runs?.[0]?.text || '';
  const videoId = renderer.playlistItemData?.videoId || 
    titleRuns?.[0]?.navigationEndpoint?.watchEndpoint?.videoId ||
    renderer.navigationEndpoint?.watchEndpoint?.videoId || '';

  // Flex column 1: Type, Artist, Album, Duration, Plays
  const flex1Runs = renderer.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
  let artist = '';
  let album = '';
  let duration = '';
  let itemType = 'song';

  const texts = flex1Runs.map(r => r.text).filter(t => t && t !== ' • ' && t !== '•');
  if (texts.length > 0) {
    const firstLower = texts[0].toLowerCase();
    if (firstLower === 'song' || firstLower === 'video' || firstLower === 'artist' || firstLower === 'album' || firstLower === 'playlist') {
      itemType = firstLower;
      artist = texts[1] || '';
      album = texts[2] || '';
      duration = texts[3] || '';
    } else {
      artist = texts[0] || '';
      album = texts[1] || '';
      duration = texts[2] || '';
    }
  }

  // Browse IDs
  const artistRun = flex1Runs.find(r => r.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('UC'));
  const artistBrowseId = artistRun?.navigationEndpoint?.browseEndpoint?.browseId || '';

  const albumRun = flex1Runs.find(r => r.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('MPRE'));
  const albumBrowseId = albumRun?.navigationEndpoint?.browseEndpoint?.browseId || '';

  // Thumbnails
  const thumbs = renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;
  const image = getHighResImage(thumbs);

  return {
    id: `yt_${videoId || Math.random().toString(36).substring(2, 9)}`,
    videoId: videoId,
    name: title,
    title: title,
    artists: artist || 'YouTube Music',
    primaryArtist: (artist || 'YouTube Music').split(/[,&/]/)[0].trim(),
    artistBrowseId,
    album: album,
    albumBrowseId,
    duration: parseDurationSec(duration),
    image: image,
    type: itemType,
    provider: 'youtube_music',
    providerId: videoId,
    metadataAvailable: true,
    playbackAvailable: false
  };
}

const YouTubeMusicService = {
  /**
   * Unified Search across YouTube Music catalog
   */
  async search(query, limit = 30) {
    const cleanQ = (query || '').trim();
    if (!cleanQ) return { songs: [], artists: [], albums: [], playlists: [] };

    const cacheKey = `search_${cleanQ}_${limit}`;
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const data = await callInnertube('search', { query: cleanQ });
      const sections = data.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];

      const songs = [];
      const artists = [];
      const albums = [];
      const playlists = [];

      for (const sec of sections) {
        // Direct card shelf (Top result)
        if (sec.musicCardShelfRenderer) {
          const topItem = parseMusicItem({ musicCardShelfRenderer: sec.musicCardShelfRenderer });
          if (topItem && topItem.videoId) songs.push(topItem);
          const shelfContents = sec.musicCardShelfRenderer.contents || [];
          shelfContents.forEach(c => {
            const parsed = parseMusicItem(c);
            if (parsed && parsed.videoId) songs.push(parsed);
          });
        }

        // Section list items
        const itemSec = sec.itemSectionRenderer?.contents?.[0];
        if (itemSec?.musicResponsiveListItemRenderer) {
          const parsed = parseMusicItem(itemSec);
          if (parsed) {
            if (parsed.type === 'artist') artists.push(parsed);
            else if (parsed.type === 'album') albums.push(parsed);
            else if (parsed.type === 'playlist') playlists.push(parsed);
            else if (parsed.videoId) songs.push(parsed);
          }
        }

        if (itemSec?.musicShelfRenderer) {
          const contents = itemSec.musicShelfRenderer.contents || [];
          contents.forEach(c => {
            const parsed = parseMusicItem(c);
            if (parsed && parsed.videoId) songs.push(parsed);
          });
        }
      }

      // Deduplicate songs by videoId
      const uniqueSongs = [];
      const seenVideoIds = new Set();
      for (const s of songs) {
        if (s.videoId && !seenVideoIds.has(s.videoId)) {
          seenVideoIds.add(s.videoId);
          uniqueSongs.push(s);
        }
      }

      const result = {
        songs: uniqueSongs.slice(0, limit),
        artists: artists.slice(0, 10),
        albums: albums.slice(0, 10),
        playlists: playlists.slice(0, 10)
      };

      setInCache(cacheKey, result);
      return result;
    } catch (err) {
      console.warn('[YouTubeMusicService] search failed:', err.message);
      return { songs: [], artists: [], albums: [], playlists: [] };
    }
  },

  /**
   * Get Automix Radio Candidates for a seed track
   */
  async getRadioCandidates(videoId, seedTitle = '', seedArtist = '', limit = 25) {
    let resolvedVideoId = videoId;

    // If videoId is missing, resolve by searching seed title + artist
    if (!resolvedVideoId && (seedTitle || seedArtist)) {
      const searchRes = await this.search(`${seedTitle} ${seedArtist}`.trim(), 3);
      if (searchRes.songs.length > 0) {
        resolvedVideoId = searchRes.songs[0].videoId;
      }
    }

    if (!resolvedVideoId) return { candidates: [], resolvedVideoId: null };

    const cacheKey = `radio_${resolvedVideoId}_${limit}`;
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    try {
      // Automix playlist ID format: RDAMVM + videoId
      const data = await callInnertube('next', {
        videoId: resolvedVideoId,
        playlistId: `RDAMVM${resolvedVideoId}`
      });

      const tabs = data.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs || [];
      const queueItems = tabs[0]?.tabRenderer?.content?.musicQueueRenderer?.content?.playlistPanelRenderer?.contents || [];

      const candidates = [];
      for (const item of queueItems) {
        const it = item.playlistPanelVideoRenderer || item.playlistPanelVideoWrapperRenderer?.primaryRenderer?.playlistPanelVideoRenderer;
        if (!it || !it.videoId) continue;

        const title = it.title?.runs?.[0]?.text || '';
        const byline = it.shortBylineText?.runs?.[0]?.text || '';
        const durationStr = it.lengthText?.runs?.[0]?.text || '';
        const thumbs = it.thumbnail?.thumbnails || [];

        candidates.push({
          id: `yt_${it.videoId}`,
          videoId: it.videoId,
          name: title,
          title: title,
          artists: byline,
          primaryArtist: byline.split(/[,&/]/)[0].trim(),
          duration: parseDurationSec(durationStr),
          image: getHighResImage(thumbs),
          provider: 'youtube_music',
          providerId: it.videoId,
          metadataAvailable: true,
          playbackAvailable: false
        });
      }

      const result = {
        seedVideoId: resolvedVideoId,
        candidates: candidates.slice(0, limit)
      };

      setInCache(cacheKey, result);
      return result;
    } catch (err) {
      console.warn('[YouTubeMusicService] getRadioCandidates failed:', err.message);
      return { seedVideoId: resolvedVideoId, candidates: [] };
    }
  },

  /**
   * Get Artist Profile & Discography
   */
  async getArtist(browseId, artistName = '') {
    let targetBrowseId = browseId;
    if (!targetBrowseId && artistName) {
      const searchRes = await this.search(artistName, 5);
      if (searchRes.artists.length > 0 && searchRes.artists[0].artistBrowseId) {
        targetBrowseId = searchRes.artists[0].artistBrowseId;
      }
    }

    if (!targetBrowseId) return { artist: null };

    const cacheKey = `artist_${targetBrowseId}`;
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const data = await callInnertube('browse', { browseId: targetBrowseId });
      const name = data.header?.musicImmersiveHeaderRenderer?.title?.runs?.[0]?.text || artistName || 'Artist';
      const listeners = data.header?.musicImmersiveHeaderRenderer?.description?.runs?.[0]?.text || '';
      const heroThumbs = data.header?.musicImmersiveHeaderRenderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];

      const sections = data.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
      const topSongs = [];
      const albums = [];

      for (const sec of sections) {
        const k = Object.keys(sec)[0];
        const shelf = sec[k];
        const title = (shelf?.title?.runs?.[0]?.text || shelf?.header?.musicHeaderRenderer?.title?.runs?.[0]?.text || '').toLowerCase();

        if (title.includes('song')) {
          const contents = shelf?.contents || [];
          contents.forEach(c => {
            const parsed = parseMusicItem(c);
            if (parsed && parsed.videoId) topSongs.push(parsed);
          });
        } else if (title.includes('album') || title.includes('single')) {
          const items = shelf?.contents || shelf?.items || [];
          items.forEach(c => {
            const parsed = parseMusicItem(c);
            if (parsed) albums.push(parsed);
          });
        }
      }

      const result = {
        artist: {
          id: targetBrowseId,
          name: name,
          image: getHighResImage(heroThumbs),
          listeners: listeners,
          topSongs: topSongs.slice(0, 10),
          albums: albums.slice(0, 10)
        }
      };

      setInCache(cacheKey, result);
      return result;
    } catch (err) {
      console.warn('[YouTubeMusicService] getArtist failed:', err.message);
      return { artist: null };
    }
  },

  /**
   * Get Album Details & Tracklist
   */
  async getAlbum(browseId) {
    if (!browseId) return { album: null };

    const cacheKey = `album_${browseId}`;
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const data = await callInnertube('browse', { browseId });
      const header = data.header?.musicDetailHeaderRenderer;
      const title = header?.title?.runs?.[0]?.text || 'Album';
      const subtitle = header?.subtitle?.runs?.map(r => r.text).join('') || '';
      const thumbs = header?.thumbnail?.croppedMusicThumbnailRenderer?.thumbnail?.thumbnails || [];

      const sec = data.contents?.twoColumnBrowseResultsRenderer?.secondaryContents?.sectionListRenderer?.contents?.[0];
      const items = sec?.musicShelfRenderer?.contents || [];
      const songs = items.map(parseMusicItem).filter(Boolean);

      const result = {
        album: {
          id: browseId,
          name: title,
          title: title,
          subtitle: subtitle,
          image: getHighResImage(thumbs),
          songs: songs
        }
      };

      setInCache(cacheKey, result);
      return result;
    } catch (err) {
      console.warn('[YouTubeMusicService] getAlbum failed:', err.message);
      return { album: null };
    }
  },

  /**
   * Get Playlist Details & Tracks
   */
  async getPlaylist(playlistUrlOrId) {
    const rawId = extractPlaylistId(playlistUrlOrId);
    if (!rawId) return { playlist: null };

    const browseId = rawId.startsWith('VL') ? rawId : `VL${rawId}`;
    const cacheKey = `pl_${browseId}`;
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const data = await callInnertube('browse', { browseId });
      const header = data.header?.musicDetailHeaderRenderer || data.header?.musicEditablePlaylistDetailHeaderRenderer?.header?.musicDetailHeaderRenderer;
      const title = header?.title?.runs?.[0]?.text || 'YouTube Playlist';
      const description = header?.description?.runs?.[0]?.text || '';
      const thumbs = header?.thumbnail?.croppedMusicThumbnailRenderer?.thumbnail?.thumbnails || [];

      const sections = data.contents?.twoColumnBrowseResultsRenderer?.secondaryContents?.sectionListRenderer?.contents
        || data.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents
        || data.contents?.sectionListRenderer?.contents
        || [];

      let items = [];
      for (const sec of sections) {
        const shelf = sec.musicPlaylistShelfRenderer || sec.musicShelfRenderer;
        if (shelf && shelf.contents) {
          items = shelf.contents;
          break;
        }
      }

      const songs = [];
      for (const it of items) {
        const parsed = parseMusicItem(it);
        if (parsed && parsed.name) {
          songs.push(parsed);
        }
      }

      const result = {
        playlist: {
          id: rawId,
          browseId: browseId,
          name: title,
          description: description,
          image: getHighResImage(thumbs),
          songCount: songs.length,
          songs: songs
        }
      };

      setInCache(cacheKey, result);
      return result;
    } catch (err) {
      console.warn('[YouTubeMusicService] getPlaylist failed:', err.message);
      return { playlist: null };
    }
  },

  /**
   * Import Single YouTube Track & Match against JioSaavn / MusicFlow Catalog
   */
  async importTrack(urlOrVideoId) {
    const rawInput = String(urlOrVideoId || '').trim();
    const videoId = extractVideoId(rawInput);
    if (!videoId) {
      throw new Error('Invalid YouTube URL or Video ID');
    }

    let ytTitle = 'YouTube Track';
    let ytAuthor = 'YouTube Music';
    let ytThumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    // 1. Fetch real video metadata via oEmbed
    try {
      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, {
        signal: AbortSignal.timeout(4000)
      });
      if (oembedRes.ok) {
        const oembedData = await oembedRes.json();
        if (oembedData.title) ytTitle = oembedData.title;
        if (oembedData.author_name) ytAuthor = oembedData.author_name;
        if (oembedData.thumbnail_url) ytThumbnail = oembedData.thumbnail_url;
      }
    } catch (_) {}

    let cleanArtist = ytAuthor.replace(/ - Topic$/i, '').trim();
    let cleanTitle = ytTitle;
    if (ytTitle.includes(' - ')) {
      const parts = ytTitle.split(' - ');
      cleanArtist = parts[0].trim().replace(/ - Topic$/i, '');
      cleanTitle = parts.slice(1).join(' - ').trim();
    }
    cleanTitle = cleanTitle.replace(/\(.*?\)|\[.*?\]|feat\..*|ft\..*|official.*|video/gi, '').trim();

    let ytTrack = {
      id: `yt_${videoId}`,
      videoId: videoId,
      name: ytTitle,
      title: ytTitle,
      artists: cleanArtist,
      primaryArtist: cleanArtist,
      album: cleanTitle,
      duration: 0,
      durationSeconds: 0,
      image: ytThumbnail,
      provider: 'youtube_music',
      providerId: videoId,
      source: 'youtube_music',
      sourceId: videoId,
      isPlayable: true,
      metadataAvailable: true,
      playbackAvailable: true
    };

    let matchedSong = ytTrack;

    // 2. Try matching against JioSaavn 320kbps catalog
    try {
      const searchQuery = `${cleanTitle} ${cleanArtist}`.trim() || `https://youtu.be/${videoId}`;
      const saavnBase = (typeof ApiConfig !== 'undefined' && typeof ApiConfig.getJioSaavnApiBase === 'function')
        ? ApiConfig.getJioSaavnApiBase()
        : 'https://spoton-trpn.vercel.app/api';
      const saavnRes = await fetch(`${saavnBase}/search/songs?query=${encodeURIComponent(searchQuery)}&limit=3`, {
        signal: AbortSignal.timeout(5000)
      }).then(r => r.ok ? r.json() : null).catch(() => null);

      const candidateList = saavnRes?.data?.results || saavnRes?.results || [];
      if (candidateList.length > 0) {
        const bestMatch = candidateList[0];
        const streamUrl = (Array.isArray(bestMatch.downloadUrl) && bestMatch.downloadUrl.length > 0)
          ? (bestMatch.downloadUrl.find(u => (u.quality || '').includes('320'))?.url || bestMatch.downloadUrl[bestMatch.downloadUrl.length - 1]?.url)
          : (bestMatch.url || bestMatch.streamUrl || '');

        let artistStr = cleanArtist;
        if (typeof bestMatch.artists === 'string' && bestMatch.artists.trim()) {
          artistStr = bestMatch.artists.trim();
        } else if (Array.isArray(bestMatch.artists)) {
          artistStr = bestMatch.artists.map(a => typeof a === 'object' ? (a.name || a.title || '') : a).filter(Boolean).join(', ');
        } else if (bestMatch.artists && typeof bestMatch.artists === 'object') {
          const prim = Array.isArray(bestMatch.artists.primary) ? bestMatch.artists.primary : [];
          const feat = Array.isArray(bestMatch.artists.featured) ? bestMatch.artists.featured : [];
          const combined = [...prim, ...feat].map(a => typeof a === 'object' ? (a.name || a.title || '') : a).filter(Boolean);
          if (combined.length > 0) artistStr = combined.join(', ');
        } else if (bestMatch.primaryArtists) {
          artistStr = Array.isArray(bestMatch.primaryArtists) ? bestMatch.primaryArtists.join(', ') : String(bestMatch.primaryArtists);
        }

        let primaryArtistStr = cleanArtist;
        if (bestMatch.artists && typeof bestMatch.artists === 'object' && Array.isArray(bestMatch.artists.primary) && bestMatch.artists.primary.length > 0) {
          primaryArtistStr = bestMatch.artists.primary[0]?.name || cleanArtist;
        } else if (typeof bestMatch.primaryArtist === 'string' && bestMatch.primaryArtist) {
          primaryArtistStr = bestMatch.primaryArtist;
        }

        let imgUrl = ytThumbnail;
        if (Array.isArray(bestMatch.image) && bestMatch.image.length > 0) {
          const hi = bestMatch.image.find(i => i.quality === '500x500') || bestMatch.image[bestMatch.image.length - 1];
          imgUrl = hi?.url || hi?.link || bestMatch.image[0]?.url || ytThumbnail;
        } else if (typeof bestMatch.image === 'string' && bestMatch.image.startsWith('http')) {
          imgUrl = bestMatch.image;
        }

        matchedSong = {
          id: String(bestMatch.id || ytTrack.id),
          name: bestMatch.name || bestMatch.title || ytTrack.name,
          title: bestMatch.name || bestMatch.title || ytTrack.name,
          artists: artistStr || ytTrack.artists,
          primaryArtist: primaryArtistStr || cleanArtist,
          album: bestMatch.album?.name || (typeof bestMatch.album === 'string' ? bestMatch.album : '') || ytTrack.album || ytTrack.name,
          albumId: bestMatch.album?.id || '',
          duration: Number(bestMatch.duration || ytTrack.duration || 0),
          durationSeconds: Number(bestMatch.duration || ytTrack.duration || 0),
          image: imgUrl,
          audioUrl: streamUrl,
          streamUrl: streamUrl,
          streamType: 'mp4',
          downloadUrl: bestMatch.downloadUrl || [],
          year: bestMatch.year || '',
          language: bestMatch.language || 'hindi',
          provider: 'jiosaavn',
          providerId: String(bestMatch.id),
          source: 'jiosaavn',
          sourceId: String(bestMatch.id),
          sourceYtVideoId: videoId,
          metadataAvailable: true,
          isPlayable: true,
          playbackAvailable: true
        };
      } else {
        // Fallback: Resolve YouTube Music direct stream URL
        try {
          const directStream = await this.getStreamUrl(videoId);
          if (directStream && directStream.url) {
            ytTrack.audioUrl = directStream.url;
            ytTrack.streamUrl = directStream.url;
          }
        } catch (_) {}
        ytTrack.playbackAvailable = true;
        ytTrack.isPlayable = true;
      }
    } catch (_) {}

    return {
      success: true,
      track: matchedSong,
      matched: true
    };
  },

  /**
   * Import YouTube Playlist or Single Song & Match against JioSaavn / MusicFlow Catalog
   */
  async importAndMatchPlaylist(playlistUrlOrId) {
    const rawInput = String(playlistUrlOrId || '').trim();
    const videoId = extractVideoId(rawInput);
    const hasListParam = /[?&]list=/.test(rawInput);

    // 1. SINGLE SONG IMPORT DELEGATE
    if (videoId && !hasListParam) {
      const res = await this.importTrack(rawInput);
      const matchedSong = res.track;
      matchedSong.playbackAvailable = true;
      matchedSong.isPlayable = true;
      return {
        type: 'song',
        isSingleSong: true,
        playlistTitle: matchedSong.name,
        image: matchedSong.image,
        totalFound: 1,
        matchedCount: 1,
        unmatchedCount: 0,
        matchedTracks: [matchedSong],
        unmatchedTracks: [],
        allTracks: [matchedSong]
      };
    }

    // 2. PLAYLIST / ALBUM IMPORT
    const playlistRes = await this.getPlaylist(playlistUrlOrId);
    const pl = playlistRes.playlist;
    if (!pl || !Array.isArray(pl.songs) || pl.songs.length === 0) {
      throw new Error('Playlist not found or contains no accessible tracks');
    }

    const matchedTracks = [];
    const unmatchedTracks = [];

    // Parallel match resolution in batches of 5 to avoid overwhelming upstream hosts
    const batchSize = 5;
    for (let i = 0; i < pl.songs.length; i += batchSize) {
      const batch = pl.songs.slice(i, i + batchSize);
      const batchPromises = batch.map(async (ytTrack) => {
        try {
          const cleanTitle = ytTrack.name.replace(/\(.*?\)|\[.*?\]|feat\..*|ft\..*|official.*|video/gi, '').trim();
          const cleanArtist = String(ytTrack.primaryArtist || ytTrack.artists || '').replace(/ - Topic$/i, '').trim();
          const searchQuery = `${cleanTitle} ${cleanArtist}`.trim();
          const saavnBase = (typeof ApiConfig !== 'undefined' && typeof ApiConfig.getJioSaavnApiBase === 'function')
            ? ApiConfig.getJioSaavnApiBase()
            : 'https://spoton-trpn.vercel.app/api';

          const saavnRes = await fetch(`${saavnBase}/search/songs?query=${encodeURIComponent(searchQuery)}&limit=3`, {
            signal: AbortSignal.timeout(5000)
          }).then(r => r.ok ? r.json() : null).catch(() => null);

          const candidateList = saavnRes?.data?.results || saavnRes?.results || [];
          if (candidateList.length > 0) {
            const bestMatch = candidateList[0];
            const streamUrl = (Array.isArray(bestMatch.downloadUrl) && bestMatch.downloadUrl.length > 0)
              ? (bestMatch.downloadUrl.find(u => (u.quality || '').includes('320'))?.url || bestMatch.downloadUrl[bestMatch.downloadUrl.length - 1]?.url)
              : (bestMatch.url || bestMatch.streamUrl || '');

            let artistStr = cleanArtist;
            if (typeof bestMatch.artists === 'string' && bestMatch.artists.trim()) {
              artistStr = bestMatch.artists.trim();
            } else if (Array.isArray(bestMatch.artists)) {
              artistStr = bestMatch.artists.map(a => typeof a === 'object' ? (a.name || a.title || '') : a).filter(Boolean).join(', ');
            } else if (bestMatch.artists && typeof bestMatch.artists === 'object') {
              const prim = Array.isArray(bestMatch.artists.primary) ? bestMatch.artists.primary : [];
              const feat = Array.isArray(bestMatch.artists.featured) ? bestMatch.artists.featured : [];
              const combined = [...prim, ...feat].map(a => typeof a === 'object' ? (a.name || a.title || '') : a).filter(Boolean);
              if (combined.length > 0) artistStr = combined.join(', ');
            } else if (bestMatch.primaryArtists) {
              artistStr = Array.isArray(bestMatch.primaryArtists) ? bestMatch.primaryArtists.join(', ') : String(bestMatch.primaryArtists);
            }

            let primaryArtistStr = cleanArtist;
            if (bestMatch.artists && typeof bestMatch.artists === 'object' && Array.isArray(bestMatch.artists.primary) && bestMatch.artists.primary.length > 0) {
              primaryArtistStr = bestMatch.artists.primary[0]?.name || cleanArtist;
            } else if (typeof bestMatch.primaryArtist === 'string' && bestMatch.primaryArtist) {
              primaryArtistStr = bestMatch.primaryArtist;
            }

            let imgUrl = ytTrack.image;
            if (Array.isArray(bestMatch.image) && bestMatch.image.length > 0) {
              const hi = bestMatch.image.find(i => i.quality === '500x500') || bestMatch.image[bestMatch.image.length - 1];
              imgUrl = hi?.url || hi?.link || bestMatch.image[0]?.url || ytTrack.image;
            } else if (typeof bestMatch.image === 'string' && bestMatch.image.startsWith('http')) {
              imgUrl = bestMatch.image;
            }

            const matchedSong = {
              id: String(bestMatch.id || ytTrack.id),
              name: bestMatch.name || bestMatch.title || ytTrack.name,
              title: bestMatch.name || bestMatch.title || ytTrack.name,
              artists: artistStr || ytTrack.artists,
              primaryArtist: primaryArtistStr || cleanArtist,
              album: bestMatch.album?.name || (typeof bestMatch.album === 'string' ? bestMatch.album : '') || ytTrack.album || ytTrack.name,
              albumId: bestMatch.album?.id || '',
              duration: Number(bestMatch.duration || ytTrack.duration || 0),
              image: imgUrl,
              audioUrl: streamUrl,
              streamUrl: streamUrl,
              downloadUrl: bestMatch.downloadUrl || [],
              year: bestMatch.year || '',
              language: bestMatch.language || 'hindi',
              provider: 'jiosaavn',
              providerId: String(bestMatch.id),
              sourceYtVideoId: ytTrack.videoId,
              metadataAvailable: true,
              playbackAvailable: true,
              isPlayable: true
            };

            return { matched: true, song: matchedSong, original: ytTrack };
          }
        } catch (_) {}

        // Fallback: Keep track as valid playable YouTube Music track
        ytTrack.playbackAvailable = true;
        ytTrack.isPlayable = true;
        return { matched: true, song: ytTrack, original: ytTrack };
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(r => {
        if (r.matched) {
          matchedTracks.push(r.song);
        } else {
          unmatchedTracks.push(r.song);
        }
      });
    }

    return {
      type: 'playlist',
      isSingleSong: false,
      playlistId: pl.id,
      playlistTitle: pl.name,
      description: pl.description,
      image: pl.image,
      totalFound: pl.songs.length,
      matchedCount: matchedTracks.length,
      unmatchedCount: unmatchedTracks.length,
      matchedTracks,
      unmatchedTracks,
      allTracks: [...matchedTracks, ...unmatchedTracks]
    };
  },

  /**
   * Resolve direct playable audio stream URL for a YouTube Music track/videoId
   */
  async getStreamUrl(videoId, options = {}) {
    const cleanId = String(videoId || '').replace(/^yt_/, '').trim();
    if (!cleanId) return null;

    const cacheKey = `stream_${cleanId}`;
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    // Strategy 1: Android Client Innertube Player API
    // Returns direct, high-quality audio stream URLs (m4a / webm) without requiring signature ciphering
    try {
      const androidPayload = {
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: '19.09.37',
            androidSdkVersion: 30,
            hl: 'en',
            gl: 'US'
          }
        },
        videoId: cleanId,
        playbackContext: {
          contentPlaybackContext: {
            html5Preference: 'HTML5_PREF_WANTS'
          }
        }
      };

      const res = await fetch('https://www.youtube.com/youtubei/v1/player', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip'
        },
        body: JSON.stringify(androidPayload),
        signal: options.signal || (typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined)
      });

      if (res.ok) {
        const data = await res.json();
        const streamingData = data?.streamingData;
        if (streamingData) {
          const formats = [...(streamingData.adaptiveFormats || []), ...(streamingData.formats || [])];
          const audioFormats = formats.filter(f => (f.mimeType || '').startsWith('audio/'));
          audioFormats.sort((a, b) => (b.bitrate || b.averageBitrate || 0) - (a.bitrate || a.averageBitrate || 0));

          const bestAudio = audioFormats.find(f => f.url && f.url.startsWith('http'));
          if (bestAudio && bestAudio.url) {
            const result = {
              success: true,
              url: bestAudio.url,
              mimeType: bestAudio.mimeType || 'audio/mp4',
              bitrate: bestAudio.bitrate || 160000,
              quality: 'HIGH',
              provider: 'youtube_music',
              providerId: cleanId,
              expiresInSeconds: parseInt(streamingData.expiresInSeconds || '21600', 10)
            };
            setInCache(cacheKey, result);
            return result;
          }
        }
      }
    } catch (err) {
      console.warn(`[YouTubeMusicService] Android Innertube stream resolution failed for ${cleanId}:`, err.message);
    }

    // Strategy 2: Fallback via Public Piped instances
    const pipedMirrors = [
      `https://pipedapi.kavin.rocks/streams/${cleanId}`,
      `https://api.piped.private.coffee/streams/${cleanId}`,
      `https://pipedapi.tokhmi.xyz/streams/${cleanId}`
    ];

    for (const mirror of pipedMirrors) {
      try {
        const pRes = await fetch(mirror, {
          headers: { 'Accept': 'application/json' },
          signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined)
        });
        if (pRes.ok) {
          const pData = await pRes.json();
          const streams = pData?.audioStreams || [];
          if (streams.length > 0) {
            streams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
            const best = streams[0];
            if (best?.url) {
              const result = {
                success: true,
                url: best.url,
                mimeType: best.mimeType || 'audio/mp4',
                bitrate: best.bitrate || 128000,
                quality: 'HIGH',
                provider: 'youtube_music',
                providerId: cleanId,
                expiresInSeconds: 3600
              };
              setInCache(cacheKey, result);
              return result;
            }
          }
        }
      } catch (_) {}
    }

    return null;
  }
};

if (typeof window !== 'undefined') {
  window.YouTubeMusicService = YouTubeMusicService;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = YouTubeMusicService;
}

