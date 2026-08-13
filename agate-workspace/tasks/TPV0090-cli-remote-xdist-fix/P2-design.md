---
phase: P2
task_id: TPV0090-cli-remote-xdist-fix
type: design
parent: P1-requirements.md
trace_id: TPV0090-P2-20260813
status: draft
created: 2026-08-13
agent: architect
# ── v2.0 机器字段 ──
candidate_count: 3
packages: [backend/tests/test_cli_remote.py]
domains: [backend]
ui_affected: false
---

# P2 方案设计 — test_cli_remote.py xdist 并发失败修复

## 0. 影响域分析

### 改什么

| 文件 | 改动点 | 性质 |
|------|--------|------|
| `backend/tests/test_cli_remote.py` | `server_url` fixture（:19-59）：① 端口从固定 `18888` 改为 **worker 动态端口**；② 等待循环加 `proc.poll()` 死亡检测 + 失败时打印 stderr 摘要；③ teardown 强化（`terminate` → `wait(5)` → 超时 `kill()` 兜底） | 测试基础设施 |

### 不改什么（明确边界）

- `Makefile`（`test-quick` 保持 `pytest tests/ -n auto --tb=short` 原样，不改调用参数）
- `backend/pyproject.toml`（pytest addopts、`pytest-xdist>=3.0.0` 声明均不动；P1 §7 硬约束）
- `.github/workflows/ci.yml`（CI 串行路径，I5 硬约束）
- `backend/peekview/cli.py`、业务代码、schema、API（I8 硬约束）
- 17 个测试用例体（`TestCLIRemoteCreate/List/Get/Delete/Config/ModeSwitching` 断言逻辑零改动）

### 风险在哪

- 端口计算依赖 `PYTEST_XDIST_WORKER` 环境变量格式（`gw0`..`gwN`）：已实测 3.8.0 命名稳定，单跑/CI 无该变量时回退 `18888`（与原行为逐位一致）→ 风险低
- 16 worker 同时各起一个 server 进程（资源开销与现状相同——现状 16 worker 本就各跑一份 module fixture，只是抢同一端口；本方案仅把端口隔离）
- 端口范围 `18888`~`18903`（16 workers 上限）：不触碰 3000/8000/8080/8888 等常用端口；`test_config.py` 用 3000 仅做配置断言不实际监听，无冲突（已 grep 验证）

## 1. 候选方案

> 全部候选均内置 **B 子方案**（`proc.poll()` 死亡检测 + stderr 诊断，BDD-4 必需）与 **teardown 强化**（I6 必需），差异仅在"消除端口竞争"的机制。方案 A（等待窗口 30→60 次）为 P1 已论证的治标陪衬，仅作为比较基线，不列为候选。

### 候选 1（选型）：worker 动态端口 + 死亡检测 + teardown 强化

**机制**：fixture 读取 `PYTEST_XDIST_WORKER` 环境变量（xdist 注入，值 `gw0`..`gw15`），推导端口 `18888 + worker_index`；无该变量（单跑/CI）回退固定 `18888`。每 worker 一个独占端口 → 端口竞争从机制上消除，无需任何 pytest 调度参数改动。

```python
@pytest.fixture(scope="module")
def server_url(tmp_path_factory):
    data_dir = tmp_path_factory.mktemp("peekview_data")
    db_path = data_dir / "test.db"
    worker = os.environ.get("PYTEST_XDIST_WORKER")
    port = 18888 + int(worker[2:]) if worker else 18888  # gw0..gw15 → 18888..18903
    env = {
        **dict(subprocess.os.environ),
        "PEEKVIEW_STORAGE__DATA_DIR": str(data_dir),
        "PEEKVIEW_STORAGE__DB_PATH": str(db_path),
        "PEEKVIEW_SERVER__PORT": str(port),
    }
    proc = subprocess.Popen(
        [sys.executable, "-m", "peekview", "serve", "--port", str(port)],
        env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    url = f"http://127.0.0.1:{port}"
    # 死亡检测（B）：每轮先 poll()，死亡立即 terminate+raise，报错含 stderr 摘要
    for _ in range(30):
        if proc.poll() is not None:
            out, err = proc.communicate(timeout=2)
            raise RuntimeError(
                f"Server failed to start (rc={proc.returncode}); stderr: {err.decode()[-500:]!r}"
            )
        try:
            resp = requests.get(f"{url}/health", timeout=1)
            if resp.status_code == 200:
                break
        except requests.ConnectionError:
            time.sleep(0.25)
    else:
        proc.terminate()
        raise RuntimeError("Server failed to start")
    yield url
    # teardown 强化（I6）：terminate → wait(5) → 超时 kill()
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=5)
```

