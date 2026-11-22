// PCM produced by the original program's DirectSound calls. No game assets live here.
const integer = (n, low, high) => Number.isSafeInteger(n) && n >= low && n <= high;
const MAX_PCM = 16 * 1024 * 1024;
export function decodePcm(event, slab) {
  const { channels, bits, sampleRate, pcmOffset, pcmBytes } = event;
  if (!(slab instanceof Uint8Array) || event.format !== 'pcm' ||
      ![1, 2].includes(channels) || ![8, 16].includes(bits) ||
      !integer(sampleRate, 8000, 96000) || !integer(pcmOffset, 0, slab.length) ||
      !integer(pcmBytes, 1, MAX_PCM) || pcmOffset + pcmBytes > slab.length ||
      pcmBytes % (channels * bits / 8)) throw Error('Invalid runtime PCM buffer');
  const frames = pcmBytes / (channels * bits / 8);
  const output = [new Float32Array(frames), new Float32Array(frames)];
  const view = new DataView(slab.buffer, slab.byteOffset + pcmOffset, pcmBytes);
  for (let i = 0; i < frames; ++i) for (let channel = 0; channel < 2; ++channel) {
    const index = i * channels + (channels === 1 ? 0 : channel);
    output[channel][i] = bits === 8 ? (view.getUint8(index) - 128) / 128 : view.getInt16(index * 2, true) / 32768;
  }
  return { output, frames, channels, bits, sampleRate, pcmBytes };
}

