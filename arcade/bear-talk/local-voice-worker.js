/* Free local synthesis. Downloads are static assets; message text never leaves
   this worker. Pinned sources and licences: local-voice-notices.md. */
'use strict';
const MODEL =
  'https://huggingface.co/rhasspy/piper-voices/resolve/36915ed3d066024c63841a1d20f29edcdbc37c14/nl/nl_BE/nathalie/medium/nl_BE-nathalie-medium.onnx';
const PIPER =
  'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize';
const ORT = 'https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.18.0/';
let session, config, phonemizer, phonemeOutput;
function progress(text) {
  self.postMessage({ type: 'progress', text });
}
async function asset(url, label) {
  let cache;
  try {
    cache = await caches.open('bear-local-voice-v1');
    const hit = await cache.match(url);
    if (hit) {
      progress('Loading saved voice…');
      return hit;
    }
  } catch {
    /* Storage is optional, including private browsing. */
  }
  const response = await fetch(url);
  if (!response.ok)
    throw Error('Voice download failed (' + response.status + ')');
  if (!response.body) return response;
  const reader = response.body.getReader(),
    chunks = [];
  let size = 0,
    last = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
    if (size - last > 1024 * 1024) {
      last = size;
      progress(label + ' · ' + Math.round(size / 1024 / 1024) + ' MB');
    }
  }
  const saved = new Response(new Blob(chunks), {
    headers: {
      'Content-Type':
        response.headers.get('Content-Type') || 'application/octet-stream',
    },
  });
  try {
    await cache?.put(url, saved.clone());
  } catch {
    /* Continue in memory. */
  }
  return saved;
}
async function load() {
  if (session) return;
  progress('Loading speech engine…');
  importScripts(ORT + 'ort.min.js', PIPER + '.js');
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = ORT;
  config = await (
    await asset(MODEL + '.json', 'Downloading voice settings')
  ).json();
  const model = await (
    await asset(MODEL, 'Downloading Nathalie')
  ).arrayBuffer();
  progress('Preparing voice on this device…');
  session = await ort.InferenceSession.create(model, {
    executionProviders: ['wasm'],
  });
  phonemizer = await createPiperPhonemize({
    noInitialRun: true,
    locateFile: (file) =>
      file.endsWith('.wasm')
        ? PIPER + '.wasm'
        : file.endsWith('.data')
          ? PIPER + '.data'
          : file,
    print: (line) => {
      phonemeOutput.push(...JSON.parse(line).phoneme_ids);
    },
    printErr: (line) => console.warn('Piper:', line),
  });
}
function chunks(text) {
  // Bound peak memory on tablets, including a long sentence without punctuation.
  return (
    text.match(/[^.!?\n]+[.!?\n]*|[.!?]+/gu)?.flatMap((sentence) => {
      const parts = [];
      while (sentence.length > 180) {
        let end = sentence.lastIndexOf(' ', 180);
        if (end < 60) end = 180;
        parts.push(sentence.slice(0, end));
        sentence = sentence.slice(end).trimStart();
      }
      if (sentence.trim()) parts.push(sentence);
      return parts;
    }) || []
  );
}
self.onmessage = async ({ data }) => {
  const { id, type } = data;
  try {
    if (type === 'load') {
      await load();
      self.postMessage({ id, type: 'ready' });
      return;
    }
    if (type !== 'speak' || !session) throw Error('Voice is not ready');
    const pieces = chunks(String(data.text).slice(0, 500)),
      output = [];
    for (let i = 0; i < pieces.length; i++) {
      progress('Preparing speech…');
      phonemeOutput = [];
      phonemizer.callMain([
        '-l',
        config.espeak.voice,
        '--input',
        JSON.stringify([{ text: pieces[i] }]),
        '--espeak_data',
        '/espeak-ng-data',
      ]);
      if (!phonemeOutput.length) throw Error('No phonemes generated');
      const ids = BigInt64Array.from(phonemeOutput, BigInt);
      const result = await session.run({
        input: new ort.Tensor('int64', ids, [1, ids.length]),
        input_lengths: new ort.Tensor(
          'int64',
          BigInt64Array.of(BigInt(ids.length)),
          [1],
        ),
        scales: new ort.Tensor(
          'float32',
          Float32Array.of(
            config.inference.noise_scale,
            config.inference.length_scale /
              Math.max(0.5, Math.min(1.5, Number(data.rate) || 0.9)),
            config.inference.noise_w,
          ),
          [3],
        ),
      });
      output.push(new Float32Array(result.output.data));
      result.output.dispose?.();
    }
    const pcm = new Float32Array(
      output.reduce((n, part) => n + part.length, 0),
    );
    let offset = 0;
    for (const part of output) {
      pcm.set(part, offset);
      offset += part.length;
    }
    self.postMessage(
      { id, type: 'audio', pcm, sampleRate: config.audio.sample_rate },
      [pcm.buffer],
    );
  } catch (error) {
    self.postMessage({
      id,
      type: 'error',
      error: String(error.message || error),
    });
  }
};
