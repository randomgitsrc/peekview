## P1 progress (analyst)

- [x] 读取 analyst.md 角色定义
- [x] 读取 P1-dispatch-context-analyst.md
- [x] 读取 P0-brief.md（现状审计表格 + 用户决策已拍板三点）
- [x] 读取 router.ts：确认 /admin 路由（27-31行）+ requiresAdmin guard（92-95行）。发现：guard 用 to.meta.requiresAdmin 判断，删除 /admin 路由后该 guard 分支变死代码（无路由再声明 meta.requiresAdmin）——列为隐含需求候选（是否清理由 P2 决定，P1 只记录）
- [x] 读取 SettingsView.vue：确认 tab 机制。关键发现：桌面端(desktop-only) 用 activeTab 单选 tab-content；移动端(mobile-only) 是"全部堆叠展示"（无 tab 切换，profile/security/apikeys 三节全部无条件渲染）。这意味着 user-manager tab 若照搬现有模式，移动端会对所有登录用户堆叠展示 user-manager 区块（除非显式加 v-if isAdmin 包裹）——这是关键隐含需求，若漏做会导致非 admin 用户在移动端看到用户管理入口/内容，属权限边界漏洞
- [x] 读取 AdminView.vue：确认迁移内容范围——用户列表(分页)/禁用/启用/升级管理员/降级/重置密码/删除，5 个操作 + loading/error/empty 三态，data-testid: admin-user-list / admin-user-row / user-badge / pagination（还有隐式 OverflowMenu/ConfirmDialog/PasswordResetDialog 相关 testid，需查这些组件）
- [x] 读取 UserMenu.vue：当前 dropdown 只有 "Settings"(→/settings?tab=apikeys) 和 "Logout" 两项，isAdmin 时只显示徽章文字，无独立入口按钮。需新增 admin 专属入口
- [x] 读取 e2e/admin.spec.ts（全文 210 行）：**核查发现与 P0-brief 不符**——实际测试数为 8 个 test() 定义（BDD-01/02/06/12/14/15/20/21），其中 6 个跑 2 viewport（desktop+mobile）= 12 + 2 个单 viewport 独立测试 = 共 14 个实际执行用例，非 P0 声称的 27 个。已在 requirements 中用实际数字，不采信 P0 的 27。关键：BDD-14(非admin重定向到/explore)、BDD-15(未登录重定向到/)是路由级 guard 测试，/admin 路由删除后这两条语义完全失效（不再是"重定向"而是"404"），必须重写而非迁移 selector
- [x] 读取 AGENTS.md 权限模型一节：Anonymous/Authenticated/Admin 三层，私有资源对非owner返回404防枚举——本任务的/admin删除后返回404符合项目已有"防枚举"惯例，非本任务独创
- [x] grep 全 frontend-v3/src 排查 /admin 硬编码引用：发现除 router.ts 外，还有 src/__tests__/t080-admin-route-guard.test.ts（vitest 单测，自建 mock router 测试 requiresAdmin guard，BDD-14/15 语义）——**dispatch-context 输入文件清单未列出此文件，但它是必须迁移的测试资产**，已补充进范围。src/api/client.ts 的 /admin/users 等是后端 API 路径（与前端路由无关），不受影响
- [x] 核查 CSS 变量命名：AdminView.vue 用 --text-primary/--bg-secondary/--border-color/--accent-color 等，SettingsView.vue 用 --c-text/--c-surface/--c-border/--c-accent；grep variables.css 确认只定义了 --c-* 前缀变量，--text-primary 等系列在全项目均无定义（非本任务独有，是历史遗留，多个组件如Pagination/ConfirmDialog都用未定义变量）——已记录为 [SUGGEST] 而非阻塞项
- [x] 核查 e2e 用例实际数量：8 个 test() 定义，非 P0 声称的 27 个（已用实际数字）
- [x] 完成信息收集，开始撰写 P1-requirements.md
- [CORRECTION] 上一条 CSS 变量核查结论有误：variables.css 第 65-98/129-162 行定义了完整的 legacy 别名层（--text-primary: var(--c-text) 等），--text-primary/--bg-secondary/--border-color/--accent-color 均是有效别名，非未定义变量。AdminView.vue 样式可正常渲染，无需在迁移时改名。撤销此前的 [SUGGEST] CSS 变量对齐项
- [x] P1-requirements.md 已写入，17 条 BDD（功能对等3 + 权限边界4 + 路由404 3 + 入口发现2 + 移动端2 + 测试资产迁移2 + 遗留引用回归1）
- [x] 自检：Header 齐全、domains/packages/risk_level/phases/capability_requirements 均声明、[NO_NEED_CONFIRM]+3条[SUGGEST]（均非阻塞）、BDD 编号连续无跳号、未绑定 CSS 类名/HTML 属性、每条 BDD 单一 Given-When-Then
- [x] 重要修正记录：P0-brief 声称的 e2e 用例数(27)与实测(8)不符，已用实测数字；新发现 t080-admin-route-guard.test.ts 未在 dispatch-context 输入清单中但属必迁移范围，已补充；CSS 变量命名初判为风险后核查证实是完整别名层，非风险
- [x] P1 完成

## P1 progress (requirements-review)

- [x] 读取角色定义 requirements-review.md + dispatch-context-requirements-review.md
- [x] 读取 P1-requirements.md 全文（17 条 BDD + 11 条隐含需求 + 3 条 SUGGEST + 裁剪说明 + 范围声明）
- [x] 读取 P0-brief.md，核对三点拍板决策转译忠实度
- [x] 读取 P1-dispatch-context-analyst.md，核对 analyst 派发指引覆盖
- [x] 独立核实 frontend-v3/e2e/admin.spec.ts：直接数 test() 调用点，共 8 个（BDD-01/02/06/12/20/21 在 viewport 循环内 x2，BDD-14/15 循环外各 1 个）——确认 analyst"8 个"声称准确，P0-brief"27 个"确认有误
- [x] 独立核实 frontend-v3/src/__tests__/t080-admin-route-guard.test.ts：确认自建 createGuardedRouter + meta.requiresAdmin 路由级 guard 逻辑，不依赖真实 router.ts——确认测的是路由级 guard；但发现 analyst 声称"4 个 it"有误，实际数 it() 得 5 个（test_bdd_14/14b/15/15b/15c）——记为 Correction Note，非阻塞（不影响 BDD-16 可判定性）
- [x] 读取 frontend-v3/src/router.ts 核对 BDD-8/9/10：/admin 仍在（删除前），catch-all not-found 路由存在，与"删除 /admin 后落 404"判断一致
- [x] BDD-1~17 逐条判定 + 覆盖维度标注
- [x] 隐含需求覆盖五维度评审
- [x] 裁剪评审（P1 第5节逐项）
- [x] 撰写 P1-review.md，status: approved（含 2 条非阻塞 Correction/Advisory Note）
