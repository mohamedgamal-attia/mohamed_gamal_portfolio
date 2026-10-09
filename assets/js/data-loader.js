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

    /* A compact logo + role row, not a grid of full cards: the detail that used
       to live on each card is now in the timeline directly below it. */
    grid.innerHTML = companies.map(c => `
      <div class="co-chip fade-up">
        <span class="co-plate">
          <img src="${escapeHTML(c.logo)}" alt="${escapeHTML(c.name)} logo"
               width="120" height="40" loading="lazy" decoding="async"
               onerror="this.src='${escapeHTML(c.logoFallback || 'assets/images/companies/' + c.slug + '-placeholder.svg')}'" />
        </span>
        <span class="co-text">
          <b>${escapeHTML(c.name)}</b>
          <i>${escapeHTML(c.role)} · ${escapeHTML(c.country)}</i>
        </span>
      </div>`).join('');

    if (P.observeFadeUps) P.observeFadeUps();
  }

  /* ── Project cards ───────────────────────────────────
     Every project renders the same way and gets the same
     "View Case Study" affordance. No project is promoted to a
     feature block: the composition varies by card size, which
     comes from the data, not from ranking one project above
     the others. */
  function renderProjects(allProjects) {
    const grid = document.getElementById('projects-grid');
    if (!grid || !allProjects) return;

    if (P.setProjectsData) P.setProjectsData(allProjects);

    grid.innerHTML = allProjects.map((p, i) => {
      const cover      = p.cover || p.image;
      const badge      = p.typeLabel || TYPE_BADGE[p.type] || '';
      /* Projects with their own page become real links; the rest open the modal. */
      const href       = p.caseStudyUrl;
      const ctaLabel   = p.caseStudyLabel || 'Case Study';
      const galleryN   = Array.isArray(p.gallery) ? p.gallery.length : 0;
      const galleryHint = galleryN > 1
        ? `<span class="card-gallery-hint"><svg class="ic" aria-hidden="true"><use href="#i-images"/></svg> ${galleryN}</span>` : '';
      const subN = (p.subProjects || []).length;
      const subHint = subN ? `<span class="card-sub-hint">+${subN} context</span>` : '';
      const size = p.size || 'medium';

      /* Never nest an anchor inside a card that is itself a link. */
      const sourceBtn = (p.sourceUrl && !href)
        ? `<a href="${escapeHTML(p.sourceUrl)}" target="_blank" rel="noopener" class="card-source" title="Official source" onclick="event.stopPropagation()">
             <svg class="ic" aria-hidden="true"><use href="#i-arrow-up-right-from-square"/></svg></a>` : '';

      /* The project's own accent rides on the card as custom properties.
         It paints hairlines, the small type line and the arrow — never a
         filter or overlay over the screenshot itself. */
      const brand = [
        p.accent       ? `--pj-accent:${p.accent}` : '',
        p.accentOnDark ? `--pj-on-dark:${p.accentOnDark}` : '',
        p.accentSoft   ? `--pj-accent-soft:${p.accentSoft}` : '',
      ].filter(Boolean).join(';');
      const styleAttr = brand ? ` style="${escapeHTML(brand)}"` : '';

      const tag  = href ? 'a' : 'article';
      const open = href
        ? `<a class="project-card card-${size} fade-up ${i ? 'fade-up-delay-' + Math.min(i,3) : ''}"
              href="${escapeHTML(href)}"${styleAttr}
              data-categories="${escapeHTML((p.categories||[]).join(','))}"
              data-type="${escapeHTML(p.type||'')}"
              aria-label="Open the ${escapeHTML(p.title)} case study">`
        : `<article class="project-card card-${size} fade-up ${i ? 'fade-up-delay-' + Math.min(i,3) : ''}"${styleAttr}
              data-categories="${escapeHTML((p.categories||[]).join(','))}"
              data-type="${escapeHTML(p.type||'')}" data-modal="${escapeHTML(p.id)}"
              tabindex="0" role="button" aria-label="View case study: ${escapeHTML(p.title)}">`;

      return `
        ${open}
          <div class="project-card-img">
            <img src="${escapeHTML(cover)}" alt="${escapeHTML(p.title)} cover" loading="lazy"
                 onerror="this.src='assets/images/placeholders/generic.svg'" />
            <div class="project-card-scrim"></div>
            ${badge ? `<span class="card-type-badge ${escapeHTML(p.type||'')}">${escapeHTML(badge)}</span>` : ''}
            ${galleryHint}
            <div class="project-card-overlay">
              <span class="overlay-cta">${escapeHTML(ctaLabel)} <svg class="ic" aria-hidden="true"><use href="#i-arrow-right"/></svg></span>
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
            <span class="project-card-cta">${escapeHTML(ctaLabel)} <svg class="ic" aria-hidden="true"><use href="#i-arrow-right"/></svg></span>
            ${sourceBtn}
          </div>
        </${tag}>`;
    }).join('');

    if (P.initFilters) P.initFilters();
    if (P.observeFadeUps) P.observeFadeUps();

    renderContext(allProjects);
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
          <button class="context-open" data-modal="${escapeHTML(p.id)}">Case study <svg class="ic" aria-hidden="true"><use href="#i-arrow-right"/></svg></button>
        </div>
        <div class="context-chips">
          ${(p.subProjects || []).map(s => {
            const inner = `<span class="chip-name">${escapeHTML(s.name)}</span>${s.sub ? `<span class="chip-sub">${escapeHTML(s.sub)}</span>` : ''}`;
            return s.sourceUrl
              ? `<a class="context-chip" href="${escapeHTML(s.sourceUrl)}" target="_blank" rel="noopener">${inner}<svg class="ic" aria-hidden="true"><use href="#i-arrow-up-right-from-square"/></svg></a>`
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
