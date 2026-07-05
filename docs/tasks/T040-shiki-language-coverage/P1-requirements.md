---
phase: P1
task_id: T040-shiki-language-coverage
type: requirements
parent: P0-brief.md
trace_id: T040-P1-20260630
status: draft
created: 2026-06-30
---

## 需求复述

后端 `language.py` 声明 89 种语言 ID，前端 `useShiki.ts` 仅静态注册 16 种。未注册语言一律回退为纯文本，导致大量代码文件失去语法高亮。

**目标**：
1. 首屏保持 16 种语言静态 import，零增量启动时间
2. 未注册语言按需动态加载（`LANG_IMPORT_MAP` + `loadLanguage`），覆盖后端全部有 Shiki grammar 的语言
3. 后端语言 ID 与 Shiki `BundledLanguage` ID 对齐，消除不一致

## 隐含需求识别

### 1. 语言 ID 对齐表（必须先建立再改代码）

后端 89 种语言中，14 种不在 Shiki `BundledLanguage` 中。需逐一判定：映射到 Shiki 别名、还是保留 text 回退。

**已确认的对齐映射**（需在后端修正）：

| 后端当前 ID | Shiki BundledLanguage ID | 动作 |
|---|---|---|
| `mathematica` | `wolfram` | 后端改 `mathematica` → `wolfram` |
| `registry` | `reg` | 后端改 `registry` → `reg` |

**确认不可映射的**（Shiki 无对应 grammar，保留 text 回退）：

| 后端 ID | 原因 |
|---|---|
| `autohotkey` | Shiki 无 AHK grammar |
| `editorconfig` | Shiki 无 grammar |
| `git_attributes` | Shiki 无 grammar |
| `git_config` | Shiki 无 grammar |
| `ignore` | Shiki 无 grammar |
| `janet` | Shiki 无 grammar |
| `odin` | Shiki 无 grammar |
| `pip-requirements` | Shiki 无 grammar |
| `sed` | Shiki 无 grammar |
| `vba` | Shiki 无 grammar |
| `vbscript` | Shiki 的 `vb` 是 VB.NET，不是 VBScript |
| `text` | 纯文本无需 grammar |

**为什么必须**：不对齐则动态加载查不到 grammar，或加载了错误 grammar。

### 2. `.m` 扩展名冲突

后端 `EXTENSION_MAP` 中 `.m` 同时映射 `objective-c`（line 88）和 `matlab`（line 121），Python dict 后者覆盖前者。当前实际行为：`.m` → `matlab`。Shiki 的 `wolfram` grammar 也声明 `.m` 为 file type。此冲突已存在，本次不解决（标记 `[SCOPE-]`），但需在代码注释中明确。

### 3. 动态加载失败时的回退策略

`LANG_IMPORT_MAP` 中有但动态 import 失败（网络/构建问题）时，必须回退为 `text`，不能抛错导致页面白屏。

### 4. `highlight` 和 `highlightCode` 两个函数都需改造

当前 `useShiki.ts` 有 `highlight()`（带行号）和 `highlightCode()`（不带行号），两者都有语言回退逻辑。动态加载需在两处统一生效。

### 5. 加载并发控制

同一语言可能被多个组件同时请求（如 entry 含多个同语言文件），需避免重复加载。`highlighter.loadLanguage()` 内部是否幂等需确认——若不幂等，需在 `ensureLanguage` 层加缓存/去重。

### 6. 前端构建产物体积

59 个动态 import 会生成 59 个独立 chunk。需确认 Vite 的 `splitChunks` 配置不会将它们合并回主 bundle，否则违背"零增量启动时间"目标。

### 7. 后端 `get_language_list()` API 返回值变化

后端语言 ID 对齐后，`/api/v1/entries/{slug}/raw` 等接口返回的 `language` 字段会变（如 `mathematica` → `wolfram`）。需评估对 MCP client 和已有 entry 数据的影响。

### 8. 已有 entry 数据中的 language 字段

数据库中已存储的 `language` 字段（如 `mathematica`、`registry`）在对齐后不会自动更新。前端动态加载时需能处理旧 ID（或后端需做读取时映射）。

## BDD 验收条件

### BDD-01: 首屏 16 种语言零增量启动时间
```
Given 前端应用首次加载
When Shiki highlighter 初始化完成
Then 16 种静态 import 语言（python, javascript, typescript, markdown, json, html, css, bash, yaml, rust, go, java, cpp, c, sql, xml）可用
And 主 bundle 体积增量 ≤ 0 KB（动态 import 不计入主 bundle）
```

### BDD-02: 未注册语言按需动态加载
```
Given Shiki highlighter 已初始化
And 语言 "ruby" 未在静态 import 中
When 调用 highlight(code, "ruby", "github-dark")
Then "ruby" grammar 被动态 import 并加载到 highlighter
And 代码以 Ruby 语法高亮渲染（非纯文本）
And 后续对 "ruby" 的 highlight 调用不再触发动态 import
```

