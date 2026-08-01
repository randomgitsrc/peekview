#!/usr/bin/env python3
"""Seed debug database from sample files.

Usage: python3 scripts/seed-debug.py [BASE_URL]
Default BASE_URL: http://127.0.0.1:8888

Loads sample files from scripts/seed-data/<slug>/ and POSTs to the API.
Each subdirectory = one entry, with a meta.json (summary/tags/is_public/owner)
and content files. Binary files use .bin extension with content_base64 in meta.

Creates:
- 3 users: alice, bob, carol (password: testpass123)
- 18 entries from seed-data/ directory
"""

import base64
import json
import sys
from pathlib import Path

import requests

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8888"

if ":8080" in BASE or "peekview.ai" in BASE or "peek.gsis.top" in BASE:
    print(f"FATAL: refusing to seed production ({BASE})")
    sys.exit(1)

SEED_DIR = Path(__file__).parent / "seed-data"

# PNG screenshot for product-screenshots entry
MINI_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAUAAAAC0CAIAAABqhmJGAAAFLUlEQVR4nO3Y24uc9R3H8d/MPLN"
    "mE10vW6wbknQ8QJZV64UXpdX6D9giREFUMCZCaUqKtNADpfRCKtaq9CptKB4oUjxhL1rwhBp7"
    "G4sJajYxLUZz0RohG7OnzDNPLzZsD7to2UTDx3m97uYH34ffDPOe5/dMa+v24wXI1D7XGwBWT"
    "8AQTMAQTMAQTMAQTMAQTMAQTMAQTMAQTMAQTMAQTMAQTMAQTMAQTMAQTMAQTMAQTMAQTMAQrDq"
    "T4d27xs7WPmCY3XnX9OoG3YEhmIAhmIAhmIAhmIAhmIAhmIAhmIAhmIAhmIAhmIAhmIAhmIAhm"
    "IAhmIAhmIAhmIAhmIAhmIAhmIAhmIAhmIAhmIAhmIAhmIAhmIAhmIAhmIAhmIAhmIAhmIAhmIA"
    "hmIAhmIAhmIAhmIAhmIAhmIAhmIAhmIAhmIAhmIAhmIAhmIAhmIAhmIAhmIAhmIAhmIAhWH"
    "HWuN3AOfPs70xs3dkpp1XVz85Y1GzZ0/p+rHTtP/PrBC5ZePvnU3Be+2PnaV7uLL3/14Mx113"
    "anp5vrrh35VDYNKxnGgDtV6/t3ryulvPf+4OFHZn/yo3WruMjkZPfFlxYWA56fbz78cPCVq7pn"
    "eaPwSYb6CH3xl9offDCYmWl2/272/gdm7v3lyb/9vS6lLF9ZcuJE87Off3T06KD35c6779aDQS"
    "mlvPlWPTFRlVJ27Dyx4viPf/rRsWODUsoDD808/oe5UsqBqf5vds9+1m+Yz52hDvitt/vj450n"
    "npy7/hsjd39v7bY7Rh99bK6UsnxlUb9fdv129uYtay66qN1ul02bOu8crkspb+w7deUV/z7LLB"
    "+f2FxNHaybpjRNOXKkLqVMTZ1uHs7EMH6H6n5z3/0nm6aMjrZuv23NvffN/OOfpyudX2gGg7L/"
    "zfp/VtrtUkr5/eOz11zTvfzy0x/aFZPV/v39S3qdw4frW28ZXbr+8vGJzdXe10+NX9xeP94+8"
    "t5gbq6ZOlhv+7qnZc7UMAa89Ay8aFA3O797frdbmqYcPFS32yuslFL6/eb9o4NS+kt/XE1srl5"
    "4cebqI9X69Z32fxxllo9fdln19DPzhw7XvV7VHakPTNX9fjM21vpM3zafR0N9hF7U61Wv//VUK"
    "WXf/v6f/jy/4koppapaP/zBumPHmlf3LCyurF3bGhlpvfaXU1ddWX38BUe6ZezC1t69/V6vc0mv"
    "89zzC5deOow/nZx1vkblpi3nPfrY3MuvLLQ7rdtvXbPiyqJWq2zbOnrPL06Oj3c2buiUUiYnq2"
    "f/OH/jt877+AuWUiY2V3v2LJy/rrVpY+fgof43b/ivEVid1tbtx1c9vHvX2FncCgytO++aXt2g"
    "IzQEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEE"
    "zAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzA"
    "EEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEE"
    "zAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzAEEzA"
    "EEzAEEzAEEzAEEzAEEzAEEzAEa23dfvxc7wFYJXdgCCZgCCZgCCZgCCZgCCZgCCZgCCZgCCZgC"
    "CZgCCZgCCZgCCZgCCZgCCZgCCZgCCZgCCZgCPYvd4xbnNfrIwIAAAAASUVORK5CYII="
)

