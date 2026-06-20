---
phase: P0
task_id: T016
task_name: plantuml-rendering
type: brief
trace_id: T016-P0-2026-06-20
created: 2026-06-20
status: ready
parent: docs/notes/plantuml-rendering-feasibility.md + 原型验证
---

# P0 Brief：PlantUML 渲染集成

## 任务简报

为 PeekView 前端新增 PlantUML 图表渲染支持，比照现有 Mermaid 实现（`useMermaid.ts` + `MermaidDiagram.vue`），使 markdown 中的 ` ```plantuml ` 代码块能在浏览器端渲染为 SVG 图表。

**技术路线已定**：路线 A（官方 plantuml.js v1.2026.6，TeaVM 编译产物，客户端渲染）。原型验证已通过，详见 `references/prototype-conclusion.md`。

## 环境约束（debug_env）

- 调试服务：`make debug`（`127.0.0.1:8888`，数据目录 `/tmp/peekview-debug/`）
- 前端构建：`cd frontend-v3 && npm run build`（自动复制到 `backend/peekview/static/`）
- 前端测试：`cd frontend-v3 && npm run test`
- Playwright 验证：连本地 Chrome CDP `:18800`，截图 + vision-helper 分析
- CSP 现状：`script-src 'self' 'unsafe-eval'`（原型未触发 wasm 错误，预期无需改动，但 P5/P6 必须在真实 CSP 下验证）
- 严禁直接 uvicorn，严禁触碰 `~/.peekview/`

## 已知风险（来自原型验证 + 可行性报告）

| 风险 | 等级 | 说明 | 缓解 |
|------|------|------|------|
| plantuml.js 体积 6.94MB + viz-global.js 1.38MB | 中 | 首次加载慢 | 懒加载：仅检测到 plantuml 块时动态 import() |
| 并发渲染陷阱 | 中 | 引擎用共享内部状态，并发调用静默覆盖结果 | 串行队列（MutationObserver 等 SVG 出现再渲染下一个） |
| CSP 实际兼容性 | 低 | 原型无 CSP 限制下正常，未在 PeekView 真实 CSP 下验证 | P5/P6 必须在 `make debug` 真实 CSP 下跑 Playwright |
| stdlib 体积 | 低 | awslib/azure/k8s 等图标库体积大 | 按需懒加载，原型未涉及，集成时评估 |
| 暗色主题 | 低 | 原型未测 `{dark: true}` | P4 实现时验证 |
| 失败降级 | 低 | 语法错误/超时需退回展示原始代码块 | 仿 `useMermaid.ts` 的失败处理，5s 超时 |

## 裁剪倾向

| 阶段 | 计划 | 理由 |
|------|------|------|
| P1 需求基线 | 保留 | 需明确 PlantUML 块的识别规则、与 Mermaid 的共存、失败降级行为 |
| P2 方案设计 | 保留 | 懒加载策略、串行队列、stdlib 处理需设计；声明 `packages: frontend-v3` `domains: frontend` `ui_affected: true` |
| P3 TDD 测试 | 保留 | 渲染封装需单元测试，串行队列逻辑需覆盖 |
| P4 代码实现 | 保留 | 核心实现 |
| P5 技术验证 | 保留 | 必须在真实 CSP 下 Playwright 验证 |
| P6 验收 | 保留 | UI 改动，必须 Playwright 实跑 + 截图 + vision 分析 |
| P7 一致性检查 | 保留 | 涉及 useMarkdown/useMermaid 多文件改动 |
| P8 发布准备 | 保留 | frontend-v3 改动，需 bump peekview 版本 + CHANGELOG |

**不裁剪任何阶段**。理由：涉及前端 UI + 多文件改动 + CSP 安全相关，符合"不可跳过 P6"的裁剪铁律。

## 参考材料

- `references/prototype-conclusion.md` — 原型验证结论（路线 A 已确认可行）
- `references/prototype.html` — 原型页面（含 3 图源码 + 串行队列实现，可作为 P4 参考）
- `references/prototype-result.png` — 渲染截图（vision-helper 已确认中文正常）
- `docs/notes/plantuml-rendering-feasibility.md` — 技术预研（三路线对比，路线 B/C 已排除）
- 现有 Mermaid 实现（复用基础）：
  - `frontend-v3/src/composables/useMermaid.ts` — 渲染引擎封装（参照对象）
  - `frontend-v3/src/composables/useMarkdown.ts` — markdown 解析路由（加 plantuml 分支）
  - `frontend-v3/src/components/MermaidDiagram.vue` — 展示组件（接口可复用）

## 关键技术决策（原型已验证）

1. **加载方式**：`viz-global.js` 普通 `<script>` 同步加载 + `plantuml.js` ES module `import`
2. **API**：`render(lines: string[], targetId: string, {dark?: boolean})` — 异步，SVG 稍后写入 DOM
3. **串行队列**：`for...of` + `await` + MutationObserver 检测 SVG 出现，5s 超时兜底
4. **直接嵌入主文档**：无需 iframe 沙箱（原型已验证可行）
5. **中文渲染**：浏览器字体子系统处理，零问题（原型已验证）

## gate_commands

- `cd backend && make test` — 后端无改动，确保无回归
- `cd frontend-v3 && npm run build` — 前端构建含 typecheck
- `cd frontend-v3 && npm run test` — 前端单元测试
- `make debug` + Playwright 截图 + vision-helper — 真实 CSP 下渲染验证
