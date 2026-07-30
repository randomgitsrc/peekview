# P5+P6 Dispatch Context — verifier

## 目标
P5: 执行 gate_commands.P5（make test-frontend），确认 1125 passed 零回归。
P6: 逐条实跑 17 条 BDD，产出 P6-acceptance.md + P6-evidence/。

## 约束
- P5: make test-frontend exit 0 + failed=0
- P6: 17 条 BDD 逐条对照，只允许 PASS/FAIL
- UI 任务需截图证据（但查询类 BDD 可用断言日志）
- 无 PROD_TOUCHED

## 上游关联
- P1-requirements.md：17 条 BDD
- P5-test-results：make test-frontend 输出

## 输入文件
1. `docs/tasks/T079-interaction-consistency/P1-requirements.md` — BDD 定义
2. `frontend-v3/src/components/__tests__/AuthButton.spec.ts` — BDD-1~6 测试
3. `frontend-v3/src/components/__tests__/UserMenu.spec.ts` — BDD-7~12+17 测试
4. `frontend-v3/src/components/__tests__/T079-entry-detail-header.spec.ts` — BDD-13~16 测试

## 客观查证信息
- P4 自查：1125 passed + 1 skipped
- 47 新增测试覆盖 BDD-1~17
- typecheck 通过

## 验证方式
通过 pytest 跑 3 个测试文件，输出作为证据。BDD-1~17 对应测试用例。

## 执行命令
```
cd /home/kity/oclab/peekview/frontend-v3 && npx vitest run src/components/__tests__/AuthButton.spec.ts src/components/__tests__/UserMenu.spec.ts src/components/__tests__/T079-entry-detail-header.spec.ts 2>&1 | tee /home/kity/oclab/peekview/docs/tasks/T079-interaction-consistency/P6-evidence/test-output.log
```

## 门槛
- P5-test-results/unit.md 含 test runner 输出
- P6-acceptance.md 含 17 条 BDD 验收结果
- P6-evidence/ 非空

<!-- AGATE_CARD_START -->
<!-- AGATE_CARD_END -->