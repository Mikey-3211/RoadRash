import { createMatchAnalytics } from './match-analytics.js';
import { createRoomClient } from './room-client.js';
import { roomSignalingUrl } from './multiplayer-config.js';

import { normalizeRoomCode, roomInviteCode, roomInviteUrl, roomCodeFromPaste } from './room-invite.js';
export { normalizeRoomCode } from './room-invite.js';

export function roomStatusText({ phase, prepared, readySent, latest = {}, error = '' }) {
  return error || (latest.interrupted ? 'Connection interrupted. Trying to recover…' : phase === 'playing' ? 'Online co-op · Game continues when you release the mouse.' :
      !latest.code ? 'Connecting to the room server…' : !prepared ? 'Preparing your game…' :
      latest.started ? 'Both players ready. Starting the game…' :
      !readySent ? 'Share the code with a friend, then press Ready.' :
      !latest.peerPresent ? 'Waiting for your friend to join…' :
      !latest.channelOpen ? 'Connecting the two players…' :
      !latest.peerReady ? 'Waiting for your friend to be ready…' : 'Both players ready. Starting the game…');
}

export function connectRooms({ session, audio, viewport, mobile, page = document, createClient = createRoomClient, onAnalytics = () => {} }) {
  const $ = id => page.getElementById(id);
  const create = $('create-room'), join = $('join-room'), form = $('join-room-form'), codeInput = $('room-code');
  const panel = $('room-panel'), label = $('room-code-label'), status = $('room-status'), ready = $('room-ready');
  const leave = $('leave-room'), banner = $('room-banner'), bannerText = $('room-banner-text');
  const copy = $('copy-room-code'), invite = $('copy-room-link');
  const track = (event, properties) => {
    try { void Promise.resolve(onAnalytics(event, properties)).catch(() => {}); } catch { /* Analytics is optional. */ }
  };
  const location = page.defaultView?.location || globalThis.location;
  const clipboard = page.defaultView?.navigator?.clipboard;
  let metrics;
  let client, prepared = false, readySent = false, latest = {}, error = '';
  function sync(phase = session.phase) {
    const active = Boolean(client), playing = phase === 'playing';
    panel.hidden = !active && !error;
    $('launch-overlay').classList.toggle('room-expanded', active || Boolean(error) || !form.hidden);
    page.querySelector('.launch-actions').hidden = active || !form.hidden;
    $('touch-leave-room').hidden = !active;
    banner.hidden = !active || !playing;
    create.disabled = join.disabled = active || ['loading','booting','playing'].includes(phase);
    $('play-button').disabled = active || ['loading','booting'].includes(phase);
    if (active) { form.hidden = true; $('launch-status').textContent = ''; if (prepared) $('load-track').hidden = true; }
    ready.disabled = !prepared || readySent;
    ready.hidden = !active || playing;
    leave.hidden = !active;
    const code = latest.code || '';
    if (label.textContent !== code) { $('room-copy-status').textContent = ''; $('room-invite-fallback').hidden = true; }
    label.textContent = code;
    $('room-code-card').hidden = !code;
    copy.disabled = invite.disabled = !code;
    $('room-player-label').textContent = code ? `PLAYER ${latest.role}` : '';
    const text = roomStatusText({ phase, prepared, readySent, latest, error });
    status.textContent = text;
    bannerText.textContent = latest.interrupted ? 'Connection interrupted. Trying to recover…' : `ROOM ${latest.code ?? ''} · PLAYER ${latest.role ?? ''} · Online co-op · Release mouse without pausing`;
    $('restart-button').textContent = active ? 'Leave room' : 'Restart';
    const localButton = page.querySelector('[title="Enter: join or pause Player 2"]');
    if (localButton) localButton.hidden = active;
  }
  function close(reason = '', endReason = reason ? 'error' : 'left') {
    metrics?.end(endReason); metrics = undefined;
    const previous = client; client = undefined;
    if (previous) track(reason ? 'multiplayer_error' : 'multiplayer_left');
    latest = {}; prepared = readySent = false; error = reason;
    previous?.close();
    session.stop(); sync();
  }
  function fail(reason) { if (!client) track('multiplayer_error'); close(reason || 'The room connection ended. Create or join a new room to play again.'); }
  async function enter(code) {
    if (client) return;
    track(code ? 'multiplayer_join_clicked' : 'multiplayer_create_clicked');
    error = ''; prepared = readySent = false; latest = {}; form.hidden = true;
    // Preserve browser audio permission inside the actual Create/Join gesture.
    void Promise.resolve(audio.enable()).catch(() => {});
    let current;
    try {
      current = createClient({ url: roomSignalingUrl(location),
        onState(value) { if (client !== current) return; latest = value; sync(); },
        onStart() { if (client === current) { session.startNetwork(); sync(); } },
        onPacket(packet) { if (client === current) session.receiveNetwork(packet); },
        onDisconnect(reason) {
          if (client === current) metrics?.end('disconnected');
          if (client === current) fail(reason === 'peer-left' ? 'Your friend left the room. Create or join a new room to play again.' :
            reason === 'peer-disconnected' ? 'Your friend disconnected. Create or join a new room to play again.' :
            ['expired', 'room-expired'].includes(reason) ? 'This room expired. Create a new room to play again.' :
            'The room closed. Create or join a new room to play again.');
        },
        onError(reason) {
          if (client !== current) return;
          console.warn('Room connection failed:', reason?.message, reason?.connection ?? {});
          fail(reason?.message || String(reason));
        },
      });
      client = current; sync();
      const assigned = await (code ? current.join(code) : current.create());
      if (client !== current) return;
      track(code ? 'multiplayer_room_joined' : 'multiplayer_room_created');
      latest = current.getSnapshot();
      metrics = createMatchAnalytics({matchId: assigned.matchId, role: assigned.role, track,
        page, lifecycle: page.defaultView});
      const currentMetrics = metrics;
      await session.play({ network: { config: { role: assigned.role, generation: assigned.generation },
        observeFrame(active) { currentMetrics.frame(active); },
        pauseMetrics() { currentMetrics.pause(); },
        markReady() { if (client === current) { prepared = true; sync(); } },
        sendPacket(packet) { current.sendPacket(packet); },
        close() { currentMetrics.end('stopped'); if (client === current) { track('multiplayer_error'); client = undefined; latest = {}; prepared = readySent = false; error = 'The multiplayer game ended. Create or join a new room to play again.'; } current.close(); sync(); },
      } });
      sync();
    } catch (reason) { if (client === current) fail(reason?.message || 'Could not open the room. Please try again.'); }
  }
  function markReady() {
    if (!client || !prepared || readySent) return;
    if (mobile.phone && !mobile.active) { mobile.enter(); return; }
    void Promise.resolve(audio.enable()).catch(() => {});
    readySent = true;
    try { client.markReady(); track('multiplayer_ready'); sync(); } catch (reason) { fail(reason.message); }
  }
  create.addEventListener('click', () => void enter());
  join.addEventListener('click', () => { error = ''; form.hidden = false; sync(); codeInput.focus(); });
  $('join-room-back').addEventListener('click', () => {
    form.hidden = true; error = ''; codeInput.setCustomValidity(''); sync(); join.focus();
  });
  form.addEventListener('submit', event => {
    event.preventDefault(); const code = normalizeRoomCode(codeInput.value);
    if (!/^[A-Z0-9]{6}$/.test(code)) { codeInput.setCustomValidity('Enter the six-character room code.'); codeInput.reportValidity(); return; }
    codeInput.setCustomValidity(''); void enter(code);
  });
  function updateCode(value) {
    codeInput.value = roomCodeFromPaste(value, location);
    codeInput.setCustomValidity('');
    $('room-join-help').textContent = 'Enter your friend’s six-character code.';
  }
  codeInput.addEventListener('input', () => updateCode(codeInput.value));
  // Normalize the whole pasted code before the browser applies any input constraints.
  codeInput.addEventListener('paste', event => {
    const value = event.clipboardData?.getData('text');
    if (!value) return;
    event.preventDefault();
    const start = codeInput.selectionStart ?? 0, end = codeInput.selectionEnd ?? codeInput.value.length;
    updateCode(codeInput.value.slice(0, start) + value + codeInput.value.slice(end));
  });
  copy.addEventListener('click', async () => {
    const code = latest.code;
    if (!code) return;
    copy.disabled = true;
    try {
      if (!clipboard?.writeText) throw new Error('Clipboard unavailable');
      await clipboard.writeText(code);
      if (latest.code === code) $('room-copy-status').textContent = 'Code copied!';
    } catch {
      if (latest.code === code) {
        const selection = page.defaultView?.getSelection();
        const range = page.createRange(); range.selectNodeContents(label);
        selection?.removeAllRanges(); selection?.addRange(range);
        $('room-copy-status').textContent = 'Select and copy the code above.';
      }
    } finally { copy.disabled = !latest.code; }
  });
  invite.addEventListener('click', async () => {
    const code = latest.code;
    if (!code) return;
    const url = roomInviteUrl(code, location);
    invite.disabled = true;
    try {
      if (!clipboard?.writeText) throw new Error('Clipboard unavailable');
      await clipboard.writeText(url);
      if (latest.code === code) $('room-copy-status').textContent = 'Invite link copied!';
    } catch {
      if (latest.code === code) {
        const field = $('room-invite-fallback');
        field.hidden = false; field.value = url; field.focus(); field.select();
        $('room-copy-status').textContent = 'Copy the selected invite link.';
      }
    } finally { invite.disabled = !latest.code; }
  });
  function showInvitation() {
    if (client) return;
    const invitedCode = roomInviteCode(location);
    if (!invitedCode) return;
    error = ''; updateCode(invitedCode); form.hidden = false;
    $('room-join-help').textContent = 'You’re invited. Press Join when you’re ready.';
    sync();
  }
  page.defaultView?.addEventListener?.('hashchange', showInvitation);
  showInvitation();
  ready.addEventListener('click', markReady);
  leave.addEventListener('click', () => close());
  $('room-banner-leave').addEventListener('click', () => close());
  $('touch-leave-room').addEventListener('click', () => close());
  return { sync, markReady, leave: () => close(), fail, get active() { return Boolean(client); } };
}
