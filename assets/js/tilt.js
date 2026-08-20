/* =========================================================
   tilt.js — 3D hover tilt + mouse-tracked glow for cards
   Sets --mx/--my (px) for glow borders and rotateX/Y transforms.
   ========================================================= */
(function () {
  'use strict';

  const fine   = window.matchMedia('(pointer: fine)').matches;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const SEL = '.project-card, .company-card, .featured-card, .value-card, .cta-card, .impact-card, .skill-group';
  const MAX = 7; // deg

  function bind(card) {
    if (card._tilt) return;
    card._tilt = true;
    card.classList.add('tilt-3d');

    if (!fine || reduce) return;

    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      card.style.setProperty('--rx', ((0.5 - py) * MAX).toFixed(2) + 'deg');
      card.style.setProperty('--ry', ((px - 0.5) * MAX).toFixed(2) + 'deg');
    });
    card.addEventListener('mouseleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  }

  function init(root) {
    (root || document).querySelectorAll(SEL).forEach(bind);
  }

  window.Portfolio = window.Portfolio || {};
  window.Portfolio.initTilt = init;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }
}());
