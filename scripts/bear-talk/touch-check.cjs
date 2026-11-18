const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
let clock = 1000,
  sequence = 0;
const timers = new Map(),
  handlers = new Map(),
  windowHandlers = new Map(),
  reactions = [];
const rect = {
  left: 10,
  top: 20,
  width: 210,
  height: 220,
  right: 220,
  bottom: 240,
};
const element = {
  addEventListener: (type, fn) => handlers.set(type, fn),
  getBoundingClientRect: () => rect,
  setPointerCapture() {},
};
const ctx = {
  window: { addEventListener: (type, fn) => windowHandlers.set(type, fn) },
  performance: { now: () => clock },
  setTimeout(fn, ms) {
    timers.set(++sequence, { at: clock + ms, fn });
    return sequence;
  },
  clearTimeout: (id) => timers.delete(id),
};
vm.runInNewContext(fs.readFileSync('arcade/bear-talk/touch.js', 'utf8'), ctx);
ctx.window.BearTouch.bind({
  element,
  onReaction: (...args) => reactions.push(args),
});
function advance(ms) {
  clock += ms;
  for (const [id, timer] of [...timers])
    if (timer.at <= clock) {
      timers.delete(id);
      timer.fn();
    }
}
function event(x, y, extra = {}) {
  return {
    clientX: rect.left + x / 2,
    clientY: rect.top + y / 2,
    button: 0,
    isPrimary: true,
    pointerId: 1,
    preventDefault() {},
    ...extra,
  };
}
function tap(x, y, extra) {
  handlers.get('pointerdown')(event(x, y, extra));
  handlers.get('pointerup')(event(x, y, extra));
  handlers.get('lostpointercapture')(event(x, y, extra));
}
const last = () => reactions.at(-1)?.[2];
tap(210, 160);
assert.equal(last(), 'head');
advance(400);
tap(210, 330);
assert.equal(last(), 'tummy');
advance(400);
tap(105, 310);
assert.equal(last(), 'paw');
advance(400);
tap(280, 405);
assert.equal(last(), 'feet');
advance(400);
tap(200, 160);
advance(120);
tap(210, 160);
assert.equal(
  last(),
  'cuddle',
  'Double tap survives the browser’s automatic pointer capture release',
);
advance(400);
handlers.get('pointerdown')(event(210, 160));
advance(650);
assert.equal(last(), 'sleepy');
const heldCount = reactions.length;
handlers.get('pointerup')(event(210, 160));
assert.equal(reactions.length, heldCount);
advance(400);
handlers.get('pointerdown')(event(150, 160));
handlers.get('pointermove')(event(210, 160));
handlers.get('pointerup')(event(210, 160));
assert.equal(last(), 'pet');
advance(400);
let count = reactions.length;
handlers.get('pointerdown')(event(210, 160));
handlers.get('pointermove')(event(210, 215));
handlers.get('pointercancel')(event(210, 215));
advance(700);
assert.equal(
  reactions.length,
  count,
  'Scrolling cancels play and the sleepy hold',
);
handlers.get('pointerdown')(event(210, 160));
handlers.get('lostpointercapture')(event(210, 160));
advance(700);
assert.equal(reactions.length, count);
handlers.get('pointerdown')(event(210, 160));
windowHandlers.get('blur')();
advance(700);
assert.equal(reactions.length, count);
tap(210, 160, { isPrimary: false, pointerId: 2 });
tap(210, 160, { button: 2 });
assert.equal(reactions.length, count);
handlers.get('pointerdown')(event(210, 160));
handlers.get('pointerup')(event(600, 160));
assert.equal(reactions.length, count, 'Release outside bear is not a tap');
advance(400);
for (const key of ['Enter', ' ']) {
  let prevented = false;
  handlers.get('keydown')({
    key,
    repeat: false,
    preventDefault() {
      prevented = true;
    },
  });
  assert.ok(prevented);
  advance(400);
}
assert.equal(reactions.length, count + 2);
handlers.get('keydown')({ key: ' ', repeat: true, preventDefault() {} });
handlers.get('click')({ detail: 1 });
assert.equal(
  reactions.length,
  count + 2,
  'Native pointer click does not duplicate the reaction',
);
handlers.get('click')({ detail: 0 });
assert.equal(reactions.length, count + 3, 'Assistive activation can play');
assert.equal(timers.size, 0);
console.log(
  'PASS: scaled hit areas, head/tummy/paw/feet reactions, real capture-release double tap, sleepy hold, petting, scroll/cancel/blur cleanup, secondary-pointer/right-click rejection, outside release, keyboard and assistive activation without duplicate clicks.',
);
