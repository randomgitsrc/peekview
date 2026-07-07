---
phase: P2
task_id: T048-entry-lifecycle
type: review
parent: P2-design.md
trace_id: T048-P2-review3-20260707
status: approved
created: 2026-07-07
agent: plan-design-review
---

# T048 P2 Design Review (Round 3)

## Verdict: **approved**

三轮评审完成。首轮 6 条 + 第二轮 2 条 CONCERN 全部正确处理，修订未引入新问题。设计可进入 P3 实现。

## 评分维度

| 维度 | 评分 | 说明 |
|------|------|------|
| 交互状态覆盖率 | 9/10 | ExpiresInDialog idle/loading/error/success 完整；EntryDetailView archived banner + Reactivate 完整 |
| AI Slop 风险 | 8/10 | 组件参考 ShareDialog 模式，交互状态表明确，AI 随便搞空间小 |
| 移动端考虑 | 8/10 | 过期编辑/Expired banner/Reactivate 移动端可见；时间戳保持 desktop-only 合理 |
| 可访问性 | 6/10 | 未提及键盘导航（ExpiresInDialog focus trap）、aria 标签。非 BLOCKER，与现有组件一致 |

## C7 验证：variables.css 遗漏 + CSS 变量名

### 7a: variables.css 加入影响域 → ✅ RESOLVED

- §0 影响域表 line 37: `styles/variables.css` 已加入，改动描述"新增 `--c-badge-archived-bg`（dark + light 主题）"
- §3 实现完成标志 line 590: 第 15 条"variables.css 新增 `--c-badge-archived-bg`（dark + light 主题）"
- §4 files_to_read line 672-673: `frontend-v3/src/styles/variables.css:52-54,107-109` 已列出
- 验证 variables.css 实际结构：badge 变量在 dark theme line 52-54、light theme line 107-109，行号引用正确

### 7b: `--c-text-3` → `--c-text-tertiary` 修正 → ✅ RESOLVED

- §2.7 BaseBadge CSS line 504: `color: var(--c-text-tertiary)` — 正确
- §2.7 颜色说明 line 508: "文字用 `--c-text-tertiary`（已有灰色文字变量，位于 `variables.css:44` dark / `:99` light）" — 正确
- §3 实现完成标志 line 589: 第 14 条"BaseBadge 支持 `'archived'` 变体（`--c-badge-archived-bg` + `--c-text-tertiary`）" — 正确
- 验证 variables.css：`--c-text-tertiary` 在 dark theme line 44（`#6a7682`）、light theme line 99（`#8c959f`），变量名和行号均正确

## C8 验证：list_entries status=archived 访问控制

### 访问控制逻辑 → ✅ RESOLVED

§2.4 list_entries() line 376-388 修订后逻辑：

```
if status == "archived":
  - is_admin → pass（可见全部）
  - current_user_id → owner_id == current_user_id（仅可见自己的）
  - anonymous → return empty（不可见任何 archived）
```

验证要点：
1. **admin 可见全部 archived** ✅ — `is_admin: pass`
2. **owner 仅可见自己的 archived** ✅ — `owner_id == current_user_id`
3. **匿名不可见任何 archived** ✅ — 直接返回空列表
4. **与 get_entry() 行为一致** ✅ — get_entry 对非 owner 非 admin 返回 404，list_entries 对非 owner 非 admin 不返回 archived entry
5. **count_query 同步过滤** ✅ — count_query 与 query 使用相同条件，分页 count 正确

### 边界场景验证

| 场景 | 预期 | 设计覆盖 |
|------|------|---------|
| 匿名 `?status=archived` | 空列表 | ✅ line 387-388 |
| 非 owner `?status=archived` | 仅自己的 | ✅ line 383-385 |
| admin `?status=archived` | 全部 | ✅ line 381-382 |
| 匿名无 status 参数 | 排除 archived | ✅ line 402-404 |
| owner 无 status 参数 | 自己的 archived + 全部 active | ✅ line 391-398 |
| admin 无 status 参数 | 全部 | ✅ line 399-400 |

## 新 CONCERN 检查

逐项检查修订是否引入新问题：

1. **variables.css 行号引用**：files_to_read 引用 `:52-54,107-109`。实际 badge 变量在 line 52-54（dark）和 107-109（light），正确。新增 `--c-badge-archived-bg` 应插入 line 54 之后（dark）和 line 109 之后（light），位置合理
2. **list_entries status=archived 提前返回**：匿名用户 `return EntryListResponse(items=[], total=0, ...)` 是提前返回，跳过后续分页逻辑。但匿名用户本就无权看任何 archived entry，提前返回正确且高效
3. **list_entries status=archived + owner="me" 组合**：当 `status=archived` 且 `owner=me` 时，先加 `Entry.status == "archived"` 过滤，再加 `Entry.owner_id == current_user_id` 过滤，两者 AND 组合正确（只看自己的 archived entry）
4. **--c-badge-archived-bg 值未指定**：line 508 提到"如 `rgba(128, 128, 128, 0.15)`"作为示例，但未在 variables.css 新增行中写死具体值。这是设计文档的合理做法——具体色值在实现时确定，与现有 badge 变量模式一致（public/private/shared 也只定义变量名，值在 variables.css 中指定）

**结论：修订未引入新问题。**

## BDD 覆盖检查

| BDD | 设计覆盖 | 备注 |
|-----|---------|------|
| 3.1 Cleanup 归档 | ✅ | §2.2 Phase 1 |
| 3.2 Cleanup 物理删除 | ✅ | §2.2 Phase 2 |
| 3.3 Cleanup 保留期=0 | ✅ | §2.2 retention_days=0 跳过 Phase 2 |
| 3.4 PATCH 修改过期时间 | ✅ | §2.3 active entry + expires_in |
| 3.5 PATCH 设永不过期 | ✅ | §2.3 expires_in="0" → expires_at=None |
| 3.6 PATCH archived reactivate | ✅ | §2.3 archived + expires_in → reactivate |
| 3.7 Archived 访问控制 | ✅ | §2.4 get_entry() + update_entry() |
| 3.8 列表 owner 可见 archived | ✅ | §2.4 list_entries() OR 条件 + status=archived owner 过滤 |
| 3.9 列表默认排除 archived | ✅ | §2.4 list_entries() else 分支 |
| 3.10 Share 不可为 archived 创建 | ✅ | §2.5 status==archived 检查 |
| 3.11 前端过期编辑 | ✅ | §2.7 ExpiresInDialog + [Edit] |
| 3.12 前端 Archived 详情页 | ✅ | §2.7 Expired banner + Reactivate |
| 3.13 前端列表 archived 视觉区分 | ✅ | §2.7 opacity: 0.6 + Archived badge |
| 3.14 FTS 搜索排除 archived | ✅ | §2.4 FTS 结果经 status 过滤 |

全部 14 条 BDD 已覆盖。

## 评审历史

| 轮次 | CONCERN 数 | 结论 |
|------|-----------|------|
| Round 1 | 6 (C1-C6) | needs-revision |
| Round 2 | 2 (C7-C8) | needs-revision |
| Round 3 | 0 | **approved** |
