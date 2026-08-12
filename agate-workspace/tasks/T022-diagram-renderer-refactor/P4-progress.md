# P4 实现进度 — T022 MarkdownViewer.vue 脚本重写

## 阶段 1：读取上下文 ✅
- P2-design.md 第 4/6/7.7 节已读取
- P1-requirements.md I3 矩阵已读取
- P3-test-cases.md TDD 红灯预期已读取
- MarkdownViewer.vue 当前实现已读取（329 行脚本）
- useCodeBlockRenderer.ts 已读取（162 行）
- BaseDiagram.vue 已读取（531 行）
- 三薄包装已读取

## 阶段 2：迁移旧状态到 composable
- 删除 mermaidSourcesMap/plantumlSourcesMap/svgSourcesMap → renderer.sourcesMap
- 删除 mermaidCache → renderer.mermaidCache
- 删除 mermaidInstances/plantumlInstances/svgInstances → renderer.instances
- 删除 renderToken → renderer.nextToken()/isCurrent()
- 进行中...

## 阶段 3：统一挂载循环
- 待实现

## 阶段 4：emit handler 分族差异
- 待实现

## 阶段 5：renderToken 检查点保留
- 待实现

## 阶段 6：useCodeBlockRenderer 扩展
- 待检查