**优点**：
- 零配置改动：不改 Makefile / pyproject / ci.yml，BDD-1/2/3 验收命令与 P1 原文逐字一致（`-n auto` 裸命令直接生效）
- 保留 module scope 共享语义：同 worker 内 17 用例共享一个 server（worker 内 fixture 缓存），无效率损失
- 保留进程级集成测试意图（I4）：真实 server 子进程 + 真实 CLI 子进程不变
- 单跑/CI 回退 `18888`：与修复前行为逐位一致（I5），无分叉
- 机制确定性（I1）：端口唯一映射无碰撞，不依赖时序

**缺点/风险**：
- 依赖 `PYTEST_XDIST_WORKER` 命名约定（`gw` + 数字）：3.8.0 实测稳定，若未来版本改名则需同步（低概率，且回退分支保证不崩）
- worker 数上限隐含端口范围：`-n auto` 当前 16，扩展到 >1000 才触顶（不现实）

**工作量**：单文件 fixture 内 ~10 行改动。

### 候选 2：`pytestmark = xdist_group("cli_remote")` + 全局 `--dist=loadgroup`

**机制**：文件级 `pytestmark = pytest.mark.xdist_group("cli_remote")`（与现有 `pytestmark = pytest.mark.integration` 合并为 list），使该文件所有用例同组，在单 worker 串行执行。**关键前提（已实测）**：xdist_group 仅在 `--dist=loadgroup` 调度下 honor，默认 `dist=load` 下完全无效（分组测试仍分散到多 worker）→ 必须全局启用 loadgroup，即修改 `pyproject.toml` addopts 加 `--dist=loadgroup`。

**优点**：分组机制语义清晰、自文档化；同组测试确定性同 worker。

**缺点/风险**：
- **违反 P1 §7 硬约束**：必须改 `backend/pyproject.toml` 的 pytest 全局配置（addopts 加 `--dist=loadgroup`），否则 BDD-1 裸命令 `pytest tests/test_cli_remote.py -n auto` 不 honor 分组 → 验收失败；改全局需走 SCOPE+ 批准
- 全局调度模式从 load 变 loadgroup：实测无组测试在 loadgroup 下按单测试 scope 分派（并行度不退化），但仍属全局行为变更，回归风险面 > 候选 1
- `--dist=loadgroup` 只放 Makefile 则 BDD-1 裸命令仍失败（Makefile 参数不进入裸命令）→ 无解，必须全局

**工作量**：pyproject.toml 1 行 + test_cli_remote.py 1 行 + SCOPE+ 流程成本。

### 候选 3：Makefile 拆两次 pytest 调用（-n auto 跑其余 + 串行跑该文件）

**机制**：`test-quick` 改为两条命令：`pytest tests/ -n auto --ignore=tests/test_cli_remote.py` + `pytest tests/test_cli_remote.py`（串行）。该文件不进 xdist。

**优点**：机制直观；该文件天然单进程无竞争。

**缺点/风险**：
- **违反 BDD-1 验收条件**：BDD-1 Given 明确要求 `pytest tests/test_cli_remote.py -n auto`（16 workers 并发执行该文件）——Makefile 拆跑后该命令仍会复现端口竞争（拆跑只影响 make test-quick 路径，不改变裸命令行为）→ 验收失败
- **违反 I1 确定性**：用户/CI 直接跑该文件 `-n auto` 仍失败，问题未从机制上消除，只是从默认命令里藏起来
- Makefile 变复杂（P1 §7 关注"其余模块并行能力不退化"，拆跑后其余模块并行不变，但该文件串行拖总耗时）

**工作量**：Makefile 2 行 + test_cli_remote.py 仍需 B 子方案。

## 2. 权衡对比与选择

| 维度 | 候选 1（动态端口） | 候选 2（xdist_group+全局 loadgroup） | 候选 3（Makefile 拆跑） |
|------|-------------------|-------------------------------------|------------------------|
| 满足 BDD-1 裸命令 `-n auto` | ✅ 天然满足 | ⚠️ 需改全局 addopts（SCOPE+） | ❌ 裸命令仍复现竞争 |
| 满足 BDD-2 make test-quick | ✅ | ✅（全局 loadgroup 下） | ✅ |
| 满足 BDD-3 单跑不回归 | ✅ 回退 18888 逐位一致 | ✅ | ✅ |
| 满足 BDD-4 死亡检测 | ✅（B 子方案） | ✅（B 子方案） | ✅（B 子方案） |
| 满足 I1 确定性 | ✅ 唯一映射无碰撞 | ✅ | ⚠️ 依赖用户不用裸命令 |
| 满足 I3 无端口竞争 | ✅ 机制级消除 | ✅ 机制级消除 | ⚠️ 仅默认命令路径 |
| 满足 I4 保留集成意图 | ✅ | ✅ | ✅ |
| 满足 I5 CI 不改变 | ✅ | ⚠️ addopts 影响 CI 串行（实测兼容但全局变更） | ✅ |
| 遵守 P1 §7 不改 pyproject.toml | ✅ | ❌ 必须改 | ✅ |
| 改动面 | 单文件 ~10 行 | pyproject + 测试文件 + SCOPE+ | Makefile + 测试文件 |
| 全局回归风险 | 无（零全局配置改动） | 中（全局调度模式变更） | 低 |
| 资源开销 | 16 server（与现状相同） | 1 server（组内串行） | 1 server |

