---
phase: P2
task_id: TPV0095
type: review
parent: P2-design.md
trace_id: TPV0095-P2-plan-design-review-rev1-20260902
status: approved
created: 2026-09-02
agent: plan-design-review
---

# P2-review-design — 前端/UI 方案评审 复审 rev1（TPV0095 team-visibility）

> 评审范围：修订后 P2-design.md（574 行）§5.1-5.8 +「UI 设计」节 + §5.7 稳定测试标识清单 + §6/§11/§12；语义权威 = docs/design-notes/team-visibility.md §8；验收权威 = P1-requirements.md BDD-38~44（含 [SCOPE+] BDD-44）。评审方式：只读 + 逐 N 项对上轮 N 清单核对 + 前端源码锚点抽查。环境隔离状态：**[PROD_NOT_TOUCHED]**（仅读 task 目录内文件，未触碰生产 :8080 / ~/.peekview/ / pipx peekview）。

## 结论

**Status: approved**

上轮 needs-revision 的 3 个修订项（N1-N3）与 4 条非阻塞建议已在修订后 P2-design.md 全部落实；修订锚点与 BDD-38~44 验收线一致、P1-P2 形态声明一致（ui_render_shape=layout ↔ 渲染形态: layout）、未发现新引入问题。本文件覆盖写上轮（rev0 needs-revision → rev1 approved）。

## 上轮修订项逐 N 核对（rev1 复审基准）

| N 项 | 上轮要求 | 修订后锚点 | 落实判定 |
|---|---|---|---|
| N1 | UI 设计节交互 checklist「需人工复核」改为明确动作；P6 复核落为逐态 Playwright 断言而非散文「人工复核」 | UI 设计节交互 checklist「输入态规格已设计（非'待人工复核'散文）」（§UI 设计 :359）+「P6 复核落为明确自动化动作：teams-page.spec.ts 内输入态逐态 Playwright 断言 + 截图」（:361）；§5.5 新建/成员输入逐态规格已入正文 | ✅ 落实。checklist 不再是「声明复核需求即 [x]」空转项，输入态实现细节（校验/成功/失败 + live region）已写死进 §5.5，P6 载体 = teams-page.spec.ts 自动化断言 |
| N2 | data-testid 集中清单节补齐 + §5.3 toggle 隐藏边界 + BDD-44 detail 三态载体二选一写死 + /teams 新建表单输入/输出规格 + myTeams store 动作清单 | §5.7 稳定测试标识清单（集中节）；§5.3「隐藏边界（防整组误删）」；§5.8「实现载体二选一（锁定 BaseBadge）」「三态逻辑（写死）」；§5.5 新建表单组件级输入/输出；§5.5 stores/team.ts myTeams 动作清单 ①-⑤ | ✅ 落实（明细见下） |
| N3 | 三态文案表并排收口；list 视图非 owner 不渲染 badge 声明 | §5.2「三态文案归属表」（暂无团队内容 / 该团队暂无内容 / 团队不可用 并排 + 是否调 listEntries + testid）；§5.2「badge 渲染声明（list 视图边界）」 | ✅ 落实（明细见下） |

### N2 明细核对（data-testid 清单完整性与 BDD 锚定）

§5.7 清单 16 类元素全部补齐，与上轮 N2 列目逐一对应：

| 上轮 N2 要求的 testid | 修订后 §5.7 | 断言用途（BDD） |
|---|---|---|
| 5 tab（tab-all/mine/teams/archived/starred） | 首行，含既有 tab-starred 保留兼容声明 | BDD-38 高亮互斥 |
| team-chip-{slug} | 有（chip 容器 testid） | BDD-38 chip 过滤态 |
| team-unavailable + clear | 有 | BDD-41 不可用态 + CTA |
| team-empty | 有（team-empty，成员无内容空态） | BDD-41 三态之一 |
| badge-team | 有 | BDD-39 存在/不存在断言 |
| visibility-toggle | 有（EntryCard 与 EntryListRow 统一命名） | BDD-40 隐藏后 count=0 |
| teams-owned / teams-joined | 有 | BDD-42 分区断言 |
| team-create-form / team-name-input | 有 | BDD-42 新建输入态 |
| team-member-username-input | 有 | BDD-42 成员输入态 |
| team-error | 有（新建/成员共用错误区） | BDD-42 三错误文案互异 |
| teams-status-live | 有 | 成功/失败播报断言 |
| 双入口 user-menu-teams-item / teams-manage-link | 有 | BDD-42 DOM 存在性 |
| ConfirmDialog 删除/退出确认 | 有（alertdialog role 可定位） | BDD-42 确认对话框 |
| 补充：teams-empty（聚合空态） | 有 | BDD-41 三态之一 |

