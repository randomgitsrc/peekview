---
phase: P1
task_id: T080-admin-user-management
trace_id: T080
type: review
parent: P1-requirements.md
status: approved
agent: requirements-review
created: 2026-08-06
---

# P1 需求基线评审 — T080 Admin 用户管理（复审 #1）

## 评审结论

**Status: approved**

上一轮 6 个问题（#1 confirm_username 旁路、#2 自操作 BDD 覆盖、#3 admin 计数边界、#4 CLI disable LastAdmin、#5 BDD-19 标题、#6 §4-5 表述）已全部修复。修订后 BDD 从 19 条增至 24 条（新增 BDD-20..24），编号连续 BDD-01..24，格式合规（`#### BDD-NN:`）。8 个 CONFIRMED 决策齐全（原 6 + 决策 A + 决策 B），无 `[NEED_CONFIRM]` 残留，`[NO_NEED_CONFIRM]` 声明保留。五维度隐含需求覆盖充分，裁剪合理（P0-P8 全走匹配 medium-high risk），P1 纯净性良好（未掺入 P2 解决方案设计）。未引入新问题。

[PROD_NOT_TOUCHED] 本评审仅读代码 + 写产出文件，未启动服务、未写代码、未触碰生产环境（:8080 / ~/.peekview/）。

## 上一轮 6 问题逐条核对

### 问题 #1：BDD-11 与 confirm_username 旁路冲突 → 已修
- 修订：§2.5（第 68 行）声明破坏性变更——移除 `delete_self`（api/auth.py:240-249）的 `confirm_username` 旁路，最后一个活跃 admin 的 delete_self 一律拒绝。§4-2 决策 A（第 225 行）回写。BDD-11（第 128-131 行）Given/When 明确覆盖两条路径（自删 delete_self + admin 删别人 delete_user），Then 声明"delete_self 路径下即使提供 confirm_username 也被拒绝（移除旁路，绝对拒绝）"。
- 代码核查：`api/auth.py:245` 确认现有 `confirm_username != current_user.username` 旁路存在，移除声明准确。
- 判定：**修复到位**。

### 问题 #2：自操作保护 BDD 覆盖不全 → 已修
- 修订：新增 BDD-20（第 183-186 行，多 admin 场景下 admin demote 自己被拒）+ BDD-21（第 188-191 行，非 LastAdmin 场景下 admin delete 自己被拒）。§2.4（第 58 行）显式引用 BDD-06/20/21 覆盖 disable/demote/delete 三操作。
- 判定：**修复到位**。三操作各有独立 BDD，Given 明确排除 LastAdmin 干扰（BDD-20 两活跃 admin、BDD-21 "非 LastAdmin 场景"），语义焦点为自操作保护。

### 问题 #3：admin 计数边界未定义 → 已修
- 修订：§2.4（第 60 行）决策 B 定义计数规则 = `COUNT(User WHERE is_admin=True AND is_active=True)`，禁用 admin 不计入活跃 admin 数。新增 BDD-22（第 195-198 行，2 admin 禁用其中一个成功）+ BDD-23（第 200-203 行，禁用后剩余唯一活跃 admin 被拒）覆盖边界。§4-3（第 227 行）回写决策 B 并引用 BDD-09/10/11/22/23/24。
- 判定：**修复到位**。计数规则明确，2 admin 禁用边界（BDD-22 成功 → BDD-23 拒绝）形成连贯状态链。

### 问题 #4：CLI disable 的 LastAdmin 保护缺 BDD → 已修
- 修订：新增 BDD-24（第 207-210 行，CLI disable 最后一个活跃 admin 被拒绝）。
- 判定：**修复到位**。与 BDD-19（CLI demote LastAdmin）互补，CLI disable/demote 均有 LastAdmin BDD。

### 问题 #5：BDD-19 标题/内容不匹配 → 已修
- 修订：BDD-19 标题（第 176 行）改为"CLI demote 补 LastAdmin 保护"，与 Given/When（`peekview user demote admin1`）一致。
- 判定：**修复到位**。

