#!/usr/bin/env python3
"""
generate_project_visuals.py
Generates premium, product-looking ERP/dashboard SVG cover images for
projects that don't have real screenshots — so every card is image-rich.

Output: assets/images/projects/generated/*.svg   (crisp, tiny, GitHub-Pages safe)

Two visual systems:
  - erp_dashboard(): looks like a real Odoo/ERP product screen
      (window chrome, sidebar, KPI tiles, chart, kanban pipeline, table)
  - context_cover(): branded "business context" cover for public projects
      (sector motif + a small honest ERP inset panel)

Run:  python3 scripts/generate_project_visuals.py
"""

import os, re, math, random, base64, mimetypes

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT  = os.path.join(ROOT, "assets/images/projects/generated")
os.makedirs(OUT, exist_ok=True)


def _data_uri(rel):
    """Base64-embed a local image so the SVG cover is self-contained (no hotlink)."""
    path = os.path.join(ROOT, rel)
    mime = mimetypes.guess_type(path)[0] or "image/png"
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    return f"data:{mime};base64,{b64}"


def brand_cover(fname, logo_rel, domain, title, tagline, accent, accent2,
                chips, logo_w=520, logo_h=180):
    """Premium website-style brand cover built around a REAL local logo asset."""
    # Same per-project shell as the dashboards. Without this the brand covers
    # inherited whichever project was themed last, so all three came out in
    # DOTec blue regardless of whose logo they carried.
    set_theme(accent)
    uri = _data_uri(logo_rel)
    lx = (W - logo_w) / 2
    chip_html, cx = "", (W - (len(chips) * 172)) / 2
    for i, c in enumerate(chips):
        x = cx + i * 172
        chip_html += (f'<rect x="{x:.0f}" y="592" width="156" height="40" rx="20" '
                      f'fill="{PANEL2}" stroke="{LINE}" stroke-width="1"/>'
                      f'<text x="{x+78:.0f}" y="617" font-family="Inter,sans-serif" font-size="14" '
                      f'font-weight="600" fill="{TXT2}" text-anchor="middle">{c}</text>')
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
  {_defs(accent, accent2)}
  {_backdrop(accent)}
  <g transform="translate(100,60)">
    <rect x="0" y="0" width="1000" height="46" rx="14" fill="{PANEL2}"/>
    <rect x="0" y="23" width="1000" height="23" fill="{PANEL2}"/>
    <circle cx="26" cy="23" r="6" fill="#ff5f57"/><circle cx="48" cy="23" r="6" fill="#febc2e"/><circle cx="70" cy="23" r="6" fill="#28c840"/>
    <rect x="360" y="12" width="280" height="22" rx="11" fill="{INK}" opacity="0.6"/>
    <text x="500" y="28" font-family="Inter,sans-serif" font-size="12" fill="{TXT2}" text-anchor="middle">🔒 {domain}</text>
  </g>
  <!-- brand glow -->
  <ellipse cx="{W/2}" cy="300" rx="520" ry="240" fill="url(#glow)" filter="url(#soft)" opacity="0.7"/>
  <!-- white logo panel (logos ship on light backgrounds) -->
  <rect x="{lx-46:.0f}" y="188" width="{logo_w+92}" height="{logo_h+92}" rx="26"
        fill="{PANEL2}" stroke="{accent}" stroke-opacity="0.45" stroke-width="2"/>
  <image href="{uri}" x="{lx:.0f}" y="234" width="{logo_w}" height="{logo_h}" preserveAspectRatio="xMidYMid meet"/>
  <text x="{W/2}" y="512" font-family="Inter,Segoe UI,sans-serif" font-size="40" font-weight="700"
        fill="{TXT}" text-anchor="middle">{title}</text>
  <text x="{W/2}" y="552" font-family="Inter,sans-serif" font-size="19" fill="{TXT2}" text-anchor="middle">{tagline}</text>
  {chip_html}
