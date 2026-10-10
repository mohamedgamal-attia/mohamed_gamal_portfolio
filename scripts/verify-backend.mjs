#!/usr/bin/env node
/**
 * verify-backend.mjs — prove the live lead system is actually connected.
 *
 *   node scripts/verify-backend.mjs            # cheap checks, no Gemini call
 *   node scripts/verify-backend.mjs --full     # plus ONE real end-to-end request
 *   node scripts/verify-backend.mjs --local    # read config.js from disk, not the live site
 *
 * The default run deliberately sends an INVALID submission. That still proves
 * the endpoint resolves, CORS is right, the gateway accepts the call and
 * validation runs — without spending a model call or creating a junk lead.
 *
 * --full submits one controlled QA request and checks the whole chain. Use it
 * once, not in a loop.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SITE = 'https://mohamedgamal-attia.github.io/mohamed_gamal_portfolio';
const ORIGIN = 'https://mohamedgamal-attia.github.io';
const full  = process.argv.includes('--full');
const local = process.argv.includes('--local');

let pass = 0, fail = 0, skip = 0;
const ok   = (c, m, extra = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${m}${extra ? '  ' + extra : ''}`); return c; };
const note = (m) => console.log(`        ${m}`);
const skipped = (m) => { skip++; console.log(`  SKIP  ${m}`); };

/** Pull the public config out of config.js without executing the whole file. */
function parseConfig(src) {
  const block = src.match(/leadSystem\s*:\s*\{([\s\S]*?)\n\s*\},/);
  if (!block) return null;
  const out = {};
  for (const m of block[1].matchAll(/(\w+)\s*:\s*'([^']*)'/g)) out[m[1]] = m[2];
  return out;
}

console.log(`\n=== lead system: live verification ===\n`);

/* ── 1. config ──────────────────────────────────────────────────────────── */
console.log('1. Public configuration');
let cfgSrc;
if (local) {
  cfgSrc = fs.readFileSync(path.join(ROOT, 'assets/js/config.js'), 'utf8');
  note('read from disk (--local)');
} else {
  try {
    const r = await fetch(`${SITE}/assets/js/config.js`, { cache: 'no-store' });
    ok(r.ok, `config.js is served`, `HTTP ${r.status}`);
    cfgSrc = await r.text();
  } catch (e) {
    ok(false, 'config.js is served', String(e.message));
    console.log('\nCannot reach the live site from here; try --local.\n');
    process.exit(1);
  }
}

const cfg = parseConfig(cfgSrc);
if (!cfg) { ok(false, 'leadSystem block is parseable'); process.exit(1); }

const configured = ok(Boolean(cfg.endpoint), 'endpoint is set', cfg.endpoint || '(empty)');
ok(Boolean(cfg.supabaseUrl), 'supabaseUrl is set', cfg.supabaseUrl || '(empty)');
ok(Boolean(cfg.supabaseAnonKey), 'supabaseAnonKey is set',
   cfg.supabaseAnonKey ? cfg.supabaseAnonKey.slice(0, 12) + '…' : '(empty)');

// The anon key is public; a service_role key here would be a breach.
const leak = /service_role/.test(cfgSrc.replace(/^\s*\/\*[\s\S]*?\*\//gm, '')) ||
             /AIza[0-9A-Za-z_-]{30,}/.test(cfgSrc) || /\bre_[A-Za-z0-9]{20,}/.test(cfgSrc);
ok(!leak, 'no secret-shaped value in the public config');

if (cfg.supabaseAnonKey) {
  try {
    const role = JSON.parse(Buffer.from(cfg.supabaseAnonKey.split('.')[1], 'base64url').toString()).role;
    ok(role === 'anon', 'the published key is the ANON key, not service_role', `role=${role}`);
  } catch { skipped('could not decode the published key to check its role'); }
}

if (!configured) {
  console.log(`\n  => NOT CONNECTED: assets/js/config.js has no endpoint.`);
  console.log(`     Run scripts/connect-backend.ps1 on a machine with Supabase access.\n`);
  process.exit(1);
}

/* ── 2. reachability and CORS ───────────────────────────────────────────── */
console.log('\n2. Endpoint reachability and CORS');
try {
  const pre = await fetch(cfg.endpoint, {
    method: 'OPTIONS',
    headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST',
               'Access-Control-Request-Headers': 'content-type,authorization' },
  });
  ok(pre.status === 204 || pre.ok, 'preflight answered', `HTTP ${pre.status}`);
  const allow = pre.headers.get('access-control-allow-origin');
  ok(allow === ORIGIN || allow === '*', 'Access-Control-Allow-Origin matches the site', allow || '(none)');

  // Allow-Origin alone is not enough: the browser also refuses to send a
  // header the preflight did not allow, which blocks every real submission
  // while a naive check still reports success.
  const allowHdr = (pre.headers.get('access-control-allow-headers') || '').toLowerCase();
  const needed = ['content-type', 'authorization', 'apikey'];
  const missing = needed.filter((h) => !allowHdr.includes(h));
  ok(missing.length === 0, 'Allow-Headers covers every header the wizard sends',
     missing.length ? `missing: ${missing.join(', ')}` : allowHdr);
} catch (e) {
  ok(false, 'preflight answered', String(e.message));
}

/* ── 3. the gateway accepts us, and validation runs ─────────────────────── */
console.log('\n3. Gateway and validation (no model call)');
const authHeaders = { 'Content-Type': 'application/json', Origin: ORIGIN };
if (cfg.supabaseAnonKey) {
  authHeaders.apikey = cfg.supabaseAnonKey;
  authHeaders.Authorization = 'Bearer ' + cfg.supabaseAnonKey;
}
try {
  // Deliberately invalid: no consent, bad email. A 400 with field errors is
  // the proof that our code ran.
  const r = await fetch(cfg.endpoint, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ language: 'en', fullName: 'Probe', email: 'not-an-email',
                           phone: '1', countryCode: 'EG', countryName: 'Egypt',
                           projectType: 'simple_website', description: 'short', consent: false }),
  });
  const body = await r.json().catch(() => ({}));
  ok(r.status !== 401, 'not rejected by the functions gateway', `HTTP ${r.status}`);
  ok(r.status !== 404, 'the function exists at this URL', `HTTP ${r.status}`);

  if (r.status === 429) {
    // Our own throttle answering is proof the function is live and working.
    ok(true, 'reached the function (throttled, which means it is running)', 'HTTP 429');
    note('the 5/hour rate limit is active for this IP; re-run later for the validation check');
  } else {
    ok(r.status === 400, 'validation ran and rejected a bad submission', `HTTP ${r.status}`);
    ok(Array.isArray(body.errors) && body.errors.length > 0, 'per-field errors returned',
       Array.isArray(body.errors) ? body.errors.map((e) => e.field).join(',') : '(none)');
  }
  const txt = JSON.stringify(body);
  ok(!/AIza|service_role|supabase\.co\/rest|Bearer |stack/i.test(txt),
     'no internal detail in the error response');
} catch (e) {
  ok(false, 'endpoint answered a POST', String(e.message));
}

