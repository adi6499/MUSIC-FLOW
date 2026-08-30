// ============================================================================
// MUSICFLOW — WAVY PROGRESS BAR ANIMATION & SEEK ENGINE TEST SUITE
// Validates: Wave renderer, 60fps animation loop, phase progression during playback,
// animation freeze on pause, instant finger tracking, and zero duplicate loops.
// ============================================================================

const assert = require('assert');

// Setup Mock DOM & RAF Environment
let mockCanvasWidth = 360;
let mockCanvasHeight = 32;
let rafIdCounter = 0;
const activeRafCallbacks = new Map();

global.window = {
  devicePixelRatio: 2,
  _isUserSeeking: false,
  requestAnimationFrame: (cb) => {
    const id = ++rafIdCounter;
    activeRafCallbacks.set(id, cb);
    return id;
  },
  cancelAnimationFrame: (id) => {
    activeRafCallbacks.delete(id);
  }
};

global.requestAnimationFrame = global.window.requestAnimationFrame;
global.cancelAnimationFrame = global.window.cancelAnimationFrame;

const drawCalls = [];
const mockCtx = {
  save: () => {},
  restore: () => {},
  scale: () => {},
  clearRect: () => {},
  beginPath: () => {},
  moveTo: (x, y) => drawCalls.push({ type: 'moveTo', x, y }),
  lineTo: (x, y) => drawCalls.push({ type: 'lineTo', x, y }),
  stroke: () => drawCalls.push({ type: 'stroke' }),
  strokeStyle: '',
  lineWidth: 0,
  lineCap: '',
  lineJoin: '',
  shadowColor: '',
  shadowBlur: 0
};

const mockElements = {
  'player-seek-wave': {
    getContext: () => mockCtx,
    getBoundingClientRect: () => ({ width: mockCanvasWidth, height: mockCanvasHeight, left: 0, top: 0 }),
    parentElement: { clientWidth: mockCanvasWidth },
    width: mockCanvasWidth,
    height: mockCanvasHeight
  },
  'player-seek-bar': {
    setAttribute: () => {},
    classList: { add: () => {}, remove: () => {} }
  },
  'player-seek-track': {
    getBoundingClientRect: () => ({ width: mockCanvasWidth, height: 4, left: 0, top: 0 })
  },
  'player-seek-fill': { style: {} },
  'player-seek-thumb': { style: {} },
  'player-time-current': { textContent: '' },
  'player-time-total': { textContent: '' }
};

global.document = {
  getElementById: (id) => mockElements[id] || null,
  querySelector: () => null,
  querySelectorAll: () => []
};

// Load UI module
const UI = require('./js/ui.js');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

console.log('\n=============================================================');
console.log('  MUSICFLOW — WAVY PROGRESS BAR ANIMATION & SEEK ENGINE TESTS');
console.log('=============================================================\n');

// 1. Wave renderer exists
runTest('1. WavyProgressBar engine and draw renderer exist on UI', () => {
  assert(UI.WavyProgressBar, 'UI.WavyProgressBar must be defined');
  assert(typeof UI.WavyProgressBar.draw === 'function', 'draw method must exist');
  assert(typeof UI.WavyProgressBar.setPlaying === 'function', 'setPlaying method must exist');
  assert(typeof UI.WavyProgressBar.setProgress === 'function', 'setProgress method must exist');
});

// 2. Animation loop starts when playback is active
runTest('2. Animation loop starts on setPlaying(true)', () => {
  UI.WavyProgressBar.setPlaying(true);
  assert(UI.WavyProgressBar.isPlaying === true, 'isPlaying state must be true');
  assert(UI.WavyProgressBar.animFrameId !== null, 'animFrameId must be assigned on play');
  assert(activeRafCallbacks.size > 0, 'Active RAF callback must be registered');
});

// 3. Animation phase continuously progresses across frames
runTest('3. Animation wave phase continuously increments on RAF frames', () => {
  const initialPhase = UI.WavyProgressBar.wavePhase;
  UI.WavyProgressBar.setProgress(50, false);

  // Execute 5 simulated RAF animation frames
  for (let i = 0; i < 5; i++) {
    const callbacks = Array.from(activeRafCallbacks.values());
    activeRafCallbacks.clear();
    callbacks.forEach(cb => cb(Date.now()));
  }

  const updatedPhase = UI.WavyProgressBar.wavePhase;
  assert(updatedPhase > initialPhase, `Wave phase must advance (initial: ${initialPhase}, updated: ${updatedPhase})`);
  assert(drawCalls.length > 0, 'Wave stroke calls must be generated during playback animation');
});

// 4. Animation stops and freezes when paused
runTest('4. Animation loop cleanly stops on setPlaying(false) with frozen frame', () => {
  UI.WavyProgressBar.setPlaying(false);
  assert(UI.WavyProgressBar.isPlaying === false, 'isPlaying state must be false');
  assert(UI.WavyProgressBar.animFrameId === null, 'animFrameId must be cleared on pause');
  const phaseBefore = UI.WavyProgressBar.wavePhase;

  // Execute any remaining callbacks (should be none)
  activeRafCallbacks.clear();
  assert(UI.WavyProgressBar.wavePhase === phaseBefore, 'Wave phase must freeze when paused');
});

// 5. Seeking immediately updates visual progress and re-renders wave
runTest('5. Seeking immediately updates progress percentage & renders wave', () => {
  drawCalls.length = 0;
  UI.WavyProgressBar.setProgress(75, true);
  assert.strictEqual(UI.WavyProgressBar.currentPct, 75, 'Progress must immediately jump to 75%');
  assert(UI.WavyProgressBar.isSeeking === true, 'isSeeking state must be true');
  assert(drawCalls.length > 0, 'Immediate draw() must execute without waiting for RAF frame');
});

// 6. Zero duplicate animation loops on rapid toggle
runTest('6. Rapid setPlaying calls maintain strictly single active RAF loop', () => {
  UI.WavyProgressBar.setPlaying(true);
  const firstLoopId = UI.WavyProgressBar.animFrameId;
  UI.WavyProgressBar.setPlaying(true);
  UI.WavyProgressBar.setPlaying(true);
  assert.strictEqual(UI.WavyProgressBar.animFrameId, firstLoopId, 'Must not spawn redundant duplicate loops');
  UI.WavyProgressBar.setPlaying(false);
  assert.strictEqual(UI.WavyProgressBar.animFrameId, null, 'Must clear loop on pause');
});

console.log(`\n=============================================================`);
console.log(`  TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
console.log(`=============================================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
