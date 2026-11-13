// No browser credentials: session capabilities are hashed and checked server-side.
const root = Deno.env.get('SUPABASE_URL')! + '/rest/v1/';
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const headers = {
  apikey: key,
  Authorization: 'Bearer ' + key,
  'Content-Type': 'application/json',
};
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};
async function db(path: string, method = 'GET', body?: unknown) {
  const r = await fetch(root + path, {
    method,
    headers: { ...headers, Prefer: 'return=representation' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw Error('Storage temporarily unavailable');
  return r.status === 204 ? null : await r.json();
}
const hash = async (s: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
const token = () => crypto.randomUUID() + crypto.randomUUID();
const langs = ['nl-BE', 'nl-NL', 'en-GB', 'en-US', 'fr-FR', 'de-DE', 'es-ES'];
Deno.serve(async (req) => {
  const reply = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'POST required' }, 405);
  try {
    if (Number(req.headers.get('content-length')) > 40000)
      return reply({ error: 'Request too large' }, 413);
    const raw = await req.text();
    if (raw.length > 40000) return reply({ error: 'Request too large' }, 413);
    const b = JSON.parse(raw),
      now = new Date().toISOString();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    if (['create', 'join'].includes(b.action)) {
      const allowed = await db('rpc/bear_rate_limit', 'POST', {
        p_key: await hash(ip),
        p_max: 15,
      });
      if (!allowed)
        return reply(
          { error: 'Too many attempts. Please wait a minute.' },
          429,
        );
    }
    if (b.action === 'create') {
      await db('bear_sessions?expires_at=lt.' + now, 'DELETE');
      await db(
        'bear_limits?until_at=lt.' +
          new Date(Date.now() - 3600000).toISOString(),
        'DELETE',
      );
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const code = Array.from(
        crypto.getRandomValues(new Uint8Array(10)),
        (v) => alphabet[v % 32],
      ).join('');
      const tablet = token(),
        id = crypto.randomUUID(),
        expires = new Date(Date.now() + 7200000).toISOString();
      await db('bear_sessions', 'POST', {
        id,
        code_hash: await hash(code),
        tablet_hash: await hash(tablet),
        pair_until: new Date(Date.now() + 600000).toISOString(),
        expires_at: expires,
        tablet_seen: now,
      });
      return reply({ id, token: tablet, code, expires });
    }
    if (b.action === 'join') {
      const code = String(b.code || '')
        .toUpperCase()
        .replace(/[\s-]/g, '');
      if (!/^[A-Z2-9]{10}$/.test(code))
        return reply({ error: 'Enter the ten-character tablet code.' }, 400);
      const controller = token();
      const rows = await db(
        'bear_sessions?code_hash=eq.' +
          (await hash(code)) +
          '&controller_hash=is.null&pair_until=gt.' +
          now +
          '&expires_at=gt.' +
          now,
        'PATCH',
        { controller_hash: await hash(controller), controller_seen: now },
      );
      if (!rows.length)
        return reply(
          {
            error:
              'Code unavailable, expired or already paired. Start a new tablet session.',
          },
          403,
        );
      return reply({
        id: rows[0].id,
        token: controller,
        expires: rows[0].expires_at,
      });
    }
    if (
      !/^[0-9a-f-]{36}$/.test(b.id || '') ||
      typeof b.token !== 'string' ||
      b.token.length > 100
    )
      return reply({ error: 'Session required' }, 403);
    const rows = await db(
      'bear_sessions?id=eq.' + b.id + '&expires_at=gt.' + now,
    );
    const s = rows[0],
      h = await hash(b.token);
    if (!s)
      return reply({ error: 'Session ended. Start again on the tablet.' }, 410);
    const tablet = h === s.tablet_hash,
      parent = h === s.controller_hash;
    if (!tablet && !parent)
      return reply({ error: 'Session access denied' }, 403);
    if (b.action === 'end') {
      await db('bear_sessions?id=eq.' + b.id, 'DELETE');
      return reply({ ok: true });
    }
    if (b.action === 'poll') {
      await db(
        'bear_sessions?id=eq.' + b.id,
        'PATCH',
        tablet ? { tablet_seen: now } : { controller_seen: now },
      );
      const messages = await db(
        'bear_messages?session_id=eq.' +
          b.id +
          (tablet
            ? '&order=id.asc&status=eq.queued'
            : '&order=id.desc&limit=15'),
      );
      return reply({
        paired: !!s.controller_hash,
        reaction: s.reaction,
        voiceState: s.voice_state,
        stopId: s.stop_id,
        online:
          Date.now() - Date.parse(tablet ? s.controller_seen : s.tablet_seen) <
          20000,
        messages,
      });
    }
    if (b.action === 'voices' && tablet) {
      if (
        !Array.isArray(b.voices) ||
        b.voices.length > 150 ||
        !['untested', 'ready', 'blocked', 'unavailable'].includes(b.ready)
      )
        return reply({ error: 'Invalid voice report' }, 400);
      const voices = b.voices.map((v: any) => ({
        uri: String(v.uri).slice(0, 200),
        name: String(v.name).slice(0, 100),
        lang: String(v.lang).slice(0, 30),
      }));
      await db('bear_sessions?id=eq.' + b.id, 'PATCH', {
        voice_state: { voices, ready: b.ready },
      });
      return reply({ ok: true });
    }
    if (b.action === 'stop' && (parent || tablet)) {
      await db(
        'bear_messages?session_id=eq.' +
          b.id +
          '&status=in.(queued,speaking,blocked)',
        'PATCH',
        { status: 'stopped' },
      );
      await db('bear_sessions?id=eq.' + b.id, 'PATCH', {
        stop_id: crypto.randomUUID(),
        reaction: null,
      });
      return reply({ ok: true });
    }
    if (b.action === 'react' && parent) {
      if (
        ![
          'happy',
          'wave',
          'love',
          'giggle',
          'sleepy',
          'tilt',
          'neutral',
        ].includes(b.emotion) ||
        !langs.includes(b.lang) ||
        typeof b.sound !== 'boolean' ||
        !/^[0-9a-f-]{36}$/.test(b.requestId || '')
      )
        return reply({ error: 'Check reaction' }, 400);
      if (
        !(await db('rpc/bear_rate_limit', 'POST', {
          p_key: b.id + ':react',
          p_max: 40,
        }))
      )
        return reply({ error: 'Please slow down a little' }, 429);
      await db('bear_sessions?id=eq.' + b.id, 'PATCH', {
        reaction: {
          id: b.requestId,
          emotion: b.emotion,
          lang: b.lang,
          sound: b.sound,
          expires: Date.now() + 12000,
        },
      });
      return reply({ ok: true });
    }
    if (b.action === 'send' && parent) {
      if (
        !langs.includes(b.lang) ||
        (b.voice !== undefined &&
          (typeof b.voice !== 'string' || b.voice.length > 200)) ||
        (b.rate !== undefined &&
          (typeof b.rate !== 'number' ||
            !Number.isFinite(b.rate) ||
            b.rate < 0.5 ||
            b.rate > 1.5)) ||
        !['happy', 'wave', 'sleepy', 'love', 'giggle', 'tilt'].includes(
          b.emotion,
        ) ||
        typeof b.text !== 'string' ||
        !b.text.trim() ||
        b.text.length > 500 ||
        !/^[0-9a-f-]{36}$/.test(b.requestId || '')
      )
        return reply({ error: 'Check message and language' }, 400);
      if (
        !(await db('rpc/bear_rate_limit', 'POST', { p_key: b.id, p_max: 20 }))
      )
        return reply({ error: 'Please slow down a little' }, 429);
      const existing = await db(
        'bear_messages?session_id=eq.' + b.id + '&request_id=eq.' + b.requestId,
      );
      if (existing.length) return reply({ ok: true });
      await db('bear_messages', 'POST', {
        session_id: b.id,
        request_id: b.requestId,
        text: b.text.trim(),
        voice: b.voice || '',
        rate: b.rate ?? 0.88,
        lang: b.lang,
        emotion: b.emotion,
      });
      return reply({ ok: true });
    }
    if (
      b.action === 'ack' &&
      tablet &&
      ['speaking', 'spoken', 'blocked', 'stopped'].includes(b.status) &&
      Number.isSafeInteger(b.messageId)
    ) {
      await db(
        'bear_messages?session_id=eq.' +
          b.id +
          '&id=eq.' +
          b.messageId +
          '&status=in.(queued,speaking,blocked)',
        'PATCH',
        { status: b.status },
      );
      return reply({ ok: true });
    }
    return reply({ error: 'Action not allowed' }, 403);
  } catch {
    return reply({ error: 'Connection problem. Please try again.' }, 500);
  }
});
