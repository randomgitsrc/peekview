# P5 unit test results — T087 代码块行号 off-by-one

## 汇总

passed: 1226
failed: 0
skipped: 1
test_files: 94 passed (94)
exit_code: 0

## 命令

```
cd frontend-v3 && ./node_modules/.bin/vitest run --reporter=dot 2>&1 | tail -30
```

## 结果

- **exit code**: 0
- **Test Files**: 94 passed (94)
- **Tests**: 1226 passed | 1 skipped (1227)
- **failed**: 0
- **Duration**: ~14.32s

## failed 清单

（无）

## 全量测试说明

运行了全量 vitest 套件（94 文件 / 1227 测试，含 T087 新增 `useShiki.linenumber.spec.ts` 9 测试 + 现有全部）。

T087 相关测试文件：
- `src/composables/__tests__/useShiki.linenumber.spec.ts` — 9 passed（BDD-1/2/3/4/5/6/7/7b 覆盖）
- `src/composables/__tests__/useShiki.spec.ts` — 现有测试无回归（P4 自查 18 passed | 1 skipped）

## 预存失败

无预存失败。全量 vitest 套件全绿。

## stderr 噪音（非失败）

- `svg-pan-zoom init failed: TypeError: svgPanZoom is not a function` — SvgRenderer.spec.ts 的 mock 噪音，测试本身通过（4 passed），与 T087 无关
- `[Vue warn]: injection "Symbol(router)" not found` — t031-landing-view.spec.ts 的 router mock 噪音，测试通过（1 passed），与 T087 无关

## N5 签名（test runner 输出）

```
Test Files  94 passed (94)
Tests  1226 passed | 1 skipped (1227)
```

[PROD_NOT_TOUCHED]
