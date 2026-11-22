// One room lifetime is one match. Both browsers report the same opaque ID;
// consumers group by match_id and take max(active_seconds), never sum peers.
export function createMatchAnalytics({ matchId, role, track, now = () => performance.now(),
  page = globalThis.document, lifecycle = globalThis } = {}) {
  if (typeof matchId !== 'string' || !/^[a-f0-9]{32}$/.test(matchId) || ![1, 2].includes(role))
    return { frame() {}, pause() {}, end() {} }; // Older room servers remain playable.
  let started = false, ended = false, previous, previousActive = false, milliseconds = 0, reportedAt;
  const emit = (event, reason) => {
    try { void Promise.resolve(track(event, { match_id: matchId, player_role: role,
      active_seconds: Math.floor(milliseconds / 1000), match_metrics_version: 1,
      ...(reason ? { end_reason: reason } : {}) })).catch(() => {}); } catch { /* Never affect gameplay. */ }
  };
  function pause() {
    previous = undefined; previousActive = false;
    if (started && !ended) { emit('multiplayer_match_progress'); reportedAt = now(); }
  }
  function end(reason = 'stopped') {
    if (ended) return;
    ended = true;
    page?.removeEventListener?.('visibilitychange', visibility);
    lifecycle?.removeEventListener?.('pagehide', hide);
    if (started) emit('multiplayer_match_ended',
      ['left', 'disconnected', 'error', 'stopped', 'pagehide'].includes(reason) ? reason : 'stopped');
  }
  function visibility() { pause(); }
  function hide(event) { if (event.persisted) pause(); else end('pagehide'); }
  page?.addEventListener?.('visibilitychange', visibility);
  lifecycle?.addEventListener?.('pagehide', hide);
  return {
    frame(active) {
      if (ended) return;
      const time = now();
      if (!Number.isFinite(time)) return;
      active = active === true && !page?.hidden;
      if (active && !started) {
        started = true; reportedAt = time; emit('multiplayer_match_started');
      }
      const delta = time - previous;
      // Only adjacent active frames count. Long stalls, pauses, hidden tabs,
      // menus and queued frames after sleep cannot turn into hours of play.
      if (active && previousActive && delta >= 0 && delta <= 1000)
        milliseconds = Math.min(2 * 60 * 60_000, milliseconds + delta);
      previous = time; previousActive = active;
      if (started && time - reportedAt >= 15_000) {
        reportedAt = time; emit('multiplayer_match_progress');
      }
    }, pause, end,
  };
}
