# P1 Dispatch Context — Analyst

## 目标
建立 T082 架构重构的需求基线。这是一次**纯重构任务**——不改行为，只改结构。BDD 验收条件的核心是"重构前后行为完全一致"（零回归），而非"新增了什么功能"。

## 约束
- 不加新功能，不改 API 契约（错误格式统一化除外——这本身是修 bug）
- 不改数据库 schema
- 不改 MCP server
- 现有 971 条测试必须全绿——这是重构的安全网
- 后端先改（DI 统一 → 去重 → 错误格式 → 事务），前端后改（store 拆分 → component 拆分）
- EntryDetailView 拆分后主组件 < 300 行，子组件各 < 200 行
- store 拆分后每个 store < 150 行

## 上游关联
- P0-brief.md：6 项结构性问题 + 约束 + 已知风险 + BDD 预览
- 三路 subagent 架构审计结果（本对话中产出）

## 输入文件
1. docs/tasks/T082-arch-refactor/P0-brief.md — 任务简报（必读）
2. AGENTS.md — 项目约定、铁律、架构描述
3. backend/peekview/api/entries.py — DI 模式 A（Depends + fallback）、重复代码、HTTPException 混用
4. backend/peekview/api/files.py — DI 模式 C（路由内手建 StorageManager + Session）、重复代码
5. backend/peekview/auth.py — DI 模式（路由内 new ApiKeyService）、_looks_like_jwt 第 3 份
6. backend/peekview/main.py — app.state 初始化、PeekError handler、HTTPException 残留
7. backend/peekview/exceptions.py — PeekError 层级定义
8. backend/peekview/services/entry_service.py — create_entry 事务问题（line 229 commit 先于文件写入）、跨 service new 实例（line 999/1022）
9. backend/peekview/services/admin_service.py — 跨 service new EntryService（line 226/275）
10. frontend-v3/src/stores/entry.ts — 223 行过载 store（list + detail + UI 状态混在一起）
11. frontend-v3/src/views/EntryDetailView.vue — 1003 行 god component

## 客观查证信息（主 Agent 已查证，不用重复查）

### 后端 DI 三种模式
- **模式 A**：`Depends(_get_service)` → `get_entry_service(app)` 带 fallback new（entries.py:33-35, files.py:167-169, apikeys.py）
- **模式 B**：直接 `request.app.state.*`（admin.py, shares.py, read_tracking.py）
- **模式 C**：路由内手建 `StorageManager(config=config)` + `Session(engine)`（files.py:237, 287, 372, 424）
- **跨 service new**：AdminService→EntryService（admin_service.py:226,275）、EntryService→ReadTrackingService（entry_service.py:999）、EntryService→ShareService（entry_service.py:1022）、auth.py→ApiKeyService（auth.py:185）、files.py→ShareService（files.py:219）

### 重复代码
- `_looks_like_jwt()`：entries.py:102-105, files.py:140-142, auth.py:193-195（3 份完全相同）
- `_is_global_api_key_auth()`：entries.py:108-128, files.py:145-164（2 份完全相同）
- `_record_read_async()`：entries.py:47-66, files.py:30-49（2 份完全相同）

### HTTPException 残留
- entries.py:205 — `raise HTTPException(status_code=422, detail="Invalid status value...")` 
- admin.py:57 — `raise HTTPException(status_code=400, detail=str(e))`
- auth.py:208, 240, 261, 266 — 4 处 HTTPException
- main.py:535, 580 — 2 处 HTTPException（基础设施层，可能保留）

### create_entry 事务问题
- entry_service.py:229 — `session.commit()` 先于文件写入
- line 277 — 第二次 commit（文件记录）
- line 296-302 — 文件写入失败时 rollback + 删已写文件，但 entry row 已在 line 229 commit，无法回滚
- 结果：文件写入失败 → 脏 entry（无文件）残留

### 前端 store 过载
- entry.ts 223 行，同时管理：list 状态（entries/page/perPage/total/ownerFound）+ detail 状态（currentEntry/activeFile/fileContent）+ UI 状态（wrapEnabled/loading/error）
- loadSeq 变量是模块级（line 7），用于防竞态——拆分时需确认归属

### 前端 god component
- EntryDetailView.vue 1003 行：335 行模板 + 473 行脚本 + 195 行样式
- 管理 20+ ref、15+ computed、15+ 函数、4 watcher
- 职责：zen mode、file tree toggle、TOC toggle、share dialog、delete confirm、expires-in dialog、login dialog、responsive layout、overflow menu、copy/download/pack、scroll-to-heading、resize、meta-tags-bar scroll hide、share watermark

## 特别注意（重构任务的 BDD 设计）

