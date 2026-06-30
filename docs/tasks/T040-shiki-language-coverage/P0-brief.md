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

task: 前端 Shiki 语言注册覆盖后端 language.py 全部映射

## 问题

后端 `language.py` 声明支持 89 种语言（通过扩展名和文件名映射），但前端 `useShiki.ts` 只注册了 16 种语言。未注册的语言文件在查看时回退为纯文本（无高亮）。

**当前注册的 16 种**：python, javascript, typescript, markdown, json, html, css, bash, yaml, rust, go, java, cpp, c, sql, xml

**缺失的高频语言**（按影响排序）：

| 缺失语言 | 后端已映射 | Shiki 文件 | 影响面 |
|----------|-----------|-----------|--------|
| csharp | ✅ .cs | ✅ cs.mjs / csharp.mjs | C# 完全无高亮 |
| tsx | ✅ .tsx | ✅ tsx.mjs | React 生态核心 |
| ruby | ✅ .rb, Gemfile 等 | ✅ | Ruby 生态全灭 |
| php | ✅ .php | ✅ | PHP 无高亮 |
| swift | ✅ .swift | ✅ | iOS 无高亮 |
| kotlin | ✅ .kt, .kts | ✅ | Android 无高亮 |
| scss | ✅ .scss | ✅ | 前端样式 |
| sass | ✅ .sass | ✅ | 前端样式 |
| less | ✅ .less | ✅ | 前端样式 |
| shellscript/zsh/fish | ✅ | ✅ | 脚本无高亮 |
| toml | ✅ pyproject.toml 等 | ✅ | 配置文件 |
| dockerfile | ✅ | ✅ | DevOps |
| vue | ✅ .vue | ✅ | 本项目技术栈 |
| graphql | ✅ .graphql | ✅ | API schema |
| diff | ✅ .diff/.patch | ✅ | PR review |
| docker | ✅ | ✅ | 容器 |
| powershell | ✅ .ps1 | ✅ | 运维 |
| jsonc | ✅ tsconfig.json | ✅ | 配置 |

**Shiki 包含 316 个语言文件**，后端映射了 89 种。需要注册后端已映射且 Shiki 有文件的全部语言。

## 方案方向

1. **静态注册**：在 `useShiki.ts` 的 `commonLangs` 数组中补充所有缺失语言的 import（约 30-50 个）
2. **按需加载**（优化）：使用 `highlighter.loadLanguage()` 动态加载，减少首屏包体积。但这增加代码复杂度，首屏可能延迟

**建议先走方案 1**（静态注册），简单可靠。包体积增量可接受（Shiki 语言文件均为 JSON grammar，单文件 5-30KB，gzip 后更小）。

**注意**：后端 language.py 中的语言 ID 与 Shiki 的 BundledLanguage ID 可能不完全一致（如后端 `objective-c` vs Shiki `objective-c`、后端 `dockerfile` vs Shiki `dockerfile`），需逐一核对映射关系。不一致的需在后端 language.py 或前端加别名映射。

## 改动域

- `frontend-v3/src/composables/useShiki.ts` — 补充语言 import + 注册
- `backend/peekview/language.py` — 核对/修正语言 ID 与 Shiki 的映射一致性

known_risks:
  - 大量静态 import 可能增加首次 highlighter 初始化时间（需测量）
  - 部分语言 ID 在后端和 Shiki 间不一致，需逐一核对
  - 新增语言 import 不影响已有语言，回归风险低

executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

env_constraints:
  debug_env: make debug (127.0.0.1:8888, /tmp/peekview-debug/)

pruning_tendency: 可裁剪 — 方案明确，P3 可跳过（Shiki 注册本身不需要 TDD），P7 可合并到下次发布
