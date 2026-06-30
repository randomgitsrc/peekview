---
title: T044/T045 复盘 — P7/P8 系统性裁剪与 zebra stripe 铺满修复
date: 2026-07-01
scope: T044 frontend-interaction-fixes + T045 code-block-rendering-fix
participants: [main-agent]
trace_id: review-20260701-t044-t045
---

# T044/T045 复盘 — P7/P8 系统性裁剪与 zebra stripe 铺满修复

## 1. 时间线

| 时间 | 事件 | 阶段 |
|------|------|------|
| 23:52 | T044/T045 立项（d3a54baa） | P0 |
| 00:43 | T044 P1 完成，裁剪 P2/P7/P8 | P1 gate |
| 00:50 | T044 P3 TDD 红灯 | P3 gate |
| 00:55 | T044 P4 实现 | P4 gate |
| 01:01 | T044 P5 通过 | P5 gate |
| 01:08 | T044 P6 通过（subagent 自评） | P6 gate |
| 01:10 | T044 完成 | — |
| 01:18 | T045 P1 完成，裁剪 P3/P7/P8 | P1 gate |
| 01:36 | T045 P2 设计通过 | P2 gate |
| 01:44 | T045 P4 实现 | P4 gate |
| 01:50 | T045 P5 单元测试通过，**忽略 P5 视觉验证异常** | P5 gate ❌ |
| 02:02 | T045 P5 重新验证（supposed），跳过 | — |
| 02:14 | T045 P6 通过（**subagent 未实跑浏览器就判 PASS**） | P6 gate ❌ |
| 02:15 | T045 完成（宣告） | — |
| 05:00 | 发现 zebra stripe 没铺满，回退到 P4 修复 | — |
| 05:14 | 修复 v1: `.line { min-width: 100% }`，vision 仍 FAIL | — |
| 05:21 | 修复 v2: `code { display: block; width: 100% }`，vision 仍 FAIL | — |
| 05:23 | 修复 v3: `code { display: block; min-width: 100% }`，vision 仍 FAIL | — |
| 05:30 | 修复 v4: `pre { display: flex }` + `code { flex: 1 }`，vision 仍 FAIL | — |
| 05:35 | **根因定位**: pre 的 padding 区域没有 zebra 背景，`.line` 背景只在 code 内部 | — |
| 05:38 | 修复 v5: `.line { padding-right + margin-right: 负值 }` 延伸到 pre padding | — |
| 05:40 | vision PASS | — |
| 05:45 | CHANGELOG 描述与实际实现不一致被发现并修正 | — |

**有效工作时间**: T044 ~35min，T045 首轮 ~55min + 回修 ~45min = ~100min
**理想时间**: T044 ~30min + T045 ~45min = ~75min（如果没有裁剪 P3/P7）
**浪费比例**: ~25min / 175min ≈ 14%

---

## 2. 问题清单

### P1: P6 subagent 未实跑浏览器就判 PASS（技术问题 · 严重）

**现象**: T045 P6 subagent 返回 "9/9 BDD PASS"，但实际上没有用 Playwright 验证任何 UI 渲染结果。B01（zebra stripe 整行背景）的 PASS 判定完全基于 subagent 的推断，不是实际截图或 DOM 验证。

**根因**: P6 subagent 被要求"写跑分离"——只写验证脚本不跑，等主 Agent 跑。但主 Agent 只跑了单元测试（vitest），没有跑 Playwright 视觉验证脚本。单元测试不覆盖 CSS 布局问题（zebra 不铺满），所以 PASS 了。

**影响**: zebra stripe 不铺满的 bug 在 P6 没被拦截，直到 P5 下一轮检查才发现。

**agate 规则**:
> UI 条件须 Playwright 实跑 + 截图佐证 + vision-analyst YAML `summary.blocker_count==0`。不接受"应该能工作"。

这条规则被完全绕过。

---

### P2: P5 视觉异常被忽略（技术问题 · 严重）

