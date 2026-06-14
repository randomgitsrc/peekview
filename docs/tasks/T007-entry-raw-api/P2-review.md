---
phase: P2
task_id: T007
parent: P2-design.md
trace_id: T007-P2-review-20260614
reviewer: Staff Engineer (/review)
---

# P2 设计评审 — T007 Entry Raw API

## 评审结论

**status: approved**

方案整体合理，安全处理到位，影响域清晰。几点确认和补充：

### ✅ 认可的设计决策

1. **统一 `files` 数组**（不区分 single/multi）：正确，Agent 处理逻辑统一，避免条件分支
2. **复用 `_resolve_entry()`**：正确，认证逻辑不重复，一致性有保证
3. **`</script>` 防御性处理**：必要，虽然本接口返回 `application/json`，但防御纵深是好习惯
4. **`errors="replace"` 解码策略**：正确，接口健壮性优先于严格模式
5. **`<a>` 而非 `<button>`**：语义正确，且 WebFetch 转 Markdown 后 href 会保留

### 🔍 需要实现时注意

**`_resolve_entry()` 的可复用性**：需确认该函数在 `files.py` 里是独立函数还是依赖特定上下文。看代码它已有 `_is_global_api_key_auth()` 的调用，新路由要确认完全复用，不要 copy-paste。

**`raw_url` 的 base_url 来源**：需从 `request.app.state.config.build_view_url()` 或类似方法构建，不能硬编码。参考现有 `create_entry` 里 `self.config.build_view_url(entry_slug)` 的做法，或直接从 `request.base_url` 拼接。

**`<link>` 注入的清理**：`data-peekview-raw` 属性标记方案合理，watch 里先清理再注入，避免多次导航时重复插入。

### 无 BLOCKER
