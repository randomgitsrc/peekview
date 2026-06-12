# T003 修复方案评审

> 评审日期：2026-06-12
> 评审对象：`docs/plans/T003-fix-workflow-v3-plan.md`（580 行，16 项修复 / 4 批 / 11 个文件）
> 评审团：技术评审 + 标准化评审
> 前置评审：`expert-review-workflow-v3-postmortem-T002-2026-06-12.md`（复盘评审，9.2/10，3 项调整建议）

---

## 评审结论

这是一个「对照复盘逐项落文件」的精确方案——16 项改进全部映射到 11 个具体文件的修改位置，批策略合理，前序复盘评审的 3 项调整建议已全部采纳。**3 个中危发现**：P4→P5 gate 的 `git diff` 在 commit 后不可用、P3→P4 的 assertion-failure 检测缺少解析方案、P6→P7 仍依赖 subagent 产出的文本未能实现 A1 原则。**1 个建议项**：P7 gate 固定 `make pre-publish` 对纯后端任务过重。其余均正确。修完 3 个中危项即可进入 P3（TDD 测试设计）。

---

## 前序调整采纳

| 复盘评审建议 | 方案处理 | 位置 |
|-------------|----------|------|
| B4 降为 🟡，仅保留硬超时 | ✅ 采纳 | §B4 修正方案，存活检查标为「已知限制」 |
| D11 路径占位符化 | ✅ 采纳 | §D11 `{test_code_dir}` / `{implementation_dir}` 占位符 |
| F14 lessons.md 按类别组织 | ✅ 采纳 | §F14 「按类别（安全/架构/流程/测试）组织」 |

---

## 一、技术评审

### 发现 1（🟡 中危）：P4→P5 gate 的 `git diff` 在 v3 流程中不可用

**位置**：§A1 gate 表 P4→P5 行

**现象**：
```
P4→P5 | 主 Agent 读目录列出文件 + `git diff` 确认有代码改动
```

**机理分析**：v3 的 `git-integration.md` 规定「每阶段门槛通过后 commit」。P4 的代码实现会在 P4 完成时 commit。当 P5 阶段主 Agent 执行 `git diff` 时，P4 的改动已提交，工作区干净，`git diff` 无输出。gate 永远失败。

**整改建议**：替代判定方案：

```
P4→P5 | P4-implementation/ 下文件非空 AND git log --oneline -1
       包含当前任务的 P4 commit（即 P4 subagent 确实产出了代码提交）
```

或用 `git diff HEAD~1` 确认最近一个 commit 包含代码文件变更。

**验证方式**：
- [ ] 模拟 P4 完成 commit 后执行判定命令，确认能检测到代码改动

---

### 发现 2（🟡 中危）：P3→P4 的「assertion failure vs collection error」检测缺少解析方案

**位置**：§A1 gate 表 P3→P4 行

**现象**：
```
P3→P4 | 主 Agent 跑 `pytest --collect-only -q` 收集成功 + 失败均为 assertion failure
```

「失败均为 assertion failure」的判断依赖对 pytest 输出的解析。pytest 用 `FAILED` 标记 assertion failure，用 `ERROR` 标记 collection/import error，但输出格式因 pytest 版本而异，LLM 解析不可靠。

**机理分析**：T002 复盘的核心教训是「不可信 subagent 写的文件」，应改为「不可信 LLM 做的文本解析」——LLM 解析 pytest 输出同样可能出错，只是错误类型从「subagent 写假数据」变成了「主 Agent 解析错误」。

**整改建议**：
1. 提供 shell wrapper（`scripts/check-tdd-red.sh`）输出机器可解析的「assertion_failures=N, collection_errors=M」
2. P3→P4 gate 判定为：`scripts/check-tdd-red.sh exit 0 AND assertion_failures > 0 AND collection_errors == 0`

这比「让 LLM 自己解析 pytest 输出」可靠得多。

**验证方式**：
- [ ] `scripts/check-tdd-red.sh` 在 assertion-only 失败场景返回 exit 0
- [ ] `scripts/check-tdd-red.sh` 在有 collection error 场景返回非 0

---

### 发现 3（🟡 中危）：P6→P7 gate 未遵循 A1 原则（仍信 subagent 产出）

**位置**：§A1 gate 表 P6→P7 行

**现象**：
```
P6→P7 | 主 Agent grep 确认无 `[BLOCKER]` 标记
```

这是唯一一个未改为「跑命令验证」的 gate。`grep` 是命令但验证对象仍是 subagent 产出的 `P6-consistency.md`——本质仍是信 subagent 写的文本。

**机理分析**：这与其他 gate 有本质区别——P3/P4/P5/P7 的 gate 都可以通过客观命令验证（pytest 跑不跑得过、git diff 有没有改动、make pre-publish 过不过）。但 P6 consistency 是定性分析，无法自动化。如果 subagent 写「5/5 一致，无 BLOCKER」但实际有遗漏，主 Agent 无法发现。

