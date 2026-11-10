---
phase: P4
task_id: TPV0102
type: review
parent: P4-implementation.md
trace_id: TPV0102-P4-review-backend-20261110
status: approved
created: 2026-11-10
agent: review
role: review（偏执 Staff Engineer，仅后端；前端由 design-review 负责）
scope: backend-serialize 批（6 文件）
critical_count: 0
informational_count: 2
prod_touched: false
---

# P4 后端实现评审 — UTC 序列化契约（`backend-serialize` 批）

> **评审范围**：`timefmt.py`（新建）/ `models.py` / `client.py` / `cli.py` / `services/admin_service.py` / `tests/test_utc_serialization.py`
> **评审基准**：`P2-design.md` §3.1 / §3.2 / §3.3（四条硬约束）、`P1-requirements.md` BDD-07~12
> **纪律**：不采信 `P4-implementation.md` 自述，全部结论对照实际代码 + 实跑探针
> **状态标记**：[PROD_NOT_TOUCHED]

---

## 1. 结论

**status: approved** — **0 个 CRITICAL**，2 个 INFORMATIONAL（均为「不改也不错、但建议登记」级别，不阻断推进）。

四条 P2 硬约束**全部落实**且经实跑反证：

| # | P2 硬约束 | 结论 | 证据 |
|---|---|---|---|
| ① | `field_serializer` 必须显式 `when_used='json'` | ✅ 落实 | `models.py:91` 显式声明；`EntryResponse.model_dump()` 返回 `datetime` 实体（非 str） |
| ② | `response_model` 按声明类重新校验后 Z 不丢 | ✅ 无风险 | 实测 `/admin-stats` `/users` `/me` 经 FastAPI 重校验后仍输出 `"...Z"` |
| ③ | `AwareDatetime` 不可用于 `table=True` 模型 | ✅ 未触碰 | 本批未改任何列类型定义 |
| ④ | `EntryBase`/`UserBase` 严禁加 serializer | ✅ 未触碰 | `git diff` 无 `-/+ class EntryBase`/`UserBase` 行；二者仍为 `(SQLModel)` |

---

## 2. Pass 1（CRITICAL）— 逐项核查

### C-1 表模型污染风险 → **无问题**

**这是本批最高风险项**（若 `UtcSerializeMixin` 被 `table=True` 模型继承，`Entry.model_dump(mode='json')` 会把时间变字符串，破坏备份/导出/内部比较）。

- **AST 探针**（`.agate-tmp/probe2.py`）：`table=True` 模型实测 11 个 —— `ApiKey` / `Entry` / `EntryRead` / `EntryReadStats` / `EntryShare` / `EntryStar` / `EntryTombstone` / `File` / `Team` / `TeamMember` / `User`。逐个做**传递继承**判定（含 base→table 传播）：
  ```
  VIOLATION table+mixin: []
  ```
- **运行时探针**（`.agate-tmp/probe_serialize.py`）：
  - `Entry.model_dump()` → `created_at` 为 `datetime.datetime`，`str()` = `'2026-11-10 09:43:00'`（**无** Z）
  - `Entry.model_dump(mode='json')` → `'2026-11-10T09:43:00'`（**无** Z）—— 表模型即使走 JSON 路径也未被污染
  - `User` 同两档，均通过
- **MRO 适应度**：`test_mixin_not_in_table_mro` 实跑 **1 passed**（exit 0，非 exit 5）—— 该函数名被 `gate_commands.P5_fitness` 以 `-k` 写死，保留正确。

### C-2 `when_used='json'` 语义 → **无问题（无 `always` 回归）**

- 源码 `models.py:91`：`@field_serializer("*", when_used="json", check_fields=False)`
- 遍历全部 **16 个叶模型 × 34 个 datetime 字段**：
  - `model_dump(mode='json')` → 全部 `str` 且 `endswith('Z')`，0 offender
  - `model_dump()`（python 模式）→ 全部 `datetime` 实体，0 offender
- 结论：硬约束 ① 落实，`model_dump()` 契约未被破坏（服务层/内部逻辑仍拿到真实 `datetime`）。

### C-3 叶模型覆盖完整性 → **无遗漏**（但覆盖口径是 **16 类 / 34 字段**，不是自述的 15）

**逐个核对，不只看计数**。AST 静态口径 + 运行时 `inspect` 口径**双路互证**，结果一致：

| 判据 | 命中 |
|---|---|
| 非 `table=True` 且不含 datetime 的类 | 排除 |
| 被 `table=True` 模型继承的类（`EntryBase` / `UserBase`） | 排除（**必须**排除，否则污染） |
| **命中（叶响应模型）** | **16 类 / 34 datetime 字段** |

