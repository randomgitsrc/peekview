---
phase: P2
task_id: T082-arch-refactor
type: review
parent: P2-design.md
trace_id: T082-P2-20260730
status: approved
created: 2026-07-30
agent: plan-eng-review
---

# P2 工程评审 — T082 架构重构（第二轮，覆盖第一轮）

## 评审结论

**status: approved**

第一轮评审的 1 个 BLOCKER 已修复，3 个 NON-BLOCKER 已处理。方案整体架构方向正确，实现就绪度达标，可推进至 P3。

---

## 第一轮 BLOCKER 修复验证

### BLOCKER-1: R3 ValidationError 状态码变更 → 已修复

**第一轮问题**：设计文档声称 ValidationError 未被任何路由使用，改其 status_code 400→422 无回归风险。实际 ValidationError 被 raise 9 处（share_service.py:55,58,68,79 / entry_service.py:173,175,857 / apikey_service.py:59），改 status_code 会导致这些路径行为变更，违反"不改 API 契约"约束。

**修复确认**：P2-design.md §1 R3 候选方案 A 已修改为：
- 新增 `ParameterValidationError(PeekError)` with `status_code=422`，仅用于 entries.py:205 的 status 参数验证替换点
- ValidationError（`status_code=400`）**不动**——设计文档明文列出 9 处 raise 点，并声明"改 ValidationError.status_code 会导致这些路径行为变更，违反'不改 API 契约'约束"
- ParameterValidationError 不追溯已有 ValidationError 调用点——零回归风险

**源码交叉验证**：
- `exceptions.py:33` 确认 `ValidationError.status_code = 400`（当前值，设计文档不改）
- grep 确认 9 处 ValidationError raise（share_service.py:55,58,68,79 / entry_service.py:173,175,857 / apikey_service.py:59）——与设计文档列出的位置一致
- `entries.py:205` 确认当前 `HTTPException(status_code=422, detail=...)` ——替换目标正确

**结论**：BLOCKER-1 **已修复**。ParameterValidationError(422) 与 ValidationError(400) 并存，语义清晰：422 用于请求参数验证（query/param），400 用于业务逻辑验证（service 层）。

---

## 第一轮 NON-BLOCKER 处理验证

### NON-BLOCKER-1: PayloadTooLargeError/SchemaMismatchError details 字段 → 已处理（技术债）

**第一轮问题**：PeekError 基类加 details 字段后，PayloadTooLargeError（携带 limit_type/max_bytes/actual_bytes）和 SchemaMismatchError（携带 missing_columns）的额外信息仍不会被 handler 输出。

**修复确认**：P2-design.md R3 已补充：
- 明文记录为技术债 **TD-T082-001**
- 说明 PayloadTooLargeError.__init__ 和 SchemaMismatchError.__init__ 调 `super().__init__(message)` 不传 details，默认 None，向后兼容
- 本次重构不迁移这些字段到 details（避免改动面扩大），后续单独处理

**源码交叉验证**：
- `exceptions.py:87-97` 确认 PayloadTooLargeError.__init__ 携带 limit_type/max_bytes/actual_bytes，调 `super().__init__(message)`
- `exceptions.py:206-215` 确认 SchemaMismatchError.__init__ 携带 missing_columns，调 `super().__init__(message)`
- `main.py:490` 确认 handler 当前硬编码 `details: None`

**结论**：已处理。技术债登记合理，不影响本次重构的正确性。

### NON-BLOCKER-2: R4 FTS 更新时机表述 → 已处理

**第一轮问题**：设计文档"FTS 更新仍在所有 commit 成功后执行"表述不精确——FTS 更新在 `with Session` 块退出后执行，不在 commit 之后立即执行。

**修复确认**：P2-design.md R4 已修正表述为：
> "FTS 更新在 create_entry 的 `with Session` 块退出后、IntegrityError 处理之后执行，方案 A 不改变此时机——FTS 更新仍在 `with Session` 块退出后执行，不受 flush→commit 改动影响。"

并补充说明 `_update_fts_content` 内部创建自己的 `with Session(self.engine) as session`，不依赖外层 session。

**源码交叉验证**：
- `entry_service.py:90` 确认 `_update_fts_content` 内部 `with Session(self.engine) as session`（独立 session）
- `entry_service.py:325` 确认 `_update_fts_content(entry_id)` 在 `with Session` 块退出后（line 226-323）+ IntegrityError 处理（line 304-323）之后执行

**结论**：已处理。表述精确，implementer 不会误解。

### NON-BLOCKER-3: get_entry_service fallback 移除声明 → 已处理

**第一轮问题**：设计文档未明确 `get_entry_service`（entry_service.py:51-74）函数本身的处理方式。

