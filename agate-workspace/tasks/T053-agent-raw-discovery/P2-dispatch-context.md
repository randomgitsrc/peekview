# T053 P2 派发上下文

> 主 Agent 派发前查证的客观信息。不含 PASS/FAIL 预判。

## P1 需求基线关键信息

- 20 条 BDD 条件（B1-B17 + B7b + B10b + B13b）
- 11 个隐含需求（I1-I11）
- risk_level: medium
- domains: content-negotiation, html-self-description, llms-txt, security, information-leakage
- packages: backend/peekview
- ui_affected: 无
- phases: [P1, P2, P3, P4, P5, P6, P7]（P8 裁剪）
- capability_requirements: curl-http-testing(available), browser-accept-header(available), requires_minimal_validation(true)

## 当前后端路由注册顺序（main.py L415-490）

1. `/{slug}/raw` → 302 重定向到 `/api/v1/entries/{slug}/raw`（L421-423）
2. `/llms.txt` → 302 重定向到 GitHub raw（L426-431）
3. `_setup_static_files` → SPA 静态文件服务（L434）
4. SPA catchall `/{path:path}` → 返回 index.html（L468-484）

## SPA catchall 实现（main.py L468-484）

```python
@app.get("/{path:path}")
async def serve_spa_catchall(request: Request, path: str):
    if path.startswith("api/") or path.startswith("health"):
        raise HTTPException(status_code=404)
    file_path = frontend_dist / path
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)
    return FileResponse(frontend_dist / "index.html")
```

## /raw 端点实现（api/files.py L385-460）

- `GET /api/v1/entries/{slug}/raw` → 结构化 JSON
- 公开 entry 免认证，私有 entry 需 API key
- 返回 `RawFileItem` 列表（文本文件含 content，二进制文件 content=null + file_url）
- 认证逻辑：global_key_auth 分支 + 常规 auth 分支（get_current_user + share cookie fallback）

## 前端路由（frontend-v3/src/router.ts）

- `/` — Landing
- `/explore` — 列表页
- `/settings/apikeys` — API Key 管理
- `/:slug` — Entry 详情页（动态路由）

## P1 requires_minimal_validation: true

P1 声明了 `requires_minimal_validation: true`，P2 必须产出 `minimal_validation:` 块且 result 为 confirmed。
验证对象：Content Negotiation 的 Accept header 优先级解析行为（RFC 7231），需用 curl 实测确认。

## P2 评审映射

按 C8 机械映射：T053 无 frontend domain、risk_level=medium、业务方向明确 → P2 不触发评审。
P2-review.md 不需要（gate 规则"文件存在时检查"）。

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
