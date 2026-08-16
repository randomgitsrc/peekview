---
phase: P2
task_id: TPV0093-star-lifecycle
type: design
parent: P1-requirements.md
trace_id: TPV0093-P2-20260816-r3
status: draft
created: 2026-08-16
agent: architect
# ── v2.0 机器字段 ──
candidate_count: 6
packages: [backend/peekview, frontend-v3]
domains: [backend, frontend, security]
ui_affected: true
dispatch_plan: {mode: static-batch, parallel_limit: 2, batches: [{id: backend, complexity: high}, {id: frontend, complexity: high}]}
---

# P2 方案设计 — 星标功能与内容生命周期管理（TPV0093）— 修订版 r3

> 修订说明：本版为 r3（极小修订，单点守卫），闭合 P2-review-eng.md r2 的 BLOCKER-4（§4.3 archived 分支恢复显式匿名守卫）+ N8（非 archived 分支收紧）+ N9（P3 补「转私有后取消星标仍 200」用例）。r2 已闭合 3 BLOCKER + N1-N7 + 设计评审 6 项。
> 修订标记：`[r3]` 前缀行（本轮修订）；`[r2]` 为上一轮修订标记（保留）。§7 同步新增 P3 用例（BLOCKER-4/N9 检测场景）。

## 0. 设计摘要

将星标（EntryStar）与墓碑（EntryTombstone）作为**独立于 entry 生命周期**的持久化实体；归档删除倒计时改造为**绝对到期点 `archive_delete_at`**（暂停=清理跳过，恢复=零重算）；决策 A（archived 星标用户可读）在 `EntryService.get_entry` 单点扩展（**archived 短路 is_public 前置检查**，BLOCKER-1 修复），download/raw/content/render/短链全部同源继承（已读代码证实）；前端在现有 Explore tabs + EntryCard/EntryDetailHeader 模式上加 Starred tab、详情页星标按钮（桌面 header + 移动端底部栏双落点）、独立星标管理页与作者豁免标签。

## 1. 候选方案与权衡

> `candidate_count: 6`，正文 6 个候选（A-F，3 对真替代），前后一致。

### 候选方案 A（采用）：绝对到期点列 `entries.archive_delete_at`（倒计时暂停/恢复）

**做法**：归档时（`cleanup_expired` 的 active→archived 转换）设置 `archive_delete_at = now + archive_retention_days`。清理删除判定改为 `status==archived AND 星标数==0 AND archive_delete_at <= now`。**暂停 = 清理跳过星标条目且不动 deadline（绝对时间点在时间轴上天然冻结）；恢复 = 无需任何重算**，星标移除后清理按原 deadline 判定：剩余>0 走缓冲期、剩余≤0 下个周期删除。

**优点**：零漂移（无"剩余秒数快照"重复计算）；BDD-9/10 的"恢复剩余倒计时"变成对绝对 deadline 的纯比较，状态机简单；迁移 D5 只需一个 backfill（存量 archived 设 `archive_delete_at = 上线日 + retention`）。

**风险/工作量**：需新增列 + 迁移 + 清理逻辑重构（中量）；与现有 `archived_at` 判定并存需定义兜底（见 §4）。

**关键正确性论证（最小验证 D 节证实）**：星标 120 天后取消 → `remaining=(deadline-now)<0` → 立即入删除队列 ✓；星标 30 天后取消 → `remaining>0` → 缓冲期 ✓。与 P0 known_risk「避免重复计算漂移」直接对应。

### 候选方案 B（备选）：剩余秒数快照 + 暂停点（`countdown_remaining_seconds` + `countdown_paused_at`）

**做法**：暂停时写剩余秒数，恢复时 `deadline = now + remaining_seconds`。

**优点**：状态显式、"暂停时冻结剩余天数"字面贴合。

**缺点（决定性）**：3 个列 + 恢复时的重算与写回；每次取消星标都要计算并更新 deadline，漂移风险点在"重算时刻的 now"与清理任务的 now 不一致；多一列就多一条迁移与测试路径。真正的替代方案在"省去状态回写"这一维度上并不优于 A——A 的 deadline 语义对清理与对用户展示完全同源。

**选择理由**：A 用「绝对时间点」同时满足「冻结」「恢复」「展示剩余天数」三件事，B 需要额外机制达到同等效果，且 B 的写回路径正是 P0 known_risk 点名的漂移源。取 A。

### 候选方案 C（采用）：星标/墓碑实体设计 — 墓碑即时绑定（tombstone_id），entry_id 为无 FK 纯整型

**做法**：
- `EntryStar`：`entry_id`（**纯 INTEGER，无 FK**，D3 硬约束，最小验证 B 节证实 FK 无 ondelete 会拦截 entry 删除）+ `user_id`（FK→users.id ON DELETE CASCADE，账号删除自动清星标）+ `tombstone_id`（可空，无 FK）+ `created_at`；部分唯一索引 `UNIQUE(entry_id,user_id) WHERE tombstone_id IS NULL`（防刷量与墓碑共存，最小验证 C 节证实）。
- `EntryTombstone`：`entry_id`（快照参考，不参与查找）+ `slug` + `title`（=entry.summary 快照）+ `cover`（保留列置 NULL，适配 D7）+ `deleted_by`（**username 文本快照，非 FK**，D8）+ `deleted_at` + `reason`（保留枚举 `expired|author_deleted`，运行期仅产出 `author_deleted`，E7）。
- 删除入口（`delete_entry` / `delete_entry_by_api_key` 统一走私有 `_delete_with_tombstone`）：entry 有 ≥1 活星标 → 建墓碑 → `UPDATE entry_stars SET tombstone_id=:tid WHERE entry_id=X AND tombstone_id IS NULL`（同一事务，原子绑定）。
- 墓碑清理：移除某墓碑绑定的最后一条星标时删除该墓碑；`delete_user` 后 + `cleanup_expired` 内做孤儿墓碑清扫兜底。

**优点**：**墓碑↔星标通过 tombstone_id 显式绑定**，彻底规避 SQLite 无 AUTOINCREMENT 的 rowid 复用误关联（最小验证 A 节证实：删除最大 id=5 后新插入会复用 id=5）；星标跨 entry 删除存活（D3）；账号删除路径语义闭环（E10）。

**风险/工作量**：删除路径多一步 UPDATE；`delete_user` 需补孤儿墓碑清扫。都已在候选内覆盖。

