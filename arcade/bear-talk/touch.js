/* Receiver-only play. Pointer gestures never send text or change the speech queue. */
(() => {
  'use strict';
  const actions = {
    head: ['tilt', 'Hello there, little friend!'],
    tummy: ['giggle', 'That tickles!'],
    paw: ['wave', 'A high five for you!'],
    feet: ['happy', 'Happy little feet!'],
    cuddle: ['love', 'A big bear cuddle!'],
    pet: ['love', 'Such gentle pats!'],
    sleepy: ['sleepy', 'Getting cosy…'],
  };
  function bind({ element, onReaction }) {
    let pointer = null,
      holdTimer,
      lastTap = null,
      lastReaction = -Infinity;
    let keyboardIndex = 0;
    const now = () => performance.now();
    const point = (event) => ({ x: event.clientX, y: event.clientY });
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    function region(event) {
      const rect = element.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 420;
      const y = ((event.clientY - rect.top) / rect.height) * 440;
      if (y < 270) return 'head';
      if (y > 380) return 'feet';
      if (x < 145 || x > 275) return 'paw';
      return 'tummy';
    }
    function react(action, force = false) {
      if (!force && now() - lastReaction < 220) return;
      lastReaction = now();
      onReaction(actions[action][0], actions[action][1], action);
    }
    function cancel() {
      clearTimeout(holdTimer);
      pointer = null;
    }
    element.addEventListener('pointerdown', (event) => {
      if (pointer || event.isPrimary === false || event.button !== 0) return;
      pointer = {
        id: event.pointerId,
        start: point(event),
        region: region(event),
        moved: false,
        held: false,
      };
      element.setPointerCapture?.(event.pointerId);
      holdTimer = setTimeout(() => {
        if (!pointer || pointer.moved) return;
        pointer.held = true;
        lastTap = null;
        react('sleepy');
      }, 650);
    });
    element.addEventListener('pointermove', (event) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      if (distance(pointer.start, point(event)) > 12) {
        pointer.moved = true;
        clearTimeout(holdTimer);
      }
    });
    element.addEventListener('pointerup', (event) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const gesture = pointer;
      cancel();
      if (gesture.held) return;
      const rect = element.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) {
        lastTap = null;
        return;
      }
      if (gesture.moved) {
        lastTap = null;
        // Let vertical swipes scroll; horizontal strokes become pats/tickles.
        const dx = Math.abs(event.clientX - gesture.start.x),
          dy = Math.abs(event.clientY - gesture.start.y);
        if (dx < dy) return;
        if (gesture.region === 'head') react('pet');
        else if (gesture.region === 'tummy') react('tummy');
        return;
      }
      const tap = { ...point(event), at: now() };
      if (lastTap && tap.at - lastTap.at < 360 && distance(tap, lastTap) < 44) {
        lastTap = null;
        react('cuddle', true);
      } else {
        lastTap = tap;
        react(gesture.region);
      }
    });
    for (const type of ['pointercancel', 'lostpointercapture'])
      element.addEventListener(type, (event) => {
        // Automatic capture release after a completed tap must preserve the
        // first tap, so the following tap can become a cuddle.
        if (pointer?.id !== event.pointerId) return;
        cancel();
        lastTap = null;
      });
    element.addEventListener('contextmenu', (event) => event.preventDefault());
    function keyboardPlay() {
      const keys = ['head', 'paw', 'tummy', 'cuddle', 'feet', 'sleepy'];
      react(keys[keyboardIndex++ % keys.length]);
    }
    element.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (!event.repeat) keyboardPlay();
    });
    // Screen readers activate role=button with a synthetic click, without pointers.
    element.addEventListener('click', (event) => {
      if (event.detail === 0) keyboardPlay();
    });
    window.addEventListener('blur', () => {
      cancel();
      lastTap = null;
    });
  }
  window.BearTouch = { bind };
})();