</svg>'''
    with open(os.path.join(OUT, fname), "w") as f:
        f.write(svg)
    return fname

W, H = 1200, 750

# ── per-project surfaces ────────────────────────────────────
# IMPORTANT: these are NOT the portfolio palette.
#
# The portfolio is the gallery; each project is the artwork. A cover
# painted in the site's own plum and gold erases the client's identity and
# makes every card look like the same product — which is exactly what the
# October 2026 review rejected.
#
# So the dark shell is rebuilt per project by tinting a near-black toward
# that project's own brand hue (set_theme below). DOTec reads blue because
# its logo is #001ad3; EJAD and EjadTech read teal because that is what
# their real product screenshots sample to; Margins reads red. The type
# ramp stays neutral so labels remain legible on every one of them.
TXT      = "#f2f1ee"
TXT2     = "#d6d4d0"
TXT3     = "#9d9a96"

# Set by set_theme(); the drawing helpers read them at call time.
INK = INK2 = PANEL = PANEL2 = LINE = "#111111"


def _rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _mix(a, b, t):
    """Blend hex colour a toward b by t (0..1)."""
    ra, ga, ba = _rgb(a)
    rb, gb, bb = _rgb(b)
    return "#%02x%02x%02x" % (
        round(ra + (rb - ra) * t),
        round(ga + (gb - ga) * t),
        round(ba + (bb - ba) * t),
    )


def _ink_on(c):
    """Readable text colour for a filled accent pill.

    The accents span a wide lightness range — Margins red and DOTec blue are
    dark, EJAD teal is mid, amber is light — so a single fixed ink fails on
    one end or the other. Pick by relative luminance instead."""
    r, g, b = (v / 255 for v in _rgb(c))
    f = lambda v: v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    lum = 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    return "#0c0c0e" if lum > 0.42 else "#ffffff"


def set_theme(brand):
    """Rebuild the dark shell around one project's brand hue.

    The tint strengths stay low on purpose: enough that two covers side by
    side are obviously different products, not so much that the UI reads as
    a colour wash."""
    global INK, INK2, PANEL, PANEL2, LINE
    INK    = _mix("#0c0c0e", brand, 0.07)
    INK2   = _mix("#131316", brand, 0.11)
    PANEL  = _mix("#1a1a1e", brand, 0.14)
    PANEL2 = _mix("#25252a", brand, 0.17)
    LINE   = _mix("#333339", brand, 0.22)


set_theme("#777777")


def _defs(accent, accent2):
    return f'''
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{INK}"/>
      <stop offset="1" stop-color="{INK2}"/>
    </linearGradient>
    <linearGradient id="acc" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{accent}"/>
      <stop offset="1" stop-color="{accent2}"/>
    </linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.09"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.02"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="{accent}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="{accent}" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="18"/>
    </filter>
    <pattern id="grid" width="34" height="34" patternUnits="userSpaceOnUse">
      <path d="M34 0H0V34" fill="none" stroke="#ffffff" stroke-opacity="0.035" stroke-width="1"/>
    </pattern>
  </defs>'''


def _backdrop(accent):
    return f'''
  <rect width="{W}" height="{H}" fill="url(#bg)"/>
  <rect width="{W}" height="{H}" fill="url(#grid)"/>
  <ellipse cx="120" cy="90" rx="360" ry="300" fill="url(#glow)" filter="url(#soft)" opacity="0.9"/>
  <ellipse cx="1120" cy="720" rx="380" ry="300" fill="url(#glow)" filter="url(#soft)" opacity="0.6"/>'''


def _bw(badge):
    """Badge pill width that always fits its label."""
    return max(150, round(7.0 * len(badge)) + 26)


def _chrome(title, badge, accent):
    """Window chrome header bar."""
    return f'''
    <rect x="0" y="0" width="1000" height="52" rx="16" fill="{PANEL2}"/>
    <rect x="0" y="26" width="1000" height="26" fill="{PANEL2}"/>
    <circle cx="30" cy="26" r="6" fill="#ff5f57"/>
    <circle cx="52" cy="26" r="6" fill="#febc2e"/>
    <circle cx="74" cy="26" r="6" fill="#28c840"/>
    <rect x="360" y="15" width="280" height="22" rx="11" fill="{INK}" opacity="0.6"/>
    <text x="500" y="30" font-family="Inter,Segoe UI,sans-serif" font-size="12"
          fill="{TXT3}" text-anchor="middle">{title}</text>
    <rect x="{986 - _bw(badge)}" y="14" width="{_bw(badge)}" height="24" rx="12" fill="url(#acc)" opacity="0.92"/>
    <text x="{986 - _bw(badge) / 2}" y="30" font-family="Inter,sans-serif" font-size="11" font-weight="700"
          fill="{_ink_on(accent)}" text-anchor="middle" letter-spacing="0.5">{badge}</text>'''


def _sidebar(accent):
    items = ""
    ys = [90, 138, 186, 234, 282, 330]
    for i, y in enumerate(ys):
        active = i == 0
        fill = "url(#acc)" if active else PANEL2
        op = "1" if active else "0.8"
        items += f'<rect x="18" y="{y}" width="52" height="34" rx="10" fill="{fill}" opacity="{op}"/>'
        items += f'<rect x="30" y="{y+11}" width="28" height="4" rx="2" fill="{_ink_on(accent) if active else TXT3}" opacity="0.9"/>'
    return f'<rect x="0" y="70" width="88" height="480" rx="16" fill="{PANEL}"/>{items}'


_FIGURE = re.compile(r'^[\d$€£]|[\d]')


def _caption(parts):
    """Tile caption from a (a, b) pair whose order is not consistent across
    the data. Any part that reads as a quantity is dropped — the covers are
    illustrative, so the words are the content and the figure is a bar."""
    words = [str(t).strip() for t in parts if str(t).strip() and not _FIGURE.search(str(t))]
    if not words:
        words = [str(t).strip() for t in parts if str(t).strip()]
    return " ".join(words[:2]) or "Metric"


def _kpi(x, y, label, accent, spark):
    """A metric tile. The caption is real; the figure is deliberately a
    placeholder bar — these are illustrative covers, not reported numbers."""
    bars = ""
    for i, v in enumerate(spark):
        bh = 4 + v * 20
        bars += (f'<rect x="{x+18+i*14}" y="{y+84-bh}" width="10" height="{bh}" rx="3" '
                 f'fill="url(#acc)" opacity="{0.35+0.5*v:.2f}"/>')
    return f'''
    <rect x="{x}" y="{y}" width="196" height="96" rx="14" fill="url(#glass)" stroke="{LINE}" stroke-width="1"/>
    <text x="{x+18}" y="{y+24}" font-family="Inter,sans-serif" font-size="10.5" font-weight="700"
          letter-spacing="1.1" fill="{TXT3}">{label.upper()}</text>
    <rect x="{x+18}" y="{y+34}" width="{72 + (len(label) * 2) % 36}" height="15" rx="7" fill="{TXT2}" opacity="0.55"/>
    {bars}'''


def _barchart(x, y, w, h, title, accent, data):
    n = len(data)
    gap = w / n
    bw = gap * 0.5
    bars = ""
    mx = max(data)
    for i, v in enumerate(data):
        bh = (v / mx) * (h - 60)
        bx = x + 20 + i * gap
        by = y + h - 24 - bh
        bars += f'<rect x="{bx:.0f}" y="{by:.0f}" width="{bw:.0f}" height="{bh:.0f}" rx="5" fill="url(#acc)"/>'
    grid = ""
    for g in range(1, 4):
        gy = y + 40 + g * (h - 70) / 4
        grid += f'<line x1="{x+18}" y1="{gy:.0f}" x2="{x+w-18}" y2="{gy:.0f}" stroke="{LINE}" stroke-opacity="0.5" stroke-width="1"/>'
    return f'''
    <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="16" fill="url(#glass)" stroke="{LINE}" stroke-width="1"/>
    <text x="{x+20}" y="{y+30}" font-family="Inter,sans-serif" font-size="14" font-weight="600" fill="{TXT}">{title}</text>
    {grid}{bars}'''


def _linechart(x, y, w, h, title, accent, data):
    n = len(data)
    mx = max(data); mn = min(data)
    pts = []
    for i, v in enumerate(data):
        px = x + 20 + i * (w - 40) / (n - 1)
        py = y + h - 24 - (v - mn) / (mx - mn + 0.001) * (h - 64)
        pts.append((px, py))
    poly = " ".join(f"{p[0]:.0f},{p[1]:.0f}" for p in pts)
    area = f"{x+20},{y+h-24} " + poly + f" {x+w-20},{y+h-24}"
    dots = "".join(f'<circle cx="{p[0]:.0f}" cy="{p[1]:.0f}" r="4" fill="{accent}"/>' for p in pts)
    return f'''
    <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="16" fill="url(#glass)" stroke="{LINE}" stroke-width="1"/>
    <text x="{x+20}" y="{y+30}" font-family="Inter,sans-serif" font-size="14" font-weight="600" fill="{TXT}">{title}</text>
    <polygon points="{area}" fill="url(#acc)" opacity="0.14"/>
    <polyline points="{poly}" fill="none" stroke="url(#acc)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    {dots}'''


