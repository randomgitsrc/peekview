---
review_date: 2026-08-31
reviewer: protocol-alignment-review
change_summary: repo 级 repomap 机制——.gitignore 忽略 REPOMAP.md、新增 .repomapignore 排除 agate-workspace/、AGENTS.md 新增「代码地图（REPOMAP.md）」指针小节
files_changed: [".gitignore", ".repomapignore", "AGENTS.md"]
---

# 协议-脚本对齐审查

> 触发：commit `0f44462a`（已 push main）包含仓库根 `AGENTS.md` 改动，命中 commit-msg self-gate 触发文件列表。
> 性质：文档/配置级改动（repo 层），**不涉及 agate 协议脚本本身**（`agate/scripts/*.sh|*.py`、`~/.agate` 协议文档均未改动）。

## 审查结论汇总

| # | 审查项 | 结论 |
|---|--------|------|
| A1 | 文档→脚本对齐 | ALIGNED |
| A2 | 脚本→文档对齐 | ALIGNED |
| A3 | 一致性连锁 + 反向传播 | MISALIGNED |
| A4 | 测试覆盖 | ALIGNED |
| A5 | 下游影响 + 文档传播 | MISALIGNED |
| A6 | 锚点表覆盖 | ALIGNED |
| A7 | 设计原则一致性 | ALIGNED |

## 逐项审查

### A1: 文档→脚本对齐

**文档声明**（AGENTS.md:90-94，本次新增小节）：

> `REPOMAP.md` 是 repomap-lite skill（零依赖正则版）生成的符号索引（顶层函数/类/嵌套），**不提交**（已加入 .gitignore），需要时现场生成，不要手动维护
> 排除范围由 `.repomapignore` 控制（**已提交**，当前排除 `agate-workspace/`）；调整后需重跑全量生成
> 用法：加载 `repomap-lite` skill，按 SKILL.md 执行（`python3 .../repomap_lite.py -o REPOMAP.md`，单文件增量用 `--update-file`）

**脚本/配置实现**（本 commit 三处改动 + 磁盘实证）：

- `.gitignore:89-90`：新增 `# Repo map (regenerable via repomap-lite, not committed)` + `REPOMAP.md`。实测 `git check-ignore -v REPOMAP.md` → `.gitignore:90:REPOMAP.md`，规则生效；REPOMAP.md 在磁盘存在（319KB，8/31 14:13 生成）但未被 git 追踪（`git ls-files` 无）→ 与「不提交」语义一致。
- `.repomapignore:1`：内容 `agate-workspace/`，已被 git 追踪（`git ls-files .repomapignore` 命中）→ 与「**已提交**」语义一致；REPOMAP.md 内 `grep -c "agate-workspace"` → 0，排除范围实际生效。
- 用法命令与 repomap-lite skill（`~/.dsh/skills/repomap-lite`）SKILL.md 记载一致：全量 `python3 scripts/repomap_lite.py -o REPOMAP.md`、增量 `--update-file`（skill「维护建议」节）→ 与「按 SKILL.md 执行」语义一致。

**结论**：ALIGNED
**差异**：无
**建议**：无

### A2: 脚本→文档对齐

**说明**：本次 commit 未改动任何 agate 协议脚本或 repomap-lite 工具本身（仅 repo 层配置 + 指针式文档），无「脚本逻辑变更 → 文档需同步」的对应关系。AGENTS.md 新小节描述的是既有 skill 的既有用法，属于**文档侧新增指针**，不构成对脚本的语义改写。

**结论**：ALIGNED
**差异**：无
**建议**：无

### A3: 一致性连锁 + 反向传播

**A3a（连锁：已知衍生改动）**：.gitignore/.repomapignore/AGENTS.md 三者互相印证（忽略规则 + 排除文件 + 指针文档），无缺环。`.gitignore` 中 REPOMAP.md 置于 `# Debug / Temp` 区段、`!agate-workspace/tasks/**/P6-evidence/logs/*` 例外之前，模式互不冲突（REPOMAP.md 为精确文件名匹配，与 agate-workspace 例外无交集）。

**A3b（反向传播：应被影响但未列入 diff 的文件）**：

| 候选文件 | 是否应受影响 | 实测 | 判断 |
|---|---|---|---|
| `CHANGELOG.md` | **是** | `[Unreleased]` 已有「仓库整理（内部，无用户可见行为变化）」类别并记录了上一笔同类 chore(repo) `b590096b`（解除误跟踪产物/归档文档/磁盘清理）；本 commit `0f44462a` 同为 `chore(repo)`（内部、无用户可见行为），但 **CHANGELOG 无任何记录**（`grep -i repomap CHANGELOG.md` → no match） | **缺口** |
| `INDEX.md` | 否 | REPOMAP.md 是临时产物不提交，INDEX.md 只链接已提交权威文档 | 无需更新 |
| `llms.txt` | 否 | 同上，llms.txt 面向外部读者链接仓库内文档，REPOMAP.md 不在仓库中 | 无需更新 |

