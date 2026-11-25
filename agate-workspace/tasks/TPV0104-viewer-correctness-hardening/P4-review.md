---
phase: P4
task_id: TPV0104
type: review
parent: P4-implementation.md
trace_id: TPV0104-P4-review-r2-20261125
status: approved
created: '2026-11-25'
agent: review
prod_touched: false
design_gap_count: 6
design_gap_reviewed_count: 6
implementation_dir: backend, frontend-v3/src
retry_round: 2
---

# P4 工程评审（第 2 轮复审）— TPV0104 Viewer 正确性与资源边界加固

[PROD_NOT_TOUCHED] 全程未接触生产 `:8080`、未触碰 `~/.peekview/`、未跑 CLI 写命令、未 commit、未改实现代码与 P3 测试。
**未使用 `:8888` 验证任何结论**（该实例跑 P4 之前的旧代码且无 `--reload`，`render` 响应无报表块）。
全部实测走 `create_app(data_dir=mkdtemp, db_path=mkdtemp)` 的**进程内临时 app** + `httpx ASGITransport`，
造件与删除都在临时目录内完成（`shutil.rmtree`），不落任何持久 DB。临时产物在 `/home/kity/oclab/peekview/.agate-tmp/`
（`r2-verify.py` / `r2-m1-boundary.py` / `r2-extra.py` / `r2-unit*.py`——**我自建，未复用实现者的 `c-fix-selftest.py` 等脚本**）。

## 0. 门槛判定

**`status: approved`** —— 第 1 轮的 **3 条 CRITICAL 全部实测评测闭环**，**2 条 MAJOR 闭环**（M1 按主 Agent 裁决的方案 C），
**无新的 CRITICAL**。残留 3 条 MINOR 列入 §5，不阻断推进。

| 上轮判定 | 本轮核实 | 关键实测证据 |
|---|---|---|
| **C1** 总预算按字符计数 → 中文/emoji 放大 3–4× | **已闭环** | 我自建 3 组素材各 5 份：`中×670k`（1.92 MiB/份）→ `inlined=4 / skipped=1 / {total_budget:1}`、响应 **7.67 MiB**；`😀×520k` → **7.94 MiB**；`中×666666` → **7.63 MiB**。三者均 ≤ 8 MiB×1.35 且势不变式成立（上轮同形态：23.0 MiB / 2.88× / `skipped=[]`） |
| **C2** `lower()` 变形取下标 → U+0130 劈开 `</body>` | **已闭环** | 4 形态（U+0130 混排 / 全大写标签 / `</body >` 带空白 / 多份 `İ`）：报表块均在**末个** `</body>` 之前、正文无 `<`+`/body>` 残片、报表可解析 |
| **C3** `not_injectable` 缺 `file_id` | **已闭环** | 一次请求含 `README.md` + 2 MiB 大文件 + 41 CSS + 1 个不存在 id：`requested=44 inlined=38 len(skipped)=6`，`reasons={count_limit:4, file_too_large:1, not_injectable:1}`，**缺 `file_id`=0**、字段集恰为 5 键、势成立、`file_id` 唯一 |
| **M1** `overflow` 无界 → 报表 13× 放大 | **已闭环（方案 C）** | 边界实测：`len=4091`→200、`len=4097`→**422**（`max_length=4096` 真生效）。残留放大已量化（见 §4-1） |
| **M2** `owners` 单命名空间互相覆盖 | **已闭环** | 我自建双向素材：text `styles/a.css` + binary `a.css` 同名 → 文本真注入=True、二进制=True 为 False、报表宣称 `inlined={11}`、binary 落 `not_injectable`；反向（`img` 引 binary、text 未引）→ `skipped==[44]` |

**与主 Agent 已知客观事实交叉核对（我独立复跑，全部对上）**：`pytest test_html_render.py + test_entry_file_order.py` 全绿；
`-k "bdd_38/39/40/41/bdd_13/g11/g12"` **10 项全绿**；`ruff check backend/peekview` exit 0；`vue-tsc --noEmit` exit 0；
`EntryDetailView.vue` **295** 行 / `entryDetail.ts` **145** 行（既有行数契约未放宽）。

