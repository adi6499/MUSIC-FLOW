// ============================================================================
// MUSICFLOW — APPLE-STYLE MOTION & INTERACTION SYSTEM TEST SUITE
// Verifies motion tokens, 3D tilt & swipe physics, pressed-states, heart-pop,
// seek thumb expansion, track transitions, and reduced-motion accessibility.
// ============================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- TEST 1: Centralized Motion Tokens in app.css ---');
{
  const css = fs.readFileSync(path.join(__dirname, 'css', 'app.css'), 'utf8');

  assert.ok(css.includes('--motion-fast: 150ms'), 'Must define --motion-fast');
  assert.ok(css.includes('--motion-std: 250ms'), 'Must define --motion-std');
  assert.ok(css.includes('--motion-emphasis: 380ms'), 'Must define --motion-emphasis');
  assert.ok(css.includes('--spring-bounce:'), 'Must define --spring-bounce');
  assert.ok(css.includes('--press-scale: scale(0.97)'), 'Must define --press-scale');

  console.log('✓ TEST 1 PASSED');
}

console.log('--- TEST 2: Pressed-State Feedback & Interactive Springs ---');
{
  const css = fs.readFileSync(path.join(__dirname, 'css', 'app.css'), 'utf8');

  assert.ok(css.includes('.clickable-card:active') || css.includes('.quick-pick-item:active'), 'Interactive cards must have active state');
  assert.ok(css.includes('transform: var(--press-scale)'), 'Must apply --press-scale on active');
  assert.ok(css.includes('.heart-pop'), 'Must define .heart-pop class');
  assert.ok(css.includes('@keyframes heartPop'), 'Must define @keyframes heartPop');
  assert.ok(css.includes('.track-text-transition'), 'Must define .track-text-transition for smooth song changes');

  console.log('✓ TEST 2 PASSED');
}

console.log('--- TEST 3: Scrubber Thumb Expansion & 3D Deck Transforms ---');
{
  const css = fs.readFileSync(path.join(__dirname, 'css', 'app.css'), 'utf8');

  assert.ok(css.includes('.player-custom-seek-bar.seeking .seek-thumb') || css.includes('#player-seek-thumb.active'), 'Scrubber thumb must scale during seeking');
  assert.ok(css.includes('transform: scale(1.25)'), 'Thumb must scale to 1.25x on active seek');
  assert.ok(css.includes('.player-3d-deck-container'), '3D deck container must be styled');
  assert.ok(css.includes('perspective: 1000px'), 'Perspective must be set to 1000px for subtle depth');

  console.log('✓ TEST 3 PASSED');
}

console.log('--- TEST 4: Prefers-Reduced-Motion Accessibility Support ---');
{
  const css = fs.readFileSync(path.join(__dirname, 'css', 'app.css'), 'utf8');

  assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'), 'Must include prefers-reduced-motion query');
  assert.ok(css.includes('animation-duration: 0.01ms !important'), 'Must disable long animations when reduced motion is preferred');

  console.log('✓ TEST 4 PASSED');
}

console.log('--- TEST 5: JavaScript 3D Tilt & Gesture Mapping in app.js ---');
{
  const appJs = fs.readFileSync(path.join(__dirname, 'js', 'app.js'), 'utf8');

  assert.ok(appJs.includes('initPlayer3DDeckGesture'), 'app.js must define initPlayer3DDeckGesture');
  assert.ok(appJs.includes('onPointerHover'), 'app.js must implement 3D pointer hover tilt');
  assert.ok(appJs.includes('rotateX') && appJs.includes('rotateY'), 'Must compute rotateX and rotateY tilt');
  
  // Verify Swipe Left = Next, Swipe Right = Previous
  assert.ok(appJs.includes('deltaX < -SWIPE_THRESHOLD') && appJs.includes('Player.next()'), 'Swipe left must trigger Player.next()');
  assert.ok(appJs.includes('deltaX > SWIPE_THRESHOLD') && appJs.includes('Player.previous()'), 'Swipe right must trigger Player.previous()');

  console.log('✓ TEST 5 PASSED');
}

console.log('\n======================================================');
console.log('ALL MOTION SYSTEM TESTS PASSED (5/5)');
console.log('======================================================');
