# Team 可见性机制设计说明（v4 终版）

> 状态：APPROVED
> 日期：2026-09-02
> 范围：PeekView 新增「团队内可见」权限档位的完整设计，覆盖后端 / API / CLI / MCP / 前端五端
> 关联：探针信号（跨 Agent 读取）、多 Agent 总线愿景
> 评审：v2 起经 plan-eng（架构）+ plan-design（前端）双独立评审，10 + 8 项阻塞全部关闭；v4 为系统性重写终版（结构重组 + 补齐 CLI 章节，无新增设计决策）
> 命名：2026-09-02 由 group 修订为 team（术语统一，非设计变更）

---

## 1. 背景与动机

### 1.1 现状可见性模型

PeekView 目前只有三档可见性：

| 档位 | 可见范围 | 实现 |
|------|---------|------|
| public | 所有人 | `is_public=true`（默认） |
| private | 仅 owner（admin 例外） | `is_public=false` + owner_id 检查 |
| share | 单条临时 token | share 表 + token 校验 |

可见性判断分散在 `entry_service.py` / `files.py` / `shares.py` 多处（见 5.3）。

### 1.2 缺口与信号

「一组人长期可见」这个档位不存在。多 Agent 协作场景（同一项目组多个 Agent 分工、跨机互通）需要一个**介于 public 与 private 之间的可见性层**。

探针数据已观测到真实信号：匿名外部读取 5 条 + 私有经 share 读取 1 次——跨 Agent 读取正在发生，但只能靠"发 share 链接"这种临时、零散的方式。

## 2. 需求定义

### 2.1 用户故事

- 用户可以创建多个 team，也可以加入多个 team
- 发布内容时可指定 team；team 内成员可见，不 public
- 不指定 team、保持 private 的，行为与现状一致

### 2.2 非目标

- 不做 organization 层级租户模型（见 3.1）
- 不做 team 内嵌套子结构
- 不做实时通信 / 通知（PeekView 定位是发布记录，不是聊天）

## 3. 核心设计决策

### 3.1 命名：team（而非 organization / group）

| 维度 | organization | team |
|------|-------------|------|
| 隐含结构 | 层级租户（org → team → user），常绑定计费 / 权限树 | 扁平协作单元 |
| 隐含关系 | 用户从属单一 org，有 root / admin 层级 | 用户可属于多个，无层级 |
| 与产品定位 | 冲突——轻量发布记录，不是 SaaS 租户管理 | 契合——平权协作 |

**决策**：用 team，不用 group 的原因——group 语义过泛（任何集合都叫 group，与前端 tags 分组易混）；team 强调"一起完成一件事的一组人"，与多 Agent 协作主场景一致，且不必然带层级（owner + 成员即团队，与平权模型吻合）。

### 3.2 成员流：owner 直接添加，无邀请-接受流

- 创建者（owner）按 username 直接添加成员
- 成员自助退出（leave），无需确认
- owner 可移除成员、重命名、删除 team
- **不做**邀请链接、pending 状态、接受 / 拒绝流

**防枚举原则**：team 不可搜索、不可浏览。成员只能由 owner 添加（精确 username 匹配）。

### 3.3 可见性：三选一，不叠加

public / team / private 三选一。`is_public` 语义保持现状；新增 `team_id` 表示团队内可见。

**决策**：`team_id` 非空时服务端**强制 `is_public=false`**（不报 422）——避免 MCP 客户端默认 `is_public=true` 时的 422 陷阱（见 7 节）。

### 3.4 entry-team 关系：一对多（单值 team_id）

entry 最多属于一个 team（`entry.team_id` 外键）。多对多（entry_teams 关联表）的复杂度不值当，等真实需求触发再升级。

### 3.5 删除 team / owner 账号失效的语义

| 场景 | 行为 | 机制 |
|------|------|------|
| team 被删除 | entry **转为 private**（仅 owner 可见），数据不丢 | FK `ON DELETE SET NULL` |
| owner 被禁用（`is_active=false`） | team **冻结**——成员仍可见，但无人可管理 | 成员关系不变 |
| owner 被删除（`admin delete_user`） | 沿用现有 CASCADE——其全部 entry（含 team entry）连带删除，team 消失 | `entries.owner_id` 已是 `ON DELETE CASCADE` |

