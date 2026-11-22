// Optional same-device controls. Map laptop keys to the original Player 2
// keyboard bindings; the original game still performs aiming and shooting.
const aliases = new Map([[0x11, 0xc8], [0x1e, 0xcb], [0x1f, 0xd0],
  [0x20, 0xcd], [0x21, 0x52], [0x22, 0x51]]);

export function createLocalCoopInput(send) {
  const held = new Set();
  const forward = command => {
    if (command.kind !== 'key') {
      if (command.kind === 'active' && !command.active) held.clear();
      send(command);
      return;
    }
    const target = aliases.get(command.scan) ?? command.scan;
    const isDown = () => [...held].some(scan => (aliases.get(scan) ?? scan) === target);
    const before = isDown();
    if (command.pressed) held.add(command.scan); else held.delete(command.scan);
    const after = isDown();
    // Releasing an alias cannot release a still-held native binding.
    if (before !== after) send({ ...command, scan: target, pressed: after });
  };
  forward.startPlayer2 = () => {
    // A toolbar pulse must not release an Enter key held on the keyboard.
    if (held.has(0x1c)) return false;
    send({ kind: 'key', scan: 0x1c, pressed: true });
    send({ kind: 'key', scan: 0x1c, pressed: false });
    return true;
  };
  return forward;
}
