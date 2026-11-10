---
task_id: TPV0102
generated_by: verifier (P5)
---
# 已知失败登记

> **语义边界**：本文件只登记**预存失败**（P5 之前就存在的、与当前任务无关的失败）。
> 当前任务引入的失败用 P5-test-results/ 记录，不写本文件。
>
> **登记质量要求（RM-AG0053）**：每条须能**被他人复现**并**说清波及面**——只写「是预存失败」
> 等于自述，复核者无法验证（`LIMITATIONS.md` 局限 3：主 Agent 的判断力是单点故障）。

## 预存失败（非本任务引入）

| # | 测试文件 | 失败数 | 根因 | 与本任务相关 | **复现证据**（可重跑命令 + 关键输出） | **举一反三**（同类扫描结论） | 处理计划 |
|---|---------|--------|------|-------------|--------------------------------------|------------------------------|---------|
| 1 | `backend/tests/test_cli_remote.py`<br>`::TestCLIRemoteConfig::test_config_set_remote_api_key` | 1 | 该用例**未隔离 HOME**，直接 `subprocess.run([python, -m, peekview, config, set, remote.api_key, ...])` → CLI 写真实 `~/.peekview/config.yaml`。本沙箱把 `~/.peekview/` 挂为**只读文件系统** ⇒ `OSError: [Errno 30] Read-only file system` ⇒ `returncode=1`，断言 `assert 1 == 0` 失败 | 否 | `cd backend && .venv/bin/python -m pytest tests/test_cli_remote.py::TestCLIRemoteConfig::test_config_set_remote_api_key -q --tb=short`<br>→ `OSError: [Errno 30] Read-only file system: '/home/kity/.peekview/config.yaml'` / `assert 1 == 0` / **1 failed**<br>**环境侧独立佐证**：`touch /home/kity/.peekview/.p5probe` → `touch: 无法 touch '/home/kity/.peekview/.p5probe': 只读文件系统`<br>**对照组**（证明非代码问题）：同文件 `::test_config_set_remote_url` 用 `patch.dict(os.environ, {"HOME": tmp_path})` 隔离 HOME → **1 passed** | `grep -n "HOME" backend/tests/test_cli_remote.py` → 仅有 `:525`（`test_config_set_remote_url`）设了 HOME；`test_config_set_remote_api_key`（`:546-565`）**没有**。<br>同类扫描：`backend/tests/test_cli.py:556-590` 的 `config set` 系列经 `CliRunner` 在进程内跑（受 conftest `isolate_config_file` autouse 隔离）→ 未受影响。<br>结论：**唯一命中**（1 处），波及面为该单条用例 | 推迟（WARNING 级，不阻断 P5）。修复方向二选一：① 给该用例补 `HOME` 隔离（对齐 `:518-526` 的兄弟用例写法，约 6 行）；② 让 CLI `config set` 支持 `PEEKVIEW_CONFIG_FILE` env 覆盖。建议单独任务处理，不混入 TPV0102 |
| 2 | `frontend-v3/e2e/team-visibility.spec.ts:147`<br>`BDD-40: team entry 卡片有 visibility-toggle，delete 保留`（chromium + Mobile Chrome 各 1） | 2 | **fixture 缺失**：该 spec 用 `teamSlug: 'proj-a'` 造 team entry，但 `proj-a` **不在 debug seed 里** ⇒ `POST /api/v1/entries` 返回 **422** `Team not found or not accessible` ⇒ 卡片从未创建 ⇒ `:157 await expect(teamCard).toHaveCount(1)` → `Expected: 1, Received: 0`（`14 × locator resolved to 0 elements`） | 否（红因是 fixture；但**红的可见性**由本任务带来，见右列"归因附注"） | `E2E_SPEC=e2e/team-visibility.spec.ts make debug-test` → **2 failed, 6 passed**，失败点 `:157`<br>**API 侧取证**：`GET /api/v1/teams`（alice）→ `{"owned":[{"slug":"frontend-team",...}],"joined":[]}`（**无 `proj-a`**）；`POST /api/v1/entries` `team_id=proj-a` → **422**；对照 `team_id=frontend-team` → **201**（后端链路正常，仅 `proj-a` 缺） | `grep -rn "proj-a" scripts/seed-data/` → **0 命中**；seed 中实际团队 slug 为 `frontend-team`（见 `scripts/seed-data/markdown-test/meta.json`、`mermaid-charts/meta.json`）。<br>同类扫描：`grep -rn "proj-a" frontend-v3/e2e/` → 仅 `team-visibility.spec.ts` 使用（其余 spec 不依赖该 slug）→ 波及面为该 spec 的 BDD-38/39/40 三条造数（前两条内部 `if (count>0)` 守卫而静默跳过，仅 BDD-40 无守卫故真红） | 推迟（WARNING 级）。修复方向：把该 spec 的 `teamSlug` 改为 seed 实有的 `frontend-team`，或在 `scripts/seed-data/` 增建 `proj-a` 团队。**P5 未做任何修改**（只读纪律） |

### 归因附注（诚实化：不把「可见性变化」写成「新缺陷」）

第 2 条的红**根因是 fixture 缺失**（`proj-a` 不在 seed，P5 独立取证已证），与 TPV0102 的实现无关。
但须如实说明一层：TPV0102 的 `P2-design §6.4` 第 1 项把该断言由 `count = 0`（且原断言整体包在 `if ((await teamCard.count()) > 0) { … }` 守卫里）翻转为**前置** `await expect(teamCard).toHaveCount(1)`，并**显式拆掉了守卫**。
即：fixture 缺口此前被守卫掩盖为**假绿**，拆守卫后变为**真红**。这是 P2 有意要求的诚实化，不是行为回归——`[chromium]`/`[Mobile Chrome]` 两条失败都停在"卡片不存在"这一前置断言，**从未走到** `visibility-toggle` 数量断言，故不能据此判定 toggle 行为有误。

> 判定口径：本条按派发单「已知的合法失败 #2」/ `P4-review.md` T-14 登记为**既有 spec 的 fixture 缺失（非 TPV0102 缺陷）**；同时保留上述附注供主 Agent 自行裁决。**不**将其归入 TPV0102 的 P5 失败。

## 归零检查单（关闭本条前逐项核对；**参考工具，非强制 gate**）

> 双归零：**技术归零**（现象→机理→复现→措施）+ **管理归零**（归属→同类→流程）。
> 只对**已修复**的条目核对；仍推迟的条目留空即可（不阻断）。

- [ ] **现象可复述**：一行说清「什么输入 → 什么错误」
- [ ] **机理已定位**：不是「改了就好了」——说清根因链（哪一层、为什么）
- [ ] **复现可重跑**：上方「复现证据」列的命令在干净检出上**能重现**（他机/CI 亦成立）
- [ ] **措施有回归锁**：修复处有**用例锁定**（无用例的修复 = 声明，不算落地）
- [ ] **同类已扫描**：上方「举一反三」列的扫描结论**为空**（或已逐条处理/登记）
- [ ] **归属明确**（非追责）：责任在**机制**（哪个判据/文档/流程缺了），不指向具体人
- [ ] **未闭合项已登记**：仍推迟的 → `tech-debt.md`（有 owner）/ roadmap；不留口头承诺

> 上表两条均为「推迟」，故归零检查单整体留空（按模板约定）。
