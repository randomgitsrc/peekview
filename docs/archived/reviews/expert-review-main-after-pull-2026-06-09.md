# main 分支 pull 后专项评审

> 评审日期：2026-06-09
> 评审对象：main 分支最新状态（HEAD: `e92443ff feat(mcp): implement dual-mode v0.7.0 (local/remote tool sets)`）
> 评审范围：配置一致性、版本/tag、文档同步、MCP dual-mode v0.7.0 实现、测试隔离
> 评审方式：pull main 后核查 git 状态、版本文件、CHANGELOG、CLAUDE.md、README.md、MCP Server 代码与测试

---

## 评审结论

main 分支已合入 MCP dual-mode v0.7.0 的核心实现，整体方向正确，`publish_files` 的安全模型和工具注册策略基本符合设计。但当前状态仍存在多个发布阻塞项：

1. MCP Server 实际实现已到 v0.7.0，但 `packages/mcp-server/package.json` 仍为 `0.1.41`。
2. `CLAUDE.md` 仍声明 MCP Server v0.6.0，与代码状态不一致。
3. `CHANGELOG.md` 的 `[0.1.41]` 条目为空，且没有记录 MCP v0.7.0。
4. git tag `v0.1.41` 和 `mcp-v0.7.0` 均缺失。
5. 本地仍有未提交的 MCP 测试隔离和 `publish_files` 修复，发布前必须合并。
6. `CLAUDE.md` / `README.md` 的环境变量默认值和实际 `config.py` 不一致，尤其 `PEEKVIEW_SERVER__HOST`。

结论：**不建议发布 PyPI 或 npm。必须先完成版本、CHANGELOG、文档、tag、测试隔离修复。**

---

## 一、版本号与 tag 状态

| 项 | 当前值 | 状态 | 评审意见 |
|----|--------|------|----------|
| `backend/peekview/__init__.py` | `0.1.41` | 通过 | 与 backend pyproject 一致 |
| `backend/pyproject.toml` | `0.1.41` | 通过 | 与 backend `__init__` 一致 |
| `frontend-v3/package.json` | `0.1.41` | 通过 | 与 backend/frontend release 一致 |
| `packages/mcp-server/package.json` | `0.1.41` | 失败 | dual-mode 实现提交声称 v0.7.0，但 package 版本未更新 |
| `CLAUDE.md` MCP 版本 | `v0.6.0` | 失败 | main 已实现 v0.7.0，文档未同步 |
| release tag | 最新 `v0.1.40` | 失败 | 缺 `v0.1.41` tag |
| MCP tag | 最新 `mcp-v0.5.3` | 失败 | 缺 `mcp-v0.7.0` tag |

### 发布风险

- PyPI 发布前没有 `v0.1.41` tag，违反发布流程。
- npm 发布时 `package.json` 仍为 `0.1.41`，会导致 npm 版本、tag、文档三方不一致。
- `CLAUDE.md` 声明 v0.6.0，但 main 已合入 v0.7.0，会误导后续维护者。

---

## 二、文档一致性问题

### 1. CHANGELOG 未同步

`CHANGELOG.md` 中 `[0.1.41]` 条目存在，但内容为空：

```markdown
## [0.1.41] - 2026-05-24

### 新增

-

### 修复

-

### 变更

-
```

这与 main 分支实际提交不一致。v0.1.41 后至少已有以下用户可感知或维护者可感知变更：

- `fix(entry): fix path/filename handling in file upload`
- `feat(mcp): add file extension suggestions to create_entry`
- `fix(mcp): fix test environment isolation`
- `feat(mcp): implement dual-mode v0.7.0 (local/remote tool sets)`
- MCP dual-mode 设计、计划、评审文档更新

### 建议

- 补全 `[0.1.41]` 的实际内容。
- 新增 `[mcp-v0.7.0]` 条目，记录 dual-mode / `publish_files` / local remote 工具集拆分。
- 修复重复 `mcp-v0.3.9` 条目。

---

### 2. CLAUDE.md 环境变量表与 config.py 不一致

`CLAUDE.md` 中写：

