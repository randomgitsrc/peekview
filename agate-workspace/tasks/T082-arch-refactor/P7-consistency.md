---
phase: P7
task_id: T082-arch-refactor
type: consistency
parent: P6-acceptance.md
trace_id: T082-P7-20260730
status: draft
created: 2026-07-30
agent: consistency-reviewer
---

# P7 一致性检查 — T082 架构重构

## 1. DESIGN_GAP 配对

P4-implementation-backend.md 声明 2 条 DESIGN_GAP，P4-implementation-frontend.md 声明 1 条 DESIGN_GAP（末尾重复声明为 REVIEWED 标记，内容相同）。逐条转抄 + REVIEWED 判定如下。

### GAP-1: get_entry_service 删除但测试引用

**原始标记（P4-implementation-backend.md:92）**：
> [DESIGN_GAP: P2 指定删除 `get_entry_service` 但未提及现有测试 `test_get_entry_service_from_app_state`。此测试直接调用了已删除的函数。已将其更新为通过 `app.state.entry_service` 访问，反映新 DI 模式。]

**审查**：
- P2§R1 明确要求删除 `get_entry_service` 函数（P2-design.md:133），grep 确认仅被 entries.py:35 和 files.py:169 的 `_get_service` 调用
- P2 未提及 `test_get_entry_service_from_app_state` 测试——这是设计盲区，implementer 自主决策更新测试为 `app.state.entry_service` 访问
- 决策合理：测试更新的方向与 R1 DI 统一目标完全一致（从 `get_entry_service(app)` → `app.state.entry_service`），不改变测试验证的语义
- 无需回 P2 补充设计

[DESIGN_GAP_REVIEWED: 已确认] — GAP-1 决策合理，测试更新方向与 P2§R1 设计目标一致。

### GAP-2: 旧测试文件 detail→error.message 更新

**原始标记（P4-implementation-backend.md:94）**：
> [DESIGN_GAP: P2 未提及更新旧格式测试文件。R3 错误格式统一后，3 个旧测试文件（test_admin_user_api.py、test_auth_me.py、test_entry_service.py）使用 `["detail"]` 读取错误响应，与新 `["error"]["message"]` 格式不兼容。已更新为读取 `["error"]["message"]`/`["error"]["code"]`。]

**审查**：
- P2§R3 设计目标是将 API 路由 HTTPException → PeekError，响应格式从 `{"detail":"..."}` → `{"error":{"code","message","details"}}`（P2-design.md:210）
- P2 files_to_read 列出了测试参照文件（P2-design.md:897-902），但未明确提及旧测试文件的 `detail` → `error.message` 读取路径更新
- 3 个旧测试文件的更新是 R3 错误格式统一的必要同步——不更新会导致测试失败（断言读取 `["detail"]` 但后端返回 `["error"]["message"]`）
- 决策合理：测试更新是 R3 的直接后果，implementer 只是执行了 P2 未显式列出但隐含必需的同步工作
- 无需回 P2 补充设计

[DESIGN_GAP_REVIEWED: 已确认] — GAP-2 决策合理，旧测试文件更新是 P2§R3 错误格式统一的必要同步。

### GAP-3: STORES_DIR 路径修复

**原始标记（P4-implementation-frontend.md:34）**：
> [DESIGN_GAP: P3 测试文件 t082-store-split.spec.ts 中 `STORES_DIR = resolve(__dirname, '..')` 路径错误（多了一级 `..`），导致查找 `src/entryList.ts` 而非 `src/stores/entryList.ts`。已修正为 `resolve(__dirname, '..', 'stores')`，与 t082-error-format.spec.ts 的路径模式一致。这是路径变量修复，非测试断言修改。]

**审查**：
- P2§R5 设计了 store 拆分为 `stores/entryList.ts` + `stores/entryDetail.ts`（P2-design.md:370-372）
- P3 测试文件中的路径变量错误是 P3 阶段引入的 bug（路径多了一级 `..`），P4 implementer 在实现过程中发现并修正
- 修正方向正确：`resolve(__dirname, '..', 'stores')` 指向 `src/stores/` 目录，与 P2 设计的文件位置一致
- 修复是路径变量修正，非测试断言修改——不影响 BDD 验收的语义
- 无需回 P2 补充设计

