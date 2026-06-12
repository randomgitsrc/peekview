# 文档同步自动化体系

> 确保代码变更后文档始终保持同步

## 三层防护

| 层级 | 触发时机 | 工具 | 阻断提交 |
|------|---------|------|---------|
| 本地 pre-commit | `git commit` | `scripts/git-hooks/pre-commit.sh` | 版本不一致时是 |
| CI | `git push` | `.github/workflows/ci.yml` | 检查失败时是 |
| 手动 | 随时 | `make doc-checklist` | 否（仅提示）|

## 常用命令

```bash
make doc-checklist        # 查看当前变更需要更新哪些文档
make sync-version-docs    # 修复版本号不一致
make bump-version NEW_VERSION=x.y.z  # bump 版本并自动同步所有文档
```

## 变更类型 → 文档映射

由 `scripts/doc-sync/doc_checklist.py` 自动维护，覆盖 8 种变更类型：

| 变更类型 | 触发文件 | 必须更新的文档 |
|---------|---------|-------------|
| 版本号 | `pyproject.toml` / `__init__.py` / `package.json` | README / CLAUDE.md / INDEX.md / CHANGELOG / active-tasks.md |
| API 端点 | `backend/peekview/api/*.py` | backend/README.md / CHANGELOG |
| CLI 命令 | `backend/peekview/cli.py` | README / CLAUDE.md / backend/README.md |
| 配置/环境变量 | `backend/peekview/config.py` | README / DEPLOYMENT.md / DEBUGGING.md |
| 前端功能 | `frontend-v3/src/**` | CHANGELOG |
| 依赖 | `pyproject.toml` / `package.json` | DEPLOYMENT.md |
| 认证/安全 | `backend/peekview/auth.py` | DEPLOYMENT.md / CHANGELOG |
| 发布流程 | `Makefile` / `scripts/` | docs/process/release.md |

## 版本号单一真相

`backend/pyproject.toml` 是版本号的唯一权威来源。其他文件均从它同步：

```
pyproject.toml (权威)
  ├── backend/peekview/__init__.py  (代码引用)
  ├── frontend-v3/package.json     (前端版本)
  ├── README.md                    (badge)
  ├── CLAUDE.md                    (Current Version)
  ├── INDEX.md                     (当前版本)
  ├── docs/tasks/active-tasks.md (发布状态)
  ├── backend/README.md            (health 示例)
  └── CHANGELOG.md                 (版本记录)
```

## 安装本地 hook

```bash
make setup-hooks
```

新 clone 后需运行一次，之后每次 commit 自动检查。
