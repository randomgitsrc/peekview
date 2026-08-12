# Spec: FileTree 目录树层级结构渲染

## 1. 背景

当前 `FileTree.vue` 组件将文件列表渲染为扁平单层结构，仅显示 `file.filename`。对于含层级目录的 entry（如 `css/layout.css`、`assets/images/hero.png`），应显示为嵌套目录树。

**触发场景**：用户创建含子目录的 entry（如新闻网站、项目文档），文件按 `path` 组织在 `css/`、`js/`、`assets/images/` 等子目录下。

## 2. 数据模型

### 2.1 输入

FileTree 接收 `files: File[]`，其中 `File` 类型包含：

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `id` | number | 文件 ID | 3 |
| `path` | string \| null | 完整相对路径（含目录） | `"css/layout.css"` / `null` |
| `filename` | string | 文件名（不含目录） | `"layout.css"` |
| `language` | string \| null | 语言标识 | `"css"` |
| `isBinary` | boolean | 是否二进制 | `false` |
| `size` | number | 文件大小 | 1221 |

**关键区别**：
- 层级文件：`path = "css/layout.css"`，`filename = "layout.css"`
- 根级文件：`path = null`，`filename = "index.html"`

**前置修复**：当前 `src/types/index.ts` line 18 定义 `path: string`（非 nullable），与后端 `null` 返回值不匹配。实现前需改为 `path: string | null`。

### 2.2 树节点

```typescript
interface TreeNode {
  name: string        // 目录名或文件 basename
  fullPath: string    // 完整路径：目录为 'css'，文件为 'css/layout.css' 或 'index.html'
  isDir: boolean      // true = 目录节点，false = 文件节点
  children: TreeNode[] // 目录节点的子节点（文件节点为空数组）
  file?: File         // 文件节点携带原始 File 对象（目录节点无此字段）
}
```

### 2.3 构建算法

`buildTree(files: File[]): TreeNode[]`

1. 对每个 file，取有效路径：`(file.path?.trim() || file.filename)`，`??` 不对空字符串生效，故用 `||`
2. 清洗路径：去除前导/尾部 `/`，按 `/` 拆分后过滤空段
   ```typescript
   const segments = rawPath.replace(/^\/+|\/+$/g, '').split('/').filter(s => s.length > 0)
   ```
3. 逐段在树中查找或创建目录节点
4. 叶节点挂载原始 `File` 对象
5. 排序：目录节点按 `name` 升序排在前面，文件节点按 `name` 升序排在后面

**示例输入 → 输出**：

```
files = [
  { path: "css/layout.css", filename: "layout.css" },
  { path: "css/components.css", filename: "components.css" },
  { path: "js/app.js", filename: "app.js" },
  { path: "assets/images/hero.png", filename: "hero.png" },
  { path: null, filename: "index.html" },
]

→ tree = [
  { name: "css", fullPath: "css", isDir: true, children: [
      { name: "components.css", fullPath: "css/components.css", isDir: false, file: ... },
      { name: "layout.css", fullPath: "css/layout.css", isDir: false, file: ... },
  ]},
  { name: "assets", fullPath: "assets", isDir: true, children: [
      { name: "images", fullPath: "assets/images", isDir: true, children: [
          { name: "hero.png", fullPath: "assets/images/hero.png", isDir: false, file: ... },
      ]},
  ]},
  { name: "js", fullPath: "js", isDir: true, children: [
      { name: "app.js", fullPath: "js/app.js", isDir: false, file: ... },
  ]},
  { name: "index.html", fullPath: "index.html", isDir: false, file: ... },
]
```

## 3. UI 设计

### 3.1 渲染

使用独立子组件 `TreeNodeItem.vue` 递归渲染，避免 Vue 3 `<script setup>` 自引用问题。`FileTree.vue` 作为容器（header + 根 `<ul>`），`TreeNodeItem.vue` 负责单个节点渲染。

- **目录节点**：`📁 ▾ {name}` 或 `📁 ▸ {name}`（折叠时）
  - 点击切换折叠状态
  - 子节点列表嵌套在 `<ul>` 中
- **文件节点**：`{icon} {filename}`
  - 图标沿用现有 `getFileIcon(file)` 逻辑
  - 点击 emit `select(file)`
  - active 文件高亮

### 3.2 折叠状态

- 用 `ref<Set<string>>` 存储已展开的目录 `fullPath`
- **默认行为**：初始全部展开（含 activeFile 的目录确保展开）
- 切换：点击目录行 → 添加/移除 fullPath from Set
- 文件切换时：如果新 activeFile 在折叠目录内，自动展开该目录
- **Entry 切换时重置**：watch `files` prop 变化 → 清空 expandedPaths Set，重新计算默认展开

### 3.3 缩进

每级嵌套 `padding-left` 增加 `var(--space-3)`（12px）：
- 根级：0px
- 1级子目录/文件：12px
- 2级：24px
- 3级：36px
- 4级：48px

