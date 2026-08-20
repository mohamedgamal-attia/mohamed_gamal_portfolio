# Mohamed Gamal — Senior Odoo Developer Portfolio

A professional portfolio website for **Mohamed Gamal**, Senior Odoo Developer & ERP Software Developer.

---

## Run Locally

```bash
cd /path/to/my_portfolio
python3 -m http.server 8000
# Open http://localhost:8000 in your browser
```

> **Important:** This site uses `@import` in CSS and `fetch()` for JSON — it requires an HTTP server. Opening `index.html` directly via `file://` will not work.

---

## Project Structure

```
my_portfolio/
├── index.html                    # Main page (no hardcoded project/company cards)
├── my_img.png                    # Personal photo
├── 0_Mohamed_Gamal_CV.pdf        # Downloadable CV
│
├── assets/
│   ├── css/
│   │   ├── style.css             # Entry point (@import only)
│   │   ├── variables.css         # CSS custom properties (colors, shadows, radii)
│   │   ├── base.css              # Reset, body, typography
│   │   ├── layout.css            # Container, grid helpers, section padding
│   │   ├── components.css        # Buttons, badges, navbar, modal, form, skeleton
│   │   ├── sections.css          # Hero, stats, about, skills, companies, work, etc.
│   │   └── responsive.css        # All @media queries
│   │
│   ├── js/
│   │   ├── config.js             # window.Portfolio namespace, profile, filterTabs, dataFiles
│   │   ├── animations.js         # Navbar scroll, back-to-top, fade-up, counter animation
│   │   ├── modals.js             # Project detail modal (event-delegated, works on dynamic cards)
│   │   ├── filters.js            # Filter tab logic (called by data-loader after render)
│   │   ├── data-loader.js        # fetch() JSON → render company cards + project cards
│   │   └── main.js               # Entry point: WhatsApp link injection, smooth scroll
│   │
│   ├── data/
│   │   ├── profile.json          # Personal info, skills, Odoo versions
│   │   ├── companies.json        # 4 companies with logos, roles, descriptions
│   │   ├── case-studies.json     # 4 featured ERP case studies (used by featured section)
│   │   ├── projects.json         # All 25 project cards (type, categories, roleNote, sourceUrl)
│   │   └── sources.json          # Image asset provenance (type, source, notes)
│   │
│   └── images/
│       ├── companies/
│       │   ├── ejadtech-logo.png         # Real PNG logo
│       │   ├── ejad-digital-logo.png     # Real PNG logo
│       │   ├── margins-logo.svg          # Premium SVG placeholder (real logo unavailable)
│       │   └── dotec-logo.png            # Real PNG logo
│       └── projects/
│           ├── *.svg                     # Premium generated SVG illustrations (ERP projects)
│           ├── bluedez/                  # BlueDez content-pack images (real project assets)
│           │   ├── bluedez-cover.png
│           │   └── bluedez-screenshot-1..3.png
│           └── sunbelt/                  # Sunbelt website asset-pack images (real project assets)
│               ├── sunbelt-cover.webp
│               ├── sunbelt-screenshot-1.webp
│               ├── sunbelt-screenshot-2..3.jpg
│               └── sunbelt-logo.png
│
└── scripts/
    ├── download_assets.py        # Try to download real company logos from official URLs
    └── validate_project.py       # Pre-flight validation (JSON, images, no ext src, server)
```

---

## How to Edit Content

### Personal Info
Edit `assets/data/profile.json`. Changes apply to `config.js` (which references the same data) and to sections rendered from JS.

To also update the hardcoded contact section in `index.html`, search for the `#contact` section and update the anchor tags there directly.

### Companies
Edit `assets/data/companies.json`. The company cards section (`#companies`) is fully rendered by `data-loader.js` — no HTML editing needed.

Each company object:
```json
{
  "slug": "ejadtech",
  "name": "EjadTech",
  "country": "Saudi Arabia",
  "industry": "Digital Transformation · Government IT",
  "role": "Odoo Developer",
  "logo": "assets/images/companies/ejadtech-logo.png",
  "logoFallback": "assets/images/companies/ejadtech-placeholder.svg",
  "website": "https://ejadtech.sa/",
  "description": "..."
}
```

### Project Cards
Edit `assets/data/projects.json`. The `#work` grid is fully rendered by `data-loader.js`.

Key fields per project:
| Field | Purpose |
|-------|---------|
| `id` | Used as the `data-modal` trigger key |
| `type` | `"erp-system"` / `"odoo-work"` / `"public-context"` / `"website-project"` / `"content-project"` — drives badge and border styling |
| `categories` | Array of filter keys (e.g., `["erp-systems", "real-estate-erp"]`) |
| `roleNote` | Shown in modal for `public-context` cards as a blue callout |
| `sourceUrl` | Enables "View Official Source" button in modal |
| `sourceLinkLabel` | Label for the source button |
| `cardDesc` | Short description shown on the card (120 chars max) |
| `sectorLabel` | Sector emoji + label shown in card footer |

