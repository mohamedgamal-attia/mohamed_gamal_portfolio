/* =========================================================
   admin.js — the private leads dashboard.

   Authentication is Supabase Auth; authorisation is RLS plus
   the admin_users allow-list. Nothing here grants access:
   if the signed-in user is not an admin, the queries below
   return zero rows and the updates affect zero rows. There
   is no client-side gate pretending to be security.
   ========================================================= */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const CFG = (window.Portfolio && window.Portfolio.leadSystem) || {};
const $ = (id) => document.getElementById(id);

const authView  = $('ad-auth');
const shell     = $('ad-shell');
const authErr   = $('ad-auth-err');
const authNote  = $('ad-auth-note');

if (!CFG.supabaseUrl || !CFG.supabaseAnonKey) {
  authView.hidden = false;
  authErr.hidden = false;
  authErr.textContent =
    'This dashboard is not connected yet. Set supabaseUrl and supabaseAnonKey in assets/js/config.js — see docs/lead-system-setup.md.';
  $('ad-login').querySelectorAll('button, input').forEach((el) => { el.disabled = true; });
  throw new Error('not configured');
}

const sb = createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);

/* ── Formatting ──────────────────────────────────────── */

const STATUSES = ['new', 'quoted', 'ai_failed', 'contacted', 'meeting_scheduled', 'won', 'lost', 'spam'];
const LABEL = {
  new: 'New', quoted: 'Quoted', ai_failed: 'AI failed', contacted: 'Contacted',
  meeting_scheduled: 'Meeting set', won: 'Won', lost: 'Lost', spam: 'Spam',
};
const TYPE_LABEL = {
  portfolio: 'Portfolio', simple_website: 'Business website',
  advanced_website: 'Advanced web app', backend_api: 'Backend / API',
  automation: 'Automation', data_ai: 'Data / AI', mobile_app: 'Mobile app',
  erp_business_system: 'ERP / business system', other: 'Other',
};

const money = (n) => (n == null ? '—' : '$' + Number(n).toLocaleString('en-US'));
const date  = (s) => (s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const stamp = (s) => (s ? new Date(s).toLocaleString('en-GB') : '—');

/** Build an element with text content. Never innerHTML: these rows hold
 *  attacker-supplied names and descriptions. */
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = String(text);
  return n;
}

function pill(value, kind) {
  const p = el('span', 'ad-pill', LABEL[value] || value || '—');
  p.setAttribute(kind === 'email' ? 'data-e' : 'data-s', value || '');
  return p;
}

/* ── Auth ────────────────────────────────────────────── */

function showAuthError(msg) { authErr.textContent = msg; authErr.hidden = false; }

$('ad-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  authErr.hidden = true; authNote.hidden = true;
  const email = $('ad-email').value.trim();
  const password = $('ad-password').value;
  if (!password) { showAuthError('Enter your password, or use the email link instead.'); return; }
  const { error } = await sb.auth.signInWithPassword({ email, password });
  // Supabase returns the same message for a wrong address and a wrong
  // password, which is what we want to show.
  if (error) showAuthError(error.message);
});

$('ad-magic').addEventListener('click', async () => {
  authErr.hidden = true; authNote.hidden = true;
  const email = $('ad-email').value.trim();
  if (!email) { showAuthError('Enter your email address first.'); return; }
  const { error } = await sb.auth.signInWithOtp({
    email, options: { emailRedirectTo: location.href.split('#')[0] },
  });
  if (error) { showAuthError(error.message); return; }
  authNote.hidden = false;
  authNote.textContent = 'Check your inbox for a sign-in link.';
});

$('ad-signout').addEventListener('click', () => sb.auth.signOut());

sb.auth.onAuthStateChange((_event, session) => { render(session); });
sb.auth.getSession().then(({ data }) => render(data.session));

function render(session) {
  const on = Boolean(session);
  authView.hidden = on;
  shell.hidden = !on;
  if (on) {
    $('ad-who').textContent = session.user.email || '';
    load();
  } else {
    leads = [];
  }
}

/* ── Data ────────────────────────────────────────────── */

let leads = [];

