---
phase: P2
task_id: T049-mobile-header-diagram-sanitize
type: design
parent: P1-requirements.md
trace_id: T049-P2-20260708
status: draft
created: 2026-07-08
agent: architect
---

# P2 方案设计 — 移动端 Header 收缩 + 图表清洗 + 错误 UI

## 影响域分析

### 改什么
| 子域 | 文件 | 改动类型 |
|------|------|----------|
| Mobile header | `EntryDetailView.vue` | `visibleTags`/`remainingTagCount` 计算 + scroll 监听 + 配置获取 |
| Mobile header | `layout.css` | `.header-tags` max-height + `.detail-header` position:sticky + mobile @media |
| Diagram config | `backend/config.py` | 新增 `PeekDiagram(BaseSettings)` + 注册到 `PeekConfig` |
| Diagram config | `backend/api/config_router.py` | 新增 `GET /api/v1/config/diagram` |
| Diagram config | `backend/cli.py` | SUPPORTED_CONFIG_KEYS + 类型转换 + CONFIG_KEYS_HELP + config_list 描述 |
| Diagram config | `frontend/api/client.ts` | 新增 `getDiagramConfig()` 方法 |
| Diagram config | `frontend/api/types.ts` | 新增 `DiagramConfigResponse` 类型 |
| Diagram sanitize | `frontend/utils/diagramSanitize.ts` | **新文件**：注册式清洗模块 |
| Diagram sanitize | `DiagramBlock.vue` | 注入 sanitize 管线 + 获取 config |
| Error UI | `useMermaid.ts` | `suppressErrors: true` |
| Error UI | `MermaidRenderer.vue` | catch 中清理 `#dmermaid-{id}` DOM + exportPng 同步清理 |
| Error UI | `DiagramBlock.vue` | 统一错误 UI 组件（引擎名 + 可折叠详情 + 查看源码） |
| Error UI | `PlantUmlRenderer.vue` | 不再自动切 code mode，走统一错误 UI |

### 不改什么
- `MarkdownViewer.vue`、`useMarkdown.ts`：不修改渲染流程，清洗在 DiagramBlock 层注入
- `SvgRenderer.vue`：DOMPurify 行为不变，统一错误 UI 由 DiagramBlock 提供
- 后端 storage/models/database：无 schema 变更
- MCP server：无变更
- 前端 stores：无新增 store，config 通过 api client 直接获取

### 风险
| 风险 | 影响 | 缓解 |
|------|------|------|
| scroll 监听 + position:sticky 在 iOS Safari 兼容性 | header 动画异常 | 用 `position: sticky` + `top: 0`，配合 `-webkit-overflow-scrolling` |
| suppressErrors 在 mermaid <10.1 不存在 | 报错但 mermaid 继续工作 | 项目锁定 `^10.9.0`，P1 已验证可用 |
| #dmermaid-{id} DOM 清理时机竞态 | 可能清理到正在使用的元素 | renderId 用 crypto.randomUUID()，清理只针对特定 ID |
| PlantUML 行为改变（code mode → error UI）可能打破用户习惯 | 现有用户不习惯 | 提供 "查看源码" 按钮，功能等价 |
| 清洗规则误改合法内容 | 渲染出错 | 确定性修正仅做可逆/无损修正；启发式修正仅失败后重试；配置可关闭 |

---

## 1. 候选方案与权衡

### 1.1 移动端 Header 收缩

### 候选方案 A（推荐）：CSS max-height + JS scroll 事件 + @media 限制
- header-tags 设置 `max-height: 2.5em` + `overflow: hidden`（单行限制）
- `+N` 溢出指示器通过 CSS `:has()` 或 JS 计算溢出数量
- `position: sticky` 加到 `.detail-header`
- Scroll 监听：`let lastScroll = 0;` 在 `onMounted` + `onUnmounted` 注册/移除
- 节流：`requestAnimationFrame` 做帧级节流
- @media (max-width: 768px) 内应用
- 优点：简单直接，CSS transition 控制动画，JS 只有滚动方向检测
- 风险：`:has()` 浏览器兼容性（Safari 15.4+ 支持，基本可用）；溢出计算需要 `scrollHeight > clientHeight`
- 工作量：～80 行（CSS 40 + JS 40）

