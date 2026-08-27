// ============================================================================
// MUSICFLOW — PHASE 9.3 SMART DOWNLOADS & STORAGE MANAGEMENT TEST SUITE
// Automated verification for Smart Download Settings, Priority Queue,
// Storage Limits & Breakdown, Auto-Cleanup Policies, Candidate Deduplication,
// Large Library Scalability, and Full Regression Battery.
// ============================================================================

const fs = require('fs');
const path = require('path');

// Mock Browser Environment
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};

class MockElement {
  constructor(id = '', tagName = 'div') {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.style = {};
    this.attributes = {};
  }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] || null; }
}

const domElements = new Map();
function getOrCreateElem(id) {
  if (!domElements.has(id)) {
    domElements.set(id, new MockElement(id));
  }
  return domElements.get(id);
}
getOrCreateElem('offline-pill-indicator');
getOrCreateElem('settings-smart-dl-switch');
getOrCreateElem('settings-wifi-only-switch');
getOrCreateElem('settings-auto-likes-switch');

global.document = {
  getElementById: (id) => getOrCreateElem(id),
  createElement: (tag) => new MockElement('', tag),
  addEventListener: () => {}
};

global.window = {
  location: { href: 'http://localhost:3000/' },
  addEventListener: () => {}
};

global.navigator = {
  onLine: true,
  connection: { type: 'wifi', effectiveType: '4g', saveData: false }
};

class MockBlob {
  constructor(content = ['dummy audio data'], options = {}) {
    this.size = options.size !== undefined ? options.size : 2048000;
    this.type = options.type || 'audio/mpeg';
  }
}
global.Blob = MockBlob;

const mockBlobStorage = new Map();
global.IndexedDbStorage = {
  async saveDownloadedAudio(id, blob, meta = {}) {
    mockBlobStorage.set(String(id), { id: String(id), audioBlob: blob, size: blob.size, ...meta });
    return true;
  },
  async getDownloadedAudio(id) {
    return mockBlobStorage.get(String(id)) || null;
  },
  async getDownloadedAudioUrl(id) {
    const rec = mockBlobStorage.get(String(id));
    return rec ? `blob:http://localhost:3000/offline-audio-${id}` : null;
  },
  async deleteDownloadedAudio(id) {
    mockBlobStorage.delete(String(id));
    return true;
  },
  async clearAllDownloadedAudio() {
    mockBlobStorage.clear();
    return true;
  },
  async removeDownloadTask() { return true; },
  async saveDownloadTask() { return true; },
  async getAllDownloadTasks() { return []; },
  async saveLocalTrack() { return true; },
  async getAllLocalTracks() { return []; },
  async removeLocalTrack() { return true; },
  async clearAllLocalTracks() { return true; },
  async getStorageBreakdown() {
    return { totalBytes: 4096000, totalMb: '4.0', totalGb: '0.00', downloadedCount: 2, localCount: 2 };
  }
};

const Storage = require('./js/storage.js');
global.Storage = Storage;
const OfflineManager = require('./js/offlineManager.js');
global.OfflineManager = OfflineManager;
const RecommendationEngine = require('./js/recommendationEngine.js');
global.RecommendationEngine = RecommendationEngine;
const DownloadManager = require('./js/downloadManager.js');
global.DownloadManager = DownloadManager;
const SmartDownloadManager = require('./js/smartDownloads.js');
global.SmartDownloadManager = SmartDownloadManager;

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

