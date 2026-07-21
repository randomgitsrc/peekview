---
phase: P1
task_id: T060-archived-visibility-auth-refresh
type: review
parent: P1-requirements.md
trace_id: T060-P1-review-20260721
status: approved
created: 2026-07-21
agent: requirements-review
---

# P1 Requirements Review (Rev 2)

## 9 项修改意见逐项确认

| # | 问题 | 修订结果 | 判定 |
|---|------|----------|------|
| 1 | Auth 过期在 Archived tab 场景未覆盖 | 新增 BDD-D2：Auth 过期后 Archived tab 刷新为空（L196-201） | ✅ |
| 2 | MCP status 参数非法值/空值未覆盖 | 新增 BDD-M3（L219-224）；BDD-M2 When 子句净化为"指定 status 过滤条件"（L214） | ✅ |
| 3 | 全 archived 用户场景未覆盖 | 新增 BDD-A1b（L78-83）、BDD-A2b（L94-99）、BDD-A3b（L110-115） | ✅ |
| 4 | Archived tab 匿名用户可见性未明确 | 2.7 补充明确声明：tab 保持可见但内容为空，无需隐藏/空状态提示（L57-61） | ✅ |
| 5 | MCP status 参数 schema 契约未声明 | 2.6 补充参数契约声明：可选字符串、默认 active、可选值至少含 active/archived、具体 schema 由 P2 设计（L55） | ✅ |
| 6 | 2.3 "需要重新请求 API"实现方向 | 2.3 改为"退出后列表必须与匿名权限一致"（L39-41），BDD 断言结果不指定实现 | ✅ |
| 7 | BDD-D1 When 子句提到 401/auth-expired | BDD-D1 When 改为"用户认证过期"（L190），用户视角 | ✅ |
| 8 | §4 仍保留 [NEED_CONFIRM] 标记 | §4 更新为确认结论（已确认选 A），移除 [NEED_CONFIRM] 标记（L226-230） | ✅ |
| 9 | BDD-C1/C2 未显式断言结果而非实现 | 与 #6 一致，BDD-C1/C2 断言"列表内容与匿名用户...一致"，不指定实现方式 | ✅ |

9/9 项均已正确处理。

## BDD 评审（修订后全量）

### BDD-A1: All tab 默认排除 archived 条目（认证用户）
- **判定**：PASS（可二值判定）
- **覆盖维度**：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **边界补充**：BDD-A1b 覆盖全 archived 用户场景

### BDD-A1b: 全 archived 用户 All tab 返回空列表
- **判定**：PASS（可二值判定）
- **覆盖维度**：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### BDD-A2: Mine tab 默认排除 archived 条目
- **判定**：PASS（可二值判定）
- **覆盖维度**：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **边界补充**：BDD-A2b 覆盖全 archived 用户场景

### BDD-A2b: 全 archived 用户 Mine tab 返回空列表
- **判定**：PASS（可二值判定）
- **覆盖维度**：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### BDD-A3: Archived tab 显示 own archived 条目
- **判定**：PASS（可二值判定）
- **覆盖维度**：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **边界补充**：BDD-A3b 覆盖无 archived 条目场景

### BDD-A3b: 无 archived 条目时 Archived tab 返回空列表
- **判定**：PASS（可二值判定）
- **覆盖维度**：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### BDD-A4: Admin All tab 默认排除 archived 条目
- **判定**：PASS（可二值判定）
- **覆盖维度**：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### BDD-A5: Admin Archived tab 可见全部 archived 条目
- **判定**：PASS（可二值判定）
- **覆盖维度**：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### BDD-A6: 匿名用户不可见任何 archived 条目
- **判定**：PASS（可二值判定）
- **覆盖维度**：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### BDD-A7: 非 owner 认证用户不可见他人 archived 条目
- **判定**：PASS（可二值判定）
- **覆盖维度**：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### BDD-B1: 登录后 All tab 列表刷新
- **判定**：PASS（可二值判定）
- **覆盖维度**：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### BDD-B2: 登录后 Mine tab 自动切换（URL 含 ?owner=me）
- **判定**：PASS（可二值判定）
- **覆盖维度**：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### BDD-C1: 退出后列表刷新为匿名视图
- **判定**：PASS（可二值判定）
- **覆盖维度**：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### BDD-C2: 退出后 Archived tab 刷新为空
- **判定**：PASS（可二值判定）
- **覆盖维度**：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓

### BDD-D1: Auth 过期后列表刷新为匿名视图
- **判定**：PASS（可二值判定）
- **覆盖维度**：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **修订确认**：When 子句已改为用户视角"用户认证过期"

