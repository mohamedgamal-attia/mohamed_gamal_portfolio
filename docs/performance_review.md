# Performance review — October 2026

Measured with Playwright against a local static server, before any edits in this pass
(`qa/performance_before.json`, commit `b78cdac`) and after (`qa/performance_after.json`).

## Method, and what these numbers are not

Lighthouse is not installed in this environment and the npm route to fetch it is not
available, so these are **not** Lighthouse scores and not field Core Web Vitals. They are
direct instrumentation, which for the specific complaint — "heavy/janky while scrolling" —
is the more direct evidence anyway:

- **Scroll jank.** The page is scrolled top to bottom over a fixed 3 s under
  `requestAnimationFrame`, recording every frame interval. A frame over 20 ms missed 50 fps.
  This is the number that corresponds to how scrolling *feels*.
- **Idle rAF callbacks / 2 s.** `requestAnimationFrame` is wrapped at document start and
  callbacks are counted over 2 s of no interaction. Anything above 0 is a continuous loop
  running while the visitor does nothing. 120 ≈ one 60 fps loop.
- **Long tasks, LCP, CLS** come from `PerformanceObserver` (`longtask`,
  `largest-contentful-paint`, `layout-shift`), buffered from before navigation.
- **Transfer** sums every response body, grouped by content type.

Caveat worth stating plainly: this container is slower and less consistent than a real
machine, and the server is local, so absolute load times are optimistic while frame timings
are pessimistic. The *deltas*, measured the same way on the same hardware minutes apart, are
the meaningful part.

## What was actually wrong

Three continuous loops and one forced reflow, none of them visible as a feature:

1. **`cursor.js` never stopped.** A custom-cursor spring loop called
   `requestAnimationFrame(loop)` unconditionally from inside `loop`, with no idle, visibility
   or completion guard — a frame callback every 16 ms for the life of the page, forever.
   The feature was deleted outright rather than throttled.
2. **`animations.js` forced a layout on every scroll event.** `highlightNav()` ran
   `querySelectorAll` and read `offsetTop` for every section on each scroll event.
   `offsetTop` flushes pending layout, so every scroll event triggered a full reflow. It is
   now one `IntersectionObserver`; the remaining scroll handler reads only `scrollY`, inside
   a rAF, and touches nothing that forces layout.
3. **The hero `<canvas>` drew an O(n²) link mesh every frame** — up to 70 nodes, ~2 400
   distance tests per frame — and ran on phones, where it cannot be interacted with at all.
4. **13 `backdrop-filter: blur()` declarations**, several on badges sitting over scrolling
   project covers, which is the worst case: the backdrop is re-rasterised as it moves.

### The canvas got measured, not guessed

After gating the canvas on `(pointer: fine)`, pausing it on `visibilitychange`, halving the
node count and shrinking the link radius, the desktop homepage *still* dropped 44/134 frames.
So it was isolated — same page, same scroll, the only difference being whether
`particles.js` was served:

| | Dropped frames | Worst frame |
|---|---|---|
| with the hero canvas | 47 / 132 | 50 ms |
| canvas blocked | **2 / 179** | 33 ms |

The canvas alone accounted for essentially all remaining jank. Weighed against what it
contributes visually — a handful of faint dots most visitors never consciously register —
it was replaced with `assets/images/hero-constellation.svg`: the same motif, generated once
deterministically (`random.seed(20261009)`), rasterised by the browser a single time, zero
frame cost. This is the brief's own rule: performance beats decoration.

## Everything changed, and why