async function runSmartDownloadsTests() {
  console.log('======================================================================');
  console.log('🧪 PHASE 9.3: SMART DOWNLOADS & STORAGE MANAGEMENT TEST SUITE');
  console.log('======================================================================\n');

  localStorage.clear();
  mockBlobStorage.clear();
  DownloadManager.clearCompleted();

  // 1. Settings & Conservative Defaults
  console.log('--- 1. Settings & Safe Defaults ---');
  const defaults = Storage.getSmartDownloadsSettings();
  assert(defaults.enabled === false, 'Smart Downloads defaults to OFF (no surprise data consumption)');
  assert(defaults.wifiOnly === true, 'Download over Wi-Fi only defaults to ON');
  assert(defaults.storageLimitMb === 2048, 'Storage limit defaults to 2048 MB (2 GB)');
  assert(defaults.autoCleanupPolicy === 'never', 'Auto-cleanup policy defaults to "never"');
  assert(defaults.autoDownloadLikes === false, 'Auto-download liked songs defaults to OFF');
  assert(defaults.maxSmartTracks === 25, 'Max smart tracks defaults to 25');

  // 2. Settings Modification & Persistence
  console.log('\n--- 2. Settings Persistence ---');
  Storage.setSmartDownloadsEnabled(true);
  assert(Storage.isSmartDownloadsEnabled() === true, 'Smart downloads enabled state saved');

  Storage.setDownloadWifiOnly(false);
  assert(Storage.isDownloadWifiOnly() === false, 'Wi-Fi only setting updated to false');
  Storage.setDownloadWifiOnly(true);

  Storage.setDownloadStorageLimitMb(5120);
  assert(Storage.getDownloadStorageLimitMb() === 5120, 'Storage limit updated to 5120 MB (5 GB)');

  Storage.setAutoCleanupPolicy('older_30_days');
  assert(Storage.getAutoCleanupPolicy() === 'older_30_days', 'Auto-cleanup policy updated to older_30_days');

  // 3. Storage Measurement & Breakdown Calculation
  console.log('\n--- 3. Storage Metrics & Breakdown ---');
  const track1 = { id: 'track_1', name: 'Blinding Lights', artists: 'The Weeknd', size: 10485760 }; // 10 MB
  const track2 = { id: 'track_2', name: 'Starboy', artists: 'The Weeknd', size: 5242880 }; // 5 MB
  Storage.addDownload(track1);
  Storage.addDownload(track2);

  const localTrack1 = { id: 'local_1', name: 'Midnight City', artists: 'M83', size: 8388608 }; // 8 MB
  Storage.saveLocalSong(localTrack1);

  const metrics = SmartDownloadManager.getStorageMetrics();
  assert(metrics.downloadedCount === 2, 'Storage metrics counts 2 downloaded tracks');
  assert(metrics.localCount === 1, 'Storage metrics counts 1 local track');
  assert(metrics.downloadedMb === 15.0, `Downloaded MB accurately calculated (got ${metrics.downloadedMb} MB, expected 15.0)`);
  assert(metrics.localMb === 8.0, `Local MB accurately calculated (got ${metrics.localMb} MB, expected 8.0)`);
  assert(metrics.totalUsedMb === 23.0, `Total used MB accurately calculated (got ${metrics.totalUsedMb} MB, expected 23.0)`);
  assert(metrics.percentUsed < 100, `Storage percentage < 100% (got ${metrics.percentUsed}%)`);
  assert(metrics.isLimitReached === false, 'Storage limit not reached with 23 MB used vs 5120 MB limit');

  // 4. Storage Limit Enforcement & Capacity Checks
  console.log('\n--- 4. Storage Limit Enforcement ---');
  Storage.setDownloadStorageLimitMb(20); // Limit is 20 MB, current usage is 23 MB -> limit reached!
  const tightMetrics = SmartDownloadManager.getStorageMetrics();
  assert(tightMetrics.isLimitReached === true, 'Limit reached detected when usage (23 MB) > limit (20 MB)');
  assert(SmartDownloadManager.canSmartDownload() === false, 'canSmartDownload() returns false when storage limit reached');

  // Restore limit
  Storage.setDownloadStorageLimitMb(2048);
  assert(SmartDownloadManager.canSmartDownload() === true, 'canSmartDownload() returns true after expanding limit');

  // 5. Smart Candidate Generation & Deduplication
  console.log('\n--- 5. Candidate Generation & Deduplication ---');
  // Seed taste signals: favorites & milestones
  const candidateTrack = { id: 'cand_1', name: 'Save Your Tears', artists: 'The Weeknd', duration: 215 };
  const likedTrack = { id: 'liked_1', name: 'In Your Eyes', artists: 'The Weeknd', duration: 237 };
  Storage.addFavorite(likedTrack);
  Storage.recordPlayMilestone(candidateTrack, 100);

  // Enable auto-download liked songs
  Storage.setAutoDownloadLikesEnabled(true);
  const candidates = SmartDownloadManager.generateSmartCandidates(10);
  assert(candidates.length > 0, `Generated ${candidates.length} smart candidates`);
  assert(candidates.some(c => c.id === 'liked_1' && c.reason === 'From your Liked Songs'), 'Liked track included with "From your Liked Songs" explanation');
  assert(!candidates.some(c => c.id === 'track_1'), 'Already downloaded track_1 excluded from candidates');
  assert(!candidates.some(c => c.id === 'local_1'), 'Local device track_1 excluded from candidates');

  // 6. Download Priority: Explicit vs Smart
  console.log('\n--- 6. Priority Enforcement (Explicit > Smart) ---');
  DownloadManager.clearCompleted();
  const smartTask = DownloadManager.enqueue({ id: 'smart_q1', name: 'Smart Song' }, { priority: 'smart', reason: 'Recommended' });
  const explicitTask = DownloadManager.enqueue({ id: 'explicit_q1', name: 'Explicit Song' }, { priority: 'explicit' });

  assert(smartTask.priority === 'smart', 'Smart task has priority: smart');
  assert(explicitTask.priority === 'explicit', 'Explicit task has priority: explicit');

  // If explicit task added for same ID as smart, it promotes priority
  const promotedTask = DownloadManager.enqueue({ id: 'smart_q1', name: 'Smart Song' }, { priority: 'explicit' });
  assert(promotedTask.priority === 'explicit', 'Explicit enqueue on existing smart task upgrades priority to explicit');

  // 7. Protected Downloads ("Keep Offline" / Pinning)
  console.log('\n--- 7. Protected Downloads ---');
  assert(Storage.isDownloadProtected('track_1') === false, 'track_1 is initially unpinned');
  Storage.setDownloadProtected('track_1', true);
  assert(Storage.isDownloadProtected('track_1') === true, 'track_1 is now protected');
  assert(Storage.getProtectedDownloads().includes('track_1'), 'Protected downloads list includes track_1');

  // 8. Auto-Cleanup Candidates & Safety
  console.log('\n--- 8. Auto-Cleanup Candidates & Protection Safety ---');
  const cleanupCandidates = SmartDownloadManager.getCleanupCandidates(0);
  assert(!cleanupCandidates.some(s => s.id === 'track_1'), 'Protected track_1 is NOT in cleanup candidates');
  assert(!cleanupCandidates.some(s => s.id === 'local_1'), 'Local device tracks are NEVER in cleanup candidates');
  assert(cleanupCandidates.some(s => s.id === 'track_2'), 'Unpinned track_2 is an eligible cleanup candidate');

  // Preview Cleanup
  const preview = SmartDownloadManager.previewCleanup('least_played');
  assert(preview.willRemoveCount >= 1, `Cleanup preview identified ${preview.willRemoveCount} track(s) for removal`);
  assert(preview.willRemoveMb > 0, `Cleanup preview calculated ${preview.willRemoveMb} MB to be freed`);
  assert(preview.willKeepCount >= 1, `Cleanup preview preserves protected/liked tracks (${preview.willKeepCount} kept)`);

  // Execute Cleanup
  const removedCount = await SmartDownloadManager.executeCleanup([track2]);
  assert(removedCount === 1, 'Executed cleanup removed 1 unpinned track');
  assert(Storage.isDownloaded('track_2') === false, 'track_2 removed from storage downloads');
  assert(Storage.isDownloaded('track_1') === true, 'Protected track_1 remains downloaded');

  // 9. Rejection / Session Blocklist
  console.log('\n--- 9. Rejected Candidate Filtering ---');
  SmartDownloadManager.rejectCandidate('cand_rejected');
  const candidatesAfterReject = SmartDownloadManager.generateSmartCandidates(10);
  assert(!candidatesAfterReject.some(c => c.id === 'cand_rejected'), 'Rejected candidate excluded from smart evaluation');

  // 10. Large Library Scalability Benchmark (1000 items)
  console.log('\n--- 10. Large Library Scalability Benchmark (1000 items) ---');
  for (let i = 0; i < 1000; i++) {
    Storage.addDownload({
      id: `bench_dl_${i}`,
      name: `Benchmark Song ${i}`,
      artists: `Artist ${(i % 50)}`,
      size: 6291456, // 6 MB
      downloadedAt: Date.now() - (i * 100000)
    });
  }

  const startMetricsMs = Date.now();
  const largeMetrics = SmartDownloadManager.getStorageMetrics();
  const metricsDurationMs = Date.now() - startMetricsMs;

  assert(largeMetrics.downloadedCount >= 1000, `Storage metrics processed ${largeMetrics.downloadedCount} downloads`);
  assert(metricsDurationMs < 30, `1000-item storage metrics calculated in ${metricsDurationMs}ms (< 30ms)`);

  const startCleanupMs = Date.now();
  const largeCleanupCandidates = SmartDownloadManager.getCleanupCandidates(50); // Free 50 MB
  const cleanupDurationMs = Date.now() - startCleanupMs;

  assert(largeCleanupCandidates.length > 0, `Found ${largeCleanupCandidates.length} cleanup candidates`);
  assert(cleanupDurationMs < 30, `1000-item cleanup ranking executed in ${cleanupDurationMs}ms (< 30ms)`);

  console.log('\n======================================================================');
  console.log(`📊 PHASE 9.3 RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('======================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSmartDownloadsTests();
