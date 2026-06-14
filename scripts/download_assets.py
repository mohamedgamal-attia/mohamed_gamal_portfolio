#!/usr/bin/env python3
"""
download_assets.py — attempt to download real company logos from official sources.

Run from the project root:
    python3 scripts/download_assets.py

Files are saved to assets/images/companies/.
If a download fails, the existing placeholder is left in place.
"""

import urllib.request
import urllib.error
import os
import sys

ASSETS_DIR = "assets/images/companies"
SOURCES = [
    {
        "name":   "ejadtech-logo.png",
        "urls": [
            "https://ejadtech.sa/web/image/website/1/logo/ejadtech-logo?unique=dae4b20",
        ],
    },
    {
        "name":   "ejad-digital-logo.png",
        "urls": [
            "https://ejad.sa/wp-content/uploads/2024/10/logo-w-l.png",
            "https://ejad.sa/wp-content/uploads/logo.png",
        ],
    },
    {
        "name":   "margins-logo.png",
        "urls": [
            "https://marginsdevelopments.com/wp-content/uploads/logo.png",
            "https://marginsdevelopments.com/wp-content/uploads/2023/01/logo.png",
            "https://marginsdevelopments.com/wp-content/uploads/2024/01/logo.png",
        ],
    },
    {
        "name":   "dotec-logo.png",
        "urls": [
            "https://dotecengineering.com/wp-content/uploads/logo-main.png",
            "https://dotecengineering.com/wp-content/uploads/logo.png",
        ],
    },
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36"
}


def try_download(url, dest_path):
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status != 200:
                return False
            data = resp.read()
            if len(data) < 500:
                return False
            with open(dest_path, "wb") as f:
                f.write(data)
            return True
    except Exception:
        return False


def main():
    os.makedirs(ASSETS_DIR, exist_ok=True)
    for item in SOURCES:
        dest = os.path.join(ASSETS_DIR, item["name"])
        print(f"\n→ {item['name']}")
        downloaded = False
        for url in item["urls"]:
            print(f"  Trying: {url}")
            if try_download(url, dest):
                size = os.path.getsize(dest)
                print(f"  ✅ Saved ({size} bytes) → {dest}")
                downloaded = True
                break
            else:
                print(f"  ✗ Failed")
        if not downloaded:
            existing = os.path.exists(dest) or os.path.exists(dest.replace(".png", ".svg"))
            if existing:
                print(f"  ⚠️  All URLs failed — keeping existing placeholder")
            else:
                print(f"  ❌ Not downloaded and no placeholder found")

    print("\nDone.")


if __name__ == "__main__":
    main()
