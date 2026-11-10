# P2-review-eng 进度（plan-eng-review, TPV0102）

## [1/8] 数据流 — 序列化链路
- 后端契约实测：`UtcSerializeMixin` + 通配 `field_serializer("*", when_used="json", check_fields=False)` 在 pydantic 2.13.4 下成立：叶模型 json 得 `...Z`，python 模式仍 `datetime`，表模型 json 仍无 `Z`（.agate-tmp/probe_mixin.py）。设计 §3.2 四条硬约束与实测一致。
- `timefmt.parse_iso` 的 `Z` 替换：CPython 3.10 `fromisoformat` 不接受 `Z`，设计已写死 replace 路径（§3.1），与 `requires-python >=3.10` 一致。
- 异常路径：`utc_iso_z(None) -> None` 显式处理；`parse_iso` 对非法串无 try/except（设计未提），但唯一调用点 `client._parse_dt` 上游 `if v else None` 已有守卫 —— 记为非阻塞。
- 发现（非阻塞）：`admin_service._parse_db_datetime` 仍裸 `fromisoformat`，设计 §1.2 已判定"备份文件不来自 API"→不改，合理。

## [2/8] 状态机 — 可见性三态 5 转换（逐条核对后端语义）
后端实测（entry_service.py:808-856 + api/entries.py:441 `team_id_set = "team_id" in data.model_fields_set`）：
- Public→Private：`{is_public:false, team_id:null}` → 清 team（本就 null）→ is_public=False ✅ BDD-20
- Private→TeamA：`{team_id:"teamA"}` → team_id_set=True 非空 → 置 team + 强制 is_public=False ✅ BDD-27
- TeamA→TeamB：同上 ✅ BDD-28
- TeamA→Private：`{is_public:false, team_id:null}` → 先清 team，再 is_public=False ✅ BDD-29
- TeamA→Public：`{is_public:true, team_id:null}` → 先清 team（否则 is_public 分支被 team 挡住）→ is_public=True ✅ BDD-19
- 结论：`visibility-target.ts` 的三分支 payload 构造与后端语义**逐条吻合**，5 转换全覆盖，设计 §3.5 的论证正确。
- 发现（阻塞级，低工作量）：`revoked_shares` 反馈路径丢失。后端 :860-865 在 Team→Public / Private→Public 时自动吊销全部 share，现有 `entryList.toggleVisibility` 有 toast 警告（:65-68），P2 §3.5 的 `setVisibility` 骨架**只留三态 toast，未处理 `updated.revokedShares`** → 分享链接被静默吊销、用户无提示。`updateEntry` 返回值已含该字段（EntryResponse:810 + transformEntry），修复只需补一个分支。

## [3/8] 接口契约 — VisibilityMenu / prop 链
- `buildVisibilityOptions` 入参同时含 `teamId: number|null|undefined` 与 `currentTeamSlug: string|null`（§3.5）——同一"当前团队"两个来源，优先级未定义（非阻塞，契约冗余）。
- `inFlight` 用 `new Set()`（§3.5 代码骨架）+ 同时声称 `props.disabled` 绑 `inFlight` 状态（§3.5 渲染节）——裸 Set 非响应式，disabled 无法随请求状态更新。BDD-24 仍可由 store 守卫（`return false`）满足，但设计内部自相矛盾（非阻塞）。
- §1.1 B5 写 `<TimeDisplay :date-str="..." />`，§6.4#8 写"改传 `absolute` / tooltip 所需 prop"——两处对 `EntryDetailHeader`/`EntryMetaTagsBar` 的 prop 变更口径不一致；且 §1.1 未登记 `EntryDetailHeader` 的 props 签名变更（现为 `relative-time`/`full-time`，见 EntryDetailView.vue:7-8）。非阻塞但 P4 会歧义。
- `applyPatch` / `restore` 在 §3.5 骨架中被引用但未定义（仅散文描述"回滚三字段"），实现需自行发明。非阻塞。

## [4/8] 错误边界
- BDD-21（切换失败回滚）：store `catch` → `restore(entry, snapshot)` 三字段回滚 + 返回 false → 视图层 error toast。路径完整 ✅
- BDD-24（进行中不重复发请求）：store `inFlight.has()` 守卫兜底 ✅（组件层 `props.disabled` 因裸 `Set` 非响应式而不可靠，但 BDD 判据仍满足）
- 发现（非阻塞）：`revoked_shares` 用户反馈丢失（详见状态机节）。
- 发现（非阻塞）：`parse_iso` 无 try/except，唯一调用点上游已 `if v` 守卫，但若未来新增调用点会静默抛 ValueError。

