# P8-dispatch-context-implementer — TPV0099（releaser / implementer P8 模式）

---
phase: P8
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0099
role: releaser
---

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P8

路径：phase-cards/P8-release.md
---
# P8 — 发布

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P8 + internal_only: true + internal_only_reason 已声明 → 跳过，标记 READY
> ⑨ P8 subagent 化

## 如果是首次进入本阶段

1. 主 Agent 派发 releaser subagent（implementer P8 模式）执行发布准备
   1.1 写 P8-dispatch-context-implementer.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. releaser subagent 产出 P8-release.md，**不执行 git commit/tag**
3. 主 Agent 执行 gate 验证 → 通过后执行 bump-version + CHANGELOG 更新 → 同一 commit + tag
4. 主 Agent 执行 READY 收尾检查（参考 P8-release.md 临时资源清单）
5. git add {AGATE_WORKSPACE}/tasks/{Txxx}/（含 .state.yaml + P8-release.md，若 .gitignore 忽略需 git add -f）
   ⚠️ 此时 .state.yaml 的 phase 保持 READY，不要提前写 DONE——phase = 本 commit 的产出阶段；终态 DONE 收尾随任务终态 commit 一起

## 如果是重试

→ 读 agate/rules/state-transitions.md 确认 retry 上限（P8 MAX=2）

## 执行方式

releaser subagent（implementer P8 模式）执行以下发布准备步骤：

1. 读取 P2-design.md packages 声明，确定需 bump 的包
2. 为每个 package 执行发布检查命令
3. 更新 CHANGELOG [Unreleased] → 版本号
4. 确认债务清单：读 `{AGATE_WORKSPACE}/debt/tech-debt.md`（若存在），在 P8-release.md 写入 `debt_check:` 字段（TAG0001 Phase 3）
5. 产出 P8-release.md（含 bump_type、版本号变更确认、CHANGELOG 更新确认、debt_check 字段、临时资源清单）

> **注意**：releaser subagent 不执行 bump-version / git commit / git tag，这些由主 Agent 在 gate 验证通过后亲自执行。

## 多包发布拆批（模式 2/3，条件触发）

> 仅当 P2 packages > 1 时适用。单包任务跳过本节。
> 并行上限 / 失败批 retry 见 dispatch-protocol「派发编排机制」并行规则。

多包发布时 P8 可拆批并行（模式 2 静态拆批 / 模式 3 并行）：

1. 每个 package 派一个 releaser subagent（implementer P8 模式），各写 `P8-release-{pkg}.md`
2. 各 releaser 只处理自己包的发布准备（版本 bump 建议 + CHANGELOG 更新 + 发布检查命令）
3. 所有 releaser 返回后，主 Agent 派合并 subagent 整合唯一 P8-release.md
4. 合并 subagent 需交叉核对：各包版本号不冲突、bump_type 汇总一致、CHANGELOG 变更合并无遗漏
5. 主 Agent 在 gate 验证通过后统一执行 bump-version / git commit / git tag

**合并机制**：单包时 releaser 直接产出 P8-release.md（不走合并）；多包时各 releaser 产 P8-release-{pkg}.md，合并 subagent 整合唯一 P8-release.md 供 gate 检查。

## releaser→主 Agent 交接

P8-release.md 中的**临时资源清单**是 releaser→主 Agent 的交接文件：
- releaser subagent 负责写入临时资源清单（本任务启动的临时服务/进程/数据/开发安装）
- 主 Agent 使用该清单执行 READY 收尾检查中的清理工作
- P8-release.md 由 releaser subagent 产出，主 Agent 不直接编写

## 前置条件

- [ ] P7-consistency.md 通过（无 BLOCKER / DESIGN_GAP 已配对）
- [ ] P2-design.md packages 声明（决定哪些包需要 bump）

## 产出规格

P8-release.md 必须包含：
- `bump_type: major / minor / patch`
- `debt_check: none / reviewed`——债务清单确认留痕（TAG0001 Phase 3）：`none` = 本次无关注项（合法选项，不视为失败）；`reviewed` = 已核对，建议正文附条目 id 清单。只查留痕存在，不查内容达标、不阻断发布
- 版本号变更确认（version 文件已修改）
- CHANGELOG [Unreleased] → 新版本号
- 临时资源清单：本任务启动的临时服务/进程/数据/开发安装

## gate 规则

