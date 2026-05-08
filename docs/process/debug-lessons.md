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

# 启动命令
cd backend
PEEKVIEW_DATA_DIR=/tmp/peekview-debug/data \
PEEKVIEW_DB_PATH=/tmp/peekview-debug/peek.db \
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

### 教训 6: 网络不稳定时的发布流程

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
