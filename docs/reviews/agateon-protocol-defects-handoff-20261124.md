# Agateon 协议层缺陷交接单（9 项 + 1 项误报）

> 报告人：PeekView 项目 Agent（DSH 环境）
> 日期：2026-11-24
> 环境：DSH 0.2.1-rc.2 / Agateon **v0.83.1**
> 来源：PeekView 各任务执行中实测沉淀（每条均有现场证据）
> 性质：**本仓无法修复**——缺陷位于 `~/.agate/current/agate/` 协议本体

---

## 0. 汇总

| # | 编号 | 级别 | 一句话 | 是否咬过人 |
|---|---|---|---|---|
| 1 | DEBT0017 | **high** | `bump-version` 的 `git add -A` 会吞未忽略的临时目录（含明文凭证） | ✅ 实际发生 |
| 2 | DEBT0021 | medium | bump 后 `--amend` 使 tag 停在 pre-amend 提交（tag 缺 CHANGELOG） | ✅ 实际发生 |
| 3 | DEBT0014 | **high** | 内置 vitest formatter 用环境变量传输出，超 `MAX_ARG_STRLEN` → exit 126 → TDD 红灯误判 | ✅ 实际发生 |
| 4 | DEBT0018 | medium | `check-judge-verdict.py` 证据路径形态/行首预判鲁棒性缺口 | ✅ 实际发生 |
| 5 | DEBT0015 | medium | `check-scope-resolved.py` 对粗体包裹的 `[SCOPE+]` 不可见；且 `check-gate.py` 不调用它 | ✅ 实际发生 |
| 6 | DEBT0016 | medium | `check-p6-provenance.py` 用 `---` 逐对配对，奇数个时尾部漏检 | 潜在 |
| 7 | DEBT0020 | medium | `gate_commands` 无 lint key → P0–P7 全绿，P8 才撞 lint 红灯 | ✅ 实际发生 |
| 8 | DEBT0008 | **high** | BDD 只有正向路径，无「测试副作用/环境还原」gate | ✅ 实际发生 |
| 9 | DEBT0009 | medium | P1 无「人工体验路径」验收要求 | ✅ 实际发生 |
| 10 | — | — | `agate-setup.py --list` 对 DSH 声明块的过期检测**假阳性** | ✅ 实际发生 |

---

## 1. DEBT0017（high）：`bump-version` 的 `git add -A` 吞临时目录

**现象**：`make bump-version` 的 Step 4 直接 `git add -A`，把工作区中**未被 `.gitignore` 覆盖**的临时目录/文件一并提交。

**实测**（2026-09-07，v0.24.1）：`bump-version` 自动提交了历史任务遗留的截图目录（TPV0089/TPV0091 的 P6 证据）。因发现及时，用 soft-reset 拆成干净 bump + 单独归档两个提交，未入 tag。

**风险**：若临时目录含**明文凭证**（探针脚本常含 API key / token），明文入 git 历史属**不可逆**（需 filter-branch / BFG 重写）。

**建议**：
- `git add -A` 后、`commit` 前加「暂存面审查」：打印 `git diff --cached --name-only`，校验不含未忽略的临时/敏感路径（可配置白/黑名单），异常则中止
- 或改为按路径显式 `git add`（只加版本文件）

---

## 2. DEBT0021（medium）：bump 后 `--amend` 使 tag 停在 pre-amend 提交

**现象**：项目文档流程为「`make bump-version` → 填 CHANGELOG → `git commit --amend --no-edit`」，但 `bump-version` 已在 Step 4 打了 tag。amend 后 HEAD 变了，**tag 仍指向旧提交** → tag 提交缺 CHANGELOG 正文。

**实测**（2026-09-07）：v0.24.1 的 tag 落在被丢弃的 `20e9b89c` 上，且已 force-push。修正需 `git tag -f v0.24.1 <new> && git push --force origin v0.24.1`（对他人有影响）。

**建议**（二选一）：
1. 流程改为「**先写 CHANGELOG 正文 → 再 `make bump-version`**」（正文随 bump 提交），去掉 amend
2. 保留 amend，但在其后补 `git tag -f vX.Y.Z HEAD`，并写入 `AGENTS.md` / `docs/process/release.md`