---

## 1. 本轮取证方式（与上轮的差异）

| 项 | 内容 |
|---|---|
| 复审对象 | 上轮 `P4-review.md §7` 的 6 项修复清单 + 实现者申报的 3 处偏离 |
| 代码差异 | `git diff de03b466 -- backend/peekview/{api/files.py,services/html_render_service.py,services/entry_service.py}` 逐行读；`docs/architecture/html-preview-security-modes.md` 全文（新增 48 行） |
| **探针独立性** | **不复用**实现者的 `c-fix-selftest.py` / `m1-invariant-check.py` / `m2-check.py`；自写 4 个探针，素材全部自选（emoji、三跳 `@import`、`@import` 环、`</body >` 变体、18/19/20 位 int token、同名 text/binary 双向） |
| 端到端 | 进程内临时 app 造件 → `GET /render?inject=…` → BS4 解报表块做**双向对账**（报表说 inlined ⇒ 内容真在响应；说 skipped ⇒ 内容真不在） |
| 单元级 | 直调 `inject_resources` / `build_skip_report_html` / `select_inject_ids` 做边界与不变式扫描 |
| 未做 | 不跑 E2E（P6 职责）；不跑全量 `make test-quick`（主 Agent 已核 1221P/1F/3S，我只跑受影响的两个文件确认零回归） |

---

## 2. Pass 1（CRITICAL）— 逐条复核

### C1 `api/files.py:389` — 已闭环

```python
cost = len(data.content.encode("utf-8"))   # ← 与 record.size 同口径（字节）
if total_bytes + cost > _MAX_INJECT_TOTAL_BYTES:   # 8 MiB
```

实测（我自建素材，每份接近单文件上限，共 5 份 CSS）：

| 素材 | 单文件字节 | 报表 | 响应体积 | 预算倍数 |
|---|---|---|---|---|
| `'中' * 670000` × 5 | 1.92 MiB | `requested 5 / inlined 4 / skipped 1 {total_budget:1}` | **7.67 MiB** | **0.96×** |
| `'😀' * 520000` × 5 | 1.98 MiB | 同上 | **7.94 MiB** | **0.99×** |
| `'中' * 666666` × 5 | 1.91 MiB | 同上 | **7.63 MiB** | **0.95×** |

与上轮同形态对比：上轮 12 份 `'中' * 670000` → `inlined=12 / skipped=[]` / **23.0 MiB** / **2.88×**。
**字节口径生效后预算不再可放大**，`total_budget` 分支真实触发，势不变式三形态全部成立（`requested - inlined == len(skipped)`）。

另核：**二进制 sibling 也走同一 `cost` 路径**（`_build_sibling_data` 返回 base64 str，`len(...encode())` 即 base64 字节数），
与 P2 D6「二进制 base64 长度计入」一致。

### C2 `api/files.py:430-443` — 已闭环（**且实现者的偏离是对的**）

```python
matches = list(re.finditer(r"</body\s*>", html, re.IGNORECASE))
if not matches:
    return html + block
idx = matches[-1].start()
return html[:idx] + block + html[idx:]
```

关键点：**匹配在原始串上做**（不论 `finditer`/`search`），`idx` 与切片对象同源 ⇒ 根因（`lower()` 非保长变形）消除。

| 形态 | 报表可解析 | 报表在末个 `</body>` 前 | 正文无残片 |
|---|---|---|---|
| `<p>İstanbul İİİ</p></body>`（U+0130 混排） | True | True | True |
| `<HTML>…<BODY>…</BODY></HTML>`（全大写） | True | True | True |
| `<p>İx</p></body ></html>`（闭合标签带空白） | True | True | True |
| `<p>İİİİİİİİ</p></BODY>`（多份 `İ` + 大写闭合） | True | True | True |