def _kanban(x, y, w, h, cols, accent):
    colw = (w - 20) / len(cols) - 14
    out = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="16" fill="url(#glass)" stroke="{LINE}" stroke-width="1"/>'
    for ci, (name, cards) in enumerate(cols):
        cx = x + 16 + ci * (colw + 14)
        out += f'<text x="{cx+4}" y="{y+28}" font-family="Inter,sans-serif" font-size="12" font-weight="600" fill="{TXT2}">{name}</text>'
        out += f'<circle cx="{cx+colw-6}" cy="{y+24}" r="8" fill="{PANEL2}"/><text x="{cx+colw-6}" y="{y+28}" font-family="Inter" font-size="9" fill="{TXT2}" text-anchor="middle">{cards}</text>'
        for k in range(min(cards, 3)):
            cy = y + 40 + k * 40
            out += f'<rect x="{cx}" y="{cy}" width="{colw:.0f}" height="32" rx="8" fill="{PANEL2}"/>'
            out += f'<rect x="{cx+10}" y="{cy+9}" width="{colw*0.5:.0f}" height="5" rx="2.5" fill="{TXT3}"/>'
            out += f'<rect x="{cx+10}" y="{cy+19}" width="{colw*0.3:.0f}" height="4" rx="2" fill="{LINE}"/>'
            out += f'<circle cx="{cx+colw-14:.0f}" cy="{cy+16}" r="6" fill="url(#acc)"/>'
    return out


