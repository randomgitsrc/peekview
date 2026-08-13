
## P2 progress (architect) — 2026-08-13

1. ✅ 读取 P2-dispatch-context-architect.md（派发指引：候选 A/B/C1/C2/C3、关键设计问题、minimal_validation 要求）
2. ✅ 读取 execution-roles/architect.md（P2 角色：影响域分析、候选 ≥2 + 权衡、四字段、minimal_validation）
3. ✅ 读取 P1-requirements.md（4 BDD + I1-I8；risk=low；packages=[test_cli_remote.py, Makefile]）
4. ✅ 读取 P1-review.md（3 观察项：根因指向 C 类、BDD-4 需时间界、I6 清理建议显式断言）
5. ✅ 读取 P0-brief.md（env_constraints: debug_env=make test-quick / prod_isolation 严禁 :8080 与 ~/.peekview/）
6. ✅ 读取 test_cli_remote.py（fixture :19-59，等待循环 30×0.5s，无 proc.poll()，cleanup terminate+wait(5)；17 用例：Create 6/List 4/Get 3/Delete 1/Config 2/ModeSwitching 1）
7. ✅ 读取 Makefile :163-166（test-quick = pytest tests/ -n auto --tb=short）
8. ✅ 读取 backend/pyproject.toml（:50 pytest-xdist>=3.0.0；addopts = -q --tb=short；pytestmark integration）
9. ✅ 读取 ci.yml :38（串行 pytest tests/ -v，无 -n auto，junit-xml）
10. ✅ 版本核实：pytest 9.1.1 + pytest-xdist 3.8.0（≥3.1 → xdist_group 可用）
11. ✅ 读取 ci.yml:36-40（串行 pytest tests/ -v + junit-xml，无 -n auto）
12. ✅ 版本核实：pytest 9.1.1 + pytest-xdist 3.8.0（≥3.1，xdist_group 可用）
13. ✅ minimal_validation A（xdist_group 行为）：8 测试（4 分组 g1-g4 + 4 无组 b1-b4）× 2 模式
    - 默认 -n 4（dist=load）：g1=gw0 g2=gw0 g3=gw1 g4=gw1 → **分组不 honor，跨 worker 分散**（refuted）
    - -n 4 --dist=loadgroup：g1-g4 全部 gw0 同 worker 串行；b1-b4 分散 gw1/gw2/gw3 → **honor，无组测试并行不退化**（confirmed）
    - 结论：C1 必须连带 --dist=loadgroup（放 Makefile test-quick，符合 P1 §7 不改 pyproject 全局配置 + P1 packages=[test_cli_remote.py, Makefile]）
14. ✅ minimal_validation B（poll 检测）：10 行脚本 Popen 立即 exit(3) → 0.10s 检测到 rc=3，快速失败有效（confirmed）
15. ✅ minimal_validation C（兼容性）：无 -n 时 --dist=loadgroup 正常通过（CI 串行代理 ✓）；无 -n 无 --dist 时 xdist_group 标记无副作用（单跑 ✓）
16. ✅ 读 xdist 源码 loadgroup.py/loadscope.py：LoadGroupScheduling 继承 LoadScopeScheduling，_split_scope 对无组测试返回完整 nodeid（=单测试 scope），有组测试按 @group 合并
17. ✅ 确认 test_cli_remote.py:16 已有 pytestmark=pytest.mark.integration，加 xdist_group 需合并为 list
18. ✅ 确认 TestCLIRemoteConfig 两个用例不依赖 server_url fixture（无碍分组）
19. ✅ 写出 P2-design.md（3 候选 + 权衡表 + 选择候选 1）
20. ✅ 自检：frontmatter 四字段齐全；candidate_count=3 与正文 3 候选一致；gate_commands/files_to_read/env_constraints/minimal_validation 齐全
21. ✅ [SCOPE+] 已标注：packages 收敛为 [backend/tests/test_cli_remote.py]（选型候选 1 后 Makefile 零改动，packages 不再含 Makefile）

## P2 progress (review) — 2026-08-13

1. ✅ 读取 P2-dispatch-context-review.md（派发指引 + 评审重点 6 项）
2. ✅ 读取 review-roles/review.md（CRITICAL/INFORMATIONAL 双层 + status 映射）
3. ✅ 读取 P2-design.md（候选 3 + 权衡 + 选候选 1；minimal_validation 4 项）
4. ✅ 读取 P1-requirements.md（4 BDD + I1-I8 + §7 约束 + SCOPE_RESOLVED）
5. ✅ 读取 P1-review.md（3 观察项：根因指向 C 类 / BDD-4 需时间界 / I6 显式断言）
6. ✅ 读取 test_cli_remote.py（fixture :19-59 + 17 用例；imports 无 os）
7. ✅ 读取 backend/pyproject.toml（:50 pytest-xdist>=3.0.0；addopts=-q --tb=short）
8. ✅ 读取 conftest.py（autouse isolate_config_file：tmp_path 隔离 PEEKVIEW_STORAGE__*）
9. ✅ 读取 Makefile:163-166（test-quick = -n auto --tb=short）+ ci.yml:38（串行）
10. ✅ 实证：-n auto = gw0..gw15（16 workers，80 tests 全部落点验证）
11. ✅ 实证：-n 4 = gw0..gw3；-n 1 = gw0；串行无 PYTEST_XDIST_WORKER → 回退 18888
12. ✅ 实证：xdist_group 默认 dist=load 不 honor（分散 gw0-3），--dist=loadgroup 全 gw0 → 佐证候选 2 否决
13. ✅ 实证：poll 死亡检测 0.251s 检测 rc=3（BDD-4 时间界可信）
14. ✅ 实证：串行 + --dist=loadgroup / xdist_group 标记无副作用（I5 佐证）
15. ✅ 实证：-n auto 当前复现 7 failed（Connection refused on :18888）→ 问题真实存在
16. ✅ 核实：test_config.py 的 port=3000 仅配置断言不监听（无端口冲突）
17. ✅ 发现：设计 snippet 用 os.environ，但 test_cli_remote.py 无 `import os` → P4 需补（非阻断）
18. ✅ 发现：等待循环仅 catch ConnectionError，ReadTimeout 等异常会传播且不留进程清理 → 预存行为，建议 P3/P4 加固（非阻断）
