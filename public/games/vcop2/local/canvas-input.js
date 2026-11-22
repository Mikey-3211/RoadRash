// Physical keys only: layout-dependent characters are never synthesized.
const scanCodes = new Map([
  ["Escape",0x01], ["Minus",0x0c], ["Equal",0x0d], ["Backspace",0x0e], ["Tab",0x0f],
  ["BracketLeft",0x1a], ["BracketRight",0x1b], ["Enter",0x1c], ["ControlLeft",0x1d],
  ["Semicolon",0x27], ["Quote",0x28], ["Backquote",0x29], ["ShiftLeft",0x2a], ["Backslash",0x2b],
  ["Comma",0x33], ["Period",0x34], ["Slash",0x35], ["ShiftRight",0x36], ["NumpadMultiply",0x37],
  ["AltLeft",0x38], ["Space",0x39], ["CapsLock",0x3a], ["NumLock",0x45], ["ScrollLock",0x46],
  ["Numpad7",0x47], ["Numpad8",0x48], ["Numpad9",0x49], ["NumpadSubtract",0x4a],
  ["Numpad4",0x4b], ["Numpad5",0x4c], ["Numpad6",0x4d], ["NumpadAdd",0x4e],
  ["Numpad1",0x4f], ["Numpad2",0x50], ["Numpad3",0x51], ["Numpad0",0x52], ["NumpadDecimal",0x53],
  ["IntlBackslash",0x56], ["F11",0x57], ["F12",0x58], ["NumpadEnter",0x9c], ["ControlRight",0x9d],
  ["NumpadDivide",0xb5], ["AltRight",0xb8], ["Home",0xc7], ["ArrowUp",0xc8], ["PageUp",0xc9],
  ["ArrowLeft",0xcb], ["ArrowRight",0xcd], ["End",0xcf], ["ArrowDown",0xd0], ["PageDown",0xd1],
  ["Insert",0xd2], ["Delete",0xd3],
]);
for (const [letters, first] of [["QWERTYUIOP",0x10],["ASDFGHJKL",0x1e],["ZXCVBNM",0x2c]])
  [...letters].forEach((key, i) => scanCodes.set(`Key${key}`, first + i));
for (let i = 0; i < 10; i++) {
  scanCodes.set(`Digit${(i + 1) % 10}`, 0x02 + i);
  scanCodes.set(`F${i + 1}`, 0x3b + i);
}
const mouseButtons = new Map([[0, 0], [2, 1], [1, 2], [3, 3]]);
const buttonMasks = [[1, 0], [2, 1], [4, 2], [8, 3]];