**结论**：MISALIGNED（反向传播缺口：CHANGELOG.md 未补记）
**差异**：`0f44462a` 与 `b590096b` 同属「仓库整理（内部，无用户可见行为变化）」，仓库既有惯例是此类改动记入 `[Unreleased]` 对应类别（铁律 8「CHANGELOG 及时记录」+ b590096b 先例），本 commit 未执行该惯例。
**建议**：主 Agent 补一笔 CHANGELOG 记录到 `[Unreleased]` 的「仓库整理（内部，无用户可见行为变化）」类别下，如：*「新增 repomap 代码地图机制：.gitignore 忽略 REPOMAP.md、新增 .repomapignore（排除 agate-workspace/）、AGENTS.md 记录 repomap 约定」*，随下次提交一并落地。

### A4: 测试覆盖

**说明**：本次为纯文档/配置改动，无行为逻辑变更，**无 pytest 可覆盖的代码路径**（不适用 pytest 全量实跑；按审查任务约定，文档改动以 lint 验证文档/代码格式问题）。

**实跑输出**（`make lint`）：

```
→ Running ruff check...
cd backend && ruff check peekview/ tests/
/bin/bash: 行 1: ruff: 未找到命令
make: *** [Makefile:187：lint] 错误 127
```

注：`make lint` 失败为**环境问题**——ruff 不在当前 PATH（AGENTS.md 已注明「ruff 不在 venv，用系统 python3」），非本 commit 引入。改用系统 ruff 实跑：

```
$ /home/kity/.local/bin/ruff check peekview/ tests/
All checks passed!
EXIT=0   (ruff 0.15.18)
```

**结论**：ALIGNED
**差异**：无（`make lint` 环境报错与本次改动无关，ruff 实际全绿）
**建议**：无

### A5: 下游影响 + 文档传播

**下游影响**：本 commit 为 repo 层声明性改动，不触碰 agate gate 行为、不引入破坏性变更、无用户可见行为变化。`.repomapignore` 只影响 repomap-lite 生成范围；`.gitignore` 忽略 REPOMAP.md 不影响任何既有文件追踪（REPOMAP.md 本就不在 git 中）。

**文档传播**：应同步的文档为 `CHANGELOG.md`——按 A3b 分析，同类 chore(repo) 有记入惯例，本次漏记（见 A3）。

**结论**：MISALIGNED（CHANGELOG 未标注本次仓库整理改动）
**差异**：同 A3b 缺口。
**建议**：同 A3b——补记 `[Unreleased]`「仓库整理（内部，无用户可见行为变化）」条目。

### A6: 锚点表覆盖

**说明**：CHECK 9 锚点表（`check-protocol-consistency.py`）覆盖的是 **agate 协议文档**（`agate/scripts/*.md` 等）的规则→锚点映射。本次改动在 peekview repo 层（AGENTS.md/.gitignore/.repomapignore），不在 agate 协议域内，未新增任何协议级规则，锚点表无更新需求。

**结论**：ALIGNED
**差异**：无
**建议**：无

### A7: 设计原则一致性

**ADR 逐条核查**（`~/.agate/adr.md`，ADR-001..011 共 11 条）：

| ADR | 相关度 | 判定 |
|---|---|---|
| ADR-001 主 Agent 不写产出 | 不相关（无阶段产出） | 无冲突 |
| ADR-005 声明性改动可直接做 | **相关**：本改动为声明性/配置级（不改变控制流） | 符合——「chore(repo)」语义与 ADR-005 声明性改动判定一致 |
| ADR-008 orchestrator 符号链接接入 | 不相关（不涉及 orchestrator 接入） | 无冲突 |
| 其余 ADR（002/003/004/006/007/009/010/011） | 不相关 | 无冲突 |

另核查用户级全局指令 `~/.dsh/AGENTS.md`「文档长期保鲜」原则：本小节为**指针式**（指向 repomap-lite skill 的 SKILL.md，不重复 skill 正文、不写死时变数字）——符合指针式精简原则。

ADR 中无针对 REPOMAP/代码地图机制的先例决策，本 commit 为 repo 层约定而非 agate 协议架构决策，**无需新增 ADR**（不在 agate/adr.md 管辖域）。

**结论**：ALIGNED
**差异**：无
**建议**：无

## 闭环规则

| 结论 | 主 Agent 动作 |
|------|--------------|
| ALIGNED（A1/A2/A4/A6/A7） | 通过 |
| MISALIGNED（A3/A5） | **必须修复**——主 Agent 在 CHANGELOG `[Unreleased]` 补记本 commit 至「仓库整理（内部，无用户可见行为变化）」类别，随下次提交落地，无需回滚本 commit（改动本身语义正确，仅文档传播缺口） |

## 人工验收清单核对

- [x] Write 前已检查目标路径：`docs/reviews/agate-alignment-review-2026-08-31.md` 不存在 → 直接写入，无覆盖
- [x] 审查报告含 A1-A7 七项，每项有结论
- [x] MISALIGNED 项（A3/A5）有差异描述 + 建议方向
- [x] 无 NEEDS_HUMAN_REVIEW 项（无需 HUMAN_CONFIRMED 标记）
- [x] 审查报告已落盘到 `docs/reviews/agate-alignment-review-2026-08-31.md`