**修复确认**：P2-design.md R1 已补充"get_entry_service 函数处理"段：
> "R1 移除 `Depends(_get_service)` 后，`get_entry_service` 不再被调用。**删除 `get_entry_service` 函数**（entry_service.py:51-74）——它是死代码，无其他调用点（grep 确认仅被 entries.py:35 和 files.py:169 的 `_get_service` 调用，两者均移除）。"

**源码交叉验证**：
- grep 确认 `get_entry_service` 仅被 entries.py:26(import)+35(call) 和 files.py:19(import)+169(call) 引用
- 两处调用均在 `_get_service` 内，R1 移除 `_get_service` 后无其他调用点

**结论**：已处理。删除死代码的决策正确。

---

## 新引入问题检查（非阻塞）

### NEW-NON-BLOCKER-1: R1 范围未明确覆盖 apikeys.py 的 Depends(_get_service)

**位置**：P2-design.md §1 R1 候选方案 A

**问题**：R1 声明"消除所有 `Depends(_get_service)`"，但具体改动列表只提到 entries.py 的 `Depends(_get_service)`，未提到 apikeys.py:16-17,24,49,59 的 `_get_service` + `Depends(_get_service)` 模式。

**源码查证**：
- `apikeys.py:16-17` 定义 `_get_service` 调用 `get_apikey_service(request.app)`
- `apikeys.py:24,49,59` 使用 `Depends(_get_service)`
- P0-brief 将 apikeys 列为模式 A（Depends+fallback）

**影响**：非阻塞。BDD-1/BDD-2 的范围限定为 files.py，不涉及 apikeys.py。但 R1 的"消除所有"措辞可能让 implementer 困惑是否需要处理 apikeys.py。

**建议**：P4 实现时，implementer 应明确 apikeys.py 的 `Depends(_get_service)` 是否一并移除。如不移除，应在 R1 方案中补充"apikeys.py 保留 Depends 模式"的声明；如移除，应补充 apikeys.py 的改动步骤。

### NEW-NON-BLOCKER-2: entries.py 路由内 Session(request.app.state.engine) 未在 R1 处理

**位置**：P2-design.md §1 R1 候选方案 A

**问题**：entries.py 在 `_check_share_cookie`（line 75）、share access 路由（line 262,326,342,376）中直接使用 `Session(request.app.state.engine)`。R1 仅处理 files.py 的路由内 `Session(engine)`，未提及 entries.py 的这些直接 Session 使用。

**源码查证**：
- entries.py:75,262,326,342,376 共 5 处 `Session(request.app.state.engine)` 在路由层
- P0-brief 模式 C 定义为"files.py 4 处 StorageManager + Session"——entries.py 不在模式 C 范围
- BDD-2 范围限定为"files.py 中的任意路由"

**影响**：非阻塞。entries.py 的 Session 使用已是模式 B 风格（`request.app.state.engine`），不是 P0-brief 所述的模式 C（`get_engine(config)` + `StorageManager`）。设计文档"不改什么"已声明不改 `_check_share_cookie`，但 line 262/326/342/376 的其他 Session 使用未明确排除。

**建议**：P4 实现时明确 entries.py 路由层 Session 使用的处理范围。如不改，在 R1 补充"entries.py 路由层 Session 保留"声明。

---

## MCP 错误格式影响（第一轮顾虑消除）

第一轮评审提到"MCP client 如果解析错误响应体可能受影响"。本轮验证：

**源码查证**：grep `packages/mcp-server/src` 无 `response.data.detail` 或 `response.data.error` 解析逻辑。MCP client 的 HTTP 错误处理不解析响应体格式（依赖 HTTP 状态码 + axios 抛异常），不受 R3 错误格式变更影响。

**结论**：MCP 不受影响，P0 约束"不改 MCP server"成立。

---

## 架构问题（阻塞级）

无。

---

## 架构问题（非阻塞）

- **NEW-NON-BLOCKER-1**：R1 范围未明确覆盖 apikeys.py 的 `Depends(_get_service)`——措辞"消除所有"与具体改动列表不一致。建议 P4 实现时澄清。
- **NEW-NON-BLOCKER-2**：entries.py 路由层 `Session(request.app.state.engine)` 未在 R1 处理范围声明——BDD 范围外但需明确。建议 P4 实现时澄清。
- **TD-T082-001**：PayloadTooLargeError/SchemaMismatchError 额外字段未迁移到 details（已登记技术债，后续处理）。

---

## 测试缺口

### GAP-1: R4 多文件 partial failure 测试（第一轮保留）

BDD-14 覆盖"文件写入失败 → entry 回滚"，建议 P3 补充"多文件 entry 中第 N 个文件写入失败"场景。

### GAP-2: R5 跨 store 协调测试（第一轮保留）

toggleVisibility/deleteEntry 跨 list+detail store 协调的单测，建议 P3 补充。

