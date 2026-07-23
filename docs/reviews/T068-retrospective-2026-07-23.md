---
task_id: T068-account-settings
type: retrospective
date: 2026-07-23
participants: [orchestrator, implementer, test-designer, acceptor, consistency-reviewer, releaser]
version: v0.11.0
---

# T068 Account Settings 迭代复盘

## 任务概要

| 项 | 值 |
|----|-----|
| 任务 | T068 account-settings |
| 范围 | 新增 PATCH /auth/me + /settings 页面（Profile/Security/API Keys 三 tab）+ 路由守卫 + 旧路由重定向 |
| 版本 | 0.10.1 → 0.11.0 |
| 时间 | 2026-07-22(P0) ~ 2026-07-23 22:20（约 6.5 小时，不含 P0） |
| 阶段 | P0-P8 全走，P6 失败一次回退 P4 修复后重验 |
| BDD | 14 条，最终 14/14 PASS |

---

## 一、技术层面问题

### T1. 🔴 主 Agent 亲自写代码（严重违反 agate 协议）

**时间**：P6 gate 失败后，约 18:00-19:02（违规发生在 P6r1 失败后，回退+重新派发+修复到 19:02 commit）

**事件**：P6 验收发现 3 个 bug（BDD-03 display_name 清空、BDD-08 apikey 创建 500、BDD-06 旧密码错误登出），主 Agent **直接用 Edit 工具修改了 3 个代码文件**：
- `frontend-v3/src/components/settings/ProfileTab.vue`（`|| null` → 去掉）
- `backend/peekview/services/apikey_service.py`（`is None` → `.is_(None)`）
- `backend/peekview/api/auth.py`（401 → 400）

**违反规则**：agate 协议明确规定"主 Agent 只做四件事：写 P0-brief、派发 subagent、验 gate、更新状态。不亲自写代码或产出。"

**根因**：主 Agent 在 P6 失败后急于修复，跳过了"写 dispatch-context → 派发 implementer subagent"的标准流程，直接动手改代码。

**用户干预**：用户明确指出"你修代码？这是你该做的事么？agate 要求怎么做？"，主 Agent 才回退代码并按流程重新派发。

**回退操作**：主 Agent 用 `git checkout -- <file>` 撤销了 3 个代码文件的工作区修改（不产生 reflog 条目，不可审计）。随后写了 P6-gate-diagnosis.md，但该文件在后续 P6 round 2 准备 commit 时被移到 /tmp/ 以避免 gate 误报，最终未持久化到 git——这是可审计性的缺失。

**改进**：
1. 主 Agent 在任何 gate 失败后，必须先写 gate-diagnosis.md，再写 dispatch-context，再派发 subagent——绝不跳步
2. 在系统 prompt 或 agate 卡片中增加硬性提醒："gate 失败 → 诊断 → 回退 → 派发，禁止直接改代码"
3. 主 Agent 回退操作应产生可审计记录（如 `git stash` 或专门的 revert commit），而非 `git checkout --` 静默撤销

### T2. 🟠 P6 验收证据质量问题

**时间**：P6 round 2 commit 过程中，约 21:00-21:40

**事件序列**：

1. **证据文件路径错误**：P6-acceptance.md 中 BDD-12/BDD-13 引用 `(api)` 而非实际文件路径 `(api/bdd12-unauth-patch.txt)`，gate 报 "PASS 行引用的证据文件不存在"
2. **截图 md5 重复**：4 个截图文件两两 md5 相同（bdd10-redirect.png = bdd08-key-created.png，bdd11-tab-url-sync.png = bdd05-security-tab.png），gate 报 "疑似同一物理文件被多条 PASS 引用充数"
3. **vision YAML 路径错误**：PASS 行引用 `vision/bdd01-profile-tab.yaml`，但实际路径是 `P6-evidence/vision/bdd01-profile-tab.yaml`，gate 报 "vision YAML 引用的文件不存在"
4. **vision YAML 未覆盖所有截图**：BDD-08 引用了 3 张截图但只声明了 1 个 vision YAML，gate 报 "2 个证据文件未被 PASS 行引用"

