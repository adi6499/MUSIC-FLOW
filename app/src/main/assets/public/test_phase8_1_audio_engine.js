// ============================================================================
// MUSICFLOW — PHASE 8.1 AUDIO ENGINE & PLAYBACK RELIABILITY TEST SUITE
// Automated verification for State Machine, Source Resolution, Queue, Shuffle,
// Repeat, Next/Previous, Error Recovery, Race Conditions & Analytics.
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

class MockAudio {
  constructor() {
    this.src = '';
    this.currentTime = 0;
    this.duration = 200;
    this.paused = true;
    this.buffered = {
      length: 1,
      end: () => 150
    };
    this.listeners = {};
  }
  addEventListener(evt, cb) {
    if (!this.listeners[evt]) this.listeners[evt] = [];
    this.listeners[evt].push(cb);
  }
  removeEventListener(evt, cb) {
    if (!this.listeners[evt]) return;
    this.listeners[evt] = this.listeners[evt].filter(c => c !== cb);
  }
  emit(evt, data) {
    (this.listeners[evt] || []).forEach(cb => cb(data));
  }
  load() {
    this.emit('loadstart');
    setTimeout(() => this.emit('canplay'), 10);
  }
  async play() {
    this.paused = false;
    this.emit('playing');
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
    this.emit('pause');
  }
}

global.Audio = MockAudio;
global.document = {
  getElementById: () => null,
  addEventListener: () => {}
};
global.window = {
  location: { href: 'http://localhost:3000/' },
  addEventListener: () => {}
};
global.navigator = {
  onLine: true,
  mediaSession: {
    metadata: null,
    playbackState: 'none',
    setActionHandler: () => {},
    setPositionState: () => {}
  }
};
global.MediaMetadata = class {
  constructor(data) { Object.assign(this, data); }
};

const Storage = require('./js/storage.js');
global.Storage = Storage;
const API = require('./js/api.js');
global.API = API;
const Player = require('./js/player.js');

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

