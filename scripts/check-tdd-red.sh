#!/bin/bash
# 检查 TDD 红灯：只允许 assertion failure，拒绝 collection/import error
# 退出 0 = 正确的红灯（assertion failure > 0, collection error == 0）
# 退出 1 = 错误（有 collection/import error，测试代码有 bug）
# 退出 2 = 测试全绿（实现可能先于测试写完，违反 TDD）
#
# 用法：scripts/check-tdd-red.sh [pytest-args...]
# 示例：scripts/check-tdd-red.sh backend/tests/

set -euo pipefail

# 禁用 pytest ANSI 颜色码，避免干扰 grep 匹配
export FORCE_COLOR=0
export NO_COLOR=1
export PY_COLORS=0

# 运行 pytest，捕获输出和退出码
RESULT=$(pytest -q "$@" 2>&1) || true
EXIT=$?

# 哨兵：pytest 崩溃无输出（segfault/OOM）
if [ -z "$RESULT" ]; then
    echo "TDD_CHECK: pytest produced no output (possible crash) — cannot determine test state"
    exit 1
fi

# 提取失败和错误数量（兼容 pytest 6/7/8 输出格式）
# 使用 -oE 替代 -oP 以兼容 macOS BSD grep
FAILED=$(echo "$RESULT" | grep -oE '[0-9]+ failed' | grep -oE '[0-9]+' || echo "0")
ERRORS=$(echo "$RESULT" | grep -oE '[0-9]+ error' | grep -oE '[0-9]+' || echo "0")

echo "assertion_failures=${FAILED}, collection_errors=${ERRORS}"

# 情况 1：测试全绿（exit 0，没有失败也没有错误）
if [ "$EXIT" -eq 0 ] && [ "${FAILED}" = "0" ] && [ "${ERRORS}" = "0" ]; then
    echo "TDD_CHECK: all tests pass — implementation may be ahead of tests"
    exit 2
fi

# 情况 2：有 collection/import error
if [ "${ERRORS}" -gt 0 ]; then
    echo "TDD_CHECK: collection/import errors (${ERRORS}) — test code has bugs, fix before proceeding"
    exit 1
fi

# 情况 3：有 assertion failure 但没有 collection error（正确的红灯）
if [ "${FAILED}" -gt 0 ]; then
    echo "TDD_CHECK: correct red light — ${FAILED} assertion failures, 0 collection errors"
    exit 0
fi

# 兜底（不应到达）
echo "TDD_CHECK: unexpected state"
exit 1
