import fs from 'fs';

let app = fs.readFileSync('public/classic/cd4bef5efafb3ec7/app.js', 'utf8');

// Add prominent "⚡ Cheats Menu" button directly to the main play button group
const oldNav = '<button data-board>Leaderboard</button>';
const newNav = '<button data-board>Leaderboard</button>\n    <button data-cheats-main style="background:#5a1010;border:1px solid #f8f078;color:#f8f078;font-weight:bold;font-size:1.1em;">⚡ Cheats Menu</button>';
if (app.includes(oldNav)) {
  app = app.replace(oldNav, newNav);
  console.log('✔ Added ⚡ Cheats Menu button to Main Menu actions');
} else {
  console.log('oldNav not found');
}

// Bind data-cheats-main click
const oldBind = 'e.querySelector("[data-board]").onclick=()=>{oe("menu_choice",{choice:"leaderboard"}),He(W)},';
const newBind = 'e.querySelector("[data-board]").onclick=()=>{oe("menu_choice",{choice:"leaderboard"}),He(W)},e.querySelector("[data-cheats-main]")&&(e.querySelector("[data-cheats-main]").onclick=()=>openCheatsMenu(W)),';
if (app.includes(oldBind)) {
  app = app.replace(oldBind, newBind);
  console.log('✔ Bound data-cheats-main click listener');
} else {
  console.log('oldBind not found');
}

// Also add Cheats option into Der Panzer Klub / Clubhouse menu (Re)
const oldKlubItems = '{label:o(56),desc:o(57),go:Z}';
const newKlubItems = '{label:"⚡ Cheats",desc:"Instantly add cash, superbike or toggle infinite nitro.",go:()=>openCheatsMenu(Re)},{label:o(56),desc:o(57),go:Z}';
if (app.includes(oldKlubItems)) {
  app = app.replace(oldKlubItems, newKlubItems);
  console.log('✔ Added ⚡ Cheats option into Clubhouse / Der Panzer Klub menu');
} else {
  console.log('oldKlubItems not found');
}

fs.writeFileSync('public/classic/cd4bef5efafb3ec7/app.js', app, 'utf8');
console.log('✔ Successfully updated app.js with prominent Cheats integration');
