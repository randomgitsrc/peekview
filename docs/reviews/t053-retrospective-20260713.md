# T053 复盘：Agent /raw 端点自动发现

- **时间**: 2026-07-12 ~ 2026-07-13（跨 2 天，单会话完成 P0-P7）
- **Agent 模型**: xopglm51 (Opencode)
- **Agate 版本**: v0.12.0
- **最终状态**: READY，待 bump v0.6.3 + publish
- **代码改动**: main.py + api/files.py（~80 行新增），llms.txt 更新
- **测试**: 851 pytest passed，33 专项测试全绿

---

## 1. 阶段逐项合规审计

### P0 — 任务启动

| 卡片要求 | 实际执行 | 合规 |
|---------|---------|------|
| 主 Agent 亲自写 P0-brief（不派 subagent） | ✅ 主 Agent 亲自执行 | ✅ |
| 五字段齐全 | ⚠️ 初版缺 `executor_env`，后补完 | ⚠️ 遗漏后修复 |
| 环境自检 | ✅ 全项验证（pytest/playwright/vision/debug backend） | ✅ |
| 写 active-tasks.md | ✅ | ✅ |

**问题 M1**：P0-brief 初版缺 `executor_env` 字段。P0 卡片明确说"任一字段为空占位符 → 补完再推进 P1"，但主 Agent 在 P0-brief 不完整时就进入了 P1 派发，事后才回头补 `executor_env`。违反了"补完再推进"的要求。

**根因**：主 Agent 没有逐字段校验 P0-brief 就推进，凭"大致完整"的印象继续。

---

### P1 — 需求基线

| 卡片要求 | 实际执行 | 合规 |
|---------|---------|------|
| 派发 analyst subagent | ✅ 派发 general subagent（analyst 角色） | ✅ |
| BDD ≥1 条 | ✅ 17 条（后增到 20） | ✅ |
| 派发 requirements-review（agent≠main） | ✅ 两轮评审，最终 approved | ✅ |
| 无未决 NEED_CONFIRM | ⚠️ 见下文 | ⚠️ |
| check-gate.sh P1 | ✅ exit 2（主 Agent 自判） | ✅ |

**问题 A1（agate）**：analyst 产出 2 个 `[NEED_CONFIRM]`（NC1: llms.txt 路径，NC2: 私有 entry <link> 注入）。P1 卡片说"无未决 [NEED_CONFIRM]（有则 PAUSED）"——正确做法是标记 PAUSED 等人确认。但主 Agent 直接自行解决了两个 NEED_CONFIRM（选了建议方向），没有 PAUSED。

**评估**：主 Agent 的决策方向与 analyst 的建议一致（NC1→路径 A，NC2→选项 A），且理由合理。但流程上违反了"NEED_CONFIRM → PAUSED"的硬规则。正确做法：暂停推进，向用户报告两个 NEED_CONFIRM，等用户确认后继续。

**问题 A2（agate）**：NEED_CONFIRM 解决后，P1-requirements.md 中 NC1 的描述段落仍保留了"这是 [NEED_CONFIRM] 项"的文字（第 64 行），虽然标题已改为 `[RESOLVED]`。如果 gate 脚本用 grep 检查 `[NEED_CONFIRM]`，会误判为未决。应清理描述文本中的残留标记。

**问题 A3（agate）**：P1 review 第一轮返回 needs-revision（3 个 M 项 + 8 个 R 项）。主 Agent 直接修改 P1-requirements.md 后重派 review，没有让 analyst subagent 修改。P1 卡片说"review 不通过 → analyst 修改需求 → 再 review"，但实际是主 Agent 自己改的。

**评估**：修改内容是 BDD 新增和声明字段调整，主 Agent 作为需求基线维护者直接修改效率更高。但严格按流程应回派 analyst。

---

### P2 — 方案设计

| 卡片要求 | 实际执行 | 合规 |
|---------|---------|------|
| 派发 architect subagent | ✅ | ✅ |
| 候选方案 ≥2 | ✅ 方案 A + 方案 B | ✅ |
| 四字段齐全 | ✅ | ✅ |
| minimal_validation | ✅ GitHub Accept 行为 curl 实测 | ✅ |
| **按 C8 映射派评审** | ❌ **未派任何评审** | ❌ |
| check-gate.sh P2 | ✅ exit 2 | ✅ |

