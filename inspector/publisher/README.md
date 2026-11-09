# Org-chart publishing service

The shared LIVE chart lives at `/inspector/Mesh/`, backed by `inspector/data/team.json`.
The shared DEV chart lives at `/inspector/Meshdev/`, backed by `inspector/data/team-dev.json`.
Both environments use the same authenticated GitHub App and Worker but independent datasets and browser drafts.

## One-time Cloudflare deployment

The Worker already exists at `https://orgchart-publisher.orakio.workers.dev`.

1. Open Cloudflare dashboard -> Workers & Pages -> **orgchart-publisher** -> **Edit code**.
2. Replace the default Hello World Worker with the entire contents of [worker.js](./worker.js).
3. Click **Deploy**. No secret values should ever be pasted into this repository or the website.
4. Open [Worker health](https://orgchart-publisher.orakio.workers.dev/health): it should return JSON with `"ok":true` and `"configured":true`.
5. Open [MESH LIVE](https://placesiwent.eu/inspector/Mesh/), click **Sign in to publish**, authorize with GitHub user `orakiotriestocode`, then edit and **Publish changes**.
6. Check the resulting GitHub commit to `inspector/data/team.json`, then verify the public chart after GitHub Pages deployment.

Required Cloudflare variables (Production):
- GITHUB_APP_ID (variable)
- GITHUB_INSTALLATION_ID (variable)
- GITHUB_CLIENT_ID (variable)
- GITHUB_PRIVATE_KEY (encrypted secret, original PKCS#1 or PKCS#8 PEM)
- GITHUB_CLIENT_SECRET (encrypted secret)
- SESSION_SECRET (encrypted secret, 32+ characters)

Github App install permission: **Contents read/write**, restricted to repo `orakiotriestocode/placesiwent`. GitHub App OAuth redirect URL: `https://orgchart-publisher.orakio.workers.dev/auth/callback`.

Security model: the Worker checks signed two-hour sessions from GitHub identity `orakiotriestocode`, restricts browser CORS to placesiwent.eu, writes only `inspector/data/team.json`, and requires the original file SHA on every publish to prevent overwriting concurrent work. The website itself is public and visitors can still edit browser-local drafts and export/import data without login. Publishing is distinct from GitHub Pages deploying; changes become visible to all after deployment. Back up a local draft before discarding it. A later multi-team version should replace the fixed repository path and authorized user with audited per-organization settings.

## Environment separation

| Page | Published data | Worker revision endpoint | Worker publish endpoint |
| --- | --- | --- | --- |
| LIVE `/inspector/Mesh/` | `inspector/data/team.json` | `GET /api/head` | `POST /api/publish` |
| DEV `/inspector/Meshdev/` | `inspector/data/team-dev.json` | `GET /api/dev/head` | `POST /api/dev/publish` |

After updating Worker source, redeploy it in Cloudflare's **Edit code** interface. A `/health` success alone only confirms configuration, not the presence of new DEV routes. Older browser-only DEV edits are intentionally retained as an unpublished draft on first load; fresh visitors load the shared DEV dataset. Publish changes from DEV to update DEV only.
