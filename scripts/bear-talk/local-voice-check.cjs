const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const turn = () => new Promise(setImmediate);
async function adapter() {
  const workers = [],
    timers = new Map();
  let timerId = 0,
    starts = 0,
    currentSource;
  class Worker {
    constructor(url) {
      this.url = url;
      workers.push(this);
    }
    postMessage(data) {
      this.last = data;
    }
    reply(data) {
      this.onmessage({ data: { id: this.last.id, ...data } });
    }
    terminate() {
      this.terminated = true;
    }
  }
  class AudioContext {
    state = 'suspended';
    resume() {
      this.state = 'running';
      return Promise.resolve();
    }
    createBuffer() {
      return { copyToChannel() {} };
    }
    createBufferSource() {
      currentSource = {
        connect() {},
        disconnect() {},
        start() {
          starts++;
        },
        stop() {},
      };
      return currentSource;
    }
  }
  const window = { Worker, WebAssembly, AudioContext };
  const ctx = {
    window,
    Worker,
    setTimeout(fn) {
      timers.set(++timerId, fn);
      return timerId;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  };
  vm.runInNewContext(
    fs.readFileSync('arcade/bear-talk/local-voice.js', 'utf8'),
    ctx,
  );
  const voice = window.BearLocalVoice;
  assert.equal(
    workers.length,
    0,
    'No download/worker until explicitly enabled',
  );
  await voice.unlock();
  const loading = voice.enable();
  assert.equal(workers.length, 1);
  workers[0].reply({ type: 'ready' });
  await loading;
  assert.equal(voice.ready, true);
  let onstart = 0;
  const speaking = voice.speak('Hallo Riva!', 0.8, () => onstart++);
  assert.equal(workers[0].last.text, 'Hallo Riva!');
  workers[0].reply({
    type: 'audio',
    pcm: new Float32Array(50),
    sampleRate: 22050,
  });
  await turn();
  assert.equal(starts, 1);
  assert.equal(onstart, 1);
  currentSource.onended();
  await speaking;
  const cancelled = voice.speak(
    'Stop voor de audio klaar is.',
    0.9,
    () => onstart++,
  );
  voice.stop();
  await assert.rejects(cancelled, /stopped/);
  assert.equal(workers[0].terminated, true);
  assert.equal(voice.ready, false);
  workers[0].reply({
    type: 'audio',
    pcm: new Float32Array(50),
    sampleRate: 22050,
  });
  await turn();
  assert.equal(starts, 1, 'Late worker output cannot play after Stop');
  const retry = voice.enable();
  workers[1].reply({ type: 'ready' });
  await retry;
  const playback = voice.speak('Nog eens.', 1, () => {});
  workers[1].reply({
    type: 'audio',
    pcm: new Float32Array(50),
    sampleRate: 22050,
  });
  await turn();
  voice.stop();
  await playback;
  assert.equal(voice.ready, true, 'Stopping audio preserves the loaded voice');
  const failed = voice.speak('Fout.', 1, () => {});
  workers[1].reply({ type: 'error', error: 'generation failed' });
  await assert.rejects(failed, /generation failed/);
  assert.equal(timers.size, 0);
}
async function worker() {
  const sent = [],
    urls = [],
    feeds = [],
    cached = new Map();
  let phonemizer,
    failStorage = false;
  const config = {
    audio: { sample_rate: 22050 },
    espeak: { voice: 'nl' },
    inference: { noise_scale: 0.667, length_scale: 1, noise_w: 0.8 },
  };
  const ctx = {
    self: {
      postMessage(data) {
        sent.push(data);
      },
    },
    fetch: async (url) => {
      urls.push(url);
      return new Response(
        url.endsWith('.json') ? JSON.stringify(config) : new Uint8Array([1, 2]),
      );
    },
    caches: {
      open: async () => {
        if (failStorage) throw Error('storage disabled');
        return {
          match: async (url) => cached.get(url)?.clone(),
          put: async (url, response) => cached.set(url, response),
        };
      },
    },
    importScripts(...urls) {
      assert.ok(urls.every((url) => /^https:/.test(url)));
    },
    ort: {
      env: { wasm: {} },
      Tensor: class {
        constructor(type, data) {
          this.type = type;
          this.data = data;
        }
      },
      InferenceSession: {
        create: async () => ({
          run: async (feed) => {
            feeds.push(feed);
            return { output: { data: new Float32Array([0.1, -0.2, 0.3]) } };
          },
        }),
      },
    },
    createPiperPhonemize: async (options) => {
      phonemizer = options;
      return {
        callMain(args) {
          const text = JSON.parse(args[3])[0].text;
          assert.ok(text.length <= 180);
          options.print(JSON.stringify({ phoneme_ids: [1, 4, 0, 2] }));
        },
      };
    },
    Response,
    Blob,
    BigInt64Array,
    Float32Array,
    BigInt,
    console,
  };
  vm.runInNewContext(
    fs.readFileSync('arcade/bear-talk/local-voice-worker.js', 'utf8'),
    ctx,
  );
  await ctx.self.onmessage({ data: { id: 1, type: 'load' } });
  assert.equal(sent.at(-1).type, 'ready');
  assert.equal(
    ctx.ort.env.wasm.numThreads,
    1,
    'Works without cross-origin isolation',
  );
  assert.equal(urls.length, 2);
  assert.ok(
    urls.every((url) => !url.includes('Riva')),
    'Only static assets are fetched',
  );
  assert.equal(cached.size, 2);
  await ctx.self.onmessage({
    data: { id: 2, type: 'speak', text: 'Hallo Riva! '.repeat(40), rate: 0.5 },
  });
  assert.equal(sent.at(-1).type, 'audio');
  assert.equal(sent.at(-1).sampleRate, 22050);
  assert.equal(feeds[0].scales.data[1], 2);
  assert.equal(urls.length, 2, 'No network requests during synthesis');
  assert.ok(phonemizer.noInitialRun);
  // Voice setup remains usable when a browser denies storage.
  failStorage = true;
  const isolated = {
    ...ctx,
    self: {
      postMessage(data) {
        sent.push(data);
      },
    },
  };
  vm.runInNewContext(
    fs.readFileSync('arcade/bear-talk/local-voice-worker.js', 'utf8'),
    isolated,
  );
  await isolated.self.onmessage({ data: { id: 3, type: 'load' } });
  assert.equal(sent.at(-1).type, 'ready');
}
(async () => {
  await adapter();
  await worker();
  console.log(
    'PASS: explicit opt-in, local audio, generation and audio cancellation, late output ignored, retry/error handling, single-thread WASM, bounded chunks, rate control, optional storage and no message text in network requests.',
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
