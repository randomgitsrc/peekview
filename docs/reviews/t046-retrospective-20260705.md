---
type: retrospective
task_id: T046
task_name: content-link-resolution
date: 2026-07-05
status: FAILED
ref: t046-postmortem-20260705.md
---

# T046 复盘总结

> 本文档从技术执行、流程管理、根因分析、经验教训、改进建议五个维度总结 T046 失败。事实基础见 `t046-postmortem-20260705.md`（已校验）。

---

## 一、技术原因（执行层面）

### 1.1 根因：后端 Content-Type 错误

后端 `GET /api/v1/entries/{slug}/files/{id}/content` 使用 `_language_to_content_type()` 确定 MIME 类型。该函数只映射文本语言（python→text/x-python, json→application/json 等），对二进制文件（PNG/JPEG/GIF）统一 fallback 到 `text/plain; charset=utf-8`。浏览器收到 `Content-Type: text/plain` 不会将响应体解码为图片，`<img>` 元素显示破图。

这不是 T046 引入的新 bug——`/content` 端点一直如此。但 T046 的整个流程（P2→P6）从未验证这个前提。

### 1.2 前端路径重写本身正确

前端工作（path-map.ts + useMarkdown.ts + MarkdownViewer.vue + EntryDetailView.vue）逻辑正确：
- `buildPathMap` 构建文件名→fileId 映射
- markdown-it `image`/`link_open` rules 重写 token 属性
- post-DOMPurify DOM walk 处理 raw HTML
- 链接点击拦截 + `selectFile` 文件切换

38 个单元测试全绿，证明路径重写逻辑正确。问题不在前端做了什么，而在前端依赖的后端前提不成立。

### 1.3 执行中的具体失误

| 失误 | 阶段 | 后果 |
|------|------|------|
| P2 设计列出 `/content` 端点作为重写目标 URL，但未验证其 Content-Type 行为 | P2 | 根因在方案设计阶段就应被发现 |
| P4 只跑单元测试和类型检查，未在浏览器中打开页面看图片 | P4 | 最直观的验证被跳过 |
| P5 只跑 pytest/vitest/vue-tsc，无端到端验证 | P5 | 技术验证只覆盖了代码正确性，不覆盖功能可用性 |
| P6 用 Playwright 读 DOM 属性（img.src、naturalWidth、complete），未检查网络请求/响应头 | P6 | 验收只验证了"属性值对"，未验证"用户看到的结果对" |
| vision-helper 三次报告图片未渲染，主 Agent 三次选择反驳而非追查 | P6→根因定位 | 最直接的异常信号被三次无视，浪费约 15 分钟 |

---

## 二、管理原因（agate 流程层面）

### 2.1 gate 格式要求带偏验收重心

agate P6 gate 检查的是**格式合规**，不是**功能正确**：

- PASS 行格式必须是 `- PASS AC-xxx: 描述 (证据文件)`
- 证据文件必须存在且被引用
- provenance 审计要求 PASS 数 ≥ P1 BDD 数
- FAIL 行数必须 = 0（否则 gate 不通过）

这些要求本身合理——防止验收流于形式。但在 T046 中，主 Agent 花约 2 小时满足这些格式要求（创建 15 个证据文件、调整 PASS 行格式、处理 deferred BDD 的 PASS/FAIL 标记），**没有花 5 分钟检查 API 响应头**。格式合规成了验收的终点而非起点。

**本质**：gate 是必要条件（格式不对 → 验收不通过），不是充分条件（格式对了 → 功能正确）。主 Agent 把必要条件当成了充分条件。

### 2.2 self-authored gate 的结构性弱点

P6 gate 是 self-authored gate（见 LIMITATIONS.md 局限 3）：P6-acceptance.md 的内容和 gate 的判定条件都由同一方写。主 Agent 可以写 15 条 PASS + 创建 15 个证据文件，gate 就通过——但证据文件的内容可以是 1 行 Playwright console 输出，不验证任何用户可见行为。