**关于「取首个 vs 取末个」的偏离（实现者申报 #1）** —— 我确认**实现者正确，我上轮的建议有缺陷**：
上轮 §7 #2 写 `re.search(...)` 取**首**个匹配，但原实现 `html.lower().rfind(marker)` 的语义是**最后**一个。
照抄 `re.search` 会在「正文/脚本里出现字面 `"</body>"` 字符串」的素材上把报表从**末尾**挪到**首个** `</body>` 之前
——这不仅没修 §3-4，还**静默改变了插入位置**。`finditer(...)[-1]` 同时满足「免变形」与「保持原有末个语义」，是正确解。

### C3 `html_render_service.py:472-484` — 已闭环

```python
skipped_out.append({
    "file_id": file_ids[id(f)],   # ← 旁路 map id(sibling)->File.id，关键字参数传入
    "filename": f.filename, "path": f.path,
    "reason": "not_injectable", "size": None,
})
```

`inject_resources` 新增两个关键字可选参数 `skipped_out` / `file_ids`，且加了一条显式护栏：

```python
if skipped_out is not None and file_ids is None:
    raise ValueError("file_ids is required when skipped_out is provided")
```

这条护栏（我上轮未要求）把「调用方忘记传 map」从 `KeyError` 变成一个**语义清晰的编程错误**，是好补充。
`SiblingFileData` **未加字段**，既有 13 处 `inject_resources(` 调用零改动（我核 `grep = inject_resources(` 仍 13 处）。

实测（一次请求同时触发 3 类 reason）：

```
requested=44  inlined=38  len(skipped)=6
reasons = {'count_limit': 4, 'file_too_large': 1, 'not_injectable': 1}
缺 file_id 的条目 = 0
字段集恰为 {file_id, reason, filename, path, size} = True
势不变式 = True     file_id 去重 = True
not_injectable 项 = [{'file_id': 2, 'filename': 'README.md', 'path': None,
                      'reason': 'not_injectable', 'size': None}]
⇒ 重放 P3 的 BDD-38③ 逐项断言 `isinstance(item["file_id"], int)` 现在真能扫到 not_injectable 项
```

### Pass 1 其余面复核（确认未因修复引入新 CRITICAL）

| 检查点 | 结论与证据 |
|---|---|
| SQL 注入 / 字符串拼接 | `_files_of_entry_query` 仍为纯 SQLModel 表达式；本轮 diff 未新增任何字符串拼接进查询 |
| Read-Check-Write 竞态 | `render_html_file` 仍是纯读路径（`get_files_by_ids` + `storage.read_file`），无写库 ⇒ 无面 |
| **六类 reason 消费方全处理** | 六类生产者逐一核对：`count_limit`(:329) `not_found`(:357) `file_too_large`(:370) `binary_too_large`(:383) `total_budget`(:396) `not_injectable`(service:479)。**新增出口校验**：`build_skip_report_html` 对第七类 reason 抛 `ValueError`——我实测注入 `seventh_reason` → `ValueError: unknown skip reason(s): ['seventh_reason']` ⇒ 闭集从「无消费的死常量」变成**真运行时闸门** |
| 每个 id 恰落一类（不重复计数） | 预算层 `continue` 后不进 `siblings`；`inject_resources` 只遍历 `siblings` ⇒ 结构互斥。实测势不变式在 8 种形态成立（见下表） |
| `<` 转义 | `json.dumps(...).replace("<", "\\u003c")` 未动；BS4 解出的 `path`/`filename` 无损（含 `</script><img src=x onerror=…>` 素材仍可 `json.loads` 还原） |
| **七处埋点 + 第二跳递归** | `consumed.add` 实测 7 处（`:352/:379/:416/:421/:434/:440/:459`）。**G12 两跳递归我独立实测**：`a.css → @import b.css → @import c.css → url(img.png)`，三跳 CSS 内容与 `data:image/png;base64,…` **全部进响应**，且 `skipped` **恰为** 未消费的 `notes.md`（id=16）；`orphan.css`（无引用 CSS）走 append 分支被正确记为已消费。另测 `@import` 环（`ca↔cb`）不挂死、不误记 |
| `order_by` 收敛且 POST 未被加排序 | 我实测 GET 序 `['aaa.css','mmm.css','zzz.css']`（升序 ✅）、POST 序 `['zzz.css','aaa.css','mmm.css']`（构造序，**未被顺手统一** ✅）；`test_entry_file_order.py` 全绿 |
| CSP / 响应头一字未动 | `git diff de03b466` 中 `CSP`/`Content-Security`/`headers=` 零命中；实测响应头含 `frame-ancestors 'self'` 与 `https:` |
| 空 siblings / 无 `</body>` / 无 `?inject` | 三态实跑均 200：无 `?inject` → `requested 0 / inlined 0 / skipped []`；无 `</body>` 片段 → 报表追加到文档尾且 `1/1` |
| 前端专项（AI Slop / `outline: none` / hover-focus / 交互态） | `git diff de03b466 -- frontend-v3/` 内 `outline: none` / `#6366f1` / `violet` / `Unlock the power` **零命中**；`TocNav.vue` 新增 3 条规则全用既有 token（`--c-text` / `--space-3` / `font-weight: 600`），无新色值、无渐变 |

