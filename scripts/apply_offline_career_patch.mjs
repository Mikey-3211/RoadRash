import fs from 'fs';

// 1. Update account-client.js
let ac = fs.readFileSync('public/classic/cd4bef5efafb3ec7/account-client.js', 'utf8');

const target_ = 'async function _(e=new URLSearchParams(location.search).get("restore")){try{const t=await m("/auth/browser",{method:"POST",signal:AbortSignal.timeout(8e3),body:{device:y(ne),...e?{restore:e}:{}}});t.device&&w(ne,t.device),await ue(t.user)}catch(t){if(!e||t.status!==400)throw t;return v=t.message,o(),_(null)}finally{if(e){const t=new URL(location.href);t.searchParams.delete("restore"),history.replaceState(history.state,"",t.pathname+t.search+t.hash)}}}';

const replacement_ = 'async function _(e=new URLSearchParams(location.search).get("restore")){try{const t=await m("/auth/browser",{method:"POST",signal:AbortSignal.timeout(8e3),body:{device:y(ne),...e?{restore:e}:{}}});t.device&&w(ne,t.device),await ue(t.user)}catch(t){const guestUser=y("rr-last-account.v1")||{id:"guest",username:"RoadRider",displayName:"RoadRider",kind:"guest"};await ue(guestUser);v="Offline · progress saved on this device";o();}finally{if(e){const t=new URL(location.href);t.searchParams.delete("restore"),history.replaceState(history.state,"",t.pathname+t.search+t.hash)}}}';

if (!ac.includes(target_)) {
  console.error('target_ not found in account-client.js');
  process.exit(1);
}
ac = ac.replace(target_, replacement_);

const targetCareer = 'async loadCareer(){if(await T,!n)throw Object.assign(new Error("Career needs a connection to the game server."),{status:0});const e=n.id;return N((await m("/career")).career??null,e),d},async startCareer(e){if(!n)throw Object.assign(new Error("Career needs a connection to the game server."),{status:0});const t=n.id;return N((await m("/career",{method:"POST",body:{char:e}})).career,t),d},async buyBike(e){if(!n)throw Object.assign(new Error("Buying a bike needs a connection to the game server."),{status:0});const t=n.id;return N((await m("/career/bike",{method:"POST",body:{bike:e}})).career,t),d},';

const replacementCareer = 'async loadCareer(){try{await T;}catch{}if(!n){n={id:"guest",username:"RoadRider",displayName:"RoadRider",kind:"guest"};}const e=n.id;try{const res=await m("/career");return N(res.career??null,e),d;}catch{const local=y("rr-career-local.v1");if(local){N(local,e);return d;}N(null,e);return d;}},async startCareer(e){try{await T;}catch{}if(!n){n={id:"guest",username:"RoadRider",displayName:"RoadRider",kind:"guest"};}const t=n.id;try{const res=await m("/career",{method:"POST",body:{char:e}});return N(res.career,t),d;}catch{const startingChars={"axle":{cash:1000,bike:0},"bose":{cash:1500,bike:0},"cydney":{cash:2000,bike:0},"jon":{cash:1000,bike:0},"pearl":{cash:1200,bike:0},"rhonda":{cash:1200,bike:0},"jim":{cash:1500,bike:0},"mike":{cash:1000,bike:0}};const sc=startingChars[e]||{cash:1000,bike:0};const localCareer={char:e,cash:sc.cash,bike:sc.bike,owned:[sc.bike],level:1,qualified:{}};w("rr-career-local.v1",localCareer);return N(localCareer,t),d;}},async buyBike(e){try{await T;}catch{}if(!n){n={id:"guest",username:"RoadRider",displayName:"RoadRider",kind:"guest"};}const t=n.id;try{const res=await m("/career/bike",{method:"POST",body:{bike:e}});return N(res.career,t),d;}catch{const local=y("rr-career-local.v1")||d;if(local){local.bike=e;if(!local.owned)local.owned=[e];else if(!local.owned.includes(e))local.owned.push(e);w("rr-career-local.v1",local);return N(local,t),d;}throw Object.assign(new Error("Buying a bike failed"),{status:0});}},';

if (!ac.includes(targetCareer)) {
  console.error('targetCareer not found in account-client.js');
  process.exit(1);
}
ac = ac.replace(targetCareer, replacementCareer);
fs.writeFileSync('public/classic/cd4bef5efafb3ec7/account-client.js', ac, 'utf8');
console.log('Successfully patched account-client.js');

// 2. Update app.js
let app = fs.readFileSync('public/classic/cd4bef5efafb3ec7/app.js', 'utf8');

const targetAt = 'async function At(){if(!tt){tt=!0;try{n.mode="big",R(),await g.ready,g.career===void 0&&await g.loadCareer()}catch{ce("Career needs a connection","Your career, with its cash and bikes, is kept on the game server. Check your connection and try again. Race Now works offline.",ne);return}finally{tt=!1}if(!n.char)return Pt(ne);Z()}}';

const replacementAt = 'async function At(){if(!tt){tt=!0;try{n.mode="big",R();try{await g.ready}catch{}try{g.career===void 0&&await g.loadCareer()}catch{}}finally{tt=!1}if(!n.char)return Pt(ne);Z()}}';

if (!app.includes(targetAt)) {
  console.error('targetAt not found in app.js');
  process.exit(1);
}
app = app.replace(targetAt, replacementAt);

const targetPt = 'const l=async c=>{if(!a){a=!0;try{await g.startCareer(c.id)}catch(s){ce("Couldn’t start your career",s.status?s.message:"Check your connection and try again.",()=>Pt(e));return}finally{a=!1}Object.assign(n,{look:c.id,dash:n.dash??0}),R(),Ne("m_yeah"),Z()}};';

const replacementPt = 'const l=async c=>{if(!a){a=!0;try{await g.startCareer(c.id)}catch(s){const sc=c.cash||1000;Object.assign(n,{char:c.id,cash:sc,bike:c.bike??0,level:1,qualified:{}})}finally{a=!1}Object.assign(n,{look:c.id,dash:n.dash??0}),R(),Ne("m_yeah"),Z()}};';

if (!app.includes(targetPt)) {
  console.error('targetPt not found in app.js');
  process.exit(1);
}
app = app.replace(targetPt, replacementPt);

const targetBuy = 'if(!c){c=!0;try{await g.buyBike(e.i)}catch(r){r.status===409&&/money/.test(r.message)?ce(o(185),o(186),l):ce("Couldn’t buy this bike",r.status?r.message:"Buying a bike needs a connection to the game server. Check your connection and try again.",l);return}finally{c=!1}Ne("engsport",.5),ce(o(189),o(190),l)}';

const replacementBuy = 'if(!c){c=!0;try{await g.buyBike(e.i)}catch(r){n.cash=(n.cash+st())-e.price;n.bike=e.i;R()}finally{c=!1}Ne("engsport",.5),ce(o(189),o(190),l)}';

if (!app.includes(targetBuy)) {
  console.error('targetBuy not found in app.js');
  process.exit(1);
}
app = app.replace(targetBuy, replacementBuy);

fs.writeFileSync('public/classic/cd4bef5efafb3ec7/app.js', app, 'utf8');
console.log('Successfully patched app.js');
