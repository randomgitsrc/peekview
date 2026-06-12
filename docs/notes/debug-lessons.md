# PeekView 调试经验总结

> 记录调试过程中的关键教训和最佳实践

## 核心原则：状态新鲜性

### 教训 1: Vite 构建的静态文件必须每次重新生成

**问题**: Mermaid 修复后，v0.1.18 发布到 PyPI 仍然是旧版本

**原因**: 
- Vite 生成带 content hash 的文件名（如 `index-BNOcl_Sl.js`）
- 每次构建 hash 都会变
- `backend/peekview/static/` 保留了旧文件，新文件复制后旧文件仍在
- index.html 引用新文件名，但 wheel 同时包含新旧文件

**解决**:
```makefile
build-frontend:
    rm -rf backend/peekview/static/*    # 关键：先清理
    cp -r frontend-v3/dist/* backend/peekview/static/
```

**检查点**:
```bash
# 确认 static 和 dist 文件数量一致
ls frontend-v3/dist/ | wc -l
ls backend/peekview/static/ | wc -l
```

---

## 调试服务与正式服务并存

### 教训 2: 不要停止用户的 pipx 服务

**场景**: 用户通过 `pipx install peekview` 运行正式服务在 :8080
**调试**: 开发代码运行在 :8888

**正确做法**:
```bash
# 调试服务配置
PORT=8888
DATA_DIR=/tmp/peekview-debug  # 隔离数据

# 启动命令（注意 __ 分隔符）
cd backend
PEEKVIEW_STORAGE__DATA_DIR=/tmp/peekview-debug/data \
PEEKVIEW_STORAGE__DB_PATH=/tmp/peekview-debug/peek.db \
  uvicorn peekview.main:get_app --host 127.0.0.1 --port 8888 --factory
```

**验证并存**:
```bash
ps aux | grep peekview
# 应看到两个服务:
# - ~/.local/bin/peekview serve (pipx, :8080)
# - python3 -m uvicorn ... --port 8888 (调试)
```

---

## E2E 测试是最后防线

### 教训 3: 不要依赖人工测试

**问题**: Mermaid 三个 bug（SVG 不铺满、切换丢失、Fullscreen 小窗口）
**人工测试**: 容易遗漏，特别是切换和边界情况
**E2E 测试**: Playwright 自动化可重复验证

**关键测试场景**:
```typescript
// 1. SVG 填满容器
const svg = await page.locator('.svg-container svg')
const box = await svg.boundingBox()
expect(box.width).toBeGreaterThan(800)  // 不是 177px

// 2. Code/Diagram 切换后图表还在
await page.click('text=Code')      // 切换到 Code 模式
await page.click('text=Diagram')   // 切换回 Diagram
const svgAfter = await page.locator('.mermaid svg')
expect(await svgAfter.isVisible()).toBe(true)

// 3. Fullscreen 铺满窗口
await page.click('[title="Fullscreen"]')
const modalSvg = await page.locator('.mermaid-modal svg')
const modalBox = await modalSvg.boundingBox()
expect(modalBox.width).toBeGreaterThan(1000)
```

---

## 调试流程标准化

### 修改前
1. 明确修改范围和测试场景
2. 确定是否需要新的 E2E 测试

### 修改中
```bash
# 1. 构建（确保 static 最新）
make debug-build

# 2. 启动调试服务（:8888）
make debug-start

# 3. 运行 E2E 测试
make debug-test
```

### 修改后
1. **自动化测试通过** ✅
2. **用户人工验证** ✅（访问 http://127.0.0.1:8888）
3. **用户确认"没问题"** ✅（口头或书面确认）
4. 进入发布流程: `make pre-publish && make publish`

---

## 常见陷阱

### 陷阱 1: 忘记清理
```bash
# 错误
make build-frontend  # 旧文件还在 static/

# 正确
make clean && make build-frontend  # 彻底清理后重建
```

### 陷阱 2: 测试用错端口
```bash
# 错误：测试跑了 pipx 的 8080 端口
curl http://127.0.0.1:8080

# 正确：测试调试的 8888 端口
curl http://127.0.0.1:8888
```

### 陷阱 3: 跳过 E2E 直接发布
```bash
# 错误流程
git commit && make publish  # 没有 E2E 验证！

# 正确流程
make debug      # 构建+启动+E2E
# 用户确认...  
make publish    # 经过验证后再发布
```

