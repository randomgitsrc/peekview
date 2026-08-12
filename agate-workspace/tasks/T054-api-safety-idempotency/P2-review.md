---
phase: P2
task_id: T054
type: review
parent: P2-design.md
trace_id: T054-P2-review-20260714
status: approved
created: 2026-07-14
agent: design-review
---

# T054 P2 Design Review

## 总评

方案整体质量高，BDD 覆盖完整，候选方案选择理由自洽。发现 **3 个必须修复项**（[MUST]）和 **4 个建议改进项**（[SHOULD]）。

---

## 1. BDD 覆盖审查

### 1.1 覆盖映射验证

逐条对照 P1 的 25 条 BDD 与 §3 映射表：

| BDD | 映射 | 判定 | 备注 |
|-----|------|------|------|
| A1 | §2.1 → config.py | ✅ | |
| A2 | §2.1 → config.py 已有机制 | ✅ | 无需改动，正确 |
| A3 | §2.1 → cli.py:141 | ✅ | |
| A4 | §2.1 → cli.py:739 | ✅ | |
| B1 | §2.2 | ✅ | |
| B2 | §2.2 | ✅ | |
| B3 | §2.2 | ⚠️ | P1 BDD-B3 写 `PUT /api/v1/entries/{slug}`，实际端点是 `PATCH`。方案 §2.2 和影响域表写 `update_entry` + `PATCH`，与代码一致。**P1 的 BDD-B3 有笔误**（PUT→PATCH），方案正确处理了实际端点，但应在 P1 勘误 |
| B4 | §2.2 | ✅ | |
| B5 | §2.2 | ✅ | |
| B6 | §2.2 | ✅ | |
| C1 | §2.3 | ✅ | |
| C2 | §2.3 | ✅ | |
| D1 | §2.4 | ✅ | |
| D2 | §2.4 | ✅ | |
| D3 | §2.4 | ✅ | |
| D4 | §2.4 | ✅ | |
| D5 | §2.4 | ✅ | key 随 entry 删除清除，正确 |
| D6 | §2.4.5 | ✅ | |
| D7 | §2.4.2 | ✅ | |
| D8 | §2.4.1 | ✅ | |
| D9 | §2.4.1 | ✅ | |
| D10 | §2.4.4 | ✅ | partial index WHERE NOT NULL |
| E1 | §2.5 | ✅ | |
| E2 | §2.5.2 | ✅ | |
| F1 | §2.6 | ✅ | |

**结论**：25/25 BDD 已覆盖。B3 的 PUT/PATCH 不一致是 P1 文档笔误，不影响实现。

---

## 2. 候选方案审查

### 2.1 方案 A vs B 权衡

方案 A（入口层幂等）选择合理，理由自洽：

1. **逻辑集中**：幂等查重 + IntegrityError catch + slug 碰撞重试全在 service 层，与现有 `_retry_with_slug_suffix` 模式一致 ✅
2. **先查优化**：命中 key 可跳过文件写入 IO ✅
3. **竞态安全**：UNIQUE 约束是最终防线，IntegrityError catch 是兜底 ✅

方案 B 的批评准确——逻辑分散到两层、API 层需重复 response 构造、竞态窗口更大。

### 2.2 [MUST] 返回类型变更的连锁影响未充分分析

方案声明 `create_entry` 返回 `tuple[CreateEntryResponse, bool]`，但未分析所有调用方：

1. **`_retry_with_slug_suffix`**（entry_service.py:786）：内部调用 `self.create_entry(...)`，当前返回 `CreateEntryResponse`。改为 tuple 后，`_retry_with_slug_suffix` 的 `return self.create_entry(...)` 会返回 `tuple`，但其签名声明返回 `CreateEntryResponse`。方案说"透传即可"但未给出具体改法——`_retry_with_slug_suffix` 在 slug 碰撞场景下永远不是幂等命中，应返回 `(response, False)` 而非直接透传 tuple。

2. **`_retry_with_slug_suffix` 被 `create_entry` 的 `except IntegrityError` 调用**（entry_service.py:296）：当前 `return self._retry_with_slug_suffix(...)` 直接返回 `CreateEntryResponse`。如果 `_retry_with_slug_suffix` 返回 `tuple`，则 `create_entry` 的 IntegrityError 分支也返回 `tuple`，与正常路径一致——但需确认 `_retry_with_slug_suffix` 内部的 `self.create_entry(...)` 调用在 slug 碰撞重试时不会误触发 idempotency 逻辑（重试时 slug 已变，但 idempotency_key 不变，如果 key 已在第一次尝试时写入 DB 则会命中幂等——但第一次尝试因 IntegrityError 回滚了，key 不应存在）。

