// Invitations contain only a public room code, never membership or TURN credentials.
export function normalizeRoomCode(value) {
  return String(value).replace(/[\s-]/g, '').toUpperCase();
}

export function roomInviteCode(location) {
  try {
    const url = new URL(location.href);
    const values = new URLSearchParams(url.hash.slice(1)).getAll('room');
    return values.length === 1 && /^[A-Z0-9]{6}$/.test(values[0]) ? values[0] : '';
  } catch { return ''; }
}

export function roomInviteUrl(code, location) {
  if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error('Invalid room code');
  const url = new URL(location.href);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported invitation origin');
  const port = url.searchParams.get('roomPort');
  url.username = ''; url.password = ''; url.search = ''; url.hash = `room=${code}`;
  // Preserve only the isolated loopback preview's signaling port, never arbitrary query data.
  if (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
      /^\d{4,5}$/.test(port || '') && Number(port) >= 1024 && Number(port) <= 65535) url.searchParams.set('roomPort', port);
  return url.href;
}

export function roomCodeFromPaste(value, location) {
  const text = String(value).trim();
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text), current = new URL(location.href);
      return url.origin === current.origin && url.pathname === current.pathname ? roomInviteCode(url) : '';
    } catch { return ''; }
  }
  return normalizeRoomCode(text);
}
