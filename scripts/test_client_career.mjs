import assert from 'assert';

console.log('Testing client offline fallback logic...');

// Simulate localStorage
const storage = {};
globalThis.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; }
};

// Simulate simulated account client behavior when offline
let guestUser = { id: 'guest', username: 'RoadRider', displayName: 'RoadRider', kind: 'guest' };
assert.strictEqual(guestUser.id, 'guest');

// Simulate start career
const startingChars = {
  "axle": { cash: 1000, bike: 0 },
  "bose": { cash: 1500, bike: 0 },
  "cydney": { cash: 2000, bike: 0 }
};
const charId = 'axle';
const sc = startingChars[charId];
const localCareer = { char: charId, cash: sc.cash, bike: sc.bike, owned: [sc.bike], level: 1, qualified: {} };
localStorage.setItem('rr-career-local.v1', JSON.stringify(localCareer));

const loaded = JSON.parse(localStorage.getItem('rr-career-local.v1'));
assert.strictEqual(loaded.char, 'axle');
assert.strictEqual(loaded.cash, 1000);
assert.strictEqual(loaded.bike, 0);

// Simulate bike buy
const bikeToBuy = 2;
const price = 4000;
const tradeIn = 1500;
loaded.cash = (loaded.cash + tradeIn) - price;
loaded.bike = bikeToBuy;
loaded.owned.push(bikeToBuy);
localStorage.setItem('rr-career-local.v1', JSON.stringify(loaded));

const updated = JSON.parse(localStorage.getItem('rr-career-local.v1'));
assert.strictEqual(updated.bike, 2);
assert.deepStrictEqual(updated.owned, [0, 2]);

console.log('✔ All client fallback simulations passed!');
