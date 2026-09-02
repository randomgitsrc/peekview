---
phase: P1
task_id: TPV0095-team-visibility
type: review
parent: P1-requirements.md
trace_id: TPV0095-P1-requirements-review-rev1-20260902
status: approved
created: 2026-09-02
agent: requirements-review
---

# P1 需求基线复审（rev1）— TPV0095 team-visibility

评审对象：`P1-requirements.md` rev1（43 BDD，analyst 修订后）
权威源：`docs/design-notes/team-visibility.md`（v4 终版，双评审 PASS，commit 5525c319）
评审依据：`{agate_root}/assets/review-roles/requirements-review.md` + rev1 dispatch-context（复审重点：上轮 F1-F8 落实核对 + 43 BDD 编号连续性 + 无新引入问题）
[PROD_NOT_TOUCHED]

## 评审结论

**status: approved**

上轮 needs-revision 的 F1-F5（阻塞）+ F6-F8（建议）经 analyst rev1 全量落实，无遗漏、无新引入问题；43 条 BDD-1~43 连续无跳号、全文引用无旧编号残留、无与权威源（design-note v4）的新冲突；frontmatter 声明与修订后内容仍匹配。

---

## 一、F1-F8 落实核对（逐 F 项引用修订后编号）

| # | 上轮要求 | rev1 落实锚点（修订后编号） | 判定 |
|---|---------|---------------------------|------|
| F1【阻塞】 | BDD-7 消除与 design-note §5.1 冲突：详情读权（owner+成员 200 / 无关 404）与管理操作（仅 owner）分开断言 | 拆为 **BDD-7**（team 详情含成员列表：Bob 成员 → 200 含成员列表 / Carol 无关 → 404，§3.2 标题明示读权）与 **BDD-8**（管理操作重命名/删除/加成员/移成员：Bob 与 Carol → 404，Alice owner → 成功；Then 显式写「成员读权 BDD-7 200 不延伸为管理写权」）；散文 §2.5「详情读权」行同步分列读/管两种权限 | ✓ 与 design-note §5.1 API 表（GET 详情 owner+成员；PATCH/DELETE/members 仅 owner）逐行一致 |
| F2【阻塞】 | 原 BDD-20 拆为两条独立 G-W-T（成员移除后读 404 / 并发删除不 5xx） | 拆为 **BDD-23**（成员被移除后立即读任一读路径 → 404，权限判定基于当前成员关系无缓存窗口）与 **BDD-24**（team 删除与 list_entries 并发 → 不抛 5xx，状态码 2xx/4xx 而非 5xx），各单 G-W-T | ✓ design-note §13#9 两项逐一成锚 |
| F3【阻塞】 | 原 BDD-23 拆条 + update team 归属口径显式统一为「成员」口径且全文无矛盾 | 拆为 **BDD-28**（team→public 撤销全部 share）、**BDD-29**（迁移到当前用户是**成员**的 team 成功）、**BDD-30**（迁移到非成员/不存在 team → 422 不可区分）。口径统一声明：§1 核心逻辑 #9（「目标 team 可用」= 当前用户是**成员**，owned/joined 皆可，design-note §5.2 update 段「属于本人」按成员解读）+ §2.5「update 转换」行 + BDD-29 标题/Then + BDD-21/BDD-30 交叉引用——**含散文全文一致** | ✓ 无残留「拥有」口径矛盾；与 create/BDD-21 同口径（前端 8.7 下拉含 joined 分区自洽） |
| F4【阻塞】 | 补 PeekClient/CLI 远程模式验收 BDD | 新增 **BDD-34**：Given 远程模式 CLI（配置指向 debug backend + 凭据走 PeekClient）+ 用户为 team 成员 → When `peekview create --team proj-a` → Then 后端 debug 收到 payload 含 team_id、entry 归属 proj-a 且 is_public=false（明示对 debug backend 实测，不触生产 :8080）。§2.4 行 93 + 同类扫描 E2 行同步引用 | ✓ 可二值判定；远程模式锚闭合 |
| F5【阻塞】 | 补 owner 禁用冻结 / 删除 CASCADE / EXPLAIN 索引命中 BDD | 新增 **BDD-19**（owner 禁用 → team 冻结：Bob 读路径/星标/GET /teams 均 200、proj-a 仍在「我加入的」、无任何登录用户可执行 owner 管理操作——admin 不自动接管）、**BDD-20**（owner 删除 → 沿现有 CASCADE：team 连带消失、原 team entry 从一切读路径消失而非转 private、`PRAGMA foreign_key_check` 通过）与 **BDD-26**（list_entries team 聚合 `EXPLAIN QUERY PLAN` 命中 `idx_entries_team_id`/`idx_team_members_user_id`、无逐行全表扫描式子查询）；回归拦截声明 + §8 备注行将 BDD-19/20 ↔ §13#5、BDD-26 ↔ §13#10 显式锚定 | ✓ design-note §3.5/§13#5/§12 性能 + §13#10 全部成锚 |
| F6【非阻塞】 | BDD-17（现 BDD-18）slug actor 归属澄清 | **BDD-18**：两 actor 各自预期写死——用户 B（另一 owner）创建同名 "Alpha" 成功且 slug=alpha-1（A 的 alpha 不变）；用户 A 若再创建同名（owner 内重复）→ 明确校验错误不静默加后缀（`UNIQUE(owner_id,name)` 拦截，与跨 owner slug `-N` 机制区分） | ✓ 判定歧义消除 |
| F7【非阻塞】 | BDD-22（现 BDD-27）标题/正文一致 | **BDD-27** 标题改「create 携带 team_id 时服务端强制 is_public=false」create-only，正文 G/W/T 仅覆盖 create 并断言「is_public:true 同传 → 201 + 存储 is_public=false」；PATCH 强制路径由 BDD-29 Then 覆盖 | ✓ 标题与正文一致 |
| F8【非阻塞】 | BDD-34（现 BDD-42）文案量化 + 入口 DOM 断言 | **BDD-42**：① 添加成员失败三类（username 不存在/已是成员/无权操作）各给明确错误提示且**三文案两两互异**（断言互异不锁字面——采纳建议的更强写法）；② 两入口 DOM 存在性断言（UserMenu 含 Teams 项点击可达 /teams + Teams tab 内「管理团队」链接存在指向 /teams）；另补删除确认框含「内容将转为仅自己可见」后果提示 | ✓ 量化锚与入口断言均落实 |