def _donut(cx, cy, r, accent, segs):
    out = f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{PANEL2}" stroke-width="18"/>'
    total = sum(s for s, _ in segs)
    ang = -90
    # Segments are tints/shades of the project's OWN accent, so a chart never
    # smuggles the portfolio's gold and plum onto a client's cover.
    cols = [accent,
            _mix(accent, "#ffffff", 0.34),
            _mix(accent, "#000000", 0.32),
            _mix(accent, "#ffffff", 0.62)]
    for i, (s, _) in enumerate(segs):
        frac = s / total
        a2 = ang + frac * 360
        large = 1 if frac > 0.5 else 0
        x1 = cx + r * math.cos(math.radians(ang)); y1 = cy + r * math.sin(math.radians(ang))
        x2 = cx + r * math.cos(math.radians(a2)); y2 = cy + r * math.sin(math.radians(a2))
        out += f'<path d="M {x1:.1f} {y1:.1f} A {r} {r} 0 {large} 1 {x2:.1f} {y2:.1f}" fill="none" stroke="{cols[i%len(cols)]}" stroke-width="18" stroke-linecap="round"/>'
        ang = a2
    # The centre figure is deliberately a placeholder bar: these covers
    # illustrate structure, they do not report real numbers.
    out += f'<rect x="{cx-24}" y="{cy-7}" width="48" height="13" rx="6" fill="{TXT2}" opacity="0.45"/>'
    return out


