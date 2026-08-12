---
phase: P4
task_id: T070
task_name: mcp-docker-deployability
type: dispatch-context
role: implementer
trace_id: T070-P4-20260725
created: 2026-07-25
---

# P4 派发指引 — implementer

## 目标

按 P2-design.md 方案 A 实现 T070 的代码修复和文档修正，使 P3 的 11 个红灯测试变绿。

## 约束

- 只改 `packages/mcp-server/` 目录下的代码文件和 README
- 只改根 `README.md` 和 `backend/README.md`
- 不改 PeekView 后端/前端代码
- 不改 Dockerfile（已正确）
- 按 P2-design.md 的 files_to_read 清单读取代码，不盲目搜索
- 遵守项目代码规范（不加注释，除非被要求）

## 上游关联

- P2-design.md：方案 A（最小侵入修复 + 诊断增强）
- P3-test-cases.md + P3-test-code/：TDD 测试（11 个红灯需变绿）
- P1-requirements.md：24 条 BDD 验收条件

## 输入文件（按 P2-design.md files_to_read 清单）

1. `packages/mcp-server/src/tools/publishFiles.ts` — CWD guard 修复
2. `packages/mcp-server/src/config/merge.ts` — allowed_paths 容错
3. `packages/mcp-server/src/server.ts` — /health 增强
4. `packages/mcp-server/src/cli/config.ts` — config list/verify 增强
5. `packages/mcp-server/src/config/file.ts` — ConfigFileData 类型
6. `packages/mcp-server/src/config.ts` — loadConfig 入口
7. `packages/mcp-server/tests/t070-*.test.ts` — P3 测试代码（理解预期行为）
8. `packages/mcp-server/README.md` — 文档修正
9. `README.md` — Docker 场景指引 + OpenCode/Cursor
10. `backend/README.md` — Docker 场景指引

## 实现要点（从 P2-design.md 提取）

### 1. CWD guard 修复（publishFiles.ts L338-346）

将：
```typescript
if (path.resolve(cwd) === path.parse(cwd).root) {
  return { content: [{ type: 'text', text: 'ERROR: ...未配置 allowed_paths...' }] };
}
```

改为：
```typescript
const isCwdRoot = path.resolve(cwd) === path.parse(cwd).root;
if (isCwdRoot && !config.trustAllPaths && config.allowedPaths.length === 0) {
  return { content: [{ type: 'text', text: 'ERROR: ...cwd 为根目录且未配置 allowed_paths...含两个原因...' }] };
}
```

### 2. allowed_paths 容错（merge.ts L81-82）

将：
```typescript
} else if (fileConfig?.server?.allowed_paths) {
  allowedPaths = fileConfig.server.allowed_paths.map(expandHome);
}
```

改为：
```typescript
} else if (fileConfig?.server?.allowed_paths) {
  const raw = fileConfig.server.allowed_paths;
  const paths = typeof raw === 'string'
    ? raw.split(':').filter((p: string) => p.length > 0)
    : Array.isArray(raw) ? raw : [];
  allowedPaths = paths.map(expandHome);
}
```

### 3. /health 增强（server.ts L231-266）

config 对象追加 cwd、mode、allowed_paths 字段。remote 模式下 allowed_paths 为空数组。

### 4. config list 增强（cli/config.ts）

configListAction() 改为调 mergeConfig 获取最终生效值，追加 runtime 节（cwd、mode、allowed_paths）。

### 5. config verify 增强（cli/config.ts）

verifyAction() 末尾追加 allowed_paths 文件可读性测试。

### 6. publish_files 工具描述增强

description 末尾追加 Docker 场景提示 + 诊断命令提示 + namespace 提示（3 行）。

### 7. 文档修正

- mcp-server/README.md：namespace 语义、allowed_paths 格式、Docker 示例、Docker 场景指引节
- README.md：Docker 场景指引 + OpenCode/Cursor 示例
- backend/README.md：Docker 场景指引

## 自查命令

实现后自跑测试确认基本功能：
```bash
cd /home/kity/oclab/peekview/packages/mcp-server && npx vitest run tests/t070- 2>&1 | tail -40
```

自查≠gate。P5 gate 由主 Agent 执行。

## AGATE_CARD

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P4