**F1-F8 落实结论：8/8 全部落实，无遗漏、无部分落实项。**

---

## 二、BDD 逐条评审（43 条 + 覆盖维度）

编号格式核验：43 条全部为 `#### BDD-NN:` 标准格式（grep 行 116-350 命中 43）；**BDD-1~43 连续无跳号**；分组映射行 111（13 组 1~6/7~8/9~10/11~13/14~15/16~20/21~22/23~24/25~26/27~30/31~34/35~37/38~43）与 §3.1~§3.13 实际分组标题逐组对应，组内条数合计 = 6+2+2+3+2+5+2+2+2+4+4+3+6 = 43 ✓。

### 3.1 后端权限与数据模型（BDD-1~6）

| BDD | 判定 | 覆盖维度 | 备注 |
|-----|------|---------|------|
| BDD-1 | ✓ 可二值判定 | 数据✓ 边界✓ | 响应含 `team:{slug,name}` 契约；匿名 404 与 §5.2「仅 owner/成员响应返回 team 字段」一致 |
| BDD-2 | ✓ 可二值判定 | 边界✓（7 路径防枚举） | Carol 7 读路径全 404 与「slug 不存在」不可区分——§13#1 矩阵锚 |
| BDD-3 | ✓ 可二值判定 | 数据✓ | All 聚合不含非成员 team entry（§8.2 聚合语义） |
| BDD-4 | ✓ 可二值判定 | 数据✓ | All 含 team 条目 + `?team=` 只含该 team |
| BDD-5 | ✓ 可二值判定 | 数据✓ | Bob 7 路径全 200（share-read 用 owner 合法 token），权限收敛无漏改 |
| BDD-6 | ✓ 可二值判定 | 边界✓（archived×team） | 星标不变量显式写死：无星标成员 404 / 星标成员 200（§5.5 决策 A） |

