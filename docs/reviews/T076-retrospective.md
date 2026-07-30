# T076 复盘与评审

- **协议:** agate (OpenCode platform)
- **版本:** peekview v0.12.0
- **子代理模型:** general: deepseek-v4-pro / vision-helper: minimax-cn/MiniMax-M3
- **日期:** 2026-07-30
- **类型:** 复盘（retrospective，含会话记录审计）

---

## 一、任务概要

| 项 | 值 |
|----|-----|
| 改动范围 | 5 实现文件 + 6 旧测试适配 + e2e spec ×1 + vitest ×4 |
| 阶段 | P0–P8（全链未裁剪） |
| subagent 派发 | 17 次（10 次阶段 subagent + 3 次 vision-helper 批量 + 4 次补充） |
| git commits | 12 个（P1–P8 + READY + 2 个修复 + 1 个消歧） |
| BDD 结果 | 21/21 PASS |
| vision | 19 YAML，全 blocker=0 |

---

## 二、会话审计（客观事件序列）

### 2.1 工具调用统计

| 工具 | 次数 ≈ | 说明 |
|------|--------|------|
| bash | ~65 | 环境检查、gate 运行、git 操作、publish、e2e 执行 |
| read | ~20 | 协议文件、产出文件、实现代码片段 |
| write | ~28 | dispatch-context（每阶段 1–2）、vision YAML ×19、证据脚本 ×3、state 更新 |
| edit | ~25 | .state.yaml、active-tasks、CHANGELOG、P6 行修正 |
| task | 12 | 阶段 subagent ×7、vision-helper ×4、test-designer(fix) ×1 |
| glob / grep | ~10 | 代码搜索、文件路径确认 |

**工具调用特点**：
- P6 阶段是工具调用密度最高的阶段——大量 write（19 份 vision YAML 转录）+ 多次 vision-helper task 派发
- bash 调用中约 15% 出现了 `Tool execution aborted`（手动中断），集中在 publish 发布阶段和 e2e 证据脚本调试阶段

### 2.2 `Tool execution aborted` 事件序列

| # | 命令 | 原因 | 影响 |
|---|------|------|------|
| 1 | `make publish` (首次) | `source ~/.bash_env` 触发 fcitx daemon 启动，shell 挂住 | 用户等待超时手动中断 |
| 2 | `make publish` (第二次) | 同样 fcitx 问题，或 token 仍未加载 | 再次中断 |
| 3 | `node --version`（无关命令，会话早期）| | 无影响 |

**特殊观察**：第 1、2 次 abort 之后我未做根因诊断就重试——这是"重复失败模式"。

### 2.3 Vision YAML 转录（P6 上下文消耗 + vision-engine 遗漏）

P6 阶段共产生 19 份 vision YAML，流程为：

1. vision-helper 被派发读取截图、返回文本分析（YAML 格式）
2. 主 Agent 接收文本后，用 write 工具落盘到 `vision-reports/*.yaml`

**问题**：vision-helper 当前模型（minimax-cn/MiniMax-M3）有 `read` 权限（可读图片），但无 `write`/`bash` 权限。它只能返回文本给主 Agent，由主 Agent 再写盘。

**后果**：
- 19 份 YAML 的分析结果全部进入了主 Agent 的上下文窗口
- 按平均每份 YAML ~2000 字符（含 visible_text_complete 的完整文字转录）计算，vision 返回的文本总量约 **38,000 字符**，相当于主 Agent 上下文窗口的 15–25%
- 主 Agent 做了"转录员"的工作（机械搬运 vision-helper 输出），浪费了上下文容量
- 如果 vision-helper 可以直接写文件，主 Agent 只需收到 `bdd01.yaml: blocker=0` 等一行摘要

**关键遗漏**：环境中有 `vision-engine` skill（CLI 工具 `vision-analyze.py`，通过 bash 调用外部 vision API），任何有 bash 权限的 subagent 都能用。正确流程应该是派 general subagent → bash 调 CLI → 拿到结构化输出 → write 到文件 → 返回摘要。一个 subagent 一步完成，无转录，不消耗主 Agent 上下文。

