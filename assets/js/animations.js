/* =========================================================
   animations.js — scroll-reveal, counters, navbar
   ========================================================= */

(function () {
  'use strict';

  /* ── Navbar scroll class ──────────────────────────────── */
  const navbar = document.getElementById('navbar');
  const backTop = document.getElementById('back-top');

  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
    backTop.classList.toggle('visible', window.scrollY > 400);
    highlightNav();
  }, { passive: true });

  backTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  /* ── Active nav link ──────────────────────────────────── */
  function highlightNav() {
    const sections  = document.querySelectorAll('section[id], div[id="stats-bar"]');
    const navLinks  = document.querySelectorAll('.nav-links a[data-section]');
    let current = '';
    sections.forEach(s => {
      if (window.scrollY >= s.offsetTop - 130) current = s.id;
    });
    navLinks.forEach(a => {
      const on = a.dataset.section === current;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
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
      let current  = 0;
      const step   = Math.max(1, Math.ceil(target / 40));
      const timer  = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = current + suffix;
        if (current >= target) clearInterval(timer);
      }, 30);
      countObserver.unobserve(el);
    }),
    { threshold: 0.5 }
  );

  document.querySelectorAll('[data-count]').forEach(el => countObserver.observe(el));

  /* ── Smooth scroll for anchor links ──────────────────── */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });

}());
