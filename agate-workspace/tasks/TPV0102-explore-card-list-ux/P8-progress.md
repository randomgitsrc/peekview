
## [P8-releaser] 输入读取记录（2026-11-11）

- 协议根解析：`AGATE_ROOT=/home/kity/.agate/v0.83.2/agate`（`AGATE_VERSION=v0.83.2`，`AGATE_REASON=全局 current`）。
  ⚠️ 派发单写的是 v0.83.1，实际 current 为 v0.83.2；两个版本下 `assets/execution-roles/implementer.md` 均存在，已按 v0.83.2 读取（较新）。
- 角色文件：`assets/execution-roles/implementer.md`（P8 交付收尾模式）已读，职责边界与派发单一致：**P8 模式禁止 `git commit`**、不含 version bump / tag。
- P1-requirements.md frontmatter：`packages: [peekview, frontend-v3, docs]`（3 包）。
- P2-design.md frontmatter：`packages: [peekview, frontend-v3, docs]`（3 包，与 P1 一致）。
- P2 §9 gate_commands：`P5: make test-quick` / `P5_frontend: make test-frontend` / `P5_lint: make lint` / `P5_typecheck: make typecheck` / 三个 e2e/fitness key；**无 docs 包专用 key**（`make check-docs` 不在 gate_commands 中，属 P5 未作 gate 项）。
- P7-consistency.md：`status: approved`、blocker 0、deviation_critical 0、DG 13/13 配对。F6 = P4 frontmatter `packages: [peekview]` 笔误，**P8 范围以 P1/P2 三包为准**（P7 §7 第 6 行明示）。
- P7 §9 结论给 P8 三条注意：① 三包范围 ② 版本号对齐 DG11 的 `0.27.0` ③ F1/F2/F8 三条既有债需明确去向。
- 既有债：F1（卡片标题与 hover 操作区重叠）/ F2（BaseBadge label stale）/ F3（BDD-25 后半条不可测）/ F4（P2 VC-5 几何不可满足）/ F8（DG7 store 无退避重试）。

## [P8-releaser] 三包检查命令实跑结果（2026-11-11）

| # | 包 | 命令 | exit | 结果 |
|---|---|---|---|---|
| 1 | peekview | `make test-quick` | **2** | `1 failed, 1205 passed, 3 skipped, 25 warnings in 59.91s` —— 唯一 failed = `test_cli_remote.py::TestCLIRemoteConfig::test_config_set_remote_api_key`，**与 P5-test-results/unit.md:96 登记的同一条预存失败完全一致**（`known-failures.md` 第 1 条）。已独立复跑取证：`OSError: [Errno 30] Read-only file system: '/home/kity/.peekview/config.yaml'` —— DSH 沙箱把 `~/.peekview/` 挂只读，测试用例未 `patch.dict(HOME=tmp_path)` 隔离。计数 1205/1/3 与 P5 完全相同 ⇒ **零本任务引入回归** |
| 2 | peekview | `make lint` | **0** | `All checks passed!`（ruff, `peekview/` + `tests/`） |
| 3 | frontend-v3 | `make test-frontend` | **0** | `Test Files 119 passed (119)` / `Tests 1456 passed | 4 skipped (1460)` / 0 failed，36.6s |
| 4 | frontend-v3 | `make build-frontend` | **0** | vite build 15.68s ✓；`392 static files`；`dist=7`/`static=7` 计数一致校验通过；产物含本任务新组件（`time-display__main` / `visibility-menu` / `此 entry 无文件` 均在 bundle 中命中） |
| 5 | frontend-v3 | `make typecheck` | **0** | `✓ type check passed`（vue-tsc --noEmit） |
| 6 | docs | `make check-docs` | **0** | 环境变量命名规范 ✓ / systemd 配置 ✓ / `✓ 所有文档与代码保持一致` |