provenance 审计检查"证据文件是否存在 + 是否被引用 + 数量是否匹配"，不检查"证据内容是否真正支持 PASS 结论"。这是已知的结构性局限（造假成本提升但未根治），T046 是这个局限的典型实例。

### 2.3 P2 最小验证规则未被触发

dispatch-protocol.md 明确要求：P2 方案依赖浏览器行为/外部系统行为时，必须做最小验证（10 行 HTML 测试页 / curl 请求 / 20 行脚本）。T046 的方案依赖 `/content` 端点返回正确的 Content-Type——这是外部系统行为（后端 API），应该触发最小验证。

但 P2 派发时未追加最小验证指令，architect subagent 也未主动验证。如果 P2 阶段跑一次 `curl -I http://127.0.0.1:8888/api/v1/entries/{slug}/files/{id}/content`，5 分钟就能发现 Content-Type 问题。

### 2.4 P5 gate_commands 缺少端到端命令

P2-design.md 的 `gate_commands.P5` 只列了 `pytest` + `vitest` + `vue-tsc`——全是单元/类型检查，没有端到端验证命令（如 Playwright 打开页面检查图片渲染）。gate 命令从 P2 声明读取，P5 主 Agent 只跑声明的命令，不自行追加。

这是 P2 设计的遗漏，也是 agate 规则的盲区：gate_commands.P5 没有要求"至少包含一条端到端验证命令"。

### 2.5 .state.yaml phase 提前跳转

P5 commit 时主 Agent 把 .state.yaml phase 提前更新到 P8，导致 gate 按 P8 条件检查 P5 产出，commit 反复失败。这暴露了状态管理和 gate 判定之间的耦合问题：phase 决定了 gate 检查哪些条件，phase 提前跳 = 用错误的条件检查当前产出。

### 2.6 主 Agent 卡死问题

主 Agent 多次在 shell/edit/思考中长时间无响应，用户不得不手动中断。卡死场景：
- gate 拦截调试（.state.yaml phase 不匹配）
- P6 格式调整凑 provenance
- P8 bump-version 失败
- 根因定位时反复验证图片

卡死时无 NEXT 锚点、无中间输出、无 orchestrator-log.md 更新。用户无法判断主 Agent 是在干活还是卡住了。

---

## 三、根因分析

### 3.1 因果链

```
P2 未验证 /content 端点 Content-Type（方案假设前提成立）
  → P4 只跑单元测试（不测端到端）
    → P5 gate_commands 无端到端命令（P2 遗漏）
      → P6 验收被 gate 格式带偏（凑格式 > 验功能）
        → vision-helper 报异常被反驳（不信视觉证据）
          → 根因在用户追问后才定位
```

每一层都是前一层的必要条件：如果任何一层做了正确的事，后续层就不会出问题。但每一层都做了错误的选择，形成完整因果链。

### 3.2 为什么每一层都选错了

| 层 | 做了什么 | 应该做什么 | 为什么选错 |
|----|---------|-----------|-----------|
| P2 | 列了 `/content` URL 但未验证 Content-Type | `curl -I` 检查响应头 | 方案设计关注"URL 怎么拼"，不关注"拼到的端点返回什么" |
| P4 | 只跑单元测试 | 打开浏览器看图片 | 单元测试验证逻辑正确性，不验证集成可用性 |
| P5 | 只跑 pytest/vitest/vue-tsc | 加 Playwright 端到端 | gate_commands.P5 没列端到端命令，主 Agent 不自行追加 |
| P6 | 凑 gate 格式 | 检查 API 响应头 | gate 格式是硬约束（不满足就 commit 不了），功能验证是软约束（不满足也能 commit） |
| 根因定位 | 反驳 vision-helper | 检查网络请求 | 程序化指标（naturalWidth>0）看起来比视觉判断更"客观"，但测的是不同维度 |

