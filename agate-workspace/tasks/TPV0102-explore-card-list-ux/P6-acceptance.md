---
phase: P6
task_id: TPV0102
type: acceptance
parent: P5-test-results/unit.md
trace_id: TPV0102-P6-20261111
status: draft
created: 2026-11-11
agent: verifier
pass: 30
fail: 0
ui_affected: true
prod_touched: false
results:
- bdd: '01'
  verdict: PASS
  evidence:
  - screenshots/bdd-01-card.png
  - screenshots/bdd-01-list.png
  - logs/assert-bdd-01.log
  vision: vision-reports/bdd-01.yaml
- bdd: '02'
  verdict: PASS
  evidence:
  - screenshots/bdd-02-tooltip-hover.png
  - logs/assert-bdd-02.log
  vision: vision-reports/bdd-02.yaml
- bdd: '03'
  verdict: PASS
  evidence:
  - screenshots/bdd-03-detail-desktop.png
  - screenshots/bdd-03-detail-mobile.png
  - logs/assert-bdd-03.log
  vision: vision-reports/bdd-03.yaml
- bdd: '04'
  verdict: PASS
  evidence:
  - screenshots/bdd-04-exact-0943.png
  - screenshots/bdd-04-shanghai-zhcn.png
  - logs/assert-bdd-04.log
  vision: vision-reports/bdd-04.yaml
- bdd: '05'
  verdict: PASS
  evidence:
  - screenshots/bdd-05-invalid-date.png
  - logs/assert-bdd-05.log
  vision: vision-reports/bdd-05.yaml
- bdd: '06'
  verdict: PASS
  evidence:
  - screenshots/bdd-06-future-time.png
  - logs/assert-bdd-06.log
  vision: vision-reports/bdd-06.yaml
- bdd: '07'
  verdict: PASS
  evidence:
  - logs/assert-bdd-07.log
  - bdd-07-endpoint-scan.json
  - bdd-07-endpoint-sample.json
  - logs/B5-backend-full.log
- bdd: 08
  verdict: PASS
  evidence:
  - logs/assert-bdd-08.log
  - bdd-08-table-model-probe.json
  - logs/B5-backend-full.log
- bdd: 09
  verdict: PASS
  evidence:
  - logs/assert-bdd-09.log
  - bdd-09-leaf-python-probe.json
  - logs/B5-backend-full.log
- bdd: '10'
  verdict: PASS
  evidence:
  - logs/assert-bdd-10.log
  - bdd-10-cli-remote-output.txt
  - bdd-10-remote-client-probe.json
- bdd: '11'
  verdict: PASS
  evidence:
  - logs/assert-bdd-11.log
  - bdd-11-cli-json-output.txt
- bdd: '12'
  verdict: PASS
  evidence:
  - logs/assert-bdd-12.log
  - bdd-12-audit-utc.json
  - bdd-12-replica-rows.json
- bdd: '13'
  verdict: PASS
  evidence:
  - screenshots/bdd-13-one-file-card.png
  - screenshots/bdd-13-one-file-list.png
  - logs/assert-bdd-13.log
  - logs/B5-frontend-full.log
  vision: vision-reports/bdd-13.yaml
- bdd: '14'
  verdict: PASS
  evidence:
  - screenshots/bdd-14-zero-file-card.png
  - screenshots/bdd-14-zero-file-list.png
  - logs/assert-bdd-14.log
  vision: vision-reports/bdd-14.yaml
- bdd: '15'
  verdict: PASS
  evidence:
  - screenshots/bdd-15-three-files-list.png
  - logs/assert-bdd-15.log
  vision: vision-reports/bdd-15.yaml
- bdd: '16'
  verdict: PASS
  evidence:
  - screenshots/bdd-16-menu-public-state.png
  - screenshots/bdd-16-card-menu-scoped.png
  - logs/assert-bdd-16.log
  - logs/rescope-shots.log
  vision: vision-reports/bdd-16.yaml
- bdd: '17'
  verdict: PASS
  evidence:
  - screenshots/bdd-17-no-team-menu.png
  - logs/assert-bdd-17.log
  vision: vision-reports/bdd-17.yaml
- bdd: '18'
  verdict: PASS
  evidence:
  - screenshots/bdd-18-team-submenu.png
  - logs/assert-bdd-18.log
  vision: vision-reports/bdd-18.yaml
- bdd: '19'
  verdict: PASS
  evidence:
  - screenshots/bdd-19-confirm-dialog.png
  - screenshots/bdd-19-after-confirm.png
  - logs/assert-bdd-19.log
  vision: vision-reports/bdd-19.yaml
- bdd: '20'
  verdict: PASS
  evidence:
  - screenshots/bdd-20-no-confirm-private.png
  - screenshots/bdd-20-card-after-private.png
  - logs/assert-bdd-20.log
  - logs/bdd-20-basebadge-label-stale.log
  vision: vision-reports/bdd-20.yaml
- bdd: '21'
  verdict: PASS
  evidence:
  - screenshots/bdd-21-fail-toast.png
  - logs/assert-bdd-21.log
  vision: vision-reports/bdd-21.yaml
- bdd: '22'
  verdict: PASS
  evidence:
  - screenshots/bdd-22-nonowner-card.png
  - screenshots/bdd-22-nonowner-list.png
  - screenshots/bdd-22-nonowner-detail.png
  - logs/assert-bdd-22.log
  vision: vision-reports/bdd-22.yaml
- bdd: '23'
  verdict: PASS
  evidence:
  - screenshots/bdd-23-detail-desktop-menu.png
  - screenshots/bdd-23-detail-mobile-menu.png
  - screenshots/bdd-23-detail-header-scoped.png
  - logs/assert-bdd-23.log
  vision: vision-reports/bdd-23.yaml
- bdd: '24'
  verdict: PASS
  evidence:
  - screenshots/bdd-24-single-request.png
  - screenshots/bdd-24-card-after-switch.png
  - logs/assert-bdd-24.log
  vision: vision-reports/bdd-24.yaml
- bdd: '25'
  verdict: PASS
  evidence:
  - screenshots/bdd-25-zero-file-empty.png
  - screenshots/bdd-25-with-files-detail.png
  - screenshots/bdd-25-content-area-scoped.png
  - logs/assert-bdd-25.log
  vision: vision-reports/bdd-25.yaml
