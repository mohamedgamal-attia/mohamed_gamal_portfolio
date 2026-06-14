/* =========================================================
   modals.js — project detail modal
   ========================================================= */

(function () {
  'use strict';

  const overlay = document.getElementById('modal-overlay');
  const closeBtn = document.getElementById('modal-close');
  if (!overlay) return;

  let allProjects = [];

  /* Store data loaded by data-loader.js */
  window.Portfolio = window.Portfolio || {};
  window.Portfolio.setProjectsData = function (data) { allProjects = data; };

  /* ── Open modal ─────────────────────────────────────── */
  function openModal(id) {
    const p = allProjects.find(x => x.id === id);
    if (!p) return;

    setText('m-company', p.company + ' · ' + p.country);
    setText('m-title',   p.title);
    setText('m-sector',  p.sector);
    setText('m-desc',    p.description);
    setText('m-role',    p.role);
    setText('m-impact',  p.impact);

    // Role note (shown for public-context cards)
    const roleNoteEl = document.getElementById('m-role-note');
    if (roleNoteEl) {
      roleNoteEl.textContent = p.roleNote || '';
      roleNoteEl.style.display = p.roleNote ? 'block' : 'none';
    }

    // Image
    const img = document.getElementById('m-img');
    if (img) { img.src = p.image; img.alt = p.title; }

    // Features
    buildTagList('m-features', p.features || [], 'modal-feature');

    // Tags
    buildTagList('m-tags', p.tags || [], 'modal-tag');

    // Source link
    const linkWrap = document.getElementById('m-source-link');
    if (linkWrap) {
      if (p.sourceUrl) {
        linkWrap.style.display = '';
        const a = document.getElementById('m-source-anchor');
        const lbl = document.getElementById('m-source-label');
        if (a) a.href = p.sourceUrl;
        if (lbl) lbl.textContent = p.sourceLinkLabel || 'View Official Source';
      } else {
        linkWrap.style.display = 'none';
      }
    }

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '';
  }

  function buildTagList(containerId, items, className) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = items.map(t => `<span class="${className}">${t}</span>`).join('');
  }

  /* ── Event bindings ─────────────────────────────────── */
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  /* Delegate click on any [data-modal] element.
     Skip if the click originated inside an <a> tag — let links navigate normally. */
  document.addEventListener('click', e => {
    if (e.target.closest('a[href]')) return;
    const trigger = e.target.closest('[data-modal]');
    if (trigger) openModal(trigger.dataset.modal);
  });

  window.Portfolio.openModal = openModal;

}());