### 候选方案 D（备选）：墓碑按 entry_id/slug 关联，不建 tombstone_id 绑定

**做法**：墓碑只存 entry_id+slug，星标仍按 entry_id 关联；墓碑清理 = `COUNT(stars WHERE entry_id=X) == 0`。

**缺点（决定性）**：rowid 复用后（最小验证 A 证实实际发生），新 entry 复用旧 id 会与墓碑残留星标**误关联**——老墓碑星标被算进新 entry 的计数，甚至新 entry 的 Starred 列表出现幽灵条目。需要额外按 slug 快照比对来防御，复杂度反而高于显式绑定。

**选择理由**：C 的"删除时一次性绑定"把关联关系固化在事务内，读写双方都无歧义；D 的关联依赖 entry_id 存活期，恰被 rowid 复用破坏。取 C。

### 候选方案 E（采用）：权限扩展点 — `EntryService.get_entry` 单点 + `is_starred` 内联查询

**做法**：`get_entry` 重构为「archived 短路 is_public → 判定仅由「状态+星标」组成」；星标存在性用同一 session 内一条 EXISTS 查询（`_has_live_star`），无 N+1。

**优点**：详情 API（entries.py get_entry）、raw（resolve_entry_raw）、文件 content/download/render（files.py `_resolve_entry`）、download zip、短链 302（main.py → resolve_entry_raw）——已读代码证实全部收敛到 `get_entry` 判定，**一处修改全路径继承**（决策 A + REV-4 同源继承）。share 通道（`get_entry_with_share`/`_check_share_cookie`）不改，BDD-28 现状即满足（archived 时 expires_at=None，share 校验不查归档状态）。

**风险**：需注意 star 用户对 archived 的列表可见性——仅"我的星标"列表（新 `starred=true` 过滤）与详情读取扩展，全局列表不向星标用户开放 archived（保持现状防枚举）；防 slug 枚举语义不破坏（非星标仍 404）。

### 候选方案 F（备选）：archived 判定改为"星标用户可见"并放开列表

**做法**：archived 条目对任何登录用户列表可见（类似 owner 视角），细节开放。

**缺点（决定性）**：直接破坏 C2 防枚举（任意登录用户可枚举全部 archived slug）；与 BDD-16「非星标 404」冲突；违反 P1 决策 A「非星标不可见」。

**选择理由**：E 精确实现 P1 基线，F 过度放开。取 E。

> 说明：6 个候选（A/B、C/D、E/F）构成三对真替代。A/C/E 为采用方案，B/D/F 各自在某一维度（字面贴合度 / 无事务绑定 / 列表开放性）形式上更简单但引入确定性缺陷，故否决。

## 2. 影响域

### 2.1 改什么

| 文件 | 改动 |
|------|------|
| `backend/peekview/models.py` | 新增 `EntryStar`、`EntryTombstone` 表模型；`Entry` 加 `archive_delete_at` 列；`EntryResponse`/`EntryListItem`/`EntryListResponse` 加 `star_count`/`is_starred`/`countdown`/`tombstone` 字段与新 schema（`StarResponse`、`StarListResponse`、`TombstoneResponse`、`CountdownInfo`） |
| `backend/peekview/database.py` | `_run_migrations`：`ALTER TABLE entries ADD COLUMN archive_delete_at` + entry_stars/entry_tombstones 表 IF NOT EXISTS 兜底；`_setup_indexes`：部分唯一索引；**新增 `backfill_archive_delete_at(engine, retention_days)` 数据幂等 backfill**（`main.py` 启动时调用，与 `backfill_fts_content` 同模式）——[r2] 不再复用 `PRAGMA user_version`（BLOCKER-3） |
| `backend/peekview/services/entry_service.py` | `get_entry` 归档分支**短路 is_public 前置检查**，判定仅由「状态+星标」组成（决策 A，BLOCKER-1）；`delete_entry`/`delete_entry_by_api_key` 接入 `_delete_with_tombstone`；`list_entries` 支持 `starred=true` 过滤 + 每项附 `star_count`/`countdown`；`update_entry` **两条 reactivation 路径都清 `archive_delete_at`**（[r2] N2：expires_in 路径 :586-594 与 status 参数路径 :604-605） |
| `backend/peekview/services/admin_service.py` | `cleanup_expired`：归档转换写 `archive_delete_at`；删除判定加星标豁免 + deadline；`delete_user` **先删用户行（星标 CASCADE）→ commit → 再孤儿墓碑清扫**（[r2] N1 顺序约束） |
| `backend/peekview/services/star_service.py`（新） | `star`/`unstar`/`unstar_batch`/`get_star_count`/`is_starred`/`list_starred`/`cleanup_orphan_tombstones`；`star` 捕获 IntegrityError → `{created:false}`（[r2] N7） |
| `backend/peekview/api/entries.py` | 新增 `POST/DELETE /{slug}/star`（**POST 先经 `get_entry` 可读验证，不可读 404**，BLOCKER-2）；`list_entries` 接受 `starred` 查询参数 |
| `backend/peekview/api/stars.py`（新） | `GET /api/v1/stars`（我的星标，含墓碑卡片）、`DELETE /api/v1/stars`（批量移除） |
| `backend/peekview/main.py` | app factory 注册 `star_service` 到 `app.state`；启动时调 `backfill_archive_delete_at(engine, config.cleanup.archive_retention_days)`（BLOCKER-3） |
| `backend/peekview/auth.py` | 无改动（`require_auth` 复用） |
| `frontend-v3/src/types/index.ts` + `api/types.ts` | `Entry` 加 `starCount`/`isStarred`/`countdown`；`ListEntriesParams` 加 `starred`；新增 `StarItem`（entry|tombstone 联合）类型 |
| `frontend-v3/src/api/client.ts` | 新增 `star`/`unstar`/`listStars`/`removeStars`；**`transformListItem`/`transformEntry`（:43-92）补 `star_count`→`starCount`、`is_starred`→`isStarred`、`countdown`→`countdown` 映射**（[r2] design-4） |
| `frontend-v3/src/stores/entryDetail.ts` + 新 `stores/star.ts` | 详情页星标状态 + 乐观更新/回滚；管理页列表状态 |
| `frontend-v3/src/views/EntryListView.vue` | 加 Starred tab（`currentStarred` 状态 + `starred=true` 参数传递 + setFilter/restoreFromURL/onBeforeRouteUpdate/emptyStateHeading 多点耦合，[r2]） |
| `frontend-v3/src/views/StarManageView.vue`（新）+ `router.ts` | 独立管理页 `/stars`：分类 tab / 红色倒计时 / 墓碑卡片 / 批量移除 / "管理失效内容"；**三态（空/加载/错误）+ 批量按钮禁用 + 移除前确认**（[r2] design-2） |
| `frontend-v3/src/components/EntryDetailHeader.vue` | title-row actions 区加星标按钮 + 计数（`aria-pressed`/`aria-label`，沿用 toggle-btn 模式，[r2] a11y） |
| `frontend-v3/src/components/EntryDetailMobileBar.vue` | **[r2] 底部栏加 star 按钮（`mobile-star-toggle`）**，复用 toggle-btn 模式；或 OverflowMenu sheet 兜底（design-1） |
| `frontend-v3/src/components/StarToggle.vue`（新） | 可复用星标按钮（乐观更新 + 失败回滚 + 归档 Toast 双文案 + 重复星标 Toast action 跳转） |
| `frontend-v3/src/components/EntryCard.vue` + `EntryListRow.vue` | 作者视角 archived 卡片：星标豁免标签（含 N，**footer 渲染条件扩展 + 与 BaseBadge 互斥**）+ ❓可点击 + 强制删除二次确认（明示 N） |
| `frontend-v3/src/components/Toast.vue` + `composables/useToast.ts` | **[r2] 支持可选 `action`（label + to）——E1 跳转入口选型：扩展 Toast 能力**（design-3） |

