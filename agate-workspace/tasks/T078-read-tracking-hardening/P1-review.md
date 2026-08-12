---
phase: P1
task_id: T078-read-tracking-hardening
type: review
parent: P1-requirements.md
trace_id: T078-P1-20260803
status: approved
created: 2026-08-03
agent: requirements-review
---

## 复审说明

本轮为 P1 第二轮 review。上轮提出 4 项 needs-revision，analyst 已修复。本轮验证修复到位 + 原有 approved BDD 未被破坏 + 新增 BDD 可二值判定。

## 上轮 4 项修复验证

### 1. BDD-19 二值歧义已消除 — ✅ 通过

BDD-19（P1-requirements.md:253-256）Then 明确写 "默认值为 NULL（历史记录 source 为 NULL，回填时由 BDD-17 覆盖设为 "unknown"）"。默认值 NULL 是明确的可二值判定条件：迁移后 `PRAGMA table_info(entry_reads)` 查 source 列的 dflt_value 为 NULL → PASS，否则 FAIL。歧义已消除。

### 2. BDD-22 When 补全 — ✅ 通过

BDD-22（P1-requirements.md:270-273）When 现为 "cleanup_expired 执行（reads_retention_days=90）后调用 get_read_events(entry_id=X)"。补全了触发条件（cleanup_expired 执行）和后续操作（调用 get_read_events），可二值判定。

### 3. BDD-31（discover 不入聚合表）— ✅ 通过

BDD-31（P1-requirements.md:168-171）Given/When/Then 完整：discover 事件 entry_id=None → entry_read_stats 不新增行。可二值判定：`SELECT COUNT(*) FROM entry_read_stats` 在 discover 事件前后不变 → PASS。

### 4. BDD-32/33/34（source 分类 search/social/other）— ✅ 通过

- BDD-32（:197-200）：搜索引擎 Referer → source="search"。Given 含具体示例（https://www.google.com/），可二值判定。
- BDD-33（:202-205）：社交平台 Referer → source="social"。Given 含具体示例（https://twitter.com/），可二值判定。
- BDD-34（:207-210）：其他 Referer → source="other"。Given 含具体示例（https://example.com/）且排除条件明确（不匹配搜索引擎/社交平台/非同域名），可二值判定。

## BDD 评审（全量 34 条）

### 格式与连续性

- BDD 编号 BDD-01 至 BDD-34，连续不跳号（grep 验证 34 条全在）
- 每条 BDD 恰好 1 Given / 1 When / 1 Then（脚本验证 34/34 通过）
- 标准格式 `#### BDD-NN:`

### 逐条可二值判定

#### 探针准确性 — window_key

- BDD-01: ✅ PASS（entry_reads 有 2 条记录 count=1）/ FAIL（否则）。覆盖维度：数据✓ 边界✓
- BDD-02: ✅ PASS（1 条记录 count=3）/ FAIL（否则）。覆盖维度：数据✓ 边界✓

#### 探针准确性 — share channel

- BDD-03: ✅ PASS（channel=="share"）/ FAIL（否则）。覆盖维度：多端✓ 安全✓
- BDD-04: ✅ PASS（channel=="share"）/ FAIL（否则）。覆盖维度：多端✓ 安全✓
- BDD-05: ✅ PASS（channel=="share"）/ FAIL（否则）。覆盖维度：多端✓ 安全✓
- BDD-06: ✅ PASS（channel=="share"）/ FAIL（否则）。覆盖维度：多端✓ 安全✓

#### 探针准确性 — discover

- BDD-07: ✅ PASS（reads.by_action 含 "discover" 且值>0）/ FAIL（否则）。覆盖维度：数据✓ 多端✓
- BDD-31: ✅ PASS（entry_read_stats 行数不变）/ FAIL（否则）。覆盖维度：数据✓ 边界✓

#### 统计维度 — by_action

- BDD-08: ✅ PASS（by_action 含三个键且值一致）/ FAIL（否则）。覆盖维度：数据✓ 多端✓

#### 统计维度 — by_source