---

## 3. DEBT0014（high）：内置 vitest formatter 超 `MAX_ARG_STRLEN`

**现象**：`assets/formatters/vitest.sh` 用**环境变量**传全量测试输出；输出超 `MAX_ARG_STRLEN`（Linux 单参数上限 ~128 KB）时 formatter `exit 126` → `check-tdd-red.py` 误判为 **A 类假红灯**（语法/import 错），导致 P3 FAIL。

**影响**：
- 本仓 4 个任务声明 `P3_formatter: vitest.sh`（T081/T084/T086/T087，其中 T084/T087 仍为 READY，会实际命中）
- **CI backstop 同源中招**：`ci-gate-backstop.py:181-183` 对 `tdd_exit==1` 有同类误判路径

**建议**：把输出经**临时文件**而非环境变量传递：
```bash
TMP=$(mktemp); cat > "$TMP"; python3 - "$TMP"
```
判定语义不变。这与本仓 TPV0099 任务级 formatter 的改法逐字一致（已在该任务验证可行）。

---

## 4. DEBT0018（medium）：`check-judge-verdict.py` 鲁棒性缺口

**现象**（TPV0100 实测两处）：
- `verdict_evidence` 的路径形态未约定基准目录 → judge 或主 Agent 按直觉书写必然机械失败
- 行首预判扫描会把 dispatch-context 里的**格式示例行**（模板化产物天然含 `- PASS` / `- FAIL` 示例）当作真实判定

**影响**：每有 P6.5 judge 的任务都会多耗一轮修正；属"非确定性、位置依赖"的摩擦。

**建议**：
1. `judge.md` 显式声明 `verdict_evidence` 引用**相对 `P6-evidence/` 解析**，并给出 `../<dir>/<file>` 的约定与示例
2. `check-judge-verdict.py` 对已知前缀（`P6-evidence/`）做容错；对围栏代码块内的示例行跳过扫描

---

## 5. DEBT0015（medium）：`check-scope-resolved.py` 真空早退 + 未被 gate 调用

**现象**（TPV0099 实测）：
- `SCOPE_PLUS_RE` 只匹配**行首** `[SCOPE+]`，产出里写成粗体 `**[SCOPE+]**` 时**静默真空早退** → 闭环实际未被校验
- `check-gate.py` **不调用**该脚本 → P7 gate 通过 ≠ SCOPE+ 被校验过

**影响**：TPV0099 的 BLOCKER 是由 P7 consistency-reviewer **人工发现**的，而非脚本 —— 存在"标记缺失却一路绿灯"的盲区。

**建议**：
1. `SCOPE_PLUS_RE` 放宽，覆盖粗体/列表/引用等常见包裹形态
2. 早退分支输出显式提示（如 `no line-start SCOPE+ found; resolved-check skipped`），不静默
3. `check-gate.py` 在 P7 调用该脚本

---

## 6. DEBT0016（medium）：`check-p6-provenance.py` 的 `---` 配对缺陷

**现象**：剥离 frontmatter 时用 `---` **逐对配对**。当文件含**奇数个** `---` 分隔线（多个水平分隔线 / 子 frontmatter 示例都常见），末个 `---` 会吞掉其后至 EOF → **审计 2 对尾部行漏检**。

**影响**：同一违规因**行位置不同**判定相反（非确定性）；"违规写在尾部即不被检出"。

**建议**：改为**只剥离文件顶部第一对 `---`**（用 `stripped[0] == '---'` 起点判定 + 找不到闭合对时**不删除**并显式提示），而非"任意位置遇 `---` 即开始配对"。

---

## 7. DEBT0020（medium）：`gate_commands` 无 lint key

**现象**：agate 的 P2 `gate_commands` 结构无 lint key → 任务可带 lint 红灯走完 P0–P7 全部 gate，到 **P8 才发现**。

**实测**：P4 的 orchestrator-log 曾记「ruff 全绿」，但自查范围未含 `tests/` → 新增测试文件未纳入 lint 面。

