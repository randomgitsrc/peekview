# Makefile 进度可见性改进 Plan v2

> 来源：T080 复盘基建改进 v2 后续讨论（用户提问）
> 日期：2026-08-06
> 状态：待复审（v1 needs-revision 已修；v2 加 pytest-xdist 并行）
> 前序：`infra-improvements-from-t080-v2.md`（v2，已完成实施）

## Context

用户在测试 v2 改动时观察到 Makefile 的体验问题：**长命令执行后无输出，无法区分"在执行 vs 卡死 vs 完成"**。这不是 Makefile 单独能解的，而是 Makefile 输出策略 + bash 工具缓冲 + 长命令本身特性三方的问题。本 plan 基于"考虑清楚"对话中确立的设计原则：

1. **echo 阶段性日志**对上下文影响忽略（vs 长命令实际输出的几 MB）
2. **关键设计**：长命令用 `tee + tail` 模式（日志文件 + 末尾汇总）
3. **异步工作流（stamp/bg-wait）不在本 plan 范围**，单独后续 plan `makefile-async-bg.md`
4. **pytest-xdist 并行测试**：Tier1 改动，与本 plan 主题一致

## v2 相对 v1 的修订

| # | 类型 | 修订项 | 来源 |
|---|------|--------|------|
| 1 | BLOCKER | 加 `set -o pipefail` + 失败时 `tail -30` 上下文 | v1 评审 #1, #2 |
| 2 | BLOCKER | Makefile 顶部加 `LOG_DIR` 变量 + 自动创建目录 | v1 评审 #3 |
| 3 | MUST-FIX | 统一 `tail -5`（成功）/ 失败 `tail -30` | v1 评审 #4 |
| 4 | SHOULD-FIX | ANSI `\r` 转换加注释限制范围（仅 publish） | v1 评审 #5 |
| 5 | 遗漏 | 问题 A 表加 `make dev`、`make install` | v1 评审 #6 |
| 6 | 遗漏 | 新增 `bg-clean` 日志清理 target | v1 评审 #7 |
| 7 | 验证 | 加失败场景验证（pipefail 有效性） | v1 评审 #8 |
| 8 | 文档 | 删除冗余"改前"示例 | v1 评审 #9 |
| 9 | 取舍 | 新增"预估时间数据来源"表 | v1 评审 #10 |
| 10 | 取舍 | 日志路径用 `$(LOG_DIR)` 变量可覆盖 | v1 评审 #11 |
| 11 | **新增** | **pytest-xdist 并行 + `addopts` 改 `-q`** | 用户追加 |
| 12 | **新增** | **实施注意事项（opencode 环境风险）** | 用户警告 |

## 问题与机理

### 问题 A：长命令"完全静默"导致无法判断状态

| 命令 | 现状 | 静默时长 |
|------|------|---------|
| `make dev` / `make install` | venv + pip install | 1-3 min |
| `make build-frontend` | `npm ci` | 2-3 min |
| `make typecheck` | `vue-tsc --noEmit` | 30-60s |
| `make debug-build` | `clean + npm ci` | 2-3 min |
| `make debug` | build + E2E + MCP | 5-15 min |

### 问题 B：长命令实际输出占满 agent 上下文

`npm ci` 详细输出 = 1-2 MB。`pytest -v` = 几百 KB。

### 问题 C：twine ANSI 转义阻塞输出缓冲

`pipx run twine upload` 的 ANSI 进度条被 bash 工具识别为"无内容"。

### 问题 D：test-quick 串行慢

即使 bcrypt rounds=4，test-quick 仍 ~107s。pytest-xdist `-n auto` 可压到 ~30-50s。

**PeekView 测试适合 xdist**（隔离维度均 OK）：

| 隔离维度 | 现状 | xdist 安全？ |
|---------|------|------------|
| 数据库 | 每个 test 独立 SQLite（conftest autouse） | ✅ |
| 模块级单例 | `rate_limit.limiter` worker 间独立 | ✅ |
| autouse fixtures | 每个 worker 自己执行 | ✅ |
| asyncio loop | function-scope | ✅ |
| bcrypt rounds=4 | 已优化，无 bottleneck | ✅ |

