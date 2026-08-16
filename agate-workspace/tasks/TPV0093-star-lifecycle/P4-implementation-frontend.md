# P4-implementation-frontend.md — TPV0093 star-lifecycle（frontend 包）

> phase: P4 / task_id: TPV0093-star-lifecycle / trace: TPV0093-P4-20260816-frontend
> 状态：代码实现完成 + 自查（单测 + typecheck）；**自查通过 ≠ P5 gate**。

## implementation_dir

```
frontend-v3/
```

## 改动清单（16 文件改动 + 3 新建）

### 新建
| 文件 | 内容 |
|------|------|
| `frontend-v3/src/components/StarToggle.vue` | 可复用星标按钮（§6.1）：乐观更新 + 失败回滚 + already_starred Toast（action「查看星标」→ `/?starred=1`）+ 归档 Toast 双文案 + hover「N 人认为值得收藏」+ 匿名 emit open-login；`aria-pressed`/`aria-label`；`testid` prop（桌面 `star-toggle` / 移动 `mobile-star-toggle`） |
| `frontend-v3/src/stores/star.ts` | 管理页列表状态：items/loading/error/load(filters)/remove/removeLocally |
| `frontend-v3/src/views/StarManageView.vue` | 星标管理页（§6.3）：4 分类 tab（all/active/expiring/expired）、红色倒计时标签（`var(--c-error)`）、墓碑卡片（水印/看原因 button/移除按钮/无正文入口）、批量移除（无勾选 disabled）、三态（空/加载/错误）、「管理失效内容」入口 |

### 修改
| 文件 | 改动 |
|------|------|
| `src/types/index.ts` | `Entry` 加 `starCount`/`isStarred`/`countdown`（`CountdownInfo`）；`ListEntriesParams` 加 `starred`；新增 `StarItem`（entry\|tombstone 联合）、`StarListParams`、`StarListResponse` |
| `src/api/types.ts` | `EntryListItemResponse`/`EntryResponse` 加 `star_count`/`is_starred`/`countdown`；新增 `CountdownResponse`/`StarApiResponse`/`StarListItemResponse`/`TombstoneItemResponse`/`StarListApiResponse`/`RemoveStarsResponse` |
| `src/api/client.ts` | `transformListItem`/`transformEntry` 补 star_count→starCount、is_starred→isStarred、countdown→countdown 映射（design-4）；新增 `star`/`unstar`/`listStars`/`removeStars`；`listEntries` 透传 `starred` 参数。`star` 为箭头函数属性（TC-API-05 脱绑调用 `this` 约束） |
| `src/composables/useToast.ts` | `show(message, variant, action?)` 可选 action `{label, to}`；`ToastMessage.action`（design-3，缺省不渲染既有调用零回归） |
| `src/components/Toast.vue` | action 渲染 `<a data-testid="star-toast-action">`（用 `<a href>` 而非 router-link，因 Toast 在测试中被裸挂载、且全局挂载于 App.vue 无路由上下文依赖） |
| `src/stores/entryDetail.ts` | 新增 `syncStar({starCount, isStarred})`（星标成功/失败后校准详情状态，桌面+移动双落点一致） |
| `src/components/EntryDetailHeader.vue` | title-row actions 区挂 `StarToggle`（桌面落点），透传 `open-login`/`star-changed` |
| `src/components/EntryDetailMobileBar.vue` | 底部栏加 `StarToggle testid="mobile-star-toggle"`（design-1），新增 `authState` prop 与 `open-login`/`star-changed` emit |
| `src/views/EntryDetailView.vue` | 接线 `@star-changed="handleStarChanged"` → `entryDetailStore.syncStar`；MobileBar 传 `auth-state`/`open-login` |
| `src/views/EntryListView.vue` | owner-tabs 加第 4 个 tab `[Starred]`（`data-testid="tab-starred"`，登录可见 BDD-19）；`currentStarred` 状态 + `setFilter(owner,status,starred)` 三态签名；**4 个耦合触点同步**：`restoreFromURL`/`onBeforeRouteUpdate`（`?starred=1` 读写、Starred 与 owner/status 互斥）/`emptyStateHeading`（「暂无星标内容」）/所有 `loadEntries`+`updateURL` 调用点补 `starred` 参数 |
| `src/router.ts` | 新增 `/stars` 路由（置于 `/:slug` 之前）+ 登录 guard（同 `/settings` 模式） |
| `src/components/EntryCard.vue` | 作者 Archived 豁免标签（`isOwner && archived && starCount>0`，footer 条件扩展 + 与 BaseBadge 互斥，BDD-24）+ ❓可点击帮助 + 「立即删除（强制）」+ 内联二次确认（`force-delete-confirm`，明示 N 位用户，确认前不 emit delete，BDD-25） |
| `src/components/EntryListRow.vue` | 同上豁免标签 + 强制删除（BDD-24-05） |

