# Portfolio Review — October 2026

Audit of the deployed portfolio at commit `b78cdac` (branch `main`), performed before any
edits in this pass. Measurements come from `qa/performance_before.json`, captured with
Playwright against a local static server; see `docs/performance_review.md` for method.

Status key: **OPEN** (found, not yet fixed) · **FIXED** · **WON'T FIX** (with reason) ·
**BLOCKED** (needs something outside this environment).

---

## Measured baseline

| Page / viewport | Dropped frames in a 3 s scroll (>20 ms) | Worst frame | Idle rAF callbacks / 2 s | Long tasks >50 ms | Transfer |
|---|---|---|---|---|---|
| homepage @1440 | **60 / 115** | **67 ms** | **154** | 5 | 902 KB |
| homepage @390  | 0 / 181 | 17 ms | 120 | 2 | 810 KB |
| eghr-case @1440 | 0 / 182 | 17 ms | 0 | 2 | 830 KB |
| eghr-case @390  | 0 / 182 | 17 ms | 0 | 2 | 830 KB |

The case-study page is the control: same CSS, same scroll, no hero canvas and no custom
cursor, and it drops **zero** frames. More than half the frames of a plain homepage scroll
on desktop are late, and 154 animation-frame callbacks are scheduled during two seconds of
complete idleness. The jank is caused by the hero decoration, not by page length.

---

## Findings