### 问题 #6：§4-5 表述准确性 → 已修
- 修订：§4 第 6 项（第 233 行）改为"API 端点 ResetPasswordRequest 已有 min_length=8 校验（models.py:756），确认对齐 CLI"。§2.4（第 63 行）同步改为"已有 min_length=8 校验"。
- 代码核查：`models.py:756` 确认 `Field(..., min_length=8, max_length=72)` 已存在。
- 判定：**修复到位**。

## BDD 逐条评审

### BDD-01: admin 在 /admin 页面看到用户列表（分页）
- 判定：PASS（可二值判定）
- 覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- 说明：25 用户 / 每页 20 / 总页数 2，判定清晰。依赖 §4-5 list_users 返回 total，隐含需求已识别。

### BDD-02: 用户列表显示每个用户的状态标记
- 判定：PASS（可二值判定）
- 覆盖维度：数据✓ 前端✓ 多端✗ 边界✓ 兼容✓
- 说明：3 个子断言（active/disabled/admin 标记）均可二值判定，单场景多观察点合规。

### BDD-03: admin 禁用用户后该用户无法登录
- 判定：PASS（可二值判定）
- 覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- 说明：三断言（状态变 disabled / 登录失败 / public entries 仍可见）均可判定。禁用用户内容可见性边界已覆盖。

### BDD-04: admin 禁用用户后该用户活跃 JWT 即时失效
- 判定：PASS（可二值判定）
- 覆盖维度：数据✓ 前端✗ 多端✓ 边界✓ 兼容✓
- 说明：JWT 软失效（get_current_user 查库验 is_active）返回 401，可判定。

### BDD-05: admin 启用用户后该用户可登录
- 判定：PASS（可二值判定）
- 覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- 说明：enable 后 active + 原密码登录成功，可判定。

### BDD-06: admin 不能禁用自己
- 判定：PASS（可二值判定）
- 覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- 说明：自操作保护（disable）。与 BDD-20（自 demote）、BDD-21（自 delete）共同覆盖三操作。

### BDD-07: admin promote 普通用户为 admin
- 判定：PASS（可二值判定）
- 覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- 说明：is_admin 变 True + 重新登录可访问 /admin，可判定。

### BDD-08: admin demote 另一个 admin 为普通用户
- 判定：PASS（可二值判定）
- 覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- 说明：两 admin 场景（admin1 demote admin2），与 BDD-09 单 admin 场景互补。

### BDD-09: 最后一个活跃 admin 不能被降级
- 判定：PASS（可二值判定）
- 覆盖维度：数据✓ 前端✗ 多端✓ 边界✓ 兼容✓
- 说明：Given 显式声明"is_admin=True AND is_active=True"，隐含决策 B 计数规则。自 demote + LastAdmin 双语义，焦点 LastAdmin。自操作保护由 BDD-20 独立覆盖。

### BDD-10: 最后一个活跃 admin 不能被禁用
- 判定：PASS（可二值判定）
- 覆盖维度：数据✓ 前端✗ 多端✓ 边界✓ 兼容✓
- 说明：与 BDD-09 同构（disable 版）。Given 声明同 BDD-09。2 admin 禁用边界由 BDD-22/23 覆盖。

### BDD-11: 最后一个 admin 不能被删除（绝对拒绝，含自删和 admin 删别人）
- 判定：PASS（可二值判定）
- 覆盖维度：数据✓ 前端✗ 多端✓ 边界✓ 兼容✓
- 说明：When 含两条路径（delete_self + admin delete_user），Then 统一"被拒绝（LastAdminError）"，并显式声明"delete_self 即使提供 confirm_username 也被拒绝"——对齐决策 A 移除旁路。两条路径共享 Given/Then，P6 可分别实跑。自操作保护由 BDD-21 独立覆盖（非 LastAdmin 场景）。

### BDD-12: admin 重置用户密码后用户可用新密码登录
- 判定：PASS（可二值判定）
- 覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- 说明：新密码登录成功 + 旧密码失败，可判定。§4-6 已修正为"已有 min_length=8 校验"。

