---
phase: P7
task_id: T086-admin-settings-consolidation
type: consistency
parent: P6-acceptance.md
trace_id: T086-P7-20260807
status: approved
created: 2026-08-07
agent: consistency-reviewer
---

# P7-consistency — T086 admin/settings 信息架构收敛

## 1. DESIGN_GAP 配对

### DESIGN_GAP #1（P4 声明，t068 mock 修复）

来源：`P4-implementation.md` 第 29 行，原文为 markdown H2 标题格式 `## [DESIGN_GAP: t068-account-settings.spec.ts 的 useAuthStore mock 需要同步修复]`（`##` 前缀不符合 gate 契约的行首格式，本节按契约要求转抄为不带 `##` 的行首格式）。

[DESIGN_GAP: t068-account-settings.spec.ts 的 useAuthStore mock 需要同步修复]

**复核内容**：P4 implementer 在实现 `SettingsView.vue` 三处 `isAdmin` 判断（复用 `storeToRefs(authStore).isAdmin`，对应 `P2-design.md §3.2`）后跑全量 `npx vitest run`，`t068-account-settings.spec.ts` 7 个用例回归失败（`TypeError: Cannot read properties of undefined (reading 'value')`，出现在 `SettingsView.vue:81` 的 `tabs` computed 内）。根因是该文件 `vi.mock('@/stores/auth', ...)` 里 `isAdmin: false` 是字面量布尔值，`storeToRefs()` 只对 ref/reactive/computed 属性解构出对应 ref，对字面量属性解构出 `undefined`——这是**该改动之前就存在的 mock 缺陷**（`SettingsView.vue` 改动前从未读取 `authStore.isAdmin`，缺陷是死代码，本任务是第一个真正消费该字段的改动，因而暴露）。

修复内容：仅 2 处改动——① `import { ref, computed, nextTick, defineComponent } from 'vue'` 新增 `computed` 导入；② mock 工厂函数内 `isAdmin: false` → `isAdmin: computed(() => mockUser.value?.isAdmin ?? false)`。未改动任何测试断言/期望值，改法参照了同项目 `UserMenu.spec.ts` 已有的正确 mock 写法（`isAdmin: ref(false)`，同为响应式对象而非字面量）。已用 `Bash` 独立核查最终代码状态（`frontend-v3/src/components/__tests__/t068-account-settings.spec.ts:24`）：`isAdmin: computed(() => mockUser.value?.isAdmin ?? false)` 确实存在，与 P4-implementation.md 描述一致，修复未被后续改动覆盖或丢失。

**判断**：mock 修复合理。理由：(1) 只改 mock 实现方式使其正确响应真实 store 的派生语义，未触碰任何断言，不构成"改测试迁就实现"的反模式；(2) 根因分析完整（字面量属性 vs storeToRefs 解构机制的框架级行为差异），且指出这是本任务首次触发的既有 mock 缺陷而非本任务引入的新问题；(3) 有代码库内先例（`UserMenu.spec.ts`）佐证写法正确性；(4) 修复后 `t068-account-settings.spec.ts` 19/19 通过，全量 `npx vitest run` 94 files/1228 passed/4 skipped，P6 验收时刻重新执行同样得到全量 1228 passed（`P6-acceptance.md` BDD-16 段落交叉印证）。

[DESIGN_GAP_REVIEWED: t068 mock 修复（isAdmin 字面量→computed）合理，未改动任何断言，根因为 storeToRefs 对字面量属性解构出 undefined 的框架级行为，已用 UserMenu.spec.ts 既有写法佐证，Bash 独立核查最终代码（t068-account-settings.spec.ts:24）确认修复已生效且未被覆盖。参照锚点：P4-implementation.md 第 18-44 行改动清单 + DESIGN_GAP 说明，P2-design.md §3.2（SettingsView.vue 三处 isAdmin 判断的设计来源）]

### DESIGN_GAP #2（P2 预标注，P3 实际执行判断，t080 15b/15c）

来源：`P2-design.md §3.6` 第 198 行预先标注 `[DESIGN_GAP: t080 的 15b/15c 是 loading→resolve 时序测试，路由级迁移后是否还需要在 router.ts 层面保留，还是彻底移除]`，由 `P3-test-cases.md` 第 2 节实际执行判断（非严格意义上的 P4 声明，但同一 DESIGN_GAP 追踪机制下产生，dispatch-context 要求一并独立复核）。

