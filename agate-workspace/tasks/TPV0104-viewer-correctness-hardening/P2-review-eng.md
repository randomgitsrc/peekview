---
phase: P2
task_id: TPV0104
type: review
parent: P2-design.md
trace_id: TPV0104-P2-20261125-eng-r3
created: '2026-11-25'
agent: plan-eng-review
status: approved
---

# P2-review-eng（第 3 轮 · 最终复审）— 工程经理 · TPV0104 Viewer 正确性与资源边界加固

> 评审对象：`P2-design.md`（1056 行，r3 修订版）
> 复审范围：**只核第 2 轮我打回的东西改没改对** —— 1 项 BLOCKER（B4）+ 4 项非阻塞（N5–N8）。
> 第 1、2 轮已确认闭环的部分（B1 / B2a / B2b / B3，12 项锁定决策）**不重做**，本轮只做未推翻性复核（见 §5）。

[PROD_NOT_TOUCHED] 全程未接触生产 `:8080`、未触碰 `~/.peekview/`、未跑任何 CLI 写命令、未 commit、未改 `P2-design.md` / `P1-requirements.md` / `P2-review.md`。**本轮未造/删任何 entry**——B4 的机制验证用独立原型 + `backend/.venv` 直接跑（不依赖 debug server），隔离性优于走 HTTP。临时产物在 `<项目根>/.agate-tmp/r3-proto/`（未用 `/tmp`）。生产代码 `git status` 干净。

---

## 0. 复审结论

**`status: approved`** —— 阻塞项 **0 项**。

**B4 已闭环**，而且是**机制层面闭环**，不是文字改对。我按 D7 的文字描述独立重写了一份原型（不读它的探针代码），跑设计 V17 的 7 个形态全部通过、数字逐项吻合；再补 9 个**设计未覆盖**的形态（`srcset` / `preload` / `manifest` / `<a href>` / `<object data>` / `<video poster>` / `<embed src>` / 同名 basename 双文件 / CSS `url()` 内联二进制）+ 3 组递归/循环边界，并用**双向对账**（比设计的势断言更强）验证：报告说 `inlined` ⇒ 内容真在响应里；报告说 `skipped` ⇒ 内容真不在。**无一撒谎。**

N5–N8 四项**全部落地**，逐项实跑取证。

**修订者对第 2 轮处方的那处「加强而非推翻」成立**：它拒绝我建议的 `used_text_keys` + `_sibling_keys` 最小钩子，理由是那会给**假绿报表**。我独立复核源码——`used_text_keys` 全仓只有 **3 个写入点**（`:231` link stylesheet / `:249` script / `:298` svg-in-img），确实不含 CSS `@import`、CSS `url()`、`<link rel=icon>`；二进制侧连集合都不存在。**所以第 2 轮我那条处方被实测证伪，修正是对的。** 设计拿出了比我的建议更硬的证据——这正是 P2 该有的样子。

**判定尺度对照**：「判据不可执行」已消除（不变式在含非 css/js sibling 的真实形态下可满足，19 组实测）；「P4 会真出事」已消除（闭集含 `not_injectable`，P4 无需偷偷扩集或红着过）。剩余 6 项为**文字/schema 补充级 WARNING**（§3），按本轮判定尺度**不阻断 approved**。

---

## 1. B4 闭环核查（逐项实跑）

### 1.1 B4-① `inlined` 语义是否写死且合理 — **已闭环**

D7（`:409`）给出**单一定义句**：

> **`inlined` = 实际进入响应体的 sibling 个数**——即 `inject_resources()` 真正把该 sibling 的内容写进了返回 HTML 的个数（命中 `<link rel=stylesheet>` / `<script src>` / kind 追加 / `img|video|audio|source|track[src]` / `<link rel=icon>` / CSS `@import` 与 `url()` 中任一消费路径）。**不是**「预算层放行的个数」。

