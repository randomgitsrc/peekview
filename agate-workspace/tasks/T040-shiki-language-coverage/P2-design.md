---
phase: P2
task_id: T040-shiki-language-coverage
type: design
parent: P1-requirements.md
trace_id: T040-P2-20260630
status: draft
created: 2026-06-30
---

## 影响域分析

### 改什么

| 文件 | 改动 |
|------|------|
| `frontend-v3/src/composables/useShiki.ts` | 新增 `LANG_IMPORT_MAP` + `ensureLanguage()` + 旧 ID 映射表；改造 `highlight()` 和 `highlightCode()` 调用 `ensureLanguage` |
| `backend/peekview/language.py` | `mathematica` → `wolfram`，`registry` → `reg`；`PLAIN_TEXT_LANGS` 增补无 Shiki grammar 的语言 |

### 不改什么

- `useShiki.ts` 的 16 种静态 import 和 `commonLangs` 数组不变
- `CodeViewer.vue` / `useMarkdown.ts` 调用层不变（它们只调 `highlight` / `highlightCode`）
- `types/index.ts` 的 `File.language` 类型不变（仍为 `string | null`）
- `language.py` 的 `EXTENSION_MAP` / `FILENAME_MAP` 键（扩展名/文件名）不变，只改部分值
- Vite 配置不变（默认行为已支持动态 import 独立 chunk）

### 风险

| 风险 | 缓解 |
|------|------|
| 动态 import 路径 `shiki/langs/xxx.mjs` 随 Shiki 版本变化 | `LANG_IMPORT_MAP` 集中维护，升级时只需更新此表 |
| 动态加载失败（网络/构建缺失）导致白屏 | `ensureLanguage` try-catch 包裹，失败回退 text |
| 旧 entry 数据中 language="mathematica" / "registry" | 前端 `LEGACY_LANG_MAP` 做读取时映射 |
| 59 个动态 chunk 增加构建产物数量 | 单个 chunk 很小（<10KB gzip），Vite 默认不合并动态 import |

---

## §1 设计方案

### 1.1 前端：`LANG_IMPORT_MAP` + `ensureLanguage()`

**位置**：`frontend-v3/src/composables/useShiki.ts`

#### LANG_IMPORT_MAP

```typescript
const LANG_IMPORT_MAP: Record<string, () => Promise<any>> = {
  csharp: () => import('shiki/langs/csharp.mjs'),
  ruby: () => import('shiki/langs/ruby.mjs'),
  php: () => import('shiki/langs/php.mjs'),
  swift: () => import('shiki/langs/swift.mjs'),
  scala: () => import('shiki/langs/scala.mjs'),
  r: () => import('shiki/langs/r.mjs'),
  scss: () => import('shiki/langs/scss.mjs'),
  sass: () => import('shiki/langs/sass.mjs'),
  less: () => import('shiki/langs/less.mjs'),
  stylus: () => import('shiki/langs/stylus.mjs'),
  toml: () => import('shiki/langs/toml.mjs'),
  ini: () => import('shiki/langs/ini.mjs'),
  rst: () => import('shiki/langs/rst.mjs'),
  zsh: () => import('shiki/langs/zsh.mjs'),
  fish: () => import('shiki/langs/fish.mjs'),
  powershell: () => import('shiki/langs/powershell.mjs'),
  batch: () => import('shiki/langs/batch.mjs'),
  dockerfile: () => import('shiki/langs/dockerfile.mjs'),
  makefile: () => import('shiki/langs/makefile.mjs'),
  graphql: () => import('shiki/langs/graphql.mjs'),
  vue: () => import('shiki/langs/vue.mjs'),
  svelte: () => import('shiki/langs/svelte.mjs'),
  astro: () => import('shiki/langs/astro.mjs'),
  lua: () => import('shiki/langs/lua.mjs'),
  viml: () => import('shiki/langs/viml.mjs'),
  elm: () => import('shiki/langs/elm.mjs'),
  clojure: () => import('shiki/langs/clojure.mjs'),
  dart: () => import('shiki/langs/dart.mjs'),
  groovy: () => import('shiki/langs/groovy.mjs'),
  'objective-c': () => import('shiki/langs/objective-c.mjs'),
  'objective-cpp': () => import('shiki/langs/objective-cpp.mjs'),
  nim: () => import('shiki/langs/nim.mjs'),
  v: () => import('shiki/langs/v.mjs'),
  zig: () => import('shiki/langs/zig.mjs'),
  elixir: () => import('shiki/langs/elixir.mjs'),
  erlang: () => import('shiki/langs/erlang.mjs'),
  ocaml: () => import('shiki/langs/ocaml.mjs'),
  fsharp: () => import('shiki/langs/fsharp.mjs'),
  purescript: () => import('shiki/langs/purescript.mjs'),
  haxe: () => import('shiki/langs/haxe.mjs'),
  pascal: () => import('shiki/langs/pascal.mjs'),
  crystal: () => import('shiki/langs/crystal.mjs'),
  lisp: () => import('shiki/langs/lisp.mjs'),
  scheme: () => import('shiki/langs/scheme.mjs'),
  racket: () => import('shiki/langs/racket.mjs'),
  julia: () => import('shiki/langs/julia.mjs'),
  matlab: () => import('shiki/langs/matlab.mjs'),
  wolfram: () => import('shiki/langs/wolfram.mjs'),
  prolog: () => import('shiki/langs/prolog.mjs'),
  perl: () => import('shiki/langs/perl.mjs'),
  awk: () => import('shiki/langs/awk.mjs'),
  diff: () => import('shiki/langs/diff.mjs'),
  reg: () => import('shiki/langs/reg.mjs'),
  tsx: () => import('shiki/langs/tsx.mjs'),
  kotlin: () => import('shiki/langs/kotlin.mjs'),
  csv: () => import('shiki/langs/csv.mjs'),
  log: () => import('shiki/langs/log.mjs'),
  jsonc: () => import('shiki/langs/jsonc.mjs'),
  cmake: () => import('shiki/langs/cmake.mjs'),
  nginx: () => import('shiki/langs/nginx.mjs'),
  apache: () => import('shiki/langs/apache.mjs'),
  dotenv: () => import('shiki/langs/dotenv.mjs'),
}
```

