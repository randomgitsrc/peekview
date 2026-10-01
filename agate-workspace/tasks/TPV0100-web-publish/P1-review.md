---
phase: P1
task_id: TPV0100
type: review
parent: P1-requirements.md
trace_id: TPV0100-P1-20261001
status: approved
created: 2026-10-01
agent: requirements-review
---

# P1-review — TPV0100 网页发布入口（requirements-review，复评 rev1）

**被评审对象**：`P1-requirements.md`（v2，agent=analyst）——按上轮评审修订清单 1–6 修订后
**评审角色**：requirements-review（独立视角，只审不写，未修改被评审文件）
**输入**：P0-brief.md / spec V1.1（`docs/specs/peekview-web-publish-20261001.md`）/ AGENTS.md / DESIGN.md / P1-dispatch-context-requirements-review.md / 上轮 P1-review.md
**环境**：`[PROD_NOT_TOUCHED]`（仅读代码、grep、静态核对；未起服务、未触碰生产 :8080 与 `~/.peekview/`）

---

## 0. 结论摘要（终态）

**终态：approved。** 上轮修订清单 1–6 全部闭合，且未引入新的不一致。修订后 §3 共 **30 条 BDD，编号 BDD-1…BDD-30 连续不跳号**，全部为 `#### BDD-NN:` 格式、每条恰好 1 组 Given-When-Then、无主观词、Then 不绑定 CSS 类名/组件名/工具名/技术栈名。`ui_ux_dimensions` 与实际 BDD 类别**严格对齐**（下附逐条核对）。同类扫描 / P0 时效性 / 裁剪声明 / 能力声明 / 声明核对均仍通过（未被本轮修改触碰，且本轮独立复核仍成立）。

---

## 上轮修订清单闭合情况

| # | 上轮等级 | 修订要求 | 修订结果 | 判定 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **阻塞** | BDD-12 标题承诺 > Then 覆盖；"再发一个"未纳入验收 | 拆为 BDD-12（结果态可跳转详情，Then 只断言地址变 `/{slug}`）+ BDD-13（"再发一个"清空表单并重置幂等键，Then 断言 summary/文件为空 + 新建 entry 未命中旧键） | **闭合** |
| 2 | 需修订 | `ui_ux_dimensions` 的「视觉呈现」无对应 BDD（过声明） | 新增 BDD-29，标题后缀「视觉呈现」，断言可见文本标明当前可见性且随切换更新 | **闭合** |
| 3 | 需修订 | I-6（slug 非法/超长早校验）无 BDD | 新增 BDD-19，>64 字符 / 含空格 / 含 `/` → 不发请求 + 就地提示 | **闭合** |
| 4 | 建议 | 可选字段 payload 契约无 BDD | 新增 BDD-21，自定义 slug/tags/团队/非默认过期时长被正确提交与采纳 | **闭合** |
| 5 | 建议 | BDD-22 Given 用 OR 合并 429 与 400/422 | 拆为 BDD-25（429 限流提示）+ BDD-26（400/422 显示后端 detail） | **闭合** |
| 6 | 建议 | BDD-1 标题/Given 含组件名 `UserMenu` | 改为行为化描述「全局用户菜单」，Given 改为「任一渲染全局用户菜单的页面」，去组件名 | **闭合** |

**清单闭合率：6/6。** 其中唯一阻塞项（#1）已按"多场景拆为独立编号"原则拆分，未用"收敛标题"的规避路径，符合评审期望。

---

## BDD 评审（30 条逐条，含覆盖维度）

> 维度标注口径：数据 / 前端 / 多端 / 边界 / 兼容。UX 类别以标题后缀标注（布局结构 / 交互行为 / 视觉呈现）。

