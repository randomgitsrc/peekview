#!/usr/bin/env python3
"""
版本同步脚本：从 VERSIONS.json（单一真相源）同步到所有源码和文档文件。

用法：
  python3 scripts/sync_versions.py                       # 从 VERSIONS.json 同步到所有文件
  python3 scripts/sync_versions.py --check               # 仅检查，不修改
  python3 scripts/sync_versions.py --bump-peekview X.Y.Z # 更新 peekview 版本并同步
  python3 scripts/sync_versions.py --bump-mcp X.Y.Z      # 更新 mcp_server 版本并同步
  python3 scripts/sync_versions.py --verbose             # 显示详细信息
"""

import os
import re
import sys
import json
import argparse
from pathlib import Path
from datetime import date


ROOT = Path(__file__).resolve().parent.parent
VERSIONS_FILE = ROOT / "VERSIONS.json"
SEMVER = r"\d+\.\d+\.\d+"


def read_versions() -> dict:
    if not VERSIONS_FILE.exists():
        return {"peekview": "0.0.0", "mcp_server": "0.0.0"}
    return json.loads(VERSIONS_FILE.read_text())


def write_versions(versions: dict):
    VERSIONS_FILE.write_text(json.dumps(versions, indent=2) + "\n")


# ─────────────────────────────────────────────
# 版本槽位定义
# ─────────────────────────────────────────────

Slot = tuple[str, str, str, int]  # (file_path, regex_pattern, version_key, max_replace)


SOURCE_SLOTS: list[Slot] = [
    ("backend/pyproject.toml", rf'version = "{SEMVER}"', "peekview", 1),
    ("backend/peekview/__init__.py", rf'__version__ = "{SEMVER}"', "peekview", 1),
    ("frontend-v3/package.json", rf'"version": "{SEMVER}"', "peekview", 1),
    ("packages/mcp-server/package.json", rf'"version": "{SEMVER}"', "mcp_server", 1),
]

DOC_SLOTS: list[Slot] = [
    # README.md
    ("README.md", rf"version-{SEMVER}-blue", "peekview", 0),
    # CLAUDE.md
    ("CLAUDE.md", rf"\*\*Current Version:\*\* v{SEMVER}", "peekview", 0),
    ("CLAUDE.md", rf"MCP Server v{SEMVER}", "mcp_server", 0),
    ("CLAUDE.md", rf"Architecture \(v{SEMVER}\)", "mcp_server", 0),
    # INDEX.md
    ("INDEX.md", rf"Backend/Frontend v{SEMVER}", "peekview", 0),
    ("INDEX.md", rf"MCP Server v{SEMVER}", "mcp_server", 0),
    # improvement-backlog.md
    ("docs/roadmap/improvement-backlog.md", rf"Backend v{SEMVER}", "peekview", 0),
    ("docs/roadmap/improvement-backlog.md", rf"MCP Server v{SEMVER}", "mcp_server", 0),
    # backend/README.md health check version
    ("backend/README.md", rf'"version": "{SEMVER}"', "peekview", 0),
]


def _replace_ver(match: re.Match, new_ver: str) -> str:
    return re.sub(SEMVER, new_ver, match.group(0))


def sync_slots(slots: list[Slot], versions: dict, check_only: bool, verbose: bool) -> bool:
    all_ok = True
    for file_path, pattern, ver_key, count in slots:
        f = ROOT / file_path
        if not f.exists():
            print(f"  ⚠️  跳过（文件不存在）: {file_path}")
            continue

        content = f.read_text()
        new_ver = versions.get(ver_key, "0.0.0")
        found = bool(re.search(pattern, content))

        if not found:
            if new_ver in content:
                if verbose:
                    print(f"  ✅ {file_path}: 已是最新 ({ver_key}={new_ver})")
                continue
            print(f"  ⚠️  {file_path}: 未匹配到 {ver_key} 版本模式，请手动检查")
            all_ok = False
            continue

        new_content = re.sub(pattern, lambda m: _replace_ver(m, new_ver), content, count=count if count > 0 else 0)

        if new_content == content:
            if verbose:
                print(f"  ✅ {file_path}: 已是最新 ({ver_key}={new_ver})")
        elif check_only:
            print(f"  ❌ {file_path}: 版本不同步 ({ver_key})")
            all_ok = False
        else:
            f.write_text(new_content)
            print(f"  ✅ {file_path}: 已更新 ({ver_key} → {new_ver})")

    return all_ok