| 判据 | 结果 | 证据 |
|---|---|---|
| 是否写死为**唯一**读法（可 grep） | 是 | `:409` 定义句 + `:411` 显式否决另一读法并给理由 + `:417` 在不变式处**再次**锁定 + `:436` 禁止由 `requested - len(预算层 skipped)` 反推 |
| 是否覆盖全部七条消费路径 | 是 | 定义句枚举六类 + CSS 内部（`@import`/`url()`），与 `:422` 七处埋点表**逐条对应** |
| 选该读法是否合理 | 是 | `:411` 的理由成立。我复核 P1 `:382` 的 BDD-40 ② 原文「未被内联的**每一个**都必须在清单里可查」——kind-drop 不属预算层，按「预算层放行」读法确实既不算 skipped 也不算未内联 → 与 ② 冲突。**否决理由成立** |

### 1.2 B4-② `reason` 六元闭集是否完整 — **已闭环**

- 闭集定义（`:413`）：`count_limit` / `file_too_large` / `binary_too_large` / `total_budget` / `not_found` / `not_injectable`。
- **一致性脚本校验**：全文 `REASONS = {...}` 字面量**只有 1 处**（`:429`），6 元集合与正文枚举（`:413`）逐项相同；§3 完成标志 #8（`:631`）与 D10 的 BDD-40 行（`:507`）均写「六元闭集」。**无第二份字面量可漂移。**
- `not_injectable` 语义写死（`:415`）并**点名覆盖两条既有静默丢弃路径**：kind-drop + 未被引用的二进制/SVG。我复核源码：`_detect_kind`（`:78-93`）确实只认 `.css`/`.js` 与 `language ∈ {css, javascript, js}`；`:257-260` 的 `if not kind: continue` 确实静默跳过。**枚举无遗漏。**
- **六元是否够**：19 组形态实测，`{reason}` 始终 ⊆ 该集合且每项可归入其一。**无需第七元。**

### 1.3 B4-③ `consumed: set[id(...)]` + 七处埋点是否覆盖所有消费路径 — **已闭环（独立原型验证）**

**方法**：不读设计的探针（`.agate-tmp/probe-b4*.py`），只按 D7 文字从零实现（`consumed: set[int]` of `id(f)` + `owners: dict[str, SiblingFileData]` 共用一张 + `_process_css_refs` 关键字可选透传含递归）。

**设计 V17 的 7 形态复现（数字逐项吻合）**：

| 形态 | 设计称 | 我实跑 |
|---|---|---|
| S1 V8 真实形态（link+svg+script + README.md + data.json） | 5/3/2 | `req=5 inl=3 skipped=2` |
| S2 零引用（a.css/a.js/a.svg/a.png/a.md/a.json） | 6/2/4 | `req=6 inl=2 skipped=4` |
| S3 `@import` + CSS `url(svg)` + favicon | 4/4/0 | `req=4 inl=4 skipped=0` |
| S4 未引用小二进制 + 被 `<script src>` 引用的 json | 2/1/1 | `req=2 inl=1 skipped=1` |
| S5 全不可注入 | 2/0/2 | `req=2 inl=0 skipped=2` |
| S6 空 siblings | 不崩 | `skipped=[]` 不崩 |
| S7 嵌套 path 按 basename 引用 | 1/1/0 | `req=1 inl=1 skipped=0` |

**自造 9 形态（设计未覆盖）—— 全部满足不变式，双向对账无撒谎**：

