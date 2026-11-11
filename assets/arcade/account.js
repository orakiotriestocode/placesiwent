/* Shared arcade identity and explicit cloud saves. Only a publishable key belongs here. */
(function () {
  'use strict';
  const URL = 'https://uabgxxbrjympqqwsryqj.supabase.co';
  const KEY = 'sb_publishable_NKL2r25c0aXAyV44WK5BCw_rF-xI4fe';
  const PREF_KEY = 'piw.arcade.preferences.v1';
  const SESSION_KEY = 'piw.arcade.auth';
  const CALLBACK = 'https://placesiwent.eu/arcade/account/';
  const game = window.PiwGameAdapters?.[document.body.dataset.arcadeGame];
  const games = {
    colonization: ['New World', '/arcade/colonization/'],
    'park-builder': ['Park Builder', '/arcade/park-builder/'],
    'rivas-shapes': ["Riva's Shapes", '/arcade/rivas-shapes/'],
  };
  const buttons = [...document.querySelectorAll('[data-arcade-account]')];
  if (!buttons.length) return;
  let prefs = { volume: 0.8, muted: false };
  function getLocal(key) {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }
  function cleanPrefs(value) {
    return {
      volume: Number.isFinite(value?.volume)
        ? Math.max(0, Math.min(1, value.volume))
        : 0.8,
      muted: value?.muted === true,
    };
  }
  try {
    prefs = cleanPrefs(JSON.parse(getLocal(PREF_KEY)));
  } catch (_) {
    /* Defaults work without storage. */
  }
  let user = null,
    clientPromise,
    saveRow,
    prefRow,
    busy = false,
    epoch = 0,
    recovery = false;
  const dialog = document.createElement('dialog');
  dialog.className = 'piw-account';
  dialog.id = 'piw-account';
  dialog.setAttribute('aria-labelledby', 'piw-title');
  dialog.innerHTML = `<div class="piw-header"><h2 id="piw-title">Your arcade account</h2><button type="button" data-action="close" aria-label="Close account">Close</button></div>
<p>One account for every game. Playing is always free to start without signing in.</p>
<div id="piw-guest"><form id="piw-auth"><label for="piw-email">Email address</label><input id="piw-email" type="email" autocomplete="email" required maxlength="254"><label for="piw-password">Password</label><input id="piw-password" type="password" autocomplete="current-password" required maxlength="128"><div class="piw-row"><button type="submit" value="signin">Sign in</button><button type="submit" value="signup">Create account</button><button type="button" data-action="forgot">Forgot password</button></div></form><p class="piw-muted">Use an adult's email address. Your email is used for account access and recovery. Saves are private to your account.</p></div>
<div id="piw-member" hidden><p id="piw-identity"></p><div class="piw-row"><button type="button" data-action="refresh">Refresh cloud saves</button><button type="button" data-action="signout">Sign out on this device</button></div><ul id="piw-saves"></ul></div>
<form id="piw-recovery" hidden><label for="piw-new-password">New password (at least 10 characters)</label><input id="piw-new-password" type="password" minlength="10" maxlength="128" autocomplete="new-password" required><button type="submit">Update password</button></form>
<section id="piw-game" hidden><h3 id="piw-game-title"></h3><div class="piw-box"><p>Local save · this browser only</p><div class="piw-row"><button type="button" data-action="local-save">Save on this device</button><button type="button" data-action="local-load">Load this device's save</button><button type="button" data-action="backup-load">Restore previous local session</button></div></div><div class="piw-box"><p id="piw-cloud-info">Sign in to use cloud saves.</p><div class="piw-row"><button type="button" data-action="cloud-save" data-member>Save current game to cloud</button><button type="button" data-action="local-upload" data-member>Upload existing local save</button><button type="button" data-action="cloud-load" data-member>Load cloud save</button><button type="button" data-action="cloud-delete" data-member>Delete cloud save</button></div><p class="piw-muted">Cloud saves are separate for each game. Uploading or loading is always your choice. A newer save from another device must be reviewed before replacement.</p></div></section>
<section><h3>Shared sound settings</h3><label for="piw-volume">Arcade volume <output id="piw-volume-label"></output></label><input id="piw-volume" type="range" min="0" max="100" step="5"><label><input id="piw-muted" type="checkbox">Mute arcade sounds</label><p class="piw-muted">These settings apply to supported arcade sounds. Each game's sound switch still controls whether its audio is enabled.</p><div class="piw-row"><button type="button" data-action="prefs-save" data-member>Save sound settings to account</button><button type="button" data-action="prefs-load" data-member>Use account sound settings</button></div></section>
<p id="piw-status" class="piw-status" role="status" aria-live="polite">Guest play and local saves work without an account.</p><footer>Game-specific settings travel with that game's cloud save. No cloud save is loaded or uploaded automatically.</footer>`;
  document.body.append(dialog);
  const el = (id) => dialog.querySelector('#' + id);
  function status(message, error = false) {
    el('piw-status').textContent = message;
    el('piw-status').dataset.error = String(error);
  }
  function applyPrefs(value, persist = true) {
    prefs = cleanPrefs(value);
    if (persist) {
      try {
        localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
      } catch (_) {
        status(
          'Sound settings apply now, but this browser cannot remember them.',
          true,
        );
      }
    }
    el('piw-volume').value = String(Math.round(prefs.volume * 100));
    el('piw-volume-label').textContent = Math.round(prefs.volume * 100) + '%';
    el('piw-muted').checked = prefs.muted;
    window.dispatchEvent(
      new CustomEvent('piw:preferences', { detail: { ...prefs } }),
    );
  }
  window.PiwArcade = {
    open,
    getAudioGain: () => (prefs.muted ? 0 : prefs.volume),
    getPreferences: () => ({ ...prefs }),
  };
  applyPrefs(prefs, false);
  window.addEventListener('storage', (event) => {
    if (event.key === PREF_KEY) {
      try {
        applyPrefs(JSON.parse(event.newValue), false);
      } catch (_) {
        /* Ignore malformed storage. */
      }
    }
  });
  function render() {
    el('piw-guest').hidden = !!user;
    el('piw-member').hidden = !user;
    el('piw-recovery').hidden = !recovery;
    el('piw-identity').textContent = user ? 'Signed in as ' + user.email : '';
    el('piw-game').hidden = !game;
    if (game) el('piw-game-title').textContent = game.label;
    for (const button of dialog.querySelectorAll('button'))
      button.disabled =
        button.dataset.action !== 'close' &&
        (busy || (button.hasAttribute('data-member') && !user));
    if (game) {
      el('piw-cloud-info').textContent = !user
        ? 'Sign in to use cloud saves.'
        : saveRow === undefined
          ? 'Refresh to check your cloud save.'
          : saveRow
            ? 'Cloud save · ' +
              new Date(saveRow.updated_at).toLocaleString() +
              ' · revision ' +
              saveRow.revision
            : 'No cloud save for this game yet.';
      for (const name of ['cloud-load', 'cloud-delete'])
        dialog.querySelector(`[data-action="${name}"]`).disabled =
          busy || !user || !saveRow;
      for (const name of ['cloud-save', 'local-upload'])
        dialog.querySelector(`[data-action="${name}"]`).disabled =
          busy || !user || saveRow === undefined;
    }
    dialog.querySelector('[data-action="prefs-save"]').disabled =
      busy || !user || prefRow === undefined;
    dialog.querySelector('[data-action="prefs-load"]').disabled =
      busy || !user || !prefRow;
    for (const button of buttons)
      button.textContent = user
        ? '☁ Account & saves'
        : '☁ Optional account & saves';
  }
  function message(error) {
    if (error?.code === '40001')
      return 'Another device changed this cloud record. Press Refresh cloud saves, review its date, then choose again. Nothing was overwritten.';
    if (
      /not authorized|sending.*email|email.*rate|over_email_send_rate_limit/i.test(
        error?.message || error?.code || '',
      )
    )
      return 'Account email delivery is not available yet, or its sending limit was reached. Guest play and local saves still work.';
    return (
      error?.message ||
      'Could not complete that action. Your local progress is still available.'
    );
  }
  async function action(fn) {
    if (busy) return;
    busy = true;
    render();
    try {
      await fn();
    } catch (error) {
      status(message(error), true);
    } finally {
      busy = false;
      render();
    }
  }
  function checkIdentity(id, generation) {
    if (!user || user.id !== id || epoch !== generation)
      throw Error('The signed-in account changed. Please try again.');
  }
  async function client() {
    if (!clientPromise)
      clientPromise = (async () => {
        if (!window.PiwSupabase)
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = '/assets/vendor/supabase-browser.js';
            script.onload = resolve;
            script.onerror = () => {
              script.remove();
              reject(
                Error(
                  'Account service could not load. Guest play and local saves remain available.',
                ),
              );
            };
            document.head.append(script);
          });
        const sdk = window.PiwSupabase.createClient(URL, KEY, {
          auth: {
            storageKey: SESSION_KEY,
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            flowType: 'implicit',
          },
        });
        sdk.auth.onAuthStateChange((event, session) => {
          const next = session?.user || null;
          if (next?.id !== user?.id) {
            epoch++;
            saveRow = undefined;
            prefRow = undefined;
            el('piw-saves').replaceChildren();
          }
          user = next;
          if (event === 'PASSWORD_RECOVERY') {
            recovery = true;
            if (!dialog.open) dialog.showModal();
          }
          if (!user) recovery = false;
          render();
        });
        const { data, error } = await sdk.auth.getSession();
        if (error) throw error;
        user = data.session?.user || null;
        render();
        return sdk;
      })().catch((error) => {
        clientPromise = null;
        throw error;
      });
    return clientPromise;
  }
  async function refresh() {
    const sdk = await client();
    if (!user) {
      saveRow = undefined;
      prefRow = undefined;
      render();
      return;
    }
    const id = user.id,
      generation = epoch;
    const [saves, preferences] = await Promise.all([
      sdk.from('arcade_saves').select('*').eq('user_id', id),
      sdk
        .from('arcade_preferences')
        .select('*')
        .eq('user_id', id)
        .maybeSingle(),
    ]);
    checkIdentity(id, generation);
    if (saves.error) throw saves.error;
    if (preferences.error) throw preferences.error;
    saveRow = game
      ? saves.data.find((row) => row.game_id === game.id) || null
      : null;
    prefRow = preferences.data || null;
    el('piw-saves').replaceChildren();
    for (const row of saves.data) {
      const known = games[row.game_id];
      if (!known) continue;
      const li = document.createElement('li'),
        a = document.createElement('a');
      a.href = known[1];
      a.textContent =
        known[0] + ' · ' + new Date(row.updated_at).toLocaleString();
      li.append(a);
      el('piw-saves').append(li);
    }
    status('Cloud records refreshed. Local progress has not changed.');
    render();
  }
  function safeSave(value) {
    const json = JSON.stringify(value);
    if (!json || new TextEncoder().encode(json).length > 950000)
      throw Error('This save is too large to sync. Keep a local save instead.');
    return JSON.parse(json, (key, item) => {
      if (['__proto__', 'prototype', 'constructor'].includes(key))
        throw Error('Unsupported save data.');
      return item;
    });
  }
  function current() {
    if (!game) throw Error('Open a game to manage its save.');
    return safeSave(game.exportSave());
  }
  function local() {
    const raw = getLocal(game.localKey);
    if (!raw)
      throw Error('There is no local save for this game in this browser.');
    return safeSave(JSON.parse(raw));
  }
  function backup() {
    const key = 'piw.arcade.backups.' + game.id;
    const items = JSON.parse(getLocal(key) || '[]');
    localStorage.setItem(
      key,
      JSON.stringify(
        [
          { at: new Date().toISOString(), save: current() },
          ...(Array.isArray(items) ? items : []),
        ].slice(0, 3),
      ),
    );
  }
  function restore(value) {
    const data = safeSave(value);
    game.validateSave(data);
    backup();
    game.importSave(data);
  }
  async function upload(useLocal) {
    const data = useLocal ? local() : current();
    game.validateSave(data);
    if (
      saveRow &&
      !confirm(
        'Replace the cloud save shown above with ' +
          (useLocal ? 'this browser’s saved game' : 'the current game') +
          '?',
      )
    )
      return;
    const sdk = await client(),
      id = user.id,
      generation = epoch;
    const payload = safeSave({
      format: 1,
      game: game.id,
      save: data,
      settings: game.getSettings?.() || {},
    });
    const { data: saved, error } = await sdk.rpc('put_arcade_save', {
      p_game_id: game.id,
      p_payload: payload,
      p_expected_revision: saveRow?.revision ?? null,
    });
    checkIdentity(id, generation);
    if (error) throw error;
    saveRow = Array.isArray(saved) ? saved[0] : saved;
    status(
      'Cloud save uploaded. You can load it on another device after signing in.',
    );
    render();
  }
  const actions = {
    refresh,
    signout: async () => {
      const sdk = await client();
      const { error } = await sdk.auth.signOut({ scope: 'local' });
      if (error) throw error;
      user = null;
      epoch++;
      saveRow = undefined;
      prefRow = undefined;
      recovery = false;
      el('piw-password').value = '';
      status('Signed out on this device. Local game saves are unchanged.');
    },
    forgot: async () => {
      const email = el('piw-email');
      if (!email.reportValidity()) return;
      const sdk = await client();
      const { error } = await sdk.auth.resetPasswordForEmail(
        email.value.trim(),
        { redirectTo: CALLBACK },
      );
      if (error) throw error;
      status(
        'If an account exists and email delivery is configured, a reset link will arrive shortly.',
      );
    },
    'local-save': () => {
      const data = current();
      game.validateSave(data);
      localStorage.setItem(game.localKey, JSON.stringify(data));
      status('Saved on this device. No cloud save was changed.');
    },
    'local-load': () => {
      const data = local();
      if (
        !confirm(
          'Load this browser’s saved game? Your current session will be backed up locally.',
        )
      )
        return;
      restore(data);
      status(
        'Local save loaded. Your previous session is available with Restore previous local session.',
      );
    },
    'backup-load': () => {
      const data = JSON.parse(
        getLocal('piw.arcade.backups.' + game.id) || '[]',
      )[0];
      if (!data) throw Error('No previous local session is backed up yet.');
      if (!confirm('Restore the previous local session?')) return;
      restore(data.save);
      status('Previous session restored.');
    },
    'cloud-save': () => upload(false),
    'local-upload': () => upload(true),
    'cloud-load': () => {
      if (
        !saveRow ||
        saveRow.payload?.format !== 1 ||
        saveRow.payload.game !== game.id
      )
        throw Error('This cloud save is not compatible with this game.');
      if (
        !confirm(
          'Load this cloud save and replace the current session? A local backup will be kept.',
        )
      )
        return;
      restore(saveRow.payload.save);
      game.applySettings?.(saveRow.payload.settings || {});
      status(
        'Cloud save loaded. Your previous session is backed up on this device.',
      );
    },
    'cloud-delete': async () => {
      if (
        !saveRow ||
        !confirm('Delete this game’s cloud save? Local saves are kept.')
      )
        return;
      const sdk = await client(),
        id = user.id,
        generation = epoch;
      const { data, error } = await sdk
        .from('arcade_saves')
        .delete()
        .eq('user_id', id)
        .eq('game_id', game.id)
        .eq('revision', saveRow.revision)
        .select('game_id');
      checkIdentity(id, generation);
      if (error) throw error;
      if (!data.length) throw { code: '40001' };
      saveRow = null;
      status('Cloud save deleted. Local saves are unchanged.');
    },
    'prefs-save': async () => {
      if (
        prefRow &&
        !confirm(
          'Replace your account sound settings with this device’s settings?',
        )
      )
        return;
      const sdk = await client(),
        id = user.id,
        generation = epoch;
      const { data, error } = await sdk.rpc('put_arcade_preferences', {
        p_payload: { ...prefs },
        p_expected_revision: prefRow?.revision ?? null,
      });
      checkIdentity(id, generation);
      if (error) throw error;
      prefRow = Array.isArray(data) ? data[0] : data;
      status('Sound settings saved to your shared arcade account.');
    },
    'prefs-load': () => {
      if (!prefRow)
        throw Error('No account sound settings have been saved yet.');
      applyPrefs(prefRow.payload);
      status('Account sound settings applied to this device.');
    },
  };
  async function open(event) {
    event?.preventDefault();
    if (!dialog.open) dialog.showModal();
    render();
    const callback =
      location.pathname === '/arcade/account/' &&
      (location.hash.includes('access_token=') ||
        location.search.includes('code='));
    if (!clientPromise && !getLocal(SESSION_KEY) && !callback) return;
    await action(async () => {
      await client();
      await refresh();
    });
  }
  for (const button of buttons) button.addEventListener('click', open);
  dialog.addEventListener('keydown', (event) => event.stopPropagation());
  dialog.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'close') {
      dialog.close();
      return;
    }
    const fn = actions[button.dataset.action];
    if (fn) action(fn);
  });
  el('piw-auth').addEventListener('submit', (event) => {
    event.preventDefault();
    const signup = event.submitter?.value === 'signup';
    const email = el('piw-email').value.trim(),
      password = el('piw-password').value;
    action(async () => {
      if (signup && password.length < 10)
        throw Error('Choose a password with at least 10 characters.');
      const sdk = await client();
      const { data, error } = signup
        ? await sdk.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: CALLBACK },
          })
        : await sdk.auth.signInWithPassword({ email, password });
      if (error) throw error;
      el('piw-password').value = '';
      if (data.session) {
        user = data.session.user;
        await refresh();
        status(
          'Signed in. Your current game is unchanged. Choose whether to upload or load a save.',
        );
      } else
        status(
          'Check your email to confirm your account, then return here to sign in.',
        );
    });
  });
  el('piw-recovery').addEventListener('submit', (event) => {
    event.preventDefault();
    action(async () => {
      const sdk = await client();
      const { error } = await sdk.auth.updateUser({
        password: el('piw-new-password').value,
      });
      if (error) throw error;
      el('piw-new-password').value = '';
      recovery = false;
      status('Password updated.');
    });
  });
  el('piw-volume').addEventListener('input', () =>
    applyPrefs({ ...prefs, volume: Number(el('piw-volume').value) / 100 }),
  );
  el('piw-muted').addEventListener('change', () =>
    applyPrefs({ ...prefs, muted: el('piw-muted').checked }),
  );
  render();
  if (
    location.pathname === '/arcade/account/' &&
    (location.hash.includes('access_token=') ||
      location.search.includes('code='))
  )
    open();
})();
