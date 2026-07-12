# T053 P4 派发上下文

> 主 Agent 派发前查证的客观信息。不含 PASS/FAIL 预判。

## P3 TDD 状态

- 33 tests, 15 true red, 18 passed (HTML 默认行为)
- 测试文件：backend/tests/test_content_negotiation.py
- 红灯覆盖：B1, B5(html_q_zero), B6, B7, B7b, B8, B10, B10b, B13, B13b, B16, B17, _prefers_json unit
- 绿灯覆盖：B2, B3, B4, B5(q值HTML胜出), B9, B11, B12, B14 等默认HTML行为

## P2 方案核心

- 方案 A（catchall 内联实现）
- 核心改动：main.py serve_spa_catchall 函数
- 新增模块级函数：_prefers_json, _is_frontend_route, _slug_exists, _inject_link
- 提取共享函数：api/files.py resolve_entry_raw（从 get_entry_raw 提取）
- /raw 端点改为调用 resolve_entry_raw（行为不变）
- catchall 调用 resolve_entry_raw（安全边界一致）

## P2 files_to_read

- backend/peekview/main.py:415-490（SPA catchall 核心）
- backend/peekview/api/files.py:140-230（_is_global_api_key_auth + 认证逻辑）
- backend/peekview/api/files.py:385-506（get_entry_raw 完整实现）
- backend/peekview/api/entries.py:68-128（_check_share_cookie + auth）
- backend/peekview/auth.py:137-196（get_current_user）
- backend/peekview/services/entry_service.py:313-344（get_entry 可见性）
- backend/peekview/models.py（Entry 模型）
- backend/peekview/exceptions.py:55-65（NotFoundError）

## gate_commands（P2 固化）

- P5: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no"

## P4 评审映射

P1 domains 含 security → P4 后需派 cso 评审
P1 domains 含 backend → P4 后需派 review

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P4

路径：agate/phase-cards/P4-implementation.md
---
# P4 — 代码实现

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P4 且有合规理由（check-pruning.sh 已检查）→ 跳过，读 P5 卡片

## 如果是首次进入本阶段

1. 派发 implementer subagent → 产出代码文件
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
- **派发 prompt 模板**：`{agate_root}/assets/templates/dispatch-prompt.md` + 以下阶段特定追加

## 产出规格

- P4-implementation.md 必须声明 `implementation_dir: {实际路径}`
- 代码文件在声明的目录下
- 遵守 P2-design.md 的方案设计 + 现有项目代码规范

## 评审派发（C8 机械映射）

**在 P4 实现完成后、gate 前**，按 P1 声明的 domains 和 risk_level 派评审

## gate 规则（check-gate.sh 会跑）

```bash
check-gate.sh P4 $TASK_DIR
```

- **exit 0**：暂存区含非 md/yaml 代码文件
- **exit 1**：暂存区仅 .md/.yaml 文件（无实际代码变更）

## 推进条件（全部满足才写 phase: P5）

- [ ] 暂存区含代码文件（非 .md/.yaml）
- [ ] 评审完成（若有触发）：P4-review.md status: approved
- [ ] SCOPE+ 已处理（若本阶段产生）
- [ ] git commit 完成

## 下游影响

- P5 验证依赖：P5 跑 gate_commands.P5
- P6 验收依赖：实现路径的端点行为必须可验证

> 完成 → 读 phase-cards/P5-verification.md
<!-- AGATE_CARD_END -->
