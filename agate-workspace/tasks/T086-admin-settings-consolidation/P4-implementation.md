---
phase: P4
task_id: T086-admin-settings-consolidation
type: implementation
parent: P2-design.md
trace_id: T086-P4-20260807
status: draft
created: 2026-08-07
agent: implementer
---

# P4-implementation — T086 admin/settings 信息架构收敛

```yaml
implementation_dir: frontend-v3/src
```

## 改动清单

| 文件 | 改动 |
|---|---|
| `frontend-v3/src/router.ts` | 删除 `/admin` 路由定义（原 L27-31）；删除 `beforeEach` 中 `if (to.meta.requiresAdmin) {...}` 死代码分支（原 L92-95）|
| `frontend-v3/src/views/SettingsView.vue` | `tabs` 静态数组 → `computed`（按 `isAdmin` 过滤追加 `user-manager`）；`validTabs` 加 `'user-manager'`；`activeTab` getter 加 `tab === 'user-manager' && !isAdmin.value` 回退 `profile`；`tab-content` 新增 `<UserManagerTab v-else-if="activeTab === 'user-manager'" />`；`mobile-stacked` 新增 `<section v-if="isAdmin">` 包裹的用户管理区块；新增 `const { isAdmin } = storeToRefs(authStore)`，三处判断（tab-nav 渲染/tab-content 回退/mobile-stacked 渲染）全部复用该同一数据源 |
| `frontend-v3/src/components/settings/UserManagerTab.vue`（新建） | 从 `AdminView.vue` 原样迁移 `<script setup>` 全部逻辑（fetchUsers/getMenuItems/doDisable/doEnable/doPromote/doDemote/doDelete/handlePwdConfirm/自我保护，末尾 `fetchUsers()` 立即调用保留）；根元素 class 改为 `user-manager-tab`，新增 `data-testid="user-manager-content"`；顶部标题区改为 `page-title-bar`/`page-title` 结构（跟随 `ApiKeySettingsTab.vue` 惯例）；内部 `data-testid`（`admin-user-list`/`admin-user-row`/`pagination`/`user-badge`）原样保留 |
| `frontend-v3/src/views/AdminView.vue` | 已删除（内容迁移至 UserManagerTab.vue） |
| `frontend-v3/src/components/UserMenu.vue` | `navigateToSettings()` 按 `isAdmin.value` 分支跳转 `'/settings?tab=user-manager'` vs `'/settings?tab=apikeys'`；Settings 按钮新增 `data-testid="user-menu-settings-item"`（按钮文案/数量不变，不新增平行入口）|
| `frontend-v3/src/components/__tests__/t068-account-settings.spec.ts` | 见下方 [DESIGN_GAP] 说明——mock 修复，非断言修改 |

## [DESIGN_GAP: t068-account-settings.spec.ts 的 useAuthStore mock 需要同步修复]

P2 设计要求 `SettingsView.vue` 三处权限判断统一改用 `storeToRefs(authStore).isAdmin`（§3.2）。实现后跑 `npx vitest run`（全量）发现既有 `t068-account-settings.spec.ts`（P2 files_to_read 清单未覆盖此文件，非 P3 红灯测试文件）7 个用例回归失败：

```
TypeError: Cannot read properties of undefined (reading 'value')
 ❯ ComputedRefImpl.fn src/views/SettingsView.vue:81:15  (tabs computed 内 isAdmin.value)
```

**根因**：该文件用 `vi.mock('@/stores/auth', ...)` 完全替身 `useAuthStore`，mock 返回对象里 `isAdmin: false` 是字面量布尔值，不是 `ref`/`computed`。`storeToRefs()` 只对 store 上 ref/reactive/computed 属性生效，对纯字面量属性不会产出对应的 ref key，导致解构出的 `isAdmin` 是 `undefined`。此 mock 字段在 P4 改动之前是死代码（`SettingsView.vue` 改动前只用 `toRef(authStore, 'authState')`，从未读取 store 的 `isAdmin`），本任务是第一个让 `SettingsView.vue` 真正消费 `authStore.isAdmin` 的改动，因此暴露了 mock 与真实 store 契约（`frontend-v3/src/stores/auth.ts:17` `isAdmin = computed(() => user.value?.isAdmin ?? false)`）不一致的问题。

