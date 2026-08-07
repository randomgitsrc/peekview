---
phase: P5
task_id: T086-admin-settings-consolidation
type: test-results
parent: P4-implementation-retry2.md
trace_id: T086-P5-20260807-retry1
status: draft
created: 2026-08-07
agent: verifier
---

# P5 E2E 测试结果（Playwright）— T086（重试 #1，全量重跑）

## 命令

`E2E_SPEC=e2e/admin.spec.ts make debug-test`

## 环境

- debug backend: `make debug-start` → http://127.0.0.1:8888
- 测试数据: `make debug-seed` → 20 entries, users alice/bob/carol/dave (dave disabled)
- Playwright projects: chromium + Mobile Chrome，2 workers，CDP Chrome (`http://127.0.0.1:18800`)
- e2e-safety-check.sh 前置检查全部通过（运行方式正确 / 调试服务运行中 / 使用独立数据库）
- 生产数据库快照：运行前 41 条 entries，运行后（`make debug-stop` 之后手工核查）仍为 41 条，未变化

## 结果（原始输出，全量重跑）

exit code: 2（`make: *** [Makefile:638：debug-test] 错误 1`）

test runner 输出签名（可 grep，Playwright line reporter 原始行）：
```
2 failed
2 flaky
2 did not run
30 passed (40.3s)
```

test runner 输出签名（可 grep 前缀形式）：
```
passed: 30
failed: 2
```

- Running 36 tests using 2 workers（chromium + Mobile Chrome 各 18 条，符合预期约 36 条）
- 30 passed
- 2 failed（真失败，非 flaky，各重试 2 次后仍失败）
- 2 flaky（首次超时，重试后通过）
- 2 did not run（因 `test.describe.configure({ mode: 'serial' })` 全文件单一 describe，BDD-11 在两个 project 各自失败后，同 project 内后续 BDD-12 级联跳过）

## 与上一轮对照：路由修复（BDD-8/9/10）已验证真正修复

上一轮真失败的 3 条（同根因，`/admin` 被 `/:slug` 拦截）本轮**全部真正执行并通过**：

| 用例 | 上一轮 | 本轮 |
|------|--------|------|
| BDD-14 → T086 BDD-9（non-admin 访问 /admin 得 404，无 redirect） | FAILED（2 projects，超时等 `.not-found`） | **PASSED**（2 projects） |
| BDD-15 → T086 BDD-10（未登录访问 /admin 得 404） | did not run（级联跳过） | **PASSED**（2 projects） |
| T086 BDD-08（admin 访问 /admin 也得 404） | did not run（级联跳过） | **PASSED**（2 projects） |

`router.ts` 新增的 `/admin` → `NotFoundView` 显式路由（插在 `/:slug` 之前）已确认生效，`.not-found` 断言真正通过，非级联误判。

其余上一轮因级联未执行、判断"大概率不受根因影响"的用例，本轮也真正执行：

| 用例 | 上一轮 | 本轮 |
|------|--------|------|
| T086 BDD-07（未登录访问 /settings?tab=user-manager 重定向到 /） | did not run | **PASSED**（2 projects） |
| T086 BDD-11（admin 通过 UserMenu → Settings 到达 user-manager） | did not run | **FAILED（新真失败，见下）** |
| T086 BDD-12（非 admin UserMenu Settings 入口不落到 user-manager tab） | did not run | **did not run（本轮再次因 BDD-11 失败被级联跳过）** |

## 新发现的真失败（2 failed，均为 T086 BDD-11）

`e2e/admin.spec.ts:269:3` — **T086 BDD-11**：`admin reaches user-manager via UserMenu Settings entry`

- 失败于 `[chromium]` 和 `[Mobile Chrome]` 两个 project，各自初次尝试 + 2 次重试（共 3 次）均失败，非偶发，判定为**真失败**
- 报错：
  ```
  Error: expect(locator).toBeVisible() failed

  Locator: locator('[data-testid="user-manager-content"]')
  Expected: visible
  Error: strict mode violation: locator('[data-testid="user-manager-content"]') resolved to 2 elements:
      1) <div ... class="user-manager-tab" data-testid="user-manager-content">…</div> aka getByTestId('user-manager-content').first()
      2) <div ... class="user-manager-tab" data-testid="user-manager-content">…</div> aka locator('section').filter({ hasText: '用户管理用户管理' }).getByTestId('user-manager-content')

    274 |     await page.locator('[data-testid="user-menu-settings-item"]').click()
    275 |     await page.waitForURL('**/settings?tab=user-manager', { timeout: 10000 })
  > 276 |     await expect(page.locator('[data-testid="user-manager-content"]')).toBeVisible({ timeout: 10000 })
        |                                                                        ^
  ```

### 根因排查（只读代码核查，未做修复）

`frontend-v3/src/views/SettingsView.vue`（14/26/33 行）：桌面版 tab 内容和移动端堆叠展示是**两套并存的 DOM 结构**，靠纯 CSS `display` 切换，不是 `v-if`：

