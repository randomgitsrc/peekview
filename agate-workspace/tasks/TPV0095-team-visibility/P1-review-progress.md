# P1 Review Progress — TPV0095 team-visibility（requirements-review）

trace_id: TPV0095-P1-requirements-review-20260902
phase: P1
agent: requirements-review
[PROD_NOT_TOUCHED]

## 读取记录

1. [x] dispatch-context（P1-dispatch-context-requirements-review.md）— 评审重点/审声明要求/输入清单已读
2. [x] 角色文件（~/.agate/assets/review-roles/requirements-review.md）— 检查清单已载入
3. [x] P0-brief.md — 约束/风险来源/决策 A-G/known_risks
4. [x] P1-requirements.md（评审对象，35 BDD，423 行）
5. [x] docs/design-notes/team-visibility.md（权威源 v4 终版，494 行）— 冲突时以 design-note 为准
6. [x] P1-progress.md（analyst 落盘）— 同类扫描证据与自检记录
7. [x] .state.yaml — judge.enabled: true（主 Agent 职责，非本评审范围）
8. [x] git 状态 — 工作区改动仅 agate-workspace/TPV0095 文档类（P1 阶段无代码改动，git diff --cached 为空）；最近 commit 5525c319（design-note v4）+ d41873ea（P0 立项文件）

## 发现清单（评审进行中）

### F1（BDD-7，跨条一致性/权威源冲突）
- BDD-7 将「team 详情」列入 Bob（成员）与 Carol 请求清单，Then「无权者…一律 404」——
  若按字面 Bob 对 详情 也 404，与 design-note §5.1 API 表「GET /teams/{slug} 详情（含成员列表）owner + 成员」冲突；
  Then 括号「Bob 对管理操作」又只限定管理操作 → 成员读详情（200）既未显式断言也未排除，语义歧义。
- P1 自声明 design-note 为唯一真相源；dispatch-context 要求冲突时以 design-note 为权威并标注差异。
- → 需 analyst 澄清：Bob（成员）GET /teams/{slug} 详情 = 200（成员可见，design-note §5.1），管理操作（重命名/删除/加/移成员）= 404；仅完全无关者（Carol）对全部接口 404。拆分或改写。

### F2（BDD-20，单 BDD 多场景）
- BDD-20 合并两个独立 When/Then：(a) 成员被移除后立即读 → 404（确定性）；
  (b) team 删除与 list_entries 并发不抛 5xx（竞态，测试手法不同）。
- 违反「每条 BDD 只有一条 Given-When-Then，多场景拆独立编号」。需拆为两条。

### F3（BDD-23，跨条一致性 + 多场景）
- BDD-23 单 BDD 内合并三子场景（team→public 撤 share / 迁移至本人拥有 team 成功 / 迁移非本人 team 422），
  其中「另：」段 = 独立 When/Then，未拆号。
- 语义疑点：update 目标 team 校验口径 =「本人拥有」（BDD-23）还是「本人是成员」（BDD-18 口径为成员、create 校验为非成员→422）？
  design-note §5.2 两行术语不一（"不存在或非成员" vs "属于本人"）。BDD-18 Given 限定 Carol 非成员故不直接冲突，
  但 update 目标是「成员但非拥有」的 team 时两条判定规则可能给出相反结果 → 需显式定口径（建 share/UI 8.7 下拉 = 我的 teams 含 joined，倾向成员口径，需 analyst 定）。

### F4（E2/CLI 远程模式无验收锚，隐含需求覆盖缺口）
- §2.4/E2 明确 PeekClient（backend/peekview/client.py）透传 team_id 为「本次处理」（CLI --team 远程模式依赖），
  但 BDD-24/25 Given 均声明「本地模式」→ CLI 远程模式（PeekClient payload 透传）无任何 BDD 验收锚。
- 已识别需求未闭环 → 需补 BDD（远程 create --team 经 PeekClient 对 debug backend 断言 team 归属）或改 Given 覆盖。

### F5（design-note §13 测试清单 → BDD 映射缺口）
- 决策 D（P0 决策表）/design-note §3.5/§13#5 的「owner 禁用 → team 冻结（成员仍可见）」与「owner 删除 → CASCADE」仅有 §2.5 散文提及，无 BDD；
- §13#10「EXPLAIN QUERY PLAN 索引命中、无逐行子查询」无 BDD（E5 以散文提及 P5 验证但无验收条件）。
- 核心生命周期语义 + 性能回归线缺验收锚 → 需 analyst 决定补 BDD 或显式声明落 P3 测试（不落 P1 验收）并给出理由。

### F6（BDD-17 微歧义）
- 「slug 为 alpha-1」未指明归属哪个 actor/创建顺序：A 已有 alpha，B 后创建同名 → B 得 alpha-1；
  A 再创建同 slug 意图的 team → 取决于名称（owner 内同名则撞 UNIQUE(owner_id,name) 报错，异名同 slug 意图才走 -N）。
  建议明确两 actor 各自预期。

