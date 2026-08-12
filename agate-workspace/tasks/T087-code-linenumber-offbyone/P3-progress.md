## P3 进度（test-designer）

### 已读输入
- [x] P3-dispatch-context-test-designer.md（BDD→测试映射 10 条 + P2 §6 指引 + mock hoisting 反模式）
- [x] test-designer.md 角色定义
- [x] P0-brief.md（环境约束 + 根因）

### 关键约束（dispatch-context）
- BDD-1~7 vitest 单测；BDD-8/9/10 走现有 viewer.spec.ts E2E（P5 跑）
- 关键断言：.line-number count == .line count（三联对齐核心）
- mock hoisting：vi.mock() 回调只用字符串字面量
- gate_commands.P3 = `cd frontend-v3 && ./node_modules/.bin/vitest run`，formatter = vitest.sh
- TDD 红灯：B 类（assertion 失败）= 正确；A 类（SyntaxError）须修；绿了违反 TDD


### 已读输入（续）
- [x] P1-requirements.md（10 BDD 验收条件）
- [x] P2-design.md（方案 A：调用方共享 trim + §6 单测指引）

### P2 §6 关键指引
- renderLineNumbers 未 export，推荐 (b) 通过 highlight/highlightCode 间接测（mock codeToHtml，断言 .line-number count == .line count）
- 关键断言：.line-number count == .line count（三联对齐）
- 6 个边界 case 已列

### BDD 映射确认
- BDD-1~7：vitest 单测（mock codeToHtml）
- BDD-8/9/10：现有 viewer.spec.ts E2E 回归（P5_e2e 跑）

### 已读输入（续）
- [x] useShiki.ts（被测代码）
  - renderLineNumbers (150-154)：未 export，内部函数
  - highlight (177-192)：调用 codeToHtml(code) + renderLineNumbers(code)
  - highlightCode (194-209)：同结构，与 highlight 完全对称
  - useShiki() 返回 { isReady, loadError, getHighlighter, highlight, highlightCode }
- [x] 现有 useShiki.spec.ts：只测 ensureLanguage + LANG_IMPORT_MAP，未测 highlight/highlightCode
  - 已有 mockHighlighter 模式可参照
  - 注意 useShiki() 内 getHighlighter 会真实 createHighlighter → 必须 mock 'shiki' 模块
- [x] viewer.spec.ts E2E：TC-002 测 .code-body .line count，TC-003 测 wrap toggle，确认现有覆盖 BDD-8/9/10

### 测试设计决策
- renderLineNumbers 未 export → 走方案 (b)：通过 highlight/highlightCode 间接测，mock codeToHtml 返回固定 .line 数
- mock 策略：vi.mock('shiki') 阻断 createHighlighter 真实调用，factory 返回 { createHighlighter: vi.fn(() => Promise.resolve(fakeHighlighter)) }
- fakeHighlighter：{ getLoadedLanguages: () => ['python'], codeToHtml: vi.fn((code) => `<pre class="shiki"><code>${code.split('\\n').map(l=>`<span class="line">${l}</span>`).join('')}</code></pre>`) }
- 关键：mock 的 codeToHtml 必须模拟真实 Shiki 行为（不 trim 末尾换行，split('\\n') 产生尾部空行），这样 P4 实现前测试红、P4 trim 后绿

### 测试代码已写
- 文件：frontend-v3/src/composables/__tests__/useShiki.linenumber.spec.ts
- 9 个测试用例（覆盖 BDD-1~7，BDD-7b 额外回归）

### 红灯验证（vitest run）
- 9 tests: 5 failed | 4 passed
- 5 红灯（B 类 assertion failure，证明 bug）：
  - BDD-1 highlight("a\nb\n") → expected 2, received 3
  - BDD-5 highlight("\n") → expected 1, received 2
  - BDD-6 highlight("a\n\n") → expected 3, received 2 (lineNumbers 先断言)
  - BDD-7 highlightCode("a\nb\n") → expected 3, received 2
  - BDD-7b highlightCode("\n") → expected 2, received 1
- 4 通过（"not-broken" 回归 case，bug 不在此情况）：
  - BDD-2 highlight("a\nb") → 2==2（无末尾换行，无 bug）
  - BDD-3 highlight("a") → 1==1（单行无换行，无 bug）
  - BDD-4 highlight("") → 1==1（空文件，无 bug）
  - BDD-7b highlightCode("a") → 1==1（单行，无 bug）

### gate 判定
- check-tdd-red.sh: failed=5, syntax_count=0, import_count=0 → return 0（classic red-light，可推进）
- 4 通过测试是 "not-broken" 回归覆盖，bug 仅存在于末尾换行 case，这些 case 不可能红灯
- 保留它们以满足"每条 BDD-NN 有对应测试"要求（role definition 强制）

### 全量 vitest 回归确认
- 94 test files: 1 failed (新文件，红灯) | 93 passed
- 1227 tests: 5 failed (BDD 红灯) | 1221 passed | 1 skipped
- 现有 useShiki.spec.ts 不受影响（18 passed | 1 skipped）—— vi.mock 作用域限单文件，不泄漏

### 自检结论
- ✅ 5 真红灯（B 类 assertion failure，证明 bug 存在）
- ✅ 0 A 类错误（无 SyntaxError / 无 import 失败）
- ✅ 现有测试无回归（93 文件全绿）
- ✅ BDD-1~7 全覆盖（vitest 单测），BDD-8/9/10 走现有 viewer.spec.ts（P5_e2e）
- ✅ 三联对齐断言（.line-number count == .line count == 逻辑行数）
- ✅ mock hoisting 规避（vi.mock 回调只用字符串字面量）
- ✅ renderLineNumbers 未改签名（走方案 b 间接测）
- ✅ 未触实现代码（useShiki.ts 未改）
- ✅ 未触生产 [PROD_NOT_TOUCHED]

### 产出文件
1. docs/tasks/T087-code-linenumber-offbyone/P3-test-cases.md
2. frontend-v3/src/composables/__tests__/useShiki.linenumber.spec.ts

P3 完成。
