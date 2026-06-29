---
phase: P1
task_id: T033-share-semantic-security-fixes
type: requirements
parent: P0-brief.md
trace_id: T033-P1-20260630
status: draft
created: 2026-06-30
---

## 1. 需求复述

3 项分享功能语义/安全修复：

1. **compare_digest 永真**：`share_service.py:207` 的 `hmac.compare_digest(computed_hash, share.token_hash)` 比较的是同一值（`computed_hash` 已在 line 199 的 SQL WHERE 中用于定位记录），永远为真。此调用误导维护者以为有 timing-attack 防护，实际无效。需删除或改为有意义的实现。
2. **share cookie 可枚举**：cookie 名 `peekview_share_{entry.id}` 暴露内部 entry ID，可推断 entry 总量。改为 `peekview_share_{slug}` 防止推断。
3. **max_views 语义模糊**：UI 文案 "Max views" 暗示"最多看 N 次"，但实际行为是"最多验证 N 次 token"（`verify_share_cookie` 不递增 `view_count`，仅 `verify_share_token` 递增）。需确认语义后统一。

## 2. 隐含需求识别

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| H1 | 删除 compare_digest 后需更新 test_b30 | 现有测试 `test_share_security.py:77-96` 显式验证 `hmac.compare_digest` 被调用。删除调用后测试会失败。 |
| H2 | compare_digest 删除后，token 查询本身是否需要 timing-safe？ | 当前 `token_hash == computed_hash` 的 SQL 查询不是 constant-time，但 SQLite 本地查询的 timing attack 风险极低（无网络延迟差异）。删除 compare_digest 不引入新风险，但需确认不替代为其他方案。 |
| H3 | cookie 改名后旧 cookie 自然失效，无需迁移 | cookie 是客户端持有的，服务端不持久化。改名后旧 cookie 不匹配新名称，自然失效（用户需重新用 share token 访问）。这是可接受的行为。 |
| H4 | cookie 改名需同步更新 4 处后端代码 + 2 处测试 | `share_service.py:303,314`、`entries.py:82`、`files.py:190`、`test_share_cookie.py`、`test_read_tracking.py`。漏改任何一处会导致 cookie 机制断裂。 |
| H5 | slug rename 目前不支持（EntryUpdate 无 slug 字段） | P0 提及 "slug rename 会导致 cookie 失效" 的风险。当前代码不支持 slug rename，此风险暂不存在。但若未来加 slug rename，需同步处理 cookie 失效问题。当前不阻塞。 |
| H6 | max_views 语义决策影响后端行为 | 若选"看 N 次"，`verify_share_cookie` 也需递增 `view_count`，改变现有行为。若选"验证 N 次"，仅改 UI 文案。这是方向性决策。 |
| H7 | max_views 若选"看 N 次"，cookie 路径递增 view_count 有性能影响 | 每次通过 cookie 访问都执行 `UPDATE entry_shares SET view_count = view_count + 1`，增加 DB 写入频率。对高并发场景可能有影响。 |
| H8 | max_views 若选"看 N 次"，需考虑 cookie 访问的计数粒度 | 同一用户同一 cookie 多次刷新是否每次都计数？当前 token 验证是每次都计数。cookie 验证若也计数，行为一致但可能不符合用户预期（"我刷新了 10 次就用完了？"）。 |
| H9 | 前端 ShareManagementPanel 显示 "3/10 views" | 若语义改为"验证次数"，"views" 文案也需同步调整。 |

## 3. BDD 验收条件

### Fix 1: compare_digest 永真

```
Given share_service.py 的 verify_share_token 方法
When 审查 token 比较逻辑
Then 不存在 hmac.compare_digest 调用（或调用有实际防护意义）
And token 验证仍正确拒绝无效 token
And token 验证仍正确接受有效 token
```

```
Given test_share_security.py 的 test_b30 测试
When 运行测试套件
Then 测试通过（无论 compare_digest 存在与否，测试需验证 token 验证的安全性语义，而非特定函数调用）
```

### Fix 2: share cookie 可枚举

