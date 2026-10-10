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
  var REQID_KEY = 'mg-request-id';
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

  /* ── Idempotency ───────────────────────────────────────
     The server de-duplicates on requestId: the same id returns the same
     reference, with no second row, no second model call and no second email.
     So a retry after a timeout MUST reuse the id, and an edited payload MUST
     NOT - otherwise a corrected request would be answered with the old quote.

     The id is therefore stored alongside a fingerprint of the payload it
     belongs to, and regenerated the moment that fingerprint changes.
     botToken and requestId are excluded from the fingerprint: a Turnstile
     token is single-use and changes on every retry, which is not an edit. */

  var ID_RE = /^[A-Za-z0-9_-]{16,80}$/;

  function newRequestId() {
    var id = '';
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        id = window.crypto.randomUUID().replace(/-/g, '');
      }
    } catch (e) { /* fall through */ }

    if (!ID_RE.test(id)) {
      // No randomUUID: build 32 hex characters from getRandomValues, and only
      // fall back to Math.random if even that is unavailable.
      var bytes = null;
      try {
        if (window.crypto && window.crypto.getRandomValues) {
          bytes = window.crypto.getRandomValues(new Uint8Array(16));
        }
      } catch (e) { bytes = null; }
      var out = '';
      for (var i = 0; i < 16; i++) {
        var v = bytes ? bytes[i] : Math.floor(Math.random() * 256);
        out += (v < 16 ? '0' : '') + v.toString(16);
      }
      // A timestamp prefix keeps ids distinct even if the RNG is degraded.
      id = 'r' + Date.now().toString(36) + out;
    }
    return ID_RE.test(id) ? id : ('r' + Date.now().toString(36) + 'xxxxxxxxxxxxxxxx').slice(0, 40);
  }

  /** A stable fingerprint of everything the server would treat as content. */
  function payloadFingerprint(payload) {
    var keys = Object.keys(payload)
      .filter(function (k) { return k !== 'requestId' && k !== 'botToken'; })
      .sort();
    var parts = keys.map(function (k) {
      var v = payload[k];
      return k + '=' + (v === null || v === undefined ? '' : String(v));
    });
    var str = parts.join('\u0001');
    // djb2: short, stable, and sufficient - this picks between "same request"
    // and "edited request", it is not a security boundary.
    var h1 = 5381, h2 = 52711;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      h1 = ((h1 << 5) + h1 + c) >>> 0;
      h2 = ((h2 << 5) + h2 + (c ^ 0x5f)) >>> 0;
    }
    return h1.toString(36) + '-' + h2.toString(36) + '-' + str.length.toString(36);
  }

  /** The id for this exact payload: reused on a retry, fresh after an edit. */
  function requestIdFor(payload) {
    var fp = payloadFingerprint(payload);
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(REQID_KEY) || 'null'); } catch (e) { saved = null; }

    if (saved && saved.fp === fp && ID_RE.test(saved.id || '')) return saved.id;

    var id = newRequestId();
    try { localStorage.setItem(REQID_KEY, JSON.stringify({ id: id, fp: fp })); }
    catch (e) { /* private mode: the id still works for this attempt */ }
    return id;
  }

  function clearRequestId() {
    try { localStorage.removeItem(REQID_KEY); } catch (e) {}
  }

  form.addEventListener('input', function () { saveDraft(); updateCount(); });
  form.addEventListener('change', saveDraft);

  /* ── Validation (mirrors validation.js on the server) ── */

  var EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
  var PHONE_RE = /^\+?[0-9][0-9\s()\-.]{4,31}$/;

  var RULES = {
    fullName:    function (v) {
      var n = v.trim().length;
      return n >= 2 && n <= 120 ? null : (n > 120 ? 'tooLong' : 'required');
    },
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

  /* A dead end is not an acceptable error state. When the backend cannot take
     the request at all, the message is followed by the two routes that always
     work, so the visitor is never told "contact me directly" without being
     given a way to do it. */
  function showFormError(msg, withContact) {
    if (!formErr) return;
    formErr.textContent = '';
    formErr.appendChild(document.createTextNode(msg));

    if (withContact) {
      var p = (window.Portfolio && window.Portfolio.profile) || {};
      var row = document.createElement('div');
      row.className = 'rq-err-actions';
      if (p.whatsapp) {
        var w = document.createElement('a');
        w.className = 'btn btn-outline-warm btn-sm';
        w.href = p.whatsapp; w.target = '_blank'; w.rel = 'noopener';
        w.textContent = t('rq.err.contactWhatsapp', 'Message on WhatsApp');
        row.appendChild(w);
      }
      if (p.email) {
        var m = document.createElement('a');
        m.className = 'btn btn-outline-warm btn-sm';
        m.href = 'mailto:' + p.email;
        m.textContent = t('rq.err.contactEmail', 'Email me');
        row.appendChild(m);
      }
      if (row.childNodes.length) formErr.appendChild(row);
    }

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

  /** collect() plus the idempotency key for exactly that payload. */
  function collectWithRequestId() {
    var payload = collect();
    payload.requestId = requestIdFor(payload);
    return payload;
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

    // Never configured: say so, and offer the routes that do work.
    if (!LEAD.endpoint) {
      showFormError(t('rq.err.notConfigured',
        'The request form is not connected yet. You can contact me directly in the meantime.'), true);
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
      body: JSON.stringify(collectWithRequestId()),
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
          // Only here. A network error, a timeout or a 5xx leaves the id in
          // place so the retry is de-duplicated against the first attempt.
          clearRequestId();
          // The lead exists on the server from here on. A failure to PAINT it
          // must never be reported as "we could not reach the server", or the
          // visitor retries and we create a second lead, a second model call
          // and a second email.
          try {
            renderResult(res.body);
          } catch (renderErr) {
            showFormError(
              t('rq.result.received', 'Request received') + ' — ' + (res.body.reference || ''),
              true);
          }
          return;
        }
        if (res.body && Array.isArray(res.body.errors)) {
          res.body.errors.forEach(function (err) { setFieldError(err.field, err.code); });
          // The server validates every field at once, so a rejected one can
          // belong to a step the visitor has already left. Marking it there
          // puts the message inside a collapsed panel where nobody sees it,
          // so jump to the earliest step that actually has a problem.
          var earliest = null;
          res.body.errors.forEach(function (err) {
            for (var step = 1; step <= TOTAL_STEPS; step++) {
              if ((STEP_FIELDS[step] || []).indexOf(err.field) !== -1) {
                if (earliest === null || step < earliest) earliest = step;
              }
            }
          });
          if (earliest !== null && earliest !== current) goTo(earliest);
        }
        // Only OUR error shape may be shown verbatim. The functions gateway
        // also answers with {message}, and "Missing authorization header" is
        // not something to put in front of a customer.
        var ours = res.parsed && res.body && res.body.ok === false &&
                   typeof res.body.code === 'string' && typeof res.body.message === 'string';
        // A 403 we recognise is a bot check the visitor can clear by
        // reloading; a 403 we do not recognise is the gateway refusing us.
        var serverDown = res.status >= 500 || res.status === 404 || res.status === 401 ||
                         (res.status === 403 && !ours);
        showFormError(
          (ours && !serverDown ? res.body.message : null) ||
          (serverDown
            ? t('rq.err.unavailable',
                'The request form is temporarily unavailable. You can contact me directly while I reconnect it.')
            : t('rq.err.server', 'Something went wrong. Please try again shortly.')),
          serverDown);
      })
      .catch(function (err) {
        // An abort is our own 30s timeout; anything else is the network.
        // Either way the backend did not take the request, so offer a way out.
        var timedOut = err && err.name === 'AbortError';
        showFormError(timedOut
          ? t('rq.err.unavailable',
              'The request form is temporarily unavailable. You can contact me directly while I reconnect it.')
          : t('rq.err.network',
              'We could not reach the server. Please check your connection and try again.'), true);
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

  /* ── Currency ──────────────────────────────────────────
     The backend decides the currency; the browser only formats it. No symbol
     table and no country mapping here - Intl knows how every ISO-4217 code
     should look, including which ones have no minor unit. */

  /** Whole units: a preliminary estimate does not need cents. */
  function formatCurrency(amount, code) {
    var n = Number(amount);
    if (!isFinite(n)) return null;
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency', currency: code,
        minimumFractionDigits: 0, maximumFractionDigits: 0,
      }).format(n);
    } catch (e) {
      // An unknown or malformed code must not lose the number.
      return (code ? code + ' ' : '') + Math.round(n).toLocaleString('en-US');
    }
  }

  /** A usable localCurrency block, or null. Validated, not trusted. */
  function localPrice(quote) {
    var lc = quote && quote.localCurrency;
    if (!lc || typeof lc !== 'object') return null;
    var code = typeof lc.currencyCode === 'string' ? lc.currencyCode.trim().toUpperCase() : '';
    if (!/^[A-Z]{3}$/.test(code)) return null;
    var min = Number(lc.priceMin), max = Number(lc.priceMax);
    if (!isFinite(min) || !isFinite(max) || min <= 0 || max <= 0) return null;
    if (min > max) { var t2 = min; min = max; max = t2; }
    return { code: code, min: min, max: max, provider: lc.provider || '' };
  }

  function range(minText, maxText) { return minText + ' – ' + maxText; }

  function whatsappLink(ref, quote) {
    var base = (P.profile && P.profile.whatsapp) || '';
    if (!base) return null;
    var typeLabel = form.elements.projectType.selectedOptions[0];
    typeLabel = typeLabel ? typeLabel.textContent.trim() : '';
    var ar = lang() === 'ar';

    /* The estimate clause leads with the currency the customer was actually
       shown, and keeps USD in brackets as the common reference. One clause
       either way - this is an opener, not a summary. */
    var clause = '';
    if (quote) {
      var lp = localPrice(quote);
      var usd = '$' + quote.priceMinUsd + '–$' + quote.priceMaxUsd;
      if (lp && lp.code !== 'USD') {
        var loc = formatCurrency(lp.min, lp.code) + '–' + formatCurrency(lp.max, lp.code);
        clause = ar
          ? '، وحصلت على تقدير مبدئي ' + loc + ' (' + usd + ')'
          : ' and received an approximate estimate of ' + loc + ' (' + usd + ')';
      } else {
        clause = ar
          ? '، وحصلت على تقدير مبدئي من ' + quote.priceMinUsd + ' إلى ' + quote.priceMaxUsd + ' دولار'
          : ' and received an approximate estimate of ' + usd;
      }
    }

    var msg = ar
      ? 'مرحبًا محمد، أرسلت طلب مشروع رقم ' + ref + ' بخصوص ' + typeLabel + clause +
        '. أريد تحديد موعد لاجتماع قصير لمناقشة المتطلبات.'
      : 'Hi Mohamed, I submitted project request ' + ref + ' for ' + typeLabel + clause +
        ". I'd like to schedule a short requirements meeting.";
    return base + (base.indexOf('?') === -1 ? '?' : '&') + 'text=' + encodeURIComponent(msg);
  }

  function paintPrice(q) {
    var priceEl = document.getElementById('rq-price');
    var subEl   = document.getElementById('rq-price-usd');
    var fxEl    = document.getElementById('rq-fx');
    // A browser holding a cached request.html alongside fresh JS has the
    // price element but not the two new ones. Missing slots are skipped, not
    // thrown over: the quote still renders.
    if (!priceEl) return;
    var hide = function (el) { if (el) { el.textContent = ''; el.hidden = true; } };

    var usdText = range(money(q.priceMinUsd), money(q.priceMaxUsd));
    var lp = localPrice(q);

    if (!lp) {
      // No conversion available: the existing USD result, unchanged.
      priceEl.textContent = usdText;
      hide(subEl); hide(fxEl);
      return;
    }

    var localText = range(formatCurrency(lp.min, lp.code), formatCurrency(lp.max, lp.code));
    priceEl.textContent = localText;

    // USD twice would be noise, so the secondary line only appears when the
    // local currency is actually something else.
    if (lp.code === 'USD' || !subEl) {
      hide(subEl);
    } else {
      subEl.hidden = false;
      subEl.textContent = '\u2248 ' + usdText + ' USD';
    }

    // Attribution, as a link, only for the provider that asks for one.
    if (!fxEl) return;
    fxEl.textContent = '';
    if (/exchangerate-api/i.test(String(lp.provider))) {
      fxEl.appendChild(document.createTextNode(t('rq.result.fxBy', 'Rates by') + ' '));
      var a2 = document.createElement('a');
      a2.href = 'https://www.exchangerate-api.com/';
      a2.target = '_blank';
      a2.rel = 'noopener noreferrer';
      a2.textContent = 'ExchangeRate-API';
      fxEl.appendChild(a2);
      fxEl.hidden = false;
    } else {
      fxEl.hidden = true;
    }
  }

  /* Kept so a language switch AFTER the result is shown can repaint the
     parts this file writes itself. Everything else on the panel is either
     data-i18n markup or model output, which must not be re-translated. */
  var lastQuote = null;

  function renderResult(body) {
    var result = document.getElementById('rq-result');
    var q = body.quote;
    lastQuote = q || null;

    document.getElementById('rq-reference').textContent = body.reference || '';

    if (q) {
      document.getElementById('rq-summary').textContent = q.summary || '';
      paintPrice(q);
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
      ['rq-price', 'rq-price-usd', 'rq-fx', 'rq-timeline-out', 'rq-message', 'rq-disclaimer']
        .forEach(function (id) {
          var el = document.getElementById(id);
          if (!el) return;
          el.textContent = '';
          if (id === 'rq-price-usd' || id === 'rq-fx') el.hidden = true;
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
    // The FX attribution label is written by paintPrice, not by data-i18n,
    // so it would otherwise stay in the previous language.
    if (lastQuote) { try { paintPrice(lastQuote); } catch (e) { /* leave it */ } }
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
