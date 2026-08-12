---
phase: P3
task_id: T019
task_name: html-viewer-srcdoc-csp
type: test_plan
trace_id: T019-P3-2026-06-22
created: 2026-06-22
status: red
parent: docs/tasks/T019-html-viewer-srcdoc-csp/P1-requirements.md
---

# T019 P3 测试计划（TDD RED）

## 概述

改造 `frontend-v3/src/components/__tests__/HtmlViewer.spec.ts`，将 Blob URL 断言全部替换为 srcdoc 断言，并新增 iframe CSP 策略验证测试。此阶段测试处于 **RED** 状态（HtmlViewer.vue 尚未改造，54/57 测试失败），等待 P4 实现 srcdoc 方案后转 GREEN。

## 改动文件

| 文件 | 改动类型 |
|------|---------|
| `frontend-v3/src/components/__tests__/HtmlViewer.spec.ts` | 改造（删 Blob URL mock + 替换断言 + 新增 CSP/srcdoc 测试） |

**未改动**（P3 范围外）：
- `frontend-v3/src/components/HtmlViewer.vue`（P4 实现）
- `frontend-v3/src/components/__tests__/HtmlViewerIntegration.spec.ts`（P5 处理）

## 改动统计

### 删除项（Blob URL 相关）

| 类别 | 数量 | 说明 |
|------|------|------|
| URL mock 声明 | 3 | `createObjectURLMock` / `revokeObjectURLMock` / `mockBlobUrl` |
| `beforeEach`/`afterEach` mock setup | 1 块 | `vi.stubGlobal('URL', ...)` + `mockClear()` |
| vitest 导入 | 3 | `vi` / `beforeEach` / `afterEach`（不再需要） |
| "Blob URL 创建与释放" describe 块 | 3 tests | 整块删除，替换为 srcdoc 绑定测试 |
| `createObjectURLMock` 调用计数断言 | 3 | `toHaveBeenCalledOnce` / `not.toHaveBeenCalled` / `toHaveBeenCalled` |
| `revokeObjectURLMock` 调用断言 | 2 | `toHaveBeenCalledOnce` / `toHaveBeenCalledWith` |
| `iframe.attributes('src')` 断言 | 2 | `toBe(mockBlobUrl)` / `toBe(mockBlobUrl2)` |
| `blob.text()` 提取 + 断言块 | 24 | 多文件注入 / 二进制注入 / 层级路径匹配中的 Blob 读取 |
| **合计删除 Blob 断言** | **34+** | 含 mock 声明、调用计数、src 属性、blob.text() |

### 新增项（srcdoc + CSP 相关）

| 类别 | 数量 | 说明 |
|------|------|------|
| "srcdoc 绑定" describe 块 | 3 tests | 挂载绑定 / 卸载无泄漏 / content 变更更新 |
| "srcdoc 渲染" describe 块 | 1 test | iframe 用 srcdoc 而非 src |
| "iframe CSP 策略" describe 块 | 7 tests | unsafe-inline / unsafe-eval / connect-src / worker-src / img-src / font-src / style-src |
| srcdoc 属性断言（替换 blob.text()） | 24 | `iframe.attributes('srcdoc')` 提取 + `toContain` 断言 |
| srcdoc 属性断言（大文件点击触发） | 1 | 替换原 `createObjectURLMock).toHaveBeenCalledOnce()` |
| iframe.exists() 断言（大文件未触发） | 1 | 替换原 `createObjectURLMock).not.toHaveBeenCalled()` |
| iframe.exists() 断言（绝对路径不崩溃） | 1 | 替换原 `createObjectURLMock).toHaveBeenCalled()` |
| **合计新增 srcdoc 断言** | **30** | 含 4 个新 describe test + 26 个替换断言 |
| **合计新增 CSP 断言** | **8** | 7 tests，connect-src 含 2 条断言 |

### 保留项（无改动）

