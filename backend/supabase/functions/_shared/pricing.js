/* =============================================================================
 * pricing.js — deterministic preliminary price window.
 *
 * The server decides the window; the model only chooses a point inside it.
 * Nothing here reads the network, the clock or any runtime API, so it behaves
 * identically in the Edge Function and under test.
 *
 *   base range for the project type
 *     x regional affordability multiplier   (country -> tier)
 *     x complexity multiplier               (explicit request signals)
 *     = allowed window, clamped to the type's absolute floor
 * ========================================================================== */

import {
  BASE_RANGES, PROJECT_TYPES, DEFAULT_PROJECT_TYPE,
  TIER_MULTIPLIERS, DEFAULT_TIER, TIER_A, TIER_C,
  COMPLEXITY_MULTIPLIERS, COMPLEXITY_SIGNALS, TYPE_BASE_SCORE, COMPLEXITY_BANDS,
  ROUND_TO_USD, MAX_CEILING_FACTOR,
} from './pricing-config.js';

/** Normalise a submitted project type to a configured one. */
export function normaliseProjectType(value) {
  const v = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return PROJECT_TYPES.includes(v) ? v : DEFAULT_PROJECT_TYPE;
}

/** Map an ISO-3166-1 alpha-2 code to an affordability tier. Unknown -> B. */
export function countryTier(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return DEFAULT_TIER;
  if (TIER_A.has(c)) return 'A';
  if (TIER_C.has(c)) return 'C';
  return DEFAULT_TIER;
}

/**
 * Score the request's complexity from explicit signals.
 * Returns { level, score, matched } — `matched` is kept so a surprising quote
 * can be explained from the record rather than guessed at.
 */
export function classifyComplexity({ projectType, description = '', extras = [] }) {
  const type = normaliseProjectType(projectType);
  const haystack = [description, ...extras].filter(Boolean).join('\n');

  let score = TYPE_BASE_SCORE[type] ?? 1;
  const matched = [];
  for (const sig of COMPLEXITY_SIGNALS) {
    if (sig.en.test(haystack) || sig.ar.test(haystack)) {
      score += sig.weight;
      matched.push(sig.key);
    }
  }

  const level =
    score < COMPLEXITY_BANDS.simpleBelow   ? 'simple'   :
    score > COMPLEXITY_BANDS.advancedAbove ? 'advanced' : 'standard';

  return { level, score, matched };
}

const roundTo = (n, step) => Math.round(n / step) * step;

/**
 * The allowed window for one request.
 *
 * @returns {{
 *   projectType: string, tier: 'A'|'B'|'C', complexity: 'simple'|'standard'|'advanced',
 *   complexityScore: number, matchedSignals: string[],
 *   floorUsd: number, allowedMinUsd: number, allowedMaxUsd: number,
 *   multipliers: { tier: number, complexity: number }
 * }}
 */
export function computePriceWindow({ projectType, countryCode, description, extras }) {
  const type  = normaliseProjectType(projectType);
  const base  = BASE_RANGES[type];
  const tier  = countryTier(countryCode);
  const cx    = classifyComplexity({ projectType: type, description, extras });

  const tierMul = TIER_MULTIPLIERS[tier];
  const cxMul   = COMPLEXITY_MULTIPLIERS[cx.level];

  let min = roundTo(base.min * tierMul * cxMul, ROUND_TO_USD);
  let max = roundTo(base.max * tierMul * cxMul, ROUND_TO_USD);

  // An absolute floor is not a discountable price. Applied after rounding so
  // rounding can never land under it.
  min = Math.max(min, base.floor);
  // A guard against any multiplier combination running away from the band.
  max = Math.min(max, Math.round(base.max * MAX_CEILING_FACTOR));
  // And the window must stay ordered and non-degenerate.
  max = Math.max(max, min + ROUND_TO_USD);

  return {
    projectType: type,
    tier,
    complexity: cx.level,
    complexityScore: cx.score,
    matchedSignals: cx.matched,
    floorUsd: base.floor,
    allowedMinUsd: min,
    allowedMaxUsd: max,
    multipliers: { tier: tierMul, complexity: cxMul },
  };
}

/**
 * Force a model-proposed pair into the allowed window.
 * Always returns a usable pair; `clamped` says whether the model was corrected.
 */
export function clampToWindow(proposedMin, proposedMax, win) {
  const lo = win.allowedMinUsd, hi = win.allowedMaxUsd;
  const usable = (v) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  // A missing or nonsensical number is not an error: fall back to the
  // conservative lower part of the window rather than failing the lead. A
  // substitution still counts as a correction, so a model that keeps sending
  // junk shows up in the record instead of looking like a clean response.
  const proposed = [usable(proposedMin), usable(proposedMax)];
  const substituted = proposed[0] === null || proposed[1] === null;

  let min = proposed[0] ?? lo;
  let max = proposed[1] ?? Math.min(hi, Math.round((lo + hi) / 2));

  if (min > max) [min, max] = [max, min];
  min = Math.min(Math.max(min, lo), hi);
  max = Math.min(Math.max(max, lo), hi);
  if (min > max) min = max;

  return {
    priceMinUsd: min,
    priceMaxUsd: max,
    clamped: substituted || proposed[0] !== min || proposed[1] !== max,
  };
}