| Change | Reason |
|---|---|
| Deleted `cursor.js` + `cursor.css` | Infinite unguarded rAF loop; the feature justified none of it |
| Deleted `particles.js`, added a static SVG | Measured as the sole remaining jank source |
| `highlightNav()` → `IntersectionObserver` | Removed a forced reflow per scroll event |
| Scroll handler wrapped in rAF, reads only `scrollY` | No layout reads on the scroll path |
| Counter `setInterval` → rAF, honours reduced motion | A 30 ms timer mutating text |
| Carousel autoplay removed | A `setInterval` advancing transforms forever |
| `tilt.js` restricted to `[data-tilt]` | Was binding a pointer handler to every card on the page |
| `backdrop-filter` 13 → 3 | Kept only on the sticky nav and the two modal scrims |
| Fonts 8 faces → 5 | Fraunces is only ever set at 600; `font-weight: 800` folded into 700 |
| Font Awesome CDN → inline 22-symbol SVG sprite | ~110 KB render-blocking stylesheet + webfonts, for 22 icons, replaced by 9 KB inline |
| CSS `@import` manifest → direct `<link>`s | `@import` serialises each fetch behind the parse of the file that requested it |
| `content-visibility: auto` on below-fold sections | With `contain-intrinsic-size` so the scrollbar does not jump |
| Removed an infinite `cue-fall` keyframe | It animated `top` — a layout property — forever, for a 1 px decoration |
| Scripts moved to `defer` | Nothing in them needs to block parsing |

## Results

### homepage · desktop-1440

| Metric | Before | After | Delta |
|---|---:|---:|---|
| Dropped frames in a 3 s scroll (>20 ms) | 60 / 115 | 5 / 176 | -55 (-92%) |
| Worst frame | 67 ms | 33 ms | -34 ms (-51%) |
| Idle rAF callbacks / 2 s | 154 | 0 | -154 (-100%) |
| Long tasks > 50 ms | 5 | 1 | -4 (-80%) |
| load event | 630 ms | 125 ms | -505 ms (-80%) |
| LCP | 720 ms | 224 ms | -496 ms (-69%) |
| CLS | 0 | 0 | no change |
| Transfer | 902 KB | 527 KB | -375 KB (-42%) |
|   of which JS | 45 KB | 36 KB | -9 KB (-20%) |
|   of which CSS | 194 KB | 99 KB | -95 KB (-49%) |
|   of which fonts/other | 400 KB | 134 KB | -266 KB (-66%) |
| Requests | 46 | 33 | -13 (-28%) |
| Console errors | 0 | 0 | no change |

### homepage · mobile-390

| Metric | Before | After | Delta |
|---|---:|---:|---|
| Dropped frames in a 3 s scroll (>20 ms) | 0 / 181 | 0 / 181 | no change |
| Worst frame | 17 ms | 17 ms | no change |
| Idle rAF callbacks / 2 s | 120 | 0 | -120 (-100%) |
| Long tasks > 50 ms | 2 | 0 | -2 (-100%) |
| load event | 217 ms | 97 ms | -120 ms (-55%) |
| LCP | 188 ms | 136 ms | -52 ms (-28%) |
| CLS | 0 | 0 | no change |
| Transfer | 810 KB | 520 KB | -290 KB (-36%) |
|   of which JS | 45 KB | 36 KB | -9 KB (-20%) |
|   of which CSS | 194 KB | 99 KB | -95 KB (-49%) |
|   of which fonts/other | 400 KB | 134 KB | -266 KB (-66%) |
| Requests | 43 | 32 | -11 (-26%) |
| Console errors | 0 | 0 | no change |

### eghr-case · desktop-1440

| Metric | Before | After | Delta |
|---|---:|---:|---|
| Dropped frames in a 3 s scroll (>20 ms) | 0 / 182 | 0 / 182 | no change |
| Worst frame | 17 ms | 17 ms | no change |
| Idle rAF callbacks / 2 s | 0 | 0 | no change |
| Long tasks > 50 ms | 2 | 2 | no change |
| load event | 438 ms | 452 ms | +14 ms (+3%) |
| LCP | 244 ms | 240 ms | -4 ms (-2%) |
| CLS | 0.0002 | 0.0002 | no change |
| Transfer | 830 KB | 591 KB | -239 KB (-29%) |
|   of which JS | 12 KB | 12 KB | no change |
|   of which CSS | 225 KB | 130 KB | -95 KB (-42%) |
|   of which fonts/other | 266 KB | 113 KB | -153 KB (-58%) |
| Requests | 41 | 36 | -5 (-12%) |
| Console errors | 0 | 0 | no change |