| describe 块 | 测试数 | 说明 |
|-------------|--------|------|
| iframe sandbox 属性 | 2 | sandbox/referrerpolicy 断言不变（但因 TypeError 失败） |
| 相对路径检测警告 | 4 | 警告条逻辑不变 |
| 大文件分级处理 | 6 | 阈值逻辑不变（2 个测试断言改造） |
| Loading 状态 | 2 | loading 态逻辑不变 |
| 多文件注入（非 blob.text() 部分） | 4 | warning/exists 断言不变 |
| 二进制资源注入（非 blob.text() 部分） | 2 | warning 断言不变 |
| 层级目录路径匹配（非 blob.text() 部分） | 1 | warning 断言不变 |

## 测试用例清单（57 tests）

### 1. srcdoc 绑定（3 tests，新增）

| # | 测试名 | 断言 |
|---|--------|------|
| 1 | 挂载时 iframe srcdoc 绑定到处理后的 HTML | `srcdoc` 含 `<html` + `<h1>Hello</h1>` |
| 2 | 卸载时无需释放（srcdoc 无 Blob URL） | `unmount()` 不抛错 |
| 3 | content 变更时 srcdoc 更新 | srcdoc 含 `Updated`，不含 `Hello` |

### 2. srcdoc 渲染（1 test，新增）

| # | 测试名 | 断言 |
|---|--------|------|
| 4 | iframe 用 srcdoc 而非 src | `srcdoc` truthy + `src` falsy |

### 3. iframe sandbox 属性（2 tests，保留）

| # | 测试名 | 断言 |
|---|--------|------|
| 5 | sandbox 仅含 allow-scripts，不含危险权限 | `allow-scripts` 含 + `allow-same-origin`/`allow-forms`/`allow-popups`/`allow-top-navigation` 不含 |
| 6 | referrerpolicy 为 no-referrer | `referrerpolicy` = `no-referrer` |

### 4. iframe CSP 策略（7 tests，新增）

| # | 测试名 | 断言 |
|---|--------|------|
| 7 | csp 属性包含 unsafe-inline | `csp` 含 `'unsafe-inline'` |
| 8 | csp 属性包含 unsafe-eval | `csp` 含 `'unsafe-eval'` |
| 9 | connect-src 允许 https/blob/data | `csp` 匹配 `connect-src[^;]*https` + `connect-src[^;]*blob:` |
| 10 | worker-src 允许 blob | `csp` 匹配 `worker-src[^;]*blob:` |
| 11 | img-src 允许 https | `csp` 匹配 `img-src[^;]*https` |
| 12 | font-src 允许 https | `csp` 匹配 `font-src[^;]*https` |
| 13 | style-src 允许 https | `csp` 匹配 `style-src[^;]*https` |

### 5. 相对路径检测警告（4 tests，保留）

| # | 测试名 | 断言 |
|---|--------|------|
| 14 | 含相对路径时显示警告条，数量为 3 | warning 含 `3` |
| 15 | 仅含 CDN 外链时不显示警告 | warning 不存在 |
| 16 | 无外部引用时不显示警告 | warning 不存在 |
| 17 | 可以关闭警告条 | 点击 close 后 warning 不存在 |

### 6. 大文件分级处理（6 tests，2 改造）

| # | 测试名 | 改动 |
|---|--------|------|
| 18 | < 512KB：正常渲染，无警告 | — |
| 19 | 512KB ~ 2MB：显示性能警告，仍自动渲染 | — |
| 20 | > 2MB：不自动渲染，显示手动触发按钮 | 删 `createObjectURLMock).not.toHaveBeenCalled()`，保留 `iframe.exists()).toBe(false)` |
| 21 | 恰好 512KB：显示性能警告，仍自动渲染 | — |
| 22 | 恰好 2MB：不自动渲染，显示手动触发按钮 | — |
| 23 | > 2MB：点击手动触发后正常渲染 | `createObjectURLMock).toHaveBeenCalledOnce()` → `srcdoc` 含 `<h1>Hello</h1>` |

### 7. Loading 状态（2 tests，保留）

| # | 测试名 | 断言 |
|---|--------|------|
| 24 | iframe load 事件前显示 Loading 态 | html-loading 存在 |
| 25 | iframe load 事件后 Loading 态消失 | html-loading 不存在 |

### 8. 多文件注入（15 tests，11 改造）