### 2.2 不改什么（明确边界）

- **share 授权通道**（`share_service.py`、`get_entry_with_share`、`_check_share_cookie`、files `_resolve_entry` share 兜底）：零改动，BDD-28 由回归测试保护。
- **MCP**（`packages/mcp-server/`）：零改动（M3 行为继承：raw/list/delete 走既有 API/服务层，已读代码核实 delete 走 `delete_entry_by_api_key` → 自动带墓碑）。
- **CLI**：零改动（M2：`peekview admin cleanup` 调 `AdminService.cleanup_expired`，`peekview delete` 调 `delete_entry`，行为继承）。P5 需回归验证。
- **FTS5/搜索/读统计/备份恢复主流程**：不动（备份 restore 影响见 [SCOPE+]）。**[r2] `PRAGMA user_version` 维持 FTS 独占，星标 backfill 不触碰它**（BLOCKER-3）。
- **认证三层**、**rate limit**、**CSP**：不动。
- **`EntryTombstone.cover`**：列存在但恒 NULL，墓碑卡片以 summary+状态标记渲染（D7 适配）。
- **列表全局可见性**：archived 不向星标用户开放全局列表（仅"我的星标"与详情/raw/文件读取扩展，见 候选 E 风险）。
- **`PRAGMA user_version`**：**[r2]** 版本号继续由 FTS 独占（FTS_VERSION=2），本次不新增任何 user_version 门控（BLOCKER-3）。

### 2.3 风险在哪

| 风险 | 缓解 |
|------|------|
| 清理逻辑回归（active→archived 转换、无星标归档删除） | cleanup 改造保留原 active→archived 逻辑；无星标且 deadline 过期的删除路径不变；`archive_delete_at` NULL 时兜底走 `archived_at` 旧判定 |
| rowid 复用导致墓碑误关联 | tombstone_id 事务内绑定（最小验证 A/B/C 证实） |
| `delete_user` 删作者行 → 其星标 CASCADE 消失 → 墓碑悬挂 | **[r2] 顺序约束：`session.delete(user)` 提交（CASCADE 生效）→ 之后执行孤儿墓碑清扫**；cleanup 双兜底（N1） |
| 星标用户读 archived 泄露 slug | 非星标仍 404，仅"状态+星标"判据（E6 原则）；列表不放开 |
| **[r2] star 端点自授权绕过（BLOCKER-2）** | POST star 先经 `get_entry` 可读验证，不可读 404；非公开 entry 仅 owner/admin 可星标；语义写入 API 契约 §4.6 |
| **[r2] 存量 archived 上线首日被清（BLOCKER-3）** | 数据幂等 backfill（`archive_delete_at IS NULL` 条件重跑），不依赖 user_version；P6 实测 BDD-27 |
| **[r2] update_entry 漏清 archive_delete_at（N2）** | 双 reactivation 路径（expires_in + status 参数）都清字段；P3 两条路径用例 |
| **[r2] star 并发重复 INSERT 500（N7）** | 部分唯一索引 + catch IntegrityError → `{created:false}` 幂等分支 |
| **[r2] 星标后转私有的 active 条目在用户自己星标列表隐藏（N4）** | 语义保持（is_public/owner/archived 可见性过滤与读取一致），前端管理页空态/文档化提示"部分条目因权限不可见" |
| **[r2] 时区混用（N5）** | `archive_delete_at` 沿用 naive UTC 约定（cleanup_expired `now_naive` 同式）；比较与展示单位统一 |
| 前端状态发散（详情页/列表/tab 三处计数） | 星标计数以服务端响应为准；乐观更新以 rollback 兜底 |
| 迁移 backfill 误删存量 archived | 数据幂等 backfill（每次启动重跑，仅 NULL 行受更新）+ P6 实测 BDD-27 |
| MCP/CLI 行为继承破坏 | P5 回归 CLI cleanup 与 MCP get/list/delete 路径 |
| **[r2] Toast 扩展 action 的回归（design-3）** | action 为可选参数（缺省不渲染），既有 Toast 调用零改动；P3_frontend 补 useToast action 用例 |

## 3. 数据模型设计

