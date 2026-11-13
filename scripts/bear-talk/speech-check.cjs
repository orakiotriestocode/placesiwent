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
      setAttribute(name, value) {
        this[name] = value;
      },
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
    querySelectorAll: (selector) =>
      (selector === '[data-reaction]'
        ? ['happy', 'wave', 'love', 'giggle', 'sleepy', 'tilt', 'neutral']
        : ['hello', 'love', 'sleep']
      ).map((key) => {
        const reaction = selector === '[data-reaction]';
        const b = el((reaction ? 'reaction-' : 'phrase-') + key);
        b.dataset = reaction ? { reaction: key } : { phrase: key };
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
vm.runInNewContext(fs.readFileSync('arcade/bear-talk/pairing.js', 'utf8'), ctx);
vm.runInNewContext(fs.readFileSync('arcade/bear-talk/phrases.js', 'utf8'), ctx);
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
  const speaking = current;
  const oldHistory = el('history').children.length;
  el('giggle-sound').checked = true;
  await el('reaction-wave').onclick();
  assert.equal(current, speaking);
  assert.equal(el('bear').className, 'bear wave talking');
  await el('reaction-giggle').onclick();
  assert.equal(current, speaking);
  assert.equal(el('history').children.length, oldHistory);
  current.onend();
  await new Promise(setImmediate);
  assert.match(el('history').children[0].children[0].textContent, /Spoken/);
  await el('remote-repeat').onclick();
  assert.equal(current.text, 'Je t’aime, Riva !');
  await el('remote-stop').onclick();
  await new Promise(setImmediate);
  assert.match(el('history').children[0].children[0].textContent, /Stopped/);
  el('giggle-sound').checked = false;
  for (const name of [
    'happy',
    'wave',
    'love',
    'giggle',
    'sleepy',
    'tilt',
    'neutral',
  ]) {
    await el('reaction-' + name).onclick();
    assert.equal(el('bear').className, 'bear ' + name);
  }
  const entries = el('history').children.length;
  el('giggle-sound').checked = true;
  await el('reaction-giggle').onclick();
  assert.match(current.text, /Hi hi/);
  current.onend();
  await new Promise(setImmediate);
  assert.equal(el('history').children.length, entries);
  for (const [lang, bank] of Object.entries(ctx.window.BearPhrases))
    for (const [category, entries] of Object.entries(bank)) {
      assert.equal(entries.length, 20);
      assert.equal(new Set(entries).size, 20);
    }
  el('language').value = 'de-DE';
  el('language').onchange();
  const cycle = [];
  for (let i = 0; i < 20; i++) {
    el('phrase-hello').onclick();
    cycle.push(el('message').value);
  }
  assert.equal(new Set(cycle).size, 20);
  el('phrase-hello').onclick();
  assert.equal(el('message').value, cycle[0]);
  assert.equal(el('emotion').value, 'happy');
  assert.match(el('phrase-status').textContent, /1 \/ 20/);
  for (const lang of ['en-GB', 'nl-BE', 'fr-FR', 'de-DE', 'es-ES'])
    for (const category of ['hello', 'love', 'sleep']) {
      el('language').value = lang;
      el('language').onchange();
      const batch = [];
      for (let i = 0; i < 20; i++) {
        el('phrase-' + category).onclick();
        batch.push(el('message').value);
      }
      assert.equal(new Set(batch).size, 20);
      el('phrase-' + category).onclick();
      assert.equal(el('message').value, batch[0]);
    }
  console.log(
    'PASS: 300 distinct localized phrases, all 15 phrase cycles wrap after 20 entries; independent reactions do not add speech messages or interrupt active speech; optional idle giggle, all seven expressions, demo controls, voice filtering, stop and repeat.',
  );
})();
