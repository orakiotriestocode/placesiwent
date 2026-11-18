const vm = require('node:vm'),
  fs = require('node:fs'),
  assert = require('node:assert/strict');
function setup(saved = 'goose', denied = false) {
  const nodes = new Map(),
    buttons = ['bear', 'goose', 'frog'].map((animal) => ({
      dataset: { animalChoice: animal },
      setAttribute(key, value) {
        this[key] = value;
      },
    }));
  const el = (id) => {
    if (!nodes.has(id))
      nodes.set(id, {
        textContent: '',
        attrs: { 'aria-label': 'A friendly bear · Giggling' },
        setAttribute(k, v) {
          this.attrs[k] = v;
        },
        getAttribute(k) {
          return this.attrs[k];
        },
      });
    return nodes.get(id);
  };
  const storage = new Map([['bear-animal', saved]]);
  const ctx = {
    window: {},
    document: { getElementById: el, querySelectorAll: () => buttons },
    localStorage: {
      getItem: (k) => {
        if (denied) throw Error('denied');
        return storage.get(k);
      },
      setItem: (k, v) => {
        if (denied) throw Error('denied');
        storage.set(k, v);
      },
    },
  };
  vm.runInNewContext(
    fs.readFileSync('arcade/bear-talk/animals.js', 'utf8'),
    ctx,
  );
  vm.runInNewContext(
    fs.readFileSync('arcade/bear-talk/phrases.js', 'utf8'),
    ctx,
  );
  return {
    animals: ctx.window.BearAnimals,
    banks: ctx.window.BearPhrases,
    el,
    buttons,
    storage,
  };
}
const { animals, banks, el, buttons, storage } = setup();
assert.equal(animals.selected, 'goose');
assert.equal(el('bear').attrs['data-animal'], 'goose');
assert.match(el('bear').attrs['aria-label'], /goose.*Giggling/);
assert.equal(buttons.filter((b) => b['aria-pressed'] === 'true').length, 1);
assert.equal(animals.set('untrusted'), false);
assert.equal(animals.selected, 'goose');
for (const animal of ['bear', 'goose', 'frog']) {
  animals.set(animal);
  assert.equal(storage.get('bear-animal'), animal);
  for (const [lang, bank] of Object.entries(banks))
    for (const phrases of Object.values(bank)) {
      const converted = phrases.map((text) => animals.phrase(text, lang));
      assert.equal(converted.length, 20);
      assert.equal(new Set(converted).size, 20);
      if (animal !== 'bear')
        for (const text of converted)
          assert.ok(
            !/\bbear\b|\bBeer\b|beertje|beren|\bours\b|Bär|osito|\boso\b/i.test(
              text,
            ),
            text,
          );
    }
}
assert.match(animals.phrase(banks.nl.hello[0], 'nl-BE'), /kikker/);
assert.match(
  animals.phrase(banks.fr.hello[0], 'fr-FR'),
  /ta petite grenouille/,
);
assert.match(animals.caption('feet', 'default'), /Hop/);
animals.set('goose');
assert.match(animals.phrase(banks.de.hello[0], 'de-DE'), /deine kleine Gans/);
assert.match(animals.caption('paw', 'default'), /wing/);
assert.match(el('touch-hint').textContent, /wings/);
let chosen;
animals.bindPicker((value) => (chosen = value));
buttons[2].onclick();
assert.equal(chosen, 'frog');
assert.equal(setup('dragon').animals.selected, 'bear');
assert.equal(setup('frog', true).animals.selected, 'bear');
console.log(
  'PASS: saved animal and fallback, exclusive accessible choice, all 900 localized preset variants, species-specific touch text, preserved reaction label and unavailable-storage handling.',
);
