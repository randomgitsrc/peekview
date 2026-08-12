---
phase: P1
task_id: T010
parent: P0-brief.md
trace_id: T010-P1-20260615
---

# P1 需求基线 — T010 apikey local 模式解锁

## 1. 需求复述

`peekview apikey create/list/revoke/cleanup` 四个命令目前强制要求 remote 模式，local 模式直接报错退出。headless 服务器部署 PeekView 时，无浏览器可用，需要通过 CLI 生成 API key 给 MCP Agent 使用，目前只能开浏览器或写 curl 脚本。去掉这个限制，local 模式直连 `ApiKeyService` 完成操作。

## 2. 隐含需求识别

- **local 模式无当前用户概念**：`ApiKeyService.create_api_key(user_id, ...)` 需要 user_id。local 模式下没有登录态，CLI 需要接收 `--user <username>` 参数，或强制要求指定用户名
- **list/revoke/cleanup 同样需要 user_id**：`list_api_keys(user_id)` / `revoke_api_key(user_id, key_id)` / `cleanup_expired_keys(user_id)` 都需要 user_id，需要 username→id 的查询
- **EntryService 里没有 ApiKeyService**：local 模式的 `_get_backend()` 返回 `EntryService`，不含 apikey 操作，需要单独实例化 `ApiKeyService`
- **local 模式不显示 remote URL 前缀**：现有 `click.echo(f"→ Remote mode: {remote_url}")` 这行在 local 模式下不该出现

## 3. BDD 验收条件

**AC1：local 模式创建 key**
```
Given local 模式（无 remote_url 配置）
When peekview apikey create "test-key" --user alice
Then 成功创建 key，显示完整 key（pv_ 开头）
  And 只显示一次，提示保存
```

**AC2：local 模式列出 key**
```
Given local 模式
When peekview apikey list --user alice
Then 显示 alice 的所有 API key 列表
```

**AC3：local 模式 revoke key**
```
Given local 模式，alice 有 key_id=1
When peekview apikey revoke 1 --user alice
Then key 被删除，显示确认信息
```

**AC4：local 模式 cleanup 过期 key**
```
Given local 模式
When peekview apikey cleanup --user alice
Then 删除 alice 的所有过期 key，显示删除数量
```

**AC5：用户不存在时报错**
```
Given local 模式
When peekview apikey create "k" --user nonexistent
Then 报错 "User 'nonexistent' not found"，exit code 1
```

**AC6：remote 模式行为不变**
```
Given remote 模式（配置了 remote_url）
When peekview apikey create/list/revoke/cleanup（不带 --user）
Then 行为与修改前完全一致（向后兼容）
```

## 4. 裁剪说明

```yaml
phases: [P1, P2, P4, P5, P8]
single_agent_mode: true
```

跳过 P3（TDD）：改动集中在 cli.py 的 4 个命令函数，逻辑简单，P4 实现后直接 P5 验证
跳过 P6：无 UI
跳过 P7：单包，无需专项一致性检查

## 5. 范围声明

```yaml
packages: [peekview]
domains: [backend]
ui_affected: false
gate_commands:
  P5: "pytest backend/tests/ -q --tb=short"
```
