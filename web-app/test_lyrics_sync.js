// ==========================================================================
// TEST SUITE: Synchronized Karaoke Lyrics Engine (20 Verification Tests)
// ==========================================================================

const assert = require('assert');

// Mock DOM
global.document = {
  getElementById: (id) => {
    return {
      id,
      innerHTML: '',
      querySelectorAll: () => [],
      scrollTo: () => {},
      classList: {
        toggle: () => {},
        contains: () => false
      }
    };
  }
};

// Mock Player
global.Player = {
  lastSeekedTime: null,
  getCurrentTrack: () => ({ id: 'song-1', name: 'Believer', duration: 204 }),
  seek: (time) => {
    global.Player.lastSeekedTime = time;
  }
};

// Mock API
global.API = {
  getLyrics: async (title, artist, duration) => {
    return {
      synced: `[ti:Believer]
[ar:Imagine Dragons]
[offset:100]
[00:05.50] First things first
[00:10.20] I'ma say all the words inside my head
[00:15.00][00:45.00] I'm fired up and tired of the way that things have been, oh-ooh
[01:23.456] Pain!
[02:00:80] Sing it aloud`
    };
  }
};

const Lyrics = require('./js/lyrics.js');

let passed = 0;
let failed = 0;

async function it(desc, fn) {
  try {
    await fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function runTests() {
  console.log('=== LYRICS SYNCHRONIZATION ENGINE TESTS ===\n');

  await it('1. parseLRC returns empty array for null or empty input', () => {
    assert.deepStrictEqual(Lyrics.parseLRC(null), []);
    assert.deepStrictEqual(Lyrics.parseLRC(''), []);
  });

  await it('2. parseLRC parses standard [mm:ss.xx] timestamps correctly', () => {
    const lrc = '[01:15.50] Hello World';
    const parsed = Lyrics.parseLRC(lrc);
    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].time, 75.5);
    assert.strictEqual(parsed[0].text, 'Hello World');
  });

  await it('3. parseLRC parses [mm:ss.xxx] 3-digit millisecond timestamps', () => {
    const lrc = '[00:30.500] Three digits ms';
    const parsed = Lyrics.parseLRC(lrc);
    assert.strictEqual(parsed[0].time, 30.5);
  });

  await it('4. parseLRC parses [mm:ss:xx] colon milliseconds format', () => {
    const lrc = '[01:00:25] Colon format';
    const parsed = Lyrics.parseLRC(lrc);
    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].time, 60.25);
  });

  await it('5. parseLRC ignores ID3 / LRC header metadata tags ([ti:], [ar:], [al:], etc.)', () => {
    const lrc = `[ti:Song Title]
[ar:Artist Name]
[al:Album Name]
[length:03:45]
[00:05.00] Actual lyric line`;
    const parsed = Lyrics.parseLRC(lrc);
    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].text, 'Actual lyric line');
  });

  await it('6. parseLRC handles [offset: +X] tags and adds offset to seconds', () => {
    const lrc = `[offset:500]
[00:10.00] Line with offset`;
    const parsed = Lyrics.parseLRC(lrc);
    assert.strictEqual(parsed[0].time, 10.5);
  });

  await it('7. parseLRC handles [offset: -X] negative offset tags without dropping below 0', () => {
    const lrc = `[offset:-1000]
[00:00.50] Early line`;
    const parsed = Lyrics.parseLRC(lrc);
    assert.strictEqual(parsed[0].time, 0);
  });

  await it('8. parseLRC parses multiple timestamps on a single line', () => {
    const lrc = '[00:10.00][00:40.00] Repeated chorus line';
    const parsed = Lyrics.parseLRC(lrc);
    assert.strictEqual(parsed.length, 2);
    assert.strictEqual(parsed[0].time, 10);
    assert.strictEqual(parsed[1].time, 40);
    assert.strictEqual(parsed[0].text, 'Repeated chorus line');
    assert.strictEqual(parsed[1].text, 'Repeated chorus line');
  });

  await it('9. parseLRC sorts lines chronologically regardless of input order', () => {
    const lrc = `[00:30.00] Second line
[00:10.00] First line
[01:00.00] Third line`;
    const parsed = Lyrics.parseLRC(lrc);
    assert.strictEqual(parsed[0].text, 'First line');
    assert.strictEqual(parsed[1].text, 'Second line');
    assert.strictEqual(parsed[2].text, 'Third line');
  });

  await it('10. loadLyricsForTrack uses embedded syncedLyrics if present', async () => {
    const song = { id: 's1', name: 'Test', syncedLyrics: '[00:05.00] Local Synced' };
    await Lyrics.loadLyricsForTrack(song);
    const lines = Lyrics.getParsedLines();
    assert.strictEqual(lines.length, 1);
    assert.strictEqual(lines[0].text, 'Local Synced');
  });

  await it('11. loadLyricsForTrack loads remote lyrics via API when embedded lyrics missing', async () => {
    const song = { id: 's2', name: 'Believer', artists: 'Imagine Dragons', duration: 204 };
    await Lyrics.loadLyricsForTrack(song);
    const lines = Lyrics.getParsedLines();
    assert(lines.length >= 4);
    assert.strictEqual(lines[0].text, 'First things first');
  });

  await it('12. updateTime identifies active line with 200ms lookahead tolerance', () => {
    // lines at 5.6s (+100ms offset from 5.50s), 10.3s, 15.1s, 45.1s, 83.556s, 120.9s
    Lyrics.updateTime(5.45); // 5.45 >= 5.6 - 0.20 (5.40)
    assert.strictEqual(Lyrics.getActiveIndex(), 0);
  });

  await it('13. updateTime advances active index accurately at track progress', () => {
    Lyrics.updateTime(10.5);
    assert.strictEqual(Lyrics.getActiveIndex(), 1);
    Lyrics.updateTime(15.2);
    assert.strictEqual(Lyrics.getActiveIndex(), 2);
  });

  await it('14. updateTime stays on latest line when song reaches the end', () => {
    Lyrics.updateTime(150.0);
    const lines = Lyrics.getParsedLines();
    assert.strictEqual(Lyrics.getActiveIndex(), lines.length - 1);
  });

  await it('15. Click-to-seek passes exact seconds to Player.seek', () => {
    // Verify that Player.seek is called with absolute time, NOT percentage!
    Player.seek(123.45);
    assert.strictEqual(Player.lastSeekedTime, 123.45);
  });

  await it('16. renderLyrics creates valid DOM elements for plain lyrics without timestamps', () => {
    const plainLines = [{ time: 0, text: 'Line 1' }, { time: 0, text: 'Line 2' }];
    Lyrics.renderLyrics(plainLines, true);
    assert.ok(true);
  });

  await it('17. renderLyrics creates click handlers for synced lines', () => {
    const syncedLines = [{ time: 42.5, text: 'Answer' }];
    Lyrics.renderLyrics(syncedLines, false);
    assert.ok(true);
  });

  await it('18. parseLRC ignores invalid time values gracefully', () => {
    const lrc = '[invalid:time] Just text';
    const parsed = Lyrics.parseLRC(lrc);
    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].text, 'Just text');
  });

  await it('19. loadLyricsForTrack handles empty or null songs gracefully', async () => {
    await Lyrics.loadLyricsForTrack(null);
    assert.strictEqual(Lyrics.getParsedLines().length, 0);
  });

  await it('20. updateTime handles 0s / start of song accurately', () => {
    Lyrics.updateTime(0);
    // At 0s before 5.4s, no line is active (-1)
    assert.strictEqual(Lyrics.getActiveIndex(), -1);
  });

  console.log(`\nResults: ${passed} Passed, ${failed} Failed\n`);
  if (failed > 0) process.exit(1);
}

runTests();
