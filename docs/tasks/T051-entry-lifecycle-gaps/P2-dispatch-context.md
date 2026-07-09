<!-- AGATE_CARD_START -->
## 当前阶段卡片：P2

路径：agate/phase-cards/P2-design.md
---
# P2 — 方案设计

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → P2 不可裁剪。design_trivial / follows_existing_pattern 可简化（1 个候选方案），不可省略。

## 如果是首次进入本阶段

1. 派发 architect subagent → 产出 P2-design.md
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

## 下游影响

- P4 依赖 files_to_read 导航代码阅读范围
- P5 依赖 gate_commands 执行验证命令
- P6 依赖 ui_affected 判断是否需要 vision-helper
- gate_commands 在 P2 固化后 P4-P6 不能改——设计阶段是声明验证契约的唯一窗口

> 完成 → 读 phase-cards/P3-tdd.md
<!-- AGATE_CARD_END -->

# T051 P2 Dispatch Context — 客观信息

## 环境状态

- Debug backend: `make debug` → `:8888`，数据隔离 `/tmp/peekview-debug/`
- 后端测试: `cd backend && .venv/bin/python -m pytest tests/ -q`
- 前端测试: `cd frontend-v3 && ./node_modules/.bin/vitest run`
- 类型检查: `cd frontend-v3 && npx vue-tsc --noEmit`

## 关键代码位置

### 缺口 A: 后台清理

- `backend/peekview/main.py:26-43` — `lifespan()` 函数，当前只有 startup（init_db）+ shutdown（log），无后台任务
- `backend/peekview/config.py:202-206` — `PeekCleanup.check_on_start` + `PeekCleanup.interval_seconds`
- `backend/peekview/services/admin_service.py:115` — `cleanup_expired()` 方法（已有两阶段逻辑）
- `backend/peekview/main.py:75` — `create_app(lifespan=lifespan)`

### 缺口 B: 筛选栏

- `frontend-v3/src/views/EntryListView.vue:34-49` — 当前 owner-tabs（All/Mine），无 status filter
- `frontend-v3/src/views/EntryListView.vue:49` — filter-chip-bar（已有 chip 容器）
- `frontend-v3/src/stores/entry.ts:53` — `loadEntries(params?: ListEntriesParams)` 已支持 owner/status
- `frontend-v3/src/types/index.ts:51-58` — `ListEntriesParams` 已有 `status?: string` + `owner?: string`
- `frontend-v3/src/views/EntryListView.vue:260` — `effectiveOwner` computed
- `frontend-v3/src/views/EntryListView.vue:314-318` — `setOwner()` + `updateURL()`
- `frontend-v3/src/components/EntryCard.vue` — 卡片模式用户名显示
- `frontend-v3/src/components/EntryListRow.vue` — 列表模式用户名显示

### 缺口 C: 过期警告

- `frontend-v3/src/views/EntryDetailView.vue:59-73` — 当前只在 `status === archived` 时显示 badge，过期但仍 active 时无警告
- `frontend-v3/src/views/EntryDetailView.vue:65-67` — `formatExpiresIn()` 显示 "Expires expired" 但无视觉区分

### 缺口 D: 头部布局

- `frontend-v3/src/views/EntryDetailView.vue:5-133` — 完整 header 结构
- `frontend-v3/src/views/EntryDetailView.vue:46-58` — meta 行：owner + time + read-stats（桌面端）
- `frontend-v3/src/views/EntryDetailView.vue:229` — `mobile-actions` 移动端底部操作栏
- `frontend-v3/src/views/EntryDetailView.vue:50-52` — `relativeTime` 相对时间格式
- `frontend-v3/src/utils/expires.ts` — `formatExpiresIn()` 过期时间格式化

## 后端 API 已有能力

- `GET /api/v1/entries?owner=me` — 当前用户条目
- `GET /api/v1/entries?owner=<username>` — 指定用户条目
- `GET /api/v1/entries?status=archived` — 已归档条目
- `GET /api/v1/entries?status=active` — 活跃条目（默认）
- 组合: `?owner=me&status=archived` — 当前用户的已归档条目
