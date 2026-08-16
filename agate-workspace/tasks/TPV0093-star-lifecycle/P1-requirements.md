---
phase: P1
task_id: TPV0093-star-lifecycle
type: problems
parent: P0-brief.md
trace_id: TPV0093-P1-20260816-r2
status: draft
created: 2026-08-16
agent: analyst
# ── v2.0 机器字段 ──
risk_level: high
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
packages: [backend/peekview, frontend-v3]
domains: [backend, frontend, security]
---

# P1 需求基线 — 星标功能与内容生命周期管理（TPV0093）

[NO_NEED_CONFIRM]

## 1. 需求复述

**核心业务逻辑（来自需求文档 §3，P0 四决策点已定稿直接采用）：**

1. **星标（Star）**：登录用户对内容做"收藏"标记，代表强留存意图。内容头部展示星标图标 + 实时计数（公开可见，延迟 <1 分钟）；同一用户对同一内容只计 1 次（防刷量）。
2. **星标豁免删除**：只要 ≥1 用户星标，系统绝不自动删除该内容——归档倒计时暂停（冻结剩余天数）。有效期内星标 → 进入归档期后倒计时同样暂停。
3. **取消星标 ≠ 立即删除**：取消星标仅代表放弃豁免权，内容**恢复剩余归档倒计时**（非立即删除），倒计时归零后才物理删除。取消后再星标 → 重新激活豁免。
4. **作者删除优先**：作者删除是最高优先级，**强制覆盖**星标豁免与归档状态，立即清除正文，并为星标用户生成**墓碑**占位。作者删除 + 倒计时归零删除都进入墓碑体系。
5. **生命周期**：有效（有效期 A = 现有 `expires_at`）→ 归档（90 天倒计时 = 现有 `archive_retention_days=90` 语义扩展为"可暂停"）→ 物理删除。
6. **决策 A**：archived 内容读取权限从"owner/admin"扩展为"owner/admin/星标用户"（星标用户可读全文；非星标用户对 archived 仍 404，防 slug 枚举）。
7. **决策 B**：独立 `EntryTombstone` 表（`entry_slug/title/cover/deleted_by/deleted_at/reason[expired|author_deleted]`）。
8. **决策 C**：Explore 复用现有 tabs 机制新增 `[Starred]` tab（登录可见）；完整星标管理页（分类/墓碑/批量清理）为独立增强页。
9. **决策 D**：存量 archived 起倒计时但**从功能上线日起算**（非 archived_at），避免存量瞬间被清；存量已星标的直接豁免。

**明确不做（需求文档 §5 可选项，见待确认清单 S3/S4）：** 平台"最长豁免 180 天强删"机制；每周站内信失效提醒。

## 2. 隐含需求识别（逐维度）

### 2.1 数据维度

