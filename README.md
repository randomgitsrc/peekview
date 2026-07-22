# PeekView

> Agent 写，人看，Agent 也能读。

Agent 发布产出，你拿到一个链接。浏览器打开就是渲染好的页面，其他 Agent 通过 `/raw` 读取原始内容。

[![Version](https://img.shields.io/badge/version-0.10.0-blue.svg)](https://github.com/randomgitsrc/peekview/releases)
[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/downloads/)
[![Vue 3](https://img.shields.io/badge/vue-3.4+-green.svg)](https://vuejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 快速开始

```bash
pipx install peekview
peekview serve                          # http://localhost:8080
peekview create file.py -s "我的代码"   # → http://localhost:8080/wo-de-dai-ma
```

Agent 接入（可选）：

```bash
npm install -g @peekview/mcp-server
peekview-mcp config set peekview.url http://localhost:8080
peekview-mcp serve
```

## 渲染能力

代码（Shiki 100+ 语言，行号定位）· Markdown（GFM，自动目录）· Mermaid / PlantUML 图表 · HTML（沙箱 iframe，Three.js / Canvas / WebGL）· 图片 · 多文件（文件树 + ZIP 下载）· 全文搜索

暗色 / 亮色主题 · 移动端适配 · 私有条目 · API Key 管理

## Agent 读

`GET /api/v1/entries/{slug}/raw` 返回结构化 JSON——文本文件含 `content` 字段，二进制文件 `content=null` + `file_url`。公开条目免认证，私有条目需 API key。

## MCP 接入

**Claude Code：**
```bash
claude mcp add peekview \
  --transport http http://localhost:33333/mcp \
  --header "Authorization: Bearer pv_your_api_key"
```

**其他 MCP 客户端（Cursor / OpenCode / ...）：**
```json
{
  "peekview": {
    "url": "http://localhost:33333/mcp",
    "headers": { "Authorization": "Bearer pv_your_api_key" }
  }
}
```

工具列表、Local/Remote 双模式、安全模型：[packages/mcp-server/README.md](packages/mcp-server/README.md)

## CLI 速查

```bash
peekview create <文件...> -s "摘要"   # 创建条目
peekview get <slug>                    # 查看条目
peekview list [-q "搜索"] [-t 标签]    # 列出/搜索
peekview delete <slug>                 # 删除条目
peekview serve                         # 启动服务
```

## 配置

环境变量，前缀 `PEEKVIEW_`，`__` 分隔嵌套：

| 变量 | 默认 | 说明 |
|------|------|------|
| `SERVER__PORT` | `8080` | 端口 |
| `SERVER__API_KEY` | `""` | 全局 API Key（空=免认证） |
| `STORAGE__DATA_DIR` | `~/.peekview/data` | 文件存储 |
| `AUTH__ALLOW_REGISTRATION` | `true` | 允许注册 |

完整配置（33 项）：`~/.peekview/config.yaml` · `peekview --help` · [CLAUDE.md](CLAUDE.md)

## 文档

[部署指南](docs/guides/DEPLOYMENT.md) · [MCP Server](packages/mcp-server/README.md) · [调试指南](docs/guides/DEBUGGING.md) · [更新日志](CHANGELOG.md)

## License

MIT
