/* =========================================================
   animations.js — scroll-reveal, counters, navbar
   ========================================================= */

(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Navbar scroll class ──────────────────────────────── */
  const navbar = document.getElementById('navbar');
  const backTop = document.getElementById('back-top');

  /* The scroll handler reads only scrollY — a value the compositor already
     has — and never touches layout. The previous version called offsetTop on
     every section on every scroll event, forcing a synchronous reflow per
     frame; that was the page's main source of scroll jank. Section tracking
     now rides an IntersectionObserver instead (see below). */
  let navTicking = false;
  window.addEventListener('scroll', () => {
    if (navTicking) return;
    navTicking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      navbar.classList.toggle('scrolled', y > 50);
      backTop.classList.toggle('visible', y > 400);
      navTicking = false;
    });
  }, { passive: true });

  backTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  /* ── Active nav link, observer-driven ─────────────────── */
  const navLinks = Array.from(document.querySelectorAll('.nav-links a[data-section]'));
  if (navLinks.length) {
    const linkFor = new Map(navLinks.map(a => [a.dataset.section, a]));
    const tracked = Array.from(document.querySelectorAll('section[id]'))
      .filter(s => linkFor.has(s.id));
    /* Keep the set of currently-intersecting sections; the topmost one wins,
       so the highlight behaves the same as the old scroll test without ever
       measuring the document. */
    const onScreen = new Set();
    const setActive = () => {
      let best = null, bestTop = Infinity;
      onScreen.forEach(s => {
        const t = s.getBoundingClientRect().top;
        if (t < bestTop) { bestTop = t; best = s; }
      });
      navLinks.forEach(a => {
        const on = !!best && a.dataset.section === best.id;
        a.classList.toggle('active', on);
        if (on) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    };
    const navObserver = new IntersectionObserver(entries => {
      entries.forEach(e => e.isIntersecting ? onScreen.add(e.target) : onScreen.delete(e.target));
      setActive();
    }, { rootMargin: '-130px 0px -55% 0px', threshold: 0 });
    tracked.forEach(s => navObserver.observe(s));
  }

  /* ── Mobile menu ──────────────────────────────────────── */
  const hamburger  = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');

  function setMenu(open) {
    mobileMenu.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', String(open));
  }
  hamburger.addEventListener('click', () => setMenu(!mobileMenu.classList.contains('open')));
  document.querySelectorAll('.mobile-menu a').forEach(a => {
    a.addEventListener('click', () => setMenu(false));
  });
  /* Escape closes the menu and hands focus back to the toggle */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
      setMenu(false);
      hamburger.focus();
    }
  });
  /* Never leave the overlay open when the desktop nav comes back.
     Guarded: engines without MediaQueryList.addEventListener must not
     abort this IIFE, or the reveal observer below never runs. */
  const desktopMQ = window.matchMedia('(min-width: 769px)');
  const onDesktop = e => { if (e.matches) setMenu(false); };
  if (desktopMQ.addEventListener) desktopMQ.addEventListener('change', onDesktop);
  else if (desktopMQ.addListener) desktopMQ.addListener(onDesktop);

  /* ── Scroll-reveal (IntersectionObserver) ─────────────── */
  const fadeObserver = new IntersectionObserver(
    entries => entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        fadeObserver.unobserve(e.target);
      }
    }),
    { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
  );

  function observeFadeUps() {
    document.querySelectorAll('.fade-up:not(.visible), .reveal:not(.visible), .reveal-left:not(.visible), .reveal-scale:not(.visible)')
      .forEach(el => fadeObserver.observe(el));
  }
  observeFadeUps();

  // Re-observe after dynamic content is injected (called from data-loader)
  window.Portfolio = window.Portfolio || {};
  window.Portfolio.observeFadeUps = observeFadeUps;

  /* ── Animated counters ────────────────────────────────── */
  const countObserver = new IntersectionObserver(
    entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el     = e.target;
      const target = parseInt(el.dataset.count, 10);
      if (isNaN(target)) return;
      const suffix = el.dataset.suffix || '';
      countObserver.unobserve(el);
      if (reduceMotion) { el.textContent = target + suffix; return; }
      /* rAF rather than setInterval: the count rides the frame clock and
         stops the moment it arrives, instead of holding a 30 ms timer. */
      const DUR = 900;
      let t0 = null;
      const tick = now => {
        if (t0 === null) t0 = now;
        const k = Math.min(1, (now - t0) / DUR);
        el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3))) + suffix;
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }),
    { threshold: 0.5 }
  );

  document.querySelectorAll('[data-count]').forEach(el => countObserver.observe(el));

  /* ── Smooth scroll for anchor links ────────────────────
     The below-fold sections carry `content-visibility: auto`, which is worth
     ~14 fewer dropped frames per full-page scroll. The catch: until a section
     has been rendered once, it occupies its `contain-intrinsic-size`
     placeholder rather than its real height, so on a COLD load the offset of
     anything below it is wrong — a jump to #contact landed ~200 px short.

     Realising those sections for the duration of the jump fixes it, and fixes
     it permanently: `contain-intrinsic-size: auto <len>` tells the browser to
     remember each element's real size once it has been rendered, so the class
     can come straight back off without the page shifting. */
  const lazySections = document.querySelectorAll('[data-cv]');
  function withSectionsRealised(fn) {
    if (!lazySections.length) return fn();
    document.documentElement.classList.add('anchor-jump');
    void document.body.offsetHeight;   // flush layout with them realised
    fn();
    // Keep it off until the smooth scroll has settled, then restore.
    setTimeout(() => document.documentElement.classList.remove('anchor-jump'),
               reduceMotion ? 0 : 1200);
  }

  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const href = a.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      withSectionsRealised(() =>
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }));
    });
  });

  /* A deep link (/#contact) lands before the sections below it have been
     rendered, so correct the position once they have been. */
  if (location.hash && location.hash.length > 1) {
    const deep = document.querySelector(location.hash);
    if (deep) {
      requestAnimationFrame(() => withSectionsRealised(() =>
        deep.scrollIntoView({ behavior: 'auto', block: 'start' })));
    }
  }

}());
