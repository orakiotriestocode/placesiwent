const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
async function run() {
  const { default: lighthouse } = await import('lighthouse');
  const { launch } = await import('chrome-launcher');
  const server = spawn(process.execPath, ['tests/serve.cjs'], {
    stdio: 'inherit',
  });
  let chrome;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        ready = (await fetch('http://localhost:4173/')).ok;
      } catch (_) {
        /* Wait for startup. */
      }
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!ready) throw Error('Performance test server did not start');
    chrome = await launch({
      chromePath: chromium.executablePath(),
      chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage'],
    });
    fs.mkdirSync('performance-report', { recursive: true });
    const summaries = [];
    for (const [name, pathname] of [
      ['home', '/'],
      ['arcade', '/arcade/'],
    ]) {
      const result = await lighthouse('http://localhost:4173' + pathname, {
        port: chrome.port,
        output: ['html', 'json'],
        logLevel: 'error',
        onlyCategories: [
          'performance',
          'accessibility',
          'best-practices',
          'seo',
        ],
      });
      if (!result || result.lhr.runtimeError)
        throw Error(
          'Lighthouse failed: ' + JSON.stringify(result?.lhr.runtimeError),
        );
      fs.writeFileSync(`performance-report/${name}.html`, result.report[0]);
      fs.writeFileSync(`performance-report/${name}.json`, result.report[1]);
      const audits = result.lhr.audits;
      const summary = {
        page: pathname,
        performance: result.lhr.categories.performance.score,
        lcp: audits['largest-contentful-paint'].numericValue,
        cls: audits['cumulative-layout-shift'].numericValue,
        bytes: audits['total-byte-weight'].numericValue,
      };
      summaries.push(summary);
      console.log(JSON.stringify(summary));
      if (
        summary.performance < 0.6 ||
        summary.lcp > 6000 ||
        summary.cls > 0.15 ||
        summary.bytes > 1500000
      )
        process.exitCode = 1;
    }
    fs.writeFileSync(
      'performance-report/summary.json',
      JSON.stringify(summaries, null, 2),
    );
    if (process.exitCode)
      console.error('Performance budget exceeded; inspect performance-report.');
  } finally {
    if (chrome) await chrome.kill();
    server.kill();
  }
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
