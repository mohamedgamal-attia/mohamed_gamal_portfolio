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
    navLinks.forEach(a => a.classList.toggle('active', a.dataset.section === current));
  }

  /* ── Mobile menu ──────────────────────────────────────── */
  const hamburger  = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');

  hamburger.addEventListener('click', () => {
    const open = mobileMenu.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', open);
  });
  document.querySelectorAll('.mobile-menu a').forEach(a => {
    a.addEventListener('click', () => mobileMenu.classList.remove('open'));
  });

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