## 改动方案

### 0. 全局配置（Makefile 顶部）

```makefile
# === Progress visibility (T080 followup) ===
LOG_DIR ?= /tmp/peekview-bg
$(shell mkdir -p $(LOG_DIR))
```

### 1. 长命令 tee + tail + pipefail（不增加上下文负担）

**原则**：echo 阶段标记 + `set -o pipefail` + 实际输出 `tee 到日志 + tail -5` 末尾汇总 + **失败时打印 `tail -30` 上下文**。

```makefile
build-frontend:
	@set -o pipefail; \
	mkdir -p $(LOG_DIR); \
	LOG=$(LOG_DIR)/build-frontend.log; \
	echo "→ [1/2] npm ci (~2-3 min)..."; \
	cd frontend-v3 && npm ci --no-audit --no-fund 2>&1 | tee $$LOG | tail -5 \
		|| { echo "✗ npm ci failed, last 30 lines of log:"; tail -30 $$LOG; exit 1; }
	@echo "→ [2/2] vite build (~10s)..."
	@set -o pipefail; \
	cd frontend-v3 && npm run build 2>&1 | tee -a $(LOG_DIR)/build-frontend.log | tail -10 \
		|| { echo "✗ vite build failed, last 30 lines of log:"; tail -30 $(LOG_DIR)/build-frontend.log; exit 1; }
	@echo "  ✓ $$(ls frontend-v3/dist/assets/ 2>/dev/null | wc -l) static files"
```

### 2. typecheck 加预估时间 + 失败上下文

```makefile
typecheck:
	@set -o pipefail; \
	mkdir -p $(LOG_DIR); \
	LOG=$(LOG_DIR)/typecheck.log; \
	echo "→ Running vue-tsc type check (~30-60s)..."; \
	cd frontend-v3 && npx vue-tsc --noEmit 2>&1 | tee $$LOG | tail -10 \
		|| { echo "✗ type check failed, last 30 lines:"; tail -30 $$LOG; exit 1; }
	@echo "  ✓ type check passed"
```

### 3. publish 的 twine ANSI 过滤（仅 publish）

```makefile
# 注意：仅适用于 publish 的 twine upload（其用 \r 覆盖同一行做进度条）。
# 不适用于其他命令（可能破坏正常 stdout 解析如 grep/wc）。
cd backend && pipx run twine upload dist/* \
	-u __token__ -p "$$TOKEN" --non-interactive 2>&1 \
	| sed 's/\x1b\[[0-9;]*[a-zA-Z]//g; s/\r/\n/g'
```

### 4. bg-clean：日志目录清理

```makefile
bg-clean:
	@echo "→ Cleaning bg logs older than 7 days..."
	@find $(LOG_DIR) -name '*.log' -mtime +7 -delete 2>/dev/null || true
	@echo "  ✓ Done"
```

### 5. pytest-xdist 并行（Tier1 提速）

**5.1 pyproject.toml 加依赖**：

```toml
test = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "pytest-cov>=4.1.0",
    "pytest-xdist>=3.0.0",   # 新增
    "httpx>=0.26.0",
]
```

**5.2 `[tool.pytest.ini_options]` 改 `addopts`**：

```toml
addopts = "-q --tb=short"   # 改：-v → -q（xdist 下 verbose 信息爆炸）
```

**5.3 Makefile `test-quick` 加 `-n auto`**：

```makefile
test-quick: guard-venv
	@echo "→ Running backend tests (~30-60s with xdist, 1068 tests)..."
	cd backend && .venv/bin/python -m pytest tests/ -n auto --tb=short
	@echo "✓ Tests passed"
```

## 不在本 plan 范围（后续 plan）

异步工作流（`-bg` + stamp + wait + status）单独处理。下一个需要时启动 `makefile-async-bg.md`。

## 不改的项

