const fs = require('fs');
const path = require('path');

// Mock browser global environment
global.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { reload: () => {} }
};
global.addEventListener = () => {};
global.document = {
  readyState: 'complete',
  addEventListener: () => {},
  getElementById: () => null,
  querySelectorAll: () => [],
  querySelector: () => null,
  body: { classList: { toggle: () => {} } }
};
global.Audio = class Audio {
  constructor() {
    this.src = '';
    this.currentTime = 0;
    this.duration = 0;
    this.paused = true;
  }
  addEventListener() {}
  removeEventListener() {}
  play() { return Promise.resolve(); }
  pause() {}
  load() {}
  setSinkId() { return Promise.resolve(); }
};

global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};
global.Player = {
  init: () => {},
  on: () => {},
  getCurrentTrack: () => null,
  isPlaying: () => false,
  setQueue: () => {},
  pause: () => {}
};
global.UI = {
  renderHomeGreeting: () => {},
  renderRecentSearchChips: () => {},
  renderLibraryTab: () => {},
  renderSearchCategoryPills: () => {}
};
global.API = {
  getArtistDetails: async () => ({}),
  getArtistSongs: async () => []
};

// Evaluate all web app JS scripts in load order
const scripts = [
  'id3Parser.js',
  'indexedDbStorage.js',
  'queryNormalizer.js',
  'stringSimilarity.js',
  'trackDeduplicator.js',
  'audioFeatureExtractor.js',
  'featureStore.js',
  'musicFlowEmbedder.js',
  'embeatAdapter.js',
  'offlineManager.js',
  'searchEngine.js',
  'recommendationEngine.js',
  'storage.js',
  'typesenseClient.js',
  'downloadManager.js',
  'smartDownloads.js',
  'api.js',
  'homeDataLayer.js',
  'exploreDataLayer.js',
  'player.js',
  'lyrics.js',
  'ui.js',
  'app.js'
];

for (const scr of scripts) {
  console.log(`Checking syntax and evaluation of js/${scr}...`);
  try {
    const mod = require(`./js/${scr}`);
    const name = scr.replace('.js', '');
    const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
    global[capitalized] = mod;
  } catch (_) {
    const code = fs.readFileSync(path.join(__dirname, 'js', scr), 'utf8');
    eval(code);
  }
}

const appObj = global.window.App || global.App || require('./js/app.js');
global.App = appObj;

console.log('✅ App object created successfully:');
console.log('App methods count:', Object.keys(appObj).length);
console.log('App.navigate is function:', typeof appObj.navigate === 'function');
console.log('App.openCustomPlaylist is function:', typeof appObj.openCustomPlaylist === 'function');
console.log('App.openLibraryTab is function:', typeof appObj.openLibraryTab === 'function');
