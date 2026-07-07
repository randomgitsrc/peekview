# P2 Review Progress (Round 2)

## Step 1: Read all input documents — DONE
- P0-brief, P1-requirements, P2-design (revised), P2-review (round 1)
- BaseBadge.vue, EntryDetailView.vue:59-64

## Step 2: Verify 6 CONCERNs from round 1
Starting verification...

## Step 2: Verify 6 CONCERNs from round 1 — DONE

### C1: BaseBadge 遗漏 → RESOLVED
- §0 影响域表 line 34: `components/BaseBadge.vue` 已加入
- §2.7 BaseBadge archived 变体设计完整（props + CSS + 颜色选择）
- ⚠️ Minor: CSS 引用 `--c-text-3` 但实际变量名是 `--c-text-tertiary`（variables.css:44,99）
- ⚠️ Minor: `variables.css` 未列入 §0 影响域，但需新增 `--c-badge-archived-bg`（dark + light 两主题）

### C2: update_entry archived 访问控制 → RESOLVED
- §2.3 line 304-307: 显式检查 `entry.status == EntryStatus.ARCHIVED`
- §2.4 line 359-368: update_entry() 独立小节，与 get_entry 保持一致
- 约束说明 line 344: "update_entry 的 archived 访问控制与 get_entry 保持一致"

### C3: ExpiresInDialog error/loading/success → RESOLVED
- §2.7 line 509-516: 完整交互状态表（idle/loading/error/success）
- §2.7 line 518-535: 伪代码含 loading/error 状态管理
- 参考 ShareDialog 模式，设计合理

### C4: 移动端布局 → RESOLVED
- §2.7 line 545-552: 移动端布局设计完整
- 过期时间+Edit 移除 desktop-only
- Expired banner 全宽
- Reactivate 按钮 banner 内移动端可点击
- 时间戳保持 desktop-only

### C5: cleanup to_delete 变量作用域 → RESOLVED
- §2.2 line 254: `to_delete = []` 在 `if retention_days > 0` 之前初始化
- line 294 关键设计决策明确说明

### C6: updateEntry data 类型排除 status → RESOLVED
- §2.7 line 469-473: data 类型 `{ expires_in?; is_public?; summary?; tags? }` 排除 status
- line 476: 设计决策说明排除原因

## Step 3: Check for new issues — IN PROGRESS

## Step 3: Check for new issues — DONE

### New C1: variables.css missing from §0 impact domain
- BaseBadge archived variant needs `--c-badge-archived-bg` in variables.css (dark + light themes)
- variables.css not listed in §0 "改什么" table
- Also: P2-design references `--c-text-3` but actual variable is `--c-text-tertiary`

### New C2: list_entries status=archived explicit query leaks public archived entries
- When `status=archived` is explicitly passed, P2 design only adds `Entry.status == status`
- Phase 3 visibility filter still applies: `is_public == True | owner_id == current_user_id`
- A public archived entry would pass Phase 3 and be visible to non-owners
- This contradicts get_entry access control (returns 404 for non-owners)
- Fix: When `status=archived` is explicitly passed, also apply archived access control
  (only owner/admin can see archived entries, regardless of is_public)

### New C3: No new issues beyond C1-C2
- All 14 BDD conditions checked against design — covered
- Frontend interaction states complete (idle/loading/error/success)
- Mobile layout addressed
- BaseBadge design feasible (verified against actual component code)
- ShareDialog reference pattern verified

## Step 4: Scoring — DONE

## Step 5: Write final review — DONE
- Output: docs/tasks/T048-entry-lifecycle/P2-review.md
- Verdict: needs-revision
- 2 new CONCERNs (C7: variables.css missing, C8: list_entries status=archived access control gap)
- All 6 round-1 CONCERNs resolved
