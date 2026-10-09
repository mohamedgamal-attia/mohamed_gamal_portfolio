/* =========================================================
   case-study.js — behaviour for projects/*.html
     · reading progress + active section
     · scroll reveal
     · pointer-tracked 3D tilt on media frames
     · tabbed screen gallery built from the no-JS track
     · accessible lightbox (focus trap, arrows, Escape)
     · locale / theme comparison switches
   Every motion path checks prefers-reduced-motion first.
   ========================================================= */

(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(pointer: fine)').matches;
  var mobile = window.matchMedia('(max-width: 760px)');

  /* ── Reading progress ───────────────────────────────── */
  var bar = document.getElementById('cs-progress');
  if (bar) {
    var onScroll = function () {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── Scroll reveal ──────────────────────────────────── */
  var revealables = document.querySelectorAll('.cs-reveal');
  if (!('IntersectionObserver' in window) || reduce) {
    revealables.forEach(function (el) { el.classList.add('visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ── Pointer-tracked tilt on media stages ───────────── */
  if (fine && !reduce) {
    document.querySelectorAll('.tilt-stage').forEach(function (stage) {
      var media = stage.querySelector('.tilt-3d-media');
      if (!media) return;
      var max = parseFloat(getComputedStyle(document.documentElement)
        .getPropertyValue('--tilt-max')) || 6;
      stage.addEventListener('mousemove', function (e) {
        var r = stage.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        media.style.setProperty('--ry', (px * max).toFixed(2) + 'deg');
        media.style.setProperty('--rx', (-py * max).toFixed(2) + 'deg');
      });
      stage.addEventListener('mouseleave', function () {
        media.style.setProperty('--ry', '0deg');
        media.style.setProperty('--rx', '0deg');
      });
    });
  }

  /* ── Screen gallery ─────────────────────────────────── */
  /* Captions live in the DOM and are translated by the i18n pass; the gallery
     mirrors them into .gal-cap, so it has to redraw when the language flips. */
  var galleryRedraws = [];
  window.addEventListener('mg:langchange', function () {
    galleryRedraws.forEach(function (fn) { try { fn(); } catch (e) {} });
  });

  document.querySelectorAll('[data-gallery]').forEach(function (gal) {
    var track = gal.querySelector('.gal-track');
    var mainImg = gal.querySelector('.gal-main img');
    var cap = gal.querySelector('.gal-cap');
    var thumbs = gal.querySelector('.gal-thumbs');
    var tabs = Array.prototype.slice.call(gal.querySelectorAll('.gal-tab'));
    if (!track || !mainImg || !thumbs) return;

    var all = Array.prototype.slice.call(track.querySelectorAll('figure')).map(function (fig) {
      var img = fig.querySelector('img');
      var capEl = fig.querySelector('figcaption');
      var title = capEl && capEl.querySelector('b');
      return {
        src: img.getAttribute('src'),
        alt: img.getAttribute('alt') || '',
        w: img.getAttribute('width'),
        h: img.getAttribute('height'),
        /* Live getters, not snapshots — see note above. */
        get title() {
          var b = this.fig.querySelector('figcaption b');
          return b ? b.textContent.trim() : '';
        },
        get text() {
          var c = this.fig.querySelector('figcaption');
          if (!c) return '';
          var b = c.querySelector('b');
          return c.textContent.replace(b ? b.textContent : '', '').trim();
        },
        group: fig.dataset.group || 'all',
        fig: fig
      };
    });

    var shown = all.slice();
    var index = 0;

    function paint() {
      var it = shown[index];
      if (!it) return;
      mainImg.setAttribute('src', it.src);
      mainImg.setAttribute('alt', it.alt);
      if (it.w) mainImg.setAttribute('width', it.w);
      if (it.h) mainImg.setAttribute('height', it.h);
      if (cap) {
        cap.textContent = '';
        var b = document.createElement('b');
        b.textContent = it.title;
        cap.appendChild(b);
        cap.appendChild(document.createTextNode(it.text));
      }
      Array.prototype.forEach.call(thumbs.children, function (btn, i) {
        btn.setAttribute('aria-current', i === index ? 'true' : 'false');
      });
    }

    /* Repaint on language change: the caption text comes from the DOM, which
       the i18n pass has just rewritten. */
    galleryRedraws.push(function () { paint(); buildThumbs(); });

    function buildThumbs() {
      thumbs.textContent = '';
      shown.forEach(function (it, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'gal-thumb';
        b.setAttribute('aria-label', 'Show screen ' + (i + 1) + ': ' + it.title);
        var im = document.createElement('img');
        im.src = it.src; im.alt = ''; im.loading = 'lazy'; im.decoding = 'async';
        b.appendChild(im);
        b.addEventListener('click', function () { index = i; paint(); });
        thumbs.appendChild(b);
      });
    }

    function select(group) {
      shown = group === 'all' ? all.slice() : all.filter(function (it) { return it.group === group; });
      if (!shown.length) shown = all.slice();
      all.forEach(function (it) {
        it.fig.classList.toggle('is-hidden', shown.indexOf(it) === -1);
      });
      index = 0;
      buildThumbs();
      paint();
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.setAttribute('aria-selected', String(t === tab)); });
        select(tab.dataset.group);
      });
      tab.addEventListener('keydown', function (e) {
        var i = tabs.indexOf(tab);
        var next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : -1;
        if (next < 0 || next >= tabs.length) return;
        e.preventDefault();
        tabs[next].focus(); tabs[next].click();
      });
    });

    select('all');
    /* Only now is the tabbed viewer real — before this the markup falls back
       to the plain horizontal track, which works with no JS at all. */
    gal.classList.add('is-enhanced');

    /* The lightbox reads the current filtered set and position from here. */
    gal._items = function () { return shown; };
    gal._index = function (v) { if (v != null) { index = v; paint(); } return index; };
  });

  /* ── Lightbox — opened from the gallery's Expand button or any
        element carrying [data-lightbox] ─────────────────────── */
  var lb = document.getElementById('lightbox');
  if (lb) {
    var lbImg = lb.querySelector('.lb-fig img');
    var lbCap = lb.querySelector('.lb-cap');
    var lbCount = lb.querySelector('.lb-count');
    var lbClose = lb.querySelector('.lb-btn');
    var ctx = { items: [], i: 0 };
    var lastFocus = null;

    function render() {
      var it = ctx.items[ctx.i];
      if (!it) return;
      lbImg.src = it.src;
      lbImg.alt = it.alt;
      lbCap.innerHTML = '';
      var b = document.createElement('b');
      b.textContent = it.title;
      lbCap.appendChild(b);
      lbCap.appendChild(document.createTextNode(' ' + it.text));
      lbCount.textContent = (ctx.i + 1) + ' / ' + ctx.items.length;
      var multi = ctx.items.length > 1;
      lb.querySelectorAll('.lb-nav').forEach(function (n) { n.hidden = !multi; });
    }
    function step(d) {
      if (!ctx.items.length) return;
      ctx.i = (ctx.i + d + ctx.items.length) % ctx.items.length;
      render();
    }
    function open(items, i) {
      ctx.items = items; ctx.i = i || 0;
      lastFocus = document.activeElement;
      render();
      lb.classList.add('open');
      document.body.style.overflow = 'hidden';
      lbClose.focus();
    }
    function close() {
      lb.classList.remove('open');
      document.body.style.overflow = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    lbClose.addEventListener('click', close);
    lb.querySelector('.lb-prev').addEventListener('click', function () { step(-1); });
    lb.querySelector('.lb-next').addEventListener('click', function () { step(1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });

    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === 'Tab') {
        /* focus trap */
        var f = Array.prototype.filter.call(
          lb.querySelectorAll('button:not([hidden])'),
          function (el) { return el.offsetParent !== null; });
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    /* Triggers: the gallery's expand button and any standalone media */
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-lightbox]');
      if (!btn) return;
      e.preventDefault();
      var gal = btn.closest('[data-gallery]');
      if (gal && gal._items) { open(gal._items(), gal._index()); return; }
      var fig = btn.closest('figure') || btn.parentElement;
      var img = fig && fig.querySelector('img');
      if (!img) return;
      var title = fig.querySelector('figcaption b');
      open([{
        src: img.currentSrc || img.src,
        alt: img.alt,
        title: title ? title.textContent.trim() : img.alt,
        text: ''
      }], 0);
    });
  }

  /* ── Locale / theme comparison ──────────────────────── */
  var cmp = document.querySelector('[data-compare]');
  if (cmp) {
    var img = cmp.querySelector('[data-compare-img]');
    var tag = cmp.querySelector('[data-compare-tag]');
    var state = { lang: 'en', theme: 'dark' };
    /* Sources live on the element so a screenshot swap that rewrites the HTML
       updates them too — the filenames are never duplicated in this file. */
    var LABEL = {
      'en-dark': 'English (LTR) · Dark',
      'en-light': 'English (LTR) · Light',
      'ar-dark': 'العربية (RTL) · Dark',
      'ar-light': 'العربية (RTL) · Light'
    };

    function apply() {
      var key = state.lang + '-' + state.theme;
      var src = cmp.getAttribute('data-src-' + key);
      if (!src || !img) return;
      img.src = src;
      img.alt = 'EGHR dashboard schematic — ' + LABEL[key].replace(/·/g, 'in') + ' theme';
      if (tag) tag.textContent = LABEL[key];
    }

    cmp.querySelectorAll('[data-set]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var parts = btn.dataset.set.split(':');
        state[parts[0]] = parts[1];
        btn.parentElement.querySelectorAll('button').forEach(function (b) {
          b.setAttribute('aria-pressed', String(b === btn));
        });
        apply();
      });
    });
    apply();
  }

  /* ── Active section in the page nav ─────────────────── */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('[data-sec-link]'));
  if (navLinks.length && 'IntersectionObserver' in window) {
    var secs = navLinks
      .map(function (a) { return document.querySelector(a.getAttribute('href')); })
      .filter(Boolean);
    var secObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        navLinks.forEach(function (a) {
          a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    secs.forEach(function (s) { secObs.observe(s); });
  }

  /* Keep the gallery in sync when crossing the mobile breakpoint */
  if (mobile.addEventListener) {
    mobile.addEventListener('change', function () {
      document.querySelectorAll('[data-gallery]').forEach(function (g) {
        if (g._index) g._index(g._index());
      });
    });
  }
}());
