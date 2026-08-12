---
phase: P2
task_id: T047
task_name: content-link-fix
type: review
parent: P2-design.md
trace_id: T047-P2-review-20260705
status: approved
created: 2026-07-05
agent: plan-eng-review
---

# T047 P2 工程经理评审

## BDD 覆盖检查

| BDD | 覆盖 | 评估 |
|-----|------|------|
| AC-1 PNG Content-Type | ✅ | 方案 A 分流: is_binary=True → mimetypes.guess_type → image/png |
| AC-2 JPEG Content-Type | ✅ | 同 AC-1 机制 |
| AC-3 SVG Content-Type | ✅ | §3.1 决策 #2 详述两种 language 场景，均可接受 |
| AC-4 未知二进制 fallback | ✅ | 三级 fallback 兜底 octet-stream |
| AC-5 文本文件不受影响 | ✅ | 分流条件 `language and not is_binary` → 走 `_language_to_content_type` |
| AC-6 CSS/JS MIME 映射 | ✅ | is_binary=False → `_language_to_content_type("css")` → text/css |
| AC-7 path-map.ts 测试全绿 | ✅ | 从 patch 恢复 38 个测试 |
| AC-8 useMarkdown.ts 兼容 | ✅ | 手动合并策略，vue-tsc 验证 |
| AC-9 图片端到端渲染 | ✅ | 后端 Content-Type + 前端 image rule 重写 |
| AC-10 链接端到端重写 | ✅ | link_open rule + 事件委托 |
| AC-11 同名文件 fallback | ✅ | pathMap basename 冲突删除 key |
| AC-12 _determine_content_type 测试 | ✅ | 新建 test_content_type.py |
| AC-13 真实尺寸图片 + vision | ✅ | P6 Playwright + vision-helper |
| AC-14 网络请求 Content-Type | ✅ | P6 Playwright 监控 |

**结论：14/14 BDD 条件全部有覆盖机制。**

## 隐含需求覆盖检查

| IR | 覆盖 | 评估 |
|----|------|------|
| IR-1 二进制格式覆盖 | ✅ | mimetypes.guess_type 基于扩展名，覆盖远超 P0 列举格式；分流策略确保文本文件不受影响 |
| IR-2 useMarkdown.ts 与 T045 兼容 | ✅ | §2 风险表 + §3.5 明确手动合并策略，不用 patch apply |
| IR-3 真实尺寸图片 | ✅ | AC-13 要求 ≥100×100 像素 |
| IR-4 先验功能再凑格式 | ✅ | P0 已声明，P6 流程约束 |
| IR-5 P2 最小验证 | ✅ | minimal_validation result=confirmed，含 curl 验证 + mimetypes 覆盖验证 |
| IR-6 P5 gate_commands 含 e2e | ✅ | gate_commands.P5_e2e 声明 e2e-smoke.sh |
| IR-7 否定证据处理 | ✅ | P0/P1 均声明，P6 流程约束 |
| IR-8 _determine_content_type 测试 | ✅ | AC-12 + 新建 test_content_type.py |

**结论：8/8 隐含需求全部覆盖。**

## 候选方案权衡评估

方案 A（分流策略）vs 方案 B（统一 fallback）：

- **方案 A 优势确认**：零回归（文本文件完全不变）、与 P0-brief 一致、与 `_build_sibling_data` 模式一致
- **方案 B 致命缺陷确认**：`mimetypes.guess_type` 对 `.rs`/`.ts` 返回错误 MIME，minimal_validation 已实证
- **选择理由自洽**：方案 A 的分流逻辑与 `_build_sibling_data`（files.py:272 `if file_record.is_binary`）模式完全一致，不是新发明

**评估：方案权衡合理，选择理由充分且经 minimal_validation 实证支撑。**

## gate_commands 可执行性

| gate_command | 可执行性 | 备注 |
|-------------|---------|------|
| P5: pytest | ✅ | 标准命令 |
| P5: vitest run | ✅ | 标准命令 |
| P5: vue-tsc --noEmit | ✅ | 标准命令 |
| P5_e2e: e2e-smoke.sh | ⚠️ | 脚本需在 P4/P5 期间创建，P2 仅声明路径 |
| P6: p6-verify.sh | ⚠️ | 同上 |

**评估：P5/P6 的 shell 脚本尚不存在，但 P2 声明路径是合理的——脚本在 P4 实现阶段或 P5 验证阶段创建即可。不阻塞。**

## minimal_validation 充分性

