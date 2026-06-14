/* =========================================================
   config.js — site-wide configuration
   Loaded first; sets window.Portfolio namespace.
   ========================================================= */

window.Portfolio = {

  profile: {
    name:       'Mohamed Gamal',
    title:      'Senior Odoo Developer',
    subtitle:   'ERP Software Developer',
    experience: '3+ Years',
    location:   'Cairo, Egypt',
    email:      'mohammedgamal37l30@gmail.com',
    phone1:     '+201102672347',
    phone2:     '+201016843962',
    whatsapp:   'https://wa.me/201102672347',
    linkedin:   'https://www.linkedin.com/in/mohamedgamal37l30',
    github:     'https://github.com/mohamedgamal-attia',
    cv:         '0_Mohamed_Gamal_CV.pdf',
    photo:      'my_img.png',
    headline:   'Building scalable ERP systems, custom Odoo modules, and business workflows for real estate, engineering, and digital transformation companies across Egypt, Saudi Arabia, and the USA.',
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
    { href: '#featured',   label: 'ERP Systems' },
    { href: '#work',       label: 'Work & Context' },
    { href: '#experience', label: 'Experience' },
    { href: '#contact',    label: 'Contact' },
  ],

  filterTabs: [
    { filter: 'all',                label: 'All' },
    { filter: 'erp-systems',        label: 'ERP Systems' },
    { filter: 'odoo-work',          label: 'Odoo Work' },
    { filter: 'real-estate-erp',    label: 'Real Estate ERP' },
    { filter: 'engineering-erp',    label: 'Engineering ERP' },
    { filter: 'digital-transformation', label: 'Digital Transformation' },
    { filter: 'public-context',     label: 'Public Company Context' },
  ],

  dataFiles: {
    profile:    'assets/data/profile.json',
    companies:  'assets/data/companies.json',
    caseStudies:'assets/data/case-studies.json',
    projects:   'assets/data/projects.json',
    sources:    'assets/data/sources.json',
  },

};
