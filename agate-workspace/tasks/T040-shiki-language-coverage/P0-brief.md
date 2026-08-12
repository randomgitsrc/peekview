---
phase: P0
task_id: T040
task_name: shiki-language-coverage
type: fix
trace_id: T040-P0-20260630
created: 2026-06-30
status: draft
parent: T038 (合并扩展)
---

task: Shiki 语言按需加载 — 首屏 16 种 + 动态 loadLanguage 覆盖后端全部映射

## 问题

后端 `language.py` 声明支持 89 种语言，前端 `useShiki.ts` 只注册 16 种。未注册语言回退为纯文本。

## 方案：按需动态加载

**首屏**：保持现有 16 种静态 import（python, javascript, typescript, markdown, json, html, css, bash, yaml, rust, go, java, cpp, c, sql, xml），零增量启动时间。

**动态加载**：遇到未注册语言时，调用 `highlighter.loadLanguage(lang)` 按需加载。Shiki 的 `loadLanguage()` 接受 grammar 对象，需动态 import 对应的 `.mjs` 文件。

实现方式：
1. 维护一个 `LANG_IMPORT_MAP: Record<string, () => Promise<any>>`，key 为语言 ID，value 为动态 import 函数
2. `highlight()` 遇到未注册语言时，查 map → 动态 import → `loadLanguage()` → 再 highlight
3. 加载过的语言缓存到 highlighter 实例，下次不再加载

```typescript
// 伪代码
const LANG_IMPORT_MAP: Record<string, () => Promise<any>> = {
  csharp: () => import('shiki/dist/langs/csharp.mjs'),
  tsx: () => import('shiki/dist/langs/tsx.mjs'),
  ruby: () => import('shiki/dist/langs/ruby.mjs'),
  // ... 后端映射的全部语言
}

async function ensureLanguage(highlighter: Highlighter, lang: string): Promise<boolean> {
  if (highlighter.getLoadedLanguages().includes(lang as BundledLanguage)) return true
  const importer = LANG_IMPORT_MAP[lang]
  if (!importer) return false
  const grammar = await importer()
  highlighter.loadLanguage(grammar)
  return true
}
```

## 语言 ID 对齐

后端 `language.py` 的语言 ID 与 Shiki 的 `BundledLanguage` ID 需逐一核对。不一致的在后端修正（如 `objective-c` → `objc` 等，视 Shiki 实际 ID 而定）。

## 改动域

- `frontend-v3/src/composables/useShiki.ts` — 动态加载逻辑 + LANG_IMPORT_MAP
- `backend/peekview/language.py` — 语言 ID 与 Shiki 对齐

known_risks:
  - 动态 import 路径 `shiki/dist/langs/xxx.mjs` 可能随 Shiki 版本变化
  - 部分语言 ID 后端与 Shiki 不一致，需逐一核对
  - 首次查看未注册语言时有短暂加载延迟（可接受）

executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

env_constraints:
  debug_env: make debug (127.0.0.1:8888, /tmp/peekview-debug/)

pruning_tendency: 可适度裁剪 — 方案明确，P3 可跳过（动态加载逻辑用集成测试覆盖），P7 可合并到下次发布
