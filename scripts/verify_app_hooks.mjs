import fs from 'fs';

const app = fs.readFileSync('public/classic/cd4bef5efafb3ec7/app.js', 'utf8');

const checks = [
  '<button class="quiet" data-settings>Settings</button>',
  'e.querySelector("[data-settings]").onclick=()=>we(W),',
  '<button data-controls>Controls</button>',
  ';le(e.video,l)}'
];

for (let c of checks) {
  console.log(c, '->', app.includes(c));
}
