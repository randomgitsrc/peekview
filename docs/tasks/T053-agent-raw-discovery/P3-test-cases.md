---
phase: P3
task_id: T053
type: test-cases
parent: P2-design.md
trace_id: T053-P3-20260713
status: complete
created: 2026-07-13
agent: test-designer
---

test_code_dir: backend/tests/

# T053: Agent Raw 端点自动发现 — 测试用例

## 测试文件

`backend/tests/test_content_negotiation.py`

## BDD → 测试用例映射

| BDD | 测试类 | 测试方法 | 预期（红灯） |
|-----|--------|---------|-------------|
| B1 | TestB1JsonPreferred | test_json_when_accept_application_json | 200 JSON，当前返回 HTML（无 Content Negotiation） |
| B1 | TestB1JsonPreferred | test_json_matches_raw_endpoint | JSON 内容与 /raw 一致，当前不返回 JSON |
| B2 | TestB2HtmlPreferred | test_html_when_both_acceptable | 200 HTML，当前返回 HTML 但无 <link> 注入 |
| B3 | TestB3Wildcard | test_html_when_accept_wildcard | 200 HTML，当前返回 HTML（此条可能意外绿灯） |
| B4 | TestB4BrowserAccept | test_html_for_browser_accept | 200 HTML，同 B3 |
| B5 | TestB5HtmlWinsOverQ | test_html_wins_despite_lower_q | 200 HTML（SCOPE+ 修正），当前返回 HTML（可能绿灯） |
| B5 | TestB5HtmlWinsOverQ | test_html_wins_when_q_equal | 200 HTML，当前返回 HTML（可能绿灯） |
| B5 | TestB5HtmlWinsOverQ | test_json_when_html_q_zero | 200 JSON，当前不返回 JSON |
| B6 | TestB6PrivateUnauth | test_404_for_private_entry_no_auth | 404 JSON，当前返回 HTML（SPA 页面） |
| B6 | TestB6PrivateUnauth | test_404_matches_raw_behavior | 404 匹配 /raw 行为 |
| B7 | TestB7PrivateOwnerAuth | test_json_for_owner_auth | 200 JSON，当前返回 HTML |
| B7b | TestB7bAdminAuth | test_json_for_admin_auth | 200 JSON，当前返回 HTML |
| B8 | TestB8NonexistentJson | test_404_json_for_nonexistent | 404 JSON，当前返回 HTML |
| B9 | TestB9NonexistentHtml | test_html_for_nonexistent | 200 HTML SPA，可能意外绿灯 |
| B10 | TestB10LinkInjection | test_link_in_head_for_valid_slug | HTML 含 <link>，当前无注入 |
| B10b | TestB10bPrivateLink | test_link_in_head_for_private_entry | HTML 含 <link>，当前无注入 |
| B10b | TestB10bPrivateLink | test_raw_still_404_without_auth | /raw 仍需认证（此条应绿灯——已有实现） |
| B11 | TestB11NoLinkForNonexistent | test_no_link_for_nonexistent | HTML 不含 <link>，当前也无（可能绿灯） |
| B12 | TestB12NoLinkForFrontendRoutes | test_no_link_for_explore | 无 <link>，当前也无（可能绿灯） |
| B12 | TestB12NoLinkForFrontendRoutes | test_no_link_for_settings_apikeys | 无 <link>，可能绿灯 |
| B12 | TestB12NoLinkForFrontendRoutes | test_no_link_for_users_route | 无 <link>，可能绿灯 |
| B12 | TestB12NoLinkForFrontendRoutes | test_no_link_for_login | 无 <link>，可能绿灯 |
| B13 | TestB13LinkHeader | test_link_header_for_valid_slug | 含 Link header，当前无 |
| B13b | TestB13bPrivateLinkHeader | test_link_header_for_private_entry | 含 Link header，当前无 |
| B14 | TestB14NoLinkHeader | test_no_link_header_for_nonexistent | 无 Link header，可能绿灯 |
| B15 | TestB15LlmsTxt | test_llms_txt_redirects | 302 重定向，已实现（可能绿灯） |
| B16 | TestB16E2EAcceptJson | test_agent_gets_json_in_one_step | 200 JSON，当前返回 HTML |
| B17 | TestB17E2ELinkDiscovery | test_agent_discovers_raw_via_link | HTML 含 /raw URL + /raw 返回 JSON |
| Edge | TestPrefersJsonUnit | test_missing_accept_returns_html | 可能绿灯 |
| Edge | TestPrefersJsonUnit | test_malformed_accept_returns_html | 可能绿灯 |
| Edge | TestPrefersJsonUnit | test_empty_accept_returns_html | 可能绿灯 |
| Edge | TestPrefersJsonUnit | test_json_only_accept | 200 JSON，红灯 |
| Edge | TestPrefersJsonUnit | test_xhtml_counts_as_html | 可能绿灯 |

## 红灯分析

### 确定红灯（实现缺失必然失败）
- B1: Accept: application/json → 期望 JSON，当前返回 HTML
- B5 (q=0): Accept: text/html;q=0, application/json → 期望 JSON
- B6: 私有 entry + Accept: application/json 无认证 → 期望 404 JSON
- B7: 私有 entry + Accept: application/json 有认证 → 期望 JSON
- B7b: admin 认证 → 期望 JSON
- B8: 不存在 slug + Accept: application/json → 期望 404 JSON
- B10: 有效 slug HTML 响应含 <link> → 当前无注入
- B10b: 私有 entry HTML 含 <link> → 当前无注入
- B13: 有效 slug 响应含 Link header → 当前无
- B13b: 私有 entry 响应含 Link header → 当前无
- B16: E2E Accept JSON → 当前返回 HTML
- B17: E2E <link> 发现 → 当前无 <link>

### 可能绿灯（当前行为与预期一致）
- B3/B4/B9: `*/*`/浏览器 Accept 返回 HTML → 当前已返回 HTML
- B5 (HTML wins): q 值排序 HTML 胜出 → 当前返回 HTML
- B10b (raw 404): /raw 私有 entry 未认证 404 → 已实现
- B11/B12/B14: 不存在/前端路由无 <link>/Link → 当前也无
- B15: llms.txt 302 重定向 → 已实现
- Edge: 缺少/malformed Accept 返回 HTML → 当前已返回

这些可能绿灯是预期行为——Content Negotiation 的"默认返回 HTML"路径在实现前后一致。关键红灯集中在：
1. JSON 返回路径（Accept: application/json）
2. <link> 注入
3. Link header
4. 认证感知的 404

## 测试基础设施

- **隔离**：conftest.py autouse（tmp_path + PEEKVIEW_STORAGE__* env）
- **Client**：create_app(data_dir=, db_path=) + ASGITransport + AsyncClient
- **认证**：/api/v1/auth/register → access_token → Bearer header
- **Admin**：register + _make_admin(app, username)
- **私有 entry**：is_public=False + auth_token 创建
