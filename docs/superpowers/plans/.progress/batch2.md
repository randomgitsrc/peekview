# Batch 2 Progress Tracker

**目标**：Task 3 → 4 → 5 → 6（MermaidRenderer → PlantUmlRenderer → SvgRenderer → DiagramBlock）

**原则**：每个 subagent 只做一个小 TDD 循环，完成后更新本文件。

---

## Task 3: MermaidRenderer（拆成 3 步）

### 3a: 骨架 + renderDiagram + mermaidCache（R1/M2）
- [ ] 写测试：props code/theme，renderDiagram 调 mermaid.render，cache 命中跳过
- [ ] 看 RED
- [ ] 实现 MermaidRenderer.vue 骨架 + renderDiagram + mermaidCache + cancelled flag
- [ ] 看 GREEN
- [ ] commit
- [ ] 更新本文件

### 3b: fullscreen modal + useModalPanZoom
- [ ] 写测试：openFullscreen/closeFullscreen，modal DOM 结构
- [ ] 看 RED
- [ ] 实现 modal + toolbar buttons + modal pan-zoom
- [ ] 看 GREEN
- [ ] commit
- [ ] 更新本文件

### 3c: exportPng + downloadPng（R3 重新 render）
- [ ] 写测试：exportPng 调 mermaid.render 拿干净 SVG，白底 PNG
- [ ] 看 RED
- [ ] 实现 exportPng + downloadPng + alert on failure
- [ ] 看 GREEN
- [ ] commit
- [ ] 更新本文件

## Task 4: PlantUmlRenderer（拆成 2 步）

### 4a: 骨架 + renderDiagram + ensureLoaded（R4）
- [ ] 写测试
- [ ] 看 RED
- [ ] 实现：usePlantUML.render/ensureLoaded，cancelled flag，no touch/resize
- [ ] 看 GREEN
- [ ] commit
- [ ] 更新本文件

### 4b: modal + exportPng（R3 重新 render）
- [ ] 写测试
- [ ] 看 RED
- [ ] 实现 modal + exportPng 白底 + downloadPng 无 alert
- [ ] 看 GREEN
- [ ] commit
- [ ] 更新本文件

## Task 5: SvgRenderer（拆成 2 步）

### 5a: 骨架 + DOMPurify sanitize（M1）
- [ ] 写测试
- [ ] 看 RED
- [ ] 实现：sanitize in onMounted/watch，cancelled flag，hasError
- [ ] 看 GREEN
- [ ] commit
- [ ] 更新本文件

### 5b: modal + exportPng 透明背景
- [ ] 写测试
- [ ] 看 RED
- [ ] 实现 modal + exportPng 透明 + downloadPng 无 alert + 400x300 fallback
- [ ] 看 GREEN
- [ ] commit
- [ ] 更新本文件

## Task 6: DiagramBlock（拆成 3 步）

### 6a: 骨架 + v-if 选择渲染器 + toggle
- [ ] 写测试
- [ ] 看 RED
- [ ] 实现：template 结构 + toggle 行为差异（Mermaid/SVG 改文字，PlantUML 不改）
- [ ] 看 GREEN
- [ ] commit
- [ ] 更新本文件

### 6b: dropdown + copy 行为差异
- [ ] 写测试
- [ ] 看 RED
- [ ] 实现：close-others/click-outside（Mermaid/SVG only），copy 反馈差异
- [ ] 看 GREEN
- [ ] commit
- [ ] 更新本文件

### 6c: resize handle + error 处理 + defineExpose
- [ ] 写测试
- [ ] 看 RED
- [ ] 实现：resize（Mermaid/SVG only），error div vs code mode 切换
- [ ] 看 GREEN
- [ ] commit
- [ ] 更新本文件

---

## 完成状态

| 步骤 | 状态 | commit | 测试数 |
|------|------|--------|--------|
| 3a | ⏳ pending | - | - |
| 3b | ⏳ pending | - | - |
| 3c | ⏳ pending | - | - |
| 4a | ⏳ pending | - | - |
| 4b | ⏳ pending | - | - |
| 5a | ⏳ pending | - | - |
| 5b | ⏳ pending | - | - |
| 6a | ⏳ pending | - | - |
| 6b | ⏳ pending | - | - |
| 6c | ⏳ pending | - | - |
