/* =========================================================
   hero.js — layered pointer depth for the hero composition
   Each child of [data-depth] is pushed to its own Z plane, so
   moving the pointer parallaxes the plate, portrait, chip and
   flagship card by different amounts instead of tilting one
   flat image. Pointer-driven only; skipped for coarse
   pointers and prefers-reduced-motion.
   ========================================================= */

(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(pointer: fine)').matches;
  var scene = document.getElementById('hero-portrait');
  var hero = document.getElementById('hero');
  if (!scene || !hero) return;

  var layers = Array.prototype.slice.call(scene.querySelectorAll('[data-depth]'));

  /* Static depth is applied even without motion: the composition is
     built from stacked planes, so the Z offsets are layout, not animation. */
  layers.forEach(function (el) {
    el.style.transform = 'translateZ(' + (parseFloat(el.dataset.depth) || 0) + 'px)';
  });

  if (!fine || reduce) return;

  var MAX = 5;            /* degrees — kept under the nausea threshold */
  var targetX = 0, targetY = 0, curX = 0, curY = 0, raf = null;

  function onMove(e) {
    var r = hero.getBoundingClientRect();
    targetY = ((e.clientX - r.left) / r.width - 0.5) * 2 * MAX;
    targetX = -((e.clientY - r.top) / r.height - 0.5) * 2 * MAX;
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function tick() {
    curX += (targetX - curX) * 0.085;
    curY += (targetY - curY) * 0.085;
    scene.style.transform = 'rotateX(' + curX.toFixed(2) + 'deg) rotateY(' + curY.toFixed(2) + 'deg)';
    if (Math.abs(targetX - curX) > 0.01 || Math.abs(targetY - curY) > 0.01) {
      raf = requestAnimationFrame(tick);
    } else {
      raf = null;
    }
  }

  hero.addEventListener('mousemove', onMove);
  hero.addEventListener('mouseleave', function () {
    targetX = targetY = 0;
    if (!raf) raf = requestAnimationFrame(tick);
  });
}());
