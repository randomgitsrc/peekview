---
phase: P1
task_id: T054
type: review
parent: P1-requirements.md
trace_id: T054-P1-review2-20260714
status: approved
created: 2026-07-14
agent: requirements-review
---

# T054 P1 Requirements Review (Round 2)

## 上一轮修正追踪

### BLOCKER 修正情况

| # | 上一轮问题 | 修正状态 | 修正位置 |
|---|-----------|---------|---------|
| B1 | 需求 B 前提事实性错误（default_limits 已覆盖） | ✅ 已修正 | 需求复述 §1-B 已改为"加显式 `@limiter.limit()` 装饰器，使限流值可独立于 default_limits 调整"；ID-13 重写为"显式装饰器优先级高于 default_limits，可独立配置更严格的限流值" |
| B2 | NC-1 采纳后 BDD 不完整（缺 update/delete 限流 BDD） | ✅ 已修正 | 新增 BDD-B3（PUT update 429）、BDD-B4（DELETE 429） |
| B3 | D 安全边界缺失（不同用户同 key） | ✅ 已修正 | 新增 BDD-D7（409 Conflict）；新增 ID-NEW-7；需求复述 §1-D 已明确"key 绑定 owner，不同用户用相同 key 返回 409 Conflict" |

### IMPORTANT 修正情况

| # | 上一轮问题 | 修正状态 | 修正位置 |
|---|-----------|---------|---------|
| I4 | BDD-C2 模糊 | ✅ 已修正 | BDD-C2 改为"Given 已有用户用旧 passlib 间接安装的 bcrypt 生成的哈希密码, When 用新依赖 bcrypt>=4.0.0 直接验证该密码, Then 验证成功（向后兼容）" |
| I5 | BDD-D3 不可复现 | ✅ 已修正 | BDD-D3 改为"Given 数据库中 idempotency_key 列有 UNIQUE 约束, When 插入时触发 IntegrityError, Then catch 后查询并返回已有 entry，HTTP 200" |
| I6 | BDD-D6 模糊 | ✅ 已修正 | BDD-D6 改为"Given MCP createEntry 传入 idempotency_key='test-key', When 后端收到请求, Then 请求体包含 idempotency_key 字段且值为 'test-key'，后端按幂等逻辑处理" |
| I7 | BDD-F1 主观 | ✅ 已修正 | BDD-F1 改为"Given _run_migrations() 函数顶部, When 检查前 10 行注释, Then 包含关键词 create_all 和 ALTER TABLE" |
| I8 | ID-NEW-3 UNIQUE 对 NULL 行为未确认 | ✅ 已修正 | 新增 ID-NEW-3 明确"SQLite 允许多个 NULL，这是期望行为"；新增 BDD-D10 覆盖 |
| I9 | P7 裁剪理由矛盾 | ✅ 已修正 | P7 改为"保留"，理由改为"涉及 backend + MCP 两个 package 改动，需跨包一致性检查" |

### MINOR 修正情况

| # | 上一轮问题 | 修正状态 | 修正位置 |
|---|-----------|---------|---------|
| M10 | ID-10 缺 BDD | ✅ 已修正 | 新增 BDD-A4 |
| M11 | idempotency_key 格式/长度约束缺失 | ✅ 已修正 | 新增 ID-NEW-2（max_length=128）；新增 BDD-D9（超长 key 422） |
| M12 | 幂等命中返回体是否含 files 未明确 | ✅ 已修正 | BDD-D1/D2 均已补充"响应体包含 files 列表" |
| M13 | idempotency_key 空字符串行为未定义 | ✅ 已修正 | 新增 ID-NEW-6；新增 BDD-D8（空字符串返回 422） |
| M14 | P1 隐含需求 3 处掺入解决方案设计 | ✅ 已修正 | ID-6 改为"并发竞态下不能创建重复条目"（移除 UNIQUE+IntegrityError 方案描述）；ID-8 改为"view_count 递增必须原子且正确"（移除 CursorResult 细节）；ID-12 改为"key 随 entry 删除已清除，相同 key 可被后续请求重新使用"（移除绑定生命周期设计描述） |
| M15 | MCP publishFiles 是否需 idempotency_key 未明确 | ✅ 已修正 | 新增 ID-NEW-4 明确"publishFiles 不暴露 idempotency_key"并附理由 |

