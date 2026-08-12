# 发布检查清单

## 版本规范

**语义化版本格式:** `MAJOR.MINOR.PATCH`

- MAJOR: 不兼容的 API 变更
- MINOR: 向后兼容的功能添加
- PATCH: 向后兼容的问题修复

**当前版本:** 查看 `backend/pyproject.toml`

---

## 发布前检查清单

### 1. 代码变更检查

- [ ] 所有功能已开发完成并通过自测
- [ ] 所有 TODO/FIXME 已处理或已记录
- [ ] 代码已提交到 GitHub
- [ ] 无敏感信息泄露 (API keys, tokens 等)

### 2. 版本号更新

- [ ] `backend/pyproject.toml` 中的 version 已更新
- [ ] `backend/peekview/__init__.py` 中的 `__version__` 已更新
- [ ] `frontend-v3/package.json` 中的 version 已更新
- [ ] 运行 `make check-version` 通过

### 3. 文档更新

- [ ] `CHANGELOG.md` 已更新，包含:
  - 版本号
  - 发布日期
  - 新增功能列表
  - 修复问题列表
  - 破坏性变更说明 (如有)
- [ ] README.md 中的版本号已更新 (如有)
- [ ] API 文档已更新 (如有接口变更)

### 4. 前端构建

- [ ] 前端代码已构建: `cd frontend-v3 && npm run build`
- [ ] 无构建错误
- [ ] 无 TypeScript 类型错误
- [ ] 静态文件已复制到 backend: `cp -r frontend-v3/dist/* backend/peekview/static/`
- [ ] 确认静态文件包含最新变更

### 5. 测试

- [ ] 后端单元测试通过: `cd backend && python -m pytest tests/`
- [ ] 前端构建通过 (无错误)
- [ ] 核心功能手动测试:
  - [ ] 条目列表分页
  - [ ] Mermaid 图表渲染
  - [ ] Mermaid 缩放/拖动
  - [ ] Mermaid Code/Diagram 切换
  - [ ] 移动端适配

### 6. 发布验证

- [ ] PyPI 包构建成功: `cd backend && python -m build`
- [ ] Wheel 文件包含静态资源
- [ ] 本地安装测试: `pipx install . --force && peekview --version`
- [ ] 本地功能测试通过

---

## 发布流程

### 方式一: 手动发布

```bash
# 1. 进入项目根目录
cd /home/kity/lab/projects/peekview

# 2. 执行完整发布流程
make publish

# 或分步执行:
make build        # 构建前端 + 后端
make check-version # 检查版本号
make test         # 运行测试 (如有)
make publish      # 上传到 PyPI
```

### 方式二: GitHub Actions 自动发布

1. 在 GitHub 创建 Release
2. 标签格式: `v0.1.14`
3. Actions 自动构建并发布

---

## 发布后验证

### 1. PyPI 验证

```bash
# 等待 1-5 分钟索引更新
pip index versions peekview

# 查看最新版本
pip index versions peekview | head -3
```

### 2. 安装验证

```bash
# 升级安装
pipx upgrade peekview

# 或强制重新安装
pipx install peekview --force

# 验证版本
peekview --version
```

### 3. 功能验证

```bash
# 启动服务
peekview serve

# 浏览器验证:
# - http://localhost:8080/ - 列表页正常
# - http://localhost:8080/<entry> - 详情页正常
# - Mermaid 图表可正常渲染
```

---

## 回滚流程

如发现严重问题需要回滚:

```bash
# 1. 删除 PyPI 版本 (需要管理员权限)
# 2. 安装旧版本
pipx install peekview==0.1.13 --force

# 3. 通知用户
# 在 GitHub Issues 发布说明
```

---

## 常见问题

### Q: 版本号冲突怎么办?

**A:** PyPI 不允许重复上传相同版本号。如需重新发布:
1. 修改版本号 (如 0.1.14 改为 0.1.15)
2. 重新运行发布流程
3. 删除错误的 Release 和 GitHub Tag

### Q: 静态文件未更新?

**A:** 检查是否执行了 `make build` (不是仅 `cd backend && python -m build`)

### Q: 测试失败能发布吗?

**A:** 不建议。如确需发布:
1. 在 CHANGELOG 中标注已知问题
2. 记录失败测试
3. 计划下个版本修复

---

## 历史版本记录

| 版本 | 发布日期 | 主要变更 |
|------|----------|----------|
| 0.1.14 | 2026-05-06 | 分页, Mermaid 交互 |
| 0.1.13 | 2026-05-06 | 版本号规范 |
| 0.1.12 | 2026-05-06 | Mermaid 基础支持 |
