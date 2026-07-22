---
phase: P4
generated_by: agate-inject-card.sh + 主 Agent
task_id: T031
role: implementer
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标
实现 Explore 列表页性能与交互优化——让 P3 的 16 个红灯测试全部变绿

### 约束
- **纯前端改动，不改后端 API 契约**
- **按 P2-design.md 方案实现**：整卡 `<a>` + stopPropagation、列表页传 fileId 并行加载、骨架屏双模式、meta-sep 字体修复、placeholder 改英文、Explore→Browse public
- **读取代码文件以 P2-design.md 的 files_to_read 清单为准**，按需读取（标了行号范围的只读片段）。不要在项目里盲目搜索或整目录全读
- **P3 测试必须全部变绿**：cd frontend-v3 && ./node_modules/.bin/vitest run src/components/__tests__/t031
- **typecheck 必须通过**：cd frontend-v3 && npx vue-tsc --noEmit
- **不加注释**（项目铁律）
- **不自行加范围外改动**——发现需要做但不在 P1 范围内的改动 → 标 [SCOPE+] 而非直接做

### 上游关联
- P2-design.md：方案详情 + files_to_read + minimal_validation confirmed
- P3-test-cases.md：16 个测试用例（6 个 vitest spec 文件）
- P1-requirements.md：7 条 BDD 验收条件

### 输入文件（按 P2 files_to_read 清单）
- frontend-v3/src/components/EntryCard.vue（卡片组件重构为 <a>）
- frontend-v3/src/components/EntryListRow.vue（列表行重构为 <a>）
- frontend-v3/src/views/EntryListView.vue:108-110（加载态→骨架屏；placeholder；footer 分隔符）
- frontend-v3/src/views/EntryDetailView.vue:132-136（加载态→骨架屏）
- frontend-v3/src/views/EntryDetailView.vue:704-708（onMounted 并行加载改造）
- frontend-v3/src/stores/entry.ts:81-105（loadEntry 串行→并行）
- frontend-v3/src/api/client.ts:128-156（API 签名确认）
- frontend-v3/src/views/LandingView.vue:45（hero-cta 文案）
- frontend-v3/src/views/LandingView.vue:167（cta-band 文案）
- frontend-v3/src/router.ts:24-28（路由 props）
- DESIGN.md:190-201（Card/List Item 样式规范）
</dispatch_guide>

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P4

路径：agate/phase-cards/P4-implementation.md
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

review 不通过 → implementer 修改代码 → 再 review → … → approved（⑩迭代循环，review 和 gate 重试共享 retry 预算）

## gate 规则（check-gate.sh 会跑）

```bash
check-gate.sh P4 $TASK_DIR
```

- **exit 0**：暂存区含非 md/yaml 代码文件（git diff --cached --name-only）
- **exit 1**：暂存区仅 .md/.yaml 文件（无实际代码变更）→ 不能推进

## 推进条件（全部满足才写 phase: P5）

- [ ] 暂存区含代码文件（非 .md/.yaml）
- [ ] 评审完成（若有触发）：P4-review.md status: approved
- [ ] SCOPE+ 已处理（若本阶段产生）：P1-requirements.md 有 [SCOPE_RESOLVED]
- [ ] git commit 完成

## 常见错误

1. **不读 files_to_read，在项目里乱翻**：implementer 拿到 P2 的 files_to_read 清单后应按清单阅读，不要在项目里全文搜索或整目录全读——上下文会爆炸
2. **自行加范围外改动**：发现需要做但不在 P1 范围内的改动 → 标 [SCOPE+] 而非直接做
3. **只跑单元测试不验证集成**：单元测试全绿 ≠ 功能可用。P5 会跑 gate_commands 做技术验证，但要确保实现时路径依赖的端点行为已验证
4. **写完代码不改 .state.yaml 就 commit**：commit 后更新 phase 标记为 P5
5. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- P5 验证依赖：P5 跑 gate_commands.P5 的命令（在 P2 声明），确保你的实现能通过
- P6 验收依赖：实现路径的端点行为必须可验证（确认 API 返回正确的 Content-Type、状态码等）
- 代码改动文件路径：P8 发布时确认版本文件变更需要知道你改动了哪些 package

> 完成 → 读 phase-cards/P5-verification.md
<!-- AGATE_CARD_END -->

<objective_info>
- 前端单测：cd frontend-v3 && ./node_modules/.bin/vitest run src/components/__tests__/t031
- 前端类型检查：cd frontend-v3 && npx vue-tsc --noEmit
- 前端构建：make build-frontend
- P3 测试文件位置：frontend-v3/src/components/__tests__/t031-*.spec.ts
- 当前 EntryCard.vue：div.card-body @click="goToEntry" + role="button" + tabindex="0"
- 当前 EntryListRow.vue：类似结构
- 当前 EntryListView.vue：loading 时显示 "Loading..." 文本
- 当前 EntryDetailView.vue：onMounted 串行 loadEntry
- 当前 stores/entry.ts：loadEntry 串行 getEntry → selectFile → getFileContent
- 分隔符 `·`：EntryCard.vue、EntryListRow.vue、EntryListView.vue footer
- 搜索框 placeholder："搜索标题、标签和文件内容"
- Explore 按钮：LandingView.vue 两处
- minimal_validation confirmed：<a> 内 button 用 stopPropagation+preventDefault 可阻止导航；嵌套 <a> 不可行（parser 打断）
- username 改为 span + role="link" + tabindex="0" + @keydown.enter + @click.stop.prevent
</objective_info>
