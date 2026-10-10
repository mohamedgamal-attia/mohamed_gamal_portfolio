/* =============================================================================
 * quote.js — turn whatever the model returned into a safe, bounded quote.
 *
 * The model's output is untrusted. Every field is re-typed, re-bounded and
 * re-truncated here, and the price is forced into the server's window. A
 * malformed response degrades to a usable quote rather than failing the lead.
 * ========================================================================== */

import { clampToWindow } from './pricing.js';

const MAX = { summary: 240, item: 120, timeline: 80, message: 1200, cta: 160 };

const str = (v, max) =>
  String(v ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);

const list = (v, maxItems, maxLen) =>
  (Array.isArray(v) ? v : [])
    .map((x) => str(x, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);

/**
 * Some models wrap JSON in a markdown fence despite being told not to.
 * Accept that, but accept nothing weirder.
 */
export function parseModelJson(text) {
  const raw = String(text ?? '').trim();
  const unfenced = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const start = unfenced.indexOf('{');
  const end   = unfenced.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(unfenced.slice(start, end + 1));
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : null;
  } catch { return null; }
}

/* Phrases that would mean the model leaked its instructions or the pricing
 * configuration. If any appears, the customer-facing text is replaced with a
 * safe fallback rather than shipped. */
const LEAK_PATTERNS = [
  /system prompt/i, /you are the pre-sales/i, /allowed (usd )?(estimate )?range/i,
  /hard (floor|minimum)/i, /multiplier/i, /tier\s*[ABC]\b/, /affordability/i,
  /REQUIRED JSON/i, /<<<CUSTOMER_DESCRIPTION/i, /complexity classification/i,
  /تقدير مسموح|الحد الأدنى الصارم|معامل التسعير/,
];

export function looksLikeLeak(text) {
  const s = String(text ?? '');
  return LEAK_PATTERNS.some((re) => re.test(s));
}

/**
 * Normalise a parsed model object into the shape the rest of the system uses.
 *
 * @param {object|null} parsed   output of parseModelJson
 * @param {object} win           the window from computePriceWindow
 * @param {object} ctx           { language, projectType, fallbacks }
 * @returns {{ quote: object, clamped: boolean, leaked: boolean, usable: boolean }}
 */
export function normaliseQuote(parsed, win, ctx) {
  const { language, projectType, fallbacks } = ctx;
  const p = parsed || {};

  const { priceMinUsd, priceMaxUsd, clamped } =
    clampToWindow(p.price_min_usd, p.price_max_usd, win);

  let summary  = str(p.summary, MAX.summary);
  let message  = str(p.customer_message, MAX.message);
  let cta      = str(p.meeting_cta, MAX.cta);
  let timeline = str(p.estimated_timeline, MAX.timeline);
  let scope    = list(p.recommended_scope, 4, MAX.item);
  let assume   = list(p.assumptions, 3, MAX.item);

  // The model must answer in the customer's language; if it says otherwise,
  // trust the server's record, not the model's claim.
  const lang = (p.language === 'ar' || p.language === 'en') ? p.language : language;
  const languageMismatch = lang !== language;

  const leaked = [summary, message, cta, timeline, ...scope, ...assume].some(looksLikeLeak);
  if (leaked) {
    summary = ''; message = ''; cta = ''; scope = []; assume = [];
  }

  // Anything still missing falls back to localised copy written by us, so the
  // customer always sees a complete, coherent result.
  if (!summary)  summary  = fallbacks.summary;
  if (!message)  message  = fallbacks.message;
  if (!cta)      cta      = fallbacks.cta;
  if (!timeline) timeline = fallbacks.timeline;
  if (!scope.length)  scope  = fallbacks.scope;
  if (!assume.length) assume = fallbacks.assumptions;

  return {
    quote: {
      language,
      projectType: str(p.project_type, 60) || projectType,
      summary,
      recommendedScope: scope,
      priceMinUsd,
      priceMaxUsd,
      estimatedTimeline: timeline,
      assumptions: assume,
      customerMessage: message,
      meetingCta: cta,
      disclaimer: fallbacks.disclaimer,
    },
    clamped,
    leaked,
    languageMismatch,
    injectionFlagged: p.injection_attempt === true,
    usable: parsed !== null && !leaked,
  };
}
