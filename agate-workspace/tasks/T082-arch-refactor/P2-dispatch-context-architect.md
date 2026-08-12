---
phase: P2
generated_by: agate-inject-card.sh + 主 Agent
task_id: T082-arch-refactor
role: architect
---

<dispatch_guide>
> 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标
将 P1 需求基线（41 条 BDD，6 项重构）转化为可实现的技术方案 P2-design.md。这是纯重构任务——方案核心是"如何改结构而不改行为"。

### 约束
- 不加新功能，不改 API 契约（错误格式统一化除外——修 bug）
- 不改数据库 schema，不改 MCP server
- 后端先改（DI 统一 → 去重 → 错误格式 → 事务修复），前端后改（store 拆分 → component 拆分）
- EntryDetailView 拆分后主组件 < 300 行，子组件各 < 200 行
- store 拆分后每个 store < 150 行
- 错误格式统一：保留原 HTTP 状态码（如 422 保持 422），仅改响应体格式（HTTPException→PeekError）
- gate_commands 必须用 Makefile target（make test-quick / make test-frontend / make typecheck / make debug-test）
- files_to_read 只列实现确实需要参考的文件，大文件标行号范围

### 上游关联
- P1-requirements.md：41 条 BDD（BDD-1~41），6 项重构，risk=high，无裁剪
- P1-review.md：status=approved，7 项 BLOCKER 已修复
- 6 项重构按依赖顺序：①DI 统一 ②去重 ③错误格式 ④事务修复 ⑤store 拆分 ⑥component 拆分

### 输入文件
- docs/tasks/T082-arch-refactor/P1-requirements.md（需求基线——必读，41 条 BDD）
- docs/tasks/T082-arch-refactor/P0-brief.md（任务简报）
- AGENTS.md（项目约定）
- backend/peekview/main.py（app.state 初始化——DI 统一的目标模式参照）
- backend/peekview/api/entries.py（DI 模式 A：Depends+fallback、重复代码、HTTPException）
- backend/peekview/api/files.py（DI 模式 C：路由内手建 StorageManager+Session、重复代码）
- backend/peekview/auth.py（DI：路由内 new ApiKeyService、_looks_like_jwt 第 3 份、HTTPException）
- backend/peekview/api/admin.py（HTTPException）
- backend/peekview/exceptions.py（PeekError 层级定义）
- backend/peekview/services/entry_service.py（事务问题 line 229、跨 service new line 999/1022）
- backend/peekview/services/admin_service.py（跨 service new line 226/275）
- frontend-v3/src/stores/entry.ts（223 行过载 store）
- frontend-v3/src/views/EntryDetailView.vue（1003 行 god component）
</dispatch_guide>

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

<objective_info>
### 后端 DI 现状（已验证）
- app.state 已初始化的 service：entry_service, apikey_service, admin_service, share_service, read_tracking_service（main.py:221-225）
- 模式 A（Depends+fallback）：entries.py:33 `_get_service` 带 fallback new
- 模式 B（直接 app.state.*）：admin.py, shares.py, read_tracking.py
- 模式 C（路由内手建）：files.py 4 处 `StorageManager(config=config)` + `Session(engine)`
- 跨 service new 实例：
  - admin_service.py:226,275 → `EntryService(engine=self.engine, storage=self.storage, config=self.config)`
  - entry_service.py:999 → `ReadTrackingService(engine=self.engine)`
  - entry_service.py:1022 → `ShareService(engine=self.engine, config=self.config)`
  - auth.py:185 → `ApiKeyService(engine=engine)`
  - files.py:219 → `ShareService(engine=engine, config=config)`

### service 构造函数签名（已验证）
- EntryService.__init__(self, engine, storage, config)
- AdminService.__init__(self, engine, storage, config)
- ShareService.__init__(self, engine, config=None)
- ReadTrackingService.__init__(self, engine)
- ApiKeyService.__init__(self, engine)

### 重复代码（已验证）
- _looks_like_jwt: entries.py:102, files.py:140, auth.py:193（3 份）
- _is_global_api_key_auth: entries.py:108, files.py:145（2 份）
- _record_read_async: entries.py:47, files.py:30（2 份）

### HTTPException 残留（已验证）
- entries.py:205 → status_code=422（status 参数验证）
- auth.py:208, 240, 261, 266（4 处）
- admin.py:57（1 处）
- main.py:535, 580（2 处——基础设施层：404 路由兜底 / metrics，可能保留）

### 事务问题（已验证）
- entry_service.py:229 → session.commit()（entry row 先 commit）
- entry_service.py:277 → 第二次 commit（file records）
- entry_service.py:296-302 → 文件写入失败时 rollback + 删已写文件，但 entry row 已 commit

### 前端 store 过载（已验证）
- entry.ts 223 行：list 状态（entries/page/perPage/total/ownerFound）+ detail 状态（currentEntry/activeFile/fileContent）+ UI 状态（wrapEnabled/loading/error）
- loadSeq 模块级变量 entry.ts:7（防竞态）

### 前端 god component（已验证）
- EntryDetailView.vue 1003 行：335 模板 + 473 脚本 + 195 样式
- 管理：zen mode、file tree toggle、TOC toggle、share dialog、delete confirm、expires-in dialog、login dialog、responsive layout、overflow menu、copy/download/pack、scroll-to-heading、resize、meta-tags-bar scroll hide、share watermark

### 前端错误格式依赖（已验证）
- ExpiresInDialog.vue:66 → `e.response?.data?.detail`
- SecurityTab.vue:71 → `err?.response?.data?.detail`
- ProfileTab.vue:74 → `err?.response?.data?.detail`
- LoginDialog.vue:157/161 → `e.detail`（DOM CustomEvent，非 HTTP 错误，不受影响）

### exceptions.py 已有类型（已验证）
- PeekError（基类）→ error_code + http_status
- ValidationError(PeekError) → error_code="VALIDATION_ERROR", http_status=422
- NotFoundError, AuthenticationError, AuthorizationError, ConflictError 等

### 测试命令（Makefile target）
- make test-quick（后端 pytest，venv Python）
- make test-frontend（前端 vitest，非 watch）
- make typecheck（vue-tsc --noEmit）
- make lint（ruff，系统 python3）
- make debug-test（Playwright E2E via debug backend :8888）
</objective_info>