P2-design.md §minimal_validation:
- **assumption**: 明确声明 bug 现状 + 修复后预期
- **method**: curl 验证 + python3 mimetypes 验证
- **result**: confirmed
- **note**: 三项关键发现：
  1. 当前 bug 确认（PNG → text/plain）
  2. mimetypes.guess_type 对图片扩展名全部正确
  3. mimetypes.guess_type 对 .rs/.ts/.go 返回错误 MIME → 直接支撑方案 A 的分流决策

**评估：minimal_validation 充分且高质量。发现 #3 直接决定了方案选择，这是 P2 最小验证的核心价值——在设计阶段就发现了方案 B 的致命问题。**

## 实现复杂度评估

| 改动 | 复杂度 | 风险 |
|------|--------|------|
| 后端 `_determine_content_type` | 低 | 分流逻辑清晰，参考 `_build_sibling_data` 已有实现 |
| 后端 `get_file_content` 修改 | 极低 | 替换一行调用 |
| 前端 path-map.ts | 低 | 从 patch 恢复，T046 已验证 |
| 前端 useMarkdown.ts 合并 | 中 | 需手动合并到 T045 后的代码，是最大风险点 |
| 前端 MarkdownViewer.vue | 低 | 新增 props + 事件委托 |
| 前端 EntryDetailView.vue | 低 | 新增 computed + 事件处理 |

**总体复杂度：中低。最大风险是 useMarkdown.ts 手动合并（IR-2），但方案已明确策略且 vue-tsc 是硬门禁。**

## 风险遗漏检查

### 已识别风险（P2 §2 风险表）

1. `_TYPE_MAP` 是局部变量 → 评估：方案 A 的分流条件 `language and not is_binary` 直接调用 `_language_to_content_type(language)`，无需引用 `_TYPE_MAP`。**此风险已被设计规避，但风险表仍列出——合理。**
2. useMarkdown.ts 合并冲突 → 评估：手动合并策略明确。
3. pathMap basename fallback → 评估：冲突删除 key，安全策略。
4. SVG is_binary=False → 评估：§3.1 决策 #2 详述两种场景。
5. DOMPurify 删除属性 → 评估：API URL 是合法值，ADD_ATTR 新增 data-peekview-file-id。

### 新发现风险

1. **`_language_to_content_type` 对 language=None 的 fallback 是 `text/plain; charset=utf-8`**（files.py:113）。方案 A 的分流条件 `language and not is_binary` 在 language=None 时跳过文本路径，走三级 fallback。对于 language=None + is_binary=False 的文件（如无扩展名的文本文件），会走 mimetypes.guess_type → 可能返回 None → octet-stream。**这是否可接受？** — 可接受。无扩展名 + 无 language 的文件本就是边缘情况，octet-stream 比 text/plain; charset=utf-8 更安全（不会误将二进制当文本渲染）。且此类文件在 `/content` 端点本就不常见。

2. **`_build_sibling_data` 中 mimetypes 是局部 import**（files.py:274），方案 A 将 mimetypes 改为模块级 import。两者共存不冲突，但 `_build_sibling_data` 的局部 import 可在后续清理。**非阻塞，记录为技术债。**

**评估：无遗漏的阻塞级风险。**

## 架构问题

### 阻塞级

无。

### 非阻塞

1. **TD-001**：`_build_sibling_data` 的 `mimetypes` 局部 import 可在后续统一为模块级 import（本次不动，避免扩大改动范围）。
2. **TD-002**：`_TYPE_MAP` 作为 `_language_to_content_type` 的局部变量，长期应提取为模块级常量以便复用（本次方案 A 通过直接调用 `_language_to_content_type` 规避了此问题）。

## 测试缺口

1. **SVG language="xml" 场景**：AC-3 覆盖 SVG Content-Type，但 P2 设计中 SVG 有两种路径（language="xml" → text/xml vs language=None → image/svg+xml）。建议 test_content_type.py 覆盖两种场景。**非阻塞——AC-3 已覆盖，具体测试用例在 P3 细化。**
2. **language=None + is_binary=False 边缘场景**：如上风险分析，建议覆盖。**非阻塞。**

## 锁定决策

1. **方案 A（分流策略）确认**：零回归 + 与现有模式一致 + minimal_validation 实证支撑
2. **`_determine_content_type` 分流条件锁定**：`language and not is_binary` → 文本路径；否则 → 三级 fallback
3. **前端手动合并策略锁定**：不使用 patch apply，逐项手动合并到 T045 后的代码
4. **mimetypes 模块级 import 锁定**：标准库惯例，`_build_sibling_data` 局部 import 保留不冲突

## 评审结论

**status: approved**

阻塞问题数量：0

方案 A 覆盖全部 14 条 BDD + 8 条隐含需求，minimal_validation 高质量（发现 #3 直接决定方案选择），gate_commands 可执行，实现复杂度中低，无遗漏阻塞级风险。