§5.3 toggle 隐藏边界：明确「toggle 与 delete 同容器（EntryCard card-actions / EntryListRow entry-actions）——仅隐藏 visibility toggle，delete 保留」+「detail 溢出菜单 Make Private/Public 不改（store 守卫拒绝）」（:287）→ 防 P4 整组误删/越界（上轮 N2-2 ✅）。
BDD-44 detail 三态载体：§5.8 锁定 **BaseBadge status union + team 变体**（与卡片 badge 同源渲染、视觉一致），不就地扩展 span.status-tag；三态逻辑 `teamId ? team 文案 : (isPublic ? 'Public' : 'Private')` 写死；EntryDetailMobileBar 不改（:340-342）→ 载体与 P1 BDD-44「BaseBadge 复用」一致（上轮 N2-3 ✅）。
/teams 新建表单输入/输出：§5.5 容器/输入 testid + 空/超长/重名校验 + 成功反馈（新卡入 owned 顶部 + live region 播报 + 清空输入 + slug 自动生成展示）+ 失败（错误区 + live region + 输入保留）——触发条件/用户输入/预期输出三要素齐全（上轮 N2-4 ✅；角色维度「组件完整性」缺口关闭）。
myTeams store 动作清单：§5.5 ① 加载时机（登录后 + mount，匿名不加载）② 登出清零 ③ 增删改后同步（owned/joined 分区重算）④ 会话快照过期语义（与 BDD-23 服务端实时判定一致，快照只影响 UI 判定）⑤ explore 与 /teams 共享单 store——五条动作边界齐（上轮 N2-5 ✅）。

### N3 明细核对

§5.2 三态文案归属表将「暂无团队内容（teams 聚合空态）/ 该团队暂无内容（team 成员无 entry）/ 团队不可用（slug ∉ myTeams，不调接口）」并排收口，附「是否调 listEntries」与 testid 两列——BDD-41「两文案可区分 + 不可用态无歧义」的判定依赖成立；「可选附 team slug 名」作为理解辅助保留为非必须（:278-280 ✅）。
§5.2 badge 渲染声明：非 owner 列表项不显示任何可见性 badge（含 team badge），EntryCard（isOwner||isExpired 才显示 footer badge 区）与 EntryListRow（:84 v-else-if="isOwner"）两视图一致——防 P4 对非 owner 项过度渲染（:282 ✅）。

## 非阻塞建议采纳核对（上轮 §非阻塞建议）

| # | 上轮建议 | 修订后状态 |
|---|---|---|
| 1 | §5.1 补「高亮规则 = 现状语义 + team 扩展，不重构 archived/starred 与 All 既有激活关系」 | ✅ 采纳为范围声明（§5.1 :265，含双激活路径保留说明） |
| 2 | §5.2「slug ∉ myTeams 不调 listEntries」注明判定依赖 myTeams 已加载（防竞态误判） | ✅ 采纳（§5.2 :273「判定依赖 myTeams 已加载（防竞态误判）」） |
| 3 | §5.6 键盘导航二选一，P3 断言只锁一种 | ✅ 采纳并锁定 tablist + 方向键，明确不采用 aria-pressed 方案（§5.6 :312 + §UI 设计 checklist） |
| 4 | E2E spec 拆分建议 | ✅ 采纳（§6 gate_commands P5_e2e_a/b 两键 + :405 spec 命名与承载分工） |

## 与 BDD-38~44 一致性核对

