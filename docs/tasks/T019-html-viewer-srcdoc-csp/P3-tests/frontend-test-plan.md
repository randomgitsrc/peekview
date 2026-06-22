---
phase: P3
task_id: T019
task_name: html-viewer-srcdoc-csp
type: test_plan
trace_id: T019-P3-frontend-2026-06-22
created: 2026-06-22
status: red
parent: docs/tasks/T019-html-viewer-srcdoc-csp/P2-design.md
---

# T019 P3 前端测试计划（TDD RED — 后端 render 路由方案）

## 概述

改造 `frontend-v3/src/components/__tests__/HtmlViewer.spec.ts`，从 srcdoc 方案改为后端 render 路由方案。对应 P2-design.md rev 2「前端设计」节 + [SCOPE+]-4（EntryDetailView sibling 逻辑重写）。

此阶段测试处于 **RED** 状态：HtmlViewer.vue 仍为 srcdoc 方案，12/31 测试失败，等待 P4 改造为 `:src="renderUrl"` 后转 GREEN。

## 改动文件

| 文件 | 改动类型 |
|------|---------|
| `frontend-v3/src/components/__tests__/HtmlViewer.spec.ts` | 全面重写（919 行 → 486 行） |

**未改动**（P3 范围外）：
- `frontend-v3/src/components/HtmlViewer.vue`（P4 实现）
- `frontend-v3/src/components/__tests__/HtmlViewerIntegration.spec.ts`（P5 处理）
- `frontend-v3/src/views/EntryDetailView.vue`（P4 实现 [SCOPE+]-4）

## 改造原则

1. **删除**所有 `srcdoc` 相关断言 → 替换为 `iframe.attributes('src')` 断言
2. **删除**前端 `injectResources` 相关测试（sibling 注入移到后端 `html_render_service.inject_resources`）
3. **保留**相对路径**检测**测试（前端 `countRelativePaths` 仍用于警告条计数）
4. **删除** iframe `csp` 属性测试（CSP 由后端 HTTP response header 设置）
5. **保留** iframe `sandbox` 属性测试
6. **保留**大文件分级测试、loading 态测试
7. **新增** `renderUrl` 拼接测试、`loadingSiblings` 时序测试

## Props 变更（驱动 P4）

```typescript
// 改前（srcdoc 方案）
defineProps<{
  content: string
  siblingFiles?: SiblingFile[]      // 已注入的内容
  loadingSiblings?: boolean
}>()

// 改后（后端 render 路由方案）
defineProps<{
  slug: string                       // [新增] 拼 renderUrl
  fileId: number                     // [新增] 拼 renderUrl
  content: string                    // [保留] 用于 size 检测 + 警告计数
  siblingFileIds: number[]           // [替换 siblingFiles] 轻量 ID 列表
  loadingSiblings?: boolean          // [保留] 兼容 EntryDetailView 流程
}>()
```

`renderUrl` computed 期望（P4 实现）：
```typescript
const renderUrl = computed(() => {
  const base = `/api/v1/entries/${props.slug}/files/${props.fileId}/render`
  if (props.siblingFileIds.length === 0) return base
  return `${base}?inject=${props.siblingFileIds.join(',')}`
})
```

## 测试结构

### describe 块分布

| describe 块 | 测试数 | 状态 | 说明 |
|-------------|--------|------|------|
| `renderUrl 拼接` | 8 | 全新 | URL 路径 / inject 参数 / slug/fileId/siblingFileIds 响应式更新 / src vs srcdoc |
| `iframe sandbox 属性` | 2 | 保留 | `allow-scripts` 无 `allow-same-origin` / `referrerpolicy` |
| `iframe 无 csp 属性` | 1 | 全新 | 验证 csp 属性被移除（CSP 由后端 header 设置） |
| `相对路径检测警告` | 6 | 保留+扩展 | 含 siblingFileIds 不影响计数的新测试 + content 切换更新警告数 |
| `大文件分级处理` | 6 | 保留 | < 512KB / 512KB~2MB / > 2MB / 边界值 / 手动触发 |
| `Loading 状态` | 3 | 保留+扩展 | load 前 / load 后 / error 后 |
| `loadingSiblings 时序` | 3 | 全新 | true 不渲染 / 切到 false 渲染 / 有 IDs 仍不渲染 |
| `content 切换` | 2 | 重写 | URL 不变（依赖 slug+fileId）/ 卸载无副作用 |
| **合计** | **31** | | |