[DESIGN_GAP_REVIEWED: 已确认] — GAP-3 决策合理，路径修复使测试文件指向 P2§R5 设计的 store 文件位置。

## 2. SCOPE+ 闭环

P1-requirements.md 无 [SCOPE+] 标记（grep 确认）。P2-design.md 无 [SCOPE+] 标记。无范围增补，无需检查闭环。

## 3. 跨文件一致性

### 3.1 P2§packages vs P4§impl-path

| 检查项 | P2 声明 | P4 实现 | 结论 |
|--------|---------|---------|------|
| packages | `[backend, frontend]`（P2-design.md:17-19） | P4-backend `implementation_dir: backend/peekview/`；P4-frontend `implementation_dir: frontend-v3/src/` | 一致 |
| backend 范围 | DI/去重/错误格式/事务修复 | R1-R4 全部实现（见 P4-backend 改动清单） | 一致 |
| frontend 范围 | store 拆分/component 拆分/错误格式兼容 | R5-R7 全部实现（见 P4-frontend 产出文件） | 一致 |

### 3.2 P1 BDD 数 vs P6 PASS 数

| 检查项 | P1 | P6 | 结论 |
|--------|----|----|------|
| BDD 总数 | 41 条（BDD-1 ~ BDD-41，grep 确认） | PASS: 41, FAIL: 0 | 一致 |
| BDD 二值规则 | 全部可二值判定（P1§7 自检通过） | 41 条全 PASS，无中间态（无"调整/跳过/覆盖"作为验收状态） | 合规 |

### 3.3 P2§gate_commands vs P5 执行命令

| P2 gate_commands | P5 执行命令 | exit code | 结论 |
|-------------------|-------------|-----------|------|
| `make test-quick` (P5) | `make test-quick` | 0 (985 passed) | 一致 |
| `make test-frontend` (P5_frontend) | `make test-frontend` | 0 (1078 passed) | 一致 |
| `make typecheck` (P5_typecheck) | `make typecheck` | 0 | 一致 |
| `make lint` (P5_lint) | `make lint` | 0 | 一致 |

P5 执行的 4 个命令与 P2§gate_commands 声明完全一致，无命令替换或降级。

### 3.4 P4§impl-path vs P2§方案设计

逐项对照 P2 七项重构方案（R1~R7）与 P4 实现记录：

| 重构项 | P2 方案设计要点 | P4 实现 | 结论 |
|--------|-----------------|---------|------|
| R1 DI 统一 | 统一为 app.state.* + 构造注入；删除 get_entry_service；files.py 走 service 层 | entries.py/files.py 移除 Depends；EntryService/AdminService 构造注入；main.py 初始化传入实例；auth.py 用 app.state.apikey_service；get_entry_service 已删除；files.py 新增 6 个 service 方法 | 一致 |
| R2 去重 | 新建 api/_shared.py，3 函数去重 | _shared.py 已创建，3 函数全局唯一（grep 确认 _looks_like_jwt 仅 1 份定义） | 一致 |
| R3 错误格式 | 7 处 HTTPException → PeekError 子类；新增 ParameterValidationError/LastAdminError/InvalidPasswordError；PeekError 基类加 details | api/ 目录 HTTPException 零匹配；3 个新子类已创建；peek_error_handler 输出 details | 一致 |
| R4 事务修复 | commit→flush，单次 commit | entry_service.py 中 `session.flush()` 已替换原 `session.commit()`（grep 确认） | 一致 |
| R5 store 拆分 | 2-store 拆分（entryList.ts + entryDetail.ts），跨 store 用 Pinia action 内引用 | entryList.ts (99 行) + entryDetail.ts (132 行) 已创建，均 < 150 行；toggleVisibility/deleteEntry 跨 store 协调通过 action 内 useEntryDetailStore() | 一致 |
| R6 component 拆分 | 5 子组件 + 2 composable，主组件 < 300 行 | 5 子组件已创建（Header/Banners/Content/MobileBar/Dialogs），主组件 236 行 < 300 | 基本一致（见 §4 DEVIATION-1） |
| R7 错误格式兼容 | 3 组件 .detail → .error.message | 3 组件均已更新（grep 确认 error?.message 存在） | 一致 |

### 3.5 P2§不改清单 vs P4 实现

