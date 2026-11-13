const vm = require('node:vm'),
  fs = require('node:fs'),
  assert = require('node:assert/strict');
const qr = require('../../assets/vendor/qrcode-generator-2.0.4.js');
const helper = { window: {}, URL, URLSearchParams };
vm.runInNewContext(
  fs.readFileSync('arcade/bear-talk/pairing.js', 'utf8'),
  helper,
);
const pairing = helper.window.BearPairing;
const link = pairing.link(
  'ABCDE23456',
  'https://placesiwent.eu/arcade/bear-talk/?demo=1#old',
  'nl',
);
assert.equal(
  link,
  'https://placesiwent.eu/arcade/bear-talk/#pair=ABCDE23456&ui=nl',
);
assert.equal(new URL(link).search, '');
assert.equal(pairing.readHash(new URL(link).hash).code, 'ABCDE23456');
assert.equal(pairing.readHash('#pair=bad').code, null);
assert.equal(pairing.readHash('#other=yes'), null);
assert.throws(() => pairing.link('bad', 'https://placesiwent.eu/'));
assert.equal(
  pairing.deadline({ expires: new Date(7200000).toISOString() }),
  600000,
);
const code = qr(0, 'M');
code.addData(link);
code.make();
assert.match(code.createSvgTag({ cellSize: 4, margin: 16 }), /<svg/);
if (process.env.BEAR_QR_DECODER) {
  const decode = require(process.env.BEAR_QR_DECODER),
    scale = 6,
    margin = 4,
    n = code.getModuleCount(),
    size = (n + 2 * margin) * scale,
    data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (code.isDark(y, x))
        for (let dy = 0; dy < scale; dy++)
          for (let dx = 0; dx < scale; dx++) {
            const i =
              (((y + margin) * scale + dy) * size + (x + margin) * scale + dx) *
              4;
            data[i] = data[i + 1] = data[i + 2] = 0;
          }
  assert.equal(decode(data, size, size).data, link);
  console.log('PASS: independent QR decoder recovered the exact pairing link.');
}
async function appTest(hash, fail = false) {
  const nodes = new Map(),
    calls = [];
  let scrubbed = false,
    language;
  const el = (id) => {
    if (!nodes.has(id))
      nodes.set(id, {
        value:
          id.endsWith('language') || id.endsWith('lang')
            ? 'nl-BE'
            : id.endsWith('rate')
              ? '0.9'
              : '',
        textContent: '',
        options: [],
        classList: { add() {}, remove() {} },
        replaceChildren(...a) {
          this.options = a;
        },
        add(o) {
          this.options.push(o);
        },
        append() {},
        focus() {},
        setAttribute() {},
      });
    return nodes.get(id);
  };
  const ctx = {
    window: {
      BearPairing: pairing,
      BearI18n: { setLanguage: (l) => (language = l) },
      speechSynthesis: { getVoices: () => [], addEventListener() {} },
    },
    URLSearchParams,
    URL,
    location: { hash, search: '', pathname: '/arcade/bear-talk/' },
    history: {
      replaceState() {
        scrubbed = true;
      },
    },
    localStorage: { getItem: () => null, setItem() {} },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { getElementById: el, querySelectorAll: () => [] },
    Option: function (text, value) {
      this.text = text;
      this.value = value;
    },
    AbortSignal,
    setTimeout: () => 1,
    clearTimeout() {},
    fetch: async (url, opts) => {
      const b = JSON.parse(opts.body);
      calls.push(b);
      return {
        ok: !fail,
        status: fail ? 403 : 200,
        json: async () =>
          fail
            ? {
                error:
                  'Code unavailable, expired or already paired. Start a new tablet session.',
              }
            : b.action === 'join'
              ? {
                  id: 'session',
                  token: 'remote',
                  expires: new Date(Date.now() + 7200000).toISOString(),
                }
              : { messages: [], paired: true, online: true },
      };
    },
  };
  vm.runInNewContext(
    fs.readFileSync('arcade/bear-talk/phrases.js', 'utf8'),
    ctx,
  );
  vm.runInNewContext(fs.readFileSync('arcade/bear-talk/app.js', 'utf8'), ctx);
  await new Promise(setImmediate);
  assert.ok(scrubbed);
  if (pairing.readHash(hash).code) {
    assert.equal(calls[0].action, 'join');
    assert.equal(calls[0].code, 'ABCDE23456');
    if (fail) assert.match(el('notice').textContent, /already paired/);
    else {
      assert.equal(el('remote').hidden, false);
      assert.equal(language, 'nl');
    }
  } else {
    assert.equal(calls.length, 0);
    assert.match(el('notice').textContent, /Invalid QR/);
  }
}
(async () => {
  await appTest('#pair=ABCDE23456&ui=nl');
  await appTest('#pair=bad');
  await appTest('#pair=ABCDE23456&ui=nl', true);
  console.log(
    'PASS: fragment-only URL, expiry calculation, QR rendering, automatic joining, address-bar cleanup, UI language, invalid/reused link fallback.',
  );
})();
