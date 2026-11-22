// Hosted deployments reverse-proxy rooms beside this module, including releases
// under /multiplayer/. Local room servers always use /rooms on their own port.
// A loopback-only override keeps relay diagnostics separate from an active game.
export function roomSignalingUrl(location = globalThis.location, moduleUrl = import.meta.url) {
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const local = location.protocol === 'http:' && (loopback || ['8000', '8001'].includes(location.port));
  const override = loopback && location.protocol === 'http:' ? new URLSearchParams(location.search || '').get('roomPort') : null;
  if (override !== null && (!/^\d{4,5}$/.test(override) || Number(override) < 1024 || Number(override) > 65535))
    throw Error('Invalid local room server port');
  const path = local ? '/rooms' : new URL('./rooms', moduleUrl).pathname;
  return `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${local ? `${location.hostname}:${override || 8002}` : location.host}${path}`;
}