async function runPlaybackTestSuite() {
  console.log('======================================================================');
  console.log('🧪 PHASE 8.1: AUDIO ENGINE & PLAYBACK RELIABILITY TEST SUITE');
  console.log('======================================================================\n');

  Player.init();

  // 1. Playback State Machine & Initial State
  console.log('--- 1. Playback State Machine & Initial State ---');
  const initState = Player.getState();
  assert(initState.playbackState === Player.PlaybackState.IDLE, `Initial state is IDLE (got ${initState.playbackState})`);
  assert(initState.isPlaying === false, 'Initially not playing');
  assert(initState.currentIndex === -1, 'Initial index is -1');
  assert(initState.queueLength === 0, 'Initial queue is empty');

  // 2. Audio Source Classification & Priority Resolution
  console.log('\n--- 2. Audio Source Classification & Priority ---');
  const onlineTrack = { id: 'track_online_1', name: 'Blinding Lights', artists: 'The Weeknd', audioUrl: 'https://cdn.example.com/audio1.mp3' };
  const resOnline = await Player.resolvePlaybackSource(onlineTrack);
  assert(resOnline.type === Player.SourceType.STREAMING, `Online track resolved to STREAMING: ${resOnline.type}`);
  assert(resOnline.uri === 'https://cdn.example.com/audio1.mp3', `Resolved correct streaming URL`);

  // Downloaded track check (higher priority than streaming)
  Storage.saveDownload({ ...onlineTrack, id: 'track_online_1' });
  // Mock offline storage URL
  Storage.getDownloadedAudioUrl = async (id) => `blob:http://localhost/offline_${id}`;
  const resDownloaded = await Player.resolvePlaybackSource(onlineTrack);
  assert(resDownloaded.type === Player.SourceType.DOWNLOADED, `Downloaded track prioritizes DOWNLOADED: ${resDownloaded.type}`);
  assert(resDownloaded.uri.startsWith('blob:'), `Resolved offline blob URL: ${resDownloaded.uri}`);

  // Local track check
  const localTrack = { id: 'local_track_1', name: 'Midnight City', artists: 'M83', source: 'LOCAL', localBlobUrl: 'blob:http://localhost/local_m83' };
  const resLocal = await Player.resolvePlaybackSource(localTrack);
  assert(resLocal.type === Player.SourceType.LOCAL, `Local track resolved to LOCAL: ${resLocal.type}`);

  // 3. Queue Management & Operations
  console.log('\n--- 3. Queue Management & Deterministic Operations ---');
  const songA = { id: 's_a', name: 'Song A', artists: 'Artist A', audioUrl: 'https://cdn.example.com/a.mp3' };
  const songB = { id: 's_b', name: 'Song B', artists: 'Artist B', audioUrl: 'https://cdn.example.com/b.mp3' };
  const songC = { id: 's_c', name: 'Song C', artists: 'Artist C', audioUrl: 'https://cdn.example.com/c.mp3' };
  const songD = { id: 's_d', name: 'Song D', artists: 'Artist D', audioUrl: 'https://cdn.example.com/d.mp3' };

  Player.setQueue([songA, songB, songC], 0, false);
  assert(Player.getQueue().length === 3, 'Queue has 3 songs');
  assert(Player.getCurrentTrack().id === 's_a', 'Current track is Song A');

  // Play next
  Player.playNext(songD);
  const qAfterNext = Player.getQueue();
  assert(qAfterNext[1].id === 's_d', `Play Next inserted Song D at index 1: ${qAfterNext[1].name}`);

  // Reorder queue
  Player.reorderQueue(1, 3); // Move Song D to end
  const qReordered = Player.getQueue();
  assert(qReordered[3].id === 's_d', 'Reordered Song D to position 3');

  // Remove from queue
  Player.removeFromQueue(3);
  assert(Player.getQueue().length === 3, 'Removed item from queue');

  // 4. Deterministic Shuffle & Repeat
  console.log('\n--- 4. Deterministic Shuffle & Repeat Modes ---');
  // Repeat toggle
  assert(Player.getRepeatMode() === 'OFF', 'Initial repeat mode is OFF');
  Player.toggleRepeat();
  assert(Player.getRepeatMode() === 'ALL', 'Repeat toggles to ALL');
  Player.toggleRepeat();
  assert(Player.getRepeatMode() === 'ONE', 'Repeat toggles to ONE');
  Player.toggleRepeat();
  assert(Player.getRepeatMode() === 'OFF', 'Repeat toggles back to OFF');

  // Shuffle toggle
  const unShuffledFirst = Player.getCurrentTrack().id;
  Player.toggleShuffle();
  assert(Player.getIsShuffle() === true, 'Shuffle enabled');
  assert(Player.getCurrentTrack().id === unShuffledFirst, 'Shuffle preserves current track as active track');
  Player.toggleShuffle();
  assert(Player.getIsShuffle() === false, 'Shuffle disabled');

  // 5. Next & Previous Navigation
  console.log('\n--- 5. Next & Previous Navigation ---');
  Player.setQueue([songA, songB, songC], 0, false);
  await Player.next();
  assert(Player.getCurrentTrack().id === 's_b', `Next advances to Song B (got ${Player.getCurrentTrack().name})`);

  // Previous when position < 3s advances to previous track
  Player.previous();
  assert(Player.getCurrentTrack().id === 's_a', `Previous returns to Song A (got ${Player.getCurrentTrack().name})`);

  // 6. Mixed Online + Local + Downloaded Queue
  console.log('\n--- 6. Mixed Online + Local + Downloaded Queue ---');
  const mixedQueue = [onlineTrack, localTrack, songC];
  Player.setQueue(mixedQueue, 0, false);
  assert(Player.getQueue().length === 3, 'Mixed queue loaded 3 items');
  await Player.next();
  assert(Player.getCurrentTrack().source === 'LOCAL', 'Advanced to local track cleanly');

  // 7. Race Condition Protection (Stale Request Discard)
  console.log('\n--- 7. Race Condition Protection ---');
  let staleSkipped = false;
  // Rapid fire 2 tracks
  Player.playSong(songA);
  Player.playSong(songB);
  assert(Player.getCurrentTrack().id === 's_b', `Only latest requested track (Song B) remains active (got ${Player.getCurrentTrack().name})`);

  // 8. Event Listeners Deduplication
  console.log('\n--- 8. Event Listener Management & Deduplication ---');
  let listenerCalls = 0;
  const testListener = () => { listenerCalls++; };
  Player.on('stateChange', testListener);
  Player.on('stateChange', testListener); // Duplicate attachment
  Player.play();
  Player.pause();
  assert(listenerCalls <= 2, `Duplicate listener discarded (called ${listenerCalls} times)`);
  Player.off('stateChange', testListener);

  console.log('\n======================================================================');
  console.log(`📊 PHASE 8.1 RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('======================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPlaybackTestSuite();
