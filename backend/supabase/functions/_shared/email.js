/* =============================================================================
 * email.js — builds the notification to Mohamed. Sends nothing itself.
 *
 * Every interpolated value is escaped. A lead's name or description is
 * attacker-controlled text that will be opened in a mail client, so it is
 * treated exactly as hostile as it is.
 * ========================================================================== */

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Subjects and addresses must never carry a newline. */
const header = (v) => String(v ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 180);

const money = (n) => '$' + Number(n || 0).toLocaleString('en-US');

export function buildLeadEmail({ lead, quote, aiFailed, siteUrl, adminUrl }) {
  const flag = aiFailed ? '[AI FAILED] ' : '';
  const subject = header(
    `${flag}New project request — ${lead.fullName} (${lead.countryName}) — ${lead.projectType}`
  );

  const waDigits = String(lead.phone || '').replace(/[^\d]/g, '');
  const waLink = waDigits ? `https://wa.me/${waDigits}` : null;

  const rows = [
    ['Reference',     lead.reference],
    ['Name',          lead.fullName],
    ['Email',         lead.email],
    ['Phone',         lead.phone],
    ['Country',       `${lead.countryName} (${lead.countryCode})`],
    ['Language',      lead.language === 'ar' ? 'العربية' : 'English'],
    ['Project type',  lead.projectType],
    ['Desired timeline', lead.desiredTimeline || '—'],
    ['Stated budget',    lead.clientBudget || '—'],
    ['Reference URL',    lead.referenceUrl || '—'],
  ];

  const quoteRows = quote ? [
    ['Estimate',   `${money(quote.priceMinUsd)} – ${money(quote.priceMaxUsd)}`],
    ['Timeline',   quote.estimatedTimeline],
    ['Complexity', lead.complexity],
    ['Tier',       lead.pricingTier],
    ['Window',     `${money(lead.pricingFloorUsd)} – ${money(lead.pricingCeilingUsd)}`],
  ] : [];

  const tableHtml = (pairs) => pairs.map(([k, v]) =>
    `<tr><td style="padding:6px 14px 6px 0;color:#6b6b6b;white-space:nowrap;vertical-align:top">${esc(k)}</td>` +
    `<td style="padding:6px 0;color:#141414">${esc(v)}</td></tr>`).join('');

  const html = `<!doctype html><html><body style="margin:0;background:#f6f5f3;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e6e3de;border-radius:12px;overflow:hidden">
  <div style="padding:18px 22px;background:#141414;color:#f3efe7">
    <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.7">New project request</div>
    <div style="font-size:19px;font-weight:700;margin-top:4px">${esc(lead.fullName)} · ${esc(lead.countryName)}</div>
  </div>
  ${aiFailed ? `<div style="padding:12px 22px;background:#fdf1e7;color:#8a4b12;font-size:14px;border-bottom:1px solid #f0e2d2">
    The automatic estimate did not complete for this lead. The request itself was saved in full.</div>` : ''}
  <div style="padding:18px 22px">
    <table style="border-collapse:collapse;font-size:14px;width:100%">${tableHtml(rows)}</table>
    <div style="margin:18px 0 6px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#6b6b6b">What they wrote</div>
    <div style="white-space:pre-wrap;font-size:14px;line-height:1.65;color:#141414;background:#faf9f7;border:1px solid #ece9e3;border-radius:8px;padding:12px 14px">${esc(lead.description)}</div>
    ${quote ? `<div style="margin:18px 0 6px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#6b6b6b">Estimate sent to the customer</div>
    <table style="border-collapse:collapse;font-size:14px;width:100%">${tableHtml(quoteRows)}</table>
    <div style="margin-top:10px;font-size:14px;line-height:1.65;color:#141414">${esc(quote.customerMessage)}</div>` : ''}
    <div style="margin-top:22px">
      ${waLink ? `<a href="${esc(waLink)}" style="display:inline-block;padding:10px 16px;margin:0 8px 8px 0;background:#141414;color:#fff;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600">WhatsApp</a>` : ''}
      <a href="mailto:${esc(lead.email)}" style="display:inline-block;padding:10px 16px;margin:0 8px 8px 0;background:#f3efe7;color:#141414;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600">Reply by email</a>
      ${adminUrl ? `<a href="${esc(adminUrl)}" style="display:inline-block;padding:10px 16px;margin:0 8px 8px 0;background:#f3efe7;color:#141414;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600">Open in dashboard</a>` : ''}
    </div>
  </div>
  <div style="padding:12px 22px;background:#faf9f7;border-top:1px solid #ece9e3;font-size:12px;color:#6b6b6b">
    Sent automatically by ${esc(siteUrl || 'the portfolio')} · reference ${esc(lead.reference)}
  </div>
</div></body></html>`;

  const text = [
    `${aiFailed ? 'AI FAILED — ' : ''}New project request`,
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '', 'What they wrote:', lead.description,
    ...(quote ? ['', 'Estimate sent to the customer:', ...quoteRows.map(([k, v]) => `${k}: ${v}`), '', quote.customerMessage] : []),
    ...(waLink ? ['', `WhatsApp: ${waLink}`] : []),
  ].join('\n');

  return { subject, html, text };
}
