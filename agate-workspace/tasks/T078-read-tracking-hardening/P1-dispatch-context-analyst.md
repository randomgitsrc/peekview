---
phase: P1
task_id: T078-read-tracking-hardening
type: dispatch-context
parent: P0-brief.md
trace_id: T078-P1-20260803
status: active
created: 2026-08-03
agent: orchestrator
---

# P1 派发指引 — analyst

## 目标

产出 P1-requirements.md：建立 T078 读取追踪强化的需求基线，含 BDD 验收条件。

## 约束

- P0-brief.md 的范围是强制约束，不超出
- 不设计解决方案（P2 的事），只定义"要解决什么"和"做完什么样算对"
- BDD 必须可二值判定（PASS/FAIL），不写主观形容词
- 后端任务，前端无改动

## 上游关联

P0-brief.md 定义了 4 个 phase：
1. 修探针准确性（window_key 加 action / share channel 统一 / discover 可查 / 测试修正）
2. 聚合表 + 新维度（entry_read_stats / by_action / by_source / unique_readers 写时更新 / 来源分类）
3. 迁移（entry_reads.source 列 + 回填）
4. 删除策略（删 entry 保留聚合统计）

## 输入文件

1. docs/tasks/T078-read-tracking-hardening/P0-brief.md — 任务简报（必读，主要输入）
2. backend/peekview/services/read_tracking_service.py — 现有实现（record_read / get_read_stats / get_read_events）
3. backend/peekview/api/_shared.py — _record_read_async 调用入口
4. backend/peekview/api/entries.py — 探针放置点（list_entries / get_entry / download_zip）
5. backend/peekview/api/files.py — 探针放置点（download_file / get_file_content / get_entry_raw）
6. backend/peekview/models.py — EntryRead / ReadStatsResponse / AdminStatsResponse model
7. backend/peekview/services/entry_service.py — _cleanup_reads（删 entry 时清理 reads）
8. backend/peekview/services/admin_service.py — cleanup_expired / get_stats / backup / restore
9. backend/peekview/database.py — _run_migrations（迁移模式参考）
10. backend/peekview/config.py — PeekCleanup（配置模式参考）
11. backend/tests/test_read_tracking.py — 现有测试（含测试名与断言矛盾点）

## 客观查证信息（主 Agent 已确认的事实）

### 探针放置点（9 个 action 调用点）

| # | 位置 | action | channel | 问题 |
|---|------|--------|---------|------|
| 1 | entries.py:172 list_entries | discover | _detect_channel | entry_id=None，无查询接口 |
| 2 | entries.py:225 get_entry（share token+公开） | read | 硬编码 "api" | BUG：应为 "share" |
| 3 | entries.py:252 get_entry（share token+私有） | read | "share" | OK |
| 4 | entries.py:275 get_entry（share cookie） | read | "share" | OK |
| 5 | entries.py:299 get_entry（正常） | read | _detect_channel | OK |
| 6 | entries.py:475 download_zip | download | _detect_channel | OK |
| 7 | files.py:190 download_file | download | 只看 header | share cookie 时记错 |
| 8 | files.py:235 get_file_content | read | 只看 header | share cookie 时记错 |
| 9 | files.py:434 get_entry_raw | raw | 只看 header | share cookie 时记错 |

### window_key bug

`read_tracking_service.py:47`：
```python
window_key = f"{eid_part}:{fingerprint}:{channel}:{window_ts}"
```
不含 action。同一分钟内同一人同一 channel 先 read 后 download → download 合并成 read 的 count+1。by_action 统计全错。

### 删除策略决策（用户已确认）

删 entry 时删原始 entry_reads（明细无法查看），**保留 entry_read_stats 聚合行**（汇总数字保留，证明"这里曾有流量"）。存在即合理。

### 不做的事项

- 注意力/停留时间/滚动深度（前端 heartbeat，另一个 task）
- 时间趋势图、第三方统计、热力图
- display_name null 修复（T074 已 hotfix）
- by_reader_type 维度（reader_type 已记录但当前不做统计维度）
- private/public 维度（是 entry 属性不是 read 事件属性）

## 关键质疑点（analyst 必须回答）

1. **window_key 加 action 后，旧数据的去重语义变化**：旧数据同一分钟内不同 action 被合并，新数据不合并。历史数据是否需要回溯修改 window_key？P0-brief 的判断是"不回溯"，analyst 确认是否合理。

2. **discover 数据**：P0-brief 决定"保留并加到 admin stats，不单独加查询接口"。analyst 确认这个决策是否需要 BDD 验证，还是只作为 admin stats 的一部分。

3. **total_count 语义**：现在 total_count 含 self_read，unique_readers 排除 self_read。测试名 `test_get_read_stats_total_count_excludes_self_reads` 与断言矛盾。analyst 明确 total_count 的预期语义（含还是排除 self_read）。

4. **get_file_content 的 action="read"**：与 entry 详情页 read 混在一起。P0-brief 决定不改。analyst 确认是否需要区分。

