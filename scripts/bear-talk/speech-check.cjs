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
      },
      add(o) {
        this.options.push(o);
      },
      focus() {},
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
  document: { getElementById: el, querySelectorAll: () => [] },
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
  console.log(
    'PASS: language filtering, regional ordering, deduplication, language switching and empty fallback; actual app handlers select voice/speed, show speaking, stop without blocked error, repeat exact text, and report failed playback.',
  );
})();