def erp_dashboard(fname, title, badge, accent, accent2, kpis, chart, layout="kanban"):
    """Illustrative ERP dashboard cover, themed to the project's own brand."""
    set_theme(accent)
    random.seed(sum(ord(c) for c in fname))
    spark = lambda: [random.random() for _ in range(6)]
    body = f'<g transform="translate(100,64)">'
    body += _chrome(title, badge, accent)
    body += _sidebar(accent)
    # KPI row
    for i, pair in enumerate(kpis[:4]):
        body += _kpi(108 + i * 212, 84, _caption(pair), accent, spark())
    # charts
    if chart == "line":
        body += _linechart(108, 196, 470, 190, "Pipeline value / month", accent, [4,6,5,8,7,11,10,13])
    else:
        body += _barchart(108, 196, 470, 190, "Revenue by stage", accent, [6,9,5,11,8,12,7])
    body += _donut(760, 292, 66, accent, [(52,"a"),(28,"b"),(20,"c")])
    body += f'<rect x="620" y="196" width="272" height="190" rx="16" fill="url(#glass)" stroke="{LINE}" stroke-width="1"/>'
    body += f'<text x="640" y="226" font-family="Inter" font-size="14" font-weight="600" fill="{TXT}">Distribution</text>'
    # bottom
    if layout == "kanban":
        body += _kanban(108, 400, 784, 150,
                        [("New", 6), ("Qualified", 4), ("Proposal", 3), ("Won", 5)], accent)
    else:
        # table
        body += f'<rect x="108" y="400" width="784" height="150" rx="16" fill="url(#glass)" stroke="{LINE}" stroke-width="1"/>'
        for r in range(4):
            ry = 420 + r*30
            body += f'<rect x="126" y="{ry}" width="240" height="8" rx="4" fill="{TXT3 if r==0 else LINE}"/>'
            body += f'<rect x="420" y="{ry}" width="150" height="8" rx="4" fill="{LINE}"/>'
            body += f'<rect x="620" y="{ry}" width="120" height="8" rx="4" fill="{LINE}"/>'
            body += f'<rect x="800" y="{ry-4}" width="70" height="18" rx="9" fill="url(#acc)" opacity="0.85"/>'
    body += '</g>'

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
  {_defs(accent, accent2)}
  {_backdrop(accent)}
  {body}
</svg>'''
    with open(os.path.join(OUT, fname), "w") as f:
        f.write(svg)
    return fname


def context_cover(fname, title, sector, accent, accent2, motif="building"):
    """Illustrative sector cover for a public-context project."""
    set_theme(accent)
    """Branded business-context cover with an honest small ERP inset."""
    if motif == "building":
        art = ''
        bx = 120
        heights = [300, 220, 360, 260, 320]
        for i, hh in enumerate(heights):
            x = bx + i*150
            art += f'<rect x="{x}" y="{H-hh-40}" width="120" height="{hh}" rx="10" fill="url(#glass)" stroke="{LINE}" stroke-width="1"/>'
            for r in range(hh//46):
                for c in range(3):
                    art += f'<rect x="{x+16+c*34}" y="{H-hh-16+r*46}" width="20" height="24" rx="3" fill="{accent}" opacity="{0.15+0.5*((i+r+c)%3==0)}"/>'
    else:  # blueprint / engineering
        art = f'<rect x="90" y="120" width="700" height="470" rx="18" fill="url(#glass)" stroke="{LINE}" stroke-width="1"/>'
        random.seed(len(title))
        for _ in range(9):
            x = random.randint(120, 720); y = random.randint(150, 540)
            w = random.randint(60, 160); h = random.randint(40, 120)
            art += f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="none" stroke="{accent}" stroke-opacity="0.35" stroke-width="1.5"/>'
        art += f'<circle cx="420" cy="360" r="120" fill="none" stroke="{accent}" stroke-opacity="0.4" stroke-width="1.5" stroke-dasharray="6 8"/>'
        art += f'<line x1="90" y1="360" x2="790" y2="360" stroke="{accent}" stroke-opacity="0.25" stroke-width="1"/>'
        art += f'<line x1="440" y1="120" x2="440" y2="590" stroke="{accent}" stroke-opacity="0.25" stroke-width="1"/>'

    # ERP inset panel (honest signal: my work = the ERP that tracks this)
    inset = f'''
    <g transform="translate(770,430)">
      <rect x="0" y="0" width="360" height="260" rx="18" fill="{PANEL}" stroke="{LINE}" stroke-width="1"/>
      <rect x="0" y="0" width="360" height="40" rx="18" fill="{PANEL2}"/>
      <rect x="0" y="22" width="360" height="18" fill="{PANEL2}"/>
      <circle cx="22" cy="20" r="5" fill="#ff5f57"/><circle cx="40" cy="20" r="5" fill="#febc2e"/><circle cx="58" cy="20" r="5" fill="#28c840"/>
      <text x="180" y="24" font-family="Inter" font-size="11" fill="{TXT3}" text-anchor="middle">Internal Odoo ERP</text>
      {_kpi(18, 58, "Units", accent, [.3,.6,.4,.8,.5,.9]).replace('width="196"','width="150"')}
      {_kpi(190, 58, "Deals", accent, [.4,.5,.7,.3,.6,.8]).replace('width="196"','width="150"')}
      <rect x="18" y="170" width="324" height="72" rx="12" fill="url(#glass)" stroke="{LINE}" stroke-width="1"/>
      <rect x="34" y="188" width="120" height="7" rx="3.5" fill="{TXT3}"/>
      <rect x="34" y="206" width="200" height="6" rx="3" fill="{LINE}"/>
      <rect x="34" y="222" width="160" height="6" rx="3" fill="{LINE}"/>
      <rect x="300" y="196" width="26" height="26" rx="8" fill="url(#acc)"/>
    </g>'''

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
  {_defs(accent, accent2)}
  {_backdrop(accent)}
  {art}
  <rect x="80" y="70" width="150" height="30" rx="15" fill="url(#acc)" opacity="0.9"/>
  <text x="155" y="90" font-family="Inter" font-size="12" font-weight="700" fill="{_ink_on(accent)}" text-anchor="middle" letter-spacing="0.5">{sector}</text>
  <text x="80" y="150" font-family="Inter,Segoe UI,sans-serif" font-size="46" font-weight="700" fill="{TXT}">{title}</text>
  {inset}
</svg>'''
    with open(os.path.join(OUT, fname), "w") as f:
        f.write(svg)
    return fname