| # | 测试名 | 改动 |
|---|--------|------|
| 26 | 无 siblingFiles 时行为一致 | — |
| 27 | CSS 内联注入 | blob.text() → srcdoc |
| 28 | JS 内联注入 | blob.text() → srcdoc |
| 29 | 混合注入：CSS + JS | blob.text() → srcdoc |
| 30 | 文件名带 ./ 前缀 | blob.text() → srcdoc |
| 31 | 不匹配的引用计入 unmatchedCount | — |
| 32 | 非 stylesheet 的 link 不替换 | blob.text() → srcdoc |
| 33 | type="module" script 不注入 | blob.text() → srcdoc |
| 34 | type="application/json" script 不替换 | blob.text() → srcdoc |
| 35 | 空文件内容不崩溃 | blob.text() → srcdoc |
| 36 | filename 含 ./ 前缀 | blob.text() → srcdoc |
| 37 | 绝对路径不崩溃 | `createObjectURLMock).toHaveBeenCalled()` → `iframe.exists()).toBe(true)` |
| 38 | loadingSiblings=true 不渲染 iframe | — |
| 39 | DOCTYPE 保留 | blob.text() → srcdoc |
| 40 | unmatchedCount 全部注入时警告消失 | — |

### 9. 二进制资源注入（10 tests，8 改造）

| # | 测试名 | 改动 |
|---|--------|------|
| 41 | img src 替换为 data URI | blob.text() → srcdoc |
| 42 | favicon href 替换为 data URI | blob.text() → srcdoc |
| 43 | CDN 外链 img 不替换 | blob.text() → srcdoc |
| 44 | iframe/object/embed 不注入 | blob.text() → srcdoc |
| 45 | video/audio/source/track 可注入 | blob.text() → srcdoc |
| 46 | 混合注入：CSS + JS + 图片 | blob.text() → srcdoc |
| 47 | CSS @font-face url() 不注入 | blob.text() → srcdoc |
| 48 | 匹配的二进制不计入 unmatchedCount | — |
| 49 | 全部二进制注入后警告消失 | — |
| 50 | shortcut icon href 替换 | blob.text() → srcdoc |

### 10. 层级目录路径匹配（7 tests，6 改造）

| # | 测试名 | 改动 |
|---|--------|------|
| 51 | 层级路径匹配 CSS 注入 | blob.text() → srcdoc |
| 52 | 层级路径匹配 JS 注入 | blob.text() → srcdoc |
| 53 | 层级路径匹配二进制 img | blob.text() → srcdoc |
| 54 | 层级路径匹配 favicon | blob.text() → srcdoc |
| 55 | basename 匹配同级引用 | blob.text() → srcdoc |
| 56 | 混合层级 + 同级全部注入 | — |
| 57 | path 与 filename 均可匹配 | blob.text() → srcdoc |

## RED 状态分析

### 当前运行结果

```
Test Files  1 failed (1)
Tests       54 failed | 3 passed (57)
```

### 3 个通过测试（正确通过）

| 测试 | 原因 |
|------|------|
| > 2MB：不自动渲染，显示手动触发按钮 | `initRender` 因 `isBlockedBySize` 提前返回，不调用 `createBlobUrl` |
| 恰好 2MB：不自动渲染，显示手动触发按钮 | 同上 |
| loadingSiblings=true 不渲染 iframe | `initRender` 因 `loadingSiblings` 提前返回，不调用 `createBlobUrl` |

这 3 个测试不触发渲染路径，因此不受 `URL.createObjectURL is not a function`（jsdom 无此 API）影响。它们验证的「不渲染」逻辑在 P4 后仍应通过。

### 54 个失败测试的失败原因

**根因**：当前 `HtmlViewer.vue` 仍使用 `createBlobUrl()` → `URL.createObjectURL(blob)`，而 P3 删除了 URL mock（srcdoc 不需要），jsdom 原生无 `URL.createObjectURL`，导致 `TypeError: URL.createObjectURL is not a function`。

