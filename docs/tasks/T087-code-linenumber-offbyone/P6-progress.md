# P6 verifier progress — T087-code-linenumber-offbyone

[PROD_NOT_TOUCHED]

## 阶段输入确认

- P1-requirements.md: 10 BDD 已读 (BDD-1..BDD-10)
- P5-test-results/unit.md: vitest 1226 passed | 1 skipped, failed=0
- P5-test-results/e2e.md: T087 专用 spec 6 passed (TC-001..TC-006 覆盖 BDD-1/2/5/6/7/9)
- P5 evidence: 6 张截图 md5 互不相同，均 >1KB
- P4-implementation.md: trim 逻辑在 highlight() + highlightCode() 调用方，renderLineNumbers 未改
- known-failures.md: viewer.spec.ts 预存失败（路由不匹配，与 T087 无关）

## BDD 逐条验收

- BDD-1: PASS — 复用 P5 TC-001 截图 + E2E PASS (def hello():\n...\n → .line=3 .line-number=3)。trim 后 3 行对齐，无尾部空行号。
- BDD-2: PASS — 复用 P5 TC-002 截图 + E2E PASS (无末尾换行 → .line=3 .line-number=3)。
- BDD-3: PASS — 复用 vitest useShiki.linenumber.spec.ts BDD-3 单测 PASS (highlight("a") → 1+1)。
- BDD-4: PASS — 复用 vitest BDD-4 单测 PASS (highlight("") → 1+1 纯函数层对齐；CodeViewer 组件层 !props.content 短路)。
- BDD-5: PASS — 复用 P5 TC-003 截图 + E2E PASS ("\n" → .line=1 .line-number=1)。
- BDD-6: PASS — 复用 P5 TC-004 截图 + E2E PASS ("a\n\n" → .line=2 .line-number=2，中间空行保留)。
- BDD-7: PASS — 复用 P5 TC-005 截图 + E2E PASS (Markdown 代码块 → .line=2 .line-number=2)。
- BDD-8: PASS — 复用 vitest 全量 1226 passed (含 useMarkdown 测试，无回归)。
- BDD-9: PASS — 复用 P5 TC-006 截图 + E2E PASS (wrap 模式 → .line=3 .line-number=3)。
- BDD-10: PASS — 源码视图切换走 CodeViewer 路径，与 BDD-1 同代码路径 (highlight())，复用 BDD-1 证据 + E2E spec 覆盖 CodeViewer 路径。

## vision 分析

6 张截图派 vision-engine 分析中。
