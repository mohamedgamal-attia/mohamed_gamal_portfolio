/* =========================================================
   cursor.js — spring-follow custom cursor (desktop only)
   ========================================================= */
(function () {
  'use strict';

  const fine   = window.matchMedia('(pointer: fine)').matches;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || reduce) return;

  const html = document.documentElement;
  const dot  = document.createElement('div');
  const ring = document.createElement('div');
  dot.id = 'cursor-dot';
  ring.id = 'cursor-ring';
  document.body.appendChild(dot);
  document.body.appendChild(ring);

  let mx = window.innerWidth / 2, my = window.innerHeight / 2;
  let rx = mx, ry = my;          // ring position (lagged)
  let ready = false;

  window.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
    if (!ready) {
      ready = true;
      // Hide the native cursor only once ours is ready to draw — avoids a
      // brief "no cursor" state between load and the first pointer move.
      html.classList.add('has-custom-cursor', 'cursor-ready');
    }
  }, { passive: true });

  window.addEventListener('mousedown', () => html.classList.add('cursor-down'));
  window.addEventListener('mouseup',   () => html.classList.remove('cursor-down'));
  window.addEventListener('mouseleave',() => html.classList.remove('cursor-ready'));
  window.addEventListener('mouseenter',() => html.classList.add('cursor-ready'));

  /* Spring follow for the ring */
  function loop() {
    rx += (mx - rx) * 0.18;
    ry += (my - ry) * 0.18;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* Hover state on interactive elements (delegated) */
  const interactiveSel = 'a, button, .btn, .project-card, .company-card, .cta-card, .value-card, .filter-tab, .skill-group, [data-magnetic], .modal-thumb, .gallery-nav';
  document.addEventListener('mouseover', e => {
    if (e.target.closest(interactiveSel)) html.classList.add('cursor-hover');
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest(interactiveSel) &&
        !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(interactiveSel))) {
      html.classList.remove('cursor-hover');
    }
  });
}());