- bdd: '26'
  verdict: PASS
  evidence:
  - screenshots/bdd-26-seeded-explore.png
  - screenshots/bdd-26-unicode-filenames-card.png
  - screenshots/bdd-26-single-file-card.png
  - logs/assert-bdd-26.log
  - logs/residue-check.log
  - logs/B5-e2e-tpv0102.log
  vision: vision-reports/bdd-26.yaml
- bdd: '27'
  verdict: PASS
  evidence:
  - screenshots/bdd-27-team-submenu-open.png
  - screenshots/bdd-27-after-team-a.png
  - logs/assert-bdd-27.log
  vision: vision-reports/bdd-27.yaml
- bdd: '28'
  verdict: PASS
  evidence:
  - screenshots/bdd-28-after-team-b.png
  - screenshots/bdd-28-menu-after-team-b.png
  - logs/assert-bdd-28.log
  - logs/bdd-28-title-overlap-measure.log
  vision: vision-reports/bdd-28.yaml
- bdd: '29'
  verdict: PASS
  evidence:
  - screenshots/bdd-29-team-to-private.png
  - screenshots/bdd-29-card-after-private.png
  - logs/assert-bdd-29.log
  vision: vision-reports/bdd-29.yaml
- bdd: '30'
  verdict: PASS
  evidence:
  - screenshots/bdd-30-menu-open.png
  - screenshots/bdd-30-after-escape.png
  - screenshots/bdd-30-card-menu-open-scoped.png
  - screenshots/bdd-30-card-after-escape-scoped.png
  - logs/assert-bdd-30.log
  vision: vision-reports/bdd-30.yaml
p5_evidence_reuse: 'false'
---

# P6 验收报告 — Explore 卡片/列表体验修正（TPV0102）

**验收对象**：P1-requirements.md 的 30 条 BDD（`BDD-01` ~ `BDD-30`），逐条实跑。
**判定口径**：每条只给 PASS 或 FAIL，二值，无中间态。
**状态标记**：[PROD_NOT_TOUCHED]

---

## 0. 验收环境

| 项 | 值 | 证据 |
|---|---|---|
| debug backend | `http://127.0.0.1:8888`，`/health` 每次使用步骤前探活 = **200** | `logs/assert-bdd-01.log` ~ `logs/assert-bdd-30.log` 各节探活行 |
| 数据目录 | `/tmp/peekview-debug/`（隔离） | dispatcher 注入；验收侧不自行启动服务 |
| seed 数据 | 23 条 entry / 4 用户（alice·bob·carol·dave）/ 2 团队（frontend-team·backend-solo） | `logs/residue-check.log` §[3][9] |
| 生产 `:8080` | 全程 **000**，未触碰 | `logs/residue-check.log` §[0][10] |
| 浏览器 | Playwright Chromium（本地 headless，非 CDP）+ 两个 viewport（1280×800 / 390×844） | `screenshots/` 全部 1280×800 或 390×844 |
| vision 工具 | `vision-engine` skill（`.agate-tmp/ve/scripts/vision-analyze.py -r quick --no-cache`） | `vision-reports/bdd-NN.yaml` 的 `tool` / `model` 字段 |

**环境准备职责边界**：debug backend 由主 Agent 在持续运行的背景 job 下托底，verifier **未自行启动任何服务**；每次 E2E / 浏览器采集前先 `curl :8888/health` 探活（27 次调用中全部 200）。

---

## 1. BDD 逐条验收结果

### 1.1 时间显示（前端，BDD-01~06）

- PASS BDD-01: 卡片与列表的时间主显均为绝对时间且含 GMT±N 偏移标识与 4 位年份、不含 ago/just now（卡片 `"11/11/2026, 02:31:30 AM GMT+8"`、列表 `"11/11/2026, 02:31:30 AM GMT+8"`） (screenshots/bdd-01-card.png, screenshots/bdd-01-list.png, logs/assert-bdd-01.log) (vision: vision-reports/bdd-01.yaml)

- PASS BDD-02: 悬停提示同时含相对时间 + 绝对时间（完整偏移 GMT±HH:MM）+ 运行时 IANA 时区名，实测 `"23m ago · 11/11/2026, 02:31:30 AM GMT+08:00 · Asia/Shanghai"`，三段齐备且 IANA = 运行时解析值 `Asia/Shanghai` (screenshots/bdd-02-tooltip-hover.png, logs/assert-bdd-02.log) (vision: vision-reports/bdd-02.yaml)

- PASS BDD-03: 详情页桌面头部（`.meta-row`）与移动端元信息条（`meta-tags-bar`）的时间规则与列表卡片三处一致——主显均含 GMT±N + 4 位年份，悬停均同时含相对/绝对时间 (screenshots/bdd-03-detail-desktop.png, screenshots/bdd-03-detail-mobile.png, logs/assert-bdd-03.log) (vision: vision-reports/bdd-03.yaml)

- PASS BDD-04: `Asia/Shanghai` + `zh-CN` 下 `2026-11-10T09:43:00Z` 显示为 `"2026/11/10 GMT+8 17:43:00"`——含 `GMT+8` 与 `17:43:00`，不含 UTC 原值 `09:43:00`（Given 用 P1 原文指定时刻注入，非当前时间） (screenshots/bdd-04-exact-0943.png, screenshots/bdd-04-shanghai-zhcn.png, logs/assert-bdd-04.log) (vision: vision-reports/bdd-04.yaml)

- PASS BDD-05: 注入 `created_at="not-a-date"` 后卡片与悬停提示均不含子串 `NaN`（提示回落为 `Invalid date`） (screenshots/bdd-05-invalid-date.png, logs/assert-bdd-05.log) (vision: vision-reports/bdd-05.yaml)

- PASS BDD-06: `created_at` 为当前 +24h 时，悬停提示的相对时间为 `"in 23h"`（未来方向），不是 `just now`，且不含 `NaN` (screenshots/bdd-06-future-time.png, logs/assert-bdd-06.log) (vision: vision-reports/bdd-06.yaml)

### 1.2 序列化契约（后端，BDD-07~12）

- PASS BDD-07: pytest 全绿（本任务引入失败 0；全量唯一失败为 `test_cli_remote::test_config_set_remote_api_key`，属 known-failures.md 第 1 条登记的预存失败——沙箱 `~/.peekview/` 只读）；遍历口径 4 passed/exit 0，且端点实查 11 个端点共 **31 个**时间字段全部以 `Z` 结尾、违规 0 个 (logs/assert-bdd-07.log, bdd-07-endpoint-scan.json, bdd-07-endpoint-sample.json, logs/B5-backend-full.log)

