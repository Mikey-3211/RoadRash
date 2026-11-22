import https from 'https';
import fs from 'fs';

https.get('https://roadrash.site/classic/55a31131a09e4a71/app.js?v=rt-200', (res) => {
  console.log('Live roadrash.site app.js status:', res.statusCode);
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('Live app.js downloaded length:', data.length);
    fs.writeFileSync('scripts/live_app.js', data, 'utf8');
    
    // Find asset paths
    const assetMatches = data.match(/\/classic-assets\/[a-zA-Z0-9_-]+\/[^"'\s\)]+/g);
    console.log('Total asset references in live app.js:', assetMatches ? assetMatches.length : 0);
    if (assetMatches) {
      const set = new Set(assetMatches);
      console.log('Unique asset URLs count:', set.size);
      console.log('Sample asset URLs:', [...set].slice(0, 15));
      fs.writeFileSync('scripts/live_assets.json', JSON.stringify([...set], null, 2), 'utf8');
    }
  });
}).on('error', e => console.error(e));