**采取的决策**：未修改任何测试断言/期望值，只把 mock 的 `isAdmin` 字段从字面量 `false` 改为 `computed(() => mockUser.value?.isAdmin ?? false)`（与真实 store 的派生逻辑一致），使其正确响应该文件内已有的 `mockUser.value = { ...mockUser.value, isAdmin: true }`（第 157 行，"shows admin badge for admin user" 用例本就依赖这个切换，此前该切换从未真正驱动过 `authStore.isAdmin`）。改动 2 处：`import { ref, computed, nextTick, defineComponent } from 'vue'`（新增 computed 导入）+ mock 工厂函数内 `isAdmin: false` → `isAdmin: computed(() => mockUser.value?.isAdmin ?? false)`。参照了同项目内 `UserMenu.spec.ts` 已有的正确 mock 写法（该文件 `isAdmin: ref(false)`，为真实 ref）。

修复后 `t068-account-settings.spec.ts` 19/19 通过，全量 `npx vitest run` 94 files / 1228 passed / 4 skipped（3 个 T086 DESIGN_GAP skip + 1 个既有无关 skip）。

> [DESIGN_GAP_REVIEWED: 待主 Agent/P7 复核]

## 测试结果

**P3 自查目标测试**：`cd frontend-v3 && npx vitest run src/__tests__/t080-admin-route-guard.test.ts`
```
✓ src/__tests__/t080-admin-route-guard.test.ts  (10 tests | 3 skipped) 68ms
Test Files  1 passed (1)
     Tests  7 passed | 3 skipped (10)
```
7 个真实断言全部由红转绿（`test_bdd_4`/`test_bdd_14b`/`test_bdd_13` 原为红灯，现通过）；3 个 skip 为 P3 已标注的 `[DESIGN_GAP]`（test_bdd_15/15b/15c），未做实现，符合 dispatch-context 指引。

**全量前端单测**：`npx vitest run`
```
Test Files  94 passed (94)
     Tests  1228 passed | 4 skipped (1232)
```

**typecheck**：`npx vue-tsc --noEmit` → 0 错误（`TabName`/`tabs`/`validTabs` 四处同步无遗漏）

**build-frontend**：`make build-frontend` 已执行，输出：
```
✓ built in 12.53s
  ✓ 382 static files
→ Copying static files to backend...
✓ Frontend built and copied (8 files)
```
`backend/peekview/static/` 已更新为最新构建产物。

**grep 校验**（对应 BDD-17 / DoD 最后一条）：`grep -rn "AdminView" frontend-v3/src frontend-v3/e2e` 无结果；`grep -rn "'/admin'" frontend-v3/src --include='*.vue' --include='*.ts'` 仅命中 `t080-admin-route-guard.test.ts` 内的字符串字面量（测试断言文本本身，非导航代码），符合预期。

## E2E / P5 gate（未跑，非本阶段职责）

`E2E_SPEC=e2e/admin.spec.ts make debug-test` 未执行——按 implementer.md 角色定义，P5 由主 Agent 派发 verifier 执行，不在 P4 自查范围内。

## 门槛自检对照（P2 §9 Definition of Done）

- [x] `router.ts` 不再含 `/admin` 路由和 `requiresAdmin` 分支
- [x] `SettingsView.vue` 四处联动完成，`isAdmin` 均来自 `storeToRefs(authStore)`
- [x] `UserManagerTab.vue` 存在，功能与原 `AdminView.vue` 完全对等（脚本逻辑原样迁移）
- [x] `AdminView.vue` 已删除
- [x] `UserMenu.vue` Settings 入口按 `isAdmin` 动态落地，非 admin 无新增可见选项
- [ ] `e2e/admin.spec.ts` 全绿 — 留给 P5 gate（E2E 环境验证不在 P4 自查范围）
- [x] `t080-admin-route-guard.test.ts` 原地重写完成，`make test-frontend`（本次用 `npx vitest run` 全量覆盖）全绿，文件内无 `requiresAdmin` 残留断言
- [x] `make typecheck`（本次用 `npx vue-tsc --noEmit`）0 错误
- [x] grep 确认无遗留 `/admin` 前端跳转硬编码