- P5 复用裁定：`AUDIT7_RESULT: reuse_allowed`（`check-p6-provenance.py --audit7-only` exit 0）——P2 `gate_commands` 的 `P5_e2e` / `P5_e2e_legacy` / `P5_fitness` 未重跑，按协议复用 P5 证据（`reuse_allowed`）。
- **构建产物核对**（P5 未作为 gate 项）：`frontend-v3/dist/index.html` 与 `backend/peekview/static/index.html` mtime 均为本次构建（04:30:19），`dist` 7 项 / `static` 7 项计数一致。

## [P8-releaser] CHANGELOG 核对 + 债务核对 + gate 自查（2026-11-11）

### CHANGELOG [Unreleased] 核对（未重写）
- `grep -c TPV0102 CHANGELOG.md` = **6**，全部在 `[Unreleased]` 内：L12 Bringing/Change，L16-19 变更×4，L23 修复×1。
- 4 项需求覆盖：需求1 = L12（后端 Z）+ L16（前端绝对时间）；需求2 = L17；需求3 = L18（主）+ L19（详情页连带）；需求4 = L23。**无遗漏，未改动**。

### ⚠️ `check-changelog.py TPV0102` exit 1（协议正则缺陷，非内容问题）
- 根因定位到 `check-changelog.py:79-83` 的右边界 `( |:|$|,|-)`——**不含全角 `）`（U+FF09）**，而本仓惯例是 `（TPV0102）`。
- 最小变体实测：`（TPV0102）` FAIL；`（TPV0102 ）`（括号内加空格）PASS；`TPV0102 ` / `TPV0102:` / `TPV0102,` / `TPV0102-` 均 PASS。
- 普遍性：CHANGELOG 全文 12 个历史 task_id **12/12 全部 exit 1**（含半角括号 `)` 写法，同样不在字符集内）。
- `pre-commit-gate.py:1086` 对该检查只输出 WARNING **不阻断**（无 sys.exit）⇒ 不会拦 P8 提交。
- **处置：未改 CHANGELOG 去凑绿灯**（改形态属为绿灯改产出 + 掩盖协议缺陷），如实记录 + 建议登记协议债。

### ⚠️ delivery.method 纠偏：`git-commit` → `release-notes`
- 派发单建议 `git-commit`，实测 **gate exit 1**：`不在快照 delivery.method_enum=['release-notes','tag-release','none'] 内`。
- 根因：本任务账本首行 `task_created` 带 `contract_level: 2` ⇒ 消费 `rules/task-data/level-2.yaml` 三值枚举。
- 取 `release-notes` 后 gate exit 2（通过码）。两条探针均已跑，非凑绿灯。

### 债务核对（debt_check: reviewed）
- `debt/tech-debt.md` 已读：最大编号 `DEBT0021`，`source_ref` 键 0 处，**未写入任何新条目**。
- 既有债 4 条（F1 卡片重叠 / F2 BaseBadge stale / F3 BDD-25 不可测 / F4 VC-5 几何不可满足）→ 全部 note/deferred，不属本任务。
- 建议新增：**DEBT0022**（F8/DG7 `stores/team.ts` 无退避重试→请求风暴，technical/medium）、**DEBT0023**（F1+F2 合并视觉/状态残留债，technical/low）。

### gate + 隔离自查
- `check-gate.py P8 $TASK_DIR` → **exit 2**（= 脚本化检查通过）；2 条 WARNING：`.agate-tmp/` 内 20 个测试收集模式文件名（ve/scripts 9 + p3probe* 7 + probe3/4/5 3 + fitprobe 1）、以及「未被忽略」已不触发（`git check-ignore` 通过）。
- `roadmap.md` 不存在 ⇒ 无 RM 条目需回写 done。
- frontmatter 自查：`bump_type=minor` / `delivery` 为 dict（method 非空、ref 5 项）/ `debt_check=reviewed` / `prod_touched=false` 全部合法。
- git 写操作 **零执行**：`git status` 仅 ` M gate-events.jsonl`（主 Agent gate 产出）+ 3 个 `??` 本阶段文件；HEAD 仍 `450ec9df`；`VERSIONS.json` diff 为空。
- 自建探针目录 `.agate-tmp/p8probe` / `p8probe2` **已自行删除**（不留给主 Agent）。