**建议**：
1. `gate_commands` 增加 lint key（如 `P5_lint: backend/.venv/bin/ruff check backend/`），纳入 P5 技术验证
2. 或把 ruff 纳入 CI backend job
3. P4 自查范围明确要求含 `tests/`

---

## 8. DEBT0008（high）：BDD 只有正向路径，无「环境还原」gate

**现象**（TPV0095 交付后实测）：`teams-page.spec.ts` 无 `afterEach` 清理 → 多次跑 E2E 在 debug DB 残留 **18 个** `Alpha-*` / `Del-*` / `T-*` 团队。用户质疑"bob 能添加 dave"（与 owner-only 权限模型矛盾），后端实测权限逻辑正确 —— **真凶是残留数据让 bob 成了自有团队的 owner**。

**关键**：P6 验收 44 条 BDD **全 PASS 时无污染**（残留是验收之后连续跑 E2E 累积的）→ "测试是否弄脏环境"不在任何 gate 覆盖内。

**建议**：P6/CI 增加「测试后环境还原」检查（E2E 运行后 DB 条目数/团队数快照比对，或要求 spec 自带 fixture 清理钩子）。

> 本仓侧已缓解：`docs/process/debug-workflow.md`「E2E 编写规范」第 2/4 条已强制 afterEach 清理队列 + 同认证上下文；TPV0096 进一步固化为 spec 模板。

---

## 9. DEBT0009（medium）：P1 无「人工体验路径」验收要求

**现象**（TPV0095 复盘）：P1 记录「样例 seed 数据不纳入本次改动（team fixture 由 P3 自建）」——条目本身合规，但 44 条 BDD **全部**用 P3 自建 fixture 验收，**无一条**验证"`make debug-seed` 后 explore Teams tab 应有内容"。结果：用户 seed 后打开 Teams tab 看到 **No entries found**。

**影响**：自动化验收全绿 ≠ 用户按文档体验正确。凡涉及 debug-seed/演示数据的功能，"seed 后页面应有内容"成了隐性验收项，靠用户肉眼发现。

**建议**：P1 模板加「人工体验验收」节 —— 凡改动涉及用户可见页面且 seed/演示数据影响其内容，强制补 1 条「Given seed 数据 When 打开 X 页 Then 有内容」的 BDD（或用 fixture 等价物）。

> 本仓侧已缓解：debug-seed 已含 team + team entry（commit `32e952da`）。

---

## 10. `agate-setup.py --list` 假阳性（误报）

**现象**：
```
⚠️  [dsh] ~/.dsh/profiles/web/cordis.patch.yml  声明块存在但与任何已装版本的权威模板都不一致
      （已过期或被手改；重跑接入刷新）
```

**实测（详见 `docs/reviews/agateon-dsh-list-false-positive-20261110.md`）**：用 v0.83.1 自己的 `dsh_preset_block()` 重新生成声明块比对 —— **插件包名集合 26 = 26，零差异**；62 行文本差异**全部**位于 `persona.prefix` 的 YAML 折叠标量内，是 `>-` 折叠时的换行位置不同 → **语义等价，仅序列化格式不同**。

**根因**：过期检测用**逐字文本比对**，而 YAML 折叠标量在"模板原文"与"生成块"之间必然重新折行。

**危害**：①持续误报造成告警疲劳 ②引导语"重跑接入刷新"会诱导用户做**无必要且覆盖用户改动**的操作。

**建议**：
1. 比对改**语义比对**（解析 YAML 后比较插件 id/name/config 树）
2. 若坚持文本比对，至少对 YAML 折叠标量做规范化（`>-` 块按空白折叠为单行再比）
3. 告警文案区分「内容不同（可能被手改）」与「仅格式不同」
4. 增加 `--diff` 输出语义差异摘要

---

## TPV0104 追加（2026-11-26）

> 以下 5 条来自 TPV0104（viewer-correctness-hardening）的 P0–P8 实测。**每条都已由独立第三方核查者复核**，并已按核查结果修正过表述——初版有 2 条夸大/误读，下面写的是修正后版本。

### 11. P2 可在不触发 `[BASELINE_CHANGE]` 的情况下实质削弱 P1 判据

