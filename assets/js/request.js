/* =========================================================
   request.js — the three-step project request wizard.

   Responsibilities:
     - populate the country list in the active language
     - validate each step before letting the visitor leave it
     - keep what has been typed, across steps and across reloads
     - POST once to the estimate endpoint and render the result
     - never assume the backend is configured; degrade honestly

   It mirrors the server's validation rather than replacing it:
   the server is the authority, this is only to save a round trip.
   ========================================================= */
(function () {
  'use strict';

  var P    = window.Portfolio || {};
  var LEAD = P.leadSystem || {};
  var form = document.getElementById('rq-form');
  if (!form) return;

  var DRAFT_KEY = 'mg-request-draft';
  var TOTAL_STEPS = 3;
  var current = 1;
  var submitted = false;

  function t(key, fallback) {
    var v = window.MG && window.MG.i18n && window.MG.i18n.t(key);
    return (v === null || v === undefined) ? fallback : v;
  }
  function lang() {
    return (window.MG && window.MG.i18n && window.MG.i18n.lang) || 'en';
  }

  /* ── Countries ─────────────────────────────────────── */

  var countries = [];
  var select = document.getElementById('rq-country');

  function paintCountries() {
    if (!select || !countries.length) return;
    var keep = select.value;
    var l = lang();
    var sorted = countries.slice().sort(function (a, b) {
      return String(a[l] || a.en).localeCompare(String(b[l] || b.en), l);
    });
    // The placeholder is keyed, so rebuild around it rather than over it.
    var ph = select.querySelector('option[value=""]');
    select.textContent = '';
    if (ph) select.appendChild(ph);
    sorted.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c.c;
      o.textContent = c[l] || c.en;
      o.setAttribute('data-name-en', c.en);
      select.appendChild(o);
    });
    if (keep) select.value = keep;
  }

  /* A required <select> with no options makes step 1 impossible to pass, so a
     failed fetch falls back to a short list that covers most of the audience
     and still lets anyone else continue. The draft is restored either way. */
  var FALLBACK_COUNTRIES = [
    { c: 'EG', en: 'Egypt',                ar: 'مصر' },
    { c: 'SA', en: 'Saudi Arabia',         ar: 'المملكة العربية السعودية' },
    { c: 'AE', en: 'United Arab Emirates', ar: 'الإمارات العربية المتحدة' },
    { c: 'KW', en: 'Kuwait',               ar: 'الكويت' },
    { c: 'QA', en: 'Qatar',                ar: 'قطر' },
    { c: 'US', en: 'United States',        ar: 'الولايات المتحدة' },
    { c: 'GB', en: 'United Kingdom',       ar: 'المملكة المتحدة' },
    { c: 'ZZ', en: 'Somewhere else',       ar: 'دولة أخرى' },
  ];

  function useCountries(rows) {
    countries = (rows && rows.length) ? rows : FALLBACK_COUNTRIES;
    paintCountries();
    restoreDraft();
  }

  fetch('assets/data/countries.json')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(useCountries)
    .catch(function () { useCountries(null); });

  /* ── Draft persistence (§51 — do not lose what was typed) ── */

  var FIELDS = ['fullName', 'email', 'phone', 'countryCode', 'projectType',
                'description', 'desiredTimeline', 'clientBudget', 'referenceUrl'];

  function saveDraft() {
    if (submitted) return;
    try {
      var d = {};
      FIELDS.forEach(function (n) {
        var el = form.elements[n];
        if (el) d[n] = el.value;
      });
      d.step = current;
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch (e) { /* private mode; the form still works */ }
  }

  function restoreDraft() {
    var d;
    try { d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { return; }
    if (!d) return;
    FIELDS.forEach(function (n) {
      var el = form.elements[n];
      if (el && typeof d[n] === 'string' && d[n]) el.value = d[n];
    });
    updateCount();
    // Return to the furthest step the visitor had reached, but only if the
    // steps before it are still valid.
    var target = Math.min(Math.max(parseInt(d.step, 10) || 1, 1), TOTAL_STEPS);
    while (target > 1 && !stepIsValid(target - 1, true)) target--;
    if (target !== current) goTo(target, { focus: false });
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
  }

  form.addEventListener('input', function () { saveDraft(); updateCount(); });
  form.addEventListener('change', saveDraft);

  /* ── Validation (mirrors validation.js on the server) ── */

  var EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
  var PHONE_RE = /^\+?[0-9][0-9\s()\-.]{4,31}$/;

  var RULES = {
    fullName:    function (v) { return v.trim().length >= 2 ? null : 'required'; },
    email:       function (v) { return EMAIL_RE.test(v.trim()) ? null : 'invalid'; },
    phone:       function (v) { return PHONE_RE.test(v.trim()) ? null : 'invalid'; },
    countryCode: function (v) { return v ? null : 'required'; },
    projectType: function (v) { return v ? null : 'required'; },
    description: function (v) { return v.trim().length >= 20 ? null : 'tooShort'; },
    referenceUrl: function (v) {
      if (!v.trim()) return null;
      try { new URL(/^https?:\/\//i.test(v) ? v : 'https://' + v); return null; }
      catch (e) { return 'invalid'; }
    },
    consent: function (v, el) { return el.checked ? null : 'required'; },
  };

  var STEP_FIELDS = {
    1: ['fullName', 'email', 'phone', 'countryCode'],
    2: ['projectType'],
    3: ['description', 'referenceUrl', 'consent'],
  };

  function errorText(field, code) {
    return t('rq.err.' + field + '.' + code, null)
        || t('rq.err.' + code, null)
        || t('rq.err.generic', 'Please check this field.');
  }

  function setFieldError(name, code) {
    var slot = form.querySelector('[data-err-for="' + name + '"]');
    var el = form.elements[name];
    var wrap = el && el.closest('.rq-field, .rq-consent');
    if (slot) slot.textContent = code ? errorText(name, code) : '';
    if (wrap) wrap.classList.toggle('is-invalid', Boolean(code));
    if (el) {
      if (code) el.setAttribute('aria-invalid', 'true');
      else el.removeAttribute('aria-invalid');
    }
  }

  function stepIsValid(step, quiet) {
    var ok = true, firstBad = null;
    (STEP_FIELDS[step] || []).forEach(function (name) {
      var el = form.elements[name];
      if (!el) return;
      var code = RULES[name] ? RULES[name](el.value || '', el) : null;
      if (!quiet) setFieldError(name, code);
      if (code) { ok = false; if (!firstBad) firstBad = el; }
    });
    if (!quiet && firstBad) firstBad.focus();
    return ok;
  }

  // Clear a field's error as soon as it becomes valid, not on the next submit.
  Object.keys(RULES).forEach(function (name) {
    var el = form.elements[name];
    if (!el) return;
    el.addEventListener('blur', function () {
      if (el.value || el.checked) setFieldError(name, RULES[name](el.value || '', el));
    });
    el.addEventListener('input', function () {
      if (el.getAttribute('aria-invalid') && !RULES[name](el.value || '', el)) setFieldError(name, null);
    });
  });

  /* ── Step navigation ───────────────────────────────── */

  function goTo(step, opts) {
    opts = opts || {};
    current = step;
    form.querySelectorAll('[data-panel]').forEach(function (p) {
      var on = Number(p.getAttribute('data-panel')) === step;
      p.hidden = !on;
      p.classList.toggle('is-active', on);
    });
    document.querySelectorAll('.rq-step').forEach(function (s) {
      var n = Number(s.getAttribute('data-step'));
      s.classList.toggle('is-current', n === step);
      s.classList.toggle('is-done', n < step);
      if (n === step) s.setAttribute('aria-current', 'step');
      else s.removeAttribute('aria-current');
    });
    if (opts.focus !== false) {
      var h = form.querySelector('[data-panel="' + step + '"] .rq-panel-h');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    saveDraft();
  }

  form.addEventListener('click', function (e) {
    var next = e.target.closest('[data-next]');
    if (next) {
      if (stepIsValid(current)) goTo(Number(next.getAttribute('data-next')));
      return;
    }
    var prev = e.target.closest('[data-prev]');
    if (prev) goTo(Number(prev.getAttribute('data-prev')));
  });

  // Enter inside a text field advances rather than submitting from step 1 or 2.
  // A button must keep its own Enter behaviour, or Back becomes unusable by
  // keyboard.
  form.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA') return;
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A') return;
    if (current < TOTAL_STEPS) {
      e.preventDefault();
      if (stepIsValid(current)) goTo(current + 1);
    }
  });

  function updateCount() {
    var el = form.elements.description;
    var out = document.querySelector('[data-count-for="description"]');
    if (el && out) out.textContent = String((el.value || '').length);
  }

  /* ── Submit ────────────────────────────────────────── */

  /* ── Turnstile ──────────────────────────────────────
     Rendered only when a site key is configured. The server enforces it only
     when TURNSTILE_SECRET_KEY is set, so the two switch on together: with
     neither, the honeypot and the server-side rate limit are the protection.
     The widget is loaded lazily so the page costs nothing when it is off. */

  var turnstileWidget = null;

  function initTurnstile() {
    if (!LEAD.turnstileSiteKey) return;
    var mount = document.getElementById('rq-turnstile');
    if (!mount) return;
    mount.hidden = false;

    window.mgTurnstileReady = function () {
      try {
        turnstileWidget = window.turnstile.render(mount, {
          sitekey: LEAD.turnstileSiteKey,
          language: lang(),
          'error-callback': function () { turnstileWidget = null; },
        });
      } catch (e) { turnstileWidget = null; }
    };

    var sc = document.createElement('script');
    sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=mgTurnstileReady&render=explicit';
    sc.async = true;
    sc.defer = true;
    document.head.appendChild(sc);
  }

  function botToken() {
    if (!LEAD.turnstileSiteKey || !window.turnstile) return null;
    try { return window.turnstile.getResponse(turnstileWidget) || null; }
    catch (e) { return null; }
  }

  function resetTurnstile() {
    if (turnstileWidget !== null && window.turnstile) {
      try { window.turnstile.reset(turnstileWidget); } catch (e) { /* ignore */ }
    }
  }

  initTurnstile();

  var formErr = document.getElementById('rq-form-err');

  function showFormError(msg) {
    if (!formErr) return;
    formErr.textContent = msg;
    formErr.hidden = false;
    formErr.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function collect() {
    var countryEl = form.elements.countryCode;
    var opt = countryEl && countryEl.selectedOptions && countryEl.selectedOptions[0];
    return {
      language:        lang(),
      fullName:        form.elements.fullName.value,
      email:           form.elements.email.value,
      phone:           form.elements.phone.value,
      countryCode:     countryEl.value,
      // Always the English name: the record must read the same whoever opens it.
      countryName:     (opt && opt.getAttribute('data-name-en')) || countryEl.value,
      projectType:     form.elements.projectType.value,
      description:     form.elements.description.value,
      desiredTimeline: form.elements.desiredTimeline.value || null,
      clientBudget:    form.elements.clientBudget.value || null,
      referenceUrl:    form.elements.referenceUrl.value || null,
      consent:         form.elements.consent.checked,
      company:         form.elements.hp_detail_2 ? form.elements.hp_detail_2.value : '',
      utmSource:       param('utm_source'),
      utmMedium:       param('utm_medium'),
      utmCampaign:     param('utm_campaign'),
      botToken:        botToken(),
    };
  }

  function param(name) {
    try { return new URLSearchParams(location.search).get(name) || null; }
    catch (e) { return null; }
  }

  var inFlight = false;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    // CSS pointer-events only stops the mouse. Without this guard, two quick
    // Enter presses create two leads, two Gemini calls and two emails.
    if (inFlight) return;
    if (formErr) formErr.hidden = true;

    // Re-check every step, not just the last: a visitor can reach step 3 and
    // then empty a field on step 1 with the browser's back button.
    for (var s = 1; s <= TOTAL_STEPS; s++) {
      if (!stepIsValid(s)) { goTo(s); return; }
    }

    if (!LEAD.endpoint) {
      showFormError(t('rq.err.notConfigured',
        'The request form is not connected yet. Please email or message me directly in the meantime.'));
      return;
    }

    inFlight = true;
    form.classList.add('is-submitting');
    var submitBtn = document.getElementById('rq-submit');
    if (submitBtn) submitBtn.disabled = true;
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 30000);

    /* Supabase's function gateway rejects an unauthenticated request before
       the function runs, so the PUBLIC anon key is sent as the bearer token.
       It grants nothing on its own: portfolio_leads has RLS on with no anon
       policy. Without a configured key the call still works on a gateway
       deployed with --no-verify-jwt. */
    var headers = { 'Content-Type': 'application/json' };
    if (LEAD.supabaseAnonKey) {
      headers.apikey = LEAD.supabaseAnonKey;
      headers.Authorization = 'Bearer ' + LEAD.supabaseAnonKey;
    }

    fetch(LEAD.endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(collect()),
      signal: controller.signal,
    })
      .then(function (r) {
        // A reachable server that answers with something unparseable is a
        // server problem, not a connection problem - say the right thing.
        return r.text().then(function (txt) {
          var body = null;
          try { body = JSON.parse(txt); } catch (e) { /* left null */ }
          return { status: r.status, body: body, parsed: body !== null };
        });
      })
      .then(function (res) {
        if (res.status === 200 && res.body && res.body.ok) {
          submitted = true;
          clearDraft();
          renderResult(res.body);
          return;
        }
        if (res.body && Array.isArray(res.body.errors)) {
          res.body.errors.forEach(function (err) { setFieldError(err.field, err.code); });
        }
        showFormError((res.parsed && res.body.message) ||
          t('rq.err.server', 'Something went wrong. Please try again shortly.'));
      })
      .catch(function () {
        showFormError(t('rq.err.network',
          'We could not reach the server. Please check your connection and try again.'));
      })
      .finally(function () {
        clearTimeout(timer);
        inFlight = false;
        form.classList.remove('is-submitting');
        if (submitBtn) submitBtn.disabled = false;
        // A Turnstile token is single-use; a retry needs a fresh one.
        resetTurnstile();
      });
  });

  /* ── Result ────────────────────────────────────────── */

  function fillList(ul, items) {
    ul.textContent = '';
    (items || []).forEach(function (text) {
      var li = document.createElement('li');
      li.textContent = text;        // textContent, never innerHTML: model output
      ul.appendChild(li);
    });
    return (items || []).length;
  }

  function money(n) {
    try { return '$' + Number(n).toLocaleString('en-US'); }
    catch (e) { return '$' + n; }
  }

  function whatsappLink(ref, quote) {
    var base = (P.profile && P.profile.whatsapp) || '';
    if (!base) return null;
    var typeLabel = form.elements.projectType.selectedOptions[0];
    typeLabel = typeLabel ? typeLabel.textContent.trim() : '';
    var msg = lang() === 'ar'
      ? 'مرحبًا محمد، أرسلت طلب مشروع رقم ' + ref + ' بخصوص ' + typeLabel +
        (quote ? '، وحصلت على تقدير مبدئي من ' + quote.priceMinUsd + ' إلى ' + quote.priceMaxUsd + ' دولار' : '') +
        '. أريد تحديد موعد لاجتماع قصير لمناقشة المتطلبات.'
      : 'Hi Mohamed, I submitted project request ' + ref + ' for ' + typeLabel +
        (quote ? ' and received an approximate estimate of $' + quote.priceMinUsd + '–$' + quote.priceMaxUsd : '') +
        ". I'd like to schedule a short requirements meeting.";
    return base + (base.indexOf('?') === -1 ? '?' : '&') + 'text=' + encodeURIComponent(msg);
  }

  function renderResult(body) {
    var result = document.getElementById('rq-result');
    var q = body.quote;

    document.getElementById('rq-reference').textContent = body.reference || '';

    if (q) {
      document.getElementById('rq-summary').textContent = q.summary || '';
      document.getElementById('rq-price').textContent =
        money(q.priceMinUsd) + ' – ' + money(q.priceMaxUsd);
      document.getElementById('rq-timeline-out').textContent = q.estimatedTimeline || '';
      document.getElementById('rq-message').textContent = q.customerMessage || '';
      document.getElementById('rq-disclaimer').textContent = q.disclaimer || '';
      document.getElementById('rq-scope-block').hidden =
        fillList(document.getElementById('rq-scope'), q.recommendedScope) === 0;
      document.getElementById('rq-assume-block').hidden =
        fillList(document.getElementById('rq-assumptions'), q.assumptions) === 0;
    } else {
      // The lead was saved; only the estimate is missing. Say exactly that.
      document.getElementById('rq-summary').textContent =
        body.message || t('rq.result.noQuote',
          'Your request has reached Mohamed. He will reply with a quote personally.');
      ['rq-price', 'rq-timeline-out', 'rq-message', 'rq-disclaimer'].forEach(function (id) {
        var el = document.getElementById(id); if (el) el.textContent = '';
      });
      document.querySelector('.rq-result-grid').hidden = true;
      document.getElementById('rq-scope-block').hidden = true;
      document.getElementById('rq-assume-block').hidden = true;
      document.querySelector('.rq-result-h').textContent =
        t('rq.result.titleNoQuote', 'Request received');
    }

    var wa = document.getElementById('rq-whatsapp');
    var link = whatsappLink(body.reference, q);
    if (link) wa.href = link; else wa.hidden = true;

    // Only claim delivery when the backend actually confirmed it.
    var notified = document.getElementById('rq-notified');
    if (notified) notified.hidden = body.notified !== true;

    form.hidden = true;
    document.getElementById('rq-steps').hidden = true;
    result.hidden = false;
    result.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ── Language changes ──────────────────────────────── */

  window.addEventListener('mg:langchange', function () {
    paintCountries();
    // Re-render any message that is currently shown, so it follows the switch.
    form.querySelectorAll('[data-err-for]').forEach(function (slot) {
      if (slot.textContent) {
        var name = slot.getAttribute('data-err-for');
        var el = form.elements[name];
        if (el && RULES[name]) setFieldError(name, RULES[name](el.value || '', el));
      }
    });
  });

  updateCount();
})();