- **D1 星标关系持久化**：需要持久化 `(user_id, entry_id, 星标时间)` 关系（新表，P0 已定名 EntryStar），唯一约束 `(user_id, entry_id)` 保证"同用户只计 1 次"在并发下也不重复。→ 为什么必须：计数正确性 + 豁免判定（是否 ≥1 星标）+ Starred 列表的查询基础。
- **D2 墓碑持久化**：新表 EntryTombstone（决策 B 已定字段）。→ 为什么必须：用户收藏占位 + Agent 可读占位。
- **D3 星标记录必须跨 entry 删除存活**：entry 物理删除后，星标记录不能被级联清掉，否则墓碑无法关联到"哪些星标用户可见/何时清理"。→ 为什么必须：墓碑可见性（决策 B）依赖星标引用；这是表结构设计的关键约束（引用键不能依赖 entry FK 级联删除），P2 落实。
- **D4 归档倒计时状态存储**：现有只有 `archived_at`（清理时用 `archived_at <= now-90d` 判定）。新需求要求倒计时可暂停/恢复，必须记录"当前倒计时到期点/剩余秒数"这类状态（暂停时冻结、恢复后续算），避免重复计算漂移（P0 known_risk 明确）。→ 为什么必须：清理逻辑要能判定"已到归零点但被星标豁免"与"已到归零点且无星标"两种状态。
- **D5 存量 archived 迁移**：决策 D 要求上线时对既有 archived 条目重设倒计时基准（上线日起 90 天），已星标的豁免。→ 为什么必须：不迁移则存量 archived（可能已远超 90 天）会在首次清理被误删。需走项目迁移机制（`database.py` `_run_migrations` / 启动回填，现有 FTS 回填同模式）。
- **D6 响应字段扩展**：Entry 详情/列表响应需新增：`star_count`（实时计数）、`is_starred`（当前用户是否已星标，未登录为 false/null）、归档条目的 `countdown` 状态（剩余天数 / 是否豁免暂停）。→ 为什么必须：前端星标按钮、Starred tab、豁免标签、红色倒计时标签全部依赖这些字段。
- **D7 墓碑字段适配**：需求文档墓碑含 `cover`（封面），PeekView 的 entry 无封面实体（见 S8）。→ 为什么必须：墓碑卡片在 PeekView 以 summary + 状态标记呈现，字段需适配而非照搬。
- **D8 墓碑 deleted_by 引用安全（REV-3 修订）**：墓碑 `deleted_by` 不能是强 FK 指向 User 行——作者账号删除路径（`AdminService.delete_user` / `delete_self` → 逐个 `delete_entry`）删除作者后 User 行被删，强 FK 会悬挂。处理策略：**`deleted_by` 存 username 快照（非 FK 指向 User 行），或对 User 引用设 ON DELETE SET NULL，或干脆不做外键约束**，保证账号删除后墓碑仍可渲染作者名。→ 为什么必须：作者账号删除 + entry 有星标 → 墓碑保留给星标用户（E10），墓碑需独立于作者行存活；具体存储方式交由 P2 落实（决策 B schema 字段不变，只约束引用安全性）。

### 2.2 前端维度（domains: frontend）

- **F1 详情页星标按钮 + 计数**（§4.1）：星标图标 + 数字；点击乐观更新（+1/-1），网络失败回滚；hover 显示"N 人认为值得收藏"。
- **F2 星标即时反馈**（§4.2）：内容已归档/即将归档时星标成功 → Toast 告知"将于 X 月 X 日归档，星标后可长期保存"。
- **F3 Explore Starred tab**（决策 C）：复用现有 `[All][Mine][Archived]` tabs 机制（`EntryListView.vue` `showTabs` 登录可见），加 `[Starred]`；点击显示当前用户星标条目（active + archived）。
- **F4 星标管理页**（§4.3，独立增强页）：分类筛选（全部/有效/即将失效/已失效或已删除）；剩余 <7 天条目显示红色倒计时标签；墓碑卡片（标题置灰/删除线 + 水印 + 点击看原因 + 移除按钮）；"管理失效内容"入口 + 批量取消/批量移除。
- **F5 作者后台豁免提示**（§4.4）：作者在 Archived 列表（现有 `Mine`→`Archived` 视图，owner 限定）看到豁免标签"因被 N 位用户星标，已暂停自动删除"，替换原"剩余 X 天删除"文案；❓ 悬停弹说明；强化"立即删除（强制）"按钮 + 二次确认（明示 N 位星标影响）。
- **F6 类型/store/api-client 扩展**：`Entry` 接口、`entryList`/`entryDetail` store、`api/client.ts` 增补星标相关方法与字段。

### 2.3 多端维度（API / CLI / MCP）

- **M1 API（backend 主要工作）**：新增星标端点（星标/取消星标/我的星标列表/墓碑列表与移除/entry 星标信息）；列表 API 支持"仅我星标"过滤；清理路径重写。→ 为什么必须：前端与 Agent 读路径都走 API。
- **M1 补充（share 通道声明，REV-1 修订）**：share token 是**独立授权通道**，与星标正交。share 读取路径（`get_entry_with_share` / `_check_share_cookie` / files `_resolve_entry` share 兜底）的授权判定只基于「token 有效 + 未过期 + entry 非公开」，**不随 archived 状态 / 星标状态变化**——archived 后既有 share 仍可读取（保留今日行为，无回归），archived 且被星标的 entry 同样可经 share 读取。→ 为什么必须：决策 A 的「archived 读取以状态+星标为准」仅约束**登录用户通道**；share 是独立授权通道（授权对象是"持 token 的访客"，非账号），若被归档规则覆盖会造成既有分享链接行为回归。
- **M2 CLI**：`peekview admin cleanup` 与后台定时任务都调 `AdminService.cleanup_expired()`——只要服务层豁免逻辑改对，CLI 无代码改动（行为继承）。需在 P5 回归 CLI cleanup 路径不破坏。
- **M3 MCP**：星标是**人类**行为，MCP 不新增星标工具。但：① `get_entry`（走 raw API）与 `list_entries`（走 list API）继承 archived+星标访问控制扩展（星标用户 token 可读 archived）；② `delete_entry` 走服务层删除，有星标时自动生成墓碑——均为行为继承，`packages/mcp-server` **无代码改动**（P6 验证行为即可）。→ 为什么必须：避免"后台加了星标豁免、MCP 读到不一致"的隐性破坏（T005 漏 MCP 教训）。