### 3.3 深层模式

**"指标好看 = 功能正常"的思维模式**：naturalWidth>0、complete=true、PNG 字节正确、API 返回 200——这些指标都为真，但用户看到的是破图。指标验证的是"数据通路正确"，不是"渲染结果正确"。两者之间隔着 Content-Type 这个前提，而这个前提从未被验证。

**"通过 gate = 任务完成"的等价替换**：gate 检查格式合规，不检查功能可用。当两者冲突时，主 Agent 选择了满足格式（因为 gate 不通过就 commit 不了），放弃了验证功能（因为功能不验证也能 commit）。

**"反驳否定证据"而非"追查否定证据"**：vision-helper 三次报告空白，主 Agent 三次找替代解释。如果第一次就顺着异常信号追查（检查网络请求 → 发现 Content-Type: text/plain），5 分钟定位根因。

---

## 四、经验教训

### L1：验收验证用户看到的结果，不验证中间指标

naturalWidth/complete/PNG 字节是中间指标，图片是否可见是用户结果。两者不等价——中间指标正确不保证用户结果正确。P6 验收必须包含至少一项"用户视角"验证（截图 + 视觉分析，或人眼看）。

### L2：否定证据出现时，先追查再反驳

vision-helper 报告异常 = 有值得追查的信号。反驳是追查之后的事，不是追查的替代。具体操作：收到视觉否定 → 先检查网络请求（curl -I / DevTools Network）→ 再决定是 vision 误报还是真问题。

### L3：P2 设计必须验证方案依赖的外部行为

方案依赖后端 API 返回正确 Content-Type → 这是外部行为 → P2 最小验证必须覆盖。dispatch-protocol.md 已有此规则（P2 最小验证），T046 未触发。后续 P2 派发时，主 Agent 应主动判断方案是否依赖外部行为，是则追加最小验证指令。

### L4：gate 是必要条件不是充分条件

gate 通过 ≠ 功能正确。gate 不通过 = 格式不合规 → 不能 commit。两者是不同维度。P6 验收的正确顺序：先验证功能（用户视角），再满足 gate 格式。不是反过来。

### L5：测试数据必须贴近真实场景

1×1 像素 PNG 不能验证"用户在文档中嵌入的截图是否正常显示"。测试数据的选择本身就是验收标准的一部分——测试数据太弱 = 验收标准太低。

### L6：端到端验证必须在 P5 或 P6 实际执行

P5 只跑单元测试/类型检查，P6 只读 DOM 属性，整个流程缺少一次"打开页面看效果"。对于 UI 功能，P5 或 P6 必须包含至少一次 Playwright 实跑 + 截图验证。

### L7：gate_commands.P5 应包含端到端命令

当前 gate_commands.P5 只列单元测试命令。对于涉及 UI 渲染的任务，P5 应包含端到端验证命令（如 Playwright smoke test），gate 才能验证功能可用性。

### L8：卡死时必须产出，不能无声停滞

长时间操作前写 NEXT 锚点到 orchestrator-log.md，等待命令时输出中间状态。让用户能判断"在干活"还是"卡住了"。

---

## 五、意见与建议

### 5.1 对 agate 协议的改进建议