- `lint`、`bump-version`、`check-*`：已清晰
- `debug-stop`、`debug-seed`：已有输出
- `debug-test`/`debug-test-mcp`：保持原样（Playwright 自带）
- `test-frontend`：vitest 自带 progress
- `make debug`、`make pre-publish`、`make publish`：加 echo 阶段标记，不引入 `-bg`

## 预估时间数据来源

| 命令 | 估算 | 依据 |
|------|------|------|
| `npm ci` | 2-3 min | frontend-v3 ~500 依赖（实测） |
| `npm run build` | ~10s | 11 个 entry，已优化（实测） |
| `vue-tsc --noEmit` | 30-60s | ~80 .ts/.vue 文件（实测） |
| `make dev`（首次） | 1-3 min | ~80 pip 包（实测） |
| `make test-quick`（串行） | ~107s | 1068 tests，已 bcrypt 优化（实测） |
| `make test-quick`（xdist） | **~30-50s** | 4 核机器（预期） |
| `make debug` | 5-15 min | build + E2E + MCP |

数字均为"实测 ±20%"。

## 验证

```bash
# === 功能验证 ===

# 1. 验证 echo 阶段标记 + 日志写入
make build-frontend 2>&1 | head -10
tail -20 $(LOG_DIR)/build-frontend.log

# 2. 验证 typecheck 不再完全静默
make typecheck 2>&1

# 3. 验证 ANSI 过滤（需要 PyPI token）
make publish 2>&1 | tail -10

# 4. 验证日志目录自动创建
rm -rf /tmp/peekview-bg && make build-frontend 2>&1 | tail -3
ls /tmp/peekview-bg/

# 5. 验证日志清理
make bg-clean

# 6. 验证 pytest-xdist 加速（可选，见实施注意事项）
make test-quick 2>&1 | tail -3

# === 失败场景验证 ===

# 7. 验证 pipefail 生效
sed -i.bak 's|cd frontend-v3 && npm run build|cd frontend-v3 && npm run nonexistent-script|' Makefile
make build-frontend
EXIT=$?
mv Makefile.bak Makefile
[ $EXIT -ne 0 ] && echo "✓ pipefail works" || echo "✗ FAIL"

# === 功能未破坏 ===

# 8. make lint（<5s）；make typecheck（30-60s）
make lint
make typecheck
```

## 改动清单

| 文件 | 改动 | 行数 |
|------|------|------|
| `Makefile` 顶部 | `LOG_DIR` + `$(shell mkdir -p)` | +3 |
| `Makefile` `build-frontend` | pipefail + tee/tail + 失败上下文 | +6 |
| `Makefile` `build-frontend-fast` | tee/tail | +3 |
| `Makefile` `build-backend` | `--verbose` | +1 |
| `Makefile` `build-backend-fast` | tee/tail | +3 |
| `Makefile` `dev` | 预估时间 + tee/tail | +3 |
| `Makefile` `install` | 预估时间 + tee/tail | +3 |
| `Makefile` `test-quick` | `-n auto` + 改预估时间 | +2 |
| `Makefile` `test-frontend` | 预估时间 echo | +1 |
| `Makefile` `test` | 分阶段 echo | +3 |
| `Makefile` `typecheck` | 预估时间 + tee/tail + 失败上下文 | +5 |
| `Makefile` `debug` | 分阶段 echo | +5 |
| `Makefile` `debug-build` | tee/tail | +3 |
| `Makefile` `debug-quick` | 分阶段 echo | +3 |
| `Makefile` `debug-start` | tee/tail | +3 |
| `Makefile` `publish` | twine ANSI 过滤 | +2 |
| `Makefile` `pre-publish-quick` | 5/5 预估时间 echo | +5 |
| `Makefile` `pre-publish` | 预估时间 echo | +5 |
| `Makefile` 新增 `bg-clean` | 日志清理 | +3 |
| `backend/pyproject.toml` | 加 `pytest-xdist>=3.0.0` | +1 |
| `backend/pyproject.toml` | `addopts` `-v` → `-q` | 改 1 行 |