## [5/8] 测试策略
- 后端 8 条用例（§6.1）覆盖 BDD-07/08/09/10/11/12，判据为遍历而非点名 ✅
- 前端 5 个单测文件（§6.2）覆盖 01-06/16-20/24/27-30 ✅
- E2E（§6.3）声明 `tpv0102-*.spec.ts` + 双 project + test.use 固定 locale/tz ✅（BDD-22 非 owner 三处、BDD-23 双视口有覆盖意图）
- **缺口（阻塞级）**：P3 红灯机制不可用（见下 gate_commands 节 R-1）。
- **缺口（非阻塞）**：§6.4 既有断言更新面列了 9 项，但漏 `header-layout.test.ts:67-76`（实测 `TC-D01` 断言 `\d+d ago` 走主显相对时间、`TC-D02` 断言 `formatFullDate` 仅 `toBeTruthy()`）——主显改绝对时间后 TC-D01 语义失效。P1 §6.1 已登记该文件，P2 §6.4 漏转抄。

## [6/8] gate_commands 审查（含 G-1/G-2/G-3 判定）
当前文件实际内容（已重读，P5_fitness 已非旧版）：
  P3: 聚合命令（backend pytest + frontend vitest，`b=$?; f=$?; [ $b -eq 0 ] && [ $f -eq 0 ]`），**无 P3_formatter**
  P5_e2e: `E2E_SPEC='e2e/(tpv0102|team-visibility)' make debug-test`
  P5_fitness: `cd backend && .venv/bin/python -m pytest tests/test_utc_serialization.py -q --tb=no -k mixin_not_in_table_mro`
  P5_e2e_timeout_seconds: 420

### G-2 判定：已失效（确认主 Agent 说法）
- 现文件 :758 已是 `tests/test_utc_serialization.py -k mixin_not_in_table_mro`，不再指向不存在的 `test_architecture_fitness.py`。**不作为缺陷**。
- 但附带实测：`-k` 零命中时 pytest **exit 5**（非 0）→ 若 P3 的测试函数名与 `mixin_not_in_table_mro` 不一致，P5_fitness 会红。属可接受的"先约定后实现"，但 P2 未写明「P3 必须建该文件名且含该测试函数名」。建议 P2 §6.1 显式加一行约束。

### G-1 判定：**成立，且比 dispatch-context 描述的更严重（阻塞级）**
实测 `npx playwright test --list 'e2e/(tpv0102|team-visibility)'` → **12 tests in 1 file**，全部来自 `team-visibility.spec.ts`，`tpv0102` 命中 **0**。
即：**该命令今天就已经是绿的，且新 BDD 覆盖为 0** —— 不是"未来 0 用例 exit 0"，而是"永远至少跑 12 个既有用例 → 永不零命中 → 永远 exit 0"，假绿不可见、不可由 exit code 察觉。
反证：`--list 'e2e/zzzznonexistent'` → `Error: No tests found` + **exit 1**（Playwright 对零命中会失败），说明"0 用例仍 exit 0"这个具体担忧不成立；真问题是 **alternation 里的 `team-visibility` 兜底让零命中永不发生**。
结论：应改为写死具体文件名（TPV0099 先例），并在 P2 写明 P3 必须创建该文件名。若要保留 team-visibility 的回归，拆成独立 key（`P5_e2e_legacy` 实测 `is_legal_gate_key` = True）。

### G-3 判定：**成立（阻塞级）**
`scripts/run-e2e-tests.sh:92` `E2E_TIMEOUT="${E2E_TIMEOUT:-600}"`，内层 `timeout 600 npx playwright test`。P5_e2e_timeout_seconds=420 < 600 → 外层先杀内层，报错归因错乱（会被记为"E2E 失败/超时"而非"预算不足"），且 420s 对 30 条 BDD × 2 project 明显不够。TPV0099 先例 900s。应改 900。