- **BDD-1**（布局结构）：可判（地址变 `/publish` + 渲染发布表单）。前端✓ 兼容✓（改一处全站生效）。已去组件名。
- **BDD-2**（布局结构）：可判（顶部主按钮存在 + 点击跳 `/publish`）。前端✓。
- **BDD-3**（布局结构）：可判（他人主页无跳 `/publish` 入口），对应 I-4 owner gate。前端✓ 多端✓。
- **BDD-4**（布局结构）：可判（未登录无入口）。前端✓。
- **BDD-5**（交互行为）：可判（未登录访问 `/publish` → 地址变 `/`）。前端✓ 兼容✓（复用既有守卫惯例）。
- **BDD-6**（交互行为）：可判（返回 201 + 文本 `is_binary=false` / 二进制 `is_binary=true`）。数据✓ 前端✓ 多端✓。
- **BDD-7**（交互行为）：可判（文本呈现且 `language` 非 null；二进制可下载且字节一致）。数据✓ 前端✓ 多端✓。`language` 为 API 契约字段（非 CSS/组件名），可接受。
- **BDD-8**（交互行为）：可判（无 NUL 非法 UTF-8 → `is_binary=true`），对应 I-2。数据✓ 边界✓。
- **BDD-9**（布局结构）：可判（文件树呈现嵌套目录 + 两文件路径=所填值）。数据✓ 前端✓。
- **BDD-10**（交互行为）：可判（页面链接 + Raw 链接展示 + 复制内容一致）。前端✓ 多端✓。
- **BDD-11**（交互行为）：可判（匿名请求 Raw 返回 200 + JSON）。多端✓ 安全✓。
- **BDD-12**（交互行为）：可判（点"查看详情"→ 地址变 `/{slug}` 并渲染详情）。前端✓。**修订后标题与 Then 一致（不再承诺"再发一个"）。**
- **BDD-13**（交互行为）：可判（点"再发一个"→ summary/文件为空 + 新提交产生新 entry 未命中旧幂等键）。前端✓ 数据✓ 边界✓。**新增，闭合清单 #1。**
- **BDD-14**（交互行为）：可判（空 summary → 不发请求 + 就地提示）。前端✓ 边界✓。
- **BDD-15**（交互行为）：可判（无文件 → 不发请求 + 就地提示）。前端✓ 边界✓。
- **BDD-16**（交互行为）：可判（三类超限任一 → 不发请求 + 指明维度/对象）。前端✓ 边界✓ 数据✓。
- **BDD-17**（交互行为）：可判（路径空/绝对/含 `..` → 不发请求 + 行标错）。前端✓ 边界✓ 数据✓。
- **BDD-18**（交互行为）：可判（两文件路径相同 → 不发请求 + 行标错），对应 I-11。前端✓ 边界✓ 数据✓。
- **BDD-19**（交互行为）：可判（slug >64/含空格/含 `/` → 不发请求 + 就地提示）。前端✓ 边界✓ 数据✓。**新增，闭合清单 #3。**
- **BDD-20**（交互行为）：可判（`is_public=true` + `expires_at` 与创建时刻差 = `default_expires_in`）。前端✓ 数据✓ 兼容✓。
- **BDD-21**（交互行为）：可判（slug/tags/team 归属/`expires_at` 与所填一致）。数据✓ 多端✓。**新增，闭合清单 #4。** 与后端 `team_id` 强制 `is_public=false` 无语义冲突——本 BDD 未断言 `is_public`。
- **BDD-22**（交互行为）：可判（`owner_id` = 用户 A id）。数据✓ 多端✓ 安全✓。
- **BDD-23**（交互行为）：可判（失败保留表单 + 载荷未变重试后 DB 仅 1 entry）。数据✓ 边界✓ 兼容✓。
- **BDD-24**（交互行为）：可判（载荷变更后重试 → 新 entry）。数据✓ 边界✓ 兼容✓。
- **BDD-25**（交互行为）：可判（429 → 限流提示 + 表单保留）。多端✓ 边界✓。**拆分，闭合清单 #5。**
- **BDD-26**（交互行为）：可判（400/422 含 detail → 显示 detail 原文 + 表单保留）。多端✓ 边界✓。**拆分，闭合清单 #5。**
- **BDD-27**（交互行为）：可判（请求未返回时再点 → 不发第二请求 + 按钮不可点击）。前端✓ 边界✓（并发）。
- **BDD-28**（交互行为，人工体验路径，强制）：✅ 句式符合「Given seed 数据 → 页面有内容」——Then 要求 Explore 渲染 seed entry 列表（页面有内容）+ 发布流程人工走通。前端✓ 数据✓。
- **BDD-29**（视觉呈现）：可判（存在可见文本指明当前可见性为公开 + 随切换更新）。前端✓。**新增，闭合清单 #2；判据为文本内容与状态更新的可观测断言，非"美观/流畅"类主观词。**
- **BDD-30**（交互行为）：可判（判定结果与后端 `is_binary_content` 对同样本逐一致，0 字节→文本）。数据✓ 边界✓。已实核 `language.py:314`：空→False、含 NUL→True、非法 UTF-8→True，与描述一致。

