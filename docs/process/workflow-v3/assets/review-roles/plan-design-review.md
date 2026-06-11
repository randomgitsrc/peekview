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
