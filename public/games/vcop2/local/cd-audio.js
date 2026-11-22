const SECTOR = 2352, SAMPLES_PER_SECTOR = 588;
const uint = (n, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(n) && n >= 0 && n <= max;
export function parseCdCue(text, bin) {
  if (typeof text !== 'string' || text.length > 262144 || !bin || !uint(bin.size) ||
      !bin.size || bin.size % SECTOR) throw Error('Choose a valid CUE and matching raw BIN image');
  let fileName, track;
  const tracks = [];
  for (const source of text.split(/\r?\n/)) {
    const line = source.trim();
    let match;
    if ((match = /^FILE\s+"([^"]+)"\s+(\S+)$/i.exec(line))) {
      if (fileName || match[2].toUpperCase() !== 'BINARY') throw Error('Music requires one little-endian BINARY BIN file');
      fileName = match[1].split(/[\\/]/).at(-1);
    } else if ((match = /^TRACK\s+(\d+)\s+(\S+)$/i.exec(line))) {
      if (!fileName) throw Error('CUE track precedes its file');
      const number = Number(match[1]), mode = match[2].toUpperCase();
      if (!uint(number, 99) || number !== tracks.length + 1 ||
          (number === 1 ? mode !== 'MODE1/2352' : mode !== 'AUDIO'))
        throw Error('Unsupported CUE track layout');
      track = { number, mode }; tracks.push(track);
    } else if ((match = /^INDEX\s+01\s+(\d+):(\d+):(\d+)$/i.exec(line))) {
      const [minutes, seconds, frames] = match.slice(1).map(Number);
      if (!track || track.startFrame !== undefined || !uint(minutes, 9999) || !uint(seconds, 59) || !uint(frames, 74))
        throw Error('Invalid CUE INDEX 01');
      track.startFrame = (minutes * 60 + seconds) * 75 + frames;
    } else if (/^(FILE|TRACK|INDEX\s+01)\b/i.test(line)) throw Error('Malformed CUE declaration');
    // PREGAP describes generated silence outside the BIN. INDEX 01 already
    // addresses bytes in the file; never add PREGAP to these offsets.
  }
  if (!fileName || fileName.toLowerCase() !== bin.name.toLowerCase() || tracks.length < 2)
    throw Error('Select the BIN named by the CUE, including its data track');
  const sectors = bin.size / SECTOR;
  for (let i = 0; i < tracks.length; ++i) {
    const current = tracks[i], end = tracks[i + 1]?.startFrame ?? sectors;
    if (!uint(current.startFrame) || !uint(end) || end <= current.startFrame || end > sectors)
      throw Error('CUE track boundaries exceed the selected BIN');
    current.lengthFrames = end - current.startFrame;
  }
  return { bin, tracks: tracks.filter(item => item.mode === 'AUDIO') };
}

export async function readCdClip(disc, trackNumber, fromFrame, toFrame, signal) {
  const track = disc?.tracks.find(item => item.number === trackNumber);
  if (!track || !uint(fromFrame) || !uint(toFrame) || fromFrame >= toFrame || toFrame > track.lengthFrames)
    throw Error('CD playback range is outside the selected track');
  const bytes = (toFrame - fromFrame) * SECTOR;
  if (bytes > 64 * 1024 * 1024) throw Error('CD playback clip exceeds the browser audio limit');
  const start = (track.startFrame + fromFrame) * SECTOR;
  signal?.throwIfAborted();
  const raw = await disc.bin.slice(start, start + bytes).arrayBuffer({ signal });
  signal?.throwIfAborted();
  if (raw.byteLength !== bytes) throw Error('Could not read the complete selected CD track');
  const count = (toFrame - fromFrame) * SAMPLES_PER_SECTOR;
  const data = new DataView(raw), channels = [new Float32Array(count), new Float32Array(count)];
  // CUE FILE BINARY stores CDDA signed 16-bit stereo in little-endian order.
  for (let i = 0; i < count; ++i) {
    channels[0][i] = data.getInt16(i * 4, true) / 32768;
    channels[1][i] = data.getInt16(i * 4 + 2, true) / 32768;
  }
  return { channels, sampleRate: 44100, frames: count };
}

