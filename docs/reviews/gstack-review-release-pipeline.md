# 发布流程与 npm 发布管道评审

> 评审框架：gstack review（Staff Engineer + /plan-eng-review 工程经理）
> 日期：2026-05-20
> 评审对象：
> - `.github/workflows/publish-npm.yml`
> - `docs/process/release.md`
> - `Makefile`（bump-version、publish-npm 相关）
> - `packages/mcp-server/package.json`

---

## 总体印象

发布流程文档详尽、Makefile 命令分层清晰、npm workflow 结构正确。问题集中在两个方向：版本管理策略存在设计矛盾，npm workflow 有几个会在生产中踩到的细节 bug。

---

## 问题清单

### 🔴 P0 — 会导致发布错误

#### P0-1 `workflow_dispatch` 的 `version` input 完全未被使用

**现状：**
```yaml
workflow_dispatch:
  inputs:
    version:
      description: "Version to publish (e.g. 0.2.0)"
      required: false
      type: string
```

`Verify version` 步骤里：
```bash
PKG_VERSION=$(node -p "require('./package.json').version")
echo "Publishing @peekview/mcp-server v${PKG_VERSION}"
```

`inputs.version` 从未被引用。手动触发 workflow 时填写的版本号被完全忽略，发布的永远是 `package.json` 里的版本。

**影响：** 操作者以为在发布自己填写的版本（例如紧急 hotfix 的 `0.2.1`），实际发布的是 `package.json` 里的旧版本。npm 发布成功，但版本号错误，且无法重传（npm 不允许覆盖已发布版本）。

**Fix：** 要么删除这个 input（避免误导），要么用它来校验 tag/package.json 版本一致性：
```yaml
- name: Verify version
  run: |
    cd packages/mcp-server
    PKG_VERSION=$(node -p "require('./package.json').version")
    echo "Publishing @peekview/mcp-server v${PKG_VERSION}"
    # 如果手动触发且填了 version，校验是否一致
    if [ -n "${{ inputs.version }}" ] && [ "${{ inputs.version }}" != "$PKG_VERSION" ]; then
      echo "ERROR: inputs.version (${{ inputs.version }}) != package.json version ($PKG_VERSION)"
      exit 1
    fi
```

---

#### P0-2 tag 触发时未校验 tag 版本与 `package.json` 版本一致

**现状：** workflow 由 `mcp-v*` tag 触发，但 `Verify version` 只打印 `package.json` 的版本，不校验 tag 和 package.json 是否匹配。

**场景：** 开发者修改了代码但忘记更新 `package.json`，然后打了 `mcp-v0.2.1` tag 并 push。workflow 触发，`package.json` 仍是 `0.2.0`，发布成功，npm 上 `0.2.1` 实际是 `0.2.0` 的内容。

**Fix：**
```yaml
- name: Verify version matches tag
  run: |
    cd packages/mcp-server
    PKG_VERSION=$(node -p "require('./package.json').version")
    # 从 tag 提取版本号（去掉 mcp-v 前缀）
    TAG_VERSION="${GITHUB_REF_NAME#mcp-v}"
    echo "Tag version: $TAG_VERSION"
    echo "package.json version: $PKG_VERSION"
    if [ "$TAG_VERSION" != "$PKG_VERSION" ]; then
      echo "ERROR: Tag version ($TAG_VERSION) != package.json version ($PKG_VERSION)"
      echo "Please update package.json version before tagging."
      exit 1
    fi
```

---

### 🟠 P1 — 设计问题，会在将来踩到

#### P1-1 `bump-version` 强制同步 Python/MCP 两个独立版本，会导致 MCP 版本回退

**现状：**
- Python backend：`0.1.29`
- MCP Server：`0.2.0`

两者版本已经分叉，这是正确的——MCP 和 Python 是独立组件，有各自的语义版本历史。

**问题：** `bump-version` 把所有组件强制同步到同一个 `NEW_VERSION`：
```makefile
sed -i "s/version .../NEW_VERSION/" packages/mcp-server/package.json
```

下次执行 `make bump-version NEW_VERSION=0.1.30`（Python backend 版本升级），MCP Server 会从 `0.2.0` 被覆盖为 `0.1.30`——版本回退，且这个已发布到 npm 的 `0.2.0` 永远消失了。

**Fix：** 两种方案选一：

**方案 A（推荐）**：`bump-version` 只更新 Python 组件，MCP 版本独立管理：
```makefile
bump-version:
    # 只更新 Python 组件
    sed -i "s/__version__..." backend/peekview/__init__.py
    sed -i "s/^version =..." backend/pyproject.toml
    sed -i "s/\"version\":..." frontend-v3/package.json
    # MCP Server 独立维护：
    @echo "⚠️  MCP Server 版本独立管理，如需更新请单独执行："
    @echo "    make bump-mcp-version NEW_MCP_VERSION=x.y.z"

bump-mcp-version:
    sed -i "s/\"version\":..." packages/mcp-server/package.json
```