export function connectCanvasInput(canvas, send, page = document, view = globalThis, captureChanged = () => {}) {
  let enabled = false, windowFocused = page.hasFocus?.() ?? true;
  let captureWanted = false, capturePending = false, captureGeneration = 0, wasLocked = false;
  let startKeyHeld = false, startPulseHeld = false, startTimer;
  let activationClickHeld = false;
  const keys = new Set(), buttons = new Set();
  const physicalButtons = new Set();
  const focused = () => enabled && windowFocused && !page.hidden && page.activeElement === canvas;
  const activate = () => {
    if (!enabled || page.hidden) return false;
    // A window/tab may regain focus without delivering the expected view focus
    // event. A real user gesture must re-read document focus rather than trust
    // the cached blur state. focus() alone also emits nothing on an active canvas.
    windowFocused = page.hasFocus?.() ?? windowFocused;
    canvas.focus({ preventScroll: true });
    if (!focused()) return false;
    send({ kind: "active", active: true });
    return true;
  };
  const locked = () => page.pointerLockElement === canvas;
  const captureSupported = () => typeof canvas.requestPointerLock === "function" && typeof page.exitPointerLock === "function";
  const captureStatus = (message) => captureChanged({ enabled, locked: locked(), pending: capturePending,
    supported: captureSupported(), message: message || (!enabled ? "Mouse capture is available while a run is active." :
      !captureSupported() ? "Mouse capture is unavailable in this browser. Normal canvas input still works." :
      locked() ? "Mouse captured. Press Escape to release." : "Mouse free. Capture it for continuous relative aiming.") });
  const release = () => {
    if (startTimer !== undefined) view.clearTimeout(startTimer);
    startTimer = undefined; startKeyHeld = false; startPulseHeld = false;
    keys.clear(); buttons.clear(); physicalButtons.clear(); activationClickHeld = false;
    if (enabled) send({ kind: "active", active: false });
  };
  const releaseCapture = () => {
    captureWanted = false; capturePending = false; captureGeneration++;
    if (locked()) page.exitPointerLock?.();
    captureStatus();
  };
  const loseFocus = () => { release(); releaseCapture(); };
  page.addEventListener?.("pointerlockchange", () => {
    if (locked()) {
      // A request may finish after Stop, blur, or a new session. Never accept
      // a delayed lock unless the current user request is still wanted.
      if (!captureWanted || !focused()) { releaseCapture(); return; }
      capturePending = false; wasLocked = true;
    } else {
      const released = wasLocked;
      wasLocked = false; captureWanted = false; capturePending = false; captureGeneration++;
      if (released) {
        release();
        if (focused()) send({ kind: "active", active: true });
      }
    }
    captureStatus();
  });
  const captureFailed = () => {
    if (!capturePending) return;
    captureWanted = false; capturePending = false;
    captureStatus("Mouse capture was denied or could not start. Normal canvas input still works; click Capture mouse to retry.");
  };
  page.addEventListener?.("pointerlockerror", captureFailed);
  // Pointer Events send chord changes as pointermove, with pointerdown/up only
  // for the first press and last release. Reconcile every complete button mask.
  const updateButton = (button) => {
    const pressed = physicalButtons.has(button) || (button === 2 && (startKeyHeld || startPulseHeld));
    if (pressed === buttons.has(button)) return;
    if (pressed) buttons.add(button); else buttons.delete(button);
    send({ kind: "button", button, pressed });
  };
  const syncButtons = (mask) => {
    if (!Number.isInteger(mask) || mask < 0) return;
    if (!(mask & 1)) activationClickHeld = false;
    for (const [bit, button] of buttonMasks) {
      const pressed = Boolean(mask & bit) && !(button === 0 && activationClickHeld);
      if (pressed) physicalButtons.add(button); else physicalButtons.delete(button);
      updateButton(button);
    }
  };
  canvas.tabIndex = 0;
  // A denied capture can leave the release outside the canvas. Observe that
  // release too, so the next ordinary click is never mistaken for re-entry.
  page.addEventListener?.("mouseup", (event) => {
    if (event.button === 0) activationClickHeld = false;
  });
  for (const name of ["pointerup", "pointermove"]) page.addEventListener?.(name, (event) => {
    if (event.pointerType === "mouse" && Number.isInteger(event.buttons) && !(event.buttons & 1))
      activationClickHeld = false;
  });
  canvas.addEventListener("focus", () => { if (focused()) send({ kind: "active", active: true }); });
  canvas.addEventListener("blur", loseFocus);
  view.addEventListener?.("blur", () => { windowFocused = false; loseFocus(); });
  view.addEventListener?.("focus", () => { windowFocused = true; if (focused()) send({ kind: "active", active: true }); });
  page.addEventListener?.("visibilitychange", () => {
    if (page.hidden) loseFocus();
    else {
      windowFocused = page.hasFocus?.() ?? windowFocused;
      if (focused()) send({ kind: "active", active: true });
    }
  });
  for (const down of [true, false]) canvas.addEventListener(down ? "keydown" : "keyup", (event) => {
    // Escape remains a browser release gesture, never a guest key while locked.
    if (event.code === "Escape" && (locked() || capturePending)) {
      if (down) releaseCapture();
      return;
    }
    // An accessible P1 shortcut feeds the same original mouse Start button.
    // Keep sources independent so releasing P cannot release a held wheel.
    if (event.code === "KeyP") {
      if (!focused() || (down && (event.ctrlKey || event.altKey || event.metaKey))) return;
      event.preventDefault();
      startKeyHeld = down; updateButton(2); return;
    }
    const scan = scanCodes.get(event.code);
    if (!focused() || scan === undefined || (down && (event.ctrlKey || event.altKey || event.metaKey))) return;
    event.preventDefault();
    if (down && keys.has(scan)) return;
    if (!down && !keys.has(scan)) return;
    if (down) keys.add(scan); else keys.delete(scan);
    send({ kind: "key", scan, pressed: down });
  });
  canvas.addEventListener("pointerdown", (event) => {
    if (!enabled || locked() || event.pointerType !== "mouse") return;
    if (!activate()) return;
    const button = mouseButtons.get(event.button);
    if (!focused() || button === undefined) return;
    event.preventDefault();
    try { canvas.setPointerCapture?.(event.pointerId); }
    catch (error) {
      // A browser may reject capture when its active pointer/lock state changes
      // during activation. Focused canvas button input must still be delivered.
      if (!["InvalidStateError", "NotFoundError"].includes(error.name)) throw error;
    }
    syncButtons(event.buttons);
  });
  canvas.addEventListener("pointerup", (event) => {
    if (!focused() || locked() || event.pointerType !== "mouse") return;
    event.preventDefault(); syncButtons(event.buttons);
  });
  const releaseButtons = () => {
    physicalButtons.clear();
    for (const button of [...buttons]) updateButton(button);
  };
  canvas.addEventListener("pointercancel", () => { if (!locked()) releaseButtons(); });
  canvas.addEventListener("lostpointercapture", () => { if (!locked()) releaseButtons(); });
  const move = (event) => {
    syncButtons(event.buttons);
    const dx = Math.trunc(event.movementX), dy = Math.trunc(event.movementY);
    if (Number.isFinite(dx) && Number.isFinite(dy) && (dx || dy)) send({ kind: "mouse", dx, dy, wheel: 0 });
  };
  canvas.addEventListener("pointermove", (event) => {
    if (focused() && !locked() && event.pointerType === "mouse") move(event);
  });
  // Pointer Lock guarantees MouseEvents. Use only this stream while locked,
  // avoiding duplicate deltas from accompanying PointerEvents.
  canvas.addEventListener("mousemove", (event) => { if (focused() && locked()) move(event); });
  for (const name of ["mousedown", "mouseup"]) canvas.addEventListener(name, (event) => {
    if (!focused() || !locked()) return;
    event.preventDefault(); syncButtons(event.buttons);
  });
  canvas.addEventListener("wheel", (event) => {
    if (!focused()) return;
    const wheel = -Math.sign(event.deltaY) * 120;
    if (wheel) { event.preventDefault(); send({ kind: "mouse", dx: 0, dy: 0, wheel }); }
  }, { passive: false });
  canvas.addEventListener("contextmenu", (event) => { if (focused()) event.preventDefault(); });
  return {
    focusGame: activate,
    tapAt(x, y) {
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= 640 || y < 0 || y >= 480 || !activate()) return false;
      send({ kind: "tap", x, y }); return true;
    },
    moveTouch(dx, dy) {
      if (![dx, dy].every(n => Number.isInteger(n) && Math.abs(n) <= 100) || !activate()) return false;
      send({ kind: "mouse", dx, dy, wheel: 0 }); return true;
    },
    reload() {
      if (!activate()) return false;
      send({ kind: "button", button: 1, pressed: true });
      send({ kind: "button", button: 1, pressed: false });
      return true;
    },
    mobileAction() {
      if (!activate()) return false;
      send({ kind: 'mobile-action' }); return true;
    },
    enable() { enabled = true; if (focused()) send({ kind: "active", active: true }); captureStatus(); },
    disable() { release(); enabled = false; releaseCapture(); },
    suppressActivationClick() {
      if (!enabled) return;
      // Keep aim and other buttons live while the consumed re-entry click is
      // held. Mouse movement must not synthesize a shot from its button mask.
      activationClickHeld = true;
      physicalButtons.delete(0); updateButton(0);
    },
    startPlayer1() {
      if (!enabled || startPulseHeld) return false;
      if (!activate()) return false;
      // A DOM click's down/up can both arrive before a guest device poll.
      // Hold this explicit UI action briefly; the guest still handles Start.
      startPulseHeld = true; updateButton(2);
      startTimer = view.setTimeout(() => {
        startTimer = undefined; startPulseHeld = false; updateButton(2);
      }, 150);
      return true;
    },
    async captureMouse() {
      if (!activate() || capturePending || locked()) return;
      if (!captureSupported()) { captureStatus(); return; }
      captureWanted = true; capturePending = true;
      const generation = ++captureGeneration;
      captureStatus("Requesting mouse capture… Press Escape to release once captured.");
      // Call synchronously within the button gesture. Older implementations
      // return void; success/failure events remain authoritative in both forms.
      try { await canvas.requestPointerLock(); }
      catch { if (generation === captureGeneration) captureFailed(); }
    },
  };
}