### F7（BDD-22 标题/正文不符，微）
- 标题「create/PATCH 携带 team_id 强制 is_public=false」，Given/When/Then 仅覆盖 create；
  PATCH 强制 is_public=false 无断言（BDD-23 只覆盖转换路径）。

### F8（BDD-34 量化微弱，微）
- 「username 不存在/重复/无权操作各有明确错误提示」无量化锚；建议引用 design-note §8.1 文案（"用户不存在"/"已是成员"/"无权操作"）
  或断言三文案互异。另 /teams 入口（UserMenu Teams 项 + Teams tab 管理链接）Given 声明但无显式断言存在性。

### F9（UX 判据核验 — 通过）
- BDD-30/31/35（布局结构）+ BDD-32/33/34（交互行为）标题带类别后缀，与 frontmatter ui_ux_dimensions=[布局结构, 交互行为] 对齐；
  无主观词（可读/美观/流畅/平滑/自然/响应灵敏 均无）；判据经 DOM 结构/文案/计算样式/URL/尺寸（≥44px、scrollWidth）可二值判定，未绑 CSS 类名。
- browser-vision capability 条目已声明（need 含 vision，status=available + 补充路径 vision-engine/playwright-cdp）→ frontend 硬要求满足。

### F10（审声明 — 通过）
- risk_level=high / ceremony=standard / phases=[P1..P8] / domains=4 / packages=3：
  与 P0-brief（risk medium-high 上沿、schema+安全+三端）一致；ceremony=standard 非 full → 无 P7 强制项（P7 仍含，全走）；
  本阶段（P1）工作区实际改动 = 纯文档（agate-workspace 任务目录），git diff --cached 为空 → 声明与阶段证据匹配，无代码域漂移。
- capability 四项均 available：browser-vision/multi-user/schema-migration/MCP 三态判断符合判断树（能力可经 skill/工具补齐，非环境不可得）。

### F11（P1 纯净性 — 通过，带注记）
- §5 A-E 表含文件路径/行号 = 卡片强制「同类扫描」产物（命中清单+处理判定），非方案设计；
  个别实现口吻范围注记（A9 unstar 回退、E5 EXPLAIN 时机）属范围判定，因 design-note 已双评审锁定决策，P1 引用不构成设计混入。

## 结论

- 判定：**needs-revision**（F1-F5 需 analyst 修改；F6-F8 建议一并处理）
- BDD 格式与连续性：BDD-1~35 连续、`#### BDD-NN:` 标准格式、每条可二值判定主体成立；
  需修改集中在「拆场景/定口径/补验收锚」三类，非重写。

## 完成

P1-review.md 已产出（status: needs-revision），返回主 Agent。

---

## rev1 复审读取记录（覆盖式评审轮）

1. [x] rev1 dispatch-context（P1-dispatch-context-requirements-review-rev1.md）— 复审重点 F1-F8 + 编号连续性 + 无新引入问题
2. [x] 角色文件（~/.agate/assets/review-roles/requirements-review.md）
3. [x] 上轮 P1-review.md（needs-revision，F1-F8 问题清单源）
4. [x] P1-requirements.md（修订后评审对象，43 BDD，471 行）
5. [x] docs/design-notes/team-visibility.md（权威源 v4 终版）— §3.5/5.1/5.2/7.2/8.1/8.2/8.4/12/13 相关节对照
6. [x] P0-brief.md（约束 + 决策 A-G）
7. [x] git 状态 — 工作区改动仅 agate-workspace/TPV0095 文档类；git diff --cached 为空；最近 commit d41873ea（P0）+ 5525c319（design-note v4），P1 阶段纯文档无代码域改动

## rev1 机械核对记录

- 43 条 `#### BDD-NN:` 标题 grep 命中 43 条（行 116-350），BDD-1~43 连续无跳号
- 正文分组行 111 映射与 3.1~3.13 分组标题完全对应（1~6/7~8/9~10/11~13/14~15/16~20/21~22/23~24/25~26/27~30/31~34/35~37/38~43）
- 全文件 BDD-\d+ 引用 79 处全部指向现存编号（1~43），无旧编号残留；修订记录行 43 对上轮编号的指代属修订史叙述，非残留
- 逐 F 项核对结论见 P1-review.md rev1

[PROD_NOT_TOUCHED]

## rev1 结论

- P1-review.md 已覆盖写（Header status: approved，agent: requirements-review，含 43 BDD 编号锚点 + 覆盖维度标注）
- F1-F8 8/8 全量落实：F1→BDD-7/8、F2→BDD-23/24、F3→BDD-28/29/30（成员口径全文统一）、F4→BDD-34、F5→BDD-19/20/26、F6→BDD-18、F7→BDD-27、F8→BDD-42
- 编号连续性：BDD-1~43 连续无跳号（grep 命中 43）、79 处引用全部指向现存编号、无旧编号残留
- 无新引入问题（§八非阻塞观察 3 项不阻 approved）

[PROD_NOT_TOUCHED]
