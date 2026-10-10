#!/usr/bin/env python3
"""Stamp a content hash onto every local CSS/JS link in the HTML pages.

Why this exists
---------------
The stylesheets and scripts have stable filenames, so a browser or CDN that
cached an earlier copy will keep serving it after a deploy. That is not a
cosmetic problem: when the icon sizing moved into CSS, visitors holding the
previous `sections.css` had no `.ic` rule at all, and an unsized inline <svg>
falls back to 300x150 - every button arrow and contact icon rendered enormous.
The same hazard applies to the i18n dictionaries: a visitor holding an old
`ar.js` keeps seeing the old translation.

The hash covers every file in ASSET_DIRS, so the query string changes exactly
when one of those files changes, and not otherwise.

Pages and asset directories are DISCOVERED, not listed, so a new page or a new
asset folder cannot be silently left out. Any local css/js link that ends up
without a version is reported and the script exits non-zero.

Run this after editing any CSS or JS, before committing:

    python3 scripts/version_assets.py
"""
import hashlib
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSET_ROOT = os.path.join(ROOT, "assets")
# Directories under assets/ whose .css/.js files are versioned.
ASSET_SUBDIRS = ("css", "js", "i18n")
SKIP_DIRS = {".git", "node_modules", "backend", "qa", "docs", "scripts"}


def html_pages():
    """Every HTML page in the site, found rather than listed."""
    out = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        for fn in filenames:
            if fn.endswith(".html"):
                out.append(os.path.relpath(os.path.join(dirpath, fn), ROOT))
    return sorted(out)


def asset_files():
    out = []
    for sub in ASSET_SUBDIRS:
        d = os.path.join(ASSET_ROOT, sub)
        if not os.path.isdir(d):
            continue
        for dirpath, _, filenames in os.walk(d):
            for fn in sorted(filenames):
                if fn.endswith((".css", ".js")):
                    out.append(os.path.join(dirpath, fn))
    return sorted(out)


def digest():
    h = hashlib.sha256()
    for path in asset_files():
        h.update(os.path.relpath(path, ROOT).encode())
        with open(path, "rb") as fh:
            h.update(fh.read())
    return h.hexdigest()[:8]


# Any number of ../ hops, any assets subdirectory we version.
_DIRS = "|".join(ASSET_SUBDIRS)
LINK_RE = re.compile(
    r'((?:href|src)="(?:\.\./)*assets/(?:' + _DIRS + r')/[^"?]+\.(?:css|js))(\?v=[0-9a-f]+)?"'
)
MISS_RE = re.compile(
    r'(?:href|src)="((?:\.\./)*assets/(?:' + _DIRS + r')/[^"]+\.(?:css|js))"'
)


def main():
    ver = digest()
    pages = html_pages()
    if not pages:
        print("ERROR: no HTML pages found.")
        return 1

    total, misses = 0, []
    for page in pages:
        path = os.path.join(ROOT, page)
        with open(path, encoding="utf-8") as fh:
            s = fh.read()
        s = LINK_RE.sub(r"\1?v=" + ver + '"', s)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(s)

        n = len(re.findall(r"\?v=" + ver, s))
        total += n
        print(f"  {page}: {n} asset links -> ?v={ver}")
        # Anything still pointing at a local versioned-directory asset without
        # a version is a miss; say so and fail rather than reporting success.
        for m in MISS_RE.findall(s):
            print(f"    MISSED (not versioned): {m}")
            misses.append(f"{page}: {m}")

    print(f"Stamped {total} links across {len(pages)} page(s) with version {ver}")
    print(f"Hash covers {len(asset_files())} files in assets/{{{','.join(ASSET_SUBDIRS)}}}")
    if misses:
        print(f"ERROR: {len(misses)} asset link(s) were not versioned.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
