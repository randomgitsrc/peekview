#!/bin/bash
# PeekView E2E 测试脚本
# 确保调试服务运行后再执行
#
# SAFETY: This script has multiple guards against production access
# IMPORTANT: Must be run via 'make debug-test' which sets E2E_GUARD_ENABLED

set -e

# Safety Check 0: Verify running through make debug-test
if [ -z "$E2E_GUARD_ENABLED" ]; then
    echo "✗ FATAL ERROR: 必须通过 'make debug-test' 运行 E2E 测试"
    echo "   直接运行此脚本被禁止，以确保数据隔离安全"
    echo ""
    echo "正确用法:"
    echo "  make debug-test"
    echo ""
    exit 1
fi

PORT=8888
BASE_URL="http://127.0.0.1:$PORT"
PRODUCTION_PORT=8080

echo "=== PeekView E2E 测试 ==="
echo "✓ 安全守卫已启用 (E2E_GUARD_ENABLED)"

# Safety Check 1: Verify we're not accidentally targeting production
echo "→ Safety Check: Verifying target is not production..."
if [ "$BASE_URL" = "http://127.0.0.1:$PRODUCTION_PORT" ] || echo "$BASE_URL" | grep -q ":$PRODUCTION_PORT"; then
    echo "✗ FATAL ERROR: BASE_URL points to production ($BASE_URL)"
    echo "   E2E tests MUST NOT run against production"
    exit 1
fi

# Safety Check 2: Verify debug service is running
echo "→ 检查服务状态..."
if ! curl -s "$BASE_URL/health" > /dev/null 2>&1; then
    echo "✗ 错误: 调试服务未运行"
    echo "   请先运行: make debug-start"
    echo "   服务应运行在: $BASE_URL"
    exit 1
fi
echo "✓ 服务运行中: $BASE_URL"

# Safety Check 3: Verify it's actually the debug server (check DB path)
PID=$(lsof -t -i :$PORT 2>/dev/null || echo "")
if [ -n "$PID" ]; then
    DB_PATH=$(lsof -p $PID 2>/dev/null | grep "peekview.db" | head -1 | awk '{print $NF}')
    if [ -n "$DB_PATH" ]; then
        if echo "$DB_PATH" | grep -q "\.peekview"; then
            echo "✗ FATAL ERROR: Service on port $PORT is using production database!"
            echo "   DB_PATH: $DB_PATH"
            echo "   Expected: /tmp/peekview-debug/peekview.db"
            exit 1
        fi
        if echo "$DB_PATH" | grep -q "/tmp/peekview-debug"; then
            echo "✓ Service using debug database: $DB_PATH"
        fi
    fi
fi

# Safety Check 4: Get production entry count before test
PROD_COUNT=$(curl -s "http://127.0.0.1:$PRODUCTION_PORT/api/v1/entries" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('items',[])))" 2>/dev/null || echo "unknown")
if [ "$PROD_COUNT" != "unknown" ]; then
    echo "ℹ  Production entry count (before test): $PROD_COUNT"
fi

# 创建测试数据目录
mkdir -p /tmp/e2e-results

cd frontend-v3

# 设置 Playwright baseURL
export BASE_URL=$BASE_URL

echo ""
spec="${E2E_SPEC:-e2e/debug-server.spec.ts}"
echo "→ 运行 E2E 测试 ($spec)..."
npx playwright test "$spec" --reporter=line || {
    echo ""
    echo "✗ E2E 测试失败"
    echo "   查看截图: /tmp/e2e-results/"
    echo "   查看报告: npx playwright show-report"
    exit 1
}

echo ""
echo "=== ✓ 所有 E2E 测试通过 ==="
echo "截图保存位置: /tmp/e2e-results/"
echo ""
echo "请访问 $BASE_URL 进行人工验证"
echo "确认无误后运行: make debug-stop"
echo ""

# Safety Check 5: Verify production wasn't polluted
if [ "$PROD_COUNT" != "unknown" ]; then
    NEW_PROD_COUNT=$(curl -s "http://127.0.0.1:$PRODUCTION_PORT/api/v1/entries" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('items',[])))" 2>/dev/null || echo "unknown")
    if [ "$NEW_PROD_COUNT" != "unknown" ] && [ "$NEW_PROD_COUNT" -gt "$PROD_COUNT" ]; then
        echo "⚠️  WARNING: Production database gained $(($NEW_PROD_COUNT - $PROD_COUNT)) entries during test!"
        echo "   Before: $PROD_COUNT, After: $NEW_PROD_COUNT"
        echo "   Check for test data pollution"
    else
        echo "✓ Production database unchanged"
    fi
fi

# 显示测试结果摘要
echo "测试截图:"
ls -la /tmp/e2e-results/*.png 2>/dev/null | awk '{print "  - " $9}' || echo "  无截图"
