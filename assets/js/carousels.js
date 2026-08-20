/* =========================================================
   carousels.js — reusable auto-carousel with manual control
   Native scroll-snap track (free mobile swipe) + pointer drag,
   autoplay w/ pause-on-hover/focus, arrows, dots, keyboard,
   and center-active emphasis. Respects prefers-reduced-motion.

   Markup:
     <div class="carousel" data-carousel data-carousel-auto="3500">
       <button class="carousel-arrow prev">‹</button>
       <div class="carousel-track">
         <div class="carousel-slide">…</div> …
       </div>
       <button class="carousel-arrow next">›</button>
       <div class="carousel-dots"></div>
     </div>
   ========================================================= */
(function () {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init(root) {
    (root || document).querySelectorAll('[data-carousel]').forEach(setup);
  }

  function setup(el) {
    if (el._carousel) return;
    el._carousel = true;

    const track = el.querySelector('.carousel-track');
    const slides = [...el.querySelectorAll('.carousel-slide')];
    const prev = el.querySelector('.carousel-arrow.prev');
    const next = el.querySelector('.carousel-arrow.next');
    const dotsWrap = el.querySelector('.carousel-dots');
    if (!track || !slides.length) return;

    const interval = parseInt(el.dataset.carouselAuto, 10) || 4000;
    let timer = null, paused = false;

    const step = () => {
      const s = slides[0];
      const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 0;
      return s.getBoundingClientRect().width + gap;
    };
    const atEnd = () => track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;

    function go(dir) {
      if (dir > 0 && atEnd()) track.scrollTo({ left: 0, behavior: 'smooth' });
      else track.scrollBy({ left: dir * step(), behavior: 'smooth' });
    }

    /* Dots — one per slide */
    if (dotsWrap) {
      dotsWrap.innerHTML = slides.map((_, i) =>
        `<button class="carousel-dot" aria-label="Go to item ${i + 1}" data-i="${i}"></button>`).join('');
    }
    const dots = dotsWrap ? [...dotsWrap.children] : [];

    function activeIndex() {
      const center = track.scrollLeft + track.clientWidth / 2;
      let best = 0, bestD = Infinity;
      slides.forEach((s, i) => {
        const c = s.offsetLeft + s.offsetWidth / 2;
        const d = Math.abs(c - center);
        if (d < bestD) { bestD = d; best = i; }
      });
      return best;
    }
    function syncActive() {
      const a = activeIndex();
      slides.forEach((s, i) => s.classList.toggle('is-active', i === a));
      dots.forEach((d, i) => d.classList.toggle('active', i === a));
    }

    prev && prev.addEventListener('click', () => { go(-1); restart(); });
    next && next.addEventListener('click', () => { go(1); restart(); });
    dots.forEach(d => d.addEventListener('click', () => {
      const s = slides[+d.dataset.i];
      track.scrollTo({ left: s.offsetLeft - (track.clientWidth - s.offsetWidth) / 2, behavior: 'smooth' });
      restart();
    }));

    let raf = null;
    track.addEventListener('scroll', () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { syncActive(); raf = null; });
    }, { passive: true });

    /* Pointer drag (desktop) */
    let down = false, startX = 0, startScroll = 0, moved = false;
    track.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') {
        down = true; moved = false; startX = e.clientX; startScroll = track.scrollLeft;
        track.classList.add('dragging');
      }
    });
    window.addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      track.scrollLeft = startScroll - dx;
    });
    window.addEventListener('pointerup', () => {
      if (down) { down = false; track.classList.remove('dragging'); restart(); }
    });
    /* Prevent click after a drag */
    track.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);

    /* Keyboard */
    el.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') { go(-1); restart(); }
      else if (e.key === 'ArrowRight') { go(1); restart(); }
    });

    /* Autoplay + pause */
    function start() {
      if (reduce || timer) return;
      timer = setInterval(() => { if (!paused) go(1); }, interval);
    }
    function stop() { clearInterval(timer); timer = null; }
    function restart() { stop(); start(); }

    ['mouseenter', 'focusin', 'pointerdown'].forEach(ev => el.addEventListener(ev, () => { paused = true; }));
    ['mouseleave', 'focusout'].forEach(ev => el.addEventListener(ev, () => { paused = false; }));
    window.addEventListener('pointerup', () => { paused = false; });

    /* Pause when off-screen */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => es.forEach(e => {
        if (e.isIntersecting) start(); else stop();
      }), { threshold: 0 }).observe(el);
    } else start();

    syncActive();
  }

  window.Portfolio = window.Portfolio || {};
  window.Portfolio.initCarousels = init;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init());
  else init();
}());