**影响**：这是 A1 原则的已知边界，不影响方案整体有效性，但需要记录为限制。T002 的复盘本身证明了 P6 是可靠阶段（5/5 检查准确），但系统不应假设永远可靠。

**整改建议**：在 §A1 gate 表 P6→P7 行加注：

```
P6→P7 | 主 Agent grep 确认无 `[BLOCKER]` 标记 |
       （已知限制：P6 为定性分析，不可全自动验证。
        主 Agent 可抽查 1-2 条一致性声明 vs 实际代码确认。
        完整性最终由 P5 回归测试兜底。）
```

---

### 发现 4（🟢 低危）：P7 gate 固定 `make pre-publish` 对纯后端任务过重

**位置**：§A1 gate 表 P7→READY 行

**现象**：
```
P7→READY | 主 Agent 跑 `make pre-publish` exit 0
```

`make pre-publish` 包含 `npm ci && npm run build`（前端构建），约为 1-2 分钟。纯后端任务（如 T002，只改了 `database.py` / `exceptions.py` / `cli.py`）不需要前端构建。

**分析**：方案已在 §A1 实现要点中写了「命令定义在 `{project_conventions_file}` 中」，允许项目自定义命令清单。但 gate 表中硬编码了 `make pre-publish`。只需保持一致。

**建议**：gate 表改为：
```
P7→READY | 主 Agent 跑项目配置的发布检查命令
         | 默认 `make pre-publish`（含前端构建）
         | 纯后端任务可配置为 `make test && make lint`（跳过构建）
```

---

## 二、标准化评审

### 通过项

| 检查项 | 结论 |
|--------|------|
| 16 项改进全部映射到具体文件（修改文件清单 §三，11 个文件） | ✅ 通过 |
| 4 批策略按依赖排序（gate → 安全评审 → 状态上下文 → UX） | ✅ 通过 |
| 每批有独立验证方案 | ✅ 通过 |
| 风险与回退方案完整（§六） | ✅ 通过 |
| 验收标准可测试（§七，含文档/行为/评审三层） | ✅ 通过 |
| 不变项 5 条声明（§1.3） | ✅ 通过 |
| 时间估算有分批复核（§八） | ✅ 通过 |
| 占位符约束（§D9/D11）防止项目特定路径硬编码到 v3 规范 | ✅ 通过 |

### 小问题

**发现 5（🟢 低危）**：`.state.yaml` 的 commit 时机未定义

**位置**：§E12

**现象**：方案说每任务独立 `.state.yaml`，主 Agent 每阶段更新。但 v3 的 git 集成按阶段 commit。如果 P4 完成后 commit 包含了 stage output 但 `.state.yaml` 还是 P3 状态，文件与实际不符。

**建议**：明确 `.state.yaml` 更新时机与 gate commit 同步——一次 commit 包含：stage output file + `.state.yaml` 更新。

---

## 三、方案完整性

对照复盘 16 项 + 前序 3 项调整建议：

| 类别 | 项目数 | 状态 |
|------|--------|------|
| A gate | 3 | A1/A2/A3 设计正确，含 gate 表、独立验证、P7 重定义 |
| B 安全 | 2 | B4 修正方案，B5 升级+P1 把关 |
| C 评审 | 3 | 并行评审+组长、P1 评审、P6 双向 |
| D 上下文 | 3 | 固定段、答疑闭环、占位符 |
| E 状态 | 1 | .state.yaml + active-tasks.md 降级 |
| F UX | 4 | 进度、lessons、依赖、小结 |
| 前序调整 | 3 | B4/D11/F14 全部采纳 |

**总计 16+3 = 19 项，全部覆盖。**

---

## 评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 方案完整性 | 10/10 | 16 项全映射，3 项调整全采纳 |
| 技术正确性 | 7/10 | 3 个 gate 设计有可修正的缺陷（P4/P3/P6） |
| 实现可行性 | 8/10 | 修改位置明确（11 个文件），P3 gate 需补充 helper script |
| 分批策略 | 9/10 | 按依赖分层，每批可独立验证 |
| 标准化 | 9/10 | 占位符化好，.state.yaml commit 时机未定义 |
| 整体 | **8.6/10** | |

---

## 待办

### 阻塞项
- [ ] **发现 1**：P4→P5 gate `git diff` 改为 `git log --oneline -1` 确认 P4 commit
- [ ] **发现 2**：P3→P4 gate 增加 `scripts/check-tdd-red.sh` 替代 LLM 解析 pytest 输出
- [ ] **发现 3**：P6→P7 gate 标注已知限制（P6 定性不可全自动验证）

### 建议项
- [ ] **发现 4**：P7 gate 表改为「项目配置的发布检查命令」可配置，不硬编码 `make pre-publish`
- [ ] **发现 5**：`.state.yaml` 的 commit 时机与 gate commit 同步写入方案