## 4. 数据模型

```sql
teams (
  id          INTEGER PK
  name        TEXT NOT NULL              -- UNIQUE(owner_id, name)：owner 内唯一
  slug        TEXT NOT NULL UNIQUE       -- 全局唯一；冲突时 -N 后缀重试（复用 entry 的 _retry_with_slug_suffix 模式）
  owner_id    INTEGER FK -> users.id ON DELETE CASCADE   -- 与 entries.owner_id 的 CASCADE 语义一致
  created_at  DATETIME
  updated_at  DATETIME
  UNIQUE (owner_id, name)
)

team_members (
  team_id     INTEGER FK -> teams.id ON DELETE CASCADE
  user_id     INTEGER FK -> users.id ON DELETE CASCADE
  joined_at   DATETIME
  PRIMARY KEY (team_id, user_id)
)

entries.team_id  INTEGER NULL FK -> teams.id ON DELETE SET NULL   -- NULL = 非 team 可见
```

索引：

- `idx_team_members_user_id`（查"我加入了哪些 team"）
- `idx_entries_team_id`（查"某 team 的 entry 列表" + list 聚合 JOIN）
- 存量 `entries.is_public, entries.status` 保持

**注意**：SQLite `foreign_keys=ON`（`database.py:32`）已强制，`ON DELETE` 子句必须显式，否则默认 NO ACTION 会在删 team 时因 FK 违约报错。

## 5. 后端设计

### 5.1 teams 管理 API

| 方法 | 路径 | 说明 | 权限（无权一律 404，防枚举） |
|------|------|------|------|
| POST | `/api/v1/teams` | 创建 team | 登录用户 |
| GET | `/api/v1/teams` | 我拥有的 + 我加入的（两分区） | 登录用户 |
| GET | `/api/v1/teams/{slug}` | team 详情（含成员列表） | owner + 成员 |
| PATCH | `/api/v1/teams/{slug}` | 重命名 | 仅 owner |
| DELETE | `/api/v1/teams/{slug}` | 删除（entry 转 private） | 仅 owner |
| POST | `/api/v1/teams/{slug}/members` | 添加成员（username） | 仅 owner |
| DELETE | `/api/v1/teams/{slug}/members/{user_id}` | 移除成员 | 仅 owner |
| POST | `/api/v1/teams/{slug}/leave` | 成员自助退出 | 成员本人 |

防枚举细节：

- `GET/PATCH/DELETE /teams/{slug}`、成员管理对无权者一律 404（非 403）
- **添加成员时 username 不存在 → 404**（与"非 owner"同语义，避免 username oracle）
- team 详情 / 成员列表仅 owner + 成员可见

### 5.2 entry API 扩展

**create（`POST /api/v1/entries`）**：

- `CreateEntryRequest` 加 `team_id`
- `team_id` 非空 → 服务端强制 `is_public=false`（不 422）
- **校验契约**：`team_id` 非空时，不存在或非成员 → **422**（统一文案，如 `team not found or not accessible`，不区分存在性与成员身份——防存在性 oracle，与 8.4 单一不可用态同一逻辑）；匿名携带 → 422（匿名连 private 都不能建，现状 `entry_service.py:200-201` 强制匿名 is_public=true）
- **绝不静默忽略** team_id——若忽略并按默认 `is_public=true` 发布，团队内容会误发为 public，是数据泄露事故（尤其 MCP agent 自动发布场景）

**update（`PATCH /api/v1/entries/{slug}`）**：

- `EntryUpdate` 加 `team_id`
- 同 create 校验（team_id 非空 → is_public=false）
- 仅 owner / admin 可改
- **team → public 转换撤销全部 share**（复用现有 `was_private` 撤销逻辑，需验证覆盖 team→public 路径）
- **team 间迁移**（team_id A → B）：校验目标 team 属于本人
- public → team：现有 private 化逻辑覆盖

**list（`GET /api/v1/entries`）**：

- 加 `team` 过滤参数（slug）
- 默认 All 聚合 team 内容（见 8.2）

