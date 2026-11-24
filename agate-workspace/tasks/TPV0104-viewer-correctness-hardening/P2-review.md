---
phase: P2
task_id: TPV0104
type: review
parent: P2-design.md
trace_id: TPV0104-P2-20261125-review-lead-r2
status: approved
created: '2026-11-25'
agent: review
---

# P2 专家组汇总评审（第 2 版 · 覆盖第 1 轮）— TPV0104 Viewer 正确性与资源边界加固

> **汇总范围**：`P2-review-eng.md`（`plan-eng-review`，第 3 轮 · 最终复审，`approved`）+ `P2-review-design.md`（`plan-design-review`，第 2 轮 · 复审，`approved`）。
> **本文件职责**：**只汇总、不新评**。核实两份专家结论 → 单一门槛判定 → 残留 WARNING 清单 → 锁定项 → 给 P3 的交接要点。
> **本文件覆盖第 1 轮的 `P2-review.md`（`status: rejected`，5 BLOCKER + 7 MAJOR）**。第 1 轮的锁定项（原 §7）在本文 §4 **完整保留**，未删除任何一条。

**引用约定**：裸 `§N` / `§N.N` 指**本文件**的节；指涉他文档时一律带文件名前缀，如「`P2-design.md` §11.8」「`P2-review-eng.md` §3」「`P2-review-design.md` §4.1」「`DESIGN.md` §7」；`:NN` 指被引文档的行号。

[PROD_NOT_TOUCHED] 本汇总轮全程只读 + 只做脚本核对：读两份专家复审、`P2-design.md`、第 1 轮 `P2-review.md` 与进度文件；只跑 `git status` / `rev-parse`、`grep -c` 计数核对、`agate-md-field-get.py` 读 frontmatter、`agate-read-gate-commands.py` 读 gate 块。**未发起任何写操作到生产**：未接触生产 `:8080`（实测不可达 `000`），未触碰 `~/.peekview/`，未跑 CLI 写命令，未造/删任何 entry，未 commit，未改 `P2-design.md` / `P2-review-eng.md` / `P2-review-design.md`。debug `:8888` 仅用于确认在线状态（`200`），未发业务请求。临时探针文件在 `/home/kity/oclab/peekview/.agate-tmp/`（**未用 `/tmp`**），仅用于验证 `agate-md-field-set.py` 的角色白名单行为，已用完即弃。

---

## 1. 汇总结论

**`status: approved`**

按组长规则第 4 条：**全票无 BLOCKER → `status: approved`**。两位专家第 3 轮**均自评 `approved`、阻塞项各为 0**，本判定无裁量空间：

| 专家 | 角色 | 轮次 | 自评结论 | 阻塞数 |
|---|---|---|---|---|
| `P2-review-eng.md` | plan-eng-review | 第 3 轮（最终复审） | `approved` | **0** |
| `P2-review-design.md` | plan-design-review | 第 2 轮（复审） | `approved` | **0** |

**核实方式**（不只读正文，用脚本读 frontmatter）：`agate-md-field-get.py agent` / `status` 分别读回 `plan-eng-review` / `approved` 与 `plan-design-review` / `approved`；两者 `agent` 均 **≠ `main`**（满足 `check-gate.py P2` 的 `agent≠main` 硬拦截）。正文表述与 frontmatter 自洽——eng 正文 §0「`status: approved` —— 阻塞项 **0 项**」，design 正文 §0「`status: approved`」，均与 frontmatter 一致，无第 1 轮 P1 出现过的那种「status 被改绿而正文仍是打回」的中间态。

**一句话结论**：P2 方案设计经三轮评审收敛，第 3 轮两位专家全票 `approved`、阻塞 0；`P2-design.md` 的架构主体、UI 设计层与注入记账机制均经专家独立实跑验证，**可进入 P3**。残留 6 项 WARNING + 2 条测试缺口建议（§3）不阻断 P2，建议 P3 起步时处理。

### 1.1 三轮演化（5 BLOCKER + 7 MAJOR → 1 BLOCKER → 0）

| 轮次 | 专家结论 | BLOCKER | MAJOR | 组长汇总 |
|---|---|---|---|---|
| **第 1 轮** | eng `rejected`（B1/B2/B3）+ design `rejected`（D-1/D-2） | **5** | **7**（M1–M7，全部来自 design） | `rejected`（第 1 轮 `P2-review.md`） |
| **第 2 轮** | eng `rejected`——但**原 3 项 BLOCKER 全部闭环**，**新增 1 项 B4**（`reason` 五元闭集之外还有一条成规模的静默丢弃路径）；design `approved`（七维 8–9 分，但新发现 R2-1 / R2-2 两项 MAJOR） | **1**（B4） | 2（R2-1 / R2-2） | `rejected`（B4 为 BLOCKER，`retries[P2]` 用满 3/3） |
| **第 3 轮** | eng `approved`——B4 **机制层闭环**，N5–N8 全部落地；design 结论维持 `approved`（其域第 3 轮按 R2-1 / R2-2 处方落地，见 §4.2 第 7 条） | **0** | 0 | **`approved`（本文件）** |

**收敛特征（值得记录，不是新意见，是对既有证据的归纳）**：

1. **第 1 轮 5 项 BLOCKER 全部落在 spec 层**（候选数、取值、落点、承载形态），未触及 P1 的 54 条 BDD 基线——两位专家当时均未要求退回 P1，本轮结论印证了该判断。
2. **第 2 轮的 B4 是「越修越深」型**：第 1 轮的 B2b 让 `_build_sibling_data` 的静默丢弃进入记账，第 2 轮评审进一步发现 `inject_resources()` **函数内部**还有 kind-drop 与未引用二进制两条静默路径，五元闭集覆盖不到 → 闭集扩到六元。
3. **评审链自我纠错运转了两次**，两次都是专家主动承认自己上一轮的处方有问题：
   - eng §9 自述「第 2 轮我建议的 `used_text_keys` 钩子是错的」，经它独立复核（该集合全仓仅 3 个写入点 `:231`/`:249`/`:298`，不含 `@import` / `url()` / favicon）确认修订者的反驳成立；
   - eng §3 自述首轮跑出的两处 `LIE-CONSUMED` 是**自己探针的 marker 选择失误**（marker 写在 `@import` 语句内部，被整段替换时一并消失），不是设计缺陷。
