---
phase: P1
task_id: T017
task_name: theme-media-query-fix
trace_id: T017-P1-2026-06-21
parent: T017-P0-2026-06-21
type: requirements-baseline
created: 2026-06-21
status: ready
---

# P1 需求基线：主题切换 @media 冲突修复

## 需求复述

**问题**：`github-markdown-css` v5.9.0 内置 `@media (prefers-color-scheme: dark)` 媒体查询，该查询的选择器直接命中 `.markdown-body`，绕过了 PeekView 通过 `data-theme` 属性建立的主题控制层。导致：当操作系统处于黑夜模式时，即使用户在 PeekView 切换到 light 主题，内容区仍被 `@media` 强制渲染为暗色。

**要解决什么**：
- 消除 `@media (prefers-color-scheme)` 对 `.markdown-body` 的越权控制
- 让内容区主题表现**完全且唯一**由 `data-theme` 属性决定，与操作系统主题解耦

**做完什么样算对**：
- 系统黑夜 + `data-theme=light` → 内容区呈现 light 配色
- 系统白天 + `data-theme=dark` → 内容区呈现 dark 配色
- 切换 `data-theme` 时内容区即时跟随，不受系统主题干扰

## 隐含需求识别

按维度逐项过：

| 维度 | 识别结果 | 说明 |
|------|----------|------|
| 数据 | 无 | 纯前端 CSS 改动，无数据迁移 |
| 前端 | **有** | `.markdown-body` 主题逻辑变更，`domains: frontend`，`ui_affected: 内容区渲染` |
| 多端 | 无 | MCP/CLI/API 不涉及展示层，仅前端 CSS |
| 边界 | **有** | 见下方隐含需求 #3、#4 |
| 兼容 | **有** | 见下方隐含需求 #1、#2 |

**隐含需求清单**：

1. **[必须] github-markdown-css 升级时 patch 不可丢失**
   - 为什么必须：直接编辑 `frontend-v3/public/css/github-markdown.css` 是对第三方文件的本地 patch。未来若 `npm` 重新拉取或升级该 CSS，patch 会被覆盖，bug 复现。
   - 隐含动作：需有机制保证 patch 可重现（文档化 patch 规则，或 postinstall 脚本，或锁定版本）。**本任务至少需文档化 patch 规范**，供升级流程参考。

2. **[必须] Shiki 代码高亮主题需跟随 `data-theme`，且不受 `@media` 影响**
   - 为什么必须：P0 known_risks 明确指出"Shiki 代码高亮主题跟随需同步验证"。若 Shiki 用独立 CSS 变量或 `@media`，patch github-markdown-css 不能修复代码块割裂。
   - 隐含动作：P4/P6 需验证 Shiki 高亮在系统黑夜 + `data-theme=light` 下为 light 主题。

3. **[必须] PlantUML/Mermaid 图表主题需跟随 `data-theme`**
   - 为什么必须：P0 known_risks 明确列出。图表若通过 `@media` 或独立机制切主题，patch 后仍割裂。
   - 隐含动作：P4/P6 需验证 Mermaid/PlantUML 在系统黑夜 + `data-theme=light` 下为 light 主题。

4. **[必须] `data-theme` 切换是运行时动态切换，非仅首屏**
   - 为什么必须：用户可在浏览过程中切换主题。若 patch 后 CSS 仅匹配初始属性，运行时切换可能不生效。
   - 隐含动作：BDD 必须覆盖"切换后即时跟随"场景，P6 用 Playwright 实跑切换动作。

5. **[观察] light 作默认值的兜底语义**
   - 为什么必须：P0 方案 A 让 light 作默认（无 `data-theme` 时也走 light）。需确认这与 PeekView 现有"无 data-theme 时的默认行为"一致，不引入回归。
   - 隐含动作：P6 需验证无 `data-theme` 属性时内容区为 light（与现有行为对比）。

## BDD 验收条件

以下条件为 P6 验收依据，每条可独立验证。Playwright 使用 `page.emulateMedia({ colorScheme: 'dark' | 'light' })` 模拟系统主题。

### BDD-1：系统黑夜 + data-theme=light → 内容区 light

```gherkin
Given 操作系统处于黑夜模式（emulateMedia colorScheme: 'dark'）
And 已打开一个含 markdown 内容的 entry 详情页
And html 根元素 data-theme="light"
When 页面渲染完成
Then .markdown-body 区域背景为浅色（light 配色）
And .markdown-body 文字为深色
And 不被 @media (prefers-color-scheme: dark) 覆盖
```