```markdown
| `PEEKVIEW_SERVER__HOST` | `127.0.0.1` | Server bind address |
```

但实际 `backend/peekview/config.py:133` 默认值为：

```python
host: str = Field(default="0.0.0.0")
```

这是 v0.1.39 的 breaking change，文档未同步。

### 仍缺失的环境变量

CLAUDE.md 只列出 15 个 `PEEKVIEW_*` 变量，而 `config.py` 中实际暴露约 33 个配置项。缺失项包括：

- `PEEKVIEW_SERVER__BASE_URL`
- `PEEKVIEW_SERVER__CORS_ORIGINS`
- `PEEKVIEW_SERVER__RATE_LIMIT_ENABLED`
- `PEEKVIEW_SERVER__RATE_LIMIT_PER_MINUTE`
- `PEEKVIEW_SERVER__RATE_LIMIT_LOGIN_PER_MINUTE`
- `PEEKVIEW_STORAGE__HEALTH_DISK_WARNING_MB`
- `PEEKVIEW_STORAGE__IGNORED_DIRS`
- `PEEKVIEW_AUTH__ALLOW_ANONYMOUS_CREATE`
- `PEEKVIEW_LIMITS__MAX_CONTENT_LENGTH`
- `PEEKVIEW_LIMITS__MAX_ENTRY_SIZE`
- `PEEKVIEW_LIMITS__MAX_SLUG_LENGTH`
- `PEEKVIEW_LIMITS__MAX_SUMMARY_LENGTH`
- `PEEKVIEW_LIMITS__MAX_PER_PAGE`
- `PEEKVIEW_CLEANUP__CHECK_ON_START`
- `PEEKVIEW_CLEANUP__INTERVAL_SECONDS`
- `PEEKVIEW_LOGGING__LEVEL`
- `PEEKVIEW_LOGGING__LOG_FILE`
- `PEEKVIEW_REMOTE__URL`
- `PEEKVIEW_REMOTE__API_KEY`
- `PEEKVIEW_REMOTE__TOKEN`
- `PEEKVIEW_REMOTE__TIMEOUT`
- `PEEKVIEW_REMOTE__VERIFY_SSL`

### 建议

- 将 CLAUDE.md 的环境变量表改为完整表。
- 修正 README.md 中 `PEEKVIEW_SERVER__HOST` 默认值。
- 后续新增配置项时强制同步 CLAUDE.md / README.md。

---

## 三、MCP dual-mode v0.7.0 实现评审

### 核查通过项

| 项 | 结论 |
|----|------|
| `ServerConfig` 新增 `mode` / `allowedPaths` | 通过 |
| `mergeConfig` 支持 `MCP_MODE` / `MCP_ALLOWED_PATHS` | 通过 |
| `createTools(client, config)` 按 mode 返回不同工具集 | 通过 |
| remote 模式不暴露 `publish_files` | 通过 |
| local 模式不暴露 `create_entry` | 通过 |
| `publish_files` 支持绝对路径、目录递归、include/exclude | 通过 |
| 敏感路径黑名单 | 通过 |
| allowed_paths 边界检查 | 通过 |
| 目录扫描防符号链接环 | 通过 |
| 不传 language，交由后端 detect_language | 通过 |

---

### 问题 1（严重）：目录扫描 relPath 基准不符合预期

位置：`packages/mcp-server/src/tools/publishFiles.ts:231-235`

当前 main 逻辑：

```ts
if (stat.isDirectory()) {
  // base 用该目录的父目录，relPath 才能含目录名
  visited.add(realPath);
  const baseForRel = path.dirname(realPath);
  const files = await scanDirectory(...);
}
```

问题：扫描目录时使用 `path.dirname(realPath)` 作为相对路径基准，会把被扫描目录本身也带进后端 `path`。例如：

- 输入目录：`/project/src`
- 文件：`/project/src/main.py`
- 当前生成：`src/main.py`
- 预期生成：`main.py`

如果用户明确 publish `/project/src/`，entry 内文件路径应相对该目录，而不是相对其父目录。

### 建议修复

```ts
const baseForRel = realPath;
```

