// Exercise the production handler against in-memory REST responses, never a live service.
const vm = require('node:vm'),
  fs = require('node:fs'),
  assert = require('node:assert/strict');
const { stripTypeScriptTypes } = require('node:module');
const crypto = require('node:crypto').webcrypto;
const hash = async (s) =>
  Buffer.from(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)),
  ).toString('hex');
(async () => {
  const id = crypto.randomUUID();
  let handler,
    allow = true;
  const row = {
    id,
    tablet_hash: await hash('receiver'),
    controller_hash: await hash('sender'),
    expires_at: new Date(Date.now() + 100000).toISOString(),
  };
  const calls = [];
  const ctx = {
    crypto,
    TextEncoder,
    Uint8Array,
    Date,
    Response,
    Request,
    JSON,
    Number,
    String,
    Array,
    Error,
    Deno: {
      env: {
        get: (k) =>
          k === 'SUPABASE_URL' ? 'https://test.invalid' : 'test-service-key',
      },
      serve: (h) => (handler = h),
    },
    fetch: async (url, opts) => {
      const path = new URL(url).pathname;
      calls.push({ path, method: opts.method });
      const body = opts.body ? JSON.parse(opts.body) : null;
      let data = [];
      if (path.endsWith('/bear_rate_limit')) data = allow;
      else if (path.endsWith('/bear_sessions')) {
        if (opts.method === 'PATCH') Object.assign(row, body);
        data = [row];
      }
      return Response.json(data);
    },
  };
  vm.runInNewContext(
    stripTypeScriptTypes(fs.readFileSync('scripts/bear-talk/edge.ts', 'utf8')),
    ctx,
  );
  async function call(action, token = 'sender', extra = {}) {
    return handler(
      new Request('https://test.invalid/bear-talk', {
        method: 'POST',
        body: JSON.stringify({ action, id, token, ...extra }),
      }),
    );
  }
  const extra = {
    emotion: 'wave',
    lang: 'nl-BE',
    sound: false,
    requestId: crypto.randomUUID(),
  };
  assert.equal((await call('react', 'sender', extra)).status, 200);
  assert.equal(row.reaction.emotion, 'wave');
  assert.ok(row.reaction.expires > Date.now());
  const r = await (await call('poll', 'receiver')).json();
  assert.equal(r.reaction.id, extra.requestId);
  assert.equal((await call('react', 'receiver', extra)).status, 403);
  assert.equal((await call('react', 'wrong', extra)).status, 403);
  assert.equal(
    (await call('react', 'sender', { ...extra, emotion: 'untrusted' })).status,
    400,
  );
  assert.equal(
    (await call('react', 'sender', { ...extra, sound: 'yes' })).status,
    400,
  );
  allow = false;
  assert.equal((await call('react', 'sender', extra)).status, 429);
  allow = true;
  assert.ok(
    !calls.some(
      (c) => c.path.endsWith('/bear_messages') && c.method === 'POST',
    ),
  );
  await call('stop');
  assert.equal(row.reaction, null);
  console.log(
    'PASS: real Edge handler validates reaction/token/role, rate limit, poll payload, no speech-message insert, and Stop clears reactions. No live services used.',
  );
})();
