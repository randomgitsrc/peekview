---
phase: P6
task_id: T053
type: acceptance
parent: P5-test-results.md
trace_id: T053-P6-20260713
status: draft
created: 2026-07-13
agent: verifier
---

# T053: Agent Raw 端点自动发现 — P6 验收报告

## 验收环境

- debug backend: `http://127.0.0.1:8888`（`/tmp/peekview-debug/`）
- 测试数据：公开 entry `test-slug`（id=1），私有 entry `private-slug`（id=2, owner_id=1）
- 认证用户：admin（id=1, is_admin=true），owner（id=2, is_admin=false）
- 验证方式：curl + python3 解析
- ui_affected: false（无 Playwright 截图需求）

## BDD 验收结果

- PASS B01: Content Negotiation — JSON 优先。`Accept: application/json` → Content-Type: application/json，响应体含 slug=test-slug (b01_headers.txt) (b01_body.json)
- PASS B02: Content Negotiation — HTML 优先。`Accept: text/html, application/json` → Content-Type: text/html (b02_headers.txt) (b02_body.html)
- PASS B03: Content Negotiation — 通配符不触发 JSON。`Accept: */*` → Content-Type: text/html (b03_headers.txt) (b03_body.html)
- PASS B04: Content Negotiation — 浏览器 Accept 返回 HTML。浏览器默认 Accept → Content-Type: text/html (b04_headers.txt) (b04_body.html)
- PASS B05: Content Negotiation — text/html 存在时 HTML 胜出（无论 q 值）。`Accept: application/json;q=0.9, text/html;q=0.8` → Content-Type: text/html (b05_headers.txt) (b05_body.html)
- PASS B06: Content Negotiation — 私有 entry 未认证返回 404。`Accept: application/json` 无认证 → 404 + JSON error (b06_headers.txt) (b06_body.json)
- PASS B07: Content Negotiation — 私有 entry 已认证(owner)返回 JSON。`Accept: application/json` + owner Bearer → Content-Type: application/json (b07_headers.txt) (b07_body.json)
- PASS B07b: Content Negotiation — admin 访问私有 entry 返回 JSON。`Accept: application/json` + admin Bearer → Content-Type: application/json (b07b_headers.txt) (b07b_body.json)
- PASS B08: Content Negotiation — 不存在 slug 返回 404 JSON。`Accept: application/json` → 404 + JSON error (b08_headers.txt) (b08_body.json)
- PASS B09: Content Negotiation — 不存在 slug HTML 模式返回 SPA 页面。`Accept: text/html` → Content-Type: text/html (b09_headers.txt) (b09_body.html)
- PASS B10: HTML <link> 注入 — 有效 slug。HTML `<head>` 含 `<link rel="alternate" type="application/json" href="/api/v1/entries/test-slug/raw" />` (b10_headers.txt) (b10_body.html)
- PASS B10b: HTML <link> 注入 — 私有 entry 也注入。HTML 含 `<link>` 指向 private-slug/raw，且 /raw 无认证返回 404 (b10b_headers.txt) (b10b_body.html) (b10b_raw_status.txt)
- PASS B11: HTML <link> 注入 — 不存在 slug 不注入。HTML 不含 `<link rel="alternate">` (b11_headers.txt) (b11_body.html)
- PASS B12: HTML <link> 注入 — 前端路由不注入。`/explore` HTML 不含 `<link rel="alternate">` (b12_headers.txt) (b12_body.html)
- PASS B13: HTTP Link header — 有效 slug。响应含 `Link: </api/v1/entries/test-slug/raw>; rel="alternate"; type="application/json"` (b13_headers.txt)
- PASS B13b: HTTP Link header — 私有 entry 也添加。响应含 Link header 指向 private-slug/raw (b13b_headers.txt)
- PASS B14: HTTP Link header — 不存在 slug 不添加。响应不含指向 /raw 的 Link header (b14_headers.txt)
- PASS B15: llms.txt — 包含 /raw 和 Content Negotiation 描述。GET /llms.txt（302→GitHub）内容含 Content Negotiation 描述和 /raw API 描述 (b15_headers.txt) (b15_body.txt)
- PASS B16: 端到端 — Agent 通过 Accept 直接获取 JSON。`Accept: application/json` → JSON 含 slug=test-slug，一步获取 (b16_headers.txt) (b16_body.json)
- PASS B17: 端到端 — Agent 通过 <link> 发现 /raw。HTML 含 `<link>` → Agent 请求 /api/v1/entries/test-slug/raw → JSON 含 slug=test-slug (b17_headers.txt) (b17_body.html) (b17_raw_headers.txt) (b17_raw_body.json)

## B15 重试验证说明

B15 在上一轮 P6 验收中 FAIL，根因为 llms.txt GitHub 文件未同步 Content Negotiation 描述。修复动作：llms.txt 已 push 到 GitHub（commit e32dfc1e）。本轮验证：GET /llms.txt（302 重定向到 GitHub raw）返回内容包含：
- Content Negotiation 机制描述（`Accept: application/json` 获取 JSON）
- /raw API 端点描述

## 验证脚本

验证脚本：`P6-evidence/verify.sh`
执行日志：`P6-evidence/test-output.log`

## 证据文件清单

| BDD | 证据文件 |
|-----|---------|
| B01 | b01_headers.txt, b01_body.json |
| B02 | b02_headers.txt, b02_body.html |
| B03 | b03_headers.txt, b03_body.html |
| B04 | b04_headers.txt, b04_body.html |
| B05 | b05_headers.txt, b05_body.html |
| B06 | b06_headers.txt, b06_body.json |
| B07 | b07_headers.txt, b07_body.json |
| B07b | b07b_headers.txt, b07b_body.json |
| B08 | b08_headers.txt, b08_body.json |
| B09 | b09_headers.txt, b09_body.html |
| B10 | b10_headers.txt, b10_body.html |
| B10b | b10b_headers.txt, b10b_body.html, b10b_raw_status.txt |
| B11 | b11_headers.txt, b11_body.html |
| B12 | b12_headers.txt, b12_body.html |
| B13 | b13_headers.txt |
| B13b | b13b_headers.txt |
| B14 | b14_headers.txt |
| B15 | b15_headers.txt, b15_body.txt |
| B16 | b16_headers.txt, b16_body.json |
| B17 | b17_headers.txt, b17_body.html, b17_raw_headers.txt, b17_raw_body.json |
