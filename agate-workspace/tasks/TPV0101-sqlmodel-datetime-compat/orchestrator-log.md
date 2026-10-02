# TPV0101 orchestrator-log

- DECISION（2026-10-02）：立项 TPV0101 修 DEBT0019。判据——DEBT0019 命中「机制交叉」（跨 Entry/User/ApiKey/Share/Star 表 + 备份/清理/star 生命周期 + 序列化契约），按 AGENTS.md「机制交叉→走完整 agate 不可裁剪」不得 hotfix。P0-brief 由主 Agent 亲写。
- 环境自检（2026-10-02）：本地 venv sqlmodel 0.0.38 / sqlalchemy 2.0.51 / pytest 9.1.1；CI 0.0.47 / 2.0.54 / 9.1.1。核心差异=sqlmodel 版本。隔离复现 venv 可重建（TPV0100 已验证）。

- GATE FAIL（2026-10-02）：P1 requirements-review **changes_requested**（4 阻塞 M1–M4 + 2 建议 M5/M6）。评审发现真实问题（主 Agent 已独立核实）：
  - M1：§2.1 判定依据列把多个 **aware 赋值**字段（Entry.updated_at/expires_at、EntryShare.revoked_at/expires_at、EntryStar.created_at/starred_at、EntryTombstone.deleted_at、TeamMember.joined_at、Team.updated_at、EntryRead.read_at/updated_at、EntryReadStats.last_read_at/updated_at）误标为 "app 赋值 naive"；且 §4.1 同类扫描**漏扫等量级的 aware 写入面**——grep 核实：entry_service:817/828/833/857/1058、share_service:89/182/277、team_service:127/157、star_service:144、apikey_service:66、read_tracking_service:47/60/74/114/115/261 等 aware 写入点真实存在。
  - M2：BDD-15「未来条件行为承诺」不可二值判定 → 须改为当前可执行断言（依赖存在性 + 人为注入漂移实测变红）。
  - M3：BDD-17「前端展示不回归」在 domains:[backend] 下无判据 → 降为 API 契约不变 + 显式范围外声明。
  - M4：BDD-1/BDD-9 Given 未纳入 aware 值写入 naive 列场景。
  - M5/M6：BDD-16 扫描范围口径（应全表模型而非"新增/修改"）；capability `no-external-network` 措辞。
- DECISION（2026-10-02）：回派 analyst 修订（P1 retry #1）。评审结论采纳——aware 写入面是真实命中面（裸列→显式 naive 列后 aware 绑定同样过 process_bind_param，被去时区而非抛错，属独立测试覆盖点）。

- GATE FAIL→FIX（2026-10-02）：check-gate P1 首次 exit 1，拦「不合规 NEED_CONFIRM 标记格式」——根因是 P1-requirements.md L365 正文出现 `[NEED_CONFIRM]` **字样**（"无 `[NEED_CONFIRM]`"），触发 check-gate.py:723 兜底（检测到字样但无行首阻塞项）。修：改写措辞为"无阻塞级待确认项"（不出现字面标记）。复跑 exit 2 通过。属产出文案问题，非需求缺陷。
- GATE PASS（2026-10-02）：P1 通过——P1-requirements.md（18 BDD）+ P1-review.md（status:approved，round 2 重审，M1–M6 全部闭合，agent=requirements-review≠main）。

- GATE PASS（2026-10-02）：P2 设计通过——P2-design.md（candidate_count=3，选定方案 1：25 列显式 Column(DateTime(timezone=False)) + sqlmodel 依赖上限守卫）+ P2-review.md（status:approved，plan-eng-review，0 BLOCKER / 3 非阻塞 WARNING）。minimal_validation 双版本四路径各 8/8。check-gate P2 exit 2。
- GATE FAIL→FIX（2026-10-02）：check-gate P2 首跑 4 条 WARNING——gate_commands 的 P5* 键以 `cd backend && ...` 开头，gate 检查首 token 为 `cd` 非可执行文件（T075 教训）。**主 Agent 主动修复**（评审未列为 BLOCKER 但属真实隐患）：改为 `backend/.venv/bin/python -m pytest backend/tests/ --rootdir=backend` 形式（首 token 可执行），实测 collect + 真实测试通过、conftest 隔离生效，复跑 WARNING 消除。

