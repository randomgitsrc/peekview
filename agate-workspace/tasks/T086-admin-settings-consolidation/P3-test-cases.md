---
phase: P3
task_id: T086-admin-settings-consolidation
type: test-cases
parent: P2-design.md
trace_id: T086-P3-20260807
status: draft
created: 2026-08-07
agent: test-designer
---

# P3-test-cases — T086 admin/settings 信息架构收敛

```yaml
test_code_dir: frontend-v3/e2e/admin.spec.ts, frontend-v3/src/__tests__/t080-admin-route-guard.test.ts
```

## 0. 编号体系说明（先读，否则下表会看不懂）

本任务同时涉及两套 BDD 编号体系，务必区分：

- **T086 编号**（本任务权威编号）：来自 `P1-requirements.md` 第 3 节，`BDD-1`～`BDD-17`。
- **legacy 编号**：`e2e/admin.spec.ts` / 旧 `t080-admin-route-guard.test.ts` 中已存在的 `BDD-01`/`02`/`06`/`12`/`14`/`15`/`20`/`21`（来自更早的 T080 任务目录，与本任务编号不同源，纯属巧合式复用同一前缀）。

迁移策略：legacy 用例保留原编号（不重命名，最小化 diff，遵循 P2-design.md §3.5），新增用例一律加 `T086 BDD-NN` 前缀以避免歧义（尤其 legacy `BDD-12` = "reset password dialog"，与 T086 `BDD-12` = "非 admin UserMenu 无入口" 编号冲突，靠前缀区分）。

## 1. BDD ↔ 测试用例映射表（T086 BDD-1..17 全覆盖）

| T086 BDD | 描述 | 测试用例 | 文件 | 迁移/新增 |
|---|---|---|---|---|
| BDD-1 | admin 看到完整用户列表 | `BDD-01`（列表分页+行）+ `BDD-02`（状态徽章） | e2e/admin.spec.ts | 迁移（URL 换新，选择器按 Advisory Note #1 加 `.desktop-only`/`.mobile-only` 限定） |
| BDD-2 | admin 可执行用户管理操作 | `BDD-12: reset password dialog`（覆盖"任一操作" 中的重置密码） | e2e/admin.spec.ts | 迁移 |
| BDD-3 | admin 不能对自己执行破坏性操作 | `BDD-06`（禁用自己）+ `BDD-20`（降级自己）+ `BDD-21`（删除自己） | e2e/admin.spec.ts | 迁移 |
| BDD-4 | admin 桌面 tab-nav 显示用户管理选项 | `T086 BDD-4: test_bdd_4`（正面：admin 看到 `tab-user-manager` 按钮）+ `test_bdd_14b`（反面：admin 拿到 tab 内容，legacy BDD-14 describe 块内） | t080-admin-route-guard.test.ts | 新增（正面）+ 迁移重写（反面，原 `test_bdd_14b` 测路由级访问，现测 tab 级回退结果） |
| BDD-5 | 非 admin 桌面 tab-nav 不显示用户管理选项 | `T086 BDD-5: test_bdd_5` | t080-admin-route-guard.test.ts | 新增 |
| BDD-6 | 非 admin 手动访问 user-manager tab 回退 profile | `test_bdd_14`（legacy `BDD-14` describe 块内，原测路由级重定向，现测 tab 级回退） | t080-admin-route-guard.test.ts | 迁移重写 |
| BDD-7 | 未登录访问 user-manager tab 沿用既有 settings 守卫 | `T086 BDD-07` | e2e/admin.spec.ts | 新增 |
| BDD-8 | admin 访问 /admin 返回 404 | `T086 BDD-08` | e2e/admin.spec.ts | 新增 |
| BDD-9 | 非 admin 访问 /admin 返回 404（不重定向 /explore） | `BDD-14`（legacy 编号，语义重写为 404 断言） | e2e/admin.spec.ts | 迁移重写 |
| BDD-10 | 未登录访问 /admin 返回 404（不重定向 /） | `BDD-15`（legacy 编号，语义重写为 404 断言） | e2e/admin.spec.ts | 迁移重写 |
| BDD-11 | admin 可从 UserMenu 到达用户管理 | `T086 BDD-11` | e2e/admin.spec.ts | 新增 |
| BDD-12 | 非 admin 的 UserMenu 不出现用户管理入口 | `T086 BDD-12` | e2e/admin.spec.ts | 新增 |
| BDD-13 | admin 移动端可见用户管理区块 | `T086 BDD-13: test_bdd_13` | t080-admin-route-guard.test.ts | 新增 |
| BDD-14 | 非 admin 移动端不出现用户管理区块 | `T086 BDD-14: test_t086_bdd_14` | t080-admin-route-guard.test.ts | 新增 |
| BDD-15 | e2e/admin.spec.ts 全部既有场景在新路径下通过 | 无独立断言——由 e2e/admin.spec.ts 全部 18 个 test()（含 6 个双 viewport）整体在 `E2E_SPEC=e2e/admin.spec.ts make debug-test` 下全绿验证（P5 gate） | e2e/admin.spec.ts | 元 BDD（验收方式=跑通整套） |
| BDD-16 | t080-admin-route-guard.test.ts 迁移为 tab 级守卫测试 | 无独立断言——由本文件全部 it() 在 `make test-frontend` 下全绿（且不含任何 `requiresAdmin`/路由级 mock router 断言）验证（P5 gate） | t080-admin-route-guard.test.ts | 元 BDD（验收方式=跑通整套 + grep 无 `requiresAdmin` 残留） |
| BDD-17 | 无遗留的前端 /admin 跳转引用 | `T086 BDD-17: test_bdd_17` | t080-admin-route-guard.test.ts | 新增（fs 扫描 `frontend-v3/src`，排除 `router.ts`/`api/client.ts`/`__tests__`） |

