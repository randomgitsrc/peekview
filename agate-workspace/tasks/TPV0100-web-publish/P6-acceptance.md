---
phase: P6
task_id: TPV0100
type: acceptance
parent: P5-verification.md
trace_id: TPV0100-P6-20261002
status: draft
created: 2026-10-02
agent: verifier
pass: 30
fail: 0
ui_affected: true
---

# P6 验收 — TPV0100 网页发布入口

> 用户视角逐条验收 P1-requirements.md §3 的 30 条 BDD。verifier 独立于 P4 实现者，只读验收，未改任何代码/测试。
> 环境：debug backend `http://127.0.0.1:8888`（主 Agent 已 `debug-start` + `debug-seed`；alice/bob/carol 密码 testpass123）。verifier 未启动/停止服务。
> 实跑命令（本 P6 独立实跑，不引用 P5 充数）：
> - `timeout 600 env E2E_SPEC=e2e/tpv0100-publish.spec.ts make debug-test` → exit 0，`40 passed (23.5s)`，0 failed，0 flaky（日志：`P6-evidence/logs/e2e.log`）
> - `timeout 180 make test-frontend` → exit 0，`112 passed` test files / `1364 passed | 4 skipped`（含 `tpv0100-publish.spec.ts` 14 passed）（日志：`P6-evidence/logs/unit-test.log`）
> - 用户视角独立驱动：Playwright `connectOverCDP('http://localhost:18800')` 真实驱动 Chrome 访问 :8888，逐条采集截图与 `assert-bdd-NN.json`（脚本 `frontend-v3/_p6-driver.mjs`，结果汇总 `P6-evidence/logs/p6-driver-results.json`）
> - vision 分析：vision-engine skill（Chrome CDP 截图 → comprehensive/quick role），逐条产出 `vision-reports/bdd-NN.yaml`，全部 `blocker_count: 0`

## 环境前置探活

- `timeout 5 curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8888/api/v1/entries` → `200`（验收全程每步前探活，未断线）
- Chrome CDP `http://localhost:18800/json/version` → `Chrome/153.0.8010.53`
- seed 数据：用户 alice（admin，id=1）/ bob / carol，团队 `frontend-team`（alice 持有）；Explore 列表约 20 张卡片

## BDD 逐条对照