### Featured Case Studies
Edit `assets/data/case-studies.json`. These populate the `#featured` section cards (currently hardcoded in HTML for richer layout). To make featured cards dynamic too, update `data-loader.js` with a `renderCaseStudies()` function.

### Filter Tabs
The filter tab categories and labels are defined in `assets/js/config.js` under `filterTabs`. The HTML filter buttons in `index.html` (`#work` section) must match these values in `data-filter` attributes.

Current categories:
- `all` — All projects
- `erp-systems` — Complete ERP builds (Margins, DOTec)
- `odoo-work` — Odoo contributor work (EjadTech, EJAD Digital)
- `real-estate-erp` — Real estate domain
- `engineering-erp` — Engineering domain
- `digital-transformation` — KSA digital transformation
- `public-context` — Company reference context cards
- `digital-delivery` — Website & digital delivery projects (Sunbelt, BlueDez)
- `web-projects` — Website / frontend projects (Sunbelt)
- `content-projects` — Content & branding projects (BlueDez)

### Styles
- Global tokens (colors, shadows, spacing): `assets/css/variables.css`
- Layout helpers: `assets/css/layout.css`
- All components (buttons, modal, form, badges): `assets/css/components.css`
- Per-section styles: `assets/css/sections.css`
- Mobile breakpoints: `assets/css/responsive.css`
- Do not edit `style.css` — it only contains 6 `@import` lines.

---

## Project Types & Honesty Model

The portfolio uses explicit project types to be transparent about the nature of each listing:

| Type | Meaning | Visual |
|------|---------|--------|
| `erp-system` | Complete Odoo ERP system built from scratch by me | Gold badge "Full ERP Build" |
| `odoo-work` | Odoo/ERP backend contributor on company client projects | Blue badge "Odoo Work" |
| `public-context` | Company's public projects shown as **business domain context only** — my direct role was building the internal ERP, not these projects | Dashed border, grey badge, role note in modal |
| `website-project` | Website / frontend / digital delivery work — **not** an ERP build (Sunbelt Deals website asset curation) | Green badge "Website & Frontend" |
| `content-project` | Content design / branding delivery — **not** an ERP build (BlueDez engineering content pack) | Purple badge "Content & Branding" |

A disclaimer banner at the top of `#work` explains this to visitors. Odoo/ERP remains the core identity; the website and content projects are listed honestly as additional digital-delivery work.

### Recent Digital Projects (BlueDez & Sunbelt)

Two non-ERP projects are included in the `#work` grid and filterable via **Website & Digital Delivery**, **Web Projects**, and **Content & Branding** tabs:

| Project | id | Type | Images |
|---------|----|------|--------|
| Sunbelt Deals – Website Image & Asset Curation | `sunbelt-website-assets` | `website-project` | `assets/images/projects/sunbelt/` |
| BlueDez – Engineering Blog Content Pack | `bluedez-content-pack` | `content-project` | `assets/images/projects/bluedez/` |

**To edit their text:** open `assets/data/projects.json` and edit the first two objects (`sunbelt-website-assets`, `bluedez-content-pack`).

**To replace their screenshots later:** drop a new image into the matching folder above and either reuse the existing filename (e.g. `sunbelt-cover.webp`, `bluedez-cover.png`) or update the `image` field in `projects.json`. Keep card/cover images roughly 16:9 (the card thumbnail is `object-fit: cover`, 160px tall). After replacing, add/adjust the provenance entry in `assets/data/sources.json` and re-run the validator.

> Original source packs live in `~/Downloads/BlueDez_Blog_Content_Pack` and `~/Downloads/Sunbelt_Website_Asset_Pack` (untouched — the portfolio only holds copied, web-optimized selections).

---

## Scripts

### Validate project integrity
```bash
python3 scripts/validate_project.py
```
Checks: JSON parse, image paths, no external img src, required files, local server.

### Re-download company logos
```bash
python3 scripts/download_assets.py
```
Tries all known official logo URLs. Falls back gracefully to existing files if download fails.

---

## Deploy to GitHub Pages

1. Push the repo to GitHub
2. Go to **Settings → Pages → Source: main branch / root**
3. Your portfolio will be live at `https://YOUR_USERNAME.github.io/REPO_NAME/`

No build step needed — everything is static HTML/CSS/JS with relative paths.

---

## Contact Info (Summary)

| Field | Value |
|-------|-------|
| Email | mohammedgamal37l30@gmail.com |
| Phone 1 | 01102672347 (tel:+201102672347) |
| WhatsApp | https://wa.me/201102672347 |
| LinkedIn | https://www.linkedin.com/in/mohamedgamal37l30 |
| GitHub | https://github.com/mohamedgamal-attia |
| Location | Cairo, Egypt |
