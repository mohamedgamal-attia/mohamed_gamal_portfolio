/* =========================================================
   particles.js — lightweight connected-dot canvas network
   Renders into #hero-canvas. Reacts to mouse. Disabled on
   reduced-motion; throttled/omitted on small screens.
   ========================================================= */
(function () {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.getElementById('hero-canvas');
  if (!canvas || reduce) return;

  const ctx = canvas.getContext('2d');
  let w, h, dpr, particles = [], raf = null, running = true;
  const mouse = { x: -9999, y: -9999 };

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    w = r.width; h = r.height;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seed() {
    const count = Math.min(70, Math.round((w * h) / 16000));
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.6 + 0.6,
      });
    }
  }

  function step() {
    if (!running) return;
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;

      // mouse attraction
      const dxm = mouse.x - p.x, dym = mouse.y - p.y;
      const dm2 = dxm * dxm + dym * dym;
      if (dm2 < 26000) { p.x += dxm * 0.0009; p.y += dym * 0.0009; }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(103, 232, 249, 0.65)';
      ctx.fill();

      for (let j = i + 1; j < particles.length; j++) {
        const q = particles[j];
        const dx = p.x - q.x, dy = p.y - q.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 15000) {
          const a = (1 - d2 / 15000) * 0.35;
          ctx.strokeStyle = `rgba(90, 150, 240, ${a})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        }
      }
    }
    raf = requestAnimationFrame(step);
  }

  const hero = document.getElementById('hero');
  (hero || window).addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
  }, { passive: true });
  (hero || window).addEventListener('mouseleave', () => { mouse.x = mouse.y = -9999; });

  window.addEventListener('resize', () => { size(); seed(); });

  // Pause when hero scrolled out of view (perf)
  if ('IntersectionObserver' in window && hero) {
    new IntersectionObserver(es => {
      es.forEach(e => {
        running = e.isIntersecting;
        if (running && !raf) { raf = requestAnimationFrame(step); }
        else if (!running && raf) { cancelAnimationFrame(raf); raf = null; }
      });
    }, { threshold: 0 }).observe(hero);
  }

  size(); seed(); step();
}());