/* ── 4. one real journey ────────────────────────────────────────────────── */
console.log('\n4. End-to-end with a real estimate' + (full ? '' : '  (skipped; pass --full)'));
if (!full) {
  skipped('one real Gemini call — run with --full when you want it');
} else {
  try {
    const r = await fetch(cfg.endpoint, {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({
        language: 'en', fullName: 'Portfolio QA', email: 'qa@example.com',
        phone: '+20 100 000 0000', countryCode: 'EG', countryName: 'Egypt',
        projectType: 'erp_business_system',
        description: 'Need an ERP system with accounting, CRM, e-commerce and website integration.',
        desiredTimeline: 'maximum 3 months', clientBudget: 'no specific budget',
        consent: true,
      }),
    });
    const b = await r.json();
    ok(r.status === 200 && b.ok === true, 'request accepted', `HTTP ${r.status}`);
    ok(/^MG-[A-Z0-9]{6}$/.test(b.reference || ''), 'lead saved with a reference', b.reference);

    if (b.aiAvailable && b.quote) {
      const q = b.quote;
      ok(Number.isInteger(q.priceMinUsd) && Number.isInteger(q.priceMaxUsd),
         'an estimate came back', `$${q.priceMinUsd}–$${q.priceMaxUsd}`);
      ok(q.priceMinUsd <= q.priceMaxUsd, 'price range is ordered');
      ok(q.priceMinUsd >= 800, 'price respects the ERP hard floor', `min $${q.priceMinUsd}`);
      ok(Boolean(q.disclaimer), 'preliminary-estimate disclaimer present');
      ok(Array.isArray(q.recommendedScope) && q.recommendedScope.length > 0, 'scope returned');
      const all = JSON.stringify(q);
      ok(!/multiplier|hard floor|tier [ABC]\b|allowed .*range|system prompt/i.test(all),
         'no pricing internals leaked to the customer');
    } else {
      note(`aiAvailable=false — the lead was saved but the model did not answer.`);
      note(`That is the designed fallback, not a crash. Check:`);
      note(`  supabase functions logs project-estimate`);
      ok(false, 'Gemini returned an estimate');
    }
    ok(b.notified === true, 'notification email accepted by the provider',
       b.notified === true ? '' : '(check RESEND_API_KEY and the sender domain)');
    note(`Reference ${b.reference} — mark it 'spam' in the dashboard afterwards so it does not sit in your real leads.`);
  } catch (e) {
    ok(false, 'end-to-end request', String(e.message));
  }
}

/* ── 5. anonymous must not reach the data ───────────────────────────────── */
console.log('\n5. Anonymous access to lead data');
if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
  skipped('no Supabase URL or anon key configured');
} else {
  try {
    const r = await fetch(`${cfg.supabaseUrl}/rest/v1/portfolio_leads?select=*&limit=1`, {
      headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + cfg.supabaseAnonKey },
    });
    const body = await r.text();
    const blocked = r.status === 401 || r.status === 403 || body.trim() === '[]';
    ok(blocked, 'anonymous cannot read leads', `HTTP ${r.status} ${body.slice(0, 60)}`);
    ok(!/"full_name"|"email"/.test(body), 'no lead fields in the anonymous response');
  } catch (e) {
    ok(false, 'anonymous read attempt', String(e.message));
  }
}

console.log(`\n=== ${pass} passed, ${fail} failed, ${skip} skipped ===`);
console.log(fail === 0
  ? (full ? '\nCONNECTED and verified end to end.\n' : '\nCONNECTED. Run with --full to send one real request.\n')
  : '\nNOT CONNECTED — see the failures above.\n');
process.exit(fail ? 1 : 0);
