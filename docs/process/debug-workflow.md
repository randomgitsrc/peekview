# PeekView 调试工作流程

> 标准调试流程 - 确保调试服务与 pipx 正式服务并存，E2E 测试通过后再发布

## 核心原则

1. **服务隔离**: 调试服务使用独立端口（8888），与 pipx 正式服务（默认 8080）并存
2. **状态新鲜**: 每次调试前必须重新构建前端静态文件
3. **E2E 验证**: 调试必须通过 Playwright E2E 测试
4. **用户确认**: 经用户确认无问题后，才进入发布流程

## 快速开始

```bash
# 一键完整调试（推荐）
make debug

# 或分步执行（推荐用于问题排查）
make debug-build       # 步骤1: 构建并检查 static 文件
make debug-start       # 步骤2: 启动调试服务 (:8888)
make debug-verify-isolation  # 步骤3: 验证数据隔离（v0.1.22+ 新增！）
make debug-test        # 步骤4: 运行 E2E 测试（自动创建测试数据）
# 步骤5: 用户人工验证 http://127.0.0.1:8888
make debug-stop        # 步骤6: 停止调试服务（自动清理数据）
```

**⚠️ 重要: 数据隔离验证必须通过**
- `make debug` 会自动执行 `debug-verify-isolation`
- 如果显示 "✗ 警告: 调试服务可能使用生产数据库"，立即停止！
- 检查 `scripts/dev-server.sh` 的环境变量配置

**⚠️ 重要: E2E 测试必须手动触发**
- `make debug` 包含 `debug-test`
- 但 **E2E 测试必须在服务启动后运行**
- 如果单独运行 `make debug-start`，稍后需要手动运行 `make debug-test`
- **严禁跳过 E2E 直接发布！**

## 详细流程

### 步骤 1: 准备（文件状态检查）

```bash
# 1.1 清理旧构建
make clean

# 1.2 重新构建前端（确保 static/ 最新）
make build-frontend

# 1.3 验证构建结果
ls -la backend/peekview/static/index.html
ls -la backend/peekview/static/assets/ | head -5
```

**检查点**:
- [ ] `static/index.html` 时间戳是最新的
- [ ] `static/assets/` 下有新的 JS/CSS 文件（带 hash）
- [ ] 文件数量和 `frontend-v3/dist/` 一致

### 步骤 2: 启动调试服务

```bash
# 使用 debug 目标（端口 8888，自动检查端口占用）
make debug-start
```

或手动启动（确保环境隔离）：

```bash
cd backend
# ⚠️ 必须使用 PEEKVIEW_STORAGE__ 前缀（嵌套配置）
PEEKVIEW_STORAGE__DATA_DIR=/tmp/peekview-debug/data \
PEEKVIEW_STORAGE__DB_PATH=/tmp/peekview-debug/peek.db \
  uvicorn peekview.main:get_app --host 127.0.0.1 --port 8888 --factory --reload
```

**关键参数**:
- `--port 8888`: 避免与 pipx 服务（8080）冲突
- `--reload`: 开发模式，代码变更自动重启
- `PEEKVIEW_STORAGE__DATA_DIR`: 使用临时数据目录（注意 `__` 分隔符）

### 步骤 2.5: 数据隔离验证（v0.1.22 教训）

**必须在 E2E 测试前执行！**

```bash
# 自动验证（推荐）
make debug-verify-isolation

# 或手动验证
# 1. 检查调试环境条目数（应为 0 或测试数据）
curl -s http://127.0.0.1:8888/api/v1/entries | jq '.total'

# 2. 检查生产环境条目数（应保持不变）
curl -s http://127.0.0.1:8080/api/v1/entries | jq '.total'

# 3. 确认数据库文件位置
lsof -p $(pgrep -f "uvicorn peekview.main.*8888" | head -1) | grep peekview.db
# 期望: /tmp/peekview-debug/peekview.db
```

**检查点**:
- [ ] 调试环境条目数与生产环境不同
- [ ] 数据库路径包含 `/tmp/peekview-debug/`
- [ ] `make debug-verify-isolation` 输出 "✓ 数据隔离验证通过"

### 步骤 4: E2E 测试

**前提**: 数据隔离验证通过

```bash
# 运行完整 E2E 测试（自动创建测试数据，测试核心功能）
make debug-test
```

**测试内容** (e2e/debug-server.spec.ts):
- ✅ 服务健康检查
- ✅ 代码条目创建和查看
- ✅ **Mermaid 图表渲染和填满容器**
- ✅ **Mermaid Code/Diagram 切换不丢失**
- ✅ **Mermaid Fullscreen 铺满窗口**
- ✅ **分页器页码显示和跳转**
- ✅ 主题切换
- ✅ 移动端布局