- BDD-09: ✅ PASS（by_source 含至少一个分类键）/ FAIL（否则）。覆盖维度：数据✓
- BDD-10: ✅ PASS（source=="direct"）/ FAIL（否则）。覆盖维度：数据✓ 边界✓
- BDD-11: ✅ PASS（source=="internal"）/ FAIL（否则）。覆盖维度：数据✓ 边界✓
- BDD-32: ✅ PASS（source=="search"）/ FAIL（否则）。覆盖维度：数据✓ 边界✓
- BDD-33: ✅ PASS（source=="social"）/ FAIL（否则）。覆盖维度：数据✓ 边界✓
- BDD-34: ✅ PASS（source=="other"）/ FAIL（否则）。覆盖维度：数据✓ 边界✓

#### 聚合表 — 写时更新

- BDD-12: ✅ PASS（total_reads+1, by_action.read+1, by_channel.api+1）/ FAIL（否则）。覆盖维度：数据✓
- BDD-13: ✅ PASS（unique_readers 不变）/ FAIL（否则）。覆盖维度：数据✓ 边界✓
- BDD-14: ✅ PASS（unique_readers+1, fingerprints 追加）/ FAIL（否则）。覆盖维度：数据✓ 边界✓
- BDD-15: ✅ PASS（unique_readers 不增加）/ FAIL（否则）。覆盖维度：数据✓ 边界✓
- BDD-16: ✅ PASS（返回值与聚合表一致）/ FAIL（否则）。覆盖维度：数据✓ 多端✓

#### 聚合表 — 回填

- BDD-17: ✅ PASS（每个 entry 有聚合行，source=="unknown"）/ FAIL（否则）。覆盖维度：数据✓ 兼容✓
- BDD-18: ✅ PASS（数据不变）/ FAIL（否则）。覆盖维度：数据✓ 边界✓

#### 迁移 — source 列

- BDD-19: ✅ PASS（source 列存在，默认 NULL）/ FAIL（否则）。覆盖维度：数据✓ 兼容✓

#### 90 天清理

- BDD-20: ✅ PASS（91 天前记录被删除）/ FAIL（否则）。覆盖维度：数据✓ 边界✓
- BDD-21: ✅ PASS（聚合表值不变）/ FAIL（否则）。覆盖维度：数据✓ 边界✓
- BDD-22: ✅ PASS（items 只含 10 天前记录）/ FAIL（否则）。覆盖维度：数据✓ 边界✓
- BDD-23: ✅ PASS（31 天前记录被删除）/ FAIL（否则）。覆盖维度：数据✓ config✓

#### 删除策略

- BDD-24: ✅ PASS（entry_reads 记录被删除）/ FAIL（否则）。覆盖维度：数据✓
- BDD-25: ✅ PASS（entry_read_stats 聚合行仍存在）/ FAIL（否则）。覆盖维度：数据✓ 兼容✓

#### Admin stats

- BDD-26: ✅ PASS（reads 字段含 total/today/by_action/by_channel/by_source）/ FAIL（否则）。覆盖维度：数据✓ 多端✓
- BDD-27: ✅ PASS（reads.total 包含已删 entry 流量）/ FAIL（否则）。覆盖维度：数据✓ 兼容✓

#### Backup/Restore

- BDD-28: ✅ PASS（restore merge 后 entry_read_stats 有数据）/ FAIL（否则）。覆盖维度：数据✓ 兼容✓
- BDD-29: ✅ PASS（restore replace 后 entry_read_stats 有数据）/ FAIL（否则）。覆盖维度：数据✓ 兼容✓

#### 测试修正

- BDD-30: ✅ PASS（total_count==4, unique_readers 排除 self_read）/ FAIL（否则）。覆盖维度：数据✓

## 隐含需求覆盖

### 数据维度
- **覆盖**：IR-1（source 列 migration）、IR-2（聚合表 create_all）、IR-3（启动回填）、IR-4（source 归 unknown）、IR-5（reader_fingerprints 拼接）、IR-10（discover 不入聚合表）、IR-11（写时更新 fingerprint 检查）、IR-12（unique_readers 排除 self_read）、IR-13（清理后明细 vs 聚合）、IR-14（清理在聚合之后）、IR-15（retention_days 默认 90）、IR-16（>500 人性能已知风险）
- 无遗漏

