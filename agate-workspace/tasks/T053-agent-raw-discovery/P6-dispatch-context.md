# T053 P6 派发上下文

> 主 Agent 派发前查证的客观信息。不含 PASS/FAIL 预判。

## P1 BDD 条件（20 条）

B1: Content Negotiation — JSON 优先
B2: Content Negotiation — HTML 优先
B3: Content Negotiation — 通配符不触发 JSON
B4: Content Negotiation — 浏览器 Accept 返回 HTML
B5: Content Negotiation — text/html 存在时 HTML 胜出（SCOPE+ 修正）
B6: Content Negotiation — 私有 entry 未认证返回 404
B7: Content Negotiation — 私有 entry 已认证返回 JSON
B7b: Content Negotiation — admin 访问私有 entry 返回 JSON
B8: Content Negotiation — 不存在 slug 返回 404 JSON
B9: Content Negotiation — 不存在 slug HTML 模式返回 SPA 页面
B10: HTML <link> 注入 — 有效 slug
B10b: HTML <link> 注入 — 私有 entry 也注入
B11: HTML <link> 注入 — 不存在 slug 不注入
B12: HTML <link> 注入 — 前端路由不注入
B13: HTTP Link header — 有效 slug
B13b: HTTP Link header — 私有 entry 也添加
B14: HTTP Link header — 不存在 slug 不添加
B15: llms.txt — 包含 /raw 和 Content Negotiation 描述
B16: 端到端 — Agent 通过 Accept 直接获取 JSON
B17: 端到端 — Agent 通过 <link> 发现 /raw

## P5 验证结果

- 851 pytest passed
- 33 content_negotiation tests passed
- curl 实测 B1/B2/B3/B5/B8/B9/B10/B12/B13 PASS
- ruff 无新增错误

## 验收环境

- debug backend: make debug-start (:8888)
- 测试 entry 创建: curl -X POST http://127.0.0.1:8888/api/v1/entries
- 私有 entry 创建: 需先注册用户 + 登录获取 cookie
- admin 用户: 需注册第一个用户（自动成为 admin）

## P2 gate_commands

- P5: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no"

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P6

路径：agate/phase-cards/P6-acceptance.md
---
# P6 — 验收

> 当前状态：[首次 / 重试 #N]
> P6 不可裁剪（验收是质量最后防线）

## 如果是首次进入本阶段

1. 派发 verifier subagent → 产出 P6-acceptance.md + 验证脚本
2. 主 Agent 执行验证脚本（不信任 subagent 自跑）
3. 主 Agent 逐条确认 BDD PASS/FAIL（证据文件存在且数量对）
4. 预跑 check-gate.sh P6
5. 更新 .state.yaml phase=P6 → P7

## 如果是重试

确认上一轮失败原因（BDD 未全部覆盖 / 证据缺失 / 脚本执行失败）
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P6 MAX=3）

## 前置条件

- [ ] P5 test-results 存在且全绿

## 派发

- **角色**：verifier（`{agate_root}/assets/execution-roles/verifier.md`）
- **输入**：P1-requirements.md（BDD 条件）+ P2-design.md（gate_commands）+ P5-test-results/
- **输出**：P6-acceptance.md + 验证脚本（存入 P6-evidence/）

## 产出规格

- P6-acceptance.md 含每条 BDD 的 PASS/FAIL 判定
- 每条 PASS 有证据引用（P6-evidence/ 下的文件）
- 验证脚本可执行（主 Agent 亲自跑）

## gate 规则

```bash
check-gate.sh P6 $TASK_DIR
```

- BDD PASS/FAIL 总数 ≥ P1 BDD 总数
- P6-evidence/ 非空
- 每条 PASS 行引用的证据文件存在

## 推进条件

- [ ] P6-acceptance.md 存在
- [ ] 每条 P1 BDD 有验收结果（PASS 或 FAIL）
- [ ] P6-evidence/ 非空
- [ ] 无 FAIL（有则 PAUSED 或回退 P4）

## 常见错误

1. **"代码看起来对"**：P6 必须实跑，不接受目测
2. **证据缺失**：每条 PASS 必须有证据文件
3. **挑验**：不能只验部分 BDD，必须全量对照
4. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你

## 下游影响

- P7 一致性检查参考 P6 验收结果
- P8 发布依赖 P6 全 PASS

> 完成 → 读 phase-cards/P7-consistency.md
<!-- AGATE_CARD_END -->
