import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computePriceWindow, clampToWindow, countryTier,
  classifyComplexity, normaliseProjectType,
} from '../supabase/functions/_shared/pricing.js';
import { BASE_RANGES, TIER_MULTIPLIERS, PROJECT_TYPES } from '../supabase/functions/_shared/pricing-config.js';

test('project type normalises, unknown falls back to "other"', () => {
  assert.equal(normaliseProjectType('erp_business_system'), 'erp_business_system');
  assert.equal(normaliseProjectType('  Mobile-App '), 'mobile_app');
  assert.equal(normaliseProjectType('definitely not a type'), 'other');
  assert.equal(normaliseProjectType(null), 'other');
  // Coercion is fine because the result is still checked against the allow-list.
  assert.equal(normaliseProjectType({ toString: () => 'portfolio' }), 'portfolio');
  assert.equal(normaliseProjectType({ toString: () => 'rm -rf /' }), 'other');
});

test('country maps to a tier; unknown and malformed default to B', () => {
  assert.equal(countryTier('US'), 'A');
  assert.equal(countryTier('eg'), 'C');
  assert.equal(countryTier('BR'), 'B');       // listed in neither set
  assert.equal(countryTier('ZZ'), 'B');
  assert.equal(countryTier(''),   'B');
  assert.equal(countryTier(null), 'B');
  assert.equal(countryTier('USA'),'B');       // not alpha-2
});

test('complexity rises with explicit signals, in English and Arabic', () => {
  const vague = classifyComplexity({ projectType: 'simple_website', description: 'I need a small website for my shop.' });
  assert.equal(vague.level, 'simple');

  const rich = classifyComplexity({
    projectType: 'simple_website',
    description: 'Website with login, user roles and permissions, online payments, and integration with our ERP.',
  });
  assert.equal(rich.level, 'advanced');
  assert.ok(rich.matched.includes('payments') && rich.matched.includes('roles'));

  const arabic = classifyComplexity({
    projectType: 'simple_website',
    description: 'موقع فيه تسجيل الدخول و صلاحيات و مدفوعات و تكامل مع نظام تخطيط موارد.',
  });
  assert.equal(arabic.level, 'advanced', 'Arabic signals must score like their English equivalents');
});

test('the same request is cheaper in a price-sensitive market, never below the floor', () => {
  const req = { projectType: 'advanced_website', description: 'A dynamic site with a admin panel and reports.' };
  const us = computePriceWindow({ ...req, countryCode: 'US' });
  const eg = computePriceWindow({ ...req, countryCode: 'EG' });
  assert.equal(us.tier, 'A');
  assert.equal(eg.tier, 'C');
  assert.ok(eg.allowedMinUsd < us.allowedMinUsd, 'tier C must quote lower than tier A');
  assert.ok(eg.allowedMaxUsd < us.allowedMaxUsd);
  assert.ok(eg.allowedMinUsd >= BASE_RANGES.advanced_website.floor);
});

test('no project type, country or complexity can produce a quote under its floor', () => {
  for (const type of PROJECT_TYPES) {
    for (const country of ['US', 'EG', 'BR', 'ZZ']) {
      for (const desc of ['tiny', 'erp ai payments roles integration migration mobile app real-time reports']) {
        const w = computePriceWindow({ projectType: type, countryCode: country, description: desc });
        assert.ok(w.allowedMinUsd >= BASE_RANGES[type].floor,
          `${type}/${country} floor breached: ${w.allowedMinUsd} < ${BASE_RANGES[type].floor}`);
        assert.ok(w.allowedMinUsd < w.allowedMaxUsd, `${type}/${country} window not ordered`);
        assert.ok(w.allowedMaxUsd <= Math.round(BASE_RANGES[type].max * 1.25),
          `${type}/${country} ceiling ran away: ${w.allowedMaxUsd}`);
      }
    }
  }
});

test('tier multipliers are the documented ones', () => {
  assert.deepEqual(TIER_MULTIPLIERS, { A: 1.00, B: 0.85, C: 0.70 });
});

test('clamping forces any model price into the window', () => {
  const w = computePriceWindow({ projectType: 'erp_business_system', countryCode: 'EG', description: 'erp with payroll' });
  for (const [min, max] of [[1, 1], [0, 0], [-500, -1], [999999, 1000000], [1, 999999]]) {
    const r = clampToWindow(min, max, w);
    assert.ok(r.priceMinUsd >= w.allowedMinUsd, `min ${r.priceMinUsd} below window`);
    assert.ok(r.priceMaxUsd <= w.allowedMaxUsd, `max ${r.priceMaxUsd} above window`);
    assert.ok(r.priceMinUsd <= r.priceMaxUsd);
    assert.equal(r.clamped, true);
  }
});

test('clamping leaves an in-range model price alone', () => {
  const w = computePriceWindow({ projectType: 'simple_website', countryCode: 'EG', description: 'a small brochure website for a clinic' });
  const mid = Math.round((w.allowedMinUsd + w.allowedMaxUsd) / 2);
  const r = clampToWindow(w.allowedMinUsd, mid, w);
  assert.equal(r.clamped, false);
  assert.equal(r.priceMinUsd, w.allowedMinUsd);
  assert.equal(r.priceMaxUsd, mid);
});

test('clamping survives junk types without throwing', () => {
  const w = computePriceWindow({ projectType: 'portfolio', countryCode: 'EG', description: 'a personal site' });
  for (const junk of [null, undefined, NaN, 'abc', {}, [], Infinity, '1e9']) {
    const r = clampToWindow(junk, junk, w);
    assert.ok(Number.isInteger(r.priceMinUsd) && r.priceMinUsd >= w.allowedMinUsd);
    assert.ok(Number.isInteger(r.priceMaxUsd) && r.priceMaxUsd <= w.allowedMaxUsd);
  }
});

test('swapped min/max are reordered, not rejected', () => {
  const w = computePriceWindow({ projectType: 'backend_api', countryCode: 'DE', description: 'a REST API with auth' });
  const r = clampToWindow(w.allowedMaxUsd, w.allowedMinUsd, w);
  assert.ok(r.priceMinUsd <= r.priceMaxUsd);
});

test('the window is a pure function of its inputs', () => {
  const args = { projectType: 'data_ai', countryCode: 'IN', description: 'OCR pipeline with reports' };
  assert.deepEqual(computePriceWindow(args), computePriceWindow(args));
});