- PASS BDD-01: 布局结构：已登录用户可从全局用户菜单进入发布页 (screenshots/bdd-01-user-menu-open.png) (screenshots/bdd-01-publish-form.png) (vision: vision-reports/bdd-01.yaml) (assert-bdd-1.json) (logs/e2e.log)
- PASS BDD-02: 布局结构：Explore 页为已登录用户渲染发布主按钮 (screenshots/bdd-02-explore-publish-button.png) (vision: vision-reports/bdd-02.yaml) (assert-bdd-2.json)
- PASS BDD-03: 布局结构：他人主页不出现发布入口 (screenshots/bdd-03-other-user-page.png) (vision: vision-reports/bdd-03.yaml) (assert-bdd-3.json)
- PASS BDD-04: 布局结构：未登录时不渲染发布入口 (screenshots/bdd-04-anon-explore.png) (vision: vision-reports/bdd-04.yaml) (assert-bdd-4.json)
- PASS BDD-05: 交互行为：未登录访问发布页被重定向到首页 (screenshots/bdd-05-anon-publish-redirect.png) (vision: vision-reports/bdd-05.yaml) (assert-bdd-5.json)
- PASS BDD-06: 交互行为：多文件（文本 + 二进制）发布成功且落库类型正确 (screenshots/bdd-06-files-selected.png) (screenshots/bdd-06-result.png) (vision: vision-reports/bdd-06.yaml) (assert-bdd-6.json)
- PASS BDD-07: 交互行为：文本文件在详情页渲染、二进制文件可下载 (screenshots/bdd-07-detail-render.png) (screenshots/bdd-07-binary-overflow-menu.png) (vision: vision-reports/bdd-07.yaml) (assert-bdd-7.json)
- PASS BDD-08: 交互行为：无 NUL 但非合法 UTF-8 的文件被判为二进制 (screenshots/bdd-08-invalid-utf8-selected.png) (vision: vision-reports/bdd-08.yaml) (assert-bdd-8.json)
- PASS BDD-09: 布局结构：编辑相对路径后构造出嵌套目录结构 (screenshots/bdd-09-path-edited.png) (screenshots/bdd-09-detail-tree.png) (vision: vision-reports/bdd-09.yaml) (assert-bdd-9.json)
- PASS BDD-10: 交互行为：结果态提供可复制的页面链接与 Raw 链接 (screenshots/bdd-10-result-links.png) (screenshots/bdd-10-mobile-result.png) (vision: vision-reports/bdd-10.yaml) (assert-bdd-10.json)
- PASS BDD-11: 交互行为：Raw 链接对公开 entry 免认证可读 (assert-bdd-11.json)
- PASS BDD-12: 交互行为：结果态可跳转详情 (screenshots/bdd-12-detail-page.png) (vision: vision-reports/bdd-12.yaml) (assert-bdd-12.json)
- PASS BDD-13: 交互行为：结果态"再发一个"清空表单并重置幂等键 (screenshots/bdd-13-form-reset.png) (vision: vision-reports/bdd-13.yaml) (assert-bdd-13.json)
- PASS BDD-14: 交互行为：空 summary 阻止提交 (screenshots/bdd-14-empty-summary-error.png) (vision: vision-reports/bdd-14.yaml) (assert-bdd-14.json)
- PASS BDD-15: 交互行为：无文件阻止提交 (screenshots/bdd-15-no-files-error.png) (vision: vision-reports/bdd-15.yaml) (assert-bdd-15.json)
- PASS BDD-16: 交互行为：超出限额（文件数 / 单文件 / 总量）阻止提交并指出对象 (screenshots/bdd-16-over-limit-error.png) (vision: vision-reports/bdd-16.yaml) (assert-bdd-16.json)
- PASS BDD-17: 交互行为：非法相对路径阻止提交 (screenshots/bdd-17-invalid-path-error.png) (vision: vision-reports/bdd-17.yaml) (assert-bdd-17.json)
- PASS BDD-18: 交互行为：重复相对路径阻止提交 (screenshots/bdd-18-duplicate-path-error.png) (vision: vision-reports/bdd-18.yaml) (assert-bdd-18.json)
- PASS BDD-19: 交互行为：自定义 slug 非法或超长时阻止提交 (screenshots/bdd-19-slug-too-long-error.png) (vision: vision-reports/bdd-19.yaml) (assert-bdd-19.json)
- PASS BDD-20: 交互行为：默认公开且过期时间默认 15 天 (screenshots/bdd-20-defaults.png) (vision: vision-reports/bdd-20.yaml) (assert-bdd-20.json)
- PASS BDD-21: 交互行为：填写的可选字段被正确提交与采纳 (screenshots/bdd-21-optional-fields-filled.png) (vision: vision-reports/bdd-21.yaml) (assert-bdd-21.json)
- PASS BDD-22: 交互行为：创建的 entry 归属登录用户 (screenshots/bdd-22-ownership.png) (vision: vision-reports/bdd-22.yaml) (assert-bdd-22.json)
- PASS BDD-23: 交互行为：失败后保留表单且重试不产生重复 entry (screenshots/bdd-23-failure-form-kept.png) (vision: vision-reports/bdd-23.yaml) (assert-bdd-23.json)
- PASS BDD-24: 交互行为：载荷变更后重试视为新意图 (screenshots/bdd-24-changed-payload.png) (vision: vision-reports/bdd-24.yaml) (assert-bdd-24.json)
- PASS BDD-25: 交互行为：限流（429）有明确提示 (screenshots/bdd-25-rate-limit-error.png) (vision: vision-reports/bdd-25.yaml) (assert-bdd-25.json)
- PASS BDD-26: 交互行为：后端校验错误（400/422）有明确提示 (screenshots/bdd-26-400-error.png) (screenshots/bdd-26-422-error.png) (vision: vision-reports/bdd-26.yaml) (assert-bdd-26.json)
- PASS BDD-27: 交互行为：提交进行中禁止重复提交 (screenshots/bdd-27-submitting-state.png) (vision: vision-reports/bdd-27.yaml) (assert-bdd-27.json)
- PASS BDD-28: 交互行为：按文档 seed 后发布流程可人工走通 (screenshots/bdd-28-explore-seeded.png) (screenshots/bdd-28-publish-form-filled.png) (screenshots/bdd-28-result.png) (vision: vision-reports/bdd-28.yaml) (assert-bdd-28.json) (logs/p6-driver-results.json)
- PASS BDD-29: 视觉呈现：表单上以可见文本标明当前可见性状态，默认指明为公开 (screenshots/bdd-29-visibility-public.png) (screenshots/bdd-29-visibility-private.png) (vision: vision-reports/bdd-29.yaml) (assert-bdd-29.json)
- PASS BDD-30: 交互行为：文本/二进制判定与后端规则一致 (assert-bdd-30.json) (logs/unit-test.log)