命中的 16 类：`ApiKeyCreateResponse` / `ApiKeyResponse` / `CountdownInfo` / `CreateEntryResponse` / `EntryListItem` / `EntryRawResponse` / `EntryResponse` / `EntryStats` / `ReadEventResponse` / `ReadStatsResponse` / `ShareCreateResponse` / `ShareResponse` / `StarItem` / `StarResponse` / `TombstoneResponse` / `UserResponse`

**与「15」的差异解释（不是缺陷）**：`ShareCreateResponse` 声明为 `class ShareCreateResponse(ShareResponse)`，**经继承命中**。P1 §6.9 第 2 条已明确「`ShareCreateResponse` 继承 `ShareResponse`，无需单独覆盖」；P2 §1.3 R6 亦已预登记「遍历实测 16 类/34 字段 vs P1 附录 15 类/31 字段」为**预期差异**。故：

- 15 条 `+class X(UtcSerializeMixin)` 的 `git diff` 逐个核对 → 与实测叶模型集合**一一对应，无一换错、无一漏换**
- 唯一「非 table 且含 datetime 却未换」的类是 `EntryBase` / `UserBase` → 二者**必须**不换（硬约束 ④），属正确排除
- 结论：无「部分字段带 Z、部分不带」的**静默错序**风险

**额外反证（超出必跑项）**：`field_serializer("*")` 是通配的，我验证了它对**未来新增字段/子类字段**的自动覆盖（`.agate-tmp/probe_subclass.py`）——`class FutureChild(Future)` 新增 `extra_at` 无需任何额外声明即带 Z。这正面回答 P2 §1.3 R2「新增叶模型/字段漏改」：机制上不可能漏。

### C-4 `utc_iso_z` 的 None / naive / aware 处理 → **无问题**

| 输入 | 实测输出 | 判定 |
|---|---|---|
| `None` | `None` | ✅ |
| naive `2026-11-10 09:43:00` | `'2026-11-10T09:43:00Z'` | ✅ 按 UTC 补时区 |
| aware `+08:00`(17:43) | `'2026-11-10T09:43:00Z'` | ✅ 归一到 UTC，无 `+08:00` 残留 |
| aware UTC | `'2026-11-10T09:43:00Z'` | ✅ 单 Z，无 `+00:00` 残留（`.isoformat()` 只产生一个尾部偏移） |

`.replace("+00:00", "Z")` 的替换目标是 `.isoformat()` 的**尾部固定偏移**，不可能是字符串中间内容，安全。

### C-5 `parse_iso` 的 `replace("Z","+00:00")` 安全性 → **无问题**

这是 dispatch-context 点名的重点怀疑项，我构造了边界用例实测（`.agate-tmp/probe_serialize.py`）：

```
'2026-11-10T09:43:00Z'            -> aware UTC                     ✅
'2026-11-10T09:43:00.123456Z'     -> aware UTC，微秒保留            ✅
'2026-11-10T09:43:00+00:00'       -> aware UTC                     ✅
'2026-11-10T09:43:00+08:00'       -> aware +08:00                  ✅
'2026-11-10T09:43:00'（naive）     -> naive，不抛                    ✅
```

**「误伤字符串中间的 Z」为何不可能**：ISO 8601 的日期/时间主体仅由数字与 `- : . +` 组成，**不含字母 `Z`**；`Z` 只能作为尾部 UTC 设计符出现。故全局 `replace` 结构上不可能命中主体内部。

**对抗性输入反向验证**（确认「坏输入只会抛错，不会静默产生错值」）：

```
'2026-11-10T09:43:00ZZ'      -> ValueError（'+00:00+00:00' 非法）   ✅ 抛错
'ZZZZ'                       -> ValueError                         ✅ 抛错
'Z'                          -> ValueError                         ✅ 抛错
'2026-11-10T09:43:00+00:00Z' -> ValueError                         ✅ 抛错
```

即 `replace` 对畸形输入的行为是**快速失败**，不存在「替换后仍能解析成功但语义错误」的静默腐蚀路径。**无 CRITICAL**。

### C-6 Read-Check-Write 竞态 / N+1 / 资源泄漏 → **本批未引入**

- 6 个被审文件全部是**纯格式化/序列化**改动：无新增查询、无新增 `Session`、无新增写路径、无新增文件句柄。
- `admin_service.export_entry` 的 3 处替换只改值渲染，不改控制流。
- `client._parse_dt` 只改解析函数，不改请求/重试逻辑。
- 结论：本批无新增此类风险。

