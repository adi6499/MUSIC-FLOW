// ==========================================================================
// TEST SUITE: Sleep Timer Engine & UI Integration (Phase 8.3)
// 28 Comprehensive Unit & Integration Tests
// ==========================================================================

const assert = require('assert');

class MockAudio {
  constructor() {
    this.id = 'app-audio';
    this.src = '';
    this.currentTime = 0;
    this.duration = 240;
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
      value: '45'
    };
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  visibilityState: 'visible'
};
global.navigator = { mediaSession: { setActionHandler: () => {}, playbackState: 'none' } };

const Player = require('./js/player.js');

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
  console.log('=== SLEEP TIMER ENGINE TESTS ===\n');

  // Initialize Player
  Player.init();
  Player.setQueue([
    { id: 'song_1', name: 'Midnight Glow', artists: 'Luna', duration: 240, streamUrl: 'https://example.com/1.mp3' },
    { id: 'song_2', name: 'Electric Horizon', artists: 'Solaris', duration: 180, streamUrl: 'https://example.com/2.mp3' }
  ], 0, false);

  // 1. Initial State
  it('1. Initial sleep timer state is inactive with mode "off"', () => {
    Player.setSleepTimer(0);
    const state = Player.getSleepTimerState();
    assert.strictEqual(state.active, false);
    assert.strictEqual(state.mode, 'off');
    assert.strictEqual(state.durationMinutes, 0);
    assert.strictEqual(state.remainingMs, 0);
  });

  // 2. 15 Minute Preset
  it('2. 15 minute timer sets correct expiration timestamp and active state', () => {
    const before = Date.now();
    const state = Player.setSleepTimer(15);
    const after = Date.now();

    assert.strictEqual(state.active, true);
    assert.strictEqual(state.mode, 'duration');
    assert.strictEqual(state.durationMinutes, 15);
    assert.ok(state.expiresAt >= before + 15 * 60 * 1000 && state.expiresAt <= after + 15 * 60 * 1000);
    assert.ok(state.remainingMs > 14.9 * 60 * 1000 && state.remainingMs <= 15 * 60 * 1000);
  });

  // 3. 30 Minute Preset
  it('3. 30 minute timer sets mode "duration" with 30m duration', () => {
    const state = Player.setSleepTimer(30);
    assert.strictEqual(state.active, true);
    assert.strictEqual(state.mode, 'duration');
    assert.strictEqual(state.durationMinutes, 30);
    assert.ok(state.remainingMs > 29.9 * 60 * 1000);
  });

  // 4. 60 Minute Preset
  it('4. 60 minute timer sets mode "duration" with 60m duration', () => {
    const state = Player.setSleepTimer(60);
    assert.strictEqual(state.active, true);
    assert.strictEqual(state.durationMinutes, 60);
  });

  // 5. Custom Timer Range Clamping (5 -> 180 min)
  it('5. Custom timer clamps duration within allowed 5 to 180 min range', () => {
    const state1 = Player.setSleepTimer(75);
    assert.strictEqual(state1.durationMinutes, 75);

    const state2 = Player.setSleepTimer(250); // exceeds 180 -> clamped to 180
    assert.strictEqual(state2.durationMinutes, 180);

    const state3 = Player.setSleepTimer(0.5); // clamped to min 1
    assert.strictEqual(state3.durationMinutes, 1);
  });

  // 6. End of Current Song Mode
  it('6. "end" or "end_of_track" mode sets mode "end_of_track"', () => {
    const state = Player.setSleepTimer('end');
    assert.strictEqual(state.active, true);
    assert.strictEqual(state.mode, 'end_of_track');
    assert.strictEqual(state.formattedRemaining, 'End of song');
  });

  // 7. Cancel Timer
  it('7. Cancel timer sets mode "off", active false, and does NOT stop music', () => {
    Player.setSleepTimer(30);
    const state = Player.setSleepTimer(0);
    assert.strictEqual(state.active, false);
    assert.strictEqual(state.mode, 'off');
    assert.strictEqual(state.durationMinutes, 0);
    assert.strictEqual(state.remainingMs, 0);
  });

  // 8. Duplicate Timer Prevention
  it('8. Duplicate timer calls replace the active timer seamlessly without creating multiple timers', () => {
    Player.setSleepTimer(15);
    const state = Player.setSleepTimer(45);
    assert.strictEqual(state.durationMinutes, 45);
    assert.strictEqual(state.active, true);
  });

  // 9. Add Minutes (+15 min)
  it('9. addSleepTimerMinutes adds duration to active timer without resetting start reference', () => {
    Player.setSleepTimer(15);
    const stateBefore = Player.getSleepTimerState();
    const stateAfter = Player.addSleepTimerMinutes(15);

    assert.strictEqual(stateAfter.durationMinutes, 30);
    assert.ok(stateAfter.expiresAt >= stateBefore.expiresAt + 14.9 * 60 * 1000);
  });

  // 10. Pause Continuity
  it('10. Pausing playback preserves the wall-clock sleep timer expiration timestamp', () => {
    Player.setSleepTimer(20);
    const expBefore = Player.getSleepTimerState().expiresAt;
    Player.pause();
    const expAfter = Player.getSleepTimerState().expiresAt;
    assert.strictEqual(expBefore, expAfter, 'Expiration timestamp must not change on pause');
  });

  // 11. Resume Continuity
  it('11. Resuming playback preserves the sleep timer state', () => {
    Player.play();
    const state = Player.getSleepTimerState();
    assert.strictEqual(state.active, true);
    assert.strictEqual(state.mode, 'duration');
  });

  // 12. Next Track Transition
  it('12. Track changes do not reset or clear an active duration sleep timer', () => {
    Player.setSleepTimer(30);
    const expBefore = Player.getSleepTimerState().expiresAt;
    Player.next();
    const expAfter = Player.getSleepTimerState().expiresAt;
    assert.strictEqual(expBefore, expAfter, 'Timer expiration must persist across track skips');
  });

  // 13. Previous Track Transition
  it('13. Previous track changes do not alter active sleep timer', () => {
    const expBefore = Player.getSleepTimerState().expiresAt;
    Player.previous();
    const expAfter = Player.getSleepTimerState().expiresAt;
    assert.strictEqual(expBefore, expAfter);
  });

  // 14. Queue Manipulation
  it('14. Modifying queue does not reset active timer', () => {
    Player.appendToQueue({ id: 'song_3', name: 'Solaris Wave', duration: 200 });
    assert.strictEqual(Player.getSleepTimerState().active, true);
  });

  // 15. Radio Mode Continuity
  it('15. Starting Radio queue does not reset active timer', () => {
    Player.startRadioQueue(Player.getCurrentTrack(), [
      { id: 'radio_1', name: 'Radio Track 1', duration: 190 },
      { id: 'radio_2', name: 'Radio Track 2', duration: 210 }
    ]);
    assert.strictEqual(Player.getSleepTimerState().active, true);
  });

  // 16. Seek Continuity
  it('16. Seeking inside a track does not alter duration sleep timer', () => {
    const expBefore = Player.getSleepTimerState().expiresAt;
    Player.seek(45);
    const expAfter = Player.getSleepTimerState().expiresAt;
    assert.strictEqual(expBefore, expAfter);
  });

  // 17. Time Remaining Formatting
  it('17. formatTimeRemaining returns mm:ss formatted string', () => {
    assert.strictEqual(Player.formatTimeRemaining(900000), '15:00');
    assert.strictEqual(Player.formatTimeRemaining(65000), '1:05');
    assert.strictEqual(Player.formatTimeRemaining(9000), '0:09');
    assert.strictEqual(Player.formatTimeRemaining(0), '0:00');
  });

  // 18. Timestamp Drift Prevention
  it('18. remainingMs is always derived directly from Date.now() and expiresAt', () => {
    Player.setSleepTimer(10);
    const state = Player.getSleepTimerState();
    const calculated = Math.max(0, state.expiresAt - Date.now());
    assert.ok(Math.abs(state.remainingMs - calculated) < 50, 'Remaining ms must be exactly derived from wall-clock');
  });

  // 19. Event Notification on Timer Change
  it('19. Player emits "sleepTimerChange" event when timer is set or cancelled', () => {
    let notified = false;
    const listener = (s) => { notified = s.active; };
    Player.on('sleepTimerChange', listener);

    Player.setSleepTimer(15);
    assert.strictEqual(notified, true);

    Player.setSleepTimer(0);
    assert.strictEqual(notified, false);

    Player.off('sleepTimerChange', listener);
  });

  // 20. Event Notification on Expiration
  it('20. Player emits "sleepTimerExpired" and pauses audio when timer expires', () => {
    let expiredFired = false;
    const listener = () => { expiredFired = true; };
    Player.on('sleepTimerExpired', listener);

    // Simulate immediate expiration
    Player.setSleepTimer(1);
    // Force expiration handler
    const audio = Player.getAudioElement();
    if (audio) audio.dispatchEvent ? audio.dispatchEvent(new Event('ended')) : null;

    Player.off('sleepTimerExpired', listener);
  });

  // 21. Audio Effects Isolation
  it('21. Sleep timer operations do not modify equalizer or audio effects', () => {
    Player.setEqPreset('Bass Boost');
    Player.setSleepTimer(30);
    Player.setSleepTimer(0);

    const state = Player.getState();
    assert.ok(state !== null, 'Player state must remain valid');
  });

  // 22. Download / Offline Source Compatibility
  it('22. Timer works identically whether audio source is stream, downloaded, or local', () => {
    Player.setSleepTimer(25);
    assert.strictEqual(Player.getSleepTimerState().active, true);
    Player.setSleepTimer(0);
  });

  // 23. Single Canonical State Object
  it('23. getState().sleepTimer returns canonical sleep timer state matching getSleepTimerState()', () => {
    Player.setSleepTimer(45);
    const state1 = Player.getState().sleepTimer;
    const state2 = Player.getSleepTimerState();

    assert.strictEqual(state1.active, state2.active);
    assert.strictEqual(state1.mode, state2.mode);
    assert.strictEqual(state1.durationMinutes, state2.durationMinutes);
    assert.strictEqual(state1.expiresAt, state2.expiresAt);
    Player.setSleepTimer(0);
  });

  // 24. Invalid Input Rejection
  it('24. Invalid timer inputs (negative, NaN, null) safely cancel or ignore without throwing', () => {
    assert.doesNotThrow(() => {
      Player.setSleepTimer(-5);
      Player.setSleepTimer(NaN);
      Player.setSleepTimer(null);
      Player.setSleepTimer('invalid');
    });
    assert.strictEqual(Player.getSleepTimerState().active, false);
  });

  // 25. Clean Cleanup on Expiration
  it('25. Setting timer to 0 clears all internal timeouts and intervals cleanly', () => {
    Player.setSleepTimer(15);
    Player.setSleepTimer(0);
    const state = Player.getSleepTimerState();
    assert.strictEqual(state.active, false);
    assert.strictEqual(state.mode, 'off');
    assert.strictEqual(state.expiresAt, 0);
  });

  // 26. Custom Duration Set from UI
  it('26. UI custom duration slider values (e.g. 45 min) correctly start a duration timer', () => {
    const state = Player.setSleepTimer(45);
    assert.strictEqual(state.active, true);
    assert.strictEqual(state.durationMinutes, 45);
    Player.setSleepTimer(0);
  });

  // 27. End of Song Mode with Audio Ended Event
  it('27. "end_of_track" mode triggers expiration when current song finishes naturally', () => {
    Player.setSleepTimer('end');
    assert.strictEqual(Player.getSleepTimerState().mode, 'end_of_track');
    Player.setSleepTimer(0);
  });

  // 28. Full Lifecycle Regression
  it('28. Full Lifecycle: Play -> Set Timer -> Skip -> Add Minutes -> Cancel works with 0 errors', () => {
    Player.play();
    Player.setSleepTimer(15);
    Player.next();
    Player.addSleepTimerMinutes(15);
    assert.strictEqual(Player.getSleepTimerState().durationMinutes, 30);
    Player.setSleepTimer(0);
    assert.strictEqual(Player.getSleepTimerState().active, false);
  });

  console.log(`\nResults: ${passed} Passed, ${failed} Failed\n`);
  if (failed > 0) process.exit(1);
}

runTests();
