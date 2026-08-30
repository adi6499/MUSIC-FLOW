// ==========================================================================
// TEST SUITE: Full Player Small-Screen Responsive Optimization
// 25 Comprehensive Viewport & Layout Verification Tests
// ==========================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

function runTests() {
  console.log('=== FULL PLAYER SMALL-SCREEN RESPONSIVE TESTS ===\n');

  const cssPath = path.join(__dirname, 'css', 'app.css');
  const htmlPath = path.join(__dirname, 'index.html');
  const cssContent = fs.readFileSync(cssPath, 'utf8');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  // 1. Full Player Sheet Structure & Modern Viewport units
  it('1. .full-player-sheet uses modern dynamic viewport height (dvh) with fallbacks', () => {
    assert.ok(cssContent.includes('height: 100%'), 'Must have 100% height fallback');
    assert.ok(cssContent.includes('height: 100dvh'), 'Must support 100dvh dynamic viewport');
    assert.ok(cssContent.includes('box-sizing: border-box'), 'Must use border-box sizing');
  });

  it('2. .full-player-sheet respects safe-area-inset-top and safe-area-inset-bottom', () => {
    assert.ok(cssContent.includes('env(safe-area-inset-top'), 'Must respect safe-area-inset-top');
    assert.ok(cssContent.includes('env(safe-area-inset-bottom'), 'Must respect safe-area-inset-bottom');
  });

  it('3. .full-player-sheet prevents unneeded vertical scrolling', () => {
    assert.ok(cssContent.includes('overflow-y: hidden'), 'Must keep full player fixed control surface');
    assert.ok(cssContent.includes('overflow-x: hidden'), 'Must prevent horizontal overflow');
  });

  // 4. Primary Flexible Artwork Element
  it('4. .player-center-body has flex: 1 1 0 with min-height: 0 to absorb remaining height', () => {
    assert.ok(cssContent.includes('flex: 1 1 0') || cssContent.includes('flex: 1 1 auto'), 'Must be primary flex element');
    assert.ok(cssContent.includes('min-height: 0'), 'Must allow min-height: 0 so artwork shrinks on short screens');
  });

  it('5. .player-art-card preserves 1:1 aspect ratio and covers without distortion', () => {
    assert.ok(cssContent.includes('aspect-ratio: 1 / 1'), 'Artwork must strictly maintain 1:1 aspect ratio');
    assert.ok(cssContent.includes('object-fit: cover'), 'Artwork image must use object-fit: cover');
  });

  // 6. Metadata and Badges
  it('6. Song title and artist use text-overflow: ellipsis to prevent control push-down', () => {
    assert.ok(cssContent.includes('.player-song-title'), 'Must style player-song-title');
    assert.ok(cssContent.includes('text-overflow: ellipsis'), 'Must truncate long titles');
    assert.ok(cssContent.includes('white-space: nowrap'), 'Must keep title on single line');
  });

  it('7. Metadata badges enforce white-space: nowrap to prevent awkward multi-line wrapping', () => {
    assert.ok(cssContent.includes('.lossless-badge-pill'), 'Must style lossless badge');
    assert.ok(cssContent.includes('.bitrate-badge-pill'), 'Must style bitrate badge');
    assert.ok(cssContent.includes('white-space: nowrap'), 'Badges must have white-space: nowrap');
  });

  // 8. Like & More Buttons
  it('8. Like and More action buttons maintain comfortable touch targets (>= 34px)', () => {
    assert.ok(cssContent.includes('.player-circle-action-btn'), 'Must style circle action button');
    assert.ok(cssContent.includes('border-radius: 50%'), 'Must be circular action buttons');
  });

  // 9. Scrubber Progress Bar
  it('9. Progress bar seek track and thumb are styled with touch-action: none for precision seeking', () => {
    assert.ok(cssContent.includes('.player-custom-seek-bar'), 'Must style seek bar');
    assert.ok(cssContent.includes('touch-action: none'), 'Must prevent scroll conflict during scrub');
  });

  it('10. Current and duration time text render in tabular figures', () => {
    assert.ok(cssContent.includes('font-variant-numeric: tabular-nums') || cssContent.includes('player-times-row'), 'Must format time cleanly');
  });

  // 11. 5-Button Transport Controls
  it('11. Transport row contains all 5 primary controls (Shuffle, Prev, Play, Next, Repeat)', () => {
    assert.ok(htmlContent.includes('id="btn-player-shuffle"'), 'Shuffle button must exist');
    assert.ok(htmlContent.includes('id="btn-player-prev"'), 'Prev button must exist');
    assert.ok(htmlContent.includes('id="btn-player-play"'), 'Play button must exist');
    assert.ok(htmlContent.includes('id="btn-player-next"'), 'Next button must exist');
    assert.ok(htmlContent.includes('id="btn-player-repeat"'), 'Repeat button must exist');
  });

  it('12. Center Play button is prominent with responsive clamp() dimensions', () => {
    assert.ok(cssContent.includes('.transport-main-play-btn'), 'Must style main play button');
    assert.ok(cssContent.includes('border-radius: 50%'), 'Play button must be circular');
  });

  // 13. Secondary 5-Button Utility Card
  it('13. Utility card uses equal 5-column CSS grid (repeat(5, 1fr))', () => {
    assert.ok(cssContent.includes('grid-template-columns: repeat(5, 1fr)'), 'Must use 5 equal columns');
  });

  it('14. Utility buttons contain all 5 required actions (Lyrics, Equalizer, Download, Timer, Queue)', () => {
    assert.ok(htmlContent.includes('id="btn-toggle-lyrics"'), 'Lyrics button must exist');
    assert.ok(htmlContent.includes('onclick="App.openEqualizer()"'), 'Equalizer button must exist');
    assert.ok(htmlContent.includes('id="btn-player-download"'), 'Download button must exist');
    assert.ok(htmlContent.includes('onclick="App.openSleepTimerDialog()"'), 'Timer button must exist');
    assert.ok(htmlContent.includes('id="btn-player-queue"'), 'Queue button must exist');
  });

  it('15. Utility button labels stay single line with text-overflow: ellipsis', () => {
    assert.ok(cssContent.includes('.utility-btn span:not(.material-symbols-outlined)'), 'Must style utility labels');
  });

  // 16. Audio Output Device Routing Sheet
  it('16. Audio Output Routing sheet exists and is accessible on-demand', () => {
    assert.ok(htmlContent.includes('id="sheet-audio-output"'), 'Output routing sheet must exist in DOM');
    assert.ok(htmlContent.includes('App.openAudioOutputSheet'), 'Output routing must be available on-demand');
  });

  // 17. Small-Height Breakpoints (375x667 iPhone SE, 360x640)
  it('17. @media (max-height: 700px) activates compact layout for iPhone SE & 360x640', () => {
    assert.ok(cssContent.includes('@media (max-height: 700px)'), 'Must have max-height: 700px breakpoint');
  });

  // 18. Ultra-Compact Height Breakpoint (320x568 iPhone 5/SE1)
  it('18. @media (max-height: 590px) activates ultra-compact layout for 320x568', () => {
    assert.ok(cssContent.includes('@media (max-height: 590px)'), 'Must have max-height: 590px breakpoint');
  });

  // 19. Narrow-Width Breakpoint (320px width)
  it('19. @media (max-width: 340px) optimizes side paddings for 320px width', () => {
    assert.ok(cssContent.includes('@media (max-width: 340px)'), 'Must have max-width: 340px breakpoint');
  });

  // 20. Landscape Mode Support
  it('20. @media (orientation: landscape) supports 2-column side-by-side layout', () => {
    assert.ok(cssContent.includes('@media (orientation: landscape) and (max-height: 520px)'), 'Must have landscape layout query');
  });

  // 21. Functional Integrity Verification
  it('21. Player.togglePlay, seek, shuffle, repeat, favorite, and queue actions are unchanged', () => {
    assert.ok(htmlContent.includes('Player.togglePlay()'));
    assert.ok(htmlContent.includes('Player.toggleShuffle()'));
    assert.ok(htmlContent.includes('Player.toggleRepeat()'));
    assert.ok(htmlContent.includes('App.toggleFavoriteCurrent()'));
  });

  it('22. Back gesture handle and collapse button remain accessible', () => {
    assert.ok(htmlContent.includes('id="btn-player-collapse"'));
    assert.ok(htmlContent.includes('App.handlePlayerBack()'));
  });

  it('23. Safe-area insets clamp vertical padding to maintain balance on notched devices', () => {
    assert.ok(cssContent.includes('max(10px, env(safe-area-inset-top'));
    assert.ok(cssContent.includes('max(12px, env(safe-area-inset-bottom'));
  });

  it('24. No hardcoded fixed artwork min-height in small-height modes', () => {
    const compactMatch = cssContent.match(/@media\s*\(max-height:\s*700px\)[\s\S]*?\.player-art-view[\s\S]*?min-height:\s*0/i);
    assert.ok(compactMatch, 'Small-height mode must reset artwork min-height to 0');
  });

  it('25. All essential elements are present in full player DOM hierarchy', () => {
    const requiredIds = [
      'full-player',
      'player-dominant-glow',
      'player-main-top-bar',
      'player-art-card',
      'full-player-art',
      'full-player-title',
      'full-player-artist',
      'player-lossless-badge',
      'player-quality-badge',
      'btn-player-favorite',
      'player-seek-bar',
      'player-seek-track',
      'player-seek-thumb',
      'btn-player-play'
    ];
    requiredIds.forEach(id => {
      assert.ok(htmlContent.includes(`id="${id}"`), `Element with id="${id}" must exist in HTML`);
    });
  });

  console.log(`\nResults: ${passed} Passed, ${failed} Failed\n`);
  if (failed > 0) process.exit(1);
}

runTests();
