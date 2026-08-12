## P4 implementer progress log

- [read] implementer.md role definition
- [read] P4-dispatch-context-implementer.md
- [read] P0-brief.md
- [read] P2-design.md, P3-test-cases.md
- [read] router.ts, SettingsView.vue, AdminView.vue, ApiKeySettingsTab.vue:1-40, UserMenu.vue, auth.ts, NotFoundView.vue
- [read] e2e/admin.spec.ts, t080-admin-route-guard.test.ts
- [note] NotFoundView.vue already has `.not-found` class on root div; e2e spec uses `.not-found` selector — no data-testid addition needed for BDD-8/9/10
- [start] implementing router.ts deletion of /admin route + requiresAdmin branch
- [done] router.ts: removed /admin route + requiresAdmin beforeEach branch
- [done] SettingsView.vue: tabs -> computed filtered by isAdmin; validTabs +user-manager; activeTab getter guards non-admin fallback; tab-content v-else-if UserManagerTab; mobile-stacked v-if=isAdmin section
- [done] UserManagerTab.vue created: migrated AdminView.vue script verbatim, root class user-manager-tab + data-testid=user-manager-content, page-title-bar/page-title header (ApiKeySettingsTab convention), internal data-testids kept unchanged (admin-user-list/admin-user-row/pagination/user-badge)
- [done] AdminView.vue deleted
- [done] UserMenu.vue: navigateToSettings branches on isAdmin (user-manager vs apikeys), added data-testid=user-menu-settings-item
- [check] grep confirms no lingering AdminView/'/admin' references outside router.ts/api client
- [next] run vitest self-check + vue-tsc + make build-frontend
- [check] vitest self-check t080: 7 passed / 3 skipped (DESIGN_GAP) — red->green confirmed
- [check] full vitest run: initially 18 failed in t068-account-settings.spec.ts (pre-existing test's useAuthStore mock had isAdmin as literal false, not ref/computed -> storeToRefs destructure returned undefined)
- [fix][DESIGN_GAP] t068-account-settings.spec.ts: changed mock isAdmin from literal false to computed(() => mockUser.value?.isAdmin ?? false), matching real auth.ts:17 semantics; not a P3-protected file, no assertions changed
- [check] full vitest run after fix: 94 files passed, 1228 passed / 4 skipped
- [check] vue-tsc --noEmit: 0 errors
- [done] make build-frontend executed, static copied to backend/peekview/static/ (8 files)
- [check] grep confirms no AdminView / hardcoded '/admin' navigation references remain (outside router.ts/api client/test assertion strings)
- [output] P4-implementation.md written at docs/tasks/T086-admin-settings-consolidation/P4-implementation.md

## design-review progress log

- [read] design-review.md role definition, P4-dispatch-context-design-review.md
- [read] P4-implementation.md, P2-design.md, CLAUDE.md/AGENTS.md/DESIGN.md
- [read] SettingsView.vue, UserManagerTab.vue, UserMenu.vue, ApiKeySettingsTab.vue（完整文件）
- [check] variables.css 核实 --text-primary/--bg-secondary/--border-color 等均是有效别名，无 CSS 断裂风险，P2 §2 变量不重命名约束未被违反
- [check] git show HEAD:frontend-v3/src/views/AdminView.vue 核实迁移前原值：确认 UserManagerTab.vue 的 page-title-bar margin-bottom（var(--space-6)）与 page-title 缺 font-weight，是原 .admin-header 数值原样保留，未对齐 ApiKeySettingsTab.vue 惯例（var(--space-4) + font-weight:600）
- [check] 4 个重点核查项逐项核实：tab 按钮共享 class 无特化样式（通过）/ page-title-bar 视觉未真正对齐（不通过，2 处偏差）/ UserMenu 按钮无视觉改动（通过）/ mobile-section 结构与另 3 个区块一致（通过）
- [found] [VISUAL] UserManagerTab.vue:296 page-title-bar margin-bottom 32px vs ApiKeySettingsTab.vue 16px
- [found] [VISUAL] UserManagerTab.vue:300-303 page-title 缺 font-weight:600（DESIGN.md Type Scale 规范要求 Page Title weight=600）
- [output] P4-review.md written, status: needs-revision（无 BLOCKER，2 处轻量 CSS 偏差待 implementer 修复后复核）
