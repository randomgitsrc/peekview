---
phase: P1
task_id: T070
task_name: mcp-docker-deployability
type: dispatch-context
role: analyst
trace_id: T070-P1-20260725
created: 2026-07-25
---

# P1 派发指引 — analyst

## 目标

建立 T070 的需求基线：质疑 P0-brief 中的 11 项问题清单，识别隐含需求，产出 BDD 验收条件。

## 约束

- 改动范围仅 `packages/mcp-server/`（代码+README）、根 `README.md`、`backend/README.md`
- 不改 PeekView 后端/前端代码
- MCP server 当前版本 0.9.3
- P0-brief 中问题 5（无健康检查端点）可能已过时——server.ts L231-266 已有 `GET /health`，需验证是否满足 Docker HEALTHCHECK 需求
- P0-brief 中问题 4（无诊断命令）需区分：`config list` 已存在（cli/config.ts L140-205），`config verify` 也已存在（L423-510）。需评估是否需要新增 `config show`（显示运行时生效配置含 cwd/mode/allowed_paths）和 `config check`（测试文件访问），还是现有命令已足够

## 上游关联

- P0-brief.md：11 项问题清单 + 验证标准 + 裁剪倾向
- 实测验证 + 网友B 部署反馈（原始需求来源）

## 输入文件（必读）

1. `docs/tasks/T070-mcp-docker-deployability/P0-brief.md` — 任务简报
2. `packages/mcp-server/src/tools/publishFiles.ts` — CWD guard bug 所在（L338-346），核心修复目标
3. `packages/mcp-server/src/server.ts` — 已有 /health 端点（L231-266），需评估
4. `packages/mcp-server/src/cli/config.ts` — 已有 config list/verify 命令，需评估是否足够
5. `packages/mcp-server/src/config/merge.ts` — allowed_paths 解析逻辑（L78-83），容错问题所在
6. `packages/mcp-server/README.md` — 文档错误所在（namespace 语义、allowed_paths 格式、Docker 示例）
7. `packages/mcp-server/Dockerfile` — 当前 Docker 构建配置
8. `README.md`（根目录）— 缺 Docker 场景指引

## 关键发现（主 Agent 预读，供 analyst 验证）

1. **CWD guard bug 确认**：publishFiles.ts L338-346，`path.resolve(cwd) === path.parse(cwd).root` 时直接返回错误，不检查 allowedPaths 是否已配置
2. **/health 端点已存在**：server.ts L231-266，返回 status/version/peekview/config 信息。Dockerfile L21-22 的 HEALTHCHECK 已使用 `wget http://localhost:33333/health`
3. **config list 已存在**：cli/config.ts L140-205，显示文件配置。但**不显示运行时 cwd**，也不显示 env 覆盖后的最终生效值
4. **config verify 已存在**：cli/config.ts L423-510，验证连通性+认证。但**不测试 allowed_paths 内文件可读性**
5. **allowed_paths 解析**：merge.ts L78-83，env 用冒号分隔 split，file 用数组。file.ts 的 YAML 解析会自动处理数组格式。但 CLI `config set server.allowed_paths '/a:/b'` 用冒号分隔（L83-84），YAML 文件里如果手写冒号分隔字符串会出 `.map is not a function`

## analyst 须质疑的点

1. P0-brief 问题 5（无健康检查端点）是否应降级或移除？/health 已存在且 Dockerfile 已使用
2. P0-brief 问题 4（无诊断命令）中 `config show` 和 `config check` 的需求是否应重新定义为"增强现有命令"而非"新增命令"？
3. CWD guard 修复后，是否需要在 /health 端点中暴露 cwd 信息以辅助 Docker 场景诊断？
4. allowed_paths 容错问题的根因：是 YAML 文件手写格式问题，还是 CLI `config set` 的冒号分隔格式问题，还是两者都有？
5. 三份 README 修正的一致性如何保证？是否需要单一真相源（如 mcp-server/README 为主，其他引用）？

## AGATE_CARD

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

- [ ] P0-brief.md 完成（五字段齐全）

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

## 推进条件

- [ ] P1-requirements.md 含 BDD ≥1 条
- [ ] domains / packages / risk_level / phases 已声明
- [ ] 无 [NEED_CONFIRM] 标记
- [ ] 无 status: GAP（supplementable 不阻，GAP 阻）

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

## 产出路径

`docs/tasks/T070-mcp-docker-deployability/P1-requirements.md`
