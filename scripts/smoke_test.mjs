import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 3456;
const PUBLIC_DIR = path.resolve('public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';
  if (reqPath.endsWith('/')) reqPath += 'index.html';

  let filePath = path.join(PUBLIC_DIR, reqPath);

  if (!path.extname(filePath) && fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  } else if (!path.extname(filePath) && fs.existsSync(filePath + '.html')) {
    filePath = filePath + '.html';
  }

  // Cross-Origin headers matching Vercel configuration
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found: ' + reqPath);
  }
});

async function runTests() {
  await new Promise(resolve => server.listen(PORT, '127.0.0.1', resolve));
  console.log(`\n======================================================`);
  console.log(`[TEST RUNNER] Local server active on http://127.0.0.1:${PORT}`);
  console.log(`======================================================\n`);

  let failures = 0;
  const baseUrl = `http://127.0.0.1:${PORT}`;

  // 1. Verify JSON catalog
  try {
    const res = await fetch(`${baseUrl}/games.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const catalog = await res.json();
    console.log(`✔ [games.json] Valid JSON array with ${catalog.length} game registrations.`);
    if (catalog.length < 4 || catalog.length > 8) throw new Error(`Expected between 4 and 8 games, got ${catalog.length}`);
    for (const g of catalog) {
      if (!g.id || !g.title || !g.route || !g.statusType) {
        throw new Error(`Game entry invalid: ${JSON.stringify(g)}`);
      }
    }
  } catch (e) {
    console.error(`❌ [games.json] Test failed: ${e.message}`);
    failures++;
  }

  // 2. Verify Service Worker & Cache Manifest
  try {
    const swRes = await fetch(`${baseUrl}/sw.js`);
    if (!swRes.ok) throw new Error(`HTTP ${swRes.status}`);
    const swText = await swRes.text();
    if (!swText.includes('arcade-hub-v6')) throw new Error('SW does not contain arcade-hub-v4');
    console.log(`✔ [sw.js] Service Worker found with arcade-hub-v4 cache configuration.`);

    const manRes = await fetch(`${baseUrl}/cache-manifest.json`);
    if (!manRes.ok) throw new Error(`HTTP ${manRes.status}`);
    const manifest = await manRes.json();
    console.log(`✔ [cache-manifest.json] Contains ${manifest.length} cached resources.`);
    const hasBackslash = manifest.filter(p => p.includes('\\'));
    if (hasBackslash.length > 0) throw new Error(`Found ${hasBackslash.length} unnormalized backslashes!`);
    console.log(`✔ [cache-manifest.json] 100% normalized with forward slashes.`);
  } catch (e) {
    console.error(`❌ [SW/Manifest] Test failed: ${e.message}`);
    failures++;
  }

  // 3. Verify All Routes & Headers
  const routesToTest = [
    { path: '/', label: 'Arcade Homepage', expectStr: 'RETRO ARCADE HUB' },
    { path: '/games/vcop2/', label: 'Virtua Cop 2 Portal', expectStr: 'VIRTUA COP 2' },
    { path: '/games/dangerous-dave/', label: 'Dangerous Dave Portal', expectStr: 'DANGEROUS DAVE' },
    { path: '/dave/', label: 'Dangerous Dave Legacy', expectStr: 'DANGEROUS DAVE' },
    { path: '/games/road-rash/', label: 'Road Rash Portal', expectStr: 'Road Rash' },
    { path: '/games/hotd2/', label: 'HOTD2 Portal', expectStr: 'The House of the Dead 2' }
  ];

  for (const r of routesToTest) {
    try {
      const res = await fetch(`${baseUrl}${r.path}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!text.includes(r.expectStr)) throw new Error(`Expected text '${r.expectStr}' not found in body`);
      
      const coop = res.headers.get('cross-origin-opener-policy');
      const coep = res.headers.get('cross-origin-embedder-policy');
      if (coop !== 'same-origin' || coep !== 'require-corp') {
        throw new Error(`Missing COOP/COEP isolation headers: COOP=${coop}, COEP=${coep}`);
      }
      console.log(`✔ [Route ${r.path}] (${r.label}) 200 OK + COOP/COEP headers present.`);
    } catch (e) {
      console.error(`❌ [Route ${r.path}] Test failed: ${e.message}`);
      failures++;
    }
  }

  // 4. Verify Critical Assets
  const criticalAssets = [
    '/assets/main-C2rmrO5w.js',
    '/classic/cd4bef5efafb3ec7/ui.css',
    '/dave/assets2/dave0.png',
    '/icon-192.png',
    '/games/hotd2/player/index.html',
    '/games/hotd2/player/main.js',
    '/games/hotd2/player/zip.js',
    '/games/hotd2/player/gl.js',
    '/games/hotd2/player/audio-worklet.js'
  ];

  for (const asset of criticalAssets) {
    try {
      const res = await fetch(`${baseUrl}${asset}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      console.log(`✔ [Asset ${asset}] 200 OK (${res.headers.get('content-type')})`);
    } catch (e) {
      console.error(`❌ [Asset ${asset}] Test failed: ${e.message}`);
      failures++;
    }
  }

  server.close();

  console.log(`\n======================================================`);
  if (failures === 0) {
    console.log(`🎉 ALL SMOKE TESTS PASSED! (${routesToTest.length + criticalAssets.length + 2} assertions)`);
  } else {
    console.error(`❌ ${failures} TESTS FAILED.`);
    process.exit(1);
  }
  console.log(`======================================================\n`);
}

runTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