### 格式 / 反模式机械核对（本轮实测）

- 编号：`#### BDD-1:` … `#### BDD-30:` **连续、无跳号、无重复**（grep 计数 = 30）。
- 单一 Given-When-Then：30 条全部 G:1 / W:1 / T:1（awk 逐条统计），无多场景合并残留。
- 主观词：无（`可读|美观|流畅|平滑|自然|响应灵敏|灵敏` 无实质命中——唯一匹配是 BDD-11 标题的"免认证**可读**"，"可读"在此为"可被读取"的宾语，非审美主观词）。
- 反模式绑定：Then 未绑定 CSS 类名 / 组件名 / 工具名 / 技术栈名。BDD-1 已去 `UserMenu`。`is_binary` / `language` / `owner_id` / `expires_at` 为 API 契约字段，非禁用项。

---

## ui_ux_dimensions 与实际 BDD 类别对齐核对

- frontmatter `ui_ux_dimensions: [布局结构, 交互行为, 视觉呈现]`；`ui_render_shape: layout`。
- 标题后缀实测分布：**布局结构** = BDD-1/2/3/4/9；**视觉呈现** = BDD-29；**交互行为** = BDD-5/6/7/8/10/11/12/13/14/15/16/17/18/19/20/21/22/23/24/25/26/27/28/30。
- §3 引言（行 82）与 §9（行 352）声明的映射与实际后缀**逐条一致**，无过声明、无遗漏。三个维度均落在 UX 分类框架内。**对齐通过。**

---

## 隐含需求覆盖

- **数据维度**：覆盖（I-2 编码 → BDD-6/8/30；I-6 slug → BDD-19；I-9 二进制下载 → BDD-7；I-10 0 字节 → BDD-30；I-11 同名不同路径 → BDD-18；可选字段契约 → BDD-21）。上轮缺口（可选字段 payload）已补。
- **前端维度**：覆盖（I-1 getLimits → BDD-16/20；I-4 Explore gate → BDD-3；I-5 守卫 → BDD-5；I-8 禁用/反馈/失败保留 → BDD-23/27；可见性显式可见 → BDD-29）。上轮缺口（视觉呈现）已补。
- **多端维度**：覆盖（201/200、429/400-422、Raw 匿名可读、owner_id、可选字段契约）。
- **边界维度**：覆盖（0 字节、无 NUL 非法 UTF-8、超限三类、空/绝对/`..`/重复路径、并发点按、幂等重试）。
- **兼容维度**：覆盖（复用既有守卫惯例、后端零改动、幂等键复用/重置语义、I-7 DESIGN.md 同步归 P7）。

**隐含需求条目落地**：I-1→BDD-16/20；I-2→BDD-8/30；I-3→BDD-13/23/24；I-4→BDD-3；I-5→BDD-5；I-6→**BDD-19（已补）**；I-7→无 BDD，归 P7（§10 已显式列入跨文件核对，可接受）；I-8→BDD-23/27；I-9→BDD-7；I-10→BDD-30；I-11→BDD-18 + §6 裁决。**11/11 条目均有落点。**

---

## 同类扫描评审

- 结论落在正文：✅ §5 含扫描范围 + 9 类符号命中清单 + 逐条处理判定。
- "无需同步的其它消费方"判断有据：✅ 4 条子核查（限流共享无需改配置 / `/config/limits` 6 字段新增消费方无影响 / 无 MCP schema 需同步 / 来源头不适用），与主 Agent 实核事实 A/E 一致。
- **本轮独立复核**：`config_router.py:52-57` 实读确认 `/config/limits` 仅 6 字段；`X-PeekView-Source` 全仓仅 `api/_shared.py:23`（读端点）消费，创建端点不消费；`frontend-v3/src` 无 `createEntry`/`getLimits`（唯一 `createEntry` 命中为 `ShareDialog.spec.ts` 的测试局部变量，非实现）。**成立。**
- "只此一处"显式写出：✅ §5 扫描总结。
- 本任务未新增/改名 `agate/scripts/` 下文件：✅ 不适用登记面实测。

**同类扫描评审结论：通过。**

---

## P0 时效性评审

