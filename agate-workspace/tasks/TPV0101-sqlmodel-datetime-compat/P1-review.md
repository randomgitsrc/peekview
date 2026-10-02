---
phase: P1
task_id: TPV0101
type: review
parent: P1-requirements.md
trace_id: TPV0101-P1-review-20261002
status: approved
created: 2026-10-02
agent: requirements-review
---

# P1 评审（round 2 重审）— TPV0101：sqlmodel 0.0.47 naive datetime 兼容修复

> 结论：**approved**。上轮 M1–M6 经**逐条正文核验**（不依赖 analyst 声称）**全部闭合**；另独立复核字段口径（ORM 枚举 25 列/11 表）、BDD 编号连续性、frontmatter 合规、无明显 NEED_CONFIRM/GAP。未发现新的阻塞问题。只审不改。

## 一、时效性与未决项核对（先行）

- **P0 时效性**：P0-brief 与 DEBT0019 均 2026-10-02 登记，P1 同日启动，无搁置间隔。核对三判据成立，**已核对无漂移**；正文 §0 显式写「无 `[P0_STALE]`」，非空白 — 通过。
- **[NEED_CONFIRM]**：正文 §8 `[NO_NEED_CONFIRM]`（L365），§1 头部亦有标记（L36）；全仓 grep 无未决 `[NEED_CONFIRM]` — 通过。
- **status: GAP**：`capability_requirements` 仅 `local-backend-runtime` = `available`；§6 显式「无 `[CAPABILITY_GAP]`」— 通过。
- **P1 纯净性**：依赖防回归手段（锁上限 vs CI 一致性检查）明确留待 P2，无实现代码 — 通过。

## 二、M1–M6 闭合确认（round 2 重审核心）

| # | 上轮要求 | 核验点（正文实测） | 判定 |
|---|---------|------------------|------|
| **M1** | §2.1 判定依据修正 + §4.1 补 aware 扫描面 | §2.1（L75-78）拆出三分类 **(a) 写入值 naive / (b) aware 但经 ORM 去时区 / (c) SQL 侧 CURRENT_TIMESTAMP**；表中每字段给出修正后的分类 + 实测代码行（`Entry.updated_at`→(b) `entry_service:817/857`；`Entry.expires_at`→(b) `:238/243/828/833`；`EntryShare.revoked_at`→(b) `:182/277`；`EntryStar.created_at`→(b) `:144`；`EntryTombstone.deleted_at`→(b)+(c) `:1058`；`TeamMember.joined_at`→(b)+(c) `:157`；`Team.updated_at`→(b) `:127`；`EntryRead`/`EntryReadStats`→(b) `read_tracking:47/60/74/114/115`）。§4.1 新增 `4.1.2 aware 写入点（b1–b22）`，逐条判「处理/不处理」，完整覆盖上轮评审 §四 漏扫清单（`entry_service`/`share_service`/`team_service`/`star_service`/`apikey_service`/`read_tracking_service` 各点） | ✅ **闭合** |
| **M2** | BDD-15 改可二值判定 | BDD-15（L188-194）Then 拆为两个可实跑断言：**(i) 守卫存在且可执行并返回成功；(ii) 人为注入漂移后重跑返回失败（变红）**；判定显式标注「实测（真实运行两次，记录前后退出码/输出），不接受推理」；未来防护降为「设计意图注记（非 BDD Then）」（L194） | ✅ **闭合** |
| **M3** | BDD-17 改可判定 | BDD-17（L203-207）降为 **API 序列化形态契约不变**（引用 BDD-7/8 可观测断言：逐字段相等）+ **显式范围外**（前端不跑测试、不做 PASS/FAIL）；MCP 补**可观测断言** (ii)（以同一 API 响应字符串驱动 `createEntry.ts:118-122`/`publishFiles.ts:550-552` 的 `new Date(expires_at)` 渲染，比较日期文本） | ✅ **闭合** |
| **M4** | BDD-1/BDD-9 Given 纳入 aware 场景 | BDD-1 Given（L111）含两条写入路径：(i) naive UTC 值（分类 a）、(ii) **aware `datetime.now(timezone.utc)` 值**（分类 b，举 `updated_at`/`expires_at`）；BDD-9（L154-157）专门覆盖**全部 aware 赋值路径**，显式列举 §4.1.2 b1–b19 命中点 | ✅ **闭合** |
| **M5** | BDD-16 扫描范围 | BDD-16（L196-199）改为「**全部表模型 datetime 列**」经 **ORM 枚举 `__table__.columns`：11 张 `table=True` 表共 25 个 datetime 列**，含 `Entry` 继承自 `EntryBase` 的 3 列；§4.2 给逐表分解，合计 25 列/11 表 | ✅ **闭合** |
| **M6** | capability 措辞 | `no-external-network` 条目**已移除**；改述为 `verification_env`（frontmatter L26 + §6 L348）：隔离 venv `/tmp/ci-repro-venv` 按 P0 重建步骤可得 + 沙箱无外网（CI 结果经 gh CLI 或隔离 venv 本地复现）；`available` 仅保留 `backend/.venv`（0.0.38） | ✅ **闭合** |

