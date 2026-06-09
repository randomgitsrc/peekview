# MCP publish_files 默认白名单优化（v0.7.1）

**状态**: 待评审
**作者**: kity
**日期**: 2026-06-09
**目标版本**: MCP Server v0.7.1（patch bump）

---

## 1. 背景

v0.7.0 的 `publish_files` 路径白名单默认 fallback 到 **cwd 单一目录**。这导致：

- 想发 `/tmp/foo.md` → 拒绝（`/tmp` 不在 cwd 下）
- 想发 `~/notes.md` → 拒绝（`~` 不在 cwd 下）
- 想发 `/b-dir/x.py` → 拒绝

用户必须**手动**编辑 `~/.peekview/mcp-config.yaml` 加 `server.allowed_paths`，再 `peekview-mcp service restart`。这让本地模式的便捷性大幅下降，**事实上不可用**——这与"local 模式给本机 agent 用"的定位冲突。

但同时 v0.7.0 之所以加白名单，是防止 agent 失控读取系统敏感文件（`/etc/shadow`、`~/.ssh/id_rsa` 等）。所以**不能**直接放成"无限制"，需要找一个"日常方便 + 默认安全"的平衡。

---

## 2. 目标

- ✅ 默认行为：用户**零配置**即可发 `cwd` / `$HOME` / `/tmp` 下的文件
- ✅ 仍能拒绝 `~/.ssh/`、`~/.gnupg/`、`~/.aws/`、`.pem/.key` 等敏感路径
- ✅ 提供一个 opt-in 配置 `server.trust_all_paths: true`，完全信任（关闭白名单）
- ✅ 完全向后兼容：v0.7.0 的 `server.allowed_paths` 行为不变
- ✅ 不破坏 v0.7.0 的安全模型

---

## 3. 设计

### 3.1 路径白名单解析顺序

```
1. 配置了 server.allowed_paths
   → 严格使用此白名单（v0.7.0 行为，完全向后兼容）

2. 未配置 server.allowed_paths
   → 计算 "safe default" 白名单：
     a. process.cwd()（必须是真实目录，不能是 /）
     b. os.homedir()（$HOME）
     c. /tmp（POSIX 标准临时目录）
     d. 去重 + path.resolve 规范化

3. 配置了 server.trust_all_paths: true
   → 跳过白名单检查（但仍走 SENSITIVE_PATTERNS 黑名单）
   → 注意：cwd 仍必须是真实目录，不能为 /

4. cwd 为 / 仍然拒绝整个请求
   → 防全盘读取的兜底（v0.7.0 行为保留）
```

### 3.2 黑名单不动

`SENSITIVE_PATTERNS` 黑名单保持 v0.7.0 不变：

- `/\/.ssh\//`
- `/\/.gnupg\//`
- `/\/.aws\//`
- `/\/.config\/gcloud\//`
- `\.pem$`, `\.key$`, `\.p12$`, `\.pfx$`

**任何情况下**（包括 `trust_all_paths: true`）都生效。这是兜底防线。

### 3.3 错误信息改进

当前（v0.7.0）：
```
ERROR: 发布被拒绝：路径 /tmp/mcp-intro.md 命中敏感文件黑名单或超出允许范围。
出于安全考虑，整个请求已取消。
```

agent 看到这条**分不清**是"黑名单命中"还是"白名单没包含"。改后：

```
ERROR: 发布被拒绝：路径 /tmp/mcp-intro.md 超出允许范围。
当前允许的基准目录：
  - /home/kity/cclab/test-01 (cwd)
  - /home/kity (HOME)
  - /tmp

如需访问其他目录，请：
  1) 在 ~/.peekview/mcp-config.yaml 配置 server.allowed_paths（重启生效）
  2) 或临时把文件复制到上述任一目录
  3) 或设置 server.trust_all_paths: true（关闭白名单，仅推荐本机自用）

出于安全考虑，整个请求已取消。
```

让 agent / 用户**能理解**拒绝原因，并知道**怎么**修复。

### 3.4 `publish_files` description 改进

当前 description 没明确"传文件 vs 传目录"，导致 agent 用错（直接把 cwd 整个扫了一遍发出去）。

