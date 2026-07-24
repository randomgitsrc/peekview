---
phase: P2
task_id: T070
task_name: mcp-docker-deployability
type: dispatch-context
role: architect
trace_id: T070-P2-20260725
created: 2026-07-25
---

# P2 派发指引 — architect

## 目标

将 P1 需求基线（24 条 BDD）转化为可实现的技术方案。产出 P2-design.md。

## 约束

- 改动范围仅 `packages/mcp-server/`（代码+README）、根 `README.md`、`backend/README.md`
- 不改 PeekView 后端/前端代码
- MCP server 当前版本 0.9.3
- P1 声明 design_trivial/follows_existing_pattern 可简化为 1 个候选方案
- CWD guard bug follows_existing_pattern（现有 guard 逻辑清晰，修复方向明确）
- 诊断增强为新增功能需设计（config list 增强、config verify 增强、/health 增强）
- 文档修正量大但无设计复杂度

## 上游关联

- P0-brief.md：环境约束 + 已知风险
- P1-requirements.md：24 条 BDD + 9 项调整后问题清单 + domains/packages/risk_level

## 输入文件（必读）

1. `docs/tasks/T070-mcp-docker-deployability/P1-requirements.md` — 需求基线（24 条 BDD）
2. `docs/tasks/T070-mcp-docker-deployability/P0-brief.md` — 环境约束
3. `packages/mcp-server/src/tools/publishFiles.ts` — CWD guard bug（L338-346）
4. `packages/mcp-server/src/config/merge.ts` — allowed_paths 解析（L78-83）
5. `packages/mcp-server/src/server.ts` — /health 端点（L231-266）
6. `packages/mcp-server/src/cli/config.ts` — config list/verify 命令
7. `packages/mcp-server/src/config/file.ts` — YAML 配置文件加载
8. `packages/mcp-server/README.md` — 文档修正目标
9. `README.md`（根目录）— Docker 场景指引 + OpenCode/Cursor 示例
10. `backend/README.md` — Docker 场景指引

## 关键设计决策点

1. **CWD guard 修复策略**：当前 L338-346 在 cwd=/ 时无条件拒绝。修复方案是在 guard 检查中加入 allowedPaths.length > 0 的判断——但需确认：trust_all_paths=true 时是否也应跳过 cwd guard？（BDD-5 要求 trust_all_paths=true + cwd=/ 时正常工作）

2. **allowed_paths 容错策略**：merge.ts L82 假设数组，YAML 字符串会崩溃。修复位置：merge.ts 的 mergeConfig 函数中，对 fileConfig.server.allowed_paths 做类型检查，字符串则 split(':')。

3. **config list 增强**：当前只读文件配置。需改为调用 mergeConfig 获取最终生效值，并显示 cwd。但 config list 是 CLI 命令（不启动 server），如何获取运行时 cwd？直接 process.cwd() 即可。

4. **config verify 增强**：增加 allowed_paths 文件可读性测试。对每个 allowed_path 执行 fs.access(path, fs.constants.R_OK)。

5. **/health 增强**：在现有响应中增加 cwd、mode、allowed_paths 字段。需区分 local/remote 模式（BDD-17）。

6. **文档修正**：以 mcp-server/README.md 为主，其他引用。Docker Compose 示例改用 node:20-alpine + npm install -g。

## P2 简化声明

- CWD guard bug: `follows_existing_pattern: [packages/mcp-server/src/tools/publishFiles.ts]` — 修复方向明确，现有 guard 逻辑清晰
- allowed_paths 容错: `design_trivial: true` — 标准防御性编程
- 诊断增强: 需设计但范围明确，1 个候选方案即可
- 文档修正: 无设计复杂度

## AGATE_CARD

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P2

路径：phase-cards/P2-design.md
---
# P2 — 方案设计

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → P2 不可裁剪。design_trivial / follows_existing_pattern 可简化（1 个候选方案），不可省略。

## 如果是首次进入本阶段

1. 派发 architect subagent → 产出 P2-design.md
   1.1 写 P2-dispatch-context-architect.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 按 C8 映射表派评审（见下方）
3. 评审通过 → P2-review.md status: approved
4. 预跑 check-gate.sh P2（脚本化检查）
5. 更新 .state.yaml phase=P2 → P3

## 如果是重试

确认上一轮失败原因（方案选择有误 / 候选方案不足 / 评审 rejected）
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P2 MAX=3）

## 前置条件

- [ ] P1-requirements.md 含 domains / risk_level / phases 声明
- [ ] P0-brief.md env_constraints 可查阅

## 派发

- **角色**：architect（`{agate_root}/assets/execution-roles/architect.md`）
- **输入**：P1-requirements.md + P0-brief.md
- **输出**：P2-design.md
- **派发 prompt 追加**：

