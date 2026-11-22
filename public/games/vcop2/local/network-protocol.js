// Wire contract for the supported original EXE/DPCTRL profile. See
// docs/network-protocol.md before extending this allowlist.
export const MAX_NETWORK_PACKET_BYTES = 52;
export const PEER_CREATED = 0x80000000;
export const PEER_DESTROYED = 0x80000001;

const lengths = new Map([
  [1, 32], [2, 8], [3, 16], [5, 8], [6, 4], [7, 4], [8, 4],
  [0x15, 4], [0x16, 8], [0x18, 8],
  [0x20, 52], [0x21, 24], [0x22, 16], [0x23, 16], [0x24, 16], [0x26, 16],
]);
const u32 = n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff;
const requirePacket = (condition, reason) => {
  if (!condition) throw Error(`Invalid network packet: ${reason}`);
};

/** Validate an inbound packet; outbound callers reverse localId/remoteId.
 * Membership and connection state belong to the caller. No bytes are repaired,
 * rewritten or delivered to guest memory by this function.
 */
export function validateNetworkPacket(packet, { generation, remoteId, localId } = {}) {
  requirePacket(u32(generation) && generation !== 0 &&
    [1, 2].includes(remoteId) && localId === 3 - remoteId, 'invalid session context');
  requirePacket(packet && typeof packet === 'object', 'missing envelope');
  requirePacket(packet.generation === generation, 'stale session generation');
  requirePacket(packet.from === remoteId, 'unexpected sender');
  requirePacket(packet.to === 0 || packet.to === localId, 'unexpected destination');
  requirePacket([0, 1, PEER_CREATED, PEER_DESTROYED].includes(packet.flags), 'unsupported flags');
  requirePacket(packet.data instanceof Uint8Array && packet.data.length <= MAX_NETWORK_PACKET_BYTES,
    'payload must be a bounded Uint8Array');
  // Copy first so later mutation of a caller-owned view cannot change an
  // already-validated payload. Buffer.slice() would retain shared storage.
  const data = new Uint8Array(packet.data);
  if (packet.flags === PEER_CREATED || packet.flags === PEER_DESTROYED) {
    requirePacket(data.length === 0 && packet.to === localId, 'invalid membership control');
  } else {
    requirePacket(data.length >= 4, 'missing application type');
    const view = new DataView(data.buffer);
    const type = view.getUint32(0, true);
    requirePacket(lengths.has(type), `unsupported application type ${type}`);
    requirePacket(data.length === lengths.get(type), `type ${type} has incorrect length`);
    const word = offset => view.getUint32(offset, true);
    if (type === 1 || type === 2)
      requirePacket(word(4) < 64, 'input ring slot is outside 0–63');
    if (type === 3) {
      requirePacket(word(4) === data.length, 'name length does not match payload');
      const expected = `Player ${remoteId}`;
      requirePacket(data.subarray(8).every((byte, i) => byte === expected.charCodeAt(i)),
        'unexpected player name');
    }
    if (type === 5)
      requirePacket(word(4) >= 1 && word(4) < 64, 'buffer lead is outside 1–63');
    if (type === 0x16)
      requirePacket(word(4) === 0, 'unexpected probe argument');
    if (type === 0x18)
      requirePacket(word(4) === 0xc351, 'unsupported remote window command');
    if (type >= 0x20) {
      requirePacket(word(4) === data.length, 'application length does not match payload');
      if (type === 0x20) {
        requirePacket(remoteId === 1, 'settings must originate from the host');
        requirePacket(word(12) >= 1 && word(12) <= 2, 'invalid game setting');
        const credits = view.getInt32(16, true);
        requirePacket(credits >= -1 && credits <= 9, 'invalid credit setting');
        for (const offset of [20, 24, 28, 32])
          requirePacket(word(offset) <= 1, 'invalid boolean setting');
        for (const offset of [36, 40])
          requirePacket(word(offset) <= 30, 'invalid player setting');
        for (const offset of [44, 48])
          requirePacket(word(offset) <= 9, 'invalid player life setting');
      }
      if (type === 0x26) {
        requirePacket(remoteId === 2, 'settings reply must originate from the joining player');
        requirePacket(word(8) <= 1, 'invalid settings reply flag');
      }
    }
  }
  return { generation, from: remoteId, to: packet.to, flags: packet.flags, data };
}