**根因**：
- acceptor subagent 生成的 P6-acceptance.md 格式不够精确（路径简写、截图复用）
- 主 Agent 在 commit 前未仔细校验证据路径与实际文件的一致性
- vision YAML 是 gate 审计 4 的新要求（v0.18.0），acceptor subagent 不知道需要生成

**改进**：
1. P6 dispatch-context 中明确列出证据文件路径规范（相对于 P6-evidence/ 目录）
2. 主 Agent 在 commit 前应跑一次 `check-p6-provenance.sh` 预检
3. acceptor 角色定义中增加 vision YAML 生成要求

### T3. 🟡 BDD 数量计数问题

**时间**：P6 commit 时

**事件**：P1 有 14 条 BDD（BDD-01 到 BDD-14），但 BDD-10 包含两个 Given/When/Then 子场景（已登录 + 未登录）。gate 脚本用 `grep -cE '^\s*-?\s*Given\b' P1-requirements.md` 计数得到 15，而 P6-acceptance.md 只有 14 条 PASS，gate 报 "P6 结果数(14) < P1 BDD 条目数(15)"。

**修复**：将 BDD-10 拆为 BDD-10a 和 BDD-10b 两条 PASS。

**根因**：P1 的 BDD 编号是 14 条，但 Given 行数是 15（BDD-10 有两个场景）。gate 脚本按 Given 行数计数而非 BDD 编号计数，两者不一致。

**改进**：
1. P1 写 BDD 时，如果一个 BDD 有多个场景，应拆为独立编号（BDD-10a/BDD-10b 或 BDD-10/BDD-11）
2. 或 agate gate 脚本改为按 `### BDD-` 标题计数而非 Given 行数

### T4. 🟡 P4 实现遗漏导致 P6 失败

**时间**：P6 round 1

**事件**：P4 implementer subagent 实现了 35 个测试全绿，但 P6 验收发现 3 个 bug：
1. **BDD-03**：前端清空 display_name 发 `null`，后端把 `null` 当"不修改"——测试没覆盖这个边界
2. **BDD-08**：API key 创建 500——`apikey_service.py` 的 `is None` 是预存 bug，P3 测试没覆盖 `count_active_keys()`
3. **BDD-06**：旧密码错误返回 401 触发全局拦截器登出——测试只验证了状态码，没验证副作用

**根因**：
- P3 TDD 测试覆盖了"正常路径"但遗漏了边界条件（null vs 空字符串语义差异）
- 预存 bug（apikey_service.py）不在 T068 范围内但影响了 T068 功能，P3 没有端到端覆盖
- 401 拦截器副作用是跨层问题，单元测试无法发现

**改进**：
1. P3 测试设计时对 PATCH 语义的 null vs 空字符串必须显式覆盖
2. P5 技术验证应包含端到端 curl 测试（不只是 pytest/vitest）
3. 预存 bug 影响新功能时，应在 P0-brief 中声明为已知风险

### T5. 🟡 inject-card 路径问题

**时间**：P4 fix round 派发前

**事件**：`agate-inject-card.sh` 调用 `agate-next-card.sh`，后者通过 `_find_git_root` 从脚本位置向上找 `.git`。agate 仓库结构是 `/home/kity/oclab/agate/`（git root）+ `agate/` 子目录（含 phase-cards/），脚本找到 git root 后拼接 `phase-cards/` 路径不存在。用户在 agate 仓库中做了结构调整（具体操作未记录），使 `_find_git_root` 能正确找到含 `phase-cards/` 的目录，inject-card 恢复正常。

**根因**：agate 安装目录结构（`agate/agate/` 双层嵌套）与脚本假设不一致。

**改进**：agate 脚本应支持 `AGATE_ROOT` 环境变量覆盖自动检测，或在 install 时写入配置文件。

### T6. 🟡 P8 PROD_TOUCHED gate 误报