### 2.4 边界维度

- **E1 重复星标**：同用户再次点击 → 不重复计数，提示"已于 X 月 X 日星标"+跳转入口（§5）。
- **E2 并发星标**：多用户同时星标 → 唯一约束兜底，计数=COUNT 实时正确。
- **E3 取消后再次星标**：内容仍在倒计时内（未物理删除）→ 重新激活豁免，倒计时再次暂停（§5）。
- **E4 最后星标取消 + 剩余 ≤0**：倒计时立即恢复；若剩余 ≤0，进入"待物理删除队列"，下个清理周期执行删除（§5）。
- **E5 已失效未删内容阅读**：archived 且未被删 → 星标用户可读全文（决策 A），非星标 404（防枚举）。
- **E6 私有/共享边界**：星标不改变私有性——非 archived 私有 entry 仍仅 owner/admin 可读；archived 读取判定以"状态+星标"为准（见 S6）。
- **E7 作者删除与倒计时归零删除**：两者都进墓碑体系（决策 B）。`reason=expired` 为**保留型枚举**（REV-2 修订）：schema 保留该值供未来策略扩展，但**当前逻辑不产出**——墓碑创建条件（SUGGEST 1）要求"删除时存在 ≥1 星标"；倒计时归零删除只发生在"最后星标取消且剩余≤0"过渡路径，该路径删除时星标数已归零 → 走纯物理删除、不建墓碑 → `reason=expired` 在运行路径**实际不可达**（作者删除路径产生 `reason=author_deleted`）。BDD 不验收 reason=expired 的实际产出，P2 不得依赖该枚举值。
- **E8 匿名用户**：不能星标（需登录）；详情页星标按钮对匿名隐藏或点击引导登录。
- **E9 空/极值**：star_count 为 0 时按钮正常显示（不星标态）；墓碑无正文、无文件，只有原因提示与移除按钮。
- **E10 作者账号删除路径（REV-3 修订）**：`AdminService.delete_user` / `delete_self` 逐个调 `delete_entry`——若 entry 有星标，该路径**同样生成墓碑**（对星标用户保留占位，语义与作者手动删除一致，reason=author_deleted）；星标用户仍能读到墓碑、可手动移除。`deleted_by` 的处理按 D8 策略（username 快照 / 非 FK / ON DELETE SET NULL）落实，不允许因作者行删除导致墓碑不可渲染或 FK 悬挂。

### 2.5 兼容维度

- **C1 向后兼容**：响应新增字段（star_count/is_starred/countdown）为增量，不破坏现有 API 消费者。
- **C2 行为变更（正向扩展）**：archived 读取从 owner/admin 扩展为 owner/admin/星标用户——非星标用户仍 404，不泄露 slug 是否存在（保持防枚举）。
- **C3 现有清理规则回归**：无星标的 archived 仍按原规则（倒计时归零删除）；有星标才暂停。现有 `cleanup_expired` 的 active→archived 逻辑保持不变。
- **C4 存量数据**：迁移不破坏现有 entry；决策 D 的基准重置只影响"删除时机"，不影响内容本身。
- **C5 配置兼容**：`archive_retention_days=90` 继续作为归档期长度语义来源；`cleanup.interval_seconds` 即"下个清理周期"粒度。

## 3. BDD 验收条件

### 3.1 星标操作与计数

#### BDD-1: 登录用户星标公开内容，计数 +1
- Given 登录用户 A 访问未星标的公开 entry E
- When A 点击星标
- Then E 的 star_count 变为原计数 +1，且 A 视角 is_starred=true

