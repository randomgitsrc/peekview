# MCP 双模式 v0.7.0 — 实施进展与下一步指南

> 日期：2026-06-09
> 状态：核心实现完成，待真实环境验证 + 发布
> 关联：docs/plans/mcp-dual-mode-final-v0.7.md（权威方案）

---

## 一、已完成（本次提交）

### 配置系统（Step 2）
- `config.ts`：`ServerConfig` 新增 `mode: 'local' | 'remote'`、`allowedPaths: string[]`
- `config/file.ts`：`ConfigFileData.server` 新增 `mode`、`allowed_paths`
- `config/merge.ts`：解析 `MCP_MODE` / `MCP_ALLOWED_PATHS`（冒号分隔），local 模式无 allowed_paths 时输出 warning（不拒绝启动）

### publish_files 工具（Step 3）
- `tools/publishFiles.ts`：新建
  - 绝对路径校验、目录递归扫描、构建目录跳过
  - 三层安全：黑名单（.ssh/.aws/.pem 等）→ allowed_paths → cwd fallback
  - `fs.stat` 先于 `fs.realpath`（避免 ENOENT）
  - 目录扫描防符号链接环（visited realpath 集合）
  - 安全类失败拒绝整个请求；非安全类（不存在/二进制/过大）skip 单文件
  - 不传 language，后端 detect_language 自动推断
  - 文件名通配自实现 matchPattern（不依赖 fs.glob，兼容 Node 18+）
  - skipped 反馈

### 工具注册（Step 4）
- `tools/index.ts`：`createTools(client, config)` 按 `config.mode` 返回不同工具集
  - local → `publish_files` + get/list/delete（无 create_entry）
  - remote → `create_entry` + get/list/delete（无 publish_files）
- `index.ts:75`：调用方同步改为 `createTools(client, config)`

### 测试（Step 5）
- `tests/config-merge.test.ts`：+6 用例（mode/allowedPaths 解析、env 覆盖、非法值、local warning）
- `tests/publishFiles.test.ts`：新建 13 用例（单文件、目录递归、构建目录跳过、include 过滤、相对路径拒绝、黑名单拒绝、越界拒绝、不存在 skip、二进制 skip、language 不传、cwd fallback）
- `tests/server.test.ts`：+2 工具策略用例（local/remote 工具列表），3 处 createTools 调用同步新签名
- 单元测试结果：**167 passed**（7 个 integration/health 失败因沙盒无真实后端，与本次改动无关）

---

## 二、下一步（需真实环境）

### 1. E2E 场景验证（必做）
本次只跑了单元测试。需在真实环境验证完整链路：

```bash
# 1) 启动 PeekView 后端
make dev   # 或 backend 启动到 8888

# 2) 构建 MCP Server
make build-mcp

# 3) local 模式启动 MCP
cat > ~/.peekview/mcp-config.yaml << EOF
peekview:
  url: http://localhost:8888
  public_url: http://localhost:8888
server:
  mode: local
  allowed_paths:
    - /path/to/test/project
EOF
peekview-mcp start

# 4) 在 Claude Code 配置 local MCP 连接，验证：
#    - list_tools 只返回 publish_files + get/list/delete（无 create_entry）
#    - publish_files 发布单文件 → 浏览器打开链接确认渲染
#    - publish_files 发布目录 → 确认多文件 + 目录结构正确
#    - publish_files 发布含 .md 的目录 → 确认 markdown 正确渲染（language 后端推断）
```

集成测试文件 `tests/integration/` 已存在框架，可扩展 publish_files 的 E2E case（需后端 + MCP 双进程）。

### 2. path 语义最终确认（已验证，记录待 E2E 复核）
后端 `get_disk_path`（storage.py:64）确认 `file_path` 是**含文件名的完整相对路径**（`src/main.py`）。publish_files 已按此构造 `relPath`。E2E 时复核多层目录（如 `src/utils/helper.py`）落盘路径正确。

### 3. CLI 配置命令（方案 Step 6，本次未做）
- `peekview-mcp config set mode local`
- `peekview-mcp config set allowed-paths /path1 /path2`
- 需先确认 `cli/config.ts` 现有配置写入入口，扩展 mode/allowed_paths 写入

### 4. 文档与发布
- `packages/mcp-server/README.md`：增加 local 模式安装章节
- 版本 bump 到 MCP Server v0.7.0
- `publish.yml` 触发 npm 发布

---

## 三、二进制文件支持（后续增强，非本期）
当前 publish_files 跳过二进制文件（reason: binary）。后端支持 base64 上传，可作为 v0.8 增强：读取二进制 → base64 → `content_base64` 字段。设计已在 `docs/specs/spec-mcp-publish-files.md` 提及。

---

## 四、风险提示
- **系统服务部署**：local 模式作为 systemd/launchd 运行时 cwd 可能是 `/`，必须显式配置 `allowed_paths`。已在 merge.ts warning 中提示。
- **prompt injection**：黑名单 + realpath + 边界检查三层防护已实现，E2E 时建议加恶意路径用例（如诱导发布 `~/.ssh/id_rsa`）验证拒绝。

---

*指南创建：2026-06-09*
