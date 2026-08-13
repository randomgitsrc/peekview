# TPV0090 P1 progress（analyst）

## 2026-08-13

- [x] 读 P1-dispatch-context-analyst.md：目标=产出 P1-requirements.md；约束=BDD 可观察行为、domains=backend、packages=backend/tests/test_cli_remote.py(+Makefile/CI)、risk=low、P3 不可跳、无 NEED_CONFIRM（或转 SUGGEST）；标记格式行首无反引号
- [x] 读 analyst.md 角色文件：先质疑再定义、隐含需求逐维度、BDD 二值判定、P1_simplified 小任务降级模式、NEED_CONFIRM vs SUGGEST 判定
- [x] 读 P0-brief.md：task=修复 test_cli_remote.py 在 -n auto(16 workers) 下失败；known_risks=方案 A/B/C 选型留 P2、零现成覆盖→P3 不可跳、验证概率性；risk=low
- [x] 读 backend/tests/test_cli_remote.py（579 行）：fixture server_url scope=module (L19-59)，30×0.5s 等待窗口，不检测 proc.poll()、不打印 stderr；17 用例分布在 5 个测试类
- [x] 读 backend/pyproject.toml：addopts="-q --tb=short"，无 xdist 分组/串行配置；pytest-xdist 在 test extra
- [x] 读 .github/workflows/ci.yml:38：CI 串行 python3 -m pytest tests/（无 -n auto）→ CI 不受影响（确认）
- [x] 读 Makefile:163-166：test-quick 用 -n auto --tb=short
- [x] 读 TPV0088/TPV0089 known-failures.md：两次登记同源失败（4~7 failed+3 errors，-n auto 下随轮次漂移；串行 1068 passed/0 failed），均为「推迟，建议另行登记环境 issue」
- [x] 复现（2026-08-13 本次会话）：单跑 17/17 全绿（pytest tests/test_cli_remote.py -q）
- [x] 复现（-n auto，16 workers）：3 次运行分别 5 failed / 3 failed+3 errors / 9 failed，随轮次漂移
- [x] 失败细节（--tb=short）：CLI 子进程报 `Connection refused (Errno 111) 127.0.0.1:18888`——fixture 健康检查可能通过（hit 到别的 worker 的 server 或幸存 server），但 CLI 调用时端口无服务 → 证实现有多 worker 抢同一固定端口 + 不检测子进程死亡的根因
- [x] 用例统计：17 个测试（Create 6 / List 4 / Get 3 / Delete 1 / Config 2 / ModeSwitching 1）；Config 2 个不依赖 server_url，其余 15 个依赖模块级 fixture
- [x] pytest 环境：backend/.venv pytest 9.1.1 + pytest-xdist，本机 16 核 → P6 本地实测能力 available
- [x] 产出 P1-requirements.md：4 条 BDD（-n auto 连 3 次全绿 / make test-quick 全量全绿 / 单跑 17 不回归 / 失败路径可诊断），隐含需求 I1-I8 逐维度，[NO_NEED_CONFIRM] + 1 条 [SUGGEST: P2 优先论证 B+C]，capability available，risk=low，phases 全走 P3 不可跳
- [x] 自检：BDD 锚点格式 / NO_NEED_CONFIRM 与 SUGGEST 行首无反引号 / frontmatter 机器字段齐全，均通过

## 2026-08-13（requirements-review 追加）

- [x] 读 P1-dispatch-context-requirements-review.md：目标=独立评审 P1-requirements.md；重点=BDD 二值判定/隐含覆盖/跨条一致/裁剪/纯净性
- [x] 读 requirements-review.md 角色文件：只审不写；BDD 锚点 + 覆盖维度逐条引用；status 映射
- [x] 读 P1-requirements.md（104 行）：frontmatter 齐全（risk=low/phases 全走/P3 不可跳/packages 含 Makefile/domains=backend）；4 条 BDD + I1-I8 + [NO_NEED_CONFIRM] + [SUGGEST: B+C] + P1_simplified
- [x] 读 P0-brief.md：known_risks 方案 A/B/C 选型、零现成覆盖→P3 不可跳、验证概率性；与 P1 一致
- [x] 读 backend/tests/test_cli_remote.py：fixture server_url scope=module L19-59（30×0.5s，无 proc.poll() 检测、不打印 stderr），17 用例 5 类
- [x] 读 Makefile:163-166：test-quick=`pytest tests/ -n auto --tb=short`（确认）
- [x] 读 .github/workflows/ci.yml:38：CI 串行 `python3 -m pytest tests/`（无 -n auto），不受影响（确认）
- [x] 复核（requirements-review 实测）：单跑 17/17 全绿；`-n auto` 单文件复现 4 failed——失败非 "Server failed to start" 而是 CLI 子进程 Connection refused（fixture 健康检查命中其他 worker 的 server 后该 worker 实例已死/端口被抢）→ 佐证根因是多 worker 抢固定端口，且仅靠加等待/死亡检测（B 类）不足，确定性要求（I1/BDD-1）实际强制方案 C 类串行/分组
- [x] 产出 P1-review.md：approved（附非阻塞观察 3 项）