def ensure_changelog(versions: dict, check_only: bool, verbose: bool) -> bool:
    changelog = ROOT / "CHANGELOG.md"
    if not changelog.exists():
        print("  ⚠️  CHANGELOG.md 不存在")
        return True

    content = changelog.read_text()
    all_ok = True
    entries = [
        ("peekview", versions["peekview"], f"[{versions['peekview']}]"),
        ("mcp_server", versions["mcp_server"], f"[mcp-v{versions['mcp_server']}]"),
    ]

    for ver_key, version, marker in entries:
        if marker in content:
            if verbose:
                print(f"  ✅ CHANGELOG.md: 已有 {marker} 记录")
            continue

        if check_only:
            print(f"  ❌ CHANGELOG.md: 缺少 {marker} 版本记录")
            all_ok = False
            continue

        today = date.today().isoformat()
        section = "新增" if ver_key == "peekview" else "变更"
        template = f"""
## {marker} - {today}

### {section}

-

"""
        if "## [Unreleased]" in content:
            content = content.replace("## [Unreleased]\n", f"## [Unreleased]\n{template}", 1)
            changelog.write_text(content)
            print(f"  ✅ CHANGELOG.md: 已插入 {marker} 模板")
            print(f"     ⚠️  请编辑 CHANGELOG.md 填写 {marker} 的具体内容")
        else:
            print(f"  ⚠️  CHANGELOG.md: 未找到 [Unreleased] 节，请手动添加 {marker}")

    return all_ok


# ─────────────────────────────────────────────
# bump 操作
# ─────────────────────────────────────────────

def bump_version(key: str, new_version: str):
    versions = read_versions()
    old = versions.get(key, "0.0.0")
    if old == new_version:
        print(f"  ⚠️  {key} 已经是 v{new_version}，无需更新")
    else:
        versions[key] = new_version
        write_versions(versions)
        print(f"  ✅ VERSIONS.json: {key} v{old} → v{new_version}")


def verify_semver(version: str) -> bool:
    return bool(re.fullmatch(r"\d+\.\d+\.\d+", version))


# ─────────────────────────────────────────────
# main
# ─────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="从 VERSIONS.json 同步版本到所有源码和文档文件",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例：
  python3 scripts/sync_versions.py                      # 同步所有文件
  python3 scripts/sync_versions.py --check              # 仅检查
  python3 scripts/sync_versions.py --bump-peekview 0.1.56  # bump + 同步
  python3 scripts/sync_versions.py --bump-mcp 0.8.5     # bump mcp + 同步
        """,
    )
    parser.add_argument("--check", action="store_true", help="只检查不修复")
    parser.add_argument("--verbose", action="store_true", help="显示详细输出")
    parser.add_argument("--bump-peekview", metavar="X.Y.Z", help="更新 peekview 版本")
    parser.add_argument("--bump-mcp", metavar="X.Y.Z", help="更新 mcp_server 版本")
    args = parser.parse_args()

    os.chdir(ROOT)

    if args.bump_peekview or args.bump_mcp:
        if args.bump_peekview:
            if not verify_semver(args.bump_peekview):
                print(f"❌ 无效版本号: {args.bump_peekview}")
                sys.exit(1)
            bump_version("peekview", args.bump_peekview)
        if args.bump_mcp:
            if not verify_semver(args.bump_mcp):
                print(f"❌ 无效版本号: {args.bump_mcp}")
                sys.exit(1)
            bump_version("mcp_server", args.bump_mcp)

    versions = read_versions()
    pv = versions.get("peekview", "0.0.0")
    mcp = versions.get("mcp_server", "0.0.0")

    mode = "检查模式" if args.check else "同步模式"
    print(f"{'=' * 52}")
    print(f"  版本同步  [{mode}]")
    print(f"  peekview: v{pv}    mcp_server: v{mcp}")
    print(f"{'=' * 52}")
    print()

    all_ok = True

    print("── 源码文件 ──")
    if not sync_slots(SOURCE_SLOTS, versions, args.check, args.verbose):
        all_ok = False

    print()
    print("── 文档文件 ──")
    if not sync_slots(DOC_SLOTS, versions, args.check, args.verbose):
        all_ok = False

    print()
    print("── CHANGELOG ──")
    if not ensure_changelog(versions, args.check, args.verbose):
        all_ok = False

    print()
    if all_ok:
        print("✅ 所有文件版本同步完成")
        sys.exit(0)
    else:
        if args.check:
            print("❌ 存在不同步，请运行: python3 scripts/sync_versions.py")
        else:
            print("⚠️  部分文件无法自动同步，请检查上方的 ⚠️ 项")
        sys.exit(1)


if __name__ == "__main__":
    main()