- PASS BDD-08: pytest 全绿（本任务引入失败 0；预存失败 1 条见 known-failures.md 第 1 条）；`Entry` 5 字段 + `User` 3 字段在 python 模式 dump 下仍为 `datetime` 且字符串形态不以 `Z` 结尾，`UtcSerializeMixin` 不在任何 `table=True` 模型的 MRO (logs/assert-bdd-08.log, bdd-08-table-model-probe.json, logs/B5-backend-full.log)

- PASS BDD-09: pytest 全绿（本任务引入失败 0；预存失败 1 条见 known-failures.md 第 1 条）；遍历 **16 个**叶模型 / **34 个** datetime 字段，python 模式 dump 全部为 `datetime` 对象、无一为 `str` (logs/assert-bdd-09.log, bdd-09-leaf-python-probe.json, logs/B5-backend-full.log)

- PASS BDD-10: CLI remote 模式成功读取并解析带 `Z` 的 API 时间——`peekview get k8s-deployment --remote-url :8888 -j` exit 0；`PeekClient.get_entry` 解析出 `created_at` 为 timezone-aware、`utcoffset=0`（另有 pytest 4 passed 锁 `parse_iso` 语义与 client 解析点） (logs/assert-bdd-10.log, bdd-10-cli-remote-output.txt, bdd-10-remote-client-probe.json)

- PASS BDD-11: CLI `--json` 输出（`create -j` / `list -j` / `get -j` 本地三等份 + `get -j --remote-url`）中 **11 个**非 null 时间值全部带 `Z` 或 `+00:00`，无时区标记 0 个 (logs/assert-bdd-11.log, bdd-11-cli-json-output.txt)

- PASS BDD-12: 存量数据 UTC 语义审计——经 debug backend API 导出**全部 23 行**（= `admin/stats` 的 `entries.total` 23，覆盖完整），用 `scripts/audit-utc-semantics.py --db <同 schema 副本>` 判定 `count=0 / checked=23 / exit 0`；独立复算（不经脚本）亦为 0 行 `created_at` 晚于当前 UTC (logs/assert-bdd-12.log, bdd-12-audit-utc.json, bdd-12-replica-rows.json)

> **BDD-12 的环境限制（如实记录）**：审计脚本默认读 `/tmp/peekview-debug/peekview.db`，但 debug backend 由主 Agent 运行在**另一 PID/挂载命名空间**的 `/tmp` tmpfs 下，验收侧 `/tmp` 为独立 tmpfs（实测该路径不存在、进程枚举取不到服务）⇒ 脚本按设计 `exit 2 = SKIP`。故改走「API 导出全量行 → 构造同 schema 副本 → **同一个脚本** `--db` 执行判据」的等价路径，并另做不经脚本的独立复算。原样记录于 `bdd-12-audit-utc.json` 的 `direct_exit` / `direct_note`。

### 1.3 文件数显隐（前端，BDD-13~15）

- PASS BDD-13: `file_count=1` 的 entry 在卡片与列表均不出现 `1 file` / `1 files` 文本 (screenshots/bdd-13-one-file-card.png, screenshots/bdd-13-one-file-list.png, logs/assert-bdd-13.log) (vision: vision-reports/bdd-13.yaml)

- PASS BDD-14: `file_count=0` 的 entry 在卡片与列表均无任何匹配 `\d+ files?` 的文本 (screenshots/bdd-14-zero-file-card.png, screenshots/bdd-14-zero-file-list.png, logs/assert-bdd-14.log) (vision: vision-reports/bdd-14.yaml)

- PASS BDD-15: `file_count=3` 的 entry 在卡片与列表均出现文本 `3 files` (screenshots/bdd-15-three-files-list.png, logs/assert-bdd-15.log) (vision: vision-reports/bdd-15.yaml)

### 1.4 可见性下拉菜单（BDD-16~24）

- PASS BDD-16: Public 态 entry 的菜单不含 `Public` 项（count=0），含 `Private`（1）与 `Team` 入口（1）；实测项文本 `["Private","Team"]` (screenshots/bdd-16-menu-public-state.png, screenshots/bdd-16-card-menu-scoped.png, logs/assert-bdd-16.log) (vision: vision-reports/bdd-16.yaml)

- PASS BDD-17: 用户不属于任何团队时菜单不渲染 `Team` 入口（count=0），仍含 `Private`（1）；Given 用**真无团队用户**（新注册 `noteam<ts>`，`GET /teams` 返回空）构造，非请求失败降级 (screenshots/bdd-17-no-team-menu.png, logs/assert-bdd-17.log) (vision: vision-reports/bdd-17.yaml)

- PASS BDD-18: Team 一律以子菜单呈现且排除当前团队——当前归属 Team A 时子菜单含 Team B（count=1）、不含 Team A（count=0）；点击 `Team` 入口只展开子菜单，前后 entry 的 `team_id`/`is_public` 均未变（未直接执行切换） (screenshots/bdd-18-team-submenu.png, logs/assert-bdd-18.log) (vision: vision-reports/bdd-18.yaml)

- PASS BDD-19: 升 Public 需二次确认——确认框未出现前 API 态仍为 `is_public=false` + `team.slug=Team A`（未发改动请求）；确认后 `is_public=true` 且 `team_id=null` / `team=null`（团队已清空）。弹窗文案 `"Make this entry public? … Team visibility will be removed."` (screenshots/bdd-19-confirm-dialog.png, screenshots/bdd-19-after-confirm.png, logs/assert-bdd-19.log) (vision: vision-reports/bdd-19.yaml)

- PASS BDD-20: 降级（Public→Private）不弹确认对话框（`.confirm-dialog` count=0），且 `is_public` 变为 `false` (screenshots/bdd-20-no-confirm-private.png, screenshots/bdd-20-card-after-private.png, logs/assert-bdd-20.log, logs/bdd-20-basebadge-label-stale.log) (vision: vision-reports/bdd-20.yaml)

- PASS BDD-21: 注入 PATCH→500 后出现失败提示（toast），且服务端状态保持 `is_public=true` / `team_id=null` 完全未变 (screenshots/bdd-21-fail-toast.png, logs/assert-bdd-21.log) (vision: vision-reports/bdd-21.yaml)