**现象**：P2 阶段的 schema 决策可以放宽某条 BDD 的 Then 子句，而**全程无 gate 拦截**，直到 P6.5 judge 独立复核才发现。

**TPV0104 实证路径**：
1. P2 判断「`get_files_by_ids` 只返回命中行 → `count_limit` 拿不到文件名」（**前半是源码事实，后半是错误推论**）
2. 据此在 `skipped[]` schema 允许 `filename: null` —— **P1 文本未改**，但 BDD-38 Then③「清单中每一项可对应到具体文件名」被实质削弱
3. P2 review 的 **W5 发现了此点**，给出两个选项（补 `file_id` ／ **把 BDD-38 ③ 的判据改为「按 file_id 对应」**），但分级为「**文字/schema 补充级，不阻断 approved**」
4. P4 照实现（`"filename": None` 硬编码）
5. P6 把实现当判据（pytest 注释写「可按 file_id 定位（filename 可为 null）」，只断言 `isinstance(file_id, int)`）
6. **P6.5 judge 从证据里揪出 `③ = False`**，判 BDD-38 FAIL

**根因（不是"没规则"，是执行点错位）**：
- 规则存在：`phase-cards/P1-requirements.md:245-248` 明文「**隐含扩展同样要授权**：…放宽/收紧某条 BDD 的判定边界…视为需要 `[BASELINE_CHANGE]`」
- 但唯一承载该义务的是 `rules/obligations.yaml` 的 `OBL-P1-14`（`disposition: R`），其 `review_output: P1-review.md` —— **P1 评审发生在 P2 之前，结构上不可能捕获 P2 造成的削弱**
- `gate_p2()` 的 12 项检查**无一项读 P1 的 BDD**
- `plan-eng-review.md` / `design-review.md` 对 "BDD/基线" **0 命中**
- `OBL-P7-04` 只验「BDD **数量**」吻合，不验语义

**建议**：把「P2 设计决策是否削弱某条 P1 Then 子句」挂到 **P2 评审**（而非 P1），并在 `plan-eng-review.md` 增一节检查项。

> ⚠️ **不要**做成「P2 gate 逐条核对 Then 子句」——实测该做法会造成 **19/19 全线误报**：本任务 54 条 BDD 中 19 条带 `①②③` 标号，而 P6 的 PASS 行**没有一条**逐条枚举（含最终全绿的），gate 会把它们全判红。

---

### 12. `agate-run.py` 在含 `*.log` 忽略规则的仓库**恒返回 1**（假红），三样能力全丢

**现象**：P5 卡推荐的执行入口在本仓**100% 不可用**——命令成功但 `agate-run` 退出 1，且证据与账本都没落。

**机制**（`scripts/agate-run.py:278-286`）：
```python
log_path, digest = _write_run_log(task_dir, k, command, exit_code, output)
ignored = _is_ignored(repo_root, log_path)
if ignored is True:
    sys.stderr.write("agate-run: 任务内日志被 .gitignore 覆盖（证据须入库）: ...")
    ...
    return 1          # ← 在 _record_cmd_run 之前 return
```

**本仓实况**：
```
.gitignore:87  *.log
.gitignore:94  !agate-workspace/tasks/**/P6-evidence/logs/*     ← 只给 P6-evidence 开例外
$ git check-ignore -v -- .../runs/1.log
.gitignore:87:*.log  .../runs/1.log                              ← 命中
```

**端到端实测**：跑 P2 声明的合法命令 `make check-docs` → 命令本身成功、打印「✓」，但 `agate-run` 真实 exit **1**。由于 `return 1` 发生在记账之前，**白名单校验、证据落盘、账本事件三样全丢**，等于该入口在本仓完全不可用（本次 P5 verifier 因此退回裸 bash）。

**建议**：`runs/**` 应与 `P6-evidence/logs/*` 同等豁免（两者都是「证据须入库」的 agate 产出）；或改为「已被 ignore」只 WARNING 不 `return 1`。

---

### 13. `check-changelog.py` 正则右边界不含全角括号 → 全仓历史任务全 failure

**现象**：本仓 CHANGELOG 约定写法是 `（TPV0104）`（全角括号），而脚本右边界只有半角。

