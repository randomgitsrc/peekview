---
phase: P2
task_id: T082-arch-refactor
type: review
parent: P2-design.md
trace_id: T082-P2-20260730
status: approved
created: 2026-07-30
agent: review-lead
---

# P2 评审汇总 — T082 架构重构

[PROD_NOT_TOUCHED]

## 1. 评审来源

| 评审文件 | 评审角色 | status | BLOCKER 残留 |
|----------|----------|--------|-------------|
| P2-review-eng.md | plan-eng-review | approved | 0 |
| P2-review-design.md | plan-design-review | approved | 0 |

两个评审均为 **approved**，无 BLOCKER 残留。按汇总规则：全票无 BLOCKER → **status: approved**。

---

## 2. 工程评审关键结论（来源：P2-review-eng.md）

### 2.1 第一轮 BLOCKER 修复验证

- **BLOCKER-1 已修复**：R3 ValidationError 状态码变更问题。P2-design.md 已改为新增 `ParameterValidationError(PeekError)` with `status_code=422`，仅用于 entries.py:205 替换点。ValidationError(400) 不动——9 处 raise 点不受影响，零回归风险。（P2-review-eng.md §"第一轮 BLOCKER 修复验证"）

### 2.2 第一轮 NON-BLOCKER 处理验证

- **NON-BLOCKER-1 已处理**：PayloadTooLargeError/SchemaMismatchError details 字段迁移登记为技术债 **TD-T082-001**，本次不迁移避免改动面扩大。
- **NON-BLOCKER-2 已处理**：R4 FTS 更新时机表述已修正为"在 `with Session` 块退出后、IntegrityError 处理之后执行"，并补充 `_update_fts_content` 内部创建独立 session。
- **NON-BLOCKER-3 已处理**：`get_entry_service` 函数处理已补充——删除死代码，grep 确认无其他调用点。

### 2.3 新发现非阻塞问题

- **NEW-NON-BLOCKER-1**（eng）：R1 "消除所有 `Depends(_get_service)`" 措辞未明确覆盖 apikeys.py:16-17,24,49,59 的 `_get_service` 模式。建议 P4 实现时澄清。
- **NEW-NON-BLOCKER-2**（eng）：entries.py 路由层 5 处 `Session(request.app.state.engine)`（line 75,262,326,342,376）未在 R1 处理范围声明。建议 P4 明确是否保留。

### 2.4 锁定决策（来源：P2-review-eng.md §"锁定决策"）

1. R3 错误格式策略：ParameterValidationError(422) 与 ValidationError(400) 并存，语义清晰
2. DI 统一方向：统一为 `request.app.state.*` 模式 B，方向正确
3. 去重位置：`api/_shared.py` 合理——API 路由层辅助函数
4. 事务修复策略：flush + 单次 commit 最小改动，正确满足 BDD-14
5. `get_entry_service` 删除：死代码移除正确
6. PeekError details 扩展：基类加 details 参数 + handler 输出 details，向后兼容
7. store 拆分策略：2-store 优于 3-store，YAGNI 正确
8. component 拆分策略：按职责拆分（5 子组件 + 2 composable），主组件 < 300 行可达
9. 实施顺序：后端 R1→R2→R3→R4，前端 R5→R6→R7，依赖链正确
10. `minimal_validation: not_needed`：合理——纯代码逻辑重构
11. files_to_read：29 个文件路径覆盖实现所需上下文，无明显遗漏
12. MCP 不受影响：MCP client 不解析 HTTP 错误响应体格式

### 2.5 测试缺口（非阻塞建议）

- **GAP-1**：R4 多文件 partial failure 测试——建议 P3 补充"多文件 entry 中第 N 个文件写入失败"场景
- **GAP-2**：R5 跨 store 协调测试——toggleVisibility/deleteEntry 跨 list+detail store 协调单测
- **GAP-3**：ParameterValidationError 422 状态码测试——P3 需覆盖 `GET /api/v1/entries?status=invalid` 返回 422

### 2.6 多方案探索评审结论

6 项重构（R1-R6）均有 ≥2 候选方案 + 权衡 + 选择理由，R7 因 follows_existing_pattern 只写 1 个（合规）。方案探索质量达标。

### 2.7 实现就绪度

files_to_read 覆盖完整，全部方案清晰度满足实现就绪度要求。数据流清晰性、状态机完整性、接口契约、错误边界均 PASS。

---

## 3. 设计评审关键结论（来源：P2-review-design.md）

### 3.1 第一轮 BLOCKER 修复验证

- **BLOCKER-2 已修复**：跨 store 协调机制。P2-design.md:375-454 现包含完整 Pinia action 内引用模式代码——`entryList.ts` 在 action 内 `useEntryDetailStore()` 获取 detail store 实例，`toggleVisibility` 含乐观更新+回滚，`deleteEntry` 含 API 调用+list 移除+detail 清理。`entryDetail.ts` 定义 `syncVisibility(slug, isPublic)` 和 `clearIfSlug(slug)` 含 slug 匹配检查。
- **BLOCKER-3 已修复**：props/emit 契约表。P2-design.md:596-707 现包含 5 子组件完整契约表（Header 15 props/5 emits、Banners 3/1、Content 17/6、MobileBar 10/4、Dialogs 7/6），无"等"字残留。

### 3.2 第一轮 WARNING 处理验证

