const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
for (const url of ['/', '/arcade/', '/web-apps/']) {
  test(`accessibility and desktop layout: ${url}`, async ({ page }) => {
    await page.route('https://*.ingest.de.sentry.io/**', (r) =>
      r.fulfill({ status: 200, body: '{}' }),
    );
    await page.goto(url);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  });
}
for (const width of [1280, 800]) {
  test(`@visual homepage at ${width}px`, async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'Canonical screenshot baselines use Chromium on Linux.',
    );
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page).toHaveScreenshot(`homepage-${width}.png`, {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.002,
    });
  });
}
