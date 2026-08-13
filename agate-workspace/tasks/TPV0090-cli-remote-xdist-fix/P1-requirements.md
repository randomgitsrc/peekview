---
phase: P1
task_id: TPV0090-cli-remote-xdist-fix
type: requirements
parent: P0-brief.md
trace_id: TPV0090-P1-20260813
status: draft
created: 2026-08-13
agent: analyst
# ── v2.0 机器字段 ──
risk_level: low             # 纯测试基础设施，无业务代码/schema/权限改动
phases: [P1, P2, P3, P4, P5, P6, P7, P8]   # 默认全走；P3 不可跳（零现成覆盖）；P6 需本地实测
packages: [backend/tests/test_cli_remote.py, Makefile]   # 方案 C 可能改 Makefile；ci.yml 串行不受影响（见正文约束）
domains: [backend]          # 仅后端测试基础设施域
# follows_existing_pattern: 修现有 fixture，但方案 A/B/C 选型需 P2 明确对比，不建议单候选直接跳过
---

# P1 需求基线 — test_cli_remote.py xdist 并发失败修复

## 1. 需求复述

`backend/tests/test_cli_remote.py` 是 CLI remote 模式的进程级集成测试（模块级 fixture `server_url` 以子进程启动真实 peekview server 监听固定端口 `:18888`，17 个用例通过 CLI 子进程访问该 server）。在本地 `make test-quick`（`pytest tests/ -n auto`，16 workers）下，该文件出现随轮次漂移的失败（实测 3 次运行分别 5 failed / 3 failed+3 errors / 9 failed），单跑（无 xdist）17/17 全绿，CI 串行（`.github/workflows/ci.yml:38` 无 `-n auto`）不受影响。

**要解决的是**：让 `make test-quick`（`-n auto`）对该文件稳定全绿，且不牺牲单跑/CI 的既有正确性与该文件的进程级集成测试意图。

## 2. 隐含需求识别

| # | 维度 | 隐含需求 | 为什么必须 |
|---|------|---------|-----------|
| I1 | 边界/并发 | 修复必须**确定性**（同一命令重复运行结果稳定），不能只是把失败概率降低（方案 A 治标，负载极高仍可能失败） | 失败本质是概率性的；单次全绿可能是运气好，验收必须覆盖重复运行 |
| I2 | 边界/诊断 | server 子进程在启动阶段死亡（如端口绑定失败）时，fixture 应立即失败并输出**可诊断信息**（含子进程 stderr），不得静默等待 15s 后抛出无信息量的 "Server failed to start" | 现状等待循环不检测 `proc.poll()`、不打印 stderr；一旦失败开发者无法定位 |
| I3 | 边界/资源 | 多 worker 不得为同一固定端口 `:18888` 竞争（无论靠串行化该文件、还是隔离分组，只要结果确定即满足） | 根因即多 worker 同时 Popen 抢同一端口；修复须从机制上消除该竞争 |
| I4 | 兼容/测试意图 | 必须**保留**该文件的进程级集成测试意图（真实 server 子进程 + 真实 CLI 子进程），不得退化为 mock/单进程 fake 以绕开问题 | 该文件定位是集成测试；用 mock 规避会改变测试语义，属方案性越权（若 P2 论证需要，另行 SCOPE+） |
| I5 | 兼容/回归 | 单跑（无 xdist）17 用例语义不变、全部通过；CI 串行路径不因本次改动改变（不改 ci.yml） | 修复必须零回归，且 CI 与本地命令不应出现行为分叉 |
| I6 | 边界/清理 | fixture 清理（`proc.terminate()` + `wait(timeout=5)`）须保证子进程被回收、端口释放；不得遗留僵尸 server 进程污染后续运行 | 残留进程会导致端口长时间占用，制造下一轮假失败 |
| I7 | 数据 | 无业务数据影响（测试临时目录由 `tmp_path_factory` 管理） | 纯测试基础设施改动 |
| I8 | 前端/多端 | 无前端、无 MCP、无 API 业务代码改动；CLI 本体仅被测试，不被修改 | 改动面收敛到测试基础设施 |

## 3. BDD 验收条件

### 并发模式全绿（本地 make test-quick 路径）

#### BDD-1: test_cli_remote.py 在 `-n auto` 下连续 3 次运行零失败
- Given 在 backend 目录以 16 workers 并发执行 `pytest tests/test_cli_remote.py -n auto`
- When 连续运行 3 次
- Then 每次均为 0 failed 且 0 errors（17 用例全部通过），无 "Server failed to start" 报错

