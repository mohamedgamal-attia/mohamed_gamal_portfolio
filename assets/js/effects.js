/* =========================================================
   effects.js — futuristic micro-interactions
   scroll progress · magnetic buttons ·
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

  /* The professional title is deliberately fixed — one claim, not a
     carousel of competing ones. (Rotator removed.) */

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

  /* ── Hero background parallax ─────────────────────────
     The portrait composition itself is driven by hero.js, which
     gives each layer its own Z plane; this only moves the
     background rules behind it. */
  const hero = document.getElementById('hero');
  const parallaxEls = hero ? [...hero.querySelectorAll('[data-parallax]')] : [];

  if (hero && parallaxEls.length) {
    hero.addEventListener('mousemove', e => {
      const r = hero.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      parallaxEls.forEach(el => {
        const s = parseFloat(el.dataset.parallax) || 0;
        el.style.transform = `translate3d(${px * s * 110}px, ${py * s * 110}px, 0)`;
      });
    });
    hero.addEventListener('mouseleave', () => {
      parallaxEls.forEach(el => { el.style.transform = ''; });
    });
  }

  /* Cursor-follow glow (--mx/--my) is handled by tilt.js, which binds the
     same card set — avoids a second mousemove pass over the same elements. */

}());
