# 问题：session 泄漏

看一下完整代码：具体是这样：

```python
def revoke_all_for_entry(self, entry_id: int, session: Session | None = None) -> int:
    own_session = session is None
    if own_session:
        session = Session(self.engine)   # ← 手动 new 出来，没有 with

    # ... 做操作 ...

    if own_session:
        session.commit()
    return len(active_shares)            # ← 函数结束，session 没有 close()
```

**问题在哪**

SQLAlchemy `Session` 底层持有一个数据库连接。正常用法是 `with Session(engine) as session:`，`with` 块退出时会自动调用 `session.close()`，把连接还给连接池。

这里手动 `new` 出来的 session，只有两条出路：

1. 正常执行到 `return` → session 变量超出作用域 → 依赖 Python GC 最终回收 → `__del__` 里可能会 close，但**时机不确定**
2. 操作中途抛异常（比如某个 `s.revoked_at = now` 触发 ORM 错误）→ 直接跳出函数 → `session.commit()` 不执行 → session **永远不 close**，连接泄漏

**实际触发概率**

这个函数被调用有两种路径：

- `entry_service` 传入自己的 session（`session=session`）→ `own_session=False` → 不走这条代码，没问题
- 独立调用（比如未来某个清理 job 或者测试直接调）→ `own_session=True` → 走问题代码

目前生产代码里 entry_service 走的是传 session 的路径，所以**现在不会触发**。但这个函数接口公开了 `session=None` 的默认值，意味着任何直接调用都会走到有问题的路径。

**修法**

```python
def revoke_all_for_entry(self, entry_id: int, session: Session | None = None) -> int:
    if session is not None:
        return self._revoke_all_in_session(entry_id, session)

    with Session(self.engine) as s:      # with 保证异常时也 close
        result = self._revoke_all_in_session(entry_id, s)
        s.commit()
        return result

def _revoke_all_in_session(self, entry_id: int, session: Session) -> int:
    now = datetime.now(timezone.utc)
    active_shares = session.exec(
        select(EntryShare).where(
            EntryShare.entry_id == entry_id,
            EntryShare.revoked_at == None,  # noqa: E711
        )
    ).all()
    for s in active_shares:
        s.revoked_at = now
        session.add(s)
    return len(active_shares)
```

或者更简单，不拆私有方法，直接 `with` 嵌套分支：

```python
def revoke_all_for_entry(self, entry_id: int, session: Session | None = None) -> int:
    def _do(s: Session) -> int:
        now = datetime.now(timezone.utc)
        active_shares = s.exec(
            select(EntryShare).where(
                EntryShare.entry_id == entry_id,
                EntryShare.revoked_at == None,  # noqa: E711
            )
        ).all()
        for share in active_shares:
            share.revoked_at = now
            s.add(share)
        return len(active_shares)

    if session is not None:
        return _do(session)

    with Session(self.engine) as s:
        result = _do(s)
        s.commit()
        return result
```

两种写法都能保证：无论正常 return 还是异常抛出，session 必然被 close。
