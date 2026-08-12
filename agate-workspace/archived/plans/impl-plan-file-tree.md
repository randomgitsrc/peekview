# Impl Plan: FileTree 目录树层级结构

Spec: `docs/specs/spec-file-tree.md`（专家评审已通过）

## Step 1: 前置修复 — 类型 nullable 修正

修复 `path` 类型从 `string` 到 `string | null`，涉及 3 处：

| 文件 | 行 | 变更 |
|------|------|------|
| `src/types/index.ts` | 18 | `File.path: string` → `string | null` |
| `src/api/types.ts` | 36 | `FileResponse.path: string` → `string | null` |
| `src/components/HtmlViewer.vue` | 91-102 | `SiblingFile.path?: string` → `path?: string | null` |

EntryDetailView 中 `path: f.path` 赋值：`f.path` 为 `string | null`，赋给 `path?: string | null` 兼容（null 可赋值给 optional nullable）。

验证：手动确认 3 处均改 + `npm run build` + `npm run test` 无新错误。

---

## Step 2: TreeNode 接口 + buildTree + FileTree + TreeNodeItem

合并原 Step 2/3（两者不可独立编译）。

### 2a. TreeNode 接口

定义在 `src/types/index.ts`（与 File 同位置，TreeNodeItem 可直接 import）：

```typescript
export interface TreeNode {
  name: string
  fullPath: string
  isDir: boolean
  children: TreeNode[]
  file?: File
}
```

### 2b. buildTree 函数（FileTree.vue 内）

```typescript
function buildTree(files: File[]): TreeNode[] {
  // 路径清洗：(file.path?.trim() || file.filename) → 去除前导/尾部/ → 过滤空段
  // 逐段查找/创建目录节点 → 叶节点挂载 File
  // 排序：目录优先，同组按 name 升序
}
```

### 2c. FileTree.vue 重写

- `computed treeNodes = buildTree(props.files)`
- `ref<Set<string>> expandedPaths`
- 默认全展开：`initExpanded(treeNodes)` 递归添加所有目录 fullPath
- `autoExpandActive`：从 activeFile 的 fullPath 拆分出所有祖先目录路径，加入 expandedPaths
- watch `files` → 重置 expandedPaths + initExpanded + autoExpandActive
- watch `activeFileId` → autoExpandActive
- provide `{ expandedPaths, toggleDir }` 给 TreeNodeItem
- `getFileIcon` 函数保留

### 2d. TreeNodeItem.vue 新建

Props: `node: TreeNode`, `depth: number`, `activeFileId`
Inject: `{ expandedPaths, toggleDir }` from FileTree

- `.dir-item`：`📁 ▾/▸ {dirName}`，点击调用 `toggleDir(node.fullPath)`
- `.file-item`：`{icon} {filename}`，点击 emit `select(node.file!)`
- 缩进：`padding-left: calc(depth * var(--space-3))`

### 2e. CSS class 规范

| 元素 | Class |
|------|-------|
| 目录行 | `.dir-item` |
| 文件行 | `.file-item`（保留） |
| 文件名 | `.file-name`（保留） |
| 目录名 | `.dir-name`（新，含 ellipsis） |
| 折叠指示 | `.dir-toggle` |

---

## Step 3: 单元测试

`src/components/__tests__/FileTree.spec.ts` — 13 项

| ID | 测试项 |
|----|--------|
| UT-TREE-01 | buildTree 层级文件 → 正确嵌套 |
| UT-TREE-02 | buildTree 扁平（path 全 null） → 纯文件 |
| UT-TREE-03 | buildTree 混合层级 + 根级 → 根在顶层 |
| UT-TREE-04 | 排序：目录优先 + name 升序 |
| UT-TREE-05 | 点击目录折叠/展开 |
| UT-TREE-06 | activeFile 在折叠目录 → 自动展开 |
| UT-TREE-07 | 点击文件 emit select |
| UT-TREE-08 | 空字符串 path → 降级到 filename |
| UT-TREE-09 | 前导 `/` path → 清洗后正确 |
| UT-TREE-10 | 尾部 `/` path → 清洗后正确 |
| UT-TREE-11 | 不同目录同名文件（a/x.js + b/x.js） |
| UT-TREE-12 | 5 级深层嵌套 → 正确层级 |
| UT-TREE-13 | files 变化 → expandedPaths 重置 |

---

## Step 4: E2E 测试 + 标准调试

1. `e2e/html-render.spec.ts` 新增 TC-TREE 组（3 项）
2. `make debug-build` → `make debug-start`
3. 浏览器验证 `/quantum-daily-news` 目录树
4. `make debug-test`（含全量 E2E，确认现有 selector 不受影响）

---

## Key Files

| File | Change |
|------|--------|
| `src/types/index.ts` | File.path → `string | null` + 新增 TreeNode |
| `src/api/types.ts` | FileResponse.path → `string | null` |
| `src/components/HtmlViewer.vue` | SiblingFile.path → `string | null` |
| `src/components/FileTree.vue` | 重写：buildTree + tree 渲染 + provide |
| `src/components/TreeNodeItem.vue` | 新建：递归节点渲染 |
| `src/components/__tests__/FileTree.spec.ts` | 新建 |
| `e2e/html-render.spec.ts` | 新增 TC-TREE 组 |