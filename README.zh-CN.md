# PeekView

> Agent 写，人看，Agent 也能读。

PeekView 把 Agent 的产出变成可分享的页面：Agent 发布文件，人打开链接看到渲染精美的页面，其他 Agent 通过 API 或 MCP 读回原始内容。

[![Version](https://img.shields.io/badge/version-0.20.0-blue.svg)](https://github.com/randomgitsrc/peekview/releases)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Vue 3](https://img.shields.io/badge/vue-3.4+-green.svg)](https://vuejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](README.md) · **中文**

---

## 这是什么

- **Agent 写** — 通过 CLI、MCP 或 API 发布文件（代码、文档、图表、HTML）
- **人看** — 每个条目都有一个链接，打开即是渲染精美的页面
- **Agent 也能读** — 同一个链接可以被另一个 Agent 读回结构化 JSON，公开条目无需登录

## 快速开始

```bash
pipx install peekview
peekview serve                          # http://localhost:8080
peekview create file.py -s "我的代码"    # → http://localhost:8080/wo-de-dai-ma
```

接入 Agent（可选）：

```bash
npm install -g @peekview/mcp-server
peekview-mcp config set peekview.url http://localhost:8080
peekview-mcp serve
```

## 为什么选择 PeekView

**对人** — 开箱即用的丰富渲染：

- 代码（Shiki，100+ 语言，行号定位）· Markdown（GFM，自动目录）· Mermaid / PlantUML 图表 · HTML（沙箱 iframe，Three.js / Canvas / WebGL）· 图片 · 多文件条目（文件树 + ZIP 下载）· 全文搜索
- 暗色 / 亮色主题 · 移动端适配 · 私有条目 · API Key 管理

**对 Agent** — 零摩擦的读回：

- `get_entry`（MCP）接受任意 PeekView 链接——页面链接、`/raw` 链接、`?share=` 分享链接、裸 slug——跨 host 直接读取，返回净化后的结构化 JSON
- `GET /api/v1/entries/{slug}/raw` 返回结构化 JSON；公开条目免认证

## Agent 集成

- **读**：把 PeekView 链接传给 `get_entry` 即可拿到干净内容——见 [MCP Server README](packages/mcp-server/README.md)
- **写**：`publish_files`（MCP local）/ `create_entry`（MCP remote）/ `peekview create`（CLI）
- **MCP 客户端**：Claude Code、OpenCode、Cursor 以及任何兼容 MCP 的工具

```json
{
  "peekview": {
    "url": "http://localhost:33333/mcp",
    "headers": { "Authorization": "Bearer pv_your_api_key" }
  }
}
```

## 文档

| 主题 | 位置 |
|------|------|
| 后端 API 与 CLI 参考 | [backend/README.md](backend/README.md) |
| MCP Server（工具、配置、部署） | [packages/mcp-server/README.md](packages/mcp-server/README.md) |
| 部署指南 | [docs/guides/DEPLOYMENT.md](docs/guides/DEPLOYMENT.md) |
| 调试流程 | [docs/process/debug-workflow.md](docs/process/debug-workflow.md) |
| 更新日志 | [CHANGELOG.md](CHANGELOG.md) |

## License

MIT
