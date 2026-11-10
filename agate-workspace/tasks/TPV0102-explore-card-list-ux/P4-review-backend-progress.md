# P4-review-backend — progress

## 状态行（阶段 0：开跑基线）
- 角色：review（偏执 Staff Engineer，仅后端）
- 评审范围：timefmt.py / models.py / client.py / cli.py / services/admin_service.py / tests/test_utc_serialization.py
- 开跑 git status 基线：44 项（M 30 / ?? 14），HEAD `20fd76b3`
- 已实跑：`pytest tests/test_utc_serialization.py` → **20 passed**（exit 0）
- 已实跑：`pytest tests/ -k mixin_not_in_table_mro` → **1 passed**（exit 0，非 exit 5）
- 已实跑：`make lint` → All checks passed
- [PROD_NOT_TOUCHED]

## Pass 1 — CRITICAL 逐项核查（对照代码，不信自述）

### 1. 表模型污染风险 —— 无问题（PASS）
- 自写 AST 探针 `.agate-tmp/probe2.py`：`table=True` 模型集合 = `ApiKey/Entry/EntryRead/EntryReadStats/EntryShare/EntryStar/EntryTombstone/File/Team/TeamMember/User`（11 个），**无一**继承 `UtcSerializeMixin`（含传递继承）→ `VIOLATION table+mixin: []`
- 运行时探针 `.agate-tmp/probe_serialize.py`：
  - `Entry.model_dump()` → `created_at` 为 `datetime.datetime`，`str()` 无 Z ✓
  - `Entry.model_dump(mode="json")` → `'2026-11-10T09:43:00'`（**无** Z）✓ 表模型 json 路径未被污染
  - `User` 同上 ✓
- `EntryBase` / `UserBase` 基类仍为 `(SQLModel)`，`git diff` 确认无 `-/+ class EntryBase` 行 ✓
- 结论：硬约束 ③④ 落实。

### 2. `when_used="json"` 语义 —— 无问题（PASS）
- 源码：`@field_serializer("*", when_used="json", check_fields=False)`（models.py:91）
- 运行时：`EntryResponse.model_dump()`（python 模式）`created_at` 为 `datetime.datetime` 实体 ✓；`model_dump(mode="json")` 为 `'...Z'` ✓
- 全 16 个叶模型 × 34 个 datetime 字段遍历：json 模式全带 Z、python 模式全为 datetime（0 offender）✓
- 结论：硬约束 ① 落实，无 `always` 回归。

### 3. 叶模型覆盖 —— 无遗漏（PASS），但**口径与主 Agent 自述的「15」不同**
- AST + 运行时双口径实测：`非 table 且不被 table 继承 且 含 datetime 字段` = **16 个类 / 34 个 datetime 字段**
  `ApiKeyCreateResponse, ApiKeyResponse, CountdownInfo, CreateEntryResponse, EntryListItem, EntryRawResponse, EntryResponse, EntryStats, ReadEventResponse, ReadStatsResponse, ShareCreateResponse, ShareResponse, StarItem, StarResponse, TombstoneResponse, UserResponse`
- 与 P1 附录 15 类的差 = `ShareCreateResponse`（`class ShareCreateResponse(ShareResponse)`，经继承命中）——P1 §6.9 第 2 条已明确「无需单独覆盖」，**不是遗漏**
- 「非 table 且含 datetime 但未换」的类仅 `EntryBase` / `UserBase` → 二者**必须**不换（被表模型继承），属正确排除
- 逐类核对基类替换（`git diff` 15 条 `+class X(UtcSerializeMixin)` + `ShareCreateResponse` 继承）与实测 16 类一一对应，**无一个换错/漏换** ✓
- 结论：无「部分带 Z、部分不带」的静默错序。

### 4. `utc_iso_z` 对 None / naive / aware —— 无问题（PASS）
- `utc_iso_z(None)` → `None` ✓
- naive `2026-11-10 09:43:00` → `'2026-11-10T09:43:00Z'` ✓
- aware `+08:00`(17:43) → 归一到 `'2026-11-10T09:43:00Z'`，无 `+08:00` 残留 ✓
- aware UTC 输入 → 单 Z，无 `+00:00` ✓（`.isoformat().replace("+00:00","Z")` 只可能命中尾部单个偏移）

