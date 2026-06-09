# MCP publish_files 默认白名单优化（v0.7.1）

**状态**: 已根据 `docs/reviews/gstack-review-default-allowed-paths.md` 修订，待实施
**作者**: kity
**日期**: 2026-06-09
**目标版本**: MCP Server v0.7.1（patch bump）

---

## 0. 评审结论与修订摘要

gstack review 认为 v0.7.0 的可用性问题真实存在：`publish_files` 未配置 `allowed_paths` 时只允许 cwd，导致 `/tmp` 下的 agent 临时文件无法发布，local 模式体验差。

但原方案把默认白名单扩展为 `cwd + $HOME + /tmp` 存在 Critical 安全问题：`$HOME` 下大量敏感文件不在黑名单中，如 `~/.env`、`~/.npmrc`、`~/.pypirc`、`~/.git-credentials`、`~/.kube/config`、`~/.docker/config.json`、`~/.config/gh/hosts.yml`、shell history、浏览器 cookie 等。用黑名单保护整个 `$HOME` 不可行。

因此本修订版采用：

1. **默认白名单 = `cwd + os.tmpdir()`**，不默认包含 `$HOME`。
2. **新增 `server.trust_all_paths: true`**，仅本机自用时显式打开；打开后跳过 allowlist，但仍走更严格的敏感路径 denylist。
3. **加强敏感路径 denylist**，覆盖常见 token / credential / history / system path。
4. **local 模式 `publish_files` 默认 `is_public=false`**，避免误发即公网暴露。
5. **改进工具描述、错误信息、CLI help、README/spec/config 文档**，让 agent 和用户知道目录递归语义、默认白名单、如何授权其他目录。

---

## 1. 背景

v0.7.0 的 `publish_files` 路径边界：

```typescript
allowedBases = config.allowedPaths.length > 0
  ? config.allowedPaths
  : [process.cwd()]
```

这会导致：

- agent 写 `/tmp/mcp-intro.md` 再 publish → 被拒绝
- agent 想发布 cwd 外的项目文件 → 被拒绝
- 用户必须手工配置 `server.allowed_paths` 并重启 MCP service

安全动机是正确的：不能让 agent 零配置读全盘。但 local 模式的目标是“本机 agent 给本机用户快速发布文件”，默认只能 cwd 太窄。

---

## 2. 目标

- ✅ 零配置下允许发布：
  - MCP server 启动时的 `process.cwd()` 下文件
  - 当前系统临时目录 `os.tmpdir()` 下文件（Linux 通常 `/tmp`）
- ✅ 零配置下**不**允许整个 `$HOME`
- ✅ 显式 `server.allowed_paths` 继续严格生效，保持 v0.7.0 兼容
- ✅ 新增 `server.trust_all_paths: true`，给完全本机自用用户一键放宽
- ✅ 敏感路径 denylist 始终优先生效，包括 `trust_all_paths`
- ✅ `publish_files` 默认私有（`is_public=false`），公开需显式指定
- ✅ 错误信息能告诉用户：当前允许目录是什么、如何配置
- ✅ 工具描述能引导 agent：生成内容先写文件，再只传那个文件，不要传整个项目目录
- ✅ CLI help / config list / README / specs / CHANGELOG 都同步

---

## 3. 最终设计

### 3.1 路径边界解析顺序

```text
1. 先解析 realpath
   - 所有输入路径必须是绝对路径
   - 对 symlink / .. 做 realpath 后再检查

2. 先检查敏感路径 denylist
   - 命中 denylist 直接拒绝整个请求
   - denylist 优先级高于 allowlist 和 trust_all_paths

3. 如果 server.trust_all_paths = true
   - 跳过 allowlist 检查
   - 仍然受 denylist 保护
   - 启动时打印危险警告

4. 否则如果配置了 server.allowed_paths
   - 严格要求 realpath 位于 allowed_paths 任一目录下
   - 这是 v0.7.0 的显式白名单行为，保持兼容

5. 否则使用默认 safe allowlist
   - process.cwd()
   - os.tmpdir()
   - 去重 + path.resolve

6. cwd 为文件系统根目录 `/` 时拒绝启动/拒绝 publish_files
   - 防止 cwd fallback 等价于全盘读取
```

### 3.2 默认 allowlist

默认值：

```typescript
const defaultAllowedBases = uniqueResolved([
  process.cwd(),
  os.tmpdir(),
]);
```

不包含 `$HOME`。

原因：

- `$HOME` 下敏感文件太多，黑名单永远列不全。
- agent 生成内容最常落在 cwd 或 `/tmp`。
- 发布 HOME 下某个目录时，用户可以显式配置：
  ```yaml
  server:
    allowed_paths:
      - /home/kity/notes
  ```