### BDD-13: admin 删除用户后该用户及其所有数据消失
- 判定：PASS（可二值判定）
- 覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- 说明：级联删除（用户/entries/files/API keys）可判定。EntryRead 无 owner FK 不被清理属现有行为，P1"及其所有数据"可接受。

### BDD-14: 非 admin 用户访问 /admin 被拒绝
- 判定：PASS（可二值判定）
- 覆盖维度：数据✗ 前端✓ 多端✓ 边界✓ 兼容✓
- 说明："重定向或显示拒绝页面"均可判定为拒绝。§4-4 跳 /explore 已确认。

### BDD-15: 未登录用户访问 /admin 被拒绝
- 判定：PASS（可二值判定）
- 覆盖维度：数据✗ 前端✓ 多端✓ 边界✓ 兼容✓
- 说明：同 BDD-14，"重定向到登录页或首页"可判定。

### BDD-16: 后端 admin 端点对非 admin 返回 403
- 判定：PASS（可二值判定）
- 覆盖维度：数据✗ 前端✗ 多端✓ 边界✓ 兼容✓
- 说明：require_admin 抛 ForbiddenError → 403，可判定。

### BDD-17: CLI disable 用户后该用户无法登录
- 判定：PASS（可二值判定）
- 覆盖维度：数据✓ 前端✗ 多端✓ 边界✓ 兼容✓
- 说明：命令成功 + 登录失败，可判定。功能路径；LastAdmin 场景由 BDD-24 覆盖。

### BDD-18: CLI enable 用户后该用户可登录
- 判定：PASS（可二值判定）
- 覆盖维度：数据✓ 前端✗ 多端✓ 边界✓ 兼容✓
- 说明：命令成功 + 登录成功，可判定。

### BDD-19: CLI demote 补 LastAdmin 保护
- 判定：PASS（可二值判定）
- 覆盖维度：数据✓ 前端✗ 多端✓ 边界✓ 兼容✓
- 说明：标题与内容一致（`peekview user demote admin1`）。Given 声明"is_admin=True AND is_active=True"。命令报错 + 仍为 admin，可判定。

### BDD-20: admin 不能降级自己（多 admin 场景）
- 判定：PASS（可二值判定）
- 覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- 说明：Given 两活跃 admin（排除 LastAdmin 干扰），When admin1 demote 自己，Then 被拒（自操作保护）。与 BDD-09（LastAdmin 焦点）语义分离清晰。可判定。

### BDD-21: admin 不能删除自己
- 判定：PASS（可二值判定）
- 覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- 说明：Given 显式"存在其他活跃 admin，非 LastAdmin 场景"，When admin delete 自己（admin delete_user 路径），Then 被拒（自操作保护）。与 BDD-11（LastAdmin 焦点）语义分离清晰。可判定。

### BDD-22: 2 admin 场景下禁用其中一个成功
- 判定：PASS（可二值判定）
- 覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- 说明：Given 两活跃 admin，When adminA 禁用 adminB，Then 成功 + adminB is_active=False 但 is_admin=True 不计入活跃 admin 数。直接验证决策 B 计数规则。可判定。

### BDD-23: 禁用后剩余唯一活跃 admin 不能再被禁用/降级/删除
- 判定：PASS（可二值判定）
- 覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- 说明：承接 BDD-22 状态（adminA 唯一活跃 admin），When adminA 对自己执行禁用/demote/删除，Then 被拒（LastAdmin）。三操作共享 Given/Then，P6 可分别实跑。与 BDD-22 形成状态链，验证决策 B 边界。可判定。

### BDD-24: CLI disable 最后一个活跃 admin 被拒绝
- 判定：PASS（可二值判定）
- 覆盖维度：数据✓ 前端✗ 多端✓ 边界✓ 兼容✓
- 说明：Given 唯一活跃 admin，When `peekview user disable admin1`，Then 命令报错（LastAdmin）+ 仍 active。与 BDD-19（CLI demote）互补。可判定。

## 隐含需求覆盖（五维度）

