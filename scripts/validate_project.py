#!/usr/bin/env python3
"""
validate_project.py — pre-flight check for the portfolio project.

Run from the project root:
    python3 scripts/validate_project.py

Checks:
  1. All JSON data files parse without errors
  2. Every project image path in projects.json exists on disk
  3. Every company logo path in companies.json exists on disk
  4. Every HTML page is free of external <img src> and has no broken local refs
  5. All required JS and CSS files exist
  6. Local server is reachable on http://localhost:8000 (optional)

Exit code 0 = all clear, 1 = errors found.
"""

import json
import os
import re
import sys
import socket

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
errors = []
warnings = []


def ok(msg): print(f"  ✅ {msg}")
def fail(msg):
    print(f"  ❌ {msg}")
    errors.append(msg)
def warn(msg):
    print(f"  ⚠️  {msg}")
    warnings.append(msg)


# ── 1. JSON files ──────────────────────────────────────────
print("\n[1] JSON files")
json_files = [
    "assets/data/profile.json",
    "assets/data/companies.json",
    "assets/data/case-studies.json",
    "assets/data/projects.json",
    "assets/data/sources.json",
]
parsed = {}
for rel in json_files:
    path = os.path.join(ROOT, rel)
    try:
        with open(path) as f:
            parsed[rel] = json.load(f)
        ok(rel)
    except FileNotFoundError:
        fail(f"Missing: {rel}")
    except json.JSONDecodeError as e:
        fail(f"JSON error in {rel}: {e}")


# ── 2. Project image paths ────────────────────────────────
print("\n[2] Project images")
projects = parsed.get("assets/data/projects.json", [])
if isinstance(projects, list):
    missing = []
    for p in projects:
        cover = p.get("cover") or p.get("image")
        if not cover:
            missing.append((p.get("id"), "<no cover/image field>"))
        elif not os.path.exists(os.path.join(ROOT, cover)):
            missing.append((p.get("id"), cover))
    if missing:
        for pid, img in missing:
            fail(f"Missing cover for '{pid}': {img}")
    else:
        ok(f"All {len(projects)} project cover paths exist")

    # Case-study pages referenced from the grid must exist
    for p in projects:
        url = p.get("caseStudyUrl")
        if url and not os.path.exists(os.path.join(ROOT, url)):
            fail(f"Missing case-study page for '{p.get('id')}': {url}")
        elif url:
            ok(f"Case-study page for '{p.get('id')}': {url}")
    # gallery images
    gal_missing = []
    gal_count = 0
    for p in projects:
        for g in (p.get("gallery") or []):
            gal_count += 1
            if not os.path.exists(os.path.join(ROOT, g)):
                gal_missing.append((p.get("id"), g))
    if gal_missing:
        for pid, g in gal_missing:
            fail(f"Missing gallery image for '{pid}': {g}")
    else:
        ok(f"All {gal_count} gallery image paths exist")
else:
    warn("projects.json is not a list — skipping image check")


# ── 3. Company logo paths ─────────────────────────────────
print("\n[3] Company logos")
companies = parsed.get("assets/data/companies.json", [])
if isinstance(companies, list):
    for c in companies:
        logo = c.get("logo", "")
        path = os.path.join(ROOT, logo)
        if os.path.exists(path):
            size = os.path.getsize(path)
            ok(f"{c.get('name')}: {logo} ({size} bytes)")
        else:
            fail(f"{c.get('name')}: logo not found at {logo}")
else:
    warn("companies.json is not a list")


