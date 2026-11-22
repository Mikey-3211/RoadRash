import fs from 'fs';

let html = fs.readFileSync('public/games/vcop2/index.html', 'utf8');

// 1. Update header badge
html = html.replace(
  '<span class="game-meta-badge">REQUIRES INTERNET · EXTERNAL LAUNCH</span>',
  '<span class="game-meta-badge" style="color:#00f0ff;border-color:#00f0ff;">⚡ 100% OFFLINE · EMBEDDED IN AIR-GAPPED CABINET</span>'
);

// 2. Update notice badge
html = html.replace(
  '<span class="notice-badge">🌐 HOSTED EXTERNALLY AT VCOP2.LOL — INTERNET REQUIRED</span>',
  '<span class="notice-badge" style="background:rgba(0,240,255,0.2);">⚡ 100% OFFLINE AIR-GAPPED BUILD · ZERO EXTERNAL CONNECTIONS NEEDED</span>'
);

// 3. Update description
html = html.replace(
  'An active internet connection is required to play.',
  'Now runs 100% offline within this arcade portal directly from cached WebAssembly and assets.'
);

// 4. Update script to default to local offline mirror everywhere (including Vercel)
const oldScript = `btnPlayEmbed.addEventListener('click', () => {
      embedCabinet.style.display = 'block';
      const targetSrc = isLocal ? '/games/vcop2/local/' : 'https://vcop2.lol/';
      if (vcop2Iframe.getAttribute('src') !== targetSrc) {
        vcop2Iframe.setAttribute('src', targetSrc);
      }
      btnPlayEmbed.style.display = 'none';
      embedCabinet.scrollIntoView({ behavior: 'smooth' });
    });`;

const newScript = `btnPlayEmbed.addEventListener('click', () => {
      embedCabinet.style.display = 'block';
      const targetSrc = '/games/vcop2/local/';
      if (vcop2Iframe.getAttribute('src') !== targetSrc) {
        vcop2Iframe.setAttribute('src', targetSrc);
      }
      btnPlayEmbed.style.display = 'none';
      embedCabinet.scrollIntoView({ behavior: 'smooth' });
    });`;

if (html.includes(oldScript)) {
  html = html.replace(oldScript, newScript);
  console.log('✔ Updated play handler to route to local offline mirror');
}

// 5. Update standalone link default
html = html.replace('href="https://vcop2.lol/" target="_blank"', 'href="/games/vcop2/local/" target="_blank"');
html = html.replace('Open in standalone tab (vcop2.lol) ↗', 'Open in standalone tab (Offline WebAssembly Mirror) ↗');

fs.writeFileSync('public/games/vcop2/index.html', html, 'utf8');
console.log('✔ Updated public/games/vcop2/index.html to default to offline mirror!');