#### BDD-2: 同一用户重复星标不重复计数
- Given 用户 A 已星标 entry E
- When A 再次点击星标
- Then E 的 star_count 不变，且系统提示"已于 X 月 X 日星标"

#### BDD-3: 取消星标计数 -1
- Given 用户 A 已星标 entry E，star_count = N
- When A 取消星标
- Then star_count = N-1，且 A 视角 is_starred=false

#### BDD-4: 匿名用户不能星标
- Given 匿名用户访问公开 entry E
- When 尝试星标
- Then 星标被拒绝（引导登录），star_count 不变

#### BDD-5: 多用户星标各计一次
- Given 用户 A 与用户 B 分别访问公开 entry E
- When A、B 各星标一次
- Then E 的 star_count = 2（同一用户不重复计）

#### BDD-6: 前端乐观更新失败回滚
- Given 登录用户 A 在详情页点击星标，star_count 即时 +1
- When 星标请求网络失败
- Then 星标数字回滚到原值，is_starred 回滚为未星标

### 3.2 豁免删除（倒计时暂停/恢复）

#### BDD-7: 归档期星标 → 倒计时暂停，清理不删
- Given entry E 已归档且无星标，归档倒计时已到归零点
- When 用户 A 星标 E 后执行清理任务
- Then E 不被删除，状态仍为 archived

#### BDD-8: 有效期内星标 → 进入归档后倒计时同样暂停
- Given 用户 A 在 entry E 有效期内已星标 E
- When E 过期进入归档期（倒计时归零）后执行清理任务
- Then E 不被删除（星标豁免生效）

#### BDD-9: 取消星标恢复剩余倒计时（缓冲期内不删）
- Given entry E 已归档被用户 A 星标，暂停时剩余倒计时 R 天（R>0）
- When A 取消星标后立即执行清理任务
- Then E 仍存在（进入剩余 R 天缓冲期，非立即删除）

#### BDD-10: 最后一个星标取消且剩余≤0 → 下个清理周期物理删除
- Given entry E 已归档，唯一星标用户 A 暂停时剩余倒计时 ≤0（已过归零点）
- When A 取消星标
- Then E 进入待删除状态，下一个清理周期执行后被物理删除

### 3.3 作者删除优先 + 墓碑

#### BDD-11: 作者删除强制覆盖星标豁免
- Given entry E 被用户 A 星标（豁免删除中）
- When 作者删除 E
- Then E 正文立即物理删除（详情/raw/文件内容均不可访问），不等待倒计时

#### BDD-12: 作者删除有星标的 entry → 生成墓碑且星标用户可见
- Given entry E 被用户 A 星标
- When 作者删除 E
- Then 生成 reason=author_deleted 的墓碑，A 在星标管理页能看到该墓碑卡片（标记"作者已删除"）

#### BDD-13: 墓碑保留至最后一个引用星标移除
- Given entry E 被 A、B 星标后作者删除，生成墓碑
- When A、B 都移除该墓碑（取消对应星标）
- Then 墓碑被清理，不再出现在任何用户的星标列表

#### BDD-14: 墓碑卡片展示失效原因且可移除
- Given 星标管理页中存在墓碑卡片（已失效或作者已删除）
- When 用户点击该墓碑卡片
- Then 展示失效原因提示与"移除/取消星标"按钮，且无正文内容

### 3.4 权限（决策 A：星标用户读 archived）

> **同源继承说明（REV-4 修订）**：下列详情 / raw / 文件内容三处 API 之外，**download**（`/{slug}/download`、`/{slug}/files/{id}`）、**render**（`/{slug}/files/{id}/render`）、**短链**（`/{slug}/raw` → 302）均经 `get_entry()` / `_resolve_entry()` 集中权限继承（render 经 `_resolve_entry`、短链 302→raw），星标/非星标判定与 BDD-15/16 完全一致、不单独列出。P6 除实跑 BDD-15/16 外，**抽查 download/render/短链其一**确认同源继承生效。

#### BDD-15: 星标用户可读 archived 全文（详情/raw/文件内容；download/render/短链同源继承）
- Given entry E 已归档，用户 A 已星标 E
- When A 依次请求详情 API、raw API、文件内容 API
- Then 三个请求均返回 200 且正文完整可读
- 注：download/render/短链路径同源继承，P6 抽查其一（见 §3.4 同源继承说明）