## 三、字段口径独立复核（25 列 / 11 表）

对 `backend/peekview/models.py` 做独立 ORM 级枚举（逐模型读 `table=True` 类的 datetime 字段 + 继承），结果：

| 表 | datetime 列数 | 实测行 |
|----|-------------|--------|
| User（含 UserBase.disabled_at） | 3 | 117,138,142 |
| Team | 2 | 178,182 |
| TeamMember | 1 | 218 |
| ApiKey | 4 | 238,239,240,244 |
| Entry（含 EntryBase 继承了 3 列） | 5 | 101,102,103 + 285,289 |
| EntryShare | 3 | 322,326,330 |
| EntryRead | 2 | 360,361 |
| EntryStar | 1 | 391 |
| EntryTombstone | 1 | 416 |
| EntryReadStats | 2 | 436,437 |
| File | 1 | 499 |
| **合计** | **25 / 11 表** | |

**与 §4.2 完全一致。** §2.1「无任何表列按 aware 存储」经核对成立——全部 25 处列定义均为裸 `datetime` 标注（无 `sa_column` 指定 tz-aware 类型）。M5 口径正确。

## 四、BDD 评审（18 条，编号连续 BDD-1…BDD-18）

- **BDD-1**: 数据✓ 边界✓ 兼容✓ — 可判定（naive/aware 双路径均不抛错 + UTC 时刻等价），**M4 已补 aware Given** — 通过。
- **BDD-2**: 数据✓ 边界✓ — 可判定（NULL↔naive），通过。
- **BDD-3**: 数据✓ 边界✓ — 可判定（naive WHERE 比较），通过。
- **BDD-4**: 兼容✓ — 可判定（0.0.38 不回归 + 无 `has no matching SQLAlchemy type`），通过。
- **BDD-5**: 数据✓ 兼容✓ — 可判定（0 failed 二元），通过。
- **BDD-6**: 数据✓ 边界✓ — 可判定（既有 naive 读出无时区漂移 + countdown），通过。
- **BDD-7**: 多端✓ 兼容✓ — 可判定（naive ISO 无 `+00:00`，字段名/可选性/类型不变），通过。
- **BDD-8**: 多端✓ 兼容✓ — 可判定（备份 JSON 与 CLI 形态不变），通过。
- **BDD-9**: 数据✓ 边界✓ — 可判定（全部 aware 赋值路径，**M4 已扩至 b1–b19**），通过。
- **BDD-10**: 数据✓ 兼容✓ — 可判定（restore merge+replace 往返一致），通过。
- **BDD-11**: 数据✓ — 可判定（running/paused/expired + 剩余天数），通过。
- **BDD-12**: 数据✓ — 可判定（admin 清理 + 禁用/启用），通过。
- **BDD-13**: 多端✓ — 可判定（CLI 禁用 + 时间展示），通过。
- **BDD-14**: 数据✓ 边界✓ — 可判定（幂等 + 不碰 user_version），通过。
- **BDD-15**: 数据✓ 兼容✓ — **M2 已改二值可实跑**（守卫存在+可执行 / 注入漂移变红），通过。
- **BDD-16**: 数据✓ — **M5 已改全表模型列 + 口径 25/11（经 ORM 枚举复核）**，通过。
- **BDD-17**: 多端✓ 兼容✓ — **M3 已降为 API 契约不变 + 显式范围外 + MCP 可观测断言**，通过。
- **BDD-18**: 边界✓ 兼容✓ — 可判定（生产 DB 未写 + :8080 未触碰），通过。

**BDD 跨条一致性**：BDD-6/7/8/9 同属序列化/存储语义面，Then 方向一致（naive 保持），无矛盾；BDD-15/16 同属防回归面，一为动态注入、一为静态扫描，互补无重叠冲突。测试环境约束（临时 HOME / 隔离 venv / 不碰生产）在 BDD-18 显式声明，合理。

## 五、同类扫描充分性