**get（`GET /api/v1/entries/{slug}`）**：

- 响应加 `team: {slug, name}`（**单数**——单值 team_id 用数组命名失实；仅 owner / 成员响应返回，share 访问者不返回）
- raw 读路径：权限检查同步扩展

### 5.3 权限检查收敛为单一函数（核心改动）

现状权限判断分散在**至少 7 处**，只改 `get_entry` 会导致团队成员在其它路径全部 404：

| # | 路径 | 现状检查 |
|---|------|---------|
| 1 | `entry_service.get_entry` | is_public OR owner OR admin（N8） |
| 2 | `entry_service.list_entries` | Phase 3：is_public OR owner（登录用户） |
| 3 | `files._resolve_entry` | 独立 is_public OR owner OR admin |
| 4 | `files.resolve_entry_raw`（share 分支） | 同上 + share 校验 |
| 5 | `entries.py:get_entry`（share 分支）+ `_check_share_cookie` | share cookie 校验 |
| 6 | `entry_service.get_entry_with_share` | share 校验 |
| 7 | `entries.download_entry_files` | 同上 |

**决策**：新增单一判定函数，全部 7 处走它：

```python
can_read_entry(session, entry, user_id, is_admin) -> bool
  = is_public OR is_admin OR (user_id == owner_id) OR team_member(user_id, entry.team_id)
  # archived 分支：owner + admin + 星标持有者（保持决策 A / BLOCKER-1，见 5.5）
```

**team 成员身份解析**：`EXISTS(SELECT 1 FROM team_members WHERE user_id=:me AND team_id=entries.team_id)` 子查询。

**顺带修复存量 bug**：`entries.py:478` 调用 `service.get_entry_by_api_key(slug)`，但 `entry_service.py` 中**无此方法**（全仓仅此一处调用）——全局 master key 走 `/download` 会 AttributeError。修 team 权限时一并补上。

### 5.4 share 与 team 的交互

**现状事实**：`share_service.py:51` 校验是 `if not is_admin and entry.owner_id != current_user_id`——**admin 也可对任何 entry 建 share**，不是"仅 owner"。

决策：

- **owner + admin 可分享** team entry（内容拥有者 / 系统管理员有权决定外部分享）
- **成员不可分享** team entry（`share_service.py:51` 已保证，无需新逻辑）——否则成员可泄露 team 内容
- **share 三接口（create / list / revoke）的 403 → 404**：现状非 owner 得 403，可区分"私有 entry 存在"与"slug 不存在"，违反 N8 防枚举铁律；team 功能使更多 actor 拥有该探测面
- **share token 生命周期与成员变动无关**：owner 建 share 后，即使成员被移除 / team 被删，share 仍有效（share 是 owner 的决定，写测试断言）

### 5.5 archived 生命周期交互

- 归档 team entry：**team 可见性不延伸到归档态**——走既有 archived 语义（owner + admin + **星标持有者**可读，`entry_service.py:344-355` 决策 A / BLOCKER-1）
- 理由：归档是"已下架"语义；且**必须保持星标不变量**（星标用户对 archived 的读权与可见性解耦），不能为 team 破坏该契约——归档 team entry 对被成员星标的用户仍可读

### 5.6 star 可见性缺口

`entry_service.py:491-497` 与 `star_service.py:365-368` 两处 starred 可见性条件都是 `is_public OR owner OR archived`。团队成员可 star team entry（star 走 get_entry），但之后在 `list_entries(starred=True)` 和 `/api/v1/stars` 里**看不到它**——功能自相矛盾。

**决策**：两处 starred 条件加 `team_id IN (我的 team)`。

### 5.7 admin 视角

- admin 对 team entry **可见**（延续"admin 看全部"）
- admin **不自动可管理**所有 team（避免误删），仅 owner 管理
- admin 可对任何 entry 建 share（现状行为，保留并写测试）

## 6. CLI 设计

CLI 走 `_get_backend`（本地 `EntryService` 或远程 `PeekClient`），与 API 同契约。本地模式复用后端权限逻辑，远程模式透传 HTTP。

### 6.1 新子命令：`peekview teams`

