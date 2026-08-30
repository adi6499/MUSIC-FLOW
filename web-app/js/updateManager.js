// ============================================================================
// MUSICFLOW — CLIENT-SIDE UPDATE MANAGER (Android APK + iOS IPA Sideloaded)
// Asynchronous, Non-Blocking, Sideload-Aware In-App Update Manager
// ============================================================================

const UpdateManager = (() => {
  // Single Source of Truth for Client Version (synchronized with Gradle/Xcode build)
  const APP_VERSION = '2.7.0';
  const BUILD_NUMBER = 27;

  // Throttling & Auto-Check Configuration
  const AUTO_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours between auto checks
  const FETCH_TIMEOUT_MS = 8000; // 8 second network timeout

  let updateState = {
    isChecking: false,
    lastChecked: 0,
    updateAvailable: false,
    updateRequired: false,
    updateData: null,
    error: null
  };

  const listeners = {
    updateAvailable: [],
    updateRequired: [],
    upToDate: [],
    error: [],
    stateChange: []
  };

  // ----------------------------------------------------------------------------
  // 1. SEMANTIC VERSION COMPARISON ENGINE
  // ----------------------------------------------------------------------------
  function parseSemVer(verStr) {
    if (!verStr || typeof verStr !== 'string') {
      return { major: 0, minor: 0, patch: 0, build: 0, raw: '0.0.0' };
    }

    let clean = verStr.trim().replace(/^[vV]/, '');
    let build = 0;
    const buildMatch = clean.match(/[\+\-build\.]+(\d+)$/i) || clean.match(/\((\d+)\)$/);
    if (buildMatch) {
      build = parseInt(buildMatch[1], 10) || 0;
      clean = clean.replace(/[\+\-build\.]+(\d+)$/i, '').replace(/\((\d+)\)$/, '').trim();
    }

    const coreParts = clean.split('-')[0].split('.');
    const major = parseInt(coreParts[0], 10) || 0;
    const minor = parseInt(coreParts[1], 10) || 0;
    const patch = parseInt(coreParts[2], 10) || 0;

    return { major, minor, patch, build, raw: verStr.trim() };
  }

  /**
   * Compares two semantic version strings.
   * Returns:
   *   1 if v1 > v2 (v1 is newer)
   *  -1 if v1 < v2 (v1 is older)
   *   0 if v1 === v2
   */
  function compareVersions(v1, v2) {
    const p1 = parseSemVer(v1);
    const p2 = parseSemVer(v2);

    if (p1.major !== p2.major) return p1.major > p2.major ? 1 : -1;
    if (p1.minor !== p2.minor) return p1.minor > p2.minor ? 1 : -1;
    if (p1.patch !== p2.patch) return p1.patch > p2.patch ? 1 : -1;
    if (p1.build !== p2.build) return p1.build > p2.build ? 1 : -1;
    return 0;
  }

  // ----------------------------------------------------------------------------
  // 2. PLATFORM DETECTION
  // ----------------------------------------------------------------------------
  function getPlatform() {
    if (typeof window !== 'undefined' && window.Capacitor && typeof window.Capacitor.getPlatform === 'function') {
      const capPlatform = window.Capacitor.getPlatform().toLowerCase();
      if (capPlatform === 'android') return 'android';
      if (capPlatform === 'ios') return 'ios';
    }

    if (typeof navigator !== 'undefined') {
      const ua = (navigator.userAgent || '').toLowerCase();
      if (ua.includes('android')) return 'android';
      if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod') || ua.includes('ios')) return 'ios';
    }

    return 'android'; // Default sideload platform
  }

  function notify(event, data) {
    (listeners[event] || []).forEach(cb => {
      try { cb(data); } catch (e) { console.warn('[UpdateManager] Listener error:', e); }
    });
    (listeners.stateChange || []).forEach(cb => {
      try { cb(updateState); } catch (_) {}
    });
  }

  // ----------------------------------------------------------------------------
  // 3. CORE UPDATE CHECKER
  // ----------------------------------------------------------------------------
  async function checkForUpdates(options = {}) {
    const { manual = false, silent = false } = options;

    if (updateState.isChecking) {
      return updateState;
    }

    const platform = getPlatform();
    const storedState = (typeof Storage !== 'undefined' && Storage.getUpdateState)
      ? Storage.getUpdateState()
      : { lastChecked: 0, dismissedVersion: null };

    // Auto-check throttling: skip network if checked recently (unless manual check)
    const now = Date.now();
    if (!manual && (now - (storedState.lastChecked || 0) < AUTO_CHECK_INTERVAL_MS)) {
      if (storedState.lastResult && storedState.lastResult.updateAvailable) {
        updateState.updateData = storedState.lastResult;
        updateState.updateAvailable = true;
        updateState.updateRequired = !!storedState.lastResult.updateRequired;
        return updateState;
      }
      return updateState;
    }

    updateState.isChecking = true;
    updateState.error = null;
    notify('stateChange', updateState);

    const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS) : null;

    try {
      const updatePath = `/api/update?platform=${encodeURIComponent(platform)}&version=${encodeURIComponent(APP_VERSION)}${manual ? '&force=true' : ''}`;
      const apiUrl = (typeof ApiConfig !== 'undefined' && typeof ApiConfig.buildUrl === 'function')
        ? ApiConfig.buildUrl(updatePath)
        : updatePath;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller ? controller.signal : undefined
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Update check failed with HTTP ${response.status}`);
      }

      const contentType = (response.headers && typeof response.headers.get === 'function')
        ? (response.headers.get('content-type') || '')
        : (response.headers?.['content-type'] || 'application/json');

      if (contentType && !contentType.includes('application/json') && (contentType.includes('text/html') || contentType.includes('text/plain'))) {
        throw new Error(`Invalid response format (received non-JSON "${contentType}")`);
      }

      const data = await response.json();
      const latestVer = data.latestVersion || APP_VERSION;
      const minVer = data.minimumVersion || '1.0.0';

      const isUpdateAvailable = compareVersions(latestVer, APP_VERSION) > 0;
      const isUpdateRequired = compareVersions(minVer, APP_VERSION) > 0;

      updateState.lastChecked = now;
      updateState.updateAvailable = isUpdateAvailable;
      updateState.updateRequired = isUpdateRequired;
      updateState.updateData = data;
      updateState.isChecking = false;

      // Persist check state
      if (typeof Storage !== 'undefined' && Storage.setLastUpdateCheck) {
        Storage.setLastUpdateCheck(now, data);
      }

      // Determine whether to notify UI
      if (isUpdateRequired) {
        notify('updateRequired', data);
        if (typeof UI !== 'undefined' && UI.showUpdateDialog) {
          UI.showUpdateDialog(data, true); // true = mandatory force update
        }
      } else if (isUpdateAvailable) {
        notify('updateAvailable', data);
        const dismissed = (typeof Storage !== 'undefined' && Storage.getDismissedVersion)
          ? Storage.getDismissedVersion()
          : null;

        // If manual check OR not previously dismissed for this specific version, display dialog
        if (manual || dismissed !== latestVer) {
          if (typeof UI !== 'undefined' && UI.showUpdateDialog) {
            UI.showUpdateDialog(data, false);
          }
        } else if (!silent) {
          // Show subtle in-app banner for previously dismissed versions
          if (typeof UI !== 'undefined' && UI.showUpdateBanner) {
            UI.showUpdateBanner(data);
          }
        }
      } else {
        notify('upToDate', { currentVersion: APP_VERSION, latestVersion: latestVer });
        if (manual && typeof UI !== 'undefined' && UI.showToast) {
          UI.showToast(`MusicFlow v${APP_VERSION} is up to date! ✨`);
        }
      }

      notify('stateChange', updateState);
      return updateState;
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      console.warn('[UpdateManager] Update check failed silently:', err.message);

      updateState.isChecking = false;
      updateState.error = err.message;
      notify('error', err);
      notify('stateChange', updateState);

      if (manual && typeof UI !== 'undefined' && UI.showToast) {
        UI.showToast('Could not check for updates. Check connection.');
      }

      return updateState;
    }
  }

  // ----------------------------------------------------------------------------
  // 4. ACTION HANDLERS
  // ----------------------------------------------------------------------------
  function openUpdate(downloadUrl) {
    const url = downloadUrl || (updateState.updateData && updateState.updateData.downloadUrl) || (updateState.updateData && updateState.updateData.releaseUrl);
    if (!url) {
      if (typeof UI !== 'undefined' && UI.showToast) {
        UI.showToast('Update download is temporarily unavailable.');
      }
      return;
    }

    try {
      if (typeof window !== 'undefined') {
        window.open(url, '_blank');
      }
    } catch (e) {
      console.error('[UpdateManager] Could not open download URL:', e);
    }
  }

  function openReleasePage(releaseUrl) {
    const url = releaseUrl || (updateState.updateData && updateState.updateData.releaseUrl) || 'https://github.com/adi6499/MUSIC-FLOW/releases';
    try {
      if (typeof window !== 'undefined') {
        window.open(url, '_blank');
      }
    } catch (e) {
      console.error('[UpdateManager] Could not open release URL:', e);
    }
  }

  function dismissUpdate(version) {
    const ver = version || (updateState.updateData && updateState.updateData.latestVersion);
    if (ver && typeof Storage !== 'undefined' && Storage.setDismissedVersion) {
      Storage.setDismissedVersion(ver);
    }
    if (typeof UI !== 'undefined' && UI.hideUpdateDialog) {
      UI.hideUpdateDialog();
    }
  }

  // ----------------------------------------------------------------------------
  // 5. LIFECYCLE INITIALIZER
  // ----------------------------------------------------------------------------
  function init() {
    // Non-blocking asynchronous startup check after UI render (delay 2500ms)
    setTimeout(() => {
      checkForUpdates({ manual: false, silent: true }).catch(() => {});
    }, 2500);

    // Check on app resume / foreground return (throttled)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          checkForUpdates({ manual: false, silent: true }).catch(() => {});
        }
      });
    }
  }

  // Event subscription API
  function on(event, callback) {
    if (listeners[event] && typeof callback === 'function') {
      listeners[event].push(callback);
    }
  }

  function off(event, callback) {
    if (listeners[event]) {
      listeners[event] = listeners[event].filter(cb => cb !== callback);
    }
  }

  return {
    VERSION: APP_VERSION,
    BUILD_NUMBER: BUILD_NUMBER,
    init,
    checkForUpdates,
    openUpdate,
    openReleasePage,
    dismissUpdate,
    compareVersions,
    parseSemVer,
    getPlatform,
    getState: () => ({ ...updateState }),
    on,
    off
  };
})();

if (typeof window !== 'undefined') {
  window.UpdateManager = UpdateManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UpdateManager;
}
