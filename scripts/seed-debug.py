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
    "unicode-filenames": {
        "中文图片.png": "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAKklEQVR4nGN4JidHU8QwasGoBaMWjFowasGoBaMWjFowasGoBaMWDBULAEhziD2uUd8dAAAAAElFTkSuQmCC",
        "概要図.png": "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAKklEQVR4nO3NQQkAAAgEsEtiZlOawxQ+hMH+S/WcikAgEAgEAoFAIPgSLCocUFs7qW//AAAAAElFTkSuQmCC",
        "café.png": "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAKklEQVR4nGNQWmBDU8QwasGoBaMWjFowasGoBaMWjFowasGoBaMWDBULAI0Q+C59qRN+AAAAAElFTkSuQmCC",
        "report final.png": "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAKklEQVR4nO3NQQkAAAgEsEtidiMawRQ+hMH+y3SdikAgEAgEAoFAIPgSLDdvuFvdsUKkAAAAAElFTkSuQmCC",
        "arch.png": "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAKklEQVR4nGOoCDhBU8QwasGoBaMWjFowasGoBaMWjFowasGoBaMWDBULAASLQFsH05tHAAAAAElFTkSuQmCC",
    },
}


def register(username: str, password: str = "testpass123") -> str | None:
    r = requests.post(f"{BASE}/api/v1/auth/login", json={"username": username, "password": password})
    if r.ok:
        return r.json()["access_token"]
    r = requests.post(f"{BASE}/api/v1/auth/register", json={"username": username, "password": password})
    if r.ok:
        return r.json()["access_token"]
    # login + register both failed: user exists but disabled (rerun scenario)
    return None


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
    if r.status_code == 409:
        # idempotency_key already used by another user (rerun disabled-user fallback), skip
        return None
    r.raise_for_status()
    return r.json()


def main():
    print(f"Seeding {BASE} ...")
    print(f"Loading from {SEED_DIR} ...")

    alice = register("alice")
    bob = register("bob")
    carol = register("carol")
    dave = register("dave")
    tokens = {"alice": alice, "bob": bob, "carol": carol, "dave": dave}
    print("Users: alice, bob, carol, dave")

    # Load all entry directories
    entry_dirs = sorted(
        d for d in SEED_DIR.iterdir()
        if d.is_dir() and (d / "meta.json").exists()
    )

    for entry_dir in entry_dirs:
        slug = entry_dir.name
        meta = json.loads((entry_dir / "meta.json").read_text(encoding="utf-8"))
        owner = meta.get("owner", "alice")
        token = tokens.get(owner)
        if token is None:
            print(f"  SKIP {slug}: owner disabled (rerun)")
            continue

        files = load_entry_files(entry_dir, slug)
        if not files:
            print(f"  SKIP {slug}: no content files")
            continue

        try:
            result = create_entry(token, slug, meta, files)
            if result is None:
                print(f"  SKIP {slug}: idempotency conflict (409)")
                continue
            file_count = len(files)
            print(f"  OK   {slug}: {meta['summary'][:40]} ({file_count} files)")

            # Archive legacy-deploy
            if slug == "legacy-deploy":
                requests.patch(
                    f"{BASE}/api/v1/entries/{result['slug']}",
                    headers={"Authorization": f"Bearer {token}"},
                    json={"status": "archived"},
                )
        except requests.HTTPError as e:
            print(f"  FAIL {slug}: {e}")

    # Disable dave (disabled user sample) -- must be after entry creation
    if dave is None:
        print("  SKIP disable dave: already disabled (rerun)")
    else:
        try:
            r = requests.get(
                f"{BASE}/api/v1/admin/users",
                headers={"Authorization": f"Bearer {alice}"},
            )
            users_data = r.json()
            users_list = users_data.get("items", users_data) if isinstance(users_data, dict) else users_data
            dave_user = next((u for u in users_list if u["username"] == "dave"), None)
            if dave_user:
                resp = requests.post(
                    f"{BASE}/api/v1/admin/users/{dave_user['id']}/disable",
                    headers={"Authorization": f"Bearer {alice}"},
                    json={"reason": "seed: disabled user sample"},
                )
                if resp.ok:
                    print("  OK   disable dave (disabled user sample)")
                else:
                    print(f"  WARN disable dave: {resp.status_code} (may already be disabled)")
        except Exception as e:
            print(f"  WARN disable dave: {e}")

    # Teams (TPV0095): 2 teams, owner + member, for manual UX of owned/joined views.
    # Slugs must NOT collide with E2E fixtures (team-visibility uses 'proj-a'; teams-page uses T-<ts> random).
    TEAM_SEEDS = [
        {"slug": "frontend-team", "name": "frontend-team", "owner": "alice", "members": ["bob"]},
        {"slug": "backend-solo", "name": "backend-solo", "owner": "carol", "members": []},
    ]
    created_teams = 0
    for t in TEAM_SEEDS:
        owner_token = tokens.get(t["owner"])
        if owner_token is None:
            print(f"  SKIP team {t['slug']}: owner disabled")
            continue
        try:
            existing = requests.get(
                f"{BASE}/api/v1/teams",
                headers={"Authorization": f"Bearer {owner_token}"},
            ).json()
            owned_slugs = {team["slug"] for team in existing.get("owned", [])}
            if t["slug"] in owned_slugs:
                print(f"  OK   team {t['slug']}: already exists (idempotent)")
                continue
            r = requests.post(
                f"{BASE}/api/v1/teams",
                headers={"Authorization": f"Bearer {owner_token}"},
                json={"name": t["name"]},
            )
            if not r.ok:
                print(f"  WARN team {t['slug']}: create {r.status_code} {r.text[:80]}")
                continue
            team = r.json()
            for username in t["members"]:
                member_token = tokens.get(username)
                if member_token is None:
                    continue
                mr = requests.post(
                    f"{BASE}/api/v1/teams/{team['slug']}/members",
                    headers={"Authorization": f"Bearer {owner_token}"},
                    json={"username": username},
                )
                if mr.ok:
                    print(f"      + member {username} -> {team['slug']}")
            created_teams += 1
            print(f"  OK   team {t['slug']}: created (owner={t['owner']}, members={len(t['members'])})")
        except Exception as e:
            print(f"  WARN team {t['slug']}: {e}")

    # Summary
    r = requests.get(f"{BASE}/api/v1/entries", headers={"Authorization": f"Bearer {alice}"})
    total = r.json().get("total", "?")
    print(f"\nDone. Total entries: {total}")
    print("Teams: frontend-team (alice owned, bob joined) / backend-solo (carol owned)")
    print("Users: alice/bob/carol/dave (password: testpass123, dave disabled)")
    print(f"Entries: {len(entry_dirs)} loaded from seed-data/")


if __name__ == "__main__":
    main()