**势不变式边界扫描（单元级，我自建）**

| 形态 | `skipped` 条数 | 势 |
|---|---|---|
| 空 siblings（调用方短路） | 0 | 成立 |
| 全不可注入（5 × `.md`） | 5 | 成立 |
| 全可注入 CSS 未引用（走 append 分支） | 0 | 成立 |
| 混合 + 2 overflow | 1 + 2 | 成立 |

---

## 3. Pass 2（MAJOR）— 逐条复核

### M2 `owners` 拆命名空间 — 已闭环

`text_owners` / `binary_owners` 两个独立 dict 建立（`:311-339`），`text_map` / `binary_map` 保持原样，
`consumed` 按**命中的具体分支**取对象。我自建双向素材独立复现：

```
素材 A（text 为主）：html 有 <link href="a.css">；text=(a.css, styles/a.css) / binary=(a.css, None)
  REPORT skipped = [{file_id: 22, filename: 'a.css', reason: 'not_injectable', size: None}]
  事实：文本 styles/a.css 真已注入 = True；二进制 a.css 真已注入 = False
  报表宣称 inlined = {11}   ← 与事实一致
⇒ PASS

素材 B（反向，binary 为主）：html 有 <img src="a.png">；binary=(a.png, img/a.png) / text=(a.png, None)
  skipped = [{file_id: 44, ...}]  ← 只记未注入的 text，binary 被正确判已消费
⇒ PASS
```

上轮该形态下「真已注入的文本被登记为未注入 + 真未注入的二进制漏记」，现已消除。

### M1 `?inject=` 有界（方案 C）— 已闭环

`inject: str | None = Query(None, max_length=4096)`。精确边界实测：

| `inject` 实长 | HTTP | 说明 |
|---|---|---|
| 4085 | 200 | |
| 4091 | 200 | |
| **4097** | **422** | 超 4096 即拒 |
| 4097（更深） | 422 | |

**关于方案选择的偏离（实现者申报 #2，主 Agent 已裁决接受 C）—— 我复核后确认裁决正确**：

实现者实测证明 B 的两种落法都撞 P2 冻结的势不变式——截断 `overflow` 至 K 项则 `len(skipped)=K ≠ requested-inlined`
（K=100/500 → `100 vs 500`）；追加汇总项则汇总项无 `file_id`，违反 `file_id: int` 必填。**B 必然需要回 P2 授权**，
而 C 不动任何冻结契约、一行级改动、且与既有 `max_slug_length` 等 `Query(max_length=…)` 风格一致。**A/B 的成本高于收益**。

**残留（不是 CRITICAL，已降级为 MINOR，见 §5-1）**：C 把**无界**压成**有界**，但没有压到 **1×**。
我实测了各 token 宽度下的最优放大：

