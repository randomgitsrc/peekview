#!/bin/bash
# E2E 测试前置安全检查
# 此脚本必须在运行 E2E 测试前执行，确保数据隔离

set -e

PROD_DB="/home/kity/.peekview/peekview.db"
DEBUG_DB="/tmp/peekview-debug/peekview.db"

echo "=== E2E 测试前置安全检查 ==="

# Check 1: 必须通过 make debug-test 运行
echo "→ Check 1: 验证运行方式..."
if [ -z "$E2E_GUARD_ENABLED" ]; then
    echo "✗ FATAL: 必须通过 'make debug-test' 运行 E2E 测试"
    echo "   直接运行 'npx playwright test' 被禁止"
    echo ""
    echo "正确用法:"
    echo "  make debug-test"
    echo ""
    exit 1
fi
echo "✓ 运行方式正确"

# Check 2: 调试服务必须运行
if ! curl -s http://127.0.0.1:8888/health > /dev/null 2>&1; then
    echo "✗ FATAL: 调试服务未运行"
    echo "   请先运行: make debug-start"
    exit 1
fi
echo "✓ 调试服务运行中"

# Check 3: 调试服务必须使用独立数据库
PID=$(lsof -t -i :8888 2>/dev/null || echo "")
if [ -n "$PID" ]; then
    # Check if using debug database
    if lsof -p $PID 2>/dev/null | grep -q "$DEBUG_DB"; then
        echo "✓ 调试服务使用独立数据库"
    else
        echo "✗ FATAL: 调试服务未使用独立数据库!"
        echo "   期望: $DEBUG_DB"
        echo "   实际: $(lsof -p $PID 2>/dev/null | grep 'peekview.db' | head -1)"
        exit 1
    fi
fi

# Check 4: 生产数据库备份
PROD_COUNT=$(python3 -c "
import sqlite3
try:
    conn = sqlite3.connect('$PROD_DB')
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM entries')
    print(cursor.fetchone()[0])
    conn.close()
except:
    print('0')
" 2>/dev/null)
echo "ℹ  生产数据库条目数: $PROD_COUNT"

# Check 5: 检查是否有 e2e- 前缀的数据
E2E_COUNT=$(python3 -c "
import sqlite3
try:
    conn = sqlite3.connect('$PROD_DB')
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM entries WHERE slug LIKE \"e2e-%\"')
    print(cursor.fetchone()[0])
    conn.close()
except:
    print('0')
" 2>/dev/null)

if [ "$E2E_COUNT" -gt 0 ]; then
    echo "⚠  WARNING: 生产数据库已有 $E2E_COUNT 条测试数据!"
    echo "   上次测试可能污染了生产环境"
fi

echo ""
echo "=== ✓ 安全检查通过，可以运行 E2E 测试 ==="
echo ""

# 非交互模式自动继续（由 Makefile 调用时）
if [ -n "$CI" ] || [ -n "$NONINTERACTIVE" ]; then
    echo "→ 非交互模式，自动继续..."
    exit 0
fi

# 最终确认
read -p "确认要继续运行 E2E 测试? [y/N] " confirm
if [ "$confirm" != "y" ]; then
    echo "已取消"
    exit 1
fi
echo ""
echo "→ 启动 E2E 测试..."
echo ""
