# P5 单元测试结果 — `make test-frontend`（重跑 #2，P4 重试 #1 后的新代码）

命令：`make test-frontend`（vitest 全量套件，非 watch 模式）
执行时间：2026-08-09
Exit code: 0
前置：跑此命令前已执行 `make build-frontend`，确认 `EntryMetaTagsBar.vue` 的 `overflow-x:visible; white-space:normal` 修复已落地到 `backend/peekview/static/assets/*.css`（grep 命中 `zsh-DLFQ99l2.css`）

**本轮与上一轮 P5 的区别**：本次运行覆盖的是 P4 重试 #1 之后的新代码（P6 退回后定向修复 `EntryMetaTagsBar.vue` scoped 规则），非旧结果复用。

## 原生输出（测试运行器签名，尾部汇总）

```
 Test Files  92 passed (92)
      Tests  1215 passed | 4 skipped (1219)
   Start at  18:10:33
   Duration  14.86s (transform 8.73s, setup 8ms, collect 30.51s, tests 25.45s, environment 109.11s, prepare 13.26s)
```

## 判定

- Test Files: 92 passed / 92 total
- Tests: 1215 passed, 4 skipped, **0 failed**
- exit 0 + failed=0 → **全通过**

## 预存失败

无预存失败。全量 92 个测试文件、1219 条用例全部 passed/skipped，无 failed。

以下为测试运行期间的 stderr 输出（属于测试用例本身故意触发的 error-path 断言，如 "emits renderError when render fails"、mock svgPanZoom 抛错、Vue router injection warning），均为测试设计内的预期噪音，不代表失败，测试结果仍为 passed：

- `MermaidRenderer.spec.ts > emits renderError when render fails`（用例主动构造 render 失败场景，断言 error 被正确 emit）→ passed
- `SvgRenderer.spec.ts`（jsdom 环境下 svgPanZoom mock 缺失导致的已知 init warning，非本任务引入）→ passed
- `t031-landing-view.spec.ts`（router injection 缺失是测试 mount 配置的已知 warning，不影响断言）→ passed

## 原生输出（TAP 格式，用于签名可核验性）

`vitest run` 默认 reporter 的汇总行含前导空格（如 ` Test Files  92 passed (92)`），不满足行首锚定的签名 grep 规则。为提供可被 `grep -cE '^(PASSED|FAILED|passed|failed|ok|not ok)'` 核验的原生输出，对同一测试套件补跑一次 `npx vitest run --reporter=tap`（非新增 gate 命令，只是同一次测试结果的另一种原生 reporter 格式，用于产出可验证性，判定仍以上方 `make test-frontend` 的运行结果为准）：

```
ok 90 - src/components/renderers/__tests__/MermaidRenderer.spec.ts # time=113.00ms {
    1..1
    ok 1 - MermaidRenderer # time=112.00ms {
        1..4
        ok 1 - mounts with required props # time=46.00ms
        ok 2 - exposes openFullscreen/closeFullscreen/refresh/exportPng/downloadPng via defineExpose # time=7.00ms
        ok 3 - emits renderError when render fails # time=20.00ms
        ok 4 - renders SVG content after mount # time=37.00ms
    }
}
ok 91 - src/components/renderers/__tests__/PlantUmlRenderer.spec.ts # time=127.00ms {
    1..1
    ok 1 - PlantUmlRenderer # time=126.00ms {
        1..4
        ok 1 - mounts with required props # time=51.00ms
        ok 2 - exposes openFullscreen/closeFullscreen/refresh/exportPng/downloadPng via defineExpose # time=6.00ms
        ok 3 - emits renderError when render fails # time=26.00ms
        ok 4 - renders SVG content after mount # time=42.00ms
    }
}
ok 92 - src/components/renderers/__tests__/SvgRenderer.spec.ts # time=139.00ms {
    1..1
    ok 1 - SvgRenderer # time=139.00ms {
        1..4
        ok 1 - mounts with required props # time=40.00ms
        ok 2 - exposes openFullscreen/closeFullscreen/refresh/exportPng via defineExpose # time=8.00ms
        ok 3 - emits renderError when sanitize returns empty # time=6.00ms
        ok 4 - renders SVG content after mount # time=85.00ms
    }
}
```

TAP 统计：顶层测试文件级 `ok` 行 92 个（对应 92 passed test files），`not ok` 行 0 个（`grep -c "^ok " ` → 92，`grep -c "not ok"` → 0）。与 `make test-frontend` 默认 reporter 报告的 92 files / 1215 tests passed / 0 failed 一致。

## 本任务相关性

本轮 P4 重试 #1 只改动了 `frontend-v3/src/components/EntryMetaTagsBar.vue` 的 scoped CSS（新增 `overflow-x:visible; white-space:normal` 两条声明，覆盖 `layout.css` 遗留全局规则），未修改任何 `.ts`/组合式函数逻辑，vitest 套件中无本任务新增单元测试、也无该组件的专属单测文件。本次运行为回归门验证，确认本轮修复未破坏既有单测覆盖，1215/1215 passed（非 skip）与上一轮结果一致，无回归。