async function load() {
  const err = $('ad-error');
  err.hidden = true;
  const { data, error } = await sb
    .from('portfolio_leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) {
    err.hidden = false;
    err.textContent = 'Could not load leads: ' + error.message;
    return;
  }
  leads = data || [];
  if (!leads.length) {
    // Zero rows for a signed-in user is the RLS answer for "not an admin",
    // and also the answer for "no leads yet". Say both, rather than guessing.
    err.hidden = false;
    err.textContent = 'No leads are visible. Either none have come in yet, or this account is not on the admin allow-list.';
  }
  fillFilterOptions();
  paint();
}

$('ad-refresh').addEventListener('click', load);

/* ── Filters ─────────────────────────────────────────── */

const F = {
  q: $('ad-q'), status: $('ad-status'), type: $('ad-type'),
  country: $('ad-country'), lang: $('ad-lang'), from: $('ad-from'), to: $('ad-to'),
};
Object.values(F).forEach((c) => c.addEventListener('input', paint));
$('ad-clear').addEventListener('click', () => {
  Object.values(F).forEach((c) => { c.value = ''; });
  paint();
});

function fillFilterOptions() {
  const fill = (sel, values, label) => {
    const keep = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    [...new Set(values)].filter(Boolean).sort().forEach((v) => {
      sel.appendChild(new Option(label ? (label[v] || v) : v, v));
    });
    sel.value = keep;
  };
  fill(F.status, STATUSES, LABEL);
  fill(F.type, leads.map((l) => l.project_type), TYPE_LABEL);
  fill(F.country, leads.map((l) => l.country_name));
}

function matches(l) {
  const q = F.q.value.trim().toLowerCase();
  if (q) {
    const hay = [l.full_name, l.email, l.phone, l.reference].join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (F.status.value && l.status !== F.status.value) return false;
  if (F.type.value && l.project_type !== F.type.value) return false;
  if (F.country.value && l.country_name !== F.country.value) return false;
  if (F.lang.value && l.preferred_language !== F.lang.value) return false;
  if (F.from.value && l.created_at < F.from.value) return false;
  // `to` is inclusive of the whole day.
  if (F.to.value && l.created_at > F.to.value + 'T23:59:59.999Z') return false;
  return true;
}

/* ── Painting ────────────────────────────────────────── */

function paint() {
  const rows = leads.filter(matches);

  const stats = $('ad-stats');
  stats.textContent = '';
  const counts = [['Total', leads.length, '']].concat(
    STATUSES.map((s) => [LABEL[s], leads.filter((l) => l.status === s).length, s]),
  );
  counts.forEach(([k, v, s]) => {
    const card = el('button', 'ad-stat');
    card.type = 'button';
    if (s && F.status.value === s) card.classList.add('is-active');
    card.appendChild(el('p', 'ad-stat-k', k));
    card.appendChild(el('p', 'ad-stat-v', v));
    card.addEventListener('click', () => {
      F.status.value = (F.status.value === s) ? '' : s;
      paint();
    });
    stats.appendChild(card);
  });

  const tbody = $('ad-rows');
  tbody.textContent = '';
  rows.forEach((l) => {
    const tr = el('tr');
    tr.tabIndex = 0;
    tr.appendChild(el('td', 'ad-nowrap', date(l.created_at)));
    tr.appendChild(el('td', null, l.full_name));
    tr.appendChild(el('td', null, l.country_name));
    tr.appendChild(el('td', null, TYPE_LABEL[l.project_type] || l.project_type));
    tr.appendChild(el('td', 'ad-nowrap ad-mono',
      l.ai_price_min_usd ? money(l.ai_price_min_usd) + ' – ' + money(l.ai_price_max_usd) : '—'));
    const st = el('td'); st.appendChild(pill(l.status)); tr.appendChild(st);
    tr.appendChild(el('td', null, l.preferred_language === 'ar' ? 'AR' : 'EN'));
    const em = el('td'); em.appendChild(pill(l.email_notification_status, 'email')); tr.appendChild(em);
    const open = () => openDetail(l.id);
    tr.addEventListener('click', open);
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
    tbody.appendChild(tr);
  });

  $('ad-empty').hidden = rows.length > 0;
  $('ad-count').textContent =
    rows.length === leads.length
      ? `${leads.length} lead${leads.length === 1 ? '' : 's'}`
      : `${rows.length} of ${leads.length} leads`;
}

/* ── Detail ──────────────────────────────────────────── */

const drawer = $('ad-drawer');
drawer.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeDetail(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.hidden) closeDetail(); });

