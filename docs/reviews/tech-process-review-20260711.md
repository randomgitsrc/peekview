# 技术与流程执行评估（T048–T052 实证）

- **分析基础**: T048–T052 共 5 个任务、85 commits、约 3.5 天连续执行的实证
- **分析维度**: LLM 执行特征 / OpenCode 平台 / Skill & Agent 系统 / Agate 流程管理
- **目的**: 暴露技术因素导致的执行偏差，区分"流程设计问题"和"执行走样"

---

## 目录

1. [LLM 执行特征](#1-llm-执行特征)
2. [OpenCode 平台限制](#2-opencode-平台限制)
3. [Skill & Agent 系统](#3-skill--agent-系统)
4. [Agate 流程管理](#4-agate-流程管理)
5. [根因分层](#5-根因分层)
6. [改进建议](#6-改进建议)

---

## 1. LLM 执行特征

### 1.1 Tool 执行可靠性

| 现象 | 频率 | 典型场景 |
|------|------|---------|
| Edit 工具 "aborted"（oldString 不匹配或多处匹配） | T052 中 4+ 次 | `ref="metaTagsSentinel"` 在多处出现 |
| Bash 工具 heredoc 卡死 | T052 中 3+ 次 | `cat > file << 'SCRIPT'` 含 50+ 行代码 |
| Bash timeout 未设，命令挂满 120s 默认值 | 多次 | `curl health` 后端未启动，挂 30s |
| Task 工具派发后 subagent 返回与预期不符 | T052 P6 verifier | 格式与 gate 期望不同 |

**根因分析**：

a) **Edit 工具的设计假设是"精确字符串匹配"**，但实际执行中：
   - 文件经多次编辑后行号偏移，oldString 不再精确
   - 用户提到的"aborted"可能是 Edit 工具内部匹配失败后的超时，而非工具本身崩溃
   - 多文件中的相同字符串（如 `ref="metaTagsSentinel"` 出现在模板和脚本中）导致匹配歧义

b) **Bash heredoc 问题**：
   - 长 heredoc（>30 行）通过工具 API 传输时可能被 shell 缓冲阻塞
   - TS 脚本中的模板字符串 `${}` 与 bash 变量展开冲突
   - Write 工具 + 短 bash 执行的组合从未出问题

c) **超时意识缺乏**：
   - 模型不会主动为命令设 timeout，依赖工具默认值
   - 长命令（`make debug`、`vitest run`）需要 300s，默认 120s 经常不够

### 1.2 LLM 认知模式问题

| 模式 | 表现 | 次数 |
|------|------|------|
| **格式先于功能** | 先调 gate 格式再修功能 bug（T052 P6 调了 4 轮格式才去修 B11） | ≥3 |
| **重复失败策略** | Edit 失败后不换方法，用同样的 edit 再试 3-4 次 | T052 中 2 次 |
| **过度工程** | 修 B11 先尝试 IntersectionObserver sentinel 位置调整（3 轮）才换 scroll listener | T052 B11 |
| **"看起来对"偏差** | 认为 CSS 规则会生效但不验证，结果 scoped style 规则被遗漏 | T052 多次 |
| **越俎代庖** | 主 Agent 写 subagent 产出（P5 脚本、P6 报告），违反 agate 规范 | T052 |

**观察**：这些不是 LLM 能力问题，而是** prompt 和工具使用策略问题**。模型倾向于"继续当前方向微调"而不是"退一步重新思考"。

### 1.3 Vision / 多模态能力

| 能力 | 评价 |
|------|------|
| vision-helper 截图分析 | 准确，blocker_count=0 判断可靠 |
| vision-analyzer CLI | 产生 YAML 格式不匹配 gate 期望 |
| 主 Agent 看图 | 不支持，但系统 prompt 已禁止 |

**建议**：vision-analyzer CLI 的产出格式需要与 provenance 审计的期望对齐（`summary.blocker_count` vs `vision_analysis.summary.blocker_count`）。

---

## 2. OpenCode 平台限制

### 2.1 会话管理

| 限制 | 影响 |
|------|------|
| 会话中断后上下文压缩（context window 管理） | T052 跨天执行后，模型丢失了部分早期 P0-P3 上下文 |
| 无内置对话导出/摘要 | 复盘时需要从 git log + SQLite 反推时间线 |
| 子 Agent 结果不自动汇入主会话 | verifier 的 P6 报告需要手动写回 P6-acceptance.md |

### 2.2 工具生态

| 工具 | 限制 | 替代方案 |
|------|------|---------|
| Edit | 精确字符串匹配，不支持模糊/正则替换 | sed（bash）或格式化写入 |
| Bash heredoc | 长脚本阻塞 | Write 文件 + 短 bash 执行 |
| Task (subagent) | 结果格式不可控 | 在 prompt 中固定输出模板 |
| Skill | 加载后内容注入对话，skill 更新需重新加载 | 每次会话开始时手动加载 |

### 2.3 成本与延迟

T048–T052 总计约 154 sessions、6612 messages，大量是 subagent 派发。subagent 每次派发都有独立的 context window，成本叠加。T049（11h 执行、25+ 子 Agent 派发）是成本最高的单任务。

---

## 3. Skill & Agent 系统

### 3.1 现有技能覆盖

| Skill | T048–T052 使用 | 评价 |
|-------|---------------|------|
| playwright-cdp | ✅ T052 P5/P6 验证 | 核心，不可或缺 |
| vision-analyzer | ✅ T052 截图分析 | 工作，但 YAML 格式需对齐 |
| brainstorming | ❌ 未使用 | 可能适用于 T049 清洗规则设计 |
| test-driven-development | ❌ 未使用 | P3 自动 TDD，但 skill 未加载 |
| systematic-debugging | ❌ 未使用 | 应加载用于 T049 归零分析 |

**问题**：agate 流程中的**执行角色**（analyst、architect、verifier 等）是以 markdown 文件定义的（`~/.agate/assets/execution-roles/`），而不是 OpenCode Skill。这意味着：
- 角色指令通过 Task prompt 手动注入，不受版本管理
- 没有 skill 那样的模板机制
- 角色版本与 agate 版本绑定，不能独立更新

### 3.2 执行角色与 Skill 的重叠

| agate 执行角色 | 对应 Skill | 关系 |
|---------------|-----------|------|
| verifier (P6) | 无 | 角色文件 + prompt 手动注入 |
| vision-analyst | vision-analyzer | 冗余：vision-analyzer skill 已经包含分析能力 |
| test-designer (P3) | test-driven-development | 重叠：TDD skill 提供了详细的测试设计流程 |

### 3.3 子 Agent 模型差异

T048–T052 中所有 subagent 都使用同一个模型（deepseek-v4-flash），没有区分：
- analyst（需要结构化思维）
- architect（需要系统设计）
- verifier（需要细心验证）
- frontend（需要 Vue/TS 技能）

**问题**：不同角色用同一个模型意味着没有专业化。T049 的清洗规则设计如果用一个更熟悉 PlantUML 生态的模型，可能 T049 不会遗漏那些常见的错误模式。

---

## 4. Agate 流程管理

### 4.1 流程强度与执行速度的权衡

```
        严格度 ←──────────→ 速度
T048 ─── 高严格（3轮评审）    慢（3h 完成）
T049 ─── 中严格               慢（11h，含后期归零）
T050 ─── 低严格（归零模式）   快（3.5h）
T051 ─── 高严格               中（7.5h）
T052 ─── 中严格（部分违规）   快（6h）
```

**观察**：严格度与速度存在明显权衡。T050（归零模式）因为目标明确、无新设计，是最快的。

### 4.2 Gate 系统的有效性与成本

| Gate | 拦截的真问题 | 拦截的假问题（格式噪音） | 信噪比 |
|------|------------|----------------------|--------|
| P1 BDD 完整 | 2/5 任务有效 | 0 | 高 |
| P2 多候选方案 | 2/5 任务有效 | 1/5 过度设计 | 中 |
| P6 验收（BDD 对照） | 4/5 任务有效 | 0 | 高 |
| P6 provenance 审计 | 0 | 5/5 任务都被格式拦截 | **零** |
| P7 DESIGN_GAP 配对 | T049 有效 | T052 无 gap 也被拦截 | 中 |
| pre-commit PROD_TOUCHED | 未触发 | 0 | 未测试 |

**关键发现**：provenance 审计（证据格式/数量/vision YAML 格式）在 T048–T052 中未拦截任何功能缺陷，但每次都增加了 15-30 分钟的格式调整时间。

### 4.3 状态管理的一致性

| 机制 | 问题 |
|------|------|
| `.state.yaml` phase vs 实际产出 | P4 产出已 commit 但 phase=P3 → gate warning 正确捕获 |
| active-tasks.md 手动更新 | 有时忘记更新 phase（如 T052 从 P6→P7→P8 连续推进时） |
| retries 计数 | T048–T052 都没有触发 retry 上限（MAX=2），说明 retry 机制未被充分测试 |

### 4.4 P6 验收环境的不足

| 环境差异 | 导致的问题 |
|---------|-----------|
| debug backend 无认证 | T052 B07/B16 的 owner 场景无法测试（→ NEED_CONFIRM） |
| debug backend 无真实数据 | T049 C（移动端 tag 宽度）需要实际 tag 数据才能暴露 |
| debug backend 不用登录态 | T049 A/B 的 config 行为在无认证模式下与生产不同 |
| static 文件 vs dev server | T052 中 built CSS 与源代码不一致（scoped style 问题） |

### 4.5 发布流程的缺口

v0.6.1 发布后立即发现 2 个问题：
1. light mode header bg 硬编码
2. desktop TOC/file tree 不默认打开

这两个问题根源：
- P6 验收只在 dark mode 进行（默认主题）
- P6 验收时没有检查桌面端的 TOC/file tree 初始状态
- P8-release.md 的 READY checklist 缺少"双主题验证"和"桌面端面板初始状态"检查项

---

## 5. 根因分层

将问题按责任层分类：

### 5.1 LLM 层（模型固有特征）

| 问题 | 根本原因 | 可缓解？ |
|------|---------|---------|
| Tool 执行不可靠（Edit/Bash 卡死）| 模型-工具协议层的稳定性问题 | ✅ 换执行策略 |
| 过度工程倾向 | LLM 的"继续优化"本能 | ✅ 明确约束 prompt |
| 格式先于功能 | 模型将 gate 输出视为目标 | ✅ gate 降级为 warning |
| 长命令超时 | 模型不自动设 timeout | ✅ 系统 prompt 约束 |

### 5.2 OpenCode 平台层

| 问题 | 根本原因 | 可缓解？ |
|------|---------|---------|
| Edit 精确匹配 | 工具设计限制 | ✅ sed 替代 / Write 重写 |
| Bash heredoc 阻塞 | 工具 API 传输限制 | ✅ Write + 短 bash |
| 子 Agent 输出格式不可控 | 无输出 schema | ✅ prompt 模板固定 |
| 会话中断上下文丢失 | context window 管理 | ❌ 平台特性，不可控 |

### 5.3 Skill & Agent 系统层

| 问题 | 根本原因 | 可缓解？ |
|------|---------|---------|
| 执行角色非 Skill | 设计选择 | ✅ 将关键角色转为 Skill |
| 角色指令手动注入 | 无自动化注入机制 | ✅ prompt 模板系统 |
| 不同角色用同模型 | 无模型路由 | ❌ 需多模型支持 |
| vision YAML 格式不匹配 | 两个系统独立开发 | ✅ 对齐产出格式 |

### 5.4 Agate 流程管理层

| 问题 | 根本原因 | 可缓解？ |
|------|---------|---------|
| provenance 审计零信噪比 | 设计过于严格 | ✅ 降级为 WARNING |
| P6 验收环境与生产环境 gap | 测试数据不足 | ✅ 增加登录态测试要求 |
| 发布前无视觉回归检查 | 流程空白 | ✅ 增加 screenshot checklist |
| task 拆解颗粒度无指导 | 无拆分标准 | ✅ 制定 task 拆分指南 |

---

## 6. 改进建议

### 6.1 立即执行（影响大、成本低）

| 建议 | 针对问题 | 具体做法 |
|------|---------|---------|
| **编辑用 sed 替代 Edit 工具** | Edit 频繁 aborted | `sed -i 's/old/new/' file` 或 Write 重写整段 |
| **长脚本用 Write 创建 + 短 bash 执行** | Bash heredoc 阻塞 | 拆分：先 Write 写文件，再 bash 设 timeout 运行 |
| **所有 bash 命令设显式 timeout** | 默认 120s 不够 | 系统 prompt 或每次手动加 `timeout: 300000` |
| **P6 provenance 审计降级为 WARNING** | 零信噪比，浪费时间 | `exit 2` 不阻塞 commit，只输出 warning |
| **主 Agent 禁止代写 subagent 产出** | agate 规范违反 | 在 system prompt 加 `BLOCK_LIST = [写代码, 写验收报告, 写测试]` |

### 6.2 短期改进（1-2 周内）

| 建议 | 针对问题 | 具体做法 |
|------|---------|---------|
| **vision YAML 产出格式与 gate 对齐** | `blocker_count` 在错误路径下 | 统一为 `sumary.blocker_count`，两边对齐 |
| **P6 verifier 产出增加固定模板** | 格式偏差 | 在 verifier role 中嵌入标准 YAML frontmatter 和 PASS 行格式 |
| **P6 验收环境增加登录态测试** | owner 场景无法验证 | debug backend 支持 API key 认证测试 |
| **发布前增加 CDP 双主题截图检查项** | light mode 问题漏出 | P8-release.md 的 READY checklist 加 "screenshots/light-desktop.png + light-mobile.png" |
| **为关键执行角色创建 Skill** | 角色指令手动注入 | 先做 verifier skill（P6 最常出问题） |

### 6.3 中期架构（1-3 个月）

| 建议 | 预期收益 |
|------|---------|
| **agate + OpenCode Skill 统一**：执行角色以 Skill 形式分发，版本管理 | 角色指令不再硬编码在 prompt 中 |
| **多模型路由**：不同 subagent 类型用不同模型（如 vision-helper 用多模态、verifier 用高精度、frontend 用代码专用） | 各角色能力专门化 |
| **P6 验收语义化**：不再用 grep 匹配 `- PASS` 行，改为结构化数据（JSON schema 验证） | 格式问题归零 |
| **自动复盘**：基于 git log + session 记录自动生成时间线和执行摘要 | 复盘工作减 80% |

### 6.4 长期原则

1. **Gate 检查功能不查格式**：格式用 CI lint（prettier、eslint），gate 只检查功能完整性。
2. **主 Agent 是调度员不是工人**：写 P0-brief，派 subagent，验 gate，更新状态——"不做第五件"。
3. **发布后 30 分钟观察期**：版本发布后等 30 分钟确认无用户报告问题，再继续下个任务。
4. **任务按"功能域"拆分**：一个任务不超过一个功能域（前端/后端/配置/文档/测试可并行但不应在同一任务内）。

---

*本评估基于 T048–T052 的 85 次 commit、154 个 opencode session、6612 条消息和所有阶段产物的实证分析。*
*报告日期：2026-07-11*