**关键问题**：IntegrityError 触发时，session 已回滚（`except IntegrityError` 在 `with Session(self.engine)` 块外），entry 和 idempotency_key 都未持久化。`_retry_with_slug_suffix` 重试时传相同 idempotency_key，正常插入不会命中幂等。这是正确的。但方案应显式说明这一点。

**要求**：§2.4.2 需补充：
- `_retry_with_slug_suffix` 签名和返回值的具体改法
- IntegrityError 回滚后 idempotency_key 不在 DB 中的保证说明
- `_retry_with_slug_suffix` 需新增 `idempotency_key` 参数并透传

### 2.3 [MUST] `_find_by_idempotency_key` 使用独立 Session 存在事务隔离问题

方案中 `_find_by_idempotency_key` 开启独立 `Session(self.engine)` 查询。在 IntegrityError catch 路径中：

1. `create_entry` 的 `with Session(self.engine) as session` 块因 IntegrityError 退出
2. 外层 `except IntegrityError` 调用 `_find_by_idempotency_key`
3. `_find_by_idempotency_key` 开新 session 查询

问题：如果并发请求 A 和 B 同时用相同 idempotency_key 插入：
- A 先完成 insert + commit → B 触发 IntegrityError
- B 的 IntegrityError catch 中调 `_find_by_idempotency_key` → 新 session 能看到 A 已 commit 的 entry ✅

这个流程是正确的。但方案应显式说明"IntegrityError catch 中开新 session 查询是安全的，因为竞态对方的 insert 已 commit"。

**要求**：§2.4.2 补充事务隔离说明。

### 2.4 [SHOULD] 幂等命中时返回的 CreateEntryResponse 构造

方案 §2.4.2 的 `_find_by_idempotency_key` 调用 `self._build_create_response(entry, list(files), username)`。但当前代码中 **不存在** `_build_create_response` 方法（grep 确认只有 `_resolve_username`，无 `_build_create_response`）。

这意味着 P4 实现时需要新建此辅助方法，从 Entry + File 列表构造 `CreateEntryResponse`。当前 `create_entry` 方法在 line 302-311 内联构造 response，提取为辅助方法是合理的，但方案应明确声明这是新增方法而非已有方法。

**要求**：§2.4.2 明确标注 `_build_create_response` 为**新增**辅助方法，从 `create_entry` line 302-311 的内联构造提取。

---

## 3. 四字段审查

### 3.1 packages

```yaml
packages:
  - backend/peekview
  - packages/mcp-server
```

✅ 正确。与 P1 一致。

### 3.2 domains

```yaml
domains:
  - api-safety
  - idempotency
  - code-style
```

✅ 正确。与 P1 一致。

### 3.3 ui_affected

`ui_affected: false` ✅ 正确。所有改动在后端 + MCP，无前端变更。

### 3.4 gate_commands

```yaml
gate_commands:
  P5: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no"
  P5_mcp: "cd packages/mcp-server && npm test"
  P6: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no"
```

✅ 正确。P5 和 P6 都用 pytest，MCP 独立 gate。缺少 ruff lint 命令，但 AGENTS.md 要求完成后跑 ruff，可在 P5/P6 阶段手动补充。

---

## 4. files_to_read 审查

共 21 个文件路径。评估：

| 判定 | 数量 | 说明 |
|------|------|------|
| 必要 | 18 | 直接涉及改动的文件 |
| 可选 | 2 | `auth.py:16`（确认 import bcrypt）和 `exceptions.py:100-107`（确认 ConflictError 存在）——验证性读取，合理 |
| 多余 | 1 | `client.ts:86-91`——方案自己已确认"无需改动"，列入 files_to_read 价值有限 |

**结论**：合理，不过多不过少。client.ts 可移除但无害。

---

## 5. idempotency_key 并发竞态方案审查

### 5.1 竞态场景分析