## BDD 评审

### A. 默认 host 改 127.0.0.1

- **BDD-A1**: PASS — 覆盖维度：数据✓ 前端✗(不适用) 多端✓ 边界✓ 兼容✓
- **BDD-A2**: PASS — 覆盖维度：数据✓ 前端✗(不适用) 多端✓ 边界✓ 兼容✓
- **BDD-A3**: PASS — 覆盖维度：数据✓ 前端✗(不适用) 多端✓ 边界✓ 兼容✓
- **BDD-A4**: PASS（新增，覆盖 ID-10） — 覆盖维度：数据✓ 前端✗(不适用) 多端✓ 边界✓ 兼容✓

### B. 写入端点加显式限流装饰器

- **BDD-B1**: PASS — 覆盖维度：数据✓ 前端✗(不适用) 多端✓ 边界✓ 兼容✓
- **BDD-B2**: PASS — 覆盖维度：数据✓ 前端✗(不适用) 多端✓ 边界✓ 兼容✓
- **BDD-B3**: PASS（新增，覆盖 update_entry） — 覆盖维度：数据✓ 前端✗(不适用) 多端✓ 边界✓ 兼容✓
- **BDD-B4**: PASS（新增，覆盖 delete_entry） — 覆盖维度：数据✓ 前端✗(不适用) 多端✓ 边界✓ 兼容✓
- **BDD-B5**: PASS（覆盖 rate_limit_enabled=False 边界） — 覆盖维度：数据✓ 前端✗(不适用) 多端✓ 边界✓ 兼容✓
- **BDD-B6**: PASS（覆盖显式装饰器独立性） — 覆盖维度：数据✓ 前端✗(不适用) 多端✓ 边界✓ 兼容✓

### C. 移除 passlib

- **BDD-C1**: PASS — 覆盖维度：数据✓ 前端✗(不适用) 多端✓ 边界✓ 兼容✓
- **BDD-C2**: PASS（已修正为可二值判定） — 覆盖维度：数据✓ 前端✗(不适用) 多端✗ 边界✗ 兼容✓

### D. Create 接口幂等保护

- **BDD-D1**: PASS — 覆盖维度：数据✓ 前端✗(不适用) 多端✓ 边界✓ 兼容✓
- **BDD-D2**: PASS（已补充 files 列表） — 覆盖维度：数据✓ 前端✗(不适用) 多端✓ 边界✓ 兼容✓
- **BDD-D3**: PASS（已改为可判定表述） — 覆盖维度：数据✓ 前端✗(不适用) 多端✗ 边界✓ 兼容✓
- **BDD-D4**: PASS — 覆盖维度：数据✓ 前端✗(不适用) 多端✓ 边界✓ 兼容✓
- **BDD-D5**: PASS — 覆盖维度：数据✓ 前端✗(不适用) 多端✓ 边界✓ 兼容✓
- **BDD-D6**: PASS（已修正为可判定表述） — 覆盖维度：数据✓ 前端✗(不适用) 多端✓ 边界✓ 兼容✓
- **BDD-D7**: PASS（新增，覆盖跨用户安全边界） — 覆盖维度：数据✓ 前端✗(不适用) 多端✓ 边界✓ 兼容✓
- **BDD-D8**: PASS（新增，覆盖空字符串边界） — 覆盖维度：数据✓ 前端✗(不适用) 多端✗ 边界✓ 兼容✓
- **BDD-D9**: PASS（新增，覆盖超长 key 边界） — 覆盖维度：数据✓ 前端✗(不适用) 多端✗ 边界✓ 兼容✓
- **BDD-D10**: PASS（新增，覆盖 NULL UNIQUE 行为） — 覆盖维度：数据✓ 前端✗(不适用) 多端✗ 边界✓ 兼容✓

