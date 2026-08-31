// ============================================================================
// MUSICFLOW — iOS PRODUCTION BLOCKER VERIFICATION TEST SUITE
// Verifies:
// 1. Native iOS AppIcon asset catalog & bundle root files (iPhone @2x, @3x, iPad)
// 2. iOS Background Audio capability, AVAudioSession lifecycle, and lock-screen controls
// 3. Mini Player & Bottom Navigation cohesive spacing (6px gap on all screen sizes)
// ============================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

async function main() {
  console.log('\n=============================================================');
  console.log('  MUSICFLOW — iOS PRODUCTION BLOCKER TEST SUITE');
  console.log('=============================================================\n');

  const rootDir = path.resolve(__dirname, '..');

  // --------------------------------------------------------------------------
  // 1. NATIVE iOS APP ICONS
  // --------------------------------------------------------------------------
  runTest('1. AppIcon Set: All required iPhone and iPad icon files exist with valid sizes', () => {
    const iconSetDir = path.join(rootDir, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
    assert.ok(fs.existsSync(iconSetDir), 'AppIcon.appiconset directory must exist');

    const requiredIcons = [
      'AppIcon-20@2x.png',
      'AppIcon-20@3x.png',
      'AppIcon-29@2x.png',
      'AppIcon-29@3x.png',
      'AppIcon-40@2x.png',
      'AppIcon-40@3x.png',
      'AppIcon-60@2x.png',
      'AppIcon-60@3x.png',
      'AppIcon-76@2x.png',
      'AppIcon-83.5@2x.png',
      'AppIcon-512@2x.png',
      'AppIcon60x60@2x.png',
      'AppIcon60x60@3x.png'
    ];

    for (const icon of requiredIcons) {
      const p = path.join(iconSetDir, icon);
      assert.ok(fs.existsSync(p), `Icon file ${icon} must exist`);
      const stat = fs.statSync(p);
      assert.ok(stat.size > 1000, `Icon file ${icon} must be non-empty image (> 1KB)`);
    }
  });

  runTest('2. Info.plist: Configures CFBundleIcons, CFBundleIconFiles and UIBackgroundModes audio', () => {
    const plistPath = path.join(rootDir, 'ios', 'App', 'App', 'Info.plist');
    assert.ok(fs.existsSync(plistPath), 'Info.plist must exist');

    const content = fs.readFileSync(plistPath, 'utf8');
    assert.ok(content.includes('<key>CFBundleIconName</key>'), 'Must specify CFBundleIconName');
    assert.ok(content.includes('<string>AppIcon</string>'), 'CFBundleIconName must be AppIcon');
    assert.ok(content.includes('AppIcon-60@3x.png') || content.includes('AppIcon60x60@3x.png'), 'Must declare iPhone @3x icon');
    assert.ok(content.includes('AppIcon-60@2x.png') || content.includes('AppIcon60x60@2x.png'), 'Must declare iPhone @2x icon');
    assert.ok(content.includes('<key>UIBackgroundModes</key>'), 'Must specify UIBackgroundModes');
    assert.ok(content.includes('<string>audio</string>'), 'UIBackgroundModes must include audio');
  });

  // --------------------------------------------------------------------------
  // 2. iOS BACKGROUND AUDIO & LIFECYCLE
  // --------------------------------------------------------------------------
  runTest('3. AppDelegate: Configures AVAudioSession .playback and remote commands', () => {
    const appDelegatePath = path.join(rootDir, 'ios', 'App', 'App', 'AppDelegate.swift');
    assert.ok(fs.existsSync(appDelegatePath), 'AppDelegate.swift must exist');

    const content = fs.readFileSync(appDelegatePath, 'utf8');
    assert.ok(content.includes('.setCategory(.playback'), 'Must set AVAudioSession category to .playback');
    assert.ok(content.includes('.allowBluetooth'), 'Must support Bluetooth audio routes');
    assert.ok(content.includes('.allowAirPlay'), 'Must support AirPlay audio routes');
    assert.ok(content.includes('AVAudioSession.interruptionNotification'), 'Must observe audio interruptions (phone calls)');
    assert.ok(content.includes('AVAudioSession.routeChangeNotification'), 'Must observe audio route changes (unplugged headphones)');
    assert.ok(content.includes('MPRemoteCommandCenter.shared()'), 'Must configure MPRemoteCommandCenter');
    assert.ok(content.includes('previousTrackCommand'), 'Must handle previous track lockscreen command');
    assert.ok(content.includes('nextTrackCommand'), 'Must handle next track lockscreen command');
    assert.ok(content.includes('playCommand'), 'Must handle play lockscreen command');
    assert.ok(content.includes('pauseCommand'), 'Must handle pause lockscreen command');
    assert.ok(content.includes('togglePlayPauseCommand'), 'Must handle toggle play/pause lockscreen command');
    assert.ok(content.includes('MPNowPlayingInfoCenter.default().nowPlayingInfo'), 'Must update NowPlayingInfo metadata');
  });

  runTest('4. NativeMedia Bridge: Dispatches metadata and state to iOS WKScriptMessageHandler', () => {
    const nativeMediaJs = fs.readFileSync(path.join(__dirname, 'js', 'nativeMedia.js'), 'utf8');
    assert.ok(nativeMediaJs.includes('window.webkit?.messageHandlers?.nativeMedia'), 'Must communicate with WebKit messageHandler');
    assert.ok(nativeMediaJs.includes('updateMetadata'), 'Must dispatch updateMetadata action');
    assert.ok(nativeMediaJs.includes('setPlaybackState'), 'Must dispatch setPlaybackState action');
  });

  // --------------------------------------------------------------------------
  // 3. MINI PLAYER & BOTTOM NAVBAR COHESIVE SPACING
  // --------------------------------------------------------------------------
  runTest('5. CSS Spacing: Mini Player and Bottom Nav use unified formula with 6px gap', () => {
    const css = fs.readFileSync(path.join(__dirname, 'css', 'app.css'), 'utf8');

    // Bottom Nav position
    assert.ok(css.includes('.floating-bottom-nav'), 'Must define .floating-bottom-nav');
    assert.ok(css.includes('bottom: max(8px, env(safe-area-inset-bottom, 8px));'), 'Navbar must anchor to safe-area + 8px');
    assert.ok(css.includes('height: 56px;'), 'Navbar height must be 56px');

    // Mini Player position: Exactly (Navbar bottom + Navbar height 56px + Gap 6px)
    assert.ok(css.includes('.mini-player-dock'), 'Must define .mini-player-dock');
    assert.ok(css.includes('bottom: calc(max(8px, env(safe-area-inset-bottom, 8px)) + 56px + 6px);'), 'Mini Player must sit exactly 6px above Bottom Navbar');

    // No disjoint margins
    assert.ok(!css.includes('bottom: calc(68px + env(safe-area-inset-bottom, 12px));'), 'Old disjoint 28px gap must be removed');
  });

  // --------------------------------------------------------------------------
  // 4. iOS BACKGROUND AUDIO FIX — CRITICAL
  // --------------------------------------------------------------------------
  runTest('6. AudioEffectsEngine: Lazy init does NOT call createMediaElementSource on init()', () => {
    const aeePath = path.join(__dirname, 'js', 'audioEffectsEngine.js');
    const content = fs.readFileSync(aeePath, 'utf8');

    // init() must NOT contain createMediaElementSource
    // It should be in attachToElement() only
    const initMatch = content.match(/function init\(audioElement\)\s*\{[\s\S]*?\n  \}/);
    assert.ok(initMatch, 'Must have an init() function');
    assert.ok(!initMatch[0].includes('createMediaElementSource'), 'init() must NOT call createMediaElementSource (lazy init)');

    // attachToElement() SHOULD contain createMediaElementSource
    assert.ok(content.includes('function attachToElement('), 'Must have attachToElement() method');
    const attachMatch = content.match(/function attachToElement[\s\S]*?createMediaElementSource/);
    assert.ok(attachMatch, 'attachToElement() must call createMediaElementSource');
  });

  runTest('7. AudioEffectsEngine: Exports detachFromElement, attachToElement, isAttached', () => {
    const aeePath = path.join(__dirname, 'js', 'audioEffectsEngine.js');
    const content = fs.readFileSync(aeePath, 'utf8');

    assert.ok(content.includes('detachFromElement'), 'Must export detachFromElement');
    assert.ok(content.includes('attachToElement'), 'Must export attachToElement');
    assert.ok(content.includes('isAttached'), 'Must export isAttached');
  });

  runTest('8. AudioEffectsEngine: detachFromElement closes AudioContext', () => {
    const aeePath = path.join(__dirname, 'js', 'audioEffectsEngine.js');
    const content = fs.readFileSync(aeePath, 'utf8');

    const detachMatch = content.match(/function detachFromElement[\s\S]*?\n  \}/);
    assert.ok(detachMatch, 'Must have detachFromElement() function');
    assert.ok(detachMatch[0].includes('audioCtx.close()'), 'detachFromElement must close AudioContext');
    assert.ok(detachMatch[0].includes('_isAttached = false'), 'detachFromElement must set _isAttached = false');
  });

  runTest('9. Player: Exports _handleBackgroundTransition and _handleForegroundTransition', () => {
    const playerPath = path.join(__dirname, 'js', 'player.js');
    const content = fs.readFileSync(playerPath, 'utf8');

    assert.ok(content.includes('_handleBackgroundTransition'), 'Must have _handleBackgroundTransition');
    assert.ok(content.includes('_handleForegroundTransition'), 'Must have _handleForegroundTransition');

    // Must be in the public return object
    const returnMatch = content.match(/return \{[\s\S]*?\};[\s\S]*?\}\)\(\)/);
    assert.ok(returnMatch, 'Must have return statement');
    assert.ok(returnMatch[0].includes('_handleBackgroundTransition'), '_handleBackgroundTransition must be exported');
    assert.ok(returnMatch[0].includes('_handleForegroundTransition'), '_handleForegroundTransition must be exported');
  });

  runTest('10. Player: Background handler maintains single audio stream without creating rogue elements', () => {
    const playerPath = path.join(__dirname, 'js', 'player.js');
    const content = fs.readFileSync(playerPath, 'utf8');

    // Background transition must maintain single audio pipeline
    assert.ok(content.includes('_handleBackgroundTransition'), 'Must export _handleBackgroundTransition');
    assert.ok(content.includes('_handleForegroundTransition'), 'Must export _handleForegroundTransition');
    assert.ok(!content.includes('_backgroundAudioEl = new Audio()'), 'Must NOT create duplicate rogue audio elements in background');
  });

  runTest('11. Player: AudioContext suspension handling on iOS', () => {
    const playerPath = path.join(__dirname, 'js', 'player.js');
    const content = fs.readFileSync(playerPath, 'utf8');

    assert.ok(content.includes('audioCtx.state === \'suspended\'') || content.includes("audioCtx.state === 'suspended'"),
      'Must check for AudioContext suspended state');
  });

  runTest('12. AppDelegate: applicationDidEnterBackground maintains continuous audio session', () => {
    const appDelegatePath = path.join(rootDir, 'ios', 'App', 'App', 'AppDelegate.swift');
    const content = fs.readFileSync(appDelegatePath, 'utf8');

    assert.ok(content.includes('applicationDidEnterBackground'), 'Must implement applicationDidEnterBackground');
    assert.ok(content.includes('configureAudioSession()'), 'applicationDidEnterBackground must configure audio session');
  });

  runTest('13. AppDelegate: applicationWillEnterForeground restores audio session and bridge', () => {
    const appDelegatePath = path.join(rootDir, 'ios', 'App', 'App', 'AppDelegate.swift');
    const content = fs.readFileSync(appDelegatePath, 'utf8');

    assert.ok(content.includes('applicationWillEnterForeground'), 'Must implement applicationWillEnterForeground');
    assert.ok(content.includes('setupWebViewBridge()'), 'applicationWillEnterForeground must re-verify webview bridge');
    assert.ok(content.includes('configureAudioSession()'), 'applicationWillEnterForeground must re-activate audio session');
  });

  runTest('14. AppDelegate: Observes mediaServicesWereResetNotification', () => {
    const appDelegatePath = path.join(rootDir, 'ios', 'App', 'App', 'AppDelegate.swift');
    const content = fs.readFileSync(appDelegatePath, 'utf8');

    assert.ok(content.includes('mediaServicesWereResetNotification'), 'Must observe mediaServicesWereResetNotification');
  });

  runTest('15. AudioEffectsEngine: iOS detection defers Web Audio attachment', () => {
    const aeePath = path.join(__dirname, 'js', 'audioEffectsEngine.js');
    const content = fs.readFileSync(aeePath, 'utf8');

    // init() must check for iOS and defer attachment
    assert.ok(content.includes('iPad|iPhone|iPod'), 'init() must detect iOS devices');
    assert.ok(content.includes('Deferred Web Audio attachment'), 'init() must log deferred attachment on iOS');
  });

  console.log('\n=============================================================');
  console.log(`  TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
  console.log('=============================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