- **WARNING-1 已处理**：storeToRefs 拆分方式明确（P2-design.md:460-467）
- **WARNING-2 已处理**：provide/inject key 和类型完整定义（P2-design.md:565-584）
- **WARNING-3 已处理**：composable 函数签名和返回值完整定义（P2-design.md:709-740）
- **WARNING-4 已处理**：drawer 状态所有权明确——留主组件 props+emit（P2-design.md:586-592）
- **WARNING-5 已处理**：aria-live 区域归属明确——留主组件（P2-design.md:584）
- **WARNING-6 已处理**：测试迁移计划已包含（P2-design.md:474-479，有遗漏见新 WARNING）

### 3.3 新发现 WARNING（不阻塞）

- **NEW-WARNING-1**（design）：测试迁移计划遗漏 `t067-detail-framework.spec.ts`（575 行，mock `@/stores/entry`）——需迁移 mock 路径
- **NEW-WARNING-2**（design）：测试迁移计划遗漏 `t031-entry-list-view.spec.ts`（141 行，mock `@/stores/entry`）——需迁移 mock 路径
- **NEW-WARNING-3**（design）：`t067-detail-framework.spec.ts:544` 使用 `wrapper.setData({ zenMode: true })`——R6 拆分后 zenMode 移至 composable+provide/inject，`wrapper.setData` 可能失效，需替代方案

### 3.4 BDD 覆盖验证

BDD-17~41 全部覆盖，包括 store 拆分（BDD-17~22）、component 拆分（BDD-23~38）、错误格式兼容（BDD-39）、测试+类型检查（BDD-40~41）。第二轮评审确认契约表补充后 BDD-25~38 行为零回归有保障。

---

## 4. NON-BLOCKER / WARNING 汇总

| # | 来源 | 类型 | 描述 | 严重性 | 建议处理时机 |
|---|------|------|------|--------|-------------|
| 1 | eng | NON-BLOCKER | R1 "消除所有"措辞未覆盖 apikeys.py Depends(_get_service) | 非阻塞 | P4 实现时澄清 |
| 2 | eng | NON-BLOCKER | entries.py 路由层 5 处 Session(request.app.state.engine) 未在 R1 声明 | 非阻塞 | P4 实现时澄清 |
| 3 | eng | 技术债 | TD-T082-001: PayloadTooLargeError/SchemaMismatchError 额外字段未迁移到 details | 技术债 | 后续单独处理 |
| 4 | eng | 测试缺口 | GAP-1: R4 多文件 partial failure 测试 | 非阻塞 | P3 补充 |
| 5 | eng | 测试缺口 | GAP-2: R5 跨 store 协调测试 | 非阻塞 | P3 补充 |
| 6 | eng | 测试缺口 | GAP-3: ParameterValidationError 422 状态码测试 | 非阻塞 | P3 补充 |
| 7 | design | WARNING | 测试迁移计划遗漏 t067-detail-framework.spec.ts | 非阻塞 | P4 补充 |
| 8 | design | WARNING | 测试迁移计划遗漏 t031-entry-list-view.spec.ts | 非阻塞 | P4 补充 |
| 9 | design | WARNING | wrapper.setData({ zenMode }) 在 composable+provide 模式下可能失效 | 非阻塞 | P4 注意替代方案 |

---

## 5. P2-design.md 四字段确认

| 字段 | 存在 | 值 |
|------|------|----|
| packages | ✓ | backend, frontend |
| domains | ✓ | backend, frontend |
| ui_affected | ✓ | false |
| gate_commands | ✓ | P5: make test-quick / P5_frontend: make test-frontend / P5_typecheck: make typecheck / P5_lint: make lint |

四字段齐全。`ui_affected: false` → 不需 P5_e2e（P6 仍需 Playwright 验证行为零回归）。

---

## 6. 候选方案确认

| 重构项 | 候选方案数 | 权衡 | 选择理由 | 合规 |
|--------|-----------|------|----------|------|
| R1 DI 统一 | 2 (A: app.state+构造注入 / B: Depends统一) | ✓ | ✓ 模式 B 已验证 | ✓ |
| R2 去重 | 2 (A: _shared.py / B: 放入 auth.py) | ✓ | ✓ 职责归属正确 | ✓ |
| R3 错误格式 | 2 (A: PeekError子类 / B: 中间件捕获) | ✓ | ✓ 显式替换更可审计 | ✓ |
| R4 事务修复 | 2 (A: flush+单次commit / B: SAVEPOINT) | ✓ | ✓ SAVEPOINT 不满足 BDD-14 | ✓ |
| R5 store 拆分 | 2 (A: 2-store / B: 3-store+composable) | ✓ | ✓ YAGNI | ✓ |
| R6 component 拆分 | 2 (A: 按职责 / B: 按区域) | ✓ | ✓ 职责拆分可独立测试 | ✓ |
| R7 前端错误兼容 | 1 (follows_existing_pattern) | N/A | N/A | ✓ 合规 |

候选方案 ≥2 + 权衡 + 选择理由全部满足（R7 因 follows_existing_pattern 只写 1 个，合规）。

---

## 7. 最终结论

**status: approved**

两个评审均为 approved，无 BLOCKER 残留。9 个 NON-BLOCKER/WARNING 均为非阻塞项（范围澄清、测试补充、技术债登记），可在 P3/P4 阶段处理。P2-design.md 四字段齐全，候选方案探索达标。方案可推进至 P3。