| 失败类别 | 数量 | P4 修复后预期 |
|---------|------|--------------|
| srcdoc 绑定/渲染（4 tests） | 4 | `createBlobUrl` 删除后不再 TypeError；iframe 用 `:srcdoc` 绑定，断言通过 |
| CSP 策略（7 tests） | 7 | CSP 字符串更新后含 `https:` / `worker-src`，断言通过 |
| sandbox 属性（2 tests） | 2 | TypeError 消失后 iframe 正常渲染，sandbox 断言通过 |
| 相对路径检测（4 tests） | 4 | TypeError 消失后正常渲染，warning 断言通过 |
| 大文件（< 512KB / 512KB~2MB / 点击触发）（4 tests） | 4 | TypeError 消失后正常渲染，断言通过 |
| Loading 状态（2 tests） | 2 | TypeError 消失后 iframe 存在，load 事件可触发 |
| 多文件注入（14 tests） | 14 | TypeError 消失后 srcdoc 含注入内容，断言通过 |
| 二进制资源注入（10 tests） | 10 | 同上 |
| 层级目录路径匹配（7 tests） | 7 | 同上 |

### P4 实现后预期（GREEN）

当 `HtmlViewer.vue` 完成以下改动后，全部 57 测试应通过：

1. 删除 `createBlobUrl` / `revokeBlobUrl` / `blobUrl` ref / `onUnmounted` revoke
2. 新增 `processedHtml` ref，`initRender` 直接赋值 `processedHtml.value = processed`
3. iframe 模板 `:src="blobUrl"` → `:srcdoc="processedHtml"`，`v-if="blobUrl"` → `v-if="processedHtml"`
4. CSP 字符串更新为 P2 设计的最终值（追加 `https:`、`connect-src` 放宽、新增 `worker-src blob:`）

## CSP 断言对应 P2 设计

| 测试 | P2 CSP 指令 | 断言正则 |
|------|------------|---------|
| unsafe-inline | `script-src 'unsafe-inline' ...` | `toContain("'unsafe-inline'")` |
| unsafe-eval | `script-src ... 'unsafe-eval' ...` | `toContain("'unsafe-eval'")` |
| connect-src | `connect-src blob: data: https:` | `/connect-src[^;]*https/` + `/connect-src[^;]*blob:/` |
| worker-src | `worker-src blob:` | `/worker-src[^;]*blob:/` |
| img-src | `img-src blob: data: https:` | `/img-src[^;]*https/` |
| font-src | `font-src blob: data: https:` | `/font-src[^;]*https/` |
| style-src | `style-src 'unsafe-inline' blob: data: https:` | `/style-src[^;]*https/` |

## BDD 覆盖追溯

| BDD（P1） | 单元测试覆盖 | P6 Playwright 覆盖 |
|-----------|-------------|-------------------|
| BDD-1: inline script 执行 | CSP unsafe-inline/unsafe-eval（#7-8） | console 抓 CSP 违规 |
| BDD-2: React 渲染到 #root | srcdoc 绑定（#1） | frame.locator('#root') |
| BDD-3: WebGL context | —（单元测试无法覆盖 WebGL） | canvas.getContext('webgl') |
| BDD-4: rAF 渲染循环 | —（同上） | canvas.toDataURL() 帧采样 |
| BDD-5: Google Fonts | CSP font-src/style-src https（#12-13） | console 抓 font CSP 违规 |
| BDD-6: 小文件自动渲染 | 大文件 < 512KB（#18）+ srcdoc 绑定（#1） | 自动渲染无回归 |
| BDD-7: 纯文本 HTML | srcdoc 绑定 SIMPLE_HTML（#1, #4） | 无 CSP 违规 |
| BDD-8: sandbox 安全性 | sandbox 不含 allow-same-origin（#5） | cookie/localStorage/fetch 隔离 |

## gate 命令

```bash
# P3 gate（当前 RED 状态）
cd frontend-v3 && npx vitest run src/components/__tests__/HtmlViewer.spec.ts

# P5 gate（P4 实现后应 GREEN）
cd frontend-v3 && npx vitest run src/components/__tests__/HtmlViewer.spec.ts
cd frontend-v3 && npx vitest run src/components/__tests__/HtmlViewerIntegration.spec.ts
cd frontend-v3 && npx vitest run
cd frontend-v3 && npm run build
cd frontend-v3 && npm run lint
```

## 下一步

P4（代码实现）：按 P2 设计改造 `HtmlViewer.vue`——删除 Blob URL 管理、新增 `processedHtml` ref、iframe 改 `:srcdoc`、更新 CSP 字符串。实现后跑上述 gate 命令确认 GREEN。
