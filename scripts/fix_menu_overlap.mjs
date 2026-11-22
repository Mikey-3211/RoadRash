import fs from 'fs';

let app = fs.readFileSync('public/classic/cd4bef5efafb3ec7/app.js', 'utf8');

// 1. Remove the extra button from home-actions that was causing the grid overflow and overlap
const badBtn = '\n    <button data-cheats-main style="background:#5a1010;border:1px solid #f8f078;color:#f8f078;font-weight:bold;font-size:1.1em;">⚡ Cheats Menu</button>';
if (app.includes(badBtn)) {
  app = app.replace(badBtn, '');
  console.log('✔ Removed overlapping button from home-actions');
}

// 2. Format home-actions and home-footer cleanly:
// Home actions keeps the authentic 4 slots: Race Now, Multiplayer, Career, Leaderboard
// Home footer adds the Cheats button neatly without overlapping
const oldFooter = '<nav class="home-footer" aria-label="More"><button class="quiet" data-cheats style="color:#f8f078;font-weight:bold;">⚡ Cheats</button><button class="quiet" data-settings>Settings</button><button class="quiet" data-help>How to Play</button><button class="quiet" data-join>Join Us</button><button class="quiet" data-chat>Global Chat</button></nav>';

const newFooter = '<nav class="home-footer" aria-label="More"><button class="quiet" data-settings>Settings</button><button class="quiet" data-help>How to Play</button><button class="quiet" data-cheats style="color:#f8f078;font-weight:bold;">⚡ Cheats</button><button class="quiet" data-chat>Global Chat</button></nav>';

if (app.includes(oldFooter)) {
  app = app.replace(oldFooter, newFooter);
  console.log('✔ Perfectly aligned 4-button home-footer with ⚡ Cheats');
}

fs.writeFileSync('public/classic/cd4bef5efafb3ec7/app.js', app, 'utf8');
console.log('✔ app.js updated successfully');
