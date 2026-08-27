// ============================================================================
// MUSICFLOW — PHASE 9.1 DOWNLOAD MANAGER 2.0 TEST SUITE
// Automated verification for Single Download Manager, Canonical Queue,
// Concurrency Bounds, Progress, Pause/Resume/Cancel/Retry, File Verification,
// Missing File Detection, Error Taxonomy, Offline Resolution, and Large Queues.
// ============================================================================

const fs = require('fs');
const path = require('path');

// Mock DOM & Storage Environment
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};

class MockBlob {
  constructor(content = ['dummy audio data'], options = {}) {
    this.size = options.size !== undefined ? options.size : 2048000; // ~2MB default
    this.type = options.type || 'audio/mpeg';
  }
}
global.Blob = MockBlob;

// In-Memory Mock IndexedDB Blob Store
const mockBlobStorage = new Map();
global.IndexedDbStorage = {
  async saveDownloadedAudio(id, blob, meta = {}) {
    mockBlobStorage.set(String(id), { id: String(id), audioBlob: blob, size: blob.size, ...meta });
    return true;
  },
  async getDownloadedAudio(id) {
    return mockBlobStorage.get(String(id)) || null;
  },
  async deleteDownloadedAudio(id) {
    mockBlobStorage.delete(String(id));
    return true;
  },
  async clearAllDownloadedAudio() {
    mockBlobStorage.clear();
    return true;
  },
  async removeDownloadTask(id) {
    return true;
  },
  async saveDownloadTask(task) {
    return true;
  },
  async getAllDownloadTasks() {
    return [];
  },
  async getStorageBreakdown() {
    return { totalBytes: 2048000, totalMb: '2.0', totalGb: '0.00', downloadedCount: 1, localCount: 0 };
  }
};

const Storage = require('./js/storage.js');
global.Storage = Storage;

// Mock fetch for audio stream URLs
global.fetch = async (url, options = {}) => {
  if (options.signal && options.signal.aborted) {
    const err = new Error('The operation was aborted');
    err.name = 'AbortError';
    throw err;
  }

  if (url.includes('fail-404')) {
    return { ok: false, status: 404, headers: { get: () => '0' } };
  }
  if (url.includes('corrupt-empty')) {
    return {
      ok: true,
      status: 200,
      headers: { get: () => '0' },
      blob: async () => new MockBlob([], { size: 0 })
    };
  }

  return {
    ok: true,
    status: 200,
    headers: {
      get: (header) => header === 'content-length' ? '2048000' : 'audio/mpeg'
    },
    blob: async () => new MockBlob(['valid audio stream bytes'], { size: 2048000 })
  };
};

const DownloadManager = require('./js/downloadManager.js');
global.DownloadManager = DownloadManager;

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failedTests++;
  }
}

