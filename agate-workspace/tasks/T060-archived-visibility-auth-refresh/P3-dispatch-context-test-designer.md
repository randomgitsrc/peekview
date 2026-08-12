> **所有 P1-P8 阶段统一强制本文件存在**——commit 前暂存区必须含至少一个当前阶段的 dispatch-context 文件。该文件是 subagent 的核心信息源，禁止包含 PASS/FAIL 预判——否则被 `check-p6-provenance.sh` 审计失败。

---
phase: P3
generated_by: agate-inject-card.sh + 主 Agent
task_id: T060
role: test-designer
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标
产出 P3-test-cases.md + 测试代码目录：为 18 条 BDD 设计测试用例，写测试代码（TDD 红灯），测试必须因实现未写而失败。

### 约束
- P3 不可裁剪（P0-brief 明确声明，权限模型变更需 TDD）
- 后端测试用 pytest（backend/.venv/bin/python -m pytest），放在 backend/tests/ 下
- 前端测试用 vitest（frontend-v3/src/__tests__/ 或类似位置），E2E 用 Playwright
- MCP 测试用 vitest（packages/mcp-server/src/__tests__/）
- 测试必须因实现未写而失败（真红灯 = assertion failure，非 import/syntax error）
- ui_affected: true → 必须含 Playwright/E2E 用例
- 现有测试需更新：test_owner_list_includes_archived_entries 和 test_owner_list_total_includes_archived（断言需反转）
- gate_commands.P5: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no"
- gate_commands.P5_e2e: "cd frontend-v3 && npx playwright test e2e/ --reporter=line"
- debug 环境：make debug（:8888, /tmp/peekview-debug/），严禁触碰生产 :8080

### 上游关联
- P1-requirements.md：18 条 BDD（A1-A7,A1b-A3b,B1-B2,C1-C2,D1-D2,M1-M3）
- P2-design.md：方案 A（后端默认排除 + 前端统一重载），§5 现有测试影响评估
- P2-design.md §2.8-2.11：新增设计（序列号去重、clearOnError、a11y、焦点管理）

### 输入文件
- docs/tasks/T060-archived-visibility-auth-refresh/P1-requirements.md（BDD 验收条件）
- docs/tasks/T060-archived-visibility-auth-refresh/P2-design.md（方案设计 + files_to_read）
- backend/peekview/services/entry_service.py（当前 list_entries 逻辑）
- backend/peekview/api/entries.py（当前 list endpoint）
- backend/tests/test_entry_lifecycle.py（现有测试，行 672-724 需更新）
- frontend-v3/src/stores/entry.ts（loadEntries 当前实现）
- frontend-v3/src/stores/auth.ts（auth store 当前实现）
- packages/mcp-server/src/tools/listEntries.ts（MCP tool 当前 schema）
- AGENTS.md（项目铁律）
</dispatch_guide>

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P3

路径：agate/phase-cards/P3-tdd.md
---
# P3 — TDD 测试设计

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P3 + 有合规理由（risk=low + 跳过风险已声明）→ 跳过，读 P4 卡片

## 如果是首次进入本阶段

1. 派发 test-designer subagent → 产出 P3-test-cases.md + 测试代码目录
   1.1 写 P3-dispatch-context-test-designer.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 主 Agent 跑 check-tdd-red.sh 确认红灯
3. git commit
4. 更新 .state.yaml phase=P3 → P4

## 如果是重试

确认上一轮失败原因（测试设计不合理 / 未覆盖关键 BDD / 非真红灯）
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P3 MAX=2）

## 前置条件

- [ ] P2-design.md files_to_read 完整（测试设计需要知道实现导航）
- [ ] P2-review.md status: approved（P2 未被裁剪时）

## 派发

- **角色**：test-designer（`{agate_root}/assets/execution-roles/test-designer.md`）
- **输入**：P2-design.md + P1-requirements.md（BDD 验收条件）
- **输出**：P3-test-cases.md + test_code_dir/
- **派发 prompt**：`{agate_root}/assets/templates/dispatch-prompt.md`

## 产出规格

- P3-test-cases.md 必须声明 `test_code_dir: {路径}`
- 每条测试用例对应一条 P1 的 BDD 验收条件
- UI 任务（P2 ui_affected: true）：必须含 Playwright/E2E 用例

## gate 规则（check-tdd-red.sh）

```bash
check-tdd-red.sh $TASK_DIR
```

- **exit 0**：真红灯（assertion 失败 / 项目内 import 失败 = B类错误）— 测试正确但因实现未写而失败
- **exit 1**：假红灯（SyntaxError / 第三方 import 失败 = A类错误）— 测试代码自身错误
- **exit 2**：绿了 — 实现先于测试，违反 TDD
- **exit 3**：无可用测试运行器

## 推进条件

- [ ] check-tdd-red.sh exit 0（真红灯确认）
- [ ] P3-test-cases.md 存在且含 test_code_dir
- [ ] 测试代码目录存在
- [ ] UI 任务：Playwright/E2E 用例存在

## 常见错误

1. **测试绿了才 commit**：测试已在 P4 之前通过 → 违反 TDD"测试先于实现"原则。P3 的 gate 要求红灯
2. **忘记声明 test_code_dir**：后续阶段找不到测试代码 → P5 跑 gate_commands 时找不到测试路径
3. **测试覆盖不全**：只为部分 BDD 写了测试 → P6 验收时那些 BDD 没有自动化验证
4. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。
5. **只覆盖交互路径，忽略前置状态**：测试设计应覆盖 BDD Given 隐含的前置状态，不只覆盖 When/Then 路径（详见 WORKFLOW.md §P3 测试设计指导）

## 下游影响

- P4 用测试驱动实现（implementer 看测试理解预期行为）
- P5 跑同一套测试验证实现正确性（gate_commands.P5）

> 完成 → 读 phase-cards/P4-implementation.md
<!-- AGATE_CARD_END -->

<objective_info>
- 环境状态：debug backend :8888 可用，pytest/vitest 可用
- 关键标识：18 条 BDD 编号，backend tests/, frontend-v3 e2e/, mcp-server tests/
- 查证结果：
  - 现有测试 test_owner_list_includes_archived_entries (line 672) 断言 own archived 在默认列表
  - 现有测试 test_owner_list_total_includes_archived (line 701) 断言 total 含 archived
  - 前端无现有 auth 刷新测试
  - MCP 无现有 status 参数测试
</objective_info>

> 注：该文件禁止包含 PASS/FAIL 预判——否则被 `check-p6-provenance.sh` 审计失败。
