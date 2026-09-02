# P5 测试结果 — e2e.md（TPV0095 team-visibility）

> verifier subagent 产出（P5 模式）。ui_affected: true → E2E 实跑必须。
> 环境：debug server :8888（主 Agent 持住，已 debug-seed + build-frontend 重建 static）；
> CDP Chrome :18800。截图存 /tmp/e2e-results/（E2E 框架输出）与 CDP 手动验证截图。
> 状态：`[PROD_NOT_TOUCHED]`

## P5_e2e_a：team-visibility.spec.ts（BDD-38~41、BDD-43）

命令：`E2E_SPEC=e2e/team-visibility.spec.ts make debug-test`

- **结果：12/12 passed（chromium 6 + Mobile Chrome 6），22.7s，exit 0** ✓
- 覆盖：BDD-38（5-tab 互斥高亮 + team chip URL ?team=）、BDD-39（team badge 不叠加 private）、
  BDD-40（team entry 无 visibility-toggle + delete 保留）、BDD-41（?team= 不可用态 + 清除 CTA）、
  BDD-43（移动端 tab 横滚 + ≥44px + aria-selected）
- 截图：/tmp/e2e-results/tpv0095-bdd39-team-badge.png、tpv0095-bdd41-team-unavailable.png、tpv0095-bdd43-mobile-tabs.png
- 前置：首轮被 stale-static 预检 FATAL 拦截（P4 review-fix 后 static 未重建）→ `make build-frontend` 后通过；
  且 debug DB 原为空（无 seed 用户）→ login 401 → `make debug-seed` 后通过

## P5_e2e_b：teams-page.spec.ts（BDD-42）

命令：`E2E_SPEC=e2e/teams-page.spec.ts make debug-test`

- **结果：12 passed + 2 failed（1.5m），exit 2**
  - passed 12：BDD-42 双入口 2 用例 + 匿名守卫 + 新建团队 + 成员添加失败三文案 + 删除确认框（×2 项目 chromium/Mobile Chrome）
  - failed 2：`BDD-42: 成员退出需确认，确认后从「我加入的」消失；owner 不显示退出按钮`（chromium + Mobile Chrome，各 retry 3 次仍败）

### failed 逐项判定：E2E spec fixture 缺陷（非产品 bug）—— CDP 实测产品行为正确

失败点：teams-page.spec.ts:221 `await login(page)`（默认 alice）
- 同一 test 内 line 206 已 `login(page, 'bob')` → **bob session 未登出**（spec 无登出步骤，beforeEach clearCookies 只在用例间生效）
- line 221 二次 login 时页面仍显示 bob 已登录态（avatar "B bob"）→ explore 无 "Sign in" 按钮 → `waitFor 15000ms` 超时
- **page snapshot 铁证**（error-context.md）：explore 顶部 `button "B bob"` 存在、无 Sign in 按钮

CDP 手动验证（:18800 实跑，证明产品行为符合 BDD-42 语义）：
1. bob 登录 → /teams → joined 分区显示 `Proj A #proj-a 1 成员 退出团队`（退出按钮存在）✓
2. 点退出 → alertdialog 出现，文案「退出团队「Proj A」退出后将无法查看该团队的团队内内容。确认退出？」✓
3. 确认 → proj-a 从 joined 消失（JOINED_AFTER_HAS_PROJ: false）✓
4. owner（alice）视角 → owned 团队无退出按钮（OWNER_LEAVE_BTN_COUNT: 0）✓
5. fixture 恢复：bob 重新加入 proj-a（API 201）✓

**判定**：产品实现正确；teams-page.spec.ts 成员退出用例存在 fixture 缺陷
（同 test 内 bob→alice 二次 login 缺登出；spec 未给 bob 建"已加入 alice team"的 fixture——即使补了，
二次 login 仍会失败）。属**测试代码缺陷 → 需回 P4 修 spec**（主 Agent 判定；verifier 不修改测试代码）。

## UI 截图证据（手动 CDP 验证，临时脚本已清理；如需留存可移至 evidences/）

- bob /teams joined 含 proj-a + 退出按钮（前轮 dump 截图已删）
- bdd42-leave-confirm.png（退出确认框）
- bdd42-after-leave.png（退出后 joined 空）
- 均存于临时目录，未纳入任务目录

## E2E 汇总

- **E2E：12/12（a）+ 12/14 用例通过、2 failed 为 spec fixture 缺陷（产品行为 CDP 实测正确）**
- a spec 全绿；b spec 产品行为正确、测试代码 1 用例（×2 项目）缺陷待 P4 修

EXIT_CODE: 0

## E2E_b 修复后重跑（主 Agent 2026-09-03）

teams-page.spec.ts fixture 缺陷（bob 登录后二次 login 无登出）已修（:220 切 alice 前 clearCookies + goto）→ 重跑 **14/14 passed**（17.8s）。
E2E 总计：team-visibility.spec.ts 12/12 + teams-page.spec.ts 14/14 = **26/26 全绿**。
EXIT_CODE: 0