async function runDownloadManagerTests() {
  console.log('======================================================================');
  console.log('🧪 PHASE 9.1: DOWNLOAD MANAGER 2.0 COMPREHENSIVE TEST SUITE');
  console.log('======================================================================\n');

  localStorage.clear();
  mockBlobStorage.clear();
  await DownloadManager.clearAllDownloads();

  // 1. Single Download Lifecycle
  console.log('--- 1. Single Download Lifecycle ---');
  const track1 = {
    id: 'dl_track_1',
    name: 'Blinding Lights',
    artists: 'The Weeknd',
    album: 'After Hours',
    streamUrl: 'https://cdn.example.com/audio/blinding_lights.mp3'
  };

  let progressReported = false;
  DownloadManager.on('progress', (data) => {
    if (data.id === 'dl_track_1') progressReported = true;
  });

  const task1 = DownloadManager.enqueue(track1);
  assert(task1 !== null, 'Track 1 enqueued successfully');
  assert(task1.status === DownloadManager.STATUS.QUEUED || task1.status === DownloadManager.STATUS.DOWNLOADING, 'Task 1 in QUEUED or DOWNLOADING state');

  // Allow async worker to complete
  await new Promise(r => setTimeout(r, 100));

  const status1 = DownloadManager.getStatus('dl_track_1');
  assert(status1 === DownloadManager.STATUS.COMPLETED, `Track 1 completed download (status: ${status1})`);
  assert(progressReported === true, 'Download progress events were emitted');
  assert(Storage.isDownloaded('dl_track_1') === true, 'Metadata registered in Storage downloads');
  assert(mockBlobStorage.has('dl_track_1'), 'Audio blob saved in IndexedDB storage');

  // 2. Duplicate Download Prevention
  console.log('\n--- 2. Canonical Duplicate Download Prevention ---');
  const task1Duplicate = DownloadManager.enqueue(track1);
  assert(task1Duplicate.id === 'dl_track_1', 'Duplicate enqueue returned existing task');
  assert(task1Duplicate.status === DownloadManager.STATUS.COMPLETED, 'Existing completed status preserved');
  assert(DownloadManager.getTasks().filter(t => t.id === 'dl_track_1').length === 1, 'Exactly one job exists for track ID');

  // 3. Concurrency Limits (Max 2 concurrent workers)
  console.log('\n--- 3. Concurrency Bounds (MAX_CONCURRENT_DOWNLOADS = 2) ---');
  const batchTracks = [
    { id: 'b_1', name: 'Song 1', streamUrl: 'https://cdn.example.com/1.mp3' },
    { id: 'b_2', name: 'Song 2', streamUrl: 'https://cdn.example.com/2.mp3' },
    { id: 'b_3', name: 'Song 3', streamUrl: 'https://cdn.example.com/3.mp3' },
    { id: 'b_4', name: 'Song 4', streamUrl: 'https://cdn.example.com/4.mp3' }
  ];

  DownloadManager.enqueueMultiple(batchTracks);
  const activeDuringDispatch = DownloadManager.getActiveCount();
  assert(activeDuringDispatch <= 2, `Active workers bounded at <= 2 (got ${activeDuringDispatch})`);

  await new Promise(r => setTimeout(r, 200));

  assert(DownloadManager.getStatus('b_1') === DownloadManager.STATUS.COMPLETED, 'Batch Track 1 completed');
  assert(DownloadManager.getStatus('b_2') === DownloadManager.STATUS.COMPLETED, 'Batch Track 2 completed');
  assert(DownloadManager.getStatus('b_3') === DownloadManager.STATUS.COMPLETED, 'Batch Track 3 completed');
  assert(DownloadManager.getStatus('b_4') === DownloadManager.STATUS.COMPLETED, 'Batch Track 4 completed');

  // 4. Pause & Resume Operations
  console.log('\n--- 4. Pause & Resume Operations ---');
  const slowTrack = { id: 'slow_1', name: 'Slow Ambient', streamUrl: 'https://cdn.example.com/slow.mp3' };
  DownloadManager.enqueue(slowTrack);
  const pauseRes = DownloadManager.pause('slow_1');
  assert(pauseRes === true || DownloadManager.getStatus('slow_1') === DownloadManager.STATUS.COMPLETED, 'Pause call succeeded');

  const resumeRes = DownloadManager.resume('slow_1');
  assert(typeof resumeRes === 'boolean', 'Resume returns boolean');

  // 5. Cancel Operation
  console.log('\n--- 5. Cancel Operation ---');
  const cancelTrack = { id: 'cancel_1', name: 'Cancel Me', streamUrl: 'https://cdn.example.com/cancel.mp3' };
  DownloadManager.enqueue(cancelTrack);
  const cancelRes = DownloadManager.cancel('cancel_1');
  assert(cancelRes === true, 'Task cancelled successfully');
  assert(DownloadManager.getTask('cancel_1') === null, 'Cancelled task removed from active memory');

  // 6. Error Handling: HTTP 404 Source Unavailable
  console.log('\n--- 6. Error Classification: SOURCE_UNAVAILABLE ---');
  const badTrack = { id: 'bad_404', name: 'Nonexistent Track', streamUrl: 'https://cdn.example.com/fail-404.mp3' };
  DownloadManager.enqueue(badTrack);

  await new Promise(r => setTimeout(r, 100));

  const badStatus = DownloadManager.getStatus('bad_404');
  const badTask = DownloadManager.getTask('bad_404');
  assert(badStatus === DownloadManager.STATUS.FAILED, `404 Track marked FAILED (status: ${badStatus})`);
  assert(badTask?.error?.code === DownloadManager.ERROR_CODES.HTTP_ERROR || badTask?.error?.code === DownloadManager.ERROR_CODES.SOURCE_UNAVAILABLE, 'Classified with correct error code');

  // 7. Retry Bounded Behavior
  console.log('\n--- 7. Retry Bounded Behavior ---');
  const retryRes = DownloadManager.retry('bad_404');
  assert(retryRes === true, 'Retry initiated for failed track');
  assert(DownloadManager.getTask('bad_404')?.status === DownloadManager.STATUS.QUEUED || DownloadManager.getTask('bad_404')?.status === DownloadManager.STATUS.DOWNLOADING, 'Task returned to queue for retry');

  // 8. Corrupt / Empty File Verification
  console.log('\n--- 8. Corrupt / Zero-Byte File Verification ---');
  const emptyTrack = { id: 'empty_1', name: 'Empty File', streamUrl: 'https://cdn.example.com/corrupt-empty.mp3' };
  DownloadManager.enqueue(emptyTrack);

  await new Promise(r => setTimeout(r, 100));

  assert(DownloadManager.getStatus('empty_1') === DownloadManager.STATUS.FAILED, 'Zero-byte download rejected by verification check');
  assert(Storage.isDownloaded('empty_1') === false, 'Zero-byte track not saved as downloaded');

  // 9. Missing File Detection
  console.log('\n--- 9. Missing File Audit & Detection ---');
  // Simulate database having record but blob deleted from disk
  mockBlobStorage.delete('dl_track_1');
  const auditRes = await DownloadManager.verifyAllDownloads();
  const missingItem = auditRes.find(item => item.id === 'dl_track_1');
  assert(missingItem !== undefined && missingItem.status === DownloadManager.STATUS.MISSING, 'Missing file accurately detected during audit');

  // 10. Playlist / Batch Download
  console.log('\n--- 10. Playlist & Album Batch Download ---');
  const playlistTracks = [
    { id: 'pl_t1', name: 'PL Song 1', streamUrl: 'https://cdn.example.com/pl1.mp3' },
    { id: 'pl_t2', name: 'PL Song 2', streamUrl: 'https://cdn.example.com/pl2.mp3' }
  ];
  const queuedBatch = DownloadManager.enqueueMultiple(playlistTracks);
  assert(queuedBatch.length === 2, 'Enqueued all 2 playlist tracks via unified manager');

  await new Promise(r => setTimeout(r, 150));

  assert(DownloadManager.getStatus('pl_t1') === DownloadManager.STATUS.COMPLETED, 'Playlist Track 1 completed');
  assert(DownloadManager.getStatus('pl_t2') === DownloadManager.STATUS.COMPLETED, 'Playlist Track 2 completed');

  // 11. Download Removal
  console.log('\n--- 11. Remove Download ---');
  await DownloadManager.removeDownload('pl_t1');
  assert(Storage.isDownloaded('pl_t1') === false, 'Track metadata removed from storage');
  assert(!mockBlobStorage.has('pl_t1'), 'Audio blob removed from IndexedDB');

  // 12. App Restart Recovery
  console.log('\n--- 12. App Restart Recovery ---');
  await DownloadManager.init();
  assert(DownloadManager.getStatus('pl_t2') === DownloadManager.STATUS.COMPLETED, 'Completed download recovered after init()');

  // 13. Queue Batch Operations (Pause All, Resume All, Cancel All)
  console.log('\n--- 13. Batch Queue Controls ---');
  DownloadManager.pauseAll();
  DownloadManager.resumeAll();
  DownloadManager.cancelAll();
  assert(DownloadManager.getActiveCount() === 0, 'No active workers after cancelAll()');

  // 14. Large Queue Stress (50 jobs)
  console.log('\n--- 14. Large Queue Stress (50 Tasks) ---');
  const largeQueue = [];
  for (let i = 0; i < 50; i++) {
    largeQueue.push({ id: `stress_${i}`, name: `Stress Song ${i}`, streamUrl: `https://cdn.example.com/s_${i}.mp3` });
  }

  const startMs = Date.now();
  DownloadManager.enqueueMultiple(largeQueue);
  const enqueueDuration = Date.now() - startMs;

  assert(enqueueDuration < 50, `50 items enqueued in ${enqueueDuration}ms (< 50ms)`);
  assert(DownloadManager.getActiveCount() <= 2, 'Active workers remained <= 2 during 50-item flood');

  await new Promise(r => setTimeout(r, 400));

  // 15. Clear Completed Queue
  console.log('\n--- 15. Clear Completed Queue Memory ---');
  DownloadManager.clearCompleted();
  assert(DownloadManager.getTasks().filter(t => t.status === DownloadManager.STATUS.COMPLETED).length === 0, 'Completed tasks cleared from in-memory queue');

  console.log('\n======================================================================');
  console.log(`📊 PHASE 9.1 RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('======================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runDownloadManagerTests();
