#!/usr/bin/env python3
"""
capture_eghr_screenshots.py
---------------------------
Replaces the EGHR interface schematics with real captures from a running
portal. Run this on a machine that can reach the EGHR instance — it is not
part of the site build and nothing on the published site depends on it.

What it does
  1. signs in with a demo/QA account (credentials from the environment),
  2. walks every portal route in both languages and both themes,
  3. masks anything that could carry personal data before the shutter,
  4. writes optimised WebP into assets/images/projects/eghr/,
  5. repoints projects/eghr.html and assets/data/projects.json at the files
     it actually produced.

Usage
  pip install playwright pillow && playwright install chromium

  export EGHR_URL=http://localhost:8069     # whatever port the instance serves on
  export EGHR_DB=<database>
  export EGHR_USER=qa.demo@example.com      # a demo/QA account, never a real employee
  export EGHR_PASSWORD=...                  # read from the environment, never committed

  python3 scripts/capture_eghr_screenshots.py            # capture, optimise, swap
  python3 scripts/capture_eghr_screenshots.py --list     # show the plan and exit
  python3 scripts/capture_eghr_screenshots.py --no-swap   # capture only
  python3 scripts/capture_eghr_screenshots.py --swap-only # re-point the references

Privacy
  MASK_SELECTORS is applied on every page before the screenshot. Review the
  output by eye before committing: a schematic that is slightly generic is a
  far smaller problem than a screenshot carrying somebody's salary.
"""

import argparse
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets/images/projects/eghr"
PAGE = ROOT / "projects/eghr.html"

URL = os.environ.get("EGHR_URL", "http://localhost:8069").rstrip("/")
DB = os.environ.get("EGHR_DB", "")
USER = os.environ.get("EGHR_USER", "")
PASSWORD = os.environ.get("EGHR_PASSWORD", "")

DESKTOP = {"width": 1440, "height": 900}
MOBILE = {"width": 420, "height": 880}

# Anything matching these is blanked before the shutter. Extend it for your
# instance rather than trimming it.
MASK_SELECTORS = [
    "[data-employee-email]", ".o_portal_user_email", ".employee-email",
    "[data-employee-id]", ".employee-code", ".o_portal_my_details",
    ".employee-phone", ".employee-iban", ".employee-salary",
    ".o_portal_chatter_author", "img.o_avatar", ".employee-avatar",
]

# name in the repo  ->  (portal path, viewport, language, theme)
SHOTS = {
    "dashboard-desktop-en-dark":        ("/my", DESKTOP, "en_US", "dark"),
    "dashboard-desktop-en-light":       ("/my", DESKTOP, "en_US", "light"),
    "dashboard-desktop-ar-dark":        ("/my", DESKTOP, "ar_001", "dark"),
    "dashboard-desktop-ar-light":       ("/my", DESKTOP, "ar_001", "light"),
    "requests-desktop-en-dark":         ("/my/requests", DESKTOP, "en_US", "dark"),
    "actions-desktop-en-dark":          ("/my/actions", DESKTOP, "en_US", "dark"),
    "request-detail-desktop-en-dark":   ("/my/requests/1", DESKTOP, "en_US", "dark"),
    "request-detail-desktop-ar-light":  ("/my/requests/1", DESKTOP, "ar_001", "light"),
    "attendance-desktop-en-dark":       ("/my/attendance", DESKTOP, "en_US", "dark"),
    "attendance-desktop-ar-light":      ("/my/attendance", DESKTOP, "ar_001", "light"),
    "services-desktop-en-dark":         ("/my/services", DESKTOP, "en_US", "dark"),
    "services-desktop-ar-light":        ("/my/services", DESKTOP, "ar_001", "light"),
    "service-form-desktop-en-dark":     ("/my/services/time-off", DESKTOP, "en_US", "dark"),
    "announcements-desktop-en-dark":    ("/my/announcements", DESKTOP, "en_US", "dark"),
    "announcement-detail-desktop-ar-light": ("/my/announcements/1", DESKTOP, "ar_001", "light"),
    "profile-desktop-en-dark":          ("/my/profile", DESKTOP, "en_US", "dark"),
    "dashboard-mobile-en":              ("/my", MOBILE, "en_US", "dark"),
    "dashboard-mobile-ar":              ("/my", MOBILE, "ar_001", "dark"),
    "services-mobile-en":               ("/my/services", MOBILE, "en_US", "dark"),
    "request-form-mobile-en":           ("/my/services/time-off", MOBILE, "en_US", "dark"),
    "attendance-mobile-en":             ("/my/attendance", MOBILE, "en_US", "dark"),
    "announcements-mobile-ar":          ("/my/announcements", MOBILE, "ar_001", "dark"),
    "profile-mobile-en":                ("/my/profile", MOBILE, "en_US", "dark"),
}


