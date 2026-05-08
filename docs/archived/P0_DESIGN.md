# P0: 修复列表显示 + Mermaid 增强

## 问题汇总

### 1. 列表显示 Bug
**现象:** 首页只显示部分条目，但直接访问旧条目链接（如 /taamra）可以查看

**根因:** 
- 后端 API 默认 `per_page=20`
- 前端 `loadEntries()` 调用时没传分页参数，只加载第一页20条
- 没有分页 UI，用户无法查看后续条目

**修复方案:**
- 方案A: 移除分页限制（后端 `per_page=9999`）- 快速但不可扩展
- **方案B（推荐）**: 实现分页 UI（上一页/下一页/页码）
- 方案C: 无限滚动 - 体验好但实现复杂

### 2. Mermaid 交互增强
**需求:**
- 支持缩放和拖动查看大图表
- 移动端手势支持

**方案选择:**
| 方案 | 实现 | 复杂度 |
|------|------|--------|
| A. 原地 zoom/pan | 添加 svg-pan-zoom 库 | 中等 |
| B. 点击放大查看 | 弹窗/新页面显示大图 | 简单 |
| **C. 组合** | 原地支持基础缩放 + 点击查看全屏 | 中等，体验最好 |

**选定方案 C:**
1. 图表默认渲染，带 toolbar
2. Toolbar 按钮: [放大] [缩小] [全屏] [查看代码] [重置]
3. 鼠标: 滚轮缩放, 拖拽平移
4. 移动端: 双指缩放, 单指拖拽
5. 点击全屏打开 Modal 查看大图

### 3. Mermaid 代码/图表切换
**需求:** 在渲染图表和显示源代码之间切换

**方案:**
- 在 mermaid 块 header 添加 toggle 按钮
- 状态: `view: 'diagram' | 'code'`
- 代码模式: 语法高亮 + Copy 按钮
- 状态按图表实例保存

## 实现计划

### Phase 1: 列表分页 (Task #6)
1. **Backend**: 检查 list API，确保返回 total count
2. **Frontend EntryStore**: 添加分页状态 `page`, `perPage`, `total`
3. **Frontend EntryListView**: 
   - 添加分页控件组件
   - 修改 loadEntries 调用，传入 page 参数
4. **测试**: 验证多页数据正确显示

### Phase 2: Mermaid Zoom/Pan (Task #4)
1. **添加依赖**: `svg-pan-zoom` (轻量级，无依赖)
2. **创建 MermaidDiagram 组件**:
   - 接收 SVG 字符串
   - 集成 svg-pan-zoom
   - 添加 toolbar UI
3. **Mobile 适配**:
   - touch 事件处理
   - 双指缩放识别
4. **全屏 Modal**:
   - 点击全屏打开 Modal
   - Modal 内独立 svg-pan-zoom 实例
5. **MarkdownViewer 集成**:
   - 替换当前直接插入 SVG 的逻辑
   - 使用新的 MermaidDiagram 组件

### Phase 3: Mermaid Code Toggle (Task #3)
1. **修改 useMarkdown.ts**:
   - mermaid 块渲染时添加 wrapper 结构
   - 包含两个 view: diagram-view 和 code-view
2. **添加 toggle 逻辑**:
   - 全局 state 或每个块独立 state
   - toggle 按钮切换 view
3. **Code view**:
   - 使用 Shiki 高亮代码
   - 保留 Copy 按钮

### Phase 4: 测试 (Task #5)
1. **单元测试**: 组件渲染测试
2. **E2E 测试**: 
   - 分页切换
   - Mermaid 缩放/拖动
   - Code/Diagram 切换
3. **交互测试**:
   - 桌面端: 鼠标滚轮/拖拽
   - 移动端: 触摸手势
4. **回归测试**:
   - 普通代码块不受影响
   - 其他 markdown 功能正常

## UI Mockup

### Mermaid Block 新结构:
```
┌─────────────────────────────────────┐
│ MERMAID        [Diagram] [Code]    │  ← toggle buttons
├─────────────────────────────────────┤
│ ┌───────────────────────────────┐  │
│ │                               │  │
│ │     Mermaid Diagram SVG       │  │  ← 可缩放拖动
│ │                               │  │
│ │                               │  │
│ └───────────────────────────────┘  │
│ [-] [+] [Reset] [Fullscreen]       │  ← toolbar
├─────────────────────────────────────┤
│ [Copy]                             │
└─────────────────────────────────────┘
```

### Entry List Pagination:
```
┌─────────────────────────────────────┐
│ Entry 1  Entry 2  Entry 3  Entry 4  │
│ Entry 5  Entry 6  ...               │
├─────────────────────────────────────┤
│ [Prev] Page 1 of 3 [Next]          │
└─────────────────────────────────────┘
```

## 依赖检查

需添加 npm 包:
- `svg-pan-zoom` - SVG 缩放拖动
- `hammerjs`（可选）- 手势识别（如果 svg-pan-zoom 移动端不够）

## 文件修改清单

### Phase 1:
- `backend/peekview/services/entry_service.py` - 确认分页返回格式
- `frontend-v3/src/stores/entry.ts` - 添加分页状态
- `frontend-v3/src/views/EntryListView.vue` - 添加分页 UI
- `frontend-v3/src/components/Pagination.vue` - 新建分页组件

### Phase 2:
- `frontend-v3/package.json` - 添加 svg-pan-zoom
- `frontend-v3/src/components/MermaidDiagram.vue` - 新建组件
- `frontend-v3/src/components/MermaidModal.vue` - 新建全屏 Modal
- `frontend-v3/src/components/MarkdownViewer.vue` - 集成新组件

### Phase 3:
- `frontend-v3/src/composables/useMarkdown.ts` - 修改 mermaid 渲染
- `frontend-v3/src/styles/mermaid.css` - 添加新样式

## 验收标准

- [ ] 列表显示所有条目，分页正常工作
- [ ] Mermaid 图表可鼠标滚轮缩放
- [ ] Mermaid 图表可鼠标拖拽平移
- [ ] Mermaid 移动端支持双指缩放
- [ ] Mermaid 可切换 code/diagram 视图
- [ ] Code 视图支持 Copy
- [ ] 所有测试通过