```bash
check-gate.py P8 $TASK_DIR
```

- bump_type 字段存在
- `debt_check` 字段存在（缺失 → exit 1；内容任意，含 `none` / 未关闭债务 → 不阻断，BDD-17）
- 暂存区有 version 文件变更
- 暂存区 CHANGELOG 有变更
- 若任务在 `agate-workspace/roadmap/roadmap.md` 有关联 RM 条目（按 `task_id` 反查「关联任务」列），须先回写「状态」列为 `done`，否则阻断（RM-AG0043）

主 Agent **必须亲自执行**以下验证（不可跳过、不可委托 subagent）：
- 从 P2 packages 逐包读取发布检查命令并执行 → 全部 exit 0
- **P5 验证（TAG0016 BDD-14 精简为条件化表述，底线不变——至少一次客观验证动作不可省）**：
  跑 `python3 agate/scripts/check-p6-provenance.py --audit7-only $TASK_DIR`，读 stdout 的
  `AUDIT7_RESULT: <reuse_allowed|reuse_blocked|no_reuse_claim_possible>` 行判定：
  - `AUDIT7_RESULT: reuse_allowed`（exit 0）→ 复用同一份 `P5-test-results/`（不重新执行命令）
  - `AUDIT7_RESULT: reuse_blocked`（exit 1）或 `AUDIT7_RESULT: no_reuse_claim_possible`
    （exit 0 但结果非 reuse_allowed）→ 完整重跑 `gate_commands.P5`（exit 0 + failed==0）
   - **⚠️ 时序注意（DEBT0013）**：若 `gate_commands.P5` 的链路包含
     `check-protocol-consistency.py` 的 CHECK 7（README version badge 与最新 git tag 一致性），
     P5 重跑应安排在 **commit + 创建 git tag 之后** 进行，而非 bump 版本文件后立即重跑——
     bump 已完成、tag 尚未创建的中间状态下，CHECK 7 必然报 `badge vX.Y.A != tag vX.Y.B` ERROR，
     这是设计使然（校验的是"发布完成态"），不是回归。先 tag 后重跑即 0 ERROR。
- `git log v{prev_version}..HEAD --oneline` 对照 CHANGELOG 无遗漏
- 从 P2 packages 验证 version 文件路径

## READY 收尾检查（P8 gate 通过后）— 主 Agent 亲自执行（不派发 subagent）

参考 P8-release.md 临时资源清单执行清理。以上检查项无 gate 脚本自动验证（已知缺口），**必须逐项实际执行检查命令**（如 `ps aux | grep debug` 确认服务已停止、`git status` 确认工作区干净），不得仅凭记忆打勾。

**状态与版本**：
- [ ] .state.yaml phase == READY
- [ ] {AGATE_WORKSPACE}/tasks/active-tasks.md 任务行状态已更新
- [ ] git 工作区干净
- [ ] git tag 已创建
- [ ] 若本任务触发复盘（异常模式 / 发现机制缺口 / 高价值任务），复盘产出
  `tasks/{Txxx}/retrospective.md` 基于 `agate/assets/templates/retrospective-template.md`
  模板撰写

**测试环境已清理**：
- [ ] 调试服务/进程已停止
- [ ] 临时数据已删除
- [ ] 测试占用的端口已释放

**开发环境已还原**：
- [ ] 开发安装已卸载
- [ ] 系统环境无污染
- [ ] 项目依赖恢复到发布版本

**协议一致性（改造协议自身的任务必做，TAG0001-0003 批次 D4 教训）**：
- [ ] **在干净 checkout 上跑一次 `check-protocol-consistency.py`**（`git clone` 到临时目录或 CI 兜底确认），0 ERROR
  - 原因：本地 worktree 的 `.worktrees` 路径过滤会掩盖任务产出文件的扫描问题，本地 0 ERROR ≠ CI 0 ERROR
  - 若无法干净 checkout，**至少确认 CI 的 consistency job 对本次 PR 通过**
- [ ] **确认任务产出目录（`docs/tasks/` 或 `{AGATE_WORKSPACE}/tasks/`）不被一致性检查器误扫**（若为 dogfooding 任务，任务产出应已在 `NARRATIVE_DIRS` 白名单）

**生产环境无残留**：
- [ ] 无 PROD_TOUCHED 标记（触发写 `[PROD_TOUCHED] {描述}`，未触发写 `[PROD_NOT_TOUCHED]`）
- [ ] 生产数据/API 未被测试写入