| 形态 | 结果 | 说明 |
|---|---|---|
| `srcset` 引用的二进制 | 1/0/1 | 非可注入 → 如实记 `not_injectable` |
| `<link rel=preload>` + `<link rel=manifest>` | 合并 5/2/3 | 非可注入 → 如实记 |
| `<a href="x.css">` | 1/1/0 | 文本 css 经 kind-append 消费 → 记 inlined（**语义边界，见 W2**） |
| `<object data>` / `<embed src>` | 4/1/3 | 非可注入 → 如实记 |
| `<video poster>` | 同上 | `poster` 不注入 → 如实记 |
| 同名 basename 双文件（一被引用） | 2/1/1 | 未命中者如实记 `not_injectable` |
| 同名 basename 双文件（都未被引用） | 2/2/0 | kind-append 各自消费 → 都记 inlined |
| CSS `url()` 内联二进制（HTML 未引用） | 2/2/0 | **关键**：不经 `used_text_keys` 也正确记为已消费 |
| SVG 双通道（`<img src>` + CSS `url()`） | 2/2/0 | 不重复计数 |

**递归/边界交互（重点——设计只写「含递归」，未给形态）**：

```
@import 链 n0→n5（_CSS_RECURSION_LIMIT = 3，超限后留字面 @import）
  → req=6 inl=4 skipped=2
  → MK0..MK3 内容落地并计 inlined；MK4/MK5 如实计 not_injectable
  → 无「标记为已消费但内容缺席」的撒谎项
循环 import（pa↔pb）→ 3/3/0；自 import → 2/2/0；均不撒谎
```

**方法学更正（诚实标注）**：我首轮跑出两处 `LIE-CONSUMED`，初看像埋点漏洞。复查是**我的探针缺陷**——`@import "x.css"` 是**整段**被替换为解析结果的，我把 marker 写在 `@import` 语句**内部**，于是文件被正确消费时 marker 也一并消失。把 marker 挪到同文件的**独立规则**后两处均转 OK。**设计无此缺陷，是我的 marker 选择失误**（记此一笔，免得下一轮有人被同样的假信号误导）。

**关于 dispatch-context 点名的旁证**：`used_text_keys` 全仓只有 3 个写入点，我复核为真。→ **修订者拒绝我的最小钩子、改用 `consumed` + 七处埋点，是必要的加强，不是过度设计。**

**七处埋点是否都在 `inject_resources()` 内**（B2a 的 `skipped_out` 约定不被破坏）：是。六处落在 `:231`/`:249`/`:263`/`:292`/`:298`/`:315`（我逐行核对，**全部准确**，均在函数体内）；第七处经 `_process_css_refs` 透传（`:127` 定义，`:145`/`:162`/`:166` 登记，`:151` 递归继续透传），**不改返回类型**、新参数关键字可选 → 既有 8 处测试调用仍可按 3–4 个位置参调用。`inject_resources` 签名仍 `-> str`，`skipped_out` 关键字可选 → **13 处既有 `= inject_resources(...)` 调用零改动**（`grep` 复核计数确为 13）。

### 1.4 B4-④ BDD-40 素材是否补了非 css/js sibling — **已闭环**

§3 完成标志 #8（`:631`）与 D10 的 BDD-40 行（`:507`）均要求**三件素材**：① >768KB 二进制（`binary_too_large`）② 含 `<` `>` `</script` 的文件名+path ③ **非 css/js sibling（`README.md` 或 `data.json`）→ 必须 `reason == "not_injectable"`**。

两处都在且措辞一致。**这一条是关键**——没有 ③，P3 用例会像 V8 那样「恰好绕开 kind 维度」而继续假绿（第 2 轮 B4 正是这样发现的）。**已补。**

### 1.5 B4 判定

**已闭环。** 四项子核查全通过，第 ③ 项经**独立原型 + 19 组形态**验证（超出设计自证的 7 形态）。第 2 轮的唯一 BLOCKER 解除。

---

## 2. 架构问题（阻塞级）

**无。**

---

## 3. 架构问题（非阻塞）

六项均为**文字 / schema 补充级**，不影响 P4 的主路径执行，不阻断 approved。建议与 P3 起步并行修（W1/W4/W5/W6 各改一两句，W2/W3 各补一句声明）。

### W1. D7 的 JSON 样例数字与「`count_limit` 机制」互不自洽（会误导 P3 照抄素材）

