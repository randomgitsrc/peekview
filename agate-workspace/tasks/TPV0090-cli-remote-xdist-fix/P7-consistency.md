---
phase: P7
task_id: TPV0090-cli-remote-xdist-fix
type: consistency
parent: P2-design.md
trace_id: TPV0090-P7-20260813
status: approved
created: 2026-08-13
agent: consistency-reviewer
# ── v2.0 机器计数 ──
blocker_count: 0
deviation_count: 0
deviation_critical_count: 0
design_gap_count: 0
design_gap_reviewed_count: 0
---

# P7 一致性检查 — test_cli_remote.py xdist 并发失败修复

检查对象：P1-requirements.md / P2-design.md / P3-test-cases.md / P4-implementation.md / P5-test-results/unit.md / P6-acceptance.md + 实现 `backend/tests/test_cli_remote.py`。
独立验证：`git show` 复核 P3/P4 提交改动面、Makefile:165 `test-quick` 原样、ci.yml:38 串行无 `-n auto`、全库 grep 端口占用、P6-evidence 4 个 log 内容核对。

## 1. DESIGN_GAP 配对

P4-implementation.md「发现」节（P4§发现，:50-52）声明：

```
无 `[SCOPE+]` / `[SCOPE_GAP]` / `[DESIGN_GAP]` / `[CLARIFY]`。实现与 P2-design §1 候选 1 规格逐行一致，未做任何规格外决策。
```

- 全文核对（grep `DESIGN_GAP` 仅命中 :52 的否定声明），P4 **无任何行首 `[DESIGN_GAP:` 声明** → `design_gap_count: 0`
- 该否定声明经 P4-review §2「与 P2 规格一致（逐行比对 §1 候选 1）」表格逐行证实（端口推导/env dict/Popen/等待循环/teardown 全部与 P2-design.md:49-91 规格一致）
- 结论：无待配对 DESIGN_GAP，`design_gap_reviewed_count: 0`，配对闭环成立（空集无需 REVIEWED）

## 2. SCOPE+ 闭环

- P1-requirements.md:14 行首 `[SCOPE_RESOLVED]` 注释：`packages 收敛为 [backend/tests/test_cli_remote.py]（P2-design.md §0 不改什么 + §2 SCOPE+ 记录）；P1 基线 BDD 不变`
- P2-design.md:157-159 的 `[SCOPE+] 发现`：P1 packages 原含 Makefile（候选 3 可能改），选型候选 1 后 Makefile 零改动 → packages 收敛为 `[backend/tests/test_cli_remote.py]`
- 双路径一致：P1 §packages 声明（frontmatter 含 SCOPE_RESOLVED 注释）与 P2 §packages（`[backend/tests/test_cli_remote.py]`）收敛结果相同
- 独立实证（本次 P7）：`git show --name-only 7612895c`（P4 提交）代码文件仅 `backend/tests/test_cli_remote.py`；`git diff` 工作区不含 Makefile/pyproject.toml/ci.yml；Makefile:165 仍为 `cd backend && .venv/bin/python -m pytest tests/ -n auto --tb=short`；ci.yml:38 无 `-n auto`
- 结论：SCOPE+（packages 收敛）已闭环，P1 基线 4 BDD 未因收敛而增删

## 3. 跨文件一致性

### 3.1 P1§BDD 数量 vs P6 验收数量（P1§BDD ↔ P6§BDD）

- P1-requirements.md §3 定义 4 条 BDD（BDD-1 `-n auto` 连续 3 次零失败 / BDD-2 make test-quick 全量全绿 / BDD-3 单跑不回归 / BDD-4 死亡快速失败含诊断）
- P6-acceptance.md §BDD 逐条验收 4 条，frontmatter `pass: 4, fail: 0`，Summary `4/4 PASS, 0 FAIL`
- **数量匹配：4 = 4**。逐条内容对照：
  - BDD-1：P6 连续 5 次（Run1-4 `-q` + Run5 默认 verbosity）全部 EXIT_CODE 0，≥ P1 的 3 次阈值，无 "Server failed to start"（P6-evidence/bdd1-xdist-consecutive.log 实测含 5 段 RUN + 5 个 EXIT_CODE: 0）
  - BDD-2：P6 全量 `1078 passed, 3 skipped, 25 warnings, EXIT 0`，test_cli_remote 零失败（bdd2-full-suite.log）
  - BDD-3：P6 单跑 `23 passed, 0 failed/0 error/0 skipped`（bdd3-serial.log）；P1 原文写"17 个用例"，P6 报告 23 = 17 既有 + 6 新增 fixture 级用例，P6 已显式澄清口径，**语义一致**（详见 4.1 观察①）
  - BDD-4：P6 引用 TC-B4a（`test_b4a_death_raises_with_rc`，rc=3 且 <5s）+ TC-B4d（`test_b4d_death_message_includes_stderr`，rc=1 + stderr 摘要 `address already in use`）2 passed in 0.36s（bdd4-fixture-death.log 实测 `2 passed, 1 warning in 0.36s`）