**方案 B**：保持同步，但在 release.md 明确说明两者版本策略（不推荐，会丢失 MCP 的语义版本历史）。

---

#### P1-2 `publish-npm` 目标没有执行 `prepublishOnly`（双重构建）

**现状：**
```makefile
publish-npm:
    cd packages/mcp-server && npm publish --access public
```

`package.json` 里有：
```json
"prepublishOnly": "npm run build && npm run test:unit"
```

`npm publish` 会自动触发 `prepublishOnly`，所以 `make publish-npm` 实际会执行：build → test:unit → publish。

但 `make pre-publish-npm` 也执行了 `build-mcp`（`npm run build`）。

结果：调用 `make pre-publish-npm && make publish-npm` 时，build 执行了两次。开销小，但容易让人困惑（以为 `pre-publish-npm` 的构建产物就是发布的产物，实际 publish 时又重新构建了一次）。

**建议：** 在 Makefile 注释里明确说明 `npm publish` 会触发 `prepublishOnly`，或将 `pre-publish-npm` 改为只做验证不构建：
```makefile
pre-publish-npm: test-mcp-unit
    @# Note: npm publish automatically runs prepublishOnly (build + test)
    @echo "✓ MCP Server pre-publish checks passed"
```

---

#### P1-3 CI workflow 用 Node 20，但 `engines` 声明 `>=18`，实际兼容性未测试

**现状：**
```yaml
node-version: '20'
```

`package.json`：
```json
"engines": { "node": ">=18.0.0" }
```

用户按文档安装，可能在 Node 18.x 上运行，但 CI 只在 Node 20 测试。

Node 18 和 20 之间有几个 breaking change 影响 ESM（`package.json` 用 `"type": "module"`），以及 `fetch` API 的行为差异。

**建议：** 在 workflow 里加一个 Node 18 的兼容性测试 job：
```yaml
strategy:
  matrix:
    node-version: ['18', '20', '22']
```
或至少在 README 里说明"开发和测试在 Node 20，最低要求 Node 18 理论支持但未完整测试"。

---

### 🟡 P2 — 细节

#### P2-1 `release.md` 第 5.5 节里"发布后验证"有自相矛盾

第 5.5 节（升级并重启生产服务）写：

> **⚠️ CRITICAL: 这一步必须由用户手动执行，严禁自动化！**

但"发布后验证"章节（最后的步骤说明）第 4 步写：
```bash
# 4. 重启生产服务（必须！pipx upgrade 不会自动重启）
sudo systemctl restart peekview
```

这两处在内容上不矛盾（都是手动执行），但一个用警告框强调"严禁自动化"，另一个把 `sudo systemctl restart` 列为第 4 步骤，风格不统一，容易让读者困惑"这步能不能放进脚本"。

建议在"发布后验证"的重启步骤前加注：
```
# ⚠️ 必须手动执行（见第 5.5 节说明）
```

#### P2-2 `publish-npm-dry` 没有集成到 `pre-publish-npm` 中

当前 `pre-publish-npm` 只跑 build + unit test，没有 `--dry-run`。dry-run 才能发现包内容（`files` 字段）是否正确、是否会误发私有文件等问题。

**建议：**
```makefile
pre-publish-npm: build-mcp test-mcp-unit
    cd packages/mcp-server && npm publish --access public --dry-run
    @echo "✓ MCP Server pre-publish checks passed (including dry-run)"
```

#### P2-3 npm workflow 缺少 `concurrency` 控制，并发发布会失败

如果同时推送两个 `mcp-v*` tag（例如 hotfix 场景），两个 workflow 同时运行，都尝试发布同一个版本，第二个会因"版本已存在"而失败。

**建议：**
```yaml
concurrency:
  group: npm-publish
  cancel-in-progress: false  # 不取消，排队执行
```

---

## 总结

| 维度 | 评分 | 说明 |
|------|------|------|
| workflow 正确性 | 5/10 | P0-1/P0-2 两个版本校验缺失，可能发布错误版本 |
| 版本管理策略 | 5/10 | Python/MCP 版本已分叉但 bump-version 强制同步 |
| 发布文档完整性 | 8/10 | 详尽，覆盖了失败恢复场景 |
| 自动化质量 | 7/10 | Makefile 分层清晰，但有双重构建等小问题 |

**综合：6/10**

最优先的两件事：

1. **修 P0-1/P0-2**（workflow 版本校验）：加两个 `if` 判断，防止 tag 与 `package.json` 不一致时静默发布错误版本。这是发布流程里最危险的地方——npm 不允许覆盖已发布版本，发错了无法补救。

2. **决策 P1-1**（版本管理策略）：`bump-version` 目前会把 MCP 版本覆盖回 Python 版本。需要明确"Python 和 MCP 是否共用版本号"这个设计决策，并让 Makefile 执行该决策，而不是当前的隐式强制同步。

---

*评审完成：2026-05-20*
