# Browser checks

GitHub Actions runs `Quality checks and publishing` for relevant pushes and pull requests into main. It can also be started from the Actions tab with Run workflow. It tests the checked-out source on localhost in desktop Chromium and Firefox; it does not test or alter saved visitor games.

Coverage: homepage navigation; live and DEV Explore map visibility and radius selectors; Colonization zoom, turns, save/restore and trade dialog; Park Builder pause, speed and save/restore; Sentry initialization, automatic error capture and URL sanitization. Unhandled JavaScript errors fail ordinary tests.

The Explore tests use the real Leaflet library from a pinned npm dependency and stub map tiles. They do not verify OpenStreetMap/Wikipedia availability or a real location scan. Sentry requests are intercepted and checked locally; no test events are sent to the production project. Speed tests and professional Inspectorate tools are outside this initial suite.

## Run on a computer

Install Node.js 24 LTS, then from this repository:

```sh
npm ci
npx playwright install chromium firefox
npm test
```

`npm run test:ui` opens the interactive test runner. `npm run test:report` opens the last HTML report.

## Diagnose a failure

Open the failed Quality checks and publishing run in GitHub Actions. Annotations identify the failed assertion. Download `quality-reports` for the HTML report, screenshots, videos and traces. Reports expire after seven days. A report can be opened with `npx playwright show-report <path-to-playwright-report>`; traces can be opened with `npx playwright show-trace <trace.zip>`.

Publishing now has a quality → package → deploy workflow. It becomes the publishing gate after the repository Pages source is switched to GitHub Actions. Until that one-time setting change, the old branch publisher remains independent. See [QUALITY.md](../QUALITY.md) for activation, coverage, screenshot baselines, accessibility and performance budgets.