// Two-second PCM reads and at most four seconds scheduled ahead keep CD traffic
// bounded during online play. Original track selection and timing remain intact.
export function createCdAudioPlayer({ getContext, getDestination, onStatus = () => {},
  setTimeoutFn = globalThis.setTimeout, clearTimeoutFn = globalThis.clearTimeout }) {
  const chunkFrames = 150, aheadSeconds = 4;
  let disc, generation = 0, sequence = 0n, timer, controller;
  const sources = new Set();
  function stop() {
    generation++;
    clearTimeoutFn(timer); timer = undefined;
    controller?.abort(); controller = undefined;
    for (const node of sources) {
      node.onended = null;
      try { node.stop(); } catch { /* Already ended. */ }
      node.disconnect();
    }
    sources.clear();
  }
  return {
    setDisc(value) { stop(); sequence = 0n; disc = value; },
    tracks() { return disc?.tracks.map(({ number, lengthFrames }) => ({ number, lengthFrames })) ?? []; },
    consume(batch) {
      if (!batch || batch.error || batch.schema !== 1 || !Array.isArray(batch.events) || batch.events.length > 4096)
        return Promise.reject(Error(batch?.error || 'Invalid CD audio event batch'));
      const jobs = [];
      for (const event of batch.events) {
        if (!/^[1-9][0-9]{0,19}$/.test(event.sequence ?? '') || BigInt(event.sequence) <= sequence ||
            BigInt(event.sequence) > 18446744073709551615n)
          return Promise.reject(Error('Invalid or stale CD audio event sequence'));
        sequence = BigInt(event.sequence);
        if (!['cd-play', 'cd-pause', 'cd-stop'].includes(event.type))
          return Promise.reject(Error(`Unsupported CD audio event: ${event.type}`));
        stop();
        if (event.type !== 'cd-play') { onStatus(event.type === 'cd-pause' ? 'Music paused' : 'Music stopped'); continue; }
        const track = disc?.tracks.find(item => item.number === event.track);
        if (!track || !uint(event.fromFrame) || !uint(event.toFrame) ||
            event.fromFrame > event.toFrame || event.toFrame > track.lengthFrames)
          return Promise.reject(Error('CD playback range is outside the selected track'));
        if (event.fromFrame === event.toFrame) { onStatus('Music ready'); continue; }
        const operation = generation, context = getContext(), selectedDisc = disc;
        if (!context || !disc) return Promise.reject(Error('Select a music disc and enable sound before playback'));
        const signal = (controller = new AbortController()).signal;
        const anchor = context.currentTime;
        let cursor = event.fromFrame;
        const live = () => operation === generation && !signal.aborted;
        const later = () => { if (live()) timer = setTimeoutFn(() => {
          timer = undefined;
          void pump().catch(() => {
            if (live()) { stop(); onStatus('Music unavailable; gameplay continues'); }
          });
        }, 250); };
        async function pump() {
          if (!live()) return;
          // AudioContext time stops while paused. Do not download a track while
          // suspended or run timers through an already-buffered track.
          if (context.state === 'suspended') { later(); return; }
          while (live() && cursor < event.toFrame) {
            if (context.state === 'suspended') break;
            const elapsedFrames = Math.max(0, Math.floor((context.currentTime - anchor) * 75));
            // A late read must not start stale audio or cause a catch-up burst.
            cursor = Math.max(cursor, Math.min(event.toFrame, event.fromFrame + elapsedFrames));
            if (cursor >= event.toFrame) break;
            const ahead = (cursor - event.fromFrame) / 75 - (context.currentTime - anchor);
            if (ahead > aheadSeconds - chunkFrames / 75) break;
            const from = cursor, end = Math.min(event.toFrame, from + chunkFrames);
            const clip = await readCdClip(selectedDisc, event.track, from, end, signal);
            if (!live()) return;
            cursor = end;
            const when = anchor + (from - event.fromFrame) / 75;
            const duration = clip.frames / clip.sampleRate;
            if (context.currentTime - when >= duration) continue;
            const buffer = context.createBuffer(2, clip.frames, clip.sampleRate);
            for (let channel = 0; channel < 2; ++channel) buffer.getChannelData(channel).set(clip.channels[channel]);
            const node = context.createBufferSource(); node.buffer = buffer; node.connect(getDestination());
            // Account for allocation/copy time too, so a late chunk still ends
            // at the next chunk's scheduled sample boundary.
            const now = context.currentTime, offset = Math.max(0, now - when);
            if (offset >= duration) { node.disconnect(); continue; }
            sources.add(node);
            node.onended = () => {
              sources.delete(node); node.disconnect();
              if (live() && cursor >= event.toFrame && !sources.size) onStatus('Music ready');
            };
            node.start(Math.max(now, when), offset);
            onStatus(`Playing original CD track ${event.track}`);
          }
          if (live() && cursor < event.toFrame) later();
        }
        jobs.push(Promise.resolve().then(pump).catch(error => {
          if (live()) { stop(); throw error; }
        }));
      }
      return Promise.all(jobs);
    },
    reset() { stop(); sequence = 0n; onStatus(disc ? 'Music stopped; selected disc ready' : 'No music disc selected'); },
  };
}
