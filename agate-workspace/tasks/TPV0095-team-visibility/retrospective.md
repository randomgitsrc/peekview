---
task_id: TPV0095
mechanism_issues: ["subagent 单次派发任务过载导致 P4 三评审并行时全部半途结束（无产出即 idle），协议对并行 subagent 的任务粒度缺乏上限约束", "P4 实现评审发现真实 BLOCKER 后，评审→修复→复审循环的 agent 复用缺少明确指引（同 agent 多次 send_message 复用 vs 新派）"]
execution_issues: ["P1/P2 阶段早期将完整 phase 卡片内容写入 dispatch-context 前未先注入 AGATE_CARD 占位符，导致 inject-card 失败重跑", "P6 E2E_b spec 的 fixture 缺陷（同 test 二次 login 无登出）在 P3 红灯期未被发现，P5 才暴露，应属 P3 自检范围"]
feedback_ready: false
---

# TPV0095 复盘 — team-visibility（团队可见性机制）

## 一、事实基线

- 任务规模：44 BDD（backend 30 + CLI 4 + MCP 3 + 前端 UI 7），schema 变更 + 三端（backend/frontend/mcp）+ CLI + 权限收敛
- 交付：peekview v0.22.0 + mcp-server v0.12.0（minor × 2，含 schema 迁移）
- 流程 commit 18 个（立项 5525c319 → READY fabc1793）
- 评审轮次：P2 双评审（首轮 needs-revision → 复审 approved）、P4 三评审（eng：rejected → needs-revision → approved 共 3 轮；design：needs-revision ×2 → approved 共 3 轮；cso 1 轮 approved）
- 真实缺陷捕获：P4 review-eng 抓 2 个 CRITICAL BLOCKER（share cookie 越权读 + owner 读权不一致，均实测复现）；P4 design-review 抓 F1-F3 前端问题；P6 抓 1 个 E2E fixture 缺陷
- 预存失败登记：known-failures ×3（沙箱只读 EROFS ×2 + backup flaky ×1）
- 维护性反模式：known-violations ×2（models.py god-file 997→1153 行 + 1 处测试 any）
- 触发的机制标记：SCOPE+ ×3（P2 报告，主 Agent 裁定采纳 2/不采纳 1 记 backlog）、DESIGN_GAP ×8（backend 3 + frontend 5，P7 全 REVIEWED）、BASELINE_CHANGE ×2（BDD-44 增补 + BDD-31~33 --user 锚）

## 二、做得好的 + 可复用模式

- **P4 实现评审的实测复现价值**：review-eng 用隔离 tmp DB 实测复现 BLOCKER（非"看代码推断"），抓到 cookie 越权读 + owner 读权不一致两个真实 CRITICAL——证明 P4 独立实现评审（非只看自述）在高风险权限任务上是必要的
  → 去向：项目资产沉淀（本任务 P4-review-eng.md 的实测模式可作后续权限类任务评审模板）
- **方案 A 裁定的 owner 语义传播检查**：BLOCKER-2 裁定"owner=团队读权成员"后，复审用 10 表面矩阵（get/All/team=me/team=slug/raw/?share=/cookie/download/files-content//stars/Starred tab）逐面验证语义传播完整，抓到 R1/R2 两处残留
  → 去向：可复用模式——"语义裁定后的全表面传播检查清单"，值得固化
- **主 Agent 在 P8 前的复盘检测**：`check-retrospective.py` 在 commit 时提醒 SCOPE+ 触发需复盘，协议自动兜底防遗漏
  → 去向：机制本身（无需沉淀）

## 三、发现的问题

- 问题：P4 C8 三评审（review-eng/design-review/cso）**并行派发后全部半途结束无产出**（cso 只读一半，其余未写 progress），白白消耗上下文与时间；改为 send_message 复用原 agent 逐个串行执行后才正常产出。
  归因层面: 机制缺口
  说明：协议 P4 卡片说"多个评审角色并行派发"，但未约束单 subagent 的任务粒度上限——大任务（44 BDD 全链）的每个评审都要读巨量 diff + 实测复现，超单 agent 承载；DSH 平台无超时保护会静默 idle。用户已指出"分派 subagent 不宜任务过多，一次撑死"。改进落点：DSH 派发时对评审类大任务拆小（每 agent 只审一个域/一批文件）或串行。

