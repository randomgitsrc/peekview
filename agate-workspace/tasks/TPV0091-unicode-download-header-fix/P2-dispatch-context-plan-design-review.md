---
phase: P2
task_id: TPV0091-unicode-download-header-fix
type: review
parent: P2-design.md
trace_id: TPV0091-P2-design-review-20260813
status: draft
---

# P2 派发上下文 — plan-design-review

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
6. git add {AGATE_WORKSPACE}/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
7. git commit -m "wf({Txxx}-P2): {摘要}"

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
## P2 最小验证
方案设计前，先用最小验证确认关键假设（10 行 HTML 测试页 / curl 请求 / 20 行脚本）。
验证结果写入 P2-design.md 的 minimal_validation 字段。
- 方案依赖浏览器行为/安全模型/外部系统行为 → 必须做最小验证
- 纯代码逻辑 → 须在 minimal_validation 字段声明 `纯代码逻辑，无外部系统依赖`（须写明依赖了哪些内部函数/数据转换）
```

## 产出规格

P2-design.md 必须包含：
- **候选方案 ≥2** + 权衡 + 选择理由（design_trivial / follows_existing_pattern 时可只写 1 个，见下方）
- **`candidate_count: N` 必填**：本方案候选方案数（≥2，design_trivial/follows_existing_pattern 时可 1），gate 按此字段校验，不再解析标题。你写几个候选就填几个，与正文一致。
- **四字段**：`packages:` `domains:` `ui_affected:` `gate_commands:`
- **files_to_read**：实现时需要参考的文件清单（控制 P4 implementer 上下文）
- **env_constraints**：确认/细化 P0-brief 的环境约束
- **minimal_validation**：验证结果 或 声明"纯代码逻辑，无外部系统依赖"（声明时须附理由）

`candidate_count`/`packages`/`domains`/`ui_affected` 写在文件头 **frontmatter**（`---` 分隔块），
不写正文；`gate_commands:`/`files_to_read:`/`env_constraints:`/`minimal_validation:` 留正文。
**可直接复制的完整样例**：
```yaml
---
phase: P2
task_id: TAG0001           # 替换为实际任务编号
type: design
parent: P1-requirements.md
trace_id: T001-P2-20260101 # {task_id}-P2-{YYYYMMDD}
status: draft
created: 2026-01-01
agent: architect
# ── v2.0 机器字段 ──
candidate_count: 2                # int ≥1，必填
packages: [pkg-a]                 # list，必填
domains: [backend, cli]           # list，必填
ui_affected: false                # bool，必填
---
```

候选方案简化（须附理由，无理由视为无效声明，要求 ≥2 候选方案）：
- `design_trivial: true` + 理由（为什么 trivial）→ 可只写 1 个候选方案（P2 仍不可省略）
- `follows_existing_pattern: [src/foo.py]`（列出参照文件路径）→ 可只写 1 个候选方案，参照已有模式（P2 仍不可省略）

## gate_commands 声明

gate_commands 在 P2 固化，后续阶段按此执行：

```yaml
gate_commands:
  P3: "pytest"                  # 可选：测试运行器（verbose 输出，供 check-tdd-red.sh 自动读取）
  P5: "pytest -q --tb=no"       # 紧凑输出模式
  P5_e2e: "playwright test --reporter=line tests/e2e/"  # ui_affected: true 时必填
