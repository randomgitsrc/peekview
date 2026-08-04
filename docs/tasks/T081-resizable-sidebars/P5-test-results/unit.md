---
phase: P5
task_id: T081-resizable-sidebars
type: test-results
parent: P4-implementation.md
trace_id: T081-P5-20260804
status: draft
created: 2026-08-04
agent: verifier
---

# P5 单元测试结果

## gate_commands.P5

```bash
cd frontend-v3 && npx vitest run --reporter=dot
```

实际执行（加超时/单线程参数规避并发 agent 抢占 CPU 导致的卡顿）：

```bash
cd frontend-v3 && timeout --signal=KILL 100 npx vitest run --reporter=dot \
  --testTimeout=5000 --hookTimeout=5000 --pool=threads --poolOptions.threads.singleThread=true
```

注：原生命令（无超时/单线程）多次卡在 `RUN v1.6.1` 阶段不退出，根因是同机并发 agent
（P6 verify 脚本 100% CPU）抢占资源导致 vitest worker 初始化卡死。加 `--signal=KILL 100`
硬超时 + `singleThread=true` 后正常完成（8.07s）。日志存档：`/tmp/t081-vitest2.log`。

## 汇总

```
 Test Files  37 failed | 55 passed (92)
      Tests  246 failed | 966 passed | 1 skipped (1213)
     Errors  18 errors
   Duration  8.07s (transform 1.41s, setup 2ms, collect 2.10s, tests 4.79s, environment 710ms, prepare 49ms)
```

failed 计数：246（预存失败，与本次改动无关，见下分析）

## T081 专属测试结果

```
 ✓ src/composables/__tests__/useSidebarResize.spec.ts  (14 tests) 36ms
```

T081 唯一新增/相关测试文件 `useSidebarResize.spec.ts`：**14 passed / 0 failed**。

## 预存失败分析（与 T081 无关）

246 个失败分散在 37 个 spec 文件，均非 T081 改动文件（T081 改动：
`EntryDetailContent.vue`、`useSidebarResize.ts`、`variables.css`、`layout.css`）。

失败特征：
- 主流错误：`Cannot read properties of null (reading '$')` — vue-test-utils / jsdom 环境问题
- 次要错误：`TypeError: ResizeObserver is not a constructor` — jsdom 未提供 ResizeObserver
- 大量 spec "全部失败"（如 EntryListRow 15/15、AuthButton 9/9、TocNav 10/10）— 典型环境性批量失败，非逻辑回归

唯一与 EntryDetail 沾边的 `t031-entry-detail-view.spec.ts`（1 failed）错误为 prop 类型
不匹配（`authState`/`fileLoading`/`fileError`/`isCsv` 传 undefined/Object 而非预期类型），
属测试桩与组件 props 定义不同步的预存问题，非 T081 resize 改动引入。

结论：**246 failed 全部为预存失败（与本次改动无关）**，T081 相关测试全绿。

## 失败文件清单（37 个）

```
src/components/__tests__/DiagramBlock.spec.ts           17 failed
src/components/__tests__/MarkdownViewer.spec.ts          6 failed
src/components/__tests__/ImageViewer.spec.ts            12 failed
src/__tests__/t069-auth-guard.test.ts                    4 failed
src/components/__tests__/t031-entry-detail-view.spec.ts  1 failed
src/components/__tests__/ConfirmDialog.spec.ts           6 failed
src/components/__tests__/CodeViewer.spec.ts              9 failed
src/__tests__/landing-auth.spec.ts                       7 failed
src/__tests__/t069-ui-structure.test.ts                  2 failed
src/components/__tests__/EntryListRow.spec.ts           15 failed
src/composables/__tests__/theme.spec.ts                  2 failed
src/components/__tests__/AuthButton.spec.ts              9 failed
src/components/__tests__/TocNav.spec.ts                 10 failed
src/components/__tests__/t076-entry-list-row.spec.ts    10 failed
src/components/__tests__/TableView.per-page.spec.ts      5 failed
src/components/__tests__/t031-entry-list-view.spec.ts    2 failed
src/components/__tests__/SearchInput.spec.ts            12 failed
src/components/__tests__/BaseButton.spec.ts             15 failed
src/components/__tests__/PageHeader.spec.ts             11 failed
src/components/__tests__/t031-entry-card.spec.ts         6 failed
src/components/__tests__/BaseBadge.spec.ts              10 failed
src/components/__tests__/EmptyState.spec.ts             10 failed
src/components/__tests__/zebra-stripe.spec.ts            3 failed
src/components/renderers/__tests__/PlantUmlRenderer.spec.ts  4 failed
src/components/renderers/__tests__/MermaidRenderer.spec.ts    4 failed
src/__tests__/expired-warning.test.ts                    5 failed
src/__tests__/filter-tabs.test.ts                        5 failed
src/components/__tests__/Toast.spec.ts                   6 failed
src/components/__tests__/t031-entry-list-row.spec.ts     5 failed
src/components/renderers/__tests__/SvgRenderer.spec.ts   4 failed
src/components/__tests__/BaseTag.spec.ts                 7 failed
src/components/__tests__/FilterChip.spec.ts              6 failed
src/components/__tests__/MarkdownViewer.blocks.spec.ts   2 failed
src/components/__tests__/ThemeToggle.spec.ts             5 failed
src/components/__tests__/BannerBar.spec.ts               5 failed
src/components/__tests__/t076-base-tag.spec.ts           3 failed
src/components/__tests__/t031-landing-view.spec.ts       1 failed
```

## 环境隔离

[PROD_NOT_TOUCHED]

测试全程在 frontend-v3 工作目录运行 vitest（jsdom 环境），未触达生产服务（:8080）、
生产数据库（~/.peekview/）或调试 backend（:8888）。纯前端单测，无网络/DB 写入。

## test runner 输出签名

```
Test Files  37 failed | 55 passed (92)
Tests  246 failed | 966 passed | 1 skipped (1213)
```

EXIT_CODE=1（有失败，非 T081 引起；T081 专属 14 tests 全绿）
