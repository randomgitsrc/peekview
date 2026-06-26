#!/usr/bin/env python3
"""
自动更新所有文档中的版本引用。

在 make bump-version 后调用，确保文档与代码版本同步。
也可手动运行：python3 scripts/doc-sync/update_version_docs.py

用法：
  python3 scripts/doc-sync/update_version_docs.py           # 检查 + 修复
  python3 scripts/doc-sync/update_version_docs.py --check   # 只检查，不修复
  python3 scripts/doc-sync/update_version_docs.py --verbose # 显示详细信息
"""

import re
import sys
import argparse
from pathlib import Path
from datetime import date


# ─────────────────────────────────────────────
# 版本来源（单一真相）
# ─────────────────────────────────────────────

def get_current_version() -> str:
    """从 pyproject.toml 读取当前版本（单一真相来源）。"""
    pyproject = Path("backend/pyproject.toml")
    if not pyproject.exists():
        raise FileNotFoundError("backend/pyproject.toml 不存在，请在项目根目录运行")
    content = pyproject.read_text()
    m = re.search(r'^version = "(\d+\.\d+\.\d+)"', content, re.MULTILINE)
    if not m:
        raise ValueError("pyproject.toml 中未找到版本号")
    return m.group(1)


# ─────────────────────────────────────────────
# 文件更新规则
# ─────────────────────────────────────────────

def make_rules(version: str) -> list[dict]:
    """
    定义每个文件的更新规则。
    每条规则包含：
      - file: 文件路径
      - patterns: [(旧正则, 新字符串), ...]  按顺序替换
      - desc: 说明
    """
    today = date.today().isoformat()
    return [
        {
            "file": "README.md",
            "desc": "README badge 版本号",
            "patterns": [
                # version badge: version-0.1.26-blue → version-0.1.28-blue
                (r"version-\d+\.\d+\.\d+-blue", f"version-{version}-blue"),
            ],
        },
        {
            "file": "CLAUDE.md",
            "desc": "CLAUDE.md Current Version",
            "patterns": [
                (r"\*\*Current Version:\*\* v\d+\.\d+\.\d+", f"**Current Version:** v{version}"),
                # 兼容无加粗格式
                (r"Current Version: v\d+\.\d+\.\d+", f"Current Version: v{version}"),
            ],
        },
        {
            "file": "INDEX.md",
            "desc": "INDEX.md 当前版本",
            "patterns": [
                (r"当前版本：v\d+\.\d+\.\d+", f"当前版本：v{version}"),
            ],
        },
        {
            "file": "backend/README.md",
            "desc": "backend README health 返回示例",
            "patterns": [
                # health 响应示例中的版本
                (r'"version": "\d+\.\d+\.\d+"', f'"version": "{version}"'),
            ],
        },
    ]


def ensure_changelog(version: str, check_only: bool, verbose: bool) -> tuple[bool, str]:
    """
    检查 CHANGELOG.md 是否有当前版本的记录。
    如果没有，在 [Unreleased] 下插入模板（仅 --fix 模式）。
    返回 (ok, message)
    """
    changelog = Path("CHANGELOG.md")
    if not changelog.exists():
        return False, "CHANGELOG.md 不存在"

    content = changelog.read_text()

    # 已有当前版本记录
    if f"## [{version}]" in content:
        return True, f"CHANGELOG.md 已包含 [{version}] 记录"

    if check_only:
        return False, f"CHANGELOG.md 缺少 [{version}] 版本记录（需手动补充）"

    # 插入模板到 [Unreleased] 下方
    today = date.today().isoformat()
    template = f"""
## [{version}] - {today}

### 新增

-

### 修复

-

### 变更

-

"""
    if "## [Unreleased]" in content:
        new_content = content.replace(
            "## [Unreleased]\n",
            f"## [Unreleased]\n{template}",
            1,
        )
        changelog.write_text(new_content)
        return True, f"CHANGELOG.md 已插入 [{version}] 模板（请填写具体内容）"
    else:
        return False, "CHANGELOG.md 格式异常：未找到 [Unreleased] 节，请手动添加"


