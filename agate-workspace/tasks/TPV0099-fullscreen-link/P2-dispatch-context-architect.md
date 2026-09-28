# P2-dispatch-context-architect — TPV0099

---
phase: P2
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0099
role: architect
---

<!-- AGATE_CARD_START -->
<!-- AGATE_CARD_END -->

> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

## 目标

为「全屏模式链接 `/{slug}/f`」产出技术方案 `P2-design.md`：候选方案权衡 + 影响面梳理 + gate_commands 固化 + files_to_read 导航。P2 不可裁剪。

## 约束

- **三个 P0 决策已由用户裁决锁定，不得重开**：①URL = 路径后缀 `/{slug}/f`（否决 `?f`）②完全锁死（f/Escape 均无效、无页内出口）③元信息条一并隐藏
- **P1 已实核的重要结论（直接采信，勿重新论证）**：meta 条隐藏**早已存在**（`EntryDetailView.vue:260`，自 T082 起）→ 本任务**预期零 CSS 改动**；"zen 外观统一"不存在取舍
- **`→ 见 P1 §4.2**：zen 隐藏集实为 **8 项 + 3 处机制**，分布在 `layout.css`（7 项，含 :208 的 `.resize-handle` 与 :649-654 的 6 项）与 `EntryDetailView.vue:260`（1 项）+ 两处 `v-show` 兜底。**若你的方案决定"不复用 zen 类而新造锁死隐藏规则"，必须覆盖全部 8 项**，否则拖拽手柄会残留
- **不引入无关改动**：P1 §4.3 已登记三处存量问题（死选择器 `.mobile-actions`、重复 `zen-shortcut.spec.ts` 两文件、`t052:141` 恒真假绿测试）判定为"本次不处理"，**不得顺手修复**（违反 P1 范围声明）
- 严格遵循 P1 的 16 条 BDD 语义，不擅自放宽/收紧判据；若确需变更须报告主 Agent（P1 基线保护）
- 子派发能力：不启用

## 需要你决策的三个开放点（P1 已明确留给你）

| 编号 | 开放点 | P1 记录位置 |
|---|---|---|
| R1 | JSON-accept 客户端访问 `/{slug}/f` 返回 **404**（走 `resolve_entry_raw("slug/f")`）——是否新增后端分支（如把两段 `*/f` 归入 `_is_frontend_route`）？**注：P0 原判"后端零改动"，故此项若选择处理即为范围扩大，须显式论证** | P1 §8 R1 |
| R2 | 锁死状态**如何承载**：新增独立状态位 vs 复用/扩展 `zenMode`+`route.meta`？须显式区分"锁死态"与"zen 态"，避免误改全局 zen 把 f 键 zen 一起锁死 | P1 §8 R3 |
| R3 | 锁死的 `preventDefault` **边界**：如何做到"不改变全屏视图状态"但**不吞掉**内容区内嵌组件的 Escape（`TableView.vue:227` 分页浮层等） | P1 §8 R4 / BDD-7 |

## 上游关联

- **P1 产出**：`P1-requirements.md`，**16 条 BDD**，0 待确认项（`[NO_NEED_CONFIRM]`）
- **P1 关键结论**：① meta 条隐藏已存在（本任务零 CSS 改动，范围缩小）② zen 隐藏集 8 项/3 处机制（更正了 P0 的"7 项"）③ `.resize-handle` 为 P1 新发现的第 8 项 ④ `shouldHandleZenShortcut` 不改（纯函数不持 zen 状态，短路应在 `useZenMode` 调用方）⑤ 图表全屏弹层**当前无任何 Escape 监听**（t022 的 Escape 断言所依赖选择器已死），故锁死与图表的 Escape 冲突面**较窄**，真正消费方是 `TableView` 分页浮层 / `ShareDialog` / `OverflowMenu`
- **P1 同类扫描**：逐符号命中清单见 P1 §4.1；三处存量问题见 §4.3（均"不处理 + 理由"）
- **[P0_STALE]**：meta 条前提为假，已就地更正 + 严重性判定为「轻微，不重开 P0」（P1 §5）
- **P1 §7 裁剪说明**：全 8 阶段保留，无裁剪 → **不声明 `跳过风险` / `coupling_checklist` / `internal_only`**；`ceremony` 缺省 standard

## 输入文件

- `agate-workspace/tasks/TPV0099-fullscreen-link/P1-requirements.md`（**主要输入**：16 BDD + 影响面 + R1-R6 风险登记）
- `agate-workspace/tasks/TPV0099-fullscreen-link/P0-brief.md`（环境约束、已知风险、**文末「P0 时效性自检」与「环境自检」节**）
- `frontend-v3/src/router.ts`（路由表；`:slug` 在 catch-all 前；现存两段路由仅 `/settings/apikeys` 与 `/users/:username`）
- `frontend-v3/src/composables/useZenMode.ts`（36 行全文，锁死短路落点）
- `frontend-v3/src/utils/zen-shortcut.ts`（`shouldHandleZenShortcut` / `redirectFocusIfHidden`）
- `frontend-v3/src/composables/entryDetailKeys.ts`（`ZenModeKey`/`IsMobileKey`/`ZenAriaTextKey`）
- `frontend-v3/src/views/EntryDetailView.vue`（zen 装配 + scoped 第 7 项隐藏）
- `frontend-v3/src/styles/layout.css`（:208 第 8 项；:649-654 六项；:624-626 桌面 meta 条隐藏）
- `frontend-v3/src/components/TableView.vue` 第 220-250 行（Escape 消费方，BDD-7 对象）
- `backend/peekview/main.py` 第 25 行 / 第 52-62 行 / 第 590-635 行，以及 `backend/peekview/api/files.py` 的 `resolve_entry_raw`（R1 决策用）
- `frontend-v3/playwright.config.ts` + `frontend-v3/e2e/` 任一近期 spec（E2E 双 project 与编写规范）
- `AGENTS.md`（项目约定）、`agate-workspace/agents/project.md`（gate 命令与测试基线）

## P2 最小验证（强制）

方案设计前先用最小验证确认关键假设（curl / 20 行脚本 / 10 行 HTML）。方案依赖浏览器行为与安全模型（路由匹配、DOM 可见性、键盘事件分发）→ **必须做最小验证**，不得只声明"纯代码逻辑"。

建议验证点（结果写入 P2-design.md 的 `minimal_validation` 字段）：
- `/yaml-docker-compose/f` 当前的路由归属（命中 NotFoundView 而非 `:slug`）——**主 Agent 已实测**：`path=/yaml-docker-compose/f`、`.entry-detail` 不存在、`Page not found` 文案存在
- `document` 级 keydown 与元素级 Escape 的**分发顺序**（验证 BDD-7 可行：锁死不吞内嵌浮层 Escape 的实现路径）
- `route.meta` 在参数化路由下的可用性（`/:slug/f` 的 meta 读取）
- 若涉及 R1 的后端分支：`_prefers_json` 判定链的实际行为（**主 Agent 已实测**：浏览器 accept → 200 + NotFoundView；`Accept: application/json` → 404 `{"error":{"code":"NOT_FOUND","message":"Entry not found: {slug}/f"}}`；对照 `/{slug}/raw` → 302）

## 产出与格式

- 产出：`agate-workspace/tasks/TPV0099-fullscreen-link/P2-design.md`
- **必含 frontmatter 机器字段**（用 `agate-md-field-set` 写，不手写）：`candidate_count`（≥2；若声明 `design_trivial`/`follows_existing_pattern` 可 1，**须附理由**）、`packages`、`domains`、`ui_affected`
- **P2 gate 会校验**：`ui_affected: true` → 正文必须含 `## UI 设计` 节，节内含**渲染形态声明**（复用 P1 `ui_render_shape: layout` 的规范值，gate 按规范化值比对 P1-P2 一致性）+ **维度选择**（复用 P1 `ui_ux_dimensions`：布局结构/交互行为/视觉呈现）+ **按形态 checklist**（常规布局型 = 布局/交互/视觉三类）。缺任一 → exit 1
- 正文必含**影响面梳理**（Modify / Not Modify / Risk 三部分，改动落点须到"哪个文件的哪个小节/函数"）；**Not Modify 栏尤其重要**（P1 §4.3 三处存量问题须列在此，避免 P4"顺手修复"）
- 正文必含 `gate_commands`（**引用 Makefile target，不手写裸命令**——Makefile 是测试命令的唯一真相源）+ `files_to_read` + `env_constraints` + `minimal_validation`
- **`gate_commands` 硬要求**：`ui_affected: true` → **必须含 `P5_e2e`**（本次 16 条 BDD 大量落在 E2E 层）；建议同时声明 `P5_e2e_timeout_seconds: 300`（E2E 档）与 `P5_timeout_seconds: 120`（单测档）。**禁止把多个命令用 `&&` 拼进同一 key**（短路会让后半段从不执行）
- 写完跑 `python3 /home/kity/.agate/v0.76.0/agate/scripts/check-frontmatter.py <产出路径>`，非 0 先修正再返回
- 分阶段落盘：每读完一个文件/完成一个关键步骤，立即追加写 `P2-progress.md`；每条 bash 命令执行前也追加一行