4. **第 3 轮零新增阻塞**：eng 的 19 组形态独立验证（设计 V17 的 7 形态 + 自造 9 形态 + 3 组递归/循环边界）全部满足不变式且双向对账无撒谎，说明 B4 的修法在**机制层**成立而非仅仅文字改对。

---

## 2. 两份专家第 3 轮结论

### 2.1 `P2-review-eng.md`（plan-eng-review，第 3 轮 · 最终复审）

- **status**：`approved` ／ **阻塞数**：**0**
- **复审范围**：只核它第 2 轮打回的 **1 BLOCKER（B4）+ 4 项非阻塞（N5–N8）**；第 1、2 轮已闭环的 B1 / B2a / B2b / B3 与 12 项锁定决策**不重做**，只做未推翻性复核（其 §5）。

**关键验证方式**（该专家自述的方法，本文照录，不复评）：

| 项 | 验证方式 | 结论 |
|---|---|---|
| **B4-①** `inlined` 语义 | 查 `:409` 是否有单一可 grep 定义句、`:411` 是否显式否决另一读法并给理由、`:417` / `:436` 是否再锁定与禁止反推 | 已闭环；否决「预算层放行」的理由（会让 BDD-40 ② 失效）经它复核 P1 `:382` 原文成立 |
| **B4-②** `reason` 六元闭集 | 脚本比对 `REASONS = {...}` 字面量出现次数 + `§3 #8` 与 D10 的 BDD-40 行三处是否逐项一致；再核对源码 `_detect_kind`（`:78-93`）与 `:257-260` 的 `if not kind: continue` | 已闭环；字面量全设计**只有 1 处**（`:429`），无第二份可漂移；枚举无遗漏，19 组实测无需第七元 |
| **B4-③** `consumed` + 七处埋点 | **不读设计的探针代码**，只按 D7 文字从零重写原型；跑设计 V17 的 7 形态（数字逐项吻合）→ **自造 9 个设计未覆盖的形态** → **3 组递归/循环边界** = 共 **19 组**；每组做**双向对账**（比势断言更强） | 已闭环；「报告 inlined ⇒ 内容真在响应里」「报告 skipped ⇒ 内容真不在」**无一撒谎** |
| **B4-④** BDD-40 素材 | 查 `§3 #8`（`:631`）与 D10（`:507`）是否都要求**三件素材**（>768KB 二进制 / 含 `</script` 的 path / **非 css/js sibling**） | 已闭环；第 ③ 件是关键——没有它 P3 会像 V8 那样「恰好绕开 kind 维度」继续假绿 |
| **N5** | `grep -c "test_entry_order.py"` 只剩 2 处叙述性提及；`\| tail -30` 已去；**独立复现假绿**：`pytest <不存在文件> \| tail -30` → exit 0，裸跑 → exit 4；并构造对照确认 `TypeError` 与 `AssertionError` 在 **exit code 层面不可区分** | 已闭环；两步取证（`:761-764`）解决 collection error 掩盖问题，判据「恰好是 assertion failure」必须读输出文本——`:763` 原文已明确要求 |
| **N7** | `grep "\b119\b"` 仅 1 处变更记录行；**独立复跑** `pytest tests/test_html_render.py tests/test_entry_service.py -v` → **73 passed in 1.98s** | 已闭环；且设计补了「本命令选择集不是上面这个 73 的组合」的澄清，比原处方更严谨 |
| **N8** | 脚本解析 frontmatter 校验 `output` / `tests_filter` 同步 + 24 个 `output` 条目**零重复** | 已闭环；4 批仍逐项互斥 |
| **N6** | `ls` 复核 spec 路径只在 `composables/__tests__/`；逐行核对 `:51` 是 `it()`、`:55` 是断言 | 已闭环 |

**锁定决策复核（其 §5）**：B1 / B2a / B2b / B3 未触碰即保持；锁定 1–8、锁定 9（预算数值 `40 / 2MiB / 8MiB`）、锁定 10（`P3` 只跑前端）、锁定 11（`gate_commands` 全 key 合法——**复跑为 23 key，`is_legal_gate_key` 全 `True`，`P3_*` 仅 `P3_formatter` 元键豁免**）、锁定 12（4 批 `output` 互斥，24 条目零重复）、`candidate_count: 6`、P1 基线（54 条 BDD 一字未改）——**无一被推翻**。

### 2.2 `P2-review-design.md`（plan-design-review，第 2 轮 · 复审）

- **status**：`approved` ／ **阻塞数**：**0**
- **评审对象**：`## UI 设计`（`:486-574`）、D5、`§11 修订记录`；形态 `layout`（与 P1 `ui_render_shape` 一致），启用**布局 / 交互 / 视觉**三组维度。
- **证据等级**：真实浏览器实测（debug `:8888` + CDP Chrome `localhost:18800`，Chrome/158）+ 源码逐函数核对 + `vue-tsc --noEmit` 类型探针。

**七维评分（第 1 轮 → 第 2 轮 / 本轮现状）**：

| # | 维度 | 第 1 轮 | 第 2 轮 |
|---|---|---|---|
| 1 | 交互状态覆盖率 | 8 | **9** |
| 2 | AI Slop 风险 | 9 | **9** |
| 3 | 移动端考虑 | 5 | **9** |
| 4 | 可访问性 / 键盘可达 | 8 | **9** |
| 5 | 组件完整性 | 7 | **8** |
| 6 | 视觉设计（合计 0–10） | 7 | **9**（2+3+2+2） |
| 7 | 交互设计细节（合计 0–10） | 6 | **9**（4+3+2） |

**关键验证方式**（其 §6 自述）：

