import fs from 'fs';
import path from 'path';

const BASE = 'https://vcop2.lol';
const LOCAL_DIR = path.resolve('offline/vcop2.lol');

async function crawlAndDownload() {
  const visited = new Set();
  const queue = ['play.js', 'startup-worker.js', 'index.html'];

  while (queue.length > 0) {
    const relPath = queue.shift();
    if (visited.has(relPath)) continue;
    visited.add(relPath);

    const localPath = path.join(LOCAL_DIR, relPath);
    let content = '';

    if (!fs.existsSync(localPath)) {
      console.log(`Downloading missing: ${relPath}...`);
      const res = await fetch(`${BASE}/${relPath}`);
      if (!res.ok) {
        console.error(`❌ Failed to fetch ${BASE}/${relPath}: ${res.status}`);
        continue;
      }
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(localPath, buf);
      console.log(`✔ Saved ${relPath} (${buf.length} bytes)`);
      content = buf.toString('utf-8');
    } else {
      content = fs.readFileSync(localPath, 'utf-8');
    }

    if (relPath.endsWith('.js') || relPath.endsWith('.html')) {
      // Find all imports
      const importMatches = [
        ...content.matchAll(/from\s+['"]([^'"]+)['"]/g),
        ...content.matchAll(/import\s*\(['"]([^'"]+)['"]\)/g),
        ...content.matchAll(/import\s+['"]([^'"]+)['"]/g),
        ...content.matchAll(/new\s+Worker\s*\(\s*['"]([^'"]+)['"]/g),
        ...content.matchAll(/src=["']([^"']+\.js)["']/g)
      ];

      for (const m of importMatches) {
        let imp = m[1];
        if (imp.startsWith('.')) {
          const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(relPath), imp));
          if (!visited.has(resolved)) queue.push(resolved);
        } else if (!imp.startsWith('http') && !imp.startsWith('data:')) {
          const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(relPath), imp));
          if (!visited.has(resolved)) queue.push(resolved);
        }
      }
    }
  }

  console.log('\n=========================================');
  console.log('🎉 Recursive crawl and download finished!');
  console.log('Total visited files:', visited.size);
  console.log('=========================================');
}

crawlAndDownload();
