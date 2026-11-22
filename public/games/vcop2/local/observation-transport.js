// Host transport only. Nonzero intervals are unsuitable for per-slice
// adaptive observers; the generic runner defaults to synchronous delivery.
export function createObservationTransport(post, intervalMs = 0) {
  if (!Number.isFinite(intervalMs) || intervalMs < 0)
    throw new Error("Invalid compact observation transport interval.");
  let pending, lastPostedAt = -Infinity;
  return {
    observe(message, { now, code, newFrame }) {
      const observation = message.observation;
      const force = intervalMs === 0 || code !== 0 || newFrame ||
        observation.diagnostics !== "compact" || observation.status !== "yielded" ||
        Boolean(observation.pause_reason) || now < lastPostedAt || now - lastPostedAt >= intervalMs;
      if (!force) { pending = message; return; }
      // Clear first: synchronous callbacks can enqueue input/cancel/re-enter.
      pending = undefined; lastPostedAt = now;
      post(message);
    },
    force(message) {
      pending = undefined; lastPostedAt = -Infinity;
      post(message);
    },
    flushPending() {
      const message = pending; pending = undefined;
      if (message) post(message);
    },
    reset() { pending = undefined; lastPostedAt = -Infinity; },
  };
}
