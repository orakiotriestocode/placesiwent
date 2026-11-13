const vm = require('node:vm'),
  fs = require('node:fs'),
  assert = require('node:assert/strict');
const plain = { closest: () => false };
const nodes = [
  { nodeValue: 'What should bear say?', parentElement: plain },
  {
    nodeValue: ' Happy ',
    parentElement: { closest: (s) => s.includes('#bubble') },
  },
  { nodeValue: 'Stopped · Queue cleared', parentElement: plain },
];
const picker = { value: '' },
  spoken = { value: 'fr-FR' },
  store = new Map();
let mutation;
const ctx = {
  window: {},
  localStorage: {
    getItem: (k) => store.get(k),
    setItem: (k, v) => store.set(k, v),
  },
  NodeFilter: { SHOW_TEXT: 4 },
  MutationObserver: function (cb) {
    mutation = cb;
    this.observe = () => {};
  },
  document: {
    documentElement: {},
    body: {},
    getElementById: (id) => (id === 'ui-language' ? picker : spoken),
    createTreeWalker() {
      let i = 0;
      return { nextNode: () => nodes[i++] };
    },
    querySelectorAll: () => [],
  },
};
vm.runInNewContext(fs.readFileSync('arcade/bear-talk/i18n.js', 'utf8'), ctx);
const ui = ctx.window.BearI18n;
ui.setLanguage('nl');
assert.equal(nodes[0].nodeValue, 'Wat mag beer zeggen?');
assert.equal(nodes[1].nodeValue, ' Happy ');
assert.equal(nodes[2].nodeValue, 'Gestopt · Wachtrij gewist');
assert.equal(spoken.value, 'fr-FR');
assert.equal(store.get('bear-ui-language'), 'nl');
assert.equal(ui.translate('Speak to Riva ✦'), 'Spreek tegen Riva ✦');
assert.equal(ui.translate('Phrase 20 / 20'), 'Zin 20 / 20');
ui.setLanguage('es');
assert.equal(nodes[0].nodeValue, '¿Qué debe decir osito?');
nodes[2].nodeValue = 'Finished speaking ✓';
mutation();
assert.equal(nodes[2].nodeValue, 'Terminado ✓');
ui.setLanguage('fr');
assert.equal(nodes[0].nodeValue, 'Que doit dire l’ours ?');
ui.setLanguage('de');
assert.equal(nodes[0].nodeValue, 'Was soll Bär sagen?');
ui.setLanguage('en');
assert.equal(nodes[0].nodeValue, 'What should bear say?');
assert.equal(nodes[1].nodeValue, ' Happy ');
assert.equal(nodes[2].nodeValue, 'Finished speaking ✓');
console.log(
  'PASS: five interface languages, dynamic statuses, translated send button/count, persistence, reversible switching, spoken-language independence and untouched bear content.',
);
