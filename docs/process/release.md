# 发布流程

> 本文档定义 PeekView 的标准发布流程
> 
> **改进记录** (2026-05-06):
> - 新增 `make bump-version` 自动更新版本号
> - 新增 `make test-quick` 和 `pre-publish-quick` 快速检查
> - 新增 `make verify-local` 本地快速验证
> - 优化发布流程，减少重复构建

## 快速发布

```bash
make bump-version NEW_VERSION=x.y.z && make release
```

`bump-version` 自动完成版本同步 + commit + tag。`release` 完成构建 + 发布到 PyPI。

## CHANGELOG 暂存区规范

`[Unreleased]` 是 CHANGELOG 的暂存区，遵循 [Keep a Changelog](https://keepachangelog.com/) 实践：

### 何时写入

**任何产生用户可见改动的任务完成后，立刻写入 `[Unreleased]`**，不要等到 bump 时补写。

- 走 agate 流程的任务：P5（技术验证）通过后立刻写
- 非 agate 任务（热修、小改动等）：完成后立刻写
- 判断标准：只要改动对用户可见（功能、行为、UI、API），就写。纯内部重构不影响用户的不写

```
## [Unreleased]

### 新增
- **功能描述**（Txxx）：简要说明

### 变更
- **变更描述**（Txxx）：简要说明

### 修复
- **修复描述**（Txxx）：简要说明

### 安全
- **安全修复**（Txxx）：简要说明
```

### bump 时归集

`make bump-version` 后，将 `[Unreleased]` 内容移到新版本号下：

```
## [0.5.1] - 2026-06-30

### 新增
- **功能描述**（Txxx）：简要说明

## [Unreleased]   ← 清空，等待下一个任务
```

### 为什么

- 避免遗漏：任务完成时记忆最清晰，延后补写容易漏条目
- 避免重复：多个任务累积在 `[Unreleased]`，bump 时一次性归集，不需要逐个回忆
- 可追溯：任何时候看 `[Unreleased]` 就知道"自上次发布以来改了什么"

---

## 标准发布流程（推荐）

### 1. 自动更新版本号

```bash
# 一键更新所有版本文件
make bump-version NEW_VERSION=0.1.22

# 将 [Unreleased] 内容归集到新版本号下（CHANGELOG.md）
# 然后提交
```

### 2. 本地快速验证

```bash
# 快速构建 + 测试（不 clean，使用缓存）
make verify-local
```

### 3. 调试和 E2E 测试

```bash
# 启动调试服务并运行 E2E 测试（包含数据隔离验证）
make debug

# 关键检查点：确认数据隔离验证通过
# - ✓ 调试环境条目数: 0 或测试数据
# - ✓ 数据库路径: /tmp/peekview-debug/peekview.db

# 人工验证 http://127.0.0.1:8888
```

**⚠️ 重要**: `make debug` 使用 `:8888` 调试端口，不会污染生产环境 (`:8080`)。旧 Python E2E 测试 (`tests/archived/e2e/`) 已被归档，不会意外运行。

### 4. 预发布检查

**发布前文档同步检查** (关键步骤):
```bash
# 检查文档是否与代码同步
make check-doc-sync

# 自动更新可自动生成的文档
make update-docs

```

**手动检查清单**:
- [ ] README.md 版本号已更新
- [ ] CHANGELOG.md `[Unreleased]` 内容已归集到新版本号下，`[Unreleased]` 区域为空
- [ ] API 路径示例正确 (`/api/v1/entries`)
- [ ] 环境变量名使用 `__` 分隔符

**发布前检查生产环境数据**:
```bash
# 检查生产环境是否有异常数据
curl -s http://127.0.0.1:8080/api/v1/entries | jq '.total'

# 如果数量异常，暂停发布并调查
# 清理命令（如有测试数据）:
# peekview list --json | jq -r '.[] | select(.summary | test("(?i)(test|stdin|workflow)")) | .slug' | xargs -r peekview delete
```

**发布前同步开发 venv 依赖** (T060 复盘教训):

```bash
# 确保 pyproject.toml 中的依赖已安装到本地 venv
# 防止新增依赖后本地测试因缺包失败（隔离构建能绕过但本地测试虚设）
make dev
```

```bash
# 如果刚运行过 make debug，用快速检查
make pre-publish-quick

# 或者完整检查（clean build + test）
make pre-publish
```

### 5. 发布到 PyPI

**⚠️ 前提：需要 PyPI API Token**

```bash
# 1. 获取 PyPI API Token（只需执行一次）
# 访问 https://pypi.org/manage/account/token/
# 点击 "Add API token"
# Token name: peekview-release (或自定义)
# Scope: "Entire account" 或 "Project: peekview"
# 复制生成的 token (pypi-xxxxxxxx)

# 2. 配置 token（三选一）
# 方式 A：环境变量（临时，当前终端）
export PYPI_API_TOKEN="pypi-xxxxxxxx"

# 方式 B：写入 ~/.bash_env（推荐，永久，非交互式 shell 也能读取）
echo 'export PYPI_API_TOKEN="pypi-xxxxxxxx"' >> ~/.bash_env

# 方式 C：写入 ~/.bashrc（需交互式 shell，Makefile 非交互式环境取不到）
echo 'export PYPI_API_TOKEN="pypi-xxxxxxxx"' >> ~/.bashrc

# 3. 执行发布
make publish
```

> **注意**：Makefile 的 `publish` target 会自动从 `~/.bash_env` 或 `~/.peekview/.release-env` 读取 token 作为 fallback，无需每次手动 export。推荐使用方式 B。

### 5.5 升级并重启生产服务

**⚠️ CRITICAL: 这一步必须由用户手动执行，严禁自动化！**

在升级生产服务之前，必须完成以下检查：
1. ✅ E2E 测试已通过
2. ✅ 用户已人工验证功能正常
3. ✅ 生产数据已备份或无风险
4. ✅ 确认没有测试数据污染生产数据库

```bash
# 1. 升级 pipx 包
pipx upgrade peekview
peekview --version   # 确认版本号正确

# 2. ⚠️  重启前验证：检查生产数据库无测试数据
curl -s http://127.0.0.1:8080/api/v1/entries | python3 -c "
import sys, json
d = json.load(sys.stdin)
test_count = sum(1 for e in d['items'] if 'e2e-' in e['slug'] or 'test-' in e['slug'])
if test_count > 0:
    print(f'⚠️  WARNING: Found {test_count} test entries in production!')
    print('   Clean up before restart or investigate data pollution.')
else:
    print(f'✓ Production database clean ({d[\"total\"]} entries)')
"

# 3. 用户确认后，手动重启生产服务
# sudo systemctl restart peekview

# 4. 验证服务已更新
curl -s http://127.0.0.1:8080/health   # 确认 version 是新版本
```

**禁止**: 在任何脚本中自动执行 `sudo systemctl restart peekview`

### 6. 创建并推送标签

`make bump-version` 已自动完成 commit + tag，无需手动操作。

推送标签（bump-version 已完成 tag 创建，只需 push）：

```bash
git push origin main && git push origin --tags
```

### 6.5 发布 MCP Server 到 npm（独立版本管理）

MCP Server 与 Python Backend 版本独立管理。发布流程：

```bash
# 1. 更新 MCP Server 版本
make bump-mcp-version NEW_MCP_VERSION=0.3.0

# 2. 编辑 CHANGELOG.md，填写 [mcp-v0.3.0] 变更内容

# 3. 预发布检查（unit test + dry-run）
make pre-publish-npm

# 4. 手动发布到 npm
make publish-npm

# 5. 推送 tag 触发 CI 自动发布
# bump-mcp-version 已自动 commit + tag，只需 push
git push origin main && git push origin --tags
```

**CI 自动发布**：推送 `mcp-v*` tag 会触发 GitHub Actions，自动在 Node 18/20 并行测试后发布到 npm。

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

# 3. 升级并验证版本
pipx upgrade peekview
peekview --version

# 4. 重启生产服务（⚠️ 必须手动执行，见第 5.5 节说明！pipx upgrade 不会自动重启）
sudo systemctl restart peekview

# 5. 验证生产服务已更新
curl -s http://127.0.0.1:8080/health
# 必须确认 version 字段是新版本号！

# 6. 验证生产数据完整
curl -s http://127.0.0.1:8080/api/v1/entries | jq '.total'
# 应与调试前数量一致，无 e2e- 测试数据
```

**⚠️ 关键**: `pipx upgrade` 只更新包文件，不重启正在运行的服务。
必须手动 `sudo systemctl restart peekview`，否则服务仍运行旧版本。

### 发布失败恢复

**场景 1: PyPI 成功，Git push 失败**
```bash
# 手动重试推送
git push origin main
git push origin v0.1.22

# 或带延迟重试
for i in 1 2 3; do
    git push origin main && break
    echo "Push failed, retrying in 5s..."
    sleep 5
done
```

**场景 2: Git push 成功，PyPI 失败**
```bash
# PyPI 不允许重复上传相同版本
# 必须 bump 新版本
make bump-version NEW_VERSION=0.1.23
# 更新 CHANGELOG，然后重新发布
make pre-publish && make publish
```

**场景 3: 调试服务数据污染了生产环境**
```bash
# 立即停止调试服务
make debug-stop

# 检查数据是否受损
curl -s http://127.0.0.1:8080/api/v1/entries | jq '.total'

# 如果有测试数据，清理（使用 peekview CLI）
peekview list --json | jq -r '.[] | select(.summary | contains("TEST:")) | .slug' | xargs -r peekview delete

# 重新配置调试服务，确保环境变量正确
# 检查 scripts/dev-server.sh 中的 PEEKVIEW_STORAGE__* 变量
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
| `make debug` | 启动调试服务 + E2E 测试 + 数据隔离验证 |
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