```text
entries（新增列）
  archive_delete_at  DATETIME NULL   -- 归档删除绝对到期点（= archived_at + retention；星标暂停不动）

entry_stars（新表）
  id          INTEGER PK
  entry_id    INTEGER NOT NULL       -- 纯整型，无 FK（D3：跨 entry 删除存活）
  user_id     INTEGER NOT NULL FK->users.id ON DELETE CASCADE, INDEX
  tombstone_id INTEGER NULL          -- 删除时绑定墓碑；无 FK
  created_at  DATETIME NOT NULL
  INDEX (entry_id), INDEX (user_id), INDEX (tombstone_id)
  UNIQUE INDEX ux_live_star ON (entry_id, user_id) WHERE tombstone_id IS NULL   -- 防刷量；墓碑共存
  （不建 EntryStar↔Entry relationship，避免 ORM cascade 干扰）

entry_tombstones（新表）
  id          INTEGER PK
  entry_id    INTEGER                -- 快照参考，不参与查找
  slug        TEXT NOT NULL          -- 快照
  title       TEXT NOT NULL          -- = entry.summary 快照
  cover       TEXT NULL              -- 恒 NULL（D7）
  deleted_by  TEXT NOT NULL          -- username 文本快照，非 FK（D8）
  deleted_at  DATETIME NOT NULL
  reason      TEXT NOT NULL DEFAULT 'author_deleted'   -- 保留枚举，运行期仅 author_deleted（E7）
```

## 4. 服务层设计

### 4.1 `cleanup_expired` 重写（admin_service.py:240-308）

```
1. active→archived（不变）：status=archived, archived_at=now, expires_at=None
   新增：archive_delete_at = now + archive_retention_days
2. 删除判定（替换 archived_at<=cutoff）：
   WHERE status=archived
     AND NOT EXISTS (SELECT 1 FROM entry_stars s WHERE s.entry_id=entries.id AND s.tombstone_id IS NULL)   # 星标豁免
     AND (archive_delete_at IS NOT NULL AND archive_delete_at <= now
          OR archive_delete_at IS NULL AND archived_at IS NOT NULL AND archived_at <= cutoff)               # NULL 兜底
3. 删除：delete_entry_by_api_key() → 无星标 → 纯删除，不建墓碑（reason=expired 运行期不可达，E7 ✓）
4. 孤儿墓碑清扫：DELETE FROM entry_tombstones WHERE id NOT IN (SELECT DISTINCT tombstone_id FROM entry_stars WHERE tombstone_id IS NOT NULL)
```

### 4.2 删除路径（entry_service.py，私有 `_delete_with_tombstone`）

`delete_entry` / `delete_entry_by_api_key` 均改调它（同一事务）：

```
1. 读 entry；若 entry_id 存在活星标（tombstone_id IS NULL）：
   a. 建 EntryTombstone(slug, title=entry.summary, deleted_by=指定用户名|entry.owner.username|"unknown", reason='author_deleted')
   b. UPDATE entry_stars SET tombstone_id=:tid WHERE entry_id=:id AND tombstone_id IS NULL
2. session.delete(entry)（files/shares 由现有 relationship cascade 处理；entry_stars 无 relationship，plain int，不受影响）
3. 提交后清 reads + storage.delete_entry_files（现状保留）
```

`deleted_by` 取值：JWT 删除路径传入 current_user.username；API-key/清理路径无用户 → 用 entry.owner 的 username 快照（D8 语义=作者身份）。

### 4.3 `get_entry` 权限扩展（决策 A）— [r2] BLOCKER-1 修复

**重构判定顺序：archived 分支短路 is_public 前置检查**（现 entry_service.py:341 先于 :344-349，会拦截 archived+private+星标读取）。改为：

```
if entry.status == EntryStatus.ARCHIVED:
    # 决策 A：archived 判定仅由「状态+星标」组成，与 is_public 解耦（短路 line 341）
    # [r3] BLOCKER-4：显式匿名守卫——ownerless legacy archived（owner_id IS NULL）下
    #       None != None 为 False 会把整个 raise 条件短路为不 404（匿名可读回归）；
    #       保留现有代码 entry_service.py:346-347 的「匿名 + 非 admin → 404」守卫
    if not is_admin and current_user_id is None:
        raise NotFoundError
    if not is_admin and entry.owner_id != current_user_id and not _has_live_star(session, entry.id, current_user_id):
        raise NotFoundError
else:
    # 非 archived：保留现有 is_public 可见性模型（E6）
    # [r3] N8：收紧 ownerless + 私有 active + 匿名（None==None 短路）的既有可读漏洞
    #       （现有代码 :341 同样存在，本任务正重构此函数，顺手修复）
    if not entry.is_public and not is_admin and (current_user_id is None or entry.owner_id != current_user_id):
        raise NotFoundError
```

`_has_live_star` = 同一 session `EXISTS(SELECT 1 FROM entry_stars WHERE entry_id=? AND user_id=? AND tombstone_id IS NULL)`。匿名（user=None）→ 被 [r3] 显式守卫拦截 → archived 404（BDD-16/E8 不变）；ownerless archived 匿名同 404（BLOCKER-4，防 slug 枚举 C2）。

**关键链路（P3 用例）**：公开 entry → 用户星标 → owner 转私有（update_entry，仍 active）→ 过期归档（archived+private+星标）→ 星标用户经短路分支 200 ✓；非星标用户 404 ✓。

### 4.4 `list_entries` 扩展

- 新参数 `starred: bool`：`current_user` 必填，过滤 `EXISTS(活星标)`，**跳过默认 `status != ARCHIVED` 排除**（active+archived 均含，BDD-18）；可见性过滤 `is_public OR owner==me OR status==archived`（决策 A 读取判据一致，防列不可读私有条目；archived 星标条目在列内可读）。
- `EntryListItem` 每项附 `star_count`（子查询 COUNT）、`is_starred`（当前用户）、`countdown`（archived 时按 `archive_delete_at` 计算，星标时 status=paused）。

### 4.5 StarService 接口（新，DI 入 app.state）— [r2] BLOCKER-2/N7/N4

| 方法 | 行为 |
|------|------|
| `star(entry_id, user_id)` | INSERT（部分唯一索引兜底）；**[r2] try/except IntegrityError（并发重复）→ rollback → 读现有行 → 返回 `{created:false, created_at}`**（N7，BDD-2 并发异常路径）；已存在（非并发）→ 同样 `{created:false}`；未登录由路由层拦截（BDD-4）。**[r2] 路由层负责前置可读验证（BLOCKER-2），本方法不做授权** |
| `unstar(entry_id, user_id)` | 删活星标；若该行带 tombstone_id → 删后 `COUNT(tombstone_id)==0` 则删墓碑（BDD-13/22） |
| `unstar_batch(user_id, entry_ids)` | 批量删星标 + 墓碑联动（BDD-22） |
| `get_star_count(entry_id)` | COUNT 活星标 |
| `is_starred(entry_id, user_id)` | EXISTS 活星标 |
| `list_starred(user_id, page, per_page, filter)` | 返回 `StarItem[]`：活 entry（附 star/countdown，**可见性过滤 `is_public OR owner==me OR status==archived`，与读取一致**，[r2] N4：星标后转私有的 active 条目会从用户自己列表隐藏，星标仍在、豁免与计数仍在——前端空态提示"部分条目因权限不可见"）∪ 墓碑卡片（无正文）；`filter∈{all,active,expiring,expired}` 分类（BDD-20/21 见 §6 前端） |
| `cleanup_orphan_tombstones()` | 见 §4.1 步骤 4；**[r2] 供 `delete_user` 在用户行删除提交后调用（N1 顺序约束）** |