### E. share_service text() SQL 统一

- **BDD-E1**: PASS — 覆盖维度：数据✓ 前端✗(不适用) 多端✗(不适用) 边界✓ 兼容✓
- **BDD-E2**: PASS（已修正为可判定表述） — 覆盖维度：数据✓ 前端✗(不适用) 多端✗(不适用) 边界✓ 兼容✓

### F. migration 注释

- **BDD-F1**: PASS（已客观化判定标准） — 覆盖维度：数据✗(不适用) 前端✗(不适用) 多端✗(不适用) 边界✗(不适用) 兼容✓

## 隐含需求覆盖

### 数据维度
- **覆盖**：ID-1(migration)、ID-2(UNIQUE 约束)、ID-3(删除清除)、ID-NEW-1(NULL/DEFAULT NULL)、ID-NEW-2(max_length=128)、ID-NEW-3(NULL UNIQUE 行为)
- **遗漏**：无

### 前端维度
- **不适用**：纯后端 + MCP 改动，无前端 UI 变更

### 多端维度
- **覆盖**：ID-4(MCP createEntry 参数)、ID-5(MCP Zod schema)、ID-NEW-4(publishFiles 不暴露)、ID-NEW-5(client.ts 签名同步)
- **遗漏**：无

### 边界维度
- **覆盖**：ID-6(竞态)、ID-7(状态码)、ID-8(view_count 原子性)、ID-NEW-6(空字符串 422)、ID-NEW-7(跨用户 409)
- **遗漏**：无

### 兼容维度
- **覆盖**：ID-9(CLI help)、ID-10(config list)、ID-11(breaking change)、ID-12(key 删除后重用)
- **遗漏**：无

### 限流范围维度
- **覆盖**：ID-13(显式装饰器独立性)
- **遗漏**：无

## 裁剪评审

| 阶段 | 裁剪 | 评审 |
|------|------|------|
| P0 | ✅ 已完成 | 合理 |
| P1 | ✅ 当前 | — |
| P2 | 保留 | 合理——idempotency 并发处理和 view_count update() 兼容性需设计 |
| P3 | 保留 | 合理——idempotency key 逻辑需测试覆盖 |
| P4 | 保留 | 合理 |
| P5 | 保留 | 合理 |
| P6 | 简化 | 合理——纯后端改动无需 Playwright，但涉及 schema 变更+安全，BDD 逐条实跑（已明确） |
| P7 | 保留 | 已修正——backend + MCP 两个 package 需跨包一致性检查 |
| P8 | 保留 | 合理——默认 host 改动是 breaking change，需 CHANGELOG |

## P1 纯净性

上一轮 3 处掺入解决方案设计已全部修正：
1. ID-6：移除"UNIQUE 索引 + IntegrityError catch"，改为纯行为描述 ✅
2. ID-8：移除 CursorResult 技术细节，改为"递增必须原子且正确" ✅
3. ID-12：移除"绑定 entry 生命周期"设计描述，改为行为描述 ✅

BDD 条件本身未发现新的解决方案掺入。

## risk_level 评审

当前：`medium`

评估：合理。默认 host 是 breaking change，idempotency_key 需 migration，需求 B 前提已修正，风险理解准确。

## 关键发现汇总

### BLOCKER：0

全部 3 个 BLOCKER 已修正。

### IMPORTANT：0

全部 6 个 IMPORTANT 已修正。

### MINOR：1（建议但不阻碍）

1. BDD-D3 文字有重复笔误："有 UNIQUE 约有 UNIQUE 约束"——应为"有 UNIQUE 约束"。不影响语义判定，P2 阶段修正即可。

## 结论

**status: approved**

所有 BDD 编号可二值判定，覆盖维度完整：A1-A4、B1-B6、C1-C2、D1-D10、E1-E2、F1。隐含需求五维度（数据/前端/多端/边界/兼容）全覆盖无遗漏。裁剪合理，P7 已修正为保留。P1 纯净性通过。