## 推进条件（全部满足才写 phase: READY）

- [ ] bump-version 完成 + P5 验证全绿（重跑或复用 `P5-test-results/`，见上方「gate 规则」条件化表述）
- [ ] CHANGELOG 已更新
- [ ] git tag 已创建
- [ ] READY 收尾检查全部通过

## 常见错误

1. **不重跑 P5 gate**：bump-version 后直接 tag，不确认测试仍全绿
2. **CHANGELOG [Unreleased] 留在模板状态**：版本 bump 完但 CHANGELOG 没更新
3. **忘记清理测试环境**：debug server 还在跑、临时数据没删 → READY 不干净
4. **临时资源清单遗漏**：P4/P5 阶段启动的服务/安装的包没记录 → 清理时遗漏
5. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- READY → DONE：任务完成，代码可合并/发布
- 本任务是 agate 链条的终点——P8 完成后任务状态转为 DONE

> 完成 → 任务 DONE
<!-- AGATE_CARD_END -->

> ⚠️ 以下派发指引是本次任务的强制指令。**你是 releaser（implementer P8 模式）：只产出文件，不执行 `bump-version` / `git commit` / `git tag`** —— 那些由主 Agent 在 gate 通过后亲自执行。

## 目标

为 TPV0099（全屏模式链接 `/{slug}/f`）做**发布准备**：产出 `P8-release.md`，含 `bump_type`、版本号变更建议、CHANGELOG 更新确认、`debt_check` 字段、**临时资源清单**。

## 输入文件

1. `P2-design.md` 的 `packages:` 声明（决定需 bump 的包）
2. `CHANGELOG.md`（`[Unreleased]` 现状）
3. `VERSIONS.json`（当前版本）
4. `P7-consistency.md`（一致性检查结论：0 BLOCKER / 4 DEVIATION）
5. `P6-acceptance.md` / `P6.5-judge-verdict.md`（验收与 judge 结论）
6. `agate-workspace/debt/tech-debt.md`（债务清单）
7. `Makefile`（发布检查命令）

---

## 已核实的事实（主 Agent 已查证，可直接采信）

| 项 | 值 |
|---|---|
| **P2 `packages`** | `[frontend-v3, docs]` —— **注意：不含 `backend`**（本任务后端零改动） |
| **当前 `VERSIONS.json`** | `peekview: 0.24.1` / `mcp_server: 0.12.0` |
| **`CHANGELOG.md` `[Unreleased]`** | **已含**本任务的「新增」条目（全屏模式链接 `/{slug}/f`）+ TPV0096 的三条（新增/修复）——**需你确认这些条目是否应随本次一起发版**（见下方"关键判断"） |
| **`agate-workspace/roadmap/roadmap.md`** | **不存在**（该目录为空）→ gate 的 RM-AG0043 roadmap-done 检查**不会触发**（主 Agent 已读 `check-gate.py` 确认该分支在文件不存在时跳过） |
| **MCP 包** | 本任务**未改动** `packages/mcp-server/` → **MCP 不 bump** |
| **后端** | 本任务**未改动** `backend/` → 后端随 peekview 版本（同一 package） |

### ⚠️ 关键判断：本次 bump 的范围（**请你给出结论并说明依据**）

`CHANGELOG.md` 的 `[Unreleased]` 区**不仅有本任务的条目**，还有 **TPV0096 的三条**（渲染类 E2E spec 自建 entry 化 / mermaid-visual 假绿修复 / 死选择器与路由迁移 / E2E 编写规范）。

**先例参考（请自行核对）**：项目历史任务（如 `TPV0093`）在 P8 时把 `[Unreleased]` **整体**移入新版本号下——即 `[Unreleased]` 区是**累积区**，发布时整体归版。

→ 请读 `CHANGELOG.md` 与 `git log` 判断：`[Unreleased]` 里的 TPV0096 条目是否**尚未发版**（若 `0.24.1` 之后未发过版，则应随本次一起归入新版本）。**给出你的结论 + 依据**，供主 Agent 复核。

### 版本号建议（**请你判断，不要照抄**）

本任务是**用户可见新功能**（新增全屏分享链接入口）→ 按 semver 应为 **minor**（`0.24.1` → `0.25.0`）。

