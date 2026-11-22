import fs from 'fs';

// In bootstrap.js, bump app.js version
let b = fs.readFileSync('public/classic/cd4bef5efafb3ec7/bootstrap.js', 'utf8');
b = b.replace('app.js?v=rt-142', 'app.js?v=rt-143');
fs.writeFileSync('public/classic/cd4bef5efafb3ec7/bootstrap.js', b, 'utf8');
console.log('✔ bootstrap.js bumped to app.js?v=rt-143');

// In main-C2rmrO5w.js, bump bootstrap.js version
let m = fs.readFileSync('public/assets/main-C2rmrO5w.js', 'utf8');
m = m.replace('bootstrap.js?v=39', 'bootstrap.js?v=40');
fs.writeFileSync('public/assets/main-C2rmrO5w.js', m, 'utf8');
console.log('✔ main-C2rmrO5w.js bumped to bootstrap.js?v=40');

// In sw.js, bump CACHE_NAME to arcade-hub-v6
let sw = fs.readFileSync('public/sw.js', 'utf8');
sw = sw.replace("const CACHE_NAME = 'arcade-hub-v5';", "const CACHE_NAME = 'arcade-hub-v6';");
fs.writeFileSync('public/sw.js', sw, 'utf8');
console.log('✔ sw.js bumped to arcade-hub-v6');

// In smoke_test.mjs, update check for arcade-hub-v6
let st = fs.readFileSync('scripts/smoke_test.mjs', 'utf8');
st = st.replace('arcade-hub-v5', 'arcade-hub-v6');
fs.writeFileSync('scripts/smoke_test.mjs', st, 'utf8');
console.log('✔ smoke_test.mjs updated to check arcade-hub-v6');