```

## 评审派发（C8 机械映射）

按 P1 声明的 domains + risk_level 机械映射评审：

| domain | risk_level | 必须派的评审 |
|--------|------------|------------|
| frontend | 任意 | plan-design-review |
| 任意 | high | plan-eng-review（硬规则，必须派独立 subagent） |
| P1-requirements.md 含 [NEED_CONFIRM] 且涉及业务方向 | 任意 | plan-ceo-review |

多个评审角色 `专家组并行` → 组长汇总 → P2-review.md（status: approved / rejected）。
详见 `agate/rules/review-mapping.md`。

**并行派发**（多个评审角色时）：
1. 同时派发所有触发的评审 subagent（每个一个 task 调用）
   > **操作方式**：在一个 assistant 消息中连续发起多个 task 工具调用（每个评审角色一个）。
   > 不要等前一个 task 返回再发下一个——那是串行，不是并行。
   > 平台会并行执行多个 task，全部返回后再进入下一步（派发组长汇总）。
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

**UI 测试选择器**：涉及前端时，P2 design 建议声明 UI 组件的稳定测试标识清单（如 `data-testid`，而非 class 命名）。P3 test-designer 用稳定标识定位元素，P4 implementer 按清单实现--class 命名可重构，稳定标识不变。具体方案由 P2 architect 决定。

## gate 规则

```bash
check-gate.sh P2 $TASK_DIR
```

- 候选方案数 ≥2（design_trivial / follows_existing_pattern 时可只写 1 个）
- P2-review.md 存在且 status: approved（agent≠main）— 不存在 → gate exit 1
- 四字段齐全（packages/domains/ui_affected/gate_commands）
- gate_commands.P3 可选（非 pytest 项目建议声明，供 check-tdd-red.sh 自动读取测试运行器）
- 候选方案 ≥2 时含权衡/选择理由

## 推进条件（全部满足才写 phase: P3）

- [ ] P2-design.md 候选方案 ≥2（或 design_trivial/follows_existing_pattern 须附理由时可只写 1 个）+ 四字段齐全
- [ ] P2-review.md 存在且 status: approved（agent≠main）
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

## 目标

评审 `P2-design.md`（方案设计），产出 `P2-review.md`。C8 映射：domains=[backend, frontend]，risk=medium → 派 plan-design-review（frontend 域）。

## 设计概要（已被 architect 选定）

修复非 latin-1 文件名下载/预览 500。**候选 C = A（后端 RFC 5987 Content-Disposition）+ B（前端预览走 /content）**：
1. 后端 `files.py` 新增 `_build_content_disposition(filename)` helper：ASCII 分支保持现格式字节级不变；非 ASCII 分支 `filename="{fallback}"; filename*=UTF-8''{quote(safe, safe='')}`
2. 前端 `client.ts getFileAsBase64` URL 从 `/files/{fileId}` 改 `/files/{fileId}/content`
3. `_sanitize_filename` 行为不变（ZIP 复用）；`/content` 端点不动；read tracking 预览 action download→read（P1 SUGGEST 已声明可接受）
4. minimal_validation 6 项全部 confirmed（RFC 5987 latin-1 可编码 + unquote 往返、MDN filename* 优先、/content 图片 200+PNG 签名、响应体一致、ASCII 零回归、ImageViewer.spec mock 化）

## 评审重点（plan-design-review 检查清单）

1. **交互状态覆盖率**：BDD-1/2/3 图片预览的 loading/error/empty 状态——方案是否覆盖？（image-content/image-error testid 已有）
2. **AI Slop 风险**：方案是否给 P4 留了「随便搞」空间？RFC 5987 实现细节（quote safe='' 全编码、fallback `_` 替换）是否足够明确？
3. **移动端考虑**：图片预览在移动端（drawer 布局）是否受影响？
4. **可访问性**：图片预览/下载对键盘/屏幕阅读器的影响？
5. **组件完整性**：ImageViewer 的 input（props.slug/fileId）→ output（data URI）描述是否完整？client.ts 两个函数（getFileAsBase64/getFileContent）改动边界是否清晰？
6. **方案正确性**（架构视角补充）：
   - RFC 5987 实现与 Starlette Response header 编码是否兼容（latin-1 encode）
   - 前后端改动边界是否最小化（YAGNI）
   - read tracking 口径变化是否可接受（P1 SUGGEST 声明）
   - 回退预案是否成立（候选 A 独立满足全部 BDD）

## 约束

1. **只审不写**——不修改 P2-design.md，产出评审意见
2. 产出写 `agate-workspace/tasks/TPV0091-unicode-download-header-fix/P2-review.md`
3. Header `status:` 初始 `draft`，评审完改为 `approved` / `needs-revision` / `rejected`
4. **必须引用具体锚点**（方案章节号/函数名/BDD 编号），不能裸 approved
5. 有 BLOCKER/CRITICAL 必须明确标出 → rejected
6. 环境隔离：只读，不改任何代码；debug :8888 可验证（勿停）
7. 每读一个输入文件追加 progress 到 `P2-progress.md`

## 输入文件

1. `agate-workspace/tasks/TPV0091-unicode-download-header-fix/P2-design.md`（评审对象）
2. `agate-workspace/tasks/TPV0091-unicode-download-header-fix/P1-requirements.md`（8 BDD 基线）
3. `agate-workspace/tasks/TPV0091-unicode-download-header-fix/P1-review.md`（O1/O2 观察项）
4. `backend/peekview/api/files.py`（download_file / _sanitize_filename / get_file_content）
5. `frontend-v3/src/api/client.ts`（getFileAsBase64 / getFileContent）
6. `frontend-v3/src/components/ImageViewer.vue`（预览链路 + testid）
7. `frontend-v3/src/components/__tests__/ImageViewer.spec.ts`（mock 化验证）

## 产出规格

P2-review.md 必须含：
- `---` frontmatter：phase/task_id/type/parent/trace_id/status/created/agent（agent: plan-design-review）
- 各评分维度结论（0-10 + 依据）
- 方案正确性核查（逐项：RFC 5987 兼容/改动最小化/read tracking/回退预案）
- BLOCKER/CRITICAL 清单（如无则显式「无 BLOCKER」）
- 结论：approved / needs-revision / rejected

## 返回

File: <路径> + Status: <approved|needs-revision|rejected>