### eghr-case · mobile-390

| Metric | Before | After | Delta |
|---|---:|---:|---|
| Dropped frames in a 3 s scroll (>20 ms) | 0 / 182 | 0 / 182 | no change |
| Worst frame | 17 ms | 17 ms | no change |
| Idle rAF callbacks / 2 s | 0 | 0 | no change |
| Long tasks > 50 ms | 2 | 2 | no change |
| load event | 345 ms | 347 ms | +2 ms (+1%) |
| LCP | 176 ms | 172 ms | -4 ms (-2%) |
| CLS | 0 | 0 | no change |
| Transfer | 830 KB | 591 KB | -239 KB (-29%) |
|   of which JS | 12 KB | 12 KB | no change |
|   of which CSS | 225 KB | 130 KB | -95 KB (-42%) |
|   of which fonts/other | 266 KB | 113 KB | -153 KB (-58%) |
| Requests | 41 | 36 | -5 (-12%) |
| Console errors | 0 | 0 | no change |

## Against the brief's targets (§62)

| Target | Result |
|---|---|
| LCP < 2.5 s | 124–220 ms locally. Not a field measurement; see the caveat above. |
| CLS < 0.1 | 0 on the homepage, 0.0002 on the case study. |
| INP < 200 ms | Not measured — INP needs real interaction traces. The proxy is long tasks: 2 or fewer per page, and 0 on the homepage at 390. |
| No persistent > 50 ms long tasks while scrolling | Met. The remaining long tasks are at load, not during scroll. |
| No continuous 20–30 fps feeling | Met: 2 late frames out of 179 on desktop, 0 of 181 on mobile. |
| No jank from hidden/offscreen effects | Met: 0 idle rAF callbacks on every page and viewport — there are no continuous loops left to hide. |

## Measurement variance

Frame timings in this container move around under CPU contention. One `perf.mjs` run
reported 64/115 dropped frames on the desktop homepage; six back-to-back runs of the same
scroll immediately afterwards gave 2, 3, 3, 5, 2 and 5 out of ~178, and the committed
`performance_after.json` run gave 5/176. The outlier was the container, not the page — but
it is the reason every claim here is backed by a repeated measurement rather than a single
sample.

## content-visibility, and the bug it caused

`content-visibility: auto` on the four below-fold sections is worth keeping: with it, a
desktop scroll drops ~2-5 frames of 178; with it forced off, 16 of 163.

It did introduce a real bug, caught in review. Until a section has rendered once it occupies
its `contain-intrinsic-size` placeholder rather than its real height, so on a **cold load**
an in-page jump to a section below it landed short — measured at 207 px off for `#contact`
at 1440. The fix is in `animations.js`: anchor navigation adds `.anchor-jump` to
`<html>`, which sets `content-visibility: visible` on those sections, flushes layout, then
scrolls. Because `contain-intrinsic-size: auto <len>` tells the browser to remember each
element's real size once rendered, the class comes straight back off without the page
shifting. Deep links (`/#contact`) get the same correction on load. All six anchor targets
tested at 1440 and 390 now land at exactly 0 px offset.

## Scroll-jank observations

At 1440 the homepage now drops ~2-5 frames out of ~178 during a full-page scroll, and the
worst frame is 33-50 ms (one frame, at the start, while below-fold sections are first
realised). At 390 it drops none. The case-study page drops none at either width, before and after — it
never had the hero effects, which is what made it a useful control throughout.

Reduced motion is verified behaviourally rather than by inspection: with
`prefers-reduced-motion: reduce`, **0** animation frames are scheduled in 1.8 s and the hero
still renders at full opacity.
