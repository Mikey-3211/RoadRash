import fs from 'fs';

// 1. In road-rash index.html, add global floating ⚡ CHEATS button
let html = fs.readFileSync('public/games/road-rash/index.html', 'utf8');
const oldHeader = '<a href="/" style="position:fixed;top:12px;left:12px;z-index:9999;background:rgba(0,0,0,0.75);color:#f8f078;border:1px solid #f8f078;border-radius:4px;padding:6px 12px;font-family:FutD,sans-serif;font-size:16px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 10px rgba(0,0,0,0.8);">◀ ARCADE HUB</a>';

const newHeader = '<a href="/" style="position:fixed;top:12px;left:12px;z-index:9999;background:rgba(0,0,0,0.75);color:#f8f078;border:1px solid #f8f078;border-radius:4px;padding:6px 12px;font-family:FutD,sans-serif;font-size:16px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 10px rgba(0,0,0,0.8);">◀ ARCADE HUB</a>\n<button type="button" id="floating-cheats-btn" onclick="window.__RR_OPEN_CHEATS__&&window.__RR_OPEN_CHEATS__()" style="position:fixed;top:12px;left:160px;z-index:9999;background:#5a1010;color:#f8f078;border:1px solid #f8f078;border-radius:4px;padding:6px 14px;font-family:sans-serif;font-weight:bold;font-size:15px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 10px rgba(0,0,0,0.8);">⚡ CHEATS</button>';

if (html.includes(oldHeader)) {
  html = html.replace(oldHeader, newHeader);
  fs.writeFileSync('public/games/road-rash/index.html', html, 'utf8');
  console.log('✔ Added floating ⚡ CHEATS button to road-rash index.html');
}

// 2. In app.js, expose window.__RR_OPEN_CHEATS__
let app = fs.readFileSync('public/classic/cd4bef5efafb3ec7/app.js', 'utf8');
if (!app.includes('window.__RR_OPEN_CHEATS__=')) {
  app = app.replace('function openCheatsMenu(backFn=W){', 'function openCheatsMenu(backFn=W){\nwindow.__RR_OPEN_CHEATS__=()=>openCheatsMenu(W);');
  fs.writeFileSync('public/classic/cd4bef5efafb3ec7/app.js', app, 'utf8');
  console.log('✔ Exposed window.__RR_OPEN_CHEATS__ globally');
}
