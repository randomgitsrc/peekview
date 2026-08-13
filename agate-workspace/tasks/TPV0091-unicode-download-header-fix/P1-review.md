---
phase: P1
task_id: TPV0091-unicode-download-header-fix
type: review
parent: P1-requirements.md
trace_id: TPV0091-P1-review-20260813
status: approved
created: 2026-08-13
agent: requirements-review
---

# P1 评审 — 中文/日文文件名下载与图片预览 500 修复

独立复核了关键客观事实（curl 实测 + 源码 grep + 测试断言范围），结论基于自身复核，非直接抄录上一轮。

## 关键事实复核

| 事实 | 复核方式 | 结果 |
|------|---------|------|
| `api.downloadFile`（client.ts:173）死代码 | grep 全部 `downloadFile` 引用 | ✓ 前端 11 处引用全部指向 `useEntryDetailComputed.ts:86` 本地 blob 函数或 props；`api.downloadFile` 无任何调用者 |
| `useEntryDetailComputed.ts:86` 为 blob 下载 | 读源码 | ✓ `new Blob([fileContent])` + `a.download=filename`，不走 API download 端点 |
| 图片预览走 download 端点 | 读源码 | ✓ ImageViewer.vue:119 → `getFileAsBase64` → client.ts:160-171 GET `/files/{id}`（无 /content） |
| download 端点 41/42/43=500、36-40=200 | curl debug :8888 实测 | ✓ 41=500、42=500、43=500、36/37/38/39/40=200 |
| `/content` 全 200 且图片 content-type 正确 | curl 实测 | ✓ 36 text/markdown、41/43 image/png、42 text/plain |
| test_security.py:574-615 断言范围 | 读源码 | ✓ 仅断言 200 + 无 `\r`/`\n`（+ 分号注释）；无引号断言 |
| seed data：public、9 文件、README 5 图 | 读 meta.json + README + /raw | ✓ is_public:true、id 36-43 与表一致、README 恰含 5 张内联图（BDD-8 基线成立） |
| MCP 无 `/files/` 牵连 | rg mcp-server/src | ✓ 仅 publishFiles.ts:93 注释文本命中，无 API 调用 |

## BDD 评审

- BDD-1: ✅ 可二值判定（Playwright 断言 `[data-testid="image-content"]` 可见 + `[data-testid="image-error"]` 缺席；两 testid 均存在于 ImageViewer.vue:54/:43）。覆盖：数据✓ 前端✓ 多端✗ 边界✓（中文非 latin-1）兼容✗
- BDD-2: ✅ 可二值判定（同 BDD-1）。覆盖：数据✓ 前端✓ 多端✗ 边界✓（日文另一语系）兼容✗
- BDD-3: ✅ 可二值判定（依次点击 3 文件，单场景参数化，属同一行为）。覆盖：数据✓ 前端✓ 多端✗ 边界✓（é latin-1 边界/空格/ASCII）兼容✓（既有行为回归）
- BDD-4: ✅ 可二值判定（pytest/curl：200 + 响应体与 /content 逐字节一致）。覆盖：数据✓ 前端✗ 多端✓（API 响应契约）边界✓（中文+日文）兼容✗
- BDD-5: ✅ 可二值判定（HTTP header 层：`filename*=UTF-8''` 存在 + 百分号 URL 解码后等于原始文件名；pytest 可断言）。浏览器保存名留 P6 用 `download.suggestedFilename()`，已由 capability_requirements 的 `requires_minimal_validation: true` 显式标记 RFC 5987 解析风险。覆盖：数据✓ 前端✗ 多端✓（header 编码契约）边界✓（编码正确性）兼容✗
- BDD-6: ✅ 可二值判定（200 + Content-Disposition 有效）。覆盖：数据✓ 前端✗ 多端✓ 边界✓（é/空格/ASCII 不回归）兼容✓
- BDD-7: ✅ 可二值判定（主要锚点是 test_security.py 现有净化用例保持 green；该用例二进制判定）。⚠️ 措辞观察：字面"头中不含引号"过强——标准格式 `filename="..."` 本就含定界引号，且现有 test_security.py:604-608 只断言 200 + 无 `\r`/`\n`（无引号断言）。意图明确（不含注入字符），P3 应按现有用例断言范围写测试，不按字面写。覆盖：数据✓ 前端✗ 多端✗ 边界✓（注入字符净化）兼容✓（安全回归）
- BDD-8: ✅ 可二值判定（Playwright 断言 5 张内联 img 全部加载）。覆盖：数据✓ 前端✓ 多端✗ 边界✗ 兼容✓（/content 路径回归）

