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
make bump-version NEW_VERSION=0.1.22

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

# 检查 FEATURES.md 已生成
ls -la FEATURES.md
```

**手动检查清单**:
- [ ] README.md 功能列表与 FEATURES.md 一致
- [ ] README.md 版本号已更新
- [ ] CHANGELOG.md 包含当前版本
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

```bash
VERSION=$(cd backend && python3 -c "from peekview import __version__; print(__version__)")
git tag -a "v$VERSION" -m "Release v$VERSION"

# 推送（带重试机制）
git push origin main || (sleep 5 && git push origin main)
git push origin "v$VERSION" || (sleep 5 && git push origin "v$VERSION")
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

# 5. 提交并推送 tag 触发 CI 自动发布
git add -A && git commit -m "chore(mcp): bump to v0.3.0"
git tag mcp-v0.3.0 && git push origin mcp-v0.3.0
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
