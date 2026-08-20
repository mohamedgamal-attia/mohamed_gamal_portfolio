/* =========================================================
   data-loader.js — renders the 6 canonical project cards,
   the company cards, and the secondary context groups.
   ========================================================= */

(function () {
  'use strict';

  const P = window.Portfolio || {};

  /* ── Helpers ────────────────────────────────────────── */
  function loadJSON(url) {
    return fetch(url)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(err => { console.warn('[Portfolio] Could not load', url, err); return null; });
  }

  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  /* Always render arrays as separated pills — never a raw join('') */
  function pills(arr, cls, max) {
    return (arr || []).slice(0, max || 99)
      .map(t => `<span class="${cls}">${escapeHTML(t)}</span>`).join('');
  }
  P.escapeHTML = escapeHTML;

  const TYPE_BADGE = {
    'erp-system':      'Full ERP Build',
    'odoo-work':       'Odoo Delivery',
    'website-project': 'Website / Frontend',
    'content-project': 'Content / Branding',
  };

  /* ── Company cards ──────────────────────────────────── */
  function renderCompanies(companies) {
    const grid = document.getElementById('companies-grid');
    if (!grid || !companies) return;

    grid.innerHTML = companies.map((c, i) => `
      <div class="company-card company-${c.slug} fade-up ${i > 0 ? 'fade-up-delay-' + Math.min(i, 3) : ''}">
        <div class="company-card-top">
          <div class="company-logo-wrap">
            <img src="${escapeHTML(c.logo)}" alt="${escapeHTML(c.name)} logo"
                 onerror="this.src='${escapeHTML(c.logoFallback || 'assets/images/companies/' + c.slug + '-placeholder.svg')}'" />
          </div>
          <div class="company-meta">
            <div class="company-name">${escapeHTML(c.name)}</div>
            <div class="company-country"><i class="fa-solid fa-location-dot"></i> ${escapeHTML(c.country)}</div>
          </div>
        </div>
        <div class="company-industry">${escapeHTML(c.industry)}</div>
        <div class="company-role"><i class="fa-solid fa-user-tie"></i> ${escapeHTML(c.role)}</div>
        <p class="company-desc">${escapeHTML(c.description)}</p>
        <div class="company-card-footer">
          <a href="#work" class="btn btn-outline-white btn-sm"><i class="fa-solid fa-briefcase"></i> View Work</a>
          ${c.website ? `<a href="${escapeHTML(c.website)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Website</a>` : ''}
        </div>
      </div>`).join('');

    if (P.observeFadeUps) P.observeFadeUps();
    if (P.initTilt) P.initTilt(grid);
  }

  /* ── Project (case-study) cards — the 6 canonical ────── */
  function renderProjects(projects) {
    const grid = document.getElementById('projects-grid');
    if (!grid || !projects) return;

    if (P.setProjectsData) P.setProjectsData(projects);

    grid.innerHTML = projects.map((p, i) => {
      const cover      = p.cover || p.image;
      const badge      = p.typeLabel || TYPE_BADGE[p.type] || '';
      const galleryN   = Array.isArray(p.gallery) ? p.gallery.length : 0;
      const galleryHint = galleryN > 1
        ? `<span class="card-gallery-hint"><i class="fa-solid fa-images"></i> ${galleryN}</span>` : '';
      const subN = (p.subProjects || []).length;
      const subHint = subN ? `<span class="card-sub-hint">+${subN} context</span>` : '';
      const size = p.size || 'medium';

      const sourceBtn = p.sourceUrl
        ? `<a href="${escapeHTML(p.sourceUrl)}" target="_blank" rel="noopener" class="card-source" title="Official source" onclick="event.stopPropagation()">
             <i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : '';

      return `
        <article class="project-card card-${size} fade-up ${i ? 'fade-up-delay-' + Math.min(i,3) : ''}"
                 data-categories="${escapeHTML((p.categories||[]).join(','))}"
                 data-type="${escapeHTML(p.type||'')}" data-modal="${escapeHTML(p.id)}"
                 tabindex="0" role="button" aria-label="View case study: ${escapeHTML(p.title)}">
          <div class="project-card-img">
            <img src="${escapeHTML(cover)}" alt="${escapeHTML(p.title)} cover" loading="lazy"
                 onerror="this.src='assets/images/placeholders/generic.svg'" />
            <div class="project-card-scrim"></div>
            ${badge ? `<span class="card-type-badge ${escapeHTML(p.type||'')}">${escapeHTML(badge)}</span>` : ''}
            ${galleryHint}
            <div class="project-card-overlay">
              <span class="overlay-cta">View Case Study <i class="fa-solid fa-arrow-right"></i></span>
            </div>
          </div>
          <div class="project-card-body">
            <div class="project-card-company">${escapeHTML(p.company)} · ${escapeHTML(p.country)} ${subHint}</div>
            <h3>${escapeHTML(p.title)}</h3>
            <p>${escapeHTML(p.short || '')}</p>
            <div class="project-card-tags">${pills(p.tags, 'tag-pill', 5)}</div>
          </div>
          <div class="project-card-footer">
            <span class="project-card-sector">${escapeHTML(p.sectorLabel || '')}</span>
            <span class="project-card-cta">Case Study <i class="fa-solid fa-arrow-right"></i></span>
            ${sourceBtn}
          </div>
        </article>`;
    }).join('');

    if (P.initFilters) P.initFilters();
    if (P.observeFadeUps) P.observeFadeUps();
    if (P.initTilt) P.initTilt(grid);

    renderContext(projects);
  }

  /* ── Secondary "Project Context & Business Domains" ──── */
  function renderContext(projects) {
    const wrap = document.getElementById('context-grid');
    if (!wrap) return;

    const groups = projects.filter(p => (p.subProjects || []).length);
    if (!groups.length) { wrap.innerHTML = ''; return; }

    wrap.innerHTML = groups.map((p, i) => `
      <div class="context-group reveal ${i ? 'r-d' + Math.min(i,3) : ''}">
        <div class="context-group-head">
          <div>
            <div class="context-group-company">${escapeHTML(p.company)}</div>
            <div class="context-group-sub">${escapeHTML(p.sectorLabel || '')}</div>
          </div>
          <button class="context-open" data-modal="${escapeHTML(p.id)}">Case study <i class="fa-solid fa-arrow-right"></i></button>
        </div>
        <div class="context-chips">
          ${(p.subProjects || []).map(s => {
            const inner = `<span class="chip-name">${escapeHTML(s.name)}</span>${s.sub ? `<span class="chip-sub">${escapeHTML(s.sub)}</span>` : ''}`;
            return s.sourceUrl
              ? `<a class="context-chip" href="${escapeHTML(s.sourceUrl)}" target="_blank" rel="noopener">${inner}<i class="fa-solid fa-arrow-up-right-from-square"></i></a>`
              : `<span class="context-chip">${inner}</span>`;
          }).join('')}
        </div>
      </div>`).join('');

    if (P.observeFadeUps) P.observeFadeUps();
  }

  /* ── Bootstrap ──────────────────────────────────────── */
  function init() {
    const cfg = (P.dataFiles) || {};
    Promise.all([
      loadJSON(cfg.companies || 'assets/data/companies.json'),
      loadJSON(cfg.projects  || 'assets/data/projects.json'),
    ]).then(([companies, projects]) => {
      renderCompanies(companies);
      renderProjects(projects);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.Portfolio = P;
  P.loadJSON = loadJSON;
}());