- §0 含显式一行「已核对 P0-brief 时效性，无漂移」：✅（非空白）。
- 逐条排查严重判据 1-3：✅ task 目标方案（复用端点/后端零改动）实读 `api/entries.py` 成立；`executor_env`（debug :8888）成立；`known_risks` 三项经代码核对成立。
- 微弱差异记录：P0 `phase_hint=[P1,P2,P3,P4,P5,P6,P8]` 未含 P7，而 P1 声明 `phases` 含 P7。此方向为**增补仪式**（非裁剪），且裁剪说明以「机制交叉」为由论证全走——与 P1 卡"机制交叉必须走完整 agate"一致，不构成 P0_STALE，无需阻塞或改 P0 字段。
- **通过。**

---

## 裁剪评审

- **未裁剪任何阶段**：`phases: [P1..P8]`，理由（编码正确性 + 幂等语义两高风险面 + 跨 ≥2 子系统 → 机制交叉）**充分**。
- **risk_level**：`medium` 与实际风险**匹配**。
- **capability_requirements 三态**：`visual-vision`→available、`browser-automation`→available，均**合法**；`verification_env`（debug :8888）与能力三态**未混用**，`verification_env_budget` 占位齐全，符合判断树。
- **ceremony**：未声明 → fail-closed 按 `standard`；`phases` 已含 P5/P6/P7；`ceremony: full` 的"phases 必含 P7"强制项不适用（非 full），但 P7 已在列。

**裁剪评审结论：通过。**

---

## 审声明（风险分级/裁剪声明 vs 证据）

- **暂存区实际改动**：`git diff --cached --name-only` = **0 项**；任务目录 untracked（`?? agate-workspace/tasks/TPV0100-web-publish/`），另有 `M agate-workspace/tasks/active-tasks.md`（任务状态登记，非产品代码）。P1 仅产出需求/评审文档、无产品代码，与"P1 只定义问题"一致，**不存在声明 vs 实际改动不一致**。
- **声明前瞻性**：`domains: [frontend]` / `packages: [peekview-frontend, docs]` 与 spec §6.3 模块改动表一致（client.ts / types / 新 view / composable / components / router / UserMenu / DESIGN.md），与任务规模匹配。
- **`ui_render_shape` / `ui_ux_dimensions` vs BDD 一致性**：✅ **一致**（见上"对齐核对"；上轮此处不一致已由 BDD-29 关闭）。
- **`ceremony: full` → phases 含 P7**：非 full，不适用。
- **vision 能力声明**：✅ `need: visual-vision`（含 visual）已声明且 `status: available` 合法，frontend 硬性要求满足。

**审声明核对通过。**

---

## 复评发现（均为非阻塞观察，不影响 approved）

以下为 polished 建议，P6 执行时可吸收，不构成本轮打回理由（均不违反角色硬规则）：

1. **BDD-7 的 `language` 非 null 依赖文件扩展名**：`detect_language` 需可识别扩展名才非 null。建议 P6 固定文本样本扩展名（如 `.txt`/`.py`），避免多解。
2. **BDD-11 的短链 `{slug}/raw` 本身是 302**（`main.py:539` 重定向到 `/api/v1/entries/{slug}/raw` 后 200）。BDD 表述"访问其 Raw 链接 → 返回 200"在"跟随重定向"语境下成立；P6 断言时宜跟随重定向。
3. **BDD-19 未覆盖大写/非法字符全集**：后端 `VALID_SLUG_CHARS` 仅小写/数字/下划线/连字符，BDD 只列了 >64/空格/`/` 三例（子集，非冲突）。P6 可顺带补大写负例。
4. **BDD-28 含 `make debug-start`/`make debug-seed` 命令名**：属环境准备描述，When/Then 仍为行为断言，可接受；如追求纯净可改为"按项目文档执行 debug 环境 seed"。
5. **BDD-13 的 When 串联两个动作**（点"再发一个"并提交新发布）：仍属单一场景链，符合"再发一个→重置→新意图"因果，非多场景合并，可接受。

---

## 门槛产出

- 产出文件：`agate-workspace/tasks/TPV0100-web-publish/P1-review.md`（Header `status: approved`，`agent: requirements-review` ≠ main）。
- approved 实质锚点：**BDD-1…BDD-30 逐条引用 + 覆盖维度清单已列**；隐含需求 I-1…I-11 落点已列；裁剪逐项理由已列；审声明 diff 证据已列。
- **上轮修订清单闭合情况表已列（6/6 闭合）。**

**终态：approved。**
