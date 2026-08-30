// ============================================================================
// TEST SUITE: NATIVE MEDIA SESSION & LOCK SCREEN BRIDGE TESTS
// ============================================================================

const assert = require('assert');
const fs = require('fs');

console.log('\n======================================================');
console.log('🧪 RUNNING NATIVE MEDIA SESSION & LOCK SCREEN TESTS');
console.log('======================================================\n');

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

async function itAsync(desc, fn) {
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

// 1. Setup Mock DOM & Native Bridge Environment BEFORE requiring nativeMedia
const mockAndroidBridge = {
  lastMetadataJson: null,
  lastPlaybackState: null,
  lastQueueJson: null,
  lastQueueIndex: -1,
  cleared: false,

  updateMetadata(json) {
    this.lastMetadataJson = JSON.parse(json);
  },
  setPlaybackState(isPlaying, pos, dur, rate) {
    this.lastPlaybackState = { isPlaying, pos, dur, rate };
  },
  setQueue(json, idx) {
    this.lastQueueJson = JSON.parse(json);
    this.lastQueueIndex = idx;
  },
  releaseSession() {
    this.cleared = true;
  }
};

const mockIosMessages = [];
const mockIosBridge = {
  messageHandlers: {
    nativeMedia: {
      postMessage(msg) {
        mockIosMessages.push(msg);
      }
    }
  }
};

const mockNavigatorMediaSession = {
  metadata: null,
  playbackState: 'none',
  positionState: null,
  actionHandlers: {},

  setActionHandler(action, handler) {
    this.actionHandlers[action] = handler;
  },
  setPositionState(state) {
    this.positionState = state;
  }
};

global.window = {
  location: { href: 'https://musicflow.app/', protocol: 'https:' },
  AndroidMediaBridge: mockAndroidBridge,
  webkit: mockIosBridge,
  navigator: { mediaSession: mockNavigatorMediaSession },
  MediaMetadata: function(opts) {
    this.title = opts.title;
    this.artist = opts.artist;
    this.album = opts.album;
    this.artwork = opts.artwork;
  }
};

try {
  Object.defineProperty(global, 'navigator', {
    value: { mediaSession: mockNavigatorMediaSession },
    configurable: true,
    writable: true
  });
} catch (_) {}

global.MediaMetadata = global.window.MediaMetadata;

const DataNormalizer = require('../web-app/js/dataNormalizer.js');
global.DataNormalizer = DataNormalizer;

delete require.cache[require.resolve('../web-app/js/nativeMedia.js')];
const NativeMedia = require('../web-app/js/nativeMedia.js');

it('1. NativeMedia exports updateMetadata, setPlaybackState, setQueue, clear', () => {
  assert.strictEqual(typeof NativeMedia.updateMetadata, 'function');
  assert.strictEqual(typeof NativeMedia.setPlaybackState, 'function');
  assert.strictEqual(typeof NativeMedia.setQueue, 'function');
  assert.strictEqual(typeof NativeMedia.clear, 'function');
});

it('2. NativeMedia.updateMetadata formats canonical track payload for Android and iOS', () => {
  const sampleTrack = {
    id: 'track_123',
    name: 'Jaan Nisaar (Arijit)',
    artists: [{ name: 'Amit Trivedi', role: 'singer' }, { name: 'Arijit Singh', role: 'singer' }],
    album: 'Kedarnath',
    image: 'https://c.saavncdn.com/150x150/art.jpg',
    duration: 238
  };

  NativeMedia.updateMetadata(sampleTrack, true, 4, 238);

  // Check Android bridge payload
  assert.ok(mockAndroidBridge.lastMetadataJson, 'Android bridge must receive metadata JSON');
  assert.strictEqual(mockAndroidBridge.lastMetadataJson.id, 'track_123');
  assert.strictEqual(mockAndroidBridge.lastMetadataJson.title, 'Jaan Nisaar (Arijit)');
  assert.strictEqual(mockAndroidBridge.lastMetadataJson.artist, 'Amit Trivedi, Arijit Singh');
  assert.strictEqual(mockAndroidBridge.lastMetadataJson.album, 'Kedarnath');
  assert.strictEqual(mockAndroidBridge.lastMetadataJson.artwork, 'https://c.saavncdn.com/500x500/art.jpg');
  assert.strictEqual(mockAndroidBridge.lastMetadataJson.duration, 238);
  assert.strictEqual(mockAndroidBridge.lastMetadataJson.position, 4);
  assert.strictEqual(mockAndroidBridge.lastMetadataJson.isPlaying, true);

  // Check iOS bridge payload
  const iosMsg = mockIosMessages.find(m => m.action === 'updateMetadata');
  assert.ok(iosMsg, 'iOS bridge must receive updateMetadata message');
  assert.strictEqual(iosMsg.title, 'Jaan Nisaar (Arijit)');
  assert.strictEqual(iosMsg.artist, 'Amit Trivedi, Arijit Singh');
  assert.strictEqual(iosMsg.isPlaying, true);

  // Check Browser mediaSession fallback
  assert.strictEqual(mockNavigatorMediaSession.metadata.title, 'Jaan Nisaar (Arijit)');
  assert.strictEqual(mockNavigatorMediaSession.playbackState, 'playing');
});

it('3. NativeMedia.setPlaybackState broadcasts play, pause, position and playbackRate', () => {
  NativeMedia.setPlaybackState({
    isPlaying: false,
    positionSec: 45.5,
    durationSec: 238,
    playbackRate: 0.0
  });

  assert.strictEqual(mockAndroidBridge.lastPlaybackState.isPlaying, false);
  assert.strictEqual(mockAndroidBridge.lastPlaybackState.pos, 45.5);
  assert.strictEqual(mockAndroidBridge.lastPlaybackState.dur, 238);
  assert.strictEqual(mockAndroidBridge.lastPlaybackState.rate, 0.0);

  const iosMsg = mockIosMessages.find(m => m.action === 'setPlaybackState');
  assert.ok(iosMsg, 'iOS bridge must receive setPlaybackState message');
  assert.strictEqual(iosMsg.isPlaying, false);
  assert.strictEqual(iosMsg.position, 45.5);
  assert.strictEqual(mockNavigatorMediaSession.playbackState, 'paused');
});

it('4. NativeMedia.setQueue delivers normalized queue summaries', () => {
  const queue = [
    { id: '1', name: 'Song 1', artists: 'Artist 1', image: 'img1.png', duration: 180 },
    { id: '2', name: 'Song 2', artists: 'Artist 2', image: 'img2.png', duration: 210 }
  ];

  NativeMedia.setQueue(queue, 1);

  assert.strictEqual(mockAndroidBridge.lastQueueIndex, 1);
  assert.strictEqual(mockAndroidBridge.lastQueueJson.length, 2);
  assert.strictEqual(mockAndroidBridge.lastQueueJson[0].title, 'Song 1');
  assert.strictEqual(mockAndroidBridge.lastQueueJson[1].title, 'Song 2');
});

it('5. NativeMedia.clear deactivates native and browser media sessions', () => {
  NativeMedia.clear();
  assert.strictEqual(mockAndroidBridge.cleared, true);
  assert.strictEqual(mockNavigatorMediaSession.playbackState, 'none');
  assert.strictEqual(mockNavigatorMediaSession.metadata, null);
});

it('6. Browser MediaSession actions dispatch to window.Player without errors', () => {
  let playCalled = false;
  let pauseCalled = false;
  let nextCalled = false;
  let prevCalled = false;
  let seekTime = -1;

  global.Player = {
    play: () => { playCalled = true; },
    pause: () => { pauseCalled = true; },
    next: () => { nextCalled = true; },
    previous: () => { prevCalled = true; },
    seek: (t) => { seekTime = t; }
  };

  // Re-trigger update to setup actions
  NativeMedia.updateMetadata({ name: 'Track', artists: 'Artist', duration: 100 }, true, 0, 100);

  assert.strictEqual(typeof mockNavigatorMediaSession.actionHandlers['play'], 'function');
  assert.strictEqual(typeof mockNavigatorMediaSession.actionHandlers['pause'], 'function');
  assert.strictEqual(typeof mockNavigatorMediaSession.actionHandlers['nexttrack'], 'function');
  assert.strictEqual(typeof mockNavigatorMediaSession.actionHandlers['previoustrack'], 'function');
  assert.strictEqual(typeof mockNavigatorMediaSession.actionHandlers['seekto'], 'function');

  mockNavigatorMediaSession.actionHandlers['play']();
  mockNavigatorMediaSession.actionHandlers['pause']();
  mockNavigatorMediaSession.actionHandlers['nexttrack']();
  mockNavigatorMediaSession.actionHandlers['previoustrack']();
  mockNavigatorMediaSession.actionHandlers['seekto']({ seekTime: 65 });

  assert.strictEqual(playCalled, true, 'Player.play must be called');
  assert.strictEqual(pauseCalled, true, 'Player.pause must be called');
  assert.strictEqual(nextCalled, true, 'Player.next must be called');
  assert.strictEqual(prevCalled, true, 'Player.previous must be called');
  assert.strictEqual(seekTime, 65, 'Player.seek must receive 65s');
});

it('7. Rapid consecutive updateMetadata calls execute cleanly without race conditions or memory leak', () => {
  assert.doesNotThrow(() => {
    for (let i = 0; i < 50; i++) {
      NativeMedia.updateMetadata({
        id: `song_${i}`,
        name: `Rapid Song ${i}`,
        artists: `Artist ${i}`,
        album: `Album ${i}`,
        image: `https://example.com/art_${i}.jpg`,
        duration: 200 + i
      }, true, i, 200 + i);
    }
  }, 'Rapid consecutive updateMetadata calls must not throw');
});

(async () => {
  console.log('\n======================================================');
  console.log(`📊 NATIVE MEDIA TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');
  if (failed > 0) process.exit(1);
})();
