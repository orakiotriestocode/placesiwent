# Quality automation

`Quality checks and publishing` runs on every main push and pull request. The workflow checks code, exercises Chromium and Firefox, checks accessibility on the homepage, arcade and web-apps landing pages, compares homepage screenshots, and audits homepage/arcade performance with Lighthouse. Reports are stored in GitHub Actions for seven days; they are not uploaded to an external public report service.

## Commands

- `npm ci`: install pinned dependencies.
- `npm run check`: ESLint, active inline/external JavaScript syntax checks, and scoped Prettier checks.
- `npm test`: browser, accessibility, and visual tests.
- `npm run test:performance`: local Lighthouse reports and budgets.
- `npm run build`: package tracked website files into `_site`, excluding dependencies, tests, automation and reports.
- `npm run test:visual:update`: intentionally regenerate screenshot baselines. Run on Linux with the pinned Chromium version; review the before/after images before committing. Never regenerate baselines automatically to make an unexpected change pass.

ESLint and formatting initially cover test/automation code, shared monitoring, and root CJS configuration. Syntax checks cover active JavaScript and inline HTML scripts across the site. Vendor bundles and historical versions are excluded. Existing application HTML is not mass-reformatted.

Lighthouse currently enforces a performance score of 60, LCP under six seconds, CLS under 0.15, and page transfer weight under 1.5 MB on the homepage and arcade. These are initial coarse regression budgets, not a claim that all pages have been optimized. Accessibility automation supplements manual review; it cannot establish complete WCAG compliance.

Dependabot proposes npm and GitHub Actions updates weekly on Monday morning, Europe/Brussels. Updates are reviewed through pull requests and the same checks; they do not auto-merge.

## Activate gated publishing (one-time repository setting)

In GitHub repository Settings → Pages → Build and deployment → Source, select **GitHub Actions** instead of **Deploy from a branch**. Preserve the existing custom domain and HTTPS settings. Then run `Quality checks and publishing` on main from Actions → Run workflow.

Before that source switch, the old branch-based Pages publisher still operates independently and this workflow cannot prevent it from publishing a failing commit. After the switch, the workflow's `package` job requires `quality` to pass and `deploy` requires `package`. Pull requests never deploy. A failed check leaves the previous successful deployment live.

This gate covers GitHub Pages only. The orgchart publisher Worker has a separate existing deployment workflow. Branch protection and human approval rules are separate from this deployment dependency chain.