列出当前用户的 team（发布前知情——agent / 脚本在 create 前先查自己属于哪些 team）：

```bash
peekview teams                 # 文本输出：我拥有的 + 我加入的
peekview teams --json          # JSON：{owned: [{slug, name}], joined: [...]}
```

- 本地模式：当前用户身份解析与 `peekview user` 一致；远程模式：按已配置的 API key / 登录态
- 无参数、只读；无权（未登录）报错提示需认证

### 6.2 `peekview create` 加 `--team`

```bash
peekview create -s "报告" --team proj-a path/to/file.md
```

- `--team {slug}`：发布到指定 team，等价于 API `team_id`
- **与 `--visibility public` 冲突**：`--team` 非空时，若同时传 `--visibility public` → 报错退出（fail fast，提示"team 内容不可公开，已忽略 --visibility"由服务端强制私有，CLI 侧直接拒绝更清晰）——实现时二选一：CLI 校验互斥或直接让服务端强制；倾向 CLI 校验互斥，避免歧义
- 校验与 API 一致：team 不存在 / 非成员 → 422 透传，错误信息含提示"先运行 `peekview teams` 查看你的 team"

### 6.3 `peekview list` 加 `--team`

```bash
peekview list --team proj-a     # 只列该 team 的 entry
```

- 与现有 `--status` / `--tag` 组合
- 默认行为不变：list 返回公开 + 自己的（不含 team 内容）——与 API `?view=` 的 All 聚合语义不同，CLI 保持显式过滤，不做隐式聚合

### 6.4 help 文案

- `peekview teams --help`："List your teams (owned + joined). Use before create --team."
- `peekview create --help` 的 `--team` 选项描述："Team slug to publish to (visible to team members only). Run 'peekview teams' first. Conflicts with --visibility public."

## 7. MCP 设计

### 7.1 工具变更总览

| 工具 | 变更 | 兼容性 |
|------|------|--------|
| `publish_files` | 加可选 `team_id` | ✅ 旧调用不变 |
| `create_entry` | 加可选 `team_id` | ✅ 旧调用不变 |
| `list_entries` | 复用现有参数（`status` / `owner` 已覆盖 archived / private），不加新参数 | ✅ 不变 |
| `get_entry` | 响应加 `team: {slug, name}`（单数，与后端契约一致） | ✅ JSON 增量 |
| `list_teams` | **新增只读工具** | 新增 |

所有新增字段均为 optional——MCP 客户端不传 team_id 时请求体与现状完全一致，**非 breaking change**。MCP server 独立 bump minor（v0.11.0 → v0.12.0）。

### 7.2 只读查询工具 `list_teams`（新增）

```ts
list_teams() → { owned: [{slug, name, member_count}], joined: [{slug, name, member_count}] }
```

- 无参数、只读
- **动机**：终端（agent）发布前不知道自己属于哪些 team——不填 team_id 时内容按 `is_public` 默认 **true → 公开**（泄露风险），填错则 422。`list_teams` 解决"发布前知情"
- **只读 ≠ 管理**：管理工具不暴露（增删成员 / 重命名 / 删除走 API / UI）；`list_teams` 是只读查询，不在禁止范围

### 7.3 查询机制：否决 get(key) 通用查询

曾设想 `get(teams)` / `get(archived_list)` 等通用 key 查询，避免每次新增查询改工具。**否决**：

1. **可发现性**——MCP agent 依 tool list 决策，独立工具协议级可见；key 需塞 description 文本级可见，反而差
2. **参数校验 / 契约**——`list_entries(status/tags/owner...)` 有 zod schema（`listEntries.ts:8-12` 先例），get(key) 只剩一个字符串，分页 / 过滤塞不进去
3. **生态惯例**——MCP 是"一工具一职责，工具名即文档"，get(key) 无先例

**结论**：archived / private 等查询**复用 `list_entries` 参数**（`status='archived'`、`owner='me'` 已覆盖）；特殊无参查询才新增独立只读工具（如 `list_teams`）。

### 7.4 help 文案（description 引导）

`create_entry` / `publish_files` 的 description 追加：