| token 宽度 | id 个数 | `inject` 实长 | 响应体 | 放大 |
|---|---|---|---|---|
| 1 位 | 1041 | 4094 | 90.5 KB | **22.6×** |
| 2 位 | 1035 | 4094 | 90.1 KB | 22.5× |
| 3 位 | 999 | 4094 | 87.1 KB | 21.8× |
| 5 位 | 682 | 4091 | 60.8 KB | 15.2× |
| 7 位 | 512 | 4095 | 46.7 KB | 11.7× |

势不变式在上表所有形态成立（`skipped` 逐项 `file_id` 齐全）。**为何不判红**：
① 绝对量有界（≤ ~91 KB，上轮无上限可达 460 KB 且随 URL 线性增长）；
② `render` 挂全局 `limiter.default_limits = f"{rate_limit_per_minute}/minute"`（默认 **60/min per IP**，`RateLimitExceeded→429` 已注册），
攻击面被限速约束；
③ 合法满配仅 **49 个 sibling**（`max_entry_files=50` 减主文件），对应 `inject` 仅 **350 字符**——正常用户路径离 4096 有 11× 余量；
④ 真正压到 1× 必须放弃「每一项未内联资源都可查」（P2 契约），属 P2 决策。

---

## 4. 实现者申报的 3 处偏离 —— 逐条裁决

| # | 偏离 | 我的裁定 | 依据 |
|---|---|---|---|
| 1 | C2 用 `re.finditer(...)[-1]` 而非我建议的 `re.search(...)` | **偏离正确，我上轮建议有缺陷** | 原 `rfind` 语义是「最后」一个；`search` 取首个会把 §3-4 的字面 `</body>` 场景从「插错位」变成「插错位置且静默改变行为」。4 形态实测（含 `</body >` 变体、全大写）全部通过 |
| 2 | M1 选 C（`max_length=4096`）而非我推荐的 B | **裁决正确**（主 Agent 已接受，我复核同意） | B 的两种落法都撞 P2 冻结项：截断违反势不变式（`100 vs 500`）、汇总项无 `file_id` 违反必填 ⇒ 必须回 P2 授权。C 保留全部契约，把无界压成有界（22.6×→绝对量 ≤91 KB 且受 60/min 限速），代价最小。**残留放大降级为 MINOR** |
| 3 | 「同 entry 两份同名 sibling → `inlined=1` 是谎报」的归因**被推翻**，根因在存储层 | **实现者正确，我上轮 §3-2 的该分句应更正** | 我独立决定性验证：POST 两份 `same.css`（一 text 一 binary）→ DB 留 2 行，但 **file 5 与 file 6 的 `/content` 前 24 B 完全相同**（都是 `b'iVBORw0KGgoAAAANSUhEUgAA'`），**磁盘仅 1 个文件** `data/default/3/same.css`。⇒ 同名写入时后者覆盖前者，两行指向同一份内容；`inlined=2` 与事实一致（两份记录的内容确实都进了响应，只是内容相同）。**根因确在存储层同名覆盖，非 `owners` 缺陷** |

**§3-2 更正声明**：上轮 §3-2 末段「报表 `inlined=1`，实测两份内容都没进响应（谎报）」一句**作废**——
该现象的解释应为「存储层同名覆盖导致两份记录内容相同」，与 `owners` 无关，也不构成 BDD-40② 的「静默缺少 sibling 且无记录」。
`owners` 拆命名空间这一修复本身（`test`/`binary` 同名键跨类型覆盖）**仍然必要且正确**（§3 M2 已实测）,两者是不同问题。

---

## 5. 残留 MINOR / 建议（不阻断，供 P5 / P7 登记）

### 5-1 [MINOR] `?inject=` 放大残留 11.7–22.6×（方案 C 的固有代价）

如 §3-M1 表格。绝对量有界 + 全局限速 60/min ⇒ 不是 DoS 面，但报表体积仍是入参的 12–23 倍。
若要压到接近 1×，唯一路径是放宽 P2 的「每一项未内联资源都必须可查」（截断 + 汇总项需 P2 授权）。
**建议 P7 登记为 DEBT，不要求 P5 处理。**