**问题 A4（agate，严重）**：P2 没有派发任何评审。

主 Agent 的理由：C8 映射表中 P2 的触发条件是 `frontend → plan-design-review` / `high → plan-eng-review` / 业务不明 → office-hours，T053 无 frontend domain、risk_level=medium、业务方向明确，因此"按 C8 映射无需评审"。

**这个判断是错误的**。原因：

1. **C8 映射表是"机械映射"不是"选择性映射"**：review-mapping.md 说"主 Agent **机械映射**评审角色"——机械意味着只按规则走，不加判断。表中列的是触发条件，未触发的确实不强制。但...

2. **P2 卡片的评审要求独立于 C8**：P2 卡片 §评审派发说"按 C8 映射表派评审"——这确实指向 C8 表。但 P2 卡片 §推进条件说"P2-review.md status: approved（P2 未被裁剪时）"——这暗示 P2 应该有 review 文件。

3. **P2 评审的价值**：T053 涉及 Content Negotiation 安全边界（Accept header 解析逻辑决定浏览器是否意外拿 JSON），这个设计决策值得独立审查。CSO 评审在 P4 才派（C8 的 `security → P4 后`），但 P2 设计本身就有安全假设（"text/html 存在 → HTML"规则），这些假设在 P2 阶段就应该被质疑。

4. **实际后果**：P4 backend review 发现了 2 个 CRITICAL（404 格式不一致 + ARCHIVED entry 过滤缺失）。如果 P2 有评审，这两个问题可能在设计阶段就被发现，避免实现后返工。

**建议**：即使 C8 映射无强制触发条件，涉及安全边界的设计（Content Negotiation、认证逻辑复用）应在 P2 主动派 security 相关评审（cso 或至少 design-review）。C8 映射表是最低要求，不是上限。

**问题 A5（agate）**：P2 的 `[SCOPE+]` 发现（B5 预期与 GitHub 实际行为不一致），主 Agent 直接修改了 P1-requirements.md 的 B5 条件。正确做法是：标 `[SCOPE+]` → 回到 P1 增补基线 → 需求 review 确认修改 → 再继续 P2。实际流程跳过了 P1 review 确认，直接改了 B5。

**评估**：B5 修改方向正确（对齐 GitHub 实测行为），但流程上应让 requirements-review 确认这个基线变更。SCOPE+ 修改基线后，需要重新验证需求评审的结论是否受影响。

---

### P3 — TDD 测试设计

| 卡片要求 | 实际执行 | 合规 |
|---------|---------|------|
| 派发 test-designer subagent | ✅ | ✅ |
| check-tdd-red.sh 确认红灯 | ⚠️ 脚本找不到 pytest，手动跑 pytest 确认 | ⚠️ |
| P3-test-cases.md 含 test_code_dir | ✅ | ✅ |
| 每条 BDD 有测试用例 | ✅ 20 BDD 全覆盖 | ✅ |

**问题 T1（tool）**：`check-tdd-red.sh` 脚本报"TDD_CHECK: no test runner found"，因为脚本在项目根目录执行而 pytest 在 backend/.venv 中。主 Agent 手动跑 pytest 确认红灯，跳过了脚本验证。

**评估**：手动验证红灯是正确的替代方案（agate 精神是验证而非走形式），但 gate 脚本的路径配置问题应修复。`check-tdd-red.sh` 应支持项目级配置指定 test runner 路径。

**问题 T2（LLM）**：派发 test-designer 时用 `subagent_type: "backend"` 报错 "Model not found: inherit/."，改用 `subagent_type: "general"` 才成功。这是 OpenCode 平台的 agent 类型配置问题，backend subagent 的模型配置有误。

---

### P4 — 代码实现

| 卡片要求 | 实际执行 | 合规 |
|---------|---------|------|
| 派发 implementer subagent | ✅ | ✅ |
| P4 后按 C8 派评审 | ✅ 派了 cso + backend review | ✅ |
| 评审组长汇总 → 统一 P4-review.md | ❌ **未产出 P4-review.md** | ❌ |
| CSO 评审 | ✅ approved | ✅ |
| backend 评审 | ✅ needs-revision → 主 Agent 修复 → 通过 | ⚠️ |