| ID | Area | Problem | Why it matters | Minimal fix | Files | Status | Evidence |
|---|---|---|---|---|---|---|---|
| P1 | Performance | `cursor.js` runs an unconditional `requestAnimationFrame` loop that never exits — it re-schedules itself forever, with no idle, visibility or motion guard. | Burns a frame callback every 16 ms for the life of the page and competes with scrolling. The single largest contributor to the 154 idle callbacks. | Delete the custom-cursor feature outright. | `assets/js/cursor.js`, `assets/css/cursor.css` | FIXED | 154 idle rAF/2 s on homepage vs 0 on the case study |
| P2 | Performance | `animations.js` calls `highlightNav()` on every `scroll` event; it runs `querySelectorAll` and reads `offsetTop` on every section each time. | `offsetTop` forces synchronous layout, so every scroll event triggers a full reflow — textbook scroll jank. | Replace with one `IntersectionObserver`; drop the scroll handler to a `classList.toggle` on cached nodes. | `assets/js/animations.js` | FIXED | 60/115 dropped frames; worst frame 67 ms |
| P3 | Performance | `particles.js` draws an O(n²) link mesh (up to 70 nodes ⇒ ~2 400 distance tests per frame) and runs on touch devices; it pauses off-screen but not on `document.hidden`. | Continuous canvas work on the critical path, including on phones where it cannot be interacted with at all. | Gate on `(pointer: fine)`, pause on `visibilitychange`, cut node count and link radius. | `assets/js/particles.js` | FIXED | 120 idle rAF/2 s at 390 px, where the effect is not reachable |
| P4 | Performance | `tilt.js` attaches a `mousemove` tilt to every project, company and value card. | Per-card pointer handlers across the page; brief §41 asks for interactive 3D on the hero and selected work only. | Restrict to opt-in `[data-tilt]` elements. | `assets/js/tilt.js` | FIXED | 11 handler attachments on the homepage |
| P5 | Performance | `carousels.js` autoplays via `setInterval`. | A timer mutating transforms forever; brief §57 forbids autoplay. | Remove autoplay; keep scroll-snap and buttons. | `assets/js/carousels.js` | FIXED | `setInterval(... interval)` at line 118 |
| P6 | Performance | 13 `backdrop-filter: blur()` declarations, several on full-width sticky surfaces. | Backdrop blur re-rasterises on scroll; on large surfaces it is one of the most expensive paint operations available. | Keep blur only on the small sticky nav and modal scrims; make the rest opaque. | `assets/css/*.css` | FIXED | grep count = 13 |
| P7 | Performance | 8 font faces requested (Fraunces 500/600/700 variable + Inter 400/500/600/700/800). | ~400 KB of font payload for weights the design does not use. | Fraunces 600 + Inter 400/600/700. | `index.html`, `projects/eghr.html` | FIXED | `bytes.other` = 400 KB |
| P8 | Performance | Whole Font Awesome stylesheet loaded from a CDN for 24 icons. | A ~110 KB render-blocking stylesheet plus webfont files and an extra origin, for a handful of glyphs. | Replace with an inline SVG sprite built from the 24 icons actually used. | `index.html`, `projects/eghr.html`, `assets/js/*` | FIXED | 24 distinct `fa-*` classes in use |
| P9 | Performance | No `content-visibility` on long below-fold sections. | The browser lays out and paints the entire page up front. | `content-visibility: auto` with `contain-intrinsic-size` on below-fold sections. | `assets/css/base.css` | FIXED | 996 DOM nodes, all laid out at load |
| C1 | Content / facts | Odoo versions shown as **14–19**. | Factually out of date. | Change to 14–20 everywhere. | `index.html`, `assets/js/config.js` | FIXED | 4 occurrences |
| C2 | Content / facts | Experience shown as **3+ years**. | Factually out of date. | Change to 4+ everywhere. | `index.html`, `assets/js/config.js`, `assets/data/profile.json` | FIXED | 5 occurrences |
| C3 | Positioning | Title is "Senior Odoo Developer & ERP Software Engineer"; hero copy and meta describe Odoo work only. | Reads as Odoo-only and hides web, backend, integration and data work. | "Senior Software Engineer & Odoo / ERP Specialist" plus broader hero copy and metadata. | `index.html`, `assets/js/config.js`, `assets/data/profile.json`, `README.md` | FIXED | title string in 6 places |
| E1 | EGHR dominance | EGHR occupies a card on the hero portrait (`.hv-flag`, "Flagship case study"). | The hero must present Mohamed, not one client project. | Remove the card; keep a neutral credential chip. | `index.html`, `assets/css/sections.css` | FIXED | `index.html:199` |
| E2 | EGHR dominance | "EGHR Case Study" sits in the primary nav and the mobile menu. | Primary nav is portfolio-level; a project does not belong there. | Remove both; EGHR is reached through Work. | `index.html` | FIXED | `index.html:105`, `:124` |
| E3 | EGHR dominance | Work heading reads "Seven real projects. One flagship."; EGHR is labelled "Flagship case study". | Elevates one project to the portfolio's identity. | Neutral heading; identical "View Case Study" affordance for every project. | `index.html`, `assets/js/data-loader.js`, `assets/data/projects.json` | FIXED | `index.html:254` |
| B1 | Branding | Generated covers for Margins, DOTec, EjadTech and EJAD Digital were retinted to the portfolio plum/gold palette in the previous pass. | Erases each client's identity and makes every card look the same. | Per-project accent palettes driven by data; regenerate covers. | `scripts/generate_project_visuals.py`, `assets/data/projects.json` | FIXED | 5 of 7 covers share one palette |
| B2 | Branding | EGHR screens were retinted from teal/cyan to plum/gold. | EJAD's product is teal; brief §52 requires real EJAD colour. | Restore the teal-based product palette. | `scripts/generate_eghr_visuals.py` | FIXED | `git show f0e7890` shows `acc="#0e7490"` before the retint |
| B3 | Branding | DOTec's real logo is `#001ad3` (strong blue) but its cover was plum/gold. | Contradicts the real mark on the same card. | Use the sampled logo colour as DOTec's accent. | `assets/data/projects.json` | FIXED | pixel-sampled from `dotec-logo.png` |
| B4 | Branding | `ejad-digital-logo.png` is white ink (no non-white opaque pixels); it needs a dark plate to be visible at all. | A white logo on a light plate is an empty box. | Keep a neutral dark plate — recorded as a contrast plate, not as brand colour. | `assets/css/sections.css`, `assets/data/sources.json` | FIXED | 28 328 opaque pixels, none outside near-white |
| B5 | Branding | `margins-logo.svg` is a generated placeholder, not Margins' real mark. | Presenting it as a real logo would be misleading. | Keep it, label it a placeholder in `sources.json`, and do not claim its colours as brand colours. | `assets/data/sources.json`, `docs/portfolio_review_2026_10.md` | FIXED | `sources.json` records `generated-svg-placeholder` |
| S1 | Structure | 10 homepage sections, of which Services, Skills, Companies, Project Context and Experience overlap conceptually. | Long scroll, repeated claims, weak hierarchy. | Merge to 6: Hero, Selected Work, What I Build, Experience & Delivery, How I Work, Contact. | `index.html` | FIXED | see "Section decisions" below |
| S2 | Structure | The About section repeats the portrait at large size. | The hero already carries the photo; this is pure page length. | Drop the second portrait; keep a compact editorial block. | `index.html` | FIXED | `index.html:421` |
| S3 | Structure | "How I Work" is a full-height five-step section. | Costs a screen of scroll for five short labels. | One compact horizontal timeline; vertical on mobile. | `index.html`, `assets/css/sections.css` | FIXED | `index.html:376` |
| S4 | Structure | Work filters are ERP-only ("ERP Systems", "Odoo Delivery", "Digital Delivery"). | Hides the non-Odoo engineering work. | Categories across ERP, portals/web, software, data and automation — only those with real projects. | `assets/js/config.js`, `assets/data/projects.json` | FIXED | `config.js:38` |
| A1 | Accessibility | Nav active state was driven by scroll position only. | With the scroll handler replaced, `aria-current` must come from the observer. | Set `aria-current` from the IntersectionObserver. | `assets/js/animations.js` | FIXED | — |
| M1 | Media | EGHR case-study media are schematic SVGs, not screenshots of the running portal. | Brief requires real screenshots; they are correctly labelled as schematics, but they are not evidence. | Run `scripts/capture_eghr_screenshots.py` on the Windows host that has the portal. | `assets/images/projects/eghr/*` | BLOCKED | the Windows host holding the source, config, database and running instance is not reachable from this container |
| T1 | Tooling | The brief names skills `UI UX Pro Max`, `frontenddesign`, `odoo-development`, `caveman`, `mcp-builder`. | Only `code-review` (and Playwright, as a library) exist in this session. | Use `code-review` and Playwright; do the design work directly. | — | WON'T FIX | session skill list contains none of the other five |

