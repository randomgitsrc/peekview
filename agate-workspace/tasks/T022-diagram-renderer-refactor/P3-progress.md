# P3 进度 — T022-diagram-renderer-refactor

## P3b1 stub + 纯函数测试文件

[P3b1] 创建文件：frontend-v3/src/composables/useCodeBlockRenderer.ts (stub)
[P3b1] 创建文件：frontend-v3/src/components/diagrams/BaseDiagram.vue (stub)
[P3b1] 创建文件：frontend-v3/src/components/diagrams/MermaidDiagram.vue (stub)
[P3b1] 创建文件：frontend-v3/src/components/diagrams/PlantUmlDiagram.vue (stub)
[P3b1] 创建文件：frontend-v3/src/components/diagrams/SvgDiagram.vue (stub)
[P3b1] 创建文件：frontend-v3/src/composables/diagramRegistry.ts (stub)
[P3b1] 创建文件：frontend-v3/src/components/diagrams/__tests__/useCodeBlockRenderer.spec.ts (13 测试点)
[P3b1] 创建文件：frontend-v3/src/components/diagrams/__tests__/useMarkdown-registry.spec.ts (12 测试点)

## vitest 验证（2026-06-25）

- 命令：`./node_modules/.bin/vitest run src/components/diagrams/__tests__/{useCodeBlockRenderer,useMarkdown-registry}.spec.ts --reporter=dot`
- 结果：Test Files 2 failed (2) | Tests 22 failed | 3 passed (25)
- 0 collection error（所有 stub 可 import）
- 22 红灯 = 新功能 stub 空壳（TDD RED 期望）
- 3 绿灯 = 保真项（2.4 python 默认 code block / 2.6 html+headings 契约 / 2.11 内联 svg 不走 registry），旧 useMarkdown.render 已满足

## P3 Test Designer 开始 (2026-06-26)

### 已读取输入文件
- P0-brief.md: known_risks (13条), env_constraints, pruning_tendency (全阶段保留)
- P1-requirements.md: 29 BDD (9维度), I1-I10 隐含需求, 三胞胎差异矩阵 24行, I3 16-case handler 差异矩阵
- P2-design.md: 第8节 gate_commands, 第7.7节 实现完成标志, 5个BLOCKER修订

### 现有测试文件 (57 tests, 全绿)
1. useCodeBlockRenderer.spec.ts (13 tests) — composable 纯函数
2. useMarkdown-registry.spec.ts (12 tests) — 注册模式 + DOMPurify
3. thin-wrappers.spec.ts (11 tests) — 三薄包装 props
4. BaseDiagram.spec.ts (8 tests) — BaseDiagram 挂载
5. error-handling-mount.spec.ts (5 tests) — 错误处理
6. snapshot-html.spec.ts (8 tests) — HTML 快照
7. SvgBlock.spec.ts (7 tests) — MarkdownViewer + svg block 集成

### 关键发现
- MarkdownViewer.vue 当前 1523 行（脚本 1-329 + CSS 331-1523）
- P4 目标：脚本 < 300 行，需迁出 mermaidCache/三 sourcesMap/renderToken/三 instances Map 到 composable
- 当前 MarkdownViewer 已部分迁移（L20-22 useCodeBlockRenderer, L36-44 三 Map+三 instances 仍在）
- 三段独立挂载函数 (renderMermaidDiagrams/renderPlantUmlDiagrams/renderSvgBlocks) 需统一为挂载循环
- emit handler 按 prefix 分族但无差异化（handleToggleView 无 refresh/toggle-text 差异）

### P3-test-cases.md 已产出
- 文件：docs/tasks/T022-diagram-renderer-refactor/P3-test-cases.md
- 新增 3 个测试文件：markdown-viewer-degeneration(15), emit-handler-diffs(15), mount-loop-unified(8) = 38 tests
- 复用 7 个现有测试文件 = 64 tests
- 总计 102 tests
- TDD 红灯率 ≈ 76%（29/38 新增测试当前红灯）
- P1 BDD 维度 1/5/9 全覆盖，维度 2/3/7/8 部分单测覆盖
- 维度 4/6/8 需 P6 Playwright

## P3 test-designer 进度（markdown-viewer-degeneration.spec.ts）

### 输入读取完成
- P0-brief: 环境约束、铁律、行为保真策略
- P3-test-cases 2.1 节: D1.1-D1.4, D2.1-D2.5, D3.1-D3.5, D4.1 (15 tests)
- P2-design 4/6 节: useCodeBlockRenderer API + 事件委托迁移
- MarkdownViewer.vue 现状: 322 行脚本, 仍持有 mermaidSourcesMap/plantumlSourcesMap/svgSourcesMap (L37-39), mermaidCache (L36), renderToken (L40), 三 instances Map (L42-44), 三段独立挂载函数 (L160-318)
- useCodeBlockRenderer.ts: 完整 composable 已存在, 162 行
- useCodeBlockRenderer.spec.ts: 参照风格 (vi.hoisted + vi.mock + 纯函数/调用断言)

### 分析结论
- D1.1-D1.4 (源码检查): 当前 MarkdownViewer 仍持有旧变量 → 红灯 ✓
- D2.1 (源码检查): 三段独立挂载函数仍存在 → 红灯 ✓
- D2.2 (路由检查): wrapperRegistry 不存在 → 红灯 ✓
- D2.3 (挂载方式): 当前已用 h+vueRender → 预期绿灯
- D2.4 (dataset.rendered): 当前已有 → 预期绿灯
- D2.5 (两阶段流程): 当前已有 v-html + nextTick + 挂载 → 预期绿灯
- D3.1-D3.5 (emit handler 差异): 当前 handler 无分族差异 → 红灯 ✓
- D4.1 (主题切换): 当前 watch 已触发 → 预期绿灯

