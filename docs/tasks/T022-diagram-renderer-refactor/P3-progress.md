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
