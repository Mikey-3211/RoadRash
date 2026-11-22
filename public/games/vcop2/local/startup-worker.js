import { createWorkerNetwork } from './worker-network.js';
import { touchAimDelta, touchAction } from "./touch-input.js";
import { gameProfile, gameIdlePoll, gameModePhase, gameArcadeState } from "./game-profile.js";
import { fingerprint } from "./module-verification.js";
import { createSliceScheduler } from "./slice-scheduler.js";
import { createRuntimePerformance } from './runtime-performance.js';
import { createObservationTransport } from "./observation-transport.js";
import { configureAudio, forwardAudio, configureCdAudio, forwardCdAudio } from "./audio-transport.js";

export function selectGameFiles(selection) {
  const paths = new Map();
  for (const { path, file } of selection) {
    const normalized = path.replaceAll("\\", "/").toUpperCase();
    if (normalized.split("/").some((part) => !part || part === "." || part === "..") || normalized.includes(":"))
      throw new Error(`Invalid local path: ${path}`);
    if (paths.has(normalized)) throw new Error(`Ambiguous local path: ${path}`);
    paths.set(normalized, file);
  }
  const executables = [...paths.keys()].filter((path) => path.endsWith("/PROJECT/PPJ2DD.EXE") || path === "PROJECT/PPJ2DD.EXE");
  if (executables.length !== 1) throw new Error("Select one complete extracted VCOP2 folder, preserving PROJECT, BIN, BMP and SE subfolders.");
  const root = executables[0].slice(0, -"PROJECT/PPJ2DD.EXE".length);
  const files = [...paths].filter(([path]) => path.startsWith(root)).map(([path, file]) => ({ path: path.slice(root.length), file }));
  const relative = new Map(files.map(({ path, file }) => [path, file]));
  let total = 0;
  for (const { file } of files) {
    if (!Number.isInteger(file.size) || file.size < 0 || file.size > 32 * 1024 * 1024) throw new Error("A selected file exceeds the 32 MiB input limit.");
    total += file.size;
  }
  if (total > 64 * 1024 * 1024) throw new Error("The selected game folder exceeds the 64 MiB input limit.");
  for (const profile of gameProfile) {
    const file = relative.get(`PROJECT/${profile.name}`);
    if (!file) throw new Error(`Missing PROJECT/${profile.name}. Select the complete extracted VCOP2 folder.`);
    if (file.size !== profile.size) throw new Error(`Unsupported size for ${profile.name}; no game instructions were executed.`);
  }
  return files;
}

function result(module, full = false) {
  return JSON.parse(module.UTF8ToString(full ? module._vcop2_result_json_full() : module._vcop2_result_json()));
}

function checked(module, code) {
  if (code !== 0) throw new Error(result(module).error || `Runtime input failed (${code}).`);
}

export function addRuntimeFile(module, path, bytes) {
  const encoded = new TextEncoder().encode(`${path}\0`);
  let name = 0, data = 0;
  try {
    name = module._malloc(encoded.length);
    data = module._malloc(Math.max(1, bytes.byteLength));
    if (!name || !data) throw new Error("Could not allocate local Wasm file buffers.");
    module.HEAPU8.set(encoded, name);
    module.HEAPU8.set(new Uint8Array(bytes), data);
    checked(module, module._vcop2_startup_add_file(name, data, bytes.byteLength));
  } finally {
    if (name) module._free(name);
    if (data) module._free(data);
  }
}

