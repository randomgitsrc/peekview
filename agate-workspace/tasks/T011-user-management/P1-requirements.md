---
phase: P1
task_id: T011
parent: P0-brief.md
trace_id: T011-P1-20260615
---

# P1 需求基线 — T011 用户管理

## 1. 需求复述

已有多个 Agent 各自有用户账号（Web UI 注册）。Agent 废弃后账号/key/entry 全变垃圾，无渠道清理。改密码同样不可能。需要：管理员能删用户（除自己）、重置他人密码；用户能注销自己、改自己密码。同时补 PeekClient.update_entry() 和 peekview whoami。

## 2. 隐含需求识别

- **级联删除必须用 service 层**：delete_entry() 确保磁盘文件清理，裸 SQL 会漏文件
- **admin 不能删自己（400）vs 唯一 admin 注销自己（409+确认）**：两个不同路径，逻辑不同不能混
- **唯一 admin 注销自己是「系统重置」**：级联删除所有数据后系统回到初始状态，下一个注册用户自动成 admin
- **username→id 的二次查询**：user delete remote 模式需 GET /admin/users?username= 先拿 id
- **change-password 需旧密码验证**：不能绕过，local 模式不支持（无当前用户概念）
- **whoami local 模式不支持**：本地没有「当前登录用户」概念
- **PeekClient.update_entry()**：API 端点已有（PATCH /entries/{slug}），只补客户端方法，本期不做 CLI 命令

## 3. BDD 验收条件

**AC1：管理员删用户（remote）**
```
Given admin 账号登录，alice 有 2 entries、1 API key
When peekview user delete alice --remote-url http://...
Then 提示「将删除 alice：2 entries，1 API key，确认？」
  And 确认后 alice 的 entries/files/apikeys/user 全部删除
  And 返回删除成功信息
```

**AC2：管理员不能删自己**
```
Given 以 admin(alice) 身份操作
When DELETE /api/v1/admin/users/{alice_id}
Then 返回 400，提示不能删除自己
```

**AC3：唯一 admin 注销自己（409 确认流程）**
```
Given 系统只有一个 admin（alice）
When peekview user change-password ... 或 DELETE /auth/me
Then 返回 409，提示「这是最后一个管理员，注销将清空所有数据」
  And CLI 要求输入 username 确认
  And 确认后级联删除所有数据，系统回到初始状态
```

**AC4：自助注销（非唯一 admin）**
```
Given 普通用户 bob（已登录）
When DELETE /api/v1/auth/me
Then bob 的 entries/files/apikeys/user 全部级联删除
  And 返回 204
```

**AC5：管理员重置他人密码（remote）**
```
Given admin 身份
When peekview user reset-password alice --remote-url http://...
Then alice 密码被重置（返回新密码或提示已重置）
```

**AC6：管理员 local 重置密码**
```
Given local 模式
When peekview user reset-password alice
Then 交互式输入新密码，直连 DB 更新 hash
```

**AC7：自助改密码（remote only）**
```
Given 已登录用户
When peekview user change-password（输入旧密码+新密码）
Then 旧密码验证通过后更新密码
  And 旧密码错误返回 401
```

**AC8：peekview whoami（remote only）**
```
Given 已配置 remote_url 和 token/api_key
When peekview whoami
Then 显示当前用户名、is_admin、创建时间
```

**AC9：PeekClient.update_entry() 可调用**
```
Given PeekClient 实例
When client.update_entry(slug, summary="new", tags=["a"])
Then 调用 PATCH /entries/{slug}，返回更新后的 entry
```

**AC10：非 admin 调用 admin 端点返回 403**
```
Given 普通用户身份
When DELETE /api/v1/admin/users/{id}
Then 返回 403
```

## 4. 裁剪说明

```yaml
phases: [P1, P2, P3, P4, P5, P8]
single_agent_mode: true
```

保留 P3（TDD）：级联删除+双权限模型，测试必须在实现前定义好
跳过 P6：无 UI（Web UI 是 T013，第二期）
跳过 P7：单包

## 5. 范围声明

```yaml
packages: [peekview]
domains: [backend]
ui_affected: false
gate_commands:
  P5: "pytest backend/tests/ -q --tb=short"
```

## 6. 能力需求

```yaml
capability_requirements:
  - need: local-node-runtime
    why: pytest + 环境隔离
    status: GAP（claude-project 环境）
    supplement: P3-P8 交接 OpenCode
```