let lastFocus = null;
function closeDetail() {
  drawer.hidden = true;
  if (lastFocus) lastFocus.focus();
}

function kv(dl, k, v, ltr) {
  dl.appendChild(el('dt', null, k));
  const dd = el('dd', ltr ? 'ad-ltr' : null, v == null || v === '' ? '—' : v);
  dl.appendChild(dd);
}

function section(parent, title) {
  const s = el('section', 'ad-sec');
  s.appendChild(el('p', 'ad-sec-k', title));
  parent.appendChild(s);
  return s;
}

function openDetail(id) {
  const l = leads.find((x) => x.id === id);
  if (!l) return;
  lastFocus = document.activeElement;

  $('ad-d-name').textContent = l.full_name;
  $('ad-d-ref').textContent = l.reference + ' · ' + stamp(l.created_at);

  const body = $('ad-d-body');
  body.textContent = '';

  /* Contact */
  let s = section(body, 'Client');
  let dl = el('dl', 'ad-kv');
  kv(dl, 'Email', l.email, true);
  kv(dl, 'Phone', l.phone, true);
  kv(dl, 'Country', `${l.country_name} (${l.country_code})`);
  kv(dl, 'Language', l.preferred_language === 'ar' ? 'العربية' : 'English');
  s.appendChild(dl);

  const acts = el('div', 'ad-actions');
  acts.style.marginTop = '12px';
  const wa = String(l.phone || '').replace(/[^\d]/g, '');
  if (wa) {
    const a = el('a', 'ad-btn ad-btn-sm', 'WhatsApp');
    a.href = 'https://wa.me/' + wa; a.target = '_blank'; a.rel = 'noopener';
    acts.appendChild(a);
  }
  const mail = el('a', 'ad-btn ad-btn-sm', 'Email');
  mail.href = 'mailto:' + l.email;
  acts.appendChild(mail);
  acts.appendChild(copyBtn('Copy email', l.email));
  acts.appendChild(copyBtn('Copy phone', l.phone));
  s.appendChild(acts);

  /* Request */
  s = section(body, 'Request');
  dl = el('dl', 'ad-kv');
  kv(dl, 'Project type', TYPE_LABEL[l.project_type] || l.project_type);
  kv(dl, 'Desired timeline', l.desired_timeline);
  kv(dl, 'Stated budget', l.client_budget);
  kv(dl, 'Reference URL', l.reference_url, true);
  s.appendChild(dl);
  const desc = el('div', 'ad-desc', l.description);
  desc.style.marginTop = '10px';
  desc.setAttribute('dir', l.preferred_language === 'ar' ? 'rtl' : 'ltr');
  s.appendChild(desc);

  /* Pricing + model */
  s = section(body, 'Estimate');
  dl = el('dl', 'ad-kv');
  kv(dl, 'Quoted', l.ai_price_min_usd ? `${money(l.ai_price_min_usd)} – ${money(l.ai_price_max_usd)}` : null);
  kv(dl, 'Allowed window', `${money(l.pricing_floor_usd)} – ${money(l.pricing_ceiling_usd)}`);
  kv(dl, 'Tier / complexity', `${l.pricing_tier} / ${l.complexity}`);
  kv(dl, 'Timeline', l.ai_timeline);
  kv(dl, 'Model', l.ai_model);
  kv(dl, 'Corrected', l.ai_was_clamped ? 'yes — the model was outside the window' : 'no');
  s.appendChild(dl);
  if (l.ai_response_text) {
    const q = el('div', 'ad-quote-text', l.ai_response_text);
    q.style.marginTop = '10px';
    q.setAttribute('dir', l.preferred_language === 'ar' ? 'rtl' : 'ltr');
    s.appendChild(q);
  }

  /* Notification */
  s = section(body, 'Notification');
  dl = el('dl', 'ad-kv');
  dl.appendChild(el('dt', null, 'Status'));
  const dd = el('dd'); dd.appendChild(pill(l.email_notification_status, 'email')); dl.appendChild(dd);
  kv(dl, 'Last sent', stamp(l.last_notified_at));
  s.appendChild(dl);
  const resend = el('button', 'ad-btn ad-btn-sm', 'Re-send notification');
  resend.type = 'button';
  resend.style.marginTop = '12px';
  resend.addEventListener('click', () => doResend(l, resend));
  if (!CFG.resendEndpoint) { resend.disabled = true; resend.title = 'resendEndpoint is not configured'; }
  s.appendChild(resend);

  /* Triage */
  s = section(body, 'Triage');
  const sel = el('select');
  sel.className = 'ad-btn';
  STATUSES.forEach((v) => sel.appendChild(new Option(LABEL[v], v)));
  sel.value = l.status;
  const savedTag = el('span', 'ad-saved', '');
  sel.addEventListener('change', () => patch(l, { status: sel.value }, savedTag));
  const row = el('div', 'ad-actions');
  row.appendChild(sel); row.appendChild(savedTag);
  s.appendChild(row);

  const note = el('textarea', 'ad-note-box');
  note.value = l.admin_notes || '';
  note.placeholder = 'Private notes — only you see these.';
  note.style.marginTop = '12px';
  s.appendChild(note);
  const saveNote = el('button', 'ad-btn ad-btn-sm ad-btn-primary', 'Save note');
  saveNote.type = 'button';
  saveNote.style.marginTop = '8px';
  const noteTag = el('span', 'ad-saved', '');
  saveNote.addEventListener('click', () => patch(l, { admin_notes: note.value }, noteTag));
  const nrow = el('div', 'ad-actions');
  nrow.appendChild(saveNote); nrow.appendChild(noteTag);
  s.appendChild(nrow);

  drawer.hidden = false;
  drawer.querySelector('[data-close]').focus();
}

