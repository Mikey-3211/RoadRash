// Guest execution remains independent of display refresh. An idle presenter
// submits immediately; during bursts retain only the newest frame for the next
// browser paint. A timer releases an adaptive cooldown if rAF stalls while page
// tasks continue. Never delay worker input or guest clocks. The leading=false
// option retains the pure animation-frame policy for measured comparisons.
export function createFramePresenter(present, host = globalThis, { leading = true } = {}) {
  let pending, request, watchdog, generation = 0;
  let received = 0, presented = 0, replaced = 0;
  const cancel = () => {
    if (request !== undefined) host.cancelAnimationFrame(request);
    if (watchdog !== undefined) host.clearTimeout(watchdog);
    request = undefined;
    watchdog = undefined;
    generation++;
  };
  const schedule = () => {
    const scheduledGeneration = generation;
    const finish = (timestamp) => {
      if (scheduledGeneration !== generation) return;
      // Invalidate both callbacks even if one has already entered the task queue.
      cancel();
      draw(timestamp, leading);
    };
    request = host.requestAnimationFrame(finish);
    // Two nominal 60 Hz refresh periods tolerate a missed animation callback
    // without indefinitely retaining pending pixels. This is a task deadline,
    // not a guarantee while the page thread itself is blocked or throttled.
    if (leading) watchdog = host.setTimeout(() => finish(undefined), 32);
  };
  const draw = (timestamp, cooldown = false) => {
    const frame = pending;
    pending = undefined;
    if (frame === undefined) return false;
    // Arm before calling user code so a reentrant submit joins the cooldown.
    if (cooldown) schedule();
    presented++;
    present(frame, timestamp);
    return true;
  };
  return {
    submit(frame) {
      if (frame === undefined) throw new Error("A completed frame is required.");
      received++;
      if (pending !== undefined) replaced++;
      pending = frame;
      if (request !== undefined) return;
      if (leading) draw(undefined, true);
      else schedule();
    },
    // Stop, terminal observations and diagnostic pauses retain the most recent
    // completed image even when rAF is suspended (for example, a hidden tab).
    flush() {
      cancel();
      return draw(undefined);
    },
    // Selection/restart discard pending work before the canvas is cleared. The
    // generation check also rejects a callback already queued before cancel.
    clear() {
      cancel();
      pending = undefined;
      received = presented = replaced = 0;
    },
    snapshot() {
      return { received, presented, replaced, pending: pending !== undefined };
    },
  };
}