### 额外发现（阻塞级，dispatch-context 未列）：**P3 红灯机制不可用**
实测（真实全量输出 + check-tdd-red.judge_result）：
- 新增 `backend/tests/test_utc_serialization.py` 必然 import 尚不存在的 `peekview.timefmt` → pytest 报 collection ERROR，exit 1。
- 当前 P3 无 `P3_formatter` → `run_test_with_formatter` 回退 `_fallback_json`（raw_output 保留）→ `judge_result` 命中 `exit_code==1 and raw_output and re.search("Traceback|SyntaxError|ImportError|ModuleNotFoundError")` → **A-class error, exit 1**。
- 实测三种输出形态（`-q --tb=no | tail -30` / `--tb=short` 全量）**均为 verdict=1**；换成 `pytest.sh` formatter 则得 `import_errors=[{module:"peekview.timefmt"}]` → project_module=peekview 命中 → **B-class, exit 0**（正确红灯）。
- 即 §9 声明要点里「不声明 P3_formatter……退化为 exit-code-only（精度略降但**不误判**）」的"不误判"**不成立**：本任务的 TDD 红灯必然被误判为 A 类（测试代码 bug），P3 gate 会假红。
- 建议：声明 `P3_formatter: "pytest.sh"`（实测对 vitest 形态输出仍返回 exit_code=1/failed=1 → classic red verdict 0，可接受）；或把 P3 收窄为后端命令、前端红灯走独立验证。

### 附：预存 flake 观察（不属 P2 缺陷，P5 需登记）
`HOME` 可写时全量后端套件仍有 1 个失败：`tests/test_admin_backup.py::TestBdd10BasicRestore::test_restore_into_empty_target`（xdist 并行下红，单跑绿）。另 `tests/test_cli_remote.py::TestCLIRemoteConfig::test_config_set_remote_api_key` 在本沙箱 HOME 只读时红（`OSError: [Errno 30] Read-only file system: /home/kity/.peekview/config.yaml`），HOME 可写后绿——属环境限制而非代码缺陷。二者建议进 P5 known-failures.md。

## [7/8] 实现就绪度（files_to_read）
- 覆盖度实测：`models.py` 6 段行号、`client.py`、`cli.py` 3 段、`admin_service.py`、前端 useRelativeTime / 4 个渲染点 / 2 个 store / team.ts / useEntryDetailActions / OverflowMenu / ConfirmDialog / 2 个视图 / types / client.ts / playwright.config —— 基本覆盖实现所需上下文。
- 缺失（非阻塞）：
  - `frontend-v3/src/stores/entry.ts:19`（§3.5 明写"透传层需同步导出 `setVisibility`，P4 注意"，却未列入 files_to_read）
  - `backend/peekview/services/entry_service.py:800-865`（`team_id_set` / `is_public` 分支 / `revoked_shares` 自动吊销——设计的核心依据，只在正文引用未列导航）
  - `backend/peekview/api/entries.py:441`（`team_id_set = "team_id" in data.model_fields_set` 的实际推导点）
  - 既有断言更新面涉及的 9 个测试文件（§6.4 点名但未进 files_to_read，P4/P3 需读才能改）
- 数量判断：以上补齐后约 40 条，偏多但均"确实需要"，符合"不多不少"边界；不算阻塞。

## [8/8] 最小验证 / 多方案 / 技术债
- `minimal_validation`：V1-V9 共 9 项，**未**声明"纯代码逻辑"（符合 dispatch 要求），V6 结果为 `refuted` 并驱动方案改选（C2）——这是本设计最有价值的部分，验证真实、结论支撑方案。V4 的 16/34 与 V9 的正则"可用"结论均可复现（我独立复现了 V4=16类/34字段、V9=12 tests in 1 file）。
  - 但 V9 的**结论用错了**：它验证了"正则被接受"就下结论"可用"，未验证"正则是否只匹配目标 spec"——这正是 G-1 假绿的成因。最小验证的判据应当是"命中集合 == 期望集合"，而非"命令不报错"。
- 多方案：candidate_count=7（A1-A3 / B1-B2 / C1-C2），三处均有权衡 + 选择理由，理由自洽。**可判定"探索了且理由自洽"；不可判定"是否选最优"**。A3 被 P0 实测排除后仅记录不保留为候选，符合"不可行方案直接排除"。
- 技术债：P1 已登记 ApiKey 时间格式化重复实现等 SUGGEST 项；P2 §1.2 显式排除并引用。本评审**不新增** DEBT 条目（见下"非阻塞"——`applyPatch`/`restore` 未定义属实现细节，不构成架构债）。

