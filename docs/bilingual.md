# Bilingual (العربية / English) — how it works

The portfolio ships in Arabic and English. Both languages are first-class:
the same markup, the same layout engine, the same journeys. Arabic is not a
translated copy of the site — it is the same site rendered under `dir="rtl"`.

---

## 1. The moving parts

| File | Role |
| --- | --- |
| `assets/js/i18n.js` | The engine. Detects, stores and applies the language; exposes `window.MG.i18n`. |
| `assets/i18n/en.js`, `assets/i18n/ar.js` | Site-wide dictionaries (207 keys each). |
| `assets/i18n/eghr-en.js`, `assets/i18n/eghr-ar.js` | Case-study dictionaries (373 keys each). Loaded **only** by `projects/eghr.html`. |
| `assets/css/rtl.css` | The language switch, plus the handful of rules that cannot be expressed logically. |

Dictionaries are plain `<script>` files loaded **blocking, in `<head>`, before
the stylesheets**. That is deliberate: there is no `fetch`, so there is no
moment where English text is painted and then replaced. The cost is 12.4 KB
gzipped on the homepage and a further 16.3 KB on the case study.

## 2. Marking something up for translation

```html
<!-- text content -->
<h2 data-i18n="work.title">Real systems I've built and shipped</h2>

<!-- an attribute (or several, semicolon separated) -->
<button data-i18n-attr="aria-label:a11y.switchAr" aria-label="التبديل إلى العربية">
```

The English text stays in the HTML. It is the fallback if a key is missing and
it keeps the page readable with JavaScript disabled.

**A key may never sit on an element that also contains an `<svg>`**, because a
plain-text value would replace the icon. Put the key on an inner `<span>`:

```html
<a class="btn"><svg class="ic">…</svg> <span data-i18n="cta.startProject">Start a Project</span></a>
```

A value containing `<em> <br> <b> <strong> <span> <i>` is applied as HTML;
anything else is applied as text. That is what lets a heading keep its accent
span across both languages.

## 3. Cards built from JSON

`assets/data/projects.json` and `companies.json` carry parallel Arabic fields
on the same record (`"title"` / `"title_ar"`), not separate files — so a record
can never drift out of sync with its translation. `data-loader.js` picks the
field with `L(obj, 'title')` and rebuilds the cards on `mg:langchange`.

## 4. Anything painted by JavaScript must redraw

`i18n.js` dispatches `mg:langchange` on every switch **and once on first boot**
(`detail.initial === true`). The initial dispatch exists because
`case-study.js` paints its gallery captions before i18n's `DOMContentLoaded`
pass would reach them. Listeners that already render on their own — such as
`data-loader.js` — must ignore the initial event, or they rebuild their DOM and
throw away the reveal state it was just given.

Gallery captions read their text through live getters rather than snapshotting
it at init, so a redraw picks up the current language.

## 5. RTL is layout, not a mirrored stylesheet

`rtl.css` is ~130 lines. It is small because the layout mirrors itself:

- **Logical properties everywhere.** `margin-inline-start`, `padding-inline-end`,
  `border-inline-start`, `inset-inline-start`, `text-align: start`. These
  resolve to the physical side in LTR, so converting a rule is provably
  side-effect free in English — verified by comparing every box's geometry
  against the previous commit (0 boxes moved, identical page heights).
- **Flex and grid already follow `dir`.** No row needs reversing by hand.

What `rtl.css` *does* hold is the residue — the things that cannot be logical:

- Directional **glyphs** (`transform: scaleX(-1)` on arrow icons), with a
  `[data-noflip]` opt-out so a *down* arrow is left alone.
- Hover nudges, which should follow the reading direction.
- The marquee, which runs the other way.
- Physical shorthands with no logical equivalent — `inset: a b c d` on the hero
  plate, and the two corner brackets, which are mirrored explicitly.
- Arabic typography: a Kufi/Naskh display face (Fraunces has no Arabic
  coverage), a taller line-height, no italics (a Latin convention) and no
  uppercase/letter-spacing (meaningless in Arabic).

### One trap worth knowing

`inset-inline-*` resolves against **the element's own `direction`**, not the
page's. An absolutely positioned box carrying `dir="ltr"` will therefore refuse
to mirror. The fix is to move `dir="ltr"` onto an inner span so the *box*
follows the page and only the *text* stays LTR — which is what `.hv-chip` does.

## 6. What must stay left-to-right

Email, phone, URLs, code literals, version ranges and numerals read LTR in any
language. They are marked `dir="ltr"` in the markup, with `unicode-bidi: isolate`
so they cannot drag neighbouring punctuation around. Arabic copy keeps product
names in Latin (Odoo, Python, PostgreSQL, QWeb, REST, GitLab) and translates
everything around them.

One string is intentionally untranslated: the literal `dir="rtl"` inside a
`<code>` element.

## 7. Detection and persistence

1. A stored preference (`localStorage['mg-lang']`) always wins.
2. Otherwise `navigator.languages` is consulted, and Arabic is chosen **only**
   when a preference *starts with* `ar`. There is no geographic guessing.
3. Otherwise English.

The switch is labelled `العربية` and `English` — each language in its own
script, never the word "Arabic".

## 8. Verification

Run against a local static server on `:8777`.

| Check | Result |
| --- | --- |
| i18n functional (lang/dir, switch, persistence, reload, detection) | 18/18 pass |
| Logical-property resolution, both directions | 22/22 pass |
| Bilingual responsive sweep — 8 viewports × 2 pages × 2 languages | 0 overflow, 0 overlap/clip, 0 console errors |
| Arabic coverage (untranslated strings in the rendered Arabic DOM) | 1 — the `dir="rtl"` code literal |
| Dictionary parity | 580 / 580 keys, no empty values |
| English geometry vs. previous commit | 0 boxes moved, page heights identical |
| Icon sizes | 110 instances, 0 out of range, 0 over 40 px |
| Scroll performance | 0 dropped frames, 0 idle rAF callbacks |

### Adding a language

Add `assets/i18n/<lang>.js` assigning into `window.MG_I18N.<lang>`, add the code
to `SUPPORTED` in `i18n.js`, and set `RTL[<lang>] = true` if it reads
right-to-left. For JSON-driven cards, add `<field>_<lang>` to each record.
Nothing else changes.

> **After editing any CSS or JS, run `python3 scripts/version_assets.py`.**
> Stylesheet filenames are stable, so cache busting is done with a content
> hash in the query string. The script exits non-zero if it misses a link.