### 候选方案 B：CSS container queries + IntersectionObserver
- 用 `container-type: inline-size` 做响应式断点
- IntersectionObserver 监听 header 可见性做收/放
- 优点：容器查询更精确，IntersectionObserver 无性能问题
- 缺点：container queries 在 Safari 16+ 才支持，比主流浏览器晚；IntersectionObserver 在 sticky 场景有额外复杂度
- 风险：Safari 15（仍有用户）不支持 container queries；方案 A 已经足够
- 工作量：～100 行

**选择理由**：方案 A。`:has()` 已在 Safari 15.4+ 支持（2022 年中），项目内已有 `:has` 用法。container queries 带来的额外兼容性风险和复杂度不值得。scroll + rAF 节流是成熟模式。

### 1.2 图表源码清洗

### 候选方案 A（推荐）：DiagramBlock 层注入 sanitize，注册式规则架构
- `utils/diagramSanitize.ts`：导出 `registerRule(engine, name, fn, type)` + `sanitize(code, engine)` + `sanitizeWithRetry(code, engine)`
- 内置规则：mermaid（空格修正/箭头语法/subgraph 括号）、plantuml（补@startuml/@enduml）、svg（闭合标签/属性引号）
- DiagramBlock.vue：`onMounted` 时获取 diagramConfig（通过 api.getDiagramConfig），传给 sanitize 管线
- 清洗管线在 `block.code` 传入 renderer 之前执行
- 优点：清洗层独立，不影响现有渲染器；注册式规则可测试；配置驱动开关
- 风险：配置获取是异步的，需在 config 就绪前跳过清洗
- 工作量：～150 行（模块 120 + DiagramBlock 集成 30）

### 候选方案 B：在 useMarkdown.ts 中预处理
- 在 `useMarkdown.render()` 创建 DiagramBlockData 时执行 sanitize
- 优点：清洗发生在 markdown 渲染流程中，统一入口
- 缺点：useMarkdown 无 DI 获取 config（需额外传参）；清洗结果不能按需重试（因为 render 已完成）
- 风险：需要修改 `render()` 签名传递 config，影响所有调用方
- 工作量：～180 行（更多修改波及）

**选择理由**：方案 A。DiagramBlock 已是渲染器编排点，注入清洗最自然。只有 DiagramBlock 知道"渲染是否失败"——这是决定是否触发启发式修正的前提。`useMarkdown` 是纯同步处理，不适合两阶段重试。

### 1.3 配置后端 + CLI

`follows_existing_pattern: [backend/peekview/config.py:272-341 (PeekAuth.captcha_enabled), backend/peekview/cli.py:531-628, backend/peekview/api/config_router.py:16-46]`

只写 1 个候选方案：参照 `PeekAuth` 中 `captcha_enabled` + `PeekCaptcha` 相关配置的模式。

- `config.py`: 新增 `PeekDiagram(BaseSettings)` 类，含 `sanitize_enabled: bool = True`
- `PeekConfig`: 新增 `diagram: PeekDiagram = Field(default_factory=PeekDiagram)` 字段
- `config_router.py`: 新增 `PublicDiagramConfig(BaseModel)` + `GET /api/v1/config/diagram` 端点
- `cli.py`:
  - `SUPPORTED_CONFIG_KEYS`: 加 `"diagram.sanitize_enabled"`
  - 类型转换: `key_name in ("sanitize_enabled", ...)` → `value = value.lower() in ("true", "1", "yes", "on")`
  - `CONFIG_KEYS_HELP`: 加 `diagram.sanitize_enabled`
  - `config_get`/`config_list`: 加 `"diagram"` section 分支和描述
- 前端 `api/client.ts`: 新增 `getDiagramConfig()` → `this.client.get('/config/diagram')`
- 前端 `api/types.ts`: 新增 `DiagramConfigResponse { sanitize_enabled: boolean }`

### 1.4 图表错误 UI 优化

### 候选方案 A（推荐）：DiagramBlock 统一错误组件 + Mermaid 清理 + 行为变更
- `useMermaid.ts`: `mermaid.initialize({ suppressErrors: true, ... })`
- `MermaidRenderer.vue`:
  - `renderDiagram()` catch: 清理 `document.getElementById(\`dmermaid-${renderId}\`)` + `emit('renderError', err)`
  - `exportPng()` catch: 同样清理，然后 throw
