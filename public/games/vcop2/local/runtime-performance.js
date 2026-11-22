// Opt-in local profiling. Durations cover active worker time only; host pauses
// reset the sample. Frame rate means produced frames, not display scanout.
export function createRuntimePerformance(post, now = () => performance.now()) {
  let started, executionMs, yieldMs, slices, frames, maxSliceMs;
  function reset() {
    started = now(); executionMs = 0; yieldMs = 0; slices = 0; frames = 0; maxSliceMs = 0;
  }
  reset();
  return {
    reset,
    executed(ms, newFrames) {
      executionMs += ms; maxSliceMs = Math.max(maxSliceMs, ms); slices++; frames += newFrames;
    },
    yielded(ms) { yieldMs += ms; },
    report() {
      const elapsedMs = now() - started;
      if (elapsedMs < 2000) return;
      post({ type: 'performance', sample: { elapsedMs, executionMs, yieldMs, slices, frames, maxSliceMs } });
      reset();
    },
  };
}