- **D-1 闭环**：三组布局层候选（L/V/I 各 3 个）确为布局层而非架构级分叉；两个否决项均由**独立可核的 BDD 判据**支撑而非个人偏好——L2 因 `OverflowMenuSheet.vue:2` 的 `Teleport to="body"` 使元素不属底栏（BDD-24 ① FAIL）、I2 因 `OverflowMenu.vue:22` 的 `v-if="isOpen && variant === 'dropdown'"` 收起时 DOM 不存在（BDD-23 FAIL）。
- **D-2 闭环**：`padding-left: 0` 的 no-op 论证已删净；用**往真实编译后的 scoped 样式表 `insertRule`** 的忠实模拟验证 h1 与 h2 首次可区分（`fontWeight 600` vs `400`、`color #e9eef4` vs `#9aa7b4`、`marginTop 12px` vs `4px`）。
- **D-3 闭环**：逐位复现 V14 的三档视口 × 两 `gap` 值（含 `5.39 / 20.39 / 35.39` 三个小数、`barH` 恒 64）；落点唯一性独立确认（组件 scoped 规则覆盖 `layout.css` 同名规则）；最终等级它自己统一为 **MAJOR（非 BLOCKER）**，理由是「覆盖不足，不是方案错误」且已单点闭环。
- **M3–M7 + MINOR**：M3 核实 `DESIGN.md:239` 的 compact 档确为 18px、并补 `:162` Selection rule；M4 字面文案满足 BDD-34 的「含 5 与 11」；M5 核实 `layout.css:270` 的 `transition: all var(--transition-fast)` 存在；M6 三条理由；M7 校验点 ⑥ 已补；N5 / N6 均「声明不处理/权衡 + 理由」。
- **桌面三档独立重测**（不采信 V15 文字）：1024 / 1280 / 1440 的 `.actions-area` 与 `title-group` 逐位一致，第 1 轮「4px 差是 flex `gap` 尾槽、不是裁切」的自我更正**未回退**。

**两项 MAJOR（它列为 MUST-FIX，已在第 3 轮落地，见 §4.2 第 7 条）**：

- **R2-1**：h1 新规则吃掉 `.active` 的强调色——`.toc-item.toc-level-1 a[data-v]` 与 `.toc-item.active a[data-v]` 特异性同为 `(0,4,1)`，新规则源码在后 → 顺序胜出。它实测给出一行处方 `:not(.active)`，并指出**更关键的连带**：现状校验点 ⑦ 只断 `fontWeight`/`marginTop`/`x`，R2-1 存在时**三项全真 = 判据漏检**，故必须补反向断言。
- **R2-2**：桌面按钮的 `activeFile` 与 `'fullscreen'` 在 `EntryDetailHeader.vue` 作用域内**一处都不存在**（`grep activeFile` → 0 命中；`defineEmits` 无 `'fullscreen'`；`EntryDetailView.vue` 未传 `:active-file`）。它用 `vue-tsc --noEmit` 对直译最小复现拿到 `TS2339` + `TS2345` → **按设计字面实现 `make typecheck` 必红**。它判 approved 的理由：意图无歧义、由独立 gate key 兜住（非静默）、且处方是两行声明级。

---

## 3. 残留 WARNING 清单（**不阻断 P2，建议 P3 起步时处理**）

> **本节逐条照录 `P2-review-eng.md` §3 / §4 的 6 项 WARNING + 2 条测试缺口建议，不增不减、不改判定。**
> 该专家自己的分级理由是「六项均为**文字 / schema 补充级**，不影响 P4 的主路径执行，不阻断 approved」，并建议「与 P3 起步并行修（W1/W4/W5/W6 各改一两句，W2/W3 各补一句声明）」。
> **不阻断 P2 的共性判据**（该专家给出的）：均**不是「判据不可执行」**，也**不会让 P4 静默出事**——最坏情形是「浪费一轮红灯」而非「静默假绿」。

### 3.1 W1–W6（文字 / schema 补充级）

