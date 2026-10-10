import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLeadEmail } from '../supabase/functions/_shared/email.js';

const LEAD = {
  reference: 'MG-7K4P2Q', fullName: 'Jane Doe', email: 'jane@example.com',
  phone: '+20 100 123 4567', countryCode: 'EG', countryName: 'Egypt',
  language: 'en', projectType: 'simple_website',
  description: 'A small website for my clinic with a booking form.',
  desiredTimeline: 'two months', clientBudget: 'around $800', referenceUrl: null,
  complexity: 'standard', pricingTier: 'C', pricingFloorUsd: 200, pricingCeilingUsd: 700,
};
const QUOTE = {
  priceMinUsd: 300, priceMaxUsd: 525, estimatedTimeline: '2-3 weeks',
  customerMessage: 'Thanks for getting in touch.',
};
const OPTS = { siteUrl: 'https://example.test', adminUrl: 'https://example.test/admin.html' };

test('a normal lead produces a complete, scannable email', () => {
  const m = buildLeadEmail({ lead: LEAD, quote: QUOTE, aiFailed: false, ...OPTS });
  assert.match(m.subject, /New project request — Jane Doe \(Egypt\) — simple_website/);
  for (const needle of ['MG-7K4P2Q', 'jane@example.com', '+20 100 123 4567', 'Egypt',
                        'booking form', '$300', '$525', '2-3 weeks']) {
    assert.ok(m.html.includes(needle), `html missing ${needle}`);
    assert.ok(m.text.includes(needle), `text missing ${needle}`);
  }
  assert.ok(m.html.includes('https://wa.me/201001234567'), 'WhatsApp link built from the phone');
  assert.ok(m.html.includes(OPTS.adminUrl), 'links back to the dashboard');
});

test('an AI failure is flagged in the subject and the body', () => {
  const m = buildLeadEmail({ lead: LEAD, quote: null, aiFailed: true, ...OPTS });
  assert.ok(m.subject.startsWith('[AI FAILED]'));
  assert.ok(m.html.includes('did not complete'));
  assert.ok(m.text.startsWith('AI FAILED'));
  assert.ok(m.html.includes('booking form'), 'the request itself is still reported in full');
});

test('HTML in a lead is escaped, not rendered', () => {
  const nasty = {
    ...LEAD,
    fullName: '<script>alert(1)</script>',
    description: '<img src=x onerror="alert(1)"> and <b>bold</b> & "quotes" and \'apostrophes\'',
  };
  const m = buildLeadEmail({ lead: nasty, quote: QUOTE, aiFailed: false, ...OPTS });
  // The real property is that the payload exists only as TEXT. Checking for
  // the substring "onerror=" after un-escaping would fail on safely escaped
  // content, so inspect the document's actual tags instead.
  const tags = [...m.html.matchAll(/<\s*\/?\s*([a-zA-Z][a-zA-Z0-9]*)/g)].map((x) => x[1].toLowerCase());
  assert.ok(!tags.includes('script'), 'no script element in the document');
  assert.ok(!tags.includes('img'), 'no img element in the document');
  // No real attribute may be an event handler.
  assert.ok(!/<[^>]*\son[a-z]+\s*=/i.test(m.html), 'no element carries an event handler');
  assert.ok(m.html.includes('&lt;script&gt;'), 'the text is still shown, escaped');
  assert.ok(m.html.includes('&lt;img src=x onerror='), 'the img payload is inert text');
  assert.ok(m.html.includes('&amp;'), 'ampersands escaped');
});

test('a quote from the model is escaped too', () => {
  const m = buildLeadEmail({
    lead: LEAD,
    quote: { ...QUOTE, customerMessage: '<style>body{display:none}</style>' },
    aiFailed: false, ...OPTS,
  });
  assert.ok(!m.html.includes('<style>'), 'model output cannot inject markup into the email');
  assert.ok(m.html.includes('&lt;style&gt;'));
});

test('a newline in a name cannot forge a header', () => {
  const m = buildLeadEmail({
    lead: { ...LEAD, fullName: 'Jane\r\nBcc: attacker@evil.test\r\nSubject: Hijacked' },
    quote: QUOTE, aiFailed: false, ...OPTS,
  });
  assert.ok(!/[\r\n]/.test(m.subject), 'the subject is a single line');
  assert.ok(!/^(bcc|cc|subject|to):/im.test(m.subject), 'no header keyword starts a line in the subject');
  assert.ok(m.subject.length <= 180, 'the subject is bounded');
});

test('a phone with formatting still yields a usable wa.me link', () => {
  const m = buildLeadEmail({ lead: { ...LEAD, phone: '+966 (50) 000-0000' }, quote: QUOTE, aiFailed: false, ...OPTS });
  assert.ok(m.html.includes('https://wa.me/966500000000'));
});

test('a lead with no usable phone simply omits the WhatsApp button', () => {
  const m = buildLeadEmail({ lead: { ...LEAD, phone: '' }, quote: QUOTE, aiFailed: false, ...OPTS });
  assert.ok(!m.html.includes('wa.me'));
  assert.ok(m.html.includes('mailto:jane@example.com'), 'email reply is still offered');
});

test('Arabic content survives intact in both parts', () => {
  const ar = { ...LEAD, language: 'ar', fullName: 'أحمد محمود',
               description: 'أحتاج نظام ERP يشمل المخزون والمحاسبة.' };
  const m = buildLeadEmail({ lead: ar, quote: QUOTE, aiFailed: false, ...OPTS });
  assert.ok(m.subject.includes('أحمد محمود'));
  assert.ok(m.html.includes('المخزون'));
  assert.ok(m.text.includes('المخزون'));
  assert.ok(m.html.includes('العربية'), 'the lead language is named in the reader\'s terms');
});

test('the pricing window is reported so a quote can be audited', () => {
  const m = buildLeadEmail({ lead: LEAD, quote: QUOTE, aiFailed: false, ...OPTS });
  assert.ok(m.html.includes('$200') && m.html.includes('$700'), 'allowed window shown');
  assert.ok(m.html.includes('standard') && m.html.includes('C'), 'complexity and tier shown');
});

test('no secret or internal URL is ever interpolated', () => {
  const m = buildLeadEmail({ lead: LEAD, quote: QUOTE, aiFailed: false, ...OPTS });
  const all = m.html + m.text + m.subject;
  for (const bad of ['GEMINI', 'SERVICE_ROLE', 'RESEND_API', 'apikey', 'Bearer ', 'supabase.co/rest']) {
    assert.ok(!all.includes(bad), `email leaked ${bad}`);
  }
});