- 结论：数量与内容均匹配

### 3.2 P2§packages vs P4 实际改动面（P2§packages ↔ P4§impl-path）

- P2-design.md frontmatter `packages: [backend/tests/test_cli_remote.py]`
- P4-implementation.md `implementation_dir: backend/tests/`，改动清单仅 `test_cli_remote.py`（新增 import os / `_server_port` 纯函数 / fixture 3 处改造 / P3 用例体零改动）
- 独立实证：`git show 7612895c --stat` 代码改动仅 test_cli_remote.py（+39/-16，纯 fixture 改造）；`git show 51d53161 --stat` 仅追加 TestCLIRemoteFixture（+150）
- 结论：P2 声明的 packages 与实际改动面完全一致，无虚列未改动文件（Makefile 已在 SCOPE+ 中收敛移除）

### 3.3 P4 实现 vs P2 方案设计（P4§impl-path ↔ P2§候选 1）

实现代码（test_cli_remote.py:20-68）与 P2-design.md:49-91 候选 1 规格逐点核对：

| P2 规格点 | 实现（行号） | 一致 |
|-----------|------------|------|
| 端口推导 `18888 + int(worker[2:]) if worker else 18888` | `_server_port` 纯函数（:20-22，P2-design §9 显式要求纯函数化） | ✅ |
| env dict `**dict(subprocess.os.environ)` + 3 个 PEEKVIEW_* 覆盖 | :32-37 | ✅ |
| Popen `[sys.executable, "-m", "peekview", "serve", "--port", str(port)]` | :38-39 | ✅ |
| 等待循环 30 轮 + 先 poll() + communicate(timeout=2) + stderr 末 500 字符 + sleep 0.25 | :46-60 | ✅ |
| teardown terminate → wait(5) → TimeoutExpired → kill() + wait(5) | :62-68 | ✅ |

- P2-design §8 完成标志 ①-⑧：P4 自述 ①-⑥⑧ 已满足、⑦ 留给 P5 gate；P5 §Step3 全量实测关闭 ⑦ → 全部闭环
- 结论：实现与方案设计吻合，无规格外改动

### 3.4 P3 测试用例 vs P6 验收覆盖（P3§BDD 映射 ↔ P6§BDD-4）

- P3-test-cases.md §BDD 映射：BDD-4 → TC-B4a/TC-B4d；I6 → TC-B4c1/TC-B4c2；BDD-1/3 → TC-port 支撑；BDD-1/2/3 主体归 P6 实测（-n auto 是 pytest 调度行为，无法写单测断言——设计正确）
- P6 验收 BDD-4 引用的正是 TC-B4a/TC-B4d（实现方法名 `test_b4a_death_raises_with_rc` / `test_b4d_death_message_includes_stderr` 存在且绿）
- P3 6 用例全部存在于实现（:667-738），P4-review §6 证实 4 红灯全转绿 + 2 护栏保持绿
- 结论：P3 用例与 P6 验收覆盖一一对应，无悬空用例、无未被验收覆盖的新增测试

### 3.5 P5 技术验证与 P6 验收一致（P5§results ↔ P6§BDD）

- P5 P5_cli_remote 连续 4 次 23/23（BDD-1）→ P6 BDD-1 连续 5 次，方向一致且更严格
- P5 P5_serial 23/23（BDD-3）→ P6 BDD-3 23 passed，一致
- P5 全量 1078/0/3（BDD-2）→ P6 BDD-2 1078 passed/3 skipped/0 failed，数量完全一致
- P5 ruff 通过 → P4 自测 + P4-review 独立复核 ruff 通过，一致
- 无预存失败需 known-failures 登记（P5 §预存失败：全量零失败）→ 与 P0-brief 背景（TPV0089/TPV0088 两次登记同源失败）形成闭环：该预存失败已消除

