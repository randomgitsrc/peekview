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

**总结**: 好记性不如烂笔头，标准化流程避免重复踩坑。