### 5. `parse_iso` 的 `replace("Z","+00:00")` 安全性 —— 无问题（PASS）
- 边界实测（`.agate-tmp/probe_serialize.py`）：
  - `'...09:43:00Z'` → aware UTC ✓
  - `'...09:43:00.123456Z'` → aware UTC，微秒保留 ✓
  - `'...09:43:00+00:00'` / `'...+08:00'` → 正确 ✓
  - `'...09:43:00'`（naive）→ naive，不抛 ✓
- 误伤分析：ISO 8601 中 `Z` 只作尾部 UTC 设计符出现；date/time 主体仅含数字与 `-:.+`，**不含字母 Z**，故 `replace` 全局替换不可能命中字符串中间。构造 `'...ZZ'` / `'ZZZZ'` / `'Z'` / `'...+00:00Z'` 均 → `ValueError`（非法输入本就应抛），**没有**产生「错误但静默成功」的值。
- 唯一残留脆弱点：`+00:00` 也被替换成 `+00:00`（自替换，幂等）——`'...+00:00Z'` 会变成 `'+00:00+00:00'` 抛错而非静默错值，属可接受。
- 结论：安全。**无 CRITICAL**。

### 6. Read-Check-Write 竞态 / N+1 / 资源泄漏 —— 本批未引入（PASS）
- 本批 6 文件均为纯格式化/序列化改动，无新增查询、无新增 session、无新增写路径。
- `admin_service.export_entry` 3 处替换不改控制流；`client._parse_dt` 不改请求逻辑。

## Pass 2 — INFORMATIONAL

### cli.py 7 处替换
- `git diff` 命中 7 处：`create -j`(376) / `get -j`(441,442) / `list -j`(562-570 两字段) / `admin stats -j`(2281) / `admin stats` echo(2310) —— 与自述一致
- 全仓 `grep -rn "isoformat()" backend/peekview/` 仅剩 `timefmt.py:16` 自身 → **无漏改**
- `utc_iso_z` 对 `None` 返回 `None`，替换后不再需要 `if ... else None` 三元，实现已正确简化；`list -j` 分支保留 `item.get(...) if isinstance(item, dict)` 判别（remote 分支走原始 JSON 字符串透传）——语义正确

### admin_service.py 3 处替换
- `expires_at` / `created_at` / `updated_at`（644-646），`git diff` 确认 3 处，无遗漏

### 循环 import
- 依赖方向 `models.py → timefmt.py`（单向）、`client.py → timefmt.py`、`cli.py → timefmt.py`、`admin_service.py → timefmt.py`；`timefmt.py` 仅 `from datetime import datetime, timezone`，**零内部依赖** → 无环
- 实测 `import peekview.models` / `peekview.cli` / `peekview.client` 均成功（测试实跑证明）

### test_utc_serialization.py 1 行 ruff 修复
- `git diff` 仅 2 行：`from peekview.timefmt ...` 与 `from peekview.models import UtcSerializeMixin` 顺序互换（I001）→ **零断言/零逻辑改动** ✓

### `response_model` 10 处
- `admin.py` 7 + `config_router.py` 3；其中含 datetime 的指名类 `UserResponse`(4 端点) / `UserListResponse` / `AdminStatsResponse`(→`EntryStats`) 均已在覆盖集合内
- 实测 FastAPI `response_model` 重校验后 Z **仍保留**（`/admin-stats` `/users` `/me` 探针全部输出 `"...Z"`）→ 硬约束 ② 无风险
- `config_router.py` 3 个 `Public*Config` 为 `BaseModel`，无 datetime 字段 → 无需处理

## 附加验证（超出必跑项）

### A. 无 `response_model` 的端点（走 FastAPI 默认 jsonable_encoder）
`.agate-tmp/probe_encoder.py` 用 TestClient 实测：
- `/stars`（StarListResponse 含嵌套 CountdownInfo + TombstoneResponse）→ `starred_at` / `expires_at` / `countdown.archive_delete_at` / `tombstone.deleted_at` **全带 Z** ✓
- `/shares`（ShareListResponse 嵌 ShareResponse）→ Z ✓
- `/share-create`（ShareCreateResponse）→ Z ✓
- `/apikey-list`（裸 `{"items": [ApiKeyResponse]}`）→ Z ✓
→ 嵌套/容器路径无遗漏。

