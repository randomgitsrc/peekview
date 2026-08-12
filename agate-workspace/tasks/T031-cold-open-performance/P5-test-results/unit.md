---
phase: P5
task_id: T031-cold-open-performance
type: test-results
parent: P4-implementation.md
trace_id: T031-P5-20260722
status: draft
created: 2026-07-22
agent: main
---

# P5 技术验证 — 单元测试

## gate_commands.P5: make test-frontend

```
Test Files  69 passed (69)
     Tests  950 passed | 1 skipped (951)
  Duration  10.73s
```

failed: 0

## gate_commands.P5_typecheck: make typecheck

```
vue-tsc --noEmit: 无输出（exit 0）
```

failed: 0

## 预存失败

无。全量 69 个测试文件全部通过。

## 旧测试修复说明

T031 改动 EntryCard/EntryListRow 的 DOM 结构（div→<a>，username router-link→span），导致 3 个旧测试断言旧行为失败：
- EntryListRow.spec.ts: Enter/Space 键 navigate 事件（<a> 原生处理 Enter，Space 对链接无效）
- expired-warning.test.ts: username 是 router-link（改为 span role="link"）
- filter-tabs.test.ts: 同上

已更新旧测试匹配新行为，全量通过。

EXIT_CODE: 0