---

## 3. Pass 2（INFORMATIONAL）— 代码健康

### I-1 `cli.py` 的 7 处替换 → **全部正确，无漏改**

`git diff` 逐处核对，7 处与自述完全一致：

| 位置 | 行 | 字段 |
|---|---|---|
| `create -j` | 379 | `created_at` |
| `get -j` | 444 / 445 | `created_at` / `updated_at` |
| `list -j` | 565 / 570 | `created_at` / `updated_at` |
| `admin stats -j` | 2284 | `latest_created_at` |
| `admin stats` echo | 2313 | `Latest:` |

**无漏改的证据**：全仓 `grep -rn "isoformat()" backend/peekview/` 结果**只剩** `timefmt.py:16` 自身 → 后端已无裸 `.isoformat()` 输出点。

改进质量：原 `x.isoformat() if x else None` 三元被 `utc_iso_z(x)` 吸收（因 `utc_iso_z` 已对 `None` 返回 `None`），**语义等价且更短** —— 这是正确的简化，不是遗漏 null 处理。`list -j` 保留 `item.get(...) if isinstance(item, dict)` 判别是正确的：remote 分支的 `item` 已是服务端 JSON dict（字符串已是 Z 结尾），不应二次解析。

### I-2 `admin_service.py` 的 3 处替换 → **全部正确**

`git diff` 确认恰好 3 处（`expires_at` / `created_at` / `updated_at`，行 644-646），无遗漏，无改错位置。

### I-3 循环 import → **无环**

依赖方向全部**单向指向** `timefmt.py`：

```
models.py ──┐
client.py ──┼──> timefmt.py（仅 from datetime import ...，零内部依赖）
cli.py ─────┤
admin_service.py ──┘
```

`timefmt.py` 不 import 任何 `peekview.*` → 结构上不可能成环。实跑证明：`import peekview.models` / `peekview.cli` / `peekview.client` / `peekview.services.admin_service` 全部成功。

### I-4 `test_utc_serialization.py` 的 ruff 修复 → **确为零语义改动**

`git diff` 仅 2 行：`from peekview.timefmt import ...` 与 `from peekview.models import UtcSerializeMixin` **顺序互换**（I001 分组排序）。
- 无断言改动、无逻辑改动、无测试增删 —— 确认属于 P3 遗留 lint 的机械修复。
- 该文件 20 passed，`-k mixin_not_in_table_mro` 1 passed。

### I-5 `response_model` 10 处 → **无遗漏风险**

- 实测分布：`api/admin.py` 7 处 + `api/config_router.py` 3 处（与 P1 §6.9 第 8 条一致）
- 其中**含 datetime** 的指名类：`UserResponse`（4 端点）、`UserListResponse`、`AdminStatsResponse`（→ 嵌套 `EntryStats`）→ **均已在覆盖集合内**
- `config_router.py` 的 3 个 `Public*Config` 是纯 `BaseModel`，无 datetime 字段 → 无需处理
- **实跑反证硬约束 ②**（`.agate-tmp/probe_nested.py`）：经 FastAPI `response_model` 重新校验后，`/admin-stats` 的 `entries.latest_created_at`、`/users` 与 `/me` 的 `created_at`/`disabled_at` **全部仍以 Z 结尾** → 不存在「重校验丢 Z」。
- `api/entries.py` / `shares.py` / `stars.py` / `files.py` 无 `response_model`，走 `JSONResponse(model_dump(mode='json'))` 或直接返回模型实例 → 亦无重校验丢 Z 风险。

### I-6 补充：无 `response_model` 端点的默认 encoder 路径 → **Z 保留**

这是 15/16 之外的排查盲区（dispatch-context 未点名）。`api/stars.py`、`api/shares.py`、`api/apikeys.py` 直接返回模型实例/裸 dict，走 FastAPI 默认 `jsonable_encoder`。用 TestClient 实测（`.agate-tmp/probe_encoder.py`）：

| 端点 | 嵌套结构 | Z 保留 |
|---|---|---|
| `GET /api/v1/stars` | `StarListResponse` → `StarItem` → `CountdownInfo` + `TombstoneResponse` | ✅ 全部保留（含 `countdown.archive_delete_at`、`tombstone.deleted_at`） |
| `GET /api/v1/entries/{slug}/shares` | `ShareListResponse` → `ShareResponse` | ✅ |
| `POST .../shares` | `ShareCreateResponse` | ✅ |
| `GET /api/v1/api-keys` | 裸 `{"items": [ApiKeyResponse]}` | ✅ |