- PASS BDD-22: 非 owner（bob）在卡片、列表、详情页**三处**均无可见性菜单入口（实测 count 分别 0/0/0，整页兜底检测亦 0） (screenshots/bdd-22-nonowner-card.png, screenshots/bdd-22-nonowner-list.png, screenshots/bdd-22-nonowner-detail.png, logs/assert-bdd-22.log) (vision: vision-reports/bdd-22.yaml)

- PASS BDD-23: 详情页桌面头部（`.meta-row`，1280×800）与移动端元信息条（`meta-tags-bar`，390×844）均出现可见的菜单入口 (screenshots/bdd-23-detail-desktop-menu.png, screenshots/bdd-23-detail-mobile-menu.png, screenshots/bdd-23-detail-header-scoped.png, logs/assert-bdd-23.log) (vision: vision-reports/bdd-23.yaml)

- PASS BDD-24: 切换请求未返回前再次点击菜单项，PATCH 请求计数仍为 **1**（未发出第二个修改请求） (screenshots/bdd-24-single-request.png, screenshots/bdd-24-card-after-switch.png, logs/assert-bdd-24.log) (vision: vision-reports/bdd-24.yaml)

### 1.5 0 文件空态（BDD-25）

- PASS BDD-25: 0 文件 entry 的详情页正文区显示专用空态 `"此 entry 无文件"`，且该文案 ≠ 多文件未选中时的通用提示 `"Select a file to view"`；对照 3 文件 entry 该专用空态 count=0（两分支互斥的正向验证） (screenshots/bdd-25-zero-file-empty.png, screenshots/bdd-25-with-files-detail.png, screenshots/bdd-25-content-area-scoped.png, logs/assert-bdd-25.log) (vision: vision-reports/bdd-25.yaml)

> **BDD-25 后半条的判据瑕疵（**照实记录，不改写为 PASS 理由**）**：「与未选中提示**在 DOM 上可区分**」这一判据对**有文件的 entry 不可测**——`frontend-v3/src/stores/entryDetail.ts:49-53` 的 `loadEntry` 在 `files.length > 0` 时**恒选 `files[0]`**，`selectFile` 也不会置空，故 `EntryDetailContent.vue` 的 `empty-select-file` 分支（`:73`）对「有文件的 entry」**永不渲染**（实测 3 文件 entry 该 testid count=0）。因此本条的「两空态可区分」只能按**文案常量对照**断言（0 文件文案 ≠ `empty-select-file` 常量文案），不能按 DOM 可达性断言。P1 BDD-25 的 Then 两条要求（①出现专用空态提示 ②该文案 ≠ 未选中提示文案）**均已成立且未放宽**，故判 PASS；但上述不可达事实一并记录，供 P7 回填 P1（`P4-review.md` T-15 已登记同一判据瑕疵）。
>
> 附注：`P4-review.md` T-24 指出该对照依赖**复制常量**（`spec.ts:53` 与 `EntryDetailContent.vue:73` 各存一份），若日后两处文案被改成相同，常量不漂移、断言仍绿 ⇒ 不变式失去机械保护。建议补一条 `EntryDetailContent` 单测（`activeFile: null` + `currentUser.files.length > 0`）。

### 1.6 人工体验路径（BDD-26）

- PASS BDD-26: 按文档 seed 数据后 Explore 页渲染 **20 张** entry 卡片（非空列表），全部卡片主显含 `GMT±N` 且不含 `ago`/`just now`；`unicode-filenames`（8 文件）与 `multi-format-demo`（4 文件）卡片显示 `N files`，`yaml-docker-compose`（1 文件）不显示文件数 (screenshots/bdd-26-seeded-explore.png, screenshots/bdd-26-unicode-filenames-card.png, screenshots/bdd-26-single-file-card.png, logs/assert-bdd-26.log, logs/residue-check.log, logs/B5-e2e-tpv0102.log) (vision: vision-reports/bdd-26.yaml)

### 1.7 可见性转换结果（BDD-27~29）

- PASS BDD-27: Private → Team A 后 `is_public=false` 且 `team.slug=Team A`（两字段均断言） (screenshots/bdd-27-team-submenu-open.png, screenshots/bdd-27-after-team-a.png, logs/assert-bdd-27.log) (vision: vision-reports/bdd-27.yaml)

- PASS BDD-28: Team A → Team B 后 `is_public=false`、`team.slug=Team B`（不再 Team A），且**未出现确认对话框**（count=0）；另补第二轮证据：重开菜单后父项 `["Public","Private","Team"]`、子菜单排除当前团队 Team B（count=0）并仍列 Team A（count=1） (screenshots/bdd-28-after-team-b.png, screenshots/bdd-28-menu-after-team-b.png, logs/assert-bdd-28.log, logs/bdd-28-title-overlap-measure.log) (vision: vision-reports/bdd-28.yaml)

- PASS BDD-29: Team A → Private 后 `is_public=false` 且 `team_id=null` / `team=null`（两字段均断言，防「团队清空但被误置 public」），且**未出现确认对话框**（count=0） (screenshots/bdd-29-team-to-private.png, screenshots/bdd-29-card-after-private.png, logs/assert-bdd-29.log) (vision: vision-reports/bdd-29.yaml)

### 1.8 可访问性（BDD-30）

- PASS BDD-30: 菜单打开时按 `Escape` 后 `visibility-menu` count=0（菜单关闭），且 `document.activeElement` 的 `data-testid` 回到 `visibility-toggle`（焦点回归触发入口） (screenshots/bdd-30-menu-open.png, screenshots/bdd-30-after-escape.png, screenshots/bdd-30-card-menu-open-scoped.png, screenshots/bdd-30-card-after-escape-scoped.png, logs/assert-bdd-30.log) (vision: vision-reports/bdd-30.yaml)

---

## 2. 视觉质量 checklist 核对（逐项 checked / 依据）

按 `verifier.md`「视觉质量 checklist 核对」要求，对照 P1 UX 类别 BDD（BDD-01/02/03/13/16/19/25/27/28/29/30）+ P2 UI 设计节（`ui_render_shape: layout`，`ui_ux_dimensions: [布局结构, 交互行为, 视觉呈现]`）。