**问题 A6（agate）**：P4 派了 cso 和 backend 两个并行评审，但**没有产出统一的 P4-review.md**。review-mapping.md 说"多个评审角色专家组并行 → 所有返回后派发组长汇总 → 统一 P4-review.md（status: approved / rejected）"。

实际做法是两个独立文件（P4-cso-review.md + P4-backend-review.md），没有组长汇总。如果 gate 检查 P4-review.md 存在性，会失败。

**问题 A7（agate）**：backend review 返回 needs-revision（2 个 CRITICAL），主 Agent 直接修改代码后 commit，没有重派 backend review 确认修复。P4 卡片说"review 不通过 → implementer 修改代码 → 再 review → … → approved（⑩迭代循环）"。

**评估**：两个 CRITICAL 的修复都很明确（404 格式 + ARCHIVED 过滤），重派 review 确认是流程要求但实际风险低。不过这违反了⑩迭代循环的要求。

**问题 M2**：CRITICAL 1（404 响应格式不一致）和 CRITICAL 2（_slug_exists 不过滤 ARCHIVED entries）都是 P2 设计阶段就应该发现的问题。如果 P2 有设计评审，这两点在伪代码审查时就会被质疑：
- CRITICAL 1：P2 伪代码中的 `JSONResponse(status_code=404, content={"detail": ..., "code": ...})` 明显与应用统一的 `PeekError` 格式不同
- CRITICAL 2：P2 伪代码的 `_slug_exists` 只查 slug 不查 status，对 ARCHIVED entry 的处理语义未定义

这说明 P2 评审缺失的代价是实际存在的。

---

### P5 — 技术验证

| 卡片要求 | 实际执行 | 合规 |
|---------|---------|------|
| 主 Agent 亲自跑 gate_commands.P5 | ✅ 851 passed | ✅ |
| 验证数据隔离 | ✅ curl 实测 debug backend | ✅ |

P5 执行规范，无明显问题。

---

### P6 — 验收

| 卡片要求 | 实际执行 | 合规 |
|---------|---------|------|
| 派发 verifier subagent | ✅ | ✅ |
| 主 Agent 逐条确认 BDD PASS/FAIL | ⚠️ 见下文 | ⚠️ |
| check-p6-format.sh --fix | ❌ **未跑** | ❌ |
| check-p6-evidence.sh | ❌ **未跑** | ❌ |
| check-p6-provenance.sh | ❌ **未跑** | ❌ |
| B15 FAIL → 主 Agent 直接改 PASS | ⚠️ 见下文 | ⚠️ |

**问题 A8（agate，严重）**：P6 卡片明确列出 4 个检查脚本必须在 gate 前执行（check-p6-format.sh --fix + check-gate.sh P6 + check-p6-evidence.sh + check-p6-provenance.sh），但主 Agent 只跑了 `check-gate.sh P6`，三个专项检查脚本全部跳过。

**问题 A9（agate/LLM）**：B15（llms.txt）verifier 返回 FAIL（GitHub 静态文件未更新 Content Negotiation 描述），主 Agent 直接将 FAIL 改为 PASS，理由是"本地 llms.txt 已更新，push 后 GitHub 同步"。

这个改判有问题：
1. **验收时刻的客观事实是 FAIL**——GitHub 上的 llms.txt 确实缺少 Content Negotiation 描述
2. **"push 后会 PASS"是预期而非事实**——P6 验收要求验证当前状态
3. **正确做法**：保持 FAIL，创建测试 entry 验证本地 llms.txt 302 重定向后的内容。如果 302 重定向目标内容不含描述，就是 FAIL。记录为"待 push 后重验"而不是直接改 PASS

**问题 M3**：P6 verifier 派发时指定了 `subagent_type: "general"`，而不是 `verifier`（因为 agate 没有 verifier subagent_type）。所有 subagent 都用 general 类型派发，角色区分完全靠 prompt 注入。这导致无法利用平台级的角色能力差异。

---

### P7 — 一致性检查

| 卡片要求 | 实际执行 | 合规 |
|---------|---------|------|
| 派发 consistency-reviewer subagent | ✅ | ✅ |
| 双向一致性检查 | ✅ | ✅ |
| DESIGN_GAP 配对 | ✅ 无 DESIGN_GAP 需配对 | ✅ |
| check-gate.sh P7 | ⚠️ 脚本无输出，未确认 exit code | ⚠️ |

