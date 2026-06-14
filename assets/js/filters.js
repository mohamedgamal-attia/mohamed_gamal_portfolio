/* =========================================================
   filters.js — project filter tabs
   ========================================================= */

(function () {
  'use strict';

  function initFilters() {
    const tabs  = document.querySelectorAll('.filter-tab');
    const cards = document.querySelectorAll('.project-card');
    if (!tabs.length || !cards.length) return;

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const filter = tab.dataset.filter;
        let visible = 0;

        cards.forEach(card => {
          const cats = (card.dataset.categories || '').split(',');
          const show = filter === 'all' || cats.includes(filter);
          card.classList.toggle('hidden', !show);
          if (show) visible++;
        });

        // Show/hide no-results message
        const noResults = document.getElementById('no-results-msg');
        if (noResults) noResults.style.display = visible === 0 ? 'block' : 'none';
      });
    });
  }

  window.Portfolio = window.Portfolio || {};
  window.Portfolio.initFilters = initFilters;

}());