- GATE PASS（2026-10-02）：P3 测试设计完成——P3-test-cases.md（test_code_dir=backend/tests/，18 BDD 1:1 映射，双口径：新增守卫测试走真红灯 + 既有测试走回归覆盖）+ 新增测试文件 2 个。
- 主 Agent 独立核验（不信 subagent 自报）：
  - check-tdd-red.py exit 0（TDD_CHECK: red-light unexpected test failure = B 类真红灯）
  - 隔离 venv 0.0.47 实测：10 failed / 3 passed（test_datetime_naive_compat.py 9 failed + test_dependency_guard.py 1 failed）
  - 本地 venv 0.0.38 实测：test_datetime_naive_compat.py 10 passed；test_dependency_guard.py 1 failed（无上限，与版本无关）
  - check-platform-assumptions.py 0 命中；check-gate P3 exit 2
  - 隔离性：conftest isolate_config_file（autouse，tmp_path）+ session fixture（conftest L87）；生产 DB ~/.peekview/peekview.db 未触碰；生产服务 PID 1583302 未触碰
- GATE FAIL→FIX（2026-10-02）：subagent 在 P3-test-cases.md §2 BDD-4 行声称「新增 datetime 守卫在 0.0.38 下全绿（10/10）」**不准确**（漏了 test_dependency_guard.py 在 0.0.38 也 failed）。主 Agent 实测纠正该单元格为准确表述（datetime 守卫 10 passed + dependency guard 1 failed 无上限）。§6 红灯预期汇总表原本已准确（分文件列示），无需改。

- GATE FAIL→FIX（2026-10-02）：P2 gate_commands 的 `P5_schema_guard` 键用 `-k schema` 过滤，但 P3 测试无任何用例名含 "schema" → 收集 0 测试（exit 5 = NO_TESTS_COLLECTED）。主 Agent 在 P4 自查时发现并修正为 `-k Bdd16`（BDD-16 测试类 `TestBdd16ExplicitNaiveColumns`）→ 收集 2 测试通过。属 P2 设计命令与 P3 测试命名的失配（gate_commands 命令需与实际测试名对齐）。
- 主 Agent 独立核验 P4 实现（不信 implementer 自报）：
  - ORM 枚举 25 列 / 11 表全 DateTime(timezone=False)，0 BAD；响应模型未改
  - 定向：0.0.47 = 13 passed；0.0.38 = 13 passed
  - **全量**：本地 0.0.38 = 0 failed（exit 0）；隔离 0.0.47 = **0 failed（exit 0）** ← 基线对比：还原改动后 0.0.47 全量 = 550 failed/errors（即 CI 原失败面）；证明修复真实生效
  - ruff 全绿；无新增注释；archive_delete_at description 保留
  - 过程中遇到 test_cli_remote.py::TestCLIRemoteDelete::test_delete_entry 偶发失败（integration 测试起 :18888 server，全量并行下端口/时序 flake）——单独/复跑均通过，且基线同样命中，非本改动引入