### 数据维度：覆盖
- schema 变更（审计字段 disabled_at/disabled_by/disabled_reason）已识别（§2.1, §4-1）
- migration 对已有数据影响已声明（disabled_at 默认 null）
- list_users 返回结构变更已识别（§2.2, §4-5）
- promote/demote 审计字段留 P2 评估（合理）

### 前端维度：覆盖
- /admin 路由 + 守卫已识别（§2.2）
- OverflowMenu 决策已确认（§4-7），mobile bottom sheet 经 OverflowMenu 覆盖
- BaseBadge 无 disabled 变体已识别（§2.2）
- destructive 操作 ConfirmDialog 已识别（§2.2，对齐 DESIGN.md §6）

### 多端维度：覆盖
- API + CLI + 前端三端同步已识别（§2.3）
- MCP 不同步决策已定（§1 不在范围内）
- CLI 不走 API 不受 list_users 结构变更影响已识别（§2.5）

### 边界维度：覆盖
- 自操作保护三操作全覆盖（BDD-06 disable / BDD-20 demote / BDD-21 delete）
- LastAdmin 保护三操作全覆盖（BDD-09 demote / BDD-10 disable / BDD-11 delete）+ CLI（BDD-19 demote / BDD-24 disable）
- admin 计数边界定义清晰（决策 B，§2.4）+ 2 admin 禁用边界 BDD 覆盖（BDD-22 成功 / BDD-23 拒绝）
- 禁用用户内容可见性已覆盖（BDD-03）
- 并发已识别（§2.4，SQLite WAL 最后写入胜出）

### 兼容维度：覆盖
- list_users 结构变更兼容性已识别（§2.5，CLI 不走 API）
- CLI promote/demote 补保护属 bug 修复非破坏性已识别（§2.5）
- delete_self 移除 confirm_username 旁路为破坏性变更已声明（§2.5, §4-2 决策 A），影响用户 + 迁移路径（先 promote 另一 admin 或由其他 admin 删除）已说明

## 裁剪评审

本任务无裁剪（P0-P8 全走），合理性确认：

- 跨后端 API + CLI + 前端三端改动 → 多子系统交互，符合"必须走完整 agate"规则
- 涉及权限模型（is_active/is_admin toggle + LastAdmin + 自操作）→ 安全边界
- 涉及级联删除 → 数据完整性
- 涉及 schema 变更 + migration → 数据迁移风险
- 涉及破坏性变更（决策 A 移除 confirm_username 旁路）→ 兼容性风险
- risk_level: medium-high 匹配（+权限模型/级联删除/三端/守卫/破坏性变更，-is_active 已存在/require_admin 成熟）
- capability_requirements 三项全 available，无 GAP
- P3 TDD 保留合理（LastAdmin/自操作/禁用 JWT 失效需红灯）
- P6 验收不可裁合理（BDD 逐条实跑 + Playwright）

**裁剪评审通过**。

## P1 纯净性

- §2.1 "需 migration"为影响声明（范围边界），非 P2 设计细节，可接受
- §4-1 "新增字段... 需 schema 变更 + 迁移（database.py migrations）"为影响范围声明，未规定迁移实现方式，可接受
- §4 决策均为需求决策（做什么），非实现决策（怎么做），纯净
- §2.4 决策 B 定义计数规则属需求语义定义（"最后一个活跃 admin"的含义），非实现方案，纯净
- §2.5 决策 A 声明移除旁路属需求决策（行为变更），非实现细节，纯净
- 无 P2 解决方案设计掺入

**P1 纯净性通过**。

## 门槛结论

**status: approved**

上一轮 6 问题全修，24 条 BDD 逐条 PASS（可二值判定 + 覆盖维度标注），五维度隐含需求覆盖充分（边界维度经 BDD-20..24 补强后全覆盖），裁剪合理，P1 纯净。8 个 CONFIRMED 决策齐全，无 `[NEED_CONFIRM]` 残留。未引入新问题。

P1 需求基线可推进至 P2 方案设计。
