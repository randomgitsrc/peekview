#!/bin/bash
# P3 TDD 测试：scripts/e2e-safety-check.sh --test-mtime 自检模式（Check 6 static 新鲜度）
#
# 用法:
#   bash docs/tasks/TPV0088-e2e-test-infra-hardening/P3-test-code/test-mtime.sh
#
# 设计依据:
#   - P2-design.md §2.2.1 check_static_freshness + --test-mtime 自检块（置于 Check 1 之前，绕过 E2E_GUARD 等既有检查）
#   - BDD-6（过期拦截）/ BDD-7（新鲜放行）/ BDD-8（自检模式不误伤、不触碰既有检查与生产 DB）
#
# 当前红灯: e2e-safety-check.sh 尚未实现 Check 6 / --test-mtime
#   → 三个 fixture 场景全部命中 Check 1 guard（EXIT=1 且输出含 "Check 1"），期望行为全部不满足
#   → 本 harness 判定 "被测模块未实现"（B 类红灯，目标缺失），exit 1

set -u

PASS=0
FAIL=0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
TARGET_SCRIPT="$REPO_ROOT/scripts/e2e-safety-check.sh"

if [ ! -f "$TARGET_SCRIPT" ]; then
    echo "✗ FATAL: 被测脚本不存在: $TARGET_SCRIPT"
    exit 1
fi

note() { printf '%s\n' "$*"; }
ok() { note "  ✓ $*"; }
fail() { note "  ✗ $*"; FAIL=$((FAIL + 1)); }

make_fixture() {
    # $1 = 目录  $2 = 场景: fresh|stale|missing
    local dir="$1" state="$2"
    mkdir -p "$dir/src/sub" "$dir/static"
    printf 'x' > "$dir/static/index.html"
    printf 'x' > "$dir/src/a.ts"
    printf 'x' > "$dir/src/sub/b.ts"
    case "$state" in
        fresh)
            # static 比 src 新 → 应放行（exit 0）
            touch -d "2026-01-01 00:00:00" "$dir/src/a.ts" "$dir/src/sub/b.ts"
            touch -d "2026-01-02 00:00:00" "$dir/static/index.html"
            ;;
        stale)
            # src 比 static 新 → 应拦截（exit 1）
            touch -d "2026-01-01 00:00:00" "$dir/static/index.html"
            touch -d "2026-01-02 00:00:00" "$dir/src/a.ts" "$dir/src/sub/b.ts"
            ;;
        missing)
            # static/index.html 缺失 → 应拦截（exit 1）
            rm -f "$dir/static/index.html"
            touch -d "2026-01-02 00:00:00" "$dir/src/a.ts"
            ;;
        *) note "未知场景: $state"; exit 2 ;;
    esac
}

run_target() {
    # $1 = fixture 目录；stdout+stderr 混流输出到变量，退出码写 $RUN_EXIT
    local dir="$1" out
    out=$(PV_SRC_DIR="$dir/src" PV_STATIC_INDEX="$dir/static/index.html" \
        bash "$TARGET_SCRIPT" --test-mtime 2>&1)
    RUN_EXIT=$?
    RUN_OUT="$out"
}

# TC-B5: --test-mtime 模式必须命中自检块（绕过 Check 1 guard，不要求 E2E_GUARD_ENABLED）
check_target_implemented() {
    if printf '%s' "$RUN_OUT" | grep -q "Check 1"; then
        note "      [诊断] TC-B5: --test-mtime 未实现（脚本落入 Check 1 guard）→ B 类红灯（目标缺失，非测试 bug）"
        return 1
    fi
    return 0
}

echo "=== TDD 红灯确认: e2e-safety-check.sh --test-mtime ==="
echo ""

# ==============================
# TC-B1 (BDD-7): 新鲜 static → exit 0
# ==============================
FIX=$(mktemp -d)
make_fixture "$FIX" fresh
run_target "$FIX"
note "TC-B1 (BDD-7) 新鲜 static (src 旧, static 新):"
note "  实际 EXIT=$RUN_EXIT"
if [ "$RUN_EXIT" -eq 0 ] && printf '%s' "$RUN_OUT" | grep -q "静态产物新鲜"; then
    ok "TC-B1 通过 (exit 0 + 新鲜提示)"
    PASS=$((PASS + 1))
else
    fail "TC-B1 红灯 (期望 EXIT=0 且输出含 '静态产物新鲜')"
    printf '%s\n' "$RUN_OUT" | sed 's/^/      | /' | head -8
    check_target_implemented
fi
rm -rf "$FIX"
echo ""

