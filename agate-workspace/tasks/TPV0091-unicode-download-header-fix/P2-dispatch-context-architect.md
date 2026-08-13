---
phase: P2
task_id: TPV0091-unicode-download-header-fix
type: design
parent: P1-requirements.md
trace_id: TPV0091-P2-architect-20260813
status: draft
---

# P2 派发上下文 — architect

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

产出 `P2-design.md`：修复非 latin-1 文件名（中文/日文）下载与图片预览 500 的**方案设计**。候选方案 ≥2 + 权衡 + 选择理由 + 四字段 + minimal_validation。

## 已确认事实（P1 查证 + 本次会话实测，勿重查）

1. **根因**：`backend/peekview/api/files.py:204-208` `download_file` 把原始中文文件名直接放 `Content-Disposition` header → Starlette `init_headers` 强制 latin-1 → `UnicodeEncodeError` → 500
2. **触发面**：
   - 图片预览：ImageViewer → `getFileAsBase64` → client.ts:160-171 GET `/entries/${slug}/files/${fileId}`（download 端点，无 /content）——**唯一实际触发点**
   - API 直接下载：GET download 端点（公开 API，agent 读路径/直接 URL）
   - `api.downloadFile`（client.ts:173）是**死代码**，无调用者
   - `useEntryDetailComputed.ts:86 downloadFile` 是客户端 blob 下载（不走 API）
3. **`/content` 端点**（get_file_content，files.py:211-253）无 Content-Disposition header，对所有文件 200，图片 content-type 正确（image/png）
4. **安全约束**：`_sanitize_filename` 现有净化逻辑（test_security.py:574-615 断言 200 + 无 `\r`/`\n`）
5. **read tracking**：download 端点记录 action="download"（files.py:191-202），`/content` 记录 action="read"
6. 无 schema/迁移需求，MCP 无牵连

## 修复候选（P1 已列出，P2 需选型 + 权衡）

- **候选 A（后端治本）**：Content-Disposition 用 RFC 5987 `filename*=UTF-8''...`（+ ASCII fallback `filename="..."`）——浏览器正确显示中文文件名，同时修复图片预览（getFileAsBase64 拿到 200 即可）
- **候选 B（前端语义修正）**：`getFileAsBase64` 改用 `/content` 端点——图片预览语义上不该走 download 端点；read tracking action 从 download 变 read（口径变化）
- **候选 C（组合 A+B）**：后端修 header 编码 + 前端预览改 /content

## 关键设计问题（P2 必须回答）

1. **RFC 5987 实现细节**：
   - 只加 `filename*` 还是同时保留 `filename` fallback（旧浏览器兼容）？
   - 编码范围：只对非 ASCII 编码，还是统一 UTF-8 编码？（`filename*=UTF-8''` 的 encoding 参数）
   - 注入字符（`"` `;` `\r` `\n`）在 `filename*` 里的处理（RFC 5987 的 attr-char 不允许哪些字符）？
   - `_sanitize_filename` 净化逻辑如何与 RFC 5987 编码配合（先净化后编码的顺序）
2. **候选 B 可行性**：`/content` 端点返回 `_determine_content_type` 的 media_type，图片 content-type 已确认正确（image/png）。改 `getFileAsBase64` 走 /content 是否影响现有 ImageViewer 测试（ImageViewer.spec.ts）
3. **是否需要改前端**：候选 A 单独是否已满足所有 BDD？BDD-1/2/3（预览）靠后端 200 即可；BDD-5（下载文件名显示）靠 RFC 5987。若 A 满足全部 BDD，B 是否仍需（语义改进 vs 最小改动）
4. **gate_commands**：P3 "pytest" / P5 "pytest -q --tb=no" / P5_e2e（ui_affected: true 时）
5. **测试策略**：P3 新增中文/日文文件名 download 测试（test_files_api / test_file_service）；BDD-7 按 test_security.py:604-608 现有断言范围（200 + 无 \r\n），不按字面加引号断言（P1-review 观察项 O1）

## P2 最小验证（必须执行，结果写入 P2-design.md）

方案依赖浏览器 header 解析行为 → 必须做 minimal_validation：
- 用 curl 验证候选 A 的 RFC 5987 header 格式（URL 解码后等于原始中文文件名）
- 验证 `filename=` fallback 与 `filename*=` 共存时浏览器解析优先级（可查 MDN/实测）
- 验证 `_sanitize_filename` 净化 + RFC 5987 编码的配合（注入字符处理）

## 约束

1. 产出 `P2-design.md`，frontmatter 含 candidate_count / packages / domains / ui_affected
2. 正文含四字段：gate_commands / files_to_read / env_constraints / minimal_validation
3. `candidate_count` 与正文候选方案数一致
4. packages = [backend/peekview/api/files.py, backend/tests, frontend-v3/src/api/client.ts, frontend-v3/src/components/ImageViewer.vue]（P1 已定）
5. domains = [backend, frontend]
6. ui_affected: true（BDD-1/2/3/8 是 UI 行为）
7. risk_level=medium（P1 已定）
8. 环境隔离：debug :8888 可用（勿停、勿碰 :8080）；只读代码，不改任何文件
9. 每读一个输入文件追加 progress 到 `P2-progress.md`
10. 产出写 `agate-workspace/tasks/TPV0091-unicode-download-header-fix/P2-design.md`

## 输入文件

1. `agate-workspace/tasks/TPV0091-unicode-download-header-fix/P1-requirements.md`（8 BDD 基线）
2. `agate-workspace/tasks/TPV0091-unicode-download-header-fix/P1-review.md`（2 条观察项 O1/O2）
3. `agate-workspace/tasks/TPV0091-unicode-download-header-fix/P0-brief.md`（env_constraints）
4. `backend/peekview/api/files.py`（download_file / get_file_content / _sanitize_filename / _determine_content_type）
5. `frontend-v3/src/api/client.ts`（getFileAsBase64 / downloadFile / getFileContent）
6. `frontend-v3/src/components/ImageViewer.vue`（预览链路 + data-testid）
7. `backend/tests/test_security.py`（574-615 Content-Disposition 净化断言）
8. `backend/tests/`（test_files_api / test_file_service 现有 download 测试）

## 验证手段

- curl debug :8888（download 端点 / content 端点 header 实测）
- `python3 -c` 验证 RFC 5987 编码/解码
- 查 Python 标准库（urllib.parse.quote）或 Starlette 相关实现

## 产出规格

P2-design.md 必须含：
- frontmatter：phase/task_id/type/parent/trace_id/status/created/agent + candidate_count/packages/domains/ui_affected
- 候选方案 ≥2 + 权衡表 + 明确选择
- gate_commands（P3/P5/P5_e2e）
- files_to_read（控制 P4 上下文，精挑）
- env_constraints
- minimal_validation（实测结果）

## 返回

路径 + 一句话摘要（候选方案数、选择、ui_affected、minimal_validation 结论）。
