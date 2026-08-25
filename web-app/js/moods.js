// ========================================
// MusicFlow — Mood & Activity Filters Engine
// ========================================

const Moods = (() => {
  const MOOD_CONFIG = {
    all: {
      id: 'all',
      label: 'All',
      icon: '',
      isDefault: true
    },
    energize: {
      id: 'energize',
      label: 'Energize',
      icon: '',
      gradient: 'linear-gradient(135deg, #FF416C, #FF4B2B)',
      queries: [
        { title: 'High Energy Hits', query: 'energy workout workout music hits', type: 'song' },
        { title: 'Fast Beats & EDM', query: 'edm high tempo electronic dance', type: 'song' }
      ]
    },
    relax: {
      id: 'relax',
      label: 'Relax',
      icon: '',
      gradient: 'linear-gradient(135deg, #1fa2ff, #12d8fa)',
      queries: [
        { title: 'Peaceful Acoustic & Lo-Fi', query: 'lo-fi chillhop acoustic vibes', type: 'song' },
        { title: 'Calm Piano & Ambient', query: 'peaceful piano ambient relaxation', type: 'song' }
      ]
    },
    workout: {
      id: 'workout',
      label: 'Workout',
      icon: '',
      gradient: 'linear-gradient(135deg, #f857a6, #ff5858)',
      queries: [
        { title: 'Gym & Cardio Fuel', query: 'cardio gym workout motivation hits', type: 'song' },
        { title: 'Beast Mode Phonk', query: 'drift phonk workout bass boost', type: 'song' }
      ]
    },
    focus: {
      id: 'focus',
      label: 'Focus',
      icon: '',
      gradient: 'linear-gradient(135deg, #11998e, #38ef7d)',
      queries: [
        { title: 'Deep Work & Study', query: 'deep focus instrumental study beats', type: 'song' },
        { title: 'Ambient Synthesis', query: 'ambient soundscapes focus flow', type: 'song' }
      ]
    },
    party: {
      id: 'party',
      label: 'Party',
      icon: '',
      gradient: 'linear-gradient(135deg, #FC466B, #3F5EFB)',
      queries: [
        { title: 'Club & Dance Anthems', query: 'dance party hits club remix', type: 'song' },
        { title: 'Blockbuster Dance Tracks', query: 'top bollywood dance party hits', type: 'song' }
      ]
    },
    romance: {
      id: 'romance',
      label: 'Romance',
      icon: '',
      gradient: 'linear-gradient(135deg, #ee0979, #ff6a00)',
      queries: [
        { title: 'Heartfelt Love Songs', query: 'romantic love songs acoustic hindi english', type: 'song' },
        { title: 'Late Night Romance', query: 'slow romantic acoustic melodies', type: 'song' }
      ]
    },
    sleep: {
      id: 'sleep',
      label: 'Sleep',
      icon: '',
      gradient: 'linear-gradient(135deg, #2c3e50, #3498db)',
      queries: [
        { title: 'Gentle Sleep Waves', query: 'deep sleep delta waves peaceful rain', type: 'song' },
        { title: 'Soft Nighttime Melodies', query: 'soothing bedtime acoustic lullabies', type: 'song' }
      ]
    }
  };

  let activeMoodId = 'all';

  let activeMoodId = 'all';

  function getMoodList() {
    return Object.values(MOOD_CONFIG);
  }

  function getActiveMood() {
    return activeMoodId;
  }

  async function setMood(moodId) {
    if (activeMoodId === moodId && moodId !== 'all') {
      // Toggle off if already active
      return setMood('all');
    }

    activeMoodId = moodId || 'all';
    
    // Update chip active states in UI
    UI.updateMoodChipsActive(activeMoodId);

    const homeContent = document.getElementById('home-feed-sections');
    const heroSection = document.getElementById('hero-section');
    const quickPicksSection = document.getElementById('quick-picks-section');
    const mixSuiteSection = document.getElementById('mix-suite-section');
    const defaultShelves = document.getElementById('default-home-shelves');

    if (!homeContent) return;

    if (activeMoodId === 'all') {
      // Restore standard home feed
      if (heroSection) heroSection.style.display = '';
      if (quickPicksSection) quickPicksSection.style.display = '';
      if (mixSuiteSection) mixSuiteSection.style.display = '';
      if (defaultShelves) defaultShelves.style.display = '';
      
      const moodCustomContainer = document.getElementById('mood-custom-feed');
      if (moodCustomContainer) moodCustomContainer.innerHTML = '';
      return;
    }

    // Hide standard shelves during active mood
    if (heroSection) heroSection.style.display = 'none';
    if (defaultShelves) defaultShelves.style.display = 'none';
    if (mixSuiteSection) mixSuiteSection.style.display = 'none';

    // Show mood feed loader
    let moodCustomContainer = document.getElementById('mood-custom-feed');
    if (!moodCustomContainer) {
      moodCustomContainer = document.createElement('div');
      moodCustomContainer.id = 'mood-custom-feed';
      homeContent.insertBefore(moodCustomContainer, defaultShelves);
    }

    const config = MOOD_CONFIG[activeMoodId];
    if (!config) return;

    moodCustomContainer.innerHTML = `
      <div class="mood-feed-header" style="background: ${config.gradient || 'var(--bg-surface)'}">
        <div class="mood-feed-badge">${config.icon} ${config.label} Mood</div>
        <h2 class="mood-feed-title">${config.label} Experience</h2>
        <p class="mood-feed-subtitle">Curated tracks & dynamic mixes tailored for your ${config.label.toLowerCase()} moments.</p>
        <button class="btn-clear-mood" id="btn-clear-mood" aria-label="Clear filter">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Clear Mood Filter
        </button>
      </div>
      <div class="mood-shelves-container">
        ${config.queries.map((q, idx) => `
          <section class="shelf-section">
            <h2 class="shelf-title">${q.title}</h2>
            <div class="shelf-container" id="mood-shelf-${idx}">
              <div class="loading-shelf shimmer-card"></div>
              <div class="loading-shelf shimmer-card"></div>
              <div class="loading-shelf shimmer-card"></div>
              <div class="loading-shelf shimmer-card"></div>
            </div>
          </section>
        `).join('')}
      </div>
    `;

    document.getElementById('btn-clear-mood')?.addEventListener('click', () => setMood('all'));

    // Automatically scroll to show the filtered results immediately so the user doesn't have to guess or manually scroll
    setTimeout(() => {
      const target = document.getElementById('mood-custom-feed') || homeContent;
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 120);
    if (typeof Haptics !== 'undefined' && Haptics.selection) Haptics.selection();

    // Fetch queries in parallel
    const promises = config.queries.map(q => API.searchSongs(q.query, 25));
    const results = await Promise.allSettled(promises);

    results.forEach((res, idx) => {
      const shelfEl = document.getElementById(`mood-shelf-${idx}`);
      if (!shelfEl) return;

      if (res.status === 'fulfilled' && Array.isArray(res.value) && res.value.length > 0) {
        const normSongs = res.value.map(API.normalizeSong);
        UI.renderShelf(normSongs, shelfEl, 'song');
        if (window.App && window.App.bindSongCardEvents) {
          window.App.bindSongCardEvents(shelfEl, normSongs);
        }
      } else {
        if (shelfEl.parentElement) shelfEl.parentElement.style.display = 'none';
      }
    });
  }

  return {
    MOOD_CONFIG,
    getMoodList,
    getActiveMood,
    setMood,
    applyMoodFilter: setMood
  };
})();

window.Moods = Moods;
window.applyMoodFilter = (moodId) => Moods.setMood(moodId);