```
## P2 最小验证（若方案依赖浏览器行为/安全模型/外部系统行为）
方案设计前，先用最小验证确认关键假设（10 行 HTML 测试页 / curl 请求 / 20 行脚本）。
验证结果写入 P2-design.md 的 minimal_validation 字段。纯代码逻辑不需要最小验证。
```

## 产出规格

P2-design.md 必须包含：
- **候选方案 ≥2** + 权衡 + 选择理由（design_trivial / follows_existing_pattern 时可只写 1 个，见下方）
- **四字段**：`packages:` `domains:` `ui_affected:` `gate_commands:`
- **files_to_read**：实现时需要参考的文件清单（控制 P4 implementer 上下文）
- **env_constraints**：确认/细化 P0-brief 的环境约束
- **minimal_validation**（若方案依赖外部行为）

候选方案简化：
- `design_trivial: true` → 可只写 1 个候选方案（P2 仍不可省略）
- `follows_existing_pattern: [src/foo.py]` → 可只写 1 个候选方案，参照已有模式（P2 仍不可省略）

## gate_commands 声明

gate_commands 在 P2 固化，后续阶段按此执行：

```yaml
gate_commands:
  P5: "pytest -q --tb=no"       # 紧凑输出模式
  P5_e2e: "playwright test --reporter=line tests/e2e/"  # ui_affected: true 时必填
```

## 评审派发（C8 机械映射）

按 P1 声明的 domains + risk_level 机械映射评审：

| domain | risk_level | 必须派的评审 |
|--------|------------|------------|
| frontend | 任意 | plan-design-review |
| 任意 | high | plan-eng-review（硬规则，必须派独立 subagent） |
| 业务方向不明 | 任意 | plan-ceo-review / office-hours |

多个评审角色 `专家组并行` → 组长汇总 → P2-review.md（status: approved / rejected）。
详见 `agate/rules/review-mapping.md`。

**并行派发**（多个评审角色时）：
1. 同时派发所有触发的评审 subagent（每个一个 task 调用）
2. 每个评审 subagent 各写一个 dispatch-context + 各自产出文件（示例非穷举，按 C8 映射表触发）：
   - plan-eng-review → P2-review-eng.md
   - plan-design-review → P2-review-design.md
   - plan-ceo-review → P2-review-ceo.md
   - cso → P2-review-cso.md
3. 所有评审返回后，派发组长汇总 subagent（角色：review + 指定为「专家组组长」）
4. 组长输入：所有评审文件路径
5. 组长产出：P2-review.md（统一 status: approved / rejected）。**组长 subagent 产出的 P2-review.md 的 Header agent 字段必须是组长角色名（非 main）——check-gate.sh P2 硬拦截 agent=main 的 approved**
6. 组长规则：
   - 不发表新意见，只汇总
   - 任何专家标 BLOCKER → status: rejected
   - 多位专家分歧 → 标「专家组分歧」交人工
   - 全票无 BLOCKER → status: approved

**单评审角色时**：直接派发，无需组长汇总，产出直接写 P2-review.md。

review 不通过 → architect 修改方案 → 再 review → … → approved（⑩迭代循环，review 和 gate 重试共享 retry 预算）

## gate 规则

```bash
check-gate.sh P2 $TASK_DIR
```

- 候选方案数 ≥2（design_trivial / follows_existing_pattern 时可只写 1 个）
- P2-review.md status: approved（文件存在时检查）
- 四字段齐全（packages/domains/ui_affected/gate_commands）
- 候选方案 ≥2 时含权衡/选择理由

## 推进条件

- [ ] P2-design.md 候选方案 ≥2（或 design_trivial/follows_existing_pattern 可只写 1 个）+ 四字段齐全
- [ ] P2-review.md status: approved（P2 未被裁剪时）
- [ ] gate_commands.P5_e2e 已声明（ui_affected: true 时）

## 常见错误

1. **忘了最小验证**：方案依赖外部系统行为（API MIME 类型、浏览器 CSP 等）但直接假设前提成立 → 到 P6 才发现不可行。跑一个 curl / 10 行 HTML 就能 5 分钟发现
2. **gate_commands.P5 只列单元测试**：UI 任务时缺少 P5_e2e → P5 不会跑端到端验证
3. **files_to_read 列太多文件**：把所有相关文件都列上 → P4 implementer 上下文爆炸。只列确实需要参考的
4. **忘了派评审**：按 C8 映射机械执行，不靠"觉得不需要"
5. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- P4 依赖 files_to_read 导航代码阅读范围
- P5 依赖 gate_commands 执行验证命令
- P6 依赖 ui_affected 判断是否需要 vision-helper
- gate_commands 在 P2 固化后 P4-P6 不能改——设计阶段是声明验证契约的唯一窗口

> 完成 → 读 phase-cards/P3-tdd.md
<!-- AGATE_CARD_END -->

## 产出路径

`docs/tasks/T070-mcp-docker-deployability/P2-design.md`