### 4.6 API 契约（M1）— [r2] BLOCKER-2 语义写入

| 端点 | 鉴权 | 前置验证 | 语义 |
|------|------|----------|------|
| `POST /api/v1/entries/{slug}/star` | require_auth | **[r2] 先经 `get_entry(slug, current_user_id, is_admin)` 可读验证：不可读（含 archived 非星标、非公开非 owner）→ 404，拒绝建星标（防自授权绕过 + 防 slug 探测）** | 返回 `{star_count, is_starred:true, created_at?, already_starred}` |
| `DELETE /api/v1/entries/{slug}/star` | require_auth | 仅需 entry 存在（按 slug 查 entry_id；不存在 404） | 返回 `{star_count, is_starred:false}` |
| `GET /api/v1/stars?filter=&page=&per_page=` | require_auth | — | 我的星标（活 entry + 墓碑卡片），供 Starred tab 与管理页 |
| `DELETE /api/v1/stars` body `{entry_ids:[...]}` | require_auth | — | 批量移除（含墓碑清理，BDD-22） |
| `GET /api/v1/entries?starred=true` | 需登录 | — | Starred tab 列表复用现有列表 API（C1 向后兼容增量） |

**授权语义（BLOCKER-2 契约行）**：star 是"留存契约"的建立动作，**只允许对当前用户可读的 entry 建立**——可读性 = `get_entry` 完整判据（is_public/owner/admin/archived+星标）。非公开（active 私有）entry 仅 owner/admin 可星标；archived 私有 entry 仅 owner/admin/已星标者（已星标者重复请求走 `already_starred`）。该语义由 P3 用例「非 owner 对私有/archived slug 星标 → 404」与「未知 slug → 404」固化。

响应字段（增量，C1）：`star_count`、`is_starred`、`countdown: {status: paused|running|expired, remaining_days, archive_delete_at} | null`、墓碑卡片 `{type:"tombstone", ...}`。

## 5. 迁移与 backfill（D5/BDD-27）— [r2] BLOCKER-3 重写

> **决策：不复用 `PRAGMA user_version`**（已被 FTS 占用，`FTS_VERSION=2`，`backfill_fts_content` 读写该版本号）。改为**数据幂等 backfill**，每次启动重跑，天然满足「上线日起算」，且不会反向污染 FTS（写 user_version 会触发 FTS 误重建）。

```
`_run_migrations`（database.py，结构迁移，与版本无关）：
1. entries 缺 archive_delete_at → ALTER TABLE entries ADD COLUMN archive_delete_at DATETIME DEFAULT NULL
2. entry_stars / entry_tombstones 表不存在则建（IF NOT EXISTS，兜底旧 DB；新 DB 由 create_all 覆盖）
3. 部分唯一索引 → _setup_indexes（幂等 CREATE UNIQUE INDEX IF NOT EXISTS ... WHERE tombstone_id IS NULL）

`backfill_archive_delete_at(engine, retention_days)`（database.py 新函数，main.py 启动时调用，与 backfill_fts_content 同模式）：
4. 数据幂等：
   UPDATE entries SET archive_delete_at = :launch_ts + :retention_days
   WHERE status='archived' AND archive_delete_at IS NULL
   （launch_ts = 本次执行时刻 = 功能上线日；每次启动重跑幂等——已设值行不再命中条件；
     新归档条目在 cleanup 转换时已写非 NULL 值，天然不受影响；无版本号写入）
```

**P3 检测用例（BLOCKER-3 回归锚）**：存量库 `PRAGMA user_version` 已被 FTS 置 2 → 升级（跑迁移 + backfill）→ 存量 archived 全部 `archive_delete_at` 非 NULL（= 上线日 + retention）→ `user_version` 仍为 2（FTS 未误重建）→ backfill 再跑一次结果不变（幂等）。

## 6. 前端设计

### 6.1 详情页星标按钮（F1/F2/E1/BDD-1/2/3/4/6/23）

- **双落点**：
  - 桌面：`StarToggle` 挂 `EntryDetailHeader` title-row actions 区（匿名 → 点击弹 LoginDialog，BDD-4/E8）。
  - **[r2] 移动端：`EntryDetailMobileBar` 底部栏加 star 按钮（`data-testid="mobile-star-toggle"`），复用 toggle-btn + toggle-badge 模式（badge 显示 star_count）；如底部栏空间不足 → 落入 OverflowMenu sheet 条目（design-1）**。
- 乐观更新：点击先 `+1/-1` + `isStarred` 翻转；请求失败回滚（BDD-6）；成功以服务端 `star_count` 校准。
- 重复星标：后端 `already_starred` → Toast「已于 X 月 X 日星标」+ **[r2] Toast action「查看星标」→ 跳转 `/?starred=1`（E1/BDD-2 跳转入口选型：扩展 useToast 可选 `action:{label,to}`，缺省不渲染，既有调用零改动）**（design-3）。
- 归档 Toast（F2/BDD-23）：**[r2] 双文案区分**——`status==='active' && 距 expires_at < 7d` → 「该内容将于 X 月 X 日归档，星标后可长期保存」；`status==='archived'` → 「该内容已归档，星标后可长期保存」（design-6，已归档条目 expires_at=None 不适用"将于"文案）。
- hover tooltip「N 人认为值得收藏」（§4.1）+ **[r2] ❓/tooltip 可点击（触屏兜底）**。
- **[r2] a11y：星标按钮 `aria-pressed` + `aria-label="收藏该内容"`（沿用 header toggle-btn 模式，EntryDetailHeader.vue:30/33）**。

### 6.2 Explore Starred tab（F3/BDD-18/19）— [r2] 补充建议 1/4

