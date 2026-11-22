// Phone onboarding and the CSS immersive fallback share one orientation gate.
// Fullscreen/orientation APIs are optional; never pretend that CSS hides browser UI.
import { isStandalone } from './home-screen.js';
export function connectMobilePlayback({ screen, dialog, title, description, button,
  isTouch, onEnter, lobby = false, onChange = () => {}, page = document, view = globalThis }) {
  let active = false, fullscreenSeen = false;
  const phone = () => isTouch() && Math.min(view.innerWidth, view.innerHeight) <= 600;
  const portrait = () => view.innerHeight >= view.innerWidth;
  const blocked = () => phone() && (!active || portrait());
  function sync() {
    const mobile = phone();
    screen.classList.toggle('mobile-immersive', mobile && active);
    page.documentElement.classList.toggle('mobile-playing', mobile && active);
    if (blocked()) {
      title.textContent = portrait() ? 'Rotate your phone' : 'Ready to play';
      description.textContent = portrait()
        ? 'Turn your phone sideways to play. Keep rotation lock off.'
        : 'Play in landscape. Tap to shoot; Reload stays beside the game.';
      button.disabled = portrait();
      button.textContent = portrait() ? 'ROTATE TO CONTINUE' : lobby ? 'ENTER ARCADE' : isStandalone(view) ? 'PLAY GAME' :
        typeof screen.requestFullscreen === 'function' ? 'PLAY FULLSCREEN' : 'PLAY IN LANDSCAPE';
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) dialog.close();
    onChange();
  }
  function enter() {
    if (!phone() || portrait()) { sync(); return; }
    active = true;
    sync();
    // Audio activation must remain in this user gesture, before any await.
    onEnter();
    try {
      if (!isStandalone(view) && typeof screen.requestFullscreen === 'function' && page.fullscreenElement !== screen) {
        Promise.resolve(screen.requestFullscreen()).then(async () => {
          if (active && page.fullscreenElement === screen) {
            try { await view.screen?.orientation?.lock?.('landscape'); } catch { /* Manual rotation remains available. */ }
          }
          sync();
        }).catch(() => sync()); // Stay immersive within the browser viewport.
      }
    } catch { sync(); }
  }
  function exit() {
    active = false;
    try { view.screen?.orientation?.unlock?.(); } catch { /* Optional API. */ }
    if (page.fullscreenElement === screen) {
      try { void Promise.resolve(page.exitFullscreen()).catch(() => {}); } catch { /* Already exiting. */ }
    }
    sync();
  }
  button.addEventListener('click', enter);
  dialog.addEventListener('cancel', event => event.preventDefault());
  view.addEventListener('resize', sync);
  view.visualViewport?.addEventListener('resize', sync);
  page.addEventListener('fullscreenchange', () => {
    const full = page.fullscreenElement === screen;
    if (fullscreenSeen && !full) { active = false; try { view.screen?.orientation?.unlock?.(); } catch {} }
    fullscreenSeen = full;
    sync();
  });
  sync();
  return { sync, enter, exit, blocked, get phone() { return phone(); }, get active() { return active; } };
}