## [完成] P2-review-eng.md 已落盘
- status: needs-revision，4 条阻塞项（B-1~B-4）
- frontmatter-check exit 0；status/agent 读回正确（needs-revision / plan-eng-review）
- check-gate P2 exit 1，唯一原因 `P2-review.md` 不存在（预期，待组长汇总）
- 只读纪律：`git status --porcelain` 相对基线唯一新增为本文件 + progress + 其他 agent 的产出；本轮误建的 `backend/tests/__probe_tmp_test.py` 已即时删除并复验（scratch 探针，非项目文件）

## 更正记录（自查）
- 初稿"BDD-22 在 §6.2/§6.3 无对应用例"表述过强：§4.4 已声明 E2E 覆盖 `BDD-01-06/13-25/27-30`，与后端 07-12、P6 人工 26 拼起来 30 条全覆盖。已改为"账目完整，但 §6.3 缺 BDD-22 的具体断言形态"（非阻塞）。

---

## 复审轮（第 2 轮）核验进度 — 2026-11-10

### B-1 核验（P5_e2e 写死文件名 + legacy 独立 key）
- `P2-design.md:973` = `E2E_SPEC=e2e/tpv0102-explore-card-list-ux.spec.ts make debug-test`（写死，无正则）
- `:974` `P5_e2e_legacy: E2E_SPEC=e2e/team-visibility.spec.ts make debug-test`（独立 key）
- 实测（frontend-v3，Playwright 1.60.0）：
  - `npx playwright test --list e2e/tpv0102-explore-card-list-ux.spec.ts` → `Error: No tests found` + `Total: 0 tests in 0 files` + **exit 1**
  - `npx playwright test --list e2e/team-visibility.spec.ts` → `Total: 12 tests in 1 file` + exit 0
  - `npx playwright test --list 'e2e/(tpv0102|team-visibility)'` → 仍是 12 tests in 1 file（印证上轮判定）
- `is_legal_gate_key` 实测：`P5_e2e_legacy`=True、`P5_e2e_legacy_timeout_seconds`=True
- §6.3 标题即「文件名写死」，正文写明 P3 必须创建该文件名 + 缺文件 exit 1 机制
- **结论：B-1 已闭合**

### B-2 核验（E2E 外层超时）
- `:980` `P5_e2e_timeout_seconds: 900`
- §9 `:1000` 写明内层 `scripts/run-e2e-tests.sh:92` `E2E_TIMEOUT:-600` + 外层必须大于内层 + 30 BDD×2 project 量级 + TPV0099 先例
- 独立确认 `scripts/run-e2e-tests.sh:92` 实际行号与内容一致（`E2E_TIMEOUT="${E2E_TIMEOUT:-600}"`，`timeout "$E2E_TIMEOUT" npx playwright test "$spec" --reporter=line`）
- **结论：B-2 已闭合**
- 新发现（非阻塞）：`:981` `P5_e2e_legacy_timeout_seconds: 600` 与外层规则相矛盾（600 == 内层 600，非"大于"）

### B-3 争议裁决（三件事配置是否完整）— 独立实测
用真实 `agate/assets/formatters/pytest.sh` + 真实 `check-tdd-red.py::judge_result`，探针 import 尚不存在的 `peekview.timefmt`（`.agate-tmp/p3probe/`）：

| 格 | 命令形态 | formatter | pytest exit | formatter import_errors | judge |
|---|---|---|---|---|---|
| A | `-q --tb=no` 无 tail | 无 | 2 | — | A 类（exit 1）|
| B | `-q --tb=no` | pytest.sh | 2 | 0 | **A 类（exit 1）** |
| C | `-q --tb=short` | 无 | 2 | — | A 类（exit 1）|
| D | `-q --tb=short` | pytest.sh | 2 | 2（`''` + `peekview.timefmt`）| **B 类（exit 0）✅** |
| E | `-q --tb=short ... 2>&1 \| tail -30`（真实全量套件 + 注入 collection error）| pytest.sh | 1 | 只剩 `''`（`ModuleNotFoundError` 被截到 EOF 30 行外）| **A 类（exit 1）假红** |
| F | 真实全量 -n auto + `--tb=short` 无 tail + 注入 error | pytest.sh | 1 | 3（含 `peekview.timefmt`）| **B 类（exit 0）✅** |

