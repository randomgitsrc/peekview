---
phase: P1
task_id: T086-admin-settings-consolidation
type: review
parent: P1-requirements.md
trace_id: T086-P1-20260807
status: approved
created: 2026-08-07
agent: requirements-review
---

# P1-review — T086 admin/settings 信息架构收敛

## 独立事实核查（dispatch-context 重点要求项）

**核查①：e2e/admin.spec.ts 实际 test() 数量**

直接通读 `frontend-v3/e2e/admin.spec.ts`（210 行）逐个数 `test(` 调用点：
- viewport 循环内（`for (const vp of VIEWPORTS)`，desktop+mobile 两档）定义 6 个：`BDD-01`(L49) `BDD-02`(L66) `BDD-06`(L78) `BDD-12`(L103) `BDD-20`(L134) `BDD-21`(L155)
- 循环外单独定义 2 个：`BDD-14`(L182) `BDD-15`(L204)
- 合计 8 个 `test()` 调用点（若按 Playwright 实际执行次数算，6×2+2=14 次运行，但"既有测试场景"数=8 与 analyst 声称一致）

**结论：analyst 声称的"8 个"准确，P0-brief 声称的"27 个"确认有误。P1-requirements.md 第 33 行、124-127 行（BDD-15）采用的"8 个"数字可信，无需修正。**

**核查②：t080-admin-route-guard.test.ts 是否测试路由级 guard**

直接通读 `frontend-v3/src/__tests__/t080-admin-route-guard.test.ts`（167 行）：
- `createGuardedRouter()`（L44-78）自建 `createRouter({ history: createMemoryHistory(), routes: [...] })`，路由表内 `/admin` 路由显式声明 `meta: { requiresAdmin: true }`（L51-56）
- `router.beforeEach`（L61-75）复刻 `router.ts` 的 `to.meta.requiresAdmin` 分支判断逻辑，但这是**复刻的独立副本**，不 import 真实 `router.ts`（无任何 `import router from '@/router'` 或类似语句）
- 4 个 `describe` 内共 5 个 `it()`：`test_bdd_14`(L81) `test_bdd_14b`(L95) `test_bdd_15`(L111) `test_bdd_15b`(L125) `test_bdd_15c`(L146)

**结论：确认该文件测的是路由级 `meta.requiresAdmin` guard（自建 mock router，不依赖真实 router.ts），analyst 关于"自包含、测路由级 guard、删除 /admin 后仍会误报通过"的判断准确。**

**Correction Note（非阻塞）**：P1-requirements.md 第 32 行（隐含需求表第 5 行）声称该文件含"4 个 it"，实际核实为 **5 个** `it()`（`test_bdd_14`/`14b`/`15`/`15b`/`15c`）。此数字仅用于隐含需求表的支撑性描述，不影响 BDD-16 的 Given/When/Then 本身可判定性（BDD-16 只要求"迁移为测试 tab 级守卫逻辑"，不依赖具体 it 数量），故不构成 needs-revision 理由，建议 P4 实现时按实际 5 个用例迁移（而非机械对应 4 个）。

## BDD 评审

### 功能对等

- BDD-1: 判定=可二值（列表渲染+分页数一致+含用户名/状态徽章） + 覆盖维度：数据✓ 前端✓ 多端✓ 边界✗ 兼容✓
- BDD-2: 判定=可二值（任一操作成功后列表反映新状态/目标消失，且行为与原页一致） + 覆盖维度：数据✓ 前端✓ 多端✓ 边界✗ 兼容✓
- BDD-3: 判定=可二值（自我保护操作被拒绝+界面提示） + 覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓

### 权限边界

- BDD-4: 判定=可二值（桌面 tab-nav 可见"用户管理"） + 覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✗
- BDD-5: 判定=可二值（DOM 中不存在对应按钮，非仅样式隐藏，可访问性维度明确） + 覆盖维度：数据✗ 前端✓ 多端✗ 边界✓ 兼容✗
- BDD-6: 判定=可二值（非 admin 手动访问回退 profile，不渲染用户管理数据） + 覆盖维度：数据✗ 前端✓ 多端✗ 边界✓ 兼容✗
- BDD-7: 判定=可二值（未登录重定向 `/`，复用既有 settings 守卫，不进入组件内部） + 覆盖维度：数据✗ 前端✓ 多端✓ 边界✓ 兼容✓

