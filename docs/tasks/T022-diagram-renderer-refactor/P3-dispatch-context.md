---
phase: P3
task_id: T022-diagram-renderer-refactor
type: dispatch-context
parent: P3-test-cases.md
trace_id: T022-P3-dispatch-context-20260625
created: 2026-06-25
---

# P3 派发上下文 — T022（测试代码骨架）

> 主 Agent 已查证的客观信息，供测试代码 subagent 直接使用。
> 避免反复读参照文件、猜测风格、设计 selector。

## 1. e2e 测试骨架（参照 mermaid.spec.ts / png-download.spec.ts）

### 1.1 通用 import + 结构
```typescript
import { test, expect } from '@playwright/test'
import fs from 'fs'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'

test.describe('T022 Diagram Refactor BDD', () => {
  // 每个 test 独立 goto，不共享 beforeEach（避免测试间状态污染）
})
```

### 1.2 测试 entry 创建方式
e2e 测试访问已存在的 entry slug。现有 e2e 用 `/entries/test-mermaid-2`、`/png-test-2` 等 slug。
本任务 e2e 可复用这些 slug，或用 `beforeAll` 通过 HTTP API 创建：
```typescript
import { request } from '@playwright/test'

test.beforeAll(async ({ request }) => {
  // 通过 debug backend HTTP API 创建（不用 CLI，AGENTS.md 铁律 8）
  await request.post(`${BASE_URL}/api/v1/entries`, {
    data: { slug: 't022-e2e', content: '...', is_public: true }
  })
})
```
**优先复用现有 slug**（test-mermaid-2 / png-test-2），减少环境依赖。

### 1.3 关键选择器（从 mermaid.spec.ts 提取，重构后保持不变）
- `.mermaid-block` — mermaid 块根
- `.mermaid-content[data-mode="diagram"]` / `[data-mode="code"]` — 视图切换
- `.mermaid-view-toggle` — toggle 按钮
- `.mermaid-action-btn[title="Fullscreen"]` — fullscreen 按钮
- `.mermaid-modal-overlay` — fullscreen modal
- `.mermaid-modal .toolbar-btn[title="Download PNG"]` — modal 内下载按钮
- `.plantuml-block` / `.svg-block` — 对应三族根
- 等待渲染：`page.waitForTimeout(3000)` 或 `waitForLoadState('networkidle')`

### 1.4 PNG 下载验证模式（参照 png-download.spec.ts）
```typescript
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.click('.mermaid-modal .toolbar-btn[title="Download PNG"]')
])
const downloadPath = '/tmp/t022-mermaid.png'
await download.saveAs(downloadPath)
const stats = fs.statSync(downloadPath)
expect(stats.size).toBeGreaterThan(1000)
// 文件名断言
const filename = download.suggestedFilename()
expect(filename).toMatch(/^mermaid-diagram.*\.png$/)
```

## 2. 组件测试骨架（参照 SvgBlock.spec.ts）

### 2.1 import + mount 工具
```typescript
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
```

### 2.2 BaseDiagram mount 骨架
```typescript
import BaseDiagram from '../BaseDiagram.vue'
import mermaidDiagram from '../MermaidDiagram.vue'

vi.mock('svg-pan-zoom', () => ({
  default: vi.fn(() => ({
    zoomIn: vi.fn(), zoomOut: vi.fn(), resetZoom: vi.fn(),
    destroy: vi.fn(), on: vi.fn(),
  }))
}))

const baseProps = {
  svgContent: '<svg><circle r="10"/></svg>',
  codeViewHtml: '<span>code</span>',
  blockId: 'block-0', blockIndex: 0,
  classPrefix: 'mermaid', theme: 'light' as const,
  pngBackground: '#ffffff' as const, pngViewBoxFallback: 'g-root-getBBox' as const,
  pngFinalSize: { width: 800, height: 600 }, pngBrFix: true, pngFilenamePrefix: 'mermaid-diagram',
  panZoomMinZoom: 0.1, panZoomMaxZoom: 10, panZoomInitTryCatch: false,
  touchEnabled: true, resizeEnabled: true,
  refreshEventName: 'mermaid-refresh', modalTitle: 'Mermaid Diagram',
  toggleTextUpdates: true, refreshOnToggle: true, copyFeedback: true,
  menuClickOutside: true, menuCloseOthers: true,
}

function mountBase(overrides: Record<string, any> = {}) {
  return mount(BaseDiagram, { props: { ...baseProps, ...overrides } })
}
```

### 2.3 薄包装 mount 骨架（stub BaseDiagram 检查 props 传递）
```typescript
const BaseDiagramStub = {
  template: `<div class="bd-stub" :data-prefix="classPrefix" :data-png-bg="pngBackground" :data-touch="touchEnabled" :data-resize="resizeEnabled" :data-brfix="pngBrFix" :data-filename="pngFilenamePrefix" :data-vb="pngViewBoxFallback" :data-size="pngFinalSize.width + 'x' + pngFinalSize.height" />`,
  props: ['classPrefix','pngBackground','touchEnabled','resizeEnabled','pngBrFix','pngFilenamePrefix','pngViewBoxFallback','pngFinalSize','svgContent','codeViewHtml','blockId','blockIndex','theme','panZoomMinZoom','panZoomMaxZoom','panZoomInitTryCatch','refreshEventName','modalTitle','toggleTextUpdates','refreshOnToggle','copyFeedback','menuClickOutside','menuCloseOthers'],
}

function mountMermaid(overrides: Record<string, any> = {}) {
  return mount(MermaidDiagram, {
    props: { blockIndex: 0, blockId: 'm-0', svgContent: '<svg/>', codeViewHtml: '', theme: 'light', ...overrides },
    global: { stubs: { BaseDiagram: BaseDiagramStub } }
  })
}
```

## 3. TDD 红灯说明
- stub 是空壳（有 props/emits 声明但无真实 template/逻辑）
- 测试断言"实现后的期望行为" → 在 stub 上断言失败 = 红灯（正确）
- **不要修改 stub**，**不要降低断言标准**
- 期望：assertion failures > 0, collection errors == 0

## 4. 现有测试文件位置
- `frontend-v3/e2e/*.spec.ts` — Playwright e2e（参照 mermaid.spec.ts / png-download.spec.ts）
- `frontend-v3/src/components/__tests__/*.spec.ts` — 组件测试（参照 SvgBlock.spec.ts）
- `frontend-v3/src/components/diagrams/__tests__/` — 本任务新测试目录（P3b1 已建 2 文件）
- `frontend-v3/src/components/diagrams/` — stub 目录（P3b1 已建 5 stub）