本地工作区已有对应修复，但尚未提交。

---

### 问题 2（严重）：测试隔离修复尚未完整进入 main

当前 main 的测试隔离仍有风险：部分 config 测试会读写用户真实 `~/.peekview/mcp-config.yaml`。

本地工作区已有修复，涉及：

- `packages/mcp-server/src/config/file.ts`
- `packages/mcp-server/tests/cli-config.test.ts`
- `packages/mcp-server/tests/config-file.test.ts`
- `packages/mcp-server/tests/config.test.ts`
- `packages/mcp-server/tests/health.test.ts`
- `packages/mcp-server/tests/setup.ts`
- `packages/mcp-server/tests/teardown.ts`
- `packages/mcp-server/vitest.config.ts`

核心方向正确：

- 使用 temp HOME，避免触碰真实 `~/.peekview`。
- 不再 rename 用户真实配置文件。
- health 真实服务测试改成 opt-in。
- config 测试显式隔离 `process.env`。

### 风险

如果不合并这些修复，CI 或开发者本地运行 MCP 测试时可能污染真实配置文件。

---

### 问题 3（中等）：cwd fallback 在 systemd 场景下仍有安全风险

位置：`packages/mcp-server/src/config/merge.ts:71-79` 与 `publishFiles.ts:196-199`

当前策略：local 模式未配置 `allowed_paths` 时不拒绝启动，仅 warning，并 fallback 到 `process.cwd()`。

风险：

- systemd/launchd 服务的 cwd 可能是 `/`。
- 如果 cwd 是 `/`，fallback 等价于允许读取整个文件系统，只靠敏感黑名单兜底。

### 建议

- local 模式下如果 `allowed_paths` 为空，系统服务模式应拒绝启动。
- 或至少禁止 cwd 为 `/` 时启用 fallback。
- warning 不足以覆盖生产部署风险。

---

### 问题 4（中等）：Vitest HOME 隔离目录命名仍可能冲突

位置：`packages/mcp-server/tests/setup.ts` 与 `tests/teardown.ts`

本地修复使用：

```ts
const workerId = process.env.VITEST_WORKER_ID ?? '0';
const testHome = join(tmpdir(), `peekview-mcp-test-home-${workerId}`);
```

但 `fileParallelism: false` 后，`VITEST_WORKER_ID` 可能始终不存在，所有测试文件共享 `peekview-mcp-test-home-0`。

### 建议

使用 `mkdtempSync(join(tmpdir(), 'peekview-mcp-test-home-'))` 生成唯一 HOME，并通过环境变量传递给 teardown，或在每个测试文件内自行创建和清理。

---

### 问题 5（轻微）：publish_files 输出和描述含图标字符

位置：`packages/mcp-server/src/tools/publishFiles.ts`

输出中包含：

- `⚠️`
- `✓`
- `✗`
- `🔗`

项目交互规范要求除非用户请求，不主动使用 emoji。虽然这是工具返回文本，不是 CLI 助手输出，但建议统一去掉 emoji，改为纯文本标记。

---

## 四、测试结果

### 已运行命令

```bash
cd packages/mcp-server && npm run test:unit
```

结果：

- 3 个测试文件通过
- 38 个测试通过

```bash
cd packages/mcp-server && npm test
```

结果：

- 12 个测试文件通过
- 1 个测试文件跳过
- 2 个测试 suite 失败
- 143 tests passed
- 6 skipped
- 失败：
  - `tests/integration/mcp-integration.test.ts`
  - `tests/e2e/mcp-e2e.test.ts`

失败原因：

```text
Error: Hook timed out in 10000ms.
```

### 评审意见

`npm test` 当前包含 integration/e2e 测试，但这些测试依赖真实后端或更长初始化时间。作为 MCP 单元测试命令不稳定，建议：

- `npm test` 仅运行纯单元测试，排除 integration/e2e。
- `npm run test:integration` 和 `npm run test:e2e` 分离，并在 Makefile 中明确依赖后端服务。
- `make test-mcp` 当前直接调用 `npm test`，会触发上述超时，不适合作为普通本地检查。