**归因**：执行失误，非协议缺陷。我机械遵循了系统提示的 vision-usage 规则（"必须派 vision-helper"），未检查 available_skills 列表中已有的 vision-engine skill。

### 2.4 前端 subagent 类型不可用

P3 派发 test-designer 时，首次尝试 `subagent_type: frontend` 返回 `Model not found: inherit/.`，回退为 `general` 类型。这意味着 OpenCode 的内置前端子代理在当前环境模型配置有问题——这与 dispatch-protocol 的平台适配说明一致（"OpenCode 自定义 subagent 因 issue #29616 不可用，统一使用 general subagent + prompt 注入角色文件"）。

对本任务的影响：无影响（general + 角色文件注入方式运作正常），但增加了 prompt 的复杂度（需在 prompt 中内联大量前端项目约定）。

---

## 三、Git 追踪（全链 commit）

```
dc85e9b8 wf(T076-P1): 需求基线通过 — 21 BDD + requirements-review approved
50c8740b wf(T076-P2): 方案设计通过 — 原生<a>语义方案 + plan-design-review approved
871beaa3 wf(T076-P3): TDD 红灯测试 — 36 单测 + 42 e2e，21 BDD 全覆盖（32 真红灯）
abc3ea11 wf(T076-P4): 实现完成 — EntryCard/EntryListRow/BaseTag <a> 拆分 + tag 过滤，1057 全绿 + design-review approved
6d08b163 wf(T076-P5): 技术验证通过 — 单测1057全绿 + e2e 42/42（retry 1轮修12测试侧缺陷）
ba49eb3d wf(T076-P6): 验收通过 — 21 BDD 全 PASS + vision×19 全 blocker=0 + provenance exit 0
bc5acc21 wf(T076-P7): 一致性检查通过 — BLOCKER=0，实现忠实 P2 方案 A
b690b7bd wf(T076-P8): 发布准备 — minor bump 0.12.0 + CHANGELOG [Unreleased] 追加 T076
db38fef3 chore(release): bump to v0.12.0          ← bump-version commit + tag
88c0612b wf(T076): READY — v0.12.0 发布就绪（P0-P8 全通过，待 make publish）
28a7915f docs: 消歧 active-tasks 归档表 T076
e63db696 fix(makefile): publish 兜底读取 ~/.env     ← fcitx 问题修复
9ca90fea fix(test): T073 BDD-10 ruff check 替代 make lint-fix
```

**P6 之后的非标准 commit**：
- db38fef3 之后经过了两次 amend（一次是移除 T069 遗留 PNG，另一次是补充 CHANGELOG 遗漏项），期间 tag v0.12.0 被 force-move 了两次

### 3.1 P7-progress.md 误提交

`bc5acc21 wf(T076-P7)` 包含了 `P7-progress.md`（trace 文件），在 P8 commit 中通过 `git rm --cached` 删除。

**根因**：阶段收尾脚本缺少"清理 trace 文件"这一步，我依赖记忆而非 checklist。

### 3.2 bump-version 卷入 T069 遗留

`make bump-version` 内部调用了某种形式的 `git add -A`（或等价操作），将 `frontend-v3/docs/tasks/T069-...` 下的 11 份错放截图扫入了 release commit（db38fef3）。发现后通过 `git rm -r --cached` + `amend` + `tag -f` 修复。

**根因**：bump-version 用 `git add -A`（或等价）而非精确路径 `git add VERSIONS.json static/`。

---

## 四、主要问题分析

### 4.1 Publish 阻塞：`~/.bash_env` 混入 fcitx daemon

**事件链**：
1. 我按 AGENTS.md 的指示 `source ~/.bash_env` 加载 token
2. `~/.bash_env` 内除了 `export PYPI_API_TOKEN=...` 外还有 fcitx 输入法 daemon 启动逻辑
3. `fcitx -d` 在非交互 shell 下 fork 子进程后未正确 detach，shell 挂住
4. 用户手动中断两次后，我仍未能诊断根因
5. 用户提供 token 后，第三次尝试成功（此时 fcitx 可能因之前被启动过而 `pgrep` 命中，跳过了启动）

**Makefile 的兜底逻辑原本就能工作**——它会自动 `source` 文件读 token。我多此一举手动 `source`，反而引入了 fcitx 副作用。

