/* =============================================================================
 * handler.js — the whole POST /project-estimate flow.
 *
 * Every side effect (database, Gemini, email, clock, randomness, rate limit)
 * arrives as an injected dependency, so the flow below is the same code that
 * runs in production and under test. The Deno entry point in
 * supabase/functions/project-estimate/index.ts supplies the real ones.
 *
 * Order matters and is deliberate (§41): the lead is written BEFORE the model
 * is called, so a Gemini outage costs us a quote, never a customer.
 * ========================================================================== */

import { validateSubmission, makeReference, LIMITS } from './validation.js';
import { computePriceWindow } from './pricing.js';
import { buildUserMessage, SYSTEM_PROMPT, GENERATION_CONFIG } from './prompt.js';
import { parseModelJson, normaliseQuote } from './quote.js';
import { quoteFallbacks, errorBody, projectTypeLabel } from './messages.js';
import { buildLeadEmail } from './email.js';

/** Only the origin is kept from a referrer — never the full path. */
export function safeReferrerOrigin(value) {
  try { return new URL(String(value)).origin.slice(0, 200); } catch { return null; }
}

/**
 * @param {object} req  { body, headers, ip }
 * @param {object} deps {
 *   db: { insertLead, updateLead },
 *   callGemini: ({system,user,config}) => Promise<{text, model}>,
 *   sendEmail: ({subject,html,text}) => Promise<void>,
 *   verifyBot: (token, ip) => Promise<boolean>,
 *   rateLimit: (key) => Promise<boolean>,   // true = allowed
 *   randomBytes: (n) => Uint8Array,
 *   now: () => Date,
 *   log: (level, event, data) => void,
 *   config: { siteUrl, adminUrl, botCheckRequired }
 * }
 * @returns {{ status: number, body: object }}
 */