**代码**（`scripts/check-changelog.py:72-76`）：
```python
rf"(^|[^0-9]){re.escape(task_id)}( |:|$|,|-)"      # 无全角 ）、无全角 ，、无全角 ：
```

**边界实测**（同一 TASK_ID，只改写法）：

| `[Unreleased]` 写法 | exit |
|---|---|
| `修复（TPV0104）…` | **1** ❌ |
| `TPV0104，全角逗号` | 1 ❌ |
| `TPV0104: 冒号` | 0 ✅ |
| `TPV0104 空格` | 0 ✅ |

**历史回放**（1603 个 commit 的 `[Unreleased]` 区段）：同一写法下 **14/14 个不同 task id 全部 exit 1**。

**严重度**：**不阻断交付**——`check-gate.py P8` 不调它，`pre-commit-gate.py` 对它仅 WARNING。

**建议**：右边界补全角 `）`、`，`、`：`。

---

### 14. `check-judge-verdict.py` 的推荐格式与 legacy 解析冲突

**现象**：`phase-cards/P6-acceptance.md:47` 给出的**推荐 PASS 行格式**本身就含 `known-failures.md`：

```
- PASS BDD-NN: pytest 全绿（引入失败 0；预存失败 N 条见 known-failures.md）(P6-evidence/...)
```

**对 legacy 任务必然失败**：该脚本会把括号里的内容当证据引用 → `结论行引用的证据不存在或不可解析: known-failures.md` → exit 1。

**对非 legacy 任务不触发**：`task_level=2` 时结论侧引用取自 `criteria[].evidence`，PASS 行的括号不被解析（TPV0104 即属此类，故未踩到）。

**建议**：二选一 —— ① 把该文件加入白名单；② 修改 P6 卡推荐格式，不把文件名写进括号（改为「见预存失败登记」）。

> 注：`judge.md:92-99` 明文写「白名单**不含** `known-failures.md`、且**禁读**、要求主 Agent 转述 baseline」——**白名单排除它是设计，不是缺陷**。真正的矛盾在「P6 卡推荐格式 ↔ legacy 解析」。

---

### 15. `SCOPE+` → `SCOPE_RESOLVED` 的落点未文档化

**现象**：`check-scope-resolved.py` 期望 `P1-requirements.md` 有 `SCOPE_RESOLVED` 标记，但 `SCOPE+` 是在 **P4** 产生的，此时 P1 已冻结禁改（P2–P8 不得修改基线）。

**TPV0104 实况**：2 条 `SCOPE+`（P4 `:512` 必要连带 / `:737` 范围外新发现），P1 内 `SCOPE_RESOLVED` 计数 **0**。最终只能改由 `P7-consistency.md` 的 frontmatter `scope_resolved:` 结构化声明承载。

**建议**：明确「P1 冻结后 SCOPE+ 的闭环标记应写在哪里」（P7 结构化声明？还是在 P1 开一个受控的追加区？）。

---

### 关于本次上报的诚实标注

- 第 11 条的**机制分析**（规则存在但义务挂在 P1-review）经独立核查者逐层验证（`obligations.yaml` / `gate_p2` 全部检查项 / 两个评审角色全文）
- 第 12 条的 exit 1 经**端到端真跑**复现，非代码阅读推断
- 第 13 条的 14/14 是**回放 1603 commit** 实测值（此前记录的 12/12 是 TPV0102 时点的快照）
- 第 14 条对 **TPV0104 本身不成立**（非 legacy），是核查者构造 legacy 任务目录时发现的
- 第 15 条属**流程空白**，非机械缺陷

## 附：验证边界（如实标注）

- 本文所有条目**均来自 PeekView 实际执行任务的现场证据**（有 commit / 日志 / 实测输出可查），非纸面推理
- 例外：**DEBT0016** 为**潜在**缺陷（未实际咬到，机制由源码阅读确认）
- 第 10 项（`--list` 假阳性）的可复现脚本见 `docs/reviews/agateon-dsh-list-false-positive-20261110.md`
- 本文**未包含**任何对 agateon 设计原则的评判——只列可复现的机械缺陷