12px 比 16px 节省空间，4 级嵌套在 260px sidebar 中仍有 ~200px 给文件名。

### 3.4 CSS Class 规范

| 元素 | CSS Class | 说明 |
|------|-----------|------|
| 目录行 | `.dir-item` | **新增**，目录行独有 |
| 文件行 | `.file-item` | **保留**，沿用现有，仅用于文件叶节点 |
| 文件名 | `.file-name` | **保留**，沿用现有 |
| 目录名 | `.dir-name` | **新增**，`white-space: nowrap; overflow: hidden; text-overflow: ellipsis` |
| 折叠指示 | `.dir-toggle` | **新增**，`▸`/`▾` |

**关键**：`.file-item` 仅用于文件叶节点，不用于目录行。保证现有 E2E selector `.file-tree .file-name` 和 `.file-item` 不受影响。

### 3.5 样式细节

| 元素 | 样式 |
|------|------|
| 目录行 `.dir-item` | `font-weight: 600`，`cursor: pointer`，hover 背景 `var(--bg-tertiary)` |
| 目录图标 | `📁`（固定） |
| 折叠指示 `.dir-toggle` | `▸`（折叠）/ `▾`（展开），`font-size: var(--font-xs)` |
| 文件行 `.file-item` | 沿用现有样式 |
| 文件名 `.file-name` | 沿用现有样式 |
| 目录名 `.dir-name` | `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`（与 file-name 一致） |
| active 文件 | `var(--accent-light)` 背景 + `var(--accent-color)` 文字 |

### 3.6 扁平结构兼容

当所有文件 `path === null` 时，`buildTree` 产生纯文件节点列表（无目录），渲染结果与当前扁平列表一致。**无需降级处理，树结构自然兼容扁平场景。**

### 3.7 移动端

移动端 drawer 中使用相同的 FileTree 组件，目录树渲染不受影响。drawer 已有 280px 宽度（80vw max），在 375px 手机上为 300px，足以显示 3 级嵌套（36px indent + ~260px 给内容）。

## 4. 不做的事

- ❌ 不做折叠动画过渡（直接 display 切换）
- ❌ 不做拖拽排序
- ❌ 不做右键菜单
- ❌ 不改 entry store（File[] 数据已足够）
- ❌ 不改 EntryDetailView props 传递（已传完整 File[]）
- ❌ 不做目录节点选中（只有文件可选中）

## 5. 测试覆盖

### 5.1 单元测试

`src/components/__tests__/FileTree.spec.ts`（新建）

| ID | 测试项 |
|----|--------|
| UT-TREE-01 | `buildTree` 层级文件 → 正确嵌套树 |
| UT-TREE-02 | `buildTree` 扁平文件（path 全 null） → 纯文件节点 |
| UT-TREE-03 | `buildTree` 混合层级 + 根级文件 → 根文件在顶层 |
| UT-TREE-04 | 目录按 name 排序，文件按 name 排序，目录优先 |
| UT-TREE-05 | 点击目录切换折叠 |
| UT-TREE-06 | activeFile 在折叠目录内时自动展开 |
| UT-TREE-07 | 点击文件 emit select 事件 |
| UT-TREE-08 | `buildTree` 空字符串 path → 降级到 filename |
| UT-TREE-09 | `buildTree` 前导斜杠 path → 清洗后正确树 |
| UT-TREE-10 | `buildTree` 尾部斜杠 path → 清洗后正确树 |
| UT-TREE-11 | `buildTree` 不同目录同名文件（`a/x.js` + `b/x.js`）→ 两个独立节点 |
| UT-TREE-12 | `buildTree` 深层嵌套（5 级） → 正确层级结构 |
| UT-TREE-13 | Entry 切换时 expandedPaths 重置 |

### 5.2 E2E 测试

`e2e/html-render.spec.ts` 新增测试组「目录树层级结构」

| ID | 测试项 |
|----|--------|
| TC-TREE-01 | 层级 entry 显示嵌套目录树（含 `.dir-item` 目录节点） |
| TC-TREE-02 | 点击 `.file-name` 文件跳转内容，点击 `.dir-item` 目录折叠/展开 |
| TC-TREE-03 | 扁平 entry 仍显示扁平列表（无 `.dir-item`） |

## 6. 关键文件

| 文件 | 变更 |
|------|------|
| `src/types/index.ts` | `File.path` 类型改为 `string | null` |
| `src/components/FileTree.vue` | 重写：buildTree + 传递 TreeNode[] 给子组件 |
| `src/components/TreeNodeItem.vue` | **新建**：递归渲染单个 TreeNode（目录/文件） |
| `src/components/__tests__/FileTree.spec.ts` | 新建 |
| `e2e/html-render.spec.ts` | 新增 TC-TREE 测试组 |