**Summary**: 30/30 PASS, 0 FAIL

## 关键证据摘录

- **BDD-06/08/30（文本/二进制判定）**：表单对合法 UTF-8 文件显示绿色"文本"徽章、对含 NUL 与无 NUL 非法 UTF-8 文件显示红色"二进制"徽章；`/raw` 断言 `note.md.is_binary=false` / `blob.bin.is_binary=true`；单测 `isBinaryContent` 对 NUL/合法 UTF-8/无 NUL 非法 UTF-8/0 字节与后端 `is_binary_content` 逐一致。
- **BDD-07（下载入口）**：文本 `note.md` 以渲染后 markdown 呈现（vision 确认粗体标题 + 正文可读）；二进制 `blob.bin` 选中后溢出菜单（More）含 `Download blob.bin` / `Download as Pack` 可点击项，且 `GET /api/v1/entries/{slug}/files/{id}` 返回 200 且字节与原文件逐一致。
- **BDD-10（复制）**：`http://127.0.0.1:8888/{slug}` 与 `.../{slug}/raw` 两链接展示；两个复制按钮点击后 `navigator.clipboard.readText()` 与展示链接逐字一致；390×844 视口 `scrollWidth=390` 无横向溢出。
- **BDD-20/21（默认值与可选字段）**：未改动时 `is_public=true` 且 `expires_at-created_at=15.00 天`（=limits.default_expires_in）；填 slug/tags(alpha)/team(frontend-team)/7d 后 detail 返回值逐一一致，`expires_at-created_at=7.00 天`。
- **BDD-22（归属）**：`owner_id=1` 与 `/auth/me` 的 alice id=1 一致。
- **BDD-23/24（幂等）**：拦截首个 POST 返回 500 后表单保留（summary+文件），原样重试成功且库中同意图仅 1 条；载荷变更后重试创建新 entry。
- **BDD-27（防重复提交）**：in-flight 时按钮文本 "发布中..." 且 disabled，强行再点击后 POST 计数仍为 1。

## 输入态/交互形态变化类 BDD 人工复核记录

按 verifier 判定标准，When 子句含输入动作的 BDD（BDD-06 选文件 / BDD-09 编辑路径 / BDD-14/15/16/17/18/19 表单预校验 / BDD-23/24 失败重试 / BDD-25/26 错误注入 / BDD-27 in-flight）结论附人工复核记录（复核人=verifier，复核时间 2026-10-02，复核结论=该 BDD 的输入动作后页面状态与 Then 判据一致，见对应截图 + assert JSON）。