| # | 残留项 | 依据摘要（专家实测） | 它建议的动作 |
|---|---|---|---|
| **W1** | D7 的 JSON 样例数字与 `count_limit` 机制**互不自洽**（会误导 P3 照抄素材） | `:395-404` 写 `requested 45 / inlined 40 / skipped 5 项（1 count_limit + 4 其他）`。按 `_MAX_INJECT_IDS = 40`：overflow 应为 **5** 个（样例只 1 个）；selected 40 中有 4 项非 count 丢弃 ⇒ `inlined` 应为 **36**（样例写 40）。**势恰好成立**（45−40 = 5 = `len(skipped)`）但两个分量机制上不可同时成立 | 改为 `<count_limit 5 项 + 其余 0 项>`（45/40/5），或降到 `44/40/4`（count_limit 1 + 其他 3 各 1） |
| **W2** | `<a href="x.css">` 这类「HTML 引用了但注入语义未生效」的项被记为 `inlined`（需一行边界声明） | 实测 `inlined=1, skipped=[]`，而输出里 `href="style.css"` **仍悬空**、CSS 另以 `<style>` 追加。按写死的定义判对无误、不变式成立，但用户在 iframe 里点该链接会 404 | 在 `§0.2 不改什么` 补一行「`<a href>` / `srcset` / `<object data>` 等非可注入引用形态的悬空引用属**既有行为**，本任务不改——不属 BDD-40 的『未被内联』范畴」。**不登记技术债**（不是债，是明确的边界） |
| **W3** | BDD-40 ③（「不出现被截断的、语义不完整的资源内容」）在 D10 的 BDD-40 行**未落判据** | `_CSS_RECURSION_LIMIT = 3` 超限时 `_process_css_refs` 返回原样内容（`:140-141`），未解析的 `@import` 字面残留（实测 1 处）。`§0.2`（`:140`）已声明该常量不动、理由为 P1 §6.5 明确不处理 | 在 D10 的 BDD-40 行补一句「③ 的判据范围：仅覆盖『整块内容被截断』（base64 截半 / CSS 块未闭合）；`@import` 深度超限的**字面残留**属 P1 §6.5 已豁免项，由 `not_injectable` 记账覆盖」——把豁免写成判据边界，免得 P3 当缺陷去断言 |
| **W4** | `skipped[]` 的 `size` 字段**无可靠来源**——`SiblingFileData` 只有 6 个字段、**无 `size`** | 文本 `len(content)` 是**字符数**不是字节数（`_build_sibling_data` 用 `decode("utf-8", errors="replace")`）；二进制 `content` 是 base64，需 `*3/4` 还原（实测 1000 字节 → 1336 字符，+33.6%）。因 `R4`（`:160`）已声明 P6 不断言具体数值，`size` 是**信息性字段** | 在 D7 补一句「`size` 为**近似值**（文本取字符数、二进制按 `len(content)*3//4` 估算）；判据不得依赖该字段的精确值」。否则 P4 可能去找并不存在的精确来源（或误加字段破坏 13 处调用零改动） |
| **W5** | `not_found` / `count_limit` 两类项的 `filename` / `path` **来源未定义** | `not_found`：`get_files_by_ids`（`:1431-1441`）只返回命中行 → 没有 filename/path 可取；`count_limit`：溢出 id 在 `select_inject_ids` 阶段就截断、从未进查询。设计只写「把溢出 id 落进 `overflow`」（`:91`） | 二者取一：**(a)** 溢出/缺失 id 也做一次轻量查询以带出 `filename`/`path`；**(b)** schema 补 `file_id` 字段、显式声明「`not_found` / `count_limit` 项 `filename` 为 `null`」，并同步把 BDD-38 ③ 在该维度的判据改为「按 `file_id` 对应」 |
| **W6** | 「`_process_css_refs` 既有 **5 处**测试调用」与实测 **8 处**不符（且引用行号区间漏 3 处） | `:422` 与 `:1006` 两处都写「5 处（`test_html_render.py:372-410`）」。实测该文件共 **8 处**真实调用（`375 / 383 / 400 / 408 / 416 / 426 / 433 / 438`），后 4 处落在所引区间之外 | 改为「既有 **8 处**测试调用（`:375`–`:438`）」。理由：若 P4 用「检查 372-410 区间零改动」自证，会**漏掉 416/426/433/438 四处**——而那正是「位置参 + 新参默认 None 是否真不破坏既有调用」的验证面。**结论（新参必须关键字可选）对全部 8 处都成立，只是计数与区间不准** |

### 3.2 G11 / G12（本轮新增的 2 条测试缺口建议，不阻断，P3 可择机纳入）

> 专家原文定义在 `P2-review-eng.md` §4（编号承接第 2 轮的 G1–G10）。两条都**不是**对既有结论的否定，而是「补一条能检出特定失效形态的断言」。

| # | 建议 | 为什么值得加（专家实测依据） |
|---|---|---|
| **G11** | **`inlined` 的「双向对账」应成为一条独立断言，而不只断势** | G10 断三个（势 `requested - inlined == len(skipped)`、值闭集、去重），但专家本轮实测确认：**势断言在「报表撒谎」时仍会绿**——若实现把「标记 consumed 但内容实际缺失」的项算进 `inlined`、又不进 `skipped`，则等式两侧**同时偏小**而等式仍成立。第 2 轮它正是用「势对但事实不对」的形态驳倒了最小钩子。素材已在 BDD-40 的三件里，成本约 5 行；**这是唯一能检出「数字自洽但与事实不符」的断言形态**，不加则未来若有人「简化」回 `used_text_keys` 式实现，势断言不会报警 |
| **G12** | **`@import` 链跨递归上限的形态应进 P3 用例（或显式声明不测）** | 实测「n0..n5 链」证明递归超限时 n4/n5 **正确地**被记为 `not_injectable`——这是**第七处埋点（递归透传）唯一会被单独证伪的形态**。设计 `:422` 已写明「`@import` 链第 2 层起的消费全部漏记」是风险，但 V17 的 S3 只测了**单层** `@import` |

---

## 4. 锁定项（**不得在 P3 / P4 推翻**）

> §4.1 完整保留**第 1 轮 `P2-review.md` §7** 的全部 31 条（12 + 7 + 12），一条未删；§4.2 为第 3 轮新增锁定。
> 冲突时以本节为准。**注意**：第 1 轮 §7.1 第 11 条的 key 计数已随 N8 变更（21 → 23），本文按**现状**写并标注；该数值变动**不改变**「全 key 合法」这一锁定结论。

### 4.1 第 1 轮锁定的 31 条（原样保留）

**（a）eng 锁定决策 12 项（原文「后续阶段不再讨论」）**

