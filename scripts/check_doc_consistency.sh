#!/bin/bash
# 检查文档与代码配置的一致性

set -e

echo "=== 文档一致性检查 ==="
echo ""

# 检查环境变量命名规范
echo "→ 检查环境变量命名规范..."

cd "$(dirname "$0")/.."

# 检查代码中是否存在旧格式（单下划线）
OLD_PATTERNS_FOUND=0

# 检查 cli.py 中的 service install 配置
if grep -n "PEEKVIEW_HOST=" backend/peekview/cli.py | grep -v "SERVER__HOST" | grep -v "^#" > /dev/null 2>&1; then
    echo "  ✗ backend/peekview/cli.py: 发现旧格式 PEEKVIEW_HOST，应改为 PEEKVIEW_SERVER__HOST"
    OLD_PATTERNS_FOUND=1
fi

if grep -n "PEEKVIEW_PORT=" backend/peekview/cli.py | grep -v "SERVER__PORT" | grep -v "^#" > /dev/null 2>&1; then
    echo "  ✗ backend/peekview/cli.py: 发现旧格式 PEEKVIEW_PORT，应改为 PEEKVIEW_SERVER__PORT"
    OLD_PATTERNS_FOUND=1
fi

if grep -n "PEEKVIEW_DATA_DIR=" backend/peekview/cli.py | grep -v "STORAGE__DATA_DIR" | grep -v "^#" > /dev/null 2>&1; then
    echo "  ✗ backend/peekview/cli.py: 发现旧格式 PEEKVIEW_DATA_DIR，应改为 PEEKVIEW_STORAGE__DATA_DIR"
    OLD_PATTERNS_FOUND=1
fi

# 检查文档中的环境变量表
DOC_FILES="README.md CLAUDE.md backend/README.md docs/DEPLOYMENT.md docs/DEBUGGING.md docs/process/debug-lessons.md docs/process/debug-workflow.md"

for file in $DOC_FILES; do
    if [ -f "$file" ]; then
        # 查找旧格式环境变量（不在示例代码块中说明旧格式的）
        if grep -E "^\| \`PEEKVIEW_(DATA_DIR|DB_PATH|HOST|PORT|API_KEY|CORS_ORIGINS|ALLOWED_PATHS)\`" "$file" | grep -v "STORAGE__\|SERVER__\|CLEANUP__\|LIMITS__" > /dev/null 2>&1; then
            echo "  ✗ $file: 表格中发现旧格式环境变量，应使用 __ 分隔符"
            OLD_PATTERNS_FOUND=1
        fi
    fi
done

if [ $OLD_PATTERNS_FOUND -eq 0 ]; then
    echo "  ✓ 所有环境变量使用正确的命名格式"
fi

echo ""
echo "→ 检查 systemd 服务配置..."

if [ -f "docs/DEPLOYMENT.md" ]; then
    if grep "Environment=PEEKVIEW_HOST" docs/DEPLOYMENT.md | grep -v "SERVER__HOST" > /dev/null 2>&1; then
        echo "  ✗ docs/DEPLOYMENT.md: systemd 配置使用旧格式"
        OLD_PATTERNS_FOUND=1
    else
        echo "  ✓ systemd 配置使用正确的命名格式"
    fi
fi

echo ""
echo "=== 检查完成 ==="

if [ $OLD_PATTERNS_FOUND -eq 1 ]; then
    echo ""
    echo "发现旧格式环境变量！请更新以下文档:"
    echo "  - 环境变量格式: PEEKVIEW_DATA_DIR → PEEKVIEW_STORAGE__DATA_DIR"
    echo "  - 参考文档: docs/process/doc-sync-guide.md"
    exit 1
else
    echo "✓ 所有文档与代码保持一致"
    exit 0
fi
