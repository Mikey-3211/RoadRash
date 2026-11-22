import fs from 'fs';

const Fa = {
  rat: ['banzai','corsair','kamikaze','perro','killer'],
  sport: ['diablo','kamikaze','stiletto','dmg','perro'],
  super: ['banzai','diablo','stiletto','corsair','kamikaze']
};

const checks = [];
for (let cls of ['rat', 'sport', 'super']) {
  checks.push('showroom/' + cls + '/bikes');
  for (let s of Fa[cls]) {
    checks.push('showroom/' + cls + '/' + s);
    checks.push('bikes/' + cls + '/' + s);
  }
}

const missing = [];
const existing = [];
for (let item of checks) {
  const p1 = 'public/classic-assets/414a4427a4dcdcc4/assets/' + item + '.webp';
  const p2 = 'public/classic-assets/414a4427a4dcdcc4/assets/' + item + '.png';
  const p3 = 'public/classic-assets/414a4427a4dcdcc4/assets/' + item;
  const exists = fs.existsSync(p1) || fs.existsSync(p2) || fs.existsSync(p3);
  if (!exists) {
    missing.push(item);
  } else {
    existing.push(item);
  }
}

console.log('Existing items count:', existing.length);
console.log('Missing items count:', missing.length);
console.log('Missing list:', missing);
