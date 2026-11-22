import { validateNetworkPacket } from './network-protocol.js';

const CHANNEL_LABEL = 'vcop2-game-v1';
const MAX_PAYLOAD = 1024, HEADER_BYTES = 20, MAX_PENDING = 256;
const MAX_BUFFERED = 1024 * 1024, MAX_SIGNAL_BYTES = 96 * 1024;
const u32 = value => Number.isInteger(value) && value > 0 && value <= 0xffffffff;
// Summarize candidate transport only; never record addresses or identifiers.
const candidateKind = value => {
  const parts = value.split(/\s+/);
  return { protocol: ['udp','tcp'].includes(parts[2]?.toLowerCase()) ? parts[2].toLowerCase() : 'unknown',
    type: ['host','srflx','prflx','relay'].includes(parts[7]) ? parts[7] : 'unknown', mdns: parts[4]?.endsWith('.local') === true };
};
const recordCandidate = (kinds, value) => {
  const kind = candidateKind(value);
  if (!kinds.some(item => item.protocol === kind.protocol && item.type === kind.type && item.mdns === kind.mdns)) kinds.push(kind);
};
const roomError = (code, message) => Object.assign(Error(message), {code});
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  // A room may close before a caller asks for its connection promise.
  promise.catch(() => {});
  return { promise, resolve, reject };
};

// Compatibility with running room servers: both peers already share the random
// room code and generation. Hash them locally; never send either value to analytics.
// This ID grants no room access. New servers supply an independent random ID.
export async function legacyMatchId(code, generation, subtle = globalThis.crypto?.subtle) {
  if (typeof code !== 'string' || !/^[A-Z0-9]{6}$/.test(code) || !u32(generation)) return undefined;
  try {
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(`vcop2-match-v1:${code}:${generation}`));
    return Array.from(new Uint8Array(digest).slice(0, 16), byte => byte.toString(16).padStart(2, '0')).join('');
  } catch { return undefined; } // Optional metrics must not block joining.
}

export function encodeRoomPacket(packet) {
  if (!(packet.data instanceof Uint8Array) || packet.data.byteLength > MAX_PAYLOAD)
    throw Error('Gameplay packet exceeds the wire limit');
  const buffer = new ArrayBuffer(HEADER_BYTES + packet.data.byteLength), view = new DataView(buffer);
  for (const [index, value] of [packet.generation, packet.from, packet.to, packet.flags, packet.data.length].entries())
    view.setUint32(index * 4, value, true);
  new Uint8Array(buffer, HEADER_BYTES).set(packet.data);
  return buffer;
}

export function decodeRoomPacket(buffer) {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) :
    ArrayBuffer.isView(buffer) ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength) : null;
  if (!bytes || bytes.byteLength < HEADER_BYTES || bytes.byteLength > HEADER_BYTES + MAX_PAYLOAD)
    throw Error('Invalid gameplay wire packet');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), length = view.getUint32(16, true);
  if (length !== bytes.byteLength - HEADER_BYTES) throw Error('Gameplay packet length mismatch');
  return { generation:view.getUint32(0,true), from:view.getUint32(4,true), to:view.getUint32(8,true),
    flags:view.getUint32(12,true), data:bytes.slice(HEADER_BYTES) };
}

function iceConfiguration(value) {
  if (!Array.isArray(value) || value.length > 8) throw Error('Invalid room ICE configuration');
  return value.map(server => {
    if (!server || typeof server !== 'object') throw Error('Invalid room ICE server');
    const urls = typeof server.urls === 'string' ? [server.urls] : server.urls;
    if (!Array.isArray(urls) || !urls.length || urls.length > 4 ||
        urls.some(url => typeof url !== 'string' || url.length > 2048 || !/^(stun|stuns|turn|turns):[^\s]+$/.test(url)))
      throw Error('Invalid room ICE URL');
    const result = { urls:[...urls] };
    for (const [key, limit] of [['username',512],['credential',1024]]) {
      if (server[key] === undefined) continue;
      if (typeof server[key] !== 'string' || server[key].length > limit) throw Error('Invalid room ICE credentials');
      result[key] = server[key];
    }
    return result;
  });
}

