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
    if (typeof window === 'undefined') return false;
    const protocol = window.location.protocol;
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
   * Detects if running in a local developer workstation browser
   */
  function isLocalDevelopment() {
    if (typeof window === 'undefined') return true;
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    if (protocol === 'file:') return false; // Android file protocol is not local workstation server
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local')
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
    // Android App / WebView -> strictly production host (never localhost)
    if (isRunningInAndroid()) {
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
   * Constructs full URL from relative path
   */
  function buildUrl(endpoint) {
    if (!endpoint || typeof endpoint !== 'string') return getApiBaseUrl();
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      return endpoint;
    }
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${getApiBaseUrl()}${cleanEndpoint}`;
  }

  return {
    PRODUCTION_API_BASE,
    PRODUCTION_JIOSAAVN_API_BASE,
    DEV_API_BASE,
    isRunningInAndroid,
    isLocalDevelopment,
    getApiBaseUrl,
    getJioSaavnApiBase,
    getYouTubeMusicApiBase,
    buildUrl
  };
})();

if (typeof window !== 'undefined') {
  window.ApiConfig = ApiConfig;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ApiConfig;
}