## 4. 未决项清零

- P1-requirements.md §4 `[NO_NEED_CONFIRM]`（:70），全文 grep 无行首 `[NEED_CONFIRM]` 残留
- P1/P6 无 `[BLOCKER]`；P2-review §7 / P4-review §BLOCKER 均明确「无 BLOCKER、无 CRITICAL」
- P4-implementation.md 无 `[DEVIATION-CRITICAL]` / `[SCOPE_GAP]` / `[CLARIFY]`
- P1-requirements.md §4 的 `[SUGGEST: 优先论证 B+C]` 为方案倾向提示，已在 P2 选型中完成对比（候选 1 = B 子方案 + 动态端口，即"B+机制级消除"，SUGGEST 已被吸收），非未决项
- 结论：未决项全部清零

## 5. 耦合点核对（P2§风险 + P1§隐含需求）

| 耦合点 | 核查 | 锚点 |
|--------|------|------|
| fixture 改造 vs 17 既有用例 | 既有用例体零改动（`git show 7612895c` 仅 fixture 区域 +39/-16）；唯一成功路径行为差异为 sleep 0.5→0.25（P2 规格值）与 env 值从字面 `"18888"` 变 `str(18888)`（恒等）→ 行为不变 | P4-review §3 + P1§I4/I5 |
| `PYTEST_XDIST_WORKER` 依赖 | P2 minimal_validation ② confirmed（gw0..gw15 全部可见、端口逐一唯一）；无该变量（单跑/CI）回退 18888 与修复前逐位一致 | P2§7 + P2-review 实证 |
| 端口范围 18888-18903 vs 项目其它端口 | 全库 grep `1888\d` 仅 test_cli_remote.py 使用；3000（test_cli.py:80 仅 CliRunner 断言不监听、test_captcha.py cap:3000 为 mock URL）/8080（test_entry_service 为配置字符串）/8888 无冲突 | P2-design §0 风险 + P2-review §1 + P7 独立 grep |
| teardown vs 残留进程（I6） | P4 自测 `ss -tlnp` 无 1888x 监听；P5 Step5 pgrep 空；P6 环境隔离节 pgrep "serve --port" 为空；P7 复核 pgrep 无残留 | P1§I6 + P4/P5/P6 |
| fixture 级测试 vs conftest 全局隔离 | conftest.py:22-41 autouse `isolate_config_file` 不设 `PEEKVIEW_SERVER__PORT`，与动态端口无干扰 | P4-review §3 + P7 读 conftest.py |

## 6. 非阻断观察（不计入计数）

1. **BDD-3 用例数口径**：P1 §3 写作"17 个用例"，P6 报告 23 = 17 既有 + 6 新增 fixture 级用例。P6 已显式澄清（"修复后 23 用例 = 17 既有全部通过 + 6 新增"），且 P3 新增用例是 P1 强制"P3 不可跳"的直接产物，非方案漂移 → 语义一致，非 deviation
2. **BDD-2 用例数近似**：P1 写"~1068"，实测 1078+3 skipped；P1-review 已标注"~1068 为近似数不影响判定"，P5/P6 数量一致 → 无碍
3. **`out` 变量未使用**（实现 :48）与 **TestCLIRemoteFixture 继承 integration mark**：P4-review 已记录为 INFORMATIONAL，与本次一致性无关，不阻断

## 7. 结论

- **BLOCKER = 0**（无 [BLOCKER] / [DEVIATION-CRITICAL]）
- **DESIGN_GAP = 0**（P4 无声明，空集配对闭环，reviewed = 0）
- **SCOPE+ 闭环**：packages 收敛 `[test_cli_remote.py]`，P1 `[SCOPE_RESOLVED]` 与 P2 SCOPE+ 记录双路径一致，独立实证 Makefile/pyproject/ci.yml 零改动
- **跨文件一致性通过**：P1 4 BDD = P6 4 PASS（逐条锚点对应）；P2 packages = P4 实际改动面（git 实证）；P4 实现 = P2 候选 1 规格逐行一致；P3 用例 = P6 验收覆盖一一对应；P5 与 P6 结果数量一致
- **未决项清零**、耦合点核对通过

跨文件引用：P1§BDD / P1§packages / P1§隐含需求 / P2§packages / P2§候选 1 / P2§gate_commands / P3§BDD 映射 / P4§发现 / P4§impl-path / P5§results / P6§BDD。

**结论：approved。可推进 P8。**