```
TEAM VISIBILITY:
- To publish to a team (visible to team members only):
  1. Call list_teams to see your teams
  2. Pass team_id from the result, e.g. {"team_id": "proj-a"}
- IMPORTANT: if you omit team_id, the entry follows is_public (default: PUBLIC!)
```

最后一行是硬要求——不强调的话，agent 省略 team_id 时内容默认为 public，等于把本该团队的泄露了（与 5.2"绝不静默忽略"同一条安全线的客户端侧提示）。

### 7.5 身份透传与全局 key

- `pv_` 用户级 API key → `get_current_user` 解析出真实 user（`auth.py:180-186`）——团队身份透传成立
- **全局 master key（无 `pv_` 前缀）**：现状 `files.py` 分支可读一切但 `get_entry` 却 404——锁为"全局 key 可读一切"（与现状 raw / file 行为一致），并补 `get_entry` 的全局 key 分支，消除不一致（顺带修 5.3 的存量 bug）

## 8. 前端设计

### 8.1 Teams 管理页（新路由 `/teams`）

**入口（两处）**：

- **主入口**：UserMenu 下拉（`UserMenu.vue`）加一项 `Teams` → 跳 `/teams`（与 Settings 同级）。理由：UserMenu 是登录用户的唯一导航聚集点；team 管理是**内容组织**（explore 的延伸），不是**账号设置**（profile / security / apikeys 才是），独立路由比塞进 Settings tab 语义清晰
- **次入口**：explore 页 Teams tab 内放 `管理团队` 链接 → 跳 `/teams`（用户看 team 内容时自然想管理）
- **避坑**：`/stars` 目前是**没有 UI 入口的路由**（只有测试 push 它，真用户到不了）——`/teams` 必须挂入口，不能只建路由

**管理流程**（权限即 UI，owner 全操作 / 成员仅退出）：

```text
/teams
├── 我拥有的
│   ├── [+ 新建] → 表单（名称；slug 自动生成，冲突 -N 后缀）
│   └── 团队卡片列表 → [管理] → 团队详情
│       ├── 成员列表（用户名 + [移除]）
│       ├── [添加成员] → 输入 username → 添加
│       ├── [重命名]
│       └── [删除团队] → 确认框（"该团队的所有内容将转为仅自己可见"）
│       （owner 不显示 [退出]——退出=删除）
└── 我加入的
    └── 团队卡片列表（只读）→ [退出团队] → 确认后移除
```

**不提供"申请加入"入口**——成员只能被 owner 添加（设计 3.2 锁定，防枚举）。

**状态定义**：

- 加载中（分区 skeleton / spinner）
- 成员列表为空（"暂无成员，通过下方输入框添加"）
- 添加成员失败：username 不存在 / 重复添加 / 非 owner 操作 / team 已删除——各给明确错误提示（"用户不存在"、"已是成员"、"无权操作"）
- 移除失败、重命名失败（重名提示）、删除 team：**确认对话框 + 后果提示**（"该团队的所有内容将转为仅自己可见"）
- 离开 team：确认后从"我加入的"消失

**移动端**：两分区堆叠（参照 SettingsView `mobile-stacked` 先例），成员行卡片化，操作按钮整行高 ≥44px（见 8.8）。

### 8.2 Explore 页改造（`EntryListView.vue`）

**tab 结构**：`All | Mine | Teams | Archived | Starred`

- **All = 聚合全集**：公开 + 自己私有 + 所有我可见的 team 内容（我是团队成员，team 内容对我可见，不出现在 All 违反直觉）
- **Teams tab**：聚合我所有 team 可见的 entry
- **team chips**：具体 team 过滤（复用 FilterChip），URL `?team={slug}`
- **entry badge**：扩展 `BaseBadge` 加 `team` 变体（色板用现有 token，**禁止新 hex / emoji**——遵守 DESIGN.md「Don't add playful illustrations, emojis in primary UI」），文案「仅团队可见 · {teamName}」+ aria-label；grid（`EntryCard`）/ list（`EntryListRow`）各定义放置与截断（`max-width` + ellipsis，hover 显示全名，避免长名挤压 `.entry-right` 的 `1fr auto`）
- **空态**：Teams tab 无内容 →"暂无团队内容"；具体 team chip 过滤为空 →"该团队暂无内容"（**两种文案区分**）
- **badge 冲突优先级**：team entry `is_public=false`，owner 视角会同时渲染 private badge + team badge——**有 team_id 时不渲染 private badge**（`teamId ? 'team' : (isPublic ? 'public' : 'private')`），`EntryCard` 与 `EntryListRow` 两处统一