共 63 项（90 种后端语言 - 16 种静态 import - 12 种无 grammar + mathematica→wolfram 别名 = 63）。其中 `wolfram` 和 `reg` 是对齐后的新 ID，需额外保留旧 ID 映射。

#### LEGACY_LANG_MAP（旧数据兼容）

```typescript
const LEGACY_LANG_MAP: Record<string, string> = {
  mathematica: 'wolfram',
  registry: 'reg',
}
```

#### ensureLanguage()

```typescript
const loadingLangs = new Map<string, Promise<boolean>>()

async function ensureLanguage(
  highlighter: Highlighter,
  lang: string
): Promise<string> {
  const resolvedLang = LEGACY_LANG_MAP[lang] ?? lang

  if (highlighter.getLoadedLanguages().includes(resolvedLang as BundledLanguage)) {
    return resolvedLang
  }

  if (commonLangs.some(l => l.name === resolvedLang || l.aliases?.includes(resolvedLang))) {
    return resolvedLang
  }

  let promise = loadingLangs.get(resolvedLang)
  if (!promise) {
    const importer = LANG_IMPORT_MAP[resolvedLang]
    if (!importer) return 'text'
    promise = importer()
      .then(async (mod) => {
        await highlighter.loadLanguage(mod.default)
        loadingLangs.delete(resolvedLang)
        return true
      })
      .catch(() => {
        loadingLangs.delete(resolvedLang)
        return false
      })
    loadingLangs.set(resolvedLang, promise)
  }

  const ok = await promise
  return ok ? resolvedLang : 'text'
}
```

关键设计点：
- `LEGACY_LANG_MAP` 先于 `getLoadedLanguages` 检查，旧 ID 优先映射
- `loadingLangs` Map 实现并发去重：同一语言多次调用共享同一个 Promise
- `loadLanguage` 返回 Promise（已验证），必须 await
- 失败时返回 `'text'`，不抛错，不影响全局 highlighter

#### highlight() 和 highlightCode() 改造

两处相同的回退逻辑替换为 `ensureLanguage` 调用：

```typescript
async function highlight(code: string, lang: string, theme: 'github-dark' | 'github-light'): Promise<string> {
  const highlighter = await getHighlighter()
  const effectiveLang = await ensureLanguage(highlighter, lang)
  const html = highlighter.codeToHtml(code, { lang: effectiveLang, theme })
  const lineNumbersHtml = renderLineNumbers(code)
  return `<div class="code-container">${lineNumbersHtml}${html}</div>`
}

async function highlightCode(code: string, lang: string, theme: 'github-dark' | 'github-light'): Promise<string> {
  const highlighter = await getHighlighter()
  const effectiveLang = await ensureLanguage(highlighter, lang)
  return highlighter.codeToHtml(code, { lang: effectiveLang, theme })
}
```

### 1.2 后端：语言 ID 对齐

**位置**：`backend/peekview/language.py`

#### EXTENSION_MAP 改动

| 行 | 改动 | 旧值 | 新值 |
|----|------|------|------|
| 122-124 | 3 处 `mathematica` → `wolfram` | `"mathematica"` | `"wolfram"` |
| 134 | `.reg` 映射 | `"registry"` | `"reg"` |

#### PLAIN_TEXT_LANGS 增补

新增 12 种无 Shiki grammar 的语言 ID：

```python
PLAIN_TEXT_LANGS = {
    "text", "log", "csv", "ignore", "git_attributes",
    "autohotkey", "editorconfig", "git_config", "janet",
    "odin", "pip-requirements", "sed", "vba", "vbscript",
}
```

注：`PLAIN_TEXT_LANGS` 的语义是"无需高亮的语言"，增补这些 ID 不影响前端行为（前端通过 `LANG_IMPORT_MAP` 缺失自动回退 text），但让后端逻辑自洽——如果未来有地方用 `PLAIN_TEXT_LANGS` 判断是否需要高亮，这些 ID 会被正确处理。