## 命令超时（强制）

任何 bash 命令设 `timeout 180s <cmd>`（E2E/构建类按 300s/600s×1.5）。超时或非预期失败 → ① 停止，不换命令不深挖；② progress 写一行；③ 返回主 Agent 决定。

## 环境隔离（强制）

只用 debug `:8888`（**主 Agent 已起，挂了长托底 job**）。**严禁**触碰生产 `:8080` 与 `~/.peekview/`；**严禁** `uvicorn` 直接启动、**严禁** `make debug`/`npm run dev`（vite :5173 会代理到生产）。状态标记二值格式：`[PROD_TOUCHED] {描述}` / `[PROD_NOT_TOUCHED]`。

## 环境约束（P0-brief 已详载，此处重申关键项）

- **DSH 沙箱**：`/tmp` 与 `~/.local/share` 只读；`/tmp` **跨 bash 调用不共享文件**；后台服务须挂持续 running 的 job 托底。临时产物落 `{project_root}/.agate-tmp/`
- **seed 数据缺陷（DEBT0012，主 Agent 已实核为确定性而非偶发）**：`seed-debug.py` 先建 entry（L173）后建 team（L264），而 `_resolve_team_for_user` 对不存在 team 抛 422 → **全新 DB 首次 seed 时 3 条带 `team_id` 的 entry（`csv-employees`/`markdown-test`/`mermaid-charts`）必定失败**，重跑才恢复。且这些 entry **即使 `is_public: true`，匿名也 404**（团队限定）。`make debug-seed` 默认 `tail -10` **会截断掉 FAIL 行**（看不到失败）——需完整输出请直接 `python3 scripts/seed-debug.py http://127.0.0.1:8888`。**设计 E2E 时不要依赖这两条 team-scoped entry 的匿名可达性**；P1 BDD-7/BDD-15 引用它们的问题正由 requirements-review 判定
- seed 计数三口径（都对，勿混淆）：seed-data 目录 24 / alice 可见 22 / **匿名可见 15**