### 8.3 状态 × URL 矩阵

| 视图 | URL 表达 | 激活条件 | 与其它维度组合 |
|------|---------|---------|---------------|
| All | `?view=all`（缺省） | 无 owner / status / starred / team | — |
| Mine | `?owner=me` | owner=me | 与 team 组合？**否**（语义互斥） |
| Teams 聚合 | `?view=teams` | 显式 view=teams | 与 status / starred 组合？**否** |
| Teams 具体 | `?view=teams&team={slug}` | view=teams + team | 与 status 组合？**否**（5.5 归档语义） |
| Archived | `?status=archived` | status=archived | 与 team 组合？**否** |
| Starred | `?starred=1` | starred=1 | 与 team 组合？**否**（互斥语义扩展） |

**决策**：`view` 参数表达聚合态；组内叠加 `&team={slug}`。矩阵中为"否"的组合，URL 恢复时**静默丢弃后者**。`setFilter` 四维互斥：点任一 tab 清其它三维。**All 激活判定必须加 `!currentTeam`**（否则 Teams tab 激活时 All 也高亮）。

### 8.4 team 过滤的单一"不可用"态

**决策：不区分"team 不存在"与"非成员"——对外只有一个"团队不可用"态，服务端不返回任何存在性信号。**

- 客户端判定成员身份用**本地"我的 teams"列表**（`GET /teams` 已加载）：slug ∈ 我的 teams → 正常过滤；slug ∉ 我的 teams → 统一显示"团队不可用" + 清除过滤 CTA
- 服务端对 `?team=` 指向"不存在的 team"与"非成员 team"返回**完全一致**的响应（200 + 空 items，**无 teamFound / 错误码等可区分字段**）——若客户端能拿到"存在与否"信号，攻击者用 curl 扫 slug 即可得到存在性 oracle，违反 N8 防枚举铁律
- 由此客户端契约中**移除 `teamFound` 概念**；成员但无内容的空态（"该团队暂无内容"）由客户端本地成员判定自然成立，不依赖服务端信号
- 匿名用户携带 `?team=` 或 `?view=teams` → 与 starred 同款 auth 门控，恢复时忽略

### 8.5 loadEntries 调用点统一

`setFilter` / `flushSearch` / `clearSearch` / `removeTag` / `watch(currentPage)` / `watch(props.owner)` 等约 9 处调用点**统一透传 team 维度**（现状 `removeTag` 就只传 owner / status / starred / tags）。**team 并入 `loadEntries` 的单一查询对象**，由 store 层组合，避免单点漏传。`restoreFromURL` / `onBeforeRouteUpdate` / `watch(authState)` 三个恢复点统一按 auth 门控 team 参数。

### 8.6 卡片 toggle 按钮的语义修正

`EntryCard.vue` / `EntryListRow.vue` 的 `toggleVisibility`（title "Make private / Make public"）在三态可见性下是错的：**team entry 上点一下变 public，静默剥离 team 归属**。

决策：

- **team entry 隐藏该按钮**，给 tooltip「此内容为团队可见，请在编辑中调整」
- 不改成三态选择器（卡片是快速操作，三态放编辑表单）
- `entryList.ts` 的 `toggleVisibility` 加守卫：`entry.teamId` 存在时拒绝调用

### 8.7 创建 / 编辑表单

- 可见性三选一：公开 / 指定 team / 私有（team 下拉选"我的 teams"）
- 编辑路径（PATCH）支持三态互转（见 5.2）

### 8.8 移动端与可访问性

**移动端 tab**（5 个 tab 无法堆叠）：

- `DESIGN.md` 现规则"desktop 横排 / mobile 堆叠"需修订：5 个扁平过滤 tab 用**可横向滚动 tab 栏**（`overflow-x: auto` + `scrollbar-width: none` + 末尾 fade）
- 触达目标 **≥44px**（现有 `.owner-tab` padding ≈32px 不达标，一并修）
- **同步修订 `DESIGN.md` 的 Tabs 规则**（注明是对现有规则的修订），避免两个文档矛盾

