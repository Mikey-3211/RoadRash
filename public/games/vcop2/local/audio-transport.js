const exports = ['_vcop2_audio_enable', '_vcop2_audio_drain_json', '_vcop2_audio_data', '_vcop2_audio_size'];
export function configureAudio(module, enabled) {
  if (!enabled) { if (typeof module._vcop2_audio_enable === 'function') module._vcop2_audio_enable(0); return; }
  if (exports.some(name => typeof module[name] !== 'function')) throw Error('This runtime build does not support sound output');
  if (module._vcop2_audio_enable(1) !== 0) throw Error(module.UTF8ToString(module._vcop2_result_json()));
}

export function forwardAudio(module, post) {
  const json = module._vcop2_audio_drain_json();
  if (!json) return; // No pending events; no JSON read or allocation.
  const batch = JSON.parse(module.UTF8ToString(json));
  if (batch.error) throw Error(`Runtime audio: ${batch.error}`);
  const pointer = module._vcop2_audio_data(), size = module._vcop2_audio_size();
  if (!Number.isSafeInteger(pointer) || pointer < 0 || !Number.isSafeInteger(size) || size < 0 ||
      size > 16 * 1024 * 1024 || pointer + size > module.HEAPU8.length)
    throw Error('Runtime audio PCM slab is outside Wasm memory');
  // Exported addresses are host Wasm-buffer offsets, not guest pointers. Copy
  // before another drain/reset can invalidate the native-owned byte slab.
  const pcm = module.HEAPU8.slice(pointer, pointer + size);
  post({ type: 'audio', batch, pcm }, [pcm.buffer]);
}

export function configureCdAudio(module, tracks = []) {
  if (!Array.isArray(tracks) || tracks.length > 98) throw Error('Invalid music disc track list');
  if (!tracks.length) return false;
  if (['_vcop2_cd_audio_track', '_vcop2_cd_audio_enable', '_vcop2_cd_audio_drain_json'].some(name => typeof module[name] !== 'function'))
    throw Error('This runtime build does not support CD music');
  let previous = 1;
  for (const {number, lengthFrames} of tracks) {
    if (!Number.isInteger(number) || number <= previous || number > 99 ||
        !Number.isInteger(lengthFrames) || lengthFrames < 1 || lengthFrames > 0xffffffff)
      throw Error('Invalid music disc track metadata');
    if (module._vcop2_cd_audio_track(number, lengthFrames) !== 0)
      throw Error(module.UTF8ToString(module._vcop2_result_json()));
    previous = number;
  }
  if (module._vcop2_cd_audio_enable(1) !== 0) throw Error(module.UTF8ToString(module._vcop2_result_json()));
  return true;
}

export function forwardCdAudio(module, post) {
  const pointer = module._vcop2_cd_audio_drain_json();
  if (!pointer) return;
  const batch = JSON.parse(module.UTF8ToString(pointer));
  if (batch.error) throw Error(`Runtime CD audio: ${batch.error}`);
  post({ type: 'cd-audio', batch });
}
