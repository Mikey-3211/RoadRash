import fs from 'fs';

// 1. In bootstrap.js, bump app.js version
let b = fs.readFileSync('public/classic/cd4bef5efafb3ec7/bootstrap.js', 'utf8');
b = b.replace('app.js?v=rt-144', 'app.js?v=rt-145');
fs.writeFileSync('public/classic/cd4bef5efafb3ec7/bootstrap.js', b, 'utf8');
console.log('✔ bootstrap.js bumped to app.js?v=rt-145');

// 2. In main-C2rmrO5w.js, bump bootstrap.js version
let m = fs.readFileSync('public/assets/main-C2rmrO5w.js', 'utf8');
m = m.replace('bootstrap.js?v=41', 'bootstrap.js?v=42');
fs.writeFileSync('public/assets/main-C2rmrO5w.js', m, 'utf8');
console.log('✔ main-C2rmrO5w.js bumped to bootstrap.js?v=42');

// 3. In sw.js, bump CACHE_NAME to arcade-hub-v8
let sw = fs.readFileSync('public/sw.js', 'utf8');
sw = sw.replace("const CACHE_NAME = 'arcade-hub-v7';", "const CACHE_NAME = 'arcade-hub-v8';");
fs.writeFileSync('public/sw.js', sw, 'utf8');
console.log('✔ sw.js bumped to arcade-hub-v8');

// 4. In road-rash index.html, update sw register version
let rrHtml = fs.readFileSync('public/games/road-rash/index.html', 'utf8');
rrHtml = rrHtml.replace('/sw.js?v=7', '/sw.js?v=8');
rrHtml = rrHtml.replace('main-C2rmrO5w.js?v=3', 'main-C2rmrO5w.js?v=4');
fs.writeFileSync('public/games/road-rash/index.html', rrHtml, 'utf8');
console.log('✔ road-rash index.html updated to v=8');

// 5. In hub index.html, update sw register version
let hubHtml = fs.readFileSync('public/index.html', 'utf8');
hubHtml = hubHtml.replace('/sw.js?v=7', '/sw.js?v=8');
fs.writeFileSync('public/index.html', hubHtml, 'utf8');
console.log('✔ hub index.html updated to v=8');

// 6. In smoke_test.mjs, update check for arcade-hub-v8
let st = fs.readFileSync('scripts/smoke_test.mjs', 'utf8');
st = st.replace('arcade-hub-v7', 'arcade-hub-v8');
fs.writeFileSync('scripts/smoke_test.mjs', st, 'utf8');
console.log('✔ smoke_test.mjs updated to check arcade-hub-v8');