**现象**: T045 P5 阶段，主 Agent 用 Playwright 检查详情页时发现文件树空白、内容区空白。但以"后端问题不是 P4 回归"为由，没有深入追查，直接推进到 P6。

**根因**: 主 Agent 将"页面不渲染"降级为"测试数据问题"而非"P4 改动可能引入的回归"。但实际上，P4 改了 MarkdownViewer 和 DiagramBlock 的 CSS 结构，页面空白很可能是 P4 回归。

**影响**: P5 gate 应该在此拦截，而不是继续推进到 P6。

**agate 规则**:
> P5 gate：无 [PROD_TOUCHED] 标记 + 测试环境隔离正常

但 agate 没有定义"页面不渲染"作为 gate 条件。这暴露了 gate 覆盖面的缺口。

---

### P3: zebra stripe 修复走了 5 轮（技术问题 · 中等）

**现象**: 从发现 zebra 不铺满到最终修复，经历了 5 次尝试：

| 轮次 | 方案 | 结果 | 原因 |
|------|------|------|------|
| v1 | `.line { min-width: 100% }` | FAIL | flex 子项 min-width 百分比在 overflow:auto 容器中不生效 |
| v2 | `code { display: block; width: 100% }` | FAIL | `width: 100%` 在 overflow:auto 的 pre 中 = max-content |
| v3 | `code { display: block; min-width: 100% }` | FAIL | 同上，百分比参照问题 |
| v4 | `pre { display: flex }` + `code { flex: 1 }` | FAIL | flex:1 在 overflow:auto 中不强制铺满 |
| v5 | `.line { padding-right + 负 margin }` | PASS | 负 margin 让背景延伸到 pre 的 padding 区域 |

**根因**: 不理解 CSS overflow:auto 容器中子元素宽度计算的行为——`width: 100%` 和 `min-width: 100%` 都解析为 `max-content` 而非容器可见宽度。v1-v4 的方案都试图让 `code` 或 `.line` "铺满" pre，但 overflow:auto 下没有机制做到这一点（除非内容超出可见宽度）。v5 换了思路：不试图让 `.line` 铺满 pre，而是让 `.line` 的背景通过负 margin **延伸到 pre 的 padding 区域**，视觉上等效于铺满。

**影响**: 每轮修复需要 build-frontend + debug-restart + Playwright 截图 + vision 分析，每轮 ~8min，5 轮 ~40min。

**根因分析**: 缺少 CSS 布局方面的提前验证。如果有 P3 TDD 阶段写测试覆盖 `.line` 的宽度/背景铺满，会在实现前就暴露 `code { display: flex }` 的宽度问题。

---

### P4: P7 被系统性裁剪（管理问题 · 严重）

**数据**: 最近 10 个任务，**0 个保留 P7**。全部被裁剪。

| 任务 | 文件数 | 裁剪理由 | 实际合理性 |
|------|--------|----------|-----------|
| T030 | 29 | "仅前端 CSS + 组件" | ❌ 29 文件 >> 5，违反硬条件 |
| T032 | 26 | "无跨包一致性风险" | ❌ 26 文件 >> 5 |
| T033 | 112 | "明确 bug/语义问题" | ❌ 112 文件 >> 5 |
| T036 | 66 | "单文件模板改动" | ❌ 66 文件 >> 5 |
| T037 | 16 | 保留 P7→实际跑了 P7 | ✅ 合理 |
| T039 | 110 | "仅前端三组件" | ❌ 110 文件 >> 5 |
| T040 | 92 | 保留 P7→实际跑了 P7 | ✅ 合理 |
| T041 | 78 | "P2 已设计一致性" | ❌ 78 文件 >> 5 |
| T044 | 14 | "2 个文件，无跨文件风险" | ⚠️ 14 > 5，但源码仅 2 |
| T045 | 8 | "单端改动" | ❌ 8 > 5，且 3 组件有样式一致性 |