重构任务的 BDD 不是"新功能能用"，而是"现有行为不变"。BDD 应这样设计：
1. **行为保持类**：Given 某操作，When 重构后执行，Then 结果与重构前完全一致
2. **结构改善类**：Given 搜索某重复代码，When 全局查找，Then 只存在 1 份定义
3. **bug 修复类**（create_entry 事务 + 错误格式）：Given 异常路径，When 触发，Then 无脏数据 / 返回统一格式

注意：错误格式统一化是唯一有行为变更的部分——HTTPException 返回 `{"detail":"..."}` 改为 PeekError 返回 `{"error":{"code","message","details"}}`。前端是否依赖 `detail` 字段需要检查。

## 裁剪倾向
P1 不可裁。后续阶段裁剪在 P1 声明。

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P1

路径：phase-cards/P1-requirements.md
---
# P1 — 需求基线

> 当前状态：[首次 / 重试 #N]
> P1 不可裁剪（核心阶段）

## 如果是首次进入本阶段

1. 派发 analyst subagent → 产出 P1-requirements.md
   1.1 写 P1-dispatch-context-analyst.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 主 Agent 确认：BDD 验收条件 ≥1 条 + 无未决 NEED_CONFIRM
2.5 派发 requirements-review subagent（角色文件：{agate_root}/assets/review-roles/requirements-review.md）
     2.5.1 写 P1-dispatch-context-requirements-review.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
    输入：P1-requirements.md
    产出：P1-review.md（agent≠main，含 BDD 编号引用 + 覆盖维度标注）
    review 不通过 → analyst 修改 → 再 review → … → approved（⑩迭代循环）
3. 预跑 check-gate.sh P1（exit 2，主 Agent 自判）
4. 更新 .state.yaml phase=P1 → P2

## 如果是重试

确认上一轮失败原因（BDD 不完整 / domains 声明错 / NEED_CONFIRM 未处理）
→ review 不通过时：analyst 修改需求 → 重派 requirements-review → 共享 retry 预算
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P1 MAX=3）

## 前置条件

- [ ] P0-brief.md 完成（四字段齐全）

## 派发

- **角色**：analyst（`{agate_root}/assets/execution-roles/analyst.md`）
- **输入**：P0-brief.md（env_constraints / known_risks / executor_env）
- **输出**：P1-requirements.md
- **派发 prompt 模板**：`{agate_root}/assets/templates/dispatch-prompt.md`

## 产出规格

P1-requirements.md 必须包含：
- BDD 验收条件（至少 1 条，Given/When/Then 格式）
- `domains:` 声明（backend / frontend / mcp / security）
- `packages:` 声明（受影响的包/模块）
- `risk_level:` 声明（low / medium / high）→ 决定 P2 评审强度
- `phases:` 裁剪声明（跳过哪些阶段 + 理由）
- `capability_requirements:` 能力需求声明（available / supplementable / GAP 三态）
- 无未决 `[NEED_CONFIRM]`（有则 PAUSED）；无待确认项时写 `[NO_NEED_CONFIRM]`

## gate 规则

check-gate.sh P1 → P1-review.md 存在 + status:approved + agent≠main + 含 BDD 编号锚点 → exit 2（BDD 编号格式为 `#### BDD-NN:`）；缺 P1-review.md / agent=main / 无锚点 → exit 1
P1 评审不可裁——所有任务都走独立 requirements-review，无例外

## 推进条件

- [ ] P1-requirements.md 含 BDD ≥1 条
- [ ] domains / packages / risk_level / phases 已声明
- [ ] 无 [NEED_CONFIRM] 标记
- [ ] 无 status: GAP（supplementable 不阻，GAP 阻）

## 常见错误

1. **BDD 写成技术实现而非用户行为**：BDD 应该描述"用户能看到什么/系统应该做什么"，不是"调用哪个 API"
2. **domains 声明不全**：漏了某个受影响域 → P2 不派该域的评审 → 实现方向错误
3. **capability_requirements 漏声明**：P6 验收时才发现需要但不可用的能力 → 返工
4. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- P2 设计依赖 domains + risk_level 决定评审角色
- P6 验收逐条对照 P1 的 BDD（PASS/FAIL 总数必须 ≥ P1 BDD 总数）
- P7 一致性检查依赖 packages 声明做跨文件交叉核对

## 评审

P1 评审通用必有（所有任务都走 requirements-review），P2/P4 评审是 C8 域触发（见 review-mapping.md）——二者在"是否通用"上不对称，仅在"独立 subagent、agent≠main"上类比。P1 评审不可裁剪。
review 不通过 → analyst 修改需求 → 再 review（⑩迭代循环），直至 approved。

> 完成 → 读 phase-cards/P2-design.md
<!-- AGATE_CARD_END -->
