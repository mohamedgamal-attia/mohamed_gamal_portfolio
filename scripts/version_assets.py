#!/usr/bin/env python3
"""Stamp a content hash onto every CSS/JS link in the HTML pages.

Why this exists
---------------
The stylesheets and scripts have stable filenames, so a browser or CDN that
cached an earlier copy will keep serving it after a deploy. That is not a
cosmetic problem: when the icon sizing moved into CSS, visitors holding the
previous `sections.css` had no `.ic` rule at all, and an unsized inline <svg>
falls back to 300x150 — every button arrow and contact icon rendered enormous.

The hash covers the contents of assets/css and assets/js, so the query string
changes exactly when one of those files changes, and not otherwise.

Run this after editing any CSS or JS, before committing:

    python3 scripts/version_assets.py
"""
import hashlib
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = ["index.html", os.path.join("projects", "eghr.html")]
ASSET_DIRS = [os.path.join("assets", "css"), os.path.join("assets", "js")]


def digest():
    h = hashlib.sha256()
    for rel in ASSET_DIRS:
        d = os.path.join(ROOT, rel)
        for fn in sorted(os.listdir(d)):
            if fn.endswith((".css", ".js")):
                with open(os.path.join(d, fn), "rb") as fh:
                    h.update(fh.read())
    return h.hexdigest()[:8]


def main():
    ver = digest()
    total = 0
    misses = []
    for page in PAGES:
        path = os.path.join(ROOT, page)
        with open(path, encoding="utf-8") as fh:
            s = fh.read()
        # [^"?]+ not [a-z-]+ : a filename with a digit, underscore or capital
        # would otherwise be skipped silently and never cache-busted, which is
        # the exact failure this script exists to prevent.
        s = re.sub(r'(href="(?:\.\./)?assets/css/[^"?]+\.css)(\?v=[0-9a-f]+)?"',
                   r"\1?v=" + ver + '"', s)
        s = re.sub(r'(src="(?:\.\./)?assets/js/[^"?]+\.js)(\?v=[0-9a-f]+)?"',
                   r"\1?v=" + ver + '"', s)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(s)
        n = len(re.findall(r"\?v=" + ver, s))
        # Anything still pointing at a local css/js without a version is a
        # miss; say so and fail rather than reporting success.
        missed = re.findall(r'(?:href|src)="(?:\.\./)?assets/(?:css|js)/[^"]+\.(?:css|js)"', s)
        total += n
        print(f"  {page}: {n} asset links -> ?v={ver}")
        for m in missed:
            print(f"    MISSED (not versioned): {m}")
            misses.append(m)
    print(f"Stamped {total} links with version {ver}")
    if misses:
        print(f"ERROR: {len(misses)} asset link(s) were not versioned.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