路径：phase-cards/P4-implementation.md
---
# P4 — 代码实现

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P4 且有合规理由（check-pruning.sh 已检查）→ 跳过，读 P5 卡片

## 如果是首次进入本阶段

1. 派发 implementer subagent → 产出代码文件
   1.1 写 P4-dispatch-context-implementer.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 按 P2 的 gate_commands 跑单元测试（非 gate，只是自查）
3. 必要评审派发（见下方）
4. git add 代码文件 → git commit
5. 预跑 check-gate.sh P4（确认暂存区有代码文件）
6. 更新 .state.yaml phase=P4 → P5

## 如果是重试

确认上一轮失败原因（来自 gate 输出 / review rejected 理由）
→ 只修复失败项，不重做已通过的部分
→ 修复后重跑全量测试（T027 教训：修复可能引入回归）
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P4 MAX=3）

**若这次是从 P6（或其他更后的阶段）退回来的**：`docs/tasks/Txxx/` 下不会再有旧的 P6-acceptance.md（已被归档），但当初具体是哪条 BDD 失败、失败原因是什么，会摘要在 `docs/tasks/Txxx/.retreat-history.md` 里——**重新派发 implementer 时，dispatch-context 必须引用这份摘要**，不能让 implementer 只看到"现有代码"却不知道具体要修哪里。已有代码不会被撤销、也不需要重新实现，是在已有实现基础上定向修复。

## 前置条件

- [ ] P2-design.md 存在且 files_to_read 字段完整（导航清单）
- [ ] P2-review.md status: approved（P2 未被裁剪时）
- [ ] P3-test-cases.md 存在（测试已设计）
- [ ] check-tdd-red.sh 确认红灯（测试先于实现）
- [ ] 未跳过 P4（如有裁剪理由，见上方裁剪跳阶）

## 派发

- **角色**：implementer（`{agate_root}/assets/execution-roles/implementer.md`）
- **输入**：P2-design.md（files_to_read 导航 + gate_commands）+ P3-test-cases.md + P0-brief.md（env_constraints）
- **输出**：代码文件（在 P4-implementation.md 声明的 implementation_dir 下）
- **派发 prompt 模板**：`{agate_root}/assets/templates/dispatch-prompt.md` + 以下阶段特定追加：

```
## 上下文控制
读取代码文件以 P2-design.md 的 files_to_read 清单为准，按需读取（标了行号范围的只读片段）。
不要在项目里盲目搜索或整目录全读。

## 自查≠gate
写完代码后应自跑测试确认基本功能（自查），但自查通过 ≠ P5 gate 通过。
P5 由主 Agent 亲自执行 P2-design.md 的 gate_commands，结果以主 Agent 为准。
不要在返回中声称"P5 已过"或"全部测试通过"——只返回路径 + 摘要。

## 生产环境隔离
任何写入生产环境/生产数据库/生产 API 的操作都必须先 PAUSED 报告人工。
```

## 产出规格

- P4-implementation.md 必须声明 `implementation_dir: {实际路径}`
- 代码文件在声明的目录下
- 遵守 P2-design.md 的方案设计 + 现有项目代码规范

## 评审派发（C8 机械映射）

**在 P4 实现完成后、gate 前**，按 P1 声明的 domains 和 risk_level 派评审：

| domain | 派哪些评审 | 产出 |
|--------|----------|------|
| backend | review | P4-review.md |
| frontend | design-review | P4-review.md |
| mcp | review（关注 MCP 接口契约）| P4-review.md |
| security | cso | P4-review.md |
| risk=high | —（plan-eng-review 在 P2 已派）| — |

多个评审角色 `专家组并行` → 所有返回后派组长汇总 → 统一 P4-review.md（status: approved / rejected）。
详见 `agate/rules/review-mapping.md`。

**并行派发**（多个评审角色时）：
1. 同时派发所有触发的评审 subagent（每个一个 task 调用）
2. 每个评审 subagent 各写一个 dispatch-context + 各自产出文件
3. 所有评审返回后，派发组长汇总 subagent（角色：review + 指定为「专家组组长」）
4. 组长产出：P4-review.md。**agent 字段必须非 main**（与 P2 评审同规则，check-gate.sh 在 P2 分支硬拦截 agent=main 的 approved）
5. 组长规则：不发表新意见，只汇总；任何 BLOCKER → rejected；分歧 → 交人工；全票无 BLOCKER → approved

