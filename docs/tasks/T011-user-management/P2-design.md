---
phase: P2
task_id: T011
parent: P1-requirements.md
trace_id: T011-P2-20260615
status: approved
---

# P2 方案设计 — T011 用户管理

## 声明字段

```yaml
packages: [peekview]
domains: [backend]
ui_affected: false
gate_commands:
  P5: "pytest backend/tests/ -q --tb=short"
env_constraints:
  debug_env: "make debug（:8888，/tmp/peekview-debug/）"
```

## 改动文件

| 文件 | 改动 |
|------|------|
| `backend/peekview/api/admin.py` | 新增 GET/DELETE /admin/users + reset-password |
| `backend/peekview/api/auth.py` | 新增 DELETE /auth/me + POST /auth/change-password |
| `backend/peekview/services/admin_service.py` | 新增 list_users / delete_user / reset_password |
| `backend/peekview/services/auth_service.py`（或 auth.py 内）| 新增 change_password / delete_self |
| `backend/peekview/client.py` | 新增 list_users / delete_user / reset_user_password / change_password / delete_self / whoami / update_entry |
| `backend/peekview/cli.py` | 新增 user delete/reset-password/change-password + whoami 命令 |
| `backend/peekview/models.py` | 新增 response models |
| `backend/tests/test_admin_user_api.py` | 新增（P3 TDD） |

## 一、后端 API

### GET /api/v1/admin/users

```python
@router.get("/users", response_model=list[UserResponse])
async def list_users(
    username: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_admin),
):
```

- `?username=alice`：精确匹配，CLI remote 模式用于 username→id 解析
- 无参数：分页返回所有用户

### DELETE /api/v1/admin/users/{user_id}

```python
@router.delete("/users/{user_id}", status_code=204)
async def delete_user(user_id: int, current_user: User = Depends(require_admin)):
```

- `user_id == current_user.id` → 400（admin 不能删自己）
- 级联删除：逐个调 `entry_service.delete_entry()`，再删 apikeys，再删 user

### POST /api/v1/admin/users/{user_id}/reset-password

```python
@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    data: ResetPasswordRequest,
    current_user: User = Depends(require_admin),
):
```

- `data.new_password`：新密码（管理员设定）

### DELETE /api/v1/auth/me

```python
@router.delete("/me", status_code=204)
async def delete_self(
    confirm_username: str | None = Query(None),
    current_user: User = Depends(require_auth),
):
```

唯一 admin 处理：
```python
admin_count = count_admins(session)
if current_user.is_admin and admin_count == 1:
    if confirm_username != current_user.username:
        raise HTTPException(409, detail={
            "message": "这是最后一个管理员，注销将清空所有数据",
            "code": "last_admin",
            "confirm_required": True,
        })
# 验证通过或非唯一 admin → 执行级联删除
```

### POST /api/v1/auth/change-password

```python
@router.post("/change-password", status_code=204)
async def change_password(
    data: ChangePasswordRequest,  # old_password + new_password
    current_user: User = Depends(require_auth),
):
```

- 验证 old_password 与 DB hash 匹配（bcrypt）
- 不匹配 → 401

## 二、Service 层

### admin_service.py 新增

```python
def list_users(self, username: str | None = None, page: int = 1, per_page: int = 20)
def delete_user(self, user_id: int, current_user_id: int)  # 含 admin-不能删自己 检查
def reset_password(self, user_id: int, new_password: str)
```

### 级联删除实现

```python
def delete_user(self, user_id: int, current_user_id: int):
    if user_id == current_user_id:
        raise ValueError("Cannot delete yourself")
    with Session(self.engine) as session:
        user = session.get(User, user_id)
        if not user:
            raise NotFoundError(f"User {user_id} not found")
        # 1. 获取所有 entries
        entries = session.exec(select(Entry).where(Entry.owner_id == user_id)).all()
        # 2. 逐个删 entry（含磁盘文件）
        for entry in entries:
            self.entry_service.delete_entry(entry.slug, user_id=user_id, is_admin=True)
        # 3. 删 api keys
        session.exec(delete(ApiKey).where(ApiKey.user_id == user_id))
        # 4. 删 user
        session.delete(user)
        session.commit()
```

## 三、CLI 层

```
peekview user delete <username>
  local:  查 user_id → admin_service.delete_user()，展示确认信息
  remote: GET /admin/users?username= → DELETE /admin/users/{id}

peekview user reset-password <username>
  local:  查 user_id → admin_service.reset_password()，交互式输入新密码
  remote: GET /admin/users?username= → POST /admin/users/{id}/reset-password

peekview user change-password
  remote only：交互式输入旧密码+新密码 → POST /auth/change-password
  local：报错「change-password 仅支持 remote 模式」

peekview whoami
  remote only：GET /auth/me → 显示 username、is_admin、created_at
```

## 四、PeekClient 新增方法

```python
list_users(username=None, page=1, per_page=20)  # GET /admin/users
delete_user(user_id: int)                         # DELETE /admin/users/{id}
reset_user_password(user_id: int, new_password: str)
change_password(old_password: str, new_password: str)
delete_self(confirm_username: str | None = None)
whoami()                                           # GET /auth/me
update_entry(slug: str, **kwargs)                  # PATCH /entries/{slug}
```

## 五、安全设计

| 风险 | 处理 |
|------|------|
| admin 删自己 | API 层 400，CLI 层也检查（双重防护）|
| 唯一 admin 注销 | 409 + confirm_username 二次确认 |
| 普通用户调 admin 端点 | require_admin → 403 |
| change-password 旧密码错 | bcrypt verify → 401 |
| 级联删除部分失败 | 在 transaction 内，失败全部回滚 |