// Commands are applied synchronously at slice boundaries. Losing focus discards
// queued presses; overflow also releases input instead of leaving a held key.
export function createStartupControl({ measureInputLatency = false,
  now = () => performance.timeOrigin + performance.now(), keepNetworkActive = false, localPlayer = 1 } = {}) {
  let pending = [], cancelled = false;
  let lastAppliedInput;
  let observePolls = false;
  let wake, hostWake, hostPaused = false;
  const buttonEdges = new Map(), keyEdges = new Map();
  const integer = (value, low, high) => Number.isInteger(value) && value >= low && value <= high;
  return {
    get cancelled() { return cancelled; },
    get hostPaused() { return hostPaused; },
    get lastAppliedInput() { return lastAppliedInput; },
    configurePollObservation(module) {
      observePolls = measureInputLatency && ["_vcop2_input_observation_enable", "_vcop2_input_observation_mark",
        "_vcop2_input_observation_json"].every((name) => typeof module[name] === "function");
      if (observePolls) checked(module, module._vcop2_input_observation_enable(1));
    },
    takePollObservation(module) {
      return observePolls ? JSON.parse(module.UTF8ToString(module._vcop2_input_observation_json())) : undefined;
    },
    enqueue(input, timing) {
      if (cancelled || !input || typeof input !== "object") return false;
      let command;
      if (input.kind === "active" && typeof input.active === "boolean") {
        command = { kind: "active", active: input.active };
        if (!input.active) pending = [];
      } else if (input.kind === "key" && integer(input.scan, 0, 255) && typeof input.pressed === "boolean")
        command = { kind: "key", scan: input.scan, pressed: input.pressed };
      else if (input.kind === "menu" && integer(input.window, 1, 0xffffffff) && integer(input.id, 0, 65535))
        command = { kind: "menu", window: input.window, id: input.id };
      else if (input.kind === "button" && integer(input.button, 0, 3) && typeof input.pressed === "boolean")
        command = { kind: "button", button: input.button, pressed: input.pressed };
      else if (input.kind === "mouse" && [input.dx, input.dy, input.wheel].every((n) => integer(n, -2147483648, 2147483647)))
        command = { kind: "mouse", dx: input.dx, dy: input.dy, wheel: input.wheel };
      else if (input.kind === "tap" && integer(input.x, 0, 639) && integer(input.y, 0, 479))
        command = { kind: "tap", x: input.x, y: input.y };
      else if (input.kind === "mobile-action") command = { kind: "mobile-action" };
      else return false;
      const queuedEdges = pending.reduce((count, item) => count + (item.kind === 'mobile-action' ? 2 : 1), 0);
      if (queuedEdges + (command.kind === "tap" ? 3 : command.kind === "mobile-action" ? 2 : 1) > 1024) { pending = [{ kind: "active", active: false }]; return false; }
      // Measurement never changes input acceptance or ordering. Invalid optional
      // timestamps are ignored, and discarded commands never produce an ack.
      if (measureInputLatency && Number.isSafeInteger(timing?.sequence) && timing.sequence > 0 &&
          Number.isFinite(timing.sentAt) && timing.sentAt >= 0)
        command.timing = { sequence: timing.sequence, sentAt: timing.sentAt, receivedAt: now() };
      if (command.kind === "tap") pending.push(command,
        { kind: "button", button: 0, pressed: true }, { kind: "button", button: 0, pressed: false });
      else pending.push(command);
      return true;
    },
    flush(module) {
      const commands = pending; pending = [];
      const applied = measureInputLatency ? [] : undefined;
      for (let index = 0; index < commands.length; index++) {
        let command = commands[index];
        if (command.kind === 'mobile-action') {
          // Resolve at application time, so a stale UI label cannot turn a
          // gameplay reload into a shot. Both edges retain the selected button.
          const { button } = touchAction(module);
          commands.splice(index, 1, { kind: 'button', button, pressed: true, timing: command.timing },
            { kind: 'button', button, pressed: false });
          command = commands[index];
        }
        let poll;
        if (command.kind === "tap") {
          // Do not move the aim for the next tap before the preceding shot/release
          // has reached the original device poll.
          const edge = buttonEdges.get(0);
          if (edge && edge.poll === module._vcop2_input_mouse_poll_serial()) {
            pending = commands.slice(index); break;
          }
        }
        const edges = command.kind === "key" ? keyEdges : buttonEdges;
        const edgeId = command.kind === "key" ? command.scan : command.button;
        const pollSerial = command.kind === "key" ? module._vcop2_input_keyboard_poll_serial : module._vcop2_input_mouse_poll_serial;
        if (["button", "key"].includes(command.kind) && typeof pollSerial === "function") {
          poll = pollSerial();
          const previous = edges.get(edgeId);
          if (previous && previous.pressed !== command.pressed && previous.poll === poll) {
            // Preserve a quick down/up until the guest has read the first edge.
            // Keep following commands ordered; blur/Stop still clear immediately.
            pending = commands.slice(index); break;
          }
        }
        let code;
        if (command.kind === "active") {
          code = module._vcop2_input_active(+command.active);
          if (!code && !command.active && keepNetworkActive) code = module._vcop2_input_active(1);
        }
        else if (command.kind === "key") code = module._vcop2_input_key(command.scan, +command.pressed);
        else if (command.kind === "button") code = module._vcop2_input_button(command.button, +command.pressed);
        else if (command.kind === "menu") {
          if (typeof module._vcop2_input_menu !== "function") throw new Error("This runtime does not support the game menu. Rebuild the browser runtime.");
          code = module._vcop2_input_menu(command.window, command.id);
        }
        else if (command.kind === "tap") {
          const delta = touchAimDelta(module, command.x, command.y, localPlayer);
          code = module._vcop2_input_mouse(delta.dx, delta.dy, 0);
        }
        else code = module._vcop2_input_mouse(command.dx, command.dy, command.wheel);
        checked(module, code);
        if (command.kind === "active" && !command.active) { buttonEdges.clear(); keyEdges.clear(); }
        if (["button", "key"].includes(command.kind) && poll !== undefined) {
          const previous = edges.get(edgeId);
          if (!previous || previous.pressed !== command.pressed)
            edges.set(edgeId, { pressed: command.pressed, poll });
        }
        if (command.timing) {
          const sample = { ...command.timing, appliedAt: now(), kind: command.kind };
          if (observePolls && ["key", "mouse", "button"].includes(command.kind)) {
            const device = command.kind === "key" ? 2 : 1;
            const beforeAt = now();
            checked(module, module._vcop2_input_observation_mark(sample.sequence, device));
            sample.pollMarker = { device, beforeAt, afterAt: now() };
          }
          lastAppliedInput = { sequence: sample.sequence, appliedAt: sample.appliedAt };
          applied.push(sample);
        }
      }
      return applied;
    },
    waitForResume() { return new Promise((resolve) => { wake = resolve; }); },
    resume() { const resolve = wake; wake = undefined; resolve?.(); },
    setPaused(paused) {
      if (cancelled || typeof paused !== "boolean") return false;
      hostPaused = paused;
      if (paused) { pending = [{ kind: "active", active: false }]; buttonEdges.clear(); keyEdges.clear(); }
      else { const resolve = hostWake; hostWake = undefined; resolve?.(); }
      return true;
    },
    waitForHostResume() {
      return !hostPaused || cancelled ? Promise.resolve() : new Promise((resolve) => { hostWake = resolve; });
    },
    cancel() {
      cancelled = true; pending = []; buttonEdges.clear(); keyEdges.clear(); this.resume();
      const resolve = hostWake; hostWake = undefined; resolve?.();
    },
    release(module, { preservePending = false } = {}) {
      if (!preservePending) pending = [];
      buttonEdges.clear(); keyEdges.clear();
      if (module) checked(module, module._vcop2_input_active(0));
    },
  };
}