- `DiagramBlock.vue`:
  - 统一错误 UI：`<div class="diagram-error">` 内嵌引擎名 + "渲染失败" + 可折叠详情（v-show）+ "查看源码"按钮
  - 详情截取前 200 字符，HTML 转义（`textContent` 安全赋值）
  - PlantUML 行为变更：`onRenderError()` 中不再自动 `isCodeMode=true`，而是 `hasError=true`（与 mermaid/svg 一致）
  - "查看源码"按钮 → `isCodeMode.value = true`
- 优点：集中管理错误展示逻辑；Mermaid DOM 清理在 catch 中即时执行
- 风险：PlantUML 行为改变可能干扰现有用户——但功能等价（有 "查看源码" 按钮）
- 工作量：～120 行（DiagramBlock 80 + MermaidRenderer 30 + useMermaid 5 + PlantUmlRenderer 5）

### 候选方案 B：Mermaid 内清理，不统一错误 UI（只修 Mermaid）
- 只修 MermaidRenderer 清理错误 SVG，不改 DiagramBlock 错误 UI
- 不改 PlantUML 行为
- 优点：改动量最小
- 缺点：不改统一错误 UI、不改 PlantUML——不符合 C-BDD-3~8
- 风险：BDD 不满足

**选择理由**：方案 A。统一错误 UI 是 P0 明确要求。工作量可接受，改动集中。

---

## 2. 声明字段

```yaml
packages:
  - backend/peekview/       # config.py, api/config_router.py, cli.py
  - frontend-v3/src/        # EntryDetailView, DiagramBlock, MermaidRenderer, utils/diagramSanitize.ts, api/client

domains:
  - mobile-header-shrink    # A-BDD-1~6: 移动端 header 标签截断 + 滚动收缩
  - diagram-sanitize        # B-BDD-1~6: 清洗模块 + 管道
  - diagram-config          # B-BDD-7~9: 后端配置 + CLI
  - diagram-error-ui        # C-BDD-1~8: Mermaid DOM 清理 + 统一错误 UI

ui_affected: true
# UI 交互点:
# - mobile: .header-tags 截断 + +N 指示器 + 滚动时收缩/恢复动画
# - diagram: 统一错误 UI（引擎名 + 可折叠详情 + 查看源码按钮）
# - diagram: Mermaid 错误后无大块错误 SVG 残留

gate_commands:
  P5: "cd backend && .venv/bin/python -m pytest -q --tb=no tests/"
  P5_typecheck: "cd frontend-v3 && npx vue-tsc --noEmit"
  P5_frontend_unit: "cd frontend-v3 && ./node_modules/.bin/vitest run --reporter=dot"
  P5_e2e: "cd frontend-v3 && npx playwright test --reporter=line e2e/"
  P6: "cd backend && .venv/bin/python -m pytest -q --tb=no tests/acceptance/"
```

---

## 3. 环境约束

```yaml
env_constraints:
  debug_env: "make debug-start（:8888, /tmp/peekview-debug/）"
  mobile_validation: "Playwright CDP Emulation.setDeviceMetricsOverride（iPhone 14, 390x844）"
  isolation_check: "sqlite3 /tmp/peekview-debug/peekview.db 'SELECT COUNT(*) FROM entries' — 确认调试 DB"
  captcha_disabled: "debug 模式自动关闭 captcha（config.py:401-406）"
```

---

## 4. files_to_read

