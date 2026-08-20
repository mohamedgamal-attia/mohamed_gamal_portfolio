#!/usr/bin/env python3
"""
audit_portfolio_data.py — data-quality / de-duplication audit.

Guards against the "inflated, repetitive portfolio" problem: duplicate cards,
duplicate titles, context shown as main projects, concatenated tags, and
filter/category mismatches.

Run:  python3 scripts/audit_portfolio_data.py   (exit 0 = clean, 1 = errors)
"""

import json, os, re, sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
errors, warnings = [], []

def ok(m):   print(f"  ✅ {m}")
def warn(m): print(f"  ⚠️  {m}"); warnings.append(m)
def fail(m): print(f"  ❌ {m}"); errors.append(m)

def load(rel, default=None):
    p = os.path.join(ROOT, rel)
    if not os.path.exists(p):
        warn(f"{rel} not found"); return default
    try:
        return json.load(open(p))
    except json.JSONDecodeError as e:
        fail(f"{rel} invalid JSON: {e}"); return default

def read(rel):
    p = os.path.join(ROOT, rel)
    return open(p).read() if os.path.exists(p) else ""

projects = load("assets/data/projects.json", []) or []
cases    = load("assets/data/case-studies.json", []) or []
sources  = load("assets/data/sources.json", {}) or {}
html     = read("index.html")
loader   = read("assets/js/data-loader.js")

print("\n[1] Duplicate project IDs")
ids = [p.get("id") for p in projects]
dup = [k for k, v in Counter(ids).items() if v > 1]
fail(f"Duplicate IDs: {dup}") if dup else ok(f"No duplicate IDs ({len(ids)} projects)")

print("\n[2] Duplicate project titles")
titles = [p.get("title", "").strip().lower() for p in projects]
dupt = [k for k, v in Counter(titles).items() if v > 1]
fail(f"Duplicate titles: {dupt}") if dupt else ok("No duplicate titles")

print("\n[3] Title overlap between projects.json and case-studies.json")
ctitles = {c.get("title", "").strip().lower() for c in cases} if isinstance(cases, list) else set()
overlap = set(titles) & ctitles
fail(f"Titles appear in both files: {overlap}") if overlap else ok("No title overlap with case-studies.json")

print("\n[4] Image reuse across projects")
imgs = []
for p in projects:
    if p.get("cover"): imgs.append(p["cover"])
    if p.get("image"): imgs.append(p["image"])
    imgs += p.get("gallery", []) or []
overused = [k for k, v in Counter(imgs).items() if v > 2]
warn(f"Image reused >2x: {overused}") if overused else ok("No image over-reused (>2x)")

print("\n[5] Missing image files")
missing = []
for p in projects:
    for f in [p.get("cover"), p.get("image")] + (p.get("gallery") or []):
        if f and not os.path.exists(os.path.join(ROOT, f)):
            missing.append((p.get("id"), f))
if missing:
    for pid, f in missing: fail(f"Missing image '{f}' in {pid}")
else:
    ok("All cover/image/gallery files exist")

print("\n[6] Empty gallery arrays")
empty = [p.get("id") for p in projects if not (p.get("gallery"))]
fail(f"Empty gallery: {empty}") if empty else ok("Every project has a non-empty gallery")

print("\n[7] Projects without any image")
noimg = [p.get("id") for p in projects if not (p.get("cover") or p.get("image"))]
fail(f"No cover/image: {noimg}") if noimg else ok("Every project has a cover image")

print("\n[8] Projects without a clear type")
notype = [p.get("id") for p in projects if not p.get("type")]
fail(f"Missing type: {notype}") if notype else ok("Every project has a type")

print("\n[9] Suspicious duplicate company + role text")
combo = Counter((p.get("company"), (p.get("role") or "").strip().lower()) for p in projects)
dupcombo = [c for c, v in combo.items() if v > 1]
warn(f"Same company+role repeated: {dupcombo}") if dupcombo else ok("No repeated company+role rows")

print("\n[10] Tag concatenation risk in data-loader.js")
# flag joins on tag/label arrays without a separator string
bad = re.findall(r"\.(?:tags|categories|features|scope)[^\n]*\.join\(\s*['\"]{2}\s*\)", loader)
bad += re.findall(r"\.join\(\s*['\"]{2}\s*\)", loader)
# join('') is OK only when mapping to wrapped spans; detect raw array join('')
raw_bad = [b for b in re.findall(r"([A-Za-z_.\[\]']+\.join\(\s*''\s*\))", loader)
           if "map(" not in b]
if raw_bad:
    warn(f"Possible raw array .join('') (no spacing): {raw_bad}")
else:
    ok("No raw tag/label .join('') without span-mapping")

print("\n[11-13] Filter buttons vs project categories")
btn_filters = set(re.findall(r'data-filter="([^"]+)"', html)) - {"all"}
cats = set()
for p in projects:
    cats |= set(p.get("categories", []))
no_match_btn = sorted(f for f in btn_filters if f not in cats)
no_btn_cat   = sorted(c for c in cats if c not in btn_filters)
fail(f"Filter buttons with 0 matching projects: {no_match_btn}") if no_match_btn else ok("Every filter button matches ≥1 project")
fail(f"Categories with no filter button: {no_btn_cat}") if no_btn_cat else ok("Every category has a filter button")

print("\n[14] Source tracking in sources.json")
src_blob = json.dumps(sources).lower()
untracked = []
for p in projects:
    key = (p.get("company") or "").split()[0].lower()
    if key and key not in src_blob and (p.get("sourceUrl")):
        untracked.append(p.get("id"))
warn(f"Companies not referenced in sources.json: {untracked}") if untracked else ok("Project companies referenced in sources.json")

print("\n" + "="*54)
print(f"Main project cards: {len(projects)}   (target ≈ 6)")
sub = sum(len(p.get('subProjects') or []) for p in projects)
print(f"Context sub-projects: {sub}")
if errors:
    print(f"❌ {len(errors)} error(s), {len(warnings)} warning(s)"); sys.exit(1)
print(f"✅ Audit clean — {len(warnings)} warning(s)")
sys.exit(0)