5. **90 天清理与聚合表的关系**：清理原始 entry_reads 后，get_read_events（明细列表）只能查 90 天内的，get_read_stats（聚合统计）是全量的。analyst 确认这个行为是否需要 BDD 明确。

6. **backup/restore**：backup 已是整库 SQLite backup（自动覆盖聚合表）。restore 需确认聚合表正确恢复。analyst 判断是否需要单独 BDD。

## 门槛

- P1-requirements.md 含 BDD ≥1 条（Given/When/Then）
- domains / packages / risk_level / phases 已声明
- 无 [NEED_CONFIRM] 或标 [NO_NEED_CONFIRM]
- capability_requirements 声明（本任务纯后端，无特殊能力需求）
- 裁剪说明：本任务 risk=medium + 5 子系统交叉，不可裁剪 P2/P3/P5/P6

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P1

路径：phase-cards/P1-requirements.md
---
# P1 — 需求基线

> 当前状态：[首次 / 重试 #N]
> P1 不可裁剪（核心阶段）

## 如果是首次进入本阶段

1. 派发 analyst subagent → 产出 P1-requirements.md
   1.1 写 P1-dispatch-context-analyst.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 主 Agent 确认：BDD 验收条件 ≥1 条 + 无未决 NEED_CONFIRM
2.5 派发 requirements-review subagent（角色文件：{agate_root}/assets/review-roles/requirements-review.md）
     2.5.1 写 P1-dispatch-context-requirements-review.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
    输入：P1-requirements.md
    产出：P1-review.md（agent≠main，含 BDD 编号引用 + 覆盖维度标注）
    review 不通过 → analyst 修改 → 再 review → … → approved（⑩迭代循环）
3. 预跑 check-gate.sh P1（exit 2，主 Agent 自判）
4. 更新 .state.yaml phase=P1 → P2
5. git add docs/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
6. git commit -m "wf({Txxx}-P1): {摘要}"

## 如果是重试

确认上一轮失败原因（BDD 不完整 / domains 声明错 / NEED_CONFIRM 未处理）
→ review 不通过时：analyst 修改需求 → 重派 requirements-review → 共享 retry 预算
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P1 MAX=3）

## 前置条件

- [ ] P0-brief.md 完成（四字段齐全）

## 派发

- **角色**：analyst（`{agate_root}/assets/execution-roles/analyst.md`）
- **输入**：P0-brief.md（env_constraints / known_risks / executor_env）
- **输出**：P1-requirements.md
- **派发 prompt 模板**：`{agate_root}/assets/templates/dispatch-prompt.md`

## 产出规格

P1-requirements.md 必须包含：
- BDD 验收条件（至少 1 条，Given/When/Then 格式）
- `domains:` 声明（backend / frontend / mcp / security）
- `packages:` 声明（受影响的包/模块）
- `risk_level:` 声明（low / medium / high）→ 决定 P2 评审强度
- `phases:` 裁剪声明（跳过哪些阶段 + 理由）
- `capability_requirements:` 能力需求声明（available / supplementable / GAP 三态）
- 无未决 `[NEED_CONFIRM]`（有则 PAUSED）；无待确认项时写 `[NO_NEED_CONFIRM]`

## gate 规则

check-gate.sh P1 → P1-review.md 存在 + status:approved + agent≠main + 含 BDD 编号锚点 → exit 2（BDD 编号格式为 `#### BDD-NN:`）；缺 P1-review.md / agent=main / 无锚点 → exit 1
P1 评审不可裁——所有任务都走独立 requirements-review，无例外

## 推进条件（全部满足才写 phase: P2）

- [ ] P1-requirements.md 含 BDD ≥1 条
- [ ] domains / packages / risk_level / phases 已声明
- [ ] 无 [NEED_CONFIRM] 标记
- [ ] 无 status: GAP（supplementable 不阻，GAP 阻）
- [ ] P1-review.md status: approved（agent≠main，含 BDD 编号锚点）

## 常见错误

1. **BDD 写成技术实现而非用户行为**：BDD 应该描述"用户能看到什么/系统应该做什么"，不是"调用哪个 API"
2. **domains 声明不全**：漏了某个受影响域 → P2 不派该域的评审 → 实现方向错误
3. **capability_requirements 漏声明**：P6 验收时才发现需要但不可用的能力 → 返工
4. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- P2 设计依赖 domains + risk_level 决定评审角色
- P6 验收逐条对照 P1 的 BDD（PASS/FAIL 总数必须 ≥ P1 BDD 总数）
- P7 一致性检查依赖 packages 声明做跨文件交叉核对

## 评审

P1 评审通用必有（所有任务都走 requirements-review），P2/P4 评审是 C8 域触发（见 review-mapping.md）——二者在"是否通用"上不对称，仅在"独立 subagent、agent≠main"上类比。P1 评审不可裁剪。
review 不通过 → analyst 修改需求 → 再 review（⑩迭代循环），直至 approved。

> 完成 → 读 phase-cards/P2-design.md
<!-- AGATE_CARD_END -->
