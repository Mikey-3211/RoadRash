import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const LOCAL_DIR = path.resolve('offline/vcop2.lol');

async function testBoot() {
  console.log('--- 1. Testing Manifest & Assets on Disk ---');
  const manifestPath = path.join(LOCAL_DIR, 'build/game/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  console.log('Manifest version:', manifest.version, 'Files count:', manifest.files.length);

  let missingAssets = 0;
  let mismatchedAssets = 0;
  for (const f of manifest.files) {
    const filePath = path.join(LOCAL_DIR, 'build/game', f.url);
    if (!fs.existsSync(filePath)) {
      console.error('Missing file:', f.path, 'Expected at:', f.url);
      missingAssets++;
    } else {
      const data = fs.readFileSync(filePath);
      if (data.length !== f.size) {
        console.error('Size mismatch for', f.path, 'Expected:', f.size, 'Got:', data.length);
        mismatchedAssets++;
      } else {
        const hash = crypto.createHash('sha256').update(data).digest('hex');
        if (hash !== f.sha256) {
          console.error('SHA256 mismatch for', f.path);
          mismatchedAssets++;
        }
      }
    }
  }

  console.log(`Assets Check: Missing=${missingAssets}, Mismatched=${mismatchedAssets}`);

  console.log('\n--- 2. Testing HTTP Endpoints from Local Server (http://localhost:8080) ---');
  const endpoints = [
    '/games/vcop2/local/index.html',
    '/games/vcop2/local/game.css',
    '/games/vcop2/local/game-viewport.css',
    '/games/vcop2/local/play.js',
    '/games/vcop2/local/startup-worker.js',
    '/games/vcop2/local/build/vcop2.js',
    '/games/vcop2/local/build/vcop2.wasm',
    '/games/vcop2/local/build/game/manifest.json',
    '/games/vcop2/local/room-ui.js',
    '/games/vcop2/local/room-client.js',
    '/games/vcop2/local/worker-network.js',
    '/games/vcop2/local/game-profile.js',
    '/games/vcop2/local/slice-scheduler.js',
    '/games/vcop2/local/runtime-performance.js',
    '/games/vcop2/local/observation-transport.js',
    '/games/vcop2/local/audio-transport.js',
    '/games/vcop2/local/match-analytics.js',
    '/games/vcop2/local/network-protocol.js',
    '/games/vcop2/local/module-verification.js',
    '/games/vcop2/local/build/game/branding/vcop2-logo.png'
  ];

  let failedEndpoints = 0;
  for (const ep of endpoints) {
    try {
      const res = await fetch('http://localhost:8080' + ep);
      if (res.status !== 200) {
        console.error('❌ HTTP', res.status, ep);
        failedEndpoints++;
      } else {
        const ct = res.headers.get('content-type');
        console.log('✔ 200 OK:', ep, `(${ct})`);
      }
    } catch (e) {
      console.error('❌ Connection error on', ep, e.message);
      failedEndpoints++;
    }
  }

  console.log('\nFailed endpoints:', failedEndpoints);
  if (missingAssets === 0 && mismatchedAssets === 0 && failedEndpoints === 0) {
    console.log('\n🎉 ALL LOCAL ASSETS & HTTP ENDPOINTS VERIFIED 100% HEALTHY!');
  }
}

testBoot();
