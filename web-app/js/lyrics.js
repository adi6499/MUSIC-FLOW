// ==========================================================================
// MUSICFLOW — LIVE SYNCHRONIZED KARAOKE LYRICS (LRCLib Engine)
// ==========================================================================

const Lyrics = (() => {
  let parsedLines = [];
  let activeIndex = -1;
  let isPlain = false;

  // Parses standard LRC format: [01:23.45] lyric line
  function parseLRC(lrcText) {
    if (!lrcText || typeof lrcText !== 'string') return [];
    const lines = lrcText.split('\n');
    const result = [];
    const timeReg = /\[(\d{2}):(\d{2})\.?(\d{2,3})?\]/g;

    lines.forEach(line => {
      const text = line.replace(timeReg, '').trim();
      let match;
      timeReg.lastIndex = 0;
      while ((match = timeReg.exec(line)) !== null) {
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const ms = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
        const timeInSeconds = min * 60 + sec + ms / 1000;
        if (text) {
          result.push({ time: timeInSeconds, text });
        }
      }
    });

    return result.sort((a, b) => a.time - b.time);
  }

  async function loadLyricsForTrack(song) {
    parsedLines = [];
    activeIndex = -1;
    isPlain = false;

    const container = document.getElementById('lyrics-scroll-container');
    if (container) {
      container.innerHTML = '<p class="lyrics-line active">✨ Searching synchronized lyrics...</p>';
    }

    if (!song) return;

    try {
      const data = await API.getLyrics(song.name, song.artists, song.duration);
      if (!data) {
        if (container) container.innerHTML = '<p class="lyrics-line">No lyrics available for this song.</p>';
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
        if (container) container.innerHTML = '<p class="lyrics-line">No lyrics found.</p>';
      }
    } catch (e) {
      if (container) container.innerHTML = '<p class="lyrics-line">Lyrics unavailable offline.</p>';
    }
  }

  function renderLyrics(lines, plain = false) {
    const container = document.getElementById('lyrics-scroll-container');
    if (!container) return;

    if (lines.length === 0) {
      container.innerHTML = '<p class="lyrics-line">No lyrics found.</p>';
      return;
    }

    container.innerHTML = lines.map((item, idx) => `
      <p class="lyrics-line ${idx === 0 && !plain ? 'active' : ''}" data-idx="${idx}" data-time="${item.time}">
        ${item.text}
      </p>
    `).join('');

    // Enable clicking a line to jump in song
    if (!plain) {
      container.querySelectorAll('.lyrics-line').forEach(el => {
        el.onclick = () => {
          const time = parseFloat(el.dataset.time);
          if (!isNaN(time) && window.Player) {
            const track = Player.getCurrentTrack();
            if (track && track.duration) {
              Player.seek((time / track.duration) * 100);
            }
          }
        };
      });
    }
  }

  function updateTime(currentTime) {
    if (isPlain || parsedLines.length === 0) return;

    // Find current active line index
    let newIndex = -1;
    for (let i = 0; i < parsedLines.length; i++) {
      if (currentTime >= parsedLines[i].time - 0.25) {
        newIndex = i;
      } else {
        break;
      }
    }

    if (newIndex !== -1 && newIndex !== activeIndex) {
      activeIndex = newIndex;
      const container = document.getElementById('lyrics-scroll-container');
      if (!container) return;

      const lines = container.querySelectorAll('.lyrics-line');
      lines.forEach((line, idx) => {
        const isCurrent = idx === activeIndex;
        if (line.classList.contains('active') !== isCurrent) {
          line.classList.toggle('active', isCurrent);
          if (isCurrent) {
            line.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      });
    }
  }

  return {
    loadLyricsForTrack,
    updateTime
  };
})();