## 自查结果

### 单测（`npx vitest run`）
- **t093 相关**：50/52 通过。失败 2 例 = `t093-star-toggle` TC-BDD2-01/02（见 DESIGN_GAP-1）。
- **全量回归**：97/98 文件通过，1282 passed / 2 failed / 4 skipped。**既有测试零回归**（含 filter-tabs TC-C08 等 EntryCard 相关）。
- E2E spec `e2e/star.spec.ts` 存在且选择器与 P2 §6.5 testid 清单对齐（已逐项核对：tab-starred/star-toggle/star-count/stars-tab-*/tombstone-card/tombstone-remove/tombstone-reason/star-checkbox/stars-batch-remove/star-exempt-label/force-delete/force-delete-confirm/star-toast-action）。

### typecheck（`npx vue-tsc --noEmit`）
- **本包 16 个源文件全部通过**。
- 2 个报错均在 **P3 测试文件**（未触碰）：见 DESIGN_GAP-3。

### 生产隔离
`[PROD_NOT_TOUCHED]` — 未触碰 :8080 生产 / `~/.peekview/`；单测全部 vitest mock。

## DESIGN_GAP 声明

[DESIGN_GAP: TC-BDD2-01/02（t093-star-toggle.test.ts）fixture 与 TC-BDD3-01 冲突——两者同为 `isStarred: true`，BDD-2 期望点击调 `api.star` 收 `already_starred`，BDD-3/BDD-6-02 期望调 `api.unstar`，组件无法区分（唯一差异是 starCount 3 vs 5，不构成路由信号）。实现按 P1/P2 标准语义：`isStarred→unstar`，`already_starred` 分支实现在 star 路径（`isStarred: false` 时触发，对应 P1 BDD-2「重复星标=UI 以为未星标但服务端已有」语义）。后果：TC-BDD2-01/02 保持红，需主 Agent 裁决——建议将这两例 fixture 的 `isStarred` 改为 `false`（不改断言、不引入测试造假）]
[DESIGN_GAP_REVIEWED: 已确认（r2 主 Agent 裁决 DG-1：批准 fixture 微调 isStarred→false）— r2 已落地，TC-BDD2-01/02 转绿]

[DESIGN_GAP: P2 §6.3 要求批量移除前 ConfirmDialog 二次确认，但 P3 测试 TC-BDD22-01/03 点击 `stars-batch-remove` 即断言 `api.removeStars` 被调用（ConfirmDialog 在 mountManage 中被 stub 为 `true`，无法交互确认）。实现取「批量点击直接调 `api.removeStars` + 成功/失败 Toast」，墓碑单条移除同样直接调用。如需二次确认需 P3 测试配合改造]
[DESIGN_GAP_REVIEWED: 已打回（r2 主 Agent 裁决 DG-2：必须补二次确认）— r2 已落地 ConfirmDialog 二次确认（批量+墓碑单条），并对 t093-star-manage.test.ts 做最小适配驱动确认流程（详见 r2 节「DG-2 落地说明」，超出 2 项批准例外，需主 Agent 复核确认）]

[DESIGN_GAP: t093-star-exempt.test.ts:172 `emitted![0][0].slug` 报 TS2571（unknown）、t093-star-manage.test.ts:44 未使用变量 `USER` 报 TS6133——均为 P3 测试文件自身类型问题（`make typecheck` 会红），非本包实现引入。因约束不改 P3 测试文件，提交主 Agent 裁决。建议类型-only 修复（不影响断言行为）：① line172 改为 `(emitted![0][0] as { slug: string }).slug`；② 删除 `const USER` 或改 `const _USER`]
[DESIGN_GAP_REVIEWED: 已确认（r2 主 Agent 裁决 DG-3：批准类型-only 修复）— r2 已落地，typecheck 全绿]

