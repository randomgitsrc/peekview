---
phase: P1
task_id: T087-code-linenumber-offbyone
type: problems
parent: P0-brief.md
---

P1_simplified: true

## 1. 需求复述

修复前端代码块行号 off-by-one：当文件内容以 `\n` 结尾时（POSIX 规范），`useShiki.ts:renderLineNumbers` 与 Shiki `codeToHtml` 都会多产生一个尾部空行，导致用户看到行号比实际代码行数多一、且最后一行是空内容。修复后行号列与高亮列的行数应等于文件内容的逻辑行数（末尾换行不产生额外行），且两列逐行对齐。

## 2. 隐含需求识别（逐维度）

- **数据**：无。已有 entry 的文件内容原样透传，无迁移、无存量数据受影响。
- **前端**：有。行号列与高亮列的行数/对齐变化（视觉改动，P6 须截图验证）。
- **多端**：无。纯前端 composable 改动，MCP/CLI/API/后端均不涉及行号渲染。
- **边界**：
  - 空文件（`""`）：CodeViewer 组件层在 `!props.content` 时短路不渲染（见 BDD-4，行号列与高亮列均不渲染）。`renderLineNumbers` 纯函数层对 `""` 产生 1 个行号（与 Shiki 1 个 `.line` 对齐），但此路径在组件层不会被触发。[SUGGEST: 空文件渲染 1 个行号，与 Shiki `codeToHtml("")` 产生的 1 个空 `.line` 对齐，不特殊处理为 0 个——符合"文件至少有一行"的直觉，且两列对齐] [BASELINE_CHANGE: 措辞修订，不改语义，P1-review retry#1]
  - 仅换行符（`"\n"`）：trim 后 → `""` → 1 行号 + 1 `.line`，对齐。
  - 单行无换行（`"a"`）：1 行号 + 1 `.line`，对齐。
  - 中间空行 + 末尾换行（`"a\n\n"`）：trim 后 → `"a\n"` → 2 行号 + 2 `.line`，对齐（中间空行保留，末尾换行去除）。
- **兼容**：不破坏现有行为。wrap（软换行）模式下行号列与高亮列仍逐行对齐（`syncLineHeights` 按 `.line[index] ↔ .line-number[index]` 配对，数量必须一致才能正确同步高度）。

### 关键隐含发现（修正 P0/dispatch-context 的不准确描述）

P0-brief 与 dispatch-context 称"Shiki 高亮列不多，两者错位"。**实测 Shiki 1.x `codeToHtml` 与 `code.split('\n')` 产生相同数量的行**——都不处理末尾换行，都多一个尾部空行。因此：

1. 当前 bug 的真实表现是"行号列与高亮列**数量对齐**（都多一个），但都多出一个尾部空行"，而非"两列错位"。
2. 用户拍板的修复方向"split 前去尾换行（`code.replace(/\n$/, '').split('\n')`）"若**只改 `renderLineNumbers`**：行号变 N-1，高亮仍 N → **真正引入错位**（实测验证：`"a\nb\n"` → 行号 2 vs `.line` 3，错位）。
3. 正确的修复语义：[DESIGN_CONSTRAINT] 修复后 `codeToHtml` 输出的 `.line` 数与 `renderLineNumbers` 输出的行号数必须一致且等于文件内容的逻辑行数（末尾 `\n` 不产生额外行）。实现手段（trim 输入 / 后处理 split 结果 / Shiki 选项 / 其他）由 P2 决定，P1 只定义结果行为（实测验证：trim 后两列均为 2，对齐）。[BASELINE_CHANGE: 措辞修订，不改语义，P1-review retry#1]

此发现是 P2 设计的强制约束（[DESIGN_CONSTRAINT]），P1 只定义结果行为，不规定实现方式。BDD 以"行号数 == `.line` 数 == 逻辑行数"三联对齐为验收锚点，留给 P2 决定如何达到对齐（trim 输入 / 分别 trim / 其他）。

## 3. BDD 验收条件

> 验收锚点：对每个渲染路径，行号列的行号数量 == Shiki 高亮列的 `.line` 数量 == 文件内容的逻辑行数（末尾 `\n` 不产生额外行）。"逻辑行数"定义：`code.replace(/\n$/, '').split('\n').length`。

### CodeViewer 路径（独立文件查看 + 源码视图）

#### BDD-1: 末尾带换行的 POSIX 文件行号正确
- Given 一个内容为 `"a\nb\n"` 的文件在 CodeViewer 中展示（行号开关开启）
- When 渲染完成
- Then 行号列显示 2 个行号（1、2），高亮列有 2 个 `.line`，两者数量相等且逐行对齐（无尾部空行号、无尾部空 `.line`）

#### BDD-2: 末尾不带换行的文件行号正确
- Given 一个内容为 `"a\nb"` 的文件在 CodeViewer 中展示
- When 渲染完成
- Then 行号列显示 2 个行号，高亮列有 2 个 `.line`，两者数量相等且对齐

#### BDD-3: 单行无换行文件行号正确
- Given 一个内容为 `"a"` 的文件在 CodeViewer 中展示
- When 渲染完成
- Then 行号列显示 1 个行号，高亮列有 1 个 `.line`，两者数量相等且对齐

#### BDD-4: 空文件不渲染行号
- Given 一个内容为 `""` 的空文件在 CodeViewer 中展示
- When 渲染完成
- Then 不渲染行号列也不渲染高亮列（CodeViewer 对空 content 短路，`highlightedCode` 为空）

#### BDD-5: 仅换行符文件行号正确
- Given 一个内容为 `"\n"` 的文件在 CodeViewer 中展示
- When 渲染完成
- Then 行号列显示 1 个行号，高亮列有 1 个 `.line`，两者数量相等且对齐

#### BDD-6: 中间空行 + 末尾换行文件行号正确
- Given 一个内容为 `"a\n\n"` 的文件在 CodeViewer 中展示
- When 渲染完成
- Then 行号列显示 2 个行号，高亮列有 2 个 `.line`，两者数量相等且对齐（中间空行保留为第 2 行）

### Markdown 代码块路径

#### BDD-7: Markdown 代码块行号与高亮对齐
- Given 一个 Markdown entry 含 ``` 代码块，代码内容为 `"a\nb\n"`（markdown-it tokenize 后 `token.content` 可能已被 trim 末尾换行）
- When Markdown 渲染完成
- Then 代码块的行号列数量 == 高亮列 `.line` 数量，两者逐行对齐（无论 markdown-it 是否 trim，两列必须对齐）。验收时取实际渲染结果比对两列数量，不依赖 markdown-it 是否 trim 末尾换行。[BASELINE_CHANGE: 措辞修订，不改语义，P1-review retry#1]

#### BDD-8: Markdown 代码块不回归
- Given 一个 Markdown entry 含多个 ``` 代码块（不同语言、不同末尾换行情况）
- When Markdown 渲染完成
- Then 每个代码块的行号列数量 == 高亮列 `.line` 数量，无错位、无多余空行号

### wrap（软换行）对齐

#### BDD-9: wrap 模式下行号与高亮逐行对齐
- Given 一个内容为 `"a\nb\n"` 的文件在 CodeViewer 中展示，且 wrap 开关开启
- When 渲染完成且 `syncLineHeights` 执行后
- Then 行号列的每个行号与高亮列的对应 `.line` 数量相等、逐行配对（`.line-number[index]` ↔ `.line[index]`），无溢出/错位

### 源码视图切换路径

#### BDD-10: 源码视图切换后行号正确
- Given 一个 entry 的文件在渲染视图与源码视图间切换，文件内容为 `"a\nb\n"`
- When 切换到源码视图（走 CodeViewer）
- Then 行号列显示 2 个行号，高亮列有 2 个 `.line`，两者对齐（与 BDD-1 一致）

## 4. 待确认清单

[NO_NEED_CONFIRM]

空文件边界已用 [SUGGEST] 给出推荐（渲染 1 个行号，与 Shiki 对齐），不阻塞推进。

## 5. 裁剪说明

```yaml
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
```

不裁剪任何阶段。理由：

- **P2 保留**（不可裁剪）：修复语义比 dispatch-context 描述的更复杂——`codeToHtml` 输出的 `.line` 数与 `renderLineNumbers` 输出的行号数必须一致且等于逻辑行数，否则引入新错位。P2 须明确实现策略（trim 输入 / 后处理 split 结果 / Shiki 选项 / 其他），`follows_existing_pattern` 可简化为单候选方案但不可省略。
- **P3 保留**：横切 3 路径的改动必须有红灯。给行号渲染加单测（末尾换行 / 无换行 / 空文件 / 单行 / 仅换行符 / 中间空行+末尾换行 case）。
- **P5 保留**：前端单测（vitest）+ typecheck 全绿。
- **P6 保留**（不可裁剪）：UI 视觉改动，必须 Playwright 截图验证行号对齐（CodeViewer + Markdown 代码块两路径）。
- **P7 保留**：多文件横切（useShiki + CodeViewer + useMarkdown），packages 少可轻量，但须交叉核对 trim 逻辑在所有调用点一致。
- **P8 保留**：bug 修复需版本/CHANGELOG 记录。

## 6. 范围声明

```yaml
packages:
  - frontend-v3/src/composables/useShiki.ts        # 主：renderLineNumbers + highlight + highlightCode
  - frontend-v3/src/components/CodeViewer.vue      # 间接：消费 highlight()，验收覆盖
  - frontend-v3/src/composables/useMarkdown.ts     # 间接：消费 highlightCode()，验收覆盖
domains:
  - frontend
risk_level: low-medium
```

risk_level 理由：根因单点、无后端、无 schema、无权限边界；但修复语义横切 `codeToHtml` 输入（不止 `renderLineNumbers`），且 3 条渲染路径需回归，故 non-low。

## 7. 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需 Playwright 截图验证行号列与高亮列的视觉对齐
    available:
      - "playwright-cdp skill（已注入，CDP 模式截图）"
      - "vision-engine skill（截图分析行号/高亮对齐）"
    status: supplementable
    supplement_note: "playwright-cdp + vision-engine 均可用，P6 派发时注入"
```

无 `status: GAP`，不阻塞推进。

[PROD_NOT_TOUCHED]