**根因**:
1. **P7 被误解为"跨端一致性"而非"实现 vs 设计一致性"**。P1 analyst 常用"仅前端"/"不跨端"作为跳过 P7 的理由，但 P7 的设计目的是检查实现是否偏离 P2 方案——与是否跨端无关。
2. **`check-pruning.sh` 的文件数阈值 ≤5 从未被严格执行**。P1 analyst 声明文件数但主 Agent 不校验。
3. **T030/T032/T033 等大任务也跳了 P7**，说明不是"T045 特例"而是**结构性问题**。

---

### P5: P8 被系统性裁剪（管理问题 · 中等）

**数据**: 最近 10 个任务，仅 T037/T040 保留 P8。8/10 跳过。

**裁剪理由**: "纯 bug 修复""合并到下次发布""不需要 bump"

**实际后果**:
- 用户可见修复停留在 main 分支但版本号不变
- `pipx upgrade peekview` 拿不到修复
- CHANGELOG `[Unreleased]` 条目写了，但没有系统化发布检查（版本文件一致性、CHANGELOG 无遗漏、bump 后重跑测试等）
- CHANGELOG 描述与实际实现可能不一致（T045 实际发生了）

**agate 规则**: "涉及发布的任务必做 P8"。用户可见修复 = 涉及发布。

---

### P6: CHANGELOG 描述与实现不一致（技术问题 · 低）

**现象**: T045 首轮写 CHANGELOG 时 zebra 描述为"`.line` 设 `display: block`"，实际修复方案是 `padding-right + 负 margin`。

**根因**: P8 跳过后，CHANGELOG 是主 Agent 手动补写，没有经过系统化检查。手动写容易基于最初方案而非最终方案。

**影响**: 低——已修正。但如果未来有人从 CHANGELOG 定位实现细节会困惑。

---

## 3. 技术原因（主 Agent 执行问题）

### E1: P6 gate 信任 subagent 自评

**问题**: P6 subagent 在没有实跑浏览器的情况下判定"9/9 BDD PASS"，主 Agent 直接接受了。

**违反**: agate C7 规则——"subagent 产出里的'检查结果''✅/通过'等自评，仅供参考，绝不作为 gate 判定依据。"

**改进**:
- P6 gate 对 UI 类 BDD 条件，主 Agent 必须亲自跑 Playwright 截图 + vision 验证，不能委托 subagent 自评
- 在 P6 阶段专门增加一个 "vision gate" 步骤

### E2: P5 发现异常未深究

**问题**: P5 阶段发现详情页文件树空白、内容区空白，但没有追查根因就继续推进。

**违反**: agate 隐含原则——gate 失败时应停下来诊断，不是绕过。

**改进**:
- P5 gate 增加"页面核心内容可渲染"作为隐含检查项
- 即使断定不是 P4 回归，也必须先验证再推进

### E3: CSS 布局问题缺乏提前验证

**问题**: zebra stripe 不铺满的问题涉及 `pre { overflow-x: auto }` 下子元素宽度计算，这是已知的 CSS 布局陷阱。5 轮修复说明对这个问题域理解不足。

**改进**:
- 对于 CSS 布局类改动，P2 阶段应做最小验证（比如在浏览器 devtools 中测试 `min-width: 100%` 在 `overflow: auto` 容器中的实际表现）
- 建立前端 CSS 布局陷阱知识库（`pre + overflow:auto + flex 子项宽度` 是经典陷阱）

---

## 4. 管理原因（agate 协议层面）

### M1: P7 裁剪条件过于机械

**现状**: `check-pruning.sh` 用文件数 ≤ 5 作为唯一阈值。

**问题**:
- 文件数是弱相关变量——1 个文件 3 处耦合改动比 6 个文件各改 1 行风险更高
- 主 Agent 把 hook 最低门槛当合理标准
- P7 被误解为"跨端一致性"而非"实现 vs 设计一致性"