## 门槛（什么算完成）

- `P2-design.md` 存在且非空；`candidate_count`/`packages`/`domains`/`ui_affected` 齐备且与正文一致
- 候选方案 ≥2（或声明简化 + 理由）+ 权衡 + 选择理由
- 影响面梳理三部分齐备（Modify 落点到文件+小节/函数；Not Modify 含 P1 §4.3 三处；Risk 每条配缓解）
- `ui_affected: true` → `## UI 设计` 节含形态声明 + 维度选择 + 按形态 checklist
- `gate_commands` 含 `P5_e2e`（ui_affected），引用 Makefile target，无 `&&` 拼接；含 `_timeout_seconds` 声明
- `minimal_validation` 有实跑结果（非"纯代码逻辑"空声明）
- `check-frontmatter.py` 退出码 0
- R1/R2/R3 三个开放点均有明确取舍结论

## 返回给我（只两行）

1. 产出文件路径
2. 一句话摘要（≤30 字，含候选方案数 + 关键决策）

**不要返回文件全文。**

## 客观查证信息（objective_info）

- 环境：debug backend `http://127.0.0.1:8888`（主 Agent 已起 + 长托底），version 0.24.1；`VERSIONS.json` peekview=0.24.1
- 主 Agent 实测（可直接引用）：`/yaml-docker-compose/f` → `path` 保持 `/yaml-docker-compose/f`、`.entry-detail` 不存在、页面含 `Page not found`（命中的是 `/:pathMatch(.*)*`）；`Accept: application/json` 时 → 404；`/{slug}/raw` → 302
- 前端测试基线：`Test Files 110 passed` / `Tests 1343 passed | 4 skipped (1347)`
- E2E：`playwright.config.ts` 双 project（chromium + Mobile Chrome/Pixel5），`baseURL` 默认 `:8888`，无 webServer 自启
- 关键选择器：`.entry-detail`（zen 类挂载点）、`[data-testid="content-area"]`、`.meta-tags-bar`（`v-if="isMobile"`）、`[data-testid="mobile-bottom-bar"]`、`.diagram-modal`

> 本文件不含通过/失败预判。
