/* =========================================================
   data-loader.js — fetches JSON and renders company cards
                    and project cards into the DOM
   ========================================================= */

(function () {
  'use strict';

  const P = window.Portfolio || {};

  /* ── Generic JSON fetch ─────────────────────────────── */
  function loadJSON(url) {
    return fetch(url)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(err => { console.warn('[Portfolio] Could not load', url, err); return null; });
  }

  /* ── Render Company Cards ───────────────────────────── */
  function renderCompanies(companies) {
    const grid = document.getElementById('companies-grid');
    if (!grid || !companies) return;

    grid.innerHTML = companies.map((c, i) => `
      <div class="company-card company-${c.slug} fade-up ${i > 0 ? 'fade-up-delay-' + Math.min(i, 3) : ''}">
        <div class="company-card-top">
          <div class="company-logo-wrap">
            <img src="${c.logo}" alt="${c.name} logo"
                 onerror="this.src='${c.logoFallback || 'assets/images/companies/' + c.slug + '-placeholder.svg'}'" />
          </div>
          <div class="company-meta">
            <div class="company-name">${c.name}</div>
            <div class="company-country">
              <i class="fa-solid fa-location-dot"></i> ${c.country}
            </div>
          </div>
        </div>
        <div class="company-industry">${c.industry}</div>
        <div class="company-role"><i class="fa-solid fa-user-tie"></i> ${c.role}</div>
        <p class="company-desc">${c.description}</p>
        <div class="company-card-footer">
          <a href="#work" class="btn btn-outline-white btn-sm">
            <i class="fa-solid fa-briefcase"></i> View Work
          </a>
          ${c.website ? `<a href="${c.website}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Website
          </a>` : ''}
        </div>
      </div>
    `).join('');

    if (P.observeFadeUps) P.observeFadeUps();
  }

  /* ── Render Project Cards ───────────────────────────── */
  function renderProjects(projects) {
    const grid = document.getElementById('projects-grid');
    if (!grid || !projects) return;

    /* Pass data to modals.js */
    if (P.setProjectsData) P.setProjectsData(projects);

    grid.innerHTML = projects.map(p => {
      const typeBadgeMap = {
        'erp-system':    { cls: 'erp-system',    label: 'Full ERP Build' },
        'odoo-work':     { cls: 'odoo-work',      label: 'Odoo Work' },
        'public-context':{ cls: 'public-context', label: 'Company Context' },
      };
      const tb = typeBadgeMap[p.type] || {};

      const tagHtml = (p.tags || []).slice(0, 3).map(t => `<span class="project-tag">${t}</span>`).join('');
      const catStr  = (p.categories || []).join(',');

      const sourceBtn = p.sourceUrl
        ? `<a href="${p.sourceUrl}" target="_blank" rel="noopener" class="project-card-link" title="View official source">
             Source <i class="fa-solid fa-arrow-up-right-from-square"></i>
           </a>`
        : `<span class="project-card-link" data-modal="${p.id}" style="cursor:pointer">
             Details <i class="fa-solid fa-arrow-right"></i>
           </span>`;

      return `
        <div class="project-card fade-up" data-categories="${catStr}" data-type="${p.type || ''}" data-modal="${p.id}">
          <div class="project-card-img">
            <img src="${p.image}" alt="${p.title}" loading="lazy"
                 onerror="this.src='assets/images/placeholders/generic.svg'" />
            ${tb.label ? `<span class="card-type-badge ${tb.cls}">${tb.label}</span>` : ''}
          </div>
          <div class="project-card-body">
            <div class="project-card-company">${p.company} · ${p.country}</div>
            <h4>${p.title}</h4>
            <p>${p.cardDesc || p.description.substring(0, 110) + '…'}</p>
            <div class="project-card-tags">${tagHtml}</div>
          </div>
          <div class="project-card-footer">
            <span class="project-card-sector">${p.sectorLabel || p.sector}</span>
            ${sourceBtn}
          </div>
        </div>
      `;
    }).join('');

    /* Init filters after cards are rendered */
    if (P.initFilters) P.initFilters();
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

  /* Run after DOM is ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.Portfolio = P;
  P.loadJSON = loadJSON;

}());