- EntryListView 现有 `owner-tabs` 加第 4 个 tab `[Starred]`（`showTabs` 已登录可见，BDD-19 匿名不显示）。
- **`Starred` 与 `owner`/`status` 过滤互斥**：`setFilter` 三态签名扩为 `(owner, status, starred)`；`currentStarred===true` 时忽略 owner/status（BDD-18 语义 active+archived 均含）。
- URL 态：`?starred=1`；**[r2] 点名耦合触点（补充建议 4）**：`restoreFromURL`（EntryListView.vue:458）、`onBeforeRouteUpdate`（:486）、`emptyStateHeading`（:282，加 `starred` 分支文案）、`setFilter`（:340）。P4 须同步这 4 处，不能只加状态。
- **[r2] Starred tab 只含活 entry、不含墓碑（补充建议 1）**：`starred=true` 列表只查 entries 表；墓碑仅出现在管理页（`GET /api/v1/stars`）。BDD-18 只验收 entry。
- **[r2] Starred tab 空态文案**：`emptyStateHeading` 加 `starred` 分支 → 「暂无星标内容」。

### 6.3 星标管理页（F4/BDD-20/21/22/14）— [r2] design-2 + 补充建议 2

- 新路由 `/stars` + `StarManageView.vue`（router guard 登录，同 `/settings` 模式）；移动端沿用 SettingsView mobile-stacked 范式。
- **[r2] filter 语义表（补充建议 2 固化）**：

| filter | 含义 | BDD-20 分类 |
|--------|------|-------------|
| `all` | 全部星标（活 entry + 墓碑） | 全部 |
| `active` | 有效星标（活 entry，非即将失效、非已失效） | 有效 |
| `expiring` | 即将失效（活 entry `remaining_days<7`） | 即将失效 |
| `expired` | 已失效或已删除（**含墓碑** + archived 到点待删） | 已失效或已删除 |

- 红色倒计时标签（BDD-21）：`remaining_days < 7` 显示「剩余X天」红色标签（**[r2] 语义色 token `var(--c-error)`，与 BaseBadge 现有 8 变体之一对齐，注意对比度**）；已暂停（星标）条目附加「豁免中」语境（解释见 §0 口径，标 [INTERPRETATION]）。
- 墓碑卡片（BDD-14/12/26）：标题置灰/删除线 + 「作者已删除/内容已失效」水印 + **[r2]「看原因」为 `<button>`（键盘可到达，a11y）** + 移除按钮（无正文入口）。
- 批量：勾选多条目（含墓碑）→ 批量移除（BDD-22）；**[r2] 批量按钮 `disabled`（无勾选时）**；执行前 `ConfirmDialog` 二次确认（明示将移除 N 条收藏）。
- **[r2] 三态（design-2）**：加载态（沿用 skeleton 范式）；错误态（提示 + 重试）；四分类空态（all→「暂无星标内容」/ active→「暂无有效星标」/ expiring→「暂无即将失效内容」/ expired→「暂无失效内容或墓碑」）。
- 「管理失效内容」入口（§4.5）→ 预切到 `filter=expired`。
- **[r2] checkbox `aria-label`（如「选择 {title}」），墓碑卡片 + 活 entry 均支持**（a11y）。

### 6.4 作者 Archived 豁免提示（F5/BDD-24/25）— [r2] 补充建议 3

- `EntryCard`/`EntryListRow` archived + `star_count>0`（owner 视角）→ **[r2] footer 渲染条件扩展：现仅 `isOwner || isExpiredButActive`（EntryCard.vue:55）→ 增 `isOwner && archived && star_count>0` 时渲染豁免标签；与 BaseBadge 互斥（豁免标签替换常规 archived badge/文案，不叠加）**（BDD-24）。
- 文案「因被 N 位用户星标，已暂停自动删除」+ ❓可点击说明（BDD-24）。
- 「立即删除（强制）」按钮（archived+starred 时强化）：`ConfirmDialog` 二次确认文案明示「此内容已被 N 位用户星标，确认删除后这些收藏将变为"作者已删除"」（BDD-25），确认前不执行；确认后走现有 `deleteEntry` → 后端自动建墓碑（BDD-26）。

### 6.5 稳定测试标识（P3/P6 用）— [r2] 增补

`data-testid`：`star-toggle`、`star-count`、`mobile-star-toggle`、`tab-starred`、`stars-tab-{all|active|expiring|expired}`、`tombstone-card`、`tombstone-remove`、`tombstone-reason`、`star-checkbox`、`stars-batch-remove`、`star-exempt-label`、`star-exempt-help`、`force-delete`、`force-delete-confirm`、`star-toast-action`、`stars-loading`、`stars-error`、`stars-empty-{all|active|expiring|expired}`。

### 6.6 可访问性（[r2] design-5 新增节）

- 星标按钮：`aria-pressed` + `aria-label`（桌面 + 移动端同一语义，沿用 header toggle-btn 模式）。
- 红色倒计时标签：语义色 token（`var(--c-error)`）+ 对比度要求（正文色 vs 背景 ≥ 4.5:1，若不足用深红加深变体）。
- 墓碑「看原因」：`<button>` 元素，键盘可达，展开/收起弹窗或详情面板（ConfirmDialog/Toast 复用）。
- ❓帮助：可点击（触屏兜底），`aria-label` 或 `aria-describedby` 关联说明。
- checkbox：`aria-label` 关联条目标题。
- ConfirmDialog 复用 `role="alertdialog"` + 焦点管理（ConfirmDialog.vue:7-9/45-50 现有能力）。

## 7. BDD 覆盖映射 — [r2] 增补 P3 链路用例

| BDD | 落点 |
|-----|------|
| 1/2/3/4/5/6 | StarService.star/unstar + 部分唯一索引 + **[r2] IntegrityError 幂等分支（N7）** + API + StarToggle 乐观更新 + Toast action（E1） |
| 7/8 | cleanup 星标豁免 NOT EXISTS 判据（归档后星标同样豁免） |
| 9/10 | archive_delete_at 绝对 deadline 比较（缓冲期 / ≤0 下周期删除） |
| 11 | delete_entry → _delete_with_tombstone 立即物理删除正文 |
| 12 | 删除时有星标 → 建 reason=author_deleted 墓碑，Star 列表可见 |
| 13 | unstar 联动：墓碑最后一条星标移除 → 删墓碑 |
| 14 | 管理页墓碑卡片 + 移除按钮（无正文） |
| 15/16/17/28 | get_entry 星标判据（**archived 短路 is_public**）+ share 通道不改（回归） |
| 18/19 | Explore Starred tab + showTabs 登录可见（**Starred 与 owner/status 互斥，不含墓碑**） |
| 20/21/22 | 管理页分类（filter 语义表）/ 红色倒计时 / 批量移除（禁用 + 确认） |
| 23 | 星标成功归档 Toast（**双文案区分 active 临近 / archived**） |
| 24/25/26 | 作者豁免标签（footer 条件扩展 + BaseBadge 互斥）/ 二次确认 / 强制删除建墓碑 |
| 27 | **数据幂等 backfill**（上线日 + retention，重跑幂等，不复用 user_version） |