---

## 快速诊断

### 问题: 页面显示旧代码
```bash
# 检查 static 文件时间戳
ls -la backend/peekview/static/index.html
# 如果不是刚修改的，重新运行 make debug-build
```

### 问题: 调试服务起不来
```bash
# 检查端口占用
lsof -i :8888

# 停止之前的调试服务
make debug-stop

# 或强制清理
pkill -f "uvicorn peekview.main.*8888"
```

### 问题: E2E 测试失败
```bash
# 查看测试截图
ls /tmp/mermaid-test-results/

# 带 UI 模式运行，手动观察
npx playwright test --ui
```

---

## 检查清单模板

### 每次修改后
- [ ] `make debug-build` 成功
- [ ] `static/index.html` 时间戳是最新的
- [ ] `make debug-start` 服务启动成功
- [ ] `make debug-test` 所有 E2E 测试通过
- [ ] 用户人工验证确认
- [ ] 用户明确说 "没问题"

### 发布前
- [ ] 版本号已更新
- [ ] CHANGELOG 已更新
- [ ] `make pre-publish` 通过
- [ ] `verify-wheel` 通过（检查 static 文件）

---

## 调试环境数据隔离（v0.1.22 教训）

### 教训 4: 环境变量名必须与配置类结构匹配

**问题**: `make debug-start` 启动的调试服务使用了生产数据库 `~/.peekview/peekview.db`，而非隔离的 `/tmp/peekview-debug/peekview.db`

**根本原因**: 
- `PeekConfig` 使用嵌套的 `PeekStorage` 类
- Pydantic Settings 对于嵌套类需要 `__` 分隔符
- 脚本错误地使用了 `PEEKVIEW_DB_PATH` 而非 `PEEKVIEW_STORAGE__DB_PATH`

**配置结构**:
```python
class PeekConfig(BaseSettings):
    storage: PeekStorage  # 嵌套配置

class PeekStorage(BaseSettings):
    db_path: Path         # 实际字段在此
```

**错误 vs 正确**:
```bash
# ❌ 错误（无效，仍使用默认值）
PEEKVIEW_DB_PATH=/tmp/peekview-debug/peekview.db
PEEKVIEW_DATA_DIR=/tmp/peekview-debug/data

# ✅ 正确（覆盖嵌套字段）
PEEKVIEW_STORAGE__DB_PATH=/tmp/peekview-debug/peekview.db
PEEKVIEW_STORAGE__DATA_DIR=/tmp/peekview-debug/data
```

**验证隔离**:
```bash
# 调试环境应该为空或只有测试数据
curl -s http://127.0.0.1:8888/api/v1/entries | jq '.items | length'

# 正式环境保持原有数据
curl -s http://127.0.0.1:8080/api/v1/entries | jq '.items | length'

# 检查进程打开的数据库文件
lsof -p $(pgrep -f "uvicorn.*8888") | grep peekview.db
# 应该显示: /tmp/peekview-debug/peekview.db
```

---

### 教训 5: 测试数据管理策略

**问题**: 调试环境积累了 224 条测试条目，与生产数据混在一起，清理时误删了真实数据

**策略**: 

1. **自动过期**: 调试服务已配置 `PEEKVIEW_CLEANUP__INTERVAL_SECONDS=600`，但仅对调试模式有效

2. **命名约定**: 测试条目使用可识别的前缀/后缀
   ```bash
   # 测试代码中
   summary="TEST: auto-generated test entry"
   ```

3. **批量清理前验证**:
   ```bash
   # 先列出要删除的内容，人工确认
   peekview list -q "TEST:" --json | jq '.[].slug'
   
   # 确认后再删除
   peekview delete $(peekview list -q "TEST:" --json | jq -r '.[].slug')
   ```

4. **生产数据保护**: 
   - 清理脚本应该白名单而非黑名单
   - 保留条目标记（如 `expires_at` 为空表示永久保留）

---

### 教训 6: dev-server.sh 必须使用正确的 Python 版本

**问题**: `scripts/dev-server.sh` 使用 `python3 -m uvicorn` 启动调试服务，但 `python3` 可能解析到 hermes venv 的 Python 3.11，而 peekview 要求 Python 3.12+

