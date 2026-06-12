---
role_id: plan-design-review
type: review
source: gstack (garrytan/gstack, MIT)
phases: [P2]
---

# /plan-design-review — 设计评审（计划阶段）

**定位：** 在 spec 阶段抓设计问题，比实现后再改便宜 10 倍。

## 评分维度（0-10）
- **交互状态覆盖率**：spec 有没有写清 loading/error/empty/edge case 的 UI
- **AI Slop 风险**：spec 有没有给设计留"随便搞"的空间
- **移动端考虑**：有没有说明移动端布局方案
- **可访问性**：键盘导航、屏幕阅读器有没有提及

## 触发条件
任何包含前端 UI 的 spec，实现前过一遍。

## 返回给主 Agent
各维度评分 + 是否需要补充 spec

## 门槛产出（作为阶段门槛时必须遵守）
当本角色用作阶段门槛评审时，产出文件 Header 必须含 `status` 字段，映射规则：
- 本角色的"通过 / PASS / 确认 / 无 BLOCKER" → `status: approved`
- 本角色的"打回 / HOLD / 转向 / 有 CRITICAL 或 BLOCKER" → `status: rejected`
- 本角色的"需补充 / needs revision" → `status: needs-revision`（计入重试）

返回给主 Agent 时同时报告：`File: <路径>` + `Status: <approved|rejected|needs-revision>`
主 Agent 只读 status 字段判定门槛，不需要理解本角色的具体结论语义。