## mount-loop-unified.spec.ts test-designer 进度

### 已读输入
- P3-test-cases.md §2.3（8 tests: M1.1-M1.3, M2.1-M2.3, M3.1-M3.2）
- P2-design.md §4.4（renderToken 防竞态保留）+ §4.5（串行约束保留）+ §5.5（wrapperRegistry）
- MarkdownViewer.vue 当前实现（三段独立函数 + renderToken 局部变量）
- useCodeBlockRenderer.ts composable API（nextToken/isCurrent/preRender*/registerInstance）
- useCodeBlockRenderer.spec.ts 参照测试风格（vi.hoisted + vi.mock 隔离）

### 关键设计决策
- M1.1-M1.3：测统一挂载循环路由。当前 MarkdownViewer 有三段独立函数（renderMermaidDiagrams/renderPlantUmlDiagrams/renderSvgBlocks），P4 要统一为遍历 sourcesMap + 查 wrapperRegistry 的循环。测试 mock composable 的 sourcesMap + h/vueRender，断言 h() 调用的组件类型
- M2.1-M2.3：测 renderToken 防竞态。当前 MarkdownViewer 有局部 renderToken，P4 迁入 composable 后逻辑应一致。测 nextToken + isCurrent 检查点
- M3.1：测 plantuml 串行。mock usePlantUML.render 记录调用顺序，断言串行
- M3.2：测 mermaid cache 命中跳过渲染

### 开始写测试代码

### 测试文件产出完成
- 文件: frontend-v3/src/components/diagrams/__tests__/markdown-viewer-degeneration.spec.ts
- 15 tests, 10 FAIL (TDD 红灯) + 5 PASS (预期绿灯)
- 红灯明细:
  - D1.1-D1.4 (4): MarkdownViewer 仍持有旧变量 → assertion failure ✓
  - D2.1 (1): 三段独立挂载函数仍存在 → assertion failure ✓
  - D2.2 (1): wrapperRegistry 不存在 → assertion failure ✓
  - D3.1 (1): handleToggleView mermaid 无 refresh dispatch → assertion failure ✓
  - D3.2 (1): handleToggleView plantuml 无 toggle-text 差异 → assertion failure ✓
  - D3.3 (1): handleToggleView svg 无 refresh dispatch → assertion failure ✓
  - D3.4 (1): handleCopyCode 无 Copied UI 反馈 → assertion failure ✓
  - D3.5 (1): handleCopyCode plantuml 无差异化 → assertion failure ✓
- 绿灯明细:
  - D2.3 (1): h+vueRender 已存在 ✓
  - D2.4 (1): dataset.rendered 已存在 ✓
  - D2.5 (1): 两阶段流程已存在 ✓
  - D4.1 (1): watch theme 已触发 ✓
  - (D2.2 的 is-active toggle 部分通过，但 wrapperRegistry 断言失败)
- TypeScript 语法检查通过 (ts.transpileModule)
- 红灯率 10/15 ≈ 67%，符合 P3-test-cases 3.2 节预期

## P3 emit-handler-diffs.spec.ts 完成

**时间**: 2026-06-26

**产出**: `frontend-v3/src/components/diagrams/__tests__/emit-handler-diffs.spec.ts`

**结果**: 15 tests — 10 red / 5 green (67% 红灯率)

**红灯明细**:
- E1.1 mermaid toggle-view: 缺 refresh dispatch + toggle-text 更新
- E1.3 svg toggle-view: 缺 refresh dispatch + toggle-text 更新
- E2.1 mermaid toggle-menu: 缺 close-others + click-outside
- E2.2 plantuml toggle-menu: 缺 toggle show 实现
- E2.3 svg toggle-menu: 缺 close-others + click-outside
- E3.1 mermaid copy-code: 缺 ✓Copied! UI 反馈
- E3.2 plantuml copy-code: 缺 console.log
- E3.3 svg copy-code: 缺 ✓Copied! UI 反馈
- E4.1 mermaid download-png: 缺 fresh render 路径
- E4.2 plantuml download-png: 缺 fresh render 路径

**绿灯明细** (当前行为已符合目标):
- E1.2 plantuml toggle-view: 无 refresh/toggle-text (保真)
- E4.3 svg download-png: 已委托 instance.downloadPng()
- E5.1-E5.3 fullscreen: 三族已走 instance.toggleFullscreen()

**类型检查**: vue-tsc --noEmit 通过，无错误

### 测试文件完成
- 产出文件: `frontend-v3/src/components/diagrams/__tests__/mount-loop-unified.spec.ts`
- 8 tests: M1.1-M1.3, M2.1-M2.3, M3.1-M3.2
- M1.1 包含源码断言（MarkdownViewer 不含三段独立函数 + 含 wrapperRegistry）→ 红灯（P4 未实现）
- M1.2-M1.3 测概念正确性（unknown lang skip + registerInstance）→ 绿灯
- M2.1-M2.3 测 renderToken composable（nextToken/isCurrent 竞态防护）→ 绿灯
- M3.1-M3.2 测串行约束 + cache 命中 → 绿灯
- 红灯统计: 1/8 (M1.1 源码断言失败)
- typecheck: 0 errors in mount-loop-unified.spec.ts
- 风格: vi.hoisted + vi.mock 隔离, describe/it 结构, 测试名含 M1.1 等编号
- 未加注释, as const 处理字面量类型
