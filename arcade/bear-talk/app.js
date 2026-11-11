(() => {
  'use strict';
  const API = 'https://uabgxxbrjympqqwsryqj.supabase.co/functions/v1/bear-talk';
  const $ = (id) => document.getElementById(id);
  const synth = window.speechSynthesis;
  let session = null,
    role = null,
    timer = null,
    busy = false,
    active = false,
    queue = [],
    seen = new Set(),
    blocked = null,
    utterance = null,
    requestId = null;
  const demo = new URLSearchParams(location.search).has('demo');
  function notice(text = '') {
    $('notice').textContent = text;
  }
  function show(id) {
    ['welcome', 'join', 'tablet', 'remote'].forEach(
      (x) => ($(x).hidden = x !== id),
    );
    notice();
  }
  async function api(action, data = {}) {
    const response = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...session, ...data, action }),
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    if (!response.ok) {
      const e = new Error(
        (result.error || 'Connection problem').replace(
          /tablet/g,
          'bear screen',
        ),
      );
      e.status = response.status;
      throw e;
    }
    return result;
  }
  function save() {
    sessionStorage.setItem(
      'bear-talk-session',
      JSON.stringify({ session, role }),
    );
  }
  function stopLocal() {
    clearTimeout(timer);
    session = null;
    sessionStorage.removeItem('bear-talk-session');
    queue = [];
    active = false;
    busy = false;
    blocked = null;
    synth?.cancel();
    $('bear').className = 'bear';
  }
  function voiceFor(lang) {
    const voices = synth?.getVoices() || [];
    return (
      voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ||
      voices.find((v) => v.lang.slice(0, 2) === lang.slice(0, 2))
    );
  }
  async function ack(m, status) {
    if (session) await api('ack', { messageId: m.id, status });
  }
  function speak(m, test = false) {
    if (!synth) {
      notice(
        'This browser has no speech support. Please try Safari or Chrome.',
      );
      return Promise.resolve(false);
    }
    return new Promise((resolve) => {
      let settled = false,
        watchdog;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        clearTimeout(watchdog);
        $('bear').classList.remove('talking');
        if (!ok && !test) {
          blocked = m;
          notice(
            'Tap Enable / test voice on the bear screen to play the waiting message.',
          );
        }
        resolve(ok);
      };
      utterance = new SpeechSynthesisUtterance(m.text);
      utterance.lang = m.lang;
      utterance.rate = 0.88;
      utterance.pitch = 1.08;
      const voice = voiceFor(m.lang);
      if (voice) utterance.voice = voice;
      if (!voice && !test)
        notice(
          'No matching installed voice found. The bear screen may use its default voice.',
        );
      $('bubble').textContent = m.text;
      $('bear').className = 'bear ' + (m.emotion || 'happy');
      utterance.onstart = () => {
        $('bear').classList.add('talking');
        if (!test) ack(m, 'speaking').catch(() => {});
      };
      utterance.onend = () => finish(true);
      utterance.onerror = () => finish(false);
      synth.speak(utterance);
      watchdog = setTimeout(() => {
        synth.cancel();
        finish(false);
      }, 90000);
    });
  }
  async function drain() {
    if (busy || !active || blocked) return;
    busy = true;
    while (queue.length && active && !blocked) {
      const m = queue.shift();
      const ok = await speak(m);
      if (!active) break;
      try {
        await ack(m, ok ? 'spoken' : 'blocked');
      } catch {
        notice('Voice played, but delivery status could not be updated.');
      }
    }
    busy = false;
  }
  async function poll() {
    if (!session) return;
    try {
      const r = await api('poll');
      if (role === 'tablet') {
        $('tablet-status').textContent = r.paired
          ? r.online
            ? 'Remote control connected · Ready for your words'
            : 'Remote control paired · Waiting for connection'
          : 'Waiting for the remote control';
        $('pairing').hidden = r.paired;
        for (const m of r.messages) {
          if (!seen.has(m.id)) {
            seen.add(m.id);
            queue.push(m);
          }
        }
        drain();
      } else {
        $('remote-status').textContent = r.online
          ? '● Bear screen connected'
          : '○ Bear screen not responding · Keep its screen open';
        $('history').replaceChildren();
        for (const m of r.messages) {
          const li = document.createElement('li');
          li.textContent = m.text;
          const status = document.createElement('small');
          status.textContent =
            {
              queued: 'Queued for bear screen',
              speaking: 'Speaking…',
              spoken: 'Spoken ✓',
              blocked: 'Needs a voice tap on the bear screen',
            }[m.status] || m.status;
          li.append(status);
          $('history').append(li);
        }
      }
    } catch (e) {
      if ([403, 410].includes(e.status)) {
        stopLocal();
        show('welcome');
        notice(e.message);
        return;
      }
      notice('Reconnecting… Keep both screens open.');
    }
    if (session) timer = setTimeout(poll, 3000);
  }
  function activate(s, r) {
    session = s;
    role = r;
    active = true;
    seen = new Set();
    save();
    show(r === 'tablet' ? 'tablet' : 'remote');
    poll();
  }
  $('start').onclick = async () => {
    if (!synth) {
      notice('Speech is not supported by this browser. Try Safari or Chrome.');
      return;
    }
    // Speech is invoked directly inside this tap to unlock mobile audio.
    speak({ text: 'Hallo Riva!', lang: 'nl-BE' }, true);
    $('start').disabled = true;
    try {
      const s = await api('create');
      $('pair-code').textContent = s.code.slice(0, 5) + ' ' + s.code.slice(5);
      activate(
        { id: s.id, token: s.token, expires: s.expires, code: s.code },
        'tablet',
      );
    } catch (e) {
      notice(e.message);
    } finally {
      $('start').disabled = false;
    }
  };
  $('parent').onclick = () => show('join');
  $('back').onclick = () => show('welcome');
  $('join-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.submitter;
    btn.disabled = true;
    try {
      const s = await api('join', { code: $('code').value });
      activate(s, 'parent');
    } catch (err) {
      notice(err.message);
    } finally {
      btn.disabled = false;
    }
  };
  $('message').oninput = () => {
    $('count').textContent = $('message').value.length + ' / 500';
    requestId = null;
  };
  $('message-form').onsubmit = async (e) => {
    e.preventDefault();
    const text = $('message').value.trim();
    if (!text) return;
    const btn = $('send');
    btn.disabled = true;
    requestId = requestId || crypto.randomUUID();
    try {
      await api('send', {
        text,
        lang: $('language').value,
        emotion: $('emotion').value,
        requestId,
      });
      $('message').value = '';
      $('count').textContent = '0 / 500';
      requestId = null;
      notice('Sent to the bear screen.');
    } catch (err) {
      notice(err.message + ' Your message is still here.');
    } finally {
      btn.disabled = false;
    }
  };
  $('sound').onclick = async () => {
    if (busy && !blocked) {
      notice('The bear is speaking. Wait until it finishes.');
      return;
    }
    synth?.cancel();
    const m = blocked;
    blocked = null;
    if (m) {
      busy = true;
      const ok = await speak(m);
      try {
        await ack(m, ok ? 'spoken' : 'blocked');
      } catch {}
      busy = false;
      if (ok) notice();
      drain();
    } else {
      await speak({ text: 'Hallo Riva!', lang: 'nl-BE' }, true);
    }
  };
  $('fullscreen').onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if ($('stage').requestFullscreen)
        await $('stage').requestFullscreen();
      else
        notice(
          'Full screen is not available here. You can add this page to the Home Screen.',
        );
    } catch {
      notice('Full screen is not available in this browser.');
    }
  };
  async function end() {
    try {
      if (session) await api('end');
      stopLocal();
      show('welcome');
      notice('Session ended.');
    } catch {
      notice('Could not end the session. Check your connection and try again.');
    }
  }
  $('end-tablet').onclick = end;
  $('end-remote').onclick = end;
  const phrases = {
    nl: [
      'Hallo Riva! Ik ben beer. Wat fijn om jou te zien!',
      'Ik vind jou heel lief, Riva!',
      'Slaap zacht, kleine Riva. Droom maar fijn.',
    ],
    en: [
      'Hello Riva! I am Bear. It is lovely to see you!',
      'I love you, Riva!',
      'Sleep well, little Riva. Sweet dreams.',
    ],
    fr: [
      'Bonjour Riva ! Je suis ton petit ours !',
      'Je t’aime, Riva !',
      'Bonne nuit, petite Riva. Fais de beaux rêves.',
    ],
    de: [
      'Hallo Riva! Ich bin dein kleiner Bär!',
      'Ich habe dich lieb, Riva!',
      'Schlaf gut, kleine Riva.',
    ],
    es: [
      '¡Hola Riva! ¡Soy tu osito!',
      '¡Te quiero, Riva!',
      'Duerme bien, pequeña Riva.',
    ],
  };
  document.querySelectorAll('[data-phrase]').forEach(
    (btn) =>
      (btn.onclick = () => {
        const a = phrases[$('language').value.slice(0, 2)] || phrases.en;
        $('message').value =
          a[['hello', 'love', 'sleep'].indexOf(btn.dataset.phrase)];
        $('message').oninput();
        $('message').focus();
      }),
  );
  $('demo-speak').onclick = () => {
    synth?.cancel();
    speak(
      {
        text: $('demo-text').value,
        lang: $('demo-lang').value,
        emotion: 'wave',
      },
      true,
    );
  };
  if (demo) {
    show('tablet');
    $('pairing').hidden = true;
    $('demo-controls').hidden = false;
    $('end-tablet').hidden = true;
    $('tablet-status').textContent = 'Single-device demo · No pairing';
  } else {
    try {
      const saved = JSON.parse(sessionStorage.getItem('bear-talk-session'));
      if (saved?.session && Date.parse(saved.session.expires) > Date.now()) {
        activate(saved.session, saved.role);
        if (saved.role === 'tablet') {
          $('pair-code').textContent = saved.session.code
            ? saved.session.code.slice(0, 5) + ' ' + saved.session.code.slice(5)
            : 'Start a new session to pair';
          notice('Tap Enable / test voice after reloading the bear screen.');
        }
      } else sessionStorage.removeItem('bear-talk-session');
    } catch {
      sessionStorage.removeItem('bear-talk-session');
    }
  }
})();