```yaml
files_to_read:
  # Sub-domain A: Mobile header
  - path: frontend-v3/src/views/EntryDetailView.vue:476-478
    why: visibleTags / remainingTagCount 当前实现，需改为真实计算逻辑
  - path: frontend-v3/src/styles/layout.css:10-19
    why: .detail-header 样式，需加 position:sticky + mobile max-height
  - path: frontend-v3/src/components/BaseTag.vue
    why: 标签组件，了解其 DOM 结构（用于溢出判断）

  # Sub-domain B: Diagram sanitize
  - path: frontend-v3/src/components/DiagramBlock.vue:1-121
    why: 注入 sanitize 管线的挂接点（script 部分）
  - path: frontend-v3/src/types/index.ts:84-92
    why: DiagramBlockData 类型——code 字段需在传入 renderer 前被 sanitize 替换
  - path: frontend-v3/src/composables/usePlantUML.ts:20-32
    why: validateSource 函数——了解 plantuml 校验逻辑，避免与 sanitize 规则冲突

  # Sub-domain C: Diagram config
  - path: backend/peekview/config.py:272-341
    why: PeekAuth.captcha_enabled 模式——PeekDiagram 的参照
  - path: backend/peekview/api/config_router.py:16-46
    why: PublicCaptchaConfig + 端点模式——PublicDiagramConfig 的参照
  - path: backend/peekview/cli.py:531-628
    why: SUPPORTED_CONFIG_KEYS + config_set 类型转换——注册 diagram.sanitize_enabled
  - path: backend/peekview/cli.py:682-750
    why: config_list + _DESC 描述——添加 diagram section 分支

  # Sub-domain C frontend
  - path: frontend-v3/src/api/client.ts:300-301
    why: api 导出——新增 getDiagramConfig 方法
  - path: frontend-v3/src/api/types.ts:1-2
    why: API response 类型——新增 DiagramConfigResponse

  # Sub-domain D: Error UI
  - path: frontend-v3/src/components/renderers/MermaidRenderer.vue:107-118
    why: exportPng 中的 mermaid.render——需要同步清理 #dmermaid-{id}
  - path: frontend-v3/src/components/renderers/PlantUmlRenderer.vue:78-82
    why: renderDiagram catch——移除 isCodeMode=true 逻辑
  - path: frontend-v3/src/composables/useMermaid.ts:9-15
    why: mermaid.initialize()——加 suppressErrors: true
```

---

## 5. 设计方案详情

### 5.1 移动端 Header 收缩

**CSS 改动（layout.css）**：
- `.detail-header` 加 `position: sticky; top: 0; z-index: 10;`
- 新增 `.detail-header.header-tags-hidden .header-tags` 内 `max-height: 0; opacity: 0; overflow: hidden;`
- `@media (max-width: 768px)` 内 `.header-tags` 设 `max-height: 2.5em; overflow: hidden;`
- `.tag-overflow` "+N" 指示器常规样式

**JS 改动（EntryDetailView.vue）**：
- `visibleTags` → 计算实际可见标签数（基于容器 `clientHeight` 与标签行高比值，或直接用 CSS 隐式溢出 + 计算剩余）
- `remainingTagCount` → `tags.length - visibleTags.length`
- `onMounted` 添加 scroll 事件监听（rAF 节流），检测 `scrollY > 50` 时隐藏 `.header-tags`
- `onUnmounted` 移除监听
- 通过 `ref` 获取 `.detail-header` DOM，滚动 >50px 时添加 class `header-tags-hidden`，`scrollTop <= 20` 时移除

**溢出数量计算**：CSS `overflow: hidden` 让标签自然截断。JS 运行时检查 `.header-tags` 的 `scrollHeight > clientHeight` 判断是否有溢出，然后用 `getComputedStyle` 或逐 child 计算可见性确定 N。

### 5.2 图表清洗模块

**文件结构**：`frontend-v3/src/utils/diagramSanitize.ts`

```
// 规则注册表
type RuleFn = (code: string) => string
type RuleType = 'deterministic' | 'heuristic'
type RuleEntry = { name: string; fn: RuleFn; type: RuleType }

// 按引擎组织的规则
const rules: Record<string, RuleEntry[]> = {}

function registerRule(engine: string, name: string, fn: RuleFn, type: RuleType): void
function sanitize(code: string, engine: string): string        // 仅确定性规则
function sanitizeWithRetry(code: string, engine: string): { code: string; appliedHeuristics: boolean }  // 确定性→渲染→失败→启发式→再渲染

// 内置规则注册
// mermaid: 箭头修正 (->> → -->>), 子图括号补全, 空格规范化
// plantuml: @startuml/@enduml 补全
// svg: 属性引号补全, 闭合标签
```