**P3 新增链路用例（评审测试缺口闭合）**：

| 用例 | 检测对象 |
|------|----------|
| 公开→星标→转私有(active)→归档 → 星标用户读 200 / 非星标 404 | BLOCKER-1 |
| 非 owner 对私有 slug 星标 → 404；非星标对 archived slug 星标 → 404；未知 slug → 404 | BLOCKER-2 |
| 存量库 user_version=2 → 升级 → backfill 生效且 user_version 保持 2、幂等 | BLOCKER-3 |
| ownerless archived（owner_id=NULL）→ 匿名请求详情 → 404 | BLOCKER-4 |
| 转私有后取消星标仍 200（DELETE star 仅需 entry 存在，不误加读校验） | N9 |
| update_entry 双 reactivation 路径（expires_in / status 参数）均清 archive_delete_at | N2 |
| delete_user 顺序：用户删除后其星标 CASCADE → 孤儿墓碑被清扫 | N1 |
| 多用户并发星标同一 entry → 唯一索引兜底幂等（非 500） | N7 |
| 星标后转私有 active 条目从用户星标列表隐藏（豁免/计数仍在） | N4 |
| 移动端 star 按钮（mobile-star-toggle）桌面/移动双端 | design-1 |
| 管理页三态 + 批量按钮禁用 + 移除确认 | design-2 |
| useToast action 渲染 + 既有 toast 零回归 | design-3 |
| client.ts transform 映射（starCount/isStarred/countdown） | design-4 |
| a11y：aria-pressed / 看原因 button / checkbox aria-label | design-5 |
| 归档 Toast 双文案 | design-6 |

## 8. gate_commands — [r2] N6

```yaml
gate_commands:
  P3: "make test-quick"
  P3_frontend: "make test-frontend"
  P5: "make test-quick"
  P5_frontend: "make test-frontend && make typecheck"
  P5_e2e: "E2E_SPEC=e2e/star*.spec.ts make debug-test"
  project_module: "backend/peekview"
```

> 说明：后端测试运行器统一用 Makefile target（AGENTS.md：Makefile 是测试命令唯一真相源）；`make debug-test` 需先 `make debug-start`（:8888 隔离实例）；**[r2] `P5_e2e` 固化 `E2E_SPEC=e2e/star*.spec.ts` 作用域（N6）**——CDP 全量 E2E 可能超 5 分钟，限定 star spec；`P5_e2e` 因 ui_affected=true 必填。

## 9. files_to_read（P4 implementer 上下文地图）— [r2] 增补

```yaml
files_to_read:
  - path: backend/peekview/models.py
    why: 表模型与 API schema 集中地；EntryStar/EntryTombstone 与响应字段加这里
  - path: backend/peekview/database.py:39-171
    why: _run_migrations ALTER TABLE 模式（archive_delete_at 列 + entry_stars/entry_tombstones IF NOT EXISTS 兜底）
  - path: backend/peekview/database.py:522-566
    why: backfill_fts_content 幂等模式 → backfill_archive_delete_at 参照（数据幂等，非 user_version）
  - path: backend/peekview/database.py:273-294
    why: _setup_indexes 幂等索引模式（部分唯一索引）
  - path: backend/peekview/services/entry_service.py:323-359
    why: get_entry 权限重构（archived 短路 is_public + 星标判据，BLOCKER-1）
  - path: backend/peekview/services/entry_service.py:542-609
    why: update_entry 双 reactivation 路径（expires_in/status 都清 archive_delete_at，N2）
  - path: backend/peekview/services/entry_service.py:709-780
    why: delete_entry/delete_entry_by_api_key（接入 _delete_with_tombstone）
  - path: backend/peekview/services/entry_service.py:360-540
    why: list_entries（starred 过滤 + star_count/countdown 附加）
  - path: backend/peekview/services/admin_service.py:240-308
    why: cleanup_expired 重写（deadline + 豁免）
  - path: backend/peekview/services/admin_service.py:450-473
    why: delete_user（删除提交后孤儿墓碑清扫顺序，N1）
  - path: backend/peekview/api/entries.py:129-176
    why: list_entries 路由（starred 查询参数）+ star 路由挂载参考
  - path: backend/peekview/api/_shared.py + backend/peekview/auth.py:138-200
    why: require_auth 依赖复用
  - path: backend/peekview/main.py:76-139, 195-237
    why: app factory DI（star_service 注册 + backfill_archive_delete_at 启动调用 + cleanup 任务）
  - path: frontend-v3/src/types/index.ts + frontend-v3/src/api/types.ts
    why: Entry/EntryListItemResponse/ListEntriesParams 扩展
  - path: frontend-v3/src/api/client.ts:43-92
    why: transformListItem/transformEntry 补 star_count/is_starred/countdown 映射（design-4）
  - path: frontend-v3/src/stores/entryDetail.ts + frontend-v3/src/stores/entryList.ts
    why: 星标状态挂载与乐观更新模式
  - path: frontend-v3/src/views/EntryListView.vue:20-36, 270-345, 458-504
    why: owner-tabs + setFilter/restoreFromURL/onBeforeRouteUpdate/emptyStateHeading 多点耦合（Starred tab）
  - path: frontend-v3/src/views/EntryDetailView.vue:1-130 + frontend-v3/src/components/EntryDetailHeader.vue:13-51
    why: 详情页 header 挂 StarToggle（桌面）
  - path: frontend-v3/src/components/EntryDetailMobileBar.vue
    why: 移动端星标按钮落点（mobile-star-toggle，design-1）
  - path: frontend-v3/src/components/EntryCard.vue:55-59 + frontend-v3/src/components/EntryListRow.vue
    why: 作者 archived 豁免标签（footer 条件扩展 + BaseBadge 互斥）+ 强制删除入口
  - path: frontend-v3/src/router.ts:6-48 + frontend-v3/src/views/SettingsView.vue
    why: /stars 路由 + 管理页骨架模式参考（mobile-stacked）
  - path: frontend-v3/src/components/ConfirmDialog.vue + frontend-v3/src/composables/useToast.ts + frontend-v3/src/components/Toast.vue
    why: 二次确认弹窗 + Toast 复用（action 扩展，design-3）
```

