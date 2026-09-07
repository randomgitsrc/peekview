---
bump_type: none
---
# P8-release — TPV0096 E2E fixture 自包含化

---
phase: P8
task_id: TPV0096
role: implementer（P8 releaser 模式）
---

## 1. 版本 bump 判定

`bump_type: none`

理由：本任务改动为 3 个渲染类 E2E spec 的 fixture 自包含化改造 + `docs/process/debug-workflow.md` 新增「E2E 编写规范」节——无产品代码改动、无用户可见行为变化，不构成 major（破坏性变更/API 行为变化）/ minor（新功能）/ patch（bug 修复）任一语义。dispatch-prompt「版本 bump 判定」节明示「测试缺陷不应影响版本号决策」，同理适用于测试基建与文档规范改动。P1 §7 裁剪声明与 P7 §8 结论均确认「无 bump、CHANGELOG [Unreleased] 记录」口径，三处一致。

## 2. 版本号变更确认

无（bump_type: none）。本任务未修改任何版本文件（VERSIONS.json / package.json / pyproject.toml 均未触碰），主 Agent 无需执行 `make bump-version`。

## 3. CHANGELOG 更新确认

已在仓库根 `CHANGELOG.md` 新增 `## [Unreleased]` 节（位于 `## [0.24.1] - 2026-09-07` 之前），Keep a Changelog zh-CN 风格。条目摘要：

- **新增**（测试基建）：3 个渲染类 E2E spec（mermaid/mermaid-check/mermaid-visual）自建 entry 化——每 test 匿名创建 fixture（`e2e-` 前缀确定性 slug、防御性预删、不吞错）+ afterEach 清理队列 + BASE_URL 防生产护栏
- **修复**：mermaid-visual 假绿修复（断言无条件执行）；死选择器迁移与 goto 路由迁移（`/entries/:slug` → `/:slug`）；干净 debug 环境 14 用例双 project 全绿可重复（DEBT0010 闭环）
- **文档**：`docs/process/debug-workflow.md` 新增「E2E 编写规范」节（4 条：路由写法/seed 或自建+清理/护栏/认证配对）

## 4. debt_check

`debt_check: reviewed`

已核对 `agate-workspace/debt/tech-debt.md`，涉及条目：

| 条目 | 状态 | 本次核对结论 |
|------|------|--------------|
| DEBT0010 | open → 建议转 closed | closure criteria「三 spec 干净 debug 全绿」已达成候选：三 spec 自建 fixture 化，干净 debug 环境 14 用例双 project 全绿（P5 e2e.md / P6 / P6.5 judge 三方证据）。状态翻转决策留主 Agent |
| DEBT0011 | open（延后） | t022/verify-mermaid 同型缺陷按 P1 SUGGEST-4 延后单独立项；本次落盘的 BDD-13 E2E 编写规范为其拦截手段 |
| DEBT0012 | open（预存） | seed-debug.py 偶发 422 预存缺陷，本任务 fixture 不依赖全量 seed，未处理，留待单独立项 |
| DEBT0008 | open（部分推进） | 测试副作用/环境还原 gate 缺失——BDD-13「自建 entry + afterEach 清理队列」规范落盘为其 closure_criteria 第 2 项的协议侧推进，未关闭 |

## 5. 发布检查命令

不适用（bump_type: none）——无包需 bump，无发布检查命令需执行。快速反馈类检查已由 P5 五键覆盖：单测 1343 passed / 0 failed + typecheck 通过 + E2E 三 spec 14 用例全绿（P5-test-results/ 可复用）。

## 6. 临时资源清单（releaser → 主 Agent 交接）

本任务全周期启动过/产生过的临时资源，供 READY 收尾检查清理核对：

- **临时服务**：debug server（`make debug-start`/`make debug-stop`，:8888）多轮启停，每轮均已 debug-stop 清理；无其他常驻进程
- **/tmp 中间日志与脚本**（可清理）：`/tmp/p5-e2e-1.log`、`/tmp/p5-e2e-2.log`、`/tmp/p5-e2e-3.log`、`/tmp/p6-*.log`、`/tmp/bdd12-*.log`、`/tmp/p2-minval.sh`、`/tmp/peekview-debug.log`
- **临时数据**：/tmp/peekview-debug/ debug 数据目录（`make debug-stop` 随每轮清理）；探针 entry `e2e-probe-p2`（P2 最小验证创建，已删除并验证）
- **开发安装**：无（全程 venv 隔离，未做 editable/全局安装）
- **生产触达**：无——全程未触碰 :8080 生产服务与 `~/.peekview/`（`[PROD_NOT_TOUCHED]`）

## 7. Lessons Learned

1. **测试基建**：E2E fixture 依赖会漂移的 seed entry 是红灯常态化的根源——自建 entry + afterEach 清理队列 + 确定性 slug（`e2e-` 前缀 + 防御性预删）三件套使 spec 在任何干净环境可重复，信号失真问题消除（来源：TPV0096，2026-09-07）
2. **流程**：「测试缺陷不应影响版本号决策」的判定原则可推广到测试基建/纯文档任务——bump_type 显式记 none 并附理由，比留空或硬凑 patch 更可审计（来源：TPV0096，2026-09-07）
3. **测试**：假绿（断言被 try/except 或条件分支跳过）比红灯更危险——本次 mermaid-visual 断言改为无条件执行后才暴露真实覆盖面，验证「红灯常态化掩盖真回归」与「假绿掩盖缺陷」是同构风险（来源：TPV0096，2026-09-07）