`:395-404` 样例写 `requested 45 / inlined 40 / skipped 5 项（1 count_limit + 4 其他）`。按 `_MAX_INJECT_IDS = 40` 推算：

```
requested 45, limit 40  →  selected 40, overflow 5   ⇒ count_limit 项应为 5 个，样例只列 1 个
selected 40 中有 4 项非 count 类丢弃  →  inlined = 36，样例写 40
→ 两个分量按新语义都不可同时成立；但样例的势恰好成立（45 - 40 = 5 == len(skipped)=5）
```

**即：势对了，两个分量的取值在机制上不可同时成立。** 建议改为 `<count_limit 5 项 + 其余 0 项>`（`45/40/5`），或降到 `44/40/4`（`count_limit` 1 + 其他 3 各 1）。

- **为何是 WARNING 而非 BLOCKER**：`§3 #8` 与 G10 的**断言**是脚本化的（势 + 闭集 + 不重名），不读样例数字；P3 若照抄样例**数值**造件会造不出，但会在红灯阶段立刻发现——属「浪费一轮」而非「静默假绿」。
- 值得改的理由：`R4`（`:160`）自己立了「不断言具体数值」的原则，而样例是全设计唯一的数值示例，最容易被照抄。

### W2. `<a href="x.css">` 这类「HTML 引用了但注入语义未生效」的项被记为 `inlined`（需一行边界声明）

实测：`<html><body><a href="style.css">click</a></body></html>` + `style.css` → `inlined=1, skipped=[]`，而输出里 `href="style.css"` **仍在**（悬空）且 CSS 另以 `<style>` 追加。

- **不是 B4 的漏洞**：css 内容确实进了响应体（kind-append 路径），按写死的定义 `inlined` 判对无误，不变式成立。
- 但用户在 iframe 里点该链接会 404。属**既有行为**（现状 `inject_resources` 本来如此），本任务不引入也不修复。
- **建议**：在 `§0.2 不改什么` 补一行「`<a href>` / `srcset` / `<object data>` 等非可注入引用形态的悬空引用属既有行为，本任务不改——不属 BDD-40 的『未被内联』范畴（内容已注入，只是引用未重写）」。**不登记技术债**：它不是债，是明确的边界。

### W3. BDD-40 ③（「不出现被截断的、语义不完整的资源内容」）在 D10 的 BDD-40 行里未落判据

D10 的 BDD-40 行（`:507`）覆盖 ①（可机读）与 ②（未内联项可查），**没有 ③ 的落点**（P1 `:382` 的 ③）。

现状事实：`_CSS_RECURSION_LIMIT = 3` 超限时 `_process_css_refs` **返回原样内容**（`:140-141`），未解析的 `@import` 字面残留 → 严格说是「语义不完整的 CSS」。实测残留 1 处。

- **为何仍不阻断**：`§0.2`（`:140`）已显式声明 `_CSS_RECURSION_LIMIT` **不动**、理由是「P1 §6.5 明确不处理」——即 ③ 在这一维上**已被 P1 豁免**。而 B4 的记账反而让这个残留**第一次可观测**（n4/n5 出现在 `skipped`），比现状更好。
- **建议**：在 D10 的 BDD-40 行补一句「③ 的判据范围：仅覆盖『整块内容被截断』（base64 截半 / CSS 块未闭合）；`@import` 深度超限的**字面残留**属 P1 §6.5 已豁免项，由 `not_injectable` 记账覆盖」。把豁免写成判据边界，免得 P3 把它当缺陷去断言。

### W4. `skipped[]` 的 `size` 字段无可靠来源——`SiblingFileData` 没有 `size`

D7 的每项 schema 是 `{filename, path, reason, size}`，但 `not_injectable` 项是在 `inject_resources()` 内生成的，而该函数拿到的 `SiblingFileData` **只有 6 个字段，无 `size`**（我核对 `:26-32`）。P4 只能自行推导：

