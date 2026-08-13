# P4 progress — TPV0090-cli-remote-xdist-fix

- [x] 读取 P4-dispatch-context-implementer.md（实现规格锁定候选 1：worker 动态端口 + poll 死亡检测 + teardown 强化 + `_server_port` 纯函数 + `import os`）
- [x] 读取 implementer.md 角色定义（最小实现、自查≠gate、DESIGN_GAP/SCOPE+ 声明格式、每读一文件写 progress）
- [x] 读取 P2-design.md（§0 影响域：只改 test_cli_remote.py 一个文件；§1 候选 1 完整 fixture 代码；§8 完成标志）
- [x] 读取 P3-test-cases.md（6 用例：TC-B4a/B4d 死亡快速失败含 rc+stderr，TC-B4b/B4c1 回归护栏，TC-B4c2 kill 兜底，TC-port 用 `globals().get("_server_port")`）
- [x] 读取 backend/tests/test_cli_remote.py（现状 fixture :19-59 固定端口 18888；P3 已追加 TestCLIRemoteFixture :650-729 + `_FakeProc` + `_popen_capture`，本次零改动）
- [x] 读取 backend/tests/conftest.py（autouse isolate_config_file 用 monkeypatch 设 PEEKVIEW_STORAGE__*，不设 PEEKVIEW_SERVER__PORT → 与动态端口无冲突）
- [x] 基线确认：当前文件 ruff 通过（rc=0）；P3 红灯已提交（4 failed）
- [x] 实现：import os + `_server_port` 纯函数 + server_url fixture 改造（端口动态化 + poll 死亡检测 + teardown 强化）
- [x] 自测：串行 23/23 全绿（`pytest tests/test_cli_remote.py -q --tb=short`）
- [x] 自测：并发 `-n auto` 23/23 全绿（`--tb=no`，0 failed/0 errors）
- [x] 自测：ruff 通过（rc=0）
- [x] 残留验证：`ss` 确认 1888x 端口无监听，teardown 正常回收；早前 pgrep 命中为自匹配（pgrep 命令串含模式串），生产 pipx 服务（:8080）未触碰
- [x] 产出 P4-implementation.md

## review subagent 追加

- [x] 读取 P4-dispatch-context-review.md（派发指引：评审重点 6 项——正确性/规格一致/回归/质量/资源/测试对应）
- [x] 读取 review.md 角色定义（Pass1 CRITICAL 数据安全/正确性 + Pass2 INFORMATIONAL 代码健康）
- [x] 读取 backend/tests/test_cli_remote.py 全文件（fixture 改造 :20-68 + 既有 17 用例 + TestCLIRemoteFixture 6 用例 + `_FakeProc`/`_popen_capture`）
- [x] 读取 P2-design.md（§1 候选 1 逐行规格 + §8 完成标志 + §9 纯函数设计）
- [x] 读取 P3-test-cases.md（6 用例 Given/When/Then + 红灯预期 4 failed）
- [x] 读取 P1-requirements.md（4 BDD + I1-I8 隐含需求）
- [x] git diff HEAD 复核改动（与 P2 §1 候选 1 规格逐行比对）
- [x] 读取 backend/tests/conftest.py（autouse 隔离约定，确认不设 PORT 无冲突）
- [x] 读取 P4-implementation.md（改动清单 + 自测结果 + 完成标志对照）
- [x] 读取 P4-dispatch-context-implementer.md（实现规格锁定）
- [x] 读取 .state.yaml + P2-review.md（历史上下文 + P2 实证复核结论）
- [x] 独立复核验证：串行/并发 pytest + ruff + 残留进程检查（见 P4-review.md）
