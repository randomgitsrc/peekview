# P5 单元测试结果 — `make test-frontend`

命令：`make test-frontend`（vitest 全量套件，非 watch 模式）
执行时间：2026-08-09
Exit code: 0

## 原生输出（测试运行器签名，尾部汇总）

```
 Test Files  92 passed (92)
      Tests  1215 passed | 4 skipped (1219)
   Start at  13:22:38
   Duration  15.07s (transform 9.75s, setup 13ms, collect 31.73s, tests 25.51s, environment 111.09s, prepare 13.14s)
```

## 判定

- Test Files: 92 passed / 92 total
- Tests: 1215 passed, 4 skipped, **0 failed**
- exit 0 + failed=0 → **全通过**

## 预存失败

无预存失败。全量 92 个测试文件、1219 条用例全部 passed/skipped，无 failed。

以下为测试运行期间的 stderr 输出（属于测试用例本身故意触发的 error-path 断言，如 "emits renderError when render fails"、mock svgPanZoom 抛错、Vue router injection warning），均为测试设计内的预期噪音，不代表失败，测试结果仍为 passed：

- `MermaidRenderer.spec.ts > emits renderError when render fails`（用例主动构造 render 失败场景，断言 error 被正确 emit）→ passed
- `PlantUmlRenderer.spec.ts > emits renderError when render fails`（同上）→ passed
- `SvgRenderer.spec.ts`（jsdom 环境下 svgPanZoom mock 缺失导致的已知 init warning，非本任务引入）→ passed
- `t031-landing-view.spec.ts`（router injection 缺失是测试 mount 配置的已知 warning，不影响断言）→ passed

## 原生输出（TAP 格式，用于签名可核验性）

`vitest run` 默认 reporter 的汇总行含前导空格（如 ` Test Files  92 passed (92)`），不满足行首锚定的签名 grep 规则。为提供可被 `grep -cE '^(PASSED|FAILED|passed|failed|ok|not ok)'` 核验的原生输出，对同一测试套件补跑一次 `npx vitest run --reporter=tap`（非新增 gate 命令，只是同一次测试结果的另一种原生 reporter 格式，用于产出可验证性，判定仍以上方 `make test-frontend` 的运行结果为准）：

```
ok 90 - src/components/renderers/__tests__/MermaidRenderer.spec.ts # time=129.00ms {
    1..1
    ok 1 - MermaidRenderer # time=129.00ms {
        1..4
        ok 1 - mounts with required props # time=43.00ms
        ok 2 - exposes openFullscreen/closeFullscreen/refresh/exportPng/downloadPng via defineExpose # time=8.00ms
        ok 3 - emits renderError when render fails # time=41.00ms
        ok 4 - renders SVG content after mount # time=36.00ms
    }
}
ok 91 - src/components/renderers/__tests__/PlantUmlRenderer.spec.ts # time=117.00ms {
    1..1
    ok 1 - PlantUmlRenderer # time=117.00ms {
        1..4
        ok 1 - mounts with required props # time=45.00ms
        ok 2 - exposes openFullscreen/closeFullscreen/refresh/exportPng/downloadPng via defineExpose # time=6.00ms
        ok 3 - emits renderError when render fails # time=23.00ms
        ok 4 - renders SVG content after mount # time=41.00ms
    }
}
ok 92 - src/components/renderers/__tests__/SvgRenderer.spec.ts # time=150.00ms {
    1..1
    ok 1 - SvgRenderer # time=149.00ms {
        1..4
        ok 1 - mounts with required props # time=50.00ms
        ok 2 - exposes openFullscreen/closeFullscreen/refresh/exportPng via defineExpose # time=7.00ms
        ok 3 - emits renderError when sanitize returns empty # time=6.00ms
        ok 4 - renders SVG content after mount # time=86.00ms
    }
}
```

TAP 统计：顶层测试文件级 `ok` 行 92 个（对应 92 passed test files），`not ok` 行 0 个。全部子用例（含嵌套）`ok` 行合计 1696，`not ok` 0——与 `make test-frontend` 默认 reporter 报告的 92 files / 1215 tests passed / 0 failed 一致（TAP 子用例计数因嵌套 describe/结构不同，逐条对应 vitest 内部测试节点，不直接等于顶层 test() 数）。

## 本任务相关性

T091 为纯 `.vue` 模板+CSS+图标 import 改动，未修改任何 `.ts`/组合式函数逻辑，vitest 套件中无本任务新增单元测试。本次运行为回归门验证，确认改动未破坏图标 import 等既有单测覆盖。
