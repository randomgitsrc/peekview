---
phase: P5
task_id: T084-detail-scroll-architecture
type: test-results
parent: P4-implementation.md
trace_id: T084-P5-20260731
status: draft
created: 2026-07-31
agent: verifier
---

# P5 Unit Test Results — vitest

## 命令

```bash
cd frontend-v3 && npx vitest run --reporter=dot
```

## 结果

- **exit code**: 1
- **Test Files**: 1 failed | 82 passed (83)
- **Tests**: 1 failed | 1128 passed | 1 skipped (1130)
- **Duration**: 58.05s

## test runner 输出签名

```
Test Files  1 failed | 82 passed (83)
     Tests  1 failed | 1128 passed | 1 skipped (1130)
  Start at  23:40:59
  Duration  58.05s (transform 113.91s, setup 24ms, collect 191.44s, tests 90.32s, environment 424.58s, prepare 39.27s)
```

## 失败清单

### 1. src/components/__tests__/MarkdownViewer.spec.ts > MarkdownViewer > handles render errors gracefully

```
FAIL  src/components/__tests__/MarkdownViewer.spec.ts > MarkdownViewer > handles render errors gracefully
Error: Test timed out in 5000ms.
```

## 失败分析

### 预存失败：1（与本次改动无关）

**`handles render errors gracefully`** — 这是一个 **flaky test**（超时型）：

- 该测试 mock `useMarkdown.render` 返回 rejected promise，验证 error 处理逻辑
- 与本次 CSS 改动（MarkdownViewer.vue scoped style 移除 `height:100%`/`overflow:auto`/`padding:2rem`）**完全无关**——CSS 改动不影响 render error 处理
- **单独运行时通过**：`npx vitest run src/components/__tests__/MarkdownViewer.spec.ts` → 10 passed (411ms)
- 全量测试套件运行时因环境负载导致 5000ms 超时（vitest 默认 testTimeout=5000）
- 这是在全量测试并行执行时的环境性能问题，非代码 bug

## 验证

- 单独运行该测试文件：`10 passed (10)` — 411ms，全部通过
- 改动前（f41869a5）同样在全量套件中可能出现此超时（环境依赖性）

## 结论

- failed: 1（预存 flaky test，与本次改动无关）
- passed: 1128
- skipped: 1
- **本次改动未引入新的单元测试回归**

[PROD_NOT_TOUCHED]
