---
phase: P1
task_id: TPV0090-cli-remote-xdist-fix
type: review
parent: P1-requirements.md
trace_id: TPV0090-P1-review-20260813
status: approved
created: 2026-08-13
agent: requirements-review
---

# P1 评审 — test_cli_remote.py xdist 并发失败修复

评审对象：`P1-requirements.md`（frontmatter：risk=low / phases 全走 / packages=[test_cli_remote.py, Makefile] / domains=[backend] / P1_simplified）

复核依据（本评审实测，非仅依赖 analyst 断言）：
- 单跑 `pytest tests/test_cli_remote.py -q`：17/17 全绿（与修复前基线一致）
- `pytest tests/test_cli_remote.py -n auto`：复现失败，本次 4 failed（`TestCLIRemoteList` 组，`assert ...`），失败为 CLI 子进程端错误而非 "Server failed to start"
- Makefile:163-166 `test-quick = cd backend && .venv/bin/python -m pytest tests/ -n auto --tb=short`；ci.yml:38 串行无 `-n auto`

## BDD 评审

| BDD | 判定 | 覆盖维度 | 备注 |
|-----|------|---------|------|
| BDD-1: `-n auto` 下连续 3 次零失败（0 failed/0 errors/17 全过） | ✅ 可二值判定 | 数据✗ 前端✗ 多端✓ 边界✓ 兼容✓ | 单文件 + 16 workers 是有效竞争复现（17 用例分散多 worker，各起一份 module fixture 抢 :18888）。"连续 3 次"作为概率性 bug 的确定性验收阈值合理（I1 直接锚定）；非机制保证，而是验证措施，可接受 |
| BDD-2: 完整 `make test-quick`（tests/ -n auto，~1068 用例）全绿 | ✅ 可二值判定 | 数据✗ 前端✗ 多端✓ 边界✓ 兼容✓ | 覆盖全量回归；含方案 C 下"其余模块并行能力不退化"（§7 约束）的观察点。`~1068` 为近似数不影响判定 |
| BDD-3: 单跑（无 xdist）17 用例全部通过、无新增失败/跳过/error | ✅ 可二值判定 | 数据✗ 前端✗ 多端✓ 边界✗ 兼容✓ | 与修复前基线一致（已实测）；同时作为 CI 串行路径的本地代理（两者均为串行执行，I5） |
| BDD-4: server 子进程启动阶段死亡时 fixture 立即失败且报错含退出码/stderr 摘要，不产生静默 Connection refused 假失败 | ✅ 可二值判定（需 P3 量化时间界） | 数据✗ 前端✗ 多端✓ 边界✓ 兼容✗ | "错误信息含退出码或 stderr 摘要"与"不产生假失败"二值明确；"立即失败（不进入完整等待窗口）"需 P3 给具体阈值（如"小于完整 15s 窗口，如 <5s"）以支撑断言——这是实现细节，P2/P3 可操作化，不阻断 |

**跨条一致性**：BDD-1（并发全绿）与 BDD-3（串行不回归）是两个执行模式，无矛盾；BDD-2 是前两者的全量超集，语义一致。BDD-4 只约束失败路径诊断，与 BDD-1/2 成功路径正交。4 条 BDD 覆盖成功路径（1/2/3）与失败路径（4），无同场景冲突。编号 `#### BDD-1:..BDD-4:` 连续、格式合规（匹配 gate 锚点 `#### BDD-NN:`）。每条 BDD 单 Given/When/Then，无多场景未拆分。

## 隐含需求覆盖

| 维度 | 条目 | 覆盖 | 说明 |
|------|------|------|------|
| 数据 | I7 无业务数据影响 | ✅ 覆盖 | I 表 + §7 约束（临时目录 tmp_path_factory 管理）；无 BDD 锚点属合理（负面约束，P6 可人工核验） |
| 前端 | I8 无前端/MCP/API 业务改动 | ✅ 覆盖 | §7 约束明确；domains=[backend] 声明一致 |
| 多端 | I3 多 worker 不得抢固定端口 :18888 | ✅ 覆盖 | BDD-1/2 间接锚定（竞争消除 → 全绿）；I3 "why" 命名了"串行化/隔离分组"作为候选机制，但以"只要结果确定即满足"约束为行为要求，属可接受边界 |
| 多端 | I5 CI 串行路径不改变（不改 ci.yml） | ✅ 覆盖 | §7 约束 + BDD-3 作串行代理；CI 不可本地实跑，以约束+代理覆盖，合理 |
| 边界 | I1 确定性（重复运行结果稳定） | ✅ 覆盖 | BDD-1 连续 3 次直接锚定 |
| 边界 | I2 子进程死亡可诊断 | ✅ 覆盖 | BDD-4 直接锚定 |
| 边界 | I6 清理回收、无残留 server 进程 | ⚠️ 间接覆盖 | BDD-1"连续 3 次"隐含（残留进程占端口会打挂后续 run），BDD-4"不产生静默假失败"部分相关；建议 P3 增补 fixture 级 teardown 回收断言（PID 消失/端口释放），非阻断项 |
| 兼容 | I4 保留进程级集成测试意图 | ✅ 覆盖 | BDD-3 锚定（17 用例语义与结果不变）+ §7 约束（不退化 mock） |
| 兼容 | I5/I4 | ✅ 见上 | |

