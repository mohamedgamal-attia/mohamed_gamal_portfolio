/* =============================================================================
 * POST /resend-notification  —  Supabase Edge Function (Deno)
 *
 * Re-sends the lead notification email for one lead, for the case where the
 * first attempt failed. Called from the admin dashboard.
 *
 * Authorisation is NOT "the caller knows the URL". The caller's Supabase JWT
 * is verified against the project's auth server, and the resulting user must
 * be on the admin allow-list. Only then does the function use the service
 * role to read the lead.
 * ========================================================================== */

import { buildLeadEmail } from '../_shared/email.js';

const env = (k: string, fallback = ''): string => Deno.env.get(k) ?? fallback;

const SUPABASE_URL     = env('SUPABASE_URL');
const SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
const ANON_KEY         = env('SUPABASE_ANON_KEY');
const RESEND_API_KEY   = env('RESEND_API_KEY');
const ADMIN_EMAIL      = env('ADMIN_NOTIFICATION_EMAIL');
const FROM_EMAIL       = env('NOTIFICATION_FROM_EMAIL', 'leads@resend.dev');
const SITE_URL         = env('PUBLIC_SITE_URL', '');
const ADMIN_URL        = env('PUBLIC_ADMIN_URL', '');
/* Same fallback as project-estimate: an unset ALLOWED_ORIGINS must not mean
   "allow nothing", or the dashboard's re-send button always fails CORS. */
const DEFAULT_ORIGIN = 'https://mohamedgamal-attia.github.io';
function originsFrom(list: string, siteUrl: string): string[] {
  const parsed = list.split(',').map((s) => s.trim()).filter(Boolean);
  if (parsed.length) return parsed;
  try { return [new URL(siteUrl).origin]; } catch { return [DEFAULT_ORIGIN]; }
}
const ALLOWED_ORIGINS = originsFrom(env('ALLOWED_ORIGINS'), SITE_URL);

function cors(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] ?? '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'content-type, authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

const json = (body: unknown, status: number, h: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...h, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

function log(level: string, event: string, data: Record<string, unknown> = {}) {
  console[level === 'error' ? 'error' : 'log'](JSON.stringify({ level, event, ...data }));
}

async function service(path: string, init: RequestInit = {}): Promise<Response> {
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

/** Resolve the bearer token to a user id, or null. */
async function callerUserId(authHeader: string | null): Promise<string | null> {
  const token = (authHeader ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return typeof user?.id === 'string' ? user.id : null;
}

async function isAdmin(userId: string): Promise<boolean> {
  const res = await service(`admin_users?user_id=eq.${encodeURIComponent(userId)}&select=user_id`);
  if (!res.ok) return false;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length === 1;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const h = cors(origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json({ ok: false, code: 'method' }, 405, h);
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return json({ ok: false, code: 'origin' }, 403, h);

  const uid = await callerUserId(req.headers.get('authorization'));
  if (!uid || !(await isAdmin(uid))) {
    log('warn', 'resend_denied', {});
    return json({ ok: false, code: 'forbidden' }, 403, h);
  }

  let leadId = '';
  try { leadId = String((await req.json())?.leadId ?? ''); } catch { /* left blank */ }
  if (!/^[0-9a-f-]{36}$/i.test(leadId)) return json({ ok: false, code: 'bad_request' }, 400, h);

  const res = await service(`portfolio_leads?id=eq.${encodeURIComponent(leadId)}&select=*`);
  if (!res.ok) return json({ ok: false, code: 'server' }, 500, h);
  const rows = await res.json();
  if (!rows.length) return json({ ok: false, code: 'not_found' }, 404, h);
  const r = rows[0];

  const mail = buildLeadEmail({
    lead: {
      reference: r.reference, fullName: r.full_name, email: r.email, phone: r.phone,
      countryCode: r.country_code, countryName: r.country_name,
      language: r.preferred_language, projectType: r.project_type,
      description: r.description, desiredTimeline: r.desired_timeline,
      clientBudget: r.client_budget, referenceUrl: r.reference_url,
      complexity: r.complexity, pricingTier: r.pricing_tier,
      pricingFloorUsd: r.pricing_floor_usd, pricingCeilingUsd: r.pricing_ceiling_usd,
    },
    quote: r.ai_price_min_usd ? {
      priceMinUsd: r.ai_price_min_usd, priceMaxUsd: r.ai_price_max_usd,
      estimatedTimeline: r.ai_timeline, customerMessage: r.ai_response_text ?? '',
    } : null,
    aiFailed: r.status === 'ai_failed',
    siteUrl: SITE_URL,
    adminUrl: ADMIN_URL,
  });

  try {
    if (!RESEND_API_KEY || !ADMIN_EMAIL) throw new Error('email not configured');
    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: [ADMIN_EMAIL], subject: mail.subject, html: mail.html, text: mail.text }),
    });
    if (!sent.ok) throw new Error(`email http ${sent.status}`);
  } catch (err) {
    log('error', 'resend_failed', { message: String((err as Error)?.message) });
    await service(`portfolio_leads?id=eq.${encodeURIComponent(leadId)}`, {
      method: 'PATCH', body: JSON.stringify({ email_notification_status: 'failed' }),
    });
    return json({ ok: false, code: 'email_failed' }, 502, h);
  }

  await service(`portfolio_leads?id=eq.${encodeURIComponent(leadId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ email_notification_status: 'sent', last_notified_at: new Date().toISOString() }),
  });
  return json({ ok: true }, 200, h);
});