- 独立确认 architect 的"第三件事"必要：`tail -30` 实测把 `ModuleNotFoundError` 行截掉（`grep -c ModuleNotFoundError full_tail30.txt` = 0），只剩 pytest 缩写的 `ERROR  - ImportError while importing test module '/.../....'` → module 取不到 → A 类。
- 独立确认 `--tb=short` 必要：`--tb=no` + formatter 时 `import_errors=[]` 但 `errors=1` → 落 `if errors>0` 的 A 类分支（exit 1）。
- **前端 exit code 遮蔽核验**：
  - 纯 vitest 断言失败（`expect(1).toBe(2)`）输出喂 formatter → `failed=1` → `classic red-light` verdict 0 ✅
  - vitest 模块解析失败（`Failed to resolve import "@/components/VisibilityMenu.vue"`）→ `Test Files 1 failed` → `failed=1` → `classic red-light` verdict 0 ✅
  - 后端绿 + 前端红拼接 → 聚合 exit 1 → judge 0 ✅（不遮蔽）
- **聚合语义核验**：`b=$?; f=$?; [ $b -eq 0 ] && [ $f -eq 0 ]` 四组合实测 0/1/1/1（b=0f=0→0；其余→1），两套测试都执行（非 `&&` 短路）✅
- **结论：architect 的三件事配置完整正确**（`--tb=short` + `P3_formatter: pytest.sh` + 去 tail）。
- 残余观察（非阻塞）：① 聚合把 pytest 退出码折叠为 1，故 `pytest exit 4/5`（usage error / 零收集）也会被判 `red-light`（P3 语义下可接受，accepted-as-red）；② `AGATE_TDD_TIMEOUT` 默认 120s 而 P3 聚合跑全量双栈，实测后端 32.8s + 前端 18.8s ≈ 52s（headroom 43%，可接受但偏紧）；③ `check-gate.py` 对 P3 首 token `(` 与 P5_fitness 首 token `cd` 报 "命令不存在" WARNING（纯 cosmetic，不阻断）。

### B-4 核验（revokedShares 反馈）
- §3.5 `:550-552` `setVisibility` 成功分支含 `if (updated.revokedShares && updated.revokedShares > 0) toast.show(..., 'warning')`
- `:574` 明确"保留原 toggleVisibility 的 revokedShares warning toast——不得静默丢弃"
- §6.2 `:793` 新增 `entry-list-visibility.spec.ts`，含「`revokedShares > 0` 产生 warning」+「为 0/undefined 不产生」两条
- §1.1 D4/D9、§5 success「四态」、§13.1 B-4 行均已登记
- 链路核对：`entry_service.py:862-865` 返回 `revoked_shares` → `:954-955` 写入 `response.revoked_shares`；`types/index.ts:56` `revokedShares?: number|null`
- **结论：B-4 已闭合**
- 新发现（非阻塞）：store 内 toast（§3.5）与视图层"四态 toast"（§1.1 D9 / §5）**归属重复**，同时实现会双 toast

### 6 个非阻塞项处置核验
| 项 | 处置落点 | 判定 |
|---|---|---|
| `inFlight` 响应式 | `:525` `ref<Set<string>>(new Set())` + `:577` 退路声明 + BDD-24 判据归属 | 已处置 |
| `files_to_read` 补 4 项 | 实测 49 条，`entry_service.py:800-870` / `api/entries.py:435-450` / `models.py:805-815` / `stores/entry.ts:1-40` 均在；1 条解析告警是行号区间写法（`EntryListView.vue:545-560,630-650`），文件存在 | 已处置 |
| `header-layout.test.ts` 转抄 | §6.4 新增第 11 项（`:829`） | 已处置 |
| §6.4#1 拆 `if` 守卫 | `:819` 明写"必须拆掉 `if (count > 0)` 守卫"+前置 `toHaveCount(1)` | 已处置 |
| BDD-22 断言形态 | `:808-811` 三处 × `visibility-toggle` `toHaveCount(0)` + 为何用 count 不用 not.toBeVisible | 已处置 |
| `P5_fitness` 的 `-k` 函数名 | §6.1 约束 2（`:781`）写死函数名 + `-k` 零命中 exit 5 | 已处置 |

