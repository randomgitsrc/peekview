---
phase: P2
task_id: T005-default-expires-15d
parent: T005-P2/P2-design.md
trace_id: T005-P2-20260612-review
status: approved
---

# P2 工程经理评审：默认 15 天过期策略

## 架构问题（阻塞级）

无。

---

## 架构问题（非阻塞）

### NB-1: CLI help text 含硬编码 "(15d)"

**位置**：`cli.py` `--expires-in` option help text — 设计为 `"Default: configured via limits.default_expires_in (15d)."`

**问题**：括号内的 `(15d)` 是硬编码数字。如果部署者设 `PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN=30d`，CLI help 仍显示 `(15d)`，形成误导。CLI 虽与 backend 同版本发布，但环境变量覆盖是部署期行为，CLI help text 无法感知。

**建议**：去掉 `(15d)` 括号，改为 `"Default: configured via limits.default_expires_in. Use '0' for no expiration."` — 与 MCP 的 "configured on server" 措辞对齐。

### NB-2: OpenAPI description 含硬编码 "(usually 15d)"

**位置**：`models.py` `EntryCreate.expires_in` / `CreateEntryRequest.expires_in` Field description — 设计为 `"Default: server-configured (usually 15d)."`

**问题**：与 NB-1 同。"usually 15d" 在非默认部署下不准确。

**建议**：改为 `"Default: server-configured (see /api/v1/config/limits). Use '0' for no expiration."` — 引用 /limits 端点代替具体数字。

### NB-3: `formatExpiresIn` 函数未明确复用路径

**位置**：`EntryDetailView.vue` 和 `EntryListView.vue`

**问题**：设计在 4.13 和 4.14 各自定义了 `formatExpiresIn`，备注 "可从 utils 导入或复制"。**应确定单一方案** — 建议新建 `frontend-v3/src/utils/expires.ts`，两个 View 共同导入。

### NB-4: `CreateEntryRequest.expires_in` 当前无 description

**位置**：`models.py:421` — `expires_in: str | None = Field(default=None)`（无 description）

**问题**：设计说 "description 更新"，但实际是 **新增** description（当前字段无 description）。不影响实现，但 P4 implementer 需注意此差异。

### NB-5: `default_expires_in="0"` 边界行为未文档化

**问题**：如果部署者设 `PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN=0`，validator 通过（`parse_expires_in("0")` 返回 `None` 不抛异常），所有新条目默认永不过期。这是合法用例但设计中未显式说明，可能造成混淆。

**建议**：在 validator docstring 或 config description 中说明 `"0"` 的语义 = 默认永不过期。

---

## 测试缺口

| # | 缺口 | 严重度 | 建议 |
|---|------|--------|------|
| TG-1 | `parse_expires_in("0h")` / `parse_expires_in("0m")` → `None` 未单独覆盖 | 低 | AC2 只测试 `"0d"`，P4 实现时应至少加 3 个参数化 case ("0d"/"0h"/"0m") |
| TG-2 | `DEFAULT_EXPIRES_IN=0` 的集成行为未测试 | 低 | 建议增加：Given `PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN=0`，不传 `expires_in` 时 `expires_at` 为 NULL |
| TG-3 | AC12/AC13 用 grep 检查硬编码 — 应自动化 | 低 | 可将 MCP tool description 常量提取 + 单元测试断言，避免依赖 manual grep |
| TG-4 | CLI help text 验证（AC10）为 manual | 低 | 可用 subprocess 测试自动抓取帮助文本并断言，但优先级不高 |

---

## 锁定决策

| 决策 | 说明 |
|------|------|
| **P1-8（存量 NULL 条目管理）推迟** | 不在此任务范围。当前 `expires_at=NULL` 条目不受清理任务影响，继续保留。 |
| **MCP 动态配置注入推迟** | MCP tool description 不硬编码数字（用 "configured on server"）。启动时读 `/api/v1/config/limits` 动态注入推迟到后续任务统一处理配置同步需求。 |
| **`expires_in=""` = `None` = 使用默认值** | 空字符串在 service 层归一化（`if expires_in and expires_in.strip()`），不在 Pydantic 层处理。与现有 `summary.strip()` pattern 一致。 |
| **`expires_in="0"` = 永不过期** | `parse_expires_in("0")` 返回 `None`，`"0d"/"0h"/"0m"` 同理。 |
| **validator 无效配置不崩溃** | `default_expires_in` validator 捕获 `parse_expires_in` 异常 → WARNING 日志 → fallback 到 `"15d"`。服务以安全默认值启动。 |
| **`/api/v1/config/limits` 无认证** | 返回值为公开安全信息（max size、默认过期等），无 secret。 |