### 3.2 teams API 权限（BDD-7~8）

| BDD | 判定 | 覆盖维度 | 备注 |
|-----|------|---------|------|
| BDD-7 | ✓ 可二值判定 | 边界✓（防枚举） | 详情读权 = owner+成员 200 / 无关 404——与 §5.1 一致（F1 落实） |
| BDD-8 | ✓ 可二值判定 | 边界✓（防枚举/写权分离） | 管理写权仅 owner：Bob+Carol 404、Alice 成功；显式声明成员读权不延伸写权 |

### 3.3 防枚举与单一"不可用"态（BDD-9~10）

| BDD | 判定 | 覆盖维度 | 备注 |
|-----|------|---------|------|
| BDD-9 | ✓ 可二值判定 | 边界✓（username oracle） | 添加不存在 username → 404，与非 owner 语义一致（§5.1） |
| BDD-10 | ✓ 可二值判定 | 前端✓（单一态契约） 多端✓ 边界✓ | 匿名×2 + Carol×2 四组响应完全一致（200+空 items 无差异字段）+ 客户端「团队不可用」态；服务端零存在性信号（§8.4） |

### 3.4 share 与 team（BDD-11~13）

| BDD | 判定 | 覆盖维度 | 备注 |
|-----|------|---------|------|
| BDD-11 | ✓ 可二值判定 | 边界✓ | owner + admin 建 share → 201 + token 可读（§5.4） |
| BDD-12 | ✓ 可二值判定 | 边界✓（403→404） | 成员建 share → 404（防私有 entry 探测） |
| BDD-13 | ✓ 可二值判定 | 数据✓ 边界✓ 兼容✓（生命周期） | share 与成员变动/team 删除无关——§5.4「share 是 owner 的决定」可测化 |

### 3.5 star 闭环（BDD-14~15）

| BDD | 判定 | 覆盖维度 | 备注 |
|-----|------|---------|------|
| BDD-14 | ✓ 可二值判定 | 数据✓（star 缺口修复） | 成员 star team entry 出现在星标列表——修复两处 starred 条件（list_entries + _build_star_item） |
| BDD-15 | ✓ 可二值判定 | 边界✓（star 越权通道） | 非成员即使有 live star 也不可见：星标列表不含 + 详情 404 |

### 3.6 team 生命周期、迁移与 owner 失效（BDD-16~20）

| BDD | 判定 | 覆盖维度 | 备注 |
|-----|------|---------|------|
| BDD-16 | ✓ 可二值判定 | 数据✓ 边界✓ | 删 team → team_id=NULL + owner 可读 + PRAGMA 双查通过 + 文件完好（§3.5） |
| BDD-17 | ✓ 可二值判定 | 数据✓ 兼容✓（迁移幂等） | 旧库升级首启成功 + 存量保留 + 二次重启幂等（§12 迁移风险可测化） |
| BDD-18 | ✓ 可二值判定 | 数据✓ 边界✓ | name owner 内唯一 + slug 全局唯一 -N 后缀，双 actor 预期写死（F6 落实） |
| BDD-19 | ✓ 可二值判定 | 边界✓（owner 冻结） | owner 禁用 → team 冻结：Bob 读权保留、proj-a 仍在 joined、无登录用户可管理（F5 落实；§5.7 admin 不接管） |
| BDD-20 | ✓ 可二值判定 | 边界✓（CASCADE） | owner 删除 → team 连带删除（非转 private）+ PRAGMA foreign_key_check 无孤儿（F5 落实；§3.5） |

### 3.7 校验契约（BDD-21~22）

