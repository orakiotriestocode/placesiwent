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
  let playbackEpoch = 0;
  let lastMessage = null,
    lastRemote = null,
    cancelSpeech = null,
    lastStop = null,
    ready = 'untested',
    remoteVoices = [],
    voiceSignature = '',
    stopping = false;
  let demoMessages = [];
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
    if (demo) {
      if (action === 'send') {
        const m = { ...data, id: Date.now() + Math.random(), status: 'queued' };
        demoMessages.unshift(m);
        demoMessages = demoMessages.slice(0, 15);
        lastRemote = m;
        $('remote-repeat').disabled = false;
        queue.push(m);
        renderHistory(demoMessages);
        drain();
        return { ok: true };
      }
      throw new Error('Pairing is not needed in the single-device demo.');
    }

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
    abortSpeech();
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
    if (demo) {
      m.status = status;
      renderHistory(demoMessages);
      return;
    }
    if (session) await api('ack', { messageId: m.id, status });
  }
  function catalog() {
    return (synth?.getVoices() || [])
      .slice(0, 150)
      .map((v) => ({ uri: v.voiceURI, name: v.name, lang: v.lang }));
  }
  const baseLanguage = (lang) =>
    String(lang || '')
      .toLowerCase()
      .replace(/_/g, '-')
      .split('-')[0];
  function fillVoices(id, voices, lang) {
    const select = $(id),
      current = select.value;
    const unique = new Map();
    for (const v of voices)
      if (baseLanguage(v.lang) === baseLanguage(lang) && !unique.has(v.uri))
        unique.set(v.uri, v);
    const matching = [...unique.values()].sort(
      (a, b) =>
        Number(b.lang.toLowerCase() === lang.toLowerCase()) -
          Number(a.lang.toLowerCase() === lang.toLowerCase()) ||
        a.name.localeCompare(b.name),
    );
    select.value = '';
    select.replaceChildren(
      new Option(
        matching.length
          ? 'Automatic · selected language'
          : 'Automatic · no matching voices reported',
        '',
      ),
    );
    for (const v of matching)
      select.add(new Option(v.name + ' · ' + v.lang, v.uri));
    if ([...select.options].some((o) => o.value === current))
      select.value = current;
  }
  function reportVoices() {
    if (demo) {
      remoteVoices = catalog();
      fillVoices('remote-voice', remoteVoices, $('language').value);
      $('remote-voice-health').textContent = {
        ready: 'Voice playback tested ✓',
        blocked: 'Sound needs attention · Tap Test voice',
        unavailable: 'Speech unavailable in this browser',
        untested: 'Tap Test voice here before playing',
      }[ready];
      return;
    }

    if (session && role === 'tablet')
      api('voices', { voices: catalog(), ready }).catch(() => {});
  }
  function health(value, text) {
    ready = value;
    $('voice-health').textContent = text;
    reportVoices();
  }
  function updateVoices() {
    fillVoices('local-voice', catalog(), $('local-language').value);
    try {
      const selected = localStorage.getItem('bear-local-voice');
      if (
        selected &&
        [...$('local-voice').options].some((o) => o.value === selected)
      )
        $('local-voice').value = selected;
    } catch {}
    reportVoices();
  }
  function abortSpeech() {
    if (demo) {
      for (const m of demoMessages)
        if (['queued', 'speaking', 'blocked'].includes(m.status))
          m.status = 'stopped';
      renderHistory(demoMessages);
    }
    playbackEpoch++;
    busy = false;
    queue = [];
    blocked = null;
    if (cancelSpeech) cancelSpeech();
    synth?.cancel();
    $('bear').classList.remove('talking');
    $('speech-progress').textContent = 'Stopped · Queue cleared';
  }
  function speak(m, test = false) {
    if (!synth) {
      health(
        'unavailable',
        'Speech is unavailable in this browser. Try Safari or Chrome.',
      );
      return Promise.resolve('blocked');
    }
    return new Promise((resolve) => {
      let settled = false,
        watchdog,
        startWatchdog;
      const finish = (status) => {
        if (settled) return;
        settled = true;
        clearTimeout(watchdog);
        clearTimeout(startWatchdog);
        cancelSpeech = null;
        $('bear').classList.remove('talking');
        if (status === 'blocked') {
          if (!test) blocked = m;
          health(
            'blocked',
            'Sound needs attention. Check volume/output, choose a voice, then tap Test voice.',
          );
          $('speech-progress').textContent =
            'Could not play · Tap Test voice to retry';
        } else if (status === 'spoken') {
          health(
            'ready',
            'Voice test/playback completed ✓ If you heard nothing, check this device’s volume and audio output.',
          );
          $('speech-progress').textContent = 'Finished speaking ✓';
        } else $('speech-progress').textContent = 'Stopped · Queue cleared';
        resolve(status);
      };
      cancelSpeech = () => finish('stopped');
      utterance = new SpeechSynthesisUtterance(m.text);
      utterance.lang = m.lang;
      utterance.rate = Number(m.rate) || Number($('local-rate').value);
      utterance.pitch = 1.08;
      if (!test && $('local-language').value !== m.lang) {
        $('local-language').value = m.lang;
        updateVoices();
      }
      const uri = m.voice || $('local-voice').value;
      const voice =
        (synth.getVoices() || []).find(
          (v) =>
            v.voiceURI === uri && baseLanguage(v.lang) === baseLanguage(m.lang),
        ) || voiceFor(m.lang);
      if (voice) utterance.voice = voice;
      $('bubble').textContent = m.text;
      $('bear').className = 'bear ' + (m.emotion || 'happy');
      $('speech-progress').textContent = 'Starting voice…';
      if (!test) {
        lastMessage = m;
        $('local-repeat').disabled = false;
      }
      utterance.onstart = () => {
        clearTimeout(startWatchdog);
        $('bear').classList.add('talking');
        $('speech-progress').textContent = 'Speaking…';
        if (!test) ack(m, 'speaking').catch(() => {});
      };
      utterance.onboundary = (e) => {
        if (e.charIndex > 0)
          $('speech-progress').textContent =
            'Speaking · ' +
            Math.min(99, Math.round((e.charIndex / m.text.length) * 100)) +
            '%';
      };
      utterance.onend = () => finish('spoken');
      utterance.onerror = () => finish('blocked');
      startWatchdog = setTimeout(() => {
        finish('blocked');
        synth.cancel();
      }, 12000);
      watchdog = setTimeout(
        () => {
          finish('blocked');
          synth.cancel();
        },
        Math.max(90000, m.text.length * 400),
      );
      try {
        synth.speak(utterance);
      } catch {
        finish('blocked');
      }
    });
  }
  async function drain() {
    if (busy || !active || blocked || stopping) return;
    busy = true;
    const epoch = playbackEpoch;
    while (queue.length && active && !blocked) {
      const m = queue.shift();
      const ok = await speak(m);
      if (epoch !== playbackEpoch) return;
      if (!active) break;
      try {
        await ack(m, ok);
      } catch {
        notice('Voice played, but delivery status could not be updated.');
      }
    }
    busy = false;
  }
  function renderHistory(messages) {
    $('history').replaceChildren();
    for (const m of messages) {
      const li = document.createElement('li');
      li.textContent = m.text;
      const status = document.createElement('small');
      status.textContent =
        {
          queued: 'Queued for bear screen',
          speaking: 'Speaking…',
          spoken: 'Spoken ✓',
          stopped: 'Stopped',
          blocked: 'Needs a voice tap on the bear screen',
        }[m.status] || m.status;
      li.append(status);
      $('history').append(li);
    }
  }
  async function poll() {
    if (!session) return;
    try {
      const r = await api('poll');
      if (!session) return;
      if (role === 'tablet') {
        if (r.stopId && r.stopId !== lastStop) {
          lastStop = r.stopId;
          abortSpeech();
        }
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
        lastRemote = r.messages[0] || null;
        $('remote-repeat').disabled = !lastRemote;
        remoteVoices = r.voiceState?.voices || [];
        const signature = JSON.stringify(remoteVoices);
        if (signature !== voiceSignature) {
          voiceSignature = signature;
          fillVoices('remote-voice', remoteVoices, $('language').value);
        }
        $('remote-voice-health').textContent =
          {
            ready: 'Voice playback tested ✓',
            blocked: 'Sound needs attention on the bear screen',
            unavailable: 'Speech unavailable on the bear screen',
            untested: 'Tap Test voice on the bear screen first',
          }[r.voiceState?.ready] || 'Waiting for the bear screen’s voice list…';
        if (!remoteVoices.length)
          $('remote-voice-health').textContent +=
            ' · No installed voices reported yet';
        renderHistory(r.messages);
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
    if (r === 'tablet') updateVoices();
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
        voice: $('remote-voice').value,
        rate: Number($('remote-rate').value),
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
      notice('Stop the current message before testing another voice.');
      return;
    }
    const m = blocked;
    blocked = null;
    synth?.cancel();
    busy = true;
    const status = await speak(
      m || {
        text: (phrases[baseLanguage($('local-language').value)] ||
          phrases.en)[0],
        lang: $('local-language').value,
      },
      !m,
    );
    if (m)
      try {
        await ack(m, status);
      } catch {}
    busy = false;
    if (status === 'spoken') notice();
    drain();
  };
  async function stopPlayback() {
    stopping = true;
    abortSpeech();
    try {
      if (session) await api('stop');
      notice(
        session
          ? 'Stop sent · The remote may take a few seconds to reach the bear screen.'
          : 'Stopped · Queue cleared',
      );
    } catch {
      notice(
        'Could not reach the other screen. Stop directly on the bear screen.',
      );
    } finally {
      stopping = false;
    }
  }
  $('remote-test').onclick = () => $('sound').onclick();
  $('local-stop').onclick = stopPlayback;
  $('remote-stop').onclick = stopPlayback;
  $('local-repeat').onclick = async () => {
    if (!lastMessage) return;
    abortSpeech();
    busy = true;
    await speak(
      {
        ...lastMessage,
        voice: $('local-voice').value,
        rate: Number($('local-rate').value),
      },
      true,
    );
    busy = false;
    drain();
  };
  $('remote-repeat').onclick = async () => {
    if (!lastRemote) return;
    const btn = $('remote-repeat');
    btn.disabled = true;
    try {
      await api('send', {
        text: lastRemote.text,
        lang: lastRemote.lang,
        emotion: lastRemote.emotion,
        voice: $('remote-voice').value,
        rate: Number($('remote-rate').value),
        requestId: crypto.randomUUID(),
      });
      notice('Repeat queued.');
    } catch (e) {
      notice(e.message);
    } finally {
      btn.disabled = false;
    }
  };
  $('local-language').onchange = () => {
    if (demo) {
      $('language').value = $('local-language').value;
      fillVoices('remote-voice', remoteVoices, $('language').value);
    }
    updateVoices();
    if (demo) $('demo-lang').value = $('local-language').value;
  };
  $('demo-lang').onchange = () => {
    $('local-language').value = $('demo-lang').value;
    updateVoices();
  };
  $('language').onchange = () => {
    fillVoices('remote-voice', remoteVoices, $('language').value);
    if (demo) {
      $('local-language').value = $('language').value;
      updateVoices();
    }
  };
  for (const prefix of ['local', 'remote']) {
    const range = $(prefix + '-rate');
    try {
      range.value = localStorage.getItem('bear-' + prefix + '-rate') || '0.9';
    } catch {}
    range.oninput = () => {
      $(prefix + '-rate-label').textContent =
        Number(range.value).toFixed(1) + '×';
      try {
        localStorage.setItem('bear-' + prefix + '-rate', range.value);
      } catch {}
    };
    range.oninput();
  }
  $('local-voice').onchange = () => {
    try {
      localStorage.setItem('bear-local-voice', $('local-voice').value);
    } catch {}
  };
  updateVoices();
  synth?.addEventListener('voiceschanged', updateVoices);
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
  $('demo-speak').onclick = async () => {
    abortSpeech();
    busy = true;
    const m = {
      text: $('demo-text').value,
      lang: $('demo-lang').value,
      emotion: 'wave',
    };
    lastMessage = m;
    $('local-repeat').disabled = false;
    await speak(m, true);
    busy = false;
  };
  if (demo) {
    show('tablet');
    $('pairing').hidden = true;
    $('remote').hidden = false;
    active = true;
    role = 'tablet';
    document.body.classList.add('demo-mode');
    document.querySelector('.sound-settings').open = false;
    $('remote-status').textContent =
      '● Local demo · Remote and bear are on this device';
    $('remote-test').hidden = false;
    $('end-remote').textContent = 'Exit demo';
    $('end-remote').onclick = () => location.assign('./');
    updateVoices();
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
          notice('Tap Test voice after reloading the bear screen.');
        }
      } else sessionStorage.removeItem('bear-talk-session');
    } catch {
      sessionStorage.removeItem('bear-talk-session');
    }
  }
})();