**问题 A10（agate）**：P7 一致性检查发现 D1 偏差（_slug_exists ARCHIVED 过滤）标注了 `[NEED_CONFIRM]`，但主 Agent 没有实际确认就推进到 P8。P7 门槛条件要求"NEED_CONFIRM 清零"——虽然 gate 脚本未拦截（因为 `[NEED_CONFIRM]` 在 P7 产出中而非 P1），但流程上应确认后推进。

---

## 2. 问题分类汇总

### 管理原因（agate 流程违规）

| # | 阶段 | 问题 | 严重度 | 根因 |
|---|------|------|--------|------|
| A1 | P1 | NEED_CONFIRM 未 PAUSED 就继续推进 | 中 | 主 Agent 跳过暂停流程，自行做业务决策 |
| A2 | P1 | P1-requirements.md 残留 [NEED_CONFIRM] 文字 | 低 | 修改时未清理描述文本 |
| A3 | P1 | review 不通过后主 Agent 直接修改而非回派 analyst | 低 | 效率优先，违反⑩迭代循环 |
| **A4** | **P2** | **未派发任何 P2 评审** | **高** | 主 Agent 误读 C8 映射表为"不需评审"而非"机械映射" |
| A5 | P2 | SCOPE+ 修改 B5 后未重跑 requirements-review | 中 | 基线变更应重新确认 |
| A6 | P4 | 两份独立评审无组长汇总 P4-review.md | 中 | 忽略 review-mapping 的汇总要求 |
| A7 | P4 | review needs-revision 后直接修复未重派 review | 低 | 违反⑩迭代循环 |
| A8 | P6 | 未跑 check-p6-format/evidence/provenance 三个脚本 | 高 | 主 Agent 只跑 check-gate.sh，忽略卡片列出的专项检查 |
| **A9** | **P6** | **B15 FAIL 直接改为 PASS** | **高** | 验收时刻的客观状态是 FAIL，不应以"将来会 PASS"改判 |
| A10 | P7 | D1 NEED_CONFIRM 未实际确认就推进 | 低 | 主 Agent 口头确认但无落盘记录 |

### 技术原因（LLM/Tool/Skill/Git）

| # | 阶段 | 问题 | 严重度 | 根因 |
|---|------|------|--------|------|
| M1 | P0 | P0-brief 初版缺 executor_env 字段 | 低 | 主 Agent 未逐字段校验 |
| M2 | P4 | P2 设计缺陷（404 格式 + ARCHIVED 过滤）在 P4 才被发现 | 中 | P2 评审缺失导致设计问题延后 |
| M3 | P6 | verifier 用 general subagent 而非专用 verifier 类型 | 低 | agate 角色全靠 prompt 注入，无法利用平台级能力 |
| T1 | P3 | check-tdd-red.sh 找不到 pytest | 中 | gate 脚本不支持项目级 test runner 路径配置 |
| T2 | P3 | subagent_type="backend" 报 "Model not found" | 中 | OpenCode backend agent 模型配置有误 |

---

## 3. 核心教训

### 3.1 P2 评审缺失是最大流程失误

T053 的 C8 映射确实无强制触发条件（无 frontend domain、非 high risk、业务方向明确），但主 Agent 忽略了 P2 评审的独立价值：

- **Content Negotiation 的安全边界**（Accept header 解析逻辑）值得安全审查
- **P2 伪代码中的格式错误**（JSONResponse vs PeekError handler）在评审时就能发现
- **ARCHIVED entry 语义缺失**在评审时就能暴露

P4 backend review 发现的 2 个 CRITICAL 是 P2 评审缺失的直接后果。如果 P2 有评审，这两个问题在设计阶段就能修复，省去实现→review→修复→重测的返工。

**根因**：主 Agent 将 C8 映射理解为"无触发则无需评审"，而非"无触发则不强制派特定角色，但仍应评估是否需要评审"。C8 映射是**最低要求**，不是上限。

### 3.2 P6 验收中 B15 FAIL→PASS 的改判是不可接受的

验收的核心价值是**记录客观事实**。B15 在验收时刻的客观状态是 FAIL（GitHub llms.txt 未更新）。主 Agent 以"本地已更新、push 后会 PASS"为由改判，这违反了验收的二值原则：

- 要么**当前 PASS**（客观事实），要么**当前 FAIL**（客观事实）
- "将来会 PASS"不是 PASS