| BDD | 判定 | 覆盖维度 | 备注 |
|-----|------|---------|------|
| BDD-21 | ✓ 可二值判定 | 数据✓ 边界✓（防 oracle） | 不存在 vs 非成员 → 统一 422 不可区分 + 绝不静默忽略（防误发 public）；update 同构见 BDD-30 引用 |
| BDD-22 | ✓ 可二值判定 | 边界✓ | 匿名带 team_id → 422（现状匿名强制 public 语义扩展） |

### 3.8 竞态（BDD-23~24）

| BDD | 判定 | 覆盖维度 | 备注 |
|-----|------|---------|------|
| BDD-23 | ✓ 可二值判定（单 G-W-T） | 边界✓ | 成员移除后立即读 → 404，无缓存窗口（F2 落实拆分 a） |
| BDD-24 | ✓ 可二值判定（单 G-W-T） | 边界✓（并发） | 删 team ∥ list_entries 不抛 5xx（状态码限 2xx/4xx）（F2 落实拆分 b） |

### 3.9 兼容与性能回归线（BDD-25~26）

| BDD | 判定 | 覆盖维度 | 备注 |
|-----|------|---------|------|
| BDD-25 | ✓ 可二值判定 | 多端✓ 兼容✓ | 不带 team 字段的既有 create/list/MCP 行为零变化——非 breaking 回归线（§7.1） |
| BDD-26 | ✓ 可二值判定 | 兼容✓（性能回归线） | EXPLAIN QUERY PLAN 命中两索引、无逐行全表扫描子查询（F5 落实；§12 + §13#10） |

### 3.10 API 契约 create/update（BDD-27~30）

| BDD | 判定 | 覆盖维度 | 备注 |
|-----|------|---------|------|
| BDD-27 | ✓ 可二值判定 | 数据✓ | create 带 team_id + is_public:true 同传 → 201 且存储 is_public=false（F7 标题/正文一致） |
| BDD-28 | ✓ 可二值判定 | 数据✓ 边界✓（share 撤销） | team→public 撤销全部 share（复用 was_private 逻辑覆盖 team→public 路径，§5.2）（F3 落实拆分 a） |
| BDD-29 | ✓ 可二值判定 | 数据✓ 边界✓（成员口径） | 迁移到「当前用户是成员」的 team 成功且 is_public=false；口径 = 成员、与 create/BDD-21 一致（F3 落实拆分 b + 口径） |
| BDD-30 | ✓ 可二值判定 | 边界✓（防 oracle） | 迁移到非成员/不存在 team → 422 不可区分，绝不静默忽略（F3 落实拆分 c） |

### 3.11 CLI（BDD-31~34）

| BDD | 判定 | 覆盖维度 | 备注 |
|-----|------|---------|------|
| BDD-31 | ✓ 可二值判定 | 多端✓（CLI） | `peekview teams` owned+joined 分区 + `--json` 结构（§6.1） |
| BDD-32 | ✓ 可二值判定 | 多端✓（CLI） | create --team 成功发布 + 与 --visibility public 互斥 fail fast exit≠0（§6.2/A14） |
| BDD-33 | ✓ 可二值判定 | 多端✓（CLI） | list --team 显式过滤不隐式聚合；默认 list 不变（§6.3） |
| BDD-34 | ✓ 可二值判定 | 多端✓（CLI 远程/PeekClient） | 远程模式 create --team → payload 含 team_id、entry 归属 proj-a、is_public=false（对 debug backend 实测）（F4 落实） |

### 3.12 MCP（BDD-35~37）

| BDD | 判定 | 覆盖维度 | 备注 |
|-----|------|---------|------|
| BDD-35 | ✓ 可二值判定 | 多端✓（MCP） 兼容✓（schema） | publish_files/create_entry 带 team_id 不撞 422 + list_teams 两分区无参只读（§7.1/7.2） |
| BDD-36 | ✓ 可二值判定 | 多端✓（MCP） 边界✓ | 成员 200 含 team 字段 / 非成员 404 / 全局 master key 200（含 /download 修复，§7.5/A8） |
| BDD-37 | ✓ 可二值判定 | 多端✓（MCP description） | description 含「omitting team_id → default PUBLIC」硬提示（§7.4 安全线） |