| # | 锁定内容 | 关键理由 |
|---|---|---|
| 1 | **锚点唯一生成点落在 `useMarkdown` 的 `heading_open` renderer**（候选 A） | BDD-07 代码级断言（正则命中 0）由「整段删除 `extractHeadings`」结构性满足，优于候选 B 的纪律性保证 |
| 2 | **TOC 数据流走 `emit('headings')` → `setTocHeadings()`**，`tocHeadings` 导出名不变 | 3 个消费组件零改动（并采纳 N3：URL 归一抽纯函数，不靠 `suppressUrlSync` 内部状态测） |
| 3 | **计数与构造解耦走单次状态机，不 `break`** | 保 BDD-37 throw 契约（公式按 N1 修正为 `totalRows = headerSeen ? parsedDataRows + 1 : 0`） |
| 4 | **观测面 = `CsvParseResult.constructedRows`**（返回值新增字段） | D1 的「实测双实现对照」区分力成立（现状不可读数 / 朴素 break 得 5 但 totalRows 掉到 6 / 正确修法 5 且 1001） |
| 5 | **resolver 单点 + 删 EntryCard/EntryListRow 死代码** | `transformListItem` 硬编码 `files: []` 使该分支为死代码，BDD-47 要求代码级归零 → 删而非修 |
| 6 | **字节数工具单点 `resolveFileSize`**，`HtmlViewer` 加可选 `file` prop、`TreeView` 加 `size` prop，阈值与 `>=` 语义不动 | R9 的「可选 prop 保 8 用例零改动」策略正确 |
| 7 | **`/f` 侧栏改 `v-if` 使 DOM 不存在**（非只加 CSS） | BDD-28/53③ 判据是 DOM 计数 0；只加 CSS 会假 FAIL |
| 8 | **`?file=` 用「显式合并 `{...route.query}` + 删键而非置 `null`」** | D4 的 vue-router 实测（V1）成立；「只删 `firstFileId`、保留 `share`」符合 BDD-22 |
| 9 | **注入预算数值 `40 / 2MiB / 8MiB`**（**数值**锁定） | `40 < 50-1` 满足 BDD-38 ④；实测真实 demo 1.29MB 给 8MiB 足够余量。**跳过清单的承载形态不在锁定范围**（第 1 轮 B3 的处置即改该形态的转义） |
| 10 | **`gate_commands.P3` 只跑前端**，后端红灯按 `P2-design.md` §5.1 规定命令取证 | `check-tdd-red.py:102-104`（exit 124 → return 0，fail-open）；eng 复核确认这是「gate 永久空转」而非「失去区分度」，architect 的否决理由**比自述更硬** |
| 11 | **`gate_commands` 的 key 全部合法**（第 1 轮为 21 key；第 3 轮复跑为 **23 key**） | `agate_common.is_legal_gate_key` 逐个实测**全 `True`**；`{key}_timeout_seconds` per-key 声明合规；无 `P3_*` 违规键（`P3_formatter` 为元键豁免）。本汇总轮另用 `agate-read-gate-commands.py` 复核读回正常（`P3 = "make test-frontend"`、`formatter = vitest.sh`、`project_module = src/`） |
| 12 | **`dispatch_plan` 4 批、`output` 逐批互斥** | 逐条比对无文件跨批；`detail-navigation` 依赖 `detail-outline` 的 `setTocHeadings()` 属**真实串行依赖**，串行合理。第 3 轮 N8 新增 1 个文件后脚本复核 **24 条目零重复，仍互斥** |

**（b）design「做得好的地方」7 项（原文「避免下轮改坏」）**

| # | 锁定内容 | 关键理由 |
|---|---|---|
| 1 | **决策 A 的守护极干净**（`/f` 为只读分享态，不加退出按钮） | 两处独立声明 + `useZenMode` 零改动 + BDD-29 定性为「约束型」；未出现「加退出按钮」或「放开 f 键」。第 3 轮复核**未被推翻** |
| 2 | **`aria-label="全屏阅读"` 而非依赖 `title`** | 比 P1 的 Given 约束更强（不依赖「正文无图表」这条脆弱前提；实测当前页 accessible name 匹配 `fullscreen\|全屏` 的元素 0 个） |
| 3 | **R5（TOC 默认展开时机）** | 识别出 `tocHeadings` 改异步后 `onMounted` 的 `nextTick()` 会拿空数组，给 `flush:'post'` + `userToggledToc` + 幂等 When 三重保险，并诚实标注残留的 100–300ms 首屏空窗 |
| 4 | **R12（表头塌陷）的预判准确** | probe7 实测确认「换 `span.th-label` 后表头不塌陷、行高变化 -28px 且首行同步上移、标签居中偏差 -0.25px」→ 缓解措施是对的 |
| 5 | **13+13 项最小验证**（且诚实列出 4 项「未验证、留给 P3/P4」，不冒充已验证） | — |
| 6 | **`P2-design.md` §0.2「不改什么」栏（12 项带证据）** | 比「改什么」更有价值，直接约束 P4 范围蔓延（其中 `_build_sibling_data` 那条已按第 1 轮 §6.1-3 更正） |
| 7 | **`_MAX_INJECT_IDS = 50` 现状休眠的推导** | 50 == `max_entry_files` 且主文件占 1 席 → 最多 49 sibling → `break` 永不触发，逻辑闭环；据此选 40 |

**（c）两份评审共同确认的正面结论 12 项（下轮不得改坏）**

| # | 结论 | 确认方 |
|---|---|---|
| 1 | **方案架构主体方向正确且经得起实测**：D1 渲染期单点生成、D2 计数与构造解耦、D3 resolver 单点、D8 字节数工具单点、D4「显式合并 + 删键」 | eng（逐条复现） |
| 2 | **`P2-design.md` §5.1 对 P3 复合命令的否决理由成立且比 architect 自述更硬** | eng（复核源码） |
| 3 | **桌面弹性布局结构安全**：`.actions-area` 插入按钮后 4px 差是 flex `gap` 尾槽，**不溢出**；三档标题均不截断 | design（**含对「溢出 40px」读数的自我更正——下轮不得回退为「溢出」**；第 2 轮独立重测 1024/1280/1440 逐位一致，未回退） |
| 4 | **截断态隐藏表头控件不会塌陷**：表头高由其余仍带控件的列撑住，控件撤掉后自然降为文字行高（期望行为） | design（probe3 + probe7） |
| 5 | **BDD-26 底栏 ≤64px 不增高成立** | design（四档视口实测栏高恒 64px） |
| 6 | **颜色对比度 WCAG AA 全过**（含暗色主题）：`.icon-btn` 亮 5.25 / 暗 7.26；`.toggle-btn` 5.19 / 5.57；TOC 链接 5.25；Entry 标题 15.8；第 2 轮新增 h1 `#e9eef4` on `--c-surface` = 15.26:1 | design |
| 7 | **UI 设计节三组 checklist 齐备 + 形态声明 `layout` 与 P1 一致** | design |
| 8 | **1612 五条禁止项全部遵守**：不进文件树、不逐文件加按钮、不加文件选择器、不遮挡、不假定 `files[0]` | design |
| 9 | **AI Slop 风险极低**：模糊词（`参照\|类似\|适当\|酌情\|风格\|视情况\|合理`）grep **0 命中**（第 2 轮复跑仍为 0） | design |
| 10 | **`?file=` 无效时静默回退可接受**：BDD-16/18 Then② 明写「页面无错误横幅」，方案 `:446` ④ 对齐（**非缺陷**） | design |
| 11 | **`files_to_read` 逐条带 `why`、常量给值且给理由、每个改动点到「哪个文件哪一行哪个函数」** | design |
| 12 | **不新增 DEBT 条目**：eng 明确第 1 轮三处阻塞均属本任务 P4 必须就地修正的范围（落在 BDD-13/40 覆盖内），登记为债反而误导为「可延后」 | eng |

