---
phase: P3
task_id: T011
parent: P2-design.md
trace_id: T011-P3-20260615
---

# P3 测试用例 — T011 用户管理

测试文件：`backend/tests/test_admin_user_api.py`

## Fixture 设计

```python
@pytest.fixture
async def client(tmp_path):
    """隔离环境，每个测试独立 DB + 数据目录。"""
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    db_path = tmp_path / "test.db"
    app = create_app(data_dir=data_dir, db_path=db_path)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        ac._app = app
        yield ac

async def _register(client, username, password="pass123") -> str:
    """注册用户，返回 access_token。"""
    resp = await client.post("/api/v1/auth/register",
                             json={"username": username, "password": password})
    assert resp.status_code == 201
    return resp.json()["access_token"]

def _make_admin(app, username):
    """直连 DB 将用户提升为 admin。"""
    with Session(app.state.engine) as s:
        user = s.exec(select(User).where(User.username == username)).first()
        user.is_admin = True
        s.add(user); s.commit()

async def _create_entry(client, token) -> str:
    """创建一个 entry，返回 slug。"""
    resp = await client.post("/api/v1/entries",
                             headers={"Authorization": f"Bearer {token}"},
                             json={"summary": "test", "is_public": True,
                                   "files": [{"filename": "f.md", "content": "x"}]})
    assert resp.status_code in (200, 201)
    return resp.json()["slug"]
```

## 测试用例

### AC1：管理员删用户（级联删除）

```python
async def test_admin_delete_user_cascade(client):
    """AC1: 删用户后 entries/apikeys/user 全部消失。"""
    alice_token = await _register(client, "alice")
    admin_token = await _register(client, "admin")
    _make_admin(client._app, "admin")

    # alice 创建 entry + apikey
    slug = await _create_entry(client, alice_token)
    await client.post("/api/v1/apikeys",
                      headers={"Authorization": f"Bearer {alice_token}"},
                      json={"name": "alice-key"})

    # 查到 alice 的 id
    list_resp = await client.get("/api/v1/admin/users?username=alice",
                                 headers={"Authorization": f"Bearer {admin_token}"})
    assert list_resp.status_code == 200
    alice_id = list_resp.json()[0]["id"]

    # admin 删 alice
    del_resp = await client.delete(f"/api/v1/admin/users/{alice_id}",
                                   headers={"Authorization": f"Bearer {admin_token}"})
    assert del_resp.status_code == 204

    # 验证级联：entry 消失
    entry_resp = await client.get(f"/api/v1/entries/{slug}",
                                  headers={"Authorization": f"Bearer {admin_token}"})
    assert entry_resp.status_code == 404

    # 验证级联：user 消失
    list_resp2 = await client.get("/api/v1/admin/users?username=alice",
                                  headers={"Authorization": f"Bearer {admin_token}"})
    assert list_resp2.json() == []
```

### AC2：admin 不能删自己

```python
async def test_admin_cannot_delete_self(client):
    """AC2: DELETE /admin/users/{self_id} 返回 400。"""
    admin_token = await _register(client, "admin")
    _make_admin(client._app, "admin")

    with Session(client._app.state.engine) as s:
        admin_id = s.exec(select(User).where(User.username == "admin")).first().id

    resp = await client.delete(f"/api/v1/admin/users/{admin_id}",
                               headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 400
    assert "self" in resp.json()["detail"].lower() or "yourself" in resp.json()["detail"].lower()
```

### AC3：唯一 admin 注销自己（409 确认流程）

```python
async def test_unique_admin_delete_self_requires_confirm(client):
    """AC3: 唯一 admin 调 DELETE /auth/me 得到 409，带 confirm_username 后成功。"""
    admin_token = await _register(client, "admin")
    _make_admin(client._app, "admin")

    # 第一次：无确认 → 409
    resp1 = await client.delete("/api/v1/auth/me",
                                headers={"Authorization": f"Bearer {admin_token}"})
    assert resp1.status_code == 409
    assert resp1.json()["detail"]["code"] == "last_admin"

    # 第二次：带确认 → 204
    resp2 = await client.delete("/api/v1/auth/me?confirm_username=admin",
                                headers={"Authorization": f"Bearer {admin_token}"})
    assert resp2.status_code == 204

    # 系统回到初始状态：admin 用户已删除
    with Session(client._app.state.engine) as s:
        assert s.exec(select(User).where(User.username == "admin")).first() is None
```

### AC4：普通用户自助注销

```python
async def test_user_delete_self(client):
    """AC4: 普通用户 DELETE /auth/me → 204，自己的数据级联删除。"""
    admin_token = await _register(client, "admin")  # 确保有其他 admin
    _make_admin(client._app, "admin")
    bob_token = await _register(client, "bob")
    slug = await _create_entry(client, bob_token)

    resp = await client.delete("/api/v1/auth/me",
                               headers={"Authorization": f"Bearer {bob_token}"})
    assert resp.status_code == 204

    # entry 已删除
    entry_resp = await client.get(f"/api/v1/entries/{slug}",
                                  headers={"Authorization": f"Bearer {admin_token}"})
    assert entry_resp.status_code == 404
```

