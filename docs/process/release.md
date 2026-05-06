# 发布流程

## 项目结构说明

```
peekview/                    # 项目根目录
├── frontend-v3/            # Vue3 前端
│   ├── src/                 # 源代码
│   └── dist/                # 构建输出
├── backend/                  # Python 后端
│   ├── peekview/            # Python 包
│   │   └── static/          # 前端静态文件（从前端构建复制）
│   └── pyproject.toml       # Python 包配置
└── Makefile                 # 根级构建脚本（统一入口）
```

**关键理解：**
- 前端构建输出必须复制到 `backend/peekview/static/` 才会被打包进 PyPI
- 后端打包工具（hatchling）只打包 `backend/` 目录下的文件
- **根级 Makefile** 是统一入口，确保"先构建前端 → 复制 → 再打包后端"

---

## 推荐发布流程（使用根级 Makefile）

### 1. 完整构建（开发测试）

```bash
cd /home/kity/lab/projects/peekview  # 项目根目录

# 构建前端 + 复制到后端 + 打包后端
make build

# 本地安装测试
make install

# 启动测试
peekview serve
```

### 2. 完整发布到 PyPI

```bash
cd /home/kity/lab/projects/peekview

# 设置环境变量
export PYPI_API_TOKEN="pypi-xxxxx"

# 一键发布（构建 → 测试 → 版本检查 → 上传）
make publish
```

### 3. 发布到 TestPyPI（测试）

```bash
export PYPI_TEST_API_TOKEN="pypi-xxxxx"
make publish-test
```

---

## 单独操作（高级/调试）

### 仅构建前端
```bash
make build-frontend
# 输出到 frontend-v3/dist/
```

### 仅构建后端（⚠️ 不包含新鲜前端）
```bash
cd backend
make build-dist
```

### 仅复制已构建的前端
```bash
# 手动复制（如果前端已构建）
rm -rf backend/peekview/static/*
cp -r frontend-v3/dist/* backend/peekview/static/
```

---

## 版本更新检查清单

发布前确认：
- [ ] `backend/pyproject.toml` 中的 version 已更新
- [ ] `backend/peekview/__init__.py` 中的 `__version__` 已更新（其他文件通过导入使用）
- [ ] `frontend-v3/package.json` 中的 version 已更新
- [ ] `CHANGELOG.md` 已记录本次变更
- [ ] 在**项目根目录**运行 `make build`（确保静态文件最新）
- [ ] 运行 `make test` 通过所有测试
- [ ] 运行 `make check-version` 通过版本一致性检查

---

## 版本号规范

**单一数据源原则：** 版本号只在 `peekview/__init__.py` 定义一次，其他文件通过导入使用。

```python
# ✅ 正确做法
from peekview import __version__

# ❌ 错误做法（已修复）
version = "0.1.12"  # 不要硬编码
```

### 文件变更

- `backend/pyproject.toml`: `version = "0.1.12"`（打包时使用）
- `backend/peekview/__init__.py`: `__version__ = "0.1.12"`（单一数据源）
- `backend/peekview/cli.py`: `from peekview import __version__`
- `backend/peekview/main.py`: `from peekview import __version__`
- `frontend-v3/package.json`: `"version": "0.1.12"`

---

## 常见错误

### ❌ 错误：在后端目录直接 publish
```bash
cd backend
make publish   # 这会打包旧的前端静态文件！
```

### ✅ 正确：在根目录 publish
```bash
cd /home/kity/lab/projects/peekview  # 回到根目录
make publish                           # 先构建前端再发布
```

### ❌ 错误：修改了前端但没重新构建
```bash
# 修改了 useMarkdown.ts 但没构建
make publish  # 静态文件还是旧的
```

### ✅ 正确：确保完整构建
```bash
make build    # 包含 npm run build + copy + python build
```

---

## 发布后验证

```bash
# 等待 PyPI 索引更新（约 1-5 分钟）
pip index versions peekview

# 安装测试
pipx install peekview --force
peekview --version

# 验证 mermaid 等功能正常
peekview serve
# 浏览器访问包含 mermaid 图表的 entry
```