**DiagramBlock 集成**：
- `onMounted` 通过 `api.getDiagramConfig()` 获取配置
- 在将 `block.code` 传给 renderer 前，调用 `sanitize(code, engine)`（如启用）
- 监听 renderer 的 `render-error` 事件，若已启用清洗则触发 `sanitizeWithRetry` + 重渲染
- 重渲染通过更新内部 `sanitizedCode` ref 触发 watch

### 5.3 配置后端 + CLI

**`PeekDiagram` 类**：
```python
class PeekDiagram(BaseSettings):
    sanitize_enabled: bool = Field(default=True, description="Enable diagram source sanitization")
```

注册到 `PeekConfig`：`diagram: PeekDiagram = Field(default_factory=PeekDiagram)`

**CLI 注册**（3 处）：
1. `SUPPORTED_CONFIG_KEYS`: 加 `"diagram.sanitize_enabled"`
2. 类型转换: `sanitize_enabled` → `value.lower() in ("true", "1", "yes", "on")`
3. `CONFIG_KEYS_HELP` + `config_list` + `config_get` 加 `"diagram"` section

### 5.4 错误 UI

**MermaidRenderer**：
- `useMermaid.ts`: `initialize({ suppressErrors: true, ... })`
- `renderDiagram()` catch: `document.getElementById(\`dmermaid-${renderId}\`)?.remove()`
- `exportPng()`: `const exportId = \`export-${crypto.randomUUID()}\`;` → catch 同样清理

**DiagramBlock 统一错误 UI**：
```html
<div v-if="hasError" class="diagram-error">
  <div class="diagram-error-header">
    <span class="diagram-error-title">{{ block.lang.toUpperCase() }} 渲染失败</span>
    <button @click="toggleErrorDetails">▼</button>
    <button @click="switchToCodeMode">查看源码</button>
  </div>
  <div v-show="errorDetailsOpen" class="diagram-error-details">
    {{ truncatedError }}  <!-- textContent bound, not v-html -->
  </div>
</div>
```

- `onRenderError(err)`: 存储错误信息到 `errorMessage` ref，设置 `hasError=true`
- 截取前 200 字符：`String(err).substring(0, 200)`
- "查看源码" → `isCodeMode.value = true`（暴露给 DiagramBlock 已有的 toggleView 逻辑）

**PlantUmlRenderer 行为变更**：
- `emit('renderError')` 不再带元信息（不影响），DiagramBlock 中 `onRenderError` 不再判断 `block.lang === 'plantuml'` 做特殊处理

---

## 6. 完成标志

1. ✅ 移动端 ≤768px：header-tags 单行截断，+N 指示器正确
2. ✅ 移动端向下滚动 >50px：header-tags 收缩隐藏动画执行
3. ✅ 移动端向上滚动 ≤20px：header-tags 恢复显示
4. ✅ 桌面端 ≥1024px：滚动不影响 header-tags 显示
5. ✅ backend config/diagram 返回 `{"sanitize_enabled": true}`
6. ✅ CLI `peekview config set diagram.sanitize_enabled false` 写配置 + 提示重启
7. ✅ 清洗规则注册式架构可扩展
8. ✅ 确定性修正无条件应用，启发式修正仅渲染失败后重试
9. ✅ Mermaid 错误后无大块错误 SVG 残留 DOM
10. ✅ 统一错误 UI 显示引擎名 + 可折叠详情 + 查看源码按钮
11. ✅ PlantUML 错误走统一错误 UI 而非 code mode
12. ✅ `npx vue-tsc --noEmit` 通过
13. ✅ `pytest -q --tb=no` 通过
14. ✅ `vitest run` 通过

---

## 7. 实现导航（P4 执行顺序建议）

1. **配置后端 + CLI**（最小依赖，独立可测）→ 后端 config.py + config_router.py + cli.py
2. **前端 api client** → api/client.ts + api/types.ts
3. **清洗模块** → utils/diagramSanitize.ts（纯函数，可独立单元测试）
4. **错误 UI** → useMermaid.ts + MermaidRenderer.vue + DiagramBlock.vue 错误 UI + PlantUmlRenderer.vue
5. **移动端 header** → EntryDetailView.vue + layout.css（最后做，依赖最少）
6. **DiagramBlock 集成清洗** → 将 sanitize 管线接入 DiagramBlock（需先有 config + 清洗模块）