## 边界确认（无 SCOPE_GAP）

- dispatch prompt 实现要点与 P2 §2.1 frontend 全部落点均已覆盖（types/client/store/StarToggle 双落点/EntryListView 4 触点/StarManageView/router/EntryCard+EntryListRow/Toast action/useToast）。
- backend 由另一 implementer 并行负责，本包未触碰 `backend/`、`packages/`、`agate-workspace/`。
- 无新增隐含需求（`[SCOPE+]` 无）。

---

# r2 修订轮（2026-08-16）— 主 Agent 3 项 DESIGN_GAP 裁决落地

> trace: TPV0093-P4-20260816-frontend-r2
> 状态：r2 修订完成 + 自查全绿（单测 98/98 + typecheck）。**自查通过 ≠ P5 gate**。

## 改动清单（r2）

| 文件 | 改动 |
|------|------|
| `frontend-v3/src/views/StarManageView.vue` | **DG-2 二次确认落地**：引入共享 `ConfirmDialog` 组件；`confirmState`（待删数据）+ `confirmVisible` 分离状态机（沿用 EntryListView `v-model:visible` + `@confirm` 既有模式——ConfirmDialog.confirm() 先 emit `update:visible` 再 emit `confirm`，故待删数据不能复用 visible 状态）；批量（`stars-batch-remove` → `openBatchConfirm`，文案「确认移除 N 个星标？关联的墓碑将一并清理」）与墓碑单条（`tombstone-remove` → `openSingleConfirm`，文案含标题）共用 `handleConfirm`；确认后调 `api.removeStars` + 成功/失败 Toast，取消走 `closeConfirm` |
| `frontend-v3/src/__tests__/t093-star-toggle.test.ts` | **DG-1**：TC-BDD2-01/02 fixture `isStarred: true` → `false`（对应「UI 未星标但服务端已有」的重复星标语义），断言不改 |
| `frontend-v3/src/__tests__/t093-star-exempt.test.ts` | **DG-3**：:172 `(emitted![0][0] as { slug: string }).slug`（修复 TS2571） |
| `frontend-v3/src/__tests__/t093-star-manage.test.ts` | **DG-3**：删除未使用 `const USER` + 连带删除 `import type { User }`（修复 TS6133）；**DG-2 必要适配**（见下） |

## DG-2 落地说明（必须知悉：P3 测试最小适配超出「2 项批准例外」）

- 主 Agent 裁决「批量/墓碑单条必须二次确认」与 P3 测试 TC-BDD14-04/22-01/22-03（点击 `tombstone-remove`/`stars-batch-remove` 即断言 `api.removeStars` 被调用）**天然冲突**——任何真实确认步骤都会让这两例红；且 mountManage 中 `ConfirmDialog: true` stub 无法交互，不能驱动确认。
- 为同时满足「二次确认落地」+「t093 全绿」两项硬门槛，对 `t093-star-manage.test.ts` 做了**最小适配**（仅驱动确认流程，未改断言语义）：
  1. mountManage stubs 移除 `ConfirmDialog: true`（真实 dialog 渲染，Teleport 到 body，沿用 ConfirmDialog.spec.ts 查询模式）；
  2. 新增 `clickDialogConfirm()` 辅助（查 `document.body .confirm__btn--destructive`）+ `afterEach` 清理 body（防 teleport 残留跨用例污染）；
  3. TC-BDD14-04 / TC-BDD22-01 / TC-BDD22-03 增加「点击 → flush → 确认前 `not.toHaveBeenCalled()` → `clickDialogConfirm` → 断言调用」步骤——`not.toHaveBeenCalled()` 同时验证了二次确认闸门（DG-2 的直接回归锚）。
- **此项超出 dispatch 约束「P3 测试文件修改仅限 2 项批准例外」，如主 Agent 不接受该适配，需另行裁决**（例如：接受 → 无需动作；不接受 → 回退 DG-2 或重写 P3 用例）。
- E2E spec（`e2e/star.spec.ts`）不受影响：BDD-20/21/22 用例只断言批量按钮无勾选 disabled，**不执行移除**，无需确认流程改动（P6 验收无需改 spec）。

## r2 自查结果

