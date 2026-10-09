/* =========================================================
   i18n.js — bilingual engine (English / العربية)
   ---------------------------------------------------------
   Loaded as a BLOCKING script in <head>, before any stylesheet
   paints content, so Arabic visitors never see a flash of
   English. The dictionaries are plain JS assigned to globals
   rather than fetched JSON: a fetch would add a round trip in
   front of first paint and guarantee that flash.

   Translation is applied by attribute:

     <h2 data-i18n="work.title">Real systems</h2>
     <a data-i18n-attr="aria-label:nav.homeLabel" ...>
     <input data-i18n-attr="placeholder:form.namePh">

   English is the authored markup, so the page is correct with
   JavaScript disabled and correct before this script runs.
   Only Arabic requires a swap.
   ========================================================= */
(function (w, d) {
  'use strict';

  var STORE_KEY = 'mg-lang';
  var SUPPORTED = ['en', 'ar'];
  var RTL = { ar: true };

  function safeGet(k) {
    try { return w.localStorage.getItem(k); } catch (e) { return null; }
  }
  function safeSet(k, v) {
    try { w.localStorage.setItem(k, v); } catch (e) { /* private mode */ }
  }

  /* §6 — stored preference wins; otherwise browser language; Arabic only
     when the browser preference actually starts with "ar". No geo guessing. */
  function detect() {
    var saved = safeGet(STORE_KEY);
    if (saved && SUPPORTED.indexOf(saved) !== -1) return saved;
    var navLangs = (w.navigator.languages && w.navigator.languages.length)
      ? w.navigator.languages
      : [w.navigator.language || w.navigator.userLanguage || 'en'];
    for (var i = 0; i < navLangs.length; i++) {
      var l = String(navLangs[i] || '').toLowerCase();
      if (l.indexOf('ar') === 0) return 'ar';
      if (l.indexOf('en') === 0) return 'en';
    }
    return 'en';
  }

  var current = detect();

  function dict(lang) {
    return (w.MG_I18N && w.MG_I18N[lang]) || {};
  }

  /* Look up a key; fall back to English, then to the key itself so a
     missing string is visible in QA rather than rendering blank. */
  function t(key, lang) {
    var l = lang || current;
    var v = dict(l)[key];
    if (v === undefined && l !== 'en') v = dict('en')[key];
    return v === undefined ? null : v;
  }

  function applyTo(root) {
    var scope = root || d;

    scope.querySelectorAll('[data-i18n]').forEach(function (el) {
      var v = t(el.getAttribute('data-i18n'));
      if (v === null) return;
      /* Allow a few inline tags inside translated copy (<em>, <br>, <b>,
         <span>) because several headings depend on them. The dictionary is
         first-party content, not user input. */
      if (/<(em|br|b|strong|span|i)\b/i.test(v)) el.innerHTML = v;
      else el.textContent = v;
    });

    scope.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var bits = pair.split(':');
        if (bits.length < 2) return;
        var attr = bits[0].trim();
        var v = t(bits.slice(1).join(':').trim());
        if (v !== null) el.setAttribute(attr, v);
      });
    });

    /* Elements whose content differs per direction (e.g. a "back" arrow
       that should point the other way) opt in with data-i18n-flip. */
    scope.querySelectorAll('[data-i18n-flip]').forEach(function (el) {
      el.classList.toggle('is-rtl-flip', !!RTL[current]);
    });
  }

  function setDocumentLang(lang) {
    var html = d.documentElement;
    html.setAttribute('lang', lang);
    html.setAttribute('dir', RTL[lang] ? 'rtl' : 'ltr');
    html.classList.toggle('is-rtl', !!RTL[lang]);
  }

  function setLang(lang, opts) {
    if (SUPPORTED.indexOf(lang) === -1) lang = 'en';
    current = lang;
    safeSet(STORE_KEY, lang);
    setDocumentLang(lang);
    if (d.body) applyTo(d);
    syncSwitch();
    if (!opts || !opts.silent) {
      w.dispatchEvent(new CustomEvent('mg:langchange', { detail: { lang: lang } }));
    }
  }

  function syncSwitch() {
    d.querySelectorAll('[data-lang-btn]').forEach(function (b) {
      var on = b.getAttribute('data-lang-btn') === current;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  /* Direction is set before first paint; text is swapped as soon as the
     body exists. Both run ahead of DOMContentLoaded handlers. */
  setDocumentLang(current);

  function boot() {
    applyTo(d);
    syncSwitch();
    /* Announce the first pass as well as later switches. Scripts that mirror
       DOM text into their own UI (the case-study gallery copies figcaptions
       into .gal-cap) may have run before this point, so they need a chance to
       resync even when the language has not "changed". */
    w.dispatchEvent(new CustomEvent('mg:langchange', { detail: { lang: current, initial: true } }));
    d.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-lang-btn]');
      if (!btn) return;
      e.preventDefault();
      setLang(btn.getAttribute('data-lang-btn'));
    });
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();

  w.MG = w.MG || {};
  w.MG.i18n = {
    get lang() { return current; },
    get dir() { return RTL[current] ? 'rtl' : 'ltr'; },
    t: t,
    setLang: setLang,
    apply: applyTo,
    supported: SUPPORTED.slice()
  };
}(window, document));