**遗漏检查**（dispatch 重点提示项）：端口占用残留（→I6 间接覆盖，见上）；xdist 分组机制（→I3 行为层覆盖，机制留 P2）；Makefile 改动影响（→packages 声明 + P7 交叉核对 + §7"其余模块并行能力不退化"约束 + BDD-2 观察）。无实质遗漏。

## 裁剪评审

- 跳过阶段：**无跳过**（P1-P8 全走，`phases: [P1..P8]`）
- P2 不可裁（方案 A/B/C 对比论证）：充分——P0 known_risks 明确方案分歧、需选型；与前端frontmatter 注释一致
- P3 不可裁（零现成覆盖）：**充分**——问题本身是测试基础设施 bug，无现有测试可验证修复；需新增 fixture 级测试（模拟启动慢/死亡/端口冲突）支撑 BDD-4 与 BDD-1 确定性。符合 agate 规则（risk=low 但"零现成覆盖"属硬性不可跳条件）
- P6 不可裁（本地实测）：**充分**——概率性失败（16 核复现、CI 不复现）必须在本地 -n auto 连续 3 次实测中关闭，无法替代
- P7 需执行：合理——fixture 与 Makefile 跨文件改动需一致性核对
- P8 全走：遵循项目惯例（CHANGELOG 记录），合理
- P1_simplified: true：**基本合理**——单文件测试基础设施 bug，但实际产出（I1-I8 + 4 BDD）已达完整 P1 密度，"simplified"仅降交互复杂度，未牺牲需求覆盖，无碍
- risk_level: low：**匹配**——无业务代码/schema/权限改动；但注意"每次 make test-quick 的可靠性"是高频开发路径，P2/P4 仍需对并发/确定性保持强度（low 指生产风险，不指实现简单度）

## 能力需求

`local-pytest-xdist: available` 判断正确：backend/.venv 有 pytest 9.1.1 + pytest-xdist，本机 16 核，`-n auto` 已实测可复现失败（=验证能力可用）；无 GAP、无 minimal_validation 需求，与低风险定位一致。

## P1 纯净性

- §4 `[SUGGEST: 优先论证 B+C]`：是方案倾向提示，但**显式标记 SUGGEST、明确"最终选型仍由 P2 对比论证"**，未在需求层拍板 → 不构成方案设计混入，处于可接受边界
- I3 "why" 提及"串行化该文件/隔离分组"：候选机制命名，但以"只要结果确定即满足"收束为行为要求 → 可接受
- BDD-4"立即失败（不进入完整等待窗口）"：描述可观察行为（快速失败+诊断），非实现细节 → 合规
- 无 P2 才该有的数据结构/算法/接口设计混入

## 结论

**approved**（附非阻塞观察 3 项，供 P2/P3 参考，不构成修改要求）：

1. **根因证据指向方案 C 类**：实测失败模式是 fixture 健康检查通过（命中他 worker 的 server）但 CLI 子进程调用时 Connection refused——即等待/死亡检测（A/B 类）单独无法消除竞争；I1 的确定性要求（BDD-1）实际**强制**引入串行/分组（方案 C）作为机制，建议 P2 以此为约束对比，而非与纯 A/B 平权比较
2. **BDD-4 "立即失败"需时间界**：P3 实现时须给出具体断言阈值（如"fixture 失败耗时 < 完整 15s 窗口"），并确认"快速失败"在进程死亡瞬间与 0.5s 轮询步长的关系
3. **I6 清理建议补显式断言**：P3 增补 fixture teardown 后子进程已回收/端口释放的断言（不阻断，BDD-1 连续 3 次已隐式覆盖）

## 门槛产物自检

- Header `status: approved` 与结论一致 ✓
- 逐条引用 BDD-1~BDD-4 编号 + 覆盖维度表 ✓
- agent=requirements-review（≠main）✓
- 只审不写：未修改 P1-requirements.md 与任何代码 ✓
