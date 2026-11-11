const { test: base, expect } = require('@playwright/test');
const path = require('node:path');
const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (error) => {
      if (error.message !== 'Playwright monitoring verification')
        errors.push(error.message);
    });
    // Keep automated runs out of the real Sentry issue stream.
    await page.route('https://*.ingest.de.sentry.io/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}',
      }),
    );
    await use(page);
    expect(errors, 'Unexpected JavaScript errors').toEqual([]);
  },
});

test('homepage links open each public section', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Places I Went',
  );
  for (const href of ['/explore/', '/blog/', '/arcade/', '/web-apps/']) {
    await page.goto('/');
    await page.locator(`a[href="${href}"]`).click();
    await expect(page).toHaveURL(new RegExp(href + '$'));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
});

for (const route of ['/explore/', '/explore/dev/']) {
  test(`Explore map renders and offers short search radii: ${route}`, async ({
    page,
  }) => {
    // Exercise the real Leaflet library without depending on a public CDN or tile service.
    await page.route(
      'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/**',
      (r) => {
        const name = new URL(r.request().url()).pathname.split('/').pop();
        if (!['leaflet.js', 'leaflet.css'].includes(name)) return r.abort();
        return r.fulfill({
          path: path.join(__dirname, '../node_modules/leaflet/dist', name),
          contentType: name.endsWith('.js') ? 'text/javascript' : 'text/css',
        });
      },
    );
    await page.route('https://tile.openstreetmap.org/**', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
          'base64',
        ),
      }),
    );
    await page.goto(route);
    await expect(page.locator('#poi-map')).toBeVisible();
    await expect(
      page.locator('#poi-map .leaflet-control-zoom-in'),
    ).toBeVisible();
    expect(
      (await page.locator('#poi-map').boundingBox()).height,
    ).toBeGreaterThan(150);
    await page.locator('#radius').selectOption('100');
    await expect(page.locator('#radius')).toHaveValue('100');
    await page.locator('#radius').selectOption('500');
    await expect(page.locator('#radius')).toHaveValue('500');
    await expect(page.locator('#scan')).toBeEnabled();
  });
}

test('Colonization advances a turn, zooms, opens trade and restores a save', async ({
  page,
}) => {
  await page.goto('/arcade/colonization/');
  await expect(page.locator('#map')).toBeVisible();
  await expect(page.locator('#stats')).toContainText('1492');
  // Zoom controls are intentionally available only in the compact layout.
  await page.setViewportSize({ width: 800, height: 900 });
  const before = await page.locator('#zoomLabel').textContent();
  await page.locator('#zoomIn').click();
  await expect(page.locator('#zoomLabel')).not.toHaveText(before);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('#save').click();
  await page.locator('#end').click();
  await expect(page.locator('#stats')).toContainText('1493');
  await page.locator('#load').click();
  await expect(page.locator('#stats')).toContainText('1492');
  await page.locator('#europe').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#modalTitle')).toContainText('Europe');
  await page.locator('#close').click();
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('Park Builder pauses, changes speed, and restores saved settings', async ({
  page,
}) => {
  await page.goto('/arcade/park-builder/');
  await expect(page.locator('#world')).toBeVisible();
  await page.locator('#pause').click();
  await expect(page.locator('#pause')).toContainText('Resume');
  await page.locator('#speed').click();
  await expect(page.locator('#speed')).toContainText('2×');
  await page.locator('#save').click();
  await page.locator('#speed').click();
  await expect(page.locator('#speed')).toContainText('4×');
  await page.locator('#load').click();
  await expect(page.locator('#speed')).toContainText('2×');
  await expect(page.locator('#pause')).toContainText('Resume');
});

test('Sentry initializes and captures an unhandled error without leaking URL parameters', async ({
  page,
}) => {
  let envelope;
  await page.route('https://*.ingest.de.sentry.io/**', async (route) => {
    envelope = route.request().postData();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    });
  });
  await page.goto('/?token=playwright-private-value#private-fragment');
  await expect
    .poll(() => page.evaluate(() => !!window.Sentry?.getClient()))
    .toBe(true);
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error('Playwright monitoring verification');
    }, 0);
  });
  await expect
    .poll(() => envelope)
    .toContain('Playwright monitoring verification');
  expect(envelope).not.toContain('playwright-private-value');
  expect(envelope).not.toContain('private-fragment');
});