| # | 判据 | 结论 | 依据（量化锚点，禁主观词） |
|---|---|---|---|
| C1 | **渲染正确性**：时间文本形态 | checked | DOM 断言：主显匹配 `/GMT[+-]\d/` + `/\d{4}/` 且不匹配 `/ago|just now/`（卡片/列表/详情桌面/详情移动四处，`logs/assert-bdd-01.log`/`03.log`）；vision 逐图抄录同一形态（`vision-reports/bdd-01.yaml`/`03.yaml`） |
| C2 | **渲染正确性**：tooltip 三段结构 | checked | DOM 断言 `text.split(' · ').length === 3` 且 ①匹配相对时间正则 ②匹配 `/GMT[+-]\d{2}:\d{2}/` ③严格等于 `Intl.DateTimeFormat().resolvedOptions().timeZone`（`logs/assert-bdd-02.log`） |
| C3 | **渲染正确性**：文件数三态 | checked | `\d+ files?` 正则三态各一条：1→不出现、0→不出现、3→出现 `3 files`（`assert-bdd-13/14/15.log`） |
| C4 | **布局结构**：卡片元信息行不溢出 | checked | `vc03` 断言 `.card-meta-text` 的 `scrollWidth ≤ clientWidth + 1`（E2E 60 passed，`logs/B5-e2e-tpv0102.log`）；另 DOM 度量见 §3 |
| C5 | **布局结构**：列表标题与动作区不重叠 | checked | `vc06` 矩形不相交断言 + 桌面双列额外要求横向分离（E2E passed） |
| C6 | **布局结构**：浮层不遮触发按钮 / 不被容器裁剪 | checked | `vc02`（菜单上边界 ≥ 触发按钮下边界）+ `vc08`（无 `overflow != visible` 裁剪祖先、整体落在视口内、每个菜单项 `elementFromPoint` 命中自身） |
| C7 | **交互反馈**：失败提示可见 | checked | DOM 断言 `.toast` 含 `/fail\|失败\|error\|错误/` 且可见；vision 抄录文案（`logs/assert-bdd-21.log` / `vision-reports/bdd-21.yaml`） |
| C8 | **交互反馈**：二次确认弹窗完整可见 | checked | DOM `.confirm-dialog` visible=True + `role="alertdialog"`；vision 断言"完整可见、居中、位于最上层未被遮挡"（`vision-reports/bdd-19.yaml`） |
| C9 | **状态结果**：转换后两字段 | checked | BDD-19/27/28/29 每条均断言 `is_public` **与** `team`/`team_id` 两字段（`assert-bdd-19/27/28/29.log` 的 API 前后态抄录） |
| C10 | **a11y**：键盘关闭 + 焦点回归 | checked | DOM 断言（菜单 count=0 + `activeElement.data-testid === 'visibility-toggle'`）；vision 独立观察到"蓝色焦点环"（`vision-reports/bdd-30.yaml`） |
| C11 | **输入态/交互形态变化类人工复核** | checked | 见 §4（人工复核记录） |

**未采用主观词**：本表全部结论落在 DOM 度量、正则匹配或 vision 逐图文本抄录上；无「美观/流畅/自然/响应灵敏」类判据。

---

## 3. 动画/过渡截图纪律与跨图独立分析

1. **过渡完成后再截图**：`shot()` 在截图前执行 `waitForSelector(state:'visible')` → `requestAnimationFrame ×2` → `waitForTimeout(250ms)`，规避 `opacity` 淡入中间帧（`verifier.md` 步骤 0 的硬要求）。
2. **不使用 `compare` role**：实测 `vision-analyze.py -r compare`（两图对比）**会颠倒两图顺序**——`bdd-30-menu-open.png`（实际菜单已展开）被判为"菜单未打开"、`bdd-19-confirm-dialog.png`（实际是弹窗图）被判为"图2"，因此产生 4 条误报 blocker（BDD-19/25/27/30）。故 vision 分析改为**逐图独立 `quick` 分析**（每图配该图专属提问），彻底消除跨图混淆；改后 24 份报告的 `blocker_count` 全为 0。
3. **BDD-28 的首轮 blocker 与仲裁过程**（如实记录）：首轮截图在 1280×800 下拍摄，鼠标停在卡上使 `.card-actions` 保持 hover 可见态，叠在长标题末尾 ⇒ vision 报 1 条 blocker。按 `verifier.md` "vision 报 blocker 但 DOM 验证 PASS" 的流程换 viewport 重做第二轮（1440×900 + 鼠标移开 + 重开菜单），第二轮 `blocker_count=0`。仲裁依据见下条 §3.1。

### 3.1 BDD-28 首轮 blocker 的根因追查（不让 vision 误报，也不掩盖真实缺陷）

`P6-evidence/bdd-28-title-overlap-measure.log`（DOM `Range` 逐行字形盒度量，非目测）：

- 该覆盖**真实存在**：`.card-title` 逐行字形右边界与 `.card-actions` 盒相交，20 张卡中 11 张命中。
- 但**不是本任务引入**：pre-task 基线（TPV0095-P4 提交 `2b382c9c`）的 `.card-actions` = 28px（旧 `card-action-btn` 可见性按钮）+ 4px gap + 28px（删除按钮）= **60px**；本任务把可见性按钮换成 `VisibilityMenu` 的 `icon` 变体（实测宽 **16px**），`.card-actions` 降为 **48px** ⇒ 同一卡片右边界下 actions 左边界**后移 12px**。覆盖像素总量 **332px → 211px（减少 121px）**，命中卡数 11/20 → 11/20（量减、面不变）。
- 且**不在本任务任何判据内**：30 条 BDD 与 VC-1~VC-8 均未对「卡片标题与右上操作按钮不重叠」设断言（VC-3 断的是 `.card-meta-text` 元信息行不溢出；VC-6 断的是**列表模式** `.entry-title` 与 `.entry-actions` 不重叠）。
- **结论**：既有视觉债（长标题 + hover 时操作按钮浮层覆盖标题末尾 2~40px），本任务**减轻未引入**。登记为 SUGGEST，交 P7/P8 决定是否单独立项（建议 `width: 28px` 对齐 + `.card-title { padding-right }` 预留位）。

---

## 3.2 雷同截图复核（4 组，check-p6-evidence 的 avg-hash 判定）

`check-p6-evidence.py` 用 average hash 判定跨 BDD 组「视觉高度相似」。本任务实测命中 **4 组**，逐组实测量化 + 人工复核如下：