### 3.3 `trust_all_paths`

新增配置：

```yaml
server:
  trust_all_paths: true
```

语义：

- 跳过 allowlist 边界检查。
- 仍然检查敏感路径 denylist。
- 仅推荐个人本机、单用户、可信 prompt 场景。
- 多用户机器、远程 MCP Server、不可信 agent 场景严禁开启。

优先级：

```text
trust_all_paths=true > allowed_paths > default(cwd+tmp)
```

如果同时配置 `trust_all_paths: true` 和 `allowed_paths`：

- `trust_all_paths` 生效。
- 启动 warning：`allowed_paths ignored because trust_all_paths=true`。

### 3.4 敏感路径 denylist（始终生效）

v0.7.1 要从 v0.7.0 的少量黑名单扩展为“高敏感路径 denylist”。

建议初始列表：

```typescript
const SENSITIVE_PATTERNS: RegExp[] = [
  // Secret directories
  /\/\.ssh(?:\/|$)/,
  /\/\.gnupg(?:\/|$)/,
  /\/\.aws(?:\/|$)/,
  /\/\.kube(?:\/|$)/,
  /\/\.docker(?:\/|$)/,
  /\/\.config\/gcloud(?:\/|$)/,
  /\/\.config\/gh(?:\/|$)/,

  // Secret files
  /\/(?:\.env|\.env\..*)$/,
  /\/\.npmrc$/,
  /\/\.pypirc$/,
  /\/\.netrc$/,
  /\/\.git-credentials$/,
  /\/\.gitconfig$/,
  /\/(?:\.bash_history|\.zsh_history|\.fish_history)$/,

  // Key/cert extensions
  /\.(?:pem|key|p12|pfx)$/i,

  // System pseudo / protected trees (mainly protects trust_all_paths)
  /^\/proc(?:\/|$)/,
  /^\/sys(?:\/|$)/,
  /^\/dev(?:\/|$)/,
  /^\/run(?:\/|$)/,
  /^\/root(?:\/|$)/,
  /^\/etc(?:\/|$)/,
  /^\/var\/log(?:\/|$)/,

  // Browser profiles/cookies (common secrets)
  /\/\.mozilla(?:\/|$)/,
  /\/\.config\/google-chrome(?:\/|$)/,
  /\/\.config\/chromium(?:\/|$)/,
];
```

说明：

- 不默认拦截所有 dotfile/dotdir，因为项目内 `.claude/settings.json`、`.vscode/settings.json` 等可能是用户确实想发布的上下文。
- 但 `.env*`、credential 文件、shell history、云/包管理器 token 必须拒绝。
- `trust_all_paths` 也不允许 `/etc`、`/proc`、`/sys`、`/root`、浏览器 profile 等。

### 3.5 `/tmp` 风险处理

`os.tmpdir()` 默认允许，但 `/tmp` 是全局可写目录。

实施要求：

- 文档标注：多用户共享机器上建议显式配置 `allowed_paths`，不要依赖默认 `/tmp`。
- 可选增强（v0.7.1 尽量实现）：对 `os.tmpdir()` 下的文件检查 owner：
  ```typescript
  stat.uid === process.getuid?.()
  ```
  非当前用户文件拒绝。
- 如果 Node/平台不支持 uid（Windows），跳过 owner 检查。

### 3.6 `is_public` 默认值

v0.7.0 `publish_files` 透传 `is_public`，未设置时后端默认 public。

v0.7.1 调整：

```typescript
is_public: params.is_public ?? false
```

只影响 `publish_files` local 模式；remote `create_entry` 不改。

理由：local 模式读取本地文件，误发风险比 Agent 直接生成内容更高。默认私有更安全，用户要公开可以显式传 `is_public: true`。

---

## 4. 错误信息设计

### 4.1 敏感路径

```text
ERROR: 发布被拒绝：路径 /home/kity/.npmrc 命中敏感文件保护规则。
该文件可能包含 token、密码、密钥、历史命令、浏览器 cookie 或系统凭证。
出于安全考虑，整个请求已取消。
```

### 4.2 超出允许范围

```text
ERROR: 发布被拒绝：路径 /b-dir/file.md 超出允许范围。

当前路径模式：默认安全模式（未配置 server.allowed_paths）
当前允许的基准目录：
  - /home/kity/cclab/test-01 (cwd)
  - /tmp (tmpdir)

如需访问其他目录，请选择一种方式：
  1) 推荐：配置 server.allowed_paths，例如：
     peekview-mcp config set server.allowed_paths '/home/kity/cclab:/b-dir:/tmp'
     peekview-mcp service restart
  2) 临时：把文件复制到 cwd 或 /tmp 后再发布
  3) 本机自用且完全信任时：设置 server.trust_all_paths=true（危险选项）

出于安全考虑，整个请求已取消。
```