# ── 4. HTML pages: no external images, no broken local assets ──
print("\n[4] HTML pages")
pages = ["index.html", "projects/eghr.html"]
for rel in pages:
    html_path = os.path.join(ROOT, rel)
    if not os.path.exists(html_path):
        fail(f"{rel} not found")
        continue
    with open(html_path) as f:
        html = f.read()

    ext_imgs = re.findall(r'<img[^>]+src=["\']https?://[^"\']+["\']', html)
    for m in ext_imgs:
        fail(f"{rel}: external img src: {m[:110]}")
    if not ext_imgs:
        ok(f"{rel}: no external <img src>")

    # Every local src/href must resolve, relative to the page. Fragments and
    # query strings are stripped first rather than excluded, so same-page
    # anchors are checked too instead of being quietly skipped.
    base = os.path.dirname(html_path)
    refs = re.findall(r'(?:\bsrc|\bhref)=["\']([^"\']+)["\']', html)
    local, anchors = set(), set()
    for raw in refs:
        raw = raw.strip()
        if raw.startswith(("http:", "https:", "//", "mailto:", "tel:", "data:", "javascript:")):
            continue
        if raw.startswith("#"):
            anchors.add(raw[1:])
            continue
        path_part = raw.split("#", 1)[0].split("?", 1)[0]
        if not path_part:
            continue
        frag = raw.split("#", 1)[1] if "#" in raw else ""
        local.add((path_part, frag))

    broken = sorted({p_ for p_, _ in local
                     if not os.path.exists(os.path.normpath(os.path.join(base, p_)))})
    for r in broken:
        fail(f"{rel}: broken local reference: {r}")
    if not broken:
        ok(f"{rel}: all {len(local)} local file references resolve")

    # same-page anchors must have a target
    ids = set(re.findall(r'\bid=["\']([^"\']+)["\']', html))
    dead = sorted(a for a in anchors if a and a not in ids)
    for a in dead:
        fail(f"{rel}: anchor #{a} has no target")
    if not dead:
        ok(f"{rel}: all {len(anchors)} same-page anchors resolve")

    # cross-page anchors (e.g. ../index.html#work)
    for p_, frag in sorted(local):
        if not frag or not p_.endswith(".html"):
            continue
        tgt = os.path.normpath(os.path.join(base, p_))
        if not os.path.exists(tgt):
            continue
        with open(tgt) as tf:
            if frag not in set(re.findall(r'\bid=["\']([^"\']+)["\']', tf.read())):
                fail(f"{rel}: {p_}#{frag} — target page has no id '{frag}'")


# ── 5. Required files ─────────────────────────────────────
print("\n[5] Required files")
required = [
    "index.html",
    "assets/css/style.css",
    "assets/css/variables.css",
    "assets/css/base.css",
    "assets/css/layout.css",
    "assets/css/components.css",
    "assets/css/sections.css",
    "assets/css/responsive.css",
    "assets/css/futuristic.css",
    "assets/css/project-showcase.css",
    "assets/css/carousels.css",
    "assets/css/cursor.css",
    "assets/css/motion.css",
    "assets/css/case-study.css",
    "projects/eghr.html",
    "assets/images/favicon.svg",
    "assets/images/og/portfolio-og.jpg",
    "assets/images/og/eghr-og.jpg",
    "assets/js/case-study.js",
    "assets/js/config.js",
    "assets/js/animations.js",
    "assets/js/effects.js",
    "assets/js/cursor.js",
    "assets/js/particles.js",
    "assets/js/tilt.js",
    "assets/js/carousels.js",
    "assets/js/modals.js",
    "assets/js/filters.js",
    "assets/js/data-loader.js",
    "assets/js/main.js",
    "my_img.png",
]
for rel in required:
    path = os.path.join(ROOT, rel)
    if os.path.exists(path):
        ok(rel)
    else:
        fail(f"Missing: {rel}")


# ── 6. Local server check ──────────────────────────────────
print("\n[6] Local server (http://localhost:8000)")
try:
    s = socket.create_connection(("localhost", 8000), timeout=2)
    s.close()
    ok("Server reachable on port 8000")
except Exception:
    warn("Server not running — start with: python3 -m http.server 8000")


# ── Summary ───────────────────────────────────────────────
print()
if errors:
    print(f"❌ {len(errors)} error(s) found:")
    for e in errors:
        print(f"   • {e}")
    sys.exit(1)
elif warnings:
    print(f"✅ All checks passed ({len(warnings)} warning(s))")
    for w in warnings:
        print(f"   ⚠️  {w}")
else:
    print("✅ All checks passed — project looks good!")