### 5-2 [MINOR] `?inject=` 传 20 位以上数字 token ⇒ 未捕获 `OverflowError` ⇒ 生产 500（**既有面，非 P4 引入**）

`int(token)` 无位数上界；SQLite `INTEGER` 上界为 2^63−1（19 位）。我实测：

```
?inject=999…9（20 位）  → OverflowError: Python int too large to convert to SQLite INTEGER（未捕获，生产即 500）
?inject=999…9（4000 位）→ 同上
```

**归属判定（我查证而非推断）**：P3 基线的 `parse_inject_ids`（`git show de03b466:…`）同样用裸 `int(token)` 且无位数上界，
当时 `inject` 连 `max_length` 都没有 ⇒ **该面在 P4 之前即存在，且 P4 的 `max_length=4096` 反而收窄了它**（4000 位仍可过，
但已不能无限长）。**不判红**，但值得登记。

Fix（一行级，若 P7 决定处理）：`select_inject_ids` 里对 token 加长度上界，如
`if len(token) > 19: continue`，或把 `int(token)` 包进 `except (ValueError, OverflowError)` 之外再加 `if fid.bit_length() > 63: continue`。

### 5-3 [MINOR] §3-4 字面 `"</body>"` 字符串形态**已实测无害**，但依赖「取末个」这一隐式约定

我实测 `<script>var s="</body>";</script>` 素材：报表位置 150、脚本内字面量位置 89、真实闭合位置 325
⇒ 报表落在**真实**闭合标签之前、且在脚本字面量之后（未插进脚本串里）✅。
但这只是因为「真实 `</body>` 恰好是最后一个」。若素材把字面量放在**真实闭合之后**（如 `</body><script>var s="</body>"</script>`），
`matches[-1]` 会命中脚本里的那个。**残留风险极低**（HTML 闭合后通常不再有内容），建议 P7 登记说明而非现在改。

### 5-4 [NOTE] 上轮 4 条 MINOR 全部处置到位（复核通过）

| 位置 | 处置 | 我的复核 |
|---|---|---|
| `parse_inject_ids` 死函数 | 删除 | `grep -rn "def parse_inject_ids"` **零命中**，全仓无残留引用 ✅ |
| `_BINARY_SIZE_LIMIT` 双定义 | 单源 | `api/files.py:25` 从 service `import`；本地定义已删；唯一消费点 `files.py:274` ✅ |
| `REASONS` 死常量 | `frozenset` + 出口校验 | 我注入第七类 reason → `ValueError` 实测抛出；闭集恰 6 元 ✅ |
| `useCsvParser.ts` 冗余重置 | 删除 | `commit()` 内保留 `row=[]/field=''`，调用点重复已删；`constructedRows` 类型已进 `CsvParseResult` 必填字段（`vue-tsc` exit 0）✅ |

---

## 6. P3 测试未篡改复核（硬性项，第 2 次核验）

**结论：一字未改。**

| 证据 | 结果 |
|---|---|
| 10 份 P3 归档副本 vs 工作树**逐字节** `diff -q`（`P3-test-code/vitest/*` 7 + `e2e/*` 2 + `pytest/test_entry_file_order.py` 1） | **10/10 SAME** |
| `git diff --stat de03b466 -- 'frontend-v3/**/tpv0104-*' 'frontend-v3/e2e/tpv0104-*' backend/tests/test_entry_file_order.py` | **零输出** |
| `git diff de03b466 -- backend/tests/test_html_render.py` | 仅 **2 处**（与上轮一致）：① `_render_url` 对 list 按前端 `join(',')` 约定序列化（修 P3 遗留夹具缺陷，**未动断言**）；② `assert _MAX_INJECT_IDS < declared - 1` → `assert declared - 1 > _MAX_INJECT_IDS`（SIM300 顺序，**语义等价**） |

本轮 retry **未新增任何对 `test_html_render.py` 的改动**（上轮基线已是这 2 处）。

---

## 7. 6 条 `[DESIGN_GAP]` + 2 条 `[SCOPE+]` 的合理性（P7 输入，含本轮新增 2 条）

