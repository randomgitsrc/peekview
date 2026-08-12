---
phase: P2
task_id: T046
type: review
parent: P2-design.md
trace_id: T046-P2-review-20260704
status: approved
agent: plan-design-review
created: 2026-07-04
---

# T046 P2 设计评审

## BLOCKER

### B1: buildPathMap priority 比较逻辑 bug

**位置**: §3.1 `buildPathMap` 函数

**问题**: `Map<string, number>` 存储 `file.id`，但比较时用 `priority` 与 `map.get(key)` 返回的 `file.id` 比较：

```typescript
if (map.has(key)) {
  const existing = map.get(key)!   // = file.id (如 3, 5, 100)
  if (priority < existing) {        // priority (1/2/3) < file.id → 几乎永远 true
    map.set(key, file.id)
  } else if (priority === existing) { // priority === file.id → 几乎永远 false
    basenameConflicts.add(key)
  }
}
```

**影响**: 
- priority 体系完全失效：后遍历的文件几乎总是覆盖先遍历的（因为 `priority(1~3) < file.id(通常>3)` 恒真）
- 同名冲突检测几乎永远不会触发（`priority === file.id` 几乎不成立）

**修复建议**: 需要同时存储 priority 和 file.id，例如：
- 方案 a: `Map<string, { fileId: number, priority: number }>`
- 方案 b: 额外维护 `Map<string, number>` 记录 priority

---

## CONCERN（非阻塞，需在 P4 实现时解决）

### C1: _sibling_keys 与 AllFileRef 类型不兼容

**位置**: §3.4 P2 后端扩展

**问题**: 设计伪代码调用 `_sibling_keys(f)` 处理 `AllFileRef` 对象，但 `_sibling_keys` 签名接受 `SiblingFileData`（含 content/language/is_binary 等字段）。AllFileRef 只有 file_id/filename/path，类型不匹配。

**建议**: 提取 key 生成逻辑为独立函数（如 `_normalize_keys(filename, path)`），`_sibling_keys` 和 AllFileRef 均调用它。

### C2: 后端 normalize_ref 对绝对路径的处理与 P2 需求矛盾

**位置**: §3.4 + §6

**问题**: 后端 `normalize_ref` 对 `/` 开头的路径返回 `null`（跳过），但 P2 场景 `<a href="/tmp/readme.md">` 需要 basename fallback 匹配。设计 §6 声明"前后端各自合理"，但 P2 后端扩展场景本身需要 basename fallback。

**建议**: P2 实现时，`inject_resources` 的 all_files 处理逻辑应使用独立的 key 生成函数（类似前端 normalizeRef 对 `/` 的 basename 提取），而非直接调用 `normalize_ref`。

### C3: DOM walk 性能 — 每个 html block 独立 DOMParser

**位置**: §3.2 rewriteHtmlRefs

**问题**: CODE_BLOCK 分割后产生多个 html block，每个独立 `new DOMParser().parseFromString`。对大文档可能有冗余开销。

**评估**: 实际场景 Markdown <100KB，html block 数量有限，性能可接受。如需优化可合并相邻 html blocks 后一次性 walk，但非必要。

### C4: 移动端 touch 事件兼容性

**位置**: §3.3 handleLinkClick

**问题**: 事件委托用 `click` 事件，移动端有 300ms 延迟。现有 handleCodeBlockCopy 也用 `click`，一致性好，但链接点击是高频交互，延迟更可感知。

**建议**: 考虑添加 `touchstart` 处理或依赖 Vue 的 `@click` （已有 passive event listener 优化），P4 时视实际体验决定。

### C5: 可访问性 — data-peekview-file-id 无 ARIA 语义

**位置**: §3.3 link_open rule + DOM walk

**问题**: 重写后的 `<a href="/{slug}?file={id}">` 对屏幕阅读者与普通链接无异，但 `data-peekview-file-id` 属性无 ARIA 语义标注"内部文件链接"。

**建议**: 可添加 `role="link"` + `aria-label` 描述（如 "Navigate to file: main.py"），但非核心功能，可列入改善清单。

---

## 评分维度

| 维度 | 分数 | 说明 |
|------|------|------|
| 交互状态覆盖率 | 8/10 | loading/error/empty 有覆盖；链接 hover/active 状态未提及 |
| AI Slop 风险 | 9/10 | 设计具体到代码级别，无模糊空间 |
| 移动端考虑 | 6/10 | touch 事件延迟未说明；事件委托在移动端可用但体验待验证 |
| 可访问性 | 5/10 | 内部文件链接无 ARIA 语义；键盘导航未受影响（<a> 天然可聚焦） |

---

## BDD 覆盖验证

全部 16 条 BDD 在 §4 覆盖矩阵中有明确映射：

| BDD | 覆盖 | 备注 |
|-----|------|------|
| AC-P0-1 相对路径图片 | ✅ | image rule + pathMap 精确匹配 |
| AC-P0-2 同目录文件名 | ✅ | pathMap filename 匹配 |
| AC-P0-3 绝对路径 basename | ✅ | normalizeRef 提取 basename（⚠️ B1 bug 影响匹配正确性） |
| AC-P0-4 外部 URL 不重写 | ✅ | normalizeRef 返回 null |
| AC-P0-5 无匹配保持原样 | ✅ | resolvePath 返回 null |
| AC-P0-6 Raw HTML 图片 | ✅ | post-DOMPurify DOM walk |
| AC-P0-7 代码块不重写 | ✅ | markdown-it token 级天然安全 |
| AC-P1-1 链接到同 entry 文件 | ✅ | link_open rule + pathMap |
| AC-P1-2 点击触发文件切换 | ✅ | 事件委托 + selectFile |
| AC-P1-3 外部链接不重写 | ✅ | normalizeRef 返回 null |
| AC-P1-4 锚点不重写 | ✅ | normalizeRef 返回 null（# 开头） |
| AC-P1-5 链接到 Markdown 文件 | ✅ | link_open + selectFile |
| AC-P1-6 Raw HTML 链接 | ✅ | post-DOMPurify DOM walk |
| AC-P2-1 HTML <a href> | ✅ | inject_resources 扩展（⚠️ C2: normalize_ref 对 / 路径行为） |
| AC-P2-2 HTML <iframe src> | ✅ | inject_resources 扩展 |
| P3 低频标签 | ⬜ | 本迭代不实现（P1 声明正确） |

**注意**: B1 bug 修复前，AC-P0-2/AC-P0-3 的匹配行为可能不正确（priority 体系失效导致错误的文件被选中）。

---

## gate_commands 可执行性

- P5/P6: `pytest + vitest` 格式正确，前端命令需确保在 `frontend-v3/` 目录执行
- P8: `grep CHANGELOG` 格式正确
- **可执行**: 是（P4 实现时注意工作目录即可）

---

## 方案权衡评估

方案 A 选择理由充分：
1. 方案 B 致命障碍（Python 无 markdown-it 等价物 + 无 Shiki）分析正确
2. 方案 C 不覆盖所有发布路径分析正确
3. 渐进实现（P0→P1→P2）策略合理，每步独立可验证
4. "错误重写比不重写更危险"原则贯穿设计（同名冲突删除 key、找不到匹配不修改）

---

## 结论

**status: needs-revision**

1 个 BLOCKER（B1: buildPathMap priority 比较逻辑 bug）需修复后重新评审。5 个 CONCERN 非阻塞，可在 P4 实现时解决。