| # | 组内两张截图 | 逐字节 md5 | 像素差异 | 差异 bbox | 复核结论 |
|---|---|---|---|---|---|
| 1 | `bdd-16-menu-public-state.png` / `bdd-30-menu-open.png` | 不同（`aed91f12…` / `12d1914b…`） | 1722 / 1024000 px = **0.168%** | `(102,159)-(281,175)` | **确为不同操作、视觉相近**：两张都是「Explore 整页 + 第一张卡菜单展开」的同构图。差异仅在卡片标题的 `<ts>` 戳与截取时刻不同（BDD-16 是 Public 态菜单、BDD-30 是 Escape 前的打开态）。**已补元素级局部截图** `bdd-16-card-menu-scoped.png`（304×228，裁剪到「卡片+菜单浮层」联合区域），标题戳与菜单项成为画面主体，视觉上可与整页图明确区分 |
| 2 | `bdd-20-no-confirm-private.png` / `bdd-29-team-to-private.png` | 不同（`694081ee…` / `daa423fb…`） | 13479 / 1024000 px = **1.316%** | `(58,159)-(295,339)` | **确为不同操作、视觉相近**：两者都是「切换后整页 Explore」，页面主体（其余 19 张 seed 卡）天然一致。实质差异（首卡 title/徽章/布局）落在 bbox 内。**已补元素级局部截图** `bdd-20-card-after-private.png`（280×205）与 `bdd-29-card-after-private.png`（局部），首卡标题戳 `bdd20 public->private <ts>` / `bdd29 team->private <ts>` 可辨识 |
| 3 | `bdd-23-detail-desktop-menu.png` / `bdd-25-with-files-detail.png` | 不同（`9cf9d142…` / `4346429b…`） | 12248 / 1024000 px = **1.196%** | `(9,19)-(963,265)` | **确为不同操作、视觉相近**：同为「详情页桌面头部」形态截图（本项目详情页骨架固定）。实质差异在头部元信息（BDD-23 是 menu 入口断言、BDD-25 是 3 文件正文）。**已补元素级局部截图** `bdd-23-detail-header-scoped.png`（裁到详情页 header 区域）与 `bdd-25-content-area-scoped.png`（裁到 `content-area`），两者构图不同（header 条 vs 正文区） |
| 4 | `bdd-24-single-request.png` / `bdd-30-after-escape.png` | 不同（`385158f8…` / `0c0e874b…`） | 4805 / 1024000 px = **0.469%** | `(73,1)-(708,324)` | **确为不同操作、视觉相近**：两者都是「切换/关闭后整页 Explore」。BDD-24 的判据是**网络请求计数**（`patchCount === 1`，非视觉），BDD-30 是 Escape 后焦点回归。**已补元素级局部截图** `bdd-24-card-after-switch.png` 与 `bdd-30-card-after-escape-scoped.png`（裁到首卡，后者可见焦点环） |

**复核人 / 时间 / 结论**

| 项 | 内容 |
|---|---|
| 复核人 | verifier subagent（P6 阶段执行者） |
| 复核时间 | 2026-11-11 |
| 复核手段 | ①逐字节 md5 比对（4 组全部不同）②PIL 逐像素差分（差异量与 bbox 如上表）③**人工目视**（`read_image` 直接查看 `bdd-16-menu-public-state.png` / `bdd-30-menu-open.png` / `bdd-16-card-menu-scoped.png` / `bdd-20-card-after-private.png`，确认差异位置与截图内容一致） |
| 结论 | **4 组均为「确为不同操作、但视觉相近」**——不是充数、不是同一物理文件的复用。原因可解释：本任务的 UI 断言点多落在同一个 Explore 页面的同一个首卡区域，整页截图天然共享 19~20 张 seed 卡作为背景。为消除歧义，4 组涉及的 7 条 BDD（16/20/23/24/25/29/30）**均已追加元素级局部截图引用**，使每条的截图内容（标题戳、菜单项、徽章、焦点环）在视觉上可直接区分 |

生成/量化脚本与逐条输出：`P6-evidence/rescope-shots.log`（元素级截图采集）与上方差异表（PIL 差分）。

---

## 4. 输入态 / 交互形态变化类 BDD 的人工复核记录

按 `verifier.md` 判定标准：When 子句含输入动作（输入/点击/按键/滚动/拖拽）或动作/特效/时序触发，且 Then 断言与该输入相关的界面状态 ⇒ 须附人工复核记录。

**触发本条的 BDD**：BDD-02（悬停）、BDD-19/20/21/24/27/28/29（点击菜单项）、BDD-30（按 Escape）。

**复核记录**

| 项 | 内容 |
|---|---|
| 复核人 | verifier subagent（P6 阶段执行者） |
| 复核时间 | 2026-11-11 |
| 复核方式 | ①DOM 断言（Playwright `getByTestId` + `getBoundingClientRect` + `document.activeElement`）②vision 逐图独立分析 ③**人工目视复核截图**（`read_image` 直接查看 `bdd-01-card.png` / `bdd-30-menu-open.png` / `bdd-28-after-team-b.png`，核对 vision 结论是否与像素一致） |
| 复核结论 | 上述 9 条 BDD 的交互结果与其 Then 断言一致：悬停工具提示三段齐备且移开后隐藏；点击升 Public 弹确认且确认前不发改动；降级/团队间切换/清团队均无确认框；失败时状态回滚并出提示；请求在飞时只发 1 个 PATCH；Escape 后菜单消失且 `activeElement` 回到触发按钮（vision 同时观察到焦点环）。**无异议** |
| 人工目视复核发现的分歧（已仲裁） | vision 首轮用 `compare` role 分析时把两图顺序判反（BDD-19/25/27/30 各报 1~3 条误报 blocker）；人工目视 `bdd-30-menu-open.png` 确认**菜单确实已展开**（画面清晰可见 `Private` / `Team` 两项）⇒ 判定为 vision 工具 cross-image 顺序缺陷，非产品缺陷；改逐图分析后 4 条全部归零（详见 §3 第 2 点） |

---

## 5. post-test 环境残留检查（P6 卡第 4 步，强制）

完整命令与输出见 `P6-evidence/residue-check.log`（10 节）。摘要：