[DESIGN_GAP: t080 的 15b/15c 是 loading→resolve 时序测试，路由级迁移后是否还需要在 router.ts 层面保留，还是彻底移除]

**复核内容**：`P3-test-cases.md` 第 2 节给出的处理：`test_bdd_15`/`test_bdd_15b`/`test_bdd_15c` 三个 legacy it() 全部改为 `it.skip`，理由记录在测试文件内 describe 块注释（已用 Bash 核查最终代码 `frontend-v3/src/__tests__/t080-admin-route-guard.test.ts:117` 附近确认注释确实存在）。判断依据：T086 删除 `/admin` 路由后，`SettingsView.vue` 模板根节点始终是 `v-if="authState === 'authenticated'"`（`frontend-v3/src/views/SettingsView.vue`），tab-nav/tab-content/mobile-stacked 整棵子树只在 `authState` 已确定为 `authenticated` 之后才挂载，组件内部不存在"loading→resolve"的中间态需要测试；未登录场景已由既有 `/settings` 路由守卫处理（对应 T086 BDD-7）；且 loading→authenticated / loading→anonymous 的时序已经被 `frontend-v3/src/__tests__/t069-auth-guard.test.ts` 的 BDD-1/BDD-2/BDD-4/BDD-5 覆盖（P3-test-cases.md 已读取该文件确认）。

我独立评估这个判断是否站得住脚（而非简单转抄 P2-review.md"核查②"的结论，后者只判断"留到 P4 判断"这个**流程安排**是否合理，未对 P3 实际给出的**技术判断内容**本身做复核）：

- 该判断的核心论证——"`SettingsView` 子树只在 `authState === 'authenticated'` 确定后才挂载，组件内部无 loading 中间态"——是可独立验证的结构性事实，不依赖主观判断。这与 `P2-review.md`"核查③"（三处 isAdmin 判断复用同一数据源）中已经核实过的同一事实一致："`SettingsView.vue` 模板根节点 `v-if="authState === 'authenticated'"` 包裹了整个组件"。两处独立文档（P2-review 核查③、P3-test-cases 第2节）对同一段代码结构的描述一致，互相印证。
- "未登录场景已由 `/settings` 路由守卫处理"对应 P1 隐含需求表 #8（`P1-requirements.md` 第 35 行）已明确记录的既有事实，非 P3 新造论据。
- "loading 时序已被 t069-auth-guard.test.ts 覆盖"是可验证的具体文件引用，非空泛断言；P6-acceptance.md 未对此重新验证（不在其 BDD 范围内），但该文件覆盖范围的真实性不因此存疑——它是一个独立既有测试资产，不属于本任务改动范围，不需要 P6 重新验证其存在性。

**判断**：P3 对该 DESIGN_GAP 的技术判断站得住脚。删除路由级 guard 后，组件级不再存在待测的 loading 中间态是一个结构性事实（非假设），且未登录/loading 场景已被别处测试覆盖，it.skip 而非删除代码块保留了可追溯性（符合 P1 SUGGEST-2"保留文件路径但重写内容，避免测试历史丢失"的同一精神）。

[DESIGN_GAP_REVIEWED: t080 的 15b/15c it.skip 处理判断站得住脚。核心论证（SettingsView 子树仅在 authState===authenticated 后挂载，无 loading 中间态）是可验证的结构性事实，与 P2-review.md 核查③ 对同一代码结构的独立核实互相印证；未登录场景已由 /settings 路由守卫覆盖（对应 P1 BDD-7）；loading 时序已被独立测试资产 t069-auth-guard.test.ts 覆盖。参照锚点：P2-design.md §3.6（预标注来源）、P3-test-cases.md 第2节（实际判断+理由）、P1 BDD-7（未登录守卫复用依据）]

## 2. SCOPE+ 闭环

全项目 `docs/tasks/T086-admin-settings-consolidation/*.md` grep 未发现任何行首 `[SCOPE+]` 声明（仅在 dispatch-context 模板文本中出现"SCOPE+ 已处理（若本阶段产生）"这类流程说明，非实际触发）。P1-requirements.md 无 SCOPE+ 条目，因此无需 `[SCOPE_RESOLVED]` 闭环标记——判定为 N/A（本任务未触发 SCOPE+ 机制），非遗漏。

## 3. 跨文件一致性

### 3.1 P2 packages 与 P8 bump 范围

