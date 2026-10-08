#!/usr/bin/env python3
"""
generate_eghr_visuals.py
------------------------
Builds the interface schematics used by the EGHR case study
(projects/eghr.html).

These are DIAGRAMS, not screenshots. They encode the real layout,
information architecture and state machine of the delivered EJAD EGHR
employee portal (screen regions, widget order, RTL mirroring, light/dark
surfaces, attendance states) without reproducing live HR records. The
case-study page labels them as schematics.

To replace them with real captures from a running instance, run
scripts/capture_eghr_screenshots.py on a machine that can reach the
portal; it writes WebP files next to these and repoints
assets/data/eghr-media.json at them.

Output: assets/images/projects/eghr/*.svg   (crisp, tiny, Pages-safe)
Run:    python3 scripts/generate_eghr_visuals.py
"""

import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets/images/projects/eghr")
os.makedirs(OUT, exist_ok=True)

# ── palettes ────────────────────────────────────────────────
PAL = {
    "dark": dict(
        back="#081220", shell="#0c1a2e", panel="#132544", panel2="#182f52",
        line="#27456f", txt="#eaf1ff", txt2="#9db4d8", txt3="#6b82a8",
        acc="#22d3ee", acc2="#2563eb", chip="#16294a", skel="#1d365c",
    ),
    "light": dict(
        back="#e7edf6", shell="#ffffff", panel="#ffffff", panel2="#f3f7fc",
        line="#d9e3f0", txt="#101c30", txt2="#4a5a76", txt3="#8296b4",
        acc="#0e7490", acc2="#2563eb", chip="#eef3fa", skel="#e4ebf5",
    ),
}
OK, WARN, DANGER, INFO, VIOLET = "#16a34a", "#d4a843", "#dc2626", "#2563eb", "#8b5cf6"

FS = "Inter,'Segoe UI',system-ui,sans-serif"
FA = "'Segoe UI','Tahoma',Arial,sans-serif"   # has Arabic glyphs on most systems


def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


# ── primitives ──────────────────────────────────────────────
def defs(p):
    return f'''<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{p['back']}"/><stop offset="1" stop-color="{p['shell']}"/>
    </linearGradient>
    <linearGradient id="acc" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="{p['acc2']}"/><stop offset="1" stop-color="{p['acc']}"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.07"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="{p['acc2']}" stop-opacity="0.38"/>
      <stop offset="1" stop-color="{p['acc2']}" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="22"/></filter>
  </defs>'''


def t(x, y, s, size=13, weight="500", fill=None, anchor="start", rtl=False, op=None):
    f = FA if rtl else FS
    d = ' direction="rtl"' if rtl else ""
    o = f' opacity="{op}"' if op else ""
    return (f'<text x="{x:.0f}" y="{y:.0f}" font-family="{f}" font-size="{size}" '
            f'font-weight="{weight}" fill="{fill}" text-anchor="{anchor}"{d}{o}>{esc(s)}</text>')


def rr(x, y, w, h, r=10, fill="none", stroke=None, sw=1, op=None):
    s = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
    o = f' opacity="{op}"' if op else ""
    return (f'<rect x="{x:.0f}" y="{y:.0f}" width="{w:.0f}" height="{h:.0f}" '
            f'rx="{r}" fill="{fill}"{s}{o}/>')


def skel(p, x, y, w, h=8, op="1"):
    """A neutral text-placeholder bar — stands in for employee data."""
    return rr(x, y, w, h, h / 2, p["skel"], op=op)


def pill(p, x, y, label, color, w=None, rtl=False, trail=False):
    """trail=True anchors the pill at the row's trailing edge (mirrors for RTL)."""
    w = w or max(58, 8 * len(label) + 22)
    x0 = (x if rtl else x - w) if trail else x
    return (rr(x0, y, w, 24, 12, color, op="0.16")
            + rr(x0, y, w, 24, 12, "none", color, 1, "0.5")
            + t(x0 + w / 2, y + 16, label, 11, "700", color, "middle"))


def icon_tile(p, x, y, s, color, glyph=""):
    return (rr(x, y, s, s, s * 0.3, color, op="0.16")
            + rr(x, y, s, s, s * 0.3, "none", color, 1, "0.45")
            + (t(x + s / 2, y + s * 0.68, glyph, int(s * 0.5), "700", color, "middle") if glyph else ""))


# ── desktop portal shell ────────────────────────────────────
W, H = 1440, 900
SB = 248          # sidebar width
PAD = 36
CHROME, TOPBAR = 52, 64     # browser chrome height, portal topbar height
CY = CHROME + TOPBAR        # 116
CX0_LTR, CX0_RTL = SB + PAD, PAD
CW = W - SB - PAD * 2       # 1120
CY0 = CY + PAD              # 152

NAV_EN = ["Dashboard", "Attendance", "My Requests", "My Actions",
          "Services", "Announcements", "Profile"]
NAV_AR = ["لوحة المعلومات", "الحضور", "طلباتي", "إجراءاتي",
          "الخدمات", "الإعلانات", "الملف الشخصي"]


def shell(theme, rtl, active, body, url="portal.eghr.local/my"):
    """Browser chrome + portal top bar + primary nav + body."""
    p = PAL[theme]
    nav = NAV_AR if rtl else NAV_EN
    sx = W - SB if rtl else 0
    o = []
    o.append(f'<rect width="{W}" height="{H}" fill="url(#bg)"/>')
    o.append(f'<ellipse cx="{W*0.78 if not rtl else W*0.22}" cy="60" rx="540" ry="300" '
             f'fill="url(#glow)" filter="url(#soft)" opacity="0.8"/>')

    # browser chrome
    o.append(rr(0, 0, W, CHROME, 0, p["panel2"]))
    o.append(f'<line x1="0" y1="{CHROME}" x2="{W}" y2="{CHROME}" stroke="{p["line"]}" stroke-width="1"/>')
    for i, c in enumerate(("#ff5f57", "#febc2e", "#28c840")):
        o.append(f'<circle cx="{26+i*20}" cy="{CHROME/2}" r="6" fill="{c}"/>')
    o.append(rr(W / 2 - 220, 14, 440, 24, 12, p["chip"], p["line"]))
    o.append(t(W / 2, 30, "🔒  " + url, 12, "500", p["txt3"], "middle"))

    # portal top bar
    o.append(rr(0, CHROME, W, TOPBAR, 0, p["shell"]))
    o.append(f'<line x1="0" y1="{CY}" x2="{W}" y2="{CY}" stroke="{p["line"]}" stroke-width="1"/>')
    bx = W - 36 if rtl else 36
    o.append(rr(bx - 36 if rtl else bx, CHROME + 16, 36, 32, 9, "url(#acc)"))
    o.append(t((bx - 18) if rtl else (bx + 18), CHROME + 37, "EG", 13, "800", "#fff", "middle"))
    lx = (bx - 46) if rtl else (bx + 46)
    o.append(t(lx, CHROME + 32, "EGHR" if not rtl else "بوابة الموظف",
               14, "800", p["txt"], "start", rtl))
    o.append(t(lx, CHROME + 49, "Employee Portal" if not rtl else "EGHR",
               10.5, "500", p["txt3"], "start", rtl))

    # top-bar right controls (mirrored)
    gx = 36 if rtl else W - 36
    def ctl(off, w, label, fill=None):
        x = (gx + off) if rtl else (gx - off - w)
        return (rr(x, CHROME + 17, w, 30, 15, fill or p["chip"], p["line"])
                + t(x + w / 2, CHROME + 36, label, 11, "600", p["txt2"], "middle"))
    o.append(ctl(0, 70, "AR  |  EN" if not rtl else "EN  |  ع"))
    o.append(ctl(78, 38, "◐"))
    o.append(ctl(124, 38, "🔔"))
    ax = (gx + 170) if rtl else (gx - 170 - 32)
    o.append(f'<circle cx="{ax+16}" cy="{CHROME+32}" r="16" fill="{p["acc2"]}" opacity="0.25"/>')
    o.append(f'<circle cx="{ax+16}" cy="{CHROME+32}" r="16" fill="none" stroke="{p["acc"]}" stroke-opacity="0.5"/>')

    # sidebar
    o.append(rr(sx, CY, SB, H - CY, 0, p["shell"], op="0.9"))
    ln = sx if rtl else sx + SB
    o.append(f'<line x1="{ln}" y1="{CY}" x2="{ln}" y2="{H}" stroke="{p["line"]}" stroke-width="1"/>')
    o.append(t(sx + (SB - 24 if rtl else 24), CY + 38,
               "MENU" if not rtl else "القائمة", 10, "700", p["txt3"],
               "start", rtl))
    for i, label in enumerate(nav):
        y = CY + 56 + i * 48
        on = (i == active)
        if on:
            o.append(rr(sx + 12, y, SB - 24, 40, 11, p["acc2"], op="0.18"))
            o.append(rr(sx + (SB - 15 if rtl else 12), y + 8, 3, 24, 2, p["acc"]))
        ix = sx + (SB - 36 if rtl else 20)
        o.append(f'<circle cx="{ix+8}" cy="{y+20}" r="7" fill="none" '
                 f'stroke="{p["acc"] if on else p["txt3"]}" stroke-width="1.6"/>')
        tx = sx + (SB - 56 if rtl else 44)
        o.append(t(tx, y + 25, label, 13, "700" if on else "500",
                   p["txt"] if on else p["txt2"], "start", rtl))

    o.append(body)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
            f'role="img">{defs(p)}' + "".join(o) + "</svg>")