- §4.1.1 naive 写入点（分类 a）：14 行「本次处理」(#1–#14) + 2 行「不处理」(#15 `window_key` 字符串键 / #16 `fromisoformat` 解析)，逐条给判据。
- §4.1.2 aware 写入点（分类 b）：19 行「本次处理」(b1–b19) + 3 行「不处理」(b20 JWT / b21 统计窗口下界 / b22 备份时间戳字符串)。
- **合并结论**：二者在「裸列 → 显式 naive 列」修法下构成**同一 `process_bind_param` 命中面**，红灯须同时命中 (a)/(b)/(c) 三路径——正面回应 P0「面状缺陷不省略一半」。
- **实测抽查（本轮）**：逐点数核对代码行，全部与正文一致（entry_service:238/243/817/828/833/857/1058/1360；share_service:60/89/172/182/209/239/269/277/296；team_service:127/157；star_service:39-42/92/144；apikey_service:66/118/121/151/152/175/206；read_tracking:47/60/74/114/115/248/261；admin_service:72-75/158/225/264/279-282/428/967/1009/1083-1084/1106/1257；database:754-755；cli:1799；auth:112）。
- **迁移 SQL 覆盖确认**：`database.py` grep `DATETIME` 恰 **8 处**（L89/102/117/137/164/243/244/251），与 §4.1 声明一致，判定「列类型正确，问题在 ORM 映射层」合理。
- **§4.3/§4.4**：MCP（无自有 ORM 时间列，经 API 消费）/ 前端（只消费字符串）/ 迁移 SQL 判定合理；结论「会复发」+ 拦截方向正确。
- 本任务**不新增/改名 `agate/scripts/` 文件**，不触发登记面实测要求 — 声明正确。

## 六、隐含需求覆盖

- **数据维度**：格式/边界/NULL/迁移 — 覆盖（BDD-2/6/14/16）。
- **前端维度**：BDD-17 显式范围外，判据已可执行（API 契约不变）— 覆盖。
- **多端维度**：API 契约 (BDD-7/8)、MCP (BDD-17 可观测断言)、CLI (BDD-8/13) — 覆盖。
- **边界维度**：NULL (BDD-2)、时区 (BDD-6)、幂等 (BDD-14)、CLI 禁用 (BDD-13)、**aware↔naive 混用 (BDD-1/BDD-9)** — 覆盖（上轮遗漏已补）。
- **兼容维度**：0.0.38 不回归 (BDD-4/5)、序列化形态 (BDD-7/8)、既有数据读出 (BDD-6) — 覆盖。

## 七、裁剪 / 能力 / frontmatter 评审

- `risk_level: high`：与 schema 映射 + 数据语义 + 跨子系统 + 25 列 11 表匹配 — 合理。
- `phases: [P1..P8]` 全走，无裁剪；跳过风险注释说明 P3（真红灯）/P6（schema/数据语义/多端）不可裁 — 理由充分。
- `domains: [backend]`、`packages: [peekview]`、`change_type: refactor` — 恰当。
- **无 `ui_render_shape` / `ui_ux_dimensions`**：本任务无 UI 改动，缺失正确（不触发 vision 硬拦）。
- `capability_requirements`：`local-backend-runtime` = `available`（`backend/.venv` 0.0.38）— 合理；`verification_env` + `verification_env_budget` 声明完整（止损轮次 2，独立计数）。
- **审声明 vs diff 证据**：本阶段仅产出 P1 文档（暂存区无代码 diff），`change_type: refactor` 指向 P4 将产生的改动类型，与纯文档 P1 不矛盾 — 通过。

## 八、验证证据（本评审实测）

- `models.py` ORM 枚举：11 张 `table=True` 表 **25 个 datetime 列**（含 `Entry` 继承 `EntryBase` 的 `expires_at`/`archived_at`/`archive_delete_at`）— 与 §4.2 一致。
- 代码行核对：M1 引用的 naive/aware 写入点全部与源码一致（逐点数见 §五）。
- 迁移 SQL：`database.py` `DATETIME` 恰 8 处，与 §4.1 一致。
- 依赖声明：`backend/pyproject.toml:28` `sqlmodel>=0.0.14`（无上限）— 与 §4.3/§4.4 一致。
- MCP 消费点：`createEntry.ts:121` / `publishFiles.ts:551` 的 `new Date(entry.expires_at)` 存在，BDD-17 (ii) 锚点真实。
- BDD 锚点：`#### BDD-1:` … `#### BDD-18:` 共 18 条，编号连续不跳号。

## 九、剩余非阻塞建议（可选，不阻 P2）

1. §4.1.1 #15 的 `window_key` 字符串窗口键（`read_tracking_service.py:48` + `:248 fromisoformat`）判「不处理」，建议 P2 影响面梳理时显式收口其比较逻辑不受 0.0.47 影响（上轮 WARNING 项，analyst 已在表格中给理由，可接受）。
2. BDD-15 落地的具体守卫形态（锁上限 vs CI 一致性检查）留待 P2 — 已在 §4.4 声明取舍在 P2 定，符合 P1 纯净性。

## 十、结论

**status: approved**。round 2 修订逐条闭合 M1–M6：判定依据三分类 (a)/(b)/(c) 修正 + §4.1.2 aware 扫描面补齐；BDD-15 二值可实跑；BDD-17 降为 API 契约 + 显式范围外 + MCP 可观测断言；BDD-1/9 纳入 aware 场景；BDD-16 全表模型列 + 口径 25/11（本轮独立 ORM 枚举复核一致）；`no-external-network` 改述为 `verification_env`。**M1–M6 闭合确认**；字段口径、BDD 编号连续性、frontmatter 合规、NEED_CONFIRM/GAP 均无问题。未发现新阻塞项。可进入 P2。