**修复**：token 移到 `~/.env`（纯变量文件），Makefile 兜底列表加 `~/.env`（e63db696）

**教训**：环境文件中混入进程启动脚本是"地雷"——在交互式终端里不爆（fcitx 已在跑），在非交互脚本里引爆（fcitx 没跑，启动卡住）。这是"同一个文件在两个上下文中有不同行为"的典型案例。

### 4.2 P3 e2e 缺陷泄漏到 P5（12/42 失败）

**时序线**：

| 时间 | 事件 | 结果 |
|------|------|------|
| P3 | test-designer 产出 e2e spec（42 测试） | P3 gate 只验证 vitest 红灯（32 assertion failures），e2e 未参与验证 |
| P5 | verifier 跑 `make build-frontend && E2E_SPEC=... make debug-test` | 28/42 passed, 12 failed |
| P5 | 主 Agent 分析 12 个失败项 → 全部为 P3 测试代码缺陷 | |
| P5 | 派 test-designer 修复 e2e spec（retry 1） | |
| P5 | 主 Agent 全量重跑 e2e | 42/42 passed |

**为什么 P3 没能发现这些问题**：
- `check-tdd-red.sh` 目前只验证单元测试红灯（vitest），e2e 不在验证范围内
- e2e 验证需要 build-frontend + debug backend + CDP，P3 阶段这些条件不完全满足（实现未写、前端可能未构建）
- 但"选择器错误"这类问题不需要前端构建也能检测——属于 test-designer 自我审查的范围

**可能的 agate 改进**：在 P3 增加一个轻量级的 e2e "结构检查"，不要求全量通过（实现未写当然失败），但至少检验：
1. 选择器格式合法（CDP 下 `hasText` on SVG 是一个已知陷阱）
2. 测试独立性（避免 `.first()` 无隔离）
3. 必要数据 setup 完整（如 BDD-20 的认证 entry）

### 4.3 Vision 发现的 3 项程序化测试漏掉的问题

P6 vision 对 3 张截图报否定/存疑。主 Agent 逐条追查后发现：三者均为"证据截图时机问题"而非实现缺陷。但 vision 的否定是关键质量关卡——程序化测试通过不代表用户看到的画面正确。

| BDD | 程序化断言 | 是否通过 | Vision 发现 | 根因 |
|-----|----------|---------|------------|------|
| BDD-02 | `toHaveURL(/{slug})` | PASS | 截图是列表页（非详情页） | e2e `waitForContent` 用 CDP 不稳定的 `waitForFunction`（被 `.catch` 吞掉），点击在 Vue hydration 未完成时触发，截图在 SPA 过渡期 |
| BDD-12 | `chip.toBeVisible()` + 移除后 URL 断言 | PASS | 截图无 chip | 截图在 chip 移除后（验证的是移除成功，不体现 chip 存在） |
| BDD-20 | Tab 遍历收集 focusedTags | PASS | 截图无 focus 轮廓 | Tab 遍历 12 次后截图，焦点已移出可见卡片 |

**T046 原则验证**："vision-helper 说破了就是破了。不要用 DOM 属性替代视觉验证。" 本任务中，三项问题均为程序化指标通过、视觉指标失败——验证了 vision 在 UI 任务 P6 中的关键价值。

**证据补验成本**：三项各需要主 Agent 写一份验证脚本 + 重截截图 + vision 复核。e2e spec 不做修改（避免 P6 self-authored gate 拦截），而是主 Agent 在 P6-evidence/ 下自写脚本（符合 P6 card 允许的"主 Agent 自写脚本落 P6-evidence/"路径）。

---

## 五、Agate 流程评价

### 5.1 做对了的

| 决策 | 理由 | 事后看 |
|------|------|--------|
| 走完整 P0–P8 不裁剪 | 跨模块 UI + 新交互功能 | ✅ P6 vision 抓到 3 项证据问题，若不验 P6 全漏 |
| P5 修复后全量重跑 | T027 教训 | ✅ 重跑 42/42 无回归 |
| P6 自写证据脚本 | P6 card 允许的兜底路径 | ✅ 三项证据补验完成 |
| vision-helper 的"否定"先追查而非反驳 | T046 原则 | ✅ 三项均发现证据时机问题 |