### 4.3 trust_all_paths 仍被 denylist 拒绝

```text
ERROR: 发布被拒绝：路径 /etc/passwd 命中敏感文件保护规则。
当前 server.trust_all_paths=true，但敏感路径 denylist 始终生效。
出于安全考虑，整个请求已取消。
```

---

## 5. `publish_files` 工具描述更新

目标：让 Claude Code / Cursor / opencode 等 agent 减少误用。

```text
Publish local files or directories to PeekView. MCP Server reads files directly.

IMPORTANT USAGE:
- To publish ONE file, pass that file's absolute path.
- Passing a DIRECTORY publishes files under it recursively. Do this only when you intentionally want to publish a directory tree.
- For Agent-generated content: first write it to a file (prefer cwd or /tmp), then publish that file path only.
- Do NOT pass the project root unless you intend to publish multiple project files.

PATH RULES:
- Paths must be absolute.
- Default allowed bases: process.cwd() and os.tmpdir() only.
- $HOME is NOT allowed by default; configure server.allowed_paths for extra directories.
- server.trust_all_paths=true disables the allowlist, but sensitive paths are still blocked.
- Sensitive files such as .env, .npmrc, .pypirc, .git-credentials, ~/.ssh, ~/.aws, ~/.kube, *.pem/*.key are always blocked.

VISIBILITY:
- publish_files defaults to private (is_public=false). Set is_public=true to publish a public link.

Examples:
- Single file:   { "summary": "Fix", "paths": ["/project/fix.py"] }
- Generated doc: write_file("/tmp/intro.md") then { "summary": "Intro", "paths": ["/tmp/intro.md"] }
- Directory:     { "summary": "Docs", "paths": ["/project/docs/"], "include_patterns": ["*.md"] }

Skipped automatically: .git, node_modules, __pycache__, .venv, dist, build
```

---

## 6. CLI / help / config 需要同步的点

### 6.1 `peekview-mcp config --help`

`packages/mcp-server/src/cli/config.ts` 的 Available configuration keys 增加：

```text
server.allowed_paths    - local 模式显式路径白名单，冒号分隔；配置后覆盖默认 cwd+tmpdir
server.trust_all_paths  - 危险选项：local 模式跳过路径白名单，仅保留敏感路径保护 (default: false)
```

同时在 help 末尾增加 local 模式说明：

```text
local 模式 publish_files 路径规则：
  - 默认允许 cwd + 系统临时目录（如 /tmp）
  - 不默认允许 $HOME
  - 如需额外目录：peekview-mcp config set server.allowed_paths '/path/a:/path/b'
  - 完全本机自用：peekview-mcp config set server.trust_all_paths true（危险）
  - 修改配置后需重启 service：peekview-mcp service restart
```

### 6.2 `peekview-mcp config list`

输出新增：

```text
server:
  allowed_paths:    (not set)  # local 显式白名单；未设置时默认 cwd+tmpdir
  trust_all_paths:  false      # 危险：跳过白名单，仅保留敏感路径保护
```

`Available config keys` 增加 `server.trust_all_paths`。

### 6.3 `peekview-mcp config set`

当前已有 bool 解析逻辑，`server.trust_all_paths true` 可直接工作。

需要补类型说明：

```typescript
ConfigFileData.server.trust_all_paths?: boolean
```

### 6.4 环境变量

新增：

```text
MCP_TRUST_ALL_PATHS=true
```

现有：

```text
MCP_ALLOWED_PATHS=/path/a:/path/b
```

优先级：Env > config file > default。

---

## 7. 代码改动清单

### 7.1 `packages/mcp-server/src/config.ts`

新增字段：

```typescript
export interface ServerConfig {
  // ...
  allowedPaths: string[];
  trustAllPaths: boolean;
}
```

### 7.2 `packages/mcp-server/src/config/file.ts`

新增 YAML schema 字段：

```typescript
server?: {
  // ...
  allowed_paths?: string[];
  trust_all_paths?: boolean;
};
```

### 7.3 `packages/mcp-server/src/config/merge.ts`

新增解析：

```typescript
const trustAllPaths = parseBool(
  env.MCP_TRUST_ALL_PATHS ?? fileConfig?.server?.trust_all_paths ?? false
);
```

warning 更新：

