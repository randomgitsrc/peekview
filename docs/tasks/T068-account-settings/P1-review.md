---
phase: P1
task_id: T068-account-settings
type: review
parent: P1-requirements.md
trace_id: T068-P1-review2-20260723
status: approved
created: 2026-07-23
agent: requirements-review
---

## BLOCKER 逐条验证

| # | BLOCKER | 修订后锚点 | 判定 |
|---|---------|-----------|------|
| 1 | BDD-03 须显式写入 `display_name: null` | BDD-03 Then: "后端存储 display_name=null" (L71) | PASS |
| 2 | BDD-05 须明确各字段清空/保留策略 | BDD-05 Then: "所有密码字段清空" (L86) | PASS |
| 3 | BDD-08 须列出具体功能清单 | BDD-08 Then 逐项列举: 创建/撤销/清理过期/列表展示/空状态/错误状态 (L106-107) | PASS |
| 4 | BDD-10 未登录落地须明确 | BDD-10 拆为两个 Given/When/Then: 已登录→302+展示tab; 未登录→先302→再auth guard→landing (L119-125) | PASS |
| 5 | BDD-14 须二选一 | BDD-14 Then: "以垂直分区形式展示" (L152) | PASS |
| 6 | 隐含需求纯空格须二值判定 | #13: "纯空格 trim 后为空则视为 null" (L43) | PASS |

6/6 BLOCKER 全部通过。

## BDD 评审

- BDD-01: PASS + 覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
  - display_name=null 初始状态：隐含需求 #3 明确 fallback 到 username，BDD-01 "可编辑输入框"隐含空值时输入框为空（与 BDD-03 清空后行为一致）
- BDD-02: PASS + 覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- BDD-03: PASS + 覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
  - 修订后 Then 显式声明 "后端存储 display_name=null"，P6 可二值判定
- BDD-04: PASS + 覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- BDD-05: PASS + 覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
  - 修订后 Then "所有密码字段清空"，P6 可二值判定
- BDD-06: PASS + 覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- BDD-07: PASS + 覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- BDD-08: PASS + 覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
  - 修订后 Then 逐项列举功能清单，P6 可逐条二值判定
- BDD-09: PASS + 覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- BDD-10: PASS + 覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
  - 修订后拆为两个场景，已登录/未登录路径均可二值判定
- BDD-11: PASS + 覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- BDD-12: PASS + 覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- BDD-13: PASS + 覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- BDD-14: PASS + 覆盖维度：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
  - 修订后明确 "垂直分区形式"，P6 可二值判定

## 隐含需求覆盖

### 数据维度
- **覆盖**：#1 display_name 已存在、#2 PATCH 返回 UserResponse、#3 null 语义+fallback、#12 API 兼容（空请求体）、#13 输入校验（空串→null、纯空格→trim→null、任意 Unicode、max_length=64）、#15 并发无冲突
- **遗漏**：无

### 前端维度
- **覆盖**：#4 auth guard、#5 导航断链更新、#6 Tab URL 直接渲染+无效参数 fallback、#7 移动端垂直分区、#8 Settings 页统一 header、#9 Loading 状态、#10 重复提交防护
- **遗漏**：无

### 多端维度
- **覆盖**：#11 MCP/CLI 不受影响、#12 API 兼容
- **遗漏**：无

### 边界维度
- **覆盖**：#13 输入校验（64字符/空串/纯空格/Unicode）、#14 改密码后 token 不失效+新旧密码相同允许、#15 并发
- **遗漏**：无

### 兼容维度
- **覆盖**：#16 旧路由 302 重定向、#17 ApiKeyListView 功能完整迁移
- **遗漏**：无

## 裁剪评审

- P1 不可裁：核心阶段 ✓
- P2 不可裁：新页面+新端点+组件迁移涉及设计决策 ✓
- P3 保留：PATCH /auth/me 安全敏感 + 组件迁移回归 ✓
- P4 不可裁 ✓
- P5 保留：pytest + typecheck 须全绿 ✓
- P6 不可裁：ui_affected=true ✓
- P7 保留：后端+前端+路由多文件改动 ✓
- P8 保留：版本/CHANGELOG ✓

裁剪声明合理，无跳过。

## P1 纯净性

- BDD-12/BDD-13 纯 API 安全基线，属需求层面可接受
- 隐含需求 #1 提及 "需新增 UpdateProfileRequest 和 PATCH /auth/me 端点"——作为隐含需求识别（非 BDD 条件），处于灰色地带但未指导具体设计，可接受
- 整体：P1 纯净，无严重设计掺入

## risk_level 评审

- 声明 `medium`：合理。PATCH /auth/me 安全敏感但参照 change-password 成熟模式；组件迁移有回归风险但功能明确。与实际风险匹配

## 结论

6 个 BLOCKER 全部通过。14 条 BDD 均可二值判定。5 个隐含需求维度全覆盖无遗漏。裁剪合理。P1 纯净。risk_level 匹配。

**status: approved**
