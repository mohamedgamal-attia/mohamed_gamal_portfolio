/* =========================================================
   effects.js — futuristic micro-interactions
   scroll progress · particles · magnetic buttons ·
   hero tilt/parallax · card cursor-glow · role rotator
   All effects respect prefers-reduced-motion.
   ========================================================= */

(function () {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine   = window.matchMedia('(pointer: fine)').matches;

  /* ── Scroll progress bar ──────────────────────────────── */
  const bar = document.getElementById('scroll-progress');
  if (bar) {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── Role rotator (subtle) ────────────────────────────── */
  const roleEl = document.getElementById('hero-role-typed');
  if (roleEl && !reduce) {
    const roles = [
      'Odoo Techno-Functional Consultant & Developer',
      'Senior Odoo Enterprise Developer',
      'ERP Solution Designer & Trainer',
      'AI & Data Analyst',
    ];
    let idx = 0;
    setInterval(() => {
      idx = (idx + 1) % roles.length;
      roleEl.style.opacity = '0';
      roleEl.style.transform = 'translateY(6px)';
      setTimeout(() => {
        roleEl.textContent = roles[idx];
        roleEl.style.opacity = '1';
        roleEl.style.transform = 'none';
      }, 320);
    }, 2800);
    roleEl.style.transition = 'opacity .32s ease, transform .32s ease';
  }

  if (!fine || reduce) return; /* remaining effects are pointer/motion driven */

  /* ── Magnetic buttons ─────────────────────────────────── */
  document.querySelectorAll('[data-magnetic]').forEach(el => {
    const strength = 0.35;
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
    });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });
  });

  /* ── Hero portrait tilt + layered mouse parallax ──────── */
  const portrait = document.getElementById('hero-portrait');
  const hero = document.getElementById('hero');
  const parallaxEls = hero ? [...hero.querySelectorAll('[data-parallax]')] : [];

  if (hero) {
    hero.addEventListener('mousemove', e => {
      const r = hero.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;

      if (portrait) {
        portrait.style.transform =
          `rotateY(${px * 8}deg) rotateX(${-py * 8}deg) translateZ(0)`;
      }
      // depth parallax: move layers by mouse offset * speed
      parallaxEls.forEach(el => {
        const s = parseFloat(el.dataset.parallax) || 0;
        el.style.transform = `translate3d(${px * s * 90}px, ${py * s * 90}px, 0)`;
      });
    });
    hero.addEventListener('mouseleave', () => {
      if (portrait) portrait.style.transform = '';
      parallaxEls.forEach(el => { el.style.transform = ''; });
    });
  }

  /* Cursor-follow glow (--mx/--my) is handled by tilt.js, which binds the
     same card set — avoids a second mousemove pass over the same elements. */

}());