### 上轮通过项未被破坏核验
- 数据流：§3.1 `timefmt.py` / §3.2 `UtcSerializeMixin`（通配 serializer + `when_used="json"` + `check_fields=False` + 非 datetime 透传四条硬约束）原样保留
- 状态机：§3.5 `toPatchPayload` 三分支（public 两字段同传 / private 带 `team_id:null` / team 单字段）5 转换论证未变
- 16 类/34 字段口径：独立复现（union-aware 遍历）= **16 类 / 34 字段**，与设计一致；`ShareCreateResponse` 3 字段全继承自 `ShareResponse`；表模型 11 个被正确排除 → 口径未被破坏，R6/§12#2 处置仍成立
- `## UI 设计` 裸标题：实测 `:657` 为 `## UI 设计`（无编号前缀）✅
- frontmatter：`FILE=P2-design.md agate-frontmatter-check.py` **exit 0**；四字段（packages/domains/ui_affected/gate_commands）齐全（scratch 副本 gate 校验通过）

### 自跑 gate
- `check-gate.py P2 <task_dir>` → **exit 1**，唯一原因 `P2-review.md 不存在`（预期，本文件产出后消除）
- scratch 副本（`.agate-tmp/gatecopy`）注入 approved 的 P2-review.md → gate **exit 2 = pass**，仅 2 条 WARNING（P3 首 token `(` / P5_fitness 首 token `cd`）
- `agate-frontmatter-check.py`（FILE=P2-design.md）→ **exit 0**

### B-3 争议最终裁决（端到端真实通路复验，补充）
用 `run_test_with_formatter` + 真实 `pytest.sh` + 真实 `judge_result`，在**真实全量套件**上跑 architect 最终配置的完整形态（后端全量+注入 collection error + 前端真跑）：
`exit_code=1, import_errors=['', 'peekview.timefmt', '']` → **B 类红灯（judge exit 0）** ✅
→ **三件事配置完整正确**（`--tb=short` + `P3_formatter: pytest.sh` + 去 tail）。

### 对上游断言的修正（2 处，不影响结论）
1. 主 Agent 的「`--tb=short` + formatter + 保留 tail + 保留 b=$? → 假绿」**在真实执行通路不可复现**：`agate_common.py:755-766` 强制前缀 `set -o pipefail;` → `cmd | tail` 取左侧失败 → b=1 → 聚合 exit 1 → B 类红灯 exit 0，非假绿。我实测内层/外层两种 tail 形态均如此。假绿只在无 pipefail 裸 shell 下出现（`false | tail -3` → b=0 已验证）。**去 tail 仍必须**（E 格：真实后果是 A 类假红）。
2. architect「18 项全 PASS」实质成立，但真实 task 目录上 `check-gate P2` 当前 exit 1（缺 P2-review.md，正常流程态）。

### 新发现 6 项（全部非阻塞）
1. `P5_e2e_legacy_timeout_seconds: 600` 与设计自己的「外层必须 > 内层 600」矛盾（等值）→ 建议改 900
2. store 内 revokedShares toast（§3.5:549-552）与视图层「四态」（§1.1 D9 / §5）归属重复 → 双 toast 风险，需二选一
3. `[ $b -eq 0 ] && [ $f -eq 0 ]` 折叠 pytest exit 4/5 → judge 0（可推进红灯）；P3 语义可接受，建议加「断言条数>0」自检
4. §6.2 六个前端单测文件无「必须存在」机制（与 B-1 同源但严重度低）
5. `useEntryDetailActions.handleToggleVisibility` 在 D6 移除入口后无触发路径，但 §6.4#10 仍要求改其 :52 文案 → P4 会困惑
6. `env_constraints` 未登记预存失败 `test_config_set_remote_api_key`（HOME 只读所致，HOME 可写即过）→ P5 必须登记 known-failures

### 上轮通过项未被破坏（逐项复核通过）
数据流 / 状态机 5 转换 / 16 类 34 字段（独立复现一致）/ `## UI 设计` 裸标题（:657）/ frontmatter（check exit 0）/ A2-B1-C2 决策权衡

### 产出与收尾
- `P2-review-eng.md` 已覆盖写：`status: approved`、`blockers: 0`；`agate-frontmatter-check.py` **exit 0**
- `check-gate.py P2 .` 仍 exit 1，唯一原因 `P2-review.md 不存在`（组长汇总后消除）
- git status：仓库代码区零改动；探针全在仓外 `.agate-tmp/`；`frontend-v3/src` 与 `agate-probe/` 临时探针已删除，`e2e-safety-check.sh --test-mtime` exit 0（未破坏静态新鲜度守卫）
- [PROD_NOT_TOUCHED]（未触碰 :8080 / ~/.peekview/）
