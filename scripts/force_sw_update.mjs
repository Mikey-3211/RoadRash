import fs from 'fs';

let html = fs.readFileSync('public/games/road-rash/index.html', 'utf8');
const oldRegister = 'navigator.serviceWorker.register("/sw.js", { scope: "/" })';
const newRegister = 'navigator.serviceWorker.register("/sw.js?v=5", { scope: "/" }).then(reg => { reg.update(); return reg; })';
if (html.includes(oldRegister)) {
  html = html.replace(oldRegister, newRegister);
  fs.writeFileSync('public/games/road-rash/index.html', html, 'utf8');
  console.log('✔ Updated SW registration in road-rash index.html to force update');
} else {
  console.log('Road Rash index.html already updated or pattern not found');
}

let hubHtml = fs.readFileSync('public/index.html', 'utf8');
const oldHub = "navigator.serviceWorker.register('/sw.js', { scope: '/' })";
const newHub = "navigator.serviceWorker.register('/sw.js?v=5', { scope: '/' }).then(reg => { reg.update(); return reg; })";
if (hubHtml.includes(oldHub)) {
  hubHtml = hubHtml.replace(oldHub, newHub);
  fs.writeFileSync('public/index.html', hubHtml, 'utf8');
  console.log('✔ Updated SW registration in hub index.html to force update');
} else {
  console.log('Hub index.html already updated or pattern not found');
}
