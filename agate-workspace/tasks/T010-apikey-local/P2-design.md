---
phase: P2
task_id: T010
parent: P1-requirements.md
trace_id: T010-P2-20260615
status: approved
---

# P2 方案设计 — T010 apikey local 模式解锁

## 声明字段

```yaml
packages: [peekview]
domains: [backend]
ui_affected: false
gate_commands:
  P5: "pytest backend/tests/ -q --tb=short"
```

## 改动文件

只改 `backend/peekview/cli.py`，约 60 行。

## 方案

### 新增辅助函数

```python
def _get_apikey_service_local(config: PeekConfig) -> tuple[ApiKeyService, int]:
    """Local 模式：实例化 ApiKeyService，通过 --user 参数解析 user_id。
    返回 (service, user_id)。用户不存在则 click.echo error + sys.exit(1)。
    """
    from peekview.services.apikey_service import ApiKeyService
    from peekview.models import User
    from sqlmodel import select, Session

    engine = init_db(config.db_path)
    check_schema(engine)
    service = ApiKeyService(engine=engine)
    return service
```

### 四个命令的改造模式（统一）

每个命令加 `--user` 选项（local 模式必填，remote 模式忽略）：

```python
@apikey_cmd.command(name="create")
@click.argument("name")
@click.option("--expires", "-e", default=None)
@click.option("--remote-url", "-r", default=None)
@click.option("--user", "-u", default=None, help="Username (required in local mode)")
def apikey_create(name, expires, remote_url, user):
    config = PeekConfig()
    backend = _get_backend(config, cli_remote_url=remote_url)

    if _is_remote_mode(backend):
        # 原有 remote 逻辑不变
        click.echo(f"→ Remote mode: {remote_url or config.remote.url}")
        result = backend.create_api_key(name=name, expires_in=expires)
        # ...展示 key...
    else:
        # Local 模式新增
        if not user:
            click.echo("Error: --user <username> is required in local mode", err=True)
            sys.exit(1)
        from peekview.services.apikey_service import ApiKeyService
        from peekview.models import User
        from sqlmodel import select, Session
        engine = init_db(config.db_path)
        check_schema(engine)
        with Session(engine) as session:
            db_user = session.exec(select(User).where(User.username == user)).first()
            if not db_user:
                click.echo(f"Error: User '{user}' not found", err=True)
                sys.exit(1)
            svc = ApiKeyService(engine=engine)
            result = svc.create_api_key(user_id=db_user.id, name=name, expires_in=expires)
        click.echo(f"✓ Created API key: {name}")
        click.echo(f"  Key: {result.key}")
        # ...展示其他字段...
        click.echo("  ⚠ Save this key now — it won't be shown again!")
```

`list`/`revoke`/`cleanup` 同样模式：加 `--user`，local 时查 user_id，调 ApiKeyService。

## 不需要改的

- ApiKeyService：接口已完整，不需要改
- remote 模式：行为完全不变（向后兼容）
- 测试：现有测试不受影响；补充 local 模式用例即可
