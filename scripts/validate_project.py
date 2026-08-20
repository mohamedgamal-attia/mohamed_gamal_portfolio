#!/usr/bin/env python3
"""
validate_project.py — pre-flight check for the portfolio project.

Run from the project root:
    python3 scripts/validate_project.py

Checks:
  1. All JSON data files parse without errors
  2. Every project image path in projects.json exists on disk
  3. Every company logo path in companies.json exists on disk
  4. index.html contains no external <img src="http..."> references
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
    missing = [(p.get("id"), p.get("image")) for p in projects
               if not os.path.exists(os.path.join(ROOT, p.get("image", "")))]
    if missing:
        for pid, img in missing:
            fail(f"Missing image for '{pid}': {img}")
    else:
        ok(f"All {len(projects)} project image paths exist")
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


# ── 4. No external <img> in index.html ───────────────────
print("\n[4] External images in index.html")
html_path = os.path.join(ROOT, "index.html")
if os.path.exists(html_path):
    with open(html_path) as f:
        html = f.read()
    ext_imgs = re.findall(r'<img[^>]+src=["\']https?://[^"\']+["\']', html)
    if ext_imgs:
        for m in ext_imgs:
            fail(f"External img src: {m[:120]}")
    else:
        ok("No external <img src> found in index.html")
else:
    fail("index.html not found")


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