export async function runStartup(selection, post, loadModule = async () => {
  const { default: createModule } = await import(new URL("./build/vcop2.js", import.meta.url).href);
  return createModule();
}, limits = {}, control = createStartupControl()) {
  const compactObservationIntervalMs = limits.compactObservationIntervalMs ?? 0;
  const observationTransport = createObservationTransport(post, compactObservationIntervalMs);
  const files = selectGameFiles(selection);
  const verified = new Map();
  // Validate every executable image before constructing a guest process.
  for (const profile of gameProfile) {
    const path = `PROJECT/${profile.name}`;
    post({ type: "status", message: `Checking ${profile.name} locally…` });
    const bytes = await files.find((file) => file.path === path).file.arrayBuffer();
    if (await fingerprint(bytes) !== profile.sha256) throw new Error(`Unsupported ${profile.name} fingerprint; no game instructions were executed.`);
    verified.set(path, bytes);
  }
  post({ type: "status", message: "Loading verified modules and local game assets…" });
  const module = await loadModule();
  if ((limits.provingGroundComingSoon === true || limits.observeGameplayStart === true || limits.observeTouchAction === true) &&
    typeof module._vcop2_guest_read_scalar !== "function")
    throw new Error("The player requires guest-state reading support. Rebuild web/build before continuing.");
  checked(module, module._vcop2_startup_reset());
  limits.network?.configure(module);
  const audioEnabled = limits.audioEnabled === true;
  configureAudio(module, audioEnabled);
  const cdAudioEnabled = audioEnabled && configureCdAudio(module, limits.cdTracks ?? []);
  const cooperativeIdle = limits.cooperativeIdle === true &&
    typeof module._vcop2_startup_idle_poll === "function" &&
    typeof module._vcop2_startup_wait_ms === "function";
  if (cooperativeIdle)
    checked(module, module._vcop2_startup_idle_poll(gameIdlePoll.returnAddress, gameIdlePoll.deadlineAddress));
  control.configurePollObservation?.(module);
  const compactDiagnostics = Boolean(limits.compactDiagnostics);
  const diagnosticObservations = limits.diagnosticObservations !== false;
  const fullSnapshotInterval = limits.fullSnapshotIntervalMs ?? 1000;
  if (!Number.isFinite(fullSnapshotInterval) || fullSnapshotInterval < 0)
    throw new Error("Invalid full diagnostic snapshot interval.");
  let first = true, totalSteps = 0, windowSteps = 0, frames = 0, lastFullAt = -Infinity, gameplayStarted = false;
  let clockPaused = false;
  const pauseClock = (paused) => {
    if (clockPaused === paused) return;
    if (typeof module._vcop2_startup_host_pause !== "function")
      throw new Error("The Wasm runtime is missing host-pause support. Rebuild web/build before continuing.");
    checked(module, module._vcop2_startup_host_pause(+paused));
    clockPaused = paused;
  };
  const scheduler = createSliceScheduler();
  try {
  for (const { path, file } of files) addRuntimeFile(module, path, verified.get(path) || await file.arrayBuffer());
  if (compactDiagnostics) checked(module, module._vcop2_startup_diagnostics(0));
  if (limits.network) await limits.network.ready();
  const slice = limits.slice || 50000;
  // Interactive sessions can run until Stop, a terminal result or a fault.
  // Individual slices remain bounded and yield for input/cancellation. CLI and
  // diagnostic callers retain the default overall instruction window.
  const maxSteps = limits.continuous === true ? Infinity : limits.maxSteps || 100000000;
  const timing = limits.measurePerformance === true ? createRuntimePerformance(post) : undefined;
  while (true) {
    if (control.cancelled) { observationTransport.flushPending(); post({ type: "cancelled", totalSteps, frames }); return; }
    if (control.hostPaused) {
      // Before the first invocation there is no resumable guest clock yet.
      if (!first) pauseClock(true);
      // setPaused(true) already discarded stale commands. A recapture activation
      // may have arrived since then and must survive until host-pause:false.
      control.release(module, { preservePending: true });
      // A separate waiter keeps focus recapture independent of diagnostic Continue.
      // No timers, interpreter slices or guest clock progression while unfocused.
      await control.waitForHostResume();
      if (control.cancelled || control.hostPaused) continue;
      pauseClock(false);
      observationTransport.reset();
      timing?.reset();
    }
    if (windowSteps >= maxSteps) {
      if (compactDiagnostics) observationTransport.force({ type: "observation", observation: result(module, true), totalSteps, frames });
      const resumable = Boolean(limits.pauseOnLimit);
      // Arm the wait before posting so an immediate Continue cannot be lost.
      const resumed = resumable ? control.waitForResume() : undefined;
      control.release(module);
      if (resumable) pauseClock(true);
      post({ type: "limit", totalSteps, frames, resumable,
        message: resumable ? `Paused after ${maxSteps.toLocaleString()} steps. Continue run preserves this game session.` :
          `Stopped at the ${maxSteps.toLocaleString()}-step diagnostic limit. Any presented frame remains visible.` });
      if (!resumable) return;
      await resumed;
      if (control.cancelled) { observationTransport.flushPending(); post({ type: "cancelled", totalSteps, frames }); return; }
      if (!control.hostPaused) pauseClock(false);
      observationTransport.reset();
      timing?.reset();
      windowSteps = 0;
      post({ type: "status", message: "Continuing the current game session…" });
      continue;
    }
    limits.network?.flush();
    const applied = control.flush(module);
    if (applied?.length) post({ type: "input-applied", samples: applied });
    const budget = Math.min(slice, maxSteps - windowSteps);
    const executionStart = timing ? performance.now() : 0;
    const code = first ? module._vcop2_startup_start(budget) : module._vcop2_startup_step(budget);
    const executionMs = timing ? performance.now() - executionStart : 0;
    limits.network?.drain();
    // Stop at the selected-mode transition, before forwarding alternate-mode
    // audio or frames. This is a player availability gate, not a guest patch.
    if (limits.provingGroundComingSoon === true && gameModePhase.provingGround.includes(
      module._vcop2_guest_read_scalar(gameModePhase.address, gameModePhase.width))) {
      post({ type: "mode-unavailable", mode: "proving-ground" });
      return;
    }
    if (audioEnabled) forwardAudio(module, post);
    if (cdAudioEnabled) forwardCdAudio(module, post);
    first = false;
    let observation = result(module);
    const now = performance.now();
    if (diagnosticObservations && compactDiagnostics && observation.diagnostics === "compact" && now - lastFullAt >= fullSnapshotInterval)
      observation = result(module, true);
    if (observation.diagnostics !== "compact") lastFullAt = now;
    totalSteps += observation.attempted_steps || 0;
    windowSteps += observation.attempted_steps || 0;
    const count = module._vcop2_frame_count();
    const newFrame = count > frames;
    timing?.executed(executionMs, Math.max(0, count - frames));
    if (newFrame || code !== 0 || !["paused", "yielded"].includes(observation.status)) {
      const polls = control.takePollObservation?.(module);
      if (polls) post({ type: "guest-input-polls", report: polls });
    }
    if (newFrame) {
      frames = count;
      const width = module._vcop2_frame_width(), height = module._vcop2_frame_height();
      const pointer = module._vcop2_frame_data();
      if (!pointer || width < 1 || height < 1 || width > 2048 || height > 2048) throw new Error("Invalid runtime frame dimensions.");
      const pixels = module.HEAPU8.slice(pointer, pointer + width * height * 4);
      const inputLatency = control.lastAppliedInput ? { sequence: control.lastAppliedInput.sequence,
        producedAt: performance.timeOrigin + performance.now() } : undefined;
      const arcadeActive = limits.observeGameplayStart === true &&
        (!gameplayStarted || limits.observeMatchActivity === true) && code === 0 &&
        ["paused", "yielded"].includes(observation.status) &&
        module._vcop2_guest_read_scalar(gameModePhase.address, gameModePhase.width) === gameArcadeState.phase &&
        (module._vcop2_guest_read_scalar(gameArcadeState.address, gameArcadeState.width) & gameArcadeState.mask) === gameArcadeState.playing;
      post({ type: "frame", width, height, frames, pixels,
        ...(limits.observeMatchActivity === true ? { arcadeActive } : {}),
        ...(limits.observeTouchAction === true ? { touchAction: touchAction(module).label } : {}),
        ...(inputLatency ? { inputLatency } : {}) }, [pixels.buffer]);
      if (!gameplayStarted && arcadeActive) {
        gameplayStarted = true;
        post({ type: "gameplay-started" });
      }
    }
    if (diagnosticObservations && compactObservationIntervalMs === 0)
      post({ type: "observation", observation, totalSteps, frames });
    else if (diagnosticObservations) observationTransport.observe({ type: "observation", observation, totalSteps, frames }, { now, code, newFrame });
    if (code !== 0 || !["paused", "yielded"].includes(observation.status)) {
      if (!diagnosticObservations && compactDiagnostics) observation = result(module, true);
      post({ type: "done", observation, totalSteps, frames });
      return observation;
    }
    // Yield the worker event loop between bounded interpreter slices.
    const yieldStart = timing ? performance.now() : 0;
    await scheduler.yield();
    if (timing) timing.yielded(performance.now() - yieldStart);
    if (!control.cancelled && !control.hostPaused && cooperativeIdle && observation.pause_reason === "clock-wait") {
      // Leave one millisecond for the original poll/compare to observe its own
      // deadline. A message turn above prevents nested timer clamping in workers.
      const remaining = module._vcop2_startup_wait_ms();
      if (!Number.isInteger(remaining) || remaining < 0 || remaining > 0xffffffff)
        throw new Error("Invalid cooperative clock-wait duration.");
      const delay = Math.min(4, Math.max(0, remaining - 1));
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    }
    timing?.report();
  }
  } catch (error) {
    // Preserve the complete runtime observation if host/input handling fails
    // between slices. The outer worker handler reports the host error itself.
    if (compactDiagnostics) observationTransport.force({ type: "observation", observation: result(module, true), totalSteps, frames });
    throw error;
  } finally { scheduler.close(); observationTransport.reset(); control.release(module); limits.network?.close(); }
}