# ==============================
# TC-B2 (BDD-6): 过期 static → exit 1 + 提示 make build-frontend
# ==============================
FIX=$(mktemp -d)
make_fixture "$FIX" stale
run_target "$FIX"
note "TC-B2 (BDD-6) 过期 static (src 新, static 旧):"
note "  实际 EXIT=$RUN_EXIT"
if [ "$RUN_EXIT" -eq 1 ] && printf '%s' "$RUN_OUT" | grep -q "make build-frontend" && printf '%s' "$RUN_OUT" | grep -q "FATAL"; then
    ok "TC-B2 通过 (exit 1 + FATAL + make build-frontend 提示)"
    PASS=$((PASS + 1))
else
    fail "TC-B2 红灯 (期望 EXIT=1 且输出含 FATAL + 'make build-frontend')"
    printf '%s\n' "$RUN_OUT" | sed 's/^/      | /' | head -8
    check_target_implemented
fi
rm -rf "$FIX"
echo ""

# ==============================
# TC-B3 (BDD-6 边界): static/index.html 缺失 → exit 1 + 提示 make build-frontend
#   P2 §6 minimal_validation Case 3: 不判 [ -f ] 时 find -newer 对不存在文件静默无输出会误放行
# ==============================
FIX=$(mktemp -d)
make_fixture "$FIX" missing
run_target "$FIX"
note "TC-B3 (BDD-6 边界) static 缺失:"
note "  实际 EXIT=$RUN_EXIT"
if [ "$RUN_EXIT" -eq 1 ] && printf '%s' "$RUN_OUT" | grep -q "make build-frontend" && printf '%s' "$RUN_OUT" | grep -q "不存在"; then
    ok "TC-B3 通过 (exit 1 + 不存在 + make build-frontend 提示)"
    PASS=$((PASS + 1))
else
    fail "TC-B3 红灯 (期望 EXIT=1 且输出含 '不存在' + 'make build-frontend')"
    printf '%s\n' "$RUN_OUT" | sed 's/^/      | /' | head -8
    check_target_implemented
fi
rm -rf "$FIX"
echo ""

# ==============================
# TC-B4 (BDD-6 强化): 过期时输出列出过期文件（前 5 个）
# ==============================
FIX=$(mktemp -d)
make_fixture "$FIX" stale
run_target "$FIX"
note "TC-B4 (BDD-6) 过期拦截输出列出过期文件:"
if [ "$RUN_EXIT" -eq 1 ] && printf '%s' "$RUN_OUT" | grep -q "过期文件"; then
    ok "TC-B4 通过 (输出含 '过期文件' 清单)"
    PASS=$((PASS + 1))
else
    fail "TC-B4 红灯 (期望 EXIT=1 且输出含 '过期文件' 清单)"
    check_target_implemented
fi
rm -rf "$FIX"
echo ""

# ==============================
# TC-B6 (BDD-7): PV_SRC_DIR / PV_STATIC_INDEX env 注入路径生效（Makefile Step 1 传 $(CURDIR) 绝对路径）
#   fresh fixture 下 env 路径被用于比对 → exit 0 即证明 env 覆盖生效
# ==============================
FIX=$(mktemp -d)
make_fixture "$FIX" fresh
run_target "$FIX"
note "TC-B6 (BDD-7) env 路径注入:"
if [ "$RUN_EXIT" -eq 0 ] && printf '%s' "$RUN_OUT" | grep -q "静态产物新鲜"; then
    ok "TC-B6 通过 (env 路径生效, exit 0)"
    PASS=$((PASS + 1))
else
    fail "TC-B6 红灯 (期望 env 注入路径下 fresh 场景 exit 0)"
    check_target_implemented
fi
rm -rf "$FIX"
echo ""

# ==============================
# TC-B7 (IMPL-C1 回归守卫, 当前绿): 无 --test-mtime 参数时既有行为不变
#   Check 1 guard 在未设 E2E_GUARD_ENABLED 时仍 exit 1 且输出含 "Check 1"
# ==============================
OUT=$(bash "$TARGET_SCRIPT" 2>&1)
REG_EXIT=$?
note "TC-B7 (IMPL-C1 回归) 无参数运行仍走既有检查:"
if [ "$REG_EXIT" -eq 1 ] && printf '%s' "$OUT" | grep -q "Check 1"; then
    ok "TC-B7 通过 (无参数: Check 1 guard 仍生效, exit 1)"
    PASS=$((PASS + 1))
else
    fail "TC-B7 红灯 (期望无参数运行仍 exit 1 且输出含 'Check 1')"
fi
echo ""

echo "=== 结果: PASS=$PASS FAIL=$FAIL ==="
if [ "$FAIL" -gt 0 ]; then
    echo "=== 红灯确认完成: 被测模块（Check 6 / --test-mtime）未实现，期望行为全部未满足 ==="
    exit 1
fi
echo "=== 全绿: Check 6 已实现，自检模式行为符合 P2 设计 ==="
exit 0