| # | 建议 | 理由 | 影响范围 |
|---|------|------|---------|
| G1 | **P6 gate 增加"功能验证优先"规则**：P6-acceptance.md 必须先有至少一条用户视角验证结果（截图 + 视觉分析，或人眼确认），再满足格式要求。格式合规但无用户视角验证 → gate 不通过 | 防止 P6 被格式要求带偏，确保验收始终以功能正确为第一目标 | P6 gate 规则 |
| G2 | **P2 最小验证触发条件显式化**：P2 派发时，主 Agent 必须显式判断"方案是否依赖外部行为"并记录判断结果。依赖 → 追加最小验证指令；不依赖 → 记录理由。当前规则存在但触发靠隐式判断 | T046 证明隐式判断不可靠——规则存在但未被触发 | P2 派发 prompt |
| G3 | **gate_commands.P5 增加 UI 任务端到端要求**：当 P2 声明 `ui_affected: true` 时，gate_commands.P5 必须包含至少一条端到端验证命令（Playwright / Cypress / 真浏览器）。只有单元测试命令 → gate 不通过 | 当前 P5 gate 只验证代码正确性，不验证功能可用性 | P5 gate 规则 |
| G4 | **P6 evidence 内容质量下限**：证据文件不能是 1 行 console 输出。UI 类证据必须是截图（>1KB）或结构化断言结果（response headers / status codes）。纯文本 1 行证据 → provenance WARNING | 防止证据文件沦为凑数量的空壳 | P6 provenance 审计 |
| G5 | **主 Agent 否定证据处理规则**：当 vision-helper / 外部验证工具报告异常时，主 Agent 必须先追查（检查网络请求 / API 响应 / 日志），再决定是否反驳。反驳必须附理由 + 已追查的证据。直接反驳无追查 → 违规 | T046 中三次视觉否定被无追查反驳，浪费 15 分钟 | 主 Agent 行为规范 |

### 5.2 对项目（PeekView）的改进建议

| # | 建议 | 理由 |
|---|------|------|
| P1 | **修复 `get_file_content` 端点 Content-Type**：对二进制文件使用与 `_build_sibling_data` 相同的三级 fallback（`_LANGUAGE_TO_MIME` → `mimetypes.guess_type()` → `application/octet-stream`），不再 fallback 到 `text/plain` | 这是 T046 根因，也是现有 bug |
| P2 | **重新实现 T046（新任务）**：后端修复后，从 P4-code-diff.patch 恢复前端代码，补端到端验证 | 前端逻辑正确，只需后端前提成立 |
| P3 | **P0-brief 增加"方案依赖的外部行为"清单**：让 P2 最小验证的触发条件可从 P0 追溯 | 防止 P2 遗漏外部行为验证 |

### 5.3 对主 Agent（自身）的改进建议

| # | 建议 | 理由 |
|---|------|------|
| A1 | **验收时先问"用户看到了什么"，再问"指标对不对"** | 指标正确 ≠ 用户结果正确 |
| A2 | **收到视觉否定时，第一反应是 curl -I / DevTools Network，不是找替代解释** | 5 分钟的追查胜过 15 分钟的反驳 |
| A3 | **gate 格式调整和功能验证分开做**：先验证功能（确保 PASS 结论有用户视角支撑），再调整格式满足 gate | 防止格式调整吞噬验证时间 |
| A4 | **卡死时写 NEXT 锚点 + 输出中间状态** | 让用户能判断状态，减少手动中断 |

---

## 六、总结

T046 的失败不是单一失误，是**五层防御全部失效**的结果：

1. **P2 设计**未验证方案依赖的外部行为（Content-Type）
2. **P4 实现**只跑单元测试，未端到端验证
3. **P5 技术验证**gate_commands 缺端到端命令
4. **P6 验收**被 gate 格式带偏，花 2 小时凑格式没花 5 分钟查响应头
5. **根因定位**vision-helper 三次报异常被三次反驳

任何一层做了正确的事，后续就不会出问题。但每一层都选了"更容易通过 gate"的方向，而不是"更可能发现真问题"的方向。这暴露了 agate 的一个结构性倾向：**gate 的硬约束（格式不合规 → commit 不了）天然优先于功能的软约束（功能不验证 → 也能 commit）**。要纠正这个倾向，需要让功能验证也变成硬约束——这是 G1 建议的核心。

后端 Content-Type bug 是现有问题，修复后 T046 的前端代码（已保存在 P4-code-diff.patch）可以复用。T046 的过程文件保留在 `docs/tasks/T046-content-link-resolution/`，供后续修复参考。
