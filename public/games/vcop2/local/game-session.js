// The player shell owns lifecycle only. Original logic still runs in startup-worker.
export function createGameSession({ loadAssets, createWorker, audio, music, input, presenter,
  focusGame = () => { }, onState = () => { }, onError = () => { }, onAnalytics = () => { }, onPerformance, onTouchAction }) {
  let worker, generation = 0, controller, assets, phase = 'idle', pending, paused = false, network;
  const track = event => {
    try { void Promise.resolve(onAnalytics(event)).catch(() => { }); } catch { /* Optional analytics. */ }
  };
  const current = id => id === generation;
  const state = (next, progress, error) => { phase = next; onState({ phase, progress, paused, error }); };
  function release() {
    paused = false; controller?.abort(); controller = undefined;
    const stoppedWorker = worker; worker = undefined;
    const stoppedNetwork = network; network = undefined; stoppedNetwork?.close?.();
    stoppedWorker?.postMessage({ type: 'stop' }); stoppedWorker?.terminate();
    input.disable();
    music.reset(); audio.reset(); presenter.clear();
  }
  function fail(error, id) {
    if (!current(id)) return;
    generation++; release(); state('error', undefined, error); onError(error);
  }
  function play(options = {}) {
    if (['loading', 'booting', 'playing'].includes(phase)) return pending;
    generation++; const id = generation;
    release(); network = options.network; controller = new AbortController();
    state('loading', 0);
    track('play_clicked');
    // Audio and capture begin inside the Play gesture, before file reads await.
    let activation;
    try {
      activation = audio.enable();
      input.enable();
      // A room is still a lobby: keep the pointer free for Ready, code entry
      // and Leave. Capture begins from the game surface after startup.
      if (!network) { focusGame(); void Promise.resolve(input.captureMouse()).catch(() => { }); }
    } catch (error) { fail(error, id); return Promise.resolve(); }
    pending = (async () => {
      try {
        const [loaded] = await Promise.all([assets ? Promise.resolve(assets) : loadAssets({
          signal: controller.signal,
          onProgress: progress => { if (current(id)) state('loading', progress); }
        }), activation]);
        if (!current(id)) return;
        assets = loaded; music.setDisc(assets.disc);
        track('assets_loaded');
        worker = createWorker(); const runningWorker = worker;
        let gameplayStarted = false;
        worker.onerror = event => fail(Error(event.message || 'Game worker failed'), id);
        worker.onmessage = ({ data }) => {
          if (!current(id) || worker !== runningWorker) return;
          try {
            if (data.type === 'network-ready') network?.markReady();
            else if (data.type === 'network-packet') network?.sendPacket(data.packet);
            else if (data.type === 'mode-unavailable' && data.mode === 'proving-ground') {
              generation++; release(); state('coming-soon');
            } else if (data.type === 'frame') {
              if (['ok', 'reload'].includes(data.touchAction)) onTouchAction?.(data.touchAction);
              try { network?.observeFrame?.(data.arcadeActive === true && !paused); } catch { /* Optional metrics. */ }
              presenter.submit(data);
              if (phase !== 'playing') state('playing');
            } else if (data.type === 'gameplay-started' && phase === 'playing' && !gameplayStarted) {
              gameplayStarted = true; track('game_started');
            } else if (data.type === 'performance') onPerformance?.(data.sample);
            else if (data.type === 'audio') audio.consume(data.batch, data.pcm);
            else if (data.type === 'cd-audio') void music.consume(data.batch).catch(error => fail(error, id));
            else if (['done', 'error', 'limit'].includes(data.type)) fail(Error(data.message || data.observation?.error || 'Game stopped'), id);
          } catch (error) { fail(error, id); }
        };
        state('booting', 1);
        worker.postMessage({
          type: 'startup', continuous: true, inputLatency: false,
          ...(network ? { network: network.config } : {}),
          diagnosticObservations: false, measurePerformance: typeof onPerformance === 'function',
          audioEnabled: true, provingGroundComingSoon: true, observeGameplayStart: true,
          observeMatchActivity: typeof network?.observeFrame === 'function',
          observeTouchAction: typeof onTouchAction === 'function',
          cdTracks: music.tracks(), files: assets.files
        });
        input.enable(); if (!network) focusGame();
      } catch (error) { fail(error, id); }
    })();
    return pending;
  }
  return {
    play,
    restart() { const wasNetwork = Boolean(network); this.stop(); if (!wasNetwork) return play(); },
    receiveNetwork(packet) { if (worker && network) worker.postMessage({ type: 'network-packet', packet }); },
    startNetwork() { if (worker && network) worker.postMessage({ type: 'network-start' }); },
    get networked() { return Boolean(network); },
    stop() { generation++; release(); state('idle'); },
    sendInput(command) { if (worker && ['booting', 'playing'].includes(phase)) worker.postMessage({ type: 'input', input: command }); },
    setPaused(value) {
      value = Boolean(value);
      if (!worker || phase !== 'playing' || paused === value) return;
      paused = value;
      try { network?.pauseMetrics?.(); } catch { /* Optional metrics. */ }
      worker.postMessage({ type: 'host-pause', paused });
      if (paused) audio.pause();
      else {
        const id = generation;
        void Promise.resolve(audio.enable()).catch(error => fail(error, id));
      }
      onState({ phase, paused });
    },
    get paused() { return paused; },
    startPlayer1() { if (phase === 'playing') input.startPlayer1(); },
    get phase() { return phase; },
  };
}