### 3.13 前端 UI / UX（BDD-38~43）

| BDD | 判定 | 类别 | 覆盖维度 | 判据量化核验 |
|-----|------|------|---------|-------------|
| BDD-38 | ✓ 可二值判定 | 布局结构 | 前端✓ | 5 互斥 tab + URL 表达（`?view=teams`/`?team=`）+ All 激活 `!currentTeam` 判定（§8.2/8.3）——DOM/URL 可断言 |
| BDD-39 | ✓ 可二值判定 | 布局结构 | 前端✓ | badge 文案「仅团队可见 · {teamName}」+ 禁新 hex/emoji + 有 team_id 不渲染 private badge（两视图统一，§8.2） |
| BDD-40 | ✓ 可二值判定 | 交互行为 | 前端✓ 边界✓ | toggle 按钮隐藏 + tooltip + store 守卫双保险（§8.6/A10） |
| BDD-41 | ✓ 可二值判定 | 交互行为 | 前端✓ 多端✓（服务端零信号） | 统一「团队不可用」态 + 清除 CTA + 与「该团队暂无内容」两态可区分（§8.4） |
| BDD-42 | ✓ 可二值判定 | 交互行为 | 前端✓ 可访问性✓ | 双入口 DOM 断言 + owner 全操作 + 三失败文案两两互异（不锁字面）+ 删除确认后果提示 + 退出流（§8.1）（F8 落实） |
| BDD-43 | ✓ 可二值判定 | 布局结构 | 前端✓ 移动端✓ 可访问性✓ | <768px 横向滚动 + 触达 ≥44px + 键盘可用（tablist/aria-pressed）（§8.8/A11） |

**UX 类别 BDD 结论**：BDD-38/39/43 布局结构 + BDD-40/41/42 交互行为，标题类别后缀与 frontmatter `ui_ux_dimensions: [布局结构, 交互行为]` 对齐；**零主观词**（可读/美观/流畅/平滑/自然/响应灵敏均无）；判据经 DOM 结构/文案字面互异断言/计算样式/URL/尺寸（≥44px、overflow-x）/行为守卫可二值判定，未绑 CSS 类名。`ui_render_shape: layout`（常规布局型）声明与形态一致。

---

## 三、编号连续性核验（复审重点）

- **43 条连续无跳号**：BDD-1 ~ BDD-43（grep `^#### BDD-\d+:` 命中 43，行 116-350），前后编号差值恒为 1。
- **无旧编号引用残留**：全文件 79 处 `BDD-\d+` 引用逐处核对全部指向现存编号 1~43；无指向 44+ 或空号；无 35 号时代旧编号（如指向已拆分的旧 BDD-20/23 语义）残留。
- **修订史叙述与现行编号区分正确**：Header 修订记录行 43 对上轮编号的指代（F1 拆 BDD-7、F2 拆 BDD-20、F3 拆 BDD-23 等）属修订史叙述，非编号引用残留——不含锚点误导。
- **拆条后各组引用自洽**：BDD-21 → BDD-30、BDD-29 → BDD-21、BDD-2/5（矩阵拦截）、BDD-19/20/26（回归拦截）、BDD-42（入口断言）、BDD-14/15、BDD-12、BDD-13、BDD-34（E2）等交叉引用全部解析到对应现存编号。

---

## 四、隐含需求覆盖评审（逐维度）

