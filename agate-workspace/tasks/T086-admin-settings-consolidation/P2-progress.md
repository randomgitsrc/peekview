P2 architect started 2026-08-07T09:19:58+08:00
[read] P1-requirements.md - 17 BDD, follows_existing_pattern (settings tab机制+redirect先例), risk_level=medium, domains=[frontend], packages=7个文件
[read] P1-review.md - approved, Advisory Note: UserMenu入口无论形式必须落地tab=user-manager (BDD-11)
[read] P0-brief.md - 用户拍板三点决策 + 现状审计表已确认
[read] router.ts - /admin路由 L27-31 (meta.requiresAdmin) + beforeEach L92-95 死代码分支;有 /settings/apikeys redirect 先例 L22-25
[read] SettingsView.vue - tabs是静态数组(非computed) L64-68, v-for无条件渲染按钮 L16, validTabs L70, activeTab computed L73-81 只判断includes不判断isAdmin, 移动端堆叠区块L32-45无条件全展示
[read] AdminView.vue - 285行完整迁移目标,自包含(users/pagination/menu/confirm/pwd dialogs),依赖api.listUsers等,fetchUsers()立即调用(挂载时机需在tab显示时才fetch,否则非active时也fetch)
[read] UserMenu.vue - dropdown两项(Settings/Logout), navigateToSettings硬编码 '/settings?tab=apikeys', isAdmin已从authStore取得(storeToRefs)
[read] admin.spec.ts - 8 test() 确认(6 viewport循环+2独立BDD-14/15), 用 .goto(`${BASE_URL}/admin`) + selector .admin-user-list/.admin-user-row 等, adminLogin() helper 独立函数(登录alice)
[read] t080-admin-route-guard.test.ts - 5 it() 确认, 自建mock router+beforeEach guard复刻, 不import真实router.ts, 用authStore.isAdmin判断
[read] auth.ts - isAdmin = computed(() => user.value?.isAdmin ?? false)，唯一权威来源，无 RouteMeta 类型增强(requiresAdmin访问是untyped，删除后无需处理类型声明)
[read] ApiKeySettingsTab.vue L1-40 - 确认根元素data-testid约定 `{tab}-content`，UserManagerTab将遵循此模式
[grep] 确认 /admin 硬编码引用仅存在于 router.ts + e2e/admin.spec.ts + t080测试文件 三处，client.ts是后端API路径不受影响，符合BDD-17
方案设计完成，开始写 P2-design.md
[verify] NotFoundView.vue 无 data-testid，确认 files_to_read 中的判断准确
[verify] vitest.sh formatter 确认存在于 ~/.agate/assets/formatters/
[write] P2-design.md 已写入，自检完成：候选方案1个(follows_existing_pattern已声明理由)+方案探索方法论(3方向)、四字段齐全、files_to_read 9条、env_constraints、minimal_validation(not_needed+理由)、三处isAdmin判断显式对照表、UserMenu落地tab设计
P2 architect 完成

---
P2 plan-design-review started 2026-08-07
[read] dispatch-context + role 定义 + P2-design.md + P1-requirements.md + P1-review.md
[verify] 对照现状代码逐一核实方案对现状的描述：SettingsView.vue(tabs静态数组L64-68/activeTab只判includes不判isAdmin L73-81/mobile-stacked无条件全展示L32-45/desktop-only mobile-only纯CSS display切换L172-178)、UserMenu.vue(现状硬编码?tab=apikeys L54,isAdmin已storeToRefs取得L28)、auth.ts(isAdmin=computed L17,唯一权威来源)、router.ts(/admin路由L27-31+死代码分支L92-95)、ApiKeySettingsTab.vue(page-title-bar结构+data-testid={tab}-content约定)、NotFoundView.vue(确认无data-testid，方案files_to_read判断准确)——均与方案描述一致，无失实
[核查①] 移动端多实例挂载放大defer to backlog：API调用成本维度合理；但发现方案未覆盖的衍生后果——双挂载会导致e2e/admin.spec.ts现状L54-58的count()断言(BDD-01, toBeLessThanOrEqual(20))在迁移后因DOM双份节点而失真，这是/admin独立路由迁移进tab结构后新引入的后果(原/admin是AdminView.vue单实例，不存在此问题)。代码库内已有先例可直接复用：raw-api.spec.ts:38 用.desktop-only父容器限定选择器。判定为Advisory Note而非BLOCKER(P5 E2E gate会自诊断出此问题，成本低)
[核查②] DESIGN_GAP(t080 15b/15c)留到P4：合理，严格遵循AGENTS.md的P4/P7 DESIGN_GAP交叉核对机制，决策所需信息(是否存在有意义的组件级等价测试)只有P4实际重写时才能判断
[核查③] 三处isAdmin判断(桌面tab-nav/移动端堆叠/activeTab回退)：确认复用同一storeToRefs(authStore).isAdmin响应式ref，非三份独立判断；核实SettingsView根节点v-if="authState==='authenticated'"包裹全部子树，isAdmin与authState同源(均派生自user.value)，无渲染时序竞态
[核查④] UserMenu落地tab(BDD-11硬性要求)：确认§3.4的isAdmin.value三元表达式精确落地/settings?tab=user-manager，与P1-review Advisory Note逐字对应
[打分] 交互状态覆盖率8/10、AI Slop风险9/10、移动端考虑7/10(双挂载E2E后果未覆盖扣分)、可访问性6/10(tab-nav无ARIA语义现状缺口未被提及扣分)、组件完整性8/10
[write] P2-review.md 已写入，status: approved，含2条Advisory Note(E2E选择器双挂载scoping建议引用raw-api.spec.ts:38先例 + ARIA tab语义现状缺口记录建议)，无BLOCKER
P2 plan-design-review 完成