| # | 行 | 内容 | 判定 |
|---|---|---|---|
| 1 | `:334` | P2 称需删 `MarkdownViewer` 的 `select-heading` emit，现仓从不存在 | **合理**（no-op 正确，上轮已核） |
| 2 | `:336` | P2 数据流把接线写成 A 组落点，`dispatch_plan` 却划给 navigation 批 ⇒ `setTocHeadings()` 一度无消费者 | **合理**（现仓已闭环：`EntryDetailView.vue:81/177` + `EntryDetailContent.vue:187`） |
| 3 | `:507` | 为守 `t082` 行数契约（View<300 / store<150），抽出 `useEntryDetailUrlSync.ts` | **合理**（我实测 295/145 行，契约未放宽） |
| 4 | `:508` | P2 D3 未覆盖「预取 id ≠ 最终 targetFile」；实现加 `targetFile.id === fileId` 守卫 | **合理，真实缺陷修复** |
| 5 | `:509` | `handleFullscreen` 伪码与 `normalizeFileQuery` 双源；实现改为复用 | **合理**（单源） |
| 6 | `:734` | **本轮新增**：C2 修复用 `finditer[-1]` 而非评审建议的 `search` | **合理且更优**（§4-1；我上轮建议确有缺陷） |
| S1 | `:511` | 原 `router.replace({query:{}})` 还承担「消费 firstFileId」；白名单化后职责移到 `syncUrl()` | **合理**（P2 时机表未覆盖的必要连带） |
| S2 | `:736` | **本轮新增**：同 entry 两份同名 sibling = 存储层同名覆盖，报表与事实一致 | **合理**（§4-3 我已独立决定性验证，根因确在存储层；修它会动 entry 写入命名策略，超 P1 范围） |

**保留意见（非阻断）**：第 2 条暴露的是**派发机制**问题（跨批数据流未进 dispatch-context），不是设计问题。
建议 P7 把「跨批数据流（emit → 父 → 祖父）必须落在**其中一批**的 dispatch-context」写成流程条目。

---

## 8. 给 P5 / P7 / P6 的交接

- **P5**：现有 `gate_commands` 会全绿。**但请勿据此判定「预算正确已充分覆盖」**——建议追加两条本评审用的非 ASCII 冒烟：
  ① emoji（4 B/字符）素材验证 byte 口径；② `@import` 三跳 + `url()` 混合素材验证七处埋点不误记。
  两条都属于「素材维度」缺口（ASCII 素材天然无法区分字符/字节口径）。
- **P7**：
  - 转抄 §7 的 **6 条 DESIGN_GAP + 2 条 SCOPE+**，逐条配 `[DESIGN_GAP_REVIEWED]`；其中 **#6 / S2 是第 2 轮新增**，别漏。
  - 登记 §5-1（放大残留 11.7–22.6×）、§5-2（超长 int token 500，**既有面**）、§5-3（字面 `</body>` 的隐式依赖）为 DEBT。
  - §4-2 的 M1 方案选择（C）有决策记录价值：B 撞 P2 冻结项的推理应写进 DEBT 说明，避免下一任务重复踩。
- **P6**：BDD-01~06/52 的 Playwright 判据我仍未实跑（P4 职责边界），仍由 P6 负责。

---

## 9. 结论

**`status: approved`**

- 3 条 CRITICAL **全部实测评测闭环**（C1 字节口径 / C2 `finditer[-1]` / C3 `file_id` 补齐），不是「代码看起来改了」。
- 2 条 MAJOR 闭环（M2 命名空间拆分经双向素材实测；M1 采方案 C，边界 4091→200 / 4097→422 实测）。
- **无新的 CRITICAL**。实现者 3 处偏离经裁决**全部正确**，其中 2 处是对我第 1 轮建议的**改进**（C2 取末个语义、M1 拒 B 保契约），
  1 处是对我归因错误的**纠正**（同名 sibling 根因在存储层，非 `owners`）。
- 残留 3 条 MINOR + 4 条 NOTE 见 §5，全部不阻断。
