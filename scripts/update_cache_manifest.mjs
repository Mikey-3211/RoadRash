import fs from 'fs';
import path from 'path';

const manifestPath = path.resolve('public/cache-manifest.json');
const list = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Convert all backslashes to forward slashes
const normalized = list.map(item => item.replace(/\\/g, '/'));

console.log('Sample before:', list[0]);
console.log('Sample after:', normalized[0]);
console.log('Backslashes remaining in normalized:', normalized.filter(p => p.includes('\\')).length);

// Additional essential hub files
const coreHubFiles = [
  '/',
  '/index.html',
  '/manifest.json',
  '/games.json',
  '/icon-192.png',
  '/icon-512.png',
  '/games/road-rash/',
  '/games/road-rash/index.html',
  '/games/dangerous-dave/',
  '/games/dangerous-dave/index.html',
  '/dave/',
  '/dave/index.html',
  '/games/vcop2/',
  '/games/vcop2/index.html',
  '/games/hotd2/',
  '/games/hotd2/index.html'
];

// Dangerous Dave assets
const daveAssetsDir = path.resolve('public/dave/assets2');
if (fs.existsSync(daveAssetsDir)) {
  const daveFiles = fs.readdirSync(daveAssetsDir);
  for (const f of daveFiles) {
    coreHubFiles.push(`/dave/assets2/${f}`);
    coreHubFiles.push(`/games/dangerous-dave/assets2/${f}`);
  }
}

// Combine and deduplicate
const combined = Array.from(new Set([...coreHubFiles, ...normalized]));
console.log('Total items in updated manifest:', combined.length);

fs.writeFileSync(manifestPath, JSON.stringify(combined, null, 2), 'utf8');
console.log('Updated cache-manifest.json successfully!');