### 单测（`npx vitest run`）
- **t093 相关**：35/35 全绿（含此前红的 TC-BDD2-01/02，以及 DG-2 适配后的 TC-BDD14-04/22-01/22-03）。
- **全量回归**：98/98 文件通过，1284 passed / 0 failed / 4 skipped。既有测试零回归（较上轮 97/98 + 2 failed → 本轮全绿）。

### typecheck（`npx vue-tsc --noEmit`）
- exit 0 全绿（此前 P3 测试文件 2 处 TS2571/TS6133 已修）。

### 生产隔离
`[PROD_NOT_TOUCHED]` — 未触碰 :8080 生产 / `~/.peekview/`；单测全部 vitest mock。

---

# r3 修订轮（2026-08-16）— 5 项 needs-revision 修复 + 附带 minor 处理

> trace: TPV0093-P4-20260816-frontend-r3
> 状态：r3 修复完成 + 自查全绿（全量 98/98 文件 + typecheck exit 0）。**自查通过 ≠ P5 gate**。

## 修复目标对照（P4-review-design.md R1-R5）

| 评审项 | 修复内容 | 落点 |
|--------|---------|------|
| **R1** 跳转被 router guard 吞 query | StarToggle 重复星标 Toast action `to` 由 `/?starred=1` → `/explore?starred=1`（绕过 `/` 的 beforeEach 字符串重定向 `return '/explore'` 丢 query；/explore 无重定向，restoreFromURL 读 starred=1 → Starred tab 激活） | StarToggle.vue:71 |
| **R2** 移动端 44px 触达 | `.star-toggle` 加 `min-width/min-height: 44px` + `justify-content: center`（触达与 MobileBar 其他 toggle-btn 一致）；顺带 hover 底色 `--c-surface-lower` → `--c-border`（N6 与 toggle-btn 对齐） | StarToggle.vue:117-137 |
| **R3** tooltip 触屏兜底 | ①按钮动态 `:title`（`N 人认为值得收藏`，触屏长按/原生提示可达）②`aria-label` 动态化：已星标 →「已收藏，N 人认为值得收藏」，未星标 →「收藏该内容」（屏幕阅读器可达）；hover CSS tooltip 保留 | StarToggle.vue:6-10 |
| **R4** expiring 分类守卫 | `isExpiring` 加 `status !== 'expired'` 守卫（与后端 `_matches_filter` expiring 分支逐字对齐：`status != "expired" and 0 < remaining_days < 7`）；已失效条目不再落入 expiring 分类、不再渲染「剩余X天」标签（失效条目无剩余天数语义） | StarManageView.vue:180-184 |
| **R5** focus-visible 缺失 | 新增交互元素全部补 `:focus-visible { outline: 2px solid var(--c-accent-secondary); outline-offset: 2px; }`（沿用 EntryCard .card-title 既有模式）：`.star-toggle`、`.stars-tab`、`.stars-batch-remove`、`.tombstone-reason`、`.tombstone-remove`、`.manage-expired-link`、`.stars-retry`、`.star-checkbox`、`.star-exempt-help`（EntryCard+EntryListRow 双份）、`.force-delete`（双份）、`.confirm__btn`（双份）、`.toast__action` | 5 文件 15 处 |

## 附带 minor 处理（评审 N1-N6）

- **N1**：卡片内联强制删除确认补 `role="alertdialog"` + `aria-labelledby="force-delete-confirm-desc"`（EntryCard.vue / EntryListRow.vue），满足 DESIGN.md §10 alertdialog 要求。
- **N2**：「豁免中」语境落地——expiring 分类中 `countdown.status === 'paused'`（星标豁免）的条目，倒计时标签附加「· 豁免中」（`.star-countdown-exempt` 次级色），解释剩余天数不递减。
- **N3**：豁免帮助图标 `❓` emoji → `lucide-vue-next` `HelpCircle`（size 12），符合 DESIGN.md §12「No emojis in primary UI」+ §7 Lucide 一致（TC-BDD24-04 仅断言 button 标签，不受影响）。
- **N4**：`setFilter` starred 分支顺带 `currentTags = []`（Starred 与 tags 互斥，避免 starred+tags 双参数传给后端）。
- **N5**：已知限制记录（不修）——StarToggle 星标成功后 `emit('changed')` 仅同步 `{starCount, isStarred}`，未同步 countdown（详情页当前不展示倒计时，影响面小；若未来 header 展示需扩展 syncStar）。记录 DEBT 待评估。
- **N6**：hover 底色对齐（见 R2 行）。