# ── Per-project brand colours (§13, §16) ────────────────────
# Each value is traceable to the project itself, not chosen to match the
# portfolio. Provenance is recorded in assets/data/sources.json.
#
#   DOTEC    sampled from the real DOTec logo (#001ad3)
#   EJAD     the teal the EGHR portal shipped with; corroborated by the
#            real EjadTech Odoo backend screenshot, which samples to
#            #00b4a8 / #009090
#   MARGINS  from the Margins placeholder mark — Margins' real logo is not
#            publicly available, which sources.json states plainly
#   GOV      the Saudi government platforms' own green
DOTEC      = "#2b5cff"   # lifted from #001ad3 for legibility on dark
DOTEC2     = "#6f8cff"
EJAD       = "#00a89c"
EJAD2      = "#4fd6cc"
MARGINS    = "#c0392b"
MARGINS2   = "#e0695c"
GOV        = "#2f9e6a"
GOV2       = "#64c79a"
AMBER      = "#d9a441"
AMBER2     = "#f0cf94"
SLATE      = "#5b6b84"
SLATE2     = "#92a3bd"

# Legacy aliases used further down the call list.
BLUE, CYAN = DOTEC, DOTEC2
VIOLET     = SLATE
GREEN      = GOV
GOLD       = AMBER
ROSE       = MARGINS