#### `.m` 冲突注释

第 88 行 `.m: "objective-c"` 已被第 121 行 `.m: "matlab"` 覆盖，这是 dict 后者覆盖前者的自然行为。在 `.m: "matlab"` 行添加注释说明冲突，本次不解决（`[SCOPE-]`）。

---

## §2 BDD 覆盖映射

| BDD | 方案对应 | 验证方式 |
|-----|----------|----------|
| BDD-01 首屏 16 种零增量 | `commonLangs` 不变，`LANG_IMPORT_MAP` 用动态 import 不入主 bundle | `npx vue-tsc --noEmit` + 构建产物分析 |
| BDD-02 未注册语言按需加载 | `ensureLanguage()` 查 map → 动态 import → `loadLanguage()` | Playwright 截图验证 ruby 高亮 |
| BDD-03 无 grammar 语言回退 text | `LANG_IMPORT_MAP` 无 key → 返回 `'text'` | 单元测试 |
| BDD-04 动态加载失败回退 text | `ensureLanguage()` catch → 返回 `'text'` | 单元测试 mock 失败 |
| BDD-05 后端 ID 与 Shiki 对齐 | `mathematica` → `wolfram`，`registry` → `reg` | pytest 断言 |
| BDD-06 并发不重复加载 | `loadingLangs` Map 共享 Promise | 单元测试（2 次 concurrent 调用验证 import 仅 1 次） |
| BDD-07 highlightCode 支持动态加载 | `highlightCode()` 也调用 `ensureLanguage()` | 单元测试 |
| BDD-08 后端 ID 对齐后 API 正确 | `.wl` → `wolfram`，`.reg` → `reg` | pytest 断言 |
| BDD-09 旧数据兼容 | `LEGACY_LANG_MAP` 在前端映射 | 单元测试 |

---

## §3 实现完成标志

1. `useShiki.ts` 包含 `LANG_IMPORT_MAP`（63 项）、`LEGACY_LANG_MAP`（2 项）、`ensureLanguage()`，`highlight()` 和 `highlightCode()` 统一调用 `ensureLanguage`
2. `language.py` 中 `mathematica` 全部替换为 `wolfram`，`registry` 替换为 `reg`，`PLAIN_TEXT_LANGS` 增补至 14 项
3. 后端 pytest 全绿（含语言检测断言更新）
4. 前端 `npx vue-tsc --noEmit` 通过
5. 构建产物中 16 种静态语言在主 chunk，动态 import 语言在独立 chunk

---

## 声明字段

```yaml
packages:
  - backend/peekview
  - frontend-v3

domains:
  - frontend
  - backend

ui_affected: false

gate_commands:
  P5: "cd backend && .venv/bin/python -m pytest tests/test_language.py -q --tb=no"
  P5_frontend: "cd frontend-v3 && npx vue-tsc --noEmit 2>&1 | tail -20"
  P6: "cd backend && .venv/bin/python -m pytest tests/test_language.py -q --tb=no"

env_constraints:
  debug_env: "make debug (127.0.0.1:8888, /tmp/peekview-debug/)"
  isolation_check: "sqlite3 /tmp/peekview-debug/peekview.db 'SELECT COUNT(*) FROM entries' 2>/dev/null || echo 'debug db not found'"

files_to_read:
  - path: frontend-v3/src/composables/useShiki.ts
    why: 改动主文件，新增 LANG_IMPORT_MAP + ensureLanguage + LEGACY_LANG_MAP，改造 highlight/highlightCode
  - path: backend/peekview/language.py
    why: 改动主文件，mathematica→wolfram, registry→reg, PLAIN_TEXT_LANGS 增补
  - path: backend/tests/test_language.py
    why: 更新断言（mathematica→wolfram, registry→reg）+ 新增对齐测试
  - path: frontend-v3/src/components/__tests__/CodeViewer.spec.ts
    why: 更新 mock 以适配 ensureLanguage 异步行为

minimal_validation:
  assumption: "Shiki loadLanguage(grammar) 可动态注册语言，getLoadedLanguages() 可检测，动态 import shiki/langs/xxx.mjs 可行"
  method: "Node.js 脚本：createHighlighter 空语言 → 动态 import csharp.mjs → loadLanguage(awaited) → getLoadedLanguages 验证 → codeToHtml 验证高亮输出"
  result: "confirmed"
  note: |
    验证结果（2026-06-30）：
    1. shiki v1.29.2 loadLanguage(grammar) 返回 Promise，必须 await
    2. 动态 import 'shiki/langs/csharp.mjs' 返回 { default: grammar }，需取 .default
    3. loadLanguage 幂等：重复调用不报错
    4. getLoadedLanguages() 正确返回已注册语言 ID（含别名，如 csharp 返回 ['csharp','c#','cs']）
    5. objective-c 在 Shiki 中 ID 为 'objective-c'（objc 是别名），无需改
    6. wolfram、reg 均有对应 grammar 文件
    7. 后端 90 种语言 ID 中 76 种直接匹配 Shiki，2 种需映射，12 种无 grammar
```