### BDD-03: 无 Shiki grammar 的语言回退为纯文本
```
Given Shiki highlighter 已初始化
And 语言 "autohotkey" 在 LANG_IMPORT_MAP 中不存在
When 调用 highlight(code, "autohotkey", "github-dark")
Then 代码以纯文本渲染（无语法高亮）
And 不抛出错误
```

### BDD-04: 动态加载失败时回退为纯文本
```
Given Shiki highlighter 已初始化
And 语言 "kotlin" 在 LANG_IMPORT_MAP 中存在
When 动态 import 'shiki/langs/kotlin.mjs' 失败（网络错误或构建缺失）
Then 代码以纯文本渲染
And 不抛出错误
And loadError 不被设置（仅影响该语言，不影响全局 highlighter）
```

### BDD-05: 后端语言 ID 与 Shiki 对齐
```
Given 后端 language.py 的 EXTENSION_MAP 和 FILENAME_MAP
When 对每个语言 ID 检查 Shiki BundledLanguage
Then 所有有 Shiki grammar 的语言 ID 与 Shiki BundledLanguage ID 一致
And 无 Shiki grammar 的语言 ID 保留原值（前端 text 回退）
```

### BDD-06: 并发请求同一语言不重复加载
```
Given Shiki highlighter 已初始化
And 语言 "scala" 未加载
When 两个组件同时调用 highlight(code1, "scala", ...) 和 highlight(code2, "scala", ...)
Then "scala" grammar 仅被动态 import 一次
And 两次 highlight 均以 Scala 语法高亮渲染
```

### BDD-07: highlight 和 highlightCode 统一支持动态加载
```
Given Shiki highlighter 已初始化
And 语言 "php" 未在静态 import 中
When 调用 highlightCode(code, "php", "github-dark")（无行号版本）
Then "php" grammar 被动态加载
And 代码以 PHP 语法高亮渲染
```

### BDD-08: 后端 ID 对齐后 API 返回值正确
```
Given 后端语言 ID 已对齐
When 上传 .wl 文件（Wolfram/Mathematica）
Then API 返回 language 为 "wolfram"（非 "mathematica"）
And 前端 LANG_IMPORT_MAP 包含 "wolfram" 映射
And 代码以 Wolfram 语法高亮渲染
```

### BDD-09: 旧 entry 数据兼容
```
Given 数据库中存在 language="mathematica" 的 entry
When 前端请求该 entry
Then 前端能正确处理 "mathematica" 语言 ID（回退为 text 或映射到 wolfram）
And 不抛出错误
```

## 待确认清单

无 `[NEED_CONFIRM]` 项。所有隐含需求均有明确技术判定：
- `mathematica` → `wolfram`：Shiki grammar 名称确认
- `registry` → `reg`：Shiki grammar 确认为 Windows Registry Script
- `vbscript` ≠ `vb`：VB.NET ≠ VBScript，不映射
- 旧数据兼容：前端做映射（后端不改存量数据）

## 裁剪说明

```yaml
phases: [P1, P2, P3, P4, P5, P6, P8]
```

| 阶段 | 裁剪？ | 理由 |
|---|---|---|
| P1 | 保留 | 当前产出 |
| P2 | 保留 | 涉及前后端改动，语言 ID 对齐需设计方案，动态加载架构需明确 |
| P3 | 保留 | 语言 ID 对齐涉及 89→75 映射关系，TDD 可防止回归；动态加载逻辑需集成测试 |
| P4 | 保留 | 实现阶段 |
| P5 | 保留 | pytest 全绿 + 隔离验证 |
| P6 | 保留 | BDD 逐条实跑，UI 需 Playwright 截图验证动态加载效果 |
| P7 | 跳过 | 仅 2 个文件改动（useShiki.ts + language.py），一致性检查无必要 |
| P8 | 跳过 | 主 Agent 预判合并到下次发布，不单独 bump |

## 范围声明

```yaml
packages:
  - peekview (backend)
  - frontend-v3

domains:
  - frontend  # useShiki.ts 动态加载逻辑
  - backend   # language.py ID 对齐

ui_affected:
  - CodeViewer 组件（动态加载后高亮效果变化）
  - MarkdownViewer 组件（代码块高亮变化）

files_affected:
  - frontend-v3/src/composables/useShiki.ts
  - backend/peekview/language.py
```

## 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需截图验证动态加载后代码高亮效果（非纯文本回退）
    available:
      - playwright-cdp skill
      - vision-analyzer skill
    status: available

  - need: shiki-bundled-languages-introspection
    why: 需确认 Shiki v1.29.2 的 BundledLanguage ID 列表和 grammar 内容
    available:
      - Node.js runtime + shiki package (frontend-v3/node_modules)
    status: available
    note: 已在 P1 阶段完成验证，303 个 BundledLanguage ID 已枚举

  - need: vite-build-analysis
    why: 需确认动态 import 生成独立 chunk，不合并回主 bundle
    available:
      - vite build + rollup output analysis
    status: available
```