改为：

```
Publish local files or directories to PeekView. MCP Server reads files directly.

WHEN TO USE:
  - To publish a SINGLE file: pass its absolute path
      { paths: ["/abs/path/to/fix.py"] }
  - To publish a WHOLE directory: pass the dir path (rarely needed)
      { paths: ["/abs/path/to/src/"] }
  - For Agent-generated content: write it to a file FIRST, then pass that file's path
      1) use write_file to save content to e.g. ./mcp-intro.md
      2) call publish_files with paths: ["<cwd>/mcp-intro.md"]

PATH RULES:
  - Paths must be ABSOLUTE
  - Paths must be under one of:
      • process.cwd() | $HOME | /tmp  (default, v0.7.1+)
      • server.allowed_paths entries   (if configured)
      • any path                       (if server.trust_all_paths: true)
  - ~/.ssh/, ~/.gnupg/, ~/.aws/, *.pem/*.key are ALWAYS blocked

EXAMPLES:
  - File in project:  { summary: "Fix", paths: ["<cwd>/fix.py"] }
  - File in HOME:     { summary: "Note", paths: ["~/notes/todo.md"] }
  - File in /tmp:     { summary: "Demo", paths: ["/tmp/demo.py"] }
  - Only .md files:   { paths: ["<cwd>/docs/"], include_patterns: ["*.md"] }

Skipped automatically: .git, node_modules, __pycache__, .venv, dist, build
```

---

## 4. 配置示例

### 4.1 零配置（v0.7.1+ 默认行为）

```yaml
# ~/.peekview/mcp-config.yaml
peekview:
  url: http://127.0.0.1:13001
  public_url: https://peek.gsis.top
server:
  port: 13003
  mode: local
  # 无需 allowed_paths，默认允许 cwd + $HOME + /tmp
```

### 4.2 严格白名单（v0.7.0 行为，保留）

```yaml
peekview:
  url: http://127.0.0.1:13001
server:
  port: 13003
  mode: local
  allowed_paths:
    - /home/kity/cclab
    - /tmp
```

### 4.3 完全信任（本机自用，最方便）

```yaml
peekview:
  url: http://127.0.0.1:13001
server:
  port: 13003
  mode: local
  trust_all_paths: true   # 跳过白名单（黑名单仍生效）
```

### 4.4 环境变量形式

```bash
# env 形式（MCP_ALLOWED_PATHS 用 : 分隔）
MCP_ALLOWED_PATHS=/home/kity/cclab:/tmp peekview-mcp serve
# 或
MCP_TRUST_ALL_PATHS=true peekview-mcp serve
```

---

## 5. 实现细节

### 5.1 配置 schema 改动

`packages/mcp-server/src/config.ts` & `config/merge.ts`：

```typescript
// config.ts
export interface ServerConfig {
  // ... 现有字段
  allowedPaths: string[];     // 现有
  trustAllPaths: boolean;     // 新增
}

// config/merge.ts
export function mergeConfig(...) {
  // ... 现有
  const trustAllPaths = env.MCP_TRUST_ALL_PATHS === 'true' 
    || fileConfig.server?.trust_all_paths === true;

  return {
    // ...
    allowedPaths,
    trustAllPaths,
  };
}
```

### 5.2 路径解析逻辑

`packages/mcp-server/src/tools/publishFiles.ts` 改动 198-208 行：