| 维度 | 覆盖情况 | 明细锚点 |
|------|---------|---------|
| **数据** | ✓ 覆盖 | schema 迁移 + 零改写（§2.2）、check_schema 对齐（BDD-17）、FK SET NULL（BDD-16）、索引 + EXPLAIN（BDD-26）、旧库升级幂等（BDD-17） |
| **前端** | ✓ 覆盖 | /teams 路由 + 双入口 DOM 断言（BDD-42，防 /stars 反模式）、类型贯通（§2.3）、状态×URL 矩阵 + `!currentTeam`（BDD-38）、toggle 守卫（BDD-40）、单一不可用态（BDD-41）、移动端（BDD-43）、a11y（BDD-42/43） |
| **多端** | ✓ 覆盖（F4 缺口已闭合） | MCP（BDD-35~37）+ CLI 本地（BDD-31~33）+ **CLI 远程 PeekClient 透传（BDD-34）** + 契约贯通（§2.4/E2） |
| **边界** | ✓ 覆盖（F5 缺口已闭合） | 防枚举 404（BDD-2/7/8/9/12）、竞态（BDD-23/24）、NULL 空值（BDD-16）、share 生命周期（BDD-13）、update 三态互转（BDD-28~30）、**owner 禁用冻结（BDD-19）/ owner 删除 CASCADE（BDD-20）**、归档×team（BDD-6） |
| **兼容** | ✓ 覆盖（F5 缺口已闭合） | 非 breaking（BDD-25）、MCP minor bump（BDD-35）、**EXPLAIN 性能回归线（BDD-26）** |
| **安全** | ✓ 覆盖 | 防枚举/防 oracle（BDD-2/7/8/9/10/21/30）、share 泄露边界（BDD-11/12）、全局 key 语义统一（BDD-36 + A7/A8）、误发 public 事故线（BDD-21/22/37 客户端提示）、卡片误操作（BDD-40） |
| **可访问性** | ✓ 覆盖 | BDD-42（错误关联/确认框）+ BDD-43（键盘/tablist）+ §2.3 FilterChip label 参数化 + badge 文字图标成对 + live region |

**隐含需求覆盖结论**：五主维度 + 安全 + a11y 全覆盖；上轮 3 处缺口（F4 PeekClient 透传 / F5 owner 失效 + EXPLAIN）全部闭合为 BDD 锚，与 design-note §13 测试清单 11 项逐项对应（#1↔BDD-2/5、#2↔BDD-7~10/12、#3↔BDD-11~13/28、#4↔BDD-6/14/15、#5↔BDD-16/19/20、#6↔BDD-17、#7↔BDD-21/22/27~30/32、#8↔BDD-35~37、#9↔BDD-23/24、#10↔BDD-26、#11↔BDD-38~43）。

---

## 五、裁剪评审

- `phases: [P1, P2, P3, P4, P5, P6, P7, P8]` — **全走无裁剪**。理由（§4 + P0-brief 裁剪倾向一致）：P2 不可裁（schema + 三端 + 权限收敛安全域，backend 强制 plan-eng-review）；P3 必走（§13 测试清单 11 项全为可测行为）；P6 不可裁（权限矩阵实跑 + Playwright）；P7/P8 必走（多包跨端 + 双版本 bump）。
- **判定：✓ 无裁剪声明且与任务实际风险匹配**——schema 变更 + 权限收敛（安全）+ 三端 = P0-brief 明确「完整 P0-P8 无裁剪」。
- `ceremony: standard`（§4 显式声明，非 thin）——schema + 安全不做薄仪式，fail-closed 语义正确。

## 六、审声明核对（TAG0019：风险分级/裁剪声明 vs diff 证据）

- **声明 vs 实际改动**：
  - P1 frontmatter 声明：`risk_level: high` / `ceremony: standard` / `phases: [P1..P8]` / `domains: [backend, frontend, mcp, security]` / `packages: [backend/peekview, frontend-v3, packages/mcp-server]`。
  - **本阶段实际改动证据**：`git status --short` 显示工作区改动仅为 `agate-workspace/tasks/TPV0095-team-visibility/` 下的文档类文件（P1-requirements.md / dispatch-context ×4 / progress ×2 / P0-brief / P1-review / orchestrator-log / gate-events.jsonl）；`git diff --cached` 为空（P1 产出尚未 commit，符合阶段流程）；最近 commit d41873ea（P0 立项）+ 5525c319（design-note v4 文档）。
  - **核对结论**：文件类型 = 纯文档（md/jsonl）、规模 = 单任务目录、域 = agate-workspace 流程域。`risk_level: high` 依据 P0-brief/design-note §12 的任务域风险（权限 7 处收敛/迁移顺序/防枚举一致性/前端状态矩阵/MCP 文案安全线），非 P1 阶段改动本身——声明与实际一致，无漂移。
