# PeekView 管理员角色 实现计划

> 版本: 1.0
> 日期: 2026-05-17
> 前置: 用户认证与条目权限 (impl-plan-user-auth.md) 已完成

---

## 背景

Auth 功能已完成 (v0.1.25)，但存在一个缺口：`owner_id=NULL` 的条目（auth 功能上线前匿名创建的）没有 owner，任何登录用户都无法管理它们。用户 test01 注册后看不到任何操作按钮，因为所有条目都不属于他。

需要一个管理员角色：admin 可以管理所有条目（包括 owner_id=NULL 的），普通用户只能管理自己的。

---

## 设计决策

- **`is_admin: bool`** — 最简方案，在 User 模型上加布尔字段（复用 `is_active` 的模式）
- **首用户自动成为管理员** — 注册第一个用户时自动设为 admin
- **无需角色表** — 轻量级服务，不需要 RBAC
- **Admin 能力**: 切换可见性 / 删除任何条目（含 owner_id=NULL）、查看所有私有条目

---

## Step 1: Backend — User Model 加 `is_admin`

**文件**: `backend/peekview/models.py`

- `UserBase` 加: `is_admin: bool = Field(default=False, sa_column_kwargs={"server_default": "0"})`
- `UserResponse` 加: `is_admin: bool`

## Step 2: Backend — DB Migration

**文件**: `backend/peekview/database.py`

- `_run_migrations()` 中加: `ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0` (if not exists)
- 迁移后：若无 admin 用户，将第一个用户设为 admin（bootstrap）

## Step 3: Backend — Auth: 首用户 = Admin

**文件**: `backend/peekview/api/auth.py`

- `register()`: 创建第一个用户时设 `is_admin=True`
- 所有 `UserResponse` 构造（register/login/me）加 `is_admin` 字段

## Step 4: Backend — Entry Service: Admin 绕过权限

**文件**: `backend/peekview/services/entry_service.py`

- `update_entry()` 和 `delete_entry()` 加 `is_admin: bool = False` 参数
- 修改权限检查:
  ```python
  # 修改前:
  if entry.owner_id != current_user_id:
      raise NotFoundError(...)

  # 修改后:
  if not is_admin and entry.owner_id != current_user_id:
      raise NotFoundError(...)
  ```
- `delete_entry`: admin 可删 owner_id=NULL 条目:
  ```python
  if entry.owner_id is None and not is_admin:
      raise NotFoundError(...)
  ```
- `list_entries`: admin 可见所有条目（含其他用户私有条目）
- `get_entry`: admin 可查看任何私有条目

## Step 5: Backend — Entry API: 传 is_admin

**文件**: `backend/peekview/api/entries.py`

- 从 `current_user` 提取 `is_admin = current_user.is_admin if current_user else False`
- 传给 service: `service.update_entry(..., is_admin=is_admin)`、`service.delete_entry(..., is_admin=is_admin)`
- list/get: 传 is_admin 以便 service 返回完整数据

## Step 6: Backend — CLI: Admin 支持

**文件**: `backend/peekview/cli.py`

- `user create`: 加 `--admin` 选项
- `user list`: 显示 admin 状态（如 `[admin]`）
- 新增 `user promote <username>` 命令
- 新增 `user demote <username>` 命令

## Step 7: Frontend — Types & API

**文件**: `frontend-v3/src/types/index.ts`, `frontend-v3/src/api/types.ts`, `frontend-v3/src/api/client.ts`

- `User` 接口加 `isAdmin: boolean`
- `UserApiResponse` 加 `is_admin: boolean`
- `transformUser()` 映射 `is_admin` → `isAdmin`

## Step 8: Frontend — Auth Store: isAdmin

**文件**: `frontend-v3/src/stores/auth.ts`

- 加 `isAdmin` computed: `user.value?.isAdmin ?? false`
- 修改 `isOwner`: admin 可管理所有条目
  ```typescript
  const isOwner = computed(() => {
    return (entryOwnerId: number | null) => {
      if (!user.value) return false
      if (user.value.isAdmin) return true
      if (entryOwnerId === null) return false  // 匿名条目仅 admin 可管
      return entryOwnerId === user.value.id
    }
  })
  ```

## Step 9: Frontend — Views: Admin 标识

**文件**: `frontend-v3/src/views/EntryListView.vue`, `frontend-v3/src/views/EntryDetailView.vue`

- 用户菜单中显示 admin 标识（如用户名旁加 "admin" 标签）

## Step 10: 测试

**文件**: `backend/tests/test_auth.py`

- 新增 `TestAdminRole` 类:
  - 首用户自动成为 admin
  - 第二个用户不是 admin
  - Admin 可更新/删除任何条目（含 owner_id=NULL）
  - Admin 可查看所有私有条目
  - 非 admin 不能管理他人条目
- 更新现有受影响的测试

---

## 验证

1. `cd backend && python3.12 -m pytest tests/test_auth.py -v` — 所有 auth 测试通过
2. `make debug-build && make debug-stop && make debug-start` — 重启新 DB
3. 注册第一个用户 → 应自动成为 admin
4. 匿名创建条目 → admin 可见操作按钮
5. 注册第二个用户 → 非 admin，只能管理自己的条目
6. `peekview user list` → 显示 admin 状态
7. `peekview user promote test01` → test01 成为 admin
8. `make debug-test` — E2E 测试仍通过
