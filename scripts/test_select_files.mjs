import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const LOCAL_DIR = path.resolve('offline/vcop2.lol');
const manifest = JSON.parse(fs.readFileSync(path.join(LOCAL_DIR, 'build/game/manifest.json'), 'utf-8'));

const selection = manifest.files.map(entry => {
  const buf = fs.readFileSync(path.join(LOCAL_DIR, 'build/game', entry.url));
  return {
    path: entry.path,
    file: {
      size: buf.length,
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    }
  };
});

async function run() {
  const worker = await import(pathToFileURL(path.join(LOCAL_DIR, 'startup-worker.js')).href);
  const files = worker.selectGameFiles(selection);

  const { default: createModule } = await import(pathToFileURL(path.join(LOCAL_DIR, 'build/vcop2.js')).href);
  console.log('Instantiating vcop2 module...');
  const module = await createModule();
  console.log('Module instantiated!');

  console.log('Calling _vcop2_startup_reset...');
  module._vcop2_startup_reset();

  console.log('Adding runtime files into WASM memory...');
  for (const { path, file } of files) {
    const bytes = await file.arrayBuffer();
    worker.addRuntimeFile(module, path, bytes);
  }
  console.log('All 116 files added to WASM memory!');

  console.log('Calling _vcop2_startup_start(50000)...');
  const code = module._vcop2_startup_start(50000);
  console.log('Startup start code:', code);

  const resJson = module.UTF8ToString(module._vcop2_result_json());
  console.log('Result JSON:', resJson);

  const frameCount = module._vcop2_frame_count();
  console.log('Frame count:', frameCount);
}

run().catch(console.error);