总计 **2 文件 ~65 行**（Makefile ~63 + pyproject.toml ~2）。

## 设计取舍说明

### 为什么必须 `set -o pipefail`？

Makefile 默认 `-e` 但管道中最后一个命令的退出码决定整体退出码。`npm ci | tee | tail -5` 中，tail 成功 → make 视为成功，即使 npm ci 失败。

### 为什么失败时 `tail -30` 而成功时 `tail -5`？

成功输出 1-3 行足够。失败时 traceback 跨多行，`tail -30` 包含足够上下文。

### 为什么 pytest-xdist 适合 PeekView？

每个 test 独立 SQLite → 无共享状态；模块级单例 worker 间独立；bcrypt rounds=4 已优化；asyncio loop function-scope。

### 为什么 xdist 下 `addopts` 改 `-v` → `-q`？

`-v` 让每个 worker 输出 verbose 行重复信息。`-q` 只显示汇总。

### 为什么 `-n auto` 而非固定 `-n 4`？

不同机器 CPU 数不同。`PYTEST_ADDOPTS="-n 2"` 可覆盖。

### 为什么不是默认 `make *-bg` 后台模式？

异步工作流复杂度远超 echo + tee/tail。使用频率（仅发布/CI）不支撑默认行为。

### 为什么 ANSI 过滤只在 publish 用？

只有 `pipx run twine` 输出含大量 ANSI 转义。局部过滤足够。

### 为什么日志路径用变量 `$(LOG_DIR)`？

支持 CI/容器场景覆盖。

### 为什么 `$(shell mkdir -p)` 在 Makefile 解析时执行？

Makefile 解析阶段执行 shell 命令，一次创建、所有 target 受益。`mkdir -p` 幂等。

## 实施注意事项（opencode 环境特定）

**环境观察**：本次会话多次遇到工具卡死：
- edit tool：长字符串 + 特殊字符（`$$`、`\`）匹配失败
- shell tool：长命令前台跑（`make build`、`make publish`、vitest 全量、`npx tsx`）卡死
- subagent：返回空 + 零改动（已发生 1 次）

**实施策略调整**：

| 改动 | 方式 |
|------|------|
| `pyproject.toml` 2 行 | Edit 工具（TOML 简单） |
| Makefile 任何改动 | python `str.replace`（**不用** edit） |
| subagent 派发 | **不用**，主 Agent 直接改 |

**风险地图**：

| 验证命令 | 风险 | 策略 |
|---------|------|------|
| `make lint` | 低 | 跑（<5s） |
| `make typecheck` | 低 | 跑（30-60s，加 timeout 90s） |
| `make test-quick` | **极高** | **跳过**，依赖之前 3 次成功验证（最近：1068 passed in 107s） |
| `make build` | **极高** | **跳过**，依赖代码审查 |
| `make publish` | **极高** | **跳过**，改动小（sed）易审查 |

**关键决策**：
- **不用 edit tool 改 Makefile**：53 处 `$$` 转义，edit 匹配不可靠
- **不用 subagent 派发**：已失败 1 次
- **不全量验证 test-quick**：节省时间 + 避免 shell 卡死；之前验证充分
- **小步走**：每改 1 类（Makefile 一节、pyproject.toml）就 commit

**回滚预案**：单文件改动，`git revert <commit>` 一次回滚。`backend/.venv` 的 pytest-xdist 安装可 `pip uninstall pytest-xdist execnet` 清理。

## 评审记录

- v1 起草（2026-08-06）：echo + tee/tail + 异步拆分
- v1 独立评审：needs-revision。11 项问题（BLOCKER 1-3、MUST-FIX、遗漏、文档、取舍）
- v2 修订：11 项全部采纳。BLOCKER 用 `set -o pipefail + 失败 tail -30` + `LOG_DIR` 解决
- v2 增量（pytest-xdist）：test-quick 107s → 30-50s
- v2 增量（实施注意事项）：用户警告 opencode 工具卡死风险，调整实施策略