- local + no allowed_paths + no trust_all_paths：提示默认 `cwd + tmpdir`
- local + trust_all_paths：打印危险 warning
- trust_all_paths + allowed_paths：提示 allowed_paths 被忽略

### 7.4 `packages/mcp-server/src/tools/publishFiles.ts`

改动：

- import `os`
- 增强 `SENSITIVE_PATTERNS`
- 新增 allowlist 解析 helper：
  ```typescript
  type PathMode = 'default' | 'allowed_paths' | 'trust_all_paths';
  interface PathPolicy { mode: PathMode; allowedBases: string[]; descriptionLines: string[]; }
  ```
- `isWithinAllowed` 支持 trust 模式
- `SecurityRejection` 区分 `sensitive | out_of_scope | tmp_owner`
- 默认 `is_public: params.is_public ?? false`
- 错误信息改为 4.1/4.2/4.3
- tool description 更新为第 5 节
- 可选：`os.tmpdir()` 下 owner 检查

### 7.5 `packages/mcp-server/src/server.ts`

health/config 响应增加：

```typescript
trust_all_paths: config.trustAllPaths,
allowed_paths_count: config.allowedPaths.length,
```

不要返回完整 allowed paths（避免 health 泄露路径结构），除非当前已在 detail 里返回过类似信息。

### 7.6 `packages/mcp-server/src/cli/config.ts`

同步第 6 节 help/list 输出。

### 7.7 `packages/mcp-server/README.md`

更新 local mode / publish_files 配置说明：

- 默认 `cwd + tmpdir`
- 不默认允许 `$HOME`
- `allowed_paths` 配置示例
- `trust_all_paths` 危险选项
- 修改 config 后重启 service
- `publish_files` 默认 private

### 7.8 根 README / docs specs

同步：

- `README.md`：MCP local mode 简述
- `CLAUDE.md`：MCP local publish_files 安全模型
- `docs/specs/spec-mcp-publish-files.md`：安全模型和默认行为
- `docs/specs/spec-mcp-local-remote-mode.md`：local mode 配置
- `CHANGELOG.md`：新增 `[mcp-v0.7.1]`

---

## 8. 测试计划

### 8.1 单元测试：`tests/publishFiles.test.ts`

新增/更新：

- [ ] 零配置 + cwd 下文件 → 允许
- [ ] 零配置 + `os.tmpdir()` 下当前用户文件 → 允许
- [ ] 零配置 + `$HOME/notes.md` → 拒绝（除非 HOME 恰好是 cwd）
- [ ] 零配置 + `/b-dir/file.md` → 拒绝，错误信息列 cwd + tmpdir
- [ ] 显式 `allowed_paths: [/a]` + `/a/x.md` → 允许
- [ ] 显式 `allowed_paths: [/a]` + `/tmp/x.md` → 拒绝（显式配置覆盖默认）
- [ ] `trust_all_paths: true` + 普通 cwd 外文件 → 允许
- [ ] `trust_all_paths: true` + `/etc/passwd` → denylist 拒绝
- [ ] `trust_all_paths: true` + `allowed_paths` 同时配置 → trust 优先
- [ ] `.env` / `.npmrc` / `.pypirc` / `.git-credentials` / `.kube/config` / `.docker/config.json` → 始终拒绝
- [ ] `*.pem` / `*.key` 大小写扩展 → 始终拒绝
- [ ] `~/.ssh/id_rsa` symlink 经 realpath 后仍拒绝
- [ ] cwd 为 `/` → 拒绝 publish_files
- [ ] 目录路径递归扫描仍工作，`.git/node_modules/dist/build` 仍跳过
- [ ] `is_public` 未传 → client.createEntry 收到 `false`
- [ ] `is_public: true` → public link 行为保持可用

### 8.2 配置测试：`tests/config*.test.ts`

- [ ] YAML `server.trust_all_paths: true` 解析为 `trustAllPaths=true`
- [ ] env `MCP_TRUST_ALL_PATHS=true` 优先于 config file
- [ ] 默认 `trustAllPaths=false`
- [ ] `config set server.trust_all_paths true` 写入 boolean
- [ ] `config list` 显示 trust_all_paths

### 8.3 集成 / E2E

- [ ] local 模式从 `/tmp` 发布单文件成功
- [ ] local 模式从 HOME 普通文件发布默认失败，并提示配置 allowed_paths
- [ ] local 模式显式 allowed_paths 后 HOME 子目录发布成功
- [ ] local 模式 trust_all_paths 发布 cwd 外普通文件成功
- [ ] trust_all_paths 下敏感文件仍拒绝
- [ ] Claude Code 场景：agent 生成文档写 `/tmp/foo.md` 后 publish_files 成功

