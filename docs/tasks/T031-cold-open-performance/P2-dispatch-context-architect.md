---
phase: P2
generated_by: agate-inject-card.sh + 主 Agent
task_id: T031
role: architect
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标
产出 P2-design.md——Explore 列表页性能与交互优化的技术方案，含候选方案权衡、files_to_read、gate_commands、minimal_validation

### 约束
- **纯前端改动，不改后端 API 契约**
- **并行加载用 Promise.all，不合并 API**——API 合并会影响 MCP 等消费方
- **`<a>` 改造需处理嵌套交互元素**（toggle/delete 按钮、username 链接）的 a11y 与事件冒泡
- **骨架屏需覆盖 grid + list 双视图模式**
- **`·` 修复覆盖 EntryCard.vue、EntryListRow.vue、EntryListView.vue footer 三处**
- **"Explore" 文案改两处**：LandingView.vue 的 hero-cta 和 cta-band
- **P1 声明 requires_minimal_validation: true**——方案依赖浏览器行为（`<a>` 嵌套交互元素的事件冒泡、右键菜单），需最小验证
- **gate_commands 必须用 Makefile target**（make test-frontend / make typecheck 等），不手写裸命令
- **ui_affected: true**——P6 需 Playwright 实跑截图验证桌面+移动

### 上游关联
- P1-requirements.md：7 条 BDD + 8 条隐含需求 + domains:[frontend] + risk_level:medium
- P0-brief.md：5 个子项 + 明确排除项 + 环境约束

### 输入文件（必读）
- docs/tasks/T031-cold-open-performance/P1-requirements.md（需求基线）
- docs/tasks/T031-cold-open-performance/P0-brief.md（环境约束）
- frontend-v3/src/views/EntryList.vue（Explore 列表页主组件）
- frontend-v3/src/views/EntryDetail.vue（详情页，串行加载链所在）
- frontend-v3/src/stores/entry.ts（entry store，getEntry/selectFile/getFileContent）
- frontend-v3/src/components/EntryCard.vue（卡片组件）
- frontend-v3/src/components/EntryListRow.vue（列表行组件）
- frontend-v3/src/views/LandingView.vue（首页，Explore 按钮所在）
- frontend-v3/src/router.ts（路由定义）
- DESIGN.md（设计系统，骨架屏/卡片/列表规范）
- AGENTS.md（项目约定、铁律）
</dispatch_guide>

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P2

路径：agate/phase-cards/P2-design.md
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

<objective_info>
- debug backend: http://127.0.0.1:8888 (make debug-start, /tmp/peekview-debug/)
- seed data: make debug-seed → alice/bob/carol (password testpass123), 12 entries
- 前端测试：make test-frontend (vitest run)
- 前端类型检查：make typecheck (vue-tsc --noEmit)
- 前端构建：make build-frontend
- 前端 lint：无独立前端 lint（ruff 只管后端）
- E2E：make debug-test 或 E2E_SPEC=e2e/<spec>.ts make debug-test
- Playwright CDP：chromium.connectOverCDP('http://localhost:18800')
- 当前加载链：EntryDetail.vue onMounted → await entryStore.loadEntry(slug) → 内部串行 getEntry → selectFile → getFileContent
- 当前卡片：EntryCard.vue 用 @click="goToEntry" + role="button" + tabindex="0" + @keydown.enter/space
- 分隔符 `·`：EntryCard.vue、EntryListRow.vue、EntryListView.vue footer
- 搜索框 placeholder："搜索标题、标签和文件内容"（EntryList.vue）
- Explore 按钮：LandingView.vue hero-cta + cta-band 两处
- 视图模式：EntryList.vue 有 grid/list 切换（useViewMode composable）
</objective_info>