def main():
    made = []
    # ── Full ERP builds ──
    made.append(erp_dashboard("margins-erp.svg", "margins.odoo · Real Estate", "REAL ESTATE ERP",
        MARGINS, MARGINS2,
        [("EGP 48M","Sales Pipeline"),("312","Units"),("87","Reservations"),("24","Brokers")],
        chart="line", layout="kanban"))
    made.append(erp_dashboard("dotec-erp.svg", "dotec.odoo · Engineering", "ENGINEERING ERP",
        BLUE, CYAN,
        [("46","Active Projects"),("128","Consultants"),("$2.4M","Billed"),("5","Disciplines")],
        chart="bar", layout="table"))
    # Alternate views (for galleries)
    made.append(erp_dashboard("margins-erp-2.svg", "margins.odoo · Reservations", "PAYMENT TRACKING",
        MARGINS, MARGINS2,
        [("EGP 12M","Collected"),("64","Installments"),("9","Overdue"),("QWeb","Receipts")],
        chart="bar", layout="table"))
    made.append(erp_dashboard("margins-erp-3.svg", "margins.odoo · CRM Pipeline", "SALES CRM",
        MARGINS, MARGINS2,
        [("214","Leads"),("38","Opportunities"),("22%","Win Rate"),("Auto","Nurture")],
        chart="line", layout="kanban"))
    made.append(erp_dashboard("dotec-erp-2.svg", "dotec.odoo · Timesheets", "WORKLOAD & EXPENSES",
        BLUE, CYAN,
        [("1.9k","Hours"),("$180k","Expenses"),("92%","Utilization"),("5","Teams")],
        chart="line", layout="kanban"))
    made.append(erp_dashboard("dotec-erp-3.svg", "dotec.odoo · Projects", "PROJECT LIFECYCLE",
        BLUE, CYAN,
        [("46","Projects"),("212","Milestones"),("Docs","Managed"),("RBAC","Security")],
        chart="bar", layout="table"))
    made.append(erp_dashboard("margins-erp-4.svg", "margins.odoo · Reports", "QWEB REPORTING",
        MARGINS, MARGINS2,
        [("48","Reports"),("Contracts","PDF"),("Roles","6"),("Access","Rules")],
        chart="bar", layout="table"))
    made.append(erp_dashboard("dotec-erp-4.svg", "dotec.odoo · Integrations", "REST & ACCESS",
        BLUE, CYAN,
        [("REST","APIs"),("Cron","Jobs"),("Security","Groups"),("Audit","Log")],
        chart="line", layout="kanban"))

    # ── Odoo work (SVG placeholders → dashboards) ──
    made.append(erp_dashboard("ejad-digital-odoo-work.svg", "ejad.odoo · Multi-Client", "ODOO SILVER PARTNER",
        EJAD, EJAD2,
        [("14","Clients"),("60+","Modules"),("QWeb","Reports"),("", "Releases")],
        chart="bar", layout="kanban"))
    made.append(erp_dashboard("ejad-erp-implementations.svg", "ejad.odoo · Implementations", "MULTI-CLIENT ERP",
        EJAD, EJAD2,
        [("CRM","+ HR"),("32","Workflows"),("Access","Rules"),("Cron","Jobs")],
        chart="line", layout="table"))
    made.append(erp_dashboard("ejad-internal-erp.svg", "ejad.odoo · Internal Tools", "INTERNAL CUSTOMIZATION",
        EJAD, EJAD2,
        [("18","Modules"),("240","Commits"),("PDF","Templates"),("Chatter","Mail")],
        chart="bar", layout="kanban"))
    made.append(erp_dashboard("creatio-automation.svg", "odoo × creatio · BPM", "BUSINESS AUTOMATION",
        EJAD, EJAD2,
        [("Sync","Real-time"),("22","Flows"),("2","Systems"),("0","Manual")],
        chart="line", layout="table"))
    made.append(erp_dashboard("visitor-service-robot.svg", "grand-mosque · Visitors", "VISITOR MANAGEMENT",
        AMBER, AMBER2,
        [("1.2M","Visitors"),("340","Services/day"),("AI","Assist"),("Live","Reports")],
        chart="bar", layout="kanban"))
    made.append(erp_dashboard("vro-ministry-media.svg", "ministry-of-media · VRO", "GOVERNMENT · MEDIA",
        SLATE, SLATE2,
        [("Licensing","Digital"),("Approvals","Workflow"),("Roles","RBAC"),("Reports","QWeb")],
        chart="line", layout="table"))
    made.append(erp_dashboard("tasharuk-platform.svg", "najran · Tasharuk", "GOVERNMENT · COMMUNITY",
        GOV, GOV2,
        [("Citizens","Engaged"),("Regional","Services"),("Access","Managed"),("Data","Exports")],
        chart="bar", layout="kanban"))

    made.append(erp_dashboard("zeraei-platform.svg", "mewa · Zeraei", "GOVERNMENT · AGRICULTURE",
        GOV, GOV2,
        [("Farmers","Onboarded"),("Services","Digital"),("Subsidies","Tracked"),("Reports","QWeb")],
        chart="line", layout="table"))
    made.append(erp_dashboard("ejadx-platform.svg", "ejadx · Acceleration", "INNOVATION PLATFORM",
        EJAD, EJAD2,
        [("Clients","Onboarded"),("APIs","Integrated"),("Flows","Automated"),("Live","Analytics")],
        chart="bar", layout="kanban"))
    made.append(erp_dashboard("tawajod-platform.svg", "tawajod · Presence", "DIGITAL SERVICES",
        SLATE, SLATE2,
        [("Multi","Client"),("Services","Managed"),("Cron","Jobs"),("Dashboards","Live")],
        chart="line", layout="table"))
    made.append(erp_dashboard("ejadtech-odoo-work.svg", "ejadtech · Government", "DIGITAL TRANSFORMATION",
        EJAD, EJAD2,
        [("5","Ministries"),("Workflows","Automated"),("Approvals","Chained"),("RBAC","Secured")],
        chart="bar", layout="kanban"))

    # ── Public / company context ──
    re_ctx = [
        ("zia-business-complex.svg", "ZIA Business Complex", "NEW ADMIN CAPITAL"),
        ("oaks-egypt.svg",           "Oaks Egypt",           "NEW CAPITAL"),
        ("lusail-residence.svg",     "Lusail Residence",     "NEW CAIRO"),
        ("sheraton-residences.svg",  "Sheraton Residences",  "MOSTAKBAL CITY"),
    ]
    for fn, ti, se in re_ctx:
        made.append(context_cover(fn, ti, se, MARGINS, MARGINS2, motif="building"))

    eng_ctx = [
        ("cargill-engineering.svg",   "Cargill",             "ROBOTICS / CONVEYOR"),
        ("johnson-controls.svg",      "Johnson Controls",    "ROBOTICS / CONVEYOR"),
        ("pb-lodge.svg",              "PB Lodge",            "STRUCTURAL"),
        ("container-home-design.svg", "Container Home",      "DESIGN / STRUCTURAL"),
        ("smurfit-stone.svg",         "Smurfit Stone",       "INDUSTRIAL"),
        ("aerofil-technologies.svg",  "Aerofil Technologies","TECHNOLOGY"),
        ("reckitt-benckiser.svg",     "Reckitt Benckiser",   "CONSUMER GOODS"),
        ("city-grocers.svg",          "City Grocers",        "RETAIL FACILITY"),
    ]
    for fn, ti, se in eng_ctx:
        made.append(context_cover(fn, ti, se, BLUE, CYAN, motif="blueprint"))

    # ── Real-brand covers (embed the actual local logo assets) ──
    made.append(brand_cover("ejadtech-brand.svg",
        "assets/images/projects/ejadtech-odoo-work.webp", "ejadtech.sa",
        "EjadTech", "Government Digital Transformation · Odoo Delivery",
        EJAD, EJAD2, ["Odoo", "Gov Platforms", "KSA"], logo_w=560, logo_h=132))
    made.append(brand_cover("ejad-brand.svg",
        "assets/images/companies/ejad-digital-logo.png", "ejad.sa",
        "EJAD Digital Solutions", "Odoo Silver Partner · Enterprise ERP Delivery",
        EJAD, EJAD2, ["Silver Partner", "Odoo 14–20", "Creatio"], logo_w=500, logo_h=145))
    made.append(brand_cover("dotec-brand.svg",
        "assets/images/companies/dotec-logo.png", "dotecengineering.com",
        "DOTec Engineering", "Internal ERP · Project Lifecycle",
        BLUE, CYAN, ["Odoo 18", "Engineering", "USA"], logo_w=380, logo_h=132))

    print(f"Generated {len(made)} visuals into assets/images/projects/generated/")
    for m in made:
        print("  •", m)


if __name__ == "__main__":
    main()
