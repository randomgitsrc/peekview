---
phase: P4
task_id: T068-account-settings
type: implementation
parent: P3-test-cases.md
trace_id: T068-P4-20260723
status: draft
created: 2026-07-23
agent: implementer
---

## implementation_dir

- Backend: `backend/peekview/`
- Frontend: `frontend-v3/src/`

## 改动清单

### 后端

| 文件 | 改动 |
|------|------|
| `backend/peekview/models.py:730` | 新增 `UpdateProfileRequest(SQLModel)` schema（display_name: str \| None = None, max_length=64） |
| `backend/peekview/api/auth.py:200` | 新增 `PATCH /me` 端点：require_auth → trim display_name → 空字符串清空为 null → commit → return UserResponse |
| `backend/peekview/api/auth.py:24` | import UpdateProfileRequest |

### 前端

| 文件 | 改动 |
|------|------|
| `frontend-v3/src/views/SettingsView.vue` | **新增** — 单页 tab 组件（Profile/Security/API Keys），auth guard 条件渲染，tab 与 URL query param 双向同步，移动端垂直分区 |
| `frontend-v3/src/components/settings/ProfileTab.vue` | **新增** — 显示名编辑 + 只读字段（username/role/member since） |
| `frontend-v3/src/components/settings/SecurityTab.vue` | **新增** — 改密码表单（前端校验 + submit protection） |
| `frontend-v3/src/components/settings/ApiKeySettingsTab.vue` | **新增** — 从 ApiKeyListView 提取的无 header 子组件，保留全部功能 |
| `frontend-v3/src/router.ts` | 新增 `/settings` 路由 + `/settings/apikeys` 重定向 + auth guard |
| `frontend-v3/src/stores/auth.ts` | 新增 `updateProfile()` action |
| `frontend-v3/src/api/client.ts` | 新增 `updateProfile()` + `changePassword()` 方法 |
| `frontend-v3/src/composables/useToast.ts` | 新增 `success()` + `error()` 便捷方法 |
| `frontend-v3/src/views/EntryListView.vue:377` | navigateToApiKeys 路径更新为 `/settings?tab=apikeys` |

## 自查结果

- 后端 pytest: 16/16 passed (test_auth_me.py)
- 前端 vitest: 19/19 passed (t068-account-settings.spec.ts)
- 前端全量: 997 passed, 1 skipped
- ruff: All checks passed
- vue-tsc: 0 errors in implementation code (1 unused import in test file from P3)

## DESIGN_GAP

[DESIGN_GAP: P2 未指定 useToast 是否有 success/error 便捷方法。测试 mock 提供了 success/error，实际 useToast 只有 show(msg, variant)。实现中新增了 success/error 便捷方法以匹配测试预期，同时保持 show() 向后兼容]

## 实现决策

1. **toRef 用于 authStore 属性访问**：测试 mock 返回的 authStore 是普通对象（非 Pinia reactive wrapper），`authStore.authState` 和 `authStore.user` 是原始 ref。使用 `toRef(authStore, 'authState')` 确保在真实 Pinia store 和 mock 场景下都能正确解包 ref 值。

2. **ApiKeySettingsTab 完整提取**：从 ApiKeyListView.vue 提取时保留了所有功能逻辑（loadKeys/handleCreate/handleRevoke/handleCleanup/dialogs），仅移除 header 区域和 .apikey-page wrapper。ApiKeyListView.vue 文件保留未修改（旧路由已重定向，但文件不删除以避免破坏性变更）。

3. **Security tab 密码字段清空**：P2 设计说"成功后 toast + 清空三个字段"，实现中 change password 成功后清空 oldPassword/newPassword/confirmPassword。
