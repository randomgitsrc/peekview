# P3 progress — TPV0102 explore-card-list-ux

## [1] 输入读取完成
- 角色定义：`~/.agate/v0.83.1/agate/assets/execution-roles/test-designer.md`（AGATE_ROOT 解析为 v0.83.2）
- dispatch-context（含 AGATE_CARD P3）读完
- P1-requirements.md：30 条 BDD（01-30）分组确认——时间显示 01-06 / 序列化 07-12 / 文件数 13-15 / 可见性菜单 16-24 + 27-30 / 0 文件空态 25 / 人工路径 26
- P2-design.md §1.1 改动面 + §3.1-3.8 详细设计 + §6 测试策略 + §8 minimal_validation + §9 gate_commands + §10 files_to_read
- P2-review.md：C-1 ~ C-23 执行约束（C-6 函数名写死 / C-14 六个前端 spec / C-15 断言条数自检 / C-19 0 文件 entry 走 HTTP API）

## [2] 关键契约（P2 冻结，测试按此写）
- `backend/tests/test_utc_serialization.py` 文件名 + `test_mixin_not_in_table_mro` 函数名（`-k` 子串，零命中 pytest exit 5）
- BDD-07 遍历口径：非 `table=True` 且不被任何 `table=True` 模型继承 → **不硬编码 15/31**
- BDD-12 **不得**写成 pytest 用例（conftest autouse 隔离 → tmp DB 恒绿假象）
- `visibility-options.ts`：`buildVisibilityOptions({isPublic, currentTeamSlug, teams, teamsFailed?}) -> {items, teamSubmenu, teamsFailed}`
- `visibility-target.ts`：`toPatchPayload` / `needsConfirm`
- tooltip：只有自定义 DOM 元素 + `visibility` + `role="tooltip"` 可断言（原生 `title` / CSS `::after` 命中 0；`opacity:0` 的 isVisible 仍 true）
- E2E 文件名写死：`frontend-v3/e2e/tpv0102-explore-card-list-ux.spec.ts`

## [3] 环境实测（venv pydantic 2.13.4 / sqlmodel 0.0.38）
- `@field_serializer("*", when_used="json", check_fields=False)` 在 mixin 内原型实测：json 模式 → `2026-11-10T09:43:00Z`，python 模式 → `datetime` 对象（when_used 隔离成立）
- `model_construct(**{...})` 可绕过必填字段校验（缺失非 datetime 必填字段时 model_dump 仍可用）→ BDD-07 用 model_construct 实例化叶模型
- `python3` 裸调用在 gate 脚本内合法；测试代码内避免平台字面量

## [4] P3-test-cases.md 已落盘
- 30 条 BDD 1:1 映射表（§1），每条测试名引用 BDD 编号
- `test_code_dir: backend/tests/ frontend-v3/src/ frontend-v3/e2e/ scripts/`
- 声明 10 个新增文件；BDD-12 改走 `scripts/audit-utc-semantics.py`（P2 §6.1 约束 3 强制，不进 pytest）
- §2 后端 10 用例 / §3 前端 7 spec / §4 E2E 28+7 视觉契约
- §5 红灯原因自查表（全部 B 类「被测模块未实现」+ 明确列出 4 处非红灯正向护栏）
## [5] backend/tests/test_utc_serialization.py + scripts/audit-utc-semantics.py 已落盘
- 14 个 test_ 函数（BDD-07 x4 / BDD-08 x5 含 `test_mixin_not_in_table_mro` / BDD-09 x2 / BDD-10 x4 / BDD-11 x3 / BDD-12 守卫 x1）
- BDD-07 遍历口径：非 table 且不被任何 table 模型继承；**不硬编码 15/31**（下限保护 ≥10 类 / ≥20 字段）
- BDD-12 走 `scripts/audit-utc-semantics.py`（不进 pytest，默认 DB 路径用 tempfile.gettempdir() 拼接）
- 自跑验证：`ModuleNotFoundError: No module named 'peekview.timefmt'` → **B 类真红灯**（被测模块未实现）
- 实测副产物：CLI `create -j` 当前输出 `"created_at": "2026-11-10T12:00:13.017700"`（naive 无时区）→ BDD-11 断言必红；jieba 初始化日志混入 stdout，取 JSON 需从第一个 `{` 起
## [6] 前端 vitest 7 个 spec 已落盘
- `src/composables/__tests__/useRelativeTime.spec.ts`（BDD-01/02/05/06）
- `src/utils/__tests__/visibility-options.spec.ts`（BDD-16/17/18 + R11）
- `src/utils/__tests__/visibility-target.spec.ts`（BDD-19/20/27/28/29）
- `src/components/__tests__/time-display.spec.ts`（BDD-01/02/05）
- `src/components/__tests__/visibility-menu.spec.ts`（BDD-16/17/18/19/20/21/24/30 + R11 + aria-label）
- `src/stores/__tests__/entry-list-visibility.spec.ts`（BDD-19/21/24/27/28/29，不断言 toast）
- `src/components/__tests__/entry-card-file-count.spec.ts`（BDD-13/14/15/22）
- 自跑：`7 failed (7) / 27 failed | 11 passed (38)` — 失败原因全部为「模块未实现」（import 解析失败 / `setVisibility is not a function` / `1 file` 仍渲染）
- 11 个 passed 全部是正向护栏（BDD-14/15 当前已正确、BDD-06 的 ago 对照、BDD-22 非 owner 两处、BDD-01 无 ago 等），非红灯来源

