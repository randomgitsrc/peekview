# 发布流程

> 本文档定义 PeekView 的标准发布流程
> 
> **改进记录** (2026-05-06):
> - 新增 `make bump-version` 自动更新版本号
> - 新增 `make test-quick` 和 `pre-publish-quick` 快速检查
> - 新增 `make verify-local` 本地快速验证
> - 优化发布流程，减少重复构建

## 快速发布（一句话）

```bash
make publish && git tag -a v$(cd backend && python3 -c "from peekview import __version__; print(__version__)") -m "Release" && git push origin --tags
```

## 标准发布流程（推荐）

### 1. 自动更新版本号

```bash
# 一键更新所有版本文件
make bump-version NEW_VERSION=0.1.21

# 手动更新 CHANGELOG.md 和 INDEX.md
# 然后提交
```

### 2. 本地快速验证

```bash
# 快速构建 + 测试（不 clean，使用缓存）
make verify-local
```

### 3. 调试和 E2E 测试

```bash
# 启动调试服务并运行 E2E 测试
make debug

# 人工验证 http://127.0.0.1:8888
```

### 4. 预发布检查

```bash
# 如果刚运行过 make debug，用快速检查
make pre-publish-quick

# 或者完整检查（clean build + test）
make pre-publish
```

### 5. 发布到 PyPI

```bash
make publish
```

### 6. 创建并推送标签

```bash
VERSION=$(cd backend && python3 -c "from peekview import __version__; print(__version__)")
git tag -a "v$VERSION" -m "Release v$VERSION"
git push origin "v$VERSION"
```

## 详细步骤说明

### 版本号管理

**自动更新**（推荐）:
```bash
make bump-version NEW_VERSION=0.1.21
```

这会同时更新:
- `backend/peekview/__init__.py`
- `backend/pyproject.toml`
- `frontend-v3/package.json`

**手动更新**（如果需要）:
- `CHANGELOG.md` - 添加新版本记录
- `INDEX.md` - 更新版本号引用

> **注意**：`frontend-v3/src/views/EntryListView.vue` 中的版本号是**自动从 package.json 注入**的，不需要手动修改。

### 快速迭代开发

当修复代码问题后，避免重复完整构建:

```bash
# 快速测试（不 rebuild）
make test-quick

# 快速预发布检查（不 rebuild）
make pre-publish-quick
```

### 发布后验证

```bash
# 1. 检查 PyPI
pip index versions peekview

# 2. 检查 GitHub Tags
open https://github.com/randomgitsrc/peekview/releases

# 3. 测试安装
pipx upgrade peekview
peekview --version
```

## Makefile 命令速查

### 构建命令

| 命令 | 作用 | 使用场景 |
|------|------|----------|
| `make build` | 完整构建（clean + build） | 首次构建或发布前 |
| `make build-fast` | 快速构建（使用缓存） | 日常开发迭代 |
| `make clean` | 清理构建产物 | 遇到构建问题时 |

### 测试命令

| 命令 | 作用 | 使用场景 |
|------|------|----------|
| `make test` | 完整测试（rebuild + test） | CI 或最终验证 |
| `make test-quick` | 快速测试（只运行测试） | 代码修复后验证 |
| `make test-failed` | 只运行失败过的测试 | 调试阶段 |

### 验证命令

| 命令 | 作用 | 使用场景 |
|------|------|----------|
| `make verify-local` | 本地快速验证 | 日常开发检查 |
| `make pre-publish` | 完整预发布检查 | 最终发布前 |
| `make pre-publish-quick` | 快速预发布检查 | 修复代码后 |
| `make check-version` | 版本一致性检查 | 版本更新后 |
| `make check-changelog` | CHANGELOG 检查 | 发布前 |

### 发布命令

| 命令 | 作用 |
|------|------|
| `make bump-version NEW_VERSION=x.y.z` | 自动更新所有版本文件 |
| `make pre-publish` | 发布前完整检查 |
| `make pre-publish-quick` | 发布前快速检查 |
| `make publish` | 发布到 PyPI |
| `make publish-test` | 发布到 TestPyPI |

## 常见问题

### 1. 版本号不一致

```bash
# 自动检查
make check-version

# 自动修复
make bump-version NEW_VERSION=0.1.21
```

### 2. 构建太慢

使用快速构建（跳过 clean）:
```bash
make build-fast
```

### 3. 测试失败修复后不想重新构建

```bash
# 只运行测试
make test-quick

# 快速预发布检查
make pre-publish-quick
```

### 4. 发布流程中断恢复

如果 `make publish` 中断，可以直接重新运行:
```bash
# publish 会检测是否已有 wheel，有才跳过构建
make publish
```

### 5. 静态文件 hash 变化导致的 git churn

这是正常现象（Vite 的 content-hash）。发布时统一提交即可:
```bash
git add -A
git commit -m "chore(release): v$(cd backend && python3 -c 'from peekview import __version__; print(__version__)')"
```

## 流程优化原理

### 问题：之前的流程痛点

1. **pre-publish 重复构建**: 修复代码后重新运行 pre-publish 会重新 clean + build（~60秒）
2. **版本号更新繁琐**: 需要手动修改 5 个文件
3. **测试发现问题晚**: health 端点 404 在 pre-publish 才发现
4. **缺少快速验证**: 没有本地快速检查的方式

### 解决方案

1. **增量构建**: `build-fast` 跳过 clean，使用 npm cache
2. **快速测试**: `test-quick` 只运行测试，不 rebuild
3. **快速验证**: `verify-local` = build-fast + test-quick
4. **版本 bump 脚本**: `bump-version` 自动更新所有文件
5. **两阶段检查**:
   - `pre-publish-quick`: 修复代码后快速验证
   - `pre-publish`: 最终发布前完整验证

## 推荐工作流

```
开发阶段:
  make verify-local        # 快速验证
  
发现问题:
  修改代码
  make test-quick          # 快速验证修复

最终发布前:
  make debug               # E2E 测试
  make pre-publish         # 完整检查
  
发布:
  make publish
  git tag + push
```

---

**记住**:
1. 日常开发用 `make verify-local` 快速验证
2. 代码修复后用 `make test-quick` 避免重复构建
3. 最终发布前用 `make pre-publish` 完整检查
4. 用 `make bump-version` 自动更新版本号