**根本原因**:
- `which python3` 返回 hermes venv 的 Python 3.11
- Python 3.11 没有安装 peekview（也不兼容），实际运行的是 pipx 安装的旧版本
- 旧版本没有 auth 端点，导致 E2E 测试失败

**修复**:
```bash
# dev-server.sh 中自动检测正确的 Python
PYTHON=""
for cmd in python3.12 python3.13 python3; do
    if command -v "$cmd" &>/dev/null; then
        if "$cmd" -c "import peekview" 2>/dev/null; then
            PYTHON="$cmd"
            break
        fi
    fi
done
```

**验证**:
```bash
# 启动后检查 Python 版本和 peekview 版本
curl -s http://127.0.0.1:8888/health | jq '.version'
# 应该是本地开发版本（如 0.1.25），而非 pipx 旧版本
```

---

### 教训 7: Playwright E2E 测试必须设置 BASE_URL

**问题**: 直接运行 `npx playwright test` 时，`playwright.config.ts` 的 `baseURL` 默认为 `http://localhost:5173`（Vite 开发服务器），而非调试服务的 `http://127.0.0.1:8888`

**根本原因**:
- `playwright.config.ts` 中 `baseURL: process.env.BASE_URL || 'http://localhost:5173'`
- `page.request.post('/api/v1/entries', ...)` 使用 `baseURL` 发送请求
- 如果没有 Vite 开发服务器运行，请求失败或打到错误的服务

**修复**:
```bash
# 使用 make debug-test（自动设置 BASE_URL）
make debug-test

# 或手动设置
BASE_URL=http://127.0.0.1:8888 npx playwright test
```

---

### 教训 8: E2E 认证测试必须使用唯一用户名

**问题**: 认证 E2E 测试使用硬编码用户名（如 `e2euser`），多次运行后注册失败（用户名已存在）

**修复**:
```typescript
// 使用时间戳 + 随机字符串确保唯一
const uniqueUser = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
```

---

### 教训 9: 网络不稳定时的发布流程

**问题**: `git push` 和 PyPI 上传可能因网络问题失败

**改进**:

```bash
# Git 推送重试机制
git_push_with_retry() {
    for i in 1 2 3; do
        git push "$@" && break
        echo "Push failed, retrying in 5s... ($i/3)"
        sleep 5
    done
}

# 或者使用 SSH 代替 HTTPS（如果可用）
git remote set-url origin git@github.com:randomgitsrc/peekview.git
```

**发布检查点**:
- [ ] 本地测试通过
- [ ] 版本号已更新
- [ ] CHANGELOG 已更新  
- [ ] PyPI 发布成功（检查 https://pypi.org/project/peekview/）
- [ ] Git 推送成功
- [ ] Tag 推送成功

**失败恢复**:
```bash
# 如果 PyPI 成功但 git 失败
# 手动推送
git push origin main
git push origin v0.1.22

# 如果 git 成功但 PyPI 失败
# 重新发布（PyPI 不允许重复上传相同版本，需要 patch 版本）
make bump-version NEW_VERSION=0.1.23
make publish
```

---

## 前端路由文件陷阱

### 教训 10: 修改路由时必须确认正确的文件

**问题**: 添加 API Key 管理页路由后，前端构建成功但 `/settings/apikeys` 页面始终显示首页，组件不在构建输出中

**原因**:
- 项目存在两个路由文件：`src/router.ts` 和 `src/router/index.ts`
- `main.ts` 导入的是 `./router.ts`（实际使用）
- 路由被添加到了 `src/router/index.ts`（未被导入）
- Vite 构建正常，但路由定义根本不参与编译

**解决**:
- 始终修改 `src/router.ts`（`main.ts` 实际导入的文件）
- 删除未使用的 `src/router/index.ts` 避免混淆
- 构建后验证：`grep -c "apikey-page" dist/assets/*.js` 确认组件在输出中

**检查点**:
```bash
# 添加新路由后，验证组件出现在构建输出中
npm run build
grep -c "your-css-class" dist/assets/*.js

# 确认 main.ts 导入的是哪个路由文件
grep "router" src/main.ts
```

---

## SQLite 时区处理

### 教训 11: SQLite 存储的 datetime 是 offset-naive

