import fs from 'fs';

// 1. In bootstrap.js, change app.js?v=rt-141 to app.js?v=rt-142
let b = fs.readFileSync('public/classic/cd4bef5efafb3ec7/bootstrap.js', 'utf8');
if (b.includes('app.js?v=rt-141')) {
  b = b.replace('app.js?v=rt-141', 'app.js?v=rt-142');
  fs.writeFileSync('public/classic/cd4bef5efafb3ec7/bootstrap.js', b, 'utf8');
  console.log('✔ bootstrap.js updated to v=rt-142');
} else {
  console.log('bootstrap.js already updated or version different');
}

// 2. In app.js, change account-client.js?v=23 to account-client.js?v=24
let app = fs.readFileSync('public/classic/cd4bef5efafb3ec7/app.js', 'utf8');
if (app.includes('account-client.js?v=23')) {
  app = app.replace('account-client.js?v=23', 'account-client.js?v=24');
  fs.writeFileSync('public/classic/cd4bef5efafb3ec7/app.js', app, 'utf8');
  console.log('✔ app.js updated account-client import to v=24');
} else {
  console.log('app.js already updated or version different');
}

// 3. In main-C2rmrO5w.js, change bootstrap.js?v=38 to bootstrap.js?v=39
let main = fs.readFileSync('public/assets/main-C2rmrO5w.js', 'utf8');
if (main.includes('bootstrap.js?v=38')) {
  main = main.replace('bootstrap.js?v=38', 'bootstrap.js?v=39');
  fs.writeFileSync('public/assets/main-C2rmrO5w.js', main, 'utf8');
  console.log('✔ main-C2rmrO5w.js updated to bootstrap.js?v=39');
} else {
  console.log('main-C2rmrO5w.js already updated or version different');
}

// 4. In road-rash index.html, update main-C2rmrO5w.js?v=2
let rrHtml = fs.readFileSync('public/games/road-rash/index.html', 'utf8');
if (rrHtml.includes('src="/assets/main-C2rmrO5w.js"')) {
  rrHtml = rrHtml.replace('src="/assets/main-C2rmrO5w.js"', 'src="/assets/main-C2rmrO5w.js?v=2"');
  fs.writeFileSync('public/games/road-rash/index.html', rrHtml, 'utf8');
  console.log('✔ road-rash index.html script tag updated with query param ?v=2');
} else {
  console.log('road-rash index.html already updated');
}

// 5. In sw.js, bump CACHE_NAME to arcade-hub-v5
let sw = fs.readFileSync('public/sw.js', 'utf8');
if (sw.includes("const CACHE_NAME = 'arcade-hub-v4';")) {
  sw = sw.replace("const CACHE_NAME = 'arcade-hub-v4';", "const CACHE_NAME = 'arcade-hub-v5';");
  fs.writeFileSync('public/sw.js', sw, 'utf8');
  console.log('✔ sw.js updated to arcade-hub-v5');
} else {
  console.log('sw.js already updated');
}
