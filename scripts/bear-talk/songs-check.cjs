const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
let timers = [],
  stopped = 0;
const param = { setValueAtTime() {}, linearRampToValueAtTime() {} };
class AudioContext {
  state = 'running';
  currentTime = 0;
  async resume() {}
  node() {
    return {
      connect() {},
      disconnect() {},
      start() {},
      stop() {
        stopped++;
      },
      gain: param,
      frequency: { value: 0 },
    };
  }
  createOscillator() {
    return this.node();
  }
  createGain() {
    return this.node();
  }
  createBiquadFilter() {
    return this.node();
  }
}
const window = { AudioContext };
vm.runInNewContext(fs.readFileSync('arcade/bear-talk/songs.js', 'utf8'), {
  window,
  setTimeout(fn) {
    timers.push(fn);
    return fn;
  },
  clearTimeout(fn) {
    timers = timers.filter((x) => x !== fn);
  },
});
(async () => {
  const songs = window.BearSongs;
  assert.equal(songs.songs.length, 4);
  assert.equal(songs.parse('hello'), null);
  assert.equal(songs.parse('♫ animal-song:4'), null);
  for (let i = 0; i < 4; i++) {
    assert.equal(songs.parse(songs.message(i)), i);
    let beats = 0;
    const result = songs.play(i, 'frog', () => beats++);
    await new Promise(setImmediate);
    [...timers].forEach((fn) => fn());
    assert.equal(await result, 'spoken');
    assert.equal(beats, songs.songs[i].notes.length);
    assert.equal(timers.length, 0);
  }
  const cancelled = songs.play(0, 'goose', () => assert.fail('Late animation'));
  await new Promise(setImmediate);
  songs.stop();
  assert.equal(await cancelled, 'stopped');
  assert.equal(timers.length, 0);
  assert(stopped > 0);
  console.log(
    'PASS: four original melodies, strict song protocol, note callbacks, completion, Stop and timer cleanup.',
  );
})();
