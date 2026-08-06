## P4 步骤 1-3 完成：输入读取
- 已读 P4-dispatch-context-implementer.md（改动清单精确到行号 + 不改什么 + P3 测试预期）
- 已读 implementer.md 角色定义（最小实现原则 + SCOPE_GAP/DESIGN_GAP/CLARIFY 标记规则）
- 已读 P0-brief.md（env_constraints：vitest 单测不依赖后端，严禁 :8080）
- 已读 P2-design.md（方案 A：调用方共享 trim，renderLineNumbers 不改）
- 已读 P3-test-cases.md（9 测试：5 红 4 绿）
- 已读 useShiki.ts:145-214（renderLineNumbers 150-154 + highlight 177-192 + highlightCode 194-209）
- 已读 useShiki.linenumber.spec.ts（mock shiki，fakeHighlighter.codeToHtml 不 trim 末尾换行，模拟真实 Shiki）

改动清单确认（dispatch-context 行号与实际代码一致）：
- highlight() line 185 前加 trim，line 185/190 用 trimmedCode
- highlightCode() line 202 前加 trim，line 202/207 用 trimmedCode
- renderLineNumbers() line 150-154 不改

[PROD_NOT_TOUCHED]

## P4 步骤 4 完成：实现方案 A
- highlight() line 185 加 `const trimmedCode = code.replace(/\n$/, '')`，line 186/191 用 trimmedCode
- highlightCode() line 203 加 `const trimmedCode = code.replace(/\n$/, '')`，line 204/209 用 trimmedCode
- renderLineNumbers() line 150-154 未改（按 P2 方案 A + dispatch-context "不改什么"）

## P4 步骤 5 完成：自查测试
TDD 红灯基线（实现前）：5 failed | 4 passed（与 P3 预期一致）
自查（实现后）useShiki.linenumber.spec.ts：9 passed（5 红转绿 + 4 绿保持）
回归 useShiki.spec.ts：18 passed | 1 skipped（无回归）

## P4 步骤 6 完成：P4-implementation.md 已写
路径：docs/tasks/T087-code-linenumber-offbyone/P4-implementation.md
implementation_dir: frontend-v3/src/composables

## P4 步骤 7 完成：自检
- 代码改动符合方案 A：highlight + highlightCode 加共享 trim，trimmedCode 同时喂 codeToHtml + renderLineNumbers ✅
- renderLineNumbers 未改 ✅
- 自查测试 9 全绿 ✅
- 现有 useShiki.spec.ts 无回归 ✅
- 无 SCOPE_GAP / DESIGN_GAP / SCOPE+ / CLARIFY

[PROD_NOT_TOUCHED]
