# Shared arcade accounts

All three games remain playable without an account. Existing local keys and save buttons are preserved. Shared account controls offer local saving, explicit cloud upload/download, three local pre-load backups, and shared mute/volume settings. New World, Park Builder, and Riva's Shapes use one Supabase identity with separate game records.

The account SDK is loaded only when an account action needs it or a stored session/callback is present. No Supabase request is made during ordinary guest play. Only the publishable API key is included in browser code; no service-role or private key belongs here.

## Behavior

- Signing in changes neither the current game nor its local save.
- Upload existing local save uses the previously saved browser snapshot. Save current game to cloud uses the running game state.
- Existing cloud replacement and cloud loading require explicit confirmation.
- Cloud writes use invoker SQL functions with expected revision numbers. A changed revision returns a conflict; the UI requires refresh/review rather than retrying the overwrite automatically.
- Loading validates the game format and backs up the current session locally first. The user can restore the previous local session from the same controls.
- Sound preferences are local by default and can be explicitly saved to or loaded from the same account. Game-specific settings are included in the game's snapshot; New World's music preference is stored alongside it.
- A cloud restore in Riva's Shapes resumes the score/settings with newly generated shapes, paused until the parent presses Resume.
- Sign out is local to this device. Local game saves remain on the device and are not private from other people sharing that browser.

## Supabase setup needed for public registration

Project: placesiwent (`uabgxxbrjympqqwsryqj`). Database schema is documented in `supabase/schema/arcade_accounts.sql`; the hosted migration history records its application. There is no hosted admin key in this repository.

1. Authentication → URL Configuration: set Site URL to `https://placesiwent.eu/arcade/account/` and allow that exact callback in Redirect URLs. Keep email confirmation enabled.
2. Authentication → Email/SMTP settings: configure a transactional email provider and a verified sender. Supabase's default sender only permits project-team email addresses. Public email signup and password recovery are not ready until this is configured. Store SMTP credentials in Supabase settings, never in this repository or chat.
3. Verify signup, email confirmation, password sign-in, forgot-password delivery and recovery using a real address you control. Automated tests mock these auth endpoints and never send email.

Reference: https://supabase.com/docs/guides/auth/auth-smtp and https://supabase.com/docs/guides/auth/redirect-urls . No account is needed for guest play or local saves while email setup is pending.

## Data security and validation

`arcade_saves`: one record per user per supported game, maximum 1 MiB JSON each. `arcade_preferences`: one record per user, maximum 8 KiB. RLS and explicit SELECT/INSERT/UPDATE/DELETE ownership policies restrict records to `auth.uid()`. Guests have no table or RPC access. Public SQL functions are SECURITY INVOKER with a fixed search path and no PUBLIC execution grant. Supported game IDs must be extended deliberately when adding a new game.

The hosted database was verified with rolled-back synthetic users: owner write/update, cross-user read/write denial, owner reassignment denial, size limits, guest denial and stale revision rejection. No test user or game save was retained. Run Supabase advisors after schema changes.

## Development

- `npm run build:account` bundles the pinned Supabase browser SDK using esbuild and preserves its MIT license. The same command runs before browser tests and packaging.
- `assets/arcade/account.js` contains shared account UI and orchestration. SDK methods remain in the official client library.
- Each active game registers a `window.PiwGameAdapters` entry with export/import/validation and its existing local key. Keep historic game versions untouched.
- `tests/accounts.spec.cjs` exercises guest/offline behavior and uses a mocked Supabase Auth/Data API with the real bundled SDK for login/session and cloud-save flows. These mocks do not prove provider email delivery; the separate real database tests prove ownership policies.
- The existing gated workflow tests the public site before publishing it. Account/login changes do not grant blog editing or Inspectorate access.