- 问题：P3 E2E spec 的 fixture 缺陷（teams-page.spec.ts 同 test 内 bob→alice 二次 login 无登出）在 P3 红灯期被"模块未实现"的失败掩盖，P5 实跑才暴露（2 failed），需 P5 后回修 spec。
  归因层面: 执行错误
  说明：P3 自检要求"红灯失败原因必须是被测模块未实现"——但 E2E spec 在 P3 期未实跑（页面未实现），fixture 逻辑缺陷（如二次 login）只有实跑才暴露。改进：E2E spec 的 fixture 层（login/登出/数据准备）在 P3 期就应可用独立于页面实现的机制自检（如单测 fixture helper）。

- 问题：P2-design 报告 SCOPE+（detail 标签三态 + raw team 字段）时，P1 基线增补走 BASELINE_CHANGE 流程（主 Agent 批准 + 标注），但 BDD 重排（35→44）导致后续阶段引用编号需全文同步，P3/P4/P6 引用旧编号易错位。
  归因层面: 执行错误
  说明：P1 rev1 重排编号时已全文同步，但 P2/P3 各自引用时仍出现对旧编号的引用（如 P2 引用 BDD-37 实为修订后不同条）——教训：BDD 重排后各阶段引用应 grep 旧编号残留确认清零。

## 四、改进措施

- 派发纪律（DSH/agate 通用）：评审类 subagent 任务粒度 = 一域一 agent（backend/frontend/security 各一），且一次只并行 ≤2 个大任务；大任务失败先看 progress 判断半途点，用 send_message 复用原 agent 续跑（保留已读上下文）而非重新派发
  → 落点：项目 AGENTS.md 派发约定 + 本复盘（用户已提示）
- E2E spec 编写规范：P3 写 E2E 时 fixture 层（多账号切换/登出）用独立 helper + 单元测试锁定；spec 内避免同 test 跨账号二次 login 未登出
  → 落点：project.md / P3 dispatch-context 模板加"E2E fixture 自检"要求
- BDD 编号变更协议：任何 BDD 增删/重排后，主 Agent 跑 grep 确认 P1-P6 产出无旧编号引用残留（`grep -rn "BDD-3[5-9]\|BDD-4[0-4]"` 对照）
  → 落点：主 Agent orchestrator 流程自检项

## 技术债登记核对清单

| 机制 | 应该触发？ | 实际触发？ | 未触发后果 | 原因 |
|------|-----------|-----------|-----------|------|
| retry 记录 | 是（P2 双评审/P4 三评审多轮） | ✅ | — | |
| PAUSED | 否 | — | | |
| PROD_TOUCHED | 否 | ✅（全程 [PROD_NOT_TOUCHED]） | | |
| SCOPE+ | 是（P2 发现 3 处） | ✅（P2-design 标 + 主 Agent 裁定） | | |
| SCOPE_RESOLVED | 是（3 项裁定后） | ✅（P1 回写 3 条） | | |
| DESIGN_GAP | 是（P4 实现 8 处自主决策） | ✅（backend 3 + frontend 5） | | |
| DESIGN_GAP_REVIEWED | 是 | ✅（P7 8/8 配对） | | |
| NEED_CONFIRM | 否 | — | | |
| CAPABILITY_GAP | 否 | — | | |
| gate 验证（每阶段） | 是 | ✅（P0-P8 全跑） | | |
| 阶段产出文件（每阶段） | 是 | ✅ | | |
| .state.yaml phase 同步 | 是 | ✅ | | |
| 裁剪条件 + override | 否（全走无裁剪） | — | | |
| capability_requirements | 是 | ✅（browser-vision 等 4 项 available） | | |
| 分阶段落盘（防 subagent 空返回） | 是 | ✅（多数批落盘，P4 评审首轮半途即因无产出暴露） | | |
| phase-产出一致性 | 是 | ✅ | | |
| P6 evidence（含截图 + 引用 + vision YAML） | 是 | ✅（44 BDD 全证据 + 24 截图 + vision 7 份 blocker 0） | | |
| P2 候选方案 + 权衡（≥2） | 是 | ✅（候选 A/B） | | |
| P8 internal_only_reason | 否（未裁 P8） | — | | |
| dispatch-context.md | 是 | ✅（每阶段每个 subagent 都有） | | |
| pre-commit hook（gate / 状态转移 / 裁剪） | 是 | ✅ | | |
| CI backstop | —（未 push，本地全链） | — | | |
| **技术债登记** | 是 | ✅ known-failures ×3（debt/ 未建独立 DEBT——均为已登记 known-failures）+ DEBT0006 关联核对（backup merge 不拷 teams 记 backlog #48 附注） | | |

## agate 反馈

（feedback_ready: false——待主 Agent 确认复盘内容后置 true 供提取）