## 2. t080-admin-route-guard.test.ts 内 5 个 legacy it() 迁移映射（P2-design.md §3.6）

| legacy it | 新内容 | 对应 T086 BDD | 状态 |
|---|---|---|---|
| `test_bdd_14` | 非 admin 挂载 SettingsView，`?tab=user-manager` → 断言无 `user-manager-content`，渲染 profile stub | BDD-6 | 已重写，当前**通过**（现状代码里 `user-manager` 本就不在 `validTabs`，非 admin/admin 都会回退 profile，这条断言此刻天然成立；实现后仍应保持通过，属于负向回归护栏，非本任务需要制造的红灯） |
| `test_bdd_14b` | admin 挂载 SettingsView，`?tab=user-manager` → 断言存在 `user-manager-content` | BDD-4（反面验证） | 已重写，当前**红灯**（真实断言失败：`user-manager` tab 尚未实现，找不到该节点） |
| `test_bdd_15` | [DESIGN_GAP] | — | it.skip + 详细理由见测试文件内 describe 块注释 |
| `test_bdd_15b` | [DESIGN_GAP] | — | it.skip |
| `test_bdd_15c` | [DESIGN_GAP] | — | it.skip |

**DESIGN_GAP 判断理由**（供 P4/P7 复核，认可请转抄为 `[DESIGN_GAP_REVIEWED: ...]`）：原 `test_bdd_15`/`15b`/`15c` 测的是路由级 `requiresAdmin` guard 在 `authState` 从 `loading→resolve` 过渡期间的重定向时序。T086 删除 `/admin` 路由后，`SettingsView.vue` 模板根节点始终是 `v-if="authState === 'authenticated'"`（`frontend-v3/src/views/SettingsView.vue:2`），tab-nav/tab-content/mobile-stacked 整棵子树只在已确定 `authenticated` 之后才挂载，组件内部不存在"loading→resolve"的中间态需要测试。未登录场景已由既有 `/settings` 路由守卫处理（对应 T086 BDD-7），且该 loading→authenticated / loading→anonymous 时序已经被 `frontend-v3/src/__tests__/t069-auth-guard.test.ts` 的 BDD-1/BDD-2/BDD-4/BDD-5 覆盖（已读取该文件确认，`/settings` 路径的 loading 时序测试已存在）。结论：无处可迁移，非遗漏。

## 3. 自检结果（真红灯确认）

命令：`cd frontend-v3 && npx vitest run src/__tests__/t080-admin-route-guard.test.ts`

结果：10 个测试（7 个真实 + 3 个 `it.skip` DESIGN_GAP），**3 个红灯 / 4 个通过 / 3 个 skip**：

- 红灯（均为 `AssertionError: expected false to be true`，即 assertion 失败因 `user-manager` tab 未实现，非语法/import 错误）：
  - `T086 BDD-4 > test_bdd_4`（tab-nav 按钮不存在）
  - `BDD-14 (legacy) > test_bdd_14b`（admin 拿不到 user-manager 内容）
  - `T086 BDD-13 > test_bdd_13`（mobile-stacked 无 user-manager 区块）
- 通过（4 个，均为非 admin 负向断言，现状代码天然满足，是正确的回归护栏而非假红灯）：
  - `T086 BDD-5 > test_bdd_5`
  - `BDD-14 (legacy) > test_bdd_14`
  - `T086 BDD-14 > test_t086_bdd_14`
  - `T086 BDD-17 > test_bdd_17`（grep 检查，当前无遗留引用，符合 P1 隐含需求 #9 已核实的现状）
- `npx vue-tsc --noEmit` 通过（0 错误），确认无 TS 编译问题。
- `npx playwright test --list e2e/admin.spec.ts` 成功解析，共 36 条（18 用例 × 2 projects：chromium + Mobile Chrome），无语法错误。E2E 实跑（`E2E_SPEC=e2e/admin.spec.ts make debug-test`）留给 P5。

## 4. Advisory Note #1 落实说明

`e2e/admin.spec.ts` 中所有涉及 `.admin-user-row`/`.admin-user-list`/`.pagination`/`.badge`/overflow-menu-trigger 的选择器（`BDD-01`/`02`/`06`/`12`/`20`/`21`，共 6 个 viewport 循环用例）均已加 `scopeOf(vp.name)` 返回的 `.desktop-only`/`.mobile-only` 前缀限定（比照 `frontend-v3/e2e/raw-api.spec.ts:38` 先例），避免双挂载导致选择器匹配到 2 倍节点或误操作到隐藏实例。`[role="alertdialog"]`/`.toast`/`[role="menuitem"]` 未加限定，因 `ConfirmDialog`/`PasswordResetDialog` 通过 `Teleport to="body"` 渲染、`Toast` 是 `App.vue` 根级全局单例（已读取源码确认），不受双挂载影响。
