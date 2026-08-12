---
phase: P1
task_id: T007
parent: P0-brief.md
trace_id: T007-P1-20260614
---

# P1 需求基线 — T007 Entry Raw API

## 1. 需求复述

为 PeekView 新增 entry 级别的原始内容 API（`GET /api/v1/entries/{slug}/raw`），返回结构化 JSON，包含 entry 的所有文件原始内容。同时在前端 ActionBar 加 Raw 按钮作为可发现入口。

核心目标：Agent B 收到 Agent A 发布的 PeekView URL（如 `http://host/7rlejl`），通过惯常的 web_fetch 工具访问页面，能在页面里发现 Raw 按钮对应的链接，再请求 `/raw` 接口，一次性拿到所有文件的原始内容。

## 2. 隐含需求识别

- **多文件返回结构**：单文件和多文件需要一致的 JSON 结构，Agent 处理逻辑才能统一。选择用 `files` 数组统一表示，单文件也是长度为 1 的数组。
- **二进制文件处理**：图片、SVG 等二进制文件不能序列化为 JSON 字符串。需要 `is_binary: true` + `file_url` 指向已有的 `/files/{slug}/files/{file_id}/content` 接口。
- **认证逻辑一致性**：`/raw` 的认证必须与现有 `GET /api/v1/entries/{slug}` 完全一致——公开 entry 无需认证，私有 entry 需要 API Key 或 Cookie。
- **前端 ActionBar 两处**：desktop 和 mobile 菜单各有一套按钮，Raw 按钮要在两处都加。
- **MCP 工具是否需要同步**：`get_entry` MCP 工具已可获取 entry 信息但不含文件内容，`/raw` 是 HTTP 接口不是 MCP 工具，暂不新增 MCP 工具（避免工具数量膨胀）。
- **内容大小限制**：超大文件（如 > 10MB 的单文件）是否截断？结论：不截断，保持与现有 download 接口一致，由调用方负责处理大内容。
- **`<link rel="alternate">` 的可行性**：SPA 的 `<head>` 动态注入需要 `useHead` 或手动 DOM 操作，成本低但 WebFetch 不会读 `<head>`，实际效果有限。保留作为锦上添花，不作为主要入口。

## 3. BDD 验收条件

**AC1：公开单文件 entry**
```
Given 公开 entry（slug=abc，单个 Markdown 文件）
When  GET /api/v1/entries/abc/raw（无认证）
Then  200，JSON 含：
      slug=abc，content_type=single
      files[0].filename, files[0].language=markdown, files[0].content=原始 Markdown 字符串
      files[0].is_binary=false
```

**AC2：公开多文件 entry**
```
Given 公开 entry（slug=def，含 main.py + README.md 两个文件）
When  GET /api/v1/entries/def/raw（无认证）
Then  200，JSON 含 content_type=multi，files 数组长度=2，每个文件有 filename/language/content
```

**AC3：私有 entry 未认证**
```
Given 私有 entry（slug=ghi）
When  GET /api/v1/entries/ghi/raw（无认证头）
Then  401
```

**AC4：私有 entry 有效 API Key**
```
Given 私有 entry（slug=ghi）
When  GET /api/v1/entries/ghi/raw（Authorization: Bearer {valid_key}）
Then  200，返回完整内容
```

**AC5：entry 含二进制文件**
```
Given entry 含一个 PNG 图片文件（file_id=42）
When  GET /api/v1/entries/{slug}/raw
Then  该文件的 is_binary=true，content=null，file_url 指向 /api/v1/entries/{slug}/files/42/content
```

**AC6：不存在的 entry**
```
Given slug=xyz 不存在
When  GET /api/v1/entries/xyz/raw
Then  404
```

**AC7：前端 Raw 按钮可见且链接正确**
```
Given 进入任意 entry 详情页
When  页面加载完成
Then  ActionBar 有 Raw 按钮，href=/api/v1/entries/{slug}/raw，点击在新 tab 打开
```

**AC8：WebFetch 可发现**
```
Given 用 WebFetch 访问 entry 页面（/7rlejl）
When  页面 HTML 转成 Markdown
Then  Markdown 中含有指向 /api/v1/entries/7rlejl/raw 的链接文字
```

## 4. 裁剪说明

```
phases: [P1, P2, P3, P4, P5, P6, P8]
```

- 保留 P2：涉及新 API 接口设计 + 前端改动，方案需明确
- 保留 P3：新接口有明确的认证边界和二进制处理逻辑，值得 TDD
- 保留 P6：验收条件明确（AC1-AC8），且涉及前端按钮的可见性验证
- 跳过 P7：改动相对独立，无需专项一致性检查

## 5. 范围声明

```
packages: [peekview]
domains: [backend, frontend]
ui_affected: true
gate_commands:
  P5: "pytest backend/tests/ -q --tb=short"
  P5_e2e: "npx playwright test --reporter=list"
  P6: "pytest backend/tests/test_raw_api.py -q"
```

## 6. 能力需求声明

```
capability_requirements:
  - need: browser-vision
    why: P6 验收 AC7/AC8 需要验证前端按钮可见性
    available:
      - vision-analyst（workflow-v4 内置）
      - Playwright 截图
    status: available
```