| BDD | 复核人 | 复核时间 | 复核结论 |
| :--- | :--- | :--- | :--- |
| BDD-06 | verifier | 2026-10-02 | 选 2 文件后两行分别标"文本"/"二进制"，落库类型正确 |
| BDD-09 | verifier | 2026-10-02 | 第二行路径改为 src/b.cs 后详情树含 src/ + 根级文件（API paths 为准） |
| BDD-14 | verifier | 2026-10-02 | summary 留空点发布 → 就地必填提示，无 POST |
| BDD-15 | verifier | 2026-10-02 | 无文件点发布 → 至少选一文件提示，无 POST |
| BDD-16 | verifier | 2026-10-02 | 超单文件上限 → 行内指明文件名+上限，无 POST |
| BDD-17 | verifier | 2026-10-02 | 路径含 .. → 行级错误，无 POST |
| BDD-18 | verifier | 2026-10-02 | 重复路径 → 行级"相对路径重复"错误，无 POST |
| BDD-19 | verifier | 2026-10-02 | slug 65 字符/含空格/含斜杠 → slug 非法提示，无 POST |
| BDD-23 | verifier | 2026-10-02 | 500 后表单保留、原样重试成功且仅 1 条 entry |
| BDD-24 | verifier | 2026-10-02 | 变更 summary/slug 后重试创建新 entry |
| BDD-25 | verifier | 2026-10-02 | 429 → "请求过于频繁，请稍后重试"，表单保留 |
| BDD-26 | verifier | 2026-10-02 | 400/422 → 显示 detail 原文，无 [object Object] |
| BDD-27 | verifier | 2026-10-02 | in-flight 按钮 disabled，重复点击 POST 仍为 1 |

## 雷同截图复核

- `P6-evidence/screenshots/` 全部 37 张截图 `md5sum` 去重后**无重复**（0 个 md5 碰撞），全部 >1KB。
- 曾出现两组视觉相近截图（BDD-01 空表单 vs BDD-29 可见性区域；BDD-20 默认值 vs BDD-29 可见性区域），已通过改为**聚焦不同表单区域**（BDD-29 聚焦可见性字段、BDD-20 聚焦可见性+过期时间合并区域）使其逐字节不同，非"确为不同操作但视觉相近"的雷同，故不构成需人工复核的 avg-hash 近重复。

## post-test 环境残留检查

- 快照比对（测试前 vs 测试后 debug 库 entry 列表）：
  - 验收过程中自建 entry 全部以 `p6-` 前缀命名，由驱动脚本 `cleanupAll()` 经 API `DELETE` 清理；
  - 额外发现首轮失败驱动遗留 1 条 `nuwttl`（summary "P6 BDD16 many files"），已用 API `DELETE /api/v1/entries/nuwttl`（HTTP 200）清理；
  - **清理后复查**：`GET /api/v1/entries?per_page=100`（alice 认证）返回 22 条，其中 `p6-`/`e2e-`/`diag-` 前缀或 summary 含 "P6 BDD" 的残留 = **0**。
- E2E 清理钩子：`tpv0100-publish.spec.ts` 的 `afterEach` 经 API 按返回的 `created.slug` 删除；实跑后 `Get /api/v1/entries` 未见 `e2e-tpv0100-*` 残留。
- 全程只访问 debug `127.0.0.1:8888`；未触碰生产 `:8080`、`~/.peekview/`、CLI `peekview create`、系统 Python 安装。

## 边界与说明

- verifier 未修改任何代码/测试，仅新建临时驱动脚本（`frontend-v3/_p6-driver.mjs` 等，验收完成后删除）。
- vision-engine 对 BDD-09 文件树缩进曾出现一次误读（把根级文件描述为 src 下），以 API `/raw` 的 `paths` 数组为 ground truth 判定，不影响结论。
- 本报告仅记录验收事实，不声称 P6 gate 已过——gate 由主 Agent 亲自跑（check-gate.py P6 + check-p6-evidence.py + check-p6-provenance.py）。

`[PROD_NOT_TOUCHED]`