| 检查项 | 结果 |
|---|---|
| entry 残留（`e2e-` / `bdd*` / `vc0*` / `noteam*` 模式匹配，扫描 23 条） | **0 命中** |
| 用户残留（`noteam*`） | **发现 7 个**（BDD-17 为构造"无团队用户"而 `register`，spec 无注销钩子）→ 已 `DELETE /api/v1/admin/users/{id}` × 7 全部 204 → 复检 0，恢复到 seed 的 4 用户 |
| 团队残留 | **发现 1 个** `probe-team-xyz`（verifier 手动 `curl` 探测 `/api/v1/teams` 响应形态时创建）→ 已 `DELETE /api/v1/teams/probe-team-xyz` 204 → 复检恢复到 `frontend-team` / `backend-solo` |
| 生产 `:8080` | 全程 **000**，未触碰 |
| entry 总数交叉核对 | 23 条 = 24 个 seed 目录 − `image-gallery`（0 内容文件，`scripts/seed-debug.py:184` 对 `if not files: SKIP`，P1 I-19 已记录） |

**残留已清理完毕**，P6 证据采集在清理后的干净环境上成立。

---

## 6. P6 两条禁令遵守声明

| # | 禁令 | 本报告遵守情况 |
|---|---|---|
| **T-1** | 不得写「对比度已满足 WCAG AA」 | **未作此声明**。`--c-text-tertiary` 实测暗 3.84:1 / 亮 3.04:1，**低于 AA 正文 4.5:1**，属既有债（P2 §7 SUGGEST）。本报告任何位置均未声称对比度达标；视觉分析只核对渲染正确性/布局/交互反馈，不做对比度合规判定。 |
| **T-2** | 不得把既有 28×28 按钮写成「已达标」 | **未作此声明**。VC-4 只断言**本任务新增**的 `VisibilityMenu` 触发按钮移动端 ≥44px（`vc04` 用例 `test.skip(!isMobile)`）；既有 `card-action-btn` / `action-btn` 的 28×28 按 P2 §7.1 S2「本任务不改」，本报告未将其任何一项计为达标。实测数据亦如实记录：新增 icon 变体触发按钮 **16×28**（`logs/bdd-28-title-overlap-measure.log`），删除按钮仍 **28×28**。 |

---

## 7. 判据瑕疵与遗留（照实记录，未为凑 PASS 而扭曲）

| # | 事实 | 处置 |
|---|---|---|
| 1 | **BDD-25 后半条对有文件 entry 不可测**：`stores/entryDetail.ts:49-53` 的 `loadEntry` 在 `files.length > 0` 时恒选 `files[0]` ⇒ `empty-select-file` 分支不可达 | 按 E2E 现有实现判定 PASS（Then 两条要求成立：专用文案非空 + ≠ 通用文案常量），并在 §1.5 写明不可达事实与依据。与 `P4-review.md` T-15 一致 |
| 2 | **BDD-12 的审计脚本默认路径在验收沙箱不可达**（跨命名空间 `/tmp` tmpfs） | 走「API 导出全量行 → 同 schema 副本 → 同一脚本 `--db`」等价路径 + 独立复算，原样记录 `direct_exit=2` / `direct_note`。未把 SKIP 当成 PASS |
| 3 | **`P5_e2e_legacy`（team-visibility）2 failed** 因 `proj-a` fixture 缺失（TPV0095-P3 引入） | 与本任务无关，已登记 `known-failures.md` 第 2 条。P6 的 E2E 验收用 `tpv0102` spec，不受影响 |
| 4 | **后端全量 1 条预存失败**（沙箱 `~/.peekview/` 只读） | `known-failures.md` 第 1 条。「pytest 全绿」类 BDD（07/08/09）的 PASS 判据 = **本任务引入失败 = 0**；机械依据 `logs/B5-backend-full.log`（失败清单 1 条 = 登记条目，引入失败 0 条），非「全量 0 失败」 |
| 5 | **卡片长标题被右上操作按钮覆盖**（BDD-28 首轮 vision blocker 的根因） | 真实存在但**非本任务引入**（pre-task 60px → 本任务 48px，覆盖量 332px → 211px）。属既有视觉债，不在本任务判据内。量化见 `logs/bdd-28-title-overlap-measure.log`，SUGGEST 交 P7/P8 |
| 6 | **vision `compare` role 颠倒两图顺序** | 工具缺陷（非产品缺陷）。已改用逐图 `quick` 分析并记录于 §3；`vision-reports/*.yaml` 的 `role` 字段标注了该取舍 |
| 7 | **BDD-25 的两文案可区分依赖复制常量**（spec 与组件各存一份） | 已记录（§1.5 附注），建议补 `EntryDetailContent` 单测（T-24） |
| 8 | **`BaseBadge` 的 `label` 不是 computed**：`status` prop 变更后 `:class` 变了、文字不变（实测 BDD-20 切换后 class=`badge-private`、文字仍 `"public"`，刷新后才正确） | **非本任务引入**（`BaseBadge.vue` 本任务零改动；pre-task `2b382c9c` 同一写法）。**不影响 BDD-20/29 判定**——两条 BDD 断的是服务端 `is_public`/`team` 状态（API polling 读到 `is_public=false` / `team=null`），徽章文字属客户端渲染瑕疵。详见 `logs/bdd-20-basebadge-label-stale.log`。建议 P7/P8 一行修为 `computed(() => …)` + 补 `setProps` 单测 |
| 9 | **4 组截图 avg-hash 雷同**（BDD-16/30、20/29、23/25、24/30 各一组） | 已量化（md5 全不同、像素差异 0.168%~1.316%）+ 人工复核确认为「不同操作、视觉相近」，并**为 7 条 BDD 追加元素级局部截图**使证据自身可区分。详见 §3.2「雷同截图复核」 |

**另有 5 处证据脚本自身缺陷（非实现缺陷，已在 `P6-progress.md` 步骤 4 逐条登记）**：登录态判据、`waitForURL` 立即返回、`team_id` 是数值 id vs slug、卡片显示 summary 而非 slug、localStorage 记忆视图模式。

---

## 8. 验收结论

**30 条 BDD 全部 PASS，0 FAIL。**

**Summary**: 30/30 PASS, 0 FAIL

P6 阶段实跑情况汇总：