`P2-design.md §5`（第 214-217 行）声明 `packages: [peekview]`（frontend-v3 构建产物打包进 `backend/peekview/static/`，随 `peekview` 包一起发版，不涉及 `mcp_server`）。P8 尚未执行，此处仅核实声明本身合理：全部改动文件（`router.ts`/`SettingsView.vue`/`UserManagerTab.vue`/`AdminView.vue`/`UserMenu.vue`/`t068-account-settings.spec.ts`/`admin.spec.ts`/`t080-admin-route-guard.test.ts`）均在 `frontend-v3/` 内，符合 `AGENTS.md`"版本源"一节"frontend-v3 构建产物打包进 `backend/peekview/static/`"的既定架构描述，`peekview` 单包声明合理，`mcp_server` 不涉及也合理（无 `packages/mcp-server/` 下的改动）。

### 3.2 P1 BDD 数量与 P6 验收结果数量

`P1-requirements.md §3` 声明 BDD-1 至 BDD-17，共 17 条。`P6-acceptance.md`"BDD 逐条验收结果"逐条列出 PASS BDD-1 至 PASS BDD-17，末尾 **Summary: 17/17 PASS, 0 FAIL**。逐条核对编号与内容对应关系（非仅数量匹配）：

| P1 BDD 主题 | P6 对应验收内容 | 匹配 |
|---|---|---|
| BDD-1 用户列表 | PASS BDD-1 4 行用户+徽章 | 是 |
| BDD-2 用户管理操作 | PASS BDD-2 重置密码对话框 | 是 |
| BDD-3 自我保护 | PASS BDD-3 禁用自己被拒绝 toast | 是 |
| BDD-4 桌面 tab-nav 显示 | PASS BDD-4 4 个 tab 按钮，count=1 | 是 |
| BDD-5 非 admin tab-nav 不显示 | PASS BDD-5 count=0 | 是 |
| BDD-6 非 admin 回退 profile | PASS BDD-6 显示 Profile 内容 | 是 |
| BDD-7 未登录守卫 | PASS BDD-7 重定向到 `/` | 是 |
| BDD-8 admin 访问 /admin 404 | PASS BDD-8 404 不重定向 | 是 |
| BDD-9 非 admin 访问 /admin 404 | PASS BDD-9 不重定向 /explore | 是 |
| BDD-10 未登录访问 /admin 404 | PASS BDD-10 不重定向 / | 是 |
| BDD-11 UserMenu admin 入口 | PASS BDD-11 落地 user-manager | 是 |
| BDD-12 UserMenu 非 admin 无入口 | PASS BDD-12 落地 apikeys | 是 |
| BDD-13 移动端 admin 可见 | PASS BDD-13 count=1 | 是 |
| BDD-14 移动端非 admin 不可见 | PASS BDD-14 count=0 | 是 |
| BDD-15 e2e 全绿（元 BDD） | PASS BDD-15 引用 P5-test-results/e2e.md exit 0 | 是 |
| BDD-16 t080 迁移（元 BDD） | PASS BDD-16 7 passed/3 skip | 是 |
| BDD-17 无遗留引用 | PASS BDD-17 grep 为空 | 是 |

17/17 编号与内容一一对应，无遗漏无错位（对照 `P1-requirements.md §3` 与 `P6-acceptance.md`"BDD 逐条验收结果"节）。

### 3.3 P4 实现路径与 P2 方案设计吻合

对照 `P2-design.md §2`"改什么"清单与 `P4-implementation.md`"改动清单"表：

