---
phase: P4
task_id: TPV0088-e2e-test-infra-hardening
type: implementation
parent: P2-design.md
trace_id: TPV0088-P4-b-20260812
status: draft
created: 2026-08-12
agent: implementer
---

# P4 Implementation B — Check 6 static 新鲜度校验 + --test-mtime 自检 + Makefile env 传递

`implementation_dir: scripts/ + Makefile`

## 改动清单

### 1. `scripts/e2e-safety-check.sh`

- **函数定义**（脚本顶部，Check 1 之前，line 11-29）：`check_static_freshness`
  - 路径经 `PV_SRC_DIR`（默认 `frontend-v3/src`）/ `PV_STATIC_INDEX`（默认 `backend/peekview/static/index.html`）env 注入
  - `[ ! -f "$static_index" ]` 先判缺失 → FATAL + 提示 `make build-frontend`（P2 §6 Case 3：find -newer 对不存在文件静默无输出会误放行）
  - `find "$src_dir" -type f -newer "$static_index"`（`-type f` 防目录 mtime 假阳性，P2 §6 ②）→ 有输出即过期，列前 5 个过期文件 + 提示 build-frontend
  - 新鲜 → `✓ 静态产物新鲜`
- **`--test-mtime` 自检块**（line 31-35，紧跟函数定义之后、Check 1 之前）：`if [ "${1:-}" = "--test-mtime" ]; then check_static_freshness; exit $?; fi`——绕过 E2E_GUARD 等既有检查，供 P3 gate 独立测试
- **Check 6 调用**（line 123-125）：置于既有 Check 5 之后、`=== ✓ 安全检查通过 ===` 之前——`check_static_freshness || exit 1`
- 既有 Check 1-5 逻辑未改动（IMPL-C1）

### 2. `Makefile`（debug-test Step 1）

line 636-639：向 `e2e-safety-check.sh` 追加绝对路径 env：

```make
@E2E_GUARD_ENABLED=1 NONINTERACTIVE=1 \
  PV_SRC_DIR=$(CURDIR)/frontend-v3/src \
  PV_STATIC_INDEX=$(CURDIR)/backend/peekview/static/index.html \
  bash scripts/e2e-safety-check.sh || exit 1
```

使 Check 6 始终比对仓库根目录真实路径，不受 `make` 调用目录影响。

## 自查结果

```
bash scripts/e2e-safety-check.sh --test-mtime
✓ 静态产物新鲜 (src 未比 static/index.html 新)
EXIT=0

bash docs/tasks/TPV0088-e2e-test-infra-hardening/P3-test-code/test-mtime.sh
=== 结果: PASS=6 FAIL=0 ===（TC-B1/B2/B3/B4/B6/B7 全绿，含回归守卫）
HARNESS_EXIT=0

bash -n scripts/e2e-safety-check.sh → syntax OK
make -n debug-test → Step 1 渲染 $(CURDIR) 绝对路径
```

[PROD_NOT_TOUCHED] 本任务仅改 shell 脚本 + Makefile，未启动任何服务，未触碰生产 :8080 / ~/.peekview/；自查用 --test-mtime 自检模式，未读写任何数据库。

## 状态标记

[PROD_NOT_TOUCHED]

## 与 P2 设计一致性

- 严格遵循 P2-design.md §2.2.1 的 check_static_freshness 函数体（含 `-type f` + `[ -f ]` 防护）、§2.2.2 的 Makefile env 传递格式
- gate_commands.P3（`bash scripts/e2e-safety-check.sh --test-mtime`）已满足：真实仓库当前状态 fresh → exit 0