if (typeof WorkerGlobalScope !== "undefined" && globalThis instanceof WorkerGlobalScope) {
  let running = false, control, network;
  globalThis.addEventListener("message", async ({ data }) => {
    if (data.type === 'network-start' && running) { network?.start(); return; }
    if (data.type === 'network-packet' && running) {
      try { network?.receive(data.packet); }
      catch (error) { network?.cancel(); control.cancel(); postMessage({type:'error',message:error.message}); }
      return;
    }
    if (data.type === "input" && running) { control.enqueue(data.input, data.timing); return; }
    if (data.type === "host-pause" && running) { if (network) { if (data.paused) control.enqueue({kind:'active',active:false}); }
      else control.setPaused(data.paused); return; }
    if (data.type === "continue" && running) { control.resume(); return; }
    if (data.type === "stop" && running) { network?.cancel(); control.cancel(); return; }
    if (data.type !== "startup" || running) return;
    running = true;
    try {
      network = data.network ? createWorkerNetwork(data.network, (message, transfer = []) => postMessage(message, transfer)) : undefined;
      control = createStartupControl({ measureInputLatency: data.inputLatency === true, keepNetworkActive: Boolean(network), localPlayer: data.network?.role ?? 1 });
      await runStartup(data.files, (message, transfer = []) => postMessage(message, transfer), undefined,
      { network, pauseOnLimit: true, compactDiagnostics: true, compactObservationIntervalMs: 0,
        diagnosticObservations: data.diagnosticObservations !== false,
        measurePerformance: data.measurePerformance === true,
        audioEnabled: data.audioEnabled === true, cdTracks: data.cdTracks,
        provingGroundComingSoon: data.provingGroundComingSoon === true,
        observeGameplayStart: data.observeGameplayStart === true,
        observeMatchActivity: data.observeMatchActivity === true,
        observeTouchAction: data.observeTouchAction === true,
        continuous: data.continuous === true }, control); }
    catch (error) { postMessage({ type: "error", message: error.message }); }
    finally { running = false; network?.close(); network = undefined; }
  });
}