```
文本：len(content) —— 是**字符数**不是字节数（_build_sibling_data 用 decode("utf-8", errors="replace")）
二进制：content 是 base64 字符串，len 需 *3/4 还原 —— 实测 1000 字节 → base64 1336 字符（+33.6%）
```

- **为何不阻断**：`R4`（`:160`）已明确「P6 只断言条目数 == N − 内联数 与文件名可对应，**不断言具体数值**」，BDD-38/40 的判据全部不含 `size`。所以 `size` 是**信息性字段**，精度不影响任何 gate。
- **建议**：在 D7 补一句「`size` 为**近似值**（文本取字符数、二进制按 `len(content)*3//4` 估算）；判据不得依赖该字段的精确值」。否则 P4 可能花时间去找一个并不存在的精确来源（或误加字段破坏 13 处调用零改动）。

### W5. `not_found` / `count_limit` 两类项的 `filename` / `path` 来源未定义

D7 要求每项带 `filename` + `path`，但：

- **`not_found`**：id 在 entry 内不存在 → `get_files_by_ids` 查不到记录（我核对 `:1431-1441` 只返回命中行）→ **没有 filename/path 可取**。
- **`count_limit`**：溢出 id 从未进 `get_files_by_ids`（`select_inject_ids` 阶段就截断）→ 同样无记录。

设计只写了「把溢出 id 落进 `overflow`」（`:91`），未写溢出项的文件名从哪来。

- **为何不阻断**：P3 的「预算五态」用例（`:96`）**不含 not_found**，count_limit 用例（BDD-38）的判据是「条目数 == N − 内联数 + 文件名可对应」——若实现选「溢出项也查一次拿 filename」或「`filename` 置 null 并加 `file_id`」，两种都能让势断言与 ③ 通过（取决于素材）。属**实现自由度**，不是不可执行的判据。
- **建议**：在 D7 明确二者取一——(a) 溢出/缺失 id 也做一次轻量查询以带出 `filename`/`path`（成本：一次 `select`）；或 (b) schema 补 `file_id` 字段、显式声明「`not_found` / `count_limit` 项 `filename` 为 `null`」，并同步 BDD-38 ③ 的「可对应到具体文件名」在 count_limit 维度的判据改为「按 `file_id` 对应」。

### W6. 「`_process_css_refs` 既有 **5 处**测试调用」与实测 **8 处**不符（且引用行号区间漏 3 处）

`:422` 与 `:1006` 两处都写「该函数既有 **5 处**测试调用（`test_html_render.py:372-410`）」。实测：

```
_process_css_refs( 在 test_html_render.py 共 8 处调用（1 处为 import，故 8 处真实调用）
  375 / 383 / 400 / 408 / 416 / 426 / 433 / 438
其中 :416 / :426 / :433 / :438 四处落在所引「372-410」区间之外
```

- **不阻断**：结论（新参数必须关键字可选）**对所有 8 处都成立**，改动要求不变，只是计数与引用区间不准。
- **为何值得改**：若 P4 用「检查 372-410 区间零改动」作为自证，会漏掉 416/426/433/438 四处——那正是「位置参传入 + 新参默认 None」是否真的不破坏既有调用的**验证面**。建议改成「既有 **8 处**测试调用（`:375`–`:438`）」。

---

## 4. 测试缺口

第 2 轮的 G1–G10 已由设计纳入，本轮不重提。基于本轮实测**新增 2 条**（不阻断，P3 可择机纳入）：

### G11. `inlined` 的「双向对账」应成为一条独立断言，而不只断势

G10 断三个：势（`requested - inlined == len(skipped)`）、值（闭集）、去重。但我在本轮实测确认：**势断言在「报表撒谎」时仍会绿**——第 2 轮我正是用「势对但事实不对」的形态驳倒了最小钩子。