#### BDD-16: 非星标用户对 archived 返回 404（详情/raw/文件内容；download/render/短链同源继承）
- Given entry E 已归档，用户 C 未星标 E（C 非 owner/admin）
- When C 依次请求详情 API、raw API、文件内容 API
- Then 三个请求均返回 404（防止 slug 枚举）
- 注：download/render/短链路径同源继承，P6 抽查其一（见 §3.4 同源继承说明）

#### BDD-17: owner/admin 读 archived 始终可用（回归）
- Given entry E 已归档（无论是否被星标）
- When owner 或 admin 请求 E 详情
- Then 返回 200

#### BDD-28: archived entry 持有效 share 仍可读取（share 独立授权通道，REV-1 修订）
- Given entry E 已归档（无论是否被星标），E 存在有效 share token
- When 持有该 share 读取 E（详情或文件内容）
- Then 返回 200 且正文可读（share 读取不受 archived/星标状态影响）

### 3.5 Explore Starred tab（决策 C）

#### BDD-18: 登录用户 Explore 出现 Starred tab 并显示我的星标
- Given 登录用户访问 /explore
- Then 出现 [All][Mine][Archived][Starred] 四个 tab；点击 Starred 后列表仅含该用户星标的 entry（active 与 archived 均含）

#### BDD-19: 匿名用户不显示 Starred tab
- Given 匿名用户访问 /explore
- Then 页面不出现 Starred tab（与现有"tabs 仅登录可见"一致）

### 3.6 星标管理页

#### BDD-20: 星标管理页分类筛选
- Given 用户进入星标管理页，含有效/即将失效/已失效或已删除等条目
- When 依次切换分类标签（全部/有效/即将失效/已失效或已删除）
- Then 列表仅显示对应分类条目

#### BDD-21: 即将失效条目显示红色倒计时标签
- Given 星标管理页中存在剩余期限 <7 天的条目
- When 查看该条目
- Then 显示红色倒计时标签（如"剩余3天"）

#### BDD-22: 批量取消星标/批量移除墓碑
- Given 星标管理页中勾选多个已失效或墓碑条目
- When 执行批量移除
- Then 这些条目从星标列表消失，对应墓碑被清理

#### BDD-23: 归档期星标即时 Toast 提示
- Given 登录用户在内容已归档或即将归档时点击星标
- When 星标成功
- Then 出现轻提示告知"该内容将于 X 月 X 日归档，星标后可长期保存"

### 3.7 作者后台豁免提示 + 强制删除（决策 A/C 落地）

#### BDD-24: 作者 Archived 列表显示星标豁免标签
- Given entry E 已归档被 N 个用户星标（倒计时暂停）
- When 作者查看自己的 Archived 列表
- Then 该卡片显示"因被 N 位用户星标，已暂停自动删除"标签，且不再显示"剩余 X 天删除"文案

#### BDD-25: 作者强制删除需二次确认（明示星标影响）
- Given entry E 已归档被 N 个用户星标
- When 作者点击"立即删除（强制）"
- Then 弹出二次确认（明示 N 位用户星标将变为"作者已删除"），确认前不执行删除

#### BDD-26: 强制删除后星标用户看到"作者已删除"墓碑
- Given entry E 被用户 A 星标，作者执行强制删除
- When A 查看星标列表或墓碑详情
- Then 显示"作者已删除"状态，正文不可访问

### 3.8 存量数据迁移（决策 D）

#### BDD-27: 存量 archived 从上线日起算倒计时
- Given 功能上线前已存在 archived 条目 E（archived_at 早于上线日 90 天以上）
- When 上线迁移执行
- Then E 不被立即清理，其归档倒计时从上线日起算 90 天；若 E 已存在星标则直接豁免

## 4. 待确认清单

[NO_NEED_CONFIRM]