### 4.2 第 3 轮新增锁定（6 条，来自 `P2-review-eng.md` §7 + 第 3 轮落地实际）

| # | 新增锁定内容 | 理由（专家原文摘要） |
|---|---|---|
| 1 | **`inlined` 语义按 D7 `:409` 写死为「实际进入响应体的 sibling 个数」**，**不得**由 `requested - len(预算层 skipped)` 反推 | 反推会让势断言变恒等式，直接违反 P1 BDD-40 ②「未被内联的每一个都必须可查」。P3/P4 硬约束 |
| 2 | **`reason` 闭集冻结为六元**（`count_limit` / `file_too_large` / `binary_too_large` / `total_budget` / `not_found` / `not_injectable`） | P4 **无权增删**；若实现中确需第七元，**回 P2** 而非就地扩集 |
| 3 | **消费追踪用 `consumed: set[id(SiblingFileData)]` + `owners` 全 map + 七处埋点**，**不用** `used_text_keys` 最小钩子 | 后者经实测会给假绿报表（决定性命中：未引用二进制 + README.md 形态下漏记 `unref.png`，报表自称 `inlined=1` 实际嵌入 0，而势「自洽」）。`_process_css_refs` 的新参数**必须关键字可选**（保护既有 **8 处**测试调用 + **13 处** `inject_resources` 调用零改动） |
| 4 | **BDD-40 用例素材固定为三件**：① >768KB 二进制 ② 含 `<` `>` `</script` 的 path ③ 非 css/js sibling（`README.md` 或 `data.json`） | 缺任一件该缺口在 P3/P6 仍测不出（第 2 轮 B4 正是因 V8 素材「恰好绕开 kind 维度」才被发现）。**P3 不得删减为两件** |
| 5 | **`not_injectable` 的判定点必须在 `inject_resources()` 内部**，`skipped` 填充顺序**不可颠倒**（先预算层五类、后函数内追加第六类） | 顺序颠倒会重复计数、打破不变式 `requested - inlined == len(skipped)` |
| 6 | **W1–W6 为文字 / schema 补充级建议**，P3 起步前修或并行修均可，**不构成 P2 阻塞** | 专家明确分级；改或不改都不改变 `approved` 判定，但改了可防「浪费一轮红灯」 |
| 7 | **R2-1 / R2-2 的落地形态以 `P2-design.md` §11.8.2 / §11.8.3 为准**（第 3 轮已落，含两处按实测对 design 处方的细化） | R2-1：design 给的是「整条颜色+字重加 `:not(.active)`」，第 3 轮实测发现**整条加会把 `fontWeight` 掉回 400**（强调色回来、层级信号消失）→ 落地改为**颜色与字重拆两条**（`.toc-level-1 a { font-weight: 600 }` + `.toc-level-1:not(.active) a { color: var(--c-text) }`；`margin-top` 挂 `li` 不挂 `:not`）。R2-2：三处补丁（props + emits + View 侧传参/handler）+ 新增「`File` 必须从 `@/types` 显式 import，否则 TS 解析成 DOM `File` → `TS2322`」的坑；移动端 `EntryDetailMobileBar.vue` 同样缺 props/emits 需一并补（但两端守卫语义不同：移动端整栏已 `v-if="isMobile && currentEntry"` 不补也不 TypeError，桌面端 `.actions-area` 的 `v-if="isDesktop"` 与 entry 状态无关**故桌面的 `v-if` 是功能性必需**）。两者均落在 design 处方**目标**之内（active 时 h1 恢复强调色且层级仍可区分），不改变 design 的 `approved` 判定 |

---

## 5. 给 P3 的交接要点

> 以下全部来自两位专家的明确要求或第 3 轮已落地的机制，**不是本汇总轮的新增意见**。

### 5.1 N5 两步取证的 gate **不能只看 exit code**（eng 实测，最关键一条）

- **命令侧**：`P2-design.md` §5.1（`:755`）已去掉 `| tail -30`。**P3 不得把它加回来**——专家独立复现：`pytest <不存在的文件> | tail -30` → **exit 0（假绿）**，裸跑 → **exit 4**。管道会把非零 exit 吞成 0。
- **判据侧**（更重要）：专家构造对照实验确认 **`TypeError` 与 `AssertionError` 在 pytest exit code 层面不可区分**（均 exit 1）。因此设计的判据「输出 ≥1 个 assertion failure 且**恰好是** assertion failure（不是 collection error）」**必须读输出文本**，不能只看 exit code。
- **原因**：collection error 会让 pytest 在**收集阶段**就 exit 4、根本不进入任何 test body，从而掩盖「本应出现的 assertion failure」。`test_entry_file_order.py` 是**新建**文件，红灯期该文件尚不存在，所以必须**两步取样**：
  1. 先单跑 `pytest tests/test_html_render.py` 取 assertion failure（红）；
  2. 再跑完整命令确认建文件后全绿。
- **计数基线**：`test_html_render.py + test_entry_service.py` = **73 passed**（专家独立复跑 1.98s 确认）。注意 §5.1 取证命令的选择集是 `test_html_render.py + test_entry_file_order.py`，**不是** 73 这个组合——**不得拿 73 当该命令的基线数**。
- **命令名唯一**：`test_entry_file_order.py`（`test_entry_order.py` 已归零，仅剩 2 处叙述性提及）。

### 5.2 G11：`inlined` 必须做**双向对账**断言，不能只断势

