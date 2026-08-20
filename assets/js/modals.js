/* =========================================================
   modals.js — tabbed case-study modal with image gallery
   Tabs: Overview · Visuals · Scope · Context · Impact
   ========================================================= */

(function () {
  'use strict';

  const overlay  = document.getElementById('modal-overlay');
  const closeBtn = document.getElementById('modal-close');
  if (!overlay) return;

  const esc = (window.Portfolio && window.Portfolio.escapeHTML) || (s => String(s == null ? '' : s));
  let allProjects = [];
  let gImgs = [], gIdx = 0;

  window.Portfolio = window.Portfolio || {};
  window.Portfolio.setProjectsData = d => { allProjects = d; };

  const $ = id => document.getElementById(id);
  function setText(id, v) { const e = $(id); if (e) e.textContent = v || ''; }
  function pills(arr, cls) {
    return (arr || []).map(t => `<span class="${cls}">${esc(t)}</span>`).join('');
  }

  /* ── Open ───────────────────────────────────────────── */
  function openModal(id) {
    const p = allProjects.find(x => x.id === id);
    if (!p) return;

    const cover = p.cover || p.image;
    setText('m-company', `${p.company} · ${p.country}`);
    setText('m-title', p.title);
    const badge = $('m-type'); if (badge) badge.textContent = p.typeLabel || '';
    const img = $('m-img'); if (img) { img.src = cover; img.alt = p.title; }

    /* Overview */
    setText('m-role', p.role || '');
    setText('m-overview', p.overview || p.short || '');

    /* Scope */
    const scope = $('m-scope');
    if (scope) scope.innerHTML = pills(p.scope, 'modal-feature');

    /* Impact + tags + source */
    setText('m-impact', p.impact || '');
    const tags = $('m-tags'); if (tags) tags.innerHTML = pills(p.tags, 'modal-tag');
    const src = $('m-source-link');
    if (src) {
      if (p.sourceUrl) {
        src.style.display = '';
        const a = $('m-source-anchor'); if (a) a.href = p.sourceUrl;
        setText('m-source-label', p.sourceLabel || 'View Official Source');
      } else src.style.display = 'none';
    }

    /* Context tab (sub-projects) */
    const ctxTabBtn = document.querySelector('[data-tab="context"]');
    const hasCtx = (p.subProjects || []).length > 0;
    if (ctxTabBtn) ctxTabBtn.style.display = hasCtx ? '' : 'none';
    setText('m-context-note', p.contextNote || '');
    const ctx = $('m-context-list');
    if (ctx) {
      ctx.innerHTML = (p.subProjects || []).map(s => {
        const meta = `<span class="ctx-name">${esc(s.name)}</span>${s.sub ? `<span class="ctx-sub">${esc(s.sub)}</span>` : ''}`;
        return s.sourceUrl
          ? `<a class="modal-ctx-item" href="${esc(s.sourceUrl)}" target="_blank" rel="noopener">${meta}<i class="fa-solid fa-arrow-up-right-from-square"></i></a>`
          : `<div class="modal-ctx-item">${meta}</div>`;
      }).join('');
    }

    setupGallery(p);
    switchTab('overview');

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ── Tabs ───────────────────────────────────────────── */
  function switchTab(name) {
    document.querySelectorAll('.modal-tab').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.tab-panel').forEach(pnl =>
      pnl.classList.toggle('active', pnl.dataset.panel === name));
    const body = document.querySelector('.modal-body');
    if (body) body.scrollTop = 0;
  }
  document.querySelectorAll('.modal-tab').forEach(b =>
    b.addEventListener('click', () => switchTab(b.dataset.tab)));

  /* ── Gallery ────────────────────────────────────────── */
  function setupGallery(p) {
    const thumbs = $('m-gallery-thumbs');
    gImgs = Array.isArray(p.gallery) ? p.gallery.slice() : [];
    if (!gImgs.length && (p.cover || p.image)) gImgs = [p.cover || p.image];
    gIdx = 0;

    if (thumbs) {
      thumbs.innerHTML = gImgs.length > 1 ? gImgs.map((s, i) =>
        `<button class="modal-thumb${i === 0 ? ' active' : ''}" data-gidx="${i}">
           <img src="${esc(s)}" alt="View ${i + 1}" loading="lazy"></button>`).join('') : '';
    }
    const nav = document.querySelectorAll('.gallery-nav');
    nav.forEach(n => n.style.display = gImgs.length > 1 ? '' : 'none');
    renderGallery();
  }
  function renderGallery() {
    const main = $('m-gallery-img'), count = $('m-gallery-count');
    if (!main || !gImgs.length) return;
    main.src = gImgs[gIdx]; main.alt = 'Project view ' + (gIdx + 1);
    if (count) count.textContent = (gIdx + 1) + ' / ' + gImgs.length;
    document.querySelectorAll('#m-gallery-thumbs .modal-thumb').forEach(t =>
      t.classList.toggle('active', +t.dataset.gidx === gIdx));
  }
  function gStep(d) { if (gImgs.length) { gIdx = (gIdx + d + gImgs.length) % gImgs.length; renderGallery(); } }

  $('m-gallery-prev')?.addEventListener('click', e => { e.stopPropagation(); gStep(-1); });
  $('m-gallery-next')?.addEventListener('click', e => { e.stopPropagation(); gStep(1); });
  $('m-gallery-thumbs')?.addEventListener('click', e => {
    const t = e.target.closest('.modal-thumb'); if (t) { gIdx = +t.dataset.gidx; renderGallery(); }
  });

  /* ── Bindings ───────────────────────────────────────── */
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', e => {
    if (!overlay.classList.contains('open')) return;
    if (e.key === 'Escape') closeModal();
    else if (e.key === 'ArrowLeft'  && gImgs.length > 1 && document.querySelector('[data-panel="gallery"].active')) gStep(-1);
    else if (e.key === 'ArrowRight' && gImgs.length > 1 && document.querySelector('[data-panel="gallery"].active')) gStep(1);
  });

  /* Open from any [data-modal] trigger (cards, context buttons) */
  document.addEventListener('click', e => {
    if (e.target.closest('a[href]')) return;      // let real links navigate
    const t = e.target.closest('[data-modal]');
    if (t) openModal(t.dataset.modal);
  });
  document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && document.activeElement?.dataset?.modal) {
      e.preventDefault(); openModal(document.activeElement.dataset.modal);
    }
  });

  window.Portfolio.openModal = openModal;
}());
