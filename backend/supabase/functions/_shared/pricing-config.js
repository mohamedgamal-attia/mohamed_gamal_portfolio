/* =============================================================================
 * pricing-config.js — the ONE place preliminary pricing is configured.
 *
 * This file is server-side only. It is never served to the browser: the public
 * site learns a price only as the single range the function returns for one
 * submitted request, so the table, the multipliers and the floors stay private.
 *
 * Everything here is a starting configuration, not business truth. Edit the
 * numbers; do not edit the arithmetic in pricing.js to change a price.
 * ========================================================================== */

/* ── Base USD range per project type ────────────────────────────────────────
 * `floor` is an absolute minimum for that type. No multiplier may take a quote
 * below it — it is what the work costs to do at all, not a discountable price.
 */
export const BASE_RANGES = {
  portfolio:            { min:  150, max:   450, floor:  120 },
  simple_website:       { min:  250, max:   800, floor:  200 },
  advanced_website:     { min:  500, max:  1500, floor:  400 },
  backend_api:          { min:  500, max:  1800, floor:  400 },
  automation:           { min:  250, max:  1200, floor:  200 },
  data_ai:              { min:  600, max:  2500, floor:  500 },
  mobile_app:           { min:  900, max:  3500, floor:  700 },
  erp_business_system:  { min: 1000, max:  4000, floor:  800 },
  other:                { min:  400, max:  2000, floor:  300 },
};

export const PROJECT_TYPES = Object.keys(BASE_RANGES);
export const DEFAULT_PROJECT_TYPE = 'other';

/* ── Regional affordability ─────────────────────────────────────────────────
 * Three tiers, not a per-country price list. Countries are grouped by broad
 * income level as a transparent, auditable proxy for what a small software
 * budget looks like locally. This is NOT a claim to know any country's market
 * rate, and it is the only way country influences a quote.
 *
 * Unlisted country -> Tier B. Unknown/!!missing country -> Tier B.
 */
export const TIER_MULTIPLIERS = { A: 1.00, B: 0.85, C: 0.70 };
export const DEFAULT_TIER = 'B';

/** High-income markets. */
export const TIER_A = new Set([
  'US','CA','GB','IE','AU','NZ','DE','FR','NL','BE','LU','AT','CH','LI','MC',
  'SE','NO','DK','FI','IS','IT','ES','PT','JP','KR','SG','HK','TW','IL',
  'AE','QA','KW','BH','SA','OM','CY','MT','SI','EE','CZ','SK','LT','LV',
]);

/** Price-sensitive markets. */
export const TIER_C = new Set([
  'EG','MA','DZ','TN','LY','SD','SS','YE','SY','IQ','JO','LB','PS','MR','SO',
  'IN','PK','BD','LK','NP','BT','MM','KH','LA','VN','PH','ID','UZ','KG','TJ',
  'NG','KE','GH','ET','TZ','UG','RW','BI','ZM','ZW','MW','MZ','AO','CM','CI',
  'SN','ML','BF','NE','TD','CF','CD','CG','GN','GM','SL','LR','TG','BJ','MG',
  'UA','MD','GE','AM','AZ','AL','XK','BA','MK','RS','ME',
  'BO','NI','HN','GT','SV','HT','PY','VE','CU','PG','VU','TL',
]);

/* ── Complexity ─────────────────────────────────────────────────────────────
 * Computed from explicit signals in the submitted request, before Gemini is
 * asked anything. The model may describe the scope; it cannot move the band.
 */
export const COMPLEXITY_MULTIPLIERS = { simple: 0.85, standard: 1.00, advanced: 1.35 };

/* Signals are matched against the description and the structured answers.
 * Weights are small integers so the scoring stays legible and arguable. */
export const COMPLEXITY_SIGNALS = [
  { key: 'auth',          weight: 1, en: /\b(login|sign[- ]?in|sign[- ]?up|authentication|sso|oauth|2fa|mfa)\b/i,          ar: /(تسجيل الدخول|مصادقة|تسجيل دخول|حساب مستخدم)/ },
  { key: 'roles',         weight: 2, en: /\b(roles?|permissions?|multi[- ]?user|access control|rbac|approval workflow)\b/i, ar: /(صلاحيات|أدوار|موافقات|تحكم في الوصول)/ },
  { key: 'payments',      weight: 2, en: /\b(payments?|checkout|stripe|paypal|paymob|fawry|billing|subscriptions?)\b/i,     ar: /(دفع|مدفوعات|اشتراك|فوترة|بوابة دفع)/ },
  { key: 'integrations',  weight: 2, en: /\b(integrat\w+|third[- ]?party|api|webhook|erp|crm|sap|salesforce|zapier)\b/i,    ar: /(تكامل|ربط|واجهة برمجية|طرف ثالث)/ },
  { key: 'mobile_plus',   weight: 2, en: /\b(mobile app|ios|android|react native|flutter|cross[- ]?platform)\b/i,           ar: /(تطبيق جوال|أندرويد|آيفون|تطبيق موبايل)/ },
  { key: 'erp_scope',     weight: 3, en: /\b(erp|odoo|inventory|accounting|payroll|hr module|manufacturing|warehouse)\b/i,  ar: /(تخطيط موارد|أودو|مخزون|محاسبة|رواتب|موارد بشرية)/ },
  { key: 'ai',            weight: 3, en: /\b(ai|machine learning|ml\b|llm|gpt|gemini|computer vision|ocr|chatbot)\b/i,      ar: /(ذكاء اصطناعي|تعلم آلي|رؤية حاسوبية|روبوت محادثة)/ },
  { key: 'migration',     weight: 2, en: /\b(migrat\w+|data import|legacy|from excel|existing (system|database))\b/i,       ar: /(ترحيل|نقل بيانات|نظام قائم|من إكسل)/ },
  { key: 'reports',       weight: 1, en: /\b(reports?|dashboards?|analytics|bi\b|charts?|kpis?)\b/i,                        ar: /(تقارير|لوحة تحكم|تحليلات|مؤشرات)/ },
  { key: 'admin_panel',   weight: 1, en: /\b(admin panel|back[- ]?office|cms|content management)\b/i,                       ar: /(لوحة إدارة|لوحة تحكم إدارية|إدارة محتوى)/ },
  { key: 'multilingual',  weight: 1, en: /\b(multi[- ]?lingual|bilingual|arabic and english|rtl|localisation|localization)\b/i, ar: /(متعدد اللغات|ثنائي اللغة|عربي وإنجليزي)/ },
  { key: 'realtime',      weight: 2, en: /\b(real[- ]?time|websocket|live (updates?|tracking)|notifications?)\b/i,          ar: /(الوقت الفعلي|تتبع مباشر|إشعارات فورية)/ },
];

/* Project types that start a band above "simple" regardless of wording. */
export const TYPE_BASE_SCORE = {
  portfolio: 0, simple_website: 0, advanced_website: 2, backend_api: 2,
  automation: 1, data_ai: 3, mobile_app: 3, erp_business_system: 4, other: 1,
};

/** score < 3 -> simple; 3..6 -> standard; > 6 -> advanced. */
export const COMPLEXITY_BANDS = { simpleBelow: 3, advancedAbove: 6 };

/* ── Presentation ───────────────────────────────────────────────────────────
 * Quotes are rounded so they read like a human wrote them. The floor is
 * re-applied AFTER rounding, so rounding can never undercut it.
 */
export const ROUND_TO_USD = 25;

/* An upper guard so no combination of multipliers can produce a number far
 * outside the configured band for the type. */
export const MAX_CEILING_FACTOR = 1.25;