def write(name, svg):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        f.write(svg)
    print("  ", name, f"{len(svg)/1024:.1f} KB")


# ── content-box coordinate helper (mirrors for RTL) ─────────
class C:
    """Local content coordinates (0..CW) mapped to absolute, mirrored for RTL."""

    def __init__(self, rtl):
        self.rtl = rtl
        self.ox = CX0_RTL if rtl else CX0_LTR

    def x(self, lx, lw=0):
        return self.ox + (CW - lx - lw) if self.rtl else self.ox + lx

    def lead(self, lx, lw=0):
        """x for text that starts at the reading edge of a block."""
        return self.x(lx, lw) + (lw if self.rtl else 0)

    def trail(self, lx, lw=0):
        """x for text at the far edge of a block."""
        return self.x(lx, lw) + (0 if self.rtl else lw)

    # text-anchor is resolved against the inline base direction, which t() already
    # sets from rtl — so the anchor keyword itself never mirrors.
    anc = "start"
    anc2 = "end"


def card(p, c, lx, y, lw, h, title=None, meta=None, accent=None):
    o = [rr(c.x(lx, lw), y, lw, h, 16, p["panel"], p["line"]),
         rr(c.x(lx, lw), y, lw, min(h, 90), 16, "url(#sheen)")]
    if accent:
        o.append(rr(c.x(lx, lw) + (lw - 3 if c.rtl else 0), y + 16, 3, 34, 2, accent))
    if title:
        o.append(t(c.lead(lx + 20, lw - 40), y + 32, title, 14.5, "700", p["txt"], c.anc, c.rtl))
    if meta:
        o.append(t(c.trail(lx + 20, lw - 40), y + 31, meta, 11.5, "600", p["txt3"], c.anc2, c.rtl))
    return "".join(o)


def kpi(p, c, lx, y, lw, h, label, value, foot, color, bar_pct=None):
    o = [card(p, c, lx, y, lw, h, accent=color)]
    o.append(t(c.lead(lx + 20, lw - 40), y + 30, label, 11, "700", p["txt3"], c.anc, c.rtl))
    o.append(t(c.lead(lx + 20, lw - 40), y + 68, value, 27, "800", p["txt"], c.anc, c.rtl))
    o.append(t(c.lead(lx + 20, lw - 40), y + 94, foot, 11.5, "500", p["txt2"], c.anc, c.rtl))
    if bar_pct is not None:
        o.append(rr(c.x(lx + 20, lw - 40), y + h - 24, lw - 40, 6, 3, p["chip"]))
        bw = (lw - 40) * bar_pct
        o.append(rr(c.x(lx + 20, lw - 40) + ((lw - 40 - bw) if c.rtl else 0), y + h - 24, bw, 6, 3, color))
    return "".join(o)


def row(p, c, lx, y, lw, cols, h=46, status=None, scolor=None, skelw=None):
    """A table/list row: leading label block + optional trailing status pill."""
    o = [rr(c.x(lx, lw), y, lw, h, 10, p["panel2"], op="0.75")]
    o.append(t(c.lead(lx + 16, lw - 32), y + h / 2 - 2, cols[0], 12.5, "600", p["txt"], c.anc, c.rtl))
    if len(cols) > 1:
        o.append(t(c.lead(lx + 16, lw - 32), y + h / 2 + 14, cols[1], 10.5, "500", p["txt3"], c.anc, c.rtl))
    if skelw:
        o.append(skel(p, c.x(lx + lw * 0.52, skelw), y + h / 2 - 10, skelw, 7, "0.9"))
    if status:
        o.append(pill(p, c.trail(lx + 16, lw - 32), y + h / 2 - 12, status, scolor,
                      rtl=c.rtl, trail=True))
    return "".join(o)


def geofence(p, cx, cy, r, state):
    """Attendance map ring. state: inside | outside | locating | off"""
    col = {"inside": OK, "outside": DANGER, "locating": INFO, "off": p["txt3"]}[state]
    dash = ' stroke-dasharray="6 7"' if state in ("locating", "off") else ''
    o = [f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{col}" opacity="0.10"/>',
         f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{col}" '
         f'stroke-width="1.6" stroke-opacity="0.65"{dash}/>',
         f'<circle cx="{cx}" cy="{cy}" r="{r*0.56}" fill="none" stroke="{col}" '
         f'stroke-width="1" stroke-opacity="0.35"/>']
    if state == "inside":
        o.append(f'<circle cx="{cx}" cy="{cy-r*0.18}" r="7" fill="{OK}"/>')
        o.append(f'<circle cx="{cx}" cy="{cy-r*0.18}" r="13" fill="none" stroke="{OK}" stroke-opacity="0.6"/>')
    elif state == "outside":
        o.append(f'<circle cx="{cx+r*1.18}" cy="{cy-r*0.4}" r="7" fill="{DANGER}"/>')
        o.append(f'<path d="M{cx+r*0.72} {cy-r*0.26} L{cx+r*1.1} {cy-r*0.37}" stroke="{DANGER}" '
                 f'stroke-width="1.4" stroke-dasharray="4 4"/>')
    elif state == "locating":
        o.append(f'<circle cx="{cx}" cy="{cy}" r="{r*0.22}" fill="{INFO}" opacity="0.5"/>')
    return "".join(o)


# ── bilingual label table ───────────────────────────────────
LAB = {
    "hi":            ("Good morning", "صباح الخير"),
    "hi_sub":        ("Here is your day at a glance.", "هذه نظرة سريعة على يومك."),
    "today":         ("TODAY", "اليوم"),
    "checked_in":    ("Checked in 08:54", "تم تسجيل الحضور ٨:٥٤"),
    "check_out":     ("Check out", "تسجيل الانصراف"),
    "check_in":      ("Check in", "تسجيل الحضور"),
    "work_hours":    ("OFFICIAL WORKING HOURS", "ساعات العمل الرسمية"),
    "work_val":      ("08:30 – 17:00", "٠٨:٣٠ – ١٧:٠٠"),
    "work_foot":     ("Sunday – Thursday", "الأحد – الخميس"),
    "leave":         ("ANNUAL LEAVE BALANCE", "رصيد الإجازة السنوية"),
    "leave_foot":    ("days remaining", "يوم متبقٍ"),
    "requests_kpi":  ("OPEN REQUESTS", "الطلبات المفتوحة"),
    "requests_foot": ("awaiting approval", "في انتظار الموافقة"),
    "services":      ("Employee services", "خدمات الموظفين"),
    "all":           ("View all", "عرض الكل"),
    "announce":      ("Announcements", "الإعلانات"),
    "recent_att":    ("Recent attendance", "سجل الحضور"),
    "my_requests":   ("My requests", "طلباتي"),
    "my_actions":    ("My actions", "إجراءاتي"),
    "timeline":      ("Approval timeline", "مسار الموافقة"),
    "attendance":    ("Attendance", "الحضور"),
    "profile":       ("Profile", "الملف الشخصي"),
    "submit":        ("Submit request", "إرسال الطلب"),
    "cancel":        ("Cancel", "إلغاء"),
    "pending":       ("Pending", "قيد الانتظار"),
    "approved":      ("Approved", "مقبول"),
    "rejected":      ("Rejected", "مرفوض"),
    "draft":         ("Draft", "مسودة"),
    "present":       ("Present", "حاضر"),
    "late":          ("Late", "متأخر"),
    "review":        ("Review", "مراجعة"),
    "search":        ("Search services", "ابحث في الخدمات"),
}

SERVICES = [
    ("Time Off", "الإجازات", INFO),
    ("Advance Salary", "سلفة راتب", WARN),
    ("Loans", "السلف والقروض", VIOLET),
    ("Ticket Booking", "حجز تذاكر", "#0ea5b7"),
    ("Visa", "تأشيرات", OK),
    ("Business Trip", "مهمة عمل", INFO),
    ("End of Service", "نهاية الخدمة", DANGER),
    ("Custody", "العُهد", WARN),
    ("Data Update", "تحديث البيانات", VIOLET),
    ("Permission", "استئذان", "#0ea5b7"),
    ("Job Request", "طلب وظيفة", OK),
]


def w(key, rtl):
    return LAB[key][1 if rtl else 0]


def svc(i, rtl):
    s = SERVICES[i]
    return (s[1] if rtl else s[0]), s[2]


