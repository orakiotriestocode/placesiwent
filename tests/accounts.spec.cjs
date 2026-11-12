const { test, expect } = require('@playwright/test');
test.beforeEach(async ({ page }) => {
  await page.route('https://*.ingest.de.sentry.io/**', (r) =>
    r.fulfill({ status: 200, body: '{}' }),
  );
});
const API = 'https://uabgxxbrjympqqwsryqj.supabase.co';
const FIRST = '10000000-0000-4000-8000-000000000001';
const SECOND = '10000000-0000-4000-8000-000000000002';
function jwt(user) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return (
    encode({ alg: 'HS256', typ: 'JWT' }) +
    '.' +
    encode({
      sub: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }) +
    '.not-a-real-signature'
  );
}
async function mockBackend(page) {
  const backend = {
    saves: new Map(),
    prefs: new Map(),
    authRequests: [],
    signupBlocked: false,
  };
  await page.route(API + '/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    };
    const reply = (body, status = 200) =>
      route.fulfill({
        status,
        headers,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    if (request.method() === 'OPTIONS') return reply(null, 200);
    let body;
    try {
      body = request.postDataJSON();
    } catch (_) {
      body = {};
    }
    let id = FIRST;
    const bearer = request.headers().authorization?.replace('Bearer ', '');
    try {
      id = JSON.parse(
        Buffer.from(bearer.split('.')[1], 'base64url').toString(),
      ).sub;
    } catch (_) {
      /* Public auth request. */
    }
    const user = {
      id,
      email: id === SECOND ? 'second@example.test' : 'player@example.test',
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: { provider: 'email' },
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    };
    if (url.pathname.startsWith('/auth/')) {
      backend.authRequests.push({ path: url.pathname, body });
      if (url.pathname.endsWith('/token')) {
        user.id = body.email === 'second@example.test' ? SECOND : FIRST;
        user.email = body.email;
        return reply({
          access_token: jwt(user),
          refresh_token: 'fake-refresh',
          token_type: 'bearer',
          expires_in: 3600,
          user,
        });
      }
      if (url.pathname.endsWith('/signup'))
        return backend.signupBlocked
          ? reply(
              {
                code: 'email_address_not_authorized',
                msg: 'Email address not authorized',
              },
              403,
            )
          : reply({ user, session: null });
      if (url.pathname.endsWith('/user')) return reply(user);
      if (url.pathname.endsWith('/logout') || url.pathname.endsWith('/recover'))
        return reply({});
      return reply({ message: 'Unexpected mock auth request' }, 400);
    }
    const saveKey = (game) => id + ':' + game;
    if (url.pathname.endsWith('/rpc/put_arcade_save')) {
      const old = backend.saves.get(saveKey(body.p_game_id));
      if ((old?.revision ?? null) !== body.p_expected_revision)
        return reply({ code: '40001', message: 'Cloud save changed' }, 409);
      const row = {
        user_id: id,
        game_id: body.p_game_id,
        payload: body.p_payload,
        revision: (old?.revision || 0) + 1,
        updated_at: new Date().toISOString(),
      };
      backend.saves.set(saveKey(body.p_game_id), row);
      return reply(row);
    }
    if (url.pathname.endsWith('/rpc/put_arcade_preferences')) {
      const old = backend.prefs.get(id);
      if ((old?.revision ?? null) !== body.p_expected_revision)
        return reply({ code: '40001', message: 'Cloud settings changed' }, 409);
      const row = {
        user_id: id,
        payload: body.p_payload,
        revision: (old?.revision || 0) + 1,
        updated_at: new Date().toISOString(),
      };
      backend.prefs.set(id, row);
      return reply(row);
    }
    if (url.pathname.endsWith('/arcade_saves')) {
      if (request.method() === 'DELETE') {
        const gid = url.searchParams.get('game_id').replace('eq.', '');
        const row = backend.saves.get(saveKey(gid));
        if (
          row &&
          row.revision ===
            Number(url.searchParams.get('revision').replace('eq.', ''))
        ) {
          backend.saves.delete(saveKey(gid));
          return reply([{ game_id: gid }]);
        }
        return reply([]);
      }
      return reply(
        [...backend.saves.values()].filter((row) => row.user_id === id),
      );
    }
    if (url.pathname.endsWith('/arcade_preferences'))
      return reply(backend.prefs.get(id) || null);
    return reply({ message: 'Unexpected mock database request' }, 400);
  });
  return backend;
}
async function open(page) {
  await page.locator('[data-arcade-account]').click();
  await expect(page.locator('#piw-account')).toBeVisible();
}
async function login(page, email = 'player@example.test') {
  await page.locator('#piw-email').fill(email);
  await page
    .locator('#piw-password')
    .fill('example-password-only-for-mocked-tests');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('#piw-identity')).toContainText(email);
  await expect(
    page.getByRole('button', {
      name: 'Save sound settings to account',
      exact: true,
    }),
  ).toBeEnabled();
}
for (const [game, key] of [
  ['colonization', 'newworld-save-v02'],
  ['park-builder', 'placesiwent-parkbuilder-alpha01'],
  ['rivas-shapes', 'placesiwent-rivas-shapes-v1'],
]) {
  test(`guest play and local saving stay available: ${game}`, async ({
    page,
  }) => {
    let requests = 0;
    await page.route(API + '/**', (route) => {
      requests++;
      return route.abort();
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/arcade/' + game + '/');
    if (game === 'rivas-shapes') await page.locator('#start').click();
    await expect(page.locator('#piw-account')).not.toBeVisible();
    await open(page);
    await page
      .getByRole('button', { name: 'Save on this device', exact: true })
      .click();
    await expect(page.locator('#piw-status')).toContainText(
      'Saved on this device',
    );
    expect(await page.evaluate((key) => !!localStorage.getItem(key), key)).toBe(
      true,
    );
    await page
      .getByRole('button', { name: 'Close account', exact: true })
      .click();
    await expect(page.locator('#piw-account')).not.toBeVisible();
    expect(requests).toBe(0);
    expect(errors).toEqual([]);
  });
}

test('one account reuses sessions across games and keeps local/cloud saves distinct', async ({
  page,
}) => {
  const backend = await mockBackend(page);
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/arcade/colonization/');
  await open(page);
  await page
    .getByRole('button', { name: 'Save on this device', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Close account', exact: true })
    .click();
  await page.locator('#end').click();
  await expect(page.locator('#stats')).toContainText('1493');
  await open(page);
  await login(page);
  await expect(page.locator('#stats')).toContainText('1493');
  expect(backend.saves.size).toBe(0);
  await page
    .getByRole('button', { name: 'Upload existing local save', exact: true })
    .click();
  await expect(page.locator('#piw-status')).toContainText(
    'Cloud save uploaded',
  );
  expect(backend.saves.get(FIRST + ':colonization').payload.save.st.year).toBe(
    1492,
  );
  await page
    .getByRole('button', { name: 'Load cloud save', exact: true })
    .click();
  await expect(page.locator('#stats')).toContainText('1492');
  await page
    .getByRole('button', {
      name: 'Restore previous local session',
      exact: true,
    })
    .click();
  await expect(page.locator('#stats')).toContainText('1493');
  await page.locator('#piw-muted').check();
  await page
    .getByRole('button', {
      name: 'Save sound settings to account',
      exact: true,
    })
    .click();
  await expect(page.locator('#piw-status')).toContainText(
    'Sound settings saved',
  );
  await page.goto('/arcade/park-builder/');
  await open(page);
  await expect(page.locator('#piw-identity')).toContainText(
    'player@example.test',
  );
  await expect(page.locator('#piw-cloud-info')).toContainText('No cloud save');
  await expect(page.locator('#piw-muted')).toBeChecked();
  await page
    .getByRole('button', { name: 'Save current game to cloud', exact: true })
    .click();
  await expect(page.locator('#piw-status')).toContainText(
    'Cloud save uploaded',
  );
  expect(backend.saves.size).toBe(2);
  await page
    .getByRole('button', { name: 'Sign out on this device', exact: true })
    .click();
  await expect(page.locator('#piw-guest')).toBeVisible();
  await login(page, 'second@example.test');
  await expect(page.locator('#piw-cloud-info')).toContainText('No cloud save');
  await expect(page.locator('#piw-saves li')).toHaveCount(0);
  expect(backend.saves.size).toBe(2);
});

test('a stale device cannot silently overwrite a newer cloud save', async ({
  page,
}) => {
  const backend = await mockBackend(page);
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/arcade/colonization/');
  await open(page);
  await login(page);
  await page
    .getByRole('button', { name: 'Save current game to cloud', exact: true })
    .click();
  await expect(page.locator('#piw-status')).toContainText(
    'Cloud save uploaded',
  );
  const row = backend.saves.get(FIRST + ':colonization');
  row.revision = 2;
  row.payload.save.st.year = 1550;
  await page
    .getByRole('button', { name: 'Save current game to cloud', exact: true })
    .click();
  await expect(page.locator('#piw-status')).toContainText(
    'Nothing was overwritten',
  );
  expect(backend.saves.get(FIRST + ':colonization').payload.save.st.year).toBe(
    1550,
  );
  await page
    .getByRole('button', { name: 'Refresh cloud saves', exact: true })
    .click();
  await expect(page.locator('#piw-cloud-info')).toContainText('revision 2');
  await page
    .getByRole('button', { name: 'Save current game to cloud', exact: true })
    .click();
  await expect(page.locator('#piw-status')).toContainText(
    'Cloud save uploaded',
  );
  expect(backend.saves.get(FIRST + ':colonization').revision).toBe(3);
});

test('Riva game score and game-specific settings can be saved and restored', async ({
  page,
}) => {
  const backend = await mockBackend(page);
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/arcade/rivas-shapes/');
  await page.locator('#start').click();
  await page.locator('#faces').click();
  await open(page);
  await login(page);
  await page
    .getByRole('button', { name: 'Save current game to cloud', exact: true })
    .click();
  await expect(page.locator('#piw-status')).toContainText(
    'Cloud save uploaded',
  );
  const row = backend.saves.get(FIRST + ':rivas-shapes');
  expect(row.payload.save.settings.faces).toBe(true);
  row.payload.save.score = 17;
  await page
    .getByRole('button', { name: 'Refresh cloud saves', exact: true })
    .click();
  await expect(page.locator('#piw-status')).toContainText(
    'Cloud records refreshed',
  );
  await page
    .getByRole('button', { name: 'Load cloud save', exact: true })
    .click();
  await expect(page.locator('#score')).toHaveText('17');
  await page
    .getByRole('button', { name: 'Close account', exact: true })
    .click();
  await expect(page.locator('#faces')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#pause')).toContainText('Resume');
});

test('failed public signup is explained and does not block guest local saves', async ({
  page,
}) => {
  const backend = await mockBackend(page);
  backend.signupBlocked = true;
  await page.goto('/arcade/colonization/');
  await open(page);
  await page.locator('#piw-email').fill('player@example.test');
  await page
    .locator('#piw-password')
    .fill('example-password-only-for-mocked-tests');
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(page.locator('#piw-status')).toContainText(
    'Account email delivery is not available',
  );
  await page
    .getByRole('button', { name: 'Save on this device', exact: true })
    .click();
  await expect(page.locator('#piw-status')).toContainText(
    'Saved on this device',
  );
});

test('account dialog has accessible labels and does not send typed keys to the game', async ({
  page,
}) => {
  await page.goto('/arcade/colonization/');
  await open(page);
  await page.locator('#piw-email').fill('player@example.test');
  await page.locator('#piw-password').fill('p');
  await page.locator('#piw-password').press('ArrowRight');
  await expect(page.locator('#stats')).toContainText('1492');
  const AxeBuilder = require('@axe-core/playwright').default;
  test.beforeEach(async ({ page }) => {
    await page.route('https://*.ingest.de.sentry.io/**', (r) =>
      r.fulfill({ status: 200, body: '{}' }),
    );
  });
  const report = await new AxeBuilder({ page })
    .include('#piw-account')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(report.violations).toEqual([]);
});