function copyBtn(label, value) {
  const b = el('button', 'ad-btn ad-btn-sm', label);
  b.type = 'button';
  b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(String(value || '')); b.textContent = 'Copied'; }
    catch { b.textContent = 'Press Ctrl+C'; }
    setTimeout(() => { b.textContent = label; }, 1600);
  });
  return b;
}

async function patch(lead, fields, tag) {
  tag.textContent = 'Saving…';
  const { data, error } = await sb
    .from('portfolio_leads').update(fields).eq('id', lead.id).select();
  if (error) { tag.textContent = 'Not saved: ' + error.message; return; }
  if (!data || !data.length) { tag.textContent = 'Not saved — no permission for this row.'; return; }
  Object.assign(lead, data[0]);
  tag.textContent = 'Saved';
  setTimeout(() => { tag.textContent = ''; }, 1800);
  paint();
}

async function doResend(lead, btn) {
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = 'Sending…';
  try {
    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch(CFG.resendEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify({ leadId: lead.id }),
    });
    const out = await res.json().catch(() => ({}));
    btn.textContent = out.ok ? 'Sent' : 'Failed: ' + (out.code || res.status);
    if (out.ok) await load();
  } catch {
    btn.textContent = 'Failed — could not reach the server';
  }
  setTimeout(() => { btn.disabled = false; btn.textContent = original; }, 2200);
}

/* ── CSV ─────────────────────────────────────────────── */

$('ad-export').addEventListener('click', () => {
  const rows = leads.filter(matches);
  const cols = ['reference', 'created_at', 'full_name', 'email', 'phone', 'country_name',
                'preferred_language', 'project_type', 'status', 'ai_price_min_usd',
                'ai_price_max_usd', 'ai_timeline', 'email_notification_status', 'admin_notes'];
  // A leading =, +, - or @ makes a spreadsheet treat the cell as a formula.
  // Every value here came from a stranger, so neutralise it.
  const cell = (v) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const csv = [cols.join(',')]
    .concat(rows.map((r) => cols.map((c) => cell(r[c])).join(',')))
    .join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});