export async function handleEstimate(req, deps) {
  const { db, callGemini, sendEmail, verifyBot, rateLimit, randomBytes, now, log, config } = deps;
  const lang = (req.body && req.body.language === 'ar') ? 'ar' : 'en';

  /* 1 — size, before anything else parses or allocates */
  if (typeof req.rawBodyBytes === 'number' && req.rawBodyBytes > LIMITS.bodyBytes) {
    return { status: 413, body: errorBody('tooLarge', lang) };
  }

  /* 2 — rate limit, before any paid call */
  if (!(await rateLimit(req.ip || 'unknown'))) {
    log('warn', 'rate_limited', { ip: req.ip });
    return { status: 429, body: errorBody('rateLimited', lang) };
  }

  /* 3 — validate */
  const v = validateSubmission(req.body);
  if (!v.ok) {
    return { status: 400, body: { ...errorBody('validation', lang), errors: v.errors } };
  }
  const lead = v.value;

  /* 4 — bot checks. A tripped honeypot is answered with the same shape as a
   *     success, so a bot learns nothing, but nothing is stored or spent. */
  if (lead.honeypotTripped) {
    log('warn', 'honeypot', { ip: req.ip });
    return { status: 200, body: { ok: true, reference: makeReference(randomBytes(6)), quote: null, aiAvailable: false } };
  }
  if (config.botCheckRequired) {
    const passed = await verifyBot(req.body && req.body.botToken, req.ip);
    if (!passed) {
      log('warn', 'bot_check_failed', { ip: req.ip });
      return { status: 403, body: errorBody('botCheck', lang) };
    }
  }

  /* 5 — deterministic price window */
  const win = computePriceWindow({
    projectType: lead.projectType,
    countryCode: lead.countryCode,
    description: lead.description,
    extras: [lead.desiredTimeline, lead.clientBudget].filter(Boolean),
  });

  /* 6 — persist the lead before spending anything on AI */
  const reference = makeReference(randomBytes(6));
  const record = {
    reference,
    full_name: lead.fullName,
    email: lead.email,
    phone: lead.phone,
    country_code: lead.countryCode,
    country_name: lead.countryName,
    preferred_language: lead.language,
    project_type: win.projectType,
    description: lead.description,
    desired_timeline: lead.desiredTimeline,
    client_budget: lead.clientBudget,
    reference_url: lead.referenceUrl,
    status: 'new',
    pricing_tier: win.tier,
    complexity: win.complexity,
    pricing_floor_usd: win.allowedMinUsd,
    pricing_ceiling_usd: win.allowedMaxUsd,
    utm_source: lead.utmSource,
    utm_medium: lead.utmMedium,
    utm_campaign: lead.utmCampaign,
    referrer: safeReferrerOrigin(req.headers && req.headers.referer),
  };

  let saved;
  try {
    saved = await db.insertLead(record);
  } catch (err) {
    log('error', 'lead_insert_failed', { message: String(err && err.message) });
    return { status: 503, body: errorBody('server', lang) };
  }

  /* 7 — one model call per accepted submission */
  const fallbacks = quoteFallbacks(lead.language, projectTypeLabel(win.projectType, lead.language));
  let quote = null, aiFailed = false, modelName = null, raw = null, clamped = false;

  try {
    const user = buildUserMessage({
      language: lead.language,
      countryName: lead.countryName,
      projectType: win.projectType,
      description: lead.description,
      desiredTimeline: lead.desiredTimeline,
      clientBudget: lead.clientBudget,
      complexity: win.complexity,
      hardFloorUsd: win.floorUsd,
      allowedMinUsd: win.allowedMinUsd,
      allowedMaxUsd: win.allowedMaxUsd,
    });

    const res = await callGemini({ system: SYSTEM_PROMPT, user, config: GENERATION_CONFIG });
    modelName = res.model || null;
    raw = parseModelJson(res.text);

    const n = normaliseQuote(raw, win, {
      language: lead.language, projectType: win.projectType, fallbacks,
    });
    quote = n.quote;
    clamped = n.clamped;
    if (!n.usable) {
      log('warn', 'model_output_unusable', { reference, leaked: n.leaked, parsed: raw !== null });
    }
    if (n.injectionFlagged || n.leaked) {
      log('warn', 'injection_suspected', { reference, leaked: n.leaked, flagged: n.injectionFlagged });
    }
  } catch (err) {
    aiFailed = true;
    log('error', 'gemini_failed', { reference, message: String(err && err.message) });
  }

  /* 8 — record the outcome */
  try {
    await db.updateLead(saved.id, aiFailed
      ? { status: 'ai_failed' }
      : {
          status: 'quoted',
          ai_model: modelName,
          ai_summary: quote.summary,
          ai_scope: quote.recommendedScope,
          ai_price_min_usd: quote.priceMinUsd,
          ai_price_max_usd: quote.priceMaxUsd,
          ai_timeline: quote.estimatedTimeline,
          ai_assumptions: quote.assumptions,
          ai_response_text: quote.customerMessage,
          ai_raw_json: raw,
          ai_was_clamped: clamped,
        });
  } catch (err) {
    log('error', 'lead_update_failed', { reference, message: String(err && err.message) });
  }

  /* 9 — notify Mohamed. A mail failure must not change what the customer sees. */
  let emailStatus = 'failed';
  try {
    const mail = buildLeadEmail({
      lead: {
        ...lead, reference,
        complexity: win.complexity, pricingTier: win.tier,
        pricingFloorUsd: win.allowedMinUsd, pricingCeilingUsd: win.allowedMaxUsd,
      },
      quote: aiFailed ? null : quote,
      aiFailed,
      siteUrl: config.siteUrl,
      adminUrl: config.adminUrl,
    });
    await sendEmail(mail);
    emailStatus = 'sent';
  } catch (err) {
    log('error', 'email_failed', { reference, message: String(err && err.message) });
  }
  try {
    await db.updateLead(saved.id, {
      email_notification_status: emailStatus,
      last_notified_at: emailStatus === 'sent' ? now().toISOString() : null,
    });
  } catch { /* already logged; the lead itself is safe */ }

  /* 10 — the customer sees the quote, or an honest fallback */
  if (aiFailed) {
    return {
      status: 200,
      body: { ok: true, reference, quote: null, aiAvailable: false,
              message: errorBody('aiUnavailable', lead.language).message },
    };
  }
  return { status: 200, body: { ok: true, reference, aiAvailable: true, quote } };
}
