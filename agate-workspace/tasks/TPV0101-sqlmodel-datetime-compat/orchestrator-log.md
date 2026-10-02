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