**问题**: `verify_api_key()` 中 `api_key.expires_at < datetime.now(timezone.utc)` 抛出 TypeError（offset-naive vs offset-aware 比较）

**原因**:
- SQLite 不存储时区信息，所有 datetime 列返回 offset-naive 的 Python datetime
- 代码使用 `datetime.now(timezone.utc)` 生成 offset-aware datetime
- 直接比较会 TypeError

**解决**:
- 从 DB 读取的 datetime，统一加 `.replace(tzinfo=timezone.utc)` 转为 aware
- 写入 DB 的 datetime，用 `.replace(tzinfo=None)` 转为 naive
- SQL WHERE 子句中的比较，两端都用 naive datetime

```python
# 读取时转为 aware
if api_key.expires_at and api_key.expires_at.tzinfo is None:
    expires_at = api_key.expires_at.replace(tzinfo=timezone.utc)

# 写入时转为 naive
api_key.last_used_at = now.replace(tzinfo=None)
```

---

## 首用户 Admin 自动提升

### 教训 12: 测试中注意首用户 is_admin=True

**问题**: `test_cannot_revoke_others_key` 失败——user_a 应该无法撤销 user_b 的 key，但返回 200

**原因**:
- 系统自动给首个注册用户设置 `is_admin=True`
- 测试先注册 user_a（成为 admin），再注册 user_b
- user_a 作为 admin 有权撤销 user_b 的 key

**解决**:
- 测试中先注册 "admin_user"，再注册实际测试用户
- 或在测试断言中考虑 admin 权限

---

## pipx upgrade 不重启服务

### 教训 13: 升级包后必须手动重启生产服务

**问题**: pipx upgrade 到 0.1.27 后，`curl /health` 仍返回 0.1.24

**原因**:
- `pipx upgrade peekview` 只更新 venv 中的包文件
- systemd 管理的进程仍在内存中运行旧代码
- Python 进程不会自动重载已安装的包

**解决**:
```bash
# 发布后必须执行这两步
pipx upgrade peekview
sudo systemctl restart peekview   # 必须手动重启！

# 验证
curl -s http://127.0.0.1:8080/health  # 确认 version 字段已更新
```

**预防**: release.md 已增加步骤 5.5（升级并重启生产服务）

---

## E2E 测试数据污染生产库

### 教训 14: E2E 测试后必须检查生产数据完整性

**问题**: 生产数据库出现 92 条 e2e- 前缀的测试条目和 5 个测试用户

**原因**:
- 某次 E2E 测试时调试服务配置错误，使用了默认的 `~/.peekview/peekview.db` 而非 `/tmp/peekview-debug/peekview.db`
- 或者 E2E 的 BASE_URL 指向了 8080（生产端口）而非 8888（调试端口）
- 生产服务 v0.1.24 无认证，任何人可写入

**解决**:
```bash
# E2E 测试后强制检查（debug-workflow.md 步骤 5.5）
curl -s http://127.0.0.1:8080/api/v1/entries | python3 -c "
import sys, json
d = json.load(sys.stdin)
e2e = sum(1 for e in d['items'] if 'e2e-' in e['slug'])
print(f'生产条目: {d[\"total\"]}, E2E污染: {e2e}')
if e2e > 0:
    print('⚠️ 生产数据库被 E2E 测试数据污染！')
"
```

**预防**:
- debug-workflow.md 增加 E2E 后生产数据检查步骤
- dev-server.sh 启动时验证 DB 路径不在 ~/.peekview/ 下

---

## 前端字段缺失防御

### 教训 15: API 字段缺失时前端必须合理兜底

**问题**: v0.1.24 API 不返回 `is_public` 字段，升级后前端 `!undefined = true`，所有条目显示 "private" 标记

**原因**:
- 旧版 API 无 `is_public` 字段，返回 JSON 中无此 key
- 前端 `entry.is_public` 为 `undefined`
- `v-if="!entry.isPublic"` → `!undefined` → `true`，所有条目标记 private

**解决**:
```typescript
// client.ts: API 字段缺失时默认合理值
isPublic: entry.is_public ?? true,    // 缺失 = 公开（向后兼容）
ownerId: entry.owner_id ?? null,      // 缺失 = 无 owner
```

**预防**: 所有新增 API 字段在前端映射时，用 `??` 提供合理默认值
