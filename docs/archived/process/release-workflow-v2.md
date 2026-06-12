# 改进后的发布流程

## 问题总结

之前的发布流程存在以下问题：

1. **静态文件需要二次提交** - `make build` 生成新的 Vite content-hash，但 `bump-version` 没有包含构建和提交
2. **版本提交分散** - 版本号、静态文件、CHANGELOG 分开提交，导致多个 commit
3. **容易遗漏 CHANGELOG** - bump 后需要手动编辑，容易忘记
4. **MCP Server 版本误同步** - bump-version 会影响 MCP Server 的 package.json（已修复）
5. **发布前无静态文件检查** - 如果忘记提交静态文件，wheel 会包含旧版本

## 改进方案

### 1. 改进的 `bump-version`

```bash
make bump-version NEW_VERSION=0.1.32
```

**新增功能：**
- ✅ Step 1: 更新版本号（__init__.py, pyproject.toml, package.json）
- ✅ Step 2: 验证版本一致性
- ✅ Step 3: 自动同步文档版本
- ✅ Step 4: 构建前端（生成新的 content-hash）
- ✅ Step 5: 提交版本和静态文件（一个 commit）
- ✅ Step 6: 创建 git tag

**输出示例：**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ Step 1/6: 更新版本号到 0.1.32...
→ Step 2/6: 验证版本一致性...
  ✓ 版本文件已更新: v0.1.32
→ Step 3/6: 自动同步文档版本引用...
→ Step 4/6: 构建前端并更新静态文件...
  ✓ 前端构建成功
→ Step 5/6: 提交版本和静态文件...
  ✓ 已提交版本和静态文件
→ Step 6/6: 创建 tag v0.1.32...
  ✓ 已创建 tag

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ bump-version 完成: v0.1.32

⚠️  重要：还需手动完成以下步骤：

  1. 编辑 CHANGELOG.md，填写 [0.1.32] 具体变更内容
     (参考: git log v0.1.31..HEAD --oneline)

  2. 更新 CHANGELOG 后执行：
     git add CHANGELOG.md && git commit --amend --no-edit

  3. 运行测试并发布：
     make pre-publish-quick  # 快速检查
     make publish            # 发布到 PyPI

  4. 推送到远程：
     git push && git push origin v0.1.32
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 2. 改进的 `publish`

```bash
make publish
```

**新增检查：**
- ✅ Step 1: 检查未提交的静态文件（防止遗漏）
- ✅ Step 2: 检查 wheel 是否存在
- ✅ Step 3: 运行最终检查（版本、CHANGELOG、wheel）
- ✅ Step 4: 发布到 PyPI

**错误示例：**
```
→ Step 1/4: 检查是否有未提交的静态文件...

✗ 错误: 发现未提交的静态文件

可能原因:
  - bump-version 后没有提交 CHANGELOG
  - 手动修改了静态文件

解决方案:
  1. 如果是修改 CHANGELOG 后: git add -A && git commit --amend --no-edit
  2. 如果是意外修改: git checkout backend/peekview/static/
```

### 3. 新增 `release`（一键发布）

```bash
make release NEW_VERSION=0.1.32
```

**完整流程：**
```
🚀 PeekView 一键发布流程

此命令将执行：
  1. bump-version (版本号 + 构建 + 提交 + tag)
  2. 等待你编辑 CHANGELOG
  3. pre-publish-quick (快速验证)
  4. publish (发布到 PyPI)
  5. push (推送到 GitHub)

确定要继续? [y/N]
```

## 新旧流程对比

### 旧流程（容易出错）

```bash
# 1. Bump 版本（只改版本号，不构建）
make bump-version NEW_VERSION=0.1.32

# 2. 手动编辑 CHANGELOG（容易忘记）
# ...

# 3. 手动构建（生成新静态文件）
make build

# 4. 发现静态文件变了，再提交一次
# （此时已经有 2-3 个 commit）

# 5. 手动打 tag
git tag v0.1.32

# 6. 发布
make publish

# 7. 推送
git push && git push origin v0.1.32
```

### 新流程（一键完成）

**方式一：分步执行（推荐）**

```bash
# 1. Bump 版本（自动构建并提交静态文件）
make bump-version NEW_VERSION=0.1.32

# 2. 编辑 CHANGELOG（按提示操作）
vim CHANGELOG.md
git add CHANGELOG.md && git commit --amend --no-edit

# 3. 验证并发布
make pre-publish-quick
make publish

# 4. 推送
git push && git push origin v0.1.32
```

**方式二：一键发布**

```bash
make release NEW_VERSION=0.1.32
```

## 关键改进点

| 问题 | 旧流程 | 新流程 |
|------|--------|--------|
| 静态文件提交 | 手动，容易遗漏 | bump-version 自动包含 |
| commit 数量 | 2-3 个（版本、静态文件、CHANGELOG） | 1 个（版本+静态文件），CHANGELOG amend |
| 遗漏 CHANGELOG | 常见 | bump-version 输出明确提示 |
| 静态文件检查 | publish 前无检查 | publish 前检查，防止遗漏 |
| 一键发布 | 不支持 | `make release` 支持 |

## 注意事项

1. **MCP Server 版本独立** - 使用 `make bump-mcp-version NEW_MCP_VERSION=x.y.z`
2. **CHANGELOG 必须手动编辑** - bump-version 无法自动生成变更内容
3. **PYPI_API_TOKEN 必须设置** - `export PYPI_API_TOKEN=pypi-...`