### AC5：管理员重置他人密码

```python
async def test_admin_reset_password(client):
    """AC5: admin 重置 alice 密码，alice 用新密码能登录。"""
    admin_token = await _register(client, "admin")
    _make_admin(client._app, "admin")
    await _register(client, "alice", "oldpass")

    with Session(client._app.state.engine) as s:
        alice_id = s.exec(select(User).where(User.username == "alice")).first().id

    resp = await client.post(f"/api/v1/admin/users/{alice_id}/reset-password",
                             headers={"Authorization": f"Bearer {admin_token}"},
                             json={"new_password": "newpass456"})
    assert resp.status_code in (200, 204)

    # alice 用新密码登录成功
    login_resp = await client.post("/api/v1/auth/login",
                                   json={"username": "alice", "password": "newpass456"})
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()
```

### AC6：自助改密码

```python
async def test_change_password_self(client):
    """AC6: 用户用旧密码换新密码，旧密码失效。"""
    token = await _register(client, "alice", "oldpass")

    resp = await client.post("/api/v1/auth/change-password",
                             headers={"Authorization": f"Bearer {token}"},
                             json={"old_password": "oldpass", "new_password": "newpass456"})
    assert resp.status_code == 204

    # 旧密码不能登录
    bad_login = await client.post("/api/v1/auth/login",
                                  json={"username": "alice", "password": "oldpass"})
    assert bad_login.status_code == 401

    # 新密码可以登录
    good_login = await client.post("/api/v1/auth/login",
                                   json={"username": "alice", "password": "newpass456"})
    assert good_login.status_code == 200
```

### AC7：旧密码错误时 change-password 返回 401

```python
async def test_change_password_wrong_old(client):
    """AC7: 旧密码错误 → 401。"""
    token = await _register(client, "alice", "oldpass")

    resp = await client.post("/api/v1/auth/change-password",
                             headers={"Authorization": f"Bearer {token}"},
                             json={"old_password": "wrongpass", "new_password": "newpass456"})
    assert resp.status_code == 401
```

### AC8：非 admin 调 admin 端点返回 403

```python
async def test_non_admin_cannot_delete_user(client):
    """AC8: 普通用户调 DELETE /admin/users/{id} → 403。"""
    bob_token = await _register(client, "bob")
    await _register(client, "alice")

    with Session(client._app.state.engine) as s:
        alice_id = s.exec(select(User).where(User.username == "alice")).first().id

    resp = await client.delete(f"/api/v1/admin/users/{alice_id}",
                               headers={"Authorization": f"Bearer {bob_token}"})
    assert resp.status_code == 403
```

### AC9：GET /admin/users 支持 username 精确查询

```python
async def test_admin_list_users_by_username(client):
    """AC9: ?username=alice 精确匹配，只返回 alice。"""
    admin_token = await _register(client, "admin")
    _make_admin(client._app, "admin")
    await _register(client, "alice")
    await _register(client, "alicex")  # 不应出现在结果里

    resp = await client.get("/api/v1/admin/users?username=alice",
                            headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["username"] == "alice"
```

### AC10：磁盘文件随 entry 一起被清理

```python
async def test_delete_user_cleans_disk_files(client):
    """AC10: 删用户后其 entry 的磁盘文件也被删除（不只是 DB 记录）。"""
    admin_token = await _register(client, "admin")
    _make_admin(client._app, "admin")
    alice_token = await _register(client, "alice")

    # 创建含文件的 entry
    await _create_entry(client, alice_token)

    data_dir = client._app.state.config.data_dir
    files_before = list(data_dir.rglob("*.md"))
    assert len(files_before) > 0  # 确认文件存在

    with Session(client._app.state.engine) as s:
        alice_id = s.exec(select(User).where(User.username == "alice")).first().id

    await client.delete(f"/api/v1/admin/users/{alice_id}",
                        headers={"Authorization": f"Bearer {admin_token}"})

    files_after = list(data_dir.rglob("*.md"))
    assert len(files_after) == 0  # 磁盘文件已清理
```

## 边界条件清单（实现时特别注意）

| 边界 | 期望行为 |
|------|---------|
| 删不存在的 user_id | 404 |
| 唯一 admin 注销但 confirm_username 拼错 | 409（重新确认） |
| 多个 admin 时其中一个注销自己 | 200，无需确认（直接 DELETE /auth/me） |
| alice 有 100 个 entries | 全部级联删除，不超时（用 entry_service.delete_entry 逐个处理） |
| change-password 新密码与旧密码相同 | 建议允许（不做限制，简化实现） |
