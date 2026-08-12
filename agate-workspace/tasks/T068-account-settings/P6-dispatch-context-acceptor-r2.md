---
phase: P6
task_id: T068-account-settings
role: acceptor
round: 2
created: 2026-07-23
---

# P6 派发指引 — acceptor (round 2, fix 后重验)

## 目标

P4 fix round 修了 3 个 bug 后，重新逐条实跑 P1 的 14 条 BDD。

## 上一轮失败项（重点验证）

1. **BDD-03**: display_name 清空 — 前端改为发空字符串 `""`
2. **BDD-08**: API key 创建 — 后端 apikey_service.py `is None` → `.is_(None)`
3. **BDD-06 side-effect**: 旧密码错误登出 — 后端 401 → 400

## 全部 BDD 清单（14 条）

1. BDD-01: Profile tab 展示用户信息
2. BDD-02: 编辑 display_name 成功
3. BDD-03: 清空 display_name（重点）
4. BDD-04: display_name 超长校验
5. BDD-05: Security tab 改密码成功
6. BDD-06: 改密码旧密码错误（重点：不再登出）
7. BDD-07: 改密码后无需重新登录
8. BDD-08: API Keys tab 功能完整（重点：创建 key）
9. BDD-09: 未登录访问 /settings 重定向
10. BDD-10: 旧路由 /settings/apikeys 重定向
11. BDD-11: Tab 切换与 URL 同步
12. BDD-12: PATCH /auth/me 未认证拒绝
13. BDD-13: PATCH /auth/me 输入校验
14. BDD-14: 移动端设置页可用

## 验证环境

- Debug backend: http://127.0.0.1:8888
- Seed data: alice/bob/carol (password: testpass123)
- Playwright CDP: chromium.connectOverCDP('http://127.0.0.1:18800')
- 截图保存到: /tmp/t068-p6r2-screenshots/

## 后端 BDD 验证方式（BDD-12, BDD-13）

curl 直接调 API。

## 前端 BDD 验证方式（BDD-01~11, BDD-14）

Playwright CDP 截图 + 页面交互。

## Playwright 关键约束

- 必须用 CDP 模式：`chromium.connectOverCDP('http://127.0.0.1:18800')`
- 不要 `browser.close()`
- 脚本必须 `try/finally { page.close(); context.close(); process.exit(0) }`
- 运行：`NODE_PATH=/home/kity/.nvm/versions/node/v24.15.0/lib/node_modules npx tsx script.ts`
- 移动端：`browser.newContext({ viewport: { width: 375, height: 812 } })`

## 输出

