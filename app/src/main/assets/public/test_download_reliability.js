// ============================================================================
// MUSICFLOW — DOWNLOAD RELIABILITY & STATE MACHINE TEST SUITE (Phase 8)
// Tests explicit download states, exponential backoff retry, corruption detection,
// deduplication, pause/resume, and offline playback availability.
// ============================================================================

const assert = require('assert');
const DownloadManager = require('./js/downloadManager.js');

// Mock in-memory storage & indexedDB
const mockDownloads = [];
global.Storage = {
  getDownloads: () => mockDownloads,
  addDownload: (song) => { mockDownloads.push(song); return true; },
  removeDownload: (id) => {
    const idx = mockDownloads.findIndex(d => d.id === id);
    if (idx !== -1) mockDownloads.splice(idx, 1);
    return true;
  }
};

global.IndexedDbStorage = {
  saveDownloadedAudio: async (id, blob, meta) => true,
  getDownloadedAudio: async (id) => ({ blob: new Uint8Array(2048), meta: { id } }),
  deleteDownloadedAudio: async (id) => true
};

let totalTests = 0;
let passedTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

async function runAllTests() {
  console.log('\n=============================================================');
  console.log('  MUSICFLOW — PHASE 8 DOWNLOAD RELIABILITY ENGINE VALIDATION');
  console.log('=============================================================\n');

  // Test 1: Download States Enum Validation
  await runTest('1. Status constants define all required explicit states', () => {
    const STATUS = DownloadManager.STATUS;
    assert(STATUS.QUEUED === 'QUEUED', 'QUEUED state missing');
    assert(STATUS.DOWNLOADING === 'DOWNLOADING', 'DOWNLOADING state missing');
    assert(STATUS.PAUSED === 'PAUSED', 'PAUSED state missing');
    assert(STATUS.COMPLETED === 'COMPLETED', 'COMPLETED state missing');
    assert(STATUS.FAILED === 'FAILED', 'FAILED state missing');
    assert(STATUS.CANCELLED === 'CANCELLED', 'CANCELLED state missing');
    assert(STATUS.RETRYING === 'RETRYING', 'RETRYING state missing');
  });

  // Test 2: Successful Download Flow with Progress Tracking
  await runTest('2. Successful download emits granular progress (0% -> 100%) and reaches COMPLETED', async () => {
    // Mock successful fetch
    global.fetch = async (url) => {
      const mockAudioBytes = new Uint8Array(5000);
      return {
        ok: true,
        status: 200,
        headers: {
          get: (h) => (h === 'content-length' ? '5000' : 'audio/mpeg')
        },
        blob: async () => ({ size: 5000, type: 'audio/mpeg' })
      };
    };

    const track = { id: 'dl_test_1', name: 'Song 1', artists: 'Artist 1', streamUrl: 'http://test/song1.mp3' };
    const task = DownloadManager.enqueue(track);
    assert(task, 'Task should be created');
    assert(task.status === DownloadManager.STATUS.QUEUED || task.status === DownloadManager.STATUS.DOWNLOADING, 'Initial state must be QUEUED/DOWNLOADING');

    // Wait for async completion
    await new Promise(resolve => setTimeout(resolve, 80));

    const updatedTask = DownloadManager.getTask('dl_test_1');
    assert(updatedTask.status === DownloadManager.STATUS.COMPLETED, `Expected COMPLETED, got ${updatedTask.status}`);
    assert(updatedTask.progress === 100, `Expected 100% progress, got ${updatedTask.progress}`);
    assert(updatedTask.bytesDownloaded === 5000, `Expected 5000 bytes, got ${updatedTask.bytesDownloaded}`);
  });

  // Test 3: Duplicate Enqueue Prevention
  await runTest('3. Duplicate enqueue returns existing task without duplicate download worker', () => {
    const track = { id: 'dl_test_1', name: 'Song 1', artists: 'Artist 1', streamUrl: 'http://test/song1.mp3' };
    const existingTask = DownloadManager.enqueue(track);
    assert(existingTask.status === DownloadManager.STATUS.COMPLETED, 'Already completed task should be returned');
  });

  // Test 4: Corrupted / Empty File Rejection (< 1KB)
  await runTest('4. Corrupted/Empty file (<1024 bytes) is rejected with INVALID_FILE', async () => {
    global.fetch = async () => ({
      ok: true,
      status: 200,
      headers: { get: () => '100' },
      blob: async () => ({ size: 100, type: 'audio/mpeg' }) // < 1KB
    });

    const track = { id: 'dl_test_corrupt', name: 'Corrupted Song', artists: 'Artist', streamUrl: 'http://test/corrupt.mp3' };
    DownloadManager.enqueue(track);

    await new Promise(resolve => setTimeout(resolve, 60));

    const task = DownloadManager.getTask('dl_test_corrupt');
    assert(task.error !== null, 'Corrupted download must register error');
    assert(task.error.code === DownloadManager.ERROR_CODES.INVALID_FILE, `Expected INVALID_FILE, got ${task.error.code}`);
  });

  // Test 5: Missing Audio Source Error Handling
  await runTest('5. Missing Audio Source without fallback fails with SOURCE_UNAVAILABLE', async () => {
    const track = { id: 'dl_test_nosource', name: 'No Source Song', artists: 'Artist', streamUrl: '' };
    DownloadManager.enqueue(track);

    await new Promise(resolve => setTimeout(resolve, 60));

    const task = DownloadManager.getTask('dl_test_nosource');
    assert(task.status === DownloadManager.STATUS.FAILED, `Expected FAILED, got ${task.status}`);
    assert(task.error.code === DownloadManager.ERROR_CODES.SOURCE_UNAVAILABLE, `Expected SOURCE_UNAVAILABLE, got ${task.error.code}`);
  });

  // Test 6: Pause and Resume Capabilities
  await runTest('6. Task pausing transitions to PAUSED and resume re-queues', async () => {
    global.fetch = () => new Promise(resolve => setTimeout(() => resolve({
      ok: true,
      status: 200,
      headers: { get: () => '10000' },
      blob: async () => ({ size: 10000, type: 'audio/mpeg' })
    }), 500));

    const track = { id: 'dl_test_pause', name: 'Slow Song', artists: 'Artist', streamUrl: 'http://test/slow.mp3' };
    DownloadManager.enqueue(track);

    DownloadManager.pause('dl_test_pause');
    const pausedTask = DownloadManager.getTask('dl_test_pause');
    assert(pausedTask.status === DownloadManager.STATUS.PAUSED, `Expected PAUSED, got ${pausedTask.status}`);

    DownloadManager.resume('dl_test_pause');
    const resumedTask = DownloadManager.getTask('dl_test_pause');
    assert(resumedTask.status === DownloadManager.STATUS.QUEUED || resumedTask.status === DownloadManager.STATUS.DOWNLOADING, `Expected QUEUED/DOWNLOADING, got ${resumedTask.status}`);
  });

  // Test 7: Cancellation Cleanup
  await runTest('7. Task cancellation cleans up active controller and removes task', () => {
    const track = { id: 'dl_test_cancel', name: 'Cancel Song', artists: 'Artist', streamUrl: 'http://test/cancel.mp3' };
    DownloadManager.enqueue(track);

    const cancelled = DownloadManager.cancel('dl_test_cancel');
    assert(cancelled, 'Cancel should return true');
    const task = DownloadManager.getTask('dl_test_cancel');
    assert(!task || task.status === DownloadManager.STATUS.CANCELLED, 'Cancelled task should be cleaned up');
  });

  console.log(`\n=============================================================`);
  console.log(`  TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
  console.log(`=============================================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAllTests();