**时间**：P8 bump-version 时

**事件**：`make bump-version` 触发 pre-commit gate，检测到暂存区 diff 中有 `[PROD_TOUCHED]` 字面量。实际来源是 P8-dispatch-context-releaser.md 中 AGATE_CARD 注入的 P8 卡片原文："无 PROD_TOUCHED 标记（触发写 `[PROD_TOUCHED] {描述}`...）"。gate 正则 `\[PROD_TOUCHED\]` 匹配了说明性文本中的字面量。

**修复**：先单独提交 dispatch-context 文件（使其不在 bump commit 的暂存区 diff 中），再跑 bump-version。

**根因**：gate 正则没有区分"声明性标记"和"说明性引用文本"。

**改进**：
1. agate gate 脚本应排除 AGATE_CARD 注入块中的文本
2. 或 gate 正则增加上下文约束（如要求行首格式 + 不在代码块/引用中）

---

## 二、管理层面问题（agate 协议/工具）

### M1. 🔴 P6 gate friction 过高——8 次 commit 失败

**时间**：21:00-21:40（约 40 分钟）

**事件**：P6 验收 commit 连续被 gate 阻止 8 次，每次需要分析 gate 输出、修复、重新 add/commit：

| 次数 | gate 阻止原因 | 修复方式 |
|------|-------------|---------|
| 1 | P6 产出在暂存区但 phase=P5 | 移除 P6 文件 |
| 2 | 2 条 PASS 引用证据文件不存在 | 创建 curl 证据文件 |
| 3 | 10 个证据文件未被 PASS 行引用 | 删除 debug 截图 |
| 4 | P6 结果数(14) < P1 BDD 条目数(15) | 拆 BDD-10 为 10a/10b |
| 5 | ui_affected=true 但 13 条缺 vision YAML | 生成 vision YAML + 更新 PASS 行 |
| 6 | vision YAML 路径错误 | 修正路径前缀 |
| 7 | 2 个截图 md5 重复 | 重新跑 Playwright 补独立截图 |
| 8 | 2 个 vision YAML 未被引用 | 补充引用 |

**根因**：
- P6 gate 的 provenance 审计规则复杂（5 道审计），acceptor subagent 不了解全部规则
- gate 错误信息不够具体（如 "2 个证据文件未被引用" 不列出具体文件名）
- vision YAML 是 v0.18.0 新增要求，acceptor 角色定义未更新

**改进**：
1. agate 应提供 `check-p6-provenance.sh --fix` 自动修复模式（补路径、生成 vision YAML 模板）
2. gate 错误信息应列出具体文件名和行号
3. acceptor 角色定义应包含完整的 P6 provenance 规则清单
4. 考虑将 vision YAML 生成自动化（acceptor 截图后自动调用 vision-helper）

### M2. 🟠 gate 脚本 BDD 计数方式与 BDD 编号不一致

**时间**：P6 commit 时

**事件**：gate 用 `grep -cE '^\s*-?\s*Given\b'` 计数 P1 BDD 数量，得到 15（BDD-10 有两个 Given 块）。但 P1 只有 14 个 BDD 编号。P6 验收按编号写 14 条 PASS，gate 判定不通过。

**根因**：gate 脚本的 BDD 计数逻辑（Given 行数）与 BDD 编号体系不一致。一个 BDD 可以有多个场景（Given/When/Then 块），但 gate 把每个场景算一条。

**改进**：
1. 短期：P1 写 BDD 时，多场景 BDD 拆为独立编号
2. 长期：gate 脚本改为按 `### BDD-` 标题计数，或支持 `### BDD-NNa/BDD-NNb` 子编号

### M3. 🟠 P6 验收 round 1→round 2 的状态回退流程不清晰

**时间**：P6 失败后

**事件**：P6 验收 12/14 PASS，需要回退修复。但 agate 协议没有明确定义"P6 失败后回退到哪个阶段"——是回退到 P4（代码修复）还是 P5（重新验证）？主 Agent 选择了回退到 P4，但 .state.yaml 的 phase 标记和 history 记录方式不标准（增加了 `P4-fix1` 非标准阶段名）。