### GAP-3: ParameterValidationError 422 状态码测试（新增）

R3 新增 ParameterValidationError(422)，P3 需覆盖 `GET /api/v1/entries?status=invalid` 返回 422 + `error.code=PARAMETER_VALIDATION_ERROR`。

---

## 锁定决策

1. **R3 错误格式策略**：ParameterValidationError(422) 用于请求参数验证，ValidationError(400) 不动用于业务逻辑验证——两者并存，语义清晰，零回归风险。
2. **DI 统一方向**：统一为 `request.app.state.*` 模式（模式 B），消除 `Depends(_get_service)` 和路由内手建——方向正确。
3. **去重位置**：`api/_shared.py` 是合理选择——API 路由层辅助函数，不属于 service 层。
4. **事务修复策略**：flush + 单次 commit 是最小改动方案，正确满足 BDD-14。
5. **get_entry_service 删除**：死代码移除，正确。
6. **PeekError details 扩展**：基类加 details 参数 + handler 输出 details，向后兼容已有子类。PayloadTooLargeError/SchemaMismatchError 额外字段记录为 TD-T082-001。
7. **store 拆分策略**：2-store 拆分（list + detail）优于 3-store，YAGNI 原则正确。
8. **component 拆分策略**：按职责拆分（5 子组件 + 2 composable）优于按区域拆分，主组件 < 300 行目标可达。
9. **实施顺序**：后端 R1→R2→R3→R4，前端 R5→R6→R7——依赖链正确。
10. **minimal_validation: not_needed**：合理——纯代码逻辑重构。
11. **files_to_read**：29 个文件路径覆盖实现所需上下文，无明显遗漏。
12. **MCP 不受影响**：MCP client 不解析 HTTP 错误响应体格式。

---

## 多方案探索评审

| 重构项 | 候选方案数 | 权衡充分性 | 选择理由自洽 | 结论 |
|--------|-----------|------------|-------------|------|
| R1 DI 统一 | 2 (A: app.state+构造注入 / B: Depends统一) | 充分 | 自洽——模式 B 已验证，Depends 是无意义间接 | PASS |
| R2 去重 | 2 (A: _shared.py / B: 放入 auth.py) | 充分 | 自洽——职责归属正确 | PASS |
| R3 错误格式 | 2 (A: PeekError子类 / B: 中间件捕获) | 充分 | 自洽——显式替换比隐式中间件更可审计；BLOCKER-1 修复后方案 A 细节正确 | PASS |
| R4 事务修复 | 2 (A: flush+单次commit / B: SAVEPOINT) | 充分 | 自洽——SAVEPOINT 不满足 BDD-14 | PASS |
| R5 store 拆分 | 2 (A: 2-store / B: 3-store+composable) | 充分 | 自洽——YAGNI，2-store 已满足约束 | PASS |
| R6 component 拆分 | 2 (A: 按职责 / B: 按区域) | 充分 | 自洽——职责拆分可独立测试 | PASS |
| R7 前端错误兼容 | 1 (无候选) | 合理——follows_existing_pattern，改动 3 行 | N/A | PASS |

**结论**：6 项重构均有 ≥2 候选方案 + 权衡 + 选择理由（R7 因 follows_existing_pattern 只写 1 个，合规）。方案探索质量达标。

---

## 实现就绪度评审

### files_to_read 覆盖性

| 重构项 | files_to_read 覆盖 | 遗漏 | 结论 |
|--------|-------------------|------|------|
| R1 | main.py:200-225, admin.py, entries.py, files.py, auth.py, entry_service.py, admin_service.py | apikeys.py 未列入（如 R1 决定处理） | PASS（如不处理 apikeys.py） |
| R2 | entries.py, files.py, auth.py, file_service.py | 无 | PASS |
| R3 | exceptions.py, main.py:481-508, entries.py, auth.py, admin.py | 无 | PASS |
| R4 | entry_service.py:215-302 | 无 | PASS |
| R5 | entry.ts, EntryListView.vue, EntryDetailView.vue:338-388 | 无 | PASS |
| R6 | EntryDetailView.vue, ShareDialog.vue, FileTree.vue | 无 | PASS |
| R7 | ExpiresInDialog.vue, SecurityTab.vue, ProfileTab.vue | 无 | PASS |
| 测试 | conftest.py, entry.spec.ts, t031-entry-detail-view.spec.ts | 无 | PASS |

**结论**：files_to_read 覆盖实现所需上下文，无关键遗漏。

### 方案清晰度

