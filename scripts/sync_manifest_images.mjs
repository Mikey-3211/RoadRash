import fs from 'fs';
import path from 'path';

function getAllFiles(dir, all = []) {
  const list = fs.readdirSync(dir);
  for (let f of list) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      getAllFiles(full, all);
    } else {
      all.push(full.replace(/\\/g, '/').replace(/^public/, ''));
    }
  }
  return all;
}

const allClassic = getAllFiles('public/classic-assets/414a4427a4dcdcc4/assets/img');
let cm = JSON.parse(fs.readFileSync('public/cache-manifest.json', 'utf8'));

let added = 0;
for (let f of allClassic) {
  if (!cm.includes(f)) {
    cm.push(f);
    added++;
  }
}

fs.writeFileSync('public/cache-manifest.json', JSON.stringify(cm, null, 2), 'utf8');
console.log('Added ' + added + ' images to cache-manifest.json. Total entries: ' + cm.length);
