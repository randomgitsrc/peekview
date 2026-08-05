# P1 requirements-review progress log

## input files read
1. P1-dispatch-context-requirements-review.md — 派发指引（已读）
2. requirements-review.md 角色定义（已读）
3. P1-requirements.md — 19 BDD + 6 CONFIRMED（已读）
4. P0-brief.md — 任务简报（已读）
5. backend/peekview/models.py — User 模型（已读，is_active/is_admin 已存在，无审计字段；ResetPasswordRequest 已有 min_length=8；UserResponse 无审计字段；list_users 返回 list[UserResponse] 无 total）
6. backend/peekview/auth.py — require_admin/get_current_user（已读，get_current_user 查库验 is_active，BDD-04 软失效可行；require_admin 非 admin 抛 ForbiddenError）
7. backend/peekview/api/auth.py:240-249 — delete_self LastAdmin 逻辑（已读：admin_count==1 且 confirm_username != current_user.username 时抛 LastAdminError；注意有 confirm_username 旁路）
8. DESIGN.md §6 — OverflowMenu/ConfirmDialog/BaseBadge 规则（已读：desktop dropdown/mobile bottom sheet，destructive 用 alertdialog role；BaseBadge variants 无 disabled）

## 代码核查关键发现
- admin_service.delete_user(user_id, current_user_id): 仅防 user_id==current_user_id 自删，**无 LastAdmin 保护** — 确认 P1 §4-2 说的"现有 delete_user 无保护"属实
- admin_service.list_users 返回 list[UserResponse]，无 total — P1 §2.2/§4-4 改结构需求成立
- cli.py user_promote/demote（1579-1620）直接 set is_admin，**无 LastAdmin 保护** — P1 §2.3/§4-2 属实
- ResetPasswordRequest(models.py:756) 已有 min_length=8 — P1 §4-5"对齐 CLI 校验"中 API 端点其实已满足，CONFIRMED 决策合理但表述"加 min_length=8"实际是已存在（无新风险）
- delete_self LastAdmin 有 confirm_username 旁路（输入用户名可删最后一个 admin 自身）— BDD-11"最后一个 admin 不能被删除"与现有 delete_self 旁路语义存在张力，需在评审中标注
- require_admin 非 admin → ForbiddenError（403），BDD-16 后端 403 可行
