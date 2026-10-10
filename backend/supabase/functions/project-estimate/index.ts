/* =============================================================================
 * POST /project-estimate  —  Supabase Edge Function (Deno)
 *
 * This file is the only part of the lead system that touches the network, the
 * clock or a secret. The decision-making lives in ../_shared/handler.js, which
 * is plain ES modules and is unit-tested under Node; everything here is wiring.
 *
 * Secrets read from the function environment and NEVER returned to a caller:
 *   GEMINI_API_KEY, RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY,
 *   TURNSTILE_SECRET_KEY, THROTTLE_SALT
 * ========================================================================== */

import { handleEstimate } from '../_shared/handler.js';

/* ── Environment ────────────────────────────────────────────────────────── */

const env = (k: string, fallback = ''): string => Deno.env.get(k) ?? fallback;

const SUPABASE_URL      = env('SUPABASE_URL');
const SERVICE_ROLE_KEY  = env('SUPABASE_SERVICE_ROLE_KEY');
const GEMINI_API_KEY    = env('GEMINI_API_KEY');
const RESEND_API_KEY    = env('RESEND_API_KEY');
const ADMIN_EMAIL       = env('ADMIN_NOTIFICATION_EMAIL');
const FROM_EMAIL        = env('NOTIFICATION_FROM_EMAIL', 'leads@resend.dev');
const TURNSTILE_SECRET  = env('TURNSTILE_SECRET_KEY');
const THROTTLE_SALT     = env('THROTTLE_SALT', 'change-me-in-production');
const SITE_URL          = env('PUBLIC_SITE_URL', 'https://mohamedgamal-attia.github.io/mohamed_gamal_portfolio/');
const ADMIN_URL         = env('PUBLIC_ADMIN_URL', SITE_URL.replace(/\/?$/, '/') + 'admin.html');
const ALLOWED_ORIGINS   = env('ALLOWED_ORIGINS', new URL(SITE_URL).origin)
                            .split(',').map((s) => s.trim()).filter(Boolean);

/* Model: a current stable Flash-class model, overridable without a redeploy of
 * this file. Keep it low-cost — this is structured pre-sales, not prose. */
const GEMINI_MODEL = env('GEMINI_MODEL', 'gemini-2.5-flash');

const RATE_LIMIT    = Number(env('RATE_LIMIT_PER_WINDOW', '5'));
const RATE_WINDOW_S = Number(env('RATE_LIMIT_WINDOW_SECONDS', '3600'));
const GEMINI_TIMEOUT_MS = Number(env('GEMINI_TIMEOUT_MS', '20000'));

/* ── Small helpers ──────────────────────────────────────────────────────── */

function corsHeaders(origin: string | null): Record<string, string> {
  // Echo the origin only when it is one we allow; never reflect blindly.
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] ?? '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Structured logs, with nothing identifying and no secret in them. */
function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console[level === 'error' ? 'error' : 'log'](JSON.stringify({ level, event, ...data }));
}

async function postgrest(path: string, init: RequestInit): Promise<Response> {
  return await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

/* ── Dependencies ───────────────────────────────────────────────────────── */

const db = {
  async insertLead(record: Record<string, unknown>) {
    const res = await postgrest('portfolio_leads', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(record),
    });
    if (!res.ok) throw new Error(`insert ${res.status}`);
    const rows = await res.json();
    return rows[0];
  },
  async updateLead(id: string, patch: Record<string, unknown>) {
    const res = await postgrest(`portfolio_leads?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`update ${res.status}`);
  },
};

async function rateLimit(ip: string): Promise<boolean> {
  try {
    const ipHash = await sha256Hex(THROTTLE_SALT + ':' + ip);
    const res = await postgrest('rpc/throttle_check', {
      method: 'POST',
      body: JSON.stringify({ p_ip_hash: ipHash, p_limit: RATE_LIMIT, p_window_secs: RATE_WINDOW_S }),
    });
    if (!res.ok) throw new Error(`throttle ${res.status}`);
    return await res.json() === true;
  } catch (err) {
    // Fail OPEN on an infrastructure fault: losing a real lead is worse than
    // allowing one extra request. Abuse is still bounded by the bot checks.
    log('error', 'throttle_unavailable', { message: String((err as Error)?.message) });
    return true;
  }
}

async function verifyBot(token: unknown, ip: string): Promise<boolean> {
  if (!TURNSTILE_SECRET) return true;             // not configured -> not enforced
  if (typeof token !== 'string' || !token) return false;
  try {
    const form = new FormData();
    form.append('secret', TURNSTILE_SECRET);
    form.append('response', token);
    if (ip) form.append('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body: form });
    const out = await res.json();
    return out?.success === true;
  } catch (err) {
    log('error', 'turnstile_unavailable', { message: String((err as Error)?.message) });
    return true;                                   // fail open, as above
  }
}

async function callGemini({ system, user, config }: { system: string; user: string; config: unknown }) {
  if (!GEMINI_API_KEY) throw new Error('model not configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: config,
        }),
      },
    );
    if (!res.ok) {
      // The body may echo the key in a URL; it is logged by status only.
      throw new Error(`model http ${res.status}`);
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
    if (!text) throw new Error('model returned no text');
    return { text, model: GEMINI_MODEL };
  } finally {
    clearTimeout(timer);
  }
}

async function sendEmail({ subject, html, text }: { subject: string; html: string; text: string }) {
  if (!RESEND_API_KEY || !ADMIN_EMAIL) throw new Error('email not configured');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [ADMIN_EMAIL], subject, html, text }),
  });
  if (!res.ok) throw new Error(`email http ${res.status}`);
}

/* ── Entry point ────────────────────────────────────────────────────────── */

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const cors = corsHeaders(origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, code: 'method' }), {
      status: 405, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    log('warn', 'origin_rejected', { origin });
    return new Response(JSON.stringify({ ok: false, code: 'origin' }), {
      status: 403, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const raw = await req.text();
  let body: unknown = null;
  try { body = JSON.parse(raw); } catch { body = null; }

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
          || req.headers.get('cf-connecting-ip') || 'unknown';

  let result;
  try {
    result = await handleEstimate(
      { body, headers: { referer: req.headers.get('referer') }, ip, rawBodyBytes: raw.length },
      {
        db, callGemini, sendEmail, verifyBot, rateLimit, log,
        randomBytes: (n: number) => crypto.getRandomValues(new Uint8Array(n)),
        now: () => new Date(),
        config: { siteUrl: SITE_URL, adminUrl: ADMIN_URL, botCheckRequired: Boolean(TURNSTILE_SECRET) },
      },
    );
  } catch (err) {
    // A bug here must still not describe itself to the caller.
    log('error', 'unhandled', { message: String((err as Error)?.message) });
    result = { status: 500, body: { ok: false, code: 'server' } };
  }

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
});