---

## 逐问题覆盖确认

| P1 问题 | P2 设计覆盖 | 状态 |
|---------|------------|------|
| P1-1 所有创建路径默认过期 | service 层 fallback 到 `config.limits.default_expires_in` | ✅ |
| P1-2 配置项新增 | `PeekLimits.default_expires_in` + validator + CLI config keys | ✅ |
| P1-3 parse `"0"` / `"0d"` / `"0h"` / `"0m"` | `parse_expires_in` 返回类型 `timedelta \| None`，三路处理 | ✅ |
| P1-4 跨组件验证方案 | 4 层测试矩阵：backend unit / MCP unit+integration / frontend e2e / full e2e | ✅ |
| P1-5 CreateEntryResponse 含 expires_at | models.py + entry_service.py + MCP 两处响应文本追加 | ✅ |
| P1-6 CLI/MCP/API 可发现性 | CLI help text / API description / MCP inputSchema + tool description 全部更新 | ✅ |
| P1-7 MCP 与 backend 配置同步 | "configured on server" 措辞 + `/api/v1/config/limits` 端点供手动查询 | ✅ |
| P1-8 存量 NULL 条目 | 明确推迟，设计预留 | ✅ |
| P1-9 expires_in="" 空字符串 | service 层归一化为 None → 使用默认值 | ✅ |
| P1-10 无效配置启动告警 | PeekLimits validator: WARNING 日志 + fallback "15d"，不崩溃 | ✅ |
| P1-11 前端展示过期信息 | `EntryListItem.expires_at` + frontend types + detail/list view 展示逻辑 | ✅ |
| P1-12 /api/v1/config/limits | `PublicLimitsConfig` + `GET /api/v1/config/limits`，无认证 | ✅ |

---

## 数据流校验

数据流 (`entry_service.py:134-158`) 路径清晰：

```
expires_in → normalize (""→None) → fallback (None→config.default) → parse → delta | None → expires_at
```

三个关键状态转换：
- `expires_in="7d"` → `parse_expires_in("7d")` → `timedelta(days=7)` → `expires_at = now+7d`
- `expires_in="0"` → `parse_expires_in("0")` → `None` → `expires_at = None` (never)
- `expires_in=None`/`""` → fallback to `config.limits.default_expires_in` → `parse_expires_in("15d")` → `timedelta(days=15)` → `expires_at = now+15d`

异常路径：
- `parse_expires_in` 对预解析值（`default_expires_in`）抛异常 → validator 已捕获（WARNING + fallback），service 层不会收到无效值
- `parse_expires_in` 对用户输入抛异常 → 通过现有 ValidationError 路径直接返回 422

**错误边界**：
- Config 层：validator 兜底 → WARNING 日志 → fallback "15d"
- Service 层：用户输入异常 → `parse_expires_in` ValueError → `create_entry` 透传 → 422 to client
- Service 层：空字符串 → 归一化为 None → fallback 到已校验的默认值

**`_retry_with_slug_suffix`**（entry_service.py:631）调用 `self.create_entry(expires_in=expires_in,...)` — 复用 create_entry 的新逻辑，无需额外改动。✅

---

## 验收标准判定能力

19 项 AC 中：
- 15 项机器可判定（pytest / Playwright / grep）
- 2 项 manual（AC10 CLI help, AC11 config list）— 可接受，自动化 ROI 不高
- 2 项 MCP integration（AC14）— 需 debug backend 运行，依赖正确

所有 AC 与 P1 验证方式一一对应，无遗漏。

---

## 总结

**结论：approved（0 阻塞，5 非阻塞问题，4 测试缺口）**

设计完整覆盖了 P1 全部 12 个问题（含 T004 遗漏的 8 个隐含需求）。数据流清晰，状态转换全部处理，错误边界明确。"不在各处硬编码"原则在 MCP（独立版本发布）上严格遵循，CLI/OpenAPI 因同版本发布存在可接受的信息性数字。实现顺序（Backend → CLI → MCP/Frontend 并行）合理。
