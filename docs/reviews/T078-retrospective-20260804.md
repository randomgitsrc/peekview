# T078 read-tracking-hardening 复盘

> 2026-08-04 | v0.14.2 → v0.15.0 | agate v0.29.0

## 概况

| 维度 | 数据 |
|------|------|
| 任务 | 读取追踪强化：修探针 + 聚合表 + 新维度 + 来源分类 + 90 天清理 + 删 entry 保留统计 |
| 阶段 | P0-P8 完整走完，无裁剪 |
| BDD | 34 条（P1 首版 30 条 → review 后增补 4 条） |
| 测试 | 34 红灯 → 34 绿灯，全量 1042 passed 0 failed |
| 代码改动 | 10 个源文件，+363 -78 行 |
| 文档产出 | 32 个 agate 文件，5563 行 |
| review 轮次 | P1 needs-revision 1 轮 / P2 needs-revision 1 轮 / P4 approved 直接通过 |
| 版本 | v0.14.2 → v0.15.0（minor） |

## 做对了什么

### 1. 先审计再设计（P0 代码审计）

P0 阶段没有直接按原始 brief 开干，而是先做了完整代码审计，发现原始 brief 只关注"加聚合表 + 加维度"，但现有探针本身就有 5 个准确性问题。如果不先修探针，聚合表只会聚合错误数据——垃圾进垃圾出。

这个决策让任务范围从"加功能"变为"先修准再加功能"，避免了一个根本性错误。

### 2. 用户参与决策点

在 P0 之前与用户讨论了几个关键设计决策：
- 删 entry 时保留聚合统计（用户提出"存在即合理"）
- discover 数据保留还是删除
- 注意力/停留时间不做（后端天花板）
- MCP channel 追踪限制

这些决策在 P0-brief 里固化，避免到 P1/P2 才发现问题需要回退。

### 3. review 机制有效拦截

- P1 review 拦截了 BDD-19 二值歧义 + discover 不入聚合表缺失 + source 分类 BDD 缺失
- P2 review 拦截了 2 个 CRITICAL：迁移 DEFAULT 值与 BDD-19 矛盾 / restore merge PK 冲突

这两个 CRITICAL 如果到 P4/P5 才发现，修复成本会高得多。

### 4. TDD 红灯有效

P3 产出 34 个测试，5.66s 全红灯。失败模式清晰（15x ImportError / 4x TypeError / 4x ImportError / 4x 断言 / 3x ValueError / 4x 其他），无假红灯。implementer 按 TDD 驱动实现，34/34 变绿后全量 1042 passed 0 回归。

## 做错了什么

### 1. P0-brief 写了两次

原始 P0-brief（7-28）是肤浅的——只列了"加聚合表 + 加维度"，没有审计现有代码。8-3 代码审计后重写。如果 7-28 立项时就做审计，能省 6 天间隔期的认知重建成本。

**教训**：P0-brief 不应只翻译用户需求，必须包含代码审计。特别是"hardening"类任务，现有代码的现状是设计的前提。

### 2. edit 工具反复卡住

session 中多次 `edit` 工具超时卡住（active-tasks.md、P5 dispatch-context 等），导致任务中断。改用 `python3 -c` 写文件后才解决。根因未查明（可能是多字节字符 + 大文件匹配问题），但实际影响是浪费了多次工具调用周期。

**教训**：edit 卡住时立即换 python3，不纠结工具原因。后续可考虑所有大文件写入都用 python3。

### 3. check-tdd-red.sh 超时

P3 确认红灯时 `check-tdd-red.sh` 超时（内部跑 pytest 可能卡在 formatter 或环境检测）。改用直接 `pytest -q --tb=line` 手动验证，5.66s 完成。

**教训**：check-tdd-red.sh 在某些环境下可能卡住，主 Agent 可以手动跑 pytest 替代，gate 只检查文件存在性（v0.29.0 已分离）。

### 4. P6 格式问题

P6-acceptance.md 总结行 `- PASS：34` 和 `- FAIL：0` 被 gate 误判为 BDD 条目。provenance 也拦截了 dispatch-context 中的 `- PASS 有证据文件引用`（行首 `- PASS` 被匹配）。

**教训**：P6 文件中行首 `- PASS` / `- FAIL` 只用于 BDD 条目，总结行用其他格式（如 `**Summary**: 34/34 PASS`）。dispatch-context 中避免行首 `- PASS` / `- FAIL`。

### 5. backend subagent 类型两次 cancel

P4 派发时两次用 `subagent_type: "backend"` 都被 Task cancelled。改用 `subagent_type: "general"` 后成功。根因不明（可能是 backend agent 类型初始化问题）。

**教训**：subagent 类型 cancel 时立即换 general 类型。

## 流程效率

| 阶段 | subagent 轮次 | 人工介入 |
|------|-------------|---------|
| P0 | 0（主 Agent 亲自） | 用户参与 4 个决策点 |
| P1 | 2（analyst + review → revision → re-review） | 0 |
| P2 | 2（architect + review → revision → re-review） | 0 |
| P3 | 1（test-designer） | 0 |
| P4 | 2（implementer + review） | 0 |
| P5 | 1（verifier） | 0 |
| P6 | 1（verifier） | 0（格式问题主 Agent 自修） |
| P7 | 1（consistency-reviewer） | 0 |
| P8 | 1（releaser） | 主 Agent bump + commit |

P1-P8 共 12 次 subagent 派发。review 轮次合理（P1/P2 各 1 轮 revision），无 PAUSED。

## 改动清单

### 源码（10 文件，+363 -78）

| 文件 | 改动 |
|------|------|
| `models.py` | EntryReadStats model / EntryRead.source / ReadStatsResponse 扩展 / AdminStatsResponse.reads |
| `config.py` | PeekCleanup.reads_retention_days |
| `read_tracking_service.py` | window_key 加 action / record_read 加 source + 写时更新 / get_read_stats 改读聚合表 / backfill_stats |
| `_shared.py` | _detect_channel 提取 / _classify_source 新增 / _record_read_async 加 request |
| `entries.py` | share channel 修复 / _detect_channel 从 _shared 导入 |
| `files.py` | 三处 channel 统一走 _detect_channel |
| `database.py` | entry_reads.source 列迁移 |
| `main.py` | backfill_stats 调用 |
| `admin_service.py` | get_stats 加 reads / cleanup_expired 加 90 天清理 / restore merge 导入聚合表 |
| `test_read_tracking_hardening.py` | 34 测试（lint 修复） |

### 交付物

- peekview v0.15.0，tag v0.15.0
- CHANGELOG [0.15.0] 含 7 新增 / 5 修复 / 2 变更 / 1 已知限制
- 32 个 agate 文件（P0-P8 全链路产出）

## 待改进

| 改进项 | 来源 | 优先级 |
|--------|------|--------|
| P0-brief 必须含代码审计 | 本次教训 | 写入 agate P0 卡片建议 |
| edit 工具卡住时立即换 python3 | 本次教训 | 个人习惯 |
| P6 总结行避免行首 PASS/FAIL | 本次教训 | 写入 P6 格式规范 |
| check-tdd-red.sh 超时 | 本次环境问题 | agate 脚本优化 |
| backend subagent cancel | 本次环境问题 | 待观察 |
| MCP channel 追踪限制 | 设计限制 | 已记录 CHANGELOG |
| 生产升级 | 待人工执行 | `pipx upgrade peekview && sudo systemctl restart peekview` |