具体地：若实现把「标记 consumed 但内容实际缺失」的项算进 `inlined`、又不进 `skipped`，则等式两侧**同时偏小**而等式仍成立。

**建议补**（素材已在 BDD-40 的三件里，成本约 5 行）：

```python
for f, needle in [(css, "color:red"), (md_sib, "README-CONTENT"), ...]:
    landed = needle in resp.text
    reported_skip = any(s["filename"] == f.filename for s in report["skipped"])
    assert landed != reported_skip, f"{f.filename} 的报告状态与事实不符"
```

- **为何值得加**：这是唯一能检出「数字自洽但与事实不符」的断言形态，且它正是 B4 争议的判别式。不加的话，未来若有人「简化」回 `used_text_keys` 式实现，势断言不会报警。

### G12. `@import` 链跨递归上限的形态应进 P3 用例（或显式声明不测）

实测「n0..n5 链」证明：递归超限时 n4/n5 **正确地**被记为 `not_injectable`——这是第七处埋点（递归透传）**唯一**会被单独证伪的形态。设计 `:422` 已写明「`@import` 链第 2 层起的消费全部漏记」是风险，但 V17 的 S3 只测了**单层** `@import`。

**建议**：P3 加一个「两跳 `@import`（a→b→c）」最小用例，断言 b、c 均不在 `skipped` 里——直接护住递归透传那一行。

---

## 5. 第 1、2 轮已闭环项 + 锁定决策的未推翻性复核

| 项 | r3 是否触碰 | 结论 |
|---|---|---|
| B1（R1 归因：`_create_entry` 读 POST 序） | 未改（`:896`/`:980` 自述） | 保持 |
| B2a（`inject_resources` 出参方案，13 处零改动） | 只在 `skipped_out` 上追加第六类 reason，签名/返回类型未变 | 保持（`grep` 复核 13 处仍在） |
| B2b（`>768KB` 二进制纳账 `binary_too_large`） | 未改 | 保持 |
| B3（序列化转义 `<`） | 未改 | 保持 |
| B4（本轮） | 已修 | **闭环**（§1） |
| N5 / N6 / N7 / N8 | 已修 | **全部闭环**（§6） |
| 锁定 1–8（前端锚点/观测面/resolver 等） | 未改 | 保持 |
| 锁定 9：预算数值 `40 / 2MiB / 8MiB` | 未改 | 保持（B4 只补 reason 成员） |
| 锁定 10：`P3` 只跑前端 | 未改 | 保持 |
| 锁定 11：`gate_commands` 全 key 合法 | 未改 | **复跑通过**：23 key，`is_legal_gate_key` 全 `True`；`P3_*` 仅 `P3_formatter`（元键豁免），无违规检测键 |
| 锁定 12：4 批 `output` 互斥 | N8 新增 1 文件 | **仍互斥**：脚本校验 24 条目零重复 |
| `candidate_count: 6` | 未改 | 保持 |
| P1 基线（54 条 BDD） | 一字未改 | 保持（B4 只补用例素材，不动 Then 语义） |

**一处需主 Agent 知晓**：第 2 轮我对 `P2-review.md §6.1-3` 的追溯更正（`:272` 只有一处、就在 `_build_sibling_data` 体内）**仍然成立**，设计已在 `:138`/`:980` 按此处置。`P2-review.md` 的旁证措辞不改变动作，主 Agent 无需回改。

---

## 6. N5–N8 落实核查（逐项实跑）

### N5 — 文件名统一 + 去 `| tail` + 两步取证：**已闭环**