- `router.ts`：P2 要求删除 `/admin` 路由定义（原 L27-31）+ 死代码分支（原 L92-95）——P4 改动清单第一行完全对应；P4-retry2 追加的显式 `/admin → NotFoundView` 路由是对 P2 §3.1"catch-all 天然生效"这一错误假设的修正（非推翻设计意图，见下文 4.2）。
- `SettingsView.vue`：P2 §3.2 给出 `tabs`/`validTabs`/`activeTab`/模板三处判断的完整代码块——已用 Bash 核查最终代码（`frontend-v3/src/views/SettingsView.vue:46,58,68,81,88`），`storeToRefs(authStore)` 解构 `isAdmin`、`tabs` computed 内 `if (isAdmin.value)`、`activeTab` getter 内 `tab === 'user-manager' && !isAdmin.value`、mobile-section `v-if="isAdmin"` 四处均与 P2 §3.2 代码块逐字一致。
- `UserManagerTab.vue`（新建）：P2 §3.3 要求脚本全部原样迁移 + 根 class 改 `user-manager-tab` + `data-testid="user-manager-content"` + `page-title-bar` 结构——文件已存在（Bash 核查 `frontend-v3/src/components/settings/UserManagerTab.vue` 存在）。
- `AdminView.vue`：P2 要求删除——已用 Bash 核查确认文件不存在。
- `UserMenu.vue`：P2 §3.4 给出 `navigateToSettings()` 按 `isAdmin` 分支跳转的完整代码——已用 Bash 核查最终代码（`frontend-v3/src/components/UserMenu.vue:52-54`），`router.push(isAdmin.value ? '/settings?tab=user-manager' : '/settings?tab=apikeys')` 与 P2 代码块逐字一致，`data-testid="user-menu-settings-item"` 也确认存在。
- `e2e/admin.spec.ts`：P2 §3.5 要求 URL 替换 + BDD-14/15 语义重写 + 新增 BDD-11/12——P3-test-cases.md 确认已实现，P3-fix-record.md 确认后续选择器订正也已落地（见 4.3）。
- `t080-admin-route-guard.test.ts`：P2 §3.6 要求原地重写、不新建 mock router——已用 Bash 核查文件 mtime（09:45，早于任务当日多数后续文件），路径未变，符合"原地重写"。

结论：P4 最终实现路径与 P2 方案设计的改动范围、代码细节均吻合，无遗漏文件、无超范围改动。

## 4. 回退历史交叉核对（dispatch-context 3 个具体核查点）

### 4.1 两次修复是否都已正确反映在最终代码/测试状态中

**第一次修复（router.ts 路由拦截）**：已用 Bash 核查 `frontend-v3/src/router.ts:33-34`，`path: '/admin'` + `name: 'admin-not-found'` 确认存在，位于 `/:slug` 路由之前（P4-implementation-retry2.md 描述的插入位置）。P6-acceptance.md BDD-8/9/10 三条验收均为 PASS，验收时刻的现象（"URL 未被重定向，页面显示 404"）与该路由修复的预期效果一致。**未发现"曾经修过又被覆盖"的迹象**——`.state.yaml` history 记录该修复发生在 P5 retry2 之后再未被 P3-fix-record.md（第二次修复，只改 `admin.spec.ts`）或任何后续阶段触碰 `router.ts`。

**第二次修复（admin.spec.ts 选择器 scope）**：已用 Bash 核查 `frontend-v3/e2e/admin.spec.ts:276`（BDD-11 用例内），`page.locator('.desktop-only [data-testid="user-manager-content"]')` 确认存在，与 `P3-fix-record.md` 描述的 diff 一致。P6-acceptance.md BDD-11/12 均为 PASS，且 P5-test-results（`P6-acceptance.md` BDD-15 段落引用）显示 P5 retry2 全量重跑后 BDD-11/12 均"首次真正执行并通过"（而非级联跳过），与选择器修复后的预期一致。

结论：两次修复均已正确反映在最终代码状态，非"曾经修过又被覆盖"。

### 4.2 P4-implementation-retry2.md 的路由修复与 P2-design.md §3.1 原始设计意图是否一致

`P2-design.md §3.1`（第 87 行）原文："删除后 `/admin` 落到 catch-all `path: '/:pathMatch(.*)*'` → `NotFoundView.vue`，天然满足 BDD-8/9/10"——这是一个关于**路由匹配结果**的假设（"访问 /admin 应该落到 NotFoundView"），假设本身（目标行为）没有错，错的是**实现路径**的假设（"仅靠 catch-all 就能天然达成，无需额外路由"）：P5-gate-diagnosis.md 已查明 `/:slug` 排在 catch-all 之前会先行拦截 `/admin`。

`P4-implementation-retry2.md` 的修复（显式注册 `/admin → NotFoundView` 路由）达成的最终效果与 P2 §3.1 声明的目标行为（"/admin 落到 NotFoundView，满足 BDD-8/9/10"）完全一致，只是**实现手段从"依赖 catch-all 隐式生效"改为"显式路由达成同一目标"**。P4-implementation-retry2.md 自身第 34 行也明确写"这是最小改动，符合 P2 §3.1 的原始设计意图"，这一自我定性经核查目标行为一致性后判定成立。