- [SUGGEST: 墓碑创建条件 —— 仅当删除时存在 ≥1 星标才生成墓碑；无星标删除直接纯删除。理由：墓碑是"为用户保留占位"，无星标用户则无人需要占位，避免无效占位数据堆积。]
- [SUGGEST: 墓碑保留策略 —— 墓碑随最后一个引用它的星标被移除而自动清理；用户也可在星标管理页手动移除（即取消对应星标）。理由：遵循需求文档状态流转图"墓碑→各用户手动移除星标"，且不长期堆积轻量占位。]
- [SUGGEST: 不做"最长豁免 180 天平台强删"机制。理由：与星标"留存契约"语义冲突；PeekView 以文本/代码为主，存储成本可控；需求文档本身标注为"不建议"。]
- [SUGGEST: 不做每周站内信失效提醒。理由：PeekView 无站内信/消息系统；以星标管理页"管理失效内容"入口替代，符合"主动清理"设计意图。]
- [SUGGEST: 允许作者星标自己内容（同用户只计 1 次仍适用），不特殊限制。理由：需求未禁止；计数防刷量已由唯一约束保证。]
- [SUGGEST: archived 读取判定以"状态 + 星标"为准（archived 且已星标 → 可读全文），与 is_public 解耦；非 archived 的私有 entry 仍按现有 is_public 模型（owner/admin 可读）。理由：星标必然发生在内容曾对该用户可见之后，归档后再限制读取违背"留存契约"；决策 A 未区分公有/私有 archived。**该判定仅约束登录用户通道；share 通道为独立授权通道，不受此判定影响（见 §2.3 M1 补充 / BDD-28，REV-1 修订）。**]
- [SUGGEST: 墓碑卡片不展示封面，以 summary + 状态标记（"内容已失效"/"作者已删除"）呈现，EntryTombstone.cover 字段置空/省略。理由：需求文档的"封面"面向有封面图的内容平台，PeekView entry 无封面实体。]

## 5. 裁剪说明

- **P1/P2/P3/P4/P5/P6/P7/P8 全走**，不裁剪任何阶段。
- 理由：schema 变更（新表 EntryStar/EntryTombstone + 倒计时状态存储）+ 权限模型改动（决策 A）+ 生命周期清理逻辑重构（暂停/恢复/豁免）+ 前端多页（详情/Explore tab/管理页/作者后台）——P0 定为 high risk，P3（零现成覆盖）、P6（schema+多用户权限+前端交互）、P7（跨 schema/后端/前端）不可裁。
- **风险等级**：high（改动影响所有 entry 的生命周期与 archived 读取权限）。

## 6. 范围声明

见 frontmatter `packages: [backend/peekview, frontend-v3]`、`domains: [backend, frontend, security]`。
说明：`security` 因决策 A 的权限模型改动 + 防 slug 枚举约束而列入；`packages/mcp-server` 无代码改动（多端行为继承，见 M3），不列入 packages。

## 7. 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需要截图验证前端交互（星标按钮乐观更新、Starred tab、星标管理页分类/批量移除、作者豁免标签、二次确认弹窗）
    available:
      - "vision-engine skill（主 agent 图片分析唯一入口）"
      - "playwright-cdp skill（CDP 连接本机 Chrome，connectOverCDP 模式）"
    status: available

  - need: multi-user 场景测试
    why: 星标豁免/墓碑/权限验证需要多用户（星标用户 vs 非星标用户 vs 作者 vs admin）
    available:
      - "make debug（:8888 隔离实例）"
      - "make debug-seed 测试用户 alice/bob/carol（密码 testpass123）"
    status: available

  - need: 时间控制（倒计时暂停/恢复/归零）
    why: 倒计时相关 BDD（BDD-7/8/9/10）需要推进/回拨时间验证清理逻辑
    available:
      - "pytest freezegun（后端单测标准设施）"
      - "debug 隔离数据库可直接调整 archived_at / 倒计时字段（/tmp/peekview-debug/，环境约束允许）"
    status: available

  - need: MCP 行为继承验证
    why: MCP 无代码改动但需验证 get/list/delete 继承星标豁免与 archived 访问控制
    available:
      - "make debug（127.0.0.1:8888，MCP 集成测试指向 debug backend）"
    status: available
```

## 8. 范围外声明（防 P2 误扩）

- 星标管理页的"站内信/推送"渠道（S4 已声明不做）。
- 平台级"最长豁免时长"上限（S3 已声明不做）。
- 墓碑的封面图渲染（S8 适配为 summary 卡片）。
- MCP 星标工具（星标是人类行为，不暴露给 Agent）。
- 内容热度除星标外的其他维度（仅计数，不做推荐/排序加权）。
