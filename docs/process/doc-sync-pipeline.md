# 文档同步流水线机制

本文档定义 PeekView 的文档同步自动化体系，确保代码与文档保持一致。

## 核心问题

> 代码迭代速度 >> 文档更新速度

- 代码平均每 2.5 天一个版本
- 文档经常落后 1-2 周
- 新用户通过 README 评估时严重低估实际能力

## 三层防护体系

```
┌─────────────────────────────────────────────────────────────┐
│ 第一层: 本地开发 (Makefile)                                │
│ make check-doc-sync  - 提交前检查                          │
│ make update-docs       - 自动生成可自动化的文档              │
├─────────────────────────────────────────────────────────────┤
│ 第二层: CI/CD (GitHub Actions)                             │
│ PR 时自动检查文档同步状态                                    │
│ 阻止不一致的代码进入主分支                                    │
├─────────────────────────────────────────────────────────────┤
│ 第三层: 发布前检查 (release.md)                            │
│ 强制要求: 文档同步检查通过后才能发布                          │
│ 人工审查 FEATURES.md 与 README.md 一致性                   │
└─────────────────────────────────────────────────────────────┘
```

## 自动化脚本

### check_feature_sync.py
从源码扫描实际功能，与 README 对比：
- 检测 Mermaid 支持
- 检测 Mobile UI
- 检测 Theme Toggle
- 检测 File Tree
- 检测其他组件

**输出**: 未在 README 中记录的功能列表

### check_version_sync.py
确保所有文档中的版本号一致：
- Source: `pyproject.toml`
- Check: `README.md`, `INDEX.md`, `CLAUDE.md`, `CHANGELOG.md`

**输出**: 版本不一致的文件列表

### check_api_docs.py
检查 API 文档与代码一致性：
- 扫描 `backend/peekview/api/*.py` 的路由
- 检查文档中的 API 路径前缀
- 验证端点示例

**输出**: 文档中缺失的 API 变更

### generate_feature_matrix.py
自动生成 `FEATURES.md`：
- 从代码中提取功能清单
- 列出所有 Views、Components、API 模块、CLI 命令
- 标注支持状态（✅/❌）

**输出**: 自动更新的 `FEATURES.md`

## 工作流程

### 日常开发

```bash
# 修改代码后，检查文档是否需要更新
make check-doc-sync

# 如果有警告，更新文档
# 1. 手动更新 README.md
# 2. 自动生成 FEATURES.md
make update-docs

# 提交
# pre-commit hook 会自动运行检查
git commit -m "feat: add xxx"
```

### PR 审查

GitHub Actions 自动检查：
- ✅ 功能同步检查通过
- ✅ 版本同步检查通过
- ✅ API 文档检查通过
- ⬜ 人工审查 README 更新

### 发布流程

```bash
make debug          # 1. 调试通过
make check-doc-sync # 2. 文档同步检查（新增强制步骤）
make update-docs    # 3. 自动生成 FEATURES.md
# 4. 人工确认 README.md 已更新
make pre-publish    # 5. 预发布检查
make publish        # 6. 发布
```

## README 更新检查清单

每个功能 PR 必须更新：

| 改动类型 | README 必须更新项 |
|----------|-------------------|
| 新增功能 | 功能特性列表、截图（如 UI 变更） |
| API 变更 | API 示例、路径说明 |
| CLI 命令 | 命令速查表 |
| 配置项 | 环境变量表、默认值 |
| 版本升级 | 版本号引用 |

## 自动化边界

**可以自动化的**:
- ✅ 功能矩阵生成
- ✅ 版本号一致性检查
- ✅ API 路由列表提取
- ✅ 缺失文档检测（提醒）

**必须手动的**:
- ❌ 功能描述文案
- ❌ 使用示例编写
- ❌ 截图更新
- ❌ 架构变更说明

## 成功指标

- 发布时 `make check-doc-sync` 0 警告
- README 功能列表与 FEATURES.md 一致
- 版本发布后 24 小时内文档同步完成

## 故障排除

### CI 检查失败

```bash
# 查看具体失败项
python3 scripts/doc-sync/check_feature_sync.py

# 修复后重新检查
make check-doc-sync
```

### 版本号不一致

```bash
# 手动修复版本号
make bump-version NEW_VERSION=x.y.z

# 检查所有文件
python3 scripts/doc-sync/check_version_sync.py
```

### FEATURES.md 未生成

```bash
# 手动生成
python3 scripts/doc-sync/generate_feature_matrix.py

# 检查 FEATURES.md 已更新
git diff FEATURES.md
```