# Binary file overrides: slug -> {filename -> base64_content}
BINARY_OVERRIDES = {
    "product-screenshots": {
        "screenshot.png": MINI_PNG_B64,
    },
}


def register(username: str, password: str = "testpass123") -> str:
    r = requests.post(f"{BASE}/api/v1/auth/login", json={"username": username, "password": password})
    if r.ok:
        return r.json()["access_token"]
    r = requests.post(f"{BASE}/api/v1/auth/register", json={"username": username, "password": password})
    r.raise_for_status()
    return r.json()["access_token"]


def load_entry_files(slug_dir: Path, slug: str) -> list[dict]:
    """Load all content files from a seed-data subdirectory."""
    files = []
    for f in sorted(slug_dir.iterdir()):
        if f.name == "meta.json":
            continue
        if not f.is_file():
            continue

        # Check for binary override
        if slug in BINARY_OVERRIDES and f.name in BINARY_OVERRIDES[slug]:
            files.append({
                "filename": f.name,
                "content_base64": BINARY_OVERRIDES[slug][f.name],
            })
        else:
            content = f.read_text(encoding="utf-8")
            files.append({
                "filename": f.name,
                "content": content,
            })
    return files


def create_entry(token: str, slug: str, meta: dict, files: list[dict]) -> dict | None:
    payload = {
        "summary": meta["summary"],
        "slug": slug,
        "tags": meta.get("tags", []),
        "is_public": meta.get("is_public", True),
        "files": files,
        "idempotency_key": f"seed-{meta['summary']}",
    }
    r = requests.post(
        f"{BASE}/api/v1/entries",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
    )
    r.raise_for_status()
    return r.json()


def main():
    print(f"Seeding {BASE} ...")
    print(f"Loading from {SEED_DIR} ...")

    alice = register("alice")
    bob = register("bob")
    carol = register("carol")
    tokens = {"alice": alice, "bob": bob, "carol": carol}
    print("Users: alice, bob, carol")

    # Load all entry directories
    entry_dirs = sorted(
        d for d in SEED_DIR.iterdir()
        if d.is_dir() and (d / "meta.json").exists()
    )

    archived_slug = None
    for entry_dir in entry_dirs:
        slug = entry_dir.name
        meta = json.loads((entry_dir / "meta.json").read_text(encoding="utf-8"))
        owner = meta.get("owner", "alice")
        token = tokens.get(owner, alice)

        files = load_entry_files(entry_dir, slug)
        if not files:
            print(f"  SKIP {slug}: no content files")
            continue

        try:
            result = create_entry(token, slug, meta, files)
            file_count = len(files)
            print(f"  OK   {slug}: {meta['summary'][:40]} ({file_count} files)")

            # Archive legacy-deploy
            if slug == "legacy-deploy":
                requests.patch(
                    f"{BASE}/api/v1/entries/{result['slug']}",
                    headers={"Authorization": f"Bearer {token}"},
                    json={"status": "archived"},
                )
                archived_slug = result["slug"]
        except requests.HTTPError as e:
            print(f"  FAIL {slug}: {e}")

    # Summary
    r = requests.get(f"{BASE}/api/v1/entries", headers={"Authorization": f"Bearer {alice}"})
    total = r.json().get("total", "?")
    print(f"\nDone. Total entries: {total}")
    print("Users: alice/bob/carol (password: testpass123)")
    print(f"Entries: {len(entry_dirs)} loaded from seed-data/")


if __name__ == "__main__":
    main()
