import { validateNetworkPacket, PEER_CREATED, PEER_DESTROYED } from './network-protocol.js';

// The worker remains the only owner of guest memory. Transport messages enter
// between interpreter slices and cannot invoke or patch the guest directly.
export function createWorkerNetwork(config, post, { now = () => performance.now() } = {}) {
  if (!config || ![1, 2].includes(config.role) || !Number.isInteger(config.generation) ||
      config.generation < 1 || config.generation > 0xffffffff) throw Error('Invalid network session configuration');
  const { role, generation } = config;
  const incomingContext = { generation, remoteId: 3 - role, localId: role };
  const outgoingContext = { generation, remoteId: role, localId: 3 - role };
  let module, pointer = 0, incoming = [], started = false, cancelled = false, resolveStart;
  let lastStatusCheck = -Infinity, statusDirty = false, observedOpen = false;
  const barrier = new Promise(resolve => { resolveStart = resolve; });
  const check = code => {
    if (code !== 0) throw Error(module.UTF8ToString(module._vcop2_result_json()) || 'Network runtime rejected a packet');
  };
  function checkSessionClosed() {
    const time = now();
    if (!Number.isFinite(time)) throw Error('Invalid network status clock');
    if (!statusDirty && time - lastStatusCheck < 250) return;
    lastStatusCheck = time; statusDirty = false;
    const raw = module._vcop2_network_status_json();
    if (!raw) throw Error('Could not read the multiplayer connection status');
    const status = JSON.parse(module.UTF8ToString(raw));
    if (!status || status.configured !== true || status.generation !== generation || status.localId !== role ||
        typeof status.open !== 'boolean' || typeof status.playerCreated !== 'boolean' ||
        !Array.isArray(status.calls) || status.calls.length > 32)
      throw Error('The multiplayer connection status changed unexpectedly');
    // The lobby starts unopened. Only an observed transition or the actual
    // successful Close call proves that the original guest ended its session.
    const closed = !status.open && !status.playerCreated && (observedOpen ||
      status.calls.some(call => call === 'DP2.Close:0x0' || call === 'DP1.Close:0x0'));
    observedOpen ||= status.open;
    if (closed) {
      cancelled = true; incoming = []; resolveStart();
      throw Error('The original game ended the multiplayer connection. Create or join a new room to play again.');
    }
  }
  return {
    configure(value) {
      if (module || cancelled) throw Error('Network worker cannot be configured twice');
      module = value;
      for (const name of ['configure','receive','drain_json','disconnect','status_json'])
        if (typeof module[`_vcop2_network_${name}`] !== 'function') throw Error('Rebuild the runtime for multiplayer support');
      check(module._vcop2_network_configure(role, generation));
      pointer = module._malloc(4096);
      if (!pointer) throw Error('Cannot allocate network receive buffer');
    },
    async ready() {
      if (!module) throw Error('Network worker is not prepared');
      post({ type: 'network-ready' });
      await barrier;
      if (cancelled) throw Error('Network session cancelled');
    },
    start() { if (!cancelled) { started = true; resolveStart(); } },
    receive(packet) {
      if (cancelled) return;
      if (incoming.length >= 256) throw Error('Network receive queue limit exceeded');
      incoming.push(validateNetworkPacket(packet, incomingContext));
    },
    flush() {
      if (!module || !started || cancelled) return;
      for (const packet of incoming) {
        module.HEAPU8.set(packet.data, pointer);
        check(module._vcop2_network_receive(generation, packet.from, packet.to, packet.flags, pointer, packet.data.length));
        statusDirty ||= packet.flags === PEER_CREATED || packet.flags === PEER_DESTROYED;
      }
      incoming = [];
    },
    drain() {
      if (!module || !started || cancelled) return;
      const raw = module._vcop2_network_drain_json();
      if (!raw) throw Error('Could not read outgoing game packets');
      const packets = JSON.parse(module.UTF8ToString(raw));
      if (!Array.isArray(packets) || packets.length > 256) throw Error('Invalid outgoing network queue');
      for (const packet of packets) {
        if (!Array.isArray(packet.data) || packet.data.length > 4096 ||
            !packet.data.every(n => Number.isInteger(n) && n >= 0 && n <= 255)) throw Error('Invalid outgoing game payload');
        const message = validateNetworkPacket({ ...packet, data: Uint8Array.from(packet.data) }, outgoingContext);
        post({ type: 'network-packet', packet: message }, [message.data.buffer]);
        statusDirty ||= message.flags === PEER_CREATED || message.flags === PEER_DESTROYED;
      }
      checkSessionClosed();
    },
    cancel() { cancelled = true; incoming = []; resolveStart(); },
    close() {
      this.cancel();
      if (module && pointer) { module._free(pointer); pointer = 0; }
    },
  };
}
