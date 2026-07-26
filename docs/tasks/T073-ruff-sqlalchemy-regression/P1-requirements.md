---
phase: P1
task_id: T073
type: requirements
parent: P0-brief.md
trace_id: T073-P1-20260726
status: draft
created: 2026-07-26
agent: analyst
---

## 需求复述

ruff `--fix --unsafe-fixes`（commit 165997b5）自动修复 E711/E712 规则，将 SQLAlchemy Column 的 `== None`/`!= None`/`== False` 改为 Python 的 `is None`/`is not None`/`not`，破坏了 SQL 表达式语义，导致 43 个测试失败。需要：①修复所有被误改的 SQLAlchemy Column 比较；②防止 `make lint-fix` 再次引入同类回归。

## 隐含需求识别

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| I1 | 区分 SQLAlchemy 查询上下文 vs Python 对象属性访问 | `not entry.is_public` 在 Python 对象上是正确的；`not Entry.is_public` 在 `.where()` 中是错误的。修复时不能误改 Python 上下文的正确用法。**测试文件也有同类误改**：`test_read_tracking.py:365` 的 `not EntryRead.is_self_read`（`.where()` 上下文），会导致该测试本身行为异常（可能误报 PASS），修复范围应包含测试文件中的同类误改 |
| I2 | ruff 配置需排除 E711/E712 对 SQLAlchemy Column 比较的干扰 | 当前 pyproject.toml 未 ignore E711/E712，未来 `make lint-fix` 会再次触发同类回归 |
| I3 | fts_content 测试失败的根因已确认 | `database.py:485` 和 `entry_service.py:96` 的 `not File.is_binary`（`.where()` 上下文）导致 FTS 索引只包含二进制文件或空内容，是 fts_content ~10 个测试失败的直接根因，非 admin/share 失败的级联效应 |
| I4 | 修复后全量测试必须通过（922 passed + 43 previously failed → 965 passed） | 不能只修已知的 3 个文件而遗漏其他被 ruff 误改的位置 |

逐维度检查：
- **数据**：无数据迁移需求，修复是代码层面的语义恢复
- **前端**：无前端改动
- **多端**：MCP/CLI 不受影响（纯后端 Python 修复）
- **边界**：`is None` 在空表时返回 Python `True`（而非 SQL 表达式），导致 WHERE 子句失效而非报错——这是最危险的边界情况
- **兼容**：修复恢复原始语义，不破坏现有行为

## BDD 验收条件

### SQLAlchemy Column 比较修复

#### BDD-1: admin_stats 不再 500 且返回正确统计
- Given 数据库中有公开/私有/已过期的 entry 和已过期的 API key
- When 调用 admin stats API
- Then 返回 200 且 public/private/expired/api_keys.expired 计数正确

#### BDD-2: share 创建时 revoked_at 过滤生效
- Given 一个 entry 有 50 个未撤销的 share 和 1 个已撤销的 share
- When 尝试再创建一个 share
- Then 返回 422（Maximum share links reached），因为已撤销的不应计入 active count

#### BDD-3: share token 验证跳过已撤销的 share
- Given 一个 share 的 revoked_at 已被设置
- When 用该 share 的 token 验证
- Then 返回 404（share not found），因为 `revoked_at is None` 过滤应排除已撤销记录

#### BDD-4: share cookie 验证跳过已撤销的 share
- Given 一个 share 的 revoked_at 已被设置
- When 用该 share 的 token_prefix 做 cookie 验证
- Then 返回 null（share not found）

#### BDD-5: revoke 操作只撤销未撤销的 share
- Given 一个 entry 有 2 个未撤销 share 和 1 个已撤销 share
- When 调用 revoke 指定全部 3 个 share ID
- Then 只撤销 2 个（已撤销的被 `revoked_at is None` 过滤排除）

#### BDD-6: API key 过期统计正确
- Given 有 2 个 API key，1 个已过期、1 个未过期
- When 调用 admin stats API
- Then api_keys.expired = 1

#### BDD-7: cleanup_expired 正确识别过期 entry
- Given 有 1 个过期 entry（expires_at < now）和 1 个未过期 entry
- When 调用 cleanup_expired
- Then 只归档 1 个 entry

#### BDD-8: cleanup_expired 正确识别旧归档 entry
- Given 有 1 个 archived_at 超过 retention_days 的 entry
- When 调用 cleanup_expired
- Then 该 entry 被删除

### 回归防护

#### BDD-9: ruff 不再对 SQLAlchemy Column 比较报 E711/E712
- Given 修复后的代码中 SQLAlchemy Column 比较语法正确
- When 运行 `ruff check --select E711,E712`
- Then 无 E711/E712 违规报告

#### BDD-10: make lint-fix 不再破坏 SQLAlchemy Column 比较
- Given 修复后的代码和更新后的 ruff 配置
- When 运行 `make lint-fix`
- Then SQLAlchemy Column 比较语法未被改变

### 全量测试

#### BDD-11: 全部测试通过
- Given 修复后的代码
- When 运行 `make test-quick`
- Then 0 failed，全部 passed

### entry_service / database 修复

#### BDD-12: entry 列表 API 对匿名用户只返回公开 entry
- Given 数据库中有 1 个公开 entry 和 1 个私有 entry
- When 匿名用户调用 entry 列表 API
- Then 只返回公开 entry（验证 `Entry.is_public` 在 `.where()` 中正确过滤）

#### BDD-13: FTS 搜索能找到非二进制文件的内容
- Given 一个 entry 包含 1 个文本文件和 1 个二进制文件
- When 对该 entry 的内容执行 FTS 搜索
- Then 能搜到文本文件内容（验证 `not File.is_binary` 修复后 FTS 聚合正确）

## 待确认清单

[NO_NEED_CONFIRM]

## 裁剪说明

```yaml
P1_simplified: false
phases: [P1, P2, P3, P4, P5, P6, P8]
skipped:
  P7:
    reason: 改动模式虽多样（is not None vs not Column vs 裸 Column）但每处独立可验证，无交叉依赖
coupling_checklist: [api-schema: checked, data-model: checked, config-change: checked]
跳过风险: 低 — 19 处修复均为机械替换，无跨文件状态依赖
```

裁剪理由：
- P2 保留：涉及 ruff 配置策略选择（ignore vs noqa vs lint-extend-per-file-ignores），需设计决策
- P3 保留：43 个测试失败是高风险回归，TDD 红灯确认修复正确性
- P5 保留：必须全量测试通过
- P6 保留：BDD 验收需逐条实跑
- P7 跳过：改动模式虽多样但每处独立可验证，无交叉依赖

## 范围声明

```yaml
packages:
  - backend/peekview/services/admin_service.py
  - backend/peekview/services/share_service.py
  - backend/peekview/services/apikey_service.py
  - backend/peekview/services/entry_service.py
  - backend/peekview/database.py
  - backend/tests/test_read_tracking.py
  - backend/pyproject.toml
domains:
  - backend
risk_level: high
```

risk_level=high 理由：43 个测试失败，涉及安全相关功能（share token 验证、API key 过期检查），且 ruff 可能再次引入同类回归。

## 能力需求声明

```yaml
capability_requirements: []
```

无特殊能力需求。纯后端 Python 代码修复，pytest 验证即可。