编号格式 `#### BDD-NN:` 标准、1-8 连续不跳号；每条单一 Given/When/Then（BDD-3/4 多文件为参数化实例，非多场景）。**8/8 全部可二值判定，无中间态。**

## 隐含需求覆盖

- 数据维度：✓ 无 schema/迁移需求已声明；内容完整性由 BDD-4（响应体与 /content 一致）覆盖
- 前端维度：✓ 预览失败态消除 BDD-1/2/3 覆盖；「下载菜单对二进制文件下载空文件」预存独立问题经 SUGGEST 显式排除出范围（决策留痕）
- 多端维度：✓ download 端点契约 BDD-4/5 覆盖；MCP 无牵连已 grep 复核；agent 读路径走 `/content` 不受影响（已声明）
- 边界维度：✓ é（latin-1 内 255 边界）/空格/ASCII 回归 BDD-3/6；中文+日文双语系 BDD-1/2/4/5；注入字符 BDD-7。观察：韩文/emoji 未进矩阵，但根因是 codec 级（>255 即 500）非逐语言，中文+日文已足证，非缺陷
- 兼容维度：✓ 注入净化回归 BDD-7；markdown 内联渲染回归 BDD-8；read tracking 口径变化（download→read）经 SUGGEST 声明由 P2 知悉

## 跨条一致性

- BDD-4 vs BDD-5：同一 GET，分别断言状态码/响应体 与 header 编码，互不矛盾，可同时满足 ✓
- BDD-7 vs BDD-4/5：BDD-7 面向 ASCII 注入名，BDD-4/5 面向非 latin-1 名；若文件名同时含非 latin-1 与注入字符，现有 `_sanitize_filename`（先净化）与 RFC 5987（后编码）的顺序保证两断言同时成立 ✓
- BDD-3/6/8 回归基线充分：latin-1/空格/ASCII（前后端）+ markdown 内联路径均有覆盖 ✓

## SCOPE 修正判断

P0-brief 称「前端 downloadFile 走该端点」——analyst 查证为死代码，且实际预览路径（getFileAsBase64）确实走 download 端点。修正合理且透明（§2 客观查证修正）：主要用户可见失败面（预览）未受影响，BDD-1/2/3 依然有效；download BDD-4/5/6 直接锁定 API 端点本身。**修正不损 BDD 完整性。**

## 裁剪评审

- phases 全走 [P1..P8]，无跳过 ✓
- P2 必走：跨端改动需 A/B/C 选型，P0-brief 已定不可单候选跳过 ✓
- P3 必走：零现成覆盖（已复核现有 download 测试均 ASCII），需新增中文/日文用例 ✓
- P6 必走：BDD-1/2/3/8 需 Playwright 实跑点击+截图 ✓
- P7 必走：跨端（files.py + client.ts）一致性核对 ✓
- risk_level=medium 与 P0-brief 一致（影响所有非 latin-1 文件名 entry 的下载/预览，用户已实际观察到）✓
- capability_requirements 三态全 available，无 GAP ✓

## P1 纯净性

- BDD 层纯净：8 条 BDD 全部机制无关（只定义可观察结果，不绑定候选 A/B/C）✓
- §2 含「候选 A/B/C」「候选 B 改 /content」讨论——属范围澄清（修正 P0-brief 的错误链路描述）+ 显式"P2 选型"延后，未形成设计承诺，判定可接受 ✓
- 观察：P2 应承接该选型决策（design_trivial 不可用），不可借 P1 现状绕过

## 结论

**approved**。8 条 BDD 全部可二值判定且编号连续；覆盖维度：数据✓/前端✓/多端✓/边界✓/兼容✓ 逐项落实；跨条无矛盾；裁剪全走且理由充分；risk_level/capability 声明正确；P1 纯净性合格（BDD 机制无关，候选讨论已显式延后 P2）。

附 2 条非阻塞观察（转 P2/P3 参考，不计 retry）：
1. BDD-7 字面"不含引号"过强，P3 测试按 test_security.py:604-608 现有断言范围写（200 + 无 \r\n），勿按字面加引号断言
2. BDD-5 的浏览器保存名（`suggestedFilename()`）为 P6 唯一需浏览器解析 RFC 5987 的判定点，P2 需先做 minimal_validation（已在 capability_requirements 标记）