# ── screen: dashboard ───────────────────────────────────────
def dashboard(theme, rtl):
    p, c = PAL[theme], C(rtl)
    o = []
    o.append(t(c.lead(0, CW), CY0 + 26, w("hi", rtl), 24, "800", p["txt"], c.anc, c.rtl))
    o.append(t(c.lead(0, CW), CY0 + 50, w("hi_sub", rtl), 13, "500", p["txt3"], c.anc, c.rtl))

    # KPI row
    ky, kh, kw = 208, 136, 262
    o.append(kpi(p, c, 0, ky, kw, kh, w("today", rtl), "08:54",
                 w("checked_in", rtl), OK))
    o.append(rr(c.x(20, 104), ky + kh - 30, 104, 24, 12, OK, op="0.16"))
    o.append(t(c.x(20, 104) + 52, ky + kh - 13,
               w("check_out", rtl), 10.5, "700", OK, "middle", rtl))
    o.append(kpi(p, c, 286, ky, kw, kh, w("work_hours", rtl), w("work_val", rtl),
                 w("work_foot", rtl), INFO, 0.48))
    o.append(kpi(p, c, 572, ky, kw, kh, w("leave", rtl), "١٨" if rtl else "18",
                 w("leave_foot", rtl), WARN, 0.6))
    o.append(kpi(p, c, 858, ky, kw, kh, w("requests_kpi", rtl), "٣" if rtl else "3",
                 w("requests_foot", rtl), VIOLET))

    # services panel
    my, mh = 360, 240
    o.append(card(p, c, 0, my, 680, mh, w("services", rtl), w("all", rtl)))
    for i in range(6):
        gx, gy = 20 + (i % 3) * 214, my + 56 + (i // 3) * 86
        name, col = svc(i, rtl)
        o.append(rr(c.x(gx, 200), gy, 200, 72, 12, p["panel2"], p["line"]))
        o.append(icon_tile(p, c.x(gx + 14, 36), gy + 18, 36, col))
        o.append(t(c.lead(gx + 62, 124), gy + 36, name, 12.5, "700", p["txt"], c.anc, c.rtl))
        o.append(t(c.lead(gx + 62, 124), gy + 54,
                   "Request" if not rtl else "تقديم طلب", 10.5, "500", p["txt3"], c.anc, c.rtl))

    # announcements panel
    o.append(card(p, c, 704, my, 416, mh, w("announce", rtl), "3"))
    for i, (col, en, ar) in enumerate([
            (WARN, "Payroll cut-off reminder", "تنبيه موعد إقفال الرواتب"),
            (INFO, "New HR service available", "خدمة موارد بشرية جديدة"),
            (OK, "Eid holiday schedule", "جدول عطلة العيد")]):
        ry = my + 56 + i * 60
        o.append(rr(c.x(724, 376), ry, 376, 50, 10, p["panel2"], op="0.75"))
        o.append(rr(c.x(724 + (373 if rtl else 0), 3), ry, 3, 50, 2, col))
        o.append(t(c.lead(740, 344), ry + 22, ar if rtl else en, 12, "700", p["txt"], c.anc, c.rtl))
        o.append(skel(p, c.x(740, 210), ry + 32, 210, 7))

    # recent attendance table
    by, bh = 616, 248
    o.append(card(p, c, 0, by, 680, bh, w("recent_att", rtl), w("all", rtl)))
    days_en = ["Mon 06", "Sun 05", "Thu 02", "Wed 01"]
    days_ar = ["الاثنين ٠٦", "الأحد ٠٥", "الخميس ٠٢", "الأربعاء ٠١"]
    for i in range(4):
        ry = by + 56 + i * 46
        st, col = ((w("late", rtl), WARN) if i == 2 else (w("present", rtl), OK))
        span = ("٠٨:٥٤ — ١٧:٠٦" if rtl else "08:54 → 17:06") if i != 2 \
            else ("٠٩:٣١ — ١٧:١٢" if rtl else "09:31 → 17:12")
        o.append(row(p, c, 20, ry, 640, [days_ar[i] if rtl else days_en[i], span], 40, st, col))

    # my requests mini list
    o.append(card(p, c, 704, by, 416, bh, w("my_requests", rtl), w("all", rtl)))
    for i, (en, ar, st, col) in enumerate([
            ("Time Off · 3 days", "إجازة · ٣ أيام", "pending", WARN),
            ("Advance Salary", "سلفة راتب", "approved", OK),
            ("Business Trip", "مهمة عمل", "review", INFO)]):
        ry = by + 56 + i * 56
        o.append(row(p, c, 724, ry, 376, [ar if rtl else en,
                                          "EGHR-104" + str(2 - i)], 48,
                     w(st, rtl), col))
    return shell(theme, rtl, 0, "".join(o))


def page_head(p, c, title, sub=None, tabs=None, active=0):
    o = [t(c.lead(0, CW), CY0 + 26, title, 24, "800", p["txt"], c.anc, c.rtl)]
    if sub:
        o.append(t(c.lead(0, CW), CY0 + 50, sub, 13, "500", p["txt3"], c.anc, c.rtl))
    if tabs:
        x = 0
        for i, label in enumerate(tabs):
            tw = 11 * len(label) + 34
            on = i == active
            o.append(rr(c.x(x, tw), CY0 + 72, tw, 36, 18,
                        p["acc2"] if on else p["panel"], None if on else p["line"]))
            o.append(t(c.x(x, tw) + tw / 2, CY0 + 95, label, 12, "700",
                       "#fff" if on else p["txt2"], "middle", c.rtl))
            x += tw + 10
    return "".join(o)


def table(p, c, lx, y, lw, head, rows, rh=52):
    o = [rr(c.x(lx, lw), y, lw, 46 + len(rows) * rh + 18, 16, p["panel"], p["line"]),
         rr(c.x(lx, lw), y, lw, 46, 16, p["panel2"])]
    colx = [0.04, 0.30, 0.55, 0.74]
    for i, h in enumerate(head):
        o.append(t(c.lead(lx + lw * colx[i], 0), y + 29, h, 10.5, "700", p["txt3"], c.anc, c.rtl))
    for r, (cells, st, col) in enumerate(rows):
        ry = y + 46 + r * rh
        o.append(f'<line x1="{c.x(lx+14,lw-28)}" y1="{ry}" x2="{c.x(lx+14,lw-28)+lw-28}" '
                 f'y2="{ry}" stroke="{p["line"]}" stroke-width="1" stroke-opacity="0.6"/>')
        for i, cell in enumerate(cells):
            o.append(t(c.lead(lx + lw * colx[i], 0), ry + rh / 2 + 4, cell,
                       12.5 if i == 0 else 12, "700" if i == 0 else "500",
                       p["txt"] if i == 0 else p["txt2"], c.anc, c.rtl))
        o.append(pill(p, c.trail(lx + 18, lw - 36), ry + rh / 2 - 12, st, col,
                      rtl=c.rtl, trail=True))
    return "".join(o)


# ── screen: My Requests / My Actions ────────────────────────
def requests_screen(theme, rtl, mode="requests"):
    p, c = PAL[theme], C(rtl)
    mine = mode == "requests"
    tabs = ([w("my_requests", rtl), w("my_actions", rtl), w("draft", rtl)]
            if mine else [w("my_actions", rtl), w("my_requests", rtl)])
    o = [page_head(p, c, w("my_requests" if mine else "my_actions", rtl),
                   ("All requests you raised, across every service."
                    if mine else "Requests waiting on your approval, by delegated role.")
                   if not rtl else ("كل الطلبات التي قدمتها عبر جميع الخدمات."
                                    if mine else "الطلبات التي تنتظر موافقتك."),
                   tabs, 0)]
    head_en = (["REQUEST", "SERVICE", "SUBMITTED", "STAGE"] if mine
               else ["REQUEST", "EMPLOYEE", "SERVICE", "WAITING SINCE"])
    head_ar = (["الطلب", "الخدمة", "تاريخ التقديم", "المرحلة"] if mine
               else ["الطلب", "الموظف", "الخدمة", "منتظر منذ"])
    data = []
    seed = [("EGHR-1042", "Time Off", "إجازة", "pending", WARN),
            ("EGHR-1041", "Advance Salary", "سلفة راتب", "approved", OK),
            ("EGHR-1038", "Business Trip", "مهمة عمل", "review", INFO),
            ("EGHR-1035", "Custody", "العُهد", "approved", OK),
            ("EGHR-1031", "Ticket Booking", "حجز تذاكر", "rejected", DANGER),
            ("EGHR-1028", "Permission", "استئذان", "approved", OK),
            ("EGHR-1024", "Data Update", "تحديث البيانات", "pending", WARN)]
    for ref, en, ar, st, col in seed:
        if mine:
            cells = [ref, ar if rtl else en, "٠٦ / ١٠" if rtl else "06 Oct", w(st, rtl)]
        else:
            cells = [ref, "—  —  —", ar if rtl else en, "٢ أيام" if rtl else "2 days"]
        data.append((cells, w(st, rtl), col))
    o.append(table(p, c, 0, CY0 + 128, CW, head_ar if rtl else head_en, data))
    return shell(theme, rtl, 2 if mine else 3, "".join(o))


# ── screen: request detail + approval timeline ──────────────
def request_detail(theme, rtl):
    p, c = PAL[theme], C(rtl)
    o = [page_head(p, c, "EGHR-1042 · " + (SERVICES[0][1] if rtl else SERVICES[0][0]),
                   "Annual leave · 3 days" if not rtl else "إجازة سنوية · ٣ أيام")]
    y = CY0 + 88
    # summary card
    o.append(card(p, c, 0, y, 660, 300, "Request details" if not rtl else "تفاصيل الطلب",
                  w("pending", rtl), WARN))
    fields_en = [("Service", "Time Off"), ("Leave type", "Annual"),
                 ("From", "12 Oct 2026"), ("To", "14 Oct 2026"),
                 ("Working days", "3"), ("Balance after", "15 days")]
    fields_ar = [("الخدمة", "الإجازات"), ("نوع الإجازة", "سنوية"),
                 ("من", "١٢ أكتوبر ٢٠٢٦"), ("إلى", "١٤ أكتوبر ٢٠٢٦"),
                 ("أيام العمل", "٣"), ("الرصيد بعد", "١٥ يوم")]
    for i, (k, v) in enumerate(fields_ar if rtl else fields_en):
        fx, fy = 20 + (i % 2) * 320, y + 58 + (i // 2) * 62
        o.append(rr(c.x(fx, 300), fy, 300, 48, 10, p["panel2"], op="0.7"))
        o.append(t(c.lead(fx + 14, 272), fy + 20, k, 10.5, "700", p["txt3"], c.anc, c.rtl))
        o.append(t(c.lead(fx + 14, 272), fy + 37, v, 12.5, "600", p["txt"], c.anc, c.rtl))
    o.append(rr(c.x(20, 300), y + 250, 300, 34, 10, p["panel2"], p["line"]))
    o.append(t(c.lead(34, 272), y + 272, "Attachment · leave-form.pdf" if not rtl
               else "مرفق · نموذج-إجازة.pdf", 11.5, "600", p["txt2"], c.anc, c.rtl))

    # approval timeline
    o.append(card(p, c, 684, y, 436, 300, w("timeline", rtl)))
    steps_en = [("Submitted", "Employee", OK), ("Line manager", "Approved", OK),
                ("HR review", "In progress", WARN), ("Payroll", "Not started", None)]
    steps_ar = [("تم الإرسال", "الموظف", OK), ("المدير المباشر", "تم القبول", OK),
                ("مراجعة الموارد البشرية", "جارية", WARN), ("الرواتب", "لم تبدأ", None)]
    rail, tx = c.x(684 + 32), c.x(684 + 58)
    for i, (k, v, col) in enumerate(steps_ar if rtl else steps_en):
        sy = y + 66 + i * 56
        cc = col or p["txt3"]
        dash = ' stroke-dasharray="4 4"' if i >= 1 else ''
        o.append(f'<circle cx="{rail:.0f}" cy="{sy}" r="8" fill="{cc}" '
                 f'opacity="{0.95 if col else 0.35}"/>')
        if i < 3:
            o.append(f'<line x1="{rail:.0f}" y1="{sy+10}" x2="{rail:.0f}" y2="{sy+46}" '
                     f'stroke="{cc}" stroke-width="2" stroke-opacity="0.45"{dash}/>')
        o.append(t(tx, sy - 1, k, 12.5, "700", p["txt"], c.anc, c.rtl))
        o.append(t(tx, sy + 16, v, 11, "500", cc, c.anc, c.rtl))
    return shell(theme, rtl, 2, "".join(o))


# ── screen: attendance ──────────────────────────────────────
def attendance_screen(theme, rtl, state="inside"):
    p, c = PAL[theme], C(rtl)
    o = [page_head(p, c, w("attendance", rtl),
                   "Check-in is validated against the office geofence on the server."
                   if not rtl else "يتم التحقق من الحضور مقابل النطاق الجغرافي على الخادم.")]
    y = CY0 + 88
    o.append(card(p, c, 0, y, 540, 330, "Today" if not rtl else "اليوم",
                  "٠٦ أكتوبر ٢٠٢٦" if rtl else "06 Oct 2026"))
    o.append(geofence(p, c.x(20, 300) + 150, y + 190, 112, state))
    cols = {"inside": OK, "outside": DANGER, "locating": INFO, "off": p["txt3"]}
    msg_en = {"inside": "Inside office zone · 42 m", "outside": "Outside office zone · 1.8 km",
              "locating": "Locating…", "off": "Location permission required"}
    msg_ar = {"inside": "داخل نطاق المكتب · ٤٢ م", "outside": "خارج نطاق المكتب · ١٫٨ كم",
              "locating": "جارٍ تحديد الموقع…", "off": "مطلوب إذن الموقع"}
    o.append(t(c.lead(330, 190), y + 110, (msg_ar if rtl else msg_en)[state],
               13, "700", cols[state], c.anc, c.rtl))
    o.append(t(c.lead(330, 190), y + 150, "08:54", 30, "800", p["txt"], c.anc, c.rtl))
    o.append(t(c.lead(330, 190), y + 172, "Check-in time" if not rtl else "وقت الحضور",
               11, "500", p["txt3"], c.anc, c.rtl))
    btn = OK if state == "inside" else p["txt3"]
    o.append(rr(c.x(330, 190), y + 210, 190, 42, 21, btn, op="0.18"))
    o.append(rr(c.x(330, 190), y + 210, 190, 42, 21, "none", btn, 1, "0.55"))
    o.append(t(c.x(330, 190) + 95, y + 237,
               w("check_out", rtl) if state == "inside" else w("check_in", rtl),
               12.5, "700", btn, "middle", c.rtl))

    o.append(card(p, c, 564, y, 556, 330, "This month" if not rtl else "هذا الشهر", "22 / 22"))
    # bar chart of daily hours
    for i in range(22):
        bx = 584 + i * 24
        hh = 48 + (i * 37 % 46)
        col = WARN if i % 7 == 3 else p["acc2"]
        o.append(rr(c.x(bx, 14), y + 250 - hh, 14, hh, 5, col, op="0.85"))
    o.append(f'<line x1="{c.x(584, 528)}" y1="{y+254}" x2="{c.x(584,528)+528}" y2="{y+254}" '
             f'stroke="{p["line"]}" stroke-width="1"/>')
    for i, (en, ar, col) in enumerate([("Present 20", "حاضر ٢٠", OK),
                                       ("Late 2", "متأخر ٢", WARN),
                                       ("Absent 0", "غياب ٠", DANGER)]):
        o.append(pill(p, c.x(584 + i * 130, 112), y + 276,
                      ar if rtl else en, col, 112, rtl=c.rtl))

    # Attendance log fills the lower half of the screen
    ly = y + 350
    o.append(card(p, c, 0, ly, CW, 274, w("recent_att", rtl), w("all", rtl)))
    head_en = ["DAY", "CHECK IN", "CHECK OUT", "WORKED"]
    head_ar = ["اليوم", "الحضور", "الانصراف", "ساعات العمل"]
    days_en = ["Mon 06", "Sun 05", "Thu 02", "Wed 01", "Tue 30"]
    days_ar = ["الاثنين ٠٦", "الأحد ٠٥", "الخميس ٠٢",
               "الأربعاء ٠١", "الثلاثاء ٣٠"]
    rows = []
    for i in range(4):
        late = (i == 2)
        st, col = ((w("late", rtl), WARN) if late else (w("present", rtl), OK))
        ci = ("٠٩:٣١" if rtl else "09:31") if late else ("٠٨:٥٤" if rtl else "08:54")
        co = "١٧:١٢" if rtl else "17:12"
        wk = ("٧س ٤٢د" if rtl else "7h 41m") if late else ("٨س ١٢د" if rtl else "8h 12m")
        rows.append(([days_ar[i] if rtl else days_en[i], ci, co, wk], st, col))
    o.append(table(p, c, 0, ly + 42, CW, head_ar if rtl else head_en, rows, 40))
    return shell(theme, rtl, 1, "".join(o))


# ── screen: services catalog ────────────────────────────────
def services_screen(theme, rtl):
    p, c = PAL[theme], C(rtl)
    o = [page_head(p, c, w("services", rtl),
                   "Every service is a registry entry — adding one needs no portal rewrite."
                   if not rtl else "كل خدمة مُسجَّلة في سجل الخدمات — إضافة خدمة لا تتطلب تعديل البوابة.")]
    y = CY0 + 80
    o.append(rr(c.x(0, 420), y, 420, 42, 21, p["panel"], p["line"]))
    o.append(t(c.lead(18, 384), y + 27, "⌕   " + w("search", rtl), 12.5, "500", p["txt3"], c.anc, c.rtl))
    x = 444
    for i, (en, ar) in enumerate([("All", "الكل"), ("Leave", "الإجازات"),
                                  ("Finance", "المالية"), ("Travel", "السفر"),
                                  ("Data", "البيانات")]):
        label = ar if rtl else en
        tw = 11 * len(label) + 32
        o.append(rr(c.x(x, tw), y + 3, tw, 36, 18, p["acc2"] if i == 0 else p["panel"],
                    None if i == 0 else p["line"]))
        o.append(t(c.x(x, tw) + tw / 2, y + 26, label, 12, "700",
                   "#fff" if i == 0 else p["txt2"], "middle", c.rtl))
        x += tw + 10
    for i in range(len(SERVICES)):
        gx, gy = (i % 4) * 283, y + 70 + (i // 4) * 142
        name, col = svc(i, rtl)
        o.append(rr(c.x(gx, 263), gy, 263, 122, 14, p["panel"], p["line"]))
        o.append(icon_tile(p, c.x(gx + 20, 44), gy + 20, 44, col))
        o.append(t(c.lead(gx + 20, 223), gy + 86, name, 13.5, "700", p["txt"], c.anc, c.rtl))
        o.append(t(c.lead(gx + 20, 223), gy + 105,
                   "Open form →" if not rtl else "← فتح النموذج", 11, "600", col, c.anc, c.rtl))
    return shell(theme, rtl, 4, "".join(o))


# ── screen: service request form ────────────────────────────
def service_form(theme, rtl):
    p, c = PAL[theme], C(rtl)
    o = [page_head(p, c, (SERVICES[0][1] if rtl else SERVICES[0][0]),
                   "New request" if not rtl else "طلب جديد")]
    y = CY0 + 80
    o.append(card(p, c, 0, y, 700, 568, "Request form" if not rtl else "نموذج الطلب"))
    fields_en = [("Leave type", "Annual", 0), ("Reason", "", 0),
                 ("From date", "12 Oct 2026", 1), ("To date", "14 Oct 2026", 1),
                 ("Working days", "3", 1), ("Balance after", "15", 1),
                 ("Delegate to", "", 0), ("Attachment", "leave-form.pdf", 0)]
    fields_ar = [("نوع الإجازة", "سنوية", 0), ("السبب", "", 0),
                 ("من تاريخ", "١٢ أكتوبر", 1), ("إلى تاريخ", "١٤ أكتوبر", 1),
                 ("أيام العمل", "٣", 1), ("الرصيد بعد", "١٥", 1),
                 ("تفويض إلى", "", 0), ("مرفق", "نموذج-إجازة.pdf", 0)]
    yy, col = y + 56, 0
    for k, v, half in (fields_ar if rtl else fields_en):
        fw = 322 if half else 660
        fx = 20 + (col * 338 if half else 0)
        o.append(t(c.lead(fx, fw), yy + 12, k, 10.5, "700", p["txt3"], c.anc, c.rtl))
        o.append(rr(c.x(fx, fw), yy + 20, fw, 42, 10, p["panel2"], p["line"]))
        if v:
            o.append(t(c.lead(fx + 14, fw - 28), yy + 47, v, 12.5, "600", p["txt"], c.anc, c.rtl))
        else:
            o.append(skel(p, c.x(fx + 14, 190), yy + 37, 190, 8))
        if half and col == 0:
            col = 1
        else:
            col = 0
            yy += 78
    o.append(rr(c.x(20, 180), y + 500, 180, 44, 22, "url(#acc)"))
    o.append(t(c.x(20, 180) + 90, y + 528, w("submit", rtl), 13, "700", "#fff", "middle", c.rtl))
    o.append(rr(c.x(214, 120), y + 500, 120, 44, 22, p["panel2"], p["line"]))
    o.append(t(c.x(214, 120) + 60, y + 528, w("cancel", rtl), 13, "700", p["txt2"], "middle", c.rtl))

    o.append(card(p, c, 724, y, 396, 568,
                  "Policy & validation" if not rtl else "السياسة والتحقق", None, INFO))
    notes_en = ["Balance checked server-side on submit.",
                "Overlapping leave is blocked by constraint.",
                "Approval route resolved from the employee's manager chain.",
                "Draft is kept until the employee submits.",
                "Attachment types and size are validated."]
    notes_ar = ["يتم التحقق من الرصيد على الخادم عند الإرسال.",
                "يُمنع تعارض الإجازات عبر قيد على مستوى النموذج.",
                "يُحدَّد مسار الموافقة من سلسلة مديري الموظف.",
                "تُحفظ المسودة حتى يرسل الموظف الطلب.",
                "يتم التحقق من نوع وحجم المرفق."]
    for i, n in enumerate(notes_ar if rtl else notes_en):
        ny = y + 62 + i * 72
        o.append(rr(c.x(744, 356), ny, 356, 58, 10, p["panel2"], op="0.7"))
        o.append(f'<circle cx="{c.lead(758, 0) + (0 if not rtl else 0)}" cy="{ny+29}" r="4" fill="{INFO}"/>')
        o.append(t(c.lead(772, 330), ny + 26, n[:44], 11.5, "600", p["txt2"], c.anc, c.rtl))
        if len(n) > 44:
            o.append(t(c.lead(772, 330), ny + 44, n[44:], 11.5, "600", p["txt2"], c.anc, c.rtl))
    return shell(theme, rtl, 4, "".join(o))


# ── screen: announcements ───────────────────────────────────
ANN = [(WARN, "Payroll cut-off is 25 Oct", "موعد إقفال الرواتب ٢٥ أكتوبر", "All employees", "جميع الموظفين"),
       (INFO, "New service: Business Trip", "خدمة جديدة: مهمة عمل", "All employees", "جميع الموظفين"),
       (OK, "Eid Al Adha holiday schedule", "جدول عطلة عيد الأضحى", "All employees", "جميع الموظفين"),
       (VIOLET, "Engineering department townhall", "لقاء إدارة الهندسة", "Engineering", "إدارة الهندسة"),
       (INFO, "Medical insurance renewal", "تجديد التأمين الطبي", "Riyadh branch", "فرع الرياض")]


def announcements_screen(theme, rtl):
    p, c = PAL[theme], C(rtl)
    o = [page_head(p, c, w("announce", rtl),
                   "Audience is resolved per employee — department, branch or company-wide."
                   if not rtl else "يُحدَّد الجمهور لكل موظف — الإدارة أو الفرع أو الشركة بالكامل.")]
    y = CY0 + 88
    for i, (col, en, ar, aen, aar) in enumerate(ANN):
        ay = y + i * 112
        o.append(rr(c.x(0, CW), ay, CW, 96, 14, p["panel"], p["line"]))
        o.append(rr(c.x(0, 4), ay, 4, 96, 2, col))
        o.append(icon_tile(p, c.x(24, 52), ay + 22, 52, col))
        o.append(t(c.lead(96, CW - 300), ay + 40, ar if rtl else en, 15, "700", p["txt"], c.anc, c.rtl))
        o.append(skel(p, c.x(96, 520), ay + 54, 520, 8))
        o.append(skel(p, c.x(96, 380), ay + 70, 380, 8, "0.6"))
        o.append(pill(p, c.trail(24, CW - 48), ay + 24, aar if rtl else aen, col,
                      max(96, 8 * len(aar if rtl else aen) + 26), rtl=c.rtl, trail=True))
        o.append(t(c.trail(24, CW - 48), ay + 72, "٠٦ أكتوبر" if rtl else "06 Oct 2026",
                   11, "500", p["txt3"], c.anc2, c.rtl))
    return shell(theme, rtl, 5, "".join(o))


def announcement_detail(theme, rtl):
    p, c = PAL[theme], C(rtl)
    o = [page_head(p, c, ANN[0][2] if rtl else ANN[0][1],
                   "٠٦ أكتوبر ٢٠٢٦ · الموارد البشرية" if rtl else "06 Oct 2026 · Human Resources")]
    y = CY0 + 88
    o.append(card(p, c, 0, y, 740, 420, None, None, WARN))
    o.append(rr(c.x(20, 700), y + 20, 700, 128, 12, p["panel2"]))
    o.append(rr(c.x(20, 700), y + 20, 700, 128, 12, "url(#sheen)"))
    o.append(icon_tile(p, c.x(20 + 324, 52), y + 58, 52, WARN, ""))
    for i in range(7):
        ww = [640, 600, 668, 520, 640, 580, 420][i]
        o.append(skel(p, c.x(20, ww), y + 180 + i * 26, ww, 9,
                      "0.85" if i < 5 else "0.55"))
    o.append(rr(c.x(20, 250), y + 376, 250, 36, 10, p["panel2"], p["line"]))
    o.append(t(c.lead(34, 222), y + 399, "📎  payroll-calendar.pdf" if not rtl
               else "📎  تقويم-الرواتب.pdf", 11.5, "600", p["txt2"], c.anc, c.rtl))

    o.append(card(p, c, 764, y, 356, 420, "Audience" if not rtl else "الجمهور"))
    for i, (en, ar, col) in enumerate([("All employees", "جميع الموظفين", OK),
                                       ("Arabic + English body", "نص عربي وإنجليزي", INFO),
                                       ("Pinned to dashboard", "مثبّت على اللوحة", WARN),
                                       ("Published 06 Oct", "نُشر ٠٦ أكتوبر", VIOLET)]):
        ry = y + 58 + i * 62
        o.append(rr(c.x(784, 316), ry, 316, 48, 10, p["panel2"], op="0.7"))
        o.append(f'<circle cx="{c.lead(802, 0)}" cy="{ry+24}" r="5" fill="{col}"/>')
        o.append(t(c.lead(818, 280), ry + 29, ar if rtl else en, 12, "600", p["txt"], c.anc, c.rtl))
    return shell(theme, rtl, 5, "".join(o))


# ── screen: profile ─────────────────────────────────────────
def profile_screen(theme, rtl):
    p, c = PAL[theme], C(rtl)
    o = [page_head(p, c, w("profile", rtl),
                   "Employee record, surfaced read-only except for the Data Update service."
                   if not rtl else "بيانات الموظف للعرض فقط، ويتم التعديل عبر خدمة تحديث البيانات.")]
    y = CY0 + 88
    o.append(card(p, c, 0, y, 360, 380))
    o.append(f'<circle cx="{c.x(0,360)+180}" cy="{y+104}" r="52" fill="{p["acc2"]}" opacity="0.2"/>')
    o.append(f'<circle cx="{c.x(0,360)+180}" cy="{y+104}" r="52" fill="none" stroke="{p["acc"]}" stroke-opacity="0.5"/>')
    o.append(f'<circle cx="{c.x(0,360)+180}" cy="{y+92}" r="19" fill="{p["acc"]}" opacity="0.5"/>')
    o.append(f'<path d="M{c.x(0,360)+148} {y+142} q32 -28 64 0" fill="{p["acc"]}" opacity="0.5"/>')
    o.append(skel(p, c.x(0, 360) + 110, y + 178, 140, 11))
    o.append(skel(p, c.x(0, 360) + 130, y + 200, 100, 9, "0.6"))
    for i, (en, ar) in enumerate([("Engineering", "إدارة الهندسة"),
                                  ("Riyadh branch", "فرع الرياض"),
                                  ("Sunday – Thursday", "الأحد – الخميس")]):
        o.append(pill(p, c.x(0, 360) + 180 - 70, y + 226 + i * 34, ar if rtl else en, INFO, 140))
    o.append(card(p, c, 384, y, 736, 380, "Employee information" if not rtl else "بيانات الموظف"))
    labels_en = ["Employee ID", "Job title", "Department", "Manager",
                 "Joining date", "Contract", "Work email", "Mobile"]
    labels_ar = ["الرقم الوظيفي", "المسمى الوظيفي", "الإدارة", "المدير",
                 "تاريخ التعيين", "العقد", "البريد الوظيفي", "الجوال"]
    for i, k in enumerate(labels_ar if rtl else labels_en):
        fx, fy = 404 + (i % 2) * 356, y + 58 + (i // 2) * 76
        o.append(rr(c.x(fx, 336), fy, 336, 60, 10, p["panel2"], op="0.7"))
        o.append(t(c.lead(fx + 16, 304), fy + 24, k, 10.5, "700", p["txt3"], c.anc, c.rtl))
        o.append(skel(p, c.x(fx + 16, 180), fy + 35, 180, 9))
    return shell(theme, rtl, 6, "".join(o))


# ── mobile shell ────────────────────────────────────────────
MW, MH = 420, 880
MTAB_EN = ["Home", "Attendance", "Services", "Requests", "Profile"]
MTAB_AR = ["الرئيسية", "الحضور", "الخدمات", "الطلبات", "الملف"]


def m_shell(theme, rtl, active, title, body):
    p = PAL[theme]
    o = [f'<rect width="{MW}" height="{MH}" fill="url(#bg)"/>',
         f'<ellipse cx="{MW/2}" cy="40" rx="260" ry="180" fill="url(#glow)" filter="url(#soft)" opacity="0.7"/>']
    # status bar
    o.append(t(24 if not rtl else MW - 24, 24, "9:41", 11.5, "700", p["txt2"],
               "start" if not rtl else "end"))
    o.append(t(MW - 24 if not rtl else 24, 24, "▮▮▮  ⏶  ▰", 11, "700", p["txt3"],
               "end" if not rtl else "start"))
    # app header
    o.append(rr(0, 38, MW, 62, 0, p["shell"]))
    o.append(f'<line x1="0" y1="100" x2="{MW}" y2="100" stroke="{p["line"]}" stroke-width="1"/>')
    hx = MW - 20 if rtl else 20
    o.append(rr(hx - 32 if rtl else hx, 54, 32, 30, 9, "url(#acc)"))
    o.append(t((hx - 16) if rtl else (hx + 16), 74, "EG", 12, "800", "#fff", "middle"))
    o.append(t((hx - 42) if rtl else (hx + 42), 74, title, 14, "800", p["txt"],
               "start", rtl))
    gx = 20 if rtl else MW - 20
    for i, lab in enumerate(("AR|EN" if not rtl else "EN|ع", "◐")):
        cw2 = 50 if i == 0 else 30
        off = 0 if i == 0 else 58
        x = (gx + off) if rtl else (gx - off - cw2)
        o.append(rr(x, 55, cw2, 28, 14, p["chip"], p["line"]))
        o.append(t(x + cw2 / 2, 73, lab, 10, "700", p["txt2"], "middle"))
    o.append(body)
    # bottom tab bar
    o.append(rr(0, MH - 74, MW, 74, 0, p["shell"]))
    o.append(f'<line x1="0" y1="{MH-74}" x2="{MW}" y2="{MH-74}" stroke="{p["line"]}" stroke-width="1"/>')
    tabs = MTAB_AR if rtl else MTAB_EN
    order = list(reversed(range(5))) if rtl else list(range(5))
    for slot, i in enumerate(order):
        cx = 42 + slot * 84
        on = i == active
        col = p["acc"] if on else p["txt3"]
        if on:
            o.append(rr(cx - 28, MH - 66, 56, 44, 12, p["acc2"], op="0.18"))
        o.append(f'<circle cx="{cx}" cy="{MH-50}" r="7" fill="none" stroke="{col}" stroke-width="1.8"/>')
        o.append(t(cx, MH - 28, tabs[i], 9.5, "700" if on else "500", col, "middle", rtl))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {MW} {MH}" width="{MW}" height="{MH}" '
            f'role="img">{defs(p)}' + "".join(o) + "</svg>")


class M:
    """Mobile content coordinate helper (0..MW-40 inside 20px gutters)."""
    IW = MW - 40

    def __init__(self, rtl):
        self.rtl = rtl

    def x(self, lx, lw=0):
        return 20 + (self.IW - lx - lw) if self.rtl else 20 + lx

    def lead(self, lx, lw=0):
        return self.x(lx, lw) + (lw if self.rtl else 0)

    def trail(self, lx, lw=0):
        return self.x(lx, lw) + (0 if self.rtl else lw)

    anc = "start"
    anc2 = "end"


def m_card(p, m, y, h, title=None, meta=None, accent=None):
    o = [rr(m.x(0, M.IW), y, M.IW, h, 14, p["panel"], p["line"]),
         rr(m.x(0, M.IW), y, M.IW, min(h, 60), 14, "url(#sheen)")]
    if accent:
        o.append(rr(m.x(0, M.IW) + (M.IW - 3 if m.rtl else 0), y + 14, 3, 26, 2, accent))
    if title:
        o.append(t(m.lead(16, M.IW - 32), y + 27, title, 12.5, "700", p["txt"], m.anc, m.rtl))
    if meta:
        o.append(t(m.trail(16, M.IW - 32), y + 26, meta, 10.5, "600", p["txt3"], m.anc2, m.rtl))
    return "".join(o)


def m_dashboard(theme, rtl):
    p, m = PAL[theme], M(rtl)
    o = [t(m.lead(0, M.IW), 134, w("hi", rtl), 19, "800", p["txt"], m.anc, m.rtl),
         t(m.lead(0, M.IW), 155, w("hi_sub", rtl), 11, "500", p["txt3"], m.anc, m.rtl)]
    # attendance hero tile
    o.append(m_card(p, m, 172, 162, w("today", rtl), "06 Oct", OK))
    o.append(geofence(p, m.x(16, 76) + 38, 254, 36, "inside"))
    o.append(t(m.lead(104, 200), 248, "08:54", 23, "800", p["txt"], m.anc, m.rtl))
    o.append(t(m.lead(104, 200), 266, w("checked_in", rtl), 10.5, "600", OK, m.anc, m.rtl))
    o.append(rr(m.x(104, 132), 284, 132, 34, 17, OK, op="0.18"))
    o.append(rr(m.x(104, 132), 284, 132, 34, 17, "none", OK, 1, "0.5"))
    o.append(t(m.x(104, 132) + 66, 306, w("check_out", rtl), 11, "700", OK, "middle", rtl))
    # two KPI tiles
    for i, (lab, val, foot, col) in enumerate([
            (w("leave", rtl), "١٨" if rtl else "18", w("leave_foot", rtl), WARN),
            (w("requests_kpi", rtl), "٣" if rtl else "3", w("requests_foot", rtl), VIOLET)]):
        kx = i * 190
        o.append(rr(m.x(kx, 190), 346, 190, 92, 14, p["panel"], p["line"]))
        o.append(t(m.lead(kx + 14, 162), 370, lab, 9, "700", p["txt3"], m.anc, m.rtl))
        o.append(t(m.lead(kx + 14, 162), 402, val, 22, "800", p["txt"], m.anc, m.rtl))
        o.append(t(m.lead(kx + 14, 162), 422, foot, 9.5, "500", col, m.anc, m.rtl))
    # services row
    o.append(m_card(p, m, 450, 148, w("services", rtl), w("all", rtl)))
    for i in range(6):
        gx, gy = 14 + (i % 3) * 118, 484 + (i // 3) * 58
        name, col = svc(i, rtl)
        o.append(rr(m.x(gx, 108), gy, 108, 50, 11, p["panel2"], p["line"]))
        o.append(icon_tile(p, m.x(gx + 38, 32), gy + 5, 32, col))
        o.append(t(m.x(gx, 108) + 54, gy + 44, name, 8.5, "700", p["txt2"], "middle", rtl))
    # announcements
    o.append(m_card(p, m, 612, 182, w("announce", rtl), "3"))
    for i in range(3):
        ay = 648 + i * 46
        col = ANN[i][0]
        o.append(rr(m.x(14, 352), ay, 352, 38, 9, p["panel2"], op="0.75"))
        o.append(rr(m.x(14, 3), ay, 3, 38, 2, col))
        o.append(t(m.lead(28, 326), ay + 23, (ANN[i][2] if rtl else ANN[i][1])[:30],
                   10.5, "700", p["txt"], m.anc, m.rtl))
    return m_shell(theme, rtl, 0, "EGHR" if not rtl else "بوابة الموظف", "".join(o))


def m_services(theme, rtl):
    p, m = PAL[theme], M(rtl)
    o = [rr(m.x(0, M.IW), 124, M.IW, 40, 20, p["panel"], p["line"]),
         t(m.lead(16, M.IW - 32), 149, "⌕   " + w("search", rtl), 11.5, "500", p["txt3"], m.anc, m.rtl)]
    for i in range(10):
        gx, gy = (i % 2) * 190, 180 + (i // 2) * 116
        name, col = svc(i, rtl)
        o.append(rr(m.x(gx, 190), gy, 190, 100, 14, p["panel"], p["line"]))
        o.append(icon_tile(p, m.x(gx + 16, 40), gy + 16, 40, col))
        o.append(t(m.lead(gx + 16, 158), gy + 76, name[:18], 11.5, "700", p["txt"], m.anc, m.rtl))
        o.append(t(m.lead(gx + 16, 158), gy + 92, "→" if not rtl else "←", 10, "700", col, m.anc, m.rtl))
    return m_shell(theme, rtl, 2, w("services", rtl), "".join(o))


def m_request_form(theme, rtl):
    p, m = PAL[theme], M(rtl)
    o = [t(m.lead(0, M.IW), 134, SERVICES[0][1] if rtl else SERVICES[0][0], 18, "800",
           p["txt"], m.anc, m.rtl),
         t(m.lead(0, M.IW), 154, "New request" if not rtl else "طلب جديد", 11, "500",
           p["txt3"], m.anc, m.rtl)]
    fields_en = ["Leave type", "From date", "To date", "Working days", "Reason", "Attachment"]
    fields_ar = ["نوع الإجازة", "من تاريخ", "إلى تاريخ", "أيام العمل", "السبب", "مرفق"]
    vals_en = ["Annual", "12 Oct 2026", "14 Oct 2026", "3", "", "leave-form.pdf"]
    vals_ar = ["سنوية", "١٢ أكتوبر ٢٠٢٦", "١٤ أكتوبر ٢٠٢٦", "٣", "", "نموذج-إجازة.pdf"]
    for i, (k, v) in enumerate(zip(fields_ar if rtl else fields_en, vals_ar if rtl else vals_en)):
        fy = 180 + i * 78
        o.append(t(m.lead(0, M.IW), fy + 12, k, 10, "700", p["txt3"], m.anc, m.rtl))
        o.append(rr(m.x(0, M.IW), fy + 20, M.IW, 44, 10, p["panel2"], p["line"]))
        if v:
            o.append(t(m.lead(14, M.IW - 28), fy + 48, v, 12, "600", p["txt"], m.anc, m.rtl))
        else:
            o.append(skel(p, m.x(14, 180), fy + 38, 180, 8))
    o.append(rr(m.x(0, M.IW), 660, M.IW, 48, 24, "url(#acc)"))
    o.append(t(20 + M.IW / 2, 690, w("submit", rtl), 13, "700", "#fff", "middle", rtl))
    o.append(rr(m.x(0, M.IW), 718, M.IW, 44, 22, p["panel2"], p["line"]))
    o.append(t(20 + M.IW / 2, 746, w("cancel", rtl), 12.5, "700", p["txt2"], "middle", rtl))
    return m_shell(theme, rtl, 2, SERVICES[0][1] if rtl else SERVICES[0][0], "".join(o))


def m_attendance(theme, rtl):
    p, m = PAL[theme], M(rtl)
    o = [m_card(p, m, 124, 300, "Today" if not rtl else "اليوم", "06 Oct", OK)]
    o.append(geofence(p, 20 + M.IW / 2, 248, 76, "inside"))
    o.append(t(20 + M.IW / 2, 350, "Inside office zone · 42 m" if not rtl
               else "داخل نطاق المكتب · ٤٢ م", 12, "700", OK, "middle", rtl))
    o.append(t(20 + M.IW / 2, 384, "08:54", 26, "800", p["txt"], "middle", rtl))
    o.append(rr(m.x(60, 260), 396, 260, 44, 22, OK, op="0.18"))
    o.append(rr(m.x(60, 260), 396, 260, 44, 22, "none", OK, 1, "0.5"))
    o.append(t(20 + M.IW / 2, 424, w("check_out", rtl), 12.5, "700", OK, "middle", rtl))
    o.append(m_card(p, m, 440, 112, "This month" if not rtl else "هذا الشهر", "22 / 22"))
    for i in range(14):
        bx = 14 + i * 25
        hh = 28 + (i * 31 % 32)
        o.append(rr(m.x(bx, 16), 534 - hh, 16, hh, 5, WARN if i % 7 == 3 else p["acc2"], op="0.85"))
    o.append(m_card(p, m, 568, 200, w("recent_att", rtl), w("all", rtl)))
    for i in range(3):
        ry = 602 + i * 44
        st, col = ((w("late", rtl), WARN) if i == 1 else (w("present", rtl), OK))
        o.append(rr(m.x(14, 352), ry, 352, 38, 9, p["panel2"], op="0.75"))
        o.append(t(m.lead(26, 328), ry + 23,
                   (["الاثنين ٠٦", "الأحد ٠٥", "الخميس ٠٢"][i] if rtl
                    else ["Mon 06", "Sun 05", "Thu 02"][i])
                   + (" · ٠٨:٥٤ — ١٧:٠٦" if rtl else " · 08:54 → 17:06"),
                   10.5, "600", p["txt"], m.anc, m.rtl))
        o.append(pill(p, m.trail(26, 328), ry + 7, st, col, rtl=rtl, trail=True))
    return m_shell(theme, rtl, 1, w("attendance", rtl), "".join(o))


def m_announcements(theme, rtl):
    p, m = PAL[theme], M(rtl)
    o = []
    for i, (col, en, ar, aen, aar) in enumerate(ANN[:5]):
        ay = 124 + i * 128
        o.append(rr(m.x(0, M.IW), ay, M.IW, 112, 14, p["panel"], p["line"]))
        o.append(rr(m.x(0, 4), ay, 4, 112, 2, col))
        o.append(icon_tile(p, m.x(16, 40), ay + 16, 40, col))
        o.append(t(m.lead(68, M.IW - 84), ay + 34, (ar if rtl else en)[:26], 12, "700",
                   p["txt"], m.anc, m.rtl))
        o.append(skel(p, m.x(16, 320), ay + 62, 320, 8))
        o.append(skel(p, m.x(16, 230), ay + 78, 230, 8, "0.6"))
        o.append(pill(p, m.trail(16, M.IW - 32), ay + 86, aar if rtl else aen, col,
                      max(86, 7 * len(aar if rtl else aen) + 22), rtl=rtl, trail=True))
    return m_shell(theme, rtl, 3, w("announce", rtl), "".join(o))


def m_profile(theme, rtl):
    p, m = PAL[theme], M(rtl)
    o = [m_card(p, m, 124, 230)]
    cx = 20 + M.IW / 2
    o.append(f'<circle cx="{cx}" cy="196" r="44" fill="{p["acc2"]}" opacity="0.2"/>')
    o.append(f'<circle cx="{cx}" cy="196" r="44" fill="none" stroke="{p["acc"]}" stroke-opacity="0.5"/>')
    o.append(f'<circle cx="{cx}" cy="186" r="16" fill="{p["acc"]}" opacity="0.5"/>')
    o.append(f'<path d="M{cx-27} {196+34} q27 -24 54 0" fill="{p["acc"]}" opacity="0.5"/>')
    o.append(skel(p, cx - 70, 262, 140, 11))
    o.append(skel(p, cx - 50, 284, 100, 9, "0.6"))
    o.append(pill(p, cx - 70, 306, "Engineering" if not rtl else "إدارة الهندسة", INFO, 140))
    labels_en = ["Employee ID", "Job title", "Department", "Joining date", "Work email", "Mobile"]
    labels_ar = ["الرقم الوظيفي", "المسمى الوظيفي", "الإدارة", "تاريخ التعيين", "البريد الوظيفي", "الجوال"]
    for i, k in enumerate(labels_ar if rtl else labels_en):
        fy = 372 + i * 66
        o.append(rr(m.x(0, M.IW), fy, M.IW, 56, 11, p["panel"], p["line"]))
        o.append(t(m.lead(14, M.IW - 28), fy + 22, k, 10, "700", p["txt3"], m.anc, m.rtl))
        o.append(skel(p, m.x(14, 170), fy + 33, 170, 9))
    return m_shell(theme, rtl, 4, w("profile", rtl), "".join(o))


# ── attendance state tiles ──────────────────────────────────
STATES = [
    ("not-checked-in", "Not checked in", "off",
     "Portal loaded; no attendance record for today yet."),
    ("location-permission", "Location permission", "off",
     "Browser geolocation has not been granted yet."),
    ("locating", "Locating", "locating",
     "Coordinates being resolved before the check-in call."),
    ("inside-zone", "Inside zone", "inside",
     "Coordinates fall inside the configured office geofence."),
    ("outside-zone", "Outside zone", "outside",
     "Server rejects the check-in and explains the distance."),
    ("checked-in", "Checked in", "inside",
     "Attendance record created; check-out becomes the action."),
    ("checkout", "Check out", "inside",
     "Worked hours computed from the stored check-in time."),
]
SW, SH = 560, 380


def state_tile(theme, key, label, ring, note, idx):
    p = PAL[theme]
    btn = {"off": p["txt3"], "locating": INFO, "inside": OK, "outside": DANGER}[ring]
    msg = {"not-checked-in": "Check in", "location-permission": "Allow location",
           "locating": "Locating…", "inside-zone": "Check in",
           "outside-zone": "Out of range", "checked-in": "Check out",
           "checkout": "Check out"}[key]
    o = [f'<rect width="{SW}" height="{SH}" fill="url(#bg)"/>',
         rr(20, 20, SW - 40, SH - 40, 18, p["panel"], p["line"]),
         rr(20, 20, SW - 40, 96, 18, "url(#sheen)"),
         rr(20, 36, 3, 30, 2, btn),
         t(44, 52, f"STATE {idx:02d}", 10.5, "800", p["txt3"]),
         t(44, 74, label, 17, "800", p["txt"]),
         pill(p, SW - 40 - 120, 40, ring.upper(), btn, 120)]
    o.append(geofence(p, 124, 236, 74, ring))
    o.append(t(226, 182, msg if ring != "outside" else "Rejected", 15, "800",
               btn if ring != "off" else p["txt2"]))
    o.append(t(226, 206,
               {"off": "—:—", "locating": "—:—", "inside": "08:54", "outside": "—:—"}[ring],
               24, "800", p["txt"]))
    for i, ln in enumerate([note[:42], note[42:84]]):
        if ln:
            o.append(t(226, 240 + i * 19, ln, 11.5, "500", p["txt2"]))
    o.append(rr(226, 282, 210, 42, 21, btn, op="0.18"))
    o.append(rr(226, 282, 210, 42, 21, "none", btn, 1, "0.5"))
    o.append(t(331, 309, msg, 12.5, "700", btn, "middle"))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SW} {SH}" '
            f'width="{SW}" height="{SH}" role="img">{defs(p)}' + "".join(o) + "</svg>")


# ── project-card cover ──────────────────────────────────────
def _embed(name):
    """Base64 a generated schematic so the cover is a single self-contained file."""
    import base64
    with open(os.path.join(OUT, name), "rb") as f:
        return "data:image/svg+xml;base64," + base64.b64encode(f.read()).decode("ascii")


def cover():
    """1200x750 card cover, matching the other project covers in the grid."""
    p = PAL["dark"]
    desk, phone = _embed("dashboard-desktop-en-dark.svg"), _embed("dashboard-mobile-ar.svg")
    chips = ["Odoo 18", "Python", "QWeb", "PostgreSQL", "Responsive"]
    cx, chip = 72, ""
    for c in chips:
        cw = 9 * len(c) + 34
        chip += (rr(cx, 636, cw, 36, 18, p["panel2"], p["line"])
                 + t(cx + cw / 2, 659, c, 13, "600", p["txt2"], "middle"))
        cx += cw + 12
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 750" width="1200" height="750" role="img">
  {defs(p)}
  <clipPath id="deskClip"><rect x="470" y="128" width="700" height="438" rx="14"/></clipPath>
  <clipPath id="phoneClip"><rect x="392" y="330" width="176" height="368" rx="22"/></clipPath>
  <rect width="1200" height="750" fill="url(#bg)"/>
  <ellipse cx="880" cy="120" rx="560" ry="330" fill="url(#glow)" filter="url(#soft)" opacity="0.9"/>
  <g opacity="0.5">
    {"".join(f'<line x1="{i*60}" y1="0" x2="{i*60}" y2="750" stroke="#ffffff" stroke-opacity="0.028"/>' for i in range(1, 20))}
    {"".join(f'<line x1="0" y1="{i*60}" x2="1200" y2="{i*60}" stroke="#ffffff" stroke-opacity="0.028"/>' for i in range(1, 13))}
  </g>

  <!-- desktop frame -->
  <rect x="468" y="112" width="704" height="458" rx="16" fill="{p['panel']}" stroke="{p['line']}" stroke-width="1.5"/>
  <image href="{desk}" x="470" y="128" width="700" height="438" preserveAspectRatio="xMidYMin slice" clip-path="url(#deskClip)"/>

  <!-- phone -->
  <rect x="384" y="322" width="192" height="384" rx="28" fill="#1a2b47" stroke="{p['line']}" stroke-width="1.5"/>
  <image href="{phone}" x="392" y="330" width="176" height="368" preserveAspectRatio="xMidYMin slice" clip-path="url(#phoneClip)"/>
  <rect x="446" y="336" width="68" height="5" rx="2.5" fill="#000000" opacity="0.55"/>

  <!-- copy -->
  <rect x="72" y="92" width="196" height="36" rx="18" fill="{p['acc2']}" opacity="0.18"/>
  <rect x="72" y="92" width="196" height="36" rx="18" fill="none" stroke="{p['acc']}" stroke-opacity="0.5"/>
  {t(170, 115, "FLAGSHIP CASE STUDY", 11.5, "800", p['acc'], "middle")}
  {t(72, 196, "EJAD EGHR", 52, "800", "#ffffff")}
  {t(72, 248, "Enterprise Employee Portal", 27, "700", p['acc'])}
  {t(72, 306, "Portal-first HR self-service on Odoo 18 \u2014", 16, "500", p['txt2'])}
  {t(72, 332, "services, approvals, geofenced attendance,", 16, "500", p['txt2'])}
  {t(72, 358, "bilingual UX and responsive journeys.", 16, "500", p['txt2'])}
  {chip}
</svg>'''


# ── build ───────────────────────────────────────────────────
def main():
    print("Desktop schematics")
    write("dashboard-desktop-en-dark.svg", dashboard("dark", False))
    write("dashboard-desktop-ar-dark.svg", dashboard("dark", True))
    write("dashboard-desktop-en-light.svg", dashboard("light", False))
    write("dashboard-desktop-ar-light.svg", dashboard("light", True))
    write("requests-desktop-en-dark.svg", requests_screen("dark", False, "requests"))
    write("actions-desktop-en-dark.svg", requests_screen("dark", False, "actions"))
    write("request-detail-desktop-en-dark.svg", request_detail("dark", False))
    write("request-detail-desktop-ar-light.svg", request_detail("light", True))
    write("attendance-desktop-en-dark.svg", attendance_screen("dark", False, "inside"))
    write("attendance-desktop-ar-light.svg", attendance_screen("light", True, "inside"))
    write("services-desktop-en-dark.svg", services_screen("dark", False))
    write("services-desktop-ar-light.svg", services_screen("light", True))
    write("service-form-desktop-en-dark.svg", service_form("dark", False))
    write("announcements-desktop-en-dark.svg", announcements_screen("dark", False))
    write("announcement-detail-desktop-ar-light.svg", announcement_detail("light", True))
    write("profile-desktop-en-dark.svg", profile_screen("dark", False))

    print("Mobile schematics")
    write("dashboard-mobile-en.svg", m_dashboard("dark", False))
    write("dashboard-mobile-ar.svg", m_dashboard("dark", True))
    write("services-mobile-en.svg", m_services("dark", False))
    write("request-form-mobile-en.svg", m_request_form("dark", False))
    write("attendance-mobile-en.svg", m_attendance("dark", False))
    write("announcements-mobile-ar.svg", m_announcements("dark", True))
    write("profile-mobile-en.svg", m_profile("dark", False))

    print("Card cover")
    write("eghr-cover.svg", cover())

    print("Attendance state tiles")
    for i, (key, label, ring, note) in enumerate(STATES, 1):
        write(f"attendance-state-{key}.svg", state_tile("dark", key, label, ring, note, i))

    print("\nDone →", os.path.relpath(OUT, ROOT))


if __name__ == "__main__":
    main()