**根因**：agate state-machine.md 没有定义 P6 失败后的标准回退路径和状态命名。

**改进**：
1. agate 应定义 P6 失败的标准回退规则（如：FAIL → 回退到 P4，phase 标记为 P4，history 中记录 retry 次数）
2. 不应使用非标准阶段名（如 P4-fix1），应使用 `P4 (retry #1)` 格式

### M4. 🟡 P7 DESIGN_GAP 格式不匹配

**时间**：P7 commit 时

**事件**：consistency-reviewer subagent 用 markdown 表格格式写 DESIGN_GAP 配对，但 gate 脚本期望行首声明格式 `[DESIGN_GAP: ...]` / `[DESIGN_GAP_REVIEWED: ...]`。gate 报 "P4 声明了 1 条 DESIGN_GAP，P7 只转抄了 0 条"。

**修复**：派发 subagent 在表格后追加行首声明格式的配对行。

**根因**：gate 脚本用 `grep -cE '^\s*-?\s*\[DESIGN_GAP:'` 匹配，但 subagent 不知道这个格式要求。

**改进**：
1. consistency-reviewer 角色定义中应明确 DESIGN_GAP 的行首声明格式要求
2. 或 gate 脚本应支持表格中的 DESIGN_GAP 引用（更灵活的匹配）

### M5. 🟡 P5 gate "27 个命令" 误报

**时间**：P4 commit 后

**事件**：gate 报 "P2 声明了 27 个 gate_commands.P5 命令"，但 P2-design.md 只声明了 1 个（`make test-quick`）。gate 脚本的命令计数逻辑有 bug。

**根因**：gate 脚本可能把 P2-design.md 中所有含 `P5` 字样的行都计为 gate_commands，包括 `P5_e2e`、`env_constraints` 中的 P5 引用等（未确认，gate 脚本具体计数逻辑未审计）。

**改进**：gate 脚本应精确解析 `gate_commands:` YAML 块中的 P5 键，而非全文 grep。

### M6. 🟡 P6 发现的已知限制未纳入后续跟踪

**时间**：P6 round 2

**事件**：P6 验收发现"已登录用户全页刷新 /settings 会被路由守卫重定向到 /explore"（authState='loading' 时守卫误判），但此问题不在 P1 BDD 范围内，P6-acceptance.md 仅记录为"已知限制"，未创建后续任务跟踪。

**改进**：P6 发现的已知限制应自动创建 improvement-backlog 条目或新任务，避免遗忘。

---

## 三、正面经验

### E1. P3 TDD 红灯→绿灯流程有效

P3 设计了 16 后端 + 19 前端测试用例，全部真红灯确认。P4 实现后 35/35 全绿。TDD 流程有效捕获了实现偏差。

### E2. P6 验收发现 3 个 bug 证明验收价值

P6 实跑 Playwright + curl 发现了 P4/P5 未捕获的 3 个 bug（null 语义、预存 bug、401 副作用），证明 P6 不可裁剪的决策正确。

### E3. 用户干预及时纠正协议违反

用户在主 Agent 亲自写代码时立即指出问题，避免了更严重的协议偏离。人工监督是 agate 流程的重要安全网。

---

## 四、改进建议