**可访问性**：

- tab 区用 `role="tablist"` + `aria-selected` + 方向键导航（或最低限度 `aria-pressed`）——5 个 `<button>` 无选中语义，读屏 / 键盘退化
- FilterChip dismiss 的 aria-label 参数化（现状硬编码 "Remove filter"，5 个 team chip 无法区分）——「移除团队过滤：{teamName}」
- badge：文字 + 图标成对（DESIGN.md「color alone must not convey meaning」），aria-label 含"仅团队可见"
- 过滤结果变化复用现有 sr-only `role="status"` live region 公告
- `/teams` 表单：username 输入 label + `aria-describedby` 错误关联；操作结果 live region；删除确认用 `alertdialog` + `aria-labelledby`
- 登出焦点归还 hack（`querySelector('.owner-tab')`）随 `currentTeam` 清零一起改

### 8.9 状态管理注意

- `setFilter` 四维（owner / status / starred / team）+ All 激活判定加 `!currentTeam`
- team 过滤仅在非 banner 模式生效（与 `showTabs` 条件一致）；`/users/{username}` 路径忽略 `?team=` 并从 URL 清理

## 9. 安全设计汇总

| 威胁 | 对策 |
|------|------|
| slug 枚举（team entry 存在性） | 非成员一律 404（非 403），7 处读路径统一走 `can_read_entry` |
| team slug 存在性 oracle（`?team=` 扫描） | 单一"不可用"态，服务端零信号（8.4） |
| team 管理接口探测 | 无权一律 404；添加成员 username 不存在 404（5.1） |
| share 接口探测私有 entry | create / list / revoke 403 → 404（5.4） |
| 成员泄露 team 内容 | 成员不可建 share（5.4） |
| team 内容误发 public | create 校验契约：team_id 不存在 / 非成员 / 匿名 → 422，绝不静默忽略（5.2） |
| 卡片误操作剥离 team 归属 | toggle 按钮隐藏 + store 守卫（8.6） |
| MCP agent 省略 team_id 默认公开 | help 文案硬提示 + `list_teams` 发布前知情（7.4） |

## 10. 观测与探针

- `_record_read_async` 的 read_tracking 应包含：entry 是否属于 team、读者是否 team 成员
- **属 v2**：`entry_reads` 表要 ALTER，v2 时走 `_run_migrations` 模式（见 12 节）
- 价值：量化"谁在读 team 内容"，验证协作价值

## 11. 分期建议

**v1（本设计范围）**：

- 后端：迁移 + 数据模型 + teams API + entry team_id（create / PATCH）+ `can_read_entry` 收敛 7 处 + star 缺口修复 + share 404 化 + 存量 bug（`get_entry_by_api_key`）
- CLI：`peekview teams` + `create --team` + `list --team`
- 前端：/teams 管理页（含全部状态）+ explore Teams tab / chips / badge / 不可用态 + 表单三选一 + 移动端 tab + a11y
- MCP：entry 侧 team 参数 + `list_teams` + 全局 key 分支补齐 + bump minor

**v2（观察后决定）**：

- 探针带 team 上下文（read_tracking ALTER）
- 成员邀请流（若出现"需审批"真实需求）

## 12. 风险与兼容性

- **迁移**：`_run_migrations`（`database.py:40`）新增 `ALTER TABLE entries ADD COLUMN team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL` + `CREATE INDEX idx_entries_team_id` + teams / team_members 建表 fallback。**执行顺序必须"先建 teams / team_members 表，再 ALTER entries 加 team_id 列"**（SQLite 要求被引用表已存在，否则 ALTER 报错）。**"零破坏"不成立**：`create_all` 只建新表、绝不改已有表；`check_schema` 会对齐模型列与 `PRAGMA table_info`，漏改则升级后启动即炸——迁移必须走 `_run_migrations`，**不可依赖 create_all 自动加列**
- **性能**：list_entries team 聚合用 `EXISTS` 子查询 + 两个索引；存量 `file_count` 逐行查询是既有 N+1，team 功能不新增；P5 用 `EXPLAIN QUERY PLAN` 验证索引命中
- **安全**：防枚举（404 非 403，7 处收敛 + share 接口 + team 接口）、share 泄露边界（成员不可建 share）、全局 key 语义统一是本设计最大风险点，P6 专项验证