# ─────────────────────────────────────────────
# 核心执行逻辑
# ─────────────────────────────────────────────

def process_file(rule: dict, version: str, check_only: bool, verbose: bool) -> tuple[bool, list[str]]:
    """
    对单个文件执行检查或修复。
    返回 (ok, messages)
    """
    fpath = Path(rule["file"])
    messages = []

    if not fpath.exists():
        return False, [f"文件不存在: {rule['file']}"]

    content = fpath.read_text()
    original = content
    any_match = False

    for pattern, replacement in rule["patterns"]:
        if re.search(pattern, content):
            any_match = True
            if not check_only:
                content = re.sub(pattern, replacement, content)

    if not any_match:
        # 没找到任何模式——可能已是最新，或文件格式变了
        # 检查是否已包含当前版本
        if version in content:
            messages.append(f"✅ {rule['file']}: 已是最新（{rule['desc']}）")
            return True, messages
        else:
            messages.append(f"⚠️  {rule['file']}: 未找到可更新的版本模式（{rule['desc']}）")
            return False, messages

    if content != original:
        fpath.write_text(content)
        messages.append(f"✅ {rule['file']}: 已更新（{rule['desc']}）")
    else:
        messages.append(f"✅ {rule['file']}: 已是最新（{rule['desc']}）")

    return True, messages


def main():
    parser = argparse.ArgumentParser(
        description="同步所有文档中的版本引用",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例：
  python3 scripts/doc-sync/update_version_docs.py          # 检查并自动修复
  python3 scripts/doc-sync/update_version_docs.py --check  # 仅检查，CI 中使用
        """,
    )
    parser.add_argument("--check", action="store_true", help="只检查不修复（返回非零退出码表示有问题）")
    parser.add_argument("--verbose", action="store_true", help="显示详细输出")
    args = parser.parse_args()

    # 切换到项目根目录
    script_dir = Path(__file__).parent
    root = script_dir.parent.parent
    import os
    os.chdir(root)

    try:
        version = get_current_version()
    except (FileNotFoundError, ValueError) as e:
        print(f"❌ 错误：{e}")
        sys.exit(1)

    mode = "检查模式" if args.check else "修复模式"
    print(f"{'=' * 50}")
    print(f"版本文档同步  [{mode}]")
    print(f"当前版本：v{version}  （来源：backend/pyproject.toml）")
    print(f"{'=' * 50}\n")

    all_ok = True
    rules = make_rules(version)

    # 处理各文件
    for rule in rules:
        ok, msgs = process_file(rule, version, args.check, args.verbose)
        if not ok:
            all_ok = False
        for msg in msgs:
            print(f"  {msg}")

    # 处理 CHANGELOG
    print()
    ok, msg = ensure_changelog(version, args.check, args.verbose)
    if not ok:
        all_ok = False
    print(f"  {'✅' if ok else '⚠️ '} {msg}")

    print()
    if all_ok:
        print(f"{'=' * 50}")
        print(f"✅ 所有文档已与 v{version} 同步")
        if not args.check:
            print()
            print("下一步：")
            print(f"  1. 编辑 CHANGELOG.md，在 [{version}] 下填写具体变更内容")
            print(f"  2. git add -A && git commit -m \"docs: sync version to v{version}\"")
        print(f"{'=' * 50}")
        sys.exit(0)
    else:
        print(f"{'=' * 50}")
        if args.check:
            print(f"❌ 发现文档与 v{version} 不同步，请运行：")
            print(f"   python3 scripts/doc-sync/update_version_docs.py")
        else:
            print(f"⚠️  部分文档无法自动修复，请手动检查上方 ⚠️  项")
        print(f"{'=' * 50}")
        sys.exit(1)


if __name__ == "__main__":
    main()
