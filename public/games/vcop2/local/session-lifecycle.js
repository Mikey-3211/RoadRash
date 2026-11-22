// A cached navigation can restore the same worker; keep it paused until a gesture.
export function connectSessionLifecycle({ session, onReturn, view = globalThis, page = document }) {
  page.addEventListener('visibilitychange', () => { if (page.hidden) session.setPaused(true); });
  view.addEventListener('pagehide', event => {
    if (event.persisted) session.setPaused(true);
    else session.stop();
  });
  view.addEventListener('pageshow', event => { if (event.persisted) onReturn(); });
}