## 13. 测试清单（P3 TDD 必测）

1. 权限矩阵：public / team / private × 匿名 / JWT 成员 / JWT 非成员 / owner / admin × 7 条路径（get / list / raw / files-content / render / download / share-read）——非成员一律 404、成员一律可读
2. 防枚举回归：非成员对 team entry slug 探测 404；share 三接口非 owner 404；team 详情 / 成员管理非 owner 404；添加成员 username 不存在 404
3. share 边界：owner + admin 可建 team entry share；成员建 share 404；team→public 转换撤销全部 share；team 删除后 share 仍由 owner 控制；成员变动不影响已有 share
4. 星标闭环：成员 star team entry → starred 列表可见 → unstar；archived team entry 对星标用户仍可读（契约回归）
5. team 生命周期：删除 team → entry 转 private 且数据完好（`PRAGMA foreign_key_check` + `integrity_check`）；owner 禁用 → team 冻结；owner 删除 → CASCADE 现状断言
6. 迁移：旧库（无 teams 表、entries 无 team_id）升级启动成功、存量数据完好；`_run_migrations` 幂等
7. 校验：team_id 非空强制 is_public=false；PATCH 改 team_id 的权限与转换；team 间迁移校验目标 team 属于本人；`--team` 与 `--visibility public` 冲突报错
8. MCP：`pv_` key getEntry / listEntries team 身份生效；全局 master key 可读一切（含修好的 /download）；publish_files 带 team_id 不撞 422；`list_teams` 返回两分区
9. 竞态：团队成员被移除后立即读 entry 404；team 删除与 list_entries 并发不抛错
10. 性能：list_entries team 聚合索引命中（EXPLAIN QUERY PLAN），无逐行子查询
11. 前端（Playwright）：5-tab 移动端滚动；team chips 过滤；badge 两视图呈现；卡片 toggle 隐藏；`?team=` 对不存在 / 无权限 / 非成员统一呈现"团队不可用"单一态（响应无存在性信号）；编辑表单三态互转；/teams 管理页全状态

## 附录 A：决策记录

| # | 问题 | 锁定决策 |
|---|------|---------|
| A1 | 命名 | **team**（非 organization / group）——扁平、多 Agent 协作惯例、无层级 |
| A2 | team name 唯一性 | owner 内唯一 `UNIQUE(owner_id, name)`；slug 全局唯一 + `-N` 后缀 |
| A3 | 成员上限 | 无限制（防过度设计） |
| A4 | 成员流 | owner 按 username 直接添加；成员自助退出；无邀请-接受流；不可搜索 / 浏览 |
| A5 | MCP team 管理 | 管理工具不暴露（增删成员 / 重命名 / 删除走 API / UI）；只读 `list_teams` 暴露 |
| A6 | team 内再分组 | 不支持（timeline 嵌套 backlog #42 另立） |
| A7 | team_id + is_public 组合 | 服务端强制 team_id → is_public=false（不 422） |
| A8 | 全局 master key 语义 | 可读一切（与 raw / file 现状一致），补 get_entry 分支 |
| A9 | share 接口防枚举 | 三接口 403 → 404 |
| A10 | 卡片 toggle 按钮 | team entry 隐藏 + store 守卫 |
| A11 | 移动端 tab | 可横向滚动 tab 栏 + 触达 ≥44px，修订 DESIGN.md |
| A12 | MCP 查询机制 | 否决 get(key) 通用查询——沿用"工具 + 参数"；特殊无参查询才新增独立只读工具（list_teams） |
| A13 | 终端发布前知情 | MCP `list_teams` + CLI `peekview teams` + create / publish description 引导文案 |
| A14 | CLI 可见性 | `create --team` 与 `--visibility public` 互斥报错（fail fast，倾向 CLI 侧校验） |