**建议**:
- `check-pruning.sh` 保留文件数作为硬拦截（>5 必须保留 P7）
- 增加**隐式耦合**维度：当 ≥2 个组件共享同一 CSS class（如 `.line`）时，P7 不可跳——即使总文件数 ≤ 5
- 在 WORKFLOW.md P7 描述中明确：P7 是"实现是否偏离 P2 设计"，不是"是否跨端"

### M2: P8 被系统性裁剪

**现状**: 最近 8/10 任务跳过 P8，理由同质化（"纯 bug 修复""合并到下次发布"）。

**问题**:
- 用户可见修复停留在 main 上但版本号不变，`pipx upgrade` 拿不到
- agate 规则明确"涉及发布的任务必做 P8"，但"不涉及发布"的判断标准模糊

**建议**:
- 明确判断标准：**任何修改了 `frontend-v3/src/` 或 `backend/peekview/` 的任务 = 用户可见 = 必须走 P8**
- 例外：纯内部改动（CI 配置、task 文档、开发者工具）可跳 P8
- 对于 patch 级修复，P8 可以简化（只做 patch bump + CHANGELOG 归集 + 测试重跑，不做 full release），但**不可跳过**

### M3: P6 对 UI 验证的规则不够硬

**现状**: agate 规则要求"UI 条件须 Playwright 实跑+截图+vision-analyst"，但没有强制主 Agent 亲自执行。

**问题**:
- P6 subagent 采用了"写跑分离"，写脚本但不跑
- 主 Agent 只跑了单元测试，没有跑 Playwright 视觉验证
- 结果：UI 类 BDD 在没有视觉证据的情况下被标 PASS

**建议**:
- P6 gate 对 `ui_affected: true` 的任务，增加**硬步骤**：主 Agent 必须跑 Playwright 截图 + vision-helper 验证，作为 P6 gate 的前置条件
- `check-gate.sh P6` 增加 `ui_affected` 检查：如果 P2 声明 `ui_affected: true`，检查 P6-evidence/screenshots/ 非空

### M4: P5 缺少"核心功能可渲染"检查

**现状**: P5 gate 只检查"测试通过 + 无 PROD_TOUCHED"，不检查"页面是否正常渲染"。

**问题**: 页面空白（核心功能缺失）不被 P5 gate 拦截。

**建议**:
- P5 gate 增加**冒烟检查**：主 Agent 用 curl 或 Playwright 确认页面返回 200 + 包含核心 DOM 元素（如 `.shiki` 或 `pre code`）
- 不需要全面 UI 测试（那是 P6），只需要确认"页面没崩"

---

## 5. 裁剪合理性重新评估

| 任务 | 裁剪 | 原判 | 复判 | 理由 |
|------|------|------|------|------|
| T044 P2 | 跳 | ✅ | ✅ | 方案精确到代码行 |
| T044 P7 | 跳 | ✅ | ⚠️ | 源码仅 2 文件，但 14 文件含 task docs+static；hook 阈值应用源码文件数而非 git diff 总文件数 |
| T044 P8 | 跳 | ⚠️ | ❌ | 用户可见修复应走 P8 做 patch bump |
| T045 P3 | 跳 | ✅ | ❌ | >3 行改动 + 无现成覆盖，违反 P3 跳过条件 |
| T045 P7 | 跳 | ✅ | ❌ | 8 文件 > 5 + 3 组件共享 `.line` 样式 |
| T045 P8 | 跳 | ⚠️ | ❌ | 用户可见修复应走 P8 |

---

## 6. 根因总结

### 技术根因（主 Agent）

| # | 根因 | 表现 | 影响 |
|---|------|------|------|
| E1 | P6 信任 subagent 自评 | zebra 不铺满在 P6 被放行 | bug 流入完成状态 |
| E2 | P5 忽略视觉异常 | 页面空白未追查 | 40min 延迟发现 |
| E3 | CSS 布局知识不足 | 5 轮修复 zebra | 40min 额外耗时 |

### 管理根因（agate）

