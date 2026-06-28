---
phase: P2
task_id: T025-user-page
type: review
parent: P2-design.md
trace_id: T025-P2-eng-r2-20260628
status: approved
created: 2026-06-28
revised: 2026-06-28
---

# P2 工程第二轮评审 — 用户公开页

## 上轮 BLOCKER 复核

### BLK-1: FTS early return 丢失 owner_found 值 ✓

**修正确认**：
- 新增「`EntryListResponse(...)` 构造点完整清单」表格（L71-78），列出全部 4 处构造点及对应 `owner_found` 值。
- 伪代码中每个构造点均显式传入 `owner_found`：
  - 构造点 1 (L91): `owner_found=None`
  - 构造点 2 (L137-139): `owner_found=owner_found`
  - 构造点 3 (L152-153): `owner_found=owner_found`
  - 构造点 4 (L104-106): `owner_found=False`
- P4 实现者仅需按表格/伪代码照抄即可，不会遗漏。

**判定**：已修正。

### BLK-2: 其他 EntryListResponse(...) 构造点未透传 owner_found ✓

**修正确认**：
- 构造点清单覆盖所有代码路径：含 FTS 空结果、正常返回、Phase 1 提前 return（user 不存在）、owner="me" 未登录。
- `files_to_read` (L719) 明确引用「3 个现有 EntryListResponse 构造点（L327, L365-367, L411）均需加 owner_found」。
- FTS/tags 段不再标注 "unchanged"——伪代码中明确展示了 owner_found 透传。

**判定**：已修正。

---

## 上轮 HIGH/MEDIUM/LOW 复核

### H-1: BannerBar 与 ownerFound=false UI 矛盾 ✓

`isBannerMode` 增加 `ownerFound.value !== false` 条件（L271）；`/users/nonexistent` 不再显示 banner。

### H-2: 可访问性退化 ✓

卡片外层 div 加 `role="link"` `tabindex="0"` `@keydown.enter` `@keydown.space`（L418-422）。

### H-3: authState race condition ✓

新增 `watch(authState, ...)` 在 authenticated 时补检 URL owner=me 参数（L312-322）。

### M-1~M-4 ✓

v-if 链整合（L367-369）、分页重置（L294,297）、数据→URL 统一顺序（L504-509,628-642）、移动端断点具体化（L570-593）均已修正。

### M-5~M-7 ✓

tech debt 记录（L31）、BE-8/BE-9 增补（L181-185）、Field description（L200-205）均已修正。

### S-1~S-4 ✓

措辞修正（L161）、三态集中定义（L64-69）、YAGNI 注释（L479-480）、路由注释（L234-235）均已修正。

---

## 架构新审视

三阶段管线核心结构无变化。`owner_found` 三态语义现在有集中定义表（L64-69），与 `Field(description=...)`（L200-205）形成双重文档，实现者无需跨段推导。

`minimal_validation` (L744-748) 声明 `result: not_needed`，理由充分（纯 Vue 组件模式 + SQL 查询，无浏览器安全模型/外部系统依赖）。

---

## 评估

- BLK-1: 已修正 ✓
- BLK-2: 已修正 ✓
- 2 BLOCKER + 3 HIGH + 7 MEDIUM + 4 LOW → 全部修正
- 架构方向无异议
- `gate_commands` / `env_constraints` / `files_to_read` 完备
- 无新增阻塞问题

---

## 锁定决策

1. 三阶段管线 + `owner_found` tri-state 架构确认
2. 4 构造点完整清单 + 伪代码逐点标注 → P4 实现无歧义
3. `func.lower(User.username)` 全表扫描可接受（User 表极小），tech debt 已记录
4. BE-8/BE-9 增补覆盖 FTS + owner 组合路径
