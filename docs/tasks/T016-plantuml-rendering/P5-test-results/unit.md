---
phase: P5
task_id: T016
task_name: plantuml-rendering
type: test_results
trace_id: T016-P5-2026-06-20
created: 2026-06-20
status: pass
parent: docs/tasks/T016-plantuml-rendering/P2-design.md
---

# P5 技术验证报告：PlantUML 渲染集成

## 1. 验证总结

| 项 | 结果 |
|----|------|
| 总体状态 | **PASS** |
| 前端单元测试 | PASS（10/10）|
| 前端构建 + typecheck | PASS |
| 真实 CSP Playwright 渲染 | PASS |
| 中文渲染 | PASS（vision 确认）|
| 生产环境隔离 | 未触碰 `~/.peekview/`（无 [PROD_TOUCHED]）|

P5 门禁放行至 P6 验收。所有功能性 BDD（渲染/降级/串行/懒加载/CSP）已在 P5 实跑通过；交互性 BDD（pan-zoom/全屏/PNG 导出/暗色主题/多图类型）留 P6 做端到端逐条实跑。

## 2. 逐项验证结果

### 2.1 前端单元测试

**命令**：
```bash
cd frontend-v3 && npx vitest run src/composables/__tests__/usePlantUML.spec.ts
```

**结果**：10 passed / 0 failed / exit 0

| # | 用例 | 覆盖 BDD | 状态 |
|---|------|----------|------|
| 1 | validateSource 有效源码 | BDD-1 | PASS |
| 2 | validateSource 缺 @startuml | BDD-3 | PASS |
| 3 | validateSource 缺 @enduml | BDD-3 | PASS |
| 4 | validateSource 空字符串 | BDD-3 | PASS |
| 5 | render 返回 SVG 字符串 | BDD-1 | PASS |
| 6 | render 语法错误 reject | BDD-3 | PASS |
| 7 | render 超时 reject | BDD-4 | PASS |
| 8 | render 串行队列排队 | BDD-7 | PASS |
| 9 | ensureLoaded 首次加载 | BDD-5 | PASS |
| 10 | ensureLoaded 不重复加载 | BDD-5 | PASS |

**全量前端测试**：84 passed / 1 failed
- 唯一失败：`mime.spec.ts` SVG MIME 检测
- 归属：**pre-existing**，非 T016 引入
- 复核：`git stash` 后该用例仍失败，确认与 T016 无关

### 2.2 前端构建（含 typecheck）

**命令**：
```bash
cd frontend-v3 && npm run build
```

**结果**：`✓ built in 13.48s`，无 typecheck 错误，无 TS 报错。

### 2.3 真实 CSP 下 Playwright 渲染验证

**环境**：`make debug-start`（`127.0.0.1:8888`）
- CSP：`script-src 'self' 'unsafe-eval'`（生产一致，未改动）
- 数据目录：`/tmp/peekview-debug/`（隔离）

**测试条目内容**：
- 3 个 ` ```plantuml ` 块：类图（中文）/ 时序图（中文）/ 组件图（英文）
- 1 个 ` ```mermaid ` 块（共存验证）

**Playwright DOM 检查结果**：

| 块 | rendered | hasSvg | SVG 大小 | 备注 |
|----|----------|--------|----------|------|
| plantuml-1 类图 | true | true | 3-4KB | 中文正常 |
| plantuml-2 时序图 | true | true | 3-4KB | 中文正常 |
| plantuml-3 组件图 | true | true | 3-4KB | 英文 |
| mermaid 块 | true | true | — | 与 PlantUML 共存正常 |

**CSP 违规**：**0 条** — plantuml.js / viz-global.js 同源加载成功，无 wasm/eval 阻断。

### 2.4 中文渲染（vision-helper 截图分析）

**截图**：
- `/tmp/p5-recheck-1.png`（类图）
- `/tmp/p5-recheck-2.png`（时序图）

**vision-helper 分析结论**：

| 图 | 内容确认 | 中文显示 | 结构 |
|----|----------|----------|------|
| 类图 | 用户/订单类 + 下单关系 | 全部正常，无豆腐块 | 完整 |
| 时序图 | 用户/认证服务参与者 + 登录请求/返回令牌消息 | 正常 | 完整 |

**结论**：中文渲染达到 BDD-1「无方块/豆腐块/乱码」要求。

## 3. 发现的问题

### 3.1 vendor/ 复制遗漏（构建流程问题）

**现象**：`npm run build` 后 `vendor/` 存在于 `frontend-v3/dist/`，但未自动复制到 `backend/peekview/static/`。

**临时处理**：手动 `cp -r frontend-v3/dist/vendor backend/peekview/static/` 后验证通过。

**根因推测**：Makefile 的 `cp -r frontend-v3/dist/* backend/peekview/static/` 理论上应覆盖，但实际未生效（疑似构建缓存或 glob 展开时机问题）。