### 删除项（srcdoc / 前端注入相关）

| 类别 | 原测试数 | 说明 |
|------|---------|------|
| `srcdoc 绑定` describe 块 | 3 | 整块删除，替换为 `renderUrl 拼接` |
| `srcdoc 渲染` describe 块 | 1 | 合并到 `renderUrl 拼接` 的「iframe 用 src 而非 srcdoc」测试 |
| `iframe CSP 策略` describe 块 | 7 | 整块删除（csp 属性移除，CSP 由后端 header） |
| `多文件注入` describe 块 | 14 | 整块删除（注入移到后端 `html_render_service`） |
| `二进制资源注入` describe 块 | 10 | 整块删除（同上） |
| `层级目录路径匹配` describe 块 | 7 | 整块删除（同上，path 字段不再存在于前端 props） |
| `srcdoc` 属性提取 + 断言 | 24 | 全部删除 |
| `siblingFiles` props 传参 | 31 处 | 全部删除 |
| **合计删除** | **~97 处断言 / ~30 个测试** | |

### 新增项

| 类别 | 测试数 | 说明 |
|------|--------|------|
| `renderUrl 拼接` describe | 8 | URL 路径 / inject query / 响应式更新 / src vs srcdoc |
| `iframe 无 csp 属性` describe | 1 | 验证 csp 属性被移除 |
| `loadingSiblings 时序` describe | 3 | 等 sibling IDs 到齐再渲染 |
| `content 切换` describe | 2 | URL 不变 / 卸载无副作用（替代原 srcdoc 卸载测试） |
| 相对路径检测新增 | 2 | siblingFileIds 不影响计数 / content 切换更新警告数 |
| Loading 状态新增 | 1 | error 事件后 Loading 消失 |
| **合计新增** | **17** | |

### 保留项（无改动或微调）

| describe 块 | 测试数 | 改动 |
|-------------|--------|------|
| `iframe sandbox 属性` | 2 | 无改动（srcdoc 方案已有 sandbox="allow-scripts"） |
| `相对路径检测警告`（原 4 个） | 4 | 仅 props 增加 slug/fileId/siblingFileIds |
| `大文件分级处理` | 6 | 仅 props 调整 + 手动触发后断言改 src |
| `Loading 状态`（原 2 个） | 2 | 仅 props 调整 |
| **合计保留** | **14** | |

## 验证记录

### 测试运行结果（P3 完成时）

```
Test Files  1 failed (1)
     Tests  12 failed | 19 passed (31)
  Duration  1.29s
```

**12 个失败测试**（均因依赖 `:src="renderUrl"`，P4 实现后转绿）：

| # | 测试 | 失败原因 |
|---|------|---------|
| 1 | renderUrl 拼接 > iframe src 指向 render 路由 | 当前是 srcdoc，无 src 属性 |
| 2 | renderUrl 拼接 > 无 siblingFileIds 时 URL 不含 inject 参数 | 同上 |
| 3 | renderUrl 拼接 > sibling file IDs 作为 inject query 参数 | 同上 |
| 4 | renderUrl 拼接 > 单个 sibling file ID 也走 inject 参数 | 同上 |
| 5 | renderUrl 拼接 > slug 变化时 URL 更新 | 同上 |
| 6 | renderUrl 拼接 > fileId 变化时 URL 更新 | 同上 |
| 7 | renderUrl 拼接 > siblingFileIds 变化时 inject 参数更新 | 同上 |
| 8 | renderUrl 拼接 > iframe 用 src 而非 srcdoc | 当前 srcdoc 非空 |
| 9 | iframe 无 csp 属性 > iframe 不携带 csp 属性 | 当前有 csp 属性 |
| 10 | 大文件分级处理 > > 2MB：点击手动触发后正常渲染 | src 为空 |
| 11 | loadingSiblings 时序 > loadingSiblings 从 true 切到 false 后渲染 iframe | 当前 siblingFiles watch 触发，loadingSiblings 切换不触发 |
| 12 | content 切换 > content 变更时 iframe 仍指向 render 路由 | src 为空 |