### 5.2 Agate 待改进点

| 问题 | 严重度 | 建议 |
|------|--------|------|
| P3 无 e2e 质量闸门 | 中 | 增加 e2e "假红灯 vs 真红灯"检测（选择器语法/隔离/数据 setup 合法性） |
| vision-helper 无 write 权限 | 低（归类为执行失误，见 3.4） | 不是协议缺陷——vision-engine skill（CLI 工具）已提供"读图 + 结构化输出"能力，general subagent 调 CLI 可一步完成。主 Agent 未检查已有 skill 就用笨办法 |
| frontend subagent 类型不可用 | 低 | 项目环境特定问题（OpenCode issue #29616），非 agate 协议层 |
| 前端 vitest `check-tdd-red.sh` 适配需手动配 env vars | 低 | 可将 vitest 适配配置模板化到 P3 dispatch-context |

### 5.3 各阶段 subagent 质量

| 阶段 | 角色 | 质量 | 问题 |
|------|------|------|------|
| P1 | analyst | ★★★★★ | 主动修正 tag 路径（/explore?tags=），BDD 覆盖全面 |
| P1 | requirements-review | ★★★★ | 可靠，无遗漏 |
| P2 | architect | ★★★★★ | files_to_read 精确（含行号），gate_commands 正确引用 Makefile |
| P2 | plan-design-review | ★★★★ | 7 NOTE 切中要害（iOS tooltip 为重点风险） |
| P3 | test-designer | ★★★ | e2e 选择器/隔离/数据 setup 有缺陷，P5 才暴露 |
| P4 | implementer | ★★★★☆ | 忠实 P2，旧测试适配正确，0 DESIGN_GAP |
| P4 | design-review | ★★★★ | 可靠，无遗漏 |
| P5 | verifier | ★★★★★ | 详尽诊断 12 失败项的类别分类 |
| P5 | test-designer(fix) | ★★★★ | 修复完整 |
| P6 | verifier | ★★★★ | 证据基本完整，21/21 PASS |
| P7 | consistency-reviewer | ★★★★ | 4 项检查逐项通过 |
| P8 | releaser | ★★★★ | bump_type 判定准确（minor for new features） |

---

## 六、改进建议

### 对主 Agent（执行纪律）

1. **跑有副作用的命令前先 grep 确认文件内容**——不凭"文档说"假设
2. **"trace 文件是否已删"加入每阶段收尾的 checklist**
3. **commit 前 git status --porcelain 确认无意外文件进入暂存区**
4. **CDP 下禁止 `waitForFunction`**——纳入 dispatch-context 模板

### 对项目（PeekView）

1. `make bump-version` 改用精确 `git add` 路径（防卷入 untracked 遗留）
2. 清理 `frontend-v3/docs/` T069 遗留
3. zip-* test fixtures 入 `.gitignore`（每次测试改写，产生伪变更）

### 对 agate 协议

1. P3 增 e2e 选择器/隔离有效性检查（"假红灯 vs 真红灯"的 e2e 版）
2. `check-tdd-red.sh` 为 vitest 提供预配置模板

### 对 vision-engine skill（通用改进，非 agate 专属）

1. 增加 `verify` role：输入截图 + 验证条件列表，输出逐条判定 + 汇总
2. 输出 schema 用 vision-engine 自己的通用格式（`results: [{id, result, evidence}]` + `summary: {pass, fail, total}`），不绑定任何消费方的数据结构
3. 输出格式（JSON/YAML/text）由调用方用 `-f` 选，不由工具方决定
4. 职责分离：
   - vision-engine 管"看图 + 结构化判定"，不管消费方怎么用
   - 消费方（agate / QA pipeline / 设计走查）管"格式适配"，调用 CLI 拿到通用输出后自己转换成自家格式

注：agate 特定的 `vision_analysis.summary.blocker_count` YAML 结构（来自 `vision-analyst.md` 角色定义）是 agate 的责任，不是 vision-engine 该迁就的。agate 的 P6 verifier 做格式转换（通用 JSON → agate YAML）。