### 前端维度
- **覆盖**：IR-6（前端无改动，P0-brief 明确）。ReadStatsResponse 新增字段对前端可选，不影响现有展示。
- 无遗漏

### 多端维度
- **覆盖**：IR-7（MCP 无需同步，X-PeekView-Source header 已识别）、IR-8（CLI 无需同步，admin CLI 走 admin API）
- 无遗漏

### 边界维度
- **覆盖**：IR-9（window_key 旧数据不回溯）、IR-10（entry_id=None 边界）、IR-13（90 天边界）、IR-14（清理时序）、IR-16（>500 人性能边界）
- 无遗漏

### 兼容维度
- **覆盖**：IR-9（旧 window_key 格式不冲突）、IR-17（backup 整库覆盖）、IR-18（restore merge 需导入聚合表）、IR-19（restore replace 整库替换）、IR-20（_cleanup_reads 只删原始表）
- 无遗漏

### 测试维度
- **覆盖**：IR-21（测试名矛盾修正）、IR-22（share cookie channel 测试）、IR-23（聚合表/回填/清理/删除策略测试）
- 无遗漏

## 裁剪评审

- risk_level: medium — 与 P0-brief 一致（5 子系统交叉 + schema 变更 + 机制交叉），合理
- phases: [P1, P2, P3, P4, P5, P6, P7, P8] — 全走，无裁剪
- 不可裁剪理由逐条：
  - P2 不可裁：新表 schema + 写时更新策略 + 迁移回填 + source 分类逻辑，方案设计直接影响正确性 — 合理
  - P3 不可裁：risk=medium + schema 变更 + 写时更新，现有测试有矛盾需先修 — 合理
  - P5 不可裁：5 子系统交叉需全量测试 — 合理
  - P6 不可裁：34 条 BDD 需逐条实跑 — 合理
  - P7 不可裁：12 文件改动需跨文件核对 — 合理
  - P8 不可裁：schema 变更需版本/CHANGELOG 双路径 — 合理
- capability_requirements: [] — 纯后端无外部依赖，合理

## P1 纯净性

- BDD section（## 4. BDD）无 SQLModel/CREATE TABLE/ALTER TABLE/Session()/func.sum/asyncio.create_task/GROUP_CONCAT/COUNT(DISTINCT) 等实现细节（脚本验证全 CLEAN）
- IR section 提及 GROUP_CONCAT/COUNT(DISTINCT) 是在"为什么必须"解释中，说明数据维度需求而非规定实现方式 — 可接受
- Q&A section（## 3）回答了 6 个关键质疑点，引用现有代码行为佐证，未规定实现方案 — 可接受

## dispatch-context 审查重点逐项

| # | 审查重点 | 结论 |
|---|---------|------|
| 1 | BDD 覆盖所有 4 个 phase | ✅ Phase1:BDD-01~07,30,31 / Phase2:BDD-08~16 / Phase3:BDD-17~19 / Phase4:BDD-20~29 |
| 2 | BDD 可二值判定 | ✅ 34/34 全可判定（逐条验证） |
| 3 | window_key 旧数据不回溯在 BDD 中体现 | ✅ IR-9 + Q1 明确决策；BDD-17 回填按现有 window_key 聚合（不回溯修改） |
| 4 | 90 天清理后聚合表不受影响有 BDD | ✅ BDD-21 |
| 5 | 删 entry 保留聚合统计有 BDD | ✅ BDD-25 + BDD-27 |
| 6 | discover 加到 admin stats 有 BDD | ✅ BDD-07 |
| 7 | domains 包含 backend | ✅ domains: backend/api/security/database/config |
| 8 | 裁剪合理（risk=medium 不可裁 P2/P3/P5/P6） | ✅ 全阶段保留，无裁剪 |

## 结论

**status: approved**

- 34 条 BDD 全部可二值判定，编号连续（BDD-01~34），每条 1G/1W/1T
- 上轮 4 项 needs-revision 全部修复到位
- 隐含需求覆盖：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓ 测试✓，无遗漏
- 裁剪合理：risk=medium，全阶段保留
- P1 纯净：BDD section 无实现细节混入
- domains/packages/risk_level/phases/capability_requirements 声明完整
- 无 [NEED_CONFIRM] 残留