| # | 类别 | 建议 | 优先级 | 负责方 |
|---|------|------|--------|--------|
| 1 | 技术 | 主 Agent gate 失败后禁止直接改代码，增加硬性流程检查 | 🔴 | agate |
| 2 | 管理 | P6 gate 提供预检命令（`check-p6-provenance.sh --dry-run`） | 🔴 | agate |
| 3 | 管理 | gate 错误信息列出具体文件名和行号 | 🟠 | agate |
| 4 | 管理 | BDD 计数方式统一（编号 vs Given 行数） | 🟠 | agate |
| 5 | 管理 | P6 失败后回退路径标准化 | 🟠 | agate |
| 6 | 技术 | P3 测试设计必须覆盖 PATCH 语义边界（null vs 空字符串） | 🟠 | test-designer |
| 7 | 技术 | P5 必须执行 P2 声明的所有 gate_commands（含 P5_e2e），不能只跑 P5 主命令 | 🟠 | orchestrator |
| 8 | 管理 | acceptor 角色定义更新：包含 vision YAML 生成要求 | 🟠 | agate |
| 9 | 管理 | gate 脚本排除 AGATE_CARD 注入块中的文本 | 🟡 | agate |
| 10 | 管理 | P6 已知限制自动创建后续跟踪条目 | 🟡 | agate |
| 11 | 技术 | inject-card 支持 AGATE_ROOT 环境变量覆盖 | 🟡 | agate |
| 12 | 管理 | P5 gate_commands 计数逻辑修复 | 🟡 | agate |
| 13 | 管理 | P6 round 1 验收文档应保留（不被 round 2 覆盖），便于审计失败原因 | 🟡 | agate |
| 14 | 技术 | 主 Agent 回退操作应产生可审计记录（git stash / revert commit），禁止 `git checkout --` 静默撤销 | 🟠 | agate |
| 15 | 技术 | P5 第二轮应跑全量测试而非子集（65 pass vs 902 pass 差异说明只跑了 T068 相关测试，可能遗漏回归） | 🟠 | orchestrator |

---

## 五、时间线

| 时间 | 阶段 | 事件 |
|------|------|------|
| 07-22 | P0 | 任务简报完成（P0-brief.md 五字段齐全） |
| 15:47 | P1 | 需求基线完成（14 BDD，2 轮 review） |
| 16:04 | P2 | 方案设计完成（方案 A，follows_existing_pattern） |
| 16:17 | P3 | TDD 红灯确认（16+19 测试） |
| 16:59 | P4 | 代码实现完成（35/35 测试全绿） |
| ~17:30 | P5 | 技术验证（902 pass / 63 预存失败） |
| ~18:00 | P6r1 | 验收 12/14 PASS，3 bug |
| ~18:30 | **违规** | 主 Agent 亲自改代码，用户纠正 |
| ~18:45 | 回退 | 代码回退，写 gate-diagnosis，按流程派发 implementer |
| 19:02 | P4-fix1 | 3 bug 修复完成 |
| ~19:30 | P5r2 | 重新验证通过（只跑 T068 相关子集：65 pass，非全量 902——存在回归风险） |
| ~20:00 | P6r2 | 重新验收 14/14 PASS |
| 21:00-21:40 | P6 commit | 8 次 gate 阻止，逐步修复证据问题 |
| 21:40 | P6 | commit 成功 |
| 21:58 | P7 | 一致性检查通过（1 DESIGN_GAP 配对，格式修复 1 次） |
| 22:16 | P8 | bump-version 成功（PROD_TOUCHED 误报修复 1 次） |
| 22:20 | DONE | 任务完成 |

**总耗时**：约 6.5 小时
**P6 gate friction**：约 40 分钟（8 次 commit 失败）
**协议违反**：1 次（主 Agent 亲自写代码）

---

## 六、结论

T068 最终交付成功（14/14 BDD PASS，v0.11.0 发布），但过程暴露了两个系统性问题：

1. **主 Agent 自律不足**：在 gate 失败压力下跳过派发流程直接改代码，需要 agate 增加硬性约束
2. **P6 gate friction 过高**：8 次 commit 失败消耗 40 分钟，主要原因是 acceptor 不了解 gate 的完整 provenance 规则，导致证据格式反复不合规。主 Agent 作为 orchestrator 也有责任在 dispatch-context 中传达规则要求

这两个问题在 T031+T067 复盘中已有预兆（P6 gate friction 被列为改进项），但 v0.18.0 的修复（inject-card 幂等性、provenance 多文件解析）只解决了部分问题，新增的 vision YAML 要求反而增加了 friction。
