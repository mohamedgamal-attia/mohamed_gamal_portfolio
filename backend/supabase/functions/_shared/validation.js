/* =============================================================================
 * validation.js — accept a submission, or reject it with a localised reason.
 *
 * Every field is treated as hostile input. Nothing here trusts a length, a
 * type or an encoding that the browser claims.
 * ========================================================================== */

import { PROJECT_TYPES, DEFAULT_PROJECT_TYPE } from './pricing-config.js';

export const LIMITS = {
  fullName:        { min: 2,  max: 120 },
  email:           { min: 5,  max: 254 },
  phone:           { min: 5,  max: 32 },
  description:     { min: 20, max: 4000 },
  desiredTimeline: { max: 120 },
  clientBudget:    { max: 60 },
  referenceUrl:    { max: 300 },
  /** Hard cap on the whole JSON body, checked before parsing. */
  bodyBytes:       16 * 1024,
};

/* A deliberately strict address shape. It rejects a few exotic-but-legal
 * addresses; it also rejects every header-injection and display-name trick. */
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
const PHONE_RE = /^\+?[0-9][0-9\s()\-.]{4,31}$/;
const ISO2_RE  = /^[A-Za-z]{2}$/;

/** Strip control characters and normalise whitespace, without touching Arabic. */
export function cleanText(value, max) {
  let s = String(value ?? '');
  s = s.normalize('NFC');
  // C0/C1 controls and the bidi-override characters, which can be used to make
  // stored text render as something other than what it is.
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F‪-‮⁦-⁩]/g, '');
  s = s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (typeof max === 'number' && s.length > max) s = s.slice(0, max).trim();
  return s;
}

/** A header-injection-safe single-line value (used for names and subjects). */
export function cleanLine(value, max) {
  return cleanText(String(value ?? '').replace(/[\r\n]+/g, ' '), max);
}

export function isSupportedLanguage(v) { return v === 'ar' || v === 'en'; }

/**
 * Validate a submission.
 * @returns {{ ok: true, value: object } | { ok: false, errors: {field,code}[] }}
 */
export function validateSubmission(input) {
  const errors = [];
  const bad = (field, code) => errors.push({ field, code });
  const raw = (input && typeof input === 'object') ? input : {};

  const language = isSupportedLanguage(raw.language) ? raw.language : 'en';

  const fullName = cleanLine(raw.fullName, LIMITS.fullName.max);
  if (fullName.length < LIMITS.fullName.min) bad('fullName', 'required');

  const email = cleanLine(raw.email, LIMITS.email.max).toLowerCase();
  if (!EMAIL_RE.test(email)) bad('email', 'invalid');

  const phone = cleanLine(raw.phone, LIMITS.phone.max);
  if (!PHONE_RE.test(phone)) bad('phone', 'invalid');

  const countryCode = cleanLine(raw.countryCode, 2).toUpperCase();
  if (!ISO2_RE.test(countryCode)) bad('countryCode', 'required');
  const countryName = cleanLine(raw.countryName, 80) || countryCode;

  const projectTypeRaw = cleanLine(raw.projectType, 60).toLowerCase().replace(/[\s-]+/g, '_');
  const projectType = PROJECT_TYPES.includes(projectTypeRaw) ? projectTypeRaw : '';
  if (!projectType) bad('projectType', 'required');

  const description = cleanText(raw.description, LIMITS.description.max);
  if (description.length < LIMITS.description.min) bad('description', 'tooShort');

  const desiredTimeline = cleanLine(raw.desiredTimeline, LIMITS.desiredTimeline.max) || null;
  const clientBudget    = cleanLine(raw.clientBudget,    LIMITS.clientBudget.max)    || null;

  let referenceUrl = cleanLine(raw.referenceUrl, LIMITS.referenceUrl.max) || null;
  if (referenceUrl) {
    try {
      const u = new URL(/^https?:\/\//i.test(referenceUrl) ? referenceUrl : 'https://' + referenceUrl);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('scheme');
      referenceUrl = u.toString();
    } catch { bad('referenceUrl', 'invalid'); referenceUrl = null; }
  }

  if (raw.consent !== true) bad('consent', 'required');

  // Honeypot: a real person never fills a field they cannot see.
  const honeypot = String(raw.company ?? '').trim();

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      language, fullName, email, phone, countryCode, countryName,
      projectType: projectType || DEFAULT_PROJECT_TYPE,
      description, desiredTimeline, clientBudget, referenceUrl,
      honeypotTripped: honeypot.length > 0,
      utmSource:   cleanLine(raw.utmSource, 60)   || null,
      utmMedium:   cleanLine(raw.utmMedium, 60)   || null,
      utmCampaign: cleanLine(raw.utmCampaign, 60) || null,
    },
  };
}

/* ── Reference code ─────────────────────────────────────────────────────────
 * Short, unambiguous and quotable over the phone: no 0/O or 1/I/L.
 */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export function makeReference(randomBytes) {
  let out = '';
  for (let i = 0; i < 6; i++) out += ALPHABET[randomBytes[i] % ALPHABET.length];
  return 'MG-' + out;
}
