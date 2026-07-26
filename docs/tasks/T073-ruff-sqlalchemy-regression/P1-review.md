---
phase: P1
task_id: T073
type: review
parent: P1-requirements.md
trace_id: T073-P1-review-20260726-r2
status: approved
created: 2026-07-26
agent: requirements-review
---

## 上一轮问题逐项复查

### ISSUE-1: packages 声明遗漏受影响文件 → ✅ 已解决

修订版 packages 列表现在包含：
- backend/peekview/services/entry_service.py ✓
- backend/peekview/database.py ✓
- backend/tests/test_read_tracking.py ✓（新增，覆盖 ISSUE-4）

原遗漏的 2 个源文件 + 1 个测试文件均已补入。

### ISSUE-2: I3 隐含需求结论过早 → ✅ 已解决

I3 已从"需确认"更新为确认结论："fts_content 测试失败的根因已确认——`database.py:485` 和 `entry_service.py:96` 的 `not File.is_binary`（`.where()` 上下文）导致 FTS 索引只包含二进制文件或空内容，是 fts_content ~10 个测试失败的直接根因，非 admin/share 失败的级联效应"。结论明确，不再有待确认状态。

### ISSUE-3: BDD 缺少 entry_service/database 的验收条件 → ✅ 已解决

新增 BDD-12 和 BDD-13：
- BDD-12: entry 列表 API 对匿名用户只返回公开 entry（验证 `Entry.is_public` 在 `.where()` 中正确过滤）
- BDD-13: FTS 搜索能找到非二进制文件的内容（验证 `not File.is_binary` 修复后 FTS 聚合正确）

覆盖了 entry_service.py 和 database.py 的关键改动场景。

### ISSUE-4: 测试文件也有误改但未声明 → ✅ 已解决

I1 隐含需求已补充："测试文件也有同类误改：`test_read_tracking.py:365` 的 `not EntryRead.is_self_read`（`.where()` 上下文），会导致该测试本身行为异常（可能误报 PASS），修复范围应包含测试文件中的同类误改"。同时 `test_read_tracking.py` 已加入 packages 声明。

### MINOR-1: P7 裁剪理由需更新 → ✅ 已解决

P7 跳过理由已更新为"改动模式虽多样（is not None vs not Column vs 裸 Column）但每处独立可验证，无交叉依赖"。准确反映了实际改动模式。

### MINOR-2: BDD-9 Given 含实现细节 → ✅ 已解决

BDD-9 Given 已改为"修复后的代码中 SQLAlchemy Column 比较语法正确"，去除了 `.is_(None)`/`.isnot(None)`/`~` 等实现细节。

## BDD 评审

- BDD-1: PASS（可二值判定）+ 覆盖维度：数据✓ 前端✗ 多端✗ 边界✓ 兼容✓
- BDD-2: PASS（可二值判定）+ 覆盖维度：数据✓ 前端✗ 多端✗ 边界✓ 兼容✓
- BDD-3: PASS（可二值判定）+ 覆盖维度：数据✓ 前端✗ 多端✗ 边界✓ 兼容✓
- BDD-4: PASS（可二值判定）+ 覆盖维度：数据✓ 前端✗ 多端✗ 边界✓ 兼容✓
- BDD-5: PASS（可二值判定）+ 覆盖维度：数据✓ 前端✗ 多端✗ 边界✓ 兼容✓
- BDD-6: PASS（可二值判定）+ 覆盖维度：数据✓ 前端✗ 多端✗ 边界✓ 兼容✓
- BDD-7: PASS（可二值判定）+ 覆盖维度：数据✓ 前端✗ 多端✗ 边界✓ 兼容✓
- BDD-8: PASS（可二值判定）+ 覆盖维度：数据✓ 前端✗ 多端✗ 边界✓ 兼容✓
- BDD-9: PASS（可二值判定）+ 覆盖维度：数据✗ 前端✗ 多端✗ 边界✓ 兼容✓
- BDD-10: PASS（可二值判定）+ 覆盖维度：数据✗ 前端✗ 多端✗ 边界✓ 兼容✓
- BDD-11: PASS（可二值判定）+ 覆盖维度：数据✓ 前端✗ 多端✗ 边界✓ 兼容✓
- BDD-12: PASS（可二值判定）+ 覆盖维度：数据✓ 前端✗ 多端✗ 边界✓ 兼容✓
- BDD-13: PASS（可二值判定）+ 覆盖维度：数据✓ 前端✗ 多端✗ 边界✓ 兼容✓

BDD 编号格式 `#### BDD-NN:` 正确，1-13 连续不跳号。每条 BDD 均为单一 Given-When-Then 场景。所有 BDD 的 Then 子句均可明确判定 PASS/FAIL，无中间态。

## 隐含需求覆盖

- 数据维度：覆盖（I4 全量测试、I3 fts_content 根因确认结论）
- 前端维度：不涉及（纯后端修复，✗ 合理）
- 多端维度：不涉及（MCP/CLI 不受影响，✗ 合理）
- 边界维度：覆盖（I1 区分 SQLAlchemy vs Python 上下文含测试文件、`is None` 空表边界）
- 兼容维度：覆盖（修复恢复原始语义，不破坏现有行为）

## 裁剪评审

- 跳过 P7：理由"改动模式虽多样但每处独立可验证，无交叉依赖"——充分合理
- risk_level=high：合理（43 个测试失败 + 安全相关功能 + 回归风险）
- capability_requirements=[]：合理（纯 Python 修复，无特殊能力需求）

## P1 纯净性

- 所有 BDD 描述用户/系统行为，无实现细节混入
- I1~I4 描述问题空间，未涉及解决方案设计
- 纯净性 OK

## 总结

| 类别 | 数量 |
|------|------|
| 上一轮关键问题 | 4（全部已解决） |
| 上一轮次要问题 | 2（全部已解决） |
| 本轮新发现问题 | 0 |

**结论：approved** — 上一轮 4 关键 + 2 次要问题全部已解决。BDD-1~13 覆盖维度完整，隐含需求 I1~I4 结论明确，packages 声明完整，裁剪理由充分，P1 纯净性无问题。
