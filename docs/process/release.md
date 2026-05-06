# 发布流程

> 本文档定义 PeekView 的标准发布流程

## 快速发布（一句话）

```bash
make publish && git tag -a v$(cd backend && python3 -c "from peekview import __version__; print(__version__)") -m "Release" && git push origin --tags
```

## 标准发布流程

### 前提条件

- PyPI API Token 已设置环境变量：`export PYPI_API_TOKEN=your_token`
- 所有代码改动已提交到 main 分支
- 版本号已在以下文件更新：
  - `backend/peekview/__init__.py`
  - `backend/pyproject.toml`
  - `frontend-v3/package.json` ⚠️ **前端版本从此文件自动读取**
  - `CHANGELOG.md`
  - `INDEX.md`

> **注意**：`frontend-v3/src/views/EntryListView.vue` 中的版本号是**自动从 package.json 注入**的，不需要手动修改。
> 构建时 Vite 会将 `package.json` 中的版本注入为 `__APP_VERSION__` 全局变量。

### 发布步骤

```bash
# 1. 进入项目根目录
cd /home/kity/lab/projects/peekview

# 2. 执行完整发布（构建 + 检查 + 上传 PyPI）
make publish

# 3. 创建并推送 Git Tag（Makefile 不包含此步骤，需手动）
VERSION=$(cd backend && python3 -c "from peekview import __version__; print(__version__)")
git tag -a "v$VERSION" -m "Release v$VERSION"
git push origin "v$VERSION"
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

| 命令 | 作用 |
|------|------|
| `make build` | 构建前后端 |
| `make test` | 运行测试 |
| `make pre-publish` | 发布前检查（不实际发布） |
| `make publish` | 发布到 PyPI |
| `make publish-test` | 发布到 TestPyPI |
| `make clean` | 清理构建产物 |

查看完整帮助：`make help`

## 常见问题

### 1. 忘记设置 PYPI_API_TOKEN

```bash
export PYPI_API_TOKEN=pypi-xxxxx
```

### 2. 版本号不一致

```bash
make check-version
```

### 3. CHANGELOG 未更新

```bash
make check-changelog
```

### 4. 只想测试发布流程（不上传）

```bash
make pre-publish
```

## 自动化建议

### 方案 1：GitHub Actions（推荐）

创建 `.github/workflows/release.yml`，实现：
- push tag 时自动发布到 PyPI
- 自动创建 GitHub Release
- 自动上传构建产物

### 方案 2：Makefile 增强

在 Makefile 中添加 `publish-full` 目标，包含 tag 创建和推送。

---

**记住**：
1. 发布前先看 `make pre-publish` 是否通过
2. 版本号必须先在 5 个文件中更新
3. 发布后必须打 tag 并推送
