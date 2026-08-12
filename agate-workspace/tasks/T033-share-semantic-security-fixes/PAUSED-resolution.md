---
phase: PAUSED-resolution
task_id: T033-share-semantic-security-fixes
type: resolution
parent: P1-requirements.md
trace_id: T033-PAUSED-20260630
created: 2026-06-30
status: resolved
---

# max_views 语义方向决策

## 问题
max_views 应表示"最多看 N 次"（方案 A）还是"最多验证 N 次 token"（方案 B）？

## 决策
**方案 B：max_views = "最多验证 N 次"**

## 理由
1. 改动最小，风险最低——仅改 UI 文案，后端行为不变
2. "最多验证 N 次"是更精确的描述，避免用户困惑（"我刷新了就用完了？"）
3. cookie 不计数是合理设计——同一用户重复访问不应消耗额度
4. 若未来需要方案 A（cookie 也计数），可独立迭代

## 影响
- P1 BDD 中方案 A 的条件删除，保留方案 B 的条件
- ShareDialog UI 文案改为"最多验证 N 次"
- 后端行为不变
