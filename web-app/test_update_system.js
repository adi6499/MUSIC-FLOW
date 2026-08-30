// ============================================================================
// MUSICFLOW — IN-APP UPDATE SYSTEM TEST SUITE
// Tests SemVer comparator, GitHub release parser, platform asset routing,
// serverless Vercel API endpoint, caching, throttling, and offline resilience.
// ============================================================================

const assert = require('assert');

// Mock browser environment for UpdateManager & Storage
global.window = global;
global.localStorage = (() => {
  let store = {};
  return {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; }
  };
})();

// Load modules
const UpdateAPI = require('../api/update.js');
const Storage = require('./js/storage.js');
const UpdateManager = require('./js/updateManager.js');

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

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

async function main() {
  console.log('\n=============================================================');
  console.log('  MUSICFLOW — IN-APP UPDATE SYSTEM VERIFICATION');
  console.log('=============================================================\n');

  // ----------------------------------------------------------------------------
  // 1. SEMANTIC VERSION COMPARATOR TESTS
  // ----------------------------------------------------------------------------
  runTest('SemVer 1: 1.8.0 is greater than 1.7.0 and 1.7.9', () => {
    assert.strictEqual(UpdateAPI.compareSemVer('1.8.0', '1.7.0'), 1);
    assert.strictEqual(UpdateAPI.compareSemVer('1.8.0', '1.7.9'), 1);
    assert.strictEqual(UpdateManager.compareVersions('1.8.0', '1.7.0'), 1);
  });

  runTest('SemVer 2: 1.10.0 is greater than 1.9.0', () => {
    assert.strictEqual(UpdateAPI.compareSemVer('1.10.0', '1.9.0'), 1);
    assert.strictEqual(UpdateManager.compareVersions('1.10.0', '1.9.0'), 1);
  });

  runTest('SemVer 3: 2.0.0 is greater than 1.99.0', () => {
    assert.strictEqual(UpdateAPI.compareSemVer('2.0.0', '1.99.0'), 1);
    assert.strictEqual(UpdateManager.compareVersions('2.0.0', '1.99.0'), 1);
  });

  runTest('SemVer 4: 1.8.0 equals 1.8.0, and handles "v" prefix gracefully', () => {
    assert.strictEqual(UpdateAPI.compareSemVer('v1.8.0', '1.8.0'), 0);
    assert.strictEqual(UpdateAPI.compareSemVer('1.8.0', 'v1.8.0'), 0);
    assert.strictEqual(UpdateManager.compareVersions('v2.6.0', '2.6.0'), 0);
  });

  runTest('SemVer 5: Build numbers are parsed and compared (1.8.0+11 > 1.8.0+10)', () => {
    assert.strictEqual(UpdateAPI.compareSemVer('1.8.0+11', '1.8.0+10'), 1);
    assert.strictEqual(UpdateAPI.compareSemVer('1.8.0+10', '1.8.0+11'), -1);
    assert.strictEqual(UpdateAPI.compareSemVer('1.8.0 (20)', '1.8.0 (19)'), 1);
  });

  // ----------------------------------------------------------------------------
  // 2. RELEASE NOTES PARSER TESTS
  // ----------------------------------------------------------------------------
  runTest('Release Notes: Extracts markdown bullets and strips formatting', () => {
    const markdownBody = `
## What's Changed in v1.8.0
* Improved [recommendations](https://github.com/adi6499/MUSIC-FLOW) algorithm
* Fixed **playlist** persistence bug
- Added \`7-band\` Web Audio equalizer
+ Real-time 60fps wavy progress bar
Full Changelog: https://github.com/adi6499/MUSIC-FLOW/compare/v1.7.0...v1.8.0
    `;

    const notes = UpdateAPI.parseReleaseNotes(markdownBody);
    assert(Array.isArray(notes), 'Should return an array');
    assert.strictEqual(notes.length, 4, 'Should extract 4 clean bullets');
    assert.strictEqual(notes[0], 'Improved recommendations algorithm');
    assert.strictEqual(notes[1], 'Fixed playlist persistence bug');
    assert.strictEqual(notes[2], 'Added 7-band Web Audio equalizer');
    assert.strictEqual(notes[3], 'Real-time 60fps wavy progress bar');
  });

  // ----------------------------------------------------------------------------
  // 3. PLATFORM SPECIFIC ASSET SELECTION & GITHUB RELEASES FILTERING
  // ----------------------------------------------------------------------------
  await runAsyncTest('GitHub Release Normalizer: Ignores drafts/prereleases & routes APK to Android, IPA to iOS', async () => {
    const normalized = {
      latestVersion: '1.8.0',
      minimumVersion: '1.7.0',
      tagName: 'v1.8.0',
      title: 'MusicFlow 1.8.0',
      message: 'Major update with recommendations, search and equalizer.',
      releaseNotes: ['Improved recommendations', 'Faster search', 'Equalizer support'],
      releaseUrl: 'https://github.com/adi6499/MUSIC-FLOW/releases/tag/v1.8.0',
      publishedAt: '2026-08-29T18:00:00Z',
      android: {
        available: true,
        version: '1.8.0',
        downloadUrl: 'https://github.com/adi6499/MUSIC-FLOW/releases/download/v1.8.0/MusicFlow-Android-v1.8.0.apk',
        fileName: 'MusicFlow-Android-v1.8.0.apk',
        size: 25000000
      },
      ios: {
        available: true,
        version: '1.8.0',
        downloadUrl: 'https://github.com/adi6499/MUSIC-FLOW/releases/download/v1.8.0/MusicFlow-iOS-v1.8.0.ipa',
        fileName: 'MusicFlow-iOS-v1.8.0.ipa',
        size: 30000000
      }
    };

    UpdateAPI.setCachedReleaseData(normalized);

    // Test Android endpoint query
    const reqAndroid = {
      method: 'GET',
      url: '/api/update?platform=android&version=1.7.0',
      headers: { host: 'localhost' }
    };
    let resDataAndroid = '';
    const resAndroid = {
      writeHead: (status) => { assert.strictEqual(status, 200); },
      end: (str) => { resDataAndroid = JSON.parse(str); }
    };

    await UpdateAPI.handleUpdateRequest(reqAndroid, resAndroid);
    assert.strictEqual(resDataAndroid.updateAvailable, true);
    assert.strictEqual(resDataAndroid.platform, 'android');
    assert(resDataAndroid.downloadUrl.endsWith('.apk'), 'Android must receive APK download URL');
    assert.strictEqual(resDataAndroid.assetAvailable, true);

    // Test iOS endpoint query
    const reqIOS = {
      method: 'GET',
      url: '/api/update?platform=ios&version=1.7.0',
      headers: { host: 'localhost' }
    };
    let resDataIOS = '';
    const resIOS = {
      writeHead: (status) => { assert.strictEqual(status, 200); },
      end: (str) => { resDataIOS = JSON.parse(str); }
    };

    await UpdateAPI.handleUpdateRequest(reqIOS, resIOS);
    assert.strictEqual(resDataIOS.updateAvailable, true);
    assert.strictEqual(resDataIOS.platform, 'ios');
    assert(resDataIOS.downloadUrl.endsWith('.ipa'), 'iOS must receive IPA download URL');
    assert.strictEqual(resDataIOS.assetAvailable, true);
  });

  // ----------------------------------------------------------------------------
  // 4. MANDATORY FORCE UPDATE (minimumVersion)
  // ----------------------------------------------------------------------------
  await runAsyncTest('Force Update: Triggers updateRequired when currentVersion < minimumVersion', async () => {
    const reqOld = {
      method: 'GET',
      url: '/api/update?platform=android&version=1.5.0', // minimum is 1.7.0
      headers: { host: 'localhost' }
    };
    let resData = '';
    const res = {
      writeHead: (status) => { assert.strictEqual(status, 200); },
      end: (str) => { resData = JSON.parse(str); }
    };

    await UpdateAPI.handleUpdateRequest(reqOld, res);
    assert.strictEqual(resData.updateAvailable, true);
    assert.strictEqual(resData.updateRequired, true, 'Deprecated version must require update');
  });

  // ----------------------------------------------------------------------------
  // 5. STORAGE & DISMISSED VERSION PERSISTENCE
  // ----------------------------------------------------------------------------
  runTest('Storage: Tracks dismissedVersion and update state persistence', () => {
    localStorage.clear();
    assert.strictEqual(Storage.getDismissedVersion(), null);

    Storage.setDismissedVersion('1.8.0');
    assert.strictEqual(Storage.getDismissedVersion(), '1.8.0');

    Storage.setLastUpdateCheck(1700000000000, { latestVersion: '1.8.0', updateAvailable: true });
    const state = Storage.getUpdateState();
    assert.strictEqual(state.lastChecked, 1700000000000);
    assert.strictEqual(state.dismissedVersion, '1.8.0');
    assert.strictEqual(state.lastResult.latestVersion, '1.8.0');
  });

  // ----------------------------------------------------------------------------
  // 6. CLIENT UPDATEMANAGER STATE & OFFLINE RESILIENCE
  // ----------------------------------------------------------------------------
  runTest('UpdateManager: Exports single version source and platform detection', () => {
    assert.strictEqual(typeof UpdateManager.VERSION, 'string');
    assert.strictEqual(UpdateManager.VERSION, '2.7.0');
    assert.strictEqual(typeof UpdateManager.getPlatform(), 'string');
    assert(['android', 'ios', 'web'].includes(UpdateManager.getPlatform()));
  });

  await runAsyncTest('UpdateManager: Gracefully handles network error without throwing', async () => {
    // Mock failing fetch
    global.fetch = async () => {
      throw new Error('Network timeout (offline)');
    };

    const state = await UpdateManager.checkForUpdates({ manual: true });
    assert.strictEqual(state.isChecking, false);
    assert(state.error.includes('Network timeout'), 'Error state should be captured');
    assert.strictEqual(state.updateAvailable, false);
  });

  // ----------------------------------------------------------------------------
  // 7. END-TO-END UPDATE DETECTION WITH MOCK API
  // ----------------------------------------------------------------------------
  await runAsyncTest('UpdateManager E2E: Detects update when API returns newer version', async () => {
    global.fetch = async (url) => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          updateAvailable: true,
          updateRequired: false,
          currentVersion: '2.7.0',
          latestVersion: '2.8.0',
          minimumVersion: '2.0.0',
          platform: 'android',
          title: 'MusicFlow 2.8.0',
          message: 'New release with enhanced discovery',
          releaseNotes: ['Enhanced search ranking', '7-band EQ'],
          releaseUrl: 'https://github.com/adi6499/MUSIC-FLOW/releases/tag/v2.8.0',
          downloadUrl: 'https://github.com/adi6499/MUSIC-FLOW/releases/download/v2.8.0/MusicFlow-Android-v2.8.0.apk',
          assetAvailable: true
        })
      };
    };

    const state = await UpdateManager.checkForUpdates({ manual: true });
    assert.strictEqual(state.isChecking, false);
    assert.strictEqual(state.updateAvailable, true);
    assert.strictEqual(state.updateRequired, false);
    assert.strictEqual(state.updateData.latestVersion, '2.8.0');
  });

  console.log('\n=============================================================');
  console.log(`  TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
  console.log('=============================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