**测试结果位置**:
- 截图: `/tmp/e2e-results/*.png`
- Playwright 报告: `frontend-v3/playwright-report/`

**如果测试失败**:
```bash
# 查看失败截图
ls -la /tmp/e2e-results/

# 带 UI 模式运行（可手动查看）
cd frontend-v3
BASE_URL=http://127.0.0.1:8888 npx playwright test --ui
```

### 步骤 5: 用户验证

1. 访问 `http://127.0.0.1:8888/entries/demo` 或测试创建的条目
2. 验证修改的功能点
3. 用户确认 **"没问题"** 后，进入发布流程

**注意**: E2E 测试通过 ≠ 用户体验 OK，必须人工确认！

### 步骤 6: 清理与发布

```bash
# 停止调试服务（自动清理 /tmp/peekview-debug/）
make debug-stop

# 执行发布流程（如果用户已确认）
make pre-publish
make publish
```

**清理后验证**:
```bash
# 确认生产数据完整
curl -s http://127.0.0.1:8080/api/v1/entries | jq '.total'
# 应与调试前数量一致
```

## 调试检查清单

### 修改前
- [ ] 理解需求，明确修改范围
- [ ] 确定需要 E2E 测试覆盖的场景

### 修改中
- [ ] 前端代码修改后必须重新构建
- [ ] 每次测试前确认 static/ 是最新的

### 修改后
- [ ] **数据隔离验证**: `make debug-verify-isolation` 通过
- [ ] E2E 自动化测试通过
- [ ] 用户手动验证通过
- [ ] 确认可以进入发布流程

## 常见问题

### Q: 调试服务使用了生产数据库
```bash
# 症状: 调试环境显示了生产数据
# 原因: 环境变量名错误

# 检查当前使用的数据库
lsof -p $(pgrep -f "uvicorn peekview.main.*8888" | head -1) | grep peekview.db

# 错误输出: /home/user/.peekview/peekview.db （污染！）
# 正确输出: /tmp/peekview-debug/peekview.db （隔离）

# 修复: 使用正确的环境变量名
# ❌ 错误
PEEKVIEW_DB_PATH=/tmp/peekview-debug/peek.db
PEEKVIEW_DATA_DIR=/tmp/peekview-debug/data

# ✅ 正确（使用 __ 分隔符）
PEEKVIEW_STORAGE__DB_PATH=/tmp/peekview-debug/peek.db
PEEKVIEW_STORAGE__DATA_DIR=/tmp/peekview-debug/data
```

### Q: 调试服务启动失败（端口被占用）
```bash
# 查找占用 8888 的进程
lsof -i :8888

# 停止之前的调试服务
make debug-stop

# 或强制终止
pkill -f "uvicorn peekview.main.*8888"
```

### Q: 静态文件不是最新的
```bash
# 确保先清理再构建
make clean && make build-frontend

# 验证 index.html 引用的 JS 存在
grep -o 'assets/[^"]*\.js' backend/peekview/static/index.html
ls backend/peekview/static/assets/ | grep index
```

### Q: E2E 测试失败但浏览器看起来正常
```bash
# 查看测试截图
ls /tmp/mermaid-test-results/

# 带 UI 模式运行，手动观察
npx playwright test --ui

# 或生成 HTML 报告
npx playwright test --reporter=html
```

### Q: pipx 服务影响了调试
```bash
# 检查端口占用
ps aux | grep peekview

# pipx 服务应该运行在 8080
# 调试服务运行在 8888
# 两者互不干扰
```

## 与发布流程的关系

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  代码修改   │ →  │  调试验证   │ →  │  发布流程   │
│  (本地开发) │    │  (E2E+人工) │    │  (PyPI)     │
└─────────────┘    └─────────────┘    └─────────────┘
                         ↓
                   用户确认 "没问题"
```

**严禁跳过调试直接发布！**

## 关键命令速查

| 命令 | 用途 |
|------|------|
| `make debug` | 完整调试流程（构建+启动+验证隔离+测试）|
| `make debug-build` | 构建并验证 |
| `make debug-start` | 启动调试服务（端口 8888）|
| `make debug-verify-isolation` | **验证数据隔离（v0.1.22+）** |
| `make debug-stop` | 停止调试服务（清理数据）|
| `make debug-test` | 运行 E2E 测试 |
| `make debug-status` | 检查调试服务状态 |
| `make pre-publish` | 预发布检查 |
| `make publish` | 发布到 PyPI |

---

**经验总结**:

1. **永远不要假设 static/ 是最新的** - Vite 生成带 hash 的文件名，必须重新构建
2. **E2E 测试是最后一道防线** - 手动测试容易遗漏边界情况
3. **调试服务和正式服务并存** - 用不同端口，不互相干扰
4. **用户确认是发布前提** - 自动化测试通过 ≠ 用户体验 OK
