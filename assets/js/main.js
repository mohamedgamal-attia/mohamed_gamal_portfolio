/* =========================================================
   main.js — entry point
   Script load order in index.html:
     1. config.js      (window.Portfolio namespace)
     2. animations.js  (navbar, scroll, counters)
     3. data-loader.js (fetch JSON, render cards)
     4. filters.js     (filter tabs — called by data-loader after render)
     5. modals.js      (modal open/close)
     6. main.js        (this file — any orchestration)
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  /* "View Work" smooth-scroll on company cards (delegated) */
  document.getElementById('companies-grid')?.addEventListener('click', e => {
    const link = e.target.closest('a[href="#work"]');
    if (link) {
      e.preventDefault();
      document.getElementById('work')?.scrollIntoView({ behavior: 'smooth' });
    }
  });

  /* WhatsApp float button — clone to ensure numbers are up-to-date from config */
  const cfg = window.Portfolio?.profile;
  if (cfg) {
    document.querySelectorAll('[data-wa-link]').forEach(el => {
      el.href = cfg.whatsapp;
    });
  }

});