### 路由删除

- BDD-8: 判定=可二值（admin 访问 /admin → 404，URL 不重定向） + 覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✓
- BDD-9: 判定=可二值（非 admin 访问 /admin → 404，明确与旧"重定向到 /explore"行为区分） + 覆盖维度：数据✗ 前端✓ 多端✗ 边界✓ 兼容✓
- BDD-10: 判定=可二值（未登录访问 /admin → 404，明确与旧"重定向到 /"行为区分） + 覆盖维度：数据✗ 前端✓ 多端✗ 边界✓ 兼容✓

### 入口发现

- BDD-11: 判定=可二值（UserMenu 存在可点击项，点击后落地 `/settings?tab=user-manager` 且显示内容） + 覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✗
- BDD-12: 判定=可二值（非 admin 的 UserMenu 不出现用户管理选项） + 覆盖维度：数据✗ 前端✓ 多端✗ 边界✓ 兼容✗

### 移动端呈现

- BDD-13: 判定=可二值（≤640px 堆叠布局含用户管理区块，内容与桌面 tab 一致） + 覆盖维度：数据✗ 前端✓ 多端✗ 边界✓ 兼容✗
- BDD-14: 判定=可二值（非 admin 移动端 DOM 中不存在用户管理区块，非折叠而是不渲染） + 覆盖维度：数据✗ 前端✓ 多端✗ 边界✓ 兼容✗

### 测试资产迁移

- BDD-15: 判定=可二值（8 个既有场景迁移到新路径+断言改为 404，`make debug-test` 全绿，desktop+mobile 双 viewport） + 覆盖维度：数据✗ 前端✓ 多端✓ 边界✗ 兼容✓
- BDD-16: 判定=可二值（迁移为测试 tab 级 isAdmin 回退逻辑，`make test-frontend` 通过，且不再有依赖已删除路由级守卫的断言） + 覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✓

### 遗留引用回归检查

- BDD-17: 判定=可二值（排除 router.ts 自身定义和 client.ts 后端路径后，无其他前端硬编码 `/admin` 跳转） + 覆盖维度：数据✗ 前端✓ 多端✗ 边界✗ 兼容✓

**BDD 总数 = 17，编号 BDD-1 至 BDD-17 连续无跳号，格式统一为 `#### BDD-NN:`，每条均单一 Given-When-Then，无"部分通过"类中间态表述。**

## 隐含需求覆盖

- 数据维度：**覆盖但薄**——本任务前后端零改动、无 schema/数据迁移，"数据"维度天然适用面窄；BDD-1/2/3 覆盖了用户列表数据渲染/状态变更一致性这一层，属合理的最小必要覆盖，非遗漏
- 前端维度：**充分覆盖**——UI 状态（BDD-1/4/5）、交互（BDD-2/3）、响应式（BDD-13/14 明确 ≤640px 断点）、可访问性（BDD-5/14 明确要求"DOM 不存在"而非仅样式隐藏，是精确到位的隐含需求识别）
- 多端维度：**覆盖**——BDD-2 显式要求"行为与原 /admin 页面完全一致"（前后端契约不变的验证锚点）；BDD-7 显式声明复用路由级既有守卫而非在 SettingsView 内重复实现，避免了保护逻辑重叠处优先级歧义；隐含需求表第 8 条专门澄清"未登录守卫是复用现状非新增逻辑"，是准确的跨层边界澄清
- 边界维度：**覆盖**——BDD-3/6/7/9/10/12/13/14 均覆盖了角色边界（admin/非admin/未登录）与视口边界（≤640px）；唯一薄弱点是 BDD-1/2 未显式覆盖列表为空/仅一页等纯数据边界，但这是 AdminView 迁移前已有行为，非本任务引入的新逻辑，不属于本次改动必须覆盖的边界范畴
- 兼容维度：**充分覆盖**——BDD-8/9/10 逐条显式对比新旧行为差异（"不发生重定向""与旧行为不同"），BDD-17 做遗留引用回归检查，隐含需求表第 4/9/10/11 条分别核查死代码、硬编码引用、CSS 变量兼容性、依赖组件不变性，兼容性尽调完整