| 场景 | 方案处理 | 判定 |
|------|---------|------|
| 同一用户并发相同 key | 先查未命中 → 并发 insert → 第二个触发 IntegrityError → catch 查回 → 返回 (existing, True) | ✅ |
| 不同用户并发相同 key | 先查未命中 → 并发 insert → 第二个触发 IntegrityError → catch 查回 → owner 不匹配 → 409 | ✅ |
| 先查命中（非竞态） | 直接返回 (existing, True/409) | ✅ |
| slug 碰撞 + idempotency_key 同时存在 | IntegrityError → 先查 key → 无 key 冲突 → slug 碰撞 → _retry_with_slug_suffix | ✅ |

### 5.2 [MUST] IntegrityError 不区分约束来源

SQLite 的 IntegrityError 不区分是哪个 UNIQUE 约束触发的（slug vs idempotency_key）。方案的 catch 逻辑是"先查 idempotency_key，有则处理，无则走 slug 碰撞"——这在语义上是正确的，但存在一个边界情况：

**场景**：请求带 idempotency_key=X + slug=S，S 已被另一个 entry 占用，X 不存在。
1. Insert → IntegrityError（slug 冲突）
2. Catch → 查 idempotency_key=X → 未找到
3. 走 `_retry_with_slug_suffix` → 重试 slug=S-2，带 idempotency_key=X → 成功

这个流程是正确的 ✅。但方案应在 §2.4.2 显式说明此场景，因为 IntegrityError 的"先查 key 再判断"逻辑依赖查询顺序，容易在 review 中被质疑。

**要求**：§2.4.2 补充 slug 碰撞 + idempotency_key 共存场景的说明。

---

## 6. 跨用户安全边界（409 Conflict）审查

### 6.1 方案正确性

- 先查 key → owner 不匹配 → 409 ✅
- IntegrityError catch → 查 key → owner 不匹配 → 409 ✅
- ConflictError 已存在（exceptions.py:100），status_code=409 ✅

### 6.2 [SHOULD] 409 响应体信息泄露风险

方案中 `ConflictError("idempotency_key already used by another user")` 的消息直接告知"已被其他用户使用"。这确认了 key 的存在性，但 idempotency_key 是调用方自己提供的，确认其存在不算信息泄露（调用方已知 key 值）。且不暴露是哪个用户或哪个 entry。✅ 可接受。

### 6.3 [SHOULD] 幂等命中返回完整 entry 是否泄露

同 owner 幂等命中返回完整 `CreateEntryResponse`（含 slug、files 等）。这是预期行为——调用方本就是要创建这个 entry，返回已有 entry 的信息是幂等语义的核心。✅

---

## 7. view_count 原子递增方案审查

### 7.1 update() 构造器原子性

```python
stmt = (
    update(EntryShare)
    .where(EntryShare.id == share.id, EntryShare.revoked_at == None)
    .values(view_count=EntryShare.view_count + 1)
)
session.exec(stmt)
```

生成的 SQL：`UPDATE entry_shares SET view_count = entry_shares.view_count + 1 WHERE id = ? AND revoked_at IS NULL`

这是数据库层面的原子操作 ✅。SQLite 单写者模型下无并发问题。

### 7.2 session.exec() vs session.execute()

当前代码用 `session.execute(text(...))`。方案改用 `session.exec(update(...))`。需确认 SQLModel 的 `session.exec()` 支持 SQLAlchemy core `update()` 语句。

SQLModel 的 `session.exec()` 接受 `Executable`，SQLAlchemy `update()` 返回 `Update` 继承 `Executable`。理论上兼容，但 P0-brief 已标记此为风险项。**建议 P3 测试中覆盖此点**。

---

## 8. 默认 host 改动向后兼容审查

### 8.1 已显式配置的部署

`PEEKVIEW_SERVER__HOST=0.0.0.0` 或 config.yaml 中设了 host → 不受影响 ✅

### 8.2 零配置部署

升级后默认变为 127.0.0.1，只监听 localhost。方案已标注 CHANGELOG breaking change ✅

### 8.3 [SHOULD] Docker/容器场景

Docker 容器中通常需要 `0.0.0.0` 才能从容器外访问。零配置 Docker 部署升级后会断连。方案未提及此场景。建议在 CHANGELOG breaking change 描述中明确提及 Docker/容器部署需显式设置 `PEEKVIEW_SERVER__HOST=0.0.0.0`。

