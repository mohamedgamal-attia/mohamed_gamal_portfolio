/* =========================================================
   config.js — site-wide configuration
   Loaded first; sets window.Portfolio namespace.
   ========================================================= */

window.Portfolio = {

  profile: {
    name:       'Mohamed Gamal',
    title:      'Odoo Techno-Functional Consultant & Developer',
    subtitle:   'Senior Odoo Developer · AI & Data Analyst',
    experience: '3+ Years',
    location:   'Cairo, Egypt',
    email:      'mohammedgamal37l30@gmail.com',
    phone1:     '+201102672347',
    whatsapp:   'https://wa.me/201102672347',
    linkedin:   'https://www.linkedin.com/in/mohamedgamal37l30',
    github:     'https://github.com/mohamedgamal-attia',
    cv:         '0_Mohamed_Gamal_CV.pdf',
    photo:      'my_img.png',
    headline:   'I turn business requirements into production-grade Odoo Enterprise systems — custom modules, workflows, REST integrations and training — powered by Python, PostgreSQL and Applied AI.',
    odooVersions: ['Odoo 14', 'Odoo 15', 'Odoo 16', 'Odoo 17', 'Odoo 18', 'Odoo 19'],
  },

  stats: [
    { value: 4,    suffix: '',  label: 'Companies',       display: '4' },
    { value: 3,    suffix: '+', label: 'Years Experience', display: '3+' },
    { value: null, suffix: '',  label: 'Odoo Versions',    display: '14–19' },
    { value: 4,    suffix: '',  label: 'Business Domains', display: '4' },
  ],

  navItems: [
    { href: '#about',      label: 'About' },
    { href: '#skills',     label: 'Skills' },
    { href: '#companies',  label: 'Companies' },
    { href: '#work',       label: 'Work' },
    { href: '#context',    label: 'Context' },
    { href: '#experience', label: 'Experience' },
    { href: '#contact',    label: 'Contact' },
  ],

  filterTabs: [
    { filter: 'all',              label: 'All' },
    { filter: 'erp-systems',      label: 'ERP Systems' },
    { filter: 'odoo-delivery',    label: 'Odoo Delivery' },
    { filter: 'digital-delivery', label: 'Digital Delivery' },
  ],

  dataFiles: {
    profile:    'assets/data/profile.json',
    companies:  'assets/data/companies.json',
    caseStudies:'assets/data/case-studies.json',
    projects:   'assets/data/projects.json',
    sources:    'assets/data/sources.json',
  },

};
