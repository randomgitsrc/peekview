---
phase: P5
task_id: T086-admin-settings-consolidation
type: test-results
parent: P4-implementation.md
trace_id: T086-P5-20260807
status: draft
created: 2026-08-07
agent: verifier
---

# P5 E2E 测试结果（Playwright）— T086

## 命令

`E2E_SPEC=e2e/admin.spec.ts make debug-test`

## 环境

- debug backend: `make debug-start` → http://127.0.0.1:8888（health 200）
- 测试数据: `make debug-seed` → 20 entries, users alice/bob/carol/dave (dave disabled)
- Playwright projects: chromium + Mobile Chrome，2 workers，CDP Chrome (`http://127.0.0.1:18800`)
- e2e-safety-check.sh 前置检查全部通过（运行方式正确 / 调试服务运行中 / 使用独立数据库 / 生产数据库条目数快照 41）

## 结果（原始输出）

exit code: 2

test runner 输出签名（可 grep，Playwright line reporter 原始行）：
```
2 failed
2 flaky
10 did not run
22 passed (59.8s)
```

test runner 输出签名（可 grep 前缀形式）：
```
passed: 22
failed: 2
```

- Running 36 tests using 2 workers（chromium + Mobile Chrome 各 18 条，符合 P3 预期约 36 条）
- 22 passed
- 2 failed（真失败，非 flaky，各重试 2 次后仍失败）
- 2 flaky（首次超时，重试后通过）
- 10 did not run（因 `test.describe.configure({ mode: 'serial' })`，同 project 内某用例失败后级联跳过后续用例）

## 真失败详情（2 failed）

`e2e/admin.spec.ts:234:3` — **BDD-14（legacy 编号，本任务重写 → T086 BDD-9）**：`non-admin visiting /admin gets 404, no redirect`

- 失败于 `[chromium]` 和 `[Mobile Chrome]` 两个 project，各自重试 2 次（共 3 次尝试）均失败，非偶发
- 报错：
  ```
  TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
  Call log:
    - waiting for locator('.not-found') to be visible

    237 |
    238 |     await page.goto(`${BASE_URL}/admin`)
  > 239 |     await page.waitForSelector('.not-found', { timeout: 10000 })
        |                ^
    240 |     expect(page.url()).toContain('/admin')
    241 |     await expect(page.locator('.not-found')).toBeVisible()
  ```

### 根因（已代码核查确认，非环境问题）

`frontend-v3/src/router.ts` 路由注册顺序：

```
32:  { path: '/:slug', name: 'detail', component: EntryDetailView, ... }   ← 第 32-37 行
38:  { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView }  ← 第 38-42 行
```

`/admin` 是单段路径，会被排在前面的 `/:slug`（详情页路由）捕获，当作 `slug="admin"` 走 `EntryDetailView`，**永远不会落到** `/:pathMatch(.*)*` 这条真正的 404 路由。已用 curl 验证后端行为正确：

```
GET /api/v1/entries/admin → 404
{"error":{"code":"NOT_FOUND","message":"Entry not found: admin","details":null}}
```

后端 404 语义正确，但 `EntryDetailView.vue` 收到该 404 后渲染的 DOM 里**没有 `.not-found` class**（该 class 只存在于 `NotFoundView.vue`），所以测试的 `waitForSelector('.not-found')` 必然超时。这与 P0-brief 的用户拍板「删除 `/admin` 路由，不做 redirect，旧书签 404」的预期行为不符——当前实现下 `/admin` 实际上是"当作 slug 查详情页，条目不存在"，不是路由层 404。

### 影响范围（因 serial 级联未执行，但同根因大概率同样失败）

以下 3 条测试因 serial 模式在 BDD-14 失败后被跳过（`did not run`），未能实际验证，但走的是**同一条 `/admin` URL + 同一段 `.not-found` 断言逻辑**，与 BDD-14 根因完全一致，需在 P4 修复后重新在本次全量重跑中验证：
- `BDD-15`（unauthenticated visiting /admin gets 404, no redirect）— `admin.spec.ts:244`
- `T086 BDD-08`（admin visiting /admin also gets 404）— `admin.spec.ts:252`

以下 2 条也因级联被跳过，但与 `/admin` 路由无关（走 `/settings?tab=user-manager` 或 UserMenu 入口），大概率不受此根因影响，仍需在重跑时补充验证：
- `T086 BDD-07`（unauthenticated visiting /settings?tab=user-manager redirected to /）— `admin.spec.ts:262`
- `T086 BDD-11`（admin reaches user-manager via UserMenu Settings entry）— `admin.spec.ts:269`
- `T086 BDD-12`（non-admin UserMenu Settings entry does not land on user-manager tab）— `admin.spec.ts:279`

（`test-results/` 目录佐证：仅 BDD-14 对应的 hash `bf30b` 有失败截图/trace 产出，BDD-15/BDD-08/BDD-07/BDD-11/BDD-12 对应目录均不存在，证实它们从未真正执行。）

## Flaky 详情（2 flaky，重试后通过，不计入失败）

- `[chromium] BDD-01: admin sees paginated user list on user-manager tab [desktop]`（`admin.spec.ts:95`）— 首次 `waitForSelector('.desktop-only .admin-user-list, ...')` 超时，retry #1 通过
- `[Mobile Chrome] BDD-02: user list shows status badges [desktop]`（`admin.spec.ts:113`）— 首次 `waitForSelector('.desktop-only .admin-user-row, ...')` 超时，retry #1 通过

两者均为首屏渲染/CDP 环境下的时序抖动（同一断言在 retry 后稳定通过），不判定为真失败，但记录在案供 P6 关注。

## Passed（22）

覆盖 desktop/mobile 双 viewport 的 BDD-01/02/06/12/20/21（含 flaky 重试后通过的 2 条），共同验证了：user-manager tab 数据加载、状态徽章、admin 自我保护（禁用/降级/删除自己均被拦截）、重置密码对话框校验逻辑，均在 `/settings?tab=user-manager` 新路径下工作正常。

## 环境隔离核查

- E2E 全程针对 `http://127.0.0.1:8888`（debug backend），`admin.spec.ts:35-37` 的 `beforeAll` 硬编码拒绝 `:8080`/`prod`，未触发
- E2E 开始前 `e2e-safety-check.sh` 记录生产数据库条目数快照：41
- `make debug-stop` 后手工核查生产库 `~/.peekview/peekview.db`：`SELECT COUNT(*) FROM entries` = 41，与 E2E 运行前快照一致，未变化
- `/tmp/peekview-debug/` 已随 `make debug-stop` 清理，无残留进程

**[PROD_NOT_TOUCHED]**

## 结论

E2E gate **未通过**（exit 2，2 个真失败 + 10 个因级联未执行）。真失败根因已定位到 `frontend-v3/src/router.ts` 路由注册顺序问题（`/:slug` 先于 `/:pathMatch(.*)*` 捕获 `/admin`），与本任务「删除 `/admin` 路由使其 404」的验收条件（P0-brief BDD-9/10 对应）直接相关，判定为**真 bug，需回 P4 修复**，不属于环境问题或 flaky。修复后需重新执行 `E2E_SPEC=e2e/admin.spec.ts make debug-test` 全量重跑（覆盖被级联跳过的 10 条，不能只测修复的那一条）。