### BDD-D2: Auth 过期后 Archived tab 刷新为空
- **判定**：PASS（可二值判定）
- **覆盖维度**：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- **新增**：覆盖 #1 修改意见

### BDD-M1: MCP list_entries 默认只返回 active 条目
- **判定**：PASS（可二值判定）
- **覆盖维度**：数据✓ 前端✗ 多端✓ 边界✓ 兼容✓

### BDD-M2: MCP list_entries 支持 status 参数过滤
- **判定**：PASS（可二值判定）
- **覆盖维度**：数据✓ 前端✗ 多端✓ 边界✓ 兼容✓
- **修订确认**：When 子句净化为"指定 status 过滤条件"，不再含具体参数值

### BDD-M3: MCP list_entries status 参数非法值处理
- **判定**：PASS（可二值判定）
- **覆盖维度**：数据✓ 前端✗ 多端✓ 边界✓ 兼容✓
- **新增**：覆盖 #2 修改意见

## 隐含需求覆盖

### 数据维度
- **覆盖**：2.1（API 行为变更分析）、2.8（数据迁移：无）、2.6（MCP status 参数契约声明含类型/默认值/可选值范围）
- **遗漏**：无

### 前端维度
- **覆盖**：2.4（登录后刷新当前 tab）、2.5（auth 过期后刷新）、2.7（Archived tab 匿名用户：可见但空，无需隐藏/空状态提示）
- **遗漏**：并发刷新竞态（登录/退出/auth 过期时用户同时切 tab）——属于 P2 前端实现设计范畴，P1 不需展开

### 多端维度
- **覆盖**：2.6（MCP status 参数契约：可选字符串、默认 active、可选值至少含 active/archived、P2 设计具体 schema）、2.1（MCP/CLI 影响分析、CLI 自动跟随 API 默认行为）
- **遗漏**：无

### 边界维度
- **覆盖**：BDD-A1b/A2b/A3b（全 archived/无 archived 边界）、BDD-M3（非法 status 值）、BDD-D2（auth 过期在 Archived tab）、2.3（退出后 filterPrivateEntries 不移除 public archived）
- **遗漏**：无

### 兼容维度
- **覆盖**：2.1（API 消费者影响分析，bug fix 语义非 breaking change）、BDD-C1/C2 断言结果而非实现方式（兼容 P2 选择 API 重载或客户端过滤）
- **遗漏**：旧版 MCP 客户端兼容策略——2.1 已声明为有意行为（不传 status 默认只返回 active），属兼容策略的隐含声明，可接受

## 裁剪评审

| 阶段 | 裁剪决定 | 评审 |
|------|---------|------|
| P1 | 不可裁 | 合理——核心阶段 |
| P2 | 不可裁 | 合理——后端权限模型变更 + 前端多组件协调 |
| P3 | 不可裁 | 合理——P0-brief 明确声明，权限模型变更需 TDD |
| P4 | 保留 | 合理——实现 |
| P5 | 不可裁 | 合理——权限模型变更需全量测试 |
| P6 | 不可裁 | 合理——P0-brief 明确声明，BDD 验收需实跑 |
| P7 | 保留 | 合理——三端改动需一致性检查 |
| P8 | 保留 | 合理——版本/CHANGELOG 更新 |

**risk_level: medium** — 合理。

**capability_requirements** — 合理。无 GAP。

## P1 纯净性

### 掺入解决方案设计
- **2.6** MCP status 参数契约声明——声明"需要什么"（参数契约）而非"怎么做"（具体 schema），P2 设计具体 schema。**OK**。
- **2.3** 已改为"退出后列表必须与匿名权限一致"，不再指定实现方式。**OK**。
- **BDD-M2** When 子句已净化，不再含具体参数值。**OK**。

### 混入实现细节
- BDD-D1 When 子句已改为用户视角"用户认证过期"。**OK**。
- 其余 BDD 均描述用户可观察行为/系统应做什么。**OK**。

## 轻微备注（不阻断）

2.6 声明 "非法值行为须明确（返回错误或忽略），由 P2 决定"，但 BDD-M3 断言 "返回错误提示，不返回条目列表"——BDD-M3 实际已选择 "返回错误" 语义，排除了 2.6 中 "忽略" 选项。这不影响二值判定，但 P2 设计时应以 BDD-M3 为准（BDD 是验收条件，优先级高于隐含需求描述中的留白）。

## 结论

**status: approved**

19 条 BDD（含新增 A1b/A2b/A3b/D2/M3）均可二值判定，编号唯一，与 P6 验收可对照。9 项修改意见全部已正确处理。隐含需求 5 维度覆盖完整。P1 纯净性 OK。NEED_CONFIRM 已清除。裁剪合理，risk_level 恰当，capability_requirements 无 GAP。