1. docs/tasks/T068-account-settings/P6-acceptance.md
2. /tmp/t068-p6r2-screenshots/*.png

P6-acceptance.md Header：
```
---
phase: P6
task_id: T068-account-settings
type: acceptance
parent: P1-requirements.md
trace_id: T068-P6R2-20260723
status: draft
created: 2026-07-23
agent: acceptor
round: 2
---
```

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P6

路径：agate/phase-cards/P6-acceptance.md
---
# P6 — 验收

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → P6 不可裁剪。no_behavior_change 可简化（快速验收），不可省略。

## 如果是首次进入本阶段

1. 派发 verifier subagent → 产出 P6-acceptance.md + P6-evidence/
   1.1 写 P6-dispatch-context-verifier.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. UI 任务：派 vision-analyst → 产出 vision-reports/
3. 主 Agent 逐条核实 BDD 对照结果
4. **先验证功能（用户视角），再满足 gate 格式**（T046 教训：别反过来）
5. **运行 `bash $AGATE_ROOT/scripts/check-p6-format.sh --fix "$TASK_DIR/P6-acceptance.md"`** 归一化 PASS/FAIL 大小写和行首空白（verifier 产出后、gate 前，① 自动格式化）
6. 预跑 check-gate.sh P6 + check-p6-evidence.sh + check-p6-provenance.sh
7. git commit → 更新 .state.yaml phase=P6 → P7

## 如果是重试

确认上一轮失败原因（BDD 不覆盖 / 证据不足 / gate 格式拦截）
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P6 MAX=2）

## 核心原则 ⚠️

**先验证功能（用户视角），再满足 gate 格式。** gate 是必要条件（格式不对 → commit 不了），不是充分条件（格式对了 ≠ 功能正确）。T046 教训：花 2 小时凑 PASS 格式，没花 5 分钟检查 API 响应头。

## 前置条件

- [ ] P1-requirements.md BDD 验收条件完整（含 SCOPE+ 增补）
- [ ] P1 声明的 capability_requirements 中 ability 为 available

## 派发

- **角色**：verifier（`{agate_root}/assets/execution-roles/verifier.md`）
- **UI 任务追加**：vision-analyst（`{agate_root}/assets/execution-roles/vision-analyst.md`）
- **输入**：P1-requirements.md + P5-test-results/
- **输出**：P6-acceptance.md + P6-evidence/

## 产出规格

### P6-acceptance.md

- BDD 逐条对照，每条只允许 PASS 或 FAIL（不允许"调整/跳过/覆盖"）
- 所有 PASS 必须有文件引用：`- PASS Bxx: 描述 (p6-bxx.png)` 或响应日志/断言文件
- UI 任务：操作类 BDD 截图必须互不相同（md5 去重），查询类 BDD 可不截图但须有断言记录文件
- UI 任务：每条 UI 类 PASS 含 vision 引用：`(vision: vision-reports/bxx.yaml)`

**PASS 行最小格式规范**：

```
- PASS {BDD编号}: {描述} ({证据路径})
```

证据路径格式：
- 截图：`(screenshots/{filename}.png)`
- vision：`(vision: vision-reports/{filename}.yaml)`
- 其他：`(result.json)` / `(assert.log)` / `(P6-evidence/{filename})` / ...
- 多文件引用（逗号分隔）：`(file1.json, file2.log)` / `(screenshots/a.png, screenshots/b.png)`

描述文本可自由添加，不影响解析（provenance 脚本用精确正则提取路径）。

### P6-evidence/

- 必须非空，每个文件含实质内容（截图 >1KB，断言文件含实际输出）
- 不接受 1 行文本文件充数（T046 教训：15 个 1 行 txt 文件凑 provenance 数量）
- 元素级截图建议使用父级元素 + padding，避免过小截图（≤1KB 虽不阻断但会触发 WARNING）
- 操作类 BDD 截图必须互不相同（md5 完全重复会被 hook 硬阻断，无例外）。
  若某个行为差异类 BDD 天然会产出视觉相同的页面（如两个不同查询都命中同一个空状态），
  优先改用非截图证据（断言日志 / response.json）而非截图，或截图时带上能体现差异的元素
  （如带时间戳的调试面板、高亮差异区域），确保截图本身逐字节不同。
  查询类 BDD 本来就可以不截图，这类场景应优先归为查询类而非勉强用截图。

### vision-helper 结论绑定 ⚠️

- `ui_affected: true` 时至少一条 PASS 基于 vision-helper 报告
- vision-helper 报 `blocker_count > 0`：不能仅用程序化指标（naturalWidth>0, complete=true, HTTP 200）反驳
- 必须追查根因（curl -I 检查响应头 / DevTools Network / API 日志），追查结果写入 P6-acceptance.md

## gate 规则

```bash
check-p6-format.sh --fix $TASK_DIR/P6-acceptance.md  # ① 自动格式化（verifier 产出后、gate 前）
check-gate.sh P6 $TASK_DIR      # FAIL=0 / NEED_CONFIRM=0 / 总数>0
check-p6-evidence.sh $TASK_DIR  # 证据目录非空 / UI截图>1KB / md5去重
check-p6-provenance.sh $TASK_DIR # 证据-结论对应 / dispatch-context审计 / BDD对照
```

- FAIL > 0 → gate exit 1 → 回 P4
- NEED_CONFIRM > 0 → gate exit 1 → PAUSED（无行首 `[NEED_CONFIRM]` 时写 `[NO_NEED_CONFIRM]` 为合规负向声明）

格式问题 → 运行 check-p6-format.sh --fix 归一化 → 再验 gate → … → 通过（⑩迭代循环，格式迭代和 gate 重试共享 retry 预算）

## 推进条件

- [ ] 所有 BDD PASS（FAIL=0）
- [ ] 无行首 `[NEED_CONFIRM]`（`[NO_NEED_CONFIRM]` 为合规负向声明）
- [ ] P6-evidence/ 目录非空 + 证据文件被引用
- [ ] UI 任务：vision-helper blocker_count=0 或 blocker>0 已追查
- [ ] provenance 审计通过

## 常见错误（T046 实证）

1. **用 DOM 属性替代视觉验证**：img.src 被重写 = 图片显示正常。不对——还有 Content-Type、CORS、CSP 等 100 种原因导致图片不渲染。**vision-helper 说破了就是破了**
2. **凑 PASS 数量**：deferred BDD 标 PASS、用 1 行文本文件充证据 → provenance 审计能通过但功能不对
3. **只验证中间指标不验证用户结果**：naturalWidth>0, complete=true, API 返回 200 → 结论"功能正常"。用户看到的：破图。**问自己：用户看到了什么**
4. **收到视觉否定先反驳**：vision-helper 报异常 → 先 curl -I 查响应头 → 再决定是 vision 误报还是真问题。T046：三次视觉否定被三次程序化指标反驳，15 分钟浪费

gate 不过 ≠ 你失败了。红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- P7 一致性检查依赖 P6 的 BDD 对照结果
- 验收结果是判定任务成败的最终依据——P8 发布只是机械步骤

## 自查≠gate
写完验证脚本后应自跑确认脚本可执行（自查），但自查通过 ≠ P6 gate 通过。
P6 gate 由主 Agent 亲自执行验收检查，结果以主 Agent 为准。
不要在返回中声称"验收已通过"或"全部 BDD PASS"——只返回路径 + 摘要。

> 完成 → 读 phase-cards/P7-consistency.md
<!-- AGATE_CARD_END -->
