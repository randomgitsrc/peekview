# MCP Server 版本号被覆盖问题评审

> 评审框架：gstack review（Staff Engineer + /investigate）
> 日期：2026-06-11
> 问题：MCP Server package.json 版本反复被主版本号覆盖（v0.8.2 → v0.1.45）

---

## 一、现象

| 来源 | MCP 版本 |
|------|----------|
| CHANGELOG.md 最新 mcp 条目 | mcp-v0.8.2 |
| commit 4a397d1e | 正确 bump 到 v0.8.2 |
| commit 1b6648a0（release v0.1.45）| **改回 v0.1.45** |
| packages/mcp-server/package.json 当前 | 0.1.45（错误）|

MCP Server 实际功能是 v0.8.2（Streamable HTTP），但 package.json 写 0.1.45，与主版本耦合。这会导致 npm 发布的包版本号错误，用户安装的 `@peekview/mcp-server@0.1.45` 实际是 v0.8.2 的代码。

---

## 二、根因定位

这是一个**两层修复只修了一层**的经典问题。

### 第一层（已修）：Makefile bump-version

`Makefile` 的 `bump-version`（187-223 行）只修改：
- `backend/peekview/__init__.py`
- `backend/pyproject.toml`
- `frontend-v3/package.json`

**不碰** `packages/mcp-server/package.json`。这一层是正确的，`release-workflow-v2.md` 也记录了"MCP Server 版本误同步（已修复）"。

### 第二层（未修，真正的根因）：doc-sync 脚本

`bump-version` 在末尾调用 `scripts/doc-sync/update_version_docs.py` 同步文档版本号。但这个脚本的同步目标列表（第 90-96 行）**包含了 `packages/mcp-server/package.json`**：

```python
{
    "file": "packages/mcp-server/package.json",
    "desc": "MCP Server package.json version",
    "patterns": [
        (r'"version": "\d+\.\d+\.\d+"', f'"version": "{version}"'),
    ],
},
```

**所以 Makefile 那层"修复"被 doc-sync 脚本绕过了**——脚本把 MCP package.json 的 version 也"同步"成了主版本号。这正是 commit 1b6648a0 把 v0.8.2 改回 0.1.45 的元凶。

---

## 三、修复方案

### 必须修：从 doc-sync 移除 MCP package.json 的 version 同步

`scripts/doc-sync/update_version_docs.py` 删除第 90-96 行的 `packages/mcp-server/package.json` 条目。

MCP Server 版本由 `bump-mcp-version` 独立管理，**任何主版本流程都不应触碰它**。

理由：
- MCP Server 是独立发布的 npm 包，有自己的版本生命周期（v0.8.x）
- 主版本（backend/frontend v0.1.x）和 MCP 版本语义完全不同
- doc-sync 的职责是"同步文档里引用的版本号"，但 MCP package.json 的 version 是**包自身的版本声明**，不是"文档引用"，不该被 doc-sync 管

### 注意：health 响应示例的 version 同步要保留

doc-sync 第 85-88 行同步的是 health 响应**示例**里的 version（文档示例），这个该保留——它是文档引用，不是包版本声明。只移除 packages/mcp-server/package.json 那一条。

### 需要修复当前已错的版本

`packages/mcp-server/package.json` 当前是 0.1.45，需要改回 0.8.2：
```bash
make bump-mcp-version NEW_MCP_VERSION=0.8.2
# 或手动改 package.json + package-lock.json
```

---

## 四、为什么之前评审没发现

之前评审发现了"bump-version 耦合 MCP 版本"，修复时只看了 Makefile，认为改完 Makefile 就好了，没有追踪 `bump-version` 调用链下游的 doc-sync 脚本。

**教训：修复"版本耦合"这类问题时，要追踪整个调用链，不能只看入口。** `bump-version` 是入口，但它调用的 doc-sync 脚本才是真正改文件的地方。修了入口没修下游，问题以另一种形式复发。

---

## 五、验证方法

修复后，跑一次完整 release 流程验证：
```bash
# 记录当前 MCP 版本
grep '"version"' packages/mcp-server/package.json

# 跑主版本 bump（不应改变 MCP 版本）
make bump-version NEW_VERSION=0.1.46

# 验证 MCP 版本没变
grep '"version"' packages/mcp-server/package.json  # 应该还是 0.8.2
```

如果 MCP 版本在主版本 bump 后保持不变，说明修复成功。

---

## 六、根因链总结

```
bump-version（Makefile，不碰 MCP）✅ 已修
    ↓ 调用
update_version_docs.py（doc-sync，同步 MCP package.json）❌ 漏网
    ↓ 把 MCP version 改成主版本号
packages/mcp-server/package.json: 0.8.2 → 0.1.45 ❌ 错误
```

**修复点：移除 doc-sync 脚本里 `packages/mcp-server/package.json` 的 version 同步条目。**

---

## 七、优先级

🔴 **高** — 影响 npm 发布的版本正确性。如果按当前状态发布，用户会装到版本号错误的包（声称 0.1.45，实际 v0.8.2 功能），破坏语义化版本，且与 CHANGELOG 的 mcp-v0.8.2 不一致，造成混乱。

应在下次 MCP 发布前修复。

---

*评审完成：2026-06-11*
