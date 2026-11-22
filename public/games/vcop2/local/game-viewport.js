// Display sizing never changes the original framebuffer's 640 x 480 pixels.
export function fitGameViewport(width, height, padding = 24) {
  if (![width, height, padding].every(Number.isFinite) || width <= 0 || height <= 0 || padding < 0)
    throw Error('Invalid game viewport dimensions');
  const scale = Math.min(2, Math.max(4, width - padding * 2) / 640,
    Math.max(3, height - padding * 2) / 480);
  const displayWidth = Math.max(4, Math.floor(640 * scale / 4) * 4);
  return { width: displayWidth, height: displayWidth * 3 / 4 };
}

export function connectGameViewport({ screen, surface, canvas, resumeButton, input, isPlaying,
  setPaused = () => {}, isTouch = () => false, onTouch = () => {}, isBlocked = () => false, page = document, view = globalThis }) {
  let needsActivation = true, wasLocked = false, wasPlaying = false;
  const locked = () => page.pointerLockElement === canvas;
  function sync() {
    const playing = isPlaying(), captured = locked();
    screen.setAttribute?.('data-mouse-captured', String(captured));
    if ((wasLocked && !captured) || (!wasPlaying && playing && !captured)) needsActivation = true;
    if (captured) needsActivation = false;
    wasLocked = captured; wasPlaying = playing;
    resumeButton.textContent = isTouch() ? 'Tap to get back into the game' : 'Click to get back into the game';
    resumeButton.hidden = !playing || captured || !needsActivation;
    setPaused(playing && (isBlocked() || needsActivation || page.hidden === true || page.hasFocus?.() === false || page.activeElement !== canvas));
    if (page.fullscreenElement === screen) {
      const size = fitGameViewport(view.innerWidth - (isTouch() ? 88 : 0), view.innerHeight, isTouch() ? 8 : 24);
      surface.style.setProperty('--fullscreen-game-width', `${size.width}px`);
      surface.style.setProperty('--fullscreen-game-height', `${size.height}px`);
    } else {
      surface.style.removeProperty('--fullscreen-game-width');
      surface.style.removeProperty('--fullscreen-game-height');
    }
  }
  function requestControl() {
    if (!isPlaying() || isBlocked()) return;
    needsActivation = false;
    void Promise.resolve(isTouch() ? input.focusGame() : input.captureMouse()).catch(() => { needsActivation = true; sync(); });
    sync();
  }
  function pointerDown(event) {
    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      onTouch();
      if (!isPlaying() || event.target !== canvas) return;
      if (needsActivation || page.activeElement !== canvas) {
        event.preventDefault(); event.stopPropagation();
      }
      requestControl(); return;
    }
    if (!isPlaying() || locked() || event.button !== 0 || event.pointerType !== 'mouse') return;
    if (needsActivation || event.target !== canvas || page.activeElement !== canvas) {
      // The first re-entry click focuses/captures; it is not a stray game shot.
      event.preventDefault(); event.stopPropagation();
      input.suppressActivationClick();
    }
    requestControl();
  }
  function blur() { needsActivation = true; sync(); }
  function visibility() { if (page.hidden) needsActivation = true; sync(); }
  screen.addEventListener('pointerdown', pointerDown, true);
  resumeButton.addEventListener('click', requestControl);
  canvas.addEventListener('blur', blur);
  canvas.addEventListener('focus', sync);
  view.addEventListener('blur', blur);
  view.addEventListener('focus', sync);
  view.addEventListener('resize', sync);
  page.addEventListener('visibilitychange', visibility);
  page.addEventListener('pointerlockchange', sync);
  page.addEventListener('fullscreenchange', sync);
  sync();
  return { sync, resume: requestControl, pause: blur };
}

// Measure the real chrome height, including wrapped copyright text and controls.
// Only the cabinet shrinks; the complete footer remains visible at any width.
export function connectPlayerLayout({ space, cabinet, screen, toolbar, view = globalThis, page = document }) {
  function fit() {
    if (page.fullscreenElement === screen || screen.classList?.contains('mobile-immersive')) return;
    const chromeHeight = cabinet.offsetHeight - screen.offsetHeight;
    const chromeWidth = cabinet.offsetWidth - screen.offsetWidth;
    const width = Math.floor(Math.min(space.clientWidth,
      Math.max(0, space.clientHeight - chromeHeight) * 4 / 3 + chromeWidth));
    const value = `${width}px`;
    if (cabinet.style.getPropertyValue('--cabinet-width') !== value)
      cabinet.style.setProperty('--cabinet-width', value);
  }
  const observer = view.ResizeObserver ? new view.ResizeObserver(fit) : undefined;
  observer?.observe(space); observer?.observe(toolbar);
  view.addEventListener('resize', fit);
  page.addEventListener('fullscreenchange', fit);
  fit();
  return { fit };
}