**单评审角色时**：直接派发，无需组长汇总，产出直接写 P4-review.md。

review 不通过 → implementer 修改代码 → 再 review → … → approved（⑩迭代循环，review 和 gate 重试共享 retry 预算）

## 按包拆分并行（可选，需额外约束）

> 仅当 P2 packages > 1 且包间无依赖时适用。单包任务跳过本节。

当 P2 声明多个 packages 且包间无数据依赖时，P4 可拆分并行，但**有额外约束**：

1. 每个 package 派一个 implementer subagent
2. **各 implementer 只改自己 package 目录下的文件**——跨包的共享文件（类型定义、接口、配置）由主 Agent 在所有并行 implementer 返回后统一处理
3. 各自返回路径 + 摘要
4. 主 Agent 汇总后统一 commit
5. 主 Agent 在所有 implementer 返回后，统一处理共享文件改动（如果有）

**冲突预防**：
- dispatch-context 约束节必须写明：`只改动 {pkg}/ 目录下的文件。共享文件（{列出}）不在本次改动范围内`
- 如果某个 implementer 必须改共享文件 → 该包不能并行，改为串行（主 Agent 先派其他包并行，再串行处理含共享改动的包）
- 无法确定是否有共享改动 → 串行（安全默认值）

**基础设施隔离（并行时强制）**：
- debug server 端口：每个 implementer 的 dispatch-context 约束节分配不同端口（如 pkg-a: 3001, pkg-b: 3002）
- 测试数据库：每个 implementer 用独立数据库路径（如 `test-{pkg}.db`），不共享同一 test.db
- 环境变量：dispatch-context 写明各 subagent 独立的环境变量值（如 `PORT=3001` vs `PORT=3002`）
- 临时文件：各 subagent 写入 `P4-implementation/{pkg}/` 独立目录

主 Agent 在并行派发前应确认每个 subagent 的 dispatch-context 已包含上述隔离参数。**注意**：这是 nudge 不是强制规则（无 gate 脚本检查），与 design_trivial 的形式义务同级。未分配隔离参数的后果是运行时冲突（端口占用/数据库锁），由 subagent 报错暴露。

## gate 规则（check-gate.sh 会跑）

```bash
check-gate.sh P4 $TASK_DIR
```

- **exit 0**：暂存区含非 md/yaml 代码文件（git diff --cached --name-only）
- **exit 1**：暂存区仅 .md/.yaml 文件（无实际代码变更）→ 不能推进

## 推进条件（全部满足才写 phase: P5）

- [ ] 暂存区含代码文件（非 .md/.yaml）
- [ ] 评审完成（若有触发）：P4-review.md status: approved
- [ ] SCOPE+ 已处理（若本阶段产生）：P1-requirements.md 有 [SCOPE_RESOLVED]（行首声明格式）
- [ ] git commit 完成

## 常见错误

1. **不读 files_to_read，在项目里乱翻**：implementer 拿到 P2 的 files_to_read 清单后应按清单阅读，不要在项目里全文搜索或整目录全读——上下文会爆炸
2. **自行加范围外改动**：发现需要做但不在 P1 范围内的改动 → 标 [SCOPE+]（行首声明格式）而非直接做
3. **只跑单元测试不验证集成**：单元测试全绿 ≠ 功能可用。P5 会跑 gate_commands 做技术验证，但要确保实现时路径依赖的端点行为已验证
4. **写完代码不改 .state.yaml 就 commit**：commit 后更新 phase 标记为 P5
5. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- P5 验证依赖：P5 跑 gate_commands.P5 的命令（在 P2 声明），确保你的实现能通过
- P6 验收依赖：实现路径的端点行为必须可验证（确认 API 返回正确的 Content-Type、状态码等）
- 代码改动文件路径：P8 发布时确认版本文件变更需要知道你改动了哪些 package

> 完成 → 读 phase-cards/P5-verification.md
<!-- AGATE_CARD_END -->

## 产出路径

- 代码文件：直接修改 `packages/mcp-server/src/` 和 `packages/mcp-server/README.md`、`README.md`、`backend/README.md`
- P4-implementation.md：`docs/tasks/T070-mcp-docker-deployability/P4-implementation.md`