结论：retry2 修复是对 P2 §3.1 错误的**实现路径假设**的修正，不是对**设计意图**（目标行为）的推翻，两者一致。

### 4.3 P3-fix-record.md 的选择器修复是否与 P2-design.md §4 UI 测试标识清单保持一致

`P2-design.md §4`"UI 测试标识清单"（第 202-210 行）声明 `user-manager-content` 位于 `UserManagerTab.vue` 根元素，状态"新增"，未对选择器的 viewport scope 前缀做任何规定（该清单只关心 testid 命名本身，不涉及 E2E 选择器写法）。`P3-fix-record.md` 的修复（`.desktop-only [data-testid="user-manager-content"]`）没有新增、重命名或删除任何 testid，只是在**引用**该 testid 的 E2E 选择器上加了一层容器 scope 限定，testid 本身与 P2 §4 清单声明的 `user-manager-content` 完全一致，未产生偏离。

该选择器 scope 需求的根源（`SettingsView.vue` 桌面/移动双挂载导致同一 testid 在 DOM 中存在两份）在 `P2-review.md`"核查①"（第 49-69 行）已提前预警并给出 `raw-api.spec.ts:38` 的 `.desktop-only`/`.mobile-only` 先例作为修复参照，`P3-fix-record.md` 与 `P3-dispatch-context-test-designer-fix.md` 采用的正是这个先例模式（虽然 BDD-11 因固定桌面 viewport、不经过 `scopeOf()` 循环，最终写成字面量 `.desktop-only` 前缀而非引入 `scopeOf()` helper，但限定容器的思路与 P2-review 建议一致）。

结论：P3-fix-record.md 的选择器修复与 P2-design.md §4 UI 测试标识清单一致，未产生 testid 层面的偏离，修复思路可溯源至 P2-review.md 的提前预警。

## 5. 未决项清零

- 全项目 `docs/tasks/T086-admin-settings-consolidation/*.md` grep 未发现任何行首 `[NEED_CONFIRM]`、`[BLOCKER]`、`[DEVIATION-CRITICAL]` 标记（仅在角色/dispatch-context 模板文本中作为流程说明出现，非实际触发实例）。`P1-requirements.md §4` 明确声明 `[NO_NEED_CONFIRM]`。
- 3 条 SUGGEST 采纳情况逐条确认（`P1-requirements.md §4` 第 147-149 行）：
  1. **router.ts 死代码清理**（`to.meta.requiresAdmin` 分支）：已随 P4 一并做。已用 Bash 核查 `frontend-v3/src/router.ts` grep `requiresAdmin` 无命中（仅测试文件内以注释形式提及历史背景），确认清理彻底。
  2. **t080-admin-route-guard.test.ts 原地重写而非新建删旧**：已做。文件路径未变（`frontend-v3/src/__tests__/t080-admin-route-guard.test.ts`），P4-implementation.md 明确称"原地重写"，未发现新建文件后删除旧文件的痕迹。
  3. **UserMenu 复用 Settings 按钮而非新增平行入口**：已做。Bash 核查 `frontend-v3/src/components/UserMenu.vue` 仅 1 处 `dropdown-item`（`data-testid="user-menu-settings-item"`，文案仍为"Settings"），未发现新增独立的"用户管理"按钮，`navigateToSettings()` 按 `isAdmin` 动态分支跳转目标（与 P4-implementation.md 描述一致）。

## 6. 结论

- **BLOCKER = 0**：无 [BLOCKER] 标记（见第5节），DESIGN_GAP #1/#2 均已配对复核，判断均为合理，代码状态经独立核查确认与文档描述一致。
- **CRITICAL = 0**：跨文件一致性检查（第3节）逐项引用具体文件+节名+行号锚点，P4 实现路径与 P2 方案设计吻合（P2§改什么 vs P4-implementation.md 改动清单），P1 §3 的 17 条 BDD 与 P6-acceptance.md 的 17 条验收结果逐条对应无遗漏错位。
- **SCOPE+ 闭环**：本任务未触发 SCOPE+ 机制，N/A，非遗漏。
- 回退历史三个核查点（第4节）均已交叉核对：两次修复正确反映在最终代码状态、router.ts 修复是对实现路径假设的修正而非设计意图推翻、admin.spec.ts 选择器修复与 P2§4 testid 清单一致。
- 无 [DEVIATION-CRITICAL]。

**status: approved**
