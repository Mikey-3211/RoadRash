// Installation is optional. The browser owns the install UI and final consent.
export function isStandalone(view = globalThis) {
  return view.navigator?.standalone === true ||
    ['standalone', 'fullscreen', 'minimal-ui'].some(mode => view.matchMedia?.(`(display-mode: ${mode})`).matches);
}

export function connectHomeScreen({ guide, instructions, installButton, view = globalThis }) {
  let prompt, installing = false, installed = false;
  const ios = /iPad|iPhone|iPod/.test(view.navigator?.userAgent ?? '') ||
    (view.navigator?.platform === 'MacIntel' && view.navigator?.maxTouchPoints > 1);
  instructions.textContent = ios
    ? 'Open the browser’s Share menu, choose Add to Home Screen, then Add. If that option is missing, open this page in Safari and use Share there. Keep Open as Web App enabled if shown. Launch from the new icon, then rotate your phone.'
    : 'Open your browser’s menu and choose Install app or Add to Home Screen. Launch from the new icon to play without the address bar.';
  function sync() {
    guide.hidden = installed || isStandalone(view) || view.isSecureContext === false;
    if (guide.hidden) guide.open = false;
    installButton.hidden = guide.hidden || !prompt;
    installButton.disabled = installing;
  }
  view.addEventListener('beforeinstallprompt', event => {
    if (isStandalone(view)) return;
    event.preventDefault(); prompt = event; sync();
  });
  installButton.addEventListener('click', async () => {
    if (!prompt || installing || isStandalone(view)) return;
    const pending = prompt; prompt = undefined; installing = true; sync();
    try {
      // Must happen before awaiting so browser user activation is retained.
      await pending.prompt();
      const choice = await pending.userChoice;
      if (choice?.outcome === 'accepted') installed = true;
    } catch { /* Keep manual installation instructions available. */ }
    finally { installing = false; sync(); }
  });
  view.addEventListener('appinstalled', () => { installed = true; prompt = undefined; sync(); });
  view.addEventListener('pageshow', sync);
  for (const mode of ['standalone', 'fullscreen', 'minimal-ui'])
    view.matchMedia?.(`(display-mode: ${mode})`).addEventListener?.('change', sync);
  sync();
  return { sync };
}