```
26:  <div class="tab-content desktop-only">   ← 内含 <UserManagerTab> 等 tab 组件
33:  <div class="mobile-stacked mobile-only"> ← 也内含 <UserManagerTab> 等 tab 组件（堆叠展示）
185: .desktop-only { display: block; }
186: .mobile-only { display: none; }
189/190: @media(...) { .desktop-only:none; .mobile-only:block; }
```

`UserManagerTab.vue` 根元素 `<div class="user-manager-tab" data-testid="user-manager-content">`（第 2 行）在 `isAdmin` 且 `tab=user-manager` 时，会同时被 `desktop-only` 和 `mobile-only` 两个容器各渲染一份 —— **两份都在 DOM 里，只是 CSS 控制可见性，不是移除节点**。所以任何不带视口 scope 的 `[data-testid="user-manager-content"]` 选择器必然命中 2 个元素，触发 Playwright strict-mode violation。

这与 BDD-01/02 的测试写法形成对照：BDD-01/02（`admin.spec.ts:95-125`）已经用 `scopeOf(vp.name)`（即 `.desktop-only` / `.mobile-only` 前缀）来消歧同一个组件的两份渲染，说明这个"桌面/移动双渲染 + CSS 切换"是**已知的既有模式**（P0-brief"移动端：settings 移动端是堆叠式全展示"已列为 known_risk）。但 **T086 BDD-11/BDD-12（第 269/279 行）的选择器没有加视口 scope**，直接查 `[data-testid="user-manager-content"]`，因而撞上这个已知模式导致的歧义。

### 判定：真失败，不是 flaky，不是环境问题

- 3 次尝试（1 初次 + 2 重试）× 2 projects 全部同样报错，模式完全一致（strict-mode violation，非超时/网络类抖动）
- 非本次路由修复引入（`git diff` 只改了 `router.ts`，未碰 `SettingsView.vue`/`UserManagerTab.vue`/`admin.spec.ts`），是**测试代码本身的选择器缺陷**（未跟随既有的 desktop/mobile scope 约定），在 BDD-11 首次真正被执行时才暴露（上一轮因级联跳过从未跑到过）
- 是否需要回 P4（改测试选择器）或算作 P1/P3 遗留缺口，由主 Agent 判定；本报告只客观记录现象与根因，未做任何修复

## 级联未执行（2 did not run）

`T086 BDD-12`（`admin.spec.ts:279`，非 admin UserMenu Settings 入口不落到 user-manager tab）在两个 project 均因同 describe 内 BDD-11 失败而被 `serial` 模式级联跳过，本轮仍未能真正验证。**这是本轮唯一仍未被真正执行验证的 BDD**。

## Flaky 详情（2 flaky，重试后通过，不计入失败，与上一轮同类）

- `[Mobile Chrome] BDD-01: admin sees paginated user list on user-manager tab [desktop]`（`admin.spec.ts:95`）— 首次 `waitForSelector('.desktop-only .admin-user-list, ...')` 超时，retry 后通过
- `[Mobile Chrome] BDD-02: user list shows status badges [desktop]`（`admin.spec.ts:113`）— 首次 `waitForSelector('.desktop-only .admin-user-row, ...')` 超时，retry 后通过

与上一轮完全同类（同用例、同 project、同选择器、同超时模式），判定为环境时序抖动，不算真失败，继续记录在案供 P6 关注。

## Passed（30）

覆盖 BDD-01/02/06/12/20/21（desktop+mobile 双 viewport，含 2 条 flaky 重试后通过）+ BDD-07/08/09/10（原 BDD-14/15 legacy 编号）全部真正执行并通过。**路由修复（P4-retry2）目标达成**：`/admin` 现在对所有角色（admin/非 admin/未登录）都真正落到 `NotFoundView`（`.not-found` 可见），无 redirect。

## 环境隔离核查

- E2E 全程针对 `http://127.0.0.1:8888`（debug backend），`admin.spec.ts` 的 `beforeAll` 硬编码拒绝 `:8080`/`prod`，未触发
- E2E 开始前手工核查生产库 `~/.peekview/peekview.db`：`SELECT COUNT(*) FROM entries` = 41
- `make debug-stop` 后再次核查：`SELECT COUNT(*) FROM entries` = 41，与运行前一致，未变化
- `/tmp/peekview-debug/` 已随 `make debug-stop` 清理

**[PROD_NOT_TOUCHED]**

## 结论

E2E gate **仍未通过**（exit 2）。但本轮全量重跑证实：

1. **P4-retry2 的路由修复已生效**：T086 BDD-8/9/10（原根因所在的 3 条用例）全部真正执行并通过，无回归、无级联跳过
2. **发现一个新的、独立的真失败**：T086 BDD-11（UserMenu → user-manager tab 断言未做视口 scope，撞上 desktop/mobile 双渲染的已知既有模式），导致 BDD-12 继续被级联跳过，是本轮唯一仍未验证的 BDD
3. 单测（1228 passed）与 typecheck（0 错误）均全绿，无回归

判定：**真失败，需回 P4**（或由主 Agent 判定是否属于测试代码缺陷，走针对性修复：为 BDD-11/BDD-12 的 `[data-testid="user-manager-content"]` 选择器加视口 scope，与 BDD-01/02 一致）。修复后需再次全量重跑本 spec，覆盖被级联跳过的 BDD-12。
