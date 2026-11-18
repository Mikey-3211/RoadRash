import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const LOCAL_DIR = path.resolve('offline/vcop2.lol');

async function testLoadAssets() {
  console.log('Testing loadGameAssets() from game-assets.js...');
  const { loadGameAssets } = await import(pathToFileURL(path.join(LOCAL_DIR, 'game-assets.js')).href);

  console.log('Calling loadGameAssets with fetcher against localhost:8080...');
  const result = await loadGameAssets({
    manifestUrl: 'http://localhost:8080/games/vcop2/local/build/game/manifest.json',
    fetcher: fetch,
    onProgress: p => console.log('Progress:', (p * 100).toFixed(1) + '%')
  });

  console.log('✔ loadGameAssets finished!');
  console.log('Files loaded:', result.files?.length);
  console.log('Disc:', result.disc ? 'present' : 'none');
}

testLoadAssets().catch(console.error);
