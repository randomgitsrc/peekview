# P6 断言记录 — vitest 单测（BDD-3/4/8/10）

来源：P5-test-results/unit.md（vitest run --reporter=dot, exit 0）
测试文件：frontend-v3/src/composables/__tests__/useShiki.linenumber.spec.ts

## 全量结果

Test Files  94 passed (94)
Tests       1226 passed | 1 skipped (1227)
failed      0
exit_code   0

## T087 相关断言（useShiki.linenumber.spec.ts, 9 passed）

### BDD-3: 单行无换行 highlight("a") → 1+1
```
expect(lineNumbers).toBe(1)   // .line-number count
expect(lines).toBe(1)         // .line count
expect(lineNumbers).toBe(lines)
```
结果: PASS（trim 后 "a" → split ["a"] → 1 行号 + 1 .line）

### BDD-4: 空文件纯函数层 highlight("") → 1+1（组件层短路）
```
expect(lineNumbers).toBe(1)
expect(lines).toBe(1)
expect(lineNumbers).toBe(lines)
```
结果: PASS（"" → split [""] → 1+1 对齐；CodeViewer.vue doHighlight 在 !props.content 时短路，此路径不触发渲染）

### BDD-8: Markdown 多代码块不回归（全量 vitest）
useMarkdown 相关测试包含在全量 1226 passed 中，无 failed。
useShiki.linenumber.spec.ts BDD-7/7b（highlightCode 路径）2 passed。
结果: PASS（无回归）

### BDD-10: 源码视图切换走 CodeViewer → highlight() 路径
BDD-10 与 BDD-1 同代码路径（highlight()），BDD-1 单测断言 2+2 已覆盖。
源码视图切换在 CodeViewer.vue 中复用同一 highlightedCode 计算属性，无独立渲染分支。
结果: PASS（路径等价于 BDD-1）

## console 签名（test runner）

```
Test Files  94 passed (94)
Tests       1226 passed | 1 skipped (1227)
```
