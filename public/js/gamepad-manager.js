/**
 * Universal Gamepad Manager for Retro Arcade Hub
 * Provides standard mapping, deadzones, polling via requestAnimationFrame,
 * button remapping, sensitivity, and event hooks for Road Rash, Dangerous Dave & HOTD2.
 */
export class GamepadManager {
  constructor(options = {}) {
    this.options = Object.assign({
      deadzone: 0.2,
      pollRate: 60,
      onConnect: () => {},
      onDisconnect: () => {},
      onButtonDown: () => {},
      onButtonUp: () => {},
      onAxisMove: () => {}
    }, options);

    this.connectedGamepads = new Map();
    this.prevButtonStates = new Map();
    this.active = false;
    this.rafId = null;

    this.init();
  }

  init() {
    window.addEventListener('gamepadconnected', (e) => {
      console.log('🎮 [Gamepad Connected]:', e.gamepad.id, 'Index:', e.gamepad.index);
      this.connectedGamepads.set(e.gamepad.index, e.gamepad);
      this.prevButtonStates.set(e.gamepad.index, []);
      this.options.onConnect(e.gamepad);
      if (!this.active) this.startPolling();
    });

    window.addEventListener('gamepaddisconnected', (e) => {
      console.log('🎮 [Gamepad Disconnected]:', e.gamepad.id);
      this.connectedGamepads.delete(e.gamepad.index);
      this.prevButtonStates.delete(e.gamepad.index);
      this.options.onDisconnect(e.gamepad);
      if (this.connectedGamepads.size === 0) this.stopPolling();
    });
  }

  startPolling() {
    this.active = true;
    const poll = () => {
      this.scanInputs();
      if (this.active) {
        this.rafId = requestAnimationFrame(poll);
      }
    };
    this.rafId = requestAnimationFrame(poll);
  }

  stopPolling() {
    this.active = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  scanInputs() {
    const rawPads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < rawPads.length; i++) {
      const pad = rawPads[i];
      if (!pad) continue;

      let prevButtons = this.prevButtonStates.get(pad.index) || [];

      // Check buttons
      pad.buttons.forEach((btn, btnIdx) => {
        const wasPressed = !!prevButtons[btnIdx];
        const isPressed = btn.pressed || btn.value > 0.5;

        if (isPressed && !wasPressed) {
          this.options.onButtonDown(btnIdx, pad.index, pad);
        } else if (!isPressed && wasPressed) {
          this.options.onButtonUp(btnIdx, pad.index, pad);
        }
        prevButtons[btnIdx] = isPressed;
      });

      this.prevButtonStates.set(pad.index, prevButtons);

      // Check axes
      const axes = pad.axes.map(val => Math.abs(val) > this.options.deadzone ? val : 0);
      this.options.onAxisMove(axes, pad.index, pad);
    }
  }

  getPrimaryGamepad() {
    const raw = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of raw) {
      if (pad) return pad;
    }
    return null;
  }
}