```typescript
// 旧逻辑（v0.7.0）
if (config.allowedPaths.length === 0 && path.resolve(process.cwd()) === path.parse(process.cwd()).root) {
  return { content: [{ type: 'text', text: 'ERROR: ...' }] };
}
const allowedBases = config.allowedPaths.length > 0
  ? config.allowedPaths.map((p) => path.resolve(p))
  : [process.cwd()];

// 新逻辑（v0.7.1）
const cwd = process.cwd();
if (path.resolve(cwd) === path.parse(cwd).root) {
  // cwd 在根目录 → 仍然拒绝（防全盘）
  return { content: [{ type: 'text', text: 'ERROR: ...' }] };
}

let allowedBases: string[];
let allowedDescription: string;

if (config.trustAllPaths) {
  // 完全信任：allowedBases 空数组 → isWithinAllowed 总返回 true
  allowedBases = [];
  allowedDescription = '(trust_all_paths: any path allowed)';
} else if (config.allowedPaths.length > 0) {
  allowedBases = config.allowedPaths.map((p) => path.resolve(p));
  allowedDescription = allowedBases.join(', ');
} else {
  // v0.7.1 新增：默认白名单
  const home = os.homedir();
  allowedBases = Array.from(new Set([cwd, home, '/tmp'].map(p => path.resolve(p))));
  allowedDescription = `${cwd} (cwd), ${home} (HOME), /tmp`;
}
```

### 5.3 `isWithinAllowed` 改动

当 `allowedBases.length === 0`（trust_all_paths）时，**直接 return true**：

```typescript
function isWithinAllowed(absPath: string, allowedBases: string[]): boolean {
  if (allowedBases.length === 0) {
    return true;  // trust_all_paths 模式
  }
  return allowedBases.some((base) => {
    const resolvedBase = path.resolve(base);
    return absPath === resolvedBase || absPath.startsWith(resolvedBase + path.sep);
  });
}
```

### 5.4 错误信息携带 allowedDescription

`SecurityRejection` 抛出时带上 `allowedDescription`，handler 渲染：

```typescript
class SecurityRejection extends Error {
  constructor(
    public readonly path: string,
    public readonly reason: 'sensitive' | 'out_of_scope',
    public readonly allowedDescription: string,
  ) {
    super(path);
  }
}

// 抛出时
if (isSensitive(realChild)) {
  throw new SecurityRejection(realChild, 'sensitive', allowedDescription);
}
if (!isWithinAllowed(realChild, allowedBases)) {
  throw new SecurityRejection(realChild, 'out_of_scope', allowedDescription);
}

// handler 渲染时
if (e.reason === 'sensitive') {
  text = `ERROR: 发布被拒绝：路径 ${e.path} 命中敏感文件黑名单。\n出于安全考虑，整个请求已取消。`;
} else {
  text = `ERROR: 发布被拒绝：路径 ${e.path} 超出允许范围。\n当前允许的基准目录：\n  - ${e.allowedDescription}\n\n如需访问其他目录，请...`;
}
```

---

## 6. 测试计划

### 6.1 单元测试

`packages/mcp-server/tests/publishFiles.test.ts` 新增：

- [ ] 零配置 + cwd 下文件 → ✅ 允许
- [ ] 零配置 + `~/foo.md` → ✅ 允许
- [ ] 零配置 + `/tmp/foo.md` → ✅ 允许
- [ ] 零配置 + `/b-dir/foo.md` → ❌ 拒绝 + 清晰错误信息
- [ ] 零配置 + `~/.ssh/id_rsa` → ❌ 黑名单（即使在 HOME）
- [ ] 零配置 + `~/.ssh/../etc/shadow` → ❌ 黑名单（realpath 后命中）
- [ ] 零配置 + cwd 为 `/` → ❌ 拒绝（兜底）
- [ ] `allowed_paths: [/a]` + `/a/x` → ✅；`/b/x` → ❌（v0.7.0 兼容）
- [ ] `trust_all_paths: true` + `/etc/foo` → ✅（但 `/etc/shadow` → ❌ 黑名单）
- [ ] `trust_all_paths: true` + `~/.ssh/id_rsa` → ❌ 黑名单
- [ ] 错误信息包含 `allowedDescription`，agent 能 parse 出当前白名单

### 6.2 集成测试

`packages/mcp-server/tests/integration/publish-files.test.ts`（已存在，需扩展）：

- [ ] 默认配置下完整发布 `~/test.md`
- [ ] 默认配置下完整发布 `/tmp/test.md`
- [ ] 默认配置下完整发布 cwd 下文件
- [ ] `trust_all_paths: true` 下发布 `/etc/issue`（应成功，但需要检查是不是黑名单）
- [ ] 配置文件热重载：新加 `allowed_paths` 后下次调用生效（这条**不**做——config 不热加载，v0.7.0 也不做）