- R1: implementer 可自主实现——路由层替换 + service 构造函数加参数 + main.py 初始化更新 + get_entry_service 删除，步骤清晰
- R2: implementer 可自主实现——新建 _shared.py + 改 import，步骤清晰
- R3: implementer 可自主实现——ParameterValidationError(422) 新增 + PeekError 基类加 details + handler 更新 + 6 处 HTTPException 替换，步骤清晰（BLOCKER-1 修复后）
- R4: implementer 可自主实现——commit→flush + 异常处理块调整 + FTS 时机不变，步骤清晰
- R5: implementer 可自主实现——2-store 拆分 + 跨域方法 Pinia action 内引用，步骤清晰
- R6: implementer 可自主实现——5 子组件 + 2 composable + 行数预估 + props/emit 契约表 + provide/inject 定义，步骤清晰
- R7: implementer 可自主实现——3 行替换

**结论**：全部方案清晰度满足实现就绪度要求。

---

## P2 最小验证评审

- `minimal_validation.result: not_needed`
- 依据：纯代码逻辑重构，无外部系统行为依赖
- **结论**：合理。本任务的 6 项重构均为项目内已有模式的复用或纯逻辑修复，不依赖浏览器行为/安全模型/外部系统行为。

---

## 数据流清晰性

### R1 DI 统一后的 service 获取链路

```
Request → route handler → request.app.state.entry_service (单例)
                              ↓
                    构造注入的 read_tracking_service / share_service (同一实例)
                              ↓
                    main.py 初始化时创建并注入
```

**结论**：链路清晰。构造注入 + fallback 兼顾单例和测试独立性。

### R3 错误格式统一后的错误流

```
Route handler → raise PeekError subclass
    → peek_error_handler (main.py:483)
    → JSONResponse(status_code=exc.status_code, {"error":{"code","message","details"}})
```

**结论**：链路清晰。ParameterValidationError(422) 与 ValidationError(400) 各自走 handler，状态码正确。

---

## 状态机完整性

### R4 事务修复后的状态转换

```
[开始] → session.add(entry) → session.flush() → [entry已flush未commit]
    → 文件写入成功 → session.commit() → [entry+files已commit] → _update_fts → [完成]
    → 文件写入失败 → 删除已写磁盘文件 + session.rollback() → [entry+files已回滚] → raise
    → IntegrityError → _find_by_idempotency_key 或 _retry_with_slug_suffix
```

**结论**：所有失败路径已处理。flush 后 rollback 能正确回滚 entry row。磁盘文件清理逻辑保留。FTS 更新在 `with Session` 块退出后执行，不受 flush→commit 影响。

---

## 接口契约

### R3 错误格式统一对 API 契约的影响

- **HTTP 状态码**：全部保持原状态码（422 保持 422，404 保持 404，409 保持 409，400 保持 400）。ParameterValidationError(422) 仅替换 entries.py:205 的 HTTPException(422)，状态码不变。ValidationError(400) 不动。
- **响应体格式**：`{"detail":"..."}` → `{"error":{"code","message","details"}}`——修 bug（统一格式），P0 约束允许
- **前端同步**：R7 更新 3 处 `.detail` → `.error.message`——覆盖完整
- **MCP server**：不改——MCP client 不解析 HTTP 错误响应体格式（源码验证）

**结论**：接口契约影响已充分分析，无遗漏。

---

## 错误边界

| 层级 | 负责方 | 处理方式 |
|------|--------|---------|
| Route handler | 路由层 | raise PeekError 子类（业务错误）或 raise HTTPException→改为 PeekError（R3） |
| Service layer | service 层 | raise PeekError 子类（业务逻辑错误） |
| peek_error_handler | main.py | 捕获所有 PeekError，返回统一格式（含 details） |
| generic_exception_handler | main.py | 捕获未处理 Exception，返回 500 |
| 文件写入失败 | entry_service.create_entry | rollback + 清理磁盘文件 + raise（冒泡到 handler） |

**结论**：错误边界清晰。R4 事务修复后，文件写入失败的错误正确冒泡到 peek_error_handler。

---

## 总结

| 评审维度 | 结论 |
|---------|------|
| 数据流清晰性 | PASS |
| 状态机完整性 | PASS |
| 接口契约 | PASS |
| 错误边界 | PASS |
| 测试策略 | PASS（3 个测试缺口为非阻塞建议） |
| 多方案探索 | PASS（6 项均有 ≥2 候选 + 权衡） |
| 实现就绪度 | PASS（files_to_read 覆盖完整，全部方案清晰） |
| P2 最小验证 | PASS（not_needed 合理） |
| BLOCKER-1 修复 | PASS（ParameterValidationError(422) 不动 ValidationError(400)） |
| NON-BLOCKER 1-3 处理 | PASS（技术债登记 + 表述修正 + 死代码删除声明） |

**阻塞问题数**：0

**结论**：第一轮 BLOCKER-1 已修复，3 个 NON-BLOCKER 已处理。2 个新发现的非阻塞范围歧义可在 P4 实现时澄清。方案可推进至 P3。