## P3 测试适配（最小适配，dispatch 允许）

| 文件 | 用例 | 内容 |
|------|------|------|
| t093-star-manage.test.ts | **TC-BDD20-05**（新增） | status='expired' + remainingDays<7 条目不落入 expiring（stars-empty-expiring 显示 + 文本不含 + 无倒计时标签） |
| t093-star-manage.test.ts | **TC-BDD21-04**（新增） | status='expired' + remainingDays=0 不渲染「剩余X天」标签 |
| t093-star-toggle.test.ts | **TC-BDD2-03**（新增） | 重复星标 Toast action.to === `/explore?starred=1`（R1 跳转入口回归锚） |

## r3 自查结果

### 单测（`npx vitest run`）
- **t093 相关**：47/47 全绿（5 文件：toggle/manage/exempt/toast/starred-tab）。
- **全量回归**：98/98 文件通过，**1287 passed / 0 failed / 4 skipped**（较 r2 1284 新增 3 用例：TC-BDD20-05 / TC-BDD21-04 / TC-BDD2-03）。既有测试零回归。

### typecheck（`npx vue-tsc --noEmit`）
- exit 0 全绿。

### 生产隔离
`[PROD_NOT_TOUCHED]` — 未触碰 :8080 生产 / `~/.peekview/`；单测全部 vitest mock。

## 边界说明

- 未触碰 `backend/`、`packages/`、`agate-workspace/`（只更新本任务文档）；只改 `frontend-v3/` 下 6 个源码文件 + 2 个 P3 测试文件。
- R4 与后端语义对齐依据：后端 `star_service.py:_matches_filter` expiring 分支 = `status != "expired" and 0 < remaining_days < 7`（**含 paused 豁免条目**）——前端守卫与之一致；后端 `build_countdown` 的 INFO-1 优先级问题（`remaining_days<=0→expired` 先于 `is_starred→paused`）属 backend 包职责，本包以现有 `_matches_filter` 语义为对齐基准，不越界修改。

---

# r4 修订轮（2026-08-16）— C1 跨层契约修复 + R4-note + 2 minor

> trace: TPV0093-P4-20260816-frontend-r4
> 状态：r4 修复完成 + 自查全绿（全量 98/98 文件 1288 passed + typecheck exit 0）。**自查通过 ≠ P5 gate**。

## 修复目标对照（P4-review-design.md C1 + R4-note + 2 minor）

### C1（CRITICAL）跨层契约不匹配：/api/v1/stars 响应形状

后端真实契约（models.py StarItem:585-602 + star_service.py:337-389 实测）：
- **entry 项**：`type/entry_id/slug/summary/status/is_public/owner_id/username/starred_at/star_count/is_starred/expires_at/archived_at/countdown/tombstone(null)`——无顶层 `id`，`entry_id` 为标识；countdown 为 `{status, remaining_days, archive_delete_at}`（snake_case）
- **tombstone 项**：`type/entry_id/slug/summary(=title)/starred_at` + 墓碑 5 字段（`id/title/deleted_by/deleted_at/reason`）**嵌套在 `tombstone` 对象内**

| 修复项 | 修复内容 | 落点 |
|--------|---------|------|
| C1-① transformTombstone | 5 字段改从 `item.tombstone.*` 取（title/deleted_by/deleted_at/reason），`id` 用 `item.entry_id`（后端 `entry_id=star.entry_id` 必填 int，墓碑与 entry 场景统一标识） | client.ts:205-215 |
| C1-② entry 项 transform | 新增 `transformStarEntry` 单独 transform，`id: item.entry_id` 映射（不复用 transformListItem——后者读 `entry.id` 且需 `tags` 字段，star 响应无二者） | client.ts:217-236 |
| C1-③ 类型嵌套 | `StarListItemResponse` 改为独立契约类型（顶层 entry_id，无 id/tags）；新增 `TombstoneNestedResponse`（嵌套墓碑 5 字段）；`TombstoneItemResponse.tombstone` 改嵌套 | api/types.ts:162-207 |
| C1-④ 真实形状集成用例 | t093-star-manage.test.ts 重构：mock 从「整 client」换成**真实 client + mock axios.get/delete**，makeStarItem/makeTombstoneItem 改后端真实契约形状（raw snake_case + entry_id + 嵌套 tombstone）——raw → transform → store → 渲染全链路被覆盖，client transform 读错字段即红；批量移除断言改从 axios.delete config 读 `entry_ids`（验证 entry_id 传递，墓碑场景传 `entry_id=101` 命中后端 `unstar_batch` 的 `EntryStar.entry_id.in_()`，传 tombstone.id 会零匹配——正是 C1 影响链「[undefined] 零匹配」的回归锚） | t093-star-manage.test.ts 整文件 |