| BDD | 设计锚点 | 一致性 |
|---|---|---|
| BDD-38 5-tab 互斥 + URL | §5.1 高亮规则 + §5.4 状态 × URL 矩阵 | ✅ All 激活含 !currentTeam；Teams 激活 = view==='teams'；URL view/team 唯一持久源 |
| BDD-39 team badge 不叠 private | §5.3 badge 优先级 + §5.7 badge-team | ✅ 两视图统一 `teamId ? 'team' : ...`；断言存在/不存在双向 |
| BDD-40 toggle 隐藏 + store 守卫 | §5.3 隐藏边界 + entryList.ts toggleVisibility teamId 守卫 | ✅ delete 保留 + UI/store 双保险；count=0 断言目标 |
| BDD-41 不可用态 | §5.2 三态表 + 判定依赖 myTeams settle | ✅ 三态文案可区分 + 不调接口 + testid 齐 |
| BDD-42 /teams 双入口 + 管理 | §5.5 结构/状态/输入输出 + §5.7 双入口 + 错误区 | ✅ 双入口 DOM 断言、owner 全操作、成员退出、三错误文案互异、确认框后果提示 |
| BDD-43 移动端 + 键盘 | §5.6 tablist + 方向键 + overflow-x + ≥44px + DESIGN.md :200-201 修订 | ✅ BDD-43「tablist 语义或 aria-pressed」取 tablist 分支锁死 |
| BDD-44 detail 三态 | §5.8 + P1 [SCOPE+] 增补 | ✅ 载体与 P1 声明一致；三态可区分；P6 逐态断言 + 截图 |

## 无新引入问题核对

修订新增内容（§5.2 三态表 / §5.5 输入规格 + store 动作 / §5.7 清单 / §5.8 三态 / UI 设计 checklist）与既有 §5.1-5.6 无矛盾；文案表「该团队暂无内容」在 §5.2 :272 与三态表 :279 两处一致；§5.2 teams-empty 与 §5.7 表、UI 设计 checklist 引用三态文案三处同源。P1 frontmatter（ui_render_shape=layout / ui_ux_dimensions=[布局结构,交互行为]）与 P2「渲染形态: layout / 适用维度: 布局结构、交互行为」一致。未发现新引入缺口。

非阻塞观察（不入本 gate 判定）：§5.7 `team-error` 由新建表单与成员操作共用——两者极少同时呈现（新建表单在 owned 分区顶部、成员操作用在 team 卡详情内），共用一个错误区 testid 在 P3/P6 定位不冲突；若 P4 实现发现两表单同屏场景，可加区分 testid（如 `team-error-create`），不影响本清单验收语义。

## 评审维度评分（0-10，rev1 终评）

| 维度 | rev0 | rev1 | 变化依据 |
|---|---|---|---|
| 交互状态覆盖率 | 7 | 9 | N2/N3 补齐后：teams 聚合空态、team 空态、不可用态、输入态、错误态、loading/disable/确认框全有归属表与 testid |
| AI Slop 风险 | 6 | 9 | §5.7 集中清单 + §5.5 输入/输出规格 + §5.8 载体写死——P4/P3 自由发挥空间大幅收敛 |
| 移动端考虑 | 9 | 9 | 不变（§5.6 + DESIGN.md 修订 + Pixel5 项目支撑） |
| 可访问性 / 键盘可达 | 8 | 9 | N1 落为自动化动作 + tablist 方案锁死 + live region/alertdialog/aria-describedby 齐全 |
| 组件完整性 | 6 | 9 | 每 UI 组件均有触发条件 + 输入 + 预期输出 + testid |
| 视觉设计（frontend 必评） | 8 | 8 | 全 token 复用、无新 hex/emoji；BaseBadge team 变体 + label 参数化沿用色板规范 |
| 交互设计细节（frontend 必评） | 7 | 9 | 输入态逐态规格（校验/成功/失败 + 反馈动作）非散文；键盘/禁用/过渡齐 |
| 合计（视觉+交互）/2 | 7.5 | 8.5 | — |

> 渲染正确性/时序维度：P1 声明 `ui_render_shape: layout`、适用维度 = 布局结构/交互行为——非渲染组件/时序特效型任务，按角色规则不启用渲染/时序维度。

## BLOCKER 清单

无。未发现安全、功能性或规格性阻断项；N1-N3 修订闭环，无新引入问题。

## 环境隔离状态

**[PROD_NOT_TOUCHED]** — 本复审仅只读 task 目录内文件（P2-design.md / P1-requirements.md / 上轮评审 / progress），未运行服务、未触碰生产 :8080 / ~/.peekview/ / pipx peekview。产出：P2-review-design.md（本文件，覆盖写）+ P2-review-progress.md（追加）。

## 评审结论

**Status: approved** — 修订后 P2-design.md 已完整落实上轮 N1-N3 与全部非阻塞建议，修订锚点可定位（§5.2 三态表 / §5.3 隐藏边界 / §5.5 输入规格 + myTeams 动作 / §5.7 testid 清单 / §5.8 三态载体 / §UI 设计 checklist），与 BDD-38~44（含 BDD-44）验收线逐条一致，无新引入问题。可进入 P2 gate 与 P3。
