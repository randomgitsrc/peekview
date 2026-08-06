---
phase: P3
task_id: T087-code-linenumber-offbyone
type: test-cases
parent: P2-design.md
---

# P3-test-cases — T087 代码块行号 off-by-one

## 声明

```yaml
test_code_dir: frontend-v3/src/composables/__tests__/
test_files:
  - useShiki.linenumber.spec.ts   # 新增，覆盖 BDD-1~7
test_runner: "cd frontend-v3 && ./node_modules/.bin/vitest run"
formatter: vitest.sh
e2e_regression: frontend-v3/e2e/viewer.spec.ts   # BDD-8/9/10 走现有 spec，P5_e2e 跑
domains: [frontend]
```

## 测试策略

### 被测对象
- `useShiki.ts:highlight()` (line 177-192) — CodeViewer 路径
- `useShiki.ts:highlightCode()` (line 194-209) — Markdown 代码块路径
- `useShiki.ts:renderLineNumbers()` (line 150-154) — 未 export，通过 highlight/highlightCode 间接测（P2 §6 方案 b，不改函数签名）

### mock 策略
- `vi.mock('shiki', ...)` 阻断真实 `createHighlighter`，返回 fakeHighlighter
- fakeHighlighter.codeToHtml 模拟真实 Shiki 1.x 行为：**不 trim 末尾换行**，`code.split('\n')` 每段产出一个 `.line`（含末尾空字符串→空 `.line`）
- mock 回调内只用字符串字面量（T079 mock hoisting 反模式规避）
- 断言通过 DOMParser 解析 highlight()/highlightCode() 返回的 HTML，count `.code-container .line-numbers .line-number` 与 `.code-container .line`

### 三联对齐断言（核心）
每个测试同时断言三件事：
1. `.line-number` count == 预期逻辑行数
2. `.line` count == 预期逻辑行数
3. `.line-number` count == `.line` count（两列对齐）

## BDD → 测试用例映射

### vitest 单测（BDD-1~7，本文件）

| BDD | 测试 case | 输入 | 预期 line-number | 预期 .line | 当前状态 |
|-----|-----------|------|------------------|-----------|---------|
| BDD-1 末尾换行 | highlight("a\nb\n") | `"a\nb\n"` | 2 | 2 | 🔴 红（received 3） |
| BDD-2 无换行 | highlight("a\nb") | `"a\nb"` | 2 | 2 | 🟢 绿（无 bug case） |
| BDD-3 单行 | highlight("a") | `"a"` | 1 | 1 | 🟢 绿（无 bug case） |
| BDD-4 空文件 | highlight("") | `""` | 1 | 1 | 🟢 绿（无 bug case，CodeViewer 组件层短路，纯函数层 1==1 对齐） |
| BDD-5 仅换行符 | highlight("\n") | `"\n"` | 1 | 1 | 🔴 红（received 2） |
| BDD-6 中间空行+末尾换行 | highlight("a\n\n") | `"a\n\n"` | 2 | 2 | 🔴 红（received 3） |
| BDD-7 Markdown 代码块 | highlightCode("a\nb\n") | `"a\nb\n"` | 2 | 2 | 🔴 红（received 3） |
| BDD-7b 回归 | highlightCode("a") | `"a"` | 1 | 1 | 🟢 绿（无 bug case） |
| BDD-7b 回归 | highlightCode("\n") | `"\n"` | 1 | 1 | 🔴 红（received 2） |

### E2E 回归（BDD-8/9/10，现有 viewer.spec.ts，P5_e2e 跑）

| BDD | 现有 E2E 用例 | 验证点 |
|-----|--------------|--------|
| BDD-8 Markdown 多代码块不回归 | viewer.spec.ts TC-002 Line numbers displayed | `.code-body .line` count > 0 |
| BDD-9 wrap 对齐 | viewer.spec.ts TC-003 Wrap mode toggle | wrap toggle 后 `.code-body` class 变化（syncLineHeights 配对依赖两列数量一致） |
| BDD-10 源码视图切换 | viewer.spec.ts TC-001/TC-002 CodeViewer 路径 | CodeViewer 渲染 `.line` count > 0 |

P3 不新写 E2E（dispatch-context 明确："BDD-8/9/10 走现有 viewer.spec.ts E2E 回归，P3 不必新写 E2E"）。

## 红灯分析

### 真红灯（5 个，B 类 assertion failure，证明 bug）
- BDD-1: `"a\nb\n".split('\n')` → `["a","b",""]` → 3 行号/3 .line（当前未 trim），预期 2 → 🔴
- BDD-5: `"\n".split('\n')` → `["",""]` → 2，预期 1 → 🔴
- BDD-6: `"a\n\n".split('\n')` → `["a","",""]` → 3，预期 2 → 🔴
- BDD-7: highlightCode 同 highlight 结构，`"a\nb\n"` → 3，预期 2 → 🔴
- BDD-7b: highlightCode("\n") → 2，预期 1 → 🔴

### 绿灯（4 个，"not-broken" 回归 case）
- BDD-2/BDD-3/BDD-4/BDD-7b(单行)：输入无末尾换行，当前代码已正确对齐，不可能红灯
- 保留原因：role definition 强制"每条 BDD-NN 有对应测试用例"+"覆盖正常路径+边界"，这些是边界回归覆盖
- P4 实现后这些 case 仍绿（trim 对无末尾换行输入是 no-op），不引入回归

### gate 判定
- `check-tdd-red.sh`：failed=5, syntax_count=0, import_count=0 → **return 0（classic red-light，可推进）**
- 4 绿灯是 bug 不存在的 case 的回归测试，非"实现先于测试"违规

## 测试代码位置

`frontend-v3/src/composables/__tests__/useShiki.linenumber.spec.ts`

[PROD_NOT_TOUCHED]
