import { parseCdCue } from './cd-audio.js';
import { fingerprint } from './module-verification.js';

const MAX_FILE = 32 * 1024 * 1024, MAX_TOTAL = 64 * 1024 * 1024;
const ASSET_CACHE = 'vcop2-game-assets-v2';
const integer = n => Number.isSafeInteger(n) && n >= 0;
function assetUrl(value, base) {
  if (typeof value !== 'string' || !value || /[%\\?#]/.test(value) || value.split('/').some(p => !p || p === '.' || p === '..'))
    throw Error('Invalid game asset address');
  const url = new URL(value, base);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) throw Error('Invalid game asset address');
  return url.href;
}
async function readExact(url, size, fetcher, signal, headers) {
  const response = await fetcher(url, { signal, headers, cache: 'no-store' });
  return readResponse(response, size, signal, Boolean(headers), url);
}
async function readResponse(response, size, signal, partial = false, url = '') {
  signal?.throwIfAborted();
  const reject = async message => { 
    await response.body?.cancel().catch(() => {}); 
    console.error(`Asset fetch failed: ${url} (status: ${response.status}) -> ${message}`);
    throw Error(`${message} [${url.split('/').pop() || url}]`); 
  };
  if (!response.ok || (partial && response.status !== 206)) return reject('Could not load a game asset');
  const length = response.headers.get('Content-Length');
  if (length !== null && Number(length) !== size) return reject('Incomplete game asset');
  const chunks = []; let received = 0;
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        signal?.throwIfAborted();
        if (done) break;
        received += value.byteLength;
        if (received > size) throw Error('Game asset exceeds its expected size');
        chunks.push(value);
      }
    } catch (error) { await reader.cancel().catch(() => {}); throw error; }
    finally { reader.releaseLock(); }
  } else {
    const bytes = await response.arrayBuffer(); received = bytes.byteLength; chunks.push(bytes);
  }
  if (received !== size) throw Error('Incomplete game asset');
  signal?.throwIfAborted();
  return { blob: new Blob(chunks), response };
}

// CacheStorage is disabled locally to eliminate corrupt cache hits
async function openAssetCache(storage) {
  return undefined;
}
async function readGameFile(entry, cache, fetcher, signal) {
  const verify = async blob => {
    if (await fingerprint(await blob.arrayBuffer()) !== entry.sha256)
      throw Error('Game asset failed its integrity check');
    signal?.throwIfAborted();
    return blob;
  };
  signal?.throwIfAborted();
  if (cache) {
    try {
      const response = await cache.match(entry.cacheKey);
      if (response) return await verify((await readResponse(response, entry.size, signal)).blob);
    } catch {
      signal?.throwIfAborted();
      try { await cache.delete(entry.cacheKey); } catch { /* Storage is optional. */ }
    }
  }
  const { blob } = await readExact(entry.url, entry.size, fetcher, signal);
  await verify(blob);
  try {
    await cache?.put(entry.cacheKey, new Response(blob, {
      headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(entry.size) },
    }));
  } catch { /* Keep playing if browser storage is unavailable or full. */ }
  signal?.throwIfAborted();
  return blob;
}

// CD music reads only the requested track range, not the entire mixed-mode disc.
export function createHttpDisc(entry, base, fetcher = fetch, signal) {
  if (!entry || typeof entry.name !== 'string' || !integer(entry.size) || !entry.size || entry.size % 2352 || entry.size > 2 ** 32)
    throw Error('Invalid music disc');
  const url = assetUrl(entry.url, base);
  return { name: entry.name, size: entry.size,
    slice(start, end) {
      if (!integer(start) || !integer(end) || start >= end || end > entry.size || end - start > MAX_TOTAL)
        throw Error('Invalid music range');
      return { async arrayBuffer({ signal: readSignal } = {}) {
        // A track switch cancels just this read; a caller can still cancel the
        // entire disc. Do not require AbortSignal.any on older mobile browsers.
        const controller = new AbortController(), signals = [signal, readSignal].filter(Boolean);
        const abort = () => controller.abort();
        for (const source of signals) { source.addEventListener('abort', abort, { once: true }); if (source.aborted) abort(); }
        try {
          controller.signal.throwIfAborted();
          const { blob, response } = await readExact(url, end - start, fetcher, controller.signal, { Range: `bytes=${start}-${end - 1}` });
          if (response.headers.get('Content-Range') !== `bytes ${start}-${end - 1}/${entry.size}`)
            throw Error('Music server returned the wrong range');
          return await blob.arrayBuffer();
        } finally { for (const source of signals) source.removeEventListener('abort', abort); }
      } };
    },
  };
}

export async function loadGameAssets({ manifestUrl = new URL('./build/game/manifest.json', import.meta.url),
  fetcher = fetch, signal, onProgress = () => {}, cacheStorage } = {}) {
  const manifestAddress = new URL(manifestUrl), base = new URL('./', manifestAddress);
  const response = await fetcher(manifestAddress.href, { signal, cache: 'no-store' });
  if (!response.ok) throw Error('Game files are not ready. Please try again shortly.');
  const text = await response.text();
  if (text.length > 1024 * 1024) throw Error('Invalid game manifest');
  const manifest = JSON.parse(text);
  if (manifest.version !== 1 || !Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length > 2048)
    throw Error('Invalid game manifest');
  const paths = new Set(); let total = 0;
  const entries = manifest.files.map(entry => {
    if (typeof entry.path !== 'string' || !entry.path || /[:\\]/.test(entry.path) || entry.path.split('/').some(p => !p || p === '.' || p === '..') ||
        !integer(entry.size) || entry.size > MAX_FILE || paths.has(entry.path.toUpperCase()) ||
        typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw Error('Invalid game file');
    paths.add(entry.path.toUpperCase()); total += entry.size;
    const url = assetUrl(entry.url, base), cacheKey = new URL(url);
    // The query is a local cache key only; network reads use the original URL.
    cacheKey.searchParams.set('sha256', entry.sha256);
    return { ...entry, url, cacheKey: cacheKey.href };
  });
  if (total > MAX_TOTAL) throw Error('Game files exceed the browser limit');
  const cache = await openAssetCache(cacheStorage);
  const files = new Array(entries.length); let cursor = 0, loaded = 0;
  await Promise.all(Array.from({ length: Math.min(6, entries.length) }, async () => {
    while (cursor < entries.length) {
      const index = cursor++, entry = entries[index];
      const blob = await readGameFile(entry, cache, fetcher, signal);
      files[index] = { path: entry.path, file: blob }; loaded += entry.size;
      onProgress(total ? loaded / total : 1);
    }
  }));
  let disc;
  if (manifest.music) {
    const { cue, bin } = manifest.music;
    if (!cue || !integer(cue.size) || cue.size > 262144) throw Error('Invalid music cue');
    const { blob } = await readExact(assetUrl(cue.url, base), cue.size, fetcher, signal);
    disc = parseCdCue(await blob.text(), createHttpDisc(bin, base, fetcher));
  }
  // Drop obsolete game-file versions only after a complete successful load.
  // Leave caches for other applications and other game roots untouched.
  if (cache) try {
    signal?.throwIfAborted();
    const active = new Set(entries.map(entry => entry.cacheKey));
    for (const request of await cache.keys()) {
      signal?.throwIfAborted();
      if (request.url.startsWith(base.href) && !active.has(request.url)) await cache.delete(request);
    }
  } catch { /* Cache maintenance must not prevent a successful game load. */ }
  signal?.throwIfAborted();
  return { files, disc };
}
