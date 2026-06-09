# MCP 双模式 v0.7.0 — 实施进展与下一步指南

> 日期：2026-06-09
> 状态：核心实现 + 测试隔离 + publish_files 真实链路验证已完成，待文档收尾、版本/tag、发布
> 关联：`docs/plans/mcp-dual-mode-final-v0.7.md`（权威方案）

---

## 一、已完成

### 配置系统
- `config.ts`：`ServerConfig` 新增 `mode: 'local' | 'remote'`、`allowedPaths: string[]`
- `config/file.ts`：`ConfigFileData.server` 新增 `mode`、`allowed_paths`
- `config/merge.ts`：解析 `MCP_MODE` / `MCP_ALLOWED_PATHS`（冒号分隔）
- local 模式无 `allowed_paths` 时 warning + cwd fallback；`publish_files` 在 cwd 为 `/` 时拒绝 fallback

### publish_files 工具
- `tools/publishFiles.ts`：新建
- 支持绝对路径文件、目录递归扫描、include/exclude 文件名过滤
- 三层安全：黑名单（`.ssh/.aws/*.pem` 等）→ `allowed_paths` → cwd fallback
- `fs.stat` 先于 `fs.realpath`（避免 ENOENT）
- 目录扫描防符号链接环（visited realpath 集合）
- 安全类失败拒绝整个请求；非安全类（不存在/二进制/过大）skip 单文件
- 不传 `language`，后端 `detect_language` 自动推断
- 文件名通配自实现 `matchPattern`（不依赖 `fs.glob`，兼容 Node 18+）
- 输出改为纯文本标记（`OK:`, `ERROR:`, `Skipped`, `Link:`），不使用 emoji

### 工具注册
- `tools/index.ts`：`createTools(client, config)` 按 `config.mode` 返回不同工具集
  - local → `publish_files` + get/list/delete（无 `create_entry`）
  - remote → `create_entry` + get/list/delete（无 `publish_files`）
- `index.ts`：调用方同步改为 `createTools(client, config)`

### 测试隔离
- MCP 测试使用临时 HOME，不再 rename 或触碰真实 `~/.peekview/mcp-config.yaml`
- config/CLI config 测试每个用例使用独立临时 HOME
- Vitest `fileParallelism: false`，避免跨文件 `process.env` 竞态
- `health.test.ts` 改为 opt-in：`RUN_REAL_MCP_HEALTH=1`
- `npm test` 改为纯单元测试；integration/e2e 通过独立命令执行

---

## 二、已验证

### 标准调试流程
- `make debug-build`：通过
- `make debug-start`：通过，调试服务运行于 `127.0.0.1:8888`
- 数据隔离：确认服务使用 `/tmp/peekview-debug/peekview.db`
- `make debug-test`：通过，Playwright **52 passed**

### MCP 测试
- `npm run build`：通过
- `npm test`：通过，纯单元测试 **145 passed**
- `tests/publishFiles.test.ts`：通过，覆盖单文件、目录、过滤、黑名单、越界、二进制、cwd fallback、cwd 为 `/` 拒绝等

### publish_files 真实链路 E2E（debug backend only）
只指向 `http://127.0.0.1:8888`，测试文件位于 `/tmp`。已固化为 opt-in 测试：

```bash
RUN_PUBLISH_FILES_E2E=1 \
PEEKVIEW_URL=http://127.0.0.1:8888 \
PEEKVIEW_PUBLIC_URL=http://127.0.0.1:8888 \
npx vitest run tests/e2e/publish-files-local-mode.test.ts
```

验证项：

- 发布目录：`README.md`, `src/main.py`, `src/utils/helper.py`
- 后端 path 语义验证通过：`README.md`, `src/main.py`, `src/utils/helper.py`
- `.pem` 黑名单拒绝验证通过
- 单文件发布验证通过
- 测试条目已从 debug 库清理

---

## 三、剩余发布前待办

### 必做
- [ ] 更新 `packages/mcp-server/README.md` local/remote 双模式说明（进行中）
- [ ] 更新 `CLAUDE.md` / `README.md` / `CHANGELOG.md` 与当前实现一致（进行中）
- [ ] 确认 `packages/mcp-server/package.json` 和 `package-lock.json` 版本为 `0.7.0`
- [ ] 再跑一次 `npm run build && npm test`
- [ ] 再跑一次标准 debug 流程或至少确认 debug 服务未污染生产

### 发布步骤（本轮不执行）
- [ ] 创建 `v0.1.41` tag
- [ ] 创建 `mcp-v0.7.0` tag
- [ ] npm 发布 `@peekview/mcp-server@0.7.0`
- [ ] PyPI 发布前确认 `[0.1.41]` CHANGELOG 内容完整

---

## 四、后续增强（非本期）

- CLI 配置命令语义糖：
  - `peekview-mcp config set mode local`
  - `peekview-mcp config set allowed-paths /path1 /path2`
- 二进制文件支持：读取二进制 → base64 → 后端 `content_base64`
- 单独的 `publish_files` SSE/Agent E2E 测试文件，覆盖 list_tools 与工具调用完整 MCP 协议链路

---

*指南更新：2026-06-09*