| 组 | BDD | 实跑方式 |
|---|---|---|
| 时间显示 | 01~06 | Playwright 实跑 + 截图 + vision 逐图分析（6/6 PASS） |
| 序列化契约 | 07~12 | pytest（`test_utc_serialization.py`）+ 端点实查 + CLI 实跑 + 审计脚本（6/6 PASS） |
| 文件数显隐 | 13~15 | Playwright 实跑 + 截图 + vision（3/3 PASS） |
| 可见性菜单 | 16~24 | Playwright 实跑（真实点击/悬停/键盘）+ 截图 + vision（9/9 PASS） |
| 0 文件空态 | 25 | Playwright 实跑（0 文件与 3 文件对照）+ vision（1/1 PASS） |
| 人工体验路径 | 26 | seed 数据 + Playwright 实跑 + vision（1/1 PASS） |
| 可见性转换 | 27~29 | Playwright 实跑 + API 前后态双字段断言 + vision（3/3 PASS） |
| 可访问性 | 30 | Playwright 实跑（Escape + `document.activeElement`）+ vision（1/1 PASS） |

**证据规模**：`P6-evidence/` 93 个文件（47 张截图（含 8 张元素级局部截图），全部 >1KB 且 md5 互不相同；30 份逐 BDD 断言日志；8 份结构化 JSON/TXT；3 份 B5 全量测试日志；1 份残留检查日志；2 份覆盖/雷同量化日志），`vision-reports/` 24 份 YAML（`blocker_count` 全为 0）。

**未修改任何被验收的代码或测试**（见 `P6-progress.md` 与最终 `git status --porcelain` 核验）。

> **自查≠gate**：本报告是 verifier 的产出，不构成 P6 gate 通过结论。gate 由主 Agent 亲自跑 `check-gate.py P6` + `check-p6-evidence.py` + `check-p6-provenance.py` 判定。

<!-- AGATE:RENDER results BEGIN（agate-md-field-set 生成，勿手改） -->
| BDD | 结论 | 证据 |
|---|---|---|
| 01 | PASS | screenshots/bdd-01-card.png, screenshots/bdd-01-list.png, logs/assert-bdd-01.log |
| 02 | PASS | screenshots/bdd-02-tooltip-hover.png, logs/assert-bdd-02.log |
| 03 | PASS | screenshots/bdd-03-detail-desktop.png, screenshots/bdd-03-detail-mobile.png, logs/assert-bdd-03.log |
| 04 | PASS | screenshots/bdd-04-exact-0943.png, screenshots/bdd-04-shanghai-zhcn.png, logs/assert-bdd-04.log |
| 05 | PASS | screenshots/bdd-05-invalid-date.png, logs/assert-bdd-05.log |
| 06 | PASS | screenshots/bdd-06-future-time.png, logs/assert-bdd-06.log |
| 07 | PASS | logs/assert-bdd-07.log, bdd-07-endpoint-scan.json, bdd-07-endpoint-sample.json, logs/B5-backend-full.log |
| 08 | PASS | logs/assert-bdd-08.log, bdd-08-table-model-probe.json, logs/B5-backend-full.log |
| 09 | PASS | logs/assert-bdd-09.log, bdd-09-leaf-python-probe.json, logs/B5-backend-full.log |
| 10 | PASS | logs/assert-bdd-10.log, bdd-10-cli-remote-output.txt, bdd-10-remote-client-probe.json |
| 11 | PASS | logs/assert-bdd-11.log, bdd-11-cli-json-output.txt |
| 12 | PASS | logs/assert-bdd-12.log, bdd-12-audit-utc.json, bdd-12-replica-rows.json |
| 13 | PASS | screenshots/bdd-13-one-file-card.png, screenshots/bdd-13-one-file-list.png, logs/assert-bdd-13.log, logs/B5-frontend-full.log |
| 14 | PASS | screenshots/bdd-14-zero-file-card.png, screenshots/bdd-14-zero-file-list.png, logs/assert-bdd-14.log |
| 15 | PASS | screenshots/bdd-15-three-files-list.png, logs/assert-bdd-15.log |
| 16 | PASS | screenshots/bdd-16-menu-public-state.png, screenshots/bdd-16-card-menu-scoped.png, logs/assert-bdd-16.log, logs/rescope-shots.log |
| 17 | PASS | screenshots/bdd-17-no-team-menu.png, logs/assert-bdd-17.log |
| 18 | PASS | screenshots/bdd-18-team-submenu.png, logs/assert-bdd-18.log |
| 19 | PASS | screenshots/bdd-19-confirm-dialog.png, screenshots/bdd-19-after-confirm.png, logs/assert-bdd-19.log |
| 20 | PASS | screenshots/bdd-20-no-confirm-private.png, screenshots/bdd-20-card-after-private.png, logs/assert-bdd-20.log, logs/bdd-20-basebadge-label-stale.log |
| 21 | PASS | screenshots/bdd-21-fail-toast.png, logs/assert-bdd-21.log |
| 22 | PASS | screenshots/bdd-22-nonowner-card.png, screenshots/bdd-22-nonowner-list.png, screenshots/bdd-22-nonowner-detail.png, logs/assert-bdd-22.log |
| 23 | PASS | screenshots/bdd-23-detail-desktop-menu.png, screenshots/bdd-23-detail-mobile-menu.png, screenshots/bdd-23-detail-header-scoped.png, logs/assert-bdd-23.log |
| 24 | PASS | screenshots/bdd-24-single-request.png, screenshots/bdd-24-card-after-switch.png, logs/assert-bdd-24.log |
| 25 | PASS | screenshots/bdd-25-zero-file-empty.png, screenshots/bdd-25-with-files-detail.png, screenshots/bdd-25-content-area-scoped.png, logs/assert-bdd-25.log |
| 26 | PASS | screenshots/bdd-26-seeded-explore.png, screenshots/bdd-26-unicode-filenames-card.png, screenshots/bdd-26-single-file-card.png, logs/assert-bdd-26.log, logs/residue-check.log, logs/B5-e2e-tpv0102.log |
| 27 | PASS | screenshots/bdd-27-team-submenu-open.png, screenshots/bdd-27-after-team-a.png, logs/assert-bdd-27.log |
| 28 | PASS | screenshots/bdd-28-after-team-b.png, screenshots/bdd-28-menu-after-team-b.png, logs/assert-bdd-28.log, logs/bdd-28-title-overlap-measure.log |
| 29 | PASS | screenshots/bdd-29-team-to-private.png, screenshots/bdd-29-card-after-private.png, logs/assert-bdd-29.log |
| 30 | PASS | screenshots/bdd-30-menu-open.png, screenshots/bdd-30-after-escape.png, screenshots/bdd-30-card-menu-open-scoped.png, screenshots/bdd-30-card-after-escape-scoped.png, logs/assert-bdd-30.log |
<!-- AGATE:RENDER results END -->