**选择：候选 1（worker 动态端口 + B 死亡检测 + teardown 强化）**。

理由：
1. **唯一满足全部 4 条 BDD 且不违反任何 P1 约束**的方案——BDD-1/3 验收命令保持 P1 原文，无需改 pyproject.toml / Makefile / ci.yml
2. **机制确定性**：端口按 worker 索引唯一映射（0..15 → 18888..18903），无碰撞、无时序依赖，比"分组串行"更本质地消除竞争（I1/I3）
3. **单跑/CI 零分叉**：无 `PYTEST_XDIST_WORKER` 时回退 `18888`，与修复前行为逐位一致（I5）
4. 改动面最小（单文件），全局回归风险最低；资源开销与现状持平（16 worker 本就各起一份 module fixture）

> [SCOPE+] 发现：P1 的 `packages` 声明含 `Makefile`，但选型候选 1 后 **Makefile 零改动**（`test-quick` 原样）。
> 必须做的理由：packages 字段用于 P8 多包发布消费，应反映真实改动面，不虚列未改动文件。
> 影响：P2-design.md `packages: [backend/tests/test_cli_remote.py]`（收敛）；P1 baseline 无需新增 BDD（约束 §7 仍满足）。

## 3. BDD 映射

| BDD | 实现机制 | 验收方式 |
|-----|---------|---------|
| BDD-1（`-n auto` 连续 3 次零失败） | 每 worker 独立端口，无竞争 | gate_commands.P5_cli_remote 连续 3 次（P6 实测） |
| BDD-2（make test-quick 全绿） | 同上，全量套件下该文件各 worker 端口隔离 | gate_commands.P5（P6 实测） |
| BDD-3（单跑 17/17 不回归） | 无 xdist 时回退 `18888`，行为不变 | gate_commands.P5_serial |
| BDD-4（server 死亡快速失败 + 诊断） | B 子方案：每轮 poll()，死亡 ≤1s 内 raise，报错含 rc + stderr 摘要 | P3 fixture 级测试（monkeypatch Popen 模拟立即死亡） |

**BDD-4 时间界量化**（P1-review 观察①）：轮询步长 0.25s，每轮先 `poll()` 再 `requests.get`；子进程死亡后 **≤1s 内** 失败（完整 15s 窗口的 1/15）。P3 断言阈值：`fixture 失败耗时 < 5s`（宽松界，实际 ~0.1-1s）。

## 4. gate_commands

```yaml
gate_commands:
  P3: "cd backend && .venv/bin/python -m pytest tests/test_cli_remote.py -v --tb=short"
  P5: "cd backend && .venv/bin/python -m pytest tests/ -n auto --tb=short"
  P5_cli_remote: "cd backend && .venv/bin/python -m pytest tests/test_cli_remote.py -n auto -q --tb=no"
  P5_serial: "cd backend && .venv/bin/python -m pytest tests/test_cli_remote.py -q --tb=no"
  project_module: "peekview"
```

- P3：TDD 红灯/绿灯用（含新增 fixture 级测试），verbose 供 check-tdd-red.sh
- P5：BDD-2 等价命令（`make test-quick` 的展开，Makefile 不改故与 target 语义一致）
- P5_cli_remote：BDD-1 单文件并发验证（P6 连续 3 次）
- P5_serial：BDD-3 单跑回归
- P5_e2e：**不声明**（ui_affected: false，纯测试基础设施）

## 5. files_to_read（P4 实现参考清单）

```yaml
files_to_read:
  - path: backend/tests/test_cli_remote.py:19-59
    why: server_url fixture 主体，本次全部改动集中于此（端口计算 + poll 检测 + teardown）
  - path: backend/tests/test_cli_remote.py:15-17
    why: pytestmark 现状，确认 module scope fixture 与 17 用例的依赖关系
  - path: backend/tests/conftest.py
    why: 确认全局 fixture 隔离约定（PEEKVIEW_STORAGE__* 指向 tmp），端口改动不与全局约定冲突
```

> Makefile / pyproject.toml / ci.yml **不需要** P4 读取——本次选型零改动这些文件，读取会撑爆上下文。

## 6. env_constraints