- 只断势（`requested - inlined == len(skipped)`）**在报表撒谎时仍会绿**：若实现把「标记 consumed 但内容实际缺失」的项算进 `inlined`、又不进 `skipped`，等式两侧同时偏小、等式仍成立。
- **P3 须补的形态**（素材已在 BDD-40 三件里，成本约 5 行）：

  ```python
  for f, needle in [(css, "color:red"), (md_sib, "README-CONTENT"), ...]:
      landed = needle in resp.text
      reported_skip = any(s["filename"] == f.filename for s in report["skipped"])
      assert landed != reported_skip, f"{f.filename} 的报告状态与事实不符"
  ```

- **为什么必须加**：这是唯一能检出「数字自洽但与事实不符」的断言形态，而它正是 B4 争议的判别式。不加的话，未来若有人「简化」回 `used_text_keys` 式实现，势断言不会报警。
- **红线**：`inlined` **不得**由 `requested - len(预算层 skipped)` 反推（§4.2-1）。

### 5.3 G12：补一条**两跳 `@import`** 用例（护住递归透传那一行）

- 实测「`@import` 链 n0..n5」（`_CSS_RECURSION_LIMIT = 3`）：n0..n3 内容落地并计 `inlined`、n4/n5 **正确地**记 `not_injectable`，无撒谎项；循环 import（`pa↔pb`）、自 import 均正常。
- **为什么值得独立成例**：这是**第七处埋点（`_process_css_refs` 递归透传）唯一会被单独证伪的形态**。设计 `:422` 已把「`@import` 链第 2 层起的消费全部漏记」列为风险，但 V17 的 S3 **只测了单层** `@import`。
- **断言**：两跳链（`a→b→c`）断言 b、c **均不在** `skipped` 里。
- **注意递归超限的记账边界**：超限时的字面残留属 W3 已登记的豁免（由 `not_injectable` 记账覆盖），**不要把它当缺陷去断言**。

### 5.4 其余交接项（逐条来自专家 WARNING / 锁定，P3 起步时顺手处理）

| 项 | 交接内容 |
|---|---|
| **W1** | 造 BDD-38 素材时**不要照抄 D7 的 JSON 样例数值**（`45/40/5` 的两个分量机制上不可同时成立，只有势成立）。按 §4.2-2 的六元闭集与真实 `_MAX_INJECT_IDS = 40` 推算 |
| **W2** | `<a href="x.css">` / `srcset` / `<object data>` 等「内容已注入但引用未重写」的悬空引用属**既有行为**，**不属** BDD-40 的「未被内联」范畴——P3 不要为它写红 |
| **W3** | BDD-40 ③ 的判据范围**只覆盖「整块内容被截断」**（base64 截半 / CSS 块未闭合）；`@import` 深度超限的字面残留是 P1 §6.5 已豁免项，由 `not_injectable` 记账覆盖 |
| **W4** | `skipped[].size` 是**近似值**（文本取字符数、二进制 `len(content)*3//4`），**任何判据不得依赖其精确值**；也不要为它给 `SiblingFileData` 加字段（会破坏 13 处调用零改动） |
| **W5** | `not_found` / `count_limit` 项的 `filename` 来源需 P4 二选一（补一次轻量查询 / 加 `file_id` 字段并显式声明 `filename` 为 `null`）；若选后者，BDD-38 ③ 在 count_limit 维度的判据要改为「按 `file_id` 对应」 |
| **W6** | `_process_css_refs` 既有 **8 处**测试调用（`:375`–`:438`），**不是 5 处**、也**不是** `:372-410` 区间。P4 若用「区间零改动」自证，必须覆盖到 416/426/433/438 四处 |
| **R2-1** | UI 校验点 ⑦ 必须含**反向断言**：「h1 条目被置 `.active` 时 `color` 等于 `--c-accent` 的解析值（`rgb(77,141,255)`）**且** `fontWeight !== '400'`」。现状 ⑦ 只断 `fontWeight !== '400'` + `marginTop === '12px'` + `x` 相等 → R2-1 存在时**三项全真 = 漏检**。这条比修 CSS 更重要——它补的是**判据的检出能力** |
| **R2-2** | 桌面 `v-if` 是功能性必需（与移动端不同）；补 props/emits/传参时 `File` 必须从 `@/types` 显式 import（否则 TS 解析成 DOM `File` → `TS2322`）；`P5_typecheck` 是兜底 gate key，P4 不许绕过 |
| **R2-3** | 校验点 ⑥（`.title-group` 的 `scrollWidth <= clientWidth`）对「标题文字被 clamp 掉」**无区分力**——专家实测故意塞 360 字超长标题时它**仍为真**（真正承载裁切的是内层 `h1.title`）。⑥ 保留（它验的是按钮占位没挤坏容器），**可选**另加强判据 `h1.scrollHeight <= clientHeight`（或 `h1.scrollHeight <= 2 * lineHeight`） |
| **R2-4** | P6 视觉复核额外看一眼两个**组合态**：① h1 条目 active（滚到文章开头）；② h1 条目 hover 且 active（`transition: all` 下会不会中间色跳变）。成本极低、无需写断言 |
| **S1** | `gap 8→4px` 后，带徽标的 Files 按钮（`.toggle-badge` 为 `absolute; top/right:-2px`，右溢 2px）与相邻 TOC 按钮的间距只剩 **2px**，视觉上徽标会几乎贴上相邻图标。**不影响 360px 溢出结论**（徽标是 absolute、不参与 flex 宽度计算），故不是 D-3 的回归——接受并记录 或 把 `right` 调到 `0` |
| **P1 措辞**（第 3 轮上报） | `P2-design.md` §11.7 上报一处 **P1 基线措辞失实**（`P1-requirements.md:589` 的实现层附注），已由 architect 上报主 Agent 决策而非擅自改 P1。**P3 不得据此改 P1**，等主 Agent 定夺 |

### 5.5 给 P4 的越界提醒（来自锁定项，非新意见）

- 六元 `reason` 闭集**不可就地扩集**（§4.2-2）；若确需第七元 → 回 P2。
- `inject_resources` 签名保持 `-> str` + `skipped_out` 关键字可选 → **13 处**既有调用零改动；`_process_css_refs` 新参**必须关键字可选** → **8 处**既有调用零改动。
- `P3` 的领域裁决（只跑前端）与预算数值 `40 / 2MiB / 8MiB` 属**锁定**，`gate_commands` 在 P2 固化后 P4–P6 **不能改**（设计阶段是声明验证契约的唯一窗口）。