**但请你自己核对**：`VERSIONS.json` 当前是 `0.24.1`（patch 位非 0），而 `CHANGELOG.md` 已有 `[0.24.1]` 段落。请对照 git tag 历史确认"下一个版本号应是什么"，并给出依据。

## 需要执行的发布检查（**只读/检查类，不 bump、不 commit、不 tag**）

1. 读 `P2-design.md` 的 `packages:` → 确定需 bump 的包（预计：`peekview`；MCP 不 bump）
2. 对每个 package 找出并**执行**其发布检查命令（参考 `Makefile`：`pre-publish-quick` = `dev + check-version + check-changelog + test-quick + verify-wheel`）。**记录实际 exit code**
3. 读 `agate-workspace/debt/tech-debt.md` → 确认债务清单，在 `P8-release.md` 写 `debt_check:` 字段
   - `reviewed` = 已核对（**建议**，并在正文附条目 id 清单）；`none` = 本次无关注项
   - 本任务期新登记债务：**DEBT0013**（banner 不在 zen 隐藏集，open）/ **DEBT0014**（agate 内置 vitest formatter 环境变量传输出缺陷，protocol）/ **DEBT0015**（check-scope-resolved 真空盲区，protocol）/ **DEBT0016**（check-p6-provenance 奇数 `---` 吞尾，protocol）—— **前 3 条为 open，请如实反映**
4. 产出 `P8-release.md`

## ⚠️ 你的产出**不包含**以下动作（主 Agent 亲自执行）

- ❌ `make bump-version`（主 Agent 在 gate 通过后执行）
- ❌ `git commit` / `git tag`
- ❌ 修改 `VERSIONS.json` / `CHANGELOG.md`（**你只给建议**；实际 bump 由主 Agent 做）

## 产出规格（`P8-release.md` 必含）

- `bump_type: major / minor / patch`（frontmatter 或正文声明，gate 会读）
- `debt_check: none / reviewed`（**gate 硬校验该字段存在**，缺失 → exit 1）
- **版本号变更建议**（现版本 → 目标版本 + 依据）
- **CHANGELOG 更新确认**（`[Unreleased]` → 新版本号的归版建议 + 是否含 TPV0096 条目的结论）
- **临时资源清单**（**releaser→主 Agent 交接文件**：本任务启动的临时服务/进程/数据/开发安装）——**必须如实列出**，主 Agent 据此做 READY 收尾清理
- 发布检查命令的**实际执行结果**（命令 + exit code）

### 临时资源清单（请特别用心）

据主 Agent 掌握，本任务全程涉及：
- **debug backend `:8888`**（`make debug-start`，数据目录 `/tmp/peekview-debug/`）—— **当前**由主 Agent 挂在长托底 job 下运行
- **Chrome CDP `:18800`**（外部既有服务，**非本任务启动**，不应停止）
- **`.agate-tmp/`** 下的探针脚本与截图（**未纳入 git**）
- **debug DB 中的测试 entry**（E2E 自建；已清理，残留 0）
- 是否存在**开发安装**（`pip install -e` 等）？—— 本任务**未做**任何安装操作（请核实并记录）

→ **请你自行核查**（不要照抄上表），列出你实际发现的临时资源，标注哪些**应清理**、哪些**不应动**（如 CDP 属外部）。

## 环境与纪律（强制）

- **严禁**触碰生产 `:8080`、`~/.peekview/`、生产数据库
- **严禁**执行 `bump-version` / `git commit` / `git tag` / `make publish`
- debug `:8888` 已运行；**不要**停止它（主 Agent 负责收尾清理）
- 临时产物落 `/home/kity/oclab/peekview/.agate-tmp/`
- **任何 bash 命令设 `timeout 180s <cmd>`**（`pre-publish-quick` 类 600s）
- 子派发能力：不启用

## 门槛（什么算完成）

- `P8-release.md` 存在且含 `bump_type` + `debt_check` + 版本建议 + CHANGELOG 确认 + **临时资源清单** + 发布检查实跑结果
- 发布检查命令已**实际执行**并记录 exit code（**不得只写"建议执行"**）
- 未执行任何 git/bump/publish 动作

## 返回给我（只三行）

1. 产出文件路径
2. **一句话结论**（bump_type + 目标版本 + 发布检查 exit code）
3. **临时资源清单摘要**（哪些需清理 / 哪些不应动）

**不要返回文件全文。**

> 本文件不含通过/失败预判。
