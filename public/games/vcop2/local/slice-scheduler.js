// A posted message resumes in a new event-loop task, letting worker input and
// cancellation messages run between slices without nesting zero-delay timers.
// Browser workers use MessageChannel task turns. Node and unsupported hosts
// use timer yields to keep incoming input and cancellation messages serviceable.
// Native scheduler.yield is deliberately avoided: its boosted continuations can
// starve incoming worker messages. See docs/performance.md for scheduling scope.
export function createSliceScheduler(host = globalThis) {
  let pending, closed = false;
  const browserWorker = typeof host.WorkerGlobalScope === "function" && host instanceof host.WorkerGlobalScope;
  const channel = browserWorker && typeof host.MessageChannel === "function" ? new host.MessageChannel() : undefined;
  const resume = () => {
    const resolve = pending;
    pending = undefined;
    resolve?.();
  };
  if (channel) channel.port1.onmessage = resume;
  return {
    yield() {
      if (closed) throw new Error("The slice scheduler is closed.");
      if (pending) throw new Error("A slice yield is already pending.");
      return new Promise((resolve) => {
        pending = resolve;
        if (channel) channel.port2.postMessage(null);
        else host.setTimeout(resume, 0);
      });
    },
    close() {
      closed = true;
      channel?.port1.close();
      channel?.port2.close();
      resume();
    },
  };
}