---

## Defects found by code review of this pass

The change was reviewed before commit. These are bugs introduced *by this pass*, each
verified against the running page or the committed output before fixing.

| ID | Problem | How it was confirmed | Fix |
|---|---|---|---|
| R1 | `content-visibility: auto` broke in-page anchors on a cold load — a jump to `#contact` landed 207 px short, because sections below the fold still occupied their `contain-intrinsic-size` placeholder. | Scripted: cold load, click nav link, measure the target's offset. | `animations.js` realises those sections around a jump (`.anchor-jump`), then releases; `contain-intrinsic-size: auto` makes the browser remember real sizes thereafter. All 6 targets now land at 0 px, at 1440 and 390. |
| R2 | The per-project accent hairline never painted. `.project-card` sets `border` as a shorthand in `project-showcase.css`, which loads *after* `sections.css`, so an equal-specificity `border-top` there was silently reset. | Computed `borderTopColor` per card in the browser. | Accent rules moved into `project-showcase.css`, after the shorthand. Verified: all 7 cards paint their own accent. |
| R3 | `brand_cover()` never called `set_theme()`, so all three real-logo covers inherited whichever project was themed last — every one came out in DOTec blue. | Colour-counted the committed SVGs: all three carried `#262e4e`. | `set_theme(accent)` added. EJAD covers are now teal (`#1f3b3d`), DOTec blue (`#262e4e`). |
| R4 | EjadTech's cover was generated with DOTec blue *and* the literal `#7c414c` — the old portfolio plum this pass bans from client covers. EJAD Digital's used the generic government green. | Read the generator call sites. | Both now use the EJAD teal, matching the provenance table. |
| R5 | `data-tilt` on the hero portrait made `tilt.js` add `.tilt-3d`, whose `transition: transform` eased `hero.js`'s per-frame writes — the exact conflict a comment in `sections.css` warns against — plus a duplicate pointer handler. | Read both code paths. | `data-tilt` removed from the hero; `hero.js` owns that interaction alone. |
| R6 | `carousels.js` and `carousels.css` were still loaded on both pages after the experience carousel became a CSS scroll-snap list; no `[data-carousel]` markup survives. | Grepped both pages for the markup the script binds to. | Both removed from both pages. |
| R7 | The architecture legend swatch stayed on `--accent-mauve` after the layer it labels moved to `--on-dark-mauve`, so the legend no longer matched the diagram. | Compared legend swatches with layer `--c` values. | Swatch aligned. |
| R8 | `set_theme()` was inserted above two functions' docstrings, silently turning them into dead expressions and leaving the functions with no `__doc__`. | Read the generator. | Docstrings restored above the call. |
| R9 | A one-off `perf.mjs` run reported 64/115 dropped frames, which looked like a regression. | Six back-to-back runs of the same scroll gave 2-5 of ~178. | No code change: the outlier was container CPU contention. Recorded in `docs/performance_review.md` rather than quietly dropped. |