### 8.4 回归

- [ ] `npm run test:unit`
- [ ] `make test-mcp`
- [ ] remote mode 工具集不变：无 `publish_files`
- [ ] local mode 工具集不变：无 `create_entry`
- [ ] 后端/前端不受影响

---

## 9. 文档发布说明

### 9.1 CHANGELOG.md

```markdown
## [mcp-v0.7.1] - 2026-06-XX

### 改进
- publish_files: 零配置默认允许 cwd + 系统临时目录，解决 /tmp 中 agent 生成文件无法发布的问题
- publish_files: 新增 server.trust_all_paths 危险选项，适合完全本机自用场景
- publish_files: 错误信息区分敏感路径与超出白名单，并给出配置修复命令
- publish_files: 工具描述强化“文件 vs 目录”语义，避免误发布整个项目目录
- CLI: config help/list 增加 allowed_paths、trust_all_paths、本地模式路径规则说明

### 安全
- publish_files: 默认不允许整个 $HOME，避免 .env/.npmrc/.pypirc/.kube 等泄露
- publish_files: 扩展敏感路径 denylist，覆盖常见 token/credential/history/system 路径
- publish_files: local 模式默认 is_public=false，公开发布需显式指定
- publish_files: cwd 为 / 仍拒绝，trust_all_paths 仍受 denylist 保护
```

### 9.2 README / specs

必须同步的用户可见文档：

- `packages/mcp-server/README.md`
- `README.md`
- `CLAUDE.md`
- `docs/specs/spec-mcp-publish-files.md`
- `docs/specs/spec-mcp-local-remote-mode.md`

必须覆盖：

- local mode `publish_files` 何时读本地文件
- 默认允许 cwd + tmpdir，不允许 HOME
- 如何配置 `server.allowed_paths`
- 如何启用 `server.trust_all_paths` 及风险
- `publish_files` 默认 private
- 修改 config 后需要重启 service

---

## 10. 发布计划

1. 实现代码与测试
2. 更新文档 / CHANGELOG
3. `make test-mcp` 或 `cd packages/mcp-server && npm run test:unit`
4. `make bump-mcp-version NEW_MCP_VERSION=0.7.1`
5. commit：`feat(mcp): improve publish_files default path policy v0.7.1`
6. tag：`mcp-v0.7.1`
7. push main + tag
8. npm CI 自动发布（`NPM_TOKEN` 已配置）

不需要 bump 后端/前端版本；这是 MCP-only patch。

---

## 11. 不做的事

- ❌ 不默认允许 `$HOME`
- ❌ 不暴露 `add_allowed_path` MCP tool（权限仍由用户/运维配置）
- ❌ 不做 config 热加载（修改后仍需 service restart）
- ❌ 不支持 glob 形式的 `allowed_paths`（如 `/home/*/project`）
- ❌ 不改后端 API
- ❌ 不改变 remote mode 工具集

---

## 12. 风险评估

| 风险 | 等级 | 缓解 |
|---|---|---|
| 默认允许 `/tmp`，多用户机器有预置文件风险 | 中 | 文档警示 + 可选 owner 检查 |
| denylist 仍可能漏新型 secret 文件 | 中 | 不默认允许 HOME；常见 secrets 补齐；用户可显式收紧 |
| `trust_all_paths` 被误用 | 中 | help/README/启动 warning 标为危险；denylist 仍生效 |
| `is_public=false` 改变用户预期 | 低 | 仅 local `publish_files`；公开可显式传 true；CHANGELOG 明确 |
| 错误信息泄露 cwd/tmpdir | 低 | 可用性优先；只在已认证 MCP session 内返回 |
| 显式 `allowed_paths` 覆盖默认导致 `/tmp` 又被拒 | 低 | 这是可预期严格模式；错误信息提示当前模式 |

---

## 13. 实施检查清单

- [ ] 默认 allowlist = cwd + os.tmpdir，不含 HOME
- [ ] `server.trust_all_paths` config/env/CLI/help/list 全链路支持
- [ ] 敏感路径 denylist 扩展并始终优先生效
- [ ] `publish_files` 默认 `is_public=false`
- [ ] 错误信息 agent-friendly 且可操作
- [ ] 工具 description 明确：传文件 vs 传目录
- [ ] CLI help/list 文案同步
- [ ] README / specs / CHANGELOG 同步
- [ ] 单元 + 配置 + E2E 测试覆盖
- [ ] `allowed_paths` 显式配置行为与 v0.7.0 兼容
- [ ] remote mode 行为不变
