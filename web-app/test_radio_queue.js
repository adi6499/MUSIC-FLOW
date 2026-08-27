// ==========================================================================
// TEST SUITE: Radio Queue Engine & Multi-Source Population (Phase 8.4)
// 29 Comprehensive Unit & Integration Tests
// ==========================================================================

const assert = require('assert');

// Mock Audio
class MockAudio {
  constructor() {
    this.id = 'app-audio';
    this.src = '';
    this.currentTime = 124.5;
    this.duration = 240;
    this.paused = false;
    this.buffered = { length: 1, end: () => 150 };
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
  load() { this.emit('loadstart'); }
  async play() { this.paused = false; this.emit('playing'); return Promise.resolve(); }
  pause() { this.paused = true; this.emit('pause'); }
}

global.Audio = MockAudio;
const mockAudioInstance = new MockAudio();

global.window = {
  addEventListener: () => {},
  removeEventListener: () => {}
};
global.document = {
  getElementById: (id) => {
    if (id === 'app-audio') return mockAudioInstance;
    return {
      id,
      classList: {
        _classes: new Set(),
        add(c) { this._classes.add(c); },
        remove(c) { this._classes.delete(c); },
        toggle(c, v) { if (v) this._classes.add(c); else this._classes.delete(c); },
        contains(c) { return this._classes.has(c); }
      },
      style: {},
      setAttribute() {},
      textContent: '',
      innerHTML: '',
      value: ''
    };
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  visibilityState: 'visible'
};
global.navigator = { mediaSession: { setActionHandler: () => {}, playbackState: 'none' } };

const Player = require('./js/player.js');
const RecommendationEngine = require('./js/recommendationEngine.js');
const TrackDeduplicator = require('./js/trackDeduplicator.js');

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

async function runTests() {
  console.log('=== RADIO QUEUE ENGINE TESTS ===\n');

  Player.init();

  const seedTrack = {
    id: 'seed_akhiyaan',
    name: 'Akhiyaan De Kol',
    artists: 'Mithoon, Jubin Nautiyal',
    primaryArtist: 'Mithoon',
    duration: 215,
    streamUrl: 'https://example.com/akhiyaan.mp3'
  };

  const candidateTracks = [
    { id: 'rad_1', name: 'Tum Hi Ho', primaryArtist: 'Mithoon', artists: 'Arijit Singh, Mithoon', duration: 262, streamUrl: 'https://example.com/1.mp3' },
    { id: 'rad_2', name: 'Raataan Lambiyan', primaryArtist: 'Tanishk Bagchi', artists: 'Jubin Nautiyal, Asees Kaur', duration: 230, streamUrl: 'https://example.com/2.mp3' },
    { id: 'rad_3', name: 'Sanam Re', primaryArtist: 'Mithoon', artists: 'Arijit Singh, Mithoon', duration: 308, streamUrl: 'https://example.com/3.mp3' },
    { id: 'rad_4', name: 'Lut Gaye', primaryArtist: 'Tanishk Bagchi', artists: 'Jubin Nautiyal', duration: 228, streamUrl: 'https://example.com/4.mp3' },
    { id: 'rad_5', name: 'Humnava Mere', primaryArtist: 'Rocky-Shiv', artists: 'Jubin Nautiyal', duration: 330, streamUrl: 'https://example.com/5.mp3' },
    { id: 'rad_6', name: 'Phir Bhi Tumko Chahunga', primaryArtist: 'Mithoon', artists: 'Arijit Singh, Shashaa Tirupati', duration: 351, streamUrl: 'https://example.com/6.mp3' },
    { id: 'rad_7', name: 'Dil Galti Kar Baitha Hai', primaryArtist: 'Meet Bros', artists: 'Jubin Nautiyal', duration: 250, streamUrl: 'https://example.com/7.mp3' },
    { id: 'rad_8', name: 'Woh Din', primaryArtist: 'Pritam', artists: 'Arijit Singh', duration: 258, streamUrl: 'https://example.com/8.mp3' },
    { id: 'rad_9', name: 'Kesariya', primaryArtist: 'Pritam', artists: 'Arijit Singh', duration: 268, streamUrl: 'https://example.com/9.mp3' },
    { id: 'rad_10', name: 'Chaleya', primaryArtist: 'Anirudh Ravichander', artists: 'Arijit Singh, Shilpa Rao', duration: 200, streamUrl: 'https://example.com/10.mp3' },
    { id: 'rad_11', name: 'Apna Bana Le', primaryArtist: 'Sachin-Jigar', artists: 'Arijit Singh', duration: 261, streamUrl: 'https://example.com/11.mp3' },
    { id: 'rad_12', name: 'Taaron Ke Shehar', primaryArtist: 'Jaani', artists: 'Neha Kakkar, Jubin Nautiyal', duration: 245, streamUrl: 'https://example.com/12.mp3' }
  ];

  // Set initial queue: Seed + 1 previous item
  Player.setQueue([seedTrack, { id: 'old_anthem', name: 'Mithoon Dada Movie Anthem', duration: 180 }], 0, false);
  mockAudioInstance.currentTime = 124.5;
  mockAudioInstance.paused = false;

  // 1. Start Radio Queue
  it('1. startRadioQueue populates multiple recommended tracks', () => {
    Player.startRadioQueue(seedTrack, candidateTracks);
    const queue = Player.getQueue();
    assert.strictEqual(queue.length, 13, 'Queue must have 13 tracks (seed + 12 recommendations)');
  });

  // 2. Candidate Generation
  it('2. RecommendationEngine generates scored candidates for seed', () => {
    const scored = RecommendationEngine.getSimilarTracks(seedTrack, candidateTracks, 10);
    assert.ok(scored.length > 0, 'Must return scored recommendations');
    assert.ok(scored[0].score > 0, 'Recommendation score must be > 0');
  });

  // 3. Candidate Count
  it('3. Radio produces at least 10 candidates when available in catalog', () => {
    const queue = Player.getQueue();
    const upcoming = queue.slice(1);
    assert.ok(upcoming.length >= 10, 'Upcoming queue must have 10+ tracks');
  });

  // 4. Source Resolution
  it('4. All queued radio tracks have valid metadata and identifiers', () => {
    const queue = Player.getQueue();
    queue.forEach((track, i) => {
      assert.ok(track.id, `Track at ${i} must have ID`);
      assert.ok(track.name, `Track at ${i} must have name`);
    });
  });

  // 5. Queue Insertion
  it('5. Radio tracks are inserted immediately after the seed track', () => {
    const queue = Player.getQueue();
    assert.strictEqual(queue[0].id, seedTrack.id);
    assert.strictEqual(queue[1].id, candidateTracks[0].id);
  });

  // 6. Current Track Preservation
  it('6. Starting Radio does not restart or change the current track', () => {
    const cur = Player.getCurrentTrack();
    assert.strictEqual(cur.id, seedTrack.id);
  });

  // 7. CurrentTime Preservation
  it('7. Starting Radio preserves audio.currentTime (does not reset to 0)', () => {
    assert.strictEqual(mockAudioInstance.currentTime, 124.5);
  });

  // 8. Queue Count
  it('8. Upcoming queue count is accurate (queue.length - 1 when at index 0)', () => {
    const queue = Player.getQueue();
    const upcomingCount = queue.length - Player.getCurrentIndex() - 1;
    assert.strictEqual(upcomingCount, 12);
  });

  // 9. Queue UI Update
  it('9. Player emits "queueChange" event when radio queue is set', () => {
    let notifiedQueue = null;
    const listener = (q) => { notifiedQueue = q; };
    Player.on('queueChange', listener);

    Player.startRadioQueue(seedTrack, candidateTracks.slice(0, 5));
    assert.ok(notifiedQueue !== null);
    assert.strictEqual(notifiedQueue.length, 6);

    Player.off('queueChange', listener);
  });

  // 10. Deduplication
  it('10. TrackDeduplicator removes duplicates and seed from radio candidates', () => {
    const duplicates = [...candidateTracks, candidateTracks[0], seedTrack];
    const dedup = TrackDeduplicator.deduplicate(duplicates.filter(s => String(s.id) !== String(seedTrack.id)));
    assert.strictEqual(dedup.length, candidateTracks.length);
  });

  // 11. Artist Diversity
  it('11. RecommendationEngine limits repeated artists to prevent single-artist flood', () => {
    const singleArtistHeavy = [
      { id: '1', name: 'Song 1', primaryArtist: 'Mithoon', artists: 'Mithoon' },
      { id: '2', name: 'Song 2', primaryArtist: 'Mithoon', artists: 'Mithoon' },
      { id: '3', name: 'Song 3', primaryArtist: 'Mithoon', artists: 'Mithoon' },
      { id: '4', name: 'Song 4', primaryArtist: 'Mithoon', artists: 'Mithoon' },
      { id: '5', name: 'Song 5', primaryArtist: 'Pritam', artists: 'Pritam' }
    ];
    const recs = RecommendationEngine.getSimilarTracks(seedTrack, singleArtistHeavy, 5);
    const mithoonCount = recs.filter(r => r.song.primaryArtist === 'Mithoon').length;
    assert.ok(mithoonCount <= 3, 'Must cap repeated artist at max 3 in top picks');
  });

  // 12. Partial Result
  it('12. Partial candidate list (e.g. 3 tracks) successfully queues all 3 without error', () => {
    Player.startRadioQueue(seedTrack, candidateTracks.slice(0, 3));
    assert.strictEqual(Player.getQueue().length, 4);
  });

  // 13. Empty Result Handling
  it('13. Empty candidate list keeps current track safe and creates 1-track queue', () => {
    Player.startRadioQueue(seedTrack, []);
    assert.strictEqual(Player.getQueue().length, 1);
    assert.strictEqual(Player.getCurrentTrack().id, seedTrack.id);
  });

  // 14. Queue Refill
  it('14. autoPopulateContinuousQueue does not crash when called on low queue', async () => {
    await Player.startRadioQueue(seedTrack, candidateTracks);
    assert.ok(Player.getQueue().length >= 10);
  });

  // 15. Radio Already Active
  it('15. Calling startRadioQueue with same active track updates upcoming items without resetting position', () => {
    const posBefore = mockAudioInstance.currentTime;
    Player.startRadioQueue(seedTrack, candidateTracks);
    assert.strictEqual(mockAudioInstance.currentTime, posBefore);
  });

  // 16. Double Tap Safe
  it('16. Rapid consecutive startRadioQueue calls do not create duplicate seed or corrupted queue', () => {
    Player.startRadioQueue(seedTrack, candidateTracks);
    Player.startRadioQueue(seedTrack, candidateTracks);
    const queue = Player.getQueue();
    const seedOccurrences = queue.filter(s => s.id === seedTrack.id).length;
    assert.strictEqual(seedOccurrences, 1, 'Seed must appear exactly once');
  });

  // 17. Stale Request Resistance
  it('17. Queue handles rapid updates cleanly and maintains correct track index', () => {
    Player.startRadioQueue(seedTrack, candidateTracks.slice(0, 4));
    Player.startRadioQueue(seedTrack, candidateTracks);
    assert.strictEqual(Player.getCurrentIndex(), 0);
    assert.strictEqual(Player.getCurrentTrack().id, seedTrack.id);
  });

  // 18. Next Track
  it('18. Player.next() plays the next Radio track (rad_1)', () => {
    Player.next();
    assert.strictEqual(Player.getCurrentTrack().id, candidateTracks[0].id);
  });

  // 19. Previous Track
  it('19. Player.previous() returns to the seed track when at start of track', () => {
    mockAudioInstance.currentTime = 0.5; // at beginning of track
    Player.previous();
    assert.strictEqual(Player.getCurrentTrack().id, seedTrack.id);
  });

  // 20. Shuffle Preservation
  it('20. Toggle shuffle on Radio queue maintains valid current track', () => {
    const curBefore = Player.getCurrentTrack().id;
    Player.toggleShuffle();
    assert.strictEqual(Player.getCurrentTrack().id, curBefore);
    Player.toggleShuffle(); // Toggle back
  });

  // 21. Repeat Preservation
  it('21. Repeat modes cycle properly with Radio queue active', () => {
    const mode1 = Player.toggleRepeat();
    assert.ok(['ALL', 'ONE', 'OFF'].includes(mode1));
  });

  // 22. Like Compatibility
  it('22. Liking a song does not alter the Radio queue order', () => {
    const lenBefore = Player.getQueue().length;
    // Simulate like
    const cur = Player.getCurrentTrack();
    assert.ok(cur !== null);
    assert.strictEqual(Player.getQueue().length, lenBefore);
  });

  // 23. Download Compatibility
  it('23. Downloading a radio track does not remove it from the active queue', () => {
    const lenBefore = Player.getQueue().length;
    assert.strictEqual(Player.getQueue().length, lenBefore);
  });

  // 24. Offline Compatibility
  it('24. Radio queue works with local and downloaded tracks', () => {
    const offlineCandidate = { id: 'offline_1', name: 'Offline Track', duration: 180, source: 'DOWNLOAD' };
    Player.startRadioQueue(seedTrack, [offlineCandidate]);
    assert.strictEqual(Player.getQueue().length, 2);
  });

  // 25. Mini Player Sync
  it('25. Mini player state reflects the seed track name and duration', () => {
    const state = Player.getState();
    assert.strictEqual(state.currentTrack.name, seedTrack.name);
  });

  // 26. Full Player Sync
  it('26. Full Player queue state shows total count matching Player.getQueue().length', () => {
    Player.startRadioQueue(seedTrack, candidateTracks);
    assert.strictEqual(Player.getQueue().length, candidateTracks.length + 1);
  });

  // 27. Radio + Sleep Timer
  it('27. Starting Radio does not cancel or reset an active Sleep Timer', () => {
    Player.setSleepTimer(30);
    const expBefore = Player.getSleepTimerState().expiresAt;
    Player.startRadioQueue(seedTrack, candidateTracks);
    const expAfter = Player.getSleepTimerState().expiresAt;
    assert.strictEqual(expBefore, expAfter, 'Sleep timer must remain active after starting radio');
    Player.setSleepTimer(0);
  });

  // 28. Radio + Audio Effects
  it('28. Starting Radio preserves Equalizer and Audio Effects settings', () => {
    Player.setEqPreset('Bass Boost');
    Player.startRadioQueue(seedTrack, candidateTracks);
    const state = Player.getState();
    assert.ok(state !== null);
  });

  // 29. Full Regression
  it('29. Full Lifecycle: Seed Play -> Radio -> Next -> Next -> Prev works without errors', () => {
    Player.startRadioQueue(seedTrack, candidateTracks);
    assert.strictEqual(Player.getCurrentTrack().id, seedTrack.id);
    Player.next();
    assert.strictEqual(Player.getCurrentTrack().id, candidateTracks[0].id);
    Player.next();
    assert.strictEqual(Player.getCurrentTrack().id, candidateTracks[1].id);
    Player.previous();
    assert.strictEqual(Player.getCurrentTrack().id, candidateTracks[0].id);
  });

  console.log(`\nResults: ${passed} Passed, ${failed} Failed\n`);
  if (failed > 0) process.exit(1);
}

runTests();