→ 容器/嵌套/裸 dict 三条路径均无遗漏。

### I-7 补充：通配 `field_serializer("*")` 的副作用 → 无不良影响

`"*"` 会作用到**所有**字段，故需确认非 datetime 值不被破坏（`.agate-tmp/probe_wildcard.py` / `probe_wildcard2.py`）：

| 字段类型 | 实测行为 | 判定 |
|---|---|---|
| `Enum`（`EntryStatus`） | → `'red'`（`.value`） | ✅ 原样透传 |
| `date` | → `'2026-11-10'` | ✅ |
| `list[str]` / `dict` | 原样 | ✅ |
| `None` | `None` | ✅ |
| `int` / `bool` | 原样 | ✅ |
| 嵌套模型（`files: list[FileResponse]`、`team: TeamRef`、`share_context`） | dict 化，字段无损 | ✅ |
| **未挂 mixin 的嵌套内层模型的 datetime** | **不**被误加 Z（`'...:00'`） | ✅ **无跨模型污染** |

**关键点**：`isinstance(v, datetime)` 守卫使非 datetime 值直接 `return value`，故 serializer **不会**改写嵌套模型的内部序列化行为 —— 内层若未挂 mixin，其 datetime 保持原有（无 Z）行为，符合「按声明类生效」的预期。

---

## 4. 实跑验证结果（全部亲自执行）

| 命令 | 结果 |
|---|---|
| `cd backend && .venv/bin/python -m pytest tests/test_utc_serialization.py -q --tb=short` | **20 passed**（exit 0） |
| `cd backend && .venv/bin/python -m pytest tests/ -q --tb=short -k mixin_not_in_table_mro` | **1 passed**（exit 0，**非** exit 5） |
| `make lint` | **All checks passed**（exit 0） |
| `pytest tests/test_client.py test_apikey.py test_admin_backup.py test_admin_stats_cleanup.py test_share_create.py test_star_api.py test_read_tracking.py test_models.py test_api.py test_cli.py` | **254 passed**（exit 0，0 failed） |

自写最小验证脚本（均落在 `.agate-tmp/`，审后删除）：

| 脚本 | 验证内容 | 结果 |
|---|---|---|
| `probe2.py` | AST 扫 table 模型集合 + 传递继承污染判定 | VIOLATION = [] |
| `probe_serialize.py` | 表模型不污染 / 叶模型带 Z / python 模式仍 datetime / 16 类 34 字段遍历 / `utc_iso_z` 四档 / `parse_iso` 边界+对抗 | 全 PASS |
| `probe_encoder.py` | 无 `response_model` 端点（含嵌套容器）的默认 encoder 路径 | Z 全保留 |
| `probe_nested.py` | `response_model` 重校验后 Z 保留（硬约束 ②） | Z 全保留 |
| `probe_wildcard.py` / `probe_wildcard2.py` | 通配 serializer 对 Enum/date/list/None/int/bool/嵌套模型 的副作用 | 无不良影响 |
| `probe_annot.py` | 全模型 datetime 注解形态扫描（查 `Optional[datetime]` 等口径漏网） | 仅 2 种形态，遍历口径已覆盖 |
| `probe_subclass.py` | 通配 serializer 对未来子类新增字段的自动覆盖 | 自动带 Z（R2 机制性成立） |

**已知预存失败**（按 dispatch-context 指示**不计入本批缺陷**）：`tests/test_cli_remote.py::TestCLIRemoteConfig::test_config_set_remote_api_key` —— 沙箱 `~/.peekview/` 只读导致写配置失败，implementer 已用 stash 反证与本批无关。本评审未复现该用例（避免 stash 操作，遵守只读纪律）。

---

## 5. INFORMATIONAL 建议（不阻断，供主 Agent 决定是否回派）

### IN-1（低）`cli.py` 的 `apikey create/list` / `whoami` 时间显示在 local 与 remote 模式下**不对称**

**位置**：`backend/peekview/cli.py:2068` / `2085` / `2112` / `2116` / `2139` / `2140` / `2020`

**现象**（实测 `.agate-tmp/probe_cli_asym.py`）：

| 模式 | `apikey create` 的 `Expires:` |
|---|---|
| local | `'2026-11-10 09:43:00'`（`str(datetime)`，**无**时区标记） |
| remote | `'2026-11-10T09:43:00Z'`（服务端 JSON 字符串透传，**带** Z） |