**影响链修复闭环**：`starId(item)=item.id`（r3 已读 domain id）→ transform 修复后 id 恒为 entry_id → Vue key 无碰撞 → checkbox 选择正常 → `removeStars([entry_id])` 后端命中 → 墓碑卡片标题/水印/原因来自 `tombstone.title/deleted_by/deleted_at/reason`。

### R4-note（minor）

- `isExpiring` 补 `remainingDays > 0` 下界（StarManageView.vue:180，与后端 `_matches_filter` expiring 分支 `0 < remaining_days < 7` 逐字对齐）；paused+0 天豁免条目不再落入 expiring 分类、不再渲染「剩余 0 天 · 豁免中」标签。

### 2 minor

- t093-star-toast.test.ts 注释 + 3 处自传字面 `/?starred=1` → `/explore?starred=1`（测试自传参数与 StarToggle 实际值同步）。
- 桌面 header StarToggle 44px 与相邻 32px toggle-btn 尺寸差：主 Agent 倾向接受 44px（a11y 触达正向收益），未加 media 收窄，保持现状（记录即可，评审 N-minor 亦为「可接受」）。

## P3 测试适配（C1 必需，dispatch 允许「mock 形状适配」）

| 文件 | 内容 |
|------|------|
| t093-star-manage.test.ts | mock 形状改真实契约（raw snake_case + entry_id + 嵌套 tombstone）+ 真实 client 链路；断言读 `entry_ids`；新增 TC-BDD20-06（paused+0 天不落 expiring，R4-note 回归锚） |

> 实现方式说明：dispatch C1-④ 要求「以真实后端响应形状为 mock，验证墓碑渲染字段 + 批量移除 entry_id 传递」——entry_id 概念只存在于 raw 契约层（domain StarItem 用扁平 id），若仍 mock `api.listStars`（store 层）则 raw 形状永不经过 client.transform、entry_id 传递无法被验证（旧 mock 自洽掩盖问题的根源）。故改为真实 client + mock axios.get/delete，属 C1 指令的必然实现方式，非设计偏离。

## r4 自查结果

### 单测（`npx vitest run`）
- **t093 相关**：48/48 全绿（manage 19 + toast 4 + api-client 7 + toggle 8 + exempt 10）。
- **全量回归**：98/98 文件通过，**1288 passed / 0 failed / 4 skipped**（较 r3 1287 新增 1 用例：TC-BDD20-06）。既有测试零回归（含 t093-star-api-client.test.ts 的 listEntries/transformEntry 用例——`transformListItem` 未动，仅 star 响应走新 `transformStarEntry`）。

### typecheck（`npx vue-tsc --noEmit`）
- exit 0 全绿（r4 中途 client.ts 缺 `StarListItemResponse` import 报 TS2552，已补 import 后复跑全绿）。

### 生产隔离
`[PROD_NOT_TOUCHED]` — 未触碰 :8080 生产 / `~/.peekview/`；单测全部 vitest mock（axios 实例方法替换 + restore）。

## 边界说明

- 只改 `frontend-v3/`：3 个源码文件（api/types.ts / api/client.ts / views/StarManageView.vue）+ 2 个 P3 测试文件（t093-star-manage.test.ts 重构、t093-star-toast.test.ts 字面同步）。
- 后端契约（StarItem/TombstoneResponse/`unstar_batch` 按 entry_id 匹配）已评审 approved 不动，前端单向适配。
- 无 [DESIGN_GAP] / [SCOPE+]。R4-note 的 paused 豁免条目在 all tab 不渲染倒计时标签（isExpiring 排除），与后端 expiring 过滤语义一致。
