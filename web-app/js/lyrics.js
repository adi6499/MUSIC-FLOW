// ==========================================================================
// MUSICFLOW — LIVE SYNCHRONIZED KARAOKE LYRICS ENGINE (LRCLib & Local)
// High-Precision Real-Time Timestamp Sync, Karaoke Scroll & Seek Alignment
// ==========================================================================

const Lyrics = (() => {
  let parsedLines = [];
  let activeIndex = -1;
  let isPlain = false;
  let userIsScrolling = false;
  let scrollTimeout = null;
  let currentSongId = null;

  // Parses standard & advanced LRC formats:
  // [mm:ss.xx], [mm:ss.xxx], [mm:ss:xx], [m:ss.xx], [offset: +/-ms], multi-timestamps
  function parseLRC(lrcText) {
    if (!lrcText || typeof lrcText !== 'string') return [];

    let globalOffsetSec = 0;
    const offsetMatch = lrcText.match(/\[offset:\s*([+-]?\d+)\]/i);
    if (offsetMatch) {
      globalOffsetSec = parseInt(offsetMatch[1], 10) / 1000.0;
    }

    const lines = lrcText.split('\n');
    const result = [];
    const timeReg = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

    lines.forEach(line => {
      // Ignore metadata tags
      if (/^\[(ti|ar|al|by|length|re|ve|offset):/i.test(line.trim())) return;

      const text = line.replace(timeReg, '').trim();
      let match;
      timeReg.lastIndex = 0;
      let hasTimestamp = false;

      while ((match = timeReg.exec(line)) !== null) {
        hasTimestamp = true;
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const rawMs = match[3] || '0';
        const ms = parseInt(rawMs.padEnd(3, '0').slice(0, 3), 10);
        const timeInSeconds = Math.max(0, (min * 60) + sec + (ms / 1000.0) + globalOffsetSec);

        if (text) {
          result.push({ time: timeInSeconds, text });
        }
      }

      // If plain lyric line without timestamp inside mixed LRC
      if (!hasTimestamp) {
        const cleanText = text.replace(/^\[.*?\]\s*/, '').trim();
        if (cleanText) {
          result.push({ time: 0, text: cleanText });
        }
      }
    });

    return result.sort((a, b) => a.time - b.time);
  }

  async function loadLyricsForTrack(song) {
    parsedLines = [];
    activeIndex = -1;
    isPlain = false;
    currentSongId = song ? String(song.id || '') : null;

    const container = document.getElementById('lyrics-scroll-container');
    if (!song) {
      if (container) container.innerHTML = '<p class="lyrics-line">No lyrics available.</p>';
      return;
    }
    if (container) {
      container.innerHTML = `
        <div class="lyrics-loading-state" style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 20px; text-align:center; color:var(--text-secondary);">
          <span class="material-symbols-outlined spinning" style="font-size:28px; color:var(--accent-red); margin-bottom:12px;">sync</span>
          <p style="font-size:14px; font-weight:600; color:#fff;">Fetching Synchronized Lyrics...</p>
          <span style="font-size:12px; margin-top:4px; opacity:0.8;">Matching song metadata with LRCLib</span>
        </div>
      `;
    }

    // 1. Check if song already has embedded lyrics (Local ID3 or preloaded synced lyrics)
    if (song.syncedLyrics || song.lyrics) {
      const lrcContent = song.syncedLyrics || song.lyrics;
      if (typeof lrcContent === 'string' && lrcContent.includes('[')) {
        parsedLines = parseLRC(lrcContent);
        isPlain = false;
        renderLyrics(parsedLines, false);
        return;
      } else if (typeof lrcContent === 'string') {
        const plainArr = lrcContent.split('\n').filter(l => l.trim()).map(text => ({ time: 0, text }));
        parsedLines = plainArr;
        isPlain = true;
        renderLyrics(plainArr, true);
        return;
      }
    }

    // 2. Fetch from LRCLib API
    try {
      const data = await API.getLyrics(song.name, song.artists || song.primaryArtist, song.duration);
      if (!data) {
        if (container) {
          container.innerHTML = `
            <div class="lyrics-empty-state" style="padding:60px 20px; text-align:center; color:var(--text-secondary);">
              <span class="material-symbols-outlined" style="font-size:36px; opacity:0.6; margin-bottom:12px;">music_off</span>
              <p style="font-size:14px; font-weight:600; color:#fff;">No lyrics found for this song</p>
              <span style="font-size:12px; margin-top:4px; display:block;">Enjoy the instrumental vibes!</span>
            </div>
          `;
        }
        return;
      }

      if (data.synced) {
        parsedLines = parseLRC(data.synced);
        isPlain = false;
        renderLyrics(parsedLines, false);
      } else if (data.plain) {
        const plainArr = data.plain.split('\n').filter(l => l.trim()).map(text => ({ time: 0, text }));
        parsedLines = plainArr;
        isPlain = true;
        renderLyrics(plainArr, true);
      } else {
        if (container) {
          container.innerHTML = `
            <div class="lyrics-empty-state" style="padding:60px 20px; text-align:center; color:var(--text-secondary);">
              <p style="font-size:14px; font-weight:600; color:#fff;">No synchronized lyrics available</p>
            </div>
          `;
        }
      }
    } catch (e) {
      if (container) {
        container.innerHTML = `
          <div class="lyrics-empty-state" style="padding:60px 20px; text-align:center; color:var(--text-secondary);">
            <p style="font-size:14px; font-weight:600; color:#fff;">Lyrics unavailable offline</p>
          </div>
        `;
      }
    }
  }

  function renderLyrics(lines, plain = false) {
    const container = document.getElementById('lyrics-scroll-container');
    if (!container) return;

    if (!lines || lines.length === 0) {
      container.innerHTML = '<p class="lyrics-line">No lyrics available.</p>';
      return;
    }

    container.innerHTML = lines.map((item, idx) => `
      <p class="lyrics-line ${idx === 0 && !plain ? 'active' : ''}" data-idx="${idx}" data-time="${item.time}">
        ${item.text}
      </p>
    `).join('');

    // Attach scroll tracking to prevent jerky auto-scroll during manual user reading
    container.onscroll = () => {
      userIsScrolling = true;
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        userIsScrolling = false;
      }, 2500);
    };

    // Enable clicking any line to jump directly to that timestamp in the track
    if (!plain) {
      container.querySelectorAll('.lyrics-line').forEach(el => {
        el.onclick = () => {
          const time = parseFloat(el.dataset.time);
          if (!isNaN(time) && typeof Player !== 'undefined' && Player.seek) {
            Player.seek(time);
            userIsScrolling = false;
          }
        };
      });
    }
  }

  function updateTime(currentTime) {
    if (isPlain || !parsedLines || parsedLines.length === 0) return;
    const curTime = Number(currentTime) || 0;

    // Find current active line index with 200ms lookahead for vocal cadence
    let newIndex = -1;
    for (let i = 0; i < parsedLines.length; i++) {
      if (curTime >= parsedLines[i].time - 0.20) {
        newIndex = i;
      } else {
        break;
      }
    }

    if (newIndex !== activeIndex) {
      activeIndex = newIndex;
      const container = document.getElementById('lyrics-scroll-container');
      if (!container) return;

      const lines = container.querySelectorAll('.lyrics-line');
      lines.forEach((line, idx) => {
        const isCurrent = idx === activeIndex;
        const isPast = activeIndex !== -1 && idx < activeIndex;

        line.classList.toggle('active', isCurrent);
        line.classList.toggle('past', isPast);

        if (isCurrent && !userIsScrolling) {
          line.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
  }

  function getParsedLines() {
    return parsedLines;
  }

  function getActiveIndex() {
    return activeIndex;
  }

  return {
    parseLRC,
    loadLyricsForTrack,
    renderLyrics,
    updateTime,
    getParsedLines,
    getActiveIndex
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Lyrics;
}