本批已把 `create -j` / `get -j` / `list -j` / `admin stats` 的 7 处 `.isoformat()` 修掉，但 `apikey create/list` 与 `whoami` 走的是**属性/字典直接插值**（`f"{result.expires_at}"`），未在 P1/P2 的改动清单内（P1 §6.6 只登记 7 处 `.isoformat()` + `admin_service` 3 处），故**不属于本批漏改**。

**为何仍值得登记**：BDD-11 的字面判据是「CLI `--json` 输出」，这些是**人类可读行**（无 `-j` 选项），故不违反 BDD-11。但同类问题（local 显示 naive、remote 显示 aware）会在同一 CLI 内造成不一致观感，且 `whoami` 的 `Created:` 永远来自 remote（恒为 Z）而 `apikey create` 分模式 → 不一致会长期存在。

**Fix（若采纳）**：`apikey_create` / `apikey_list` 的 local 分支改用 `utc_iso_z(...)`：
```python
click.echo(f"  Expires: {utc_iso_z(result.expires_at) or 'Never'}")
click.echo(f"      Created: {utc_iso_z(k.created_at)}")
```
（remote 分支保持现状——`result['expires_at']` 已是服务端带 Z 字符串，二次调用 `utc_iso_z` 会因入参是 `str` 而非 `datetime` 而原样返回，安全但无意义。）

**建议**：**不在本任务修**（超出 P1 范围，且不违反任何 BDD）。建议登记到 `docs/roadmap/improvement-backlog.md` 作为 follow-up。

### IN-2（低）`parse_iso` 对 `+00:00` 与 `Z` 混写的输入抛错而非容错

**位置**：`backend/peekview/timefmt.py:21`

**现象**：`'2026-11-10T09:43:00+00:00Z'` → `ValueError`（替换后成 `'+00:00+00:00'`）。

**为何不算缺陷**：这是**非法** ISO 8601 输入，任何合规解析器（含 `datetime.fromisoformat` 本身）都应拒绝；抛错是正确行为，且 `client._parse_dt` 的上游是自家服务端，不会产生此类值。**不建议改**。

**仅作记录**：若未来需要容忍第三方服务端的畸形时间戳，可改为 `value.removesuffix("Z") + "+00:00" if value.endswith("Z") else value` 的尾部限定写法——语义更精确（只在尾部是 Z 时替换）。当前**无需要**，记录备查。

---

## 6. 只读纪律核验

- **零写仓操作**：未执行 `git checkout` / `restore` / `reset` / `stash` / `clean` / `add` / `commit` / `switch -f`；未编辑或删除任何被评审文件。
- **零写类 agate 工具**：未运行 `agate-inject-card.py` / `agate-md-field-set.py` / `agate-state-set.py` / `agate-task-init.py`。
- **scratch 隔离**：全部探针在 `.agate-tmp/`（已 gitignore），审毕删除；`backend/tests/` 与 `frontend-v3/src/` 无新增文件。
- **git status 前后对比**：开跑 44 项 → 收尾 45 项，**唯一新增**为本评审的两个产出文件（`P4-review-backend.md` / `P4-review-backend-progress.md`）。无其他变动。
- **环境隔离**：全程未触碰生产 `:8080`，未读写 `~/.peekview/`（探针 DB 由 pytest conftest 隔离到 `tmp_path`，Probe 脚本只做纯内存模型操作，不碰 DB）。

[PROD_NOT_TOUCHED]

---

## 7. 给主 Agent 的结论摘要

- **Status: approved**，**0 CRITICAL**，2 INFORMATIONAL（均可 follow-up，不阻断）。
- 四条 P2 硬约束全部落实，且经**实跑反证**（不只是读代码）——尤其硬约束 ② 的「`response_model` 重校验丢 Z」已用 TestClient 实测推翻。
- dispatch-context 点名的两个核心疑点均有明确结论：
  1. **`parse_iso` 的 `replace("Z", ...)` 安全** —— ISO 8601 时间主体不含字母 Z，结构上不可能误伤中间字符；畸形输入只会快速失败抛错，不会静默产生错值。
  2. **15 个叶模型无一错换** —— 逐个核对通过；覆盖实际是 **16 类 / 34 字段**（多出 `ShareCreateResponse`，经继承命中，P1 §6.9 与 P2 §1.3 R6 均已预登记为预期）。
- 未发现遗漏的叶响应模型；`EntryBase`/`UserBase` 正确排除（若纳入反而会触发 CRITICAL 的表模型污染）。
- 唯一实质性改进建议是 `cli.py` 的 `apikey create/list`/`whoami` local-vs-remote 显示不对称（IN-1），**超出 P1 范围**，建议进 backlog 而非本任务回派。