| 判据 | 结果 | 证据 |
|---|---|---|
| `test_entry_order.py` 是否归零 | 是（仅剩 2 处**叙述性**提及） | `grep -c` = 2，均为 `:761`「全设计不再出现该名」与 `:1030` 变更记录——**无任何现存动作指令** |
| `test_entry_file_order.py` 是否唯一名字 | 是 | `:27`（tests_filter）/`:33`（output）/`:97`（§0.1A）/`:755`（§5.1 命令）/`:844`（§8 批表）全为该名 |
| `\| tail -30` 是否去掉 | 是 | `:755` 为裸 `pytest … -q --tb=line`；`:758` 显式警告「管道把非零 exit 变 0」并给 `set -o pipefail` 备选 |
| 删除理由是否有实测 | 是 | 我独立复现：`pytest <不存在文件> \| tail -30` → **exit 0**（假绿）；裸跑 → **exit 4**。警告内容属实 |
| 两步法是否解决假绿 | **是** | `:761-764`：① 先单跑 `test_html_render.py` 取 assertion failure ② 再跑完整命令确认建文件后全绿。**机理**：collection error 会让 pytest 在**收集阶段**就 exit 4、根本不进入任何 test body，从而掩盖「本应出现的 assertion failure」；两步法把两者分开取样，各自归因 |

**补充实测（dispatch-context 要我判断两步法解不解决假绿）**：构造对照——同一进程里放一个「调用不存在 kwarg」的用例和一个「纯 assertion」用例，实测两者都 `FAILED`（`TypeError` / `AssertionError`），**exit 均为 1**。所以二者在 **exit code 层面不可区分**——设计的判据写的是「输出 ≥1 个 assertion failure 且**恰好是** assertion failure（不是 collection error）」，必须**读输出文本**而非只看 exit code。`:763` 的判据原文已明确要求区分，**可执行**。

### N7 — `119` → `73`：**已闭环**

- `grep "\b119\b"` 全文仅 1 命中，且是 `:1031` 的**变更记录行**（叙述「三处 119 全部改为 73」），非现存断言素材。
- 正文三处（`:173` R13 / `:765` §5.1 / `:829` V12）均为 **73**。
- **我独立复跑**：`pytest tests/test_html_render.py tests/test_entry_service.py -v` → **73 passed in 1.98s**，与设计一致。
- 且 `:765` 补了一句我第 2 轮没要求的澄清：「本命令的选择集是 `test_html_render.py + test_entry_file_order.py`，**不是**上面这个 73 的组合」——消除了「基线数与被测集不符」的误用风险。**改得比我的处方更严谨。**

### N8 — 批 `output` / `tests_filter`：**已闭环**

- `dispatch_plan.batches[backend-render-budget].output` 含 `backend/tests/test_entry_file_order.py`（5 → **6** 项，`:33`）。
- `tests_filter` 同步含该文件（`:26-27`）。
- §8 批表两列同步（`:844`）。
- **互斥性校验**：脚本解析 frontmatter → 24 个 `output` 条目，**零重复**（4 批仍逐项互斥）。

### N6 — `files_to_read` 路径 + 行号区间：**已闭环**

- `:681` 路径为 `frontend-v3/src/composables/__tests__/useCsvParser.spec.ts:45-70`，**并注明「不是 components/」**。`ls` 复核：该文件确实只在 `composables/__tests__/`，`components/__tests__/` 下不存在。
- 三处 `:51` 均改为 `:51-57` 并注明断言在 `:55`（`:282` / `:624` / `:918`）。逐行核对：`:51` 是 `it('test_bdd_23_empty_csv_no_rows', ...)`、`:55` 是 `expect(result.totalRows).toBe(0)`。**行号准确。**
- 顺带：`:68` 的 `toThrow()` 契约行号也正确。

---

## 7. 锁定决策（本次评审后确定）

