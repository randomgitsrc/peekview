# P5 技术验证结果 — TPV0094 TreeView 默认展开优化

- phase: P5
- task_id: TPV0094-treeview-default-expand
- trace_id: TPV0094-P5-20260815
- agent: verifier
- 环境: debug :8888（隔离）/tmp/peekview-debug/，CDP :18800
- 状态标记: [PROD_NOT_TOUCHED]（未触碰 :8080 生产服务与 ~/.peekview/，无任何生产写入）
- 状态标记: [NO_NEED_CONFIRM]

## gate_commands.P5

命令源: `P2-design.md §5`

```yaml
gate_commands:
  P5: "make test-frontend && make typecheck"
  P5_e2e: "make debug-quick && E2E_SPEC=e2e/structured-data-viewer.spec.ts make debug-test"
```

## 命令 1: `make test-frontend`

- **exit code**: 2（首轮）→ 0（复跑 3 轮全绿）
- 输出摘要（首轮）:
  ```
  Test Files  2 failed | 90 passed (92)
       Tests  2 failed | 1230 passed | 4 skipped (1236)
  ```
- 输出摘要（复跑 3 轮，含 1 轮完整 make 链路）:
  ```
  Test Files  92 passed (92)
       Tests  1232 passed | 4 skipped (1236)
  ```
- 首轮失败 2 例（**pre-existing flaky，与本任务无关**，均非 TreeView 测试文件）:
  1. `TreeNodeItem.spec.ts > dir nodes > calls toggleDir on click` — spy 未被调用（Number of calls: 0）
  2. `TableView.per-page.spec.ts`（aria-expanded toBe('false')，行 115-116，Escape 关闭下拉后断言）
- **failed 数量**: 0（复跑）；首轮 2（flaky，已确认与本次改动无关）
- 首轮失败归类依据:
  - 两失败文件与 `TreeView.vue` / 默认展开逻辑零关联（分别测 TreeNodeItem 文件树与 TableView 分页下拉）
  - `TreeView.spec.ts` 独立 3 轮复跑 17/17 全绿
  - 全量复跑 3 轮全部 1232 passed
  - 首轮 stderr 已有同类环境噪音（path-map.test.ts 等 DOM 时序敏感用例）

## 命令 2: `make typecheck`

- **exit code**: 0
- 输出摘要:
  ```
  → Running vue-tsc type check (~30-60s)...
    ✓ type check passed
  ```

## 附录: 后端全量回归（建议项，P2 未声明）

- 命令: `make test-quick`
- **exit code**: 0
- 输出摘要:
  ```
  1078 passed, 3 skipped, 34 warnings in 42.10s
  ✓ Tests passed
  ```
- **failed 数量**: 0 → 纯前端改动零后端回归

## 预存失败

无新增失败与本任务相关。首轮 `make test-frontend` 的 2 例失败为 pre-existing flaky（隔离复跑全绿，文件与本次改动无关），按「预存失败」标注处理，不阻断。

## 签名（供主 Agent N5 校验）

```
passed 1232 (复跑: Test Files 92 passed (92), Tests 1232 passed | 4 skipped (1236))
failed 0 (复跑 3 轮全绿; 首轮 2 例 pre-existing flaky，见上方分析)
passed 1078 (后端: 1078 passed, 3 skipped, 34 warnings in 42.10s)
failed 0 (后端)
```

## 判定

- `make test-frontend`：复跑后 failed=0 ✓（首轮 2 例 pre-existing flaky，文件与改动无关）
- `make typecheck`：exit 0 ✓
- 后端回归：failed=0 ✓

EXIT_CODE: 0
