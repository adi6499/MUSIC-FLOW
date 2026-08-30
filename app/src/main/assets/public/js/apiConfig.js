// ==========================================================================
// MUSICFLOW — CENTRALIZED API CONFIGURATION & ENVIRONMENT DETECTOR
// Determines base URLs, endpoints, and fallbacks for:
// - Android APK / WebView (file:///android_asset/...) -> Deployed Production HTTPS
// - Desktop Development (localhost:3000 / 127.0.0.1)  -> Local Node Server
// - Production Web App (https://...)                 -> HTTPS Origin / Host
// ==========================================================================

const ApiConfig = (() => {
  // Production JioSaavn Live Provider API Host
  const PRODUCTION_JIOSAAVN_API_BASE = 'https://spoton-trpn.vercel.app/api';
  const PRODUCTION_API_BASE = 'https://spoton-trpn.vercel.app';
  // Local Development API Base URL
  const DEV_API_BASE = 'http://localhost:3000';

  /**
   * Detects if the app is currently running inside an Android APK / WebView environment
   */
  function isRunningInAndroid() {
    if (typeof window === 'undefined' || !window.location) return false;
    const protocol = window.location.protocol || '';
    const href = window.location.href || '';
    const userAgent = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    return (
      protocol === 'file:' ||
      href.startsWith('file:///android_asset/') ||
      href.includes('androidplatform.net') ||
      /MusicFlowApp|Android.*wv|Version\/.*Chrome/i.test(userAgent)
    );
  }

  /**
   * Detects if the app is currently running inside an iOS App / Capacitor environment
   */
  function isRunningInIOS() {
    if (typeof window === 'undefined' || !window.location) return false;
    const protocol = window.location.protocol || '';
    const href = window.location.href || '';
    const userAgent = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    const isCapacitor = typeof window.Capacitor !== 'undefined' || protocol === 'capacitor:';
    const isIOSDevice = /iPhone|iPad|iPod/i.test(userAgent) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return (
      (isCapacitor && isIOSDevice) ||
      protocol === 'capacitor:' ||
      protocol === 'ionic:' ||
      (isIOSDevice && typeof window.webkit !== 'undefined' && href.includes('localhost'))
    );
  }

  /**
   * Detects if running inside any native mobile container (Android APK or iOS App)
   */
  function isNativeApp() {
    return isRunningInAndroid() || isRunningInIOS();
  }

  /**
   * Detects if running in a local developer workstation browser
   */
  function isLocalDevelopment() {
    if (isNativeApp()) return false;
    if (typeof window === 'undefined' || !window.location) return false;
    const hostname = window.location.hostname || '';
    const href = window.location.href || '';
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      href.startsWith('http://localhost') ||
      href.startsWith('http://127.0.0.1')
    );
  }

  /**
   * Resolves the authoritative API Base URL for the current environment
   */
  function getApiBaseUrl() {
    if (typeof window === 'undefined') {
      return DEV_API_BASE;
    }
    // Explicit environment override
    if (window.MUSICFLOW_API_BASE && typeof window.MUSICFLOW_API_BASE === 'string') {
      return window.MUSICFLOW_API_BASE.replace(/\/+$/, '');
    }
    // Native Mobile App (Android APK or iOS App) -> strictly production host (never localhost)
    if (isNativeApp()) {
      return PRODUCTION_API_BASE;
    }
    // Local development browser -> local node server on port 3000
    if (isLocalDevelopment()) {
      return window.location.origin || DEV_API_BASE;
    }
    // Production Web deployed to cloud/HTTPS -> same origin or production host
    return (window.location.origin && window.location.origin.startsWith('https://'))
      ? window.location.origin
      : PRODUCTION_API_BASE;
  }

  // Production Update Metadata Endpoint (Instant High-Availability GitHub Raw CDN & Pages Fallback)
  const PRODUCTION_UPDATE_API_URL = 'https://raw.githubusercontent.com/adi6499/MUSICFLOW/main/api/update.json';
  const PRODUCTION_UPDATE_API_FALLBACK = 'https://adi6499.github.io/MUSICFLOW/api/update.json';

  /**
   * Returns JioSaavn API endpoint base URL (always the live Saavn service host)
   */
  function getJioSaavnApiBase() {
    return PRODUCTION_JIOSAAVN_API_BASE;
  }

  /**
   * Returns YouTube Music Provider endpoint base URL
   */
  function getYouTubeMusicApiBase() {
    return `${getApiBaseUrl()}/api/providers/ytmusic`;
  }

  /**
   * Returns production Update API endpoint URL
   */
  function getUpdateApiBase() {
    if (isLocalDevelopment()) {
      return `${DEV_API_BASE}/api/update`;
    }
    return PRODUCTION_UPDATE_API_URL;
  }

  /**
   * Returns fallback update URL in case of primary CDN failure
   */
  function getUpdateApiFallback() {
    return PRODUCTION_UPDATE_API_FALLBACK;
  }

  /**
   * Constructs full URL from relative path
   */
  function buildUrl(endpoint) {
    if (!endpoint || typeof endpoint !== 'string') return getApiBaseUrl();
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      return endpoint;
    }
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    if (cleanEndpoint.startsWith('/api/update')) {
      if (isLocalDevelopment()) {
        return `${DEV_API_BASE}${cleanEndpoint}`;
      }
      const hasForce = cleanEndpoint.includes('force=true');
      const timestamp = hasForce ? `?t=${Date.now()}` : '';
      return `${PRODUCTION_UPDATE_API_URL}${timestamp}`;
    }
    return `${getApiBaseUrl()}${cleanEndpoint}`;
  }

  return {
    PRODUCTION_API_BASE,
    PRODUCTION_JIOSAAVN_API_BASE,
    PRODUCTION_UPDATE_API_URL,
    PRODUCTION_UPDATE_API_FALLBACK,
    DEV_API_BASE,
    isRunningInAndroid,
    isRunningInIOS,
    isNativeApp,
    isLocalDevelopment,
    getApiBaseUrl,
    getJioSaavnApiBase,
    getYouTubeMusicApiBase,
    getUpdateApiBase,
    getUpdateApiFallback,
    buildUrl
  };
})();

if (typeof window !== 'undefined') {
  window.ApiConfig = ApiConfig;
  try {
    console.log('[MusicFlow] YTMUSIC API BASE:', ApiConfig.getYouTubeMusicApiBase());
  } catch (_) {}
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ApiConfig;
}