```yaml
env_constraints:
  debug_env: "cd backend && .venv/bin/python -m pytest tests/test_cli_remote.py -n auto -q --tb=no（修复验证）；make test-quick（BDD-2 全量）"
  isolation_check: |
    测试全部走 tmp_path_factory 临时目录（PEEKVIEW_STORAGE__DATA_DIR/DB_PATH 已注入）；
    server 端口 18888+worker_index，不触碰生产端口（:8080）；
    复现/验证后确认无残留进程：pgrep -f "peekview serve --port 1888" 应为空（I6 断言辅助）
  xdist_behavior: "依赖 pytest-xdist 注入 PYTEST_XDIST_WORKER（gwN 命名，3.8.0 实测）；单跑/CI 无该变量回退 18888（与现状逐位一致）"
  prod_isolation: "严禁触碰 :8080 生产服务与 ~/.peekview/（P0-brief 继承）"
```

## 7. minimal_validation

```yaml
minimal_validation:
  assumption: "xdist_group 标记在默认 pytest -n 模式下 honor 分组（C1 前提）"
  method: "8 测试（4 分组 g1-g4 + 4 无组 b1-b4）× 2 模式实测：默认 -n 4 vs -n 4 --dist=loadgroup"
  result: "refuted"
  note: |
    默认 dist=load 下 g1=gw0/g2=gw0/g3=gw1/g4=gw1（分组**不 honor**，跨 worker 分散）；
    --dist=loadgroup 下 g1-g4 全部 gw0（honor，同 worker 串行），无组 b1-b4 分散 gw1/gw2/gw3（并行不退化）。
    → C1 必须连带全局 --dist=loadgroup（改 pyproject.toml），违反 P1 §7，候选 1（动态端口）因此更优。

  assumption2: "PYTEST_XDIST_WORKER 环境变量在 worker 内可见且可推导唯一端口（C3 前提）"
  method: "16 个测试 × -n 16 实测：各 worker 记录 PYTEST_XDIST_WORKER 值并推导 port=18888+index"
  result: "confirmed"
  note: |
    gw0..gw15 全部可见，端口 18888..18903 逐一唯一无碰撞；
    单跑（无 xdist）无该变量，回退 18888（与现状一致）。

  assumption3: "poll() 死亡检测可实现快速失败（B 前提）"
  method: "10 行脚本：Popen 启动立即 exit(3) 的进程，循环内 poll() 检测"
  result: "confirmed"
  note: "0.10s 内检测到 rc=3 并捕获 stderr，快速失败机制有效，远小于 15s 完整窗口"

  assumption4: "无 -n 时 --dist=loadgroup 与 xdist_group 标记无副作用（CI 串行代理）"
  method: "单跑（无 -n）加 --dist=loadgroup / 带 xdist_group 标记各跑一次"
  result: "confirmed"
  note: "两者均正常通过（xdist 未激活时参数/标记被忽略）；佐证 CI 串行路径不受任何候选方案影响（I5）"
```

## 8. 实现完成标志（供 P3/P5 判定）

1. `server_url` fixture 端口 = `18888 + worker_index`（xdist 时）/ `18888`（单跑时），URL 与端口一致
2. 等待循环每轮先 `proc.poll()`，死亡时 `raise RuntimeError` 且报错含 `rc={returncode}` 与 stderr 摘要
3. teardown：`terminate()` → `wait(timeout=5)` → 超时 `kill()` + `wait(5)` 兜底
4. 新增 fixture 级测试（P3）：模拟 server 立即死亡 → fixture ≤5s 失败且报错含诊断；模拟正常启动 → 行为不变
5. `pytest tests/test_cli_remote.py -q`：17/17 全绿（与修复前一致）
6. `pytest tests/test_cli_remote.py -n auto -q`：连续 3 次 0 failed / 0 errors
7. `make test-quick`：全量套件全绿
8. 无残留：`pgrep -f "peekview serve --port 1888"` 为空（多 worker 端口 18888-18903 均释放）

## 9. P3 测试设计要点（供 test-designer 参考）

- 新增 fixture 级测试文件（或并入 test_cli_remote.py）：`monkeypatch` 替换 `subprocess.Popen` 返回立即退出的假 proc（`poll() -> 3`），断言 fixture raise 且 `RuntimeError` 消息含 `rc=3`；时间断言 `< 5s`
- 端口推导纯函数化（`_server_port(worker_env) -> int`）以便直接单测：`gw0→18888, gw7→18895, None→18888`
- teardown 断言：Popen 假 proc 记录 `terminate/wait/kill` 调用序列，断言超时路径触发 kill
- I6 显式回收断言（P1-review 观察③）：测试结束后 `pgrep -f "peekview serve --port 1888"` 为空（真实进程场景，可放 P5 手工验证或 P3 集成断言）
