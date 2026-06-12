#!/bin/bash
# Git pre-commit hook — 版本同步检查 + 文档提示
#
# 安装方法：
#   make setup-hooks
# 或手动：
#   ln -sf ../../scripts/git-hooks/pre-commit.sh .git/hooks/pre-commit
#   chmod +x .git/hooks/pre-commit
#
# 功能：
#   1. 版本一致性检查（基于 VERSIONS.json，不通过则阻断提交）
#   2. 文档更新 checklist（提示性，不阻断）
#   3. 旧格式环境变量检查（提示性，不阻断）

set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   Pre-commit: 版本同步检查           ║"
echo "╚══════════════════════════════════════╝"
echo ""

STAGED_FILES=$(git diff --cached --name-only 2>/dev/null || true)

if [ -z "$STAGED_FILES" ]; then
    echo "✅ 无暂存文件，跳过检查"
    exit 0
fi

# ── 1. 版本一致性检查（强制）──────────────────────
if [ -f "VERSIONS.json" ] && [ -f "scripts/sync_versions.py" ]; then
    echo "→ 版本一致性检查（来源: VERSIONS.json）..."
    echo ""

    if python3 scripts/sync_versions.py --check; then
        echo ""
        echo "  ✅ 版本一致性检查通过"
    else
        echo ""
        echo "┌──────────────────────────────────────────────────┐"
        echo "│  ❌ 提交被阻止：版本号不一致                      │"
        echo "│                                                   │"
        echo "│  VERSIONS.json 与源文件/文档不同步。              │"
        echo "│                                                   │"
        echo "│  修复方法：                                       │"
        echo "│    make sync-version-docs                        │"
        echo "│  然后重新 git add 更新的文件后再提交              │"
        echo "└──────────────────────────────────────────────────┘"
        echo ""
        exit 1
    fi
else
    echo "→ VERSIONS.json 或 sync_versions.py 不存在，跳过版本检查"
    echo "  （运行 make bump-version 一次即可建立）"
fi

# ── 2. 文档 Checklist 提示（不阻断）─────────────────
echo ""
echo "→ 文档更新 checklist..."
echo ""

if command -v python3 &>/dev/null && [ -f "scripts/doc-sync/doc_checklist.py" ]; then
    python3 scripts/doc-sync/doc_checklist.py --staged 2>/dev/null || true
else
    echo "  ⚠️  Python3 不可用，跳过 checklist"
fi

# ── 3. 旧格式环境变量检查（不阻断）─────────────────
if [ -f "scripts/check_doc_consistency.sh" ]; then
    ENV_ISSUES=$(bash scripts/check_doc_consistency.sh 2>&1 | grep "✗" || true)
    if [ -n "$ENV_ISSUES" ]; then
        echo ""
        echo "⚠️  发现旧格式环境变量（不阻断，建议修复）："
        echo "$ENV_ISSUES"
    fi
fi

echo ""
echo "✅ Pre-commit 检查完成"
echo ""
exit 0