### BDD-2：系统白天 + data-theme=dark → 内容区 dark

```gherkin
Given 操作系统处于白天模式（emulateMedia colorScheme: 'light'）
And 已打开一个含 markdown 内容的 entry 详情页
And html 根元素 data-theme="dark"
When 页面渲染完成
Then .markdown-body 区域背景为深色（dark 配色）
And .markdown-body 文字为浅色
And 不被 @media (prefers-color-scheme: light) 覆盖
```

### BDD-3：切换主题后内容区即时跟随

```gherkin
Given 操作系统处于黑夜模式
And 页面当前 data-theme="dark"，内容区为 dark 配色
When 用户触发主题切换，data-theme 变为 "light"
Then .markdown-body 区域在切换后呈现 light 配色
And 无需刷新页面
```

### BDD-4：代码块（Shiki）跟随 data-theme

```gherkin
Given 操作系统处于黑夜模式
And entry 内容含代码块（经 Shiki 高亮）
And data-theme="light"
When 页面渲染完成
Then 代码块背景/ token 颜色为 Shiki light 主题
And 不呈现 dark 主题高亮
```

反向场景（系统白天 + `data-theme=dark` → Shiki dark）同理由成立。

### BDD-5：Mermaid/PlantUML 图表跟随 data-theme

```gherkin
Given 操作系统处于黑夜模式
And entry 内容含 Mermaid 图表（或 PlantUML）
And data-theme="light"
When 页面渲染完成
Then 图表背景/配色为 light 主题
And 不被 @media (prefers-color-scheme: dark) 强制为暗色
```

反向场景同理由成立。

### BDD-6（兜底）：无 data-theme 时默认 light 不回归

```gherkin
Given 操作系统处于黑夜模式
And html 根元素未设置 data-theme 属性
When 页面渲染完成
Then .markdown-body 区域为 light 配色
And 与本任务修复前的"无 data-theme 默认行为"一致（无回归）
```

## 待确认清单（[NEED_CONFIRM]）

无。

需求方向明确（修 `@media` 越权），方案 A 已在 P0 拍板，隐含需求均为"必须做的同步验证"，不涉及业务方向判断。patch 升级文档化（隐含需求 #1）属流程配套，不构成方向分叉，按"至少文档化"处理，P8 阶段或后续任务落实。

## 裁剪说明

`phases: [P1, P3, P4, P5, P6, P8]`

| 阶段 | 走/跳 | 理由 |
|------|-------|------|
| P1 | 走 | 本产出 |
| P2 | **跳** | 方案 A 已在 P0-brief 明确定义（patch `@media` 选择器为 `[data-theme=xxx] .markdown-body`），无需重复设计 |
| P3 | 走 | CSS 改动虽小但涉及主题逻辑，需测试覆盖 `@media` 被正确替换、选择器不误伤 |
| P4 | 走 | 执行 patch |
| P5 | 走 | 前端构建 + vitest 全绿 |
| P6 | 走 | **不可跳**——UI 主题切换任务，P0 明确要求 Playwright 实测系统黑夜场景；涉及多组件（Shiki/Mermaid/PlantUML）主题跟随验证 |
| P7 | **跳** | 单文件改动（`github-markdown.css`），无多文件一致性风险 |
| P8 | 走 | 前端构建产物随 peekview 主包发布，需 bump 版本 + CHANGELOG |

## 范围声明

```yaml
packages:
  - peekview        # 前端构建产物（含 patched github-markdown.css）随主包发布
domains:
  - frontend        # 纯前端 CSS，不涉及 backend/api/cli/security
ui_affected:
  - 内容区 markdown 渲染主题（.markdown-body）
  - 代码块高亮主题（Shiki，需同步验证）
  - 图表主题（Mermaid / PlantUML，需同步验证）
gate_commands:
  - cd frontend-v3 && npm run build
  - cd frontend-v3 && npx vitest run
  - make debug + Playwright emulateMedia({colorScheme:'dark'}) + vision 截图验证
```

## 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需 Playwright 模拟系统黑夜（emulateMedia colorScheme:'dark'）并截图验证内容区主题表现
    available:
      - playwright-cdp skill（已注入，连本地 Chrome CDP :18800）
      - "@vision-helper subagent（截图分析）"
    status: available

  - need: frontend-build
    why: P5 需 npm run build 验证 patch 后构建通过（含 typecheck）
    available:
      - 本地 runtime（cd frontend-v3 && npm run build）
    status: available
```

无 `[CAPABILITY_GAP]`，流程可自走。