---

## 9. 其他发现

### 9.1 [SHOULD] MCP handler 响应文本未区分 200/201

createEntry.ts handler 的响应文本固定写 `✓ Entry created successfully`。幂等命中（200）时语义上不是"created"而是"returned existing"。建议区分：

- 201 → `✓ Entry created successfully`
- 200 → `✓ Entry already exists (idempotent)`

但 MCP client 当前通过 `this.request<EntryResponse>` 调用，只返回 response body，不暴露 HTTP status code。要区分需 client 层捕获 status code——改动较大，可作为后续优化。当前方案可接受。

### 9.2 BDD-B3 PUT/PATCH 不一致

P1 BDD-B3 写 `PUT /api/v1/entries/{slug}`，实际端点是 `PATCH /api/v1/entries/{slug}`。方案 §2.2 和影响域表正确使用 `update_entry` + `PATCH`。**P1 需勘误**。

### 9.3 §2.2 限流 provider 的配置独立性

方案选择不加新配置项 `rate_limit_entries_per_minute`，而是复用 `rate_limit_per_minute` + 独立 provider 函数。这满足 BDD-B6（"可独立于 default_limits 配置"），因为 provider 函数的值可在 main.py 中独立修改。✅

但 `set_entries_rate_limit` 的值当前直接用 `rate_limit_per_minute`，与 default_limits 值相同。短期内无实际差异，但架构上已为独立配置留了扩展点。合理。

### 9.4 §2.4.1 Entry 模型的 unique 声明方式

方案在 `sa_column_kwargs` 中设 `unique=True`，同时说 `__table_args__` 加显式 UNIQUE index。但 migration 中已用 `CREATE UNIQUE INDEX ... WHERE idempotency_key IS NOT NULL`（partial index）。`sa_column_kwargs={"unique": True}` 会生成普通 UNIQUE 约束（不允许 NULL 重复取决于 DB——SQLite 允许多个 NULL 在普通 UNIQUE 中，但语义不如 partial index 清晰）。

**建议**：不在 `sa_column_kwargs` 中设 `unique=True`，而是完全依赖 migration 中的 partial unique index。`sa_column_kwargs={"unique": True}` 会触发 `create_all()` 创建普通 UNIQUE 约束，与 migration 的 partial index 重复且语义不同。

**正确做法**：
```python
idempotency_key: str | None = Field(
    default=None,
    max_length=128,
    sa_column_kwargs={"nullable": True, "default": None},
)
```
不设 `unique=True`，UNIQUE 约束完全由 migration 的 partial index 处理。`create_all()` 不会创建 UNIQUE 约束，migration 的 partial index 提供唯一性保证。

---

## 10. 审查结论

### 必须修复 [MUST]（3 项）

| # | 问题 | 位置 | 要求 |
|---|------|------|------|
| M1 | 返回类型变更对 `_retry_with_slug_suffix` 的连锁影响未充分分析 | §2.4.2 | 补充 `_retry_with_slug_suffix` 签名改法、idempotency_key 参数透传、IntegrityError 回滚后 key 不在 DB 的保证说明 |
| M2 | `_find_by_idempotency_key` 使用独立 Session 的事务隔离说明缺失 | §2.4.2 | 补充"IntegrityError catch 中开新 session 查询安全，因竞态对方 insert 已 commit"的说明 |
| M3 | slug 碰撞 + idempotency_key 共存场景的 IntegrityError 处理说明缺失 | §2.4.2 | 补充此边界场景的流程说明 |

### 建议改进 [SHOULD]（4 项）

| # | 建议 | 位置 | 说明 |
|---|------|------|------|
| S1 | `_build_create_response` 标注为新增方法 | §2.4.2 | 当前代码无此方法，需从 create_entry 内联构造提取 |
| S2 | Entry 模型 idempotency_key 不设 `sa_column_kwargs={"unique": True}` | §2.4.1 | 避免与 migration partial index 重复/冲突，UNIQUE 约束完全由 migration 处理 |
| S3 | CHANGELOG breaking change 描述补充 Docker/容器场景 | §2.1 | 零配置 Docker 部署升级后断连 |
| S4 | P1 BDD-B3 勘误 PUT→PATCH | P1 | 文档一致性 |

### 总体判定

**条件通过**——修复 3 个 MUST 项后可进入 P3。
