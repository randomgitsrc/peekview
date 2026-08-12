# P1 Dispatch Context — analyst

## 目标
为 T083（中文搜索与 Tag 过滤修复）建立需求基线：质疑需求完整性、识别隐含依赖、产出 BDD 验收条件。

## 约束
- P0-brief 已定义三个 bug + 修法（json_each / jieba 预分词 / 连字符→空格），P1 只定义"要解决什么"和"做完什么样算对"，不设计"怎么做"
- 不改数据库 schema（FTS5 表结构不变）
- 不改存储的 tag 值（只改 FTS 索引文本和查询方式）
- 不改 MCP server
- 不改前端
- jieba 作为新依赖加入 pyproject.toml
- 现有测试必须全绿
- 启动时需 rebuild FTS 索引（已有 backfill_fts_content 机制可复用）

## 上游关联
- P0-brief.md：三个 bug 的根因 + 修法 + 已知风险
- 调查阶段已完整复现 + 验证（python3 脚本 + SQLite 3.45.1）

## 输入文件
1. `docs/tasks/T083-cjk-search-fix/P0-brief.md` — 任务简报（四字段 + 三 bug 详情 + 约束 + 风险）
2. `backend/peekview/services/entry_service.py` — tag 过滤（L458-463 LIKE）+ FTS 写入（L85-115 _update_fts_content）+ FTS 查询（L466-486）
3. `backend/peekview/database.py` — FTS5 表定义（L248-306 setup_fts5）+ search_entries（L349-376）+ rebuild_fts_index（L379-428）+ backfill_fts_content（L492-528）
4. `backend/peekview/main.py` — lifespan 启动（L200-232 backfill_fts_content 调用点）
5. `backend/pyproject.toml` — dependencies（L25-42，需加 jieba）

## 客观查证信息
- SQLite 3.45.1（支持 json_each + contentless_delete FTS5）
- jieba 0.42.1 已在 venv 和系统 Python 安装
- FTS5 当前 tokenizer: unicode61（默认，不分词 CJK）
- tag 存储: SQLModel `Column(JSON)`，SQLAlchemy ensure_ascii=True 导致中文存为 `\uXXXX`
- FTS tags 字段写入: `" ".join(entry.tags or [])`（entry_service.py L112, database.py L412/L522）
- tag 过滤查询: `Entry.tags.cast(String).like(f'%"{tag}"%')`（entry_service.py L461-463）

## 门槛
- P1-requirements.md 含 BDD ≥1 条（Given/When/Then）
- domains / packages / risk_level / phases 已声明
- 无 [NEED_CONFIRM] 标记（或写 [NO_NEED_CONFIRM]）
- 无 status: GAP
- 隐含需求已主动识别（数据/前端/多端/边界/兼容 五维度）

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