### B. 通配 `field_serializer("*")` 的副作用
`.agate-tmp/probe_wildcard.py` / `probe_wildcard2.py`：
- 非 datetime 值原样透传：`Enum`→`'red'`、`date`→`'2026-11-10'`、`list[str]`→`["x","y"]`、`None`→`None`、`int`/`bool` 原样 ✓
- 嵌套模型（`files: list[FileResponse]` / `team: TeamRef` / `share_context`）序列化为 dict，字段无损 ✓
- 未挂 mixin 的嵌套内层模型的 datetime **不**被误加 Z（`Inner.when` → `'...:00'`）→ 无跨模型污染 ✓

### C. `parse_iso` 变更的影响面（aware 化）
- `client._parse_dt` 现在对带 Z 服务端值返回 **aware**，对无后缀返回 **naive**。`RemoteEntry` 的 created_at/updated_at 在 `cli.py` 中只用于 `utc_iso_z()` 渲染与 `or 'Never'` 判空，**无 aware/naive 混比** → 无 `TypeError` 风险
- `test_client.py` 既有用例喂 naive 字符串，`isinstance(..., datetime)` 断言仍真 ✓（已实跑）

### D. 通配 serializer 对未来子类新增字段的自动覆盖（P2 §1.3 R2 机制性验证）
`.agate-tmp/probe_subclass.py`：`FutureChild(Future)` 新增 `extra_at` 未做任何声明即带 Z → R2「新增叶模型/字段漏改」**机制上不可能发生** ✓
`ShareCreateResponse.model_construct(...)` → `created_at`/`expires_at`/`revoked_at` 三字段全带 Z ✓（继承即得，P1 §6.9 第 2 条）

### E. `response_model` 重校验后 Z 保留（硬约束 ② 实跑反证）
`.agate-tmp/probe_nested.py`（TestClient）：`/admin-stats` → `entries.latest_created_at` = `"...Z"`；`/users`、`/me` → `created_at`/`disabled_at` = `"...Z"` ✓

### F. CLI local vs remote 时间显示不对称（IN-1，超范围，建议 backlog）
`.agate-tmp/probe_cli_asym.py` 实测：
- local `apikey create` 的 `Expires:` → `'2026-11-10 09:43:00'`（naive，无时区标记）
- remote 同字段 → `'2026-11-10T09:43:00Z'`
成因：这两处走 `f"{result.expires_at}"` 属性插值，非 `.isoformat()`，故不在 P1 §6.6 登记的 7+3 改动清单内 → **不是本批漏改**。不违反 BDD-11（BDD-11 判据是 `--json` 输出）。建议登记 improvement-backlog，不在本任务修。

## 最终结论

**status: approved** — **0 CRITICAL**，2 INFORMATIONAL（IN-1 CLI 显示不对称 / IN-2 `parse_iso` 对 `+00:00Z` 混写抛错，均不阻断）。

四条 P2 硬约束全部落实并经实跑反证：
- ① `when_used='json'` 显式 → python 模式仍 datetime ✓
- ② `response_model` 重校验后 Z 不丢 ✓（TestClient 实测）
- ③ `AwareDatetime` 未用于 table 模型 ✓（本批未改列类型）
- ④ `EntryBase`/`UserBase` 未动 ✓（git diff 无相关行）

dispatch-context 两大疑点明确结论：
1. `parse_iso` 的 `replace("Z","+00:00")` **安全**——ISO 8601 时间主体不含字母 Z，结构上不可能误伤；畸形输入快速失败抛 ValueError，无静默错值路径。
2. 15 个叶模型**逐个核对无错换**；实际覆盖 **16 类 / 34 字段**（多 `ShareCreateResponse`，经继承，P1 §6.9 / P2 §1.3 R6 已预登记为预期差异）；无遗漏。

## 只读纪律核验
- git status：开跑 44 → 收尾 46，**新增仅** `P4-review-backend.md` + `P4-review-backend-progress.md`
- `backend/` 下变动仅 6 个被审文件（5 M + 1 ??），与开跑基线一致，**未被我改动**
- 零 git 写操作、零 agate 写类工具、scratch 全在 `.agate-tmp/` 且已删除自有探针
- 注：`.agate-tmp/probe_mixin.py`（16:26，早于本会话）非我创建，原样保留
- [PROD_NOT_TOUCHED]
