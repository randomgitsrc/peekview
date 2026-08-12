# T011 HANDOVER — 用户管理

状态：P0-P2 完成，P3-P8 交接 OpenCode

## 待执行

```bash
# P3 先写红灯测试
# 新建 backend/tests/test_admin_user_api.py
# 10个用例覆盖 AC1-AC10（先跑 pytest 确认全红）

# P4 实现（按顺序）
# 1. admin_service.py: list_users/delete_user/reset_password
# 2. api/admin.py: GET/DELETE /admin/users + reset-password
# 3. api/auth.py: DELETE /auth/me + POST /auth/change-password
# 4. client.py: 7个新方法
# 5. cli.py: user delete/reset-password/change-password + whoami

# P5 gate
pytest backend/tests/ -q --tb=short

# P8
make bump-version
# 填写 CHANGELOG
```

## 关键实现注意

1. delete_user 必须用 entry_service.delete_entry()，不能裸 SQL
2. 唯一 admin 检查：count_admins() = query User where is_admin=True count
3. 409 响应体含 code="last_admin" 供 CLI 判断
4. entry_service.delete_entry() 确认有 is_admin=True 参数（绕过 owner 检查）
5. BDD 验收条件：P1-requirements.md（10条 AC）