---

## 五、发布前待办

### 阻塞发布

- [ ] 修正 `publishFiles.ts` 目录扫描 `baseForRel`。
- [ ] 合并 MCP 测试隔离修复，确保测试不触碰真实 `~/.peekview`。
- [ ] 将 `packages/mcp-server/package.json` 版本更新为 `0.7.0`。
- [ ] 补全 `CHANGELOG.md` 的 `[0.1.41]` 内容。
- [ ] 新增 `CHANGELOG.md` 的 `[mcp-v0.7.0]` 条目。
- [ ] 更新 `CLAUDE.md` 中 MCP 版本为 v0.7.0。
- [ ] 修正 `CLAUDE.md` / `README.md` 中 `PEEKVIEW_SERVER__HOST` 默认值为 `0.0.0.0`。
- [ ] 创建 `v0.1.41` tag。
- [ ] 创建 `mcp-v0.7.0` tag。

### 建议发布前完成

- [ ] 补全 CLAUDE.md 环境变量表。
- [ ] 将 `npm test` 改为纯单元测试命令，integration/e2e 分离。
- [ ] local 模式下 cwd 为 `/` 时拒绝 fallback。
- [ ] 修复 Vitest HOME 隔离目录潜在冲突。
- [ ] 去除 `publish_files` 输出中的 emoji。

---

## 六、最终建议

当前 main 分支功能实现已经接近可发布，但配置与文档状态明显滞后。建议下一步优先执行：

1. 先提交本地 MCP 修复。
2. 再做一次配置/文档同步提交。
3. 最后做 release commit/tag。

在完成上述事项前，不应执行：

- `make publish`
- `make publish-npm`
- `git push origin v0.1.41`
- `git push origin mcp-v0.7.0`

---

## 七、修正进展（2026-06-09 补充）

本评审提出的问题已按以下状态处理：

| 项 | 状态 | 说明 |
|----|------|------|
| `publishFiles.ts` 目录扫描 `baseForRel` | 已修正 | 目录扫描使用目录自身作为相对路径基准，E2E 验证得到 `README.md`, `src/main.py`, `src/utils/helper.py` |
| MCP 测试隔离 | 已修正 | 测试使用临时 HOME，不再 rename/触碰真实 `~/.peekview/mcp-config.yaml` |
| MCP package 版本 | 已修正 | `package.json` / `package-lock.json` 更新为 `0.7.0` |
| CHANGELOG | 已修正 | 补充 `[0.1.41]` 与 `[mcp-v0.7.0]` 条目，合并重复 `mcp-v0.3.9` |
| CLAUDE.md MCP 版本 | 已修正 | 更新为 MCP Server v0.7.0，并补充双模式架构说明 |
| HOST 默认值文档 | 已修正 | README / CLAUDE.md / backend README / DEPLOYMENT 同步为 `0.0.0.0` |
| `npm test` 语义 | 已修正 | 改为纯单元测试，integration/e2e 分离 |
| cwd 为 `/` 的 fallback 风险 | 已修正 | `publish_files` 在未配置 allowed_paths 且 cwd 为 `/` 时拒绝使用 |
| Vitest HOME 隔离目录冲突 | 已修正 | 使用 `mkdtempSync` 生成唯一临时 HOME；teardown 清理 `/tmp/peekview-mcp-test-home-*` |
| publish_files 输出 emoji | 已修正 | 输出改为 `OK:`, `ERROR:`, `Skipped`, `Link:` |

验证结果：

```bash
cd packages/mcp-server && npm run build && npm test
# 145 passed

RUN_PUBLISH_FILES_E2E=1 \
PEEKVIEW_URL=http://127.0.0.1:8888 \
PEEKVIEW_PUBLIC_URL=http://127.0.0.1:8888 \
npx vitest run tests/e2e/publish-files-local-mode.test.ts --reporter=verbose
# 1 passed
```

仍未执行的发布动作：

- 未创建 `v0.1.41` tag
- 未创建 `mcp-v0.7.0` tag
- 未执行 `make publish`
- 未执行 `make publish-npm`
