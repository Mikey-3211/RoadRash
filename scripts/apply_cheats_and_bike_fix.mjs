import fs from 'fs';

let app = fs.readFileSync('public/classic/cd4bef5efafb3ec7/app.js', 'utf8');

// 1. Fix showroom bike selection by eliminating missing video stalls
const oldBuyHook = ';le(e.video,l)}';
const newBuyHook = ';l()}';
if (app.includes(oldBuyHook)) {
  app = app.replace(oldBuyHook, newBuyHook);
  console.log('✔ Replaced le(e.video,l) with l() to show bike preview instantaneously');
} else {
  console.log('oldBuyHook not found');
}

// 2. Add Cheats button to Main Menu footer
const oldHomeNav = '<button class="quiet" data-settings>Settings</button>';
const newHomeNav = '<button class="quiet" data-cheats style="color:#f8f078;font-weight:bold;">⚡ Cheats</button><button class="quiet" data-settings>Settings</button>';
if (app.includes(oldHomeNav)) {
  app = app.replace(oldHomeNav, newHomeNav);
  console.log('✔ Added Cheats button to Main Menu footer');
} else {
  console.log('oldHomeNav not found');
}

// 3. Add Cheats button to Settings menu
const oldSettingsActions = '<button data-controls>Controls</button>';
const newSettingsActions = '<button data-cheats style="background:#5a1010;color:#f8f078;font-weight:bold;">⚡ Cheats Menu</button><button data-controls>Controls</button>';
if (app.includes(oldSettingsActions)) {
  app = app.replace(oldSettingsActions, newSettingsActions);
  console.log('✔ Added Cheats button to Settings menu');
} else {
  console.log('oldSettingsActions not found');
}

// 4. Implement openCheatsMenu function and bind buttons
const cheatsMenuFunc = `
function openCheatsMenu(backFn=W){
  const t = be("Cheats & Hacks", \`<div class="menu-stack">
    <p class="menu-muted" style="color:#f8f078;">Instant Cheats: apply directly to your current game, career, and bikes!</p>
    <div class="menu-card" style="display:flex;flex-direction:column;gap:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div><strong>Cash (Current: $\${n.cash})</strong><div class="menu-muted">Add cash to purchase any bike in Olley's shop</div></div>
        <div style="display:flex;gap:6px;">
          <button type="button" data-cheat-cash="50000">+ $50,000</button>
          <button type="button" data-cheat-cash="500000">+ $500,000</button>
        </div>
      </div>
      <hr style="border:none;border-top:1px solid #444;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div><strong>Unlock Best Superbike</strong><div class="menu-muted">Immediately equip the fastest 750cc Superbike (Kamikaze)</div></div>
        <button type="button" data-cheat-superbike>Equip Superbike</button>
      </div>
      <hr style="border:none;border-top:1px solid #444;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div><strong>Nitro Booster (xyzz)</strong><div class="menu-muted">Unlimited nitrous speed boosts during every race</div></div>
        <button type="button" data-cheat-nitro>Toggle Nitro ON</button>
      </div>
      <hr style="border:none;border-top:1px solid #444;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div><strong>Career Level (Current: Level \${n.level||1})</strong><div class="menu-muted">Advance to any level immediately</div></div>
        <div style="display:flex;gap:6px;">
          <button type="button" data-cheat-level="1">Lvl 1</button>
          <button type="button" data-cheat-level="3">Lvl 3</button>
          <button type="button" data-cheat-level="5">Lvl 5 (Max)</button>
        </div>
      </div>
      <hr style="border:none;border-top:1px solid #444;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div><strong>Qualify All Tracks</strong><div class="menu-muted">Mark all 5 courses qualified for the current level</div></div>
        <button type="button" data-cheat-qualify>Qualify All</button>
      </div>
    </div>
    <div id="cheat-feedback" role="status" style="font-weight:bold;color:#4ade80;text-align:center;min-height:24px;"></div>
    <div class="menu-actions"><button type="button" class="primary" data-cheat-done>Back</button></div>
  </div>\`, {back: backFn, art: "remaster/credits.webp"});

  const msg = t.querySelector("#cheat-feedback");
  const showFeedback = (txt) => {
    msg.textContent = "✔ " + txt;
    Ne("engsport", .5);
    R();
  };

  t.querySelectorAll("[data-cheat-cash]").forEach(btn => {
    btn.onclick = () => {
      const amt = parseInt(btn.dataset.cheatCash, 10);
      n.cash = (n.cash || 0) + amt;
      const local = JSON.parse(localStorage.getItem("rr-career-local.v1") || "{}");
      local.cash = n.cash;
      localStorage.setItem("rr-career-local.v1", JSON.stringify(local));
      showFeedback("Added $" + amt.toLocaleString() + "! Total Cash: $" + n.cash.toLocaleString());
    };
  });

  const sbBtn = t.querySelector("[data-cheat-superbike]");
  if (sbBtn) {
    sbBtn.onclick = () => {
      n.bike = 14;
      if (!n.owned) n.owned = [14];
      else if (!n.owned.includes(14)) n.owned.push(14);
      const local = JSON.parse(localStorage.getItem("rr-career-local.v1") || "{}");
      local.bike = 14;
      local.owned = n.owned;
      localStorage.setItem("rr-career-local.v1", JSON.stringify(local));
      showFeedback("Unlocked and equipped Superbike (Kamikaze 750cc)!");
    };
  }

  const nitroBtn = t.querySelector("[data-cheat-nitro]");
  if (nitroBtn) {
    nitroBtn.onclick = () => {
      window.__RR_NITRO_CHEAT__ = !window.__RR_NITRO_CHEAT__;
      nitroBtn.textContent = window.__RR_NITRO_CHEAT__ ? "Nitro is ACTIVE" : "Toggle Nitro ON";
      showFeedback(window.__RR_NITRO_CHEAT__ ? "Infinite Nitro Activated!" : "Nitro Deactivated");
    };
  }

  t.querySelectorAll("[data-cheat-level]").forEach(btn => {
    btn.onclick = () => {
      const lvl = parseInt(btn.dataset.cheatLevel, 10);
      n.level = lvl;
      const local = JSON.parse(localStorage.getItem("rr-career-local.v1") || "{}");
      local.level = lvl;
      localStorage.setItem("rr-career-local.v1", JSON.stringify(local));
      showFeedback("Career level changed to Level " + lvl + "!");
    };
  });

  const qBtn = t.querySelector("[data-cheat-qualify]");
  if (qBtn) {
    qBtn.onclick = () => {
      if (!n.qualified) n.qualified = {};
      const lvl = n.level || 1;
      for (const tr of ["city", "hiway", "medly", "napa", "canyn"]) {
        n.qualified[lvl + ":" + tr] = true;
      }
      const local = JSON.parse(localStorage.getItem("rr-career-local.v1") || "{}");
      local.qualified = n.qualified;
      localStorage.setItem("rr-career-local.v1", JSON.stringify(local));
      showFeedback("All 5 courses qualified for Level " + lvl + "!");
    };
  }

  const doneBtn = t.querySelector("[data-cheat-done]");
  if (doneBtn) doneBtn.onclick = () => backFn();
}
`;

