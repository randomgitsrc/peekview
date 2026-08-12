---
phase: P0
task_id: T087
task_name: code-linenumber-offbyone
trace_id: T087
created: 2026-08-06
status: pending
parent: none
---

# P0-brief — T087 代码块行号 off-by-one

## task

修复 `useShiki.ts:renderLineNumbers` 的 off-by-one：当文件内容以 `\n` 结尾时（POSIX 规范），`code.split('\n')` 产生末尾空字符串，导致行号比实际代码多一行。横切影响 CodeViewer / Markdown 代码块 / 源码视图三条渲染路径。

## known_risks

- 横切改动：3 条前端渲染路径共用 `renderLineNumbers`，单点修改需验证三处不回归
- Markdown 代码块路径：markdown-it tokenize 时对 fence content 会 trim 末尾换行，行为可能与 CodeViewer 路径不一致，需确认修复后两路径行号都对
- 视觉对齐：行号列与 Shiki `codeToHtml` 的 `.line` 数量必须一致，否则行号错位
- 无后端改动（content 链路原样透传，已确认）

## executor_env

platform: claude-code
has_task_tool: true
has_local_runtime: true
network: full

## env_constraints

debug_env: "make debug-quick（:8888，/tmp/peekview-debug/ 隔离）；前端测试 make test-frontend（vitest 非 watch）；typecheck: cd frontend-v3 && ./node_modules/.bin/vue-tsc --noEmit；E2E: make debug-test"
lint: "make lint（ruff，后端无改动可跳）；前端无 lint gate，typecheck 是 CI 强制项"
prod_isolation: "严禁触碰 :8080 生产服务与 ~/.peekview/；测试只走 debug backend :8888"

## 代码审计结果（bugfix 类 P0 输入）

### 根因（已由 Explore agent 核查确认）

`frontend-v3/src/composables/useShiki.ts:150-154`：

```ts
function renderLineNumbers(code: string): string {
  const lines = code.split('\n')
  const lineNumbers = lines.map((_, i) => `<span class="line-number">${i + 1}</span>`).join('\n')
  return `<div class="line-numbers" aria-hidden="true">${lineNumbers}</div>`
}
```

`"a\nb\n".split('\n')` → `["a","b",""]`（3 元素），实际 2 行。行号列多一个空号，Shiki 高亮列不多，两者错位。

### 影响面

| 路径 | 入口 | 是否受影响 |
|------|------|-----------|
| CodeViewer（独立文件查看）| `useShiki.highlight()` → `renderLineNumbers`（useShiki.ts:190）| ✅ |
| Markdown 代码块 | `useMarkdown.highlightCode()` → `renderLineNumbers`（useShiki.ts:207）| ✅（但 markdown-it 对 fence content trim 末尾换行，可能不复现）|
| 源码视图切换 | EntryDetailContent.vue 切 source 走 CodeViewer | ✅ |
| 后端 content 链路 | files.py:get_file_content → storage.read_file（read_bytes 原样）| ❌ 不追加换行 |

### 数据链路（已确认原样透传）

后端 `read_bytes()` → `Response(content=...)` → 前端 store → CodeViewer `props.content` → `highlight()` → `renderLineNumbers`。全程无 trim / 追加。末尾 `\n` 来自文件本身（POSIX 规范）。

### 修复方向（P2 细化，P0 只记录方向）

`renderLineNumbers` 内处理末尾换行：split 前去尾换行，或 split 后 pop 末尾空字符串。需注意空文件（`""`）和单行无换行（`"a"`）边界。

## 裁剪倾向

- P2：`follows_existing_pattern`，单候选方案（改一个函数），可简化
- P3：保留——横切改动必须有红灯。给 `renderLineNumbers` 加单测（末尾换行 / 无换行 / 空文件 / 单行四 case）
- P6：保留——UI 视觉改动必须 Playwright 截图验证行号对齐（CodeViewer + Markdown 代码块两路径）
- 风险：low-medium（根因单点、无后端、无 schema、无权限边界）

## 排期

T087（本任务，行号 bug）→ 完成后接 T086（admin-settings 合并）。两者独立，无依赖。