**隐含需求表 11 条覆盖：路由守卫迁移路径(#1-3)、死代码识别(#4)、双测试资产迁移(#5-6)、入口可发现性(#7)、保护逻辑分层澄清(#8)、遗留引用扫描(#9)、CSS 变量兼容性核实(#10)、依赖组件不变性核实(#11)——五维度检查清单要求的类目均有对应条目，无缺项。**

## P1 纯净性核查

隐含需求表（第 2 节）出现的实现相关措辞（如"activeTab computed 需要加 isAdmin 判断"）属于对现状代码结构的必要引用，用以论证隐含需求存在的理由，未越界成为方案设计（未指定具体如何改写代码、未给出组件结构方案）；BDD 本身（第 3 节）全程保持用户可见行为描述，未出现"调用哪个 API""用哪个 Vue API"等实现细节。**判定：P1 纯净性合格，无解决方案设计混入。**

## BDD 跨条一致性

- 同场景 Then 矛盾核查：BDD-6（登录非 admin，手动访问 `?tab=user-manager` → 回退 profile）与 BDD-7（未登录访问同路径 → 重定向 `/`）Given 条件（认证状态）不同，Then 不冲突；BDD-9（非 admin 访问 `/admin` → 404）与旧 t080 测试的"重定向 /explore"语义不同，P1-requirements.md 已在 BDD-9 正文显式标注"与旧行为不同"，不是遗漏而是有意识的行为变更声明——**不构成跨条矛盾**
- 保护优先级：隐含需求表第 8 条显式声明"未登录守卫在路由级拦截，先于 tab 级 isAdmin 判断生效"，优先级链路（路由级认证守卫 → 组件内角色判断）表述清晰，无歧义

## 裁剪评审（P1 第 5 节逐项）

- P0：已完成，不适用裁剪判断
- P1：不裁剪（核心阶段），本文件即产出——**合规**
- P2：不裁剪阶段本身，采纳 `follows_existing_pattern` 简化为单候选方案——**理由充分**：settings 已有 `?tab=` 机制 + `/settings/apikeys` redirect 先例（P0-brief 已核实），属于"跟随既有模式"的典型场景，符合 agate 规则"design_trivial/follows_existing_pattern 可简化为 1 候选方案"的裁剪许可条件
- P3：保留，声明为需要红灯——**理由充分**：medium risk + 权限边界逻辑（BDD-4/5/6/12/13/14）是本任务核心风险点，与 agate 规则"medium/high risk 必须走 TDD 红灯"一致，未裁剪
- P4：正常实现，不适用裁剪判断
- P5：保留全量测试套件——**理由充分**：迁移后 admin.spec.ts + t080-admin-route-guard.test.ts 均需回归验证
- P6：不裁剪——**理由充分**：BDD-4/5/6/8/9/10/13/14 均为纯视觉/DOM 可见性判定，代码审查无法确认，必须 Playwright 实跑+截图，与 agate 规则"P6 不可裁剪"一致（本任务也未声称裁剪 P6，仅注明"不可省"）
- P7：保留——**理由充分**：7 个文件级改动点（router.ts/SettingsView.vue/AdminView.vue删除/UserManagerTab.vue新建/UserMenu.vue/admin.spec.ts/t080-admin-route-guard.test.ts），符合"多文件改动需 P7"的判断标准
- P8：正常发布准备，不适用裁剪判断

**结论：无阶段被实质跳过，仅 P2 按规则许可简化为单候选方案，其余阶段均保留。裁剪说明第 5 节标题"不裁剪任何阶段"与正文内容一致，无夸大或遗漏。**

**risk_level=medium 匹配度核查**：declared 理由为"路由守卫从路由级迁移到组件级（权限边界不能漏）+ 跨 7 个文件 + 双重测试资产语义级迁移，但不触碰后端/数据库/schema"。核实 `router.ts` 现状（L92-95 `if (to.meta.requiresAdmin)` 分支）与 `AGENTS.md` 权限模型确认：后端 `/api/v1/admin/*` 全部 `require_admin` 且本任务零改动——即便前端 tab 级守卫存在缺陷导致非 admin 短暂看到 user-manager tab，实际管理操作仍会被后端拒绝（403），构成纵深防御。这一事实支持 medium 而非 high 的定级：真正的授权边界仍在后端且未改动，前端改动只影响"发现性/展示层"而非"授权层"。**判定：risk_level=medium 合理，不需要上调至 high。**

**capability_requirements 三态核查**：3 项声明（browser-vision / e2e-test-runner / frontend-unit-test-runner）均为 `status: available`，对照 AGENTS.md 已确认 `make debug-test`/`make test-frontend`/playwright-cdp skill 均为项目已文档化能力，无需 supplementable 或 GAP，**判定正确**。

## 用户拍板决策转译忠实度核查（对照 P0-brief.md "用户决策（已拍板）"节）

1. 完全合并 → BDD-1/2/3 + 需求复述第 1 条，转译忠实，无引入新解读
2. 删除 `/admin`、不做 redirect、旧书签 404 → BDD-8/9/10 逐条明确"不发生重定向""URL 不被重定向"，转译忠实
3. tab 可见性 `isAdmin` 判断 + 非 admin 回退 profile → BDD-4/5/6/7 精确区分"已登录非 admin→回退 profile"（BDD-6）与"未登录→重定向 /"（BDD-7）两种场景，未将两者混为一谈，转译精确且优于字面拍板描述（拍板未细分认证状态，analyst 主动补全了这一隐含分支）

**判定：三点拍板决策均被忠实转译为对应 BDD，未引入偏离拍板方向的新解读。**

## Advisory Note（非阻塞，供 P2 参考）

SUGGEST 第 3 条（UserMenu 复用现有 "Settings" 跳转项而非新增按钮）需注意：若 P2/P4 采纳该 SUGGEST 但未同步调整跳转目标的 query 参数（即仍跳到 `/settings?tab=apikeys` 而非按角色动态跳 `/settings?tab=user-manager`），将与 BDD-11"点击后到达 `/settings?tab=user-manager` 且显示用户管理内容"的字面要求不符。建议 P2 设计时明确：无论是否新增独立按钮，admin 用户点击该入口后的**落地 tab 必须是 user-manager**，这是 BDD-11 的硬性验收点，不因入口 UI 形式的简化而降低。

其余两条 SUGGEST（router.ts 死代码清理放 P4 一并处理 / t080 测试文件原地重写而非新建删旧）均为纯技术性选择，不涉及业务方向或破坏性变更，**判定：可由主 Agent 直接采纳，无需询问用户**。

## 结论

P1-requirements.md **approved**。

- 17 条 BDD（BDD-1 至 BDD-17）均可二值判定，编号连续、格式合规，锚点见上文"BDD 评审"节
- 隐含需求五维度（数据/前端/多端/边界/兼容）均有对应条目覆盖，无缺项
- 裁剪说明第 5 节逐项理由充分，无实质跳过阶段
- risk_level=medium 与实际风险匹配（有后端纵深防御支撑判断）
- 三点用户拍板决策（BDD-1/2/3、BDD-8/9/10、BDD-4/5/6/7 对应）忠实转译，无解读偏离
- dispatch-context 要求独立核实的两处关键声称均已核实：e2e/admin.spec.ts 确为 8 个 test()（核查①），t080-admin-route-guard.test.ts 确测路由级 guard（核查②），但同时发现该文件的 `it()` 实际数为 5 而非 analyst 声称的 4（Correction Note，非阻塞）
- 3 条 SUGGEST 中 2 条（死代码清理时机、测试文件重写方式）可直接采纳，第 3 条（UserMenu 复用入口）需 P2 注意落地 tab 目标以满足 BDD-11（Advisory Note，非阻塞）

无 needs-revision 或 rejected 理由；上述两条 Note 不影响 BDD 基线的可判定性和完整性，均以非阻塞形式记录供 P2/P4 参考。