// One room and one original-game session per client. A closed session is never
// automatically rejoined: new guests must start with a fresh room generation.
export function createRoomClient({ url, onState = () => {}, onStart = () => {}, onPacket = () => {},
  onDisconnect = () => {}, onError = () => {}, WebSocketImpl = globalThis.WebSocket,
  RTCPeerConnectionImpl = globalThis.RTCPeerConnection, setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout, timeoutMs = 20000, disconnectGraceMs = 2000,
  now = () => performance.now() } = {}) {
  const endpoint = new URL(url);
  if (!['ws:','wss:'].includes(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.hash)
    throw Error('A ws:// or wss:// room signaling URL is required');
  if (typeof WebSocketImpl !== 'function' || typeof RTCPeerConnectionImpl !== 'function')
    throw Error('This browser does not support online rooms');
  if (!Number.isFinite(timeoutMs) || timeoutMs < 100 || timeoutMs > 120000 ||
      !Number.isFinite(disconnectGraceMs) || disconnectGraceMs < 0 || disconnectGraceMs > 5000)
    throw Error('Invalid room connection timeout');
  let ws, pc, channel, membership, terminal = false, operation = false, peerPresent = false;
  let prepared = false, readySent = false, peerReady = false, started = false, opened = false, startPending = false;
  let localDescriptionSent = false, signalChain = Promise.resolve(), queuedSignals = 0, queuedSignalBytes = 0;
  let phase = 'idle', message = '', timer, disconnectTimer, pendingTransportEnd = '', recoverableDisconnect = false;
  let disconnectDeadline, failureCode = '';
  let receiveTokens = 1024, lastReceive = now();
  const assignment = deferred(), connected = deferred(), incoming = [], localCandidates = [], remoteCandidates = [];
  const stats = { sentPackets:0, receivedPackets:0, sentBytes:0, receivedBytes:0, peakBufferedAmount:0, discardedPackets:0, localCandidates:0, remoteCandidates:0, localCandidateKinds:[], remoteCandidateKinds:[] };
  const snapshot = () => ({ phase, message, code:membership?.code ?? '', role:membership?.role ?? 0,
    generation:membership?.generation ?? 0, peerPresent, peerReady, prepared, channelOpen:opened, started,
    interrupted:recoverableDisconnect, errorCode:failureCode,
    transport:'webrtc', localCandidates:stats.localCandidates, remoteCandidates:stats.remoteCandidates,
    iceState:pc?.iceConnectionState ?? 'new', gatheringState:pc?.iceGatheringState ?? 'new' });
  const emit = (next, text = '') => { phase = next; message = text; onState(snapshot()); };
  const clearTimer = () => { if (timer !== undefined) clearTimeoutFn(timer); timer = undefined; };
  const arm = (code, text) => { clearTimer(); timer = setTimeoutFn(() => fail(roomError(code,text)), timeoutMs); };
  const clearDisconnectTimer = () => {
    if (disconnectTimer !== undefined) clearTimeoutFn(disconnectTimer);
    disconnectTimer = undefined; pendingTransportEnd = ''; recoverableDisconnect = false; disconnectDeadline = undefined;
  };
  // Data-channel shutdown can beat the ordered signaling 'closed' notice to
  // this tab. Give that notice a bounded chance to identify a normal departure.
  function deferTransportEnd(code, reason, recoverable = false) {
    if (terminal || (pendingTransportEnd && !recoverableDisconnect)) return;
    if (disconnectTimer !== undefined) clearTimeoutFn(disconnectTimer);
    pendingTransportEnd = roomError(code,reason); recoverableDisconnect = recoverable;
    disconnectDeadline ??= now() + disconnectGraceMs;
    if (!recoverable) opened = false;
    disconnectTimer = setTimeoutFn(() => fail(pendingTransportEnd),Math.max(0,disconnectDeadline-now()));
    try { onState(snapshot()); } catch (error) { fail(error); }
  }
  function finish(reason, error = false) {
    if (terminal) return;
    terminal = true; clearTimer(); clearDisconnectTimer(); opened = false; startPending = false;
    incoming.length = localCandidates.length = remoteCandidates.length = 0;
    const source = reason instanceof Error ? reason : Error(String(reason || 'Room closed'));
    failureCode = error ? (typeof source.code === 'string' ? source.code : 'room-error') : '';
    // Browser RTC failures can be DOMExceptions with a read-only numeric code.
    const failure = error ? roomError(failureCode,source.message) : source;
    failure.stack = source.stack;
    failure.connection = { localCandidates:stats.localCandidates, remoteCandidates:stats.remoteCandidates,
      iceState:pc?.iceConnectionState ?? 'new', gatheringState:pc?.iceGatheringState ?? 'new',
      connectionState:pc?.connectionState ?? 'new', channelState:channel?.readyState ?? 'absent',
      signalingState:pc?.signalingState, hasRemoteDescription:Boolean(pc?.remoteDescription),
      localCandidateKinds:stats.localCandidateKinds, remoteCandidateKinds:stats.remoteCandidateKinds };
    assignment.reject(failure); connected.reject(failure);
    try { channel?.close(); } catch {}
    try { pc?.close(); } catch {}
    try { ws?.close(1000,'Room closed'); } catch {}
    try { emit(error ? 'error' : 'closed',failure.message); } catch {}
    if (error) { try { onError(failure); } catch {} }
    try { onDisconnect(failure.message); } catch {}
  }
  function fail(error) { finish(error instanceof Error ? error : Error(String(error)),true); }
  function socketSend(payload) {
    if (terminal || ws?.readyState !== 1) throw Error('Room signaling connection is closed');
    const encoded = JSON.stringify(payload);
    if (encoded.length > MAX_SIGNAL_BYTES || ws.bufferedAmount > MAX_BUFFERED)
      throw Error('Room signaling queue limit exceeded');
    ws.send(encoded);
  }
  function sessionSend(payload) {
    if (!membership) throw Error('Room assignment is not ready');
    socketSend({ ...payload, generation:membership.generation, token:membership.token });
  }
  function updateReady() {
    if (terminal || pendingTransportEnd || !membership || !opened || !prepared || readySent) return;
    sessionSend({type:'ready'}); readySent = true;
    if (!started) emit('waiting-ready','Waiting for the other player to finish loading');
  }
  function channelOpened() {
    if (terminal || opened || pendingTransportEnd && !recoverableDisconnect) return;
    opened = true; clearTimer(); connected.resolve(publicMembership());
    emit(prepared ? 'waiting-ready' : 'preparing',prepared ? 'Waiting for the other player' : 'Preparing the game');
    updateReady();
  }
  function startGame() {
    if (terminal || !startPending || pendingTransportEnd) return;
    startPending = false; started = true; emit('playing','Connected');
    if (terminal) return;
    onStart(publicMembership());
    for (const packet of incoming.splice(0)) { if (terminal) break; onPacket(packet); }
  }
  function publicMembership() {
    return {code:membership.code,role:membership.role,generation:membership.generation,
      ...(membership.matchId ? {matchId:membership.matchId} : {})};
  }
  function deliver(packet) {
    if (!started) {
      if (incoming.length >= MAX_PENDING) throw Error('Early gameplay packet queue limit exceeded');
      incoming.push(packet); return;
    }
    onPacket(packet);
  }
  function installChannel(candidate) {
    if (terminal) { candidate.close(); return; }
    if (channel || candidate.label !== CHANNEL_LABEL || candidate.ordered !== true ||
        candidate.maxRetransmits != null || candidate.maxPacketLifeTime != null)
      throw Error('Unexpected or unreliable gameplay data channel');
    channel = candidate; channel.binaryType = 'arraybuffer';
    channel.onopen = () => { try { channelOpened(); } catch (error) { fail(error); } };
    channel.onclose = () => deferTransportEnd('channel-closed','The gameplay connection closed unexpectedly. Create a new room to play again.');
    channel.onerror = () => deferTransportEnd('channel-failed','The gameplay connection failed. Check your network and create a new room.');
    channel.onmessage = event => {
      if (terminal || pendingTransportEnd && !recoverableDisconnect) return;
      try {
        const timestamp = now();
        if (recoverableDisconnect && timestamp >= disconnectDeadline) return fail(pendingTransportEnd);
        receiveTokens = Math.min(1024,receiveTokens + Math.max(0,timestamp-lastReceive)*1.024);
        lastReceive = timestamp;
        if (--receiveTokens < 0) throw Error('Gameplay message rate limit exceeded');
        const packet = validateNetworkPacket(decodeRoomPacket(event.data), {
          generation:membership.generation, localId:membership.role, remoteId:3-membership.role });
        stats.receivedPackets++; stats.receivedBytes += HEADER_BYTES + packet.data.length;
        deliver(packet);
      } catch (error) { fail(error); }
    };
    if (channel.readyState === 'open') channelOpened();
  }
  function localCandidate(event) {
    if (terminal) return;
    try {
      const candidate = event.candidate ? (event.candidate.toJSON?.() ?? event.candidate) : null;
      if (candidate?.candidate) { stats.localCandidates++; recordCandidate(stats.localCandidateKinds,candidate.candidate); }
      onState(snapshot());
      if (!localDescriptionSent) {
        if (localCandidates.length >= 128) throw Error('ICE candidate queue limit exceeded');
        localCandidates.push(candidate);
      } else sessionSend({type:'signal',candidate});
    } catch (error) { fail(error); }
  }
  function setupPeer(servers) {
    pc = new RTCPeerConnectionImpl({ iceServers:servers, bundlePolicy:'max-bundle' });
    pc.onicecandidate = localCandidate;
    pc.ondatachannel = event => {
      try {
        if (membership.role !== 2) throw Error('Only the joining player accepts a remote data channel');
        installChannel(event.channel);
      } catch (error) { try { event.channel?.close(); } catch {} fail(error); }
    };
    pc.onconnectionstatechange = () => {
      try {
        if (terminal) return;
        if (['failed','closed'].includes(pc.connectionState)) return deferTransportEnd('peer-failed','The peer connection ended. Check your network and create a new room.');
        if (pc.connectionState === 'disconnected' && disconnectTimer === undefined)
          deferTransportEnd('peer-interrupted','The peer connection was interrupted. Keep both game tabs open and create a new room.',true);
        if (pc.connectionState === 'connected' && recoverableDisconnect) {
          // A suspended tab may deliver recovery before its overdue timeout.
          // Never revive this guest after the agreed interruption deadline.
          if (now() >= disconnectDeadline) return fail(pendingTransportEnd);
          clearDisconnectTimer(); onState(snapshot()); updateReady(); startGame();
        }
      } catch (error) { fail(error); }
    };
  }
  async function sendDescription(description) {
    if (terminal || pendingTransportEnd && !recoverableDisconnect) return;
    await pc.setLocalDescription(description);
    if (terminal || pendingTransportEnd && !recoverableDisconnect) return;
    sessionSend({type:'signal',description:{type:pc.localDescription.type,sdp:pc.localDescription.sdp}});
    localDescriptionSent = true;
    for (const candidate of localCandidates.splice(0)) sessionSend({type:'signal',candidate});
  }
  async function handleSignal(event) {
    if (event.description) {
      if ('candidate' in event) throw Error('A room signal must contain one payload');
      const expected = membership.role === 1 ? 'answer' : 'offer';
      if (event.description.type !== expected || typeof event.description.sdp !== 'string' ||
          !event.description.sdp.length || event.description.sdp.length > 65536 || pc.remoteDescription)
        throw Error('Unexpected room session description');
      await pc.setRemoteDescription({type:expected,sdp:event.description.sdp});
      if (terminal) return;
      for (const candidate of remoteCandidates.splice(0)) {
        if (terminal) return;
        await pc.addIceCandidate(candidate);
      }
      if (terminal) return;
      if (membership.role === 2) await sendDescription(await pc.createAnswer());
    } else if ('candidate' in event) {
      const candidate = event.candidate;
      if (candidate !== null && (!candidate || typeof candidate !== 'object' ||
          typeof candidate.candidate !== 'string' || candidate.candidate.length > 4096 ||
          (candidate.sdpMid != null && (typeof candidate.sdpMid !== 'string' || candidate.sdpMid.length > 256)) ||
          (candidate.sdpMLineIndex != null && (!Number.isInteger(candidate.sdpMLineIndex) || candidate.sdpMLineIndex < 0 || candidate.sdpMLineIndex > 65535))))
        throw Error('Invalid room ICE candidate');
      if (candidate?.candidate) { stats.remoteCandidates++; recordCandidate(stats.remoteCandidateKinds,candidate.candidate); }
      onState(snapshot());
      if (!pc.remoteDescription) {
        if (remoteCandidates.length >= 128) throw Error('Remote ICE candidate queue limit exceeded');
        remoteCandidates.push(candidate);
      } else await pc.addIceCandidate(candidate);
    } else throw Error('Invalid room signal');
  }
  async function receiveSignal(data) {
    if (terminal) return;
    if (pendingTransportEnd && !recoverableDisconnect) return;
    if (data.type === 'joined') {
      if (membership || ![1,2].includes(data.role) || !u32(data.generation) ||
          (data.matchId !== undefined && (typeof data.matchId !== 'string' || !/^[a-f0-9]{32}$/.test(data.matchId))) ||
          !/^[A-Z0-9]{6}$/.test(data.code) || !/^[a-f0-9]{32}$/i.test(data.token))
        throw Error('Invalid room assignment');
      const servers = iceConfiguration(data.iceServers);
      const matchId = data.matchId ?? await legacyMatchId(data.code, data.generation);
      if (terminal) return;
      membership = {code:data.code,role:data.role,generation:data.generation,token:data.token,matchId};
      clearTimer(); setupPeer(servers); emit('waiting-peer','Share the room code with another player');
      assignment.resolve(publicMembership()); return;
    }
    if (!membership || data.generation !== membership.generation) throw Error('Stale room signaling message');
    if (data.type === 'peer-joined') {
      if (peerPresent) throw Error('Room peer was assigned twice');
      peerPresent = true; emit('connecting-peer','Connecting directly to the other player');
      arm('peer-timeout',['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname)
        ? 'Could not connect the two players. Check your browser’s Local Network permission, then create a new room.'
        : 'Could not connect to the other player. Check your network and create a new room. This network may require a TURN relay.');
      if (membership.role === 1) {
        installChannel(pc.createDataChannel(CHANNEL_LABEL,{ordered:true}));
        await sendDescription(await pc.createOffer());
      }
    } else if (data.type === 'signal') {
      if (!peerPresent) throw Error('Received a signal before the peer joined');
      await handleSignal(data);
    } else if (data.type === 'peer-ready') {
      if (!peerPresent) throw Error('Ready signal arrived without a peer');
      peerReady = true; onState(snapshot());
    } else if (data.type === 'start') {
      if (started || startPending || !readySent || !opened || !prepared) throw Error('Room started before both clients were ready');
      startPending = true; startGame();
    } else throw Error('Unknown room signaling message');
  }
  function connect(request) {
    if (operation || terminal) return Promise.reject(Error('Create a fresh client for another room'));
    operation = true;
    try {
      emit('connecting','Connecting to the room server'); arm('signaling-timeout','The room server did not respond. Check your connection and try creating or joining a room again.');
      ws = new WebSocketImpl(endpoint.href);
      ws.onopen = () => { try { if (!terminal) socketSend(request); } catch (error) { fail(error); } };
      ws.onmessage = event => {
        if (terminal) return;
        const size = typeof event.data === 'string' ? event.data.length : MAX_SIGNAL_BYTES + 1;
        if (size > MAX_SIGNAL_BYTES || queuedSignals >= 128 || queuedSignalBytes + size > MAX_BUFFERED)
          return fail(Error('Room signaling receive queue limit exceeded'));
        let data;
        try {
          data = JSON.parse(event.data);
          if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('Invalid room signaling message');
          // Departure/error notices must not wait behind a pending RTC promise.
          if (data.type === 'closed') return finish(typeof data.reason === 'string' ? data.reason.slice(0,256) : 'Room closed');
          if (data.type === 'error') return fail(roomError(
            typeof data.code === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(data.code) ? data.code : 'room-request-failed',
            typeof data.message === 'string' ? data.message.slice(0,256) : 'Room request failed'));
        } catch (error) { return fail(error); }
        queuedSignals++; queuedSignalBytes += size;
        signalChain = signalChain.then(() => receiveSignal(data)).catch(fail).finally(() => {
          queuedSignals--; queuedSignalBytes -= size;
        });
      };
      ws.onerror = () => fail(roomError('signaling-unavailable','Could not reach the room server. Check your connection and try again.'));
      ws.onclose = () => fail(roomError('signaling-closed','The room server connection closed unexpectedly. Check your connection and create a new room.'));
    } catch (error) { fail(error); }
    return assignment.promise;
  }
  return {
    create() { return connect({type:'create'}); },
    join(code) {
      if (typeof code !== 'string' || !/^[A-Z0-9]{6}$/.test(code.trim().toUpperCase()))
        return Promise.reject(Error('Enter the six-character room code'));
      return connect({type:'join',code:code.trim().toUpperCase()});
    },
    ready() { return connected.promise; },
    markReady() {
      if (terminal) throw Error('Room is closed');
      prepared = true;
      try { updateReady(); } catch (error) { fail(error); throw error; }
    },
    setAssetsReady() { this.markReady(); },
    sendPacket(packet) {
      if (recoverableDisconnect && now() >= disconnectDeadline) fail(pendingTransportEnd);
      // The guest may emit a final input while the departure notice is in flight.
      // Do not let a send error override that notice or grow a doomed send queue.
      if (!terminal && pendingTransportEnd && !recoverableDisconnect) { stats.discardedPackets++; return false; }
      if (terminal || !started || !opened || channel?.readyState !== 'open') throw Error('Gameplay connection is not ready');
      try {
        const checked = validateNetworkPacket(packet, {generation:membership.generation,remoteId:membership.role,localId:3-membership.role});
        const encoded = encodeRoomPacket(checked);
        if (channel.bufferedAmount + encoded.byteLength > MAX_BUFFERED) throw Error('Gameplay connection is too slow; send queue limit exceeded');
        channel.send(encoded); stats.sentPackets++; stats.sentBytes += encoded.byteLength;
        stats.peakBufferedAmount = Math.max(stats.peakBufferedAmount,channel.bufferedAmount);
        return true;
      } catch (error) { fail(error); throw error; }
    },
    send(packet) { return this.sendPacket(packet); },
    close(reason = 'Left the room') {
      if (!terminal && membership && ws?.readyState === 1) { try { sessionSend({type:'leave'}); } catch {} }
      finish(reason);
    },
    getSnapshot:snapshot,
    async getStats() {
      const result = {...stats,transport:'webrtc',channelState:channel?.readyState ?? 'closed',connectionState:pc?.connectionState ?? 'new'};
      if (!pc?.getStats || terminal) return result;
      try {
        const reports = await pc.getStats();
        let pair;
        for (const report of reports.values()) if (report.type === 'transport' && report.selectedCandidatePairId) pair = reports.get(report.selectedCandidatePairId);
        if (!pair) for (const report of reports.values()) if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated) pair = report;
        if (pair) {
          if (Number.isFinite(pair.currentRoundTripTime)) result.rttMs = pair.currentRoundTripTime * 1000;
          result.localCandidateType = reports.get(pair.localCandidateId)?.candidateType;
          result.remoteCandidateType = reports.get(pair.remoteCandidateId)?.candidateType;
        }
      } catch {}
      return result;
    },
  };
}
