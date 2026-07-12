# T053 P3 派发上下文

> 主 Agent 派发前查证的客观信息。不含 PASS/FAIL 预判。

## P2 方案关键信息

- 方案 A（推荐）：catchall 内联实现
- 核心改动：main.py serve_spa_catchall 函数
- 新增函数：_prefers_json, _is_frontend_route, _slug_exists, _inject_link
- 提取共享函数：api/files.py resolve_entry_raw（从 get_entry_raw 提取）
- ui_affected: false（无 Playwright/E2E 用例需求）
- gate_commands.P5: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no"

## P1 BDD 条件（20 条，含 SCOPE+ 修正）

B1-B4: Content Negotiation 基本行为（JSON 优先/HTML 优先/*通配符/浏览器）
B5: text/html 存在时 HTML 胜出（SCOPE+ 修正，原预期 JSON）
B6-B7b: 私有 entry 认证行为（未认证 404/owner JSON/admin JSON）
B8-B9: 不存在 slug 行为（JSON 404/HTML SPA）
B10-B10b: <link> 注入（公开/私有 slug）
B11-B12: <link> 不注入（不存在 slug/前端路由）
B13-B13b: Link header（公开/私有 slug）
B14: Link header 不添加（不存在 slug）
B15: llms.txt 内容
B16-B17: 端到端场景

## 测试代码位置

- 后端测试目录：backend/tests/
- 现有测试文件：test_api.py, test_security.py, test_apikey.py 等
- conftest.py 提供 autouse 隔离 + factories.py 数据构建器
- 测试运行命令：cd backend && .venv/bin/python -m pytest tests/ -q --tb=no

## P2 files_to_read（测试设计需要参考的实现导航）

- backend/peekview/main.py:415-490（SPA catchall）
- backend/peekview/api/files.py:140-230（认证逻辑）
- backend/peekview/api/files.py:385-506（/raw 端点）
- backend/peekview/api/entries.py:68-128（share cookie + auth）
- backend/peekview/auth.py:137-196（get_current_user）
- backend/peekview/services/entry_service.py:313-344（get_entry 可见性）
- backend/peekview/models.py（Entry 模型）
- backend/peekview/exceptions.py:55-65（NotFoundError）

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P3

路径：agate/phase-cards/P3-tdd.md
---
# P3 — TDD 测试设计

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P3 + 有合规理由（risk≠high + 跳过风险已声明）→ 跳过，读 P4 卡片

## 如果是首次进入本阶段

1. 派发 test-designer subagent → 产出 P3-test-cases.md + 测试代码目录
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
- **exit 3**：无可用运行器

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

## 下游影响

- P4 用测试驱动实现（implementer 看测试理解预期行为）
- P5 跑同一套测试验证实现正确性（gate_commands.P5）

> 完成 → 读 phase-cards/P4-implementation.md
<!-- AGATE_CARD_END -->