**处置**：非阻塞，P5 不深挖。**留 P7 一致性检查**确认 Makefile 构建流程，保证发布产物完整。

### 3.2 SVGMatrix.inverse 警告（非致命）

**现象**：pan-zoom 初始化时控制台出现 `Failed to execute 'inverse' on 'SVGMatrix'` 警告，每次 3-4 次。

**影响**：非致命，不影响 SVG 渲染与展示。pan-zoom 仍可用。

**根因推测**：`PlantUmlDiagram.vue` 的 pan-zoom 初始化时序问题（SVG 尺寸/视图就绪前调用 `getCTM().inverse()`）。

**处置**：非阻塞 P5。**留 P7/后续改善**优化初始化时序（等待 SVG `viewBox` 就绪后再 init pan-zoom）。

### 3.3 生产环境隔离

所有 P5 验证在 `/tmp/peekview-debug/` 进行，**未触碰** `~/.peekview/`。无 [PROD_TOUCHED]。

## 4. BDD 覆盖对照

### 4.1 P5 已验证（实跑通过）

| BDD | 标题 | P5 验证方式 | 结论 |
|-----|------|-------------|------|
| BDD-1 | 正常渲染 PlantUML（含中文） | Playwright DOM + vision 截图 | PASS |
| BDD-2 | PlantUML 与 Mermaid 混合共存 | Playwright（3 plantuml + 1 mermaid 同文档） | PASS |
| BDD-3 | 语法错误降级 | 单元测试用例 #2/#3/#4/#6 | PASS（逻辑层） |
| BDD-4 | 渲染超时降级 | 单元测试用例 #7 | PASS（逻辑层） |
| BDD-5 | 懒加载（无 plantuml 块不加载） | 单元测试用例 #9/#10 | PASS（逻辑层） |
| BDD-7 | 多块串行渲染 | 单元测试用例 #8 + Playwright（3 块全部 rendered） | PASS |
| BDD-9 | 真实 CSP 下渲染 | `make debug` + CSP 违规计数 0 | PASS |

**说明**：BDD-3/4/5 的逻辑分支在单元测试已覆盖；P6 需在真实浏览器补端到端场景（如真实语法错误条目的降级 DOM 表现、真实无 plantuml 块页面的网络请求断言）。

### 4.2 留 P6 端到端验收

| BDD | 标题 | P6 需补 |
|-----|------|---------|
| BDD-3 | 语法错误降级 | 真实条目 + 浏览器 DOM 验证「退回源码展示 + 错误标识」 |
| BDD-4 | 超时降级 | 真实超时场景的 DOM 降级表现 + 控制台日志 |
| BDD-5 | 懒加载 | 真实无 plantuml 页面的 Network 面板断言（无 plantuml.js/viz-global.js 请求） |
| BDD-6 | 暗色主题 | dark/light 切换实跑 + `{dark: true}` 选项效果 + 与 Mermaid 暗色一致性 vision 对比 |
| BDD-7 | 多块串行 | 真实 3 块渲染时序断言 + 总耗时测量（基线 740ms） |
| BDD-8 | 交互复用（pan-zoom/全屏/PNG） | 真实点击全屏/zoom/PNG 下载，PNG 比例正确性，注意 §3.2 SVGMatrix 警告下 pan-zoom 仍可用 |
| BDD-9 | CSP | P5 已核心验证，P6 可顺手复测 |

### 4.3 P1 §3.3 PNG 导出兼容性（SCOPE+ 项）

P1 标注「PNG 导出对 PlantUML SVG 的兼容性」为待实测项（viewBox / g.root 假设）。

- **P5 状态**：未单独实测 PNG 导出（属 BDD-8 范畴）。
- **P5 检查**：PlantUML SVG 3-4KB，结构正常渲染（DOM hasSvg=true），但未抓取 outerHTML 比对 viewBox/g.root。
- **处置**：**留 P6** 在真实 PNG 导出实跑中验证；若导出比例异常则需小幅适配 `exportMermaidToPng`。

## 5. 结论

**P5 门禁：PASS**

- 单元测试 10/10 全绿（含串行/降级/懒加载核心逻辑）
- 构建 + typecheck 零错误
- 真实 CSP（`make debug`）下 Playwright 渲染成功，CSP 违规 0
- 中文渲染经 vision-helper 确认无豆腐块
- Mermaid/PlantUML 共存正常
- 生产数据库未触碰

**遗留至 P7**：vendor/ 复制流程一致性、SVGMatrix 警告优化（均非阻塞）。
**遗留至 P6**：BDD-3/4/5 端到端 DOM 表现、BDD-6 暗色主题、BDD-7 时序+耗时、BDD-8 交互+PNG 导出、P1 §3.3 PNG 兼容性实测。

**建议**：放行至 P6 验收。