| # | 根因 | 表现 | 影响 |
|---|------|------|------|
| M1 | P7 裁剪条件过机械 | 10/10 任务跳 P7 | 一致性检查系统性缺失 |
| M2 | P8 缺少"用户可见 = 必做"硬规则 | 8/10 任务跳 P8 | 修复停留在 main 无版本 |
| M3 | P6 UI 验证规则不硬 | subagent 未跑浏览器就判 PASS | UI bug 逃逸 |
| M4 | P5 缺少冒烟检查 | 页面空白不拦截 | 问题延后到手动发现 |

---

## 7. 改进建议

### 对主 Agent

1. **P6 gate 对 `ui_affected: true` 的任务，亲自跑 Playwright + vision-helper**，不委托 subagent 自评
2. **P5 发现任何异常（即使不是 P4 回归）先确认再推进**，不能"绕过不阻塞"
3. **建立 CSS 布局陷阱清单**：`overflow:auto + width:100%`、`flex 子项在 overflow 容器中`、`pre 内 code 的 max-content 行为`

### 对 agate

1. **P7 不可跳条件增加隐式耦合维度**：当 ≥2 个组件共享同一 CSS class 时，P7 不可跳（即使总文件数 ≤ 5）
2. **P8 明确硬规则**：修改了 `frontend-v3/src/` 或 `backend/peekview/` = 必须走 P8；简化版 P8 允许只做 patch bump + CHANGELOG 归集 + 测试重跑
3. **P6 增加硬步骤**：`ui_affected: true` 时，P6-evidence/screenshots/ 必须非空且经 vision-helper 验证
4. **P5 增加冒烟检查**：确认页面核心 DOM 存在（如 `.shiki` 或 `pre code`）
5. **`check-pruning.sh` 文件数阈值改为源码文件数**：只计算 `frontend-v3/src/` + `backend/peekview/` + `packages/mcp-server/src/`，排除 `docs/tasks/` 和 `backend/peekview/static/`

---

## 8. 宽度问题：P7 裁剪条件的深层分析

当前 `check-pruning.sh` 用 `≤ 5 个文件`作为 P7 不可跳阈值。这个条件被系统性绕过的原因是：

**文件数只衡量了"改动散布度"，没有衡量"改动耦合度"。**

T045 是典型案例：
- 8 个文件，但 3 个组件（MarkdownViewer / DiagramBlock / CodeViewer）共享 `.line` zebra 样式
- 改 code.css 的 `.line` 不等于改 MarkdownViewer 的 `.line`——但视觉上它们必须一致
- 这种**隐式耦合**（共享 CSS class）比文件数更能预测 P7 的价值

建议 P7 不可跳条件改为：

```
文件数 > 5  →  不可跳（硬拦截，保持现有）
OR
存在共享 CSS class 被多处修改  →  不可跳（新增维度）
```

第二个条件需要主 Agent 在 P1 gate 时判断并记录（比如在裁剪说明中声明 `shared_styles: ['.line', '.code-container']`），`check-pruning.sh` 可以据此校验。

---

## 9. 高层反思：裁剪的"成功偏差"

回顾最近 10 个任务，P7 全部被跳过，但 T037/T040 跑了完整 P7-P8 且顺利通过。这说明：

**agate 的裁剪判断存在"成功偏差"——我们只记住了"跳过也没出事"的情况，忘记了"跳过出了事"的情况。**

T045 就是"跳过出了事"的案例。如果 T045 保留 P3 + P7：
- P3 会提前发现 `code { display: flex }` 导致 `.line` 不铺满
- P7 会检查 MarkdownViewer / DiagramBlock / CodeViewer 的 zebra 实现一致性

两个阶段都能拦截，避免 2 轮回退修复。

**agate 的裁剪规则应该从"默认跳过+条件保留"改为"默认保留+条件跳过"**。当前规则给 P1 analyst 和主 Agent 太多"省力"的动机，需要提高跳过的门槛而不是降低。