export function createAudioPlayer({ contextFactory = () => new AudioContext(), onStatus = () => {} } = {}) {
  let context, master, sequence = 0, generation = 0, muted = false, disposed = false, wantedRunning = false;
  let decodedBytes = 0;
  const assets = new Map(), current = new Map(), voices = new Map();
  const key = event => `${event.id}:${event.version}`;
  const report = message => onStatus({ message, state: context?.state ?? 'unavailable',
    buffers: current.size, voices: voices.size, decodedBytes, muted });
  function collect() {
    const used = new Set([...current.values(), ...[...voices.values()].map(voice => voice.assetKey)]);
    for (const [name, asset] of assets) if (!used.has(name)) { decodedBytes -= asset.memoryBytes; assets.delete(name); }
  }
  function stopVoice(id) {
    const voice = voices.get(id);
    if (!voice) return;
    voices.delete(id); voice.source.onended = null;
    try { voice.source.stop(); } catch { /* A naturally ended source is already stopped. */ }
    for (const node of voice.nodes) node.disconnect();
  }
  function parameters(voice, event) {
    const volume = event.volumeHundredthDb ?? voice.volume;
    const pan = event.panHundredthDb ?? voice.pan;
    const frequency = event.frequencyHz ?? voice.frequency;
    if (!integer(volume, -10000, 0) || !integer(pan, -10000, 10000) ||
        !integer(frequency, 0, 200000)) throw Error('Invalid DirectSound playback parameters');
    voice.volume = volume; voice.pan = pan; voice.frequency = frequency;
    const gain = volume === -10000 ? 0 : 10 ** (volume / 2000);
    // DirectSound pan attenuates one side in hundredths of a dB; it is not an
    // equal-power panner. Mono PCM was duplicated into two channels above.
    voice.left.gain.value = gain * (pan >= 10000 ? 0 : 10 ** (-Math.max(0, pan) / 2000));
    voice.right.gain.value = gain * (pan <= -10000 ? 0 : 10 ** (Math.min(0, pan) / 2000));
    voice.source.playbackRate.value = (frequency || voice.asset.sampleRate) / voice.asset.sampleRate;
  }
  function play(event) {
    const asset = assets.get(key(event));
    if (!asset) throw Error('Audio play references an unavailable PCM version');
    const blockAlign = asset.channels * asset.bits / 8;
    if (!integer(event.startByte, 0, asset.pcmBytes - 1) || event.startByte % blockAlign ||
        typeof event.loop !== 'boolean') throw Error('Invalid DirectSound playback position');
    if (!voices.has(event.id) && voices.size >= 128) throw Error('Browser audio voice limit exceeded');
    stopVoice(event.id);
    const source = context.createBufferSource(), split = context.createChannelSplitter(2);
    const left = context.createGain(), right = context.createGain(), merge = context.createChannelMerger(2);
    const voice = { source, left, right, asset, assetKey: key(event), generation,
      volume: 0, pan: 0, frequency: asset.sampleRate, loop: event.loop,
      nodes: [source, split, left, right, merge] };
    try {
      source.buffer = asset.buffer; source.loop = event.loop;
      parameters(voice, event);
      source.connect(split); split.connect(left, 0); split.connect(right, 1);
      left.connect(merge, 0, 0); right.connect(merge, 0, 1); merge.connect(master);
      voices.set(event.id, voice);
      source.onended = () => {
        if (voices.get(event.id) !== voice || voice.generation !== generation) return;
        voices.delete(event.id); for (const node of voice.nodes) node.disconnect(); collect(); report('Sound ready');
      };
      source.start(0, event.startByte / blockAlign / asset.sampleRate);
    } catch (error) {
      voices.delete(event.id); for (const node of voice.nodes) node.disconnect(); throw error;
    }
  }
  return {
    async enable() {
      if (disposed) throw Error('Audio player disposed');
      wantedRunning = true;
      // Called directly from Run/Continue, preserving the browser's user gesture.
      if (!context) { context = contextFactory(); master = context.createGain(); master.connect(context.destination); }
      master.gain.value = muted ? 0 : 1;
      try {
        await Promise.race([
          context.resume(),
          new Promise(resolve => setTimeout(resolve, 500))
        ]);
      } catch (_) {}
      if (!wantedRunning) { await context.suspend(); return; }
      report('Sound enabled');
    },
    consume(batch, slab = new Uint8Array()) {
      if (!context || disposed) throw Error('Audio output is not enabled');
      if (!batch || batch.error || !Array.isArray(batch.events) || batch.events.length > 4096 ||
          !integer(batch.sequence, 1, Number.MAX_SAFE_INTEGER) || batch.sequence <= sequence)
        throw Error(batch?.error || 'Invalid or stale runtime audio batch');
      sequence = batch.sequence;
      for (const event of batch.events) {
        if (!integer(event.id, 1, 0xffffffff) || !integer(event.version, 0, 0xffffffff))
          throw Error('Invalid runtime sound identity');
        if (event.type === 'buffer') {
          const decoded = decodePcm(event, slab), memoryBytes = decoded.frames * 8;
          if (!current.has(event.id) && current.size >= 256) throw Error('Browser PCM buffer limit exceeded');
          collect();
          if (decodedBytes + memoryBytes > 64 * 1024 * 1024 || assets.has(key(event)))
            throw Error('Browser PCM memory limit or duplicate version');
          const buffer = context.createBuffer(2, decoded.frames, decoded.sampleRate);
          for (let channel = 0; channel < 2; ++channel) buffer.getChannelData(channel).set(decoded.output[channel]);
          assets.set(key(event), { ...decoded, output: undefined, buffer, memoryBytes });
          decodedBytes += memoryBytes; current.set(event.id, key(event)); collect();
        } else if (event.type === 'play') play(event);
        else if (event.type === 'stop') { stopVoice(event.id); collect(); }
        else if (event.type === 'release') { stopVoice(event.id); current.delete(event.id); collect(); }
        else if (event.type === 'params') { const voice = voices.get(event.id); if (voice) parameters(voice, event); }
        else if (event.type === 'position') {
          const voice = voices.get(event.id);
          if (voice) play({ ...event, loop: voice.loop, volumeHundredthDb: voice.volume,
            panHundredthDb: voice.pan, frequencyHz: voice.frequency });
        } else throw Error(`Unsupported runtime audio event: ${event.type}`);
      }
      collect(); report(voices.size ? 'Sound playing' : 'Sound ready');
    },
    setMuted(value) { muted = Boolean(value); if (master) master.gain.value = muted ? 0 : 1; report(muted ? 'Sound muted' : 'Sound enabled'); },
    pause() {
      wantedRunning = false; const pausedGeneration = generation;
      if (context) void context.suspend().then(() => {
        if (generation === pausedGeneration && !wantedRunning) report('Sound paused');
      }).catch(error => report(error.message));
    },
    reset() {
      wantedRunning = false; generation++; for (const id of [...voices.keys()]) stopVoice(id);
      assets.clear(); current.clear(); decodedBytes = 0; sequence = 0;
      if (context) void context.suspend().catch(error => report(error.message));
      report('Sound stopped');
    },
    async dispose() { this.reset(); disposed = true; if (context) await context.close(); },
    snapshot() { return { state: context?.state ?? 'unavailable', buffers: current.size,
      voices: voices.size, decodedBytes, muted, sequence }; },
    get context() { return context; },
    get destination() { return master; },
  };
}