```
Given 一个私有 entry（slug="my-entry"）
When 通过 share token 访问该 entry
Then 响应设置 cookie 名为 peekview_share_my-entry（非 peekview_share_{id}）
```

```
Given 一个已设置 peekview_share_{slug} cookie 的浏览器
When 通过 cookie 访问该 entry（无 ?share= 参数）
Then 返回 200（cookie 验证正常工作）
```

```
Given 一个已设置 peekview_share_{slug} cookie 的浏览器
When 访问该 entry 的子资源（文件内容）
Then 返回 200（cookie 对子资源也有效）
```

```
Given cookie 名称 peekview_share_{slug}
When 观察者看到 cookie 名称
Then 无法推断系统中的 entry 总量（cookie 不含自增 ID）
```

### Fix 3: max_views 语义统一（方案 B：最多验证 N 次 token，cookie 不计数）

决策：选择方案 B。理由见 PAUSED-resolution.md。

```
Given 一个 max_views=3 的 share link
When 通过 ?share= token 访问 3 次
Then 第 3 次成功，第 4 次返回 404
```

```
Given 一个 max_views=3 的 share link，已通过 token 访问 1 次（view_count=1）
When 通过 cookie 无限次访问
Then 每次均成功（cookie 不递增 view_count）
```

```
Given ShareDialog 的 max_views 输入
When 用户看到标签文案
Then 文案为 "Max token uses" 或等价表述（与"验证 N 次"语义一致）
```

```
Given ShareManagementPanel 的 share 列表
When 显示 max_views 信息
Then 文案为 "uses" 而非 "views"（与语义一致）
```

## 4. 待确认清单

（已全部解决。max_views 语义方向决策：方案 B，见 PAUSED-resolution.md）

## 5. 裁剪说明

P0 建议 `phases: [P1, P4, P5, P6]`，判断如下：

| 阶段 | 是否走 | 理由 |
|------|--------|------|
| P1 | ✅ | 当前阶段，需求基线 |
| P2 | ❌ 跳过 | 3 项修复均为明确 bug/语义问题，方案无设计空间。compare_digest 删除是唯一解；cookie 改名是直接替换；max_views 取决于方向决策但无架构设计需求 |
| P3 | ❌ 跳过 | 现有测试已覆盖 share 功能（test_share_security, test_share_cookie, test_share_access, test_share_lifecycle 等），修复项只需更新现有测试，不需 TDD 红灯先行 |
| P4 | ✅ | 代码实现 |
| P5 | ✅ | 技术验证：pytest 全绿 + 隔离正常 |
| P6 | ✅ | BDD 验收逐条实跑；cookie 改名需 Playwright 验证前端行为 |
| P7 | ❌ 跳过 | 改动集中在 share 模块，无跨文件一致性风险 |
| P8 | ❌ 跳过 | 3 项均为 bug 修复/语义修正，不涉及版本变更 |

**最终 phases: [P1, P4, P5, P6]**

## 6. 范围声明

```yaml
packages:
  - peekview (backend)

domains:
  - backend (share_service.py, entries.py, files.py)
  - frontend (ShareDialog.vue, ShareManagementPanel.vue)
  - security (cookie 信息泄露、timing-safe 比较语义)
  - testing (test_share_security.py, test_share_cookie.py, test_read_tracking.py)

ui_affected:
  - ShareDialog.vue (max_views 标签文案)
  - ShareManagementPanel.vue (views → uses 文案，取决于 max_views 决策)
```

## 7. 能力需求声明

```yaml
capability_requirements:
  - need: security-review
    why: 评估 compare_digest 删除后是否引入 timing-attack 风险；评估 cookie 改名是否引入新攻击面
    available:
      - 代码审查（Agent 自身能力，SQLite 本地查询 timing attack 风险极低，可自行判断）
    status: available

  - need: browser-vision
    why: P6 验收需截图验证 ShareDialog 文案和 ShareManagementPanel 显示
    available:
      - playwright-vision skill
      - vision-analyzer skill
    status: available
    requires_minimal_validation: false
```