| P2 不改项 | P4 是否遵守 | 结论 |
|-----------|-------------|------|
| main.py 基础设施层 HTTPException 保留 | P6 证据：main.py 保留 2 处（metrics 404 + catch-all 404） | 一致 |
| 不改 MCP server | P4 无 packages/mcp-server/ 改动 | 一致 |
| 不改 CLI | P4 无 cli.py 改动 | 一致 |
| 不改数据库 schema | P4 无 schema 变更 | 一致 |
| 不改 share cookie 逻辑 | P4 未触碰 _check_share_cookies | 一致 |
| 不改 _build_sibling_data | P4 未触碰 | 一致 |
| 不改 loadSeq 竞态防护机制 | P4 仅迁移到 entryList.ts，逻辑不变 | 一致 |

## 4. 偏差记录

### DEVIATION-1: P4 前端 composable 数量超出 P2 设计

**P2 设计**（P2-design.md:518）：5 子组件 + 2 composable（useZenMode.ts + useResponsiveLayout.ts）

**P4 实现**（P4-implementation-frontend.md:44-48）：5 子组件 + 4 composable（useZenMode.ts + useResponsiveLayout.ts + useEntryDetailComputed.ts + useEntryDetailActions.ts）

**判定**：[EXTENSION] — implementer 额外抽取了 2 个 composable（useEntryDetailComputed 封装计算属性，useEntryDetailActions 封装操作逻辑），超出 P2 设计的 2 composable。这是合理的实现扩展——P2 设计的 composable 数量是预估，实际实现中发现计算属性和操作逻辑也需要抽取才能满足主组件 < 300 行约束。主组件 236 行 < 300，子组件均 < 200 行，行数约束全部满足。不影响 P1 BDD 验收条件，不改变行为。

### DEVIATION-2: P6 BDD-22~38 验证方式

**P2 建议**（P2-design.md:36）：P6 仍需 Playwright 验证行为零回归（BDD-22~38）

**P6 实际**：BDD-22~38 通过 vitest 单元测试（.spec.ts 文件）验证，未使用 Playwright

**判定**：[DEVIATION] — P2 建议 P6 用 Playwright 验证 BDD-22~38 的行为零回归，但 P6 实际通过 vitest 单元测试验证。P1 BDD 条件本身描述的是行为效果（如"进入 zen mode"、"file tree 切换开/关"），未强制要求 Playwright 作为唯一验证手段。vitest 单元测试覆盖了对应的行为逻辑（zen-shortcut.spec.ts、FileTree.spec.ts、TocNav.spec.ts 等），前端 1078 passed 全绿。此偏差涉及 P2 建议但非 P1 BDD 强制要求，标 [DEVIATION] 不阻塞。如果主 Agent 认为 Playwright E2E 验证是必要的，可在 P8 前补充。

## 5. 未决项清零

| 检查项 | 结果 |
|--------|------|
| [NEED_CONFIRM] 残留 | 无（grep P1-P6 产出文件，仅 dispatch-context 文件中引用此标记名作为检查规则描述） |
| BLOCKER 残留 | 无（同上） |
| DEVIATION-CRITICAL 残留 | 无（同上） |
| [NO_NEED_CONFIRM] 存在 | 是（P1-requirements.md:290 行首声明） |

## 6. 双向一致性总结

### 方向 1（设计→实现）

P2 七项重构方案 R1~R7 全部在 P4 中落地。实现路径与方案设计吻合，无核心设计目标未落地的情况。3 条 DESIGN_GAP 均为 P2 设计盲区的合理补救，已逐条 REVIEWED 确认。

### 方向 2（实现→设计）

P4 实现中无"已否决方案的僵尸需求"——P2 候选方案 B 全部被否决且未在 P4 中出现。2 条 DEVIATION（composable 数量扩展 + P6 验证方式）均为非核心偏差，不影响 P1 BDD 验收条件。无 DEVIATION-CRITICAL。

## 7. 结论

- 3 条 DESIGN_GAP 全部 [DESIGN_GAP_REVIEWED: 已确认]
- 0 BLOCKER
- 0 DEVIATION-CRITICAL
- 2 [DEVIATION]（非阻塞）+ 1 [EXTENSION]（合理扩展）
- 跨文件一致性检查全部通过
- P7 gate 通过