---

## 6. 专家组分歧核查

**结论：无实质分歧，无需交人工裁定。**

两位专家的评价面**不重叠**——eng 覆盖后端注入记账 / `order_by` / CSV 计数 / `gate_commands` / `dispatch_plan` / 测试缺口；design 覆盖 UI 布局 / 视觉 / 交互 / 移动端 / 可访问性 / 组件完整性。本轮（第 3 轮）两人**独立地**给出 `approved` 且**各自明确划出域边界**：

- design 原文：「eng 的 B4 在我域外，我不为它背书也不替它否决」；
- eng 原文：未跑前端（vitest / `vue-tsc` / `make typecheck`），「design 侧 R2-1/R2-2 属 `plan-design-review` 的域，其第 2 轮已 approved 且 V18/V19 有实测，不重复」。

**一处需如实标注（不是分歧，是时序）**：`P2-review-design.md` 是**第 2 轮**的产出（`trace_id` 含 `r2`），其 `approved` 判定作出于 `P2-design.md` 第 3 轮落地 R2-1 / R2-2 **之前**。第 3 轮按它的处方目标落了这两条（并按实测细化了处方形态，见 §4.2-7）。**这不构成两位专家对同一问题给出不同结论**——design 的 R2-1 / R2-2 本就是它自己列为「P4 按处方落地」的 MUST-FIX，第 3 轮提前落地且**落在其目标之内**；eng 对 UI 域未表态、其 `approved` 亦不以 UI 实现细节为前提。故**不触发「专家组分歧」标记**，但主 Agent 若需 design 侧对第 3 轮落地形态背书，应另派一轮（本文档不代其背书）。

**交叉核对（只做事实抽查，不重评）**：

| 核对项 | 方法 | 结果 |
|---|---|---|
| 两份评审是否真为 `approved` 且 `agent ≠ main` | `agate-md-field-get.py agent` / `status` | `plan-eng-review`/`approved`、`plan-design-review`/`approved` ✓ |
| eng 的 13 处 `inject_resources` 调用点 | `grep -c "= inject_resources(" backend/tests/test_html_render.py` | **13** ✓ 与锁定项一致 |
| eng W6 的 8 处 `_process_css_refs` 调用点 | `grep "_process_css_refs(" backend/tests/test_html_render.py \| wc -l` | **8** ✓ W6 实测成立 |
| eng B4-② 的 `REASONS` 字面量唯一性 | `grep -c "REASONS = {"` 于 `P2-design.md` | **1** ✓ 无第二份可漂移 |
| eng N7 的 `119` 是否归零 | `grep -c "\b119\b"` 于 `P2-design.md` | **1**（仅为变更记录行）✓ 与 eng 表述一致 |
| eng N5 的旧命令名是否归零 | `grep -c "test_entry_order\.py"` | **2**（均为叙述性）✓ 与 eng 表述一致 |
| 锁定 11 的 gate key 计数 | `agate-read-gate-commands.py`（`GATE_FILE` 指向 `P2-design.md`） | 读回 `make test-frontend` / `vitest.sh` / `src/` ✓ 与 design §6 一致 |
| `candidate_count` 现状 | `grep candidate_count` 于 `P2-design.md` | **6**，与两位专家所核一致 ✓ |
| 生产隔离 | `curl -m 2 http://127.0.0.1:8080/` | `000`（不可达）→ 全程未接触 ✓ |
| 工作区状态 | `git status --porcelain` + `HEAD` | 生产代码无 M 标记（仅 agate-workspace 任务目录为新增/修改），`HEAD=5548a380` ✓ |

**未核对项（如实标注）**：eng 的 19 组 B4 原型形态、design 的全部浏览器探针（probeA–I）与 `vue-tsc` 类型探针，本轮**未重跑**——理由：组长规则第 1 条（不发表新意见、不重新评审），且两份评审各自附完整实测命令与读数，`objective_info` 亦记录了主 Agent 已独立验证的关键事实（`used_text_keys` 3 个写入点、`SiblingFileData` 无 `size`、`get_files_by_ids` 只返回命中行、后端两文件 73 passed、`_process_css_refs` 实测 8 处调用）。若需第三方复现，请另派独立角色。

---

## 7. 汇总方法与证据边界

**做了什么**：读全两份专家复审 + 第 1 轮 `P2-review.md` + 两份进度文件 + `P2-design.md` §11.8 与 frontmatter → 核实两份的 `status` / `agent`（脚本读 frontmatter 而非只读正文）→ 抽 8 项可机械核对的事实做 `grep` / 脚本抽查 → 三轮演化归纳 → 残留 WARNING 与测试缺口照录 → 第 1 轮锁定项完整保留 + 第 3 轮新增锁定 → 按 G11 / G12 / N5 三条专家点名项写交接要点。

**未做什么**（遵守组长规则）：**未发表任何新意见**、**未重新评审方案**、未独立实跑任何探针或测试套件、未新增任何专家未提的缺陷或要求、未提升或降低任何专家的定级、未改动任何输入文件（`P2-design.md` / `P2-review-eng.md` / `P2-review-design.md` 一字未动）。

**环境状态**：[PROD_NOT_TOUCHED]。生产 `:8080` 实测不可达（`000`）、未触碰 `~/.peekview/`、未跑 CLI 写命令、未造/删 entry、未 commit。临时产物在 `/home/kity/oclab/peekview/.agate-tmp/`（未用 `/tmp`）。产出仅本文件（覆盖第 1 轮版本）。

**推进影响**：本文件 `status: approved`（`agent: review`，≠ `main`）满足 `check-gate.py P2` 的「`P2-review.md` 存在且 `status: approved`（`agent≠main`）」门槛；`retries[P2]` 最终为 **3/3 用满**但收敛于 `approved`，未触发 PAUSED。
