/**
 * currency-idempotency.mjs — the live-API integration behaviour.
 *   - requestId generation, payload binding and lifecycle
 *   - local-currency presentation and its fallbacks
 *   - the WhatsApp message in both languages
 * Run against a local static server on :8777.
 */
import pkg from '/opt/node-tools/node_modules/playwright/index.js';
const { chromium } = pkg;

let pass = 0, fail = 0;
const ok = (c, m, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${m}${x ? '  ' + x : ''}`); return c; };
const EP = 'https://mogamal.duckdns.org/project-estimate';

const quote = (localCurrency, lang = 'en') => ({
  summary: lang === 'ar'
    ? 'نظام ERP يغطي المحاسبة وإدارة العملاء والمتجر الإلكتروني.'
    : 'An ERP covering accounting, CRM and an integrated storefront.',
  recommendedScope: ['Accounting and CRM core', 'Storefront integration', 'Hand-over'],
  priceMinUsd: 200, priceMaxUsd: 350,
  estimatedTimeline: '6–8 weeks',
  assumptions: ['Scope agreed in a requirements meeting first'],
  customerMessage: 'Thanks for the detail. Here is a preliminary range.',
  disclaimer: 'This is an initial approximate estimate and may increase or decrease after a short requirements meeting.',
  ...(localCurrency ? { localCurrency } : {}),
});
const EGP = { currencyCode: 'EGP', priceMin: 10476.07, priceMax: 18333.13,
              fxRate: 52.380358, fxUpdatedAt: '2026-10-10T00:02:31+00:00', provider: 'ExchangeRate-API' };

const b = await chromium.launch();

async function open(lang, handler) {
  const ctx = await b.newContext({ viewport: { width: 1100, height: 1000 } });
  ctx.route('**://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  ctx.route('**://fonts.gstatic.com/**', r => r.abort());
  await ctx.addInitScript(l => { try { localStorage.setItem('mg-lang', l); } catch (e) {} }, lang);
  const seen = [];
  await ctx.route(EP, async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    seen.push(body);
    await route.fulfill(await handler(body, seen.length));
  });
  const errors = [];
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await p.goto('http://127.0.0.1:8777/request.html', { waitUntil: 'load' });
  await p.waitForFunction(() => document.querySelectorAll('#rq-country option').length > 5);
  return { ctx, p, seen, errors };
}

const reply = (q, extra = {}) => ({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({ ok: true, reference: 'REQ-7K4P2Q', quote: q, notified: true, ...extra }),
});

async function fill(p, lang, over = {}) {
  await p.fill('#rq-name', over.name ?? (lang === 'ar' ? 'جين دو' : 'Jane Doe'));
  await p.fill('#rq-email', over.email ?? 'jane@example.com');
  await p.fill('#rq-phone', '+20 100 123 4567');
  await p.selectOption('#rq-country', over.country ?? 'EG');
  await p.click('[data-next="2"]');
  await p.selectOption('#rq-type', 'erp_business_system');
  await p.click('[data-next="3"]');
  await p.fill('#rq-desc', over.desc ?? (lang === 'ar'
    ? 'أحتاج نظام ERP يشمل المحاسبة وإدارة العملاء والمتجر الإلكتروني.'
    : 'Need an ERP system with accounting, CRM, e-commerce and website integration.'));
  await p.check('#rq-consent');
}

/* ── 1. Endpoint ────────────────────────────────────────────────── */
console.log('\n1. Live endpoint');
{
  const { ctx, p } = await open('en', async () => reply(quote(EGP)));
  const ep = await p.evaluate(() => window.Portfolio.leadSystem.endpoint);
  ok(ep === EP, 'config points at the production API', ep);
  const cfg = await p.evaluate(() => JSON.stringify(window.Portfolio.leadSystem));
  ok(/"supabaseUrl":""/.test(cfg), 'supabaseUrl stays blank', cfg);
  ok(/"supabaseAnonKey":""/.test(cfg), 'supabaseAnonKey stays blank');
  ok(/"resendEndpoint":""/.test(cfg), 'resendEndpoint stays blank');
  await ctx.close();
}

/* ── 2. requestId ───────────────────────────────────────────────── */
console.log('\n2. Idempotency key');
{
  const { ctx, p, seen } = await open('en', async () => reply(quote(EGP)));
  await fill(p, 'en');
  await p.click('#rq-submit');
  await p.waitForSelector('#rq-result:not([hidden])');
  const id = seen[0].requestId;
  ok(typeof id === 'string' && /^[A-Za-z0-9_-]{16,80}$/.test(id), 'requestId matches the required pattern', id);
  ok(seen[0].language === 'en', 'payload still carries language');
  const stored = await p.evaluate(() => localStorage.getItem('mg-request-id'));
  ok(stored === null, 'requestId is cleared on success, with the draft');
  const draft = await p.evaluate(() => localStorage.getItem('mg-request-draft'));
  ok(draft === null, 'draft is cleared on success');
  await ctx.close();
}
{
  // A failing first attempt, then a retry: same id, nothing cleared.
  const { ctx, p, seen } = await open('en', async (_b, n) =>
    n === 1 ? { status: 503, contentType: 'text/plain', body: 'upstream' } : reply(quote(EGP)));
  await fill(p, 'en');
  await p.click('#rq-submit');
  await p.waitForSelector('#rq-form-err:not([hidden])');
  const kept = await p.evaluate(() => localStorage.getItem('mg-request-id'));
  ok(kept !== null, 'requestId survives a server error so the retry de-duplicates');
  await p.click('#rq-submit');
  await p.waitForSelector('#rq-result:not([hidden])');
  ok(seen.length === 2, 'two attempts were made', String(seen.length));
  ok(seen[0].requestId === seen[1].requestId, 'the retry reuses the SAME requestId',
     seen[0].requestId + ' / ' + seen[1].requestId);
  await ctx.close();
}
{
  // Editing the payload must produce a new id, or the edit would be ignored.
  const { ctx, p, seen } = await open('en', async (_b, n) =>
    n === 1 ? { status: 503, contentType: 'text/plain', body: 'x' } : reply(quote(EGP)));
  await fill(p, 'en');
  await p.click('#rq-submit');
  await p.waitForSelector('#rq-form-err:not([hidden])');
  await p.fill('#rq-desc', 'A completely different project: a mobile app for field technicians.');
  await p.click('#rq-submit');
  await p.waitForSelector('#rq-result:not([hidden])');
  ok(seen[0].requestId !== seen[1].requestId, 'an edited payload gets a NEW requestId');
  ok(/^[A-Za-z0-9_-]{16,80}$/.test(seen[1].requestId), 'the new id is also well formed', seen[1].requestId);
  await ctx.close();
}
{
  // A fresh Turnstile token on retry is not an edit.
  const { ctx, p, seen } = await open('en', async (_b, n) =>
    n === 1 ? { status: 503, contentType: 'text/plain', body: 'x' } : reply(quote(EGP)));
  await fill(p, 'en');
  await p.evaluate(() => { window.__tok = 'tok-1'; window.turnstile = { getResponse: () => window.__tok, reset() {} }; });
  await p.click('#rq-submit');
  await p.waitForSelector('#rq-form-err:not([hidden])');
  await p.evaluate(() => { window.__tok = 'tok-2'; });
  await p.click('#rq-submit');
  await p.waitForSelector('#rq-result:not([hidden])');
  ok(seen[0].requestId === seen[1].requestId, 'a changed botToken does not change the requestId');
  await ctx.close();
}
{
  // crypto.randomUUID missing -> the fallback must still satisfy the pattern.
  const ctx = await b.newContext({ viewport: { width: 1100, height: 900 } });
  ctx.route('**://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  ctx.route('**://fonts.gstatic.com/**', r => r.abort());
  await ctx.addInitScript(() => {
    try { Object.defineProperty(window.crypto, 'randomUUID', { value: undefined, configurable: true }); } catch (e) {}
  });
  const seen = [];
  await ctx.route(EP, async (route) => { seen.push(JSON.parse(route.request().postData() || '{}')); await route.fulfill(reply(quote(EGP))); });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8777/request.html', { waitUntil: 'load' });
  await p.waitForFunction(() => document.querySelectorAll('#rq-country option').length > 5);
  await fill(p, 'en');
  await p.click('#rq-submit');
  await p.waitForSelector('#rq-result:not([hidden])');
  ok(/^[A-Za-z0-9_-]{16,80}$/.test(seen[0].requestId),
     'the fallback generator produces a valid id without randomUUID', seen[0].requestId);
  await ctx.close();
}

/* ── 3. Local currency ──────────────────────────────────────────── */
console.log('\n3. Local currency presentation');
for (const [code, min, max, expectBig] of [
  ['EGP', 10476.07, 18333.13, 'EGP'],
  ['SAR', 750.4, 1313.2, 'SAR'],
  ['AED', 734.5, 1285.4, 'AED'],
  ['GBP', 157.2, 275.1, '£'],
  ['EUR', 184.3, 322.5, '€'],
]) {
  const { ctx, p } = await open('en', async () =>
    reply(quote({ currencyCode: code, priceMin: min, priceMax: max, fxRate: 1, fxUpdatedAt: 'x', provider: 'ExchangeRate-API' })));
  await fill(p, 'en');
  await p.click('#rq-submit');
  await p.waitForSelector('#rq-result:not([hidden])');
  const big = (await p.textContent('#rq-price')).trim();
  const sub = (await p.textContent('#rq-price-usd')).trim();
  ok(big.includes(expectBig), `${code}: local currency is the large line`, big);
  ok(!/\$/.test(big) || code === 'USD', `${code}: USD is not in the large line`);
  ok(/\$200/.test(sub) && /\$350/.test(sub) && /USD/.test(sub), `${code}: USD is the secondary line`, sub);
  ok(!/\.\d/.test(big), `${code}: rounded to whole units`, big);
  await ctx.close();
}
{
  const { ctx, p } = await open('en', async () =>
    reply(quote({ currencyCode: 'USD', priceMin: 200, priceMax: 350, fxRate: 1, fxUpdatedAt: 'x', provider: 'ExchangeRate-API' })));
  await fill(p, 'en');
  await p.click('#rq-submit');
  await p.waitForSelector('#rq-result:not([hidden])');
  ok((await p.textContent('#rq-price')).includes('$200'), 'USD: shown once in the large line');
  ok(await p.isHidden('#rq-price-usd'), 'USD: no duplicated secondary line');
  await ctx.close();
}
{
  const { ctx, p } = await open('en', async () => reply(quote(null)));
  await fill(p, 'en');
  await p.click('#rq-submit');
  await p.waitForSelector('#rq-result:not([hidden])');
  ok((await p.textContent('#rq-price')).trim() === '$200 – $350', 'no localCurrency: the USD result, unchanged');
  ok(await p.isHidden('#rq-price-usd'), 'no localCurrency: no empty secondary line');
  ok(await p.isHidden('#rq-fx'), 'no localCurrency: no attribution');
  await ctx.close();
}
for (const bad of [
  { currencyCode: 'XX', priceMin: 1, priceMax: 2, provider: 'ExchangeRate-API' },
  { currencyCode: 'EGP', priceMin: 'abc', priceMax: 2, provider: 'ExchangeRate-API' },
  { currencyCode: 'EGP', priceMin: 0, priceMax: 0, provider: 'ExchangeRate-API' },
  { priceMin: 10, priceMax: 20 },
]) {
  const { ctx, p, errors } = await open('en', async () => reply(quote(bad)));
  await fill(p, 'en');
  await p.click('#rq-submit');
  await p.waitForSelector('#rq-result:not([hidden])');
  ok((await p.textContent('#rq-price')).includes('$200'),
     'malformed localCurrency falls back to USD', JSON.stringify(bad).slice(0, 42));
  ok(errors.length === 0, '  and throws nothing', errors.join('|'));
  await ctx.close();
}

/* ── 4. Attribution ─────────────────────────────────────────────── */
console.log('\n4. FX attribution');
{
  const { ctx, p } = await open('en', async () => reply(quote(EGP)));
  await fill(p, 'en');
  await p.click('#rq-submit');
  await p.waitForSelector('#rq-result:not([hidden])');
  ok(await p.isVisible('#rq-fx'), 'attribution shown for ExchangeRate-API');
  const a = await p.$('#rq-fx a');
  ok(a !== null, 'it is a link');
  ok(await a.getAttribute('href') === 'https://www.exchangerate-api.com/', 'correct URL');
  ok(await a.getAttribute('target') === '_blank', 'opens in a new tab');
  const rel = await a.getAttribute('rel');
  ok(/noopener/.test(rel) && /noreferrer/.test(rel), 'rel has noopener and noreferrer', rel);
  ok((await p.textContent('#rq-fx')).includes('Rates by'), 'English wording');
  await ctx.close();
}
{
  const { ctx, p } = await open('ar', async () => reply(quote(EGP)));
  await fill(p, 'ar');
  await p.click('#rq-submit');
  await p.waitForSelector('#rq-result:not([hidden])');
  ok((await p.textContent('#rq-fx')).includes('أسعار الصرف عبر'), 'Arabic wording');
  await ctx.close();
}
{
  const { ctx, p } = await open('en', async () =>
    reply(quote({ ...EGP, provider: 'SomeOtherProvider' })));
  await fill(p, 'en');
  await p.click('#rq-submit');
  await p.waitForSelector('#rq-result:not([hidden])');
  ok(await p.isHidden('#rq-fx'), 'no attribution for a provider that does not require one');
  await ctx.close();
}

/* ── 4b. Regressions found in review ────────────────────────────── */
console.log('\n4b. Review regressions');
{
  // Switching language after the result is shown must repaint the label
  // this file writes by hand.
  const { ctx, p } = await open('en', async () => reply(quote(EGP)));
  await fill(p, 'en');
  await p.click('#rq-submit');
  await p.waitForSelector('#rq-result:not([hidden])');
  ok((await p.textContent('#rq-fx')).includes('Rates by'), 'FX label starts in English');
  await p.click('[data-lang-btn="ar"]');
  await p.waitForFunction(() => document.documentElement.getAttribute('dir') === 'rtl');
  await p.waitForTimeout(250);
  const fx = await p.textContent('#rq-fx');
  ok(fx.includes('أسعار الصرف عبر'), 'FX label follows a language switch', fx.trim());
  ok((await p.textContent('#rq-price')).includes('EGP'), '  and the price survives the switch');
  await ctx.close();
}
{
  // A cached request.html without the two new slots must still render.
  const { ctx, p, errors } = await open('en', async () => reply(quote(EGP)));
  await p.evaluate(() => {
    ['rq-price-usd', 'rq-fx'].forEach((id) => { const e = document.getElementById(id); if (e) e.remove(); });
  });
  await fill(p, 'en');
  await p.click('#rq-submit');
  await p.waitForSelector('#rq-result:not([hidden])');
  ok((await p.textContent('#rq-price')).includes('EGP'),
     'an older cached page without the new slots still renders the price');
  ok(errors.length === 0, '  and throws nothing', errors.join('|'));
  await ctx.close();
}

/* ── 5. Arabic / RTL ────────────────────────────────────────────── */
console.log('\n5. Arabic');
{
  const { ctx, p, seen, errors } = await open('ar', async (body) => reply(quote(EGP, body.language)));
  ok(await p.getAttribute('html', 'dir') === 'rtl', 'dir=rtl');
  await fill(p, 'ar');
  await p.click('#rq-submit');
  await p.waitForSelector('#rq-result:not([hidden])');
  ok(seen[0].language === 'ar', 'language sent as ar');
  const big = (await p.textContent('#rq-price')).trim();
  ok(big.includes('EGP'), 'local currency shown in Arabic', big);
  ok(await p.getAttribute('#rq-price', 'dir') === 'ltr', 'price is an LTR island');
  ok(await p.getAttribute('#rq-price-usd', 'dir') === 'ltr', 'USD line is an LTR island');
  ok(!/[؀-ۿ]/.test(big), 'no stray Arabic inside the price value');
  ok(/[؀-ۿ]/.test(await p.textContent('#rq-summary')), 'summary still Arabic');
  ok(errors.length === 0, 'no console errors', errors.join('|'));
  await ctx.close();
}

/* ── 6. WhatsApp ────────────────────────────────────────────────── */
console.log('\n6. WhatsApp message');
for (const lang of ['en', 'ar']) {
  const { ctx, p } = await open(lang, async () => reply(quote(EGP)));
  await fill(p, lang);
  await p.click('#rq-submit');
  await p.waitForSelector('#rq-result:not([hidden])');
  const href = await p.getAttribute('#rq-whatsapp', 'href');
  const msg = decodeURIComponent(href.split('text=')[1] || '');
  ok(href.startsWith('https://wa.me/201102672347'), `${lang}: reuses the site number`);
  ok(msg.includes('REQ-7K4P2Q'), `${lang}: carries the reference`);
  ok(/EGP/.test(msg), `${lang}: mentions the local estimate`);
  ok(/\$200/.test(msg) && /\$350/.test(msg), `${lang}: keeps USD as a reference`);
  ok(msg.length < 320, `${lang}: message stays short`, msg.length + ' chars');
  if (lang === 'ar') ok(/[؀-ۿ]/.test(msg), 'ar: message is Arabic');
  await ctx.close();
}
{
  const { ctx, p } = await open('en', async () => reply(quote(null)));
  await fill(p, 'en');
  await p.click('#rq-submit');
  await p.waitForSelector('#rq-result:not([hidden])');
  const msg = decodeURIComponent((await p.getAttribute('#rq-whatsapp', 'href')).split('text=')[1] || '');
  ok(/\$200/.test(msg) && !/EGP/.test(msg), 'no localCurrency: USD-only message unchanged', msg.slice(0, 70));
  await ctx.close();
}

/* ── 7. Nothing regressed ───────────────────────────────────────── */
console.log('\n7. Existing behaviour');
{
  const { ctx, p, seen } = await open('en', async () => reply(quote(EGP)));
  await fill(p, 'en');
  await p.evaluate(() => {
    const f = document.getElementById('rq-form');
    for (let i = 0; i < 3; i++) f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  });
  await p.waitForSelector('#rq-result:not([hidden])');
  ok(seen.length === 1, 'inFlight guard still prevents a double submit', String(seen.length));
  await ctx.close();
}
{
  const { ctx, p } = await open('en', async () => reply(quote(EGP), { notified: false }));
  await fill(p, 'en');
  await p.click('#rq-submit');
  await p.waitForSelector('#rq-result:not([hidden])');
  ok(await p.isHidden('#rq-notified'), 'notified=false still suppresses the delivery claim');
  await ctx.close();
}
{
  const { ctx, p } = await open('en', async () => reply(null, { aiAvailable: false, message: 'Saved, no quote.' }));
  await fill(p, 'en');
  await p.click('#rq-submit');
  await p.waitForSelector('#rq-result:not([hidden])');
  ok((await p.textContent('#rq-summary')).includes('Saved, no quote'), 'no-quote path still works');
  ok(await p.isHidden('#rq-price-usd'), 'no-quote path hides the secondary line');
  ok(await p.isHidden('#rq-fx'), 'no-quote path hides the attribution');
  await ctx.close();
}
{
  // Model output is text, never markup.
  const { ctx, p } = await open('en', async () => reply({
    ...quote(EGP), summary: '<img src=x onerror="window.__x=1">',
    recommendedScope: ['<script>window.__y=1</script>'],
  }));
  await fill(p, 'en');
  await p.click('#rq-submit');
  await p.waitForSelector('#rq-result:not([hidden])');
  ok((await p.$$('#rq-summary img')).length === 0 && (await p.$$('#rq-scope script')).length === 0,
     'model output is still rendered as text, not markup');
  ok(await p.evaluate(() => !window.__x && !window.__y), 'nothing executed');
  await ctx.close();
}
{
  // Draft persistence still works.
  const { ctx, p } = await open('en', async () => reply(quote(EGP)));
  await p.fill('#rq-name', 'Jane Doe');
  await p.fill('#rq-email', 'jane@example.com');
  await p.fill('#rq-phone', '+20 100 123 4567');
  await p.selectOption('#rq-country', 'EG');
  await p.click('[data-next="2"]');
  await p.waitForTimeout(200);
  await p.reload({ waitUntil: 'load' });
  await p.waitForFunction(() => document.querySelectorAll('#rq-country option').length > 5);
  await p.waitForTimeout(300);
  ok(await p.inputValue('#rq-name') === 'Jane Doe', 'draft persistence intact');
  await ctx.close();
}

await b.close();
console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