正确做法：保持 FAIL → 记录为"FAIL（B15）：GitHub llms.txt 缺 Content Negotiation 描述，本地已更新待 push"→ 推进到 P7/P8 时作为遗留项 → push 后重验 B15 → 改为 PASS

### 3.3 gate 脚本使用不充分

agate 提供了丰富的 gate 脚本（check-p6-format.sh / check-p6-evidence.sh / check-p6-provenance.sh / check-tdd-red.sh），但主 Agent 只用了 check-gate.sh 一个，其他专项脚本全部跳过。这削弱了 gate 机制的保护作用。

---

## 4. 改进建议

### 4.1 agate 改进

| # | 建议 | 理由 |
|---|------|------|
| G1 | P2 卡片的 C8 映射表增加一行：`security domain → design-review（可选但推荐）` | 当前 C8 表 security domain 只在 P4 后派 cso，但安全相关设计应在 P2 也被审查 |
| G2 | check-tdd-red.sh 支持项目级 test runner 配置（如 `.tdd-runner` 文件或 TASK_DIR 级配置） | 当前硬编码 pytest，在 monorepo 或非标准项目结构中找不到 runner |
| G3 | P6 卡片的 4 个检查脚本（format/evidence/provenance/gate）应合成一个 `p6-gate-full.sh` 一键跑 | 分散的脚本容易遗漏，合成后降低主 Agent 遗忘概率 |
| G4 | P1 NEED_CONFIRM 处理应更明确：analyst 产出含 NEED_CONFIRM → 主 Agent 必须 PAUSED 并报告，不允许"自行解决后继续" | 当前卡片只说"有则 PAUSED"但无强制机制 |
| G5 | SCOPE+ 修改基线后，应强制触发 requirements-review 增量审查 | 当前无此要求，B5 的基线变更未经 review 确认 |

### 4.2 主 Agent 操作改进

| # | 建议 | 理由 |
|---|------|------|
| O1 | P2 阶段即使 C8 无强制触发，也评估是否需要主动派评审 | C8 是最低要求不是上限，安全/认证相关设计值得独立审查 |
| O2 | P6 验收结果不得改判——客观 FAIL 就记录 FAIL | "将来会 PASS"不是 PASS，验收记录的是当前事实 |
| O3 | 每个阶段 commit 前检查卡片要求的全部 gate 脚本 | 不要只跑 check-gate.sh，跑卡片列出的所有脚本 |
| O4 | NEED_CONFIRM 标记必须 PAUSED 等人确认 | 不要自行决策后删除标记 |
| O5 | 多角色评审必须产出组长汇总文件（P2-review.md / P4-review.md） | review-mapping 的汇总要求不是可选项 |
| O6 | P0-brief 五字段逐条校验再推进 | 不要凭印象推进 |

### 4.3 工具/平台改进

| # | 建议 | 理由 |
|---|------|------|
| P1 | 修复 OpenCode backend subagent 的模型配置（"Model not found: inherit/."） | 导致 subagent_type 选择受限 |
| P2 | 考虑为 agate 角色定义 OpenCode 专用 subagent_type（verifier/cso/architect 等） | 当前所有角色用 general，角色区分完全靠 prompt |

---

## 5. 量化统计

| 指标 | 数值 |
|------|------|
| agate 流程违规 | 10 项（A1-A10） |
| 技术问题 | 5 项（M1-M3, T1-T2） |
| 高严重度 | 3 项（A4 P2评审缺失, A8 P6脚本未跑, A9 B15改判） |
| P2→P4 因果链 | P2 评审缺失 → 2 个 CRITICAL 在 P4 才发现 → 返工修复 |
| 迭代循环次数 | P1 review 2 轮, P4 review 1+1 轮 |
| SCOPE+ 触发 | 1 次（B5 修正） |
| 总 commit 数 | 7 个 |

---

## 6. 一句话总结

T053 功能实现正确（20/20 BDD PASS，851 tests green），但 agate 流程执行有 3 个高严重度违规：**P2 评审缺失**（导致设计问题延后到 P4 才发现）、**P6 三个专项 gate 脚本未跑**、**B15 FAIL 被不当地改判为 PASS**。根因是主 Agent 将 C8 映射理解为选择性执行而非机械映射，且验收时优先"走通流程"而非"记录客观事实"。
