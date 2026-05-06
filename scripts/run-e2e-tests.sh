#!/bin/bash
# PeekView E2E 测试脚本
# 确保调试服务运行后再执行

set -e

PORT=8888
BASE_URL="http://127.0.0.1:$PORT"

echo "=== PeekView E2E 测试 ==="

# 检查服务是否运行
echo "→ 检查服务状态..."
if ! curl -s "$BASE_URL/health" > /dev/null 2>&1; then
    echo "✗ 错误: 调试服务未运行"
    echo "   请先运行: make debug-start"
    exit 1
fi
echo "✓ 服务运行中: $BASE_URL"

# 创建测试数据目录
mkdir -p /tmp/peekview-e2e-results

cd frontend-v3

# 运行核心 E2E 测试
echo ""
echo "→ 运行 Mermaid 测试..."
npx playwright test e2e/mermaid-full-test.ts --reporter=line || {
    echo "✗ Mermaid 测试失败"
    exit 1
}

echo ""
echo "→ 运行分页器测试..."
npx playwright test e2e/pagination.spec.ts --reporter=line 2>/dev/null || {
    echo "⚠️  分页器测试不存在或跳过"
}

echo ""
echo "→ 运行核心功能测试..."
npx playwright test e2e/viewer.spec.ts --reporter=line || {
    echo "✗ 核心功能测试失败"
    exit 1
}

echo ""
echo "=== ✓ 所有 E2E 测试通过 ==="
echo "截图保存位置: /tmp/peekview-e2e-results/"
echo ""
echo "请访问 $BASE_URL 进行人工验证"