### 6.3 E2E（opt-in）

`packages/mcp-server/tests/e2e/publish-files-local-mode.test.ts` 已存在，新增：

- [ ] 默认配置下从 `/tmp` 发布
- [ ] `trust_all_paths: true` 下从任意路径发布
- [ ] 错误信息回传给 Claude Code / MCP client 时能展示

### 6.4 回归测试

- [ ] 现有 v0.7.0 测试全部通过
- [ ] `allowed_paths` 显式配置时行为完全等同于 v0.7.0
- [ ] 远程模式（remote）行为不变
- [ ] `get_entry` / `list_entries` / `delete_entry` 不受影响

---

## 7. 文档改动

### 7.1 CHANGELOG.md

```markdown
## [mcp-v0.7.1] - 2026-06-XX

### 改进
- publish_files: 默认白名单扩展为 cwd + $HOME + /tmp（无需配置）
- publish_files: 新增 server.trust_all_paths 选项，可关闭白名单
- publish_files: 错误信息明确区分"黑名单命中"和"超出白名单"，并列出当前白名单
- publish_files: 工具描述强化"传文件 vs 传目录"语义，引导 agent 正确使用

### 安全
- 敏感文件黑名单（.ssh/.gnupg/.aws/.config/gcloud/*.pem 等）保持不变
- cwd 为 / 仍然拒绝整个请求
- trust_all_paths 不影响黑名单
```

### 7.2 docs/specs/spec-mcp-publish-files.md

- 替换 "默认行为" 章节
- 新增 `trust_all_paths` 配置说明
- 更新错误信息示例

### 7.3 docs/specs/spec-mcp-local-remote-mode.md

- 同步 v0.7.1 行为

### 7.4 README.md / backend/README.md

- Quick start 中"零配置"流程说明

---

## 8. 发布计划

1. **代码改动**：~80 行（publishFiles.ts + config/merge.ts + config.ts）
2. **测试**：~150 行新测试
3. **文档**：3 份同步
4. **版本 bump**：MCP Server `0.7.0` → `0.7.1`（patch）
5. **不需要** bump Backend 版本（纯 MCP 端改动）
6. **CI 发布**：重打 `mcp-v0.7.1` tag，CI 会自动跑 + 发 npm
7. **向后兼容**：v0.7.0 用户升级后行为更宽松，**不破坏**任何现有调用

---

## 9. 不做的事

- ❌ 不支持 `allowed_paths` 的 glob 模式（如 `~/projects/*`）—— YAGNI
- ❌ 不做 config 热加载—— v0.7.0 也没有，不在本次范围
- ❌ 不暴露 `add_allowed_path` MCP tool—— 安全考虑，白名单是运维管
- ❌ 不改后端 API—— 纯 MCP 端改动

---

## 10. 风险评估

| 风险 | 等级 | 缓解 |
|---|---|---|
| 默认白名单太宽，泄露 HOME 下的隐私 | 低 | 黑名单兜底（.ssh/.gnupg 等），用户可显式收紧 |
| agent 误读 HOME 范围，把 `~/.bash_history` 发出去 | 低 | bash_history 不在黑名单，但用户可配 `allowed_paths` 显式收紧 |
| 改 `isWithinAllowed` 引入 bypass | 低 | 单元测试 + 回归测试覆盖 |
| `trust_all_paths` 被误用 | 低 | 文档明确警告"仅推荐本机自用" |
| 向后兼容破坏 | 极低 | v0.7.0 行为（`allowed_paths` 显式配置）完全保留 |

---

## 11. 评审检查清单

- [ ] 方案覆盖三个场景（零配置 / 严格白名单 / 完全信任）
- [ ] 黑名单不变
- [ ] 错误信息 agent-friendly
- [ ] 工具描述引导 agent 用对
- [ ] 单元 + 集成 + E2E 测试齐
- [ ] 文档同步
- [ ] 版本号计划正确（0.7.1 patch）
- [ ] CI 发布链路可用（npm NPM_TOKEN 已设）
- [ ] 不破坏 v0.7.0 行为
