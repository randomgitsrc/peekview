---
phase: P2
task_id: TPV0090-cli-remote-xdist-fix
type: review
parent: P2-design.md
trace_id: TPV0090-P2-review-20260813
status: approved
created: 2026-08-13
agent: review
---

# P2 评审 — test_cli_remote.py xdist 并发失败修复

评审对象：`P2-design.md`（frontmatter：candidate_count=3 / packages=[backend/tests/test_cli_remote.py] / domains=[backend] / ui_affected=false）

本评审全部关键技术前提经**实证复核**（非仅依赖 architect 断言）：
- `-n auto` 实测 = `gw0`..`gw15`（80 tests 落点 16 个不同 worker）
- `-n 4` = `gw0`..`gw3`；`-n 1` = `gw0`；串行无 `PYTEST_XDIST_WORKER`
- `int(worker[2:])` 对 `gw15` → `"15"` → `15` → `18903`，推导正确
- xdist_group 在默认 `dist=load` 下**不 honor**（g1-g4 分散 gw0-3），`--dist=loadgroup` 下全 gw0 —— 佐证候选 2 否决理由
- poll 死亡检测 0.251s 检测 rc=3 —— 佐证 BDD-4 时间界
- 串行 + `--dist=loadgroup` / 串行 + xdist_group 标记均通过 —— 佐证 I5
- `-n auto` 当前复现 **7 failed**（均为 Connection refused on :18888）—— 问题真实、根因方向正确

## 1. 方案正确性核查

| 项 | 核查结果 | 证据 |
|----|---------|------|
| 端口推导 `int(worker[2:])`（§1 候选 1 代码，P2-design.md:55） | ✅ 正确 | 实证 gw0..gw15 → 18888..18903，16 端口逐一唯一 |
| worker 名非 gwN 格式 | ✅ 低风险 | xdist 固定 gwN 命名，3.8.0 实测稳定；串行无变量走回退分支；若未来命名变更 `int()` 抛 ValueError 属 fail-fast 而非静默错误 |
| 端口范围 18888-18903 | ✅ 无冲突 | grep 全库仅 test_cli_remote.py 用 18888；test_config.py:116 的 port=3000 仅配置断言不监听 |
| 无 -n 回退 18888（I5） | ✅ 逐位一致 | 实证串行无 env var；`--dist=loadgroup`/xdist_group 在串行下无副作用 |
| BDD-4 时间界（§3，P2-design.md:170） | ✅ 合理 | poll 每轮先行 → 死亡后最快下轮 0.25s 检测（实测 0.251s）；"≤1s" 保守；P3 断言 <5s 含 30-loop 兜底余量 |
| teardown 强化（I6，§1） | ✅ 满足 | terminate → wait(5) → TimeoutExpired → kill() + wait(5) 兜底 |
| env 与 --port 一致性 | ✅ 一致 | cli.py:171 `bind_port = port or config.server.port`，两者同值 |

## 2. BDD 映射核查

| BDD | 机制锚点 | 判定 |
|-----|---------|------|
| BDD-1（-n auto ×3 零失败） | §1 候选 1 每 worker 独占端口 + §4 P5_cli_remote（P6 实测 3 次） | ✅ 满足 |
| BDD-2（make test-quick 全绿） | §4 P5 = Makefile test-quick 展开等价 | ✅ 满足（`-n auto --tb=short` 与 Makefile:166 一致） |
| BDD-3（单跑 17/17） | §4 P5_serial + 回退 18888 | ✅ 满足 |
| BDD-4（死亡快速失败含诊断） | §1 poll 分支 raise RuntimeError 含 rc + stderr 摘要 + §8.4 P3 fixture 级测试 | ✅ 满足 |

跨条一致性：BDD-1（机制消除竞争）与 BDD-3（串行回归）无矛盾；BDD-4 与成功路径正交。4 条全覆盖。

## 3. 约束遵守核查（P1 §7 + I1-I8）

- **P1 §7**：pyproject.toml / ci.yml / Makefile / 业务代码 **零改动**（§0 不改什么）。候选 2 因违反 §7 被否决（minimal_validation 实测需全局 --dist=loadgroup），论证充分 ✅
- **I1 确定性**：唯一映射无碰撞、无时序依赖（§2 理由 2）✅
- **I2 诊断**：poll 死亡检测 + stderr 摘要（§1）✅
- **I3 无端口竞争**：机制级消除（每 worker 独占端口）✅
- **I4 保留集成意图**：真实 server + 真实 CLI 子进程不变（§2 理由）✅
- **I5 CI 不改变**：串行实测无副作用 + ci.yml 零改动 ✅
- **I6 清理回收**：terminate→wait→kill 兜底 + §8.8 pgrep 断言 ✅
- **I7 数据**：tmp_path_factory 隔离（PEEKVIEW_STORAGE__* 已注入，conftest 全局 autouse 复核）✅
- **I8 多端**：无前端/MCP/API 业务改动 ✅

## 4. SCOPE+ 合理性

packages 收敛为 `[backend/tests/test_cli_remote.py]`（§2 SCOPE+ 记录）—— 合理。P1 原含 Makefile 是因候选 3 可能改；选型候选 1 后 `make test-quick` 原样（Makefile:163-166 实测确认零改动）。P1-requirements.md:14 已同步 SCOPE_RESOLVED 注释，双路径一致，无虚列。

## 5. 候选方案对比

- 候选 1 满足全部 4 BDD + 零约束违反 + 改动面最小（单文件）—— 选型正确
- 候选 2 否决理由经实证支撑（xdist_group 默认不 honor，必须改全局 pyproject）✅
- 候选 3 否决理由成立（BDD-1 裸命令仍复现竞争）✅
- `candidate_count: 3` 与正文 3 候选一致（§0 提及的方案 A 仅作陪衬基线，未计入候选，无碍）

## 6. 非阻断观察（供 P3/P4，不构成修改要求）

1. **`import os` 缺失**：设计 snippet 用 `os.environ.get(...)`（P2-design.md:54），但 test_cli_remote.py 当前 imports 无 `os`（仅 json/subprocess/sys/time/patch/pytest/requests）→ P4 需补 `import os`，否则 NameError
2. **等待循环仅 catch ConnectionError**：若 `requests.get(timeout=1)` 抛 ReadTimeout 等异常会向上传播且不留进程清理——**预存行为**（当前代码同样如此），非本任务引入，可留 P3 作可选加固，不阻断
3. **gate_commands.P5_cli_remote 单次 vs BDD-1 ×3 次**：P5 一次、P6 连续 3 次，语义与 P1 验收一致，无歧义

## 7. BLOCKER/CRITICAL 清单

**无 BLOCKER，无 CRITICAL。**

## 结论

**approved**。方案正确性逐项复核通过；4 条 BDD 全部满足；P1 §7 + I1-I8 约束全遵守；SCOPE+ 收敛合理；无 BLOCKER。观察项均非阻断，P4 实现时注意补 `import os`。

## 门槛产物自检

- Header `status: approved` 与结论一致 ✓
- 结论引用具体锚点（§1/§2/§3 章节 + BDD 编号 + 行号）✓
- agent=review（≠main）✓
- 只审不写：未修改 P2-design.md 与任何代码；实证仅跑测试于 backend/.venv 与 /tmp ✓
