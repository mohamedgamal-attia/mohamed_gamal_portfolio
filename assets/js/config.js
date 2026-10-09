/* =========================================================
   config.js — site-wide configuration
   Loaded first; sets window.Portfolio namespace.
   ========================================================= */

window.Portfolio = {

  profile: {
    name:       'Mohamed Gamal',
    title:      'Senior Software Engineer & Odoo / ERP Specialist',
    subtitle:   'Enterprise systems · Portals & web · Backend, integrations & data',
    experience: '4+ Years',
    location:   'Cairo, Egypt',
    email:      'mohammedgamal37l30@gmail.com',
    phone1:     '+201102672347',
    whatsapp:   'https://wa.me/201102672347',
    linkedin:   'https://www.linkedin.com/in/mohamedgamal37l30',
    github:     'https://github.com/mohamedgamal-attia',
    cv:         '0_Mohamed_Gamal_CV.pdf',
    photo:      'assets/images/portrait/mohamed-gamal-728.jpg',
    headline:   'I build software that connects business workflows to reliable systems — from Odoo and ERP platforms to web applications, backend services, integrations, automation and data pipelines.',
    odooVersions: ['Odoo 14', 'Odoo 15', 'Odoo 16', 'Odoo 17', 'Odoo 18', 'Odoo 19', 'Odoo 20'],
  },

  stats: [
    { value: 4,    suffix: '+', label: 'Years Experience', display: '4+' },
    { value: null, suffix: '',  label: 'Odoo Versions',    display: '14–20' },
    { value: null, suffix: '',  label: 'Delivery',         display: 'Enterprise / Web / Data' },
    { value: 3,    suffix: '',  label: 'Countries',        display: '3' },
  ],

  navItems: [
    { href: '#work',       label: 'Work' },
    { href: '#services',   label: 'Services' },
    { href: '#experience', label: 'Experience' },
    { href: '#contact',    label: 'Contact' },
  ],

  /* §43 — only categories with real projects behind them. There is no
     data-engineering PROJECT card, so there is no data-engineering filter;
     that work is surfaced in What I Build and in the experience timeline. */
  filterTabs: [
    { filter: 'all',             label: 'All' },
    { filter: 'odoo-erp',        label: 'Odoo & ERP' },
    { filter: 'portals-web',     label: 'Portals / Web' },
    { filter: 'integrations',    label: 'Integrations / Automation' },
    { filter: 'digital-content', label: 'Digital & Content' },
  ],

  dataFiles: {
    profile:    'assets/data/profile.json',
    companies:  'assets/data/companies.json',
    caseStudies:'assets/data/case-studies.json',
    projects:   'assets/data/projects.json',
    sources:    'assets/data/sources.json',
  },

};