def optimise(png: Path, webp: Path, quality: int = 86) -> None:
    from PIL import Image
    with Image.open(png) as im:
        im.convert("RGB").save(webp, "WEBP", quality=quality, method=6)
    png.unlink()


DATA = ROOT / "assets/data/projects.json"


def swap_refs(names) -> int:
    """Point every reference at the captures that actually landed on disk.

    Covers the case-study page (including the data-src-* attributes the
    language/theme switch reads) and the homepage card's cover and gallery.
    """
    captured = [n for n in sorted(names) if (OUT / f"{n}.webp").exists()]
    if not captured:
        return 0

    swapped = 0
    for target in (PAGE, DATA):
        if not target.exists():
            continue
        text = target.read_text(encoding="utf-8")
        for name in captured:
            text, n = re.subn(re.escape(f"{name}.svg"), f"{name}.webp", text)
            swapped += n
        target.write_text(text, encoding="utf-8")
    return swapped


def capture() -> list:
    from playwright.sync_api import sync_playwright

    if not (USER and PASSWORD):
        sys.exit("Set EGHR_USER and EGHR_PASSWORD in the environment first.")

    OUT.mkdir(parents=True, exist_ok=True)
    done = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(viewport=DESKTOP, device_scale_factor=2)
        page = ctx.new_page()

        page.goto(f"{URL}/web/login" + (f"?db={DB}" if DB else ""))
        page.fill("input[name='login']", USER)
        page.fill("input[name='password']", PASSWORD)
        page.click("button[type='submit']")
        page.wait_for_load_state("networkidle")
        if "/web/login" in page.url:
            sys.exit("Sign-in failed — check EGHR_URL, EGHR_DB and the credentials.")

        current_lang = None
        for name, (path, viewport, lang, theme) in SHOTS.items():
            page.set_viewport_size(viewport)

            if lang != current_lang:
                resp = page.goto(f"{URL}/web/session/lang?lang={lang}")
                if resp is not None and resp.status >= 400:
                    sys.exit(
                        f"Could not switch to {lang} (HTTP {resp.status}). Fix the language "
                        f"route before capturing — otherwise the RTL screens would be "
                        f"English screens saved under Arabic names.")
                current_lang = lang

            page.goto(f"{URL}{path}")
            page.wait_for_load_state("networkidle")
            if f"{URL}{path}" not in page.url:
                sys.exit(f"{path} redirected to {page.url} — check the route and the account's access.")
            page.evaluate(
                "t => document.documentElement.setAttribute('data-theme', t)", theme)
            # blank anything that could carry personal data
            page.evaluate(
                """sels => sels.forEach(s => document.querySelectorAll(s)
                     .forEach(el => { el.style.filter = 'blur(9px)';
                                      el.setAttribute('aria-hidden', 'true'); }))""",
                MASK_SELECTORS)
            page.wait_for_timeout(600)

            png = OUT / f"{name}.png"
            page.screenshot(path=str(png), full_page=False)
            optimise(png, OUT / f"{name}.webp")
            done.append(name)
            print(f"  captured {name}.webp  ({path}, {lang}, {theme})")

        browser.close()
    return done


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--list", action="store_true", help="print the capture plan and exit")
    ap.add_argument("--no-swap", action="store_true",
                    help="capture but leave the page and data file alone")
    ap.add_argument("--swap-only", action="store_true",
                    help="only repoint the page and data file at existing .webp files")
    args = ap.parse_args()

    if args.list:
        print(f"{len(SHOTS)} screens from {URL}\n")
        for name, (path, vp, lang, theme) in SHOTS.items():
            print(f"  {name:42s} {path:28s} {vp['width']}x{vp['height']}  {lang}  {theme}")
        return

    names = list(SHOTS) if args.swap_only else capture()

    if not args.no_swap:
        n = swap_refs(names)
        print(f"\n{n} image references repointed at real captures "
              f"(projects/eghr.html + assets/data/projects.json).")
        if n:
            print("Review every file by eye for personal data before committing.")


if __name__ == "__main__":
    main()
