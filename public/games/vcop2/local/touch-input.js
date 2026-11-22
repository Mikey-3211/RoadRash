// Supported, hash-verified PPJ2DD.EXE only. Read the original aim and send
// ordinary relative mouse input; never write gameplay state or bypass hit tests.
export function touchAction(module) {
  const phase = module._vcop2_guest_read_scalar(0x4cf1b4, 2);
  const substate = module._vcop2_guest_read_scalar(0x4cf120, 2);
  if (![phase, substate].every(n => Number.isInteger(n) && n >= 0 && n <= 65535))
    throw Error('Mobile action could not read the original menu state.');
  // Intro/title/attract accept Start. In the mode menu Start confirms;
  // the original reload button would instead cancel back to the title.
  if (phase <= 6) return { label: 'ok', button: 2 };
  // Confirm the existing stage cursor without moving it to screen center.
  if (phase === 7 && (substate & 31) === 2) return { label: 'ok', button: 0 };
  return { label: 'reload', button: 1 };
}

export function touchAimDelta(module, x, y, localPlayer = 1) {
  if (![1, 2].includes(localPlayer)) throw Error('Invalid local player for touch aiming');
  const read = (address) => {
    const value = module._vcop2_guest_read_scalar(address, 2);
    if (!Number.isInteger(value) || value < 0 || value > 65535)
      throw Error('Touch aiming could not read the original input state.');
    return value;
  };
  // The Arcade stage selector (2) uses the same initialized aim and hit-test
  // coordinates as gameplay (9). Move to the tap before its fire edge.
  // Title/mode screens and transition states may not have initialized aiming.
  if (read(0x4cf1b4) !== 7 || ![2, 9].includes(read(0x4cf120) & 31)) return { dx: 0, dy: 0 };
  const signed = value => (value << 16) >> 16;
  const sensitivity = read(localPlayer === 2 ? 0x52bbd1 : 0x52bbd0) & 255;
  const multiplier = (read(0x4d426a) & 255) + 1;
  if (!sensitivity || sensitivity > 32 || multiplier > 32)
    throw Error('Unsupported original mouse sensitivity for touch aiming.');
  // The joining peer owns Player 2 in gameplay and the Arcade stage selector.
  const offset = localPlayer === 2 ? 0x50 : 0;
  // The reset cursor is drawn at a different origin from the relative-mouse
  // integrator (+8,+4). Read its grid and subcell position rather than using
  // that displayed aim as the base for the first movement. See the verified
  // profile evidence in docs/network-protocol.md.
  const axis = (target, grid, remainder, origin, displayed) => {
    const position = signed(read(grid + offset)) * 8 + signed(read(remainder + offset)) - origin;
    let delta = Math.round((target - position) * sensitivity / multiplier);
    // A zero movement leaves the reset coordinate untouched in the original
    // handler. Request the smallest device movement when an otherwise exact
    // grid target still has a stale displayed aim; ordinary native quantization
    // remains in force and no guest state is rewritten.
    const visible = signed(read(displayed + offset));
    if (delta === 0 && Math.abs(position - visible) > 1 && Math.abs(target - position) < 1)
      delta = Math.sign(target - visible) * Math.max(1, Math.ceil(sensitivity / multiplier));
    return delta;
  };
  return {
    dx: axis(x / 2 - 160, 0x52b900, 0x52b908, 168, 0x52b904),
    dy: axis(y / 2 - 120, 0x52b902, 0x52b90a, 112, 0x52b906),
  };
}

export function connectTouchInput(canvas, input, { page = document, view = globalThis,
  isPlaying = () => true, onTouch = () => {} } = {}) {
  let pointer, origin;
  const touch = event => event.pointerType === 'touch' || event.pointerType === 'pen';
  const cancel = () => { pointer = undefined; origin = undefined; };
  canvas.addEventListener('pointerdown', event => {
    if (!touch(event) || !isPlaying()) return;
    onTouch(); event.preventDefault();
    if (pointer !== undefined || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
    pointer = event.pointerId; origin = [event.clientX, event.clientY];
    // Touch pointers have implicit capture. Page-level release also handles
    // browsers that release outside the canvas; no mouse lock is requested.
  });
  const finish = event => {
    if (!touch(event) || event.pointerId !== pointer) return;
    const start = origin; cancel(); event.preventDefault();
    if (!isPlaying() || page.hidden || page.hasFocus?.() === false) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    // Releasing outside the displayed game cancels rather than shooting an edge.
    if (x < 0 || x >= 1 || y < 0 || y >= 1) return;
    const dx = event.clientX - start[0], dy = event.clientY - start[1];
    if (Math.hypot(dx, dy) >= 24) {
      input.moveTouch(Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) * 100 : 0,
        Math.abs(dy) > Math.abs(dx) ? Math.sign(dy) * 100 : 0);
    } else input.tapAt(Math.floor(x * 640), Math.floor(y * 480));
  };
  canvas.addEventListener('pointerup', finish);
  page.addEventListener('pointerup', finish);
  for (const name of ['pointercancel', 'lostpointercapture']) canvas.addEventListener(name, event => {
    if (event.pointerId === pointer) cancel();
  });
  canvas.addEventListener('blur', cancel);
  view.addEventListener('blur', cancel);
  view.addEventListener('resize', cancel);
  page.addEventListener('visibilitychange', () => { if (page.hidden) cancel(); });
  return { cancel };
}