1. **`inlined` 语义按 D7 `:409` 写死为「实际进入响应体的 sibling 个数」**，不得由 `requested - len(预算层 skipped)` 反推。P3/P4 硬约束。
2. **`reason` 闭集冻结为六元**（`count_limit` / `file_too_large` / `binary_too_large` / `total_budget` / `not_found` / `not_injectable`）。P4 **无权增删**；若实现中确需第七元，回 P2 而非就地扩集。
3. **消费追踪用 `consumed: set[id(SiblingFileData)]` + `owners` 全 map + 七处埋点**，不用 `used_text_keys` 最小钩子（后者经实测会给假绿报表）。`_process_css_refs` 的新参数**必须关键字可选**（保护既有 8 处测试调用 + 13 处 `inject_resources` 调用零改动）。
4. **BDD-40 用例素材固定为三件**（>768KB 二进制 / 含 `</script` 的 path / 非 css/js sibling），缺任一件该缺口在 P3/P6 仍测不出。
5. **`not_injectable` 的判定点必须在 `inject_resources()` 内部**，`skipped` 填充顺序不可颠倒（先预算层、后函数内追加）。
6. **W1–W6 为文字/schema 补充级建议**，P3 起步前修或并行修均可，不构成 P2 阻塞。

---

## 8. 证据边界（如实标注做了什么、没做什么）

**做了什么**：

- 独立从零实现 B4 原型（不读设计探针代码），跑设计 V17 的 7 形态 + 自造 9 形态 + 3 组递归/循环边界 = **19 组**。
- 对每个形态做**双向对账**（比设计的势断言更强）：报告 inlined ⇒ 内容真在响应里；报告 skipped ⇒ 内容真不在。
- 逐行核对七处埋点行号（`231/249/263/292/298/315` + `_process_css_refs` 的 `127/145/151/162/166`），**全部准确**。
- 复核 `used_text_keys` 的 3 个写入点、`_detect_kind` 判定分支、`_CSS_RECURSION_LIMIT` 返回路径、`SiblingFileData` 的 6 字段构成、`get_files_by_ids` 的查询口径。
- 复跑 `pytest tests/test_html_render.py tests/test_entry_service.py -v` → 73 passed。
- 脚本校验 `gate_commands` 23 key 合法性、`dispatch_plan` 24 条目互斥性、`REASONS` 字面量唯一性。
- 构造 pytest 对照实验，确认 `TypeError` 与 `AssertionError` 在 exit code 层面不可区分（影响 N5 判据可执行性判断）。

**没做什么（明确边界）**：

- **未跑前端**（vitest / `vue-tsc` / `make typecheck`）——本轮范围是 B4（后端注入）与 N5–N8；design 侧 R2-1/R2-2 属 `plan-design-review` 的域，其第 2 轮已 approved 且 V18/V19 有实测，不重复。
- **未跑全量 `make test-quick`**——预存失败（`test_cli_remote` 沙箱只读）会让「有红恒真」，对 B4 无判据价值；`R13` 已登记该风险并给出处置。
- **未造/删 entry**——B4 的机制验证用独立原型即可覆盖，走 HTTP 只引入 DB 状态而**不增加任何判据**。
- **未在浏览器验证 `siblingFileIds` 不过滤 kind 的实际请求体**——源码复核该 computed 确实无 kind 过滤，但未跑浏览器确认。这是 B4 的**动机**而非**闭环判据**；闭环判据（埋点充分性）已由原型独立验证。
- **未验证 W1–W6 的修复**（设计未改，属建议）。

---

## 9. 给主 Agent 的一句话判断

**B4 已闭环（机制层，19 组形态独立验证），N5–N8 全部落地，`status: approved`，阻塞 0 项。** 剩余只有 6 条文字/schema 补充级 WARNING（样例数字、`<a href>` 边界、BDD-40 ③ 判据范围、`size` 近似性、`not_found` 标识来源、8 处调用的计数），可在 P3 起步时顺手改，**不必再开一轮 P2**。

> 附一句给修订者：第 2 轮我建议的 `used_text_keys` 钩子是错的，它的反驳（三条真实消费路径不进该集合 + 二进制侧连集合都没有）经我独立复核**成立**。用 `consumed` + 七处埋点替代是对的，且成本（一个关键字可选参数）远低于它避免的风险（假绿报表）。