## 10. env_constraints

```yaml
env_constraints:
  debug_env: "make debug-quick（:8888 隔离）；迁移走 database.py 机制（backfill_archive_delete_at）；测试用户 alice/bob/carol（testpass123）模拟多用户星标"
  lint: "make lint && make typecheck（CI 强制）"
  prod_isolation: "严禁触碰 :8080 生产与 ~/.peekview/（生产 DB 有存量数据，迁移在 P8 发布评估）；pytest 由 conftest autouse 隔离到 tmp_path；MCP/E2E 指向 127.0.0.1:8888"
  isolation_check: "pytest 全量绿（含新 test_star* / 扩展 test_archived_visibility / test_admin_cleanup）；`sqlite3 /tmp/peekview-debug/peekview.db` 抽查 entry_stars/entry_tombstones/archive_delete_at 建表与 backfill 幂等 + user_version 仍为 2"
```

## 11. minimal_validation

```yaml
minimal_validation:
  assumption: "SQLite FK=ON 下：①entry_id 带 FK 无 ondelete 会拦截 entry 删除；②纯整型 entry_id 星标行跨删除存活；③无 AUTOINCREMENT 的 entries 删除最大 id 后新插入会复用 rowid；④部分唯一索引可同时防刷量并允许墓碑共存"
  method: "20 行 sqlite3 脚本（/tmp/pv_minval_stars.py）在内存库模拟 entries/entry_stars(plain int)/entry_tombstones + 部分唯一索引 + 绝对 deadline 算术"
  result: "confirmed"
  note: "A.rowid 复用实际发生（删 id=5 后新 entry 复用 id=5）→ 确认墓碑必须事务内绑定 tombstone_id 而非依赖 entry_id；B.FK 无 ondelete 抛 IntegrityError、plain int 删除后星标存活；C.部分唯一索引重复活星标 IntegrityError、墓碑共存 OK；D.deadline 冻结/恢复算术验证 BDD-9/10 成立。倒计时与权限判定为纯代码逻辑（依赖 entries.archive_delete_at 字段 + entry_stars EXISTS + delete_entry/cleanup_expired 数据转换），已由上述 DB 行为验证覆盖"
```

## 12. 批次设计与 dispatch_plan

high 复杂度，静态拆批（frontmatter `dispatch_plan`）：

```
batch-1 backend（high）：models/database 迁移与 backfill（数据幂等，非 user_version）→ star_service + API（含可读前置验证）→ get_entry/delete/cleanup/list 改造 → 后端测试（test_star_api/test_star_lifecycle/test_archived_visibility 扩展/test_admin_cleanup 扩展 + BLOCKER-1/2/3 链路用例）
batch-2 frontend（high）：types/client（transform 映射）→ StarToggle（桌面+移动端）/详情页 → Starred tab → 管理页（三态）→ 作者豁免标签 → vitest + typecheck
```

两批解耦点 = **API 契约（§4.6）在本设计已冻结**，frontend 可 mock 契约先行；依赖方向 backend→frontend 单向。parallel_limit=2。E2E（P5_e2e，`E2E_SPEC=e2e/star*.spec.ts`）依赖两批产物齐备后统一验证。

## 13. [SCOPE+]

```
[SCOPE+] 发现：backup/restore 的 _restore_merge 不导入新表 entry_stars/entry_tombstones（现有代码只处理 entries/files/shares/reads/apikeys）
         必须做的理由：merge-restore 恢复旧备份后星标与墓碑数据丢失（replace 模式整体换库不受影响）
         影响：已登记 DEBT0006（主 Agent 裁定为已知限制，P2 不扩大范围）；若确认修 → admin_service.py _restore_merge 增补两表导入 + RestorePreview 计数扩展
```

## 14. 实现完成标志（P3/P5 判据）— [r2] 增补

- [ ] 迁移：`backfill_archive_delete_at` 幂等（跑两次结果一致，存量 archived 全非 NULL）、entry_stars/entry_tombstones 建表、部分唯一索引存在；**[r2] `PRAGMA user_version` 保持 2（FTS 独占，无污染）**
- [ ] cleanup：无星标 archived 到点删除；有星标到点不删（BDD-7/8）；取消星标恢复缓冲/≤0 下周期删（BDD-9/10）
- [ ] 删除：有星标建墓碑（reason=author_deleted）、星标行绑定 tombstone_id、正文+文件立即清除（BDD-11/12）；无星标纯删除不建墓碑
- [ ] 权限：星标用户 archived 详情/raw/文件 200（BDD-15）；非星标 404（BDD-16）；owner/admin 恒 200（BDD-17）；share 通道回归（BDD-28）；**[r2] 公开→星标→转私有→归档 链路星标用户 200（BLOCKER-1）**；**[r3] ownerless archived 匿名 404（BLOCKER-4）**
- [ ] API：star/unstar 幂等 + 计数正确（BDD-1/2/3/5）；**[r2] POST star 前置可读验证（不可读 404，BLOCKER-2）+ IntegrityError 幂等（N7）**；匿名 401/引导（BDD-4）；`starred=true` 列表 active+archived（BDD-18）；**[r3] 转私有后取消星标仍 200（N9，DELETE star 不要求读权限）**
- [ ] 前端：StarToggle 乐观更新+回滚（BDD-6）+ **移动端 mobile-star-toggle（design-1）**；Starred tab 登录可见 + 空态（BDD-18/19）；管理页分类/红倒计时/批量禁用+确认/三态（BDD-20/21/22）；墓碑卡片（BDD-14）；归档 Toast 双文案（BDD-23）；作者豁免标签/二次确认/强制删除（BDD-24/25/26）；**Toast action（E1）**
- [ ] 前端 `make typecheck` 与 vitest 全绿；E2E `E2E_SPEC=e2e/star*.spec.ts make debug-test` 通过