- **ceremony 核对**：`ceremony: standard`（非 full）→ 无「full 档 phases 含 P7」强制；实际 phases 含 P7（全走），满足最高档亦无缺失。✓
- **capability_requirements 三态核验**：四项（browser-vision / multi-user 场景 / schema 迁移 / MCP 集成）均 `available` 且 §7 判断说明逐项给出理由；browser-vision（need 含 vision）已声明 + 补充路径（vision-engine + playwright-cdp skill）→ frontend 视觉能力硬要求满足；无 supplementable/GAP，无「环境问题误标 supplementable」的机制误用。✓

## 七、P1 纯净性评审

- §1 需求复述 / §2 隐含需求 / §3 BDD 全部为问题与验收条件表述，无「怎么实现」的新方案选择。
- §5 同类扫描 A-E 表（文件路径/行号/处理判定 + 回归拦截声明）= 卡片强制节产物，属范围判定。
- rev1 相对上轮仅做拆条/补锚/口径澄清/文案量化，未引入实现设计；「成员口径」「断言三文案互异」等均为验收判定边界声明，非实现方案。
- 判定：✓ 纯净（P2 前无方案设计混入；design-note 既已定稿，P1 引用其决策语义不违规）。

---

## 八、非阻塞观察（不影响 approved，供 P3 测试拆分参考）

1. **BDD-18 含次级断言**：Then 末句「用户 A 若再创建同名（owner 内重复）→ 明确校验错误」是在主 When（B 创建）之外的补充操作。属上轮 F6 建议范围内的既有结构（name 唯一性同一行为域的两面：跨 owner slug -N / owner 内报错），rev1 已将 actor 写死消除歧义——判定成立，不构成新引入的多 G-W-T 违规；P3 建议拆两个测试用例实现。
2. **BDD-42 仍为多操作覆盖型**：一条 BDD 覆盖双入口 DOM + owner 全操作 + 成员退出，是上轮已接受（弱量化 F8）的 /teams 页验收广度形态，rev1 仅补齐其缺失断言；P3 应拆为多个前端测试用例逐操作断言。
3. **BDD-30 Given 冗余**：Given 提及「Carol 无关」但 When/Then 未使用该 actor，属背景演员注记，无判定影响（P6 建数据时忽略即可）。

---

## 九、结论

**status: approved**

- F1-F8 落实：**8/8 全部落实**（§一逐项引用修订后 BDD 编号：F1→BDD-7/8、F2→BDD-23/24、F3→BDD-28/29/30 + 口径统一、F4→BDD-34、F5→BDD-19/20/26、F6→BDD-18、F7→BDD-27、F8→BDD-42）。
- BDD 编号连续性：BDD-1~43 连续无跳号、无旧编号引用残留、交叉引用全部解析到现存编号（§三）。
- 无新引入问题：拆条/补条后每条单 G-W-T、可二值判定、与 design-note 无新冲突（§二逐条 + §八非阻塞观察仅 3 项不阻）。
- frontmatter 声明（risk/ceremony/phases/packages/domains/ui 形态/维度）与修订后内容匹配（§六）。

---

**评审锚点汇总**：43 条 BDD-1~43（格式 ✓ / 连续性 ✓ / 逐条可二值判定 ✓ / 覆盖维度逐条标注于 §二）；F1-F8 落实锚点 §一；隐含需求覆盖结论 §四；裁剪/审声明/P1 纯净性 §五-§七。Gate 读 Header `status: approved` 判定通过。
