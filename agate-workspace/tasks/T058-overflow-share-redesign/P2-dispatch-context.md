---
phase: P2
task_id: T058
type: dispatch-context
created: 2026-07-17
agent: main
---

# T058 P2 Dispatch Context

## 任务上下文

### P1 关键决策（architect 必须遵循）
- OverflowMenu 从 DESIGN.md §6 规范出发完整重写（不是修补）
- 桌面端 Dropdown 和移动端 Bottom Sheet 拆为独立子组件
- 分享交互统一入口：分享按钮 + badge
- 桌面端用 Popover（280px），移动端用 Bottom Sheet
- ShareManagementPanel.vue 删除，新建 ShareDialog.vue + ShareDialogContent.vue
- P3 已恢复：需设计可测试的行为契约（props/emits/view switching/badge reactivity）
- P7 已裁剪：组件接口一致性由 P2 design-review 补偿检查

### P1 BDD 摘要（26 条）
- BDD-01~03: OverflowMenu 视觉 token（背景/边框阴影/hover 含 danger）
- BDD-04: Share 从 OverflowMenu 移除
- BDD-05: Badge 反映活跃链接数
- BDD-06: Loading 状态
- BDD-07~09: 链接列表显示/复制/过期折叠
- BDD-10a~c: 创建视图 UI/成功/失败
- BDD-11: 即时撤销
- BDD-12~13: Popover 打开关闭/视口溢出
- BDD-14~15: Bottom Sheet 打开/关闭
- BDD-16~17: 子组件拆分（desktop/mobile）
- BDD-18~19: Light/Dark 主题
- BDD-20: OverflowMenu 键盘导航
- BDD-21: 空状态
- BDD-22: Mobile share button 位置
- BDD-23: Popover 键盘导航
- BDD-24: Tablet viewport

### 现有代码关键路径
- `frontend-v3/src/components/OverflowMenu.vue` — 当前实现（需重写）
- `frontend-v3/src/components/ShareManagementPanel.vue` — 当前实现（需删除）
- `frontend-v3/src/views/EntryDetailView.vue` — 引用方（需调整）
- `frontend-v3/src/stores/share.ts` — Pinia store（不变）
- `frontend-v3/src/types/index.ts:140-155` — ShareInfo/ShareCreateResult 类型
- `frontend-v3/src/api/client.ts:279` — shareUrl 映射
- `frontend-v3/src/api/types.ts:110-130` — API 响应类型
- `DESIGN.md` — 设计规范（§6 Dropdown/Select, §9 响应式断点）

### Share URL 构造
- `ShareCreateResult.shareUrl` 在创建时提供完整 URL
- 列表 API 返回的 `ShareInfo` 只有 `tokenPrefix`，前端需自行拼装
- 拼装规则：`{base_url}/{slug}?share={full_token}`

### verification_env
```yaml
ui_affected: true
gate_requires_playwright: true
debug_env: "make debug-start (:8888, /tmp/peekview-debug/)"
vision_available: true
```
