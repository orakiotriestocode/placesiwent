/* Optional on-device voice; no inference API, accounts or usage charges. */
(() => {
  'use strict';
  const URI = 'bear-local:nathalie-nl-BE';
  let worker,
    audio,
    source,
    pending,
    sequence = 0,
    ready = false,
    loading,
    finishAudio;
  const supported = !!(
    window.Worker &&
    window.WebAssembly &&
    (window.AudioContext || window.webkitAudioContext)
  );
  function unlock() {
    if (!supported) return;
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    return audio.resume();
  }
  function reset(error = new Error('Voice stopped')) {
    ready = false;
    worker?.terminate();
    worker = null;
    if (pending) {
      const p = pending;
      pending = null;
      clearTimeout(p.timeout);
      p.reject(error);
    }
  }
  function request(type, data = {}, onprogress) {
    return new Promise((resolve, reject) => {
      if (pending) {
        reject(new Error('Voice is busy'));
        return;
      }
      const id = ++sequence;
      pending = {
        id,
        resolve,
        reject,
        onprogress,
        timeout: setTimeout(
          () => reset(new Error('Voice preparation took too long')),
          180000,
        ),
      };
      worker.postMessage({ id, type, ...data });
    });
  }
  function enable(onprogress) {
    if (ready) return Promise.resolve();
    if (loading) return loading;
    if (!supported)
      return Promise.reject(new Error('Local voice is unavailable'));
    worker = new Worker('local-voice-worker.js?v=0.5.0');
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') {
        pending?.onprogress?.(data.text);
        return;
      }
      if (!pending || data.id !== pending.id) return;
      const p = pending;
      pending = null;
      clearTimeout(p.timeout);
      if (data.type === 'error') p.reject(new Error(data.error));
      else p.resolve(data);
    };
    worker.onerror = () => reset(new Error('Local voice could not start'));
    loading = request('load', {}, onprogress)
      .then(() => {
        ready = true;
      })
      .catch((e) => {
        reset();
        throw e;
      })
      .finally(() => {
        loading = null;
      });
    return loading;
  }
  function stop() {
    if (source) {
      const s = source;
      source = null;
      s.onended = null;
      s.stop();
      s.disconnect();
      finishAudio?.();
      finishAudio = null;
    }
    // Terminating a generation prevents late audio from playing after Stop.
    if (pending) reset();
  }
  async function speak(text, rate, onstart, onprogress) {
    if (!ready) throw Error('Enable Nathalie on the bear screen first');
    const result = await request('speak', { text, rate }, onprogress);
    if (audio?.state !== 'running')
      throw Error('Tap Test voice to enable sound');
    const buffer = audio.createBuffer(1, result.pcm.length, result.sampleRate);
    buffer.copyToChannel(result.pcm, 0);
    return new Promise((resolve, reject) => {
      try {
        source = audio.createBufferSource();
        source.buffer = buffer;
        source.connect(audio.destination);
        finishAudio = resolve;
        source.onended = () => {
          source?.disconnect();
          source = null;
          finishAudio = null;
          resolve();
        };
        source.start();
        onstart();
      } catch (e) {
        reject(e);
      }
    });
  }
  window.BearLocalVoice = {
    URI,
    supported,
    enable,
    unlock,
    stop,
    speak,
    get ready() {
      return ready;
    },
  };
})();
