const vm = require('node:vm'),
  fs = require('node:fs'),
  assert = require('node:assert/strict');
const elements = new Map();
function el(id) {
  if (!elements.has(id))
    elements.set(id, {
      id,
      value: id.endsWith('rate')
        ? '0.9'
        : id.endsWith('lang') || id.endsWith('language')
          ? 'nl-BE'
          : '',
      textContent: '',
      options: [],
      classList: { add() {}, remove() {} },
      replaceChildren(...o) {
        this.options = o;
        this.children = [];
      },
      add(o) {
        this.options.push(o);
      },
      focus() {},
      append(node) {
        (this.children ||= []).push(node);
      },
    });
  return elements.get(id);
}
let current,
  cancelCount = 0;
const voices = [
  { voiceURI: 'dutch', name: 'Dutch test voice', lang: 'nl-BE' },
  { voiceURI: 'nl-nl', name: 'Dutch NL', lang: 'nl-NL' },
  { voiceURI: 'english', name: 'English', lang: 'en-GB' },
  { voiceURI: 'french', name: 'French', lang: 'fr-FR' },
  { voiceURI: 'dutch', name: 'Duplicate', lang: 'nl-BE' },
];
const synth = {
  getVoices: () => voices,
  addEventListener() {},
  speak(u) {
    current = u;
    u.onstart?.();
  },
  cancel() {
    cancelCount++;
    current?.onerror?.();
  },
};
const ctx = {
  window: { speechSynthesis: synth },
  document: {
    getElementById: el,
    querySelectorAll: () =>
      ['hello', 'love', 'sleep'].map((key) => {
        const b = el('phrase-' + key);
        b.dataset = { phrase: key };
        return b;
      }),
    querySelector: () => el('settings'),
    body: el('body'),
    createElement: () => ({
      textContent: '',
      append(node) {
        (this.children ||= []).push(node);
      },
    }),
  },
  fetch() {
    throw Error('Demo must not use the network');
  },
  URLSearchParams,
  location: { search: '?demo=1' },
  Option: function (text, value) {
    this.text = text;
    this.value = value;
  },
  SpeechSynthesisUtterance: function (text) {
    this.text = text;
  },
  localStorage: { getItem: () => null, setItem() {} },
  sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  setTimeout: () => 1,
  clearTimeout() {},
  Number,
  crypto: require('node:crypto').webcrypto,
};
vm.runInNewContext(fs.readFileSync('arcade/bear-talk/app.js', 'utf8'), ctx);
(async () => {
  assert.deepEqual(
    el('local-voice').options.map((o) => o.value),
    ['', 'dutch', 'nl-nl'],
  );
  el('local-voice').value = 'dutch';
  el('local-language').value = 'en-GB';
  el('local-language').onchange();
  assert.deepEqual(
    el('local-voice').options.map((o) => o.value),
    ['', 'english'],
  );
  assert.equal(el('local-voice').value, '');
  el('local-language').value = 'de-DE';
  el('local-language').onchange();
  assert.equal(el('local-voice').options.length, 1);
  assert.match(el('local-voice').options[0].text, /no matching/);
  el('local-language').value = 'nl-BE';
  el('local-language').onchange();
  el('demo-text').value = 'Hallo Riva';
  el('local-voice').value = 'dutch';
  el('local-rate').value = '0.6';
  const play = el('demo-speak').onclick();
  assert.equal(current.rate, 0.6);
  assert.equal(current.voice.voiceURI, 'dutch');
  assert.equal(el('speech-progress').textContent, 'Speaking…');
  await el('local-stop').onclick();
  await play;
  assert.equal(el('speech-progress').textContent, 'Stopped · Queue cleared');
  assert.ok(cancelCount);
  const repeat = el('local-repeat').onclick();
  assert.equal(current.text, 'Hallo Riva');
  current.onend();
  await repeat;
  assert.match(el('voice-health').textContent, /completed/);
  const failed = el('demo-speak').onclick();
  current.onerror();
  await failed;
  assert.match(el('voice-health').textContent, /attention/);
  assert.equal(el('remote').hidden, false);
  el('language').value = 'fr-FR';
  el('language').onchange();
  el('phrase-love').onclick();
  assert.match(el('message').value, /Je t’aime/);
  el('emotion').value = 'love';
  el('remote-voice').value = 'french';
  el('remote-rate').value = '0.7';
  await el('message-form').onsubmit({ preventDefault() {} });
  assert.equal(current.text, 'Je t’aime, Riva !');
  assert.equal(current.voice.voiceURI, 'french');
  assert.equal(current.rate, 0.7);
  assert.equal(el('bear').className, 'bear love');
  current.onend();
  await new Promise(setImmediate);
  assert.match(el('history').children[0].children[0].textContent, /Spoken/);
  await el('remote-repeat').onclick();
  assert.equal(current.text, 'Je t’aime, Riva !');
  await el('remote-stop').onclick();
  await new Promise(setImmediate);
  assert.match(el('history').children[0].children[0].textContent, /Stopped/);
  console.log(
    'PASS: full single-device remote composer, language-specific phrases, expression, selected voice and speed, history, repeat and stop; no network calls. Existing voice filtering/playback checks passed.',
  );
})();