## [7] E2E spec 已落盘并验证可解析
- `frontend-v3/e2e/tpv0102-explore-card-list-ux.spec.ts`
- `npx playwright test --list` → `Total: 62 tests in 1 file`（31 用例 × 2 project），**exit 0**
- 覆盖 BDD-01~06 / 13~30（后端专属的 07-12 不在 E2E）+ VC-1~VC-7 视觉契约
- 清理队列：`cleanupQueue` + `afterEach` 无条件删除，接受 200/204/404；entry/team 均走 debug HTTP API
- 0 文件 entry 现造（空 `files`），团队用随机后缀名避免与 seed / team-visibility 冲突

## [8] 平台假设扫描
- `check-platform-assumptions.py backend/tests/test_utc_serialization.py scripts/audit-utc-semantics.py` → **0 命中，exit 0**
- 全目录扫描的命中全部来自既有文件（test_admin_backup.py / test_cli.py / test_cli_remote.py），与本次新增无关
- TS 侧不在扫描面内（DEBT0048 已知缺口）→ 已在 P3-test-cases §8 声明三条人工纪律

## [9] 红灯原因真伪校验（用桩注入 P4 实现验证测试代码本身无缺陷）
按 dispatch-context 要求「每个红灯必须是被测模块未实现」逐项验：
- 后端：注入伪 `peekview.timefmt` + `UtcSerializeMixin` + 把 16 个叶模型换基类，**20 个用例 18 passed**
  - 剩余 2 个失败 = P4 真实缺口：`peekview.client` 未换 `parse_iso`、CLI `--json` 仍输出 naive
  - 期间修掉一处**假红灯**：`test_bdd_10_naive_input_is_treated_as_utc` 曾断言 `parse_iso` 对无后缀输入返回 aware
    —— P2 §3.1 冻结实现是 `fromisoformat(value.replace("Z","+00:00"))`，无后缀输入保持 naive。
    改为只断言「不抛异常」（不把实现细节写成断言），改名 `test_bdd_10_naive_input_stays_parseable`
  - 同批修掉 `test_bdd_10_remote_client_parse_dt_roundtrip` 的空断言（`__doc__ is not None` 恒真）
    → 改为断言 `peekview.client` 源码含 `parse_iso` 且无裸 `datetime.fromisoformat`
- 前端：唯一失败原因分布 = `Failed to resolve import '@/utils/visibility-*'` / `'@/components/TimeDisplay.vue'` /
  `'@/components/VisibilityMenu.vue'` / `store.setVisibility is not a function` / BDD-13 的 `1 file` 仍渲染
  → 全部为 B 类「被测模块未实现」
  - 修掉两处与 P2 契约耦合过紧的断言：`visibility-options` 的 R11 用例改为
    「透传 `teamsFailed` 或保留 Team 位，二者其一」（P2 §3.5 规则 6 允许两种表达）；
    BDD-18 的「Team 项无 teamSlug」改为断言字符串 `teamSlug` 不出现（原断言用团队 slug 值，语义弱）

## [10] 最终门槛自跑结果
| 门槛 | 命令 | 结果 |
|---|---|---|
| TDD 红灯 | `check-tdd-red.py <task_dir>` | **exit 0** — `B-class red-light (import errors from missing project module 'peekview')` |
| P3 gate | `check-gate.py P3 <task_dir>` | **exit 2** = P3-test-cases.md 存在（正常态，exit 1 才是缺文件） |
| 平台假设扫描 | `check-platform-assumptions.py backend/tests/test_utc_serialization.py scripts/audit-utc-semantics.py` | **exit 0，0 命中** |
| E2E 可解析 | `npx playwright test --list e2e/tpv0102-explore-card-list-ux.spec.ts` | **exit 0** — `Total: 62 tests in 1 file`（31 用例 × 2 project） |
| 文件存在性 | 10 个新增文件 | 全部存在，合计 ≈115 KB |
| BDD 覆盖 | 01..30 逐个 grep | **30/30 命中，0 缺失** |

## [11] 完整 P3 聚合命令实跑（P2 冻结形态，无 tail）
```
( cd backend && .venv/bin/python -m pytest tests/ -n auto -q --tb=short ); b=$?; \
( cd frontend-v3 && npx vitest run --reporter=dot ); f=$?; [ $b -eq 0 ] && [ $f -eq 0 ]
```
→ `AGG_EXIT=1`（预期：测试先于实现）
- pytest：`1 failed, 1 error` —
  - `ERROR tests/test_utc_serialization.py`（本任务新增，`ModuleNotFoundError: peekview.timefmt` = 目标红灯）
  - `FAILED tests/test_cli_remote.py::TestCLIRemoteConfig::test_config_set_remote_api_key` = **预存失败**（C-20 已登记：沙箱 `~/.peekview/` 只读）
- vitest：`Test Files 7 failed | 112 passed (119)` / `Tests 27 failed | 1375 passed | 4 skipped (1406)`
  - 7 failed 全部是本任务新增的 7 个 spec；既有 112 个 spec 文件无回归

## [12] 环境隔离
`[PROD_NOT_TOUCHED]` — 全程未启动服务、未触碰 :8080、未读写 ~/.peekview/、未执行 peekview CLI 对生产 DB；实测探针全部落 `.agate-tmp/`（已清理临时桩目录）。