Two review observations were checked and found **not** to be defects: the EjadTech logo
rendering as a broken image in one screenshot (a lazy-load decode artifact of the capture
script — `naturalWidth` is 256 and no request fails), and 383 apparent contrast failures
(the measuring tool read only `backgroundColor`, which is transparent for the gradient
backgrounds the dark sections use).

---

## Section decisions (§53)

| Current section | Decision | Where it goes |
|---|---|---|
| Hero | KEEP, rewrite | Person, positioning, CTAs; EGHR card removed |
| Stack marquee | KEEP, compact | Below hero, versions corrected |
| Selected Work | KEEP, re-rank | Moves up; equal case-study affordance per project |
| Services ("Hire me for the whole problem") | MERGE | → **What I Build** |
| Skills ("What is actually in my hands") | MERGE | → **What I Build** |
| How I Work | KEEP, compact | Horizontal timeline |
| About | MERGE, shrink | → **Experience & Delivery**, second portrait dropped |
| Companies | MERGE | → **Experience & Delivery** as a logo row |
| Project Context | MOVE TO CASE STUDY | Per-project context belongs on project pages |
| Experience | MERGE | → **Experience & Delivery** timeline |
| Contact | KEEP, widen | Lists all six service areas |

Result: 10 homepage sections → 6.

---

## Logo QA (§59)

| Project | Logo source | Original colours preserved? | Contrast plate needed? | Status |
|---|---|---|---|---|
| EJAD EGHR | `ejad-digital-logo.png` — real, from ejad.sa | Yes — untouched | Yes: the file is white ink, invisible on a light surface | OK, neutral dark plate |
| EJAD Digital | `ejad-digital-logo.png` — real | Yes — untouched | Yes, same file | OK, neutral dark plate |
| DOTec | `dotec-logo.png` — real, from dotecengineering.com | Yes — untouched; `#001ad3` sampled for the card accent only | No | OK |
| EjadTech | `ejadtech-logo.png` — real, from the EjadTech Odoo backend | Yes — untouched | Mono `#cccccc` artwork; needs a dark surface | OK, neutral dark plate |
| Margins | `margins-logo.svg` — **generated placeholder**, real mark not publicly reachable | N/A — not a real logo | No | Labelled placeholder in `sources.json` |
| Sunbelt Deals | Real site screenshot | Yes — unmodified capture | No | OK |
| BlueDez | Real site screenshot | Yes — unmodified capture | No | OK |

No logo is recoloured anywhere. Where a plate is used it is a neutral contrast surface, and it
is recorded as such — it is not presented as the project's brand colour.

---

## One figure worth a second look

The brief states the experience figure as **4+ years** and instructs that "3+ years" must
not remain anywhere, so that is what the site now says everywhere.

It is worth flagging that it does not reconcile with the page's own timeline: the earliest
entry shown is ExploreAI Academy, Jun 2023, which is about 3 years 4 months to October 2026.
Either the figure counts experience that predates the entries on the page, or the timeline is
missing an earlier role. Nothing was invented to close the gap and no entry was altered — if
there is an earlier role, adding it to the timeline in `index.html` would make the two agree.

## Not verifiable in this environment

- **EJAD's exact brand hex values.** `ejad.sa` is blocked by this container's network policy
  (`connect_rejected`). The EGHR palette is restored to the teal it used before the previous
  pass retinted it, which matches the brief's description of EJAD as teal/red. It is not
  claimed as a sampled brand value.
- **Real EGHR screenshots** — see M1. The capture script reads its target from the
  environment (`EGHR_URL`), so no local path, port, database name or credential is recorded
  in this repository.
- **Lighthouse** is not installed and the npm registry route for it is not available; the
  Playwright measurements in `qa/` are the substitute, and are reported as what they are.