**19 个通过测试**（不依赖 :src，或当前 srcdoc 行为已满足）：
- iframe sandbox 属性（2）：srcdoc 方案已有 sandbox="allow-scripts"
- 相对路径检测警告（6）：countRelativePaths 逻辑不变
- 大文件分级处理前 5 项（5）：size 逻辑不变
- Loading 状态前 2 项（2）：isLoading 逻辑不变
- loadingSiblings 时序第 1、3 项（2）：loadingSiblings=true 时 iframe 不渲染逻辑不变
- content 切换 > 卸载时不崩溃（1）：unmount 无副作用

## P4 实现要点（供 P4 参考）

1. **HtmlViewer.vue props** 改为 `{ slug, fileId, content, siblingFileIds, loadingSiblings? }`
2. **新增 `renderUrl` computed**：拼接 `/api/v1/entries/{slug}/files/{fileId}/render[?inject=ids]`
3. **iframe 模板**：`:srcdoc="processedHtml"` → `:src="renderUrl"`，移除 `csp` 属性
4. **`v-if` 条件**：`processedHtml` → `shouldRender`（= `!showManualRender && !props.loadingSiblings`）
5. **删除**：`processedHtml` ref / `injectResources` / `serializeDoc` / `countRelativePathsInDoc` 中与 inject 相关部分 / `SiblingFile` 类型导出
6. **保留**：`normalizeRef` / `countRelativePaths`（警告计数）/ size warning / manual render 逻辑
7. **`initRender` 简化**：不再生成 processedHtml，仅设 `isLoading = true` + `relativePathWarningCount = countRelativePaths(content)`
8. **watch 调整**：`siblingFiles` watch → `siblingFileIds` watch；`content` watch + `siblingFileIds` watch + `manuallyTriggered` watch 触发 `initRender`
9. **EntryDetailView.vue**：移除 sibling 内容 fetch（~50 行），改为 `siblingFileIds = computed(() => entry.files.filter(f => f.id !== activeFile.id).map(f => f.id))`

## P5 gate 命令

```bash
cd frontend-v3 && npx vitest run src/components/__tests__/HtmlViewer.spec.ts
cd frontend-v3 && npx vitest run src/components/__tests__/HtmlViewerIntegration.spec.ts
cd frontend-v3 && npx vitest run                                        # 无回归
cd frontend-v3 && npm run build                                          # 类型检查 + 构建
cd frontend-v3 && npm run lint                                           # Lint
```

## 与原 P3 test-plan.md 的关系

原 `P3-tests/test-plan.md` 对应 srcdoc 方案（P2 rev 1），已随 P2 修订过时。本文件为 P2 rev 2（后端 render 路由方案）的前端测试计划，覆盖范围更聚焦：

| 维度 | 原 test-plan.md（srcdoc） | 本文件（后端 render 路由） |
|------|--------------------------|--------------------------|
| 测试数 | 57 | 31 |
| 删除 Blob URL mock | ✓ | N/A（无 Blob URL） |
| 删除 srcdoc 断言 | N/A | ✓ |
| 新增 CSP 属性测试 | ✓（7 tests） | ✗（CSP 移到后端） |
| 新增 renderUrl 测试 | ✗ | ✓（8 tests） |
| 新增 loadingSiblings 时序 | ✗ | ✓（3 tests） |
| 前端注入测试 | 保留 | 删除（移到后端） |
| 相对路径检测 | 保留 | 保留 + 扩展 |