- GATE PASS（2026-10-02）：P5 技术验证通过（verifier external-output-gate）——4 个 gate_commands key 全 exit 0 / 0 failed；本地全量(0.0.38)=1186 passed；隔离全量(0.0.47, CI 等价)=1186 passed；N5 签名 count=6；fail-list.txt 空；[PROD_NOT_TOUCHED]。commit 28a2b16b；check-gate P5 exit 2。
- GATE PASS（2026-10-02）：P6 验收通过（refactor 回归口径三段式）——P6-acceptance.md pass=18 / fail=0 / regression_pass=true；P6-evidence/ 23 文件（regression.log 尾行 EXIT_CODE: 0）；BDD-15 注入漂移端到端实测；BDD-18 [PROD_NOT_TOUCHED]。四道 gate 全过（format/check-gate/evidence/provenance）。commit ba27b2ee。
- GATE FAIL→FIX（2026-10-03）：P6.5 judge 首跑 check-judge-verdict **exit 1**——BDD-15 结论行证据引用**开括号全角 `（` / 闭括号半角 `)` 不配对**，gate 仅认半角 `(...)` 逗号分隔路径 → 4 个证据（bdd_15_*）被判「未被引用」。回派 judge（**作者自修**，非主 Agent 代改）修正为半角配对；复跑 exit 0（status=passed, criteria 18/18；账本 14 行哈希链完整）。
- GATE PASS（2026-10-03）：P6.5 judge 复核通过——status=passed / criteria 18/18（零挑验），信息隔离白名单合规 + 证据交叉核对（verdict_evidence 23 文件存在非空且被引用）。commit e390b9a2（phase 保持 P6）。
- GATE PASS（2026-10-03）：P7 一致性检查通过——BLOCKER=0 / DEVIATION-CRITICAL=0 / DESIGN_GAP 0 条（P4 确无声明）/ SCOPE+ 闭环（0 增补）/ CODE-MAP 机制未采用 / decisions 目录不存在无待落决策。跨文件一致性（P1 BDD 18 ↔ P6 pass 18、P2 packages[peekview] ↔ P4 实现路径）均引源文件节名。check-gate P7 exit 0，pre-commit 钩子亦报「GATE P7 (TPV0101): 通过」。commit abebbfe9。
- GATE FAIL→FIX（2026-10-03）：P8 发布检查 `make lint` **exit 1**——4 个本任务新增测试文件引入的机械 lint 错误（3×F401 未用 import + 1×I001 import 排序）。根因：`make lint` 不在 P2 gate_commands（P5 全为 pytest），CI 亦不含 ruff，故 agate gate 链未捕获；但 AGENTS.md 铁律 #10 强制 lint/typecheck 全绿。处置：派 backend implementer 仅做 ruff autofix（attempt 1 因把两轮全量测试并入同一前台 subagent 被平台中断、零改动；attempt 2 拆分为「subagent 只 autofix + make lint」成功）。主 Agent 独立复跑：make lint exit 0 / 本地 0.0.38 全量 exit 0（1186 passed/3 skipped）/ 0.0.47 全量 exit 0（0 FAILED，100%）/ make typecheck exit 0。详见 P8-gate-diagnosis.md。因代码有变，P5 证据不走复用路径、已重跑两环境全量。
- NEXT（2026-10-03）：P8 收尾——CHANGELOG [Unreleased]→[0.26.1]（主 Agent）→ make bump-version NEW_VERSION=0.26.1（commit + tag v0.26.1）→ check-gate P8 → READY 收尾（.agate-tmp / 临时资源 / 生产未触碰）→ phase READY commit → phase DONE commit。
- RESOLVED（2026-10-03）：P8 lint 修复经 attempt 2（拆分职责：subagent 只做 autofix，长跑验证归主 Agent）完成；主 Agent 复核 make lint exit 0 + diff 仅 2 测试文件 import 区（零逻辑变更），commit 970d065b。
- GATE PASS（2026-10-03）：P8 发布完成。CHANGELOG [Unreleased]→[0.26.1]；make bump-version NEW_VERSION=0.26.1 → commit 3f0c5bb3 + tag v0.26.1；填 CHANGELOG 正文后 amend → HEAD 8450d044，**发现 tag 仍指 pre-amend 提交（缺正文）→ git tag -f 重指 HEAD**（登记 DEBT0021）。发布检查全 exit 0：make lint / make check-version / make check-changelog / make test-quick（1186 passed/3 skipped）/ 0.0.47 全量（CI 等价 0 failed）/ make typecheck。check-gate P8 exit 2；audit7=reuse_blocked → 已重跑 P5 双环境全量。
- GATE PASS（2026-10-03）：READY 收尾——临时资源清理、无调试端口、.agate-tmp 空且 ignored、[PROD_NOT_TOUCHED]（:8080 PID 1583302 未动、DB md5 d68a32c1 未变）。DEBT0019 closed（附 P5/P6 证据，agate-debt-check exit 0）；新建 docs/notes/lessons.md。commit c94f7b96。
- DONE（2026-10-03）：终态 DONE。retrospective.md（机制缺口 3 / 执行错误 2）；技术债登记 DEBT0020（lint 门禁面缺口）、DEBT0021（发布流程 tag 修正）、DEBT0018 追加第三例证据。commit 40fe578f。**人工待办（沙箱无外网）**：git push + push tag；make publish（PyPI）；pipx upgrade peekview && sudo systemctl restart peekview。