#### BDD-2: 完整 `make test-quick`（`pytest tests/ -n auto`）全绿
- Given 执行 `make test-quick`（等价 `cd backend && .venv/bin/python -m pytest tests/ -n auto --tb=short`）
- When 运行完整后端测试套件（~1068 用例）
- Then 全部通过，且 `test_cli_remote.py` 用例零失败、零 error

### 无回归

#### BDD-3: 单跑（无 xdist）不回归
- Given 在 backend 目录单进程执行 `pytest tests/test_cli_remote.py -q`
- When 运行 17 个用例
- Then 17 个全部通过（与修复前行为一致），无新增失败/跳过/error

### 失败路径可诊断

#### BDD-4: server 子进程启动阶段死亡时 fixture 快速失败且报错含诊断信息
- Given 模块级 fixture 启动的 server 子进程在启动阶段死亡（模拟端口绑定失败/启动崩溃）
- When 测试用例请求 `server_url` fixture
- Then fixture 立即失败（不进入完整等待窗口），错误信息包含子进程退出码或 stderr 摘要（可据此定位原因），且后续依赖该 fixture 的用例不产生静默 "Connection refused" 假失败

## 4. 待确认清单

[NO_NEED_CONFIRM]

- 修复方向（加长等待/死亡检测/串行分组）为方案选型问题，已明确交由 P2 论证，P1 无需人定夺
- 验收标准（连续 3 次 `-n auto` 全绿 + 单跑 17/17 + 全量套件全绿 + 失败路径可诊断）均有明确二值判定，无需确认
- 若 P2 论证需要放弃进程级集成测试意图（I4），应作为 `[SCOPE+]` 回写本文件，交由主 Agent 批准，而非 P1 预先决定

[SUGGEST: P2 选型时应优先论证「子进程死亡检测 + 该文件串行/分组」组合（B+C），理由：方案 A 仅加长等待窗口，负载极高时仍可能失败（治标）；方案 B 单独只提升诊断不消除竞争；方案 C 从设计上规避进程级集成测试的并发问题，B+C 兼得确定性与可诊断性。最终选型仍由 P2 对比论证后决定]

## 5. 裁剪说明

- **P2 不可裁剪**：方案 A/B/C（及组合）选型需明确对比论证，P0-brief 已声明不建议单候选直接跳过
- **P3 不可裁剪（强制）**：问题本身是测试基础设施 bug，修复无现成测试可验证；需新增 fixture 级测试（模拟 server 启动慢/死亡/端口冲突场景，支撑 BDD-4 与 BDD-1 的确定性）——零现成覆盖是硬性理由
- **P6 不可裁剪**：验收需本地实测（-n auto 连续 3 次全绿 + 单跑 17/17 + 全量套件全绿），概率性失败必须在实测中关闭
- **P7 需执行**：改动可能跨 `test_cli_remote.py` fixture 与 `Makefile`（方案 C 时），多文件改动需一致性交叉核对
- **P8 全走**：遵循默认流程（CHANGELOG 记录测试基础设施改进）；虽无用户可见功能变更，但按项目惯例全走发布准备
- **P1_simplified: true**：任务为单文件测试基础设施 bug 修复，需求复述一句话 + 隐含需求逐维度快速过（I1-I8 已覆盖数据/前端/多端/边界/兼容维度）

## 6. 能力需求声明

```yaml
capability_requirements:
  - need: local-pytest-xdist
    why: P6 验收需本地实测 -n auto 连续 3 次全绿 + 单跑不回归 + 全量套件全绿；P3 需新增 fixture 级测试
    available:
      - "backend/.venv（pytest 9.1.1 + pytest-xdist 已装，本机 16 核，-n auto = 16 workers）"
    status: available
```

无 GAP，无需 minimal_validation（不依赖浏览器行为/外部系统/安全模型）。

## 7. 约束与边界

- 只改测试基础设施（`backend/tests/test_cli_remote.py`，方案 C 时含 `Makefile`）；**不改**业务代码、CI 文件、`backend/pyproject.toml` 的 pytest 全局配置（除非论证必要，须走 SCOPE+）
- **严禁触碰**生产 `:8080` 服务与 `~/.peekview/`；复现与验证只走 backend/.venv 与测试临时目录
- 修复后 CI 串行路径（`.github/workflows/ci.yml:38`）行为不得改变，不允许通过改 CI 掩盖本地问题
- 若方案 C 采用文件级串行/分组，其余测试模块的并行执行能力不得退化（验收时关注全量套件总耗时不显著劣化）
