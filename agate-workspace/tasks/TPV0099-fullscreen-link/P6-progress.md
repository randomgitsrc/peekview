
---

## P6 验收进度（verifier 派发，2026-09-29 01:15–01:45）

### 环境前置（全部满足）
- `curl :8888/health` → 200；4 个种子 slug 匿名 raw 全 200
- `make build-frontend-fast` exit 0（陷阱 1 规避）；`find src -newer static/index.html` = 0 行
- 生产 `:8080` 不可达（000），`~/.peekview/peekview.db` mtime 早于开工 → `[PROD_NOT_TOUCHED]`

### 逐批落盘
1. **桌面 + 移动批（16 条 BDD）**：自建探针 `.agate-tmp/p6/p6-evidence.spec.js`（独立 playwright 配置，视口显式钉定 1280×800 / 390×844）→ `16 passed (34.4s)` exit 0。产出 assert-bdd-{1,2,3,4,5,6,7,8,11,12,13,14,16,17,18,19}.json + 截图。
2. **BDD-3 三态负向对照**：① 正确实现命中 0（候选集 1 非空，未退化）；② 强制 `.detail-header` 可见命中 3（1280×107 / 1232×44 / 1232×26）；③ 注入 `#bespoke-bar`（1280×40）命中 1 → 判据拦截力闭环。两失败态各有截图 + vision 独立确认横条存在。
3. **auth 批（3 条 BDD）**：首两轮因**探针脚本自身**的变量作用域（`realTokenVisible is not defined`）与断言路径（读 `pageStates.marker_visible_with_real_token` 而非 `doc.then.*`）失败，与实现无关；修正后 `3 passed (15.5s)` exit 0。
4. **BDD-10 硬约束 3 落实**：清理队列登记 `created.slug`（服务端 slug）+ 活体校验（`raw`=200）+ 删除后 404；三态区分力 `[false,false,true]`、API 基线 404/404/200 成立。
5. **BDD-16 截图 md5 冲突修正**：首版 fullPage 截图与 BDD-1 截图 md5 完全相同（133617B，会被 check-p6-evidence 硬阻断）→ 改为滚动正文后截图并重跑 → 截图目录 14 张、md5 唯一 14（dupes=0）。
6. **判据拦截力负向对照（BDD-4/5/9）**：`assert-negative-controls.json` — 对照臂（非锁死页按 f）实测 rect 107/693→0/800→107/693、Escape 使 zen true→false（同一判据对失败态给相反结论）；摘除 zen 类后 chrome/rect 立即改变（toc-sidebar 复现、宽 1280→1040）；BDD-9 的 `window.scrollY` 前后恒 0（绑 window 会恒真）而容器 scrollTop 0→13691。
7. **复用 E2E 独立重跑**：两个 spec 均 `E2E_SPEC=` 定向，exit 0（32 passed / 6 passed）→ `e2e-reuse.log`。
8. **残留检查**：`per_page` 分页扫全量（不用失效的 `limit`），alice 可见 22 条全取尽，`e2e-`/`tpv0099` 残留 **0 条** → `residual-check.log`。
9. **真实视觉分析**：vision-engine（role=quick）14 次调用全 exit 0，原始输出 `P6-evidence/vision-raw/*.txt`，结构化判定 `vision-reports/bdd-*.yaml`（blocker_count=0 ×14）。
10. **人工复核 + 雷同截图复核**：`manual-review-input-state.md`（含 BDD-4/5/7/8/9/10 输入态复核 + bdd-7 开/闭截图的雷同复核，三项互证）。

### 结果
- **19/19 PASS，0 FAIL** → `P6-acceptance.md`（frontmatter pass=19 / fail=0 / ui_affected=true）

### gate 预检（verifier 自查，非 gate）
- `check-p6-format.py --fix` → exit 0
- `check-p6-evidence.py` → **exit 0**（19 条 BDD、证据非空、截图 >1KB、md5 无重复）
- `check-gate.py P6` → **exit 2（= 通过码）**
- `check-p6-provenance.py` → **exit 1**，唯一原因在**派发产物**而非 verifier 产出：
  `P6-dispatch-context-verifier.md` **物理行 293** 的格式样例 `- PASS BDD-1: {描述} (screenshots/bdd-1-fullscreen-form.png)`
  落在 AGATE_CARD 块**之外** → 被审计 2 判为「验收结论预判」。
  对照同项目历史任务（TPV0094 / T087 / T080）：其同类样例行均在 CARD 块**内**，故未被判罚。
  → 需主 Agent 处理（把该样例行移入代码围栏外的 CARD 块内，或改写为不含行首 `- PASS` 的形态），verifier 不擅自改派发产物。

### P6 收尾自查（verifier，01:47）

| 自查项 | 结果 |
|---|---|
| 19 条 BDD 逐条 PASS/FAIL + 每条 PASS 带证据引用（路径真实存在） | ✅ 19 PASS / 0 FAIL，引用缺失 0 |
| frontmatter `pass`/`fail`/`ui_affected` 与正文一致 | ✅ 19/0/true ≡ 正文 19 PASS / 0 FAIL |
| BDD 编号连续全覆盖（1..19）且 ≥ P1 BDD 数（19） | ✅ |
| `P6-evidence/` 非空、无 1 行凑数（<200B 检查）、52 个文件全部被 PASS 行引用 | ✅ 未引用 0 |
| 截图 >1KB 且操作类 md5 互不相同 | ✅ 14 张、md5 唯一 14、无 ≤1KB |
| vision 引用文件存在 + blocker_count=0 | ✅ 14 份全 0 |
| manual-review 引用文件存在 | ✅ |
| 日志 EXIT_CODE 尾行 | ✅ 3 份均 `EXIT_CODE: 0` |
| 残留检查已记录（残留 = 0） | ✅ |
| 硬约束 1（BDD-1/2/3 钉定 `dsh-architecture` 非归档） | ✅ |
| 硬约束 2（BDD-3 A/B 不简化 + 三态 ①0 ②3 ③1） | ✅ |
| 硬约束 3（BDD-10 服务端 slug + 三态 [false,false,true] + 清理 404） | ✅ |
| 硬约束 4（双视口显式钉定 1280×800 / 390×844） | ✅ 证据 JSON 记录 innerWidth/Height 与钉定声明 |

### gate 预检终值（verifier 自查；正式判定由主 Agent 跑）
- `check-p6-format.py --fix` → exit 0
- `check-p6-evidence.py` → **exit 0**（19 条 BDD；md5 去重通过；1 组 ahash 雷同已附复核记录后放行；无 ≤1KB 截图、无低方差告警）
- `check-gate.py P6` → **exit 2（通过码）**
- `check-p6-provenance.py` → exit 1，**唯一**原因：`P6-dispatch-context-verifier.md` 物理行 293（主 Agent 派发产物，非 verifier 可改范围），详见上节。

### 交付物
- `P6-acceptance.md`（19 条 BDD 逐条结果 + 四条硬约束落实表 + vision 澄清节 + 视觉 checklist）
- `P6-evidence/` 52 个文件 / 1.5MB（19 断言 JSON + 14 截图 + 14 vision 原始输出 + 3 日志 + 2 记录）
- `vision-reports/` 14 份 YAML（blocker_count=0）
- `P6-progress.md`（本文件）

标记：**`[PROD_NOT_TOUCHED]`** —— `:8080` 全程 000 不可达、`~/.peekview/peekview.db` mtime 早于开工、`git status frontend-v3/` 为空。