// Insert openCheatsMenu right before function we(
const weIdx = app.indexOf('function we(');
if (weIdx >= 0) {
  app = app.slice(0, weIdx) + cheatsMenuFunc + '\n' + app.slice(weIdx);
  console.log('✔ Added openCheatsMenu function into app.js');
} else {
  console.log('function we not found');
}

// Bind data-cheats in W
const homeSettingsBind = 'e.querySelector("[data-settings]").onclick=()=>we(W),';
const newHomeSettingsBind = 'e.querySelector("[data-cheats]")&&(e.querySelector("[data-cheats]").onclick=()=>openCheatsMenu(W)),e.querySelector("[data-settings]").onclick=()=>we(W),';
if (app.includes(homeSettingsBind)) {
  app = app.replace(homeSettingsBind, newHomeSettingsBind);
  console.log('✔ Bound data-cheats button in Main Menu');
} else {
  console.log('homeSettingsBind not found');
}

// Bind data-cheats in we (Settings)
const settingsControlsBind = 't.querySelector("[data-controls]").onclick=()=>';
const newSettingsControlsBind = 't.querySelector("[data-cheats]")&&(t.querySelector("[data-cheats]").onclick=()=>openCheatsMenu(()=>we(e))),t.querySelector("[data-controls]").onclick=()=>';
if (app.includes(settingsControlsBind)) {
  app = app.replace(settingsControlsBind, newSettingsControlsBind);
  console.log('✔ Bound data-cheats button in Settings menu');
} else {
  console.log('settingsControlsBind not found');
}

// Update nitro cheat checks to respect window.__RR_NITRO_CHEAT__
const oldNitroCheck1 = 'cheated:ft()';
const newNitroCheck1 = 'cheated:ft()||window.__RR_NITRO_CHEAT__===true';
if (app.includes(oldNitroCheck1)) {
  app = app.replace(oldNitroCheck1, newNitroCheck1);
  console.log('✔ Updated context cheated flag for nitro cheat');
}

const oldNitroCheck2 = 'nitroCheat:ft()';
const newNitroCheck2 = 'nitroCheat:ft()||window.__RR_NITRO_CHEAT__===true';
if (app.includes(oldNitroCheck2)) {
  app = app.replace(oldNitroCheck2, newNitroCheck2);
  console.log('✔ Updated race nitroCheat parameter for window.__RR_NITRO_CHEAT__');
}

fs.writeFileSync('public/classic/cd4bef5efafb3ec7/app.js', app, 'utf8');
console.log('✔ Successfully saved all changes to app.js');
