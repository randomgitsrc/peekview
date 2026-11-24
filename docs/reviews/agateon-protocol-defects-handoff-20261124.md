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

## 附：验证边界（如实标注）

- 本文所有条目**均来自 PeekView 实际执行任务的现场证据**（有 commit / 日志 / 实测输出可查），非纸面推理
- 例外：**DEBT0016** 为**潜在**缺陷（未实际咬到，机制由源码阅读确认）
- 第 10 项（`--list` 假阳性）的可复现脚本见 `docs/reviews/agateon-dsh-list-false-positive-20261110.md`
- 本文**未包含**任何对 agateon 设计原则的评判——只列可复现的机械缺陷
