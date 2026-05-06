# PeekView 调试工作流程

> 标准调试流程 - 确保调试服务与 pipx 正式服务并存，E2E 测试通过后再发布

## 核心原则

1. **服务隔离**: 调试服务使用独立端口（8888），与 pipx 正式服务（默认 8080）并存
2. **状态新鲜**: 每次调试前必须重新构建前端静态文件
3. **E2E 验证**: 调试必须通过 Playwright E2E 测试
4. **用户确认**: 经用户确认无问题后，才进入发布流程

## 快速开始

```bash
# 一键启动调试（构建 + 启动服务 + 运行 E2E 测试）
make debug

# 或分步执行
make debug-build    # 步骤1: 构建并检查
make debug-start    # 步骤2: 启动调试服务
make debug-test     # 步骤3: 运行 E2E 测试
```

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
PEEKVIEW_DATA_DIR=/tmp/peekview-debug/data \
PEEKVIEW_DB_PATH=/tmp/peekview-debug/peek.db \
  uvicorn peekview.main:get_app --host 127.0.0.1 --port 8888 --factory --reload
```

**关键参数**:
- `--port 8888`: 避免与 pipx 服务（8080）冲突
- `--reload`: 开发模式，代码变更自动重启
- `PEEKVIEW_DATA_DIR=/tmp/...`: 使用临时数据目录，不污染生产数据

### 步骤 3: E2E 测试

```bash
# 运行完整 E2E 测试（Mermaid + 分页器 + 核心功能）
make debug-test

# 或单独测试 Mermaid
npx playwright test e2e/mermaid-full-test.ts

# 或带 UI 调试
npx playwright test --ui
```

**必须通过的测试**:
- [ ] `mermaid-full-test.ts` - SVG 填满容器、切换不丢失、Fullscreen 正常
- [ ] `pagination.spec.ts` - 页码跳转、快速跳转输入框
- [ ] `viewer.spec.ts` - 代码高亮、Markdown 渲染

### 步骤 4: 用户验证

1. 访问 `http://127.0.0.1:8888/entries/demo` 或创建的测试条目
2. 验证修改的功能点
3. 用户确认 **"没问题"** 后，进入发布流程

### 步骤 5: 清理与发布

```bash
# 停止调试服务
make debug-stop

# 执行发布流程（如果用户已确认）
make pre-publish
make publish
```

## 调试检查清单

### 修改前
- [ ] 理解需求，明确修改范围
- [ ] 确定需要 E2E 测试覆盖的场景

### 修改中
- [ ] 前端代码修改后必须重新构建
- [ ] 每次测试前确认 static/ 是最新的

### 修改后
- [ ] 通过 E2E 自动化测试
- [ ] 用户手动验证通过
- [ ] 确认可以进入发布流程

## 常见问题

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
| `make debug` | 完整调试流程（构建+启动+测试）|
| `make debug-build` | 构建并验证 |
| `make debug-start` | 启动调试服务（端口 8888）|
| `make debug-stop` | 停止调试服务 |
| `make debug-test` | 运行 E2E 测试 |
| `make pre-publish` | 预发布检查 |
| `make publish` | 发布到 PyPI |

---

**经验总结**:

1. **永远不要假设 static/ 是最新的** - Vite 生成带 hash 的文件名，必须重新构建
2. **E2E 测试是最后一道防线** - 手动测试容易遗漏边界情况
3. **调试服务和正式服务并存** - 用不同端口，不互相干扰
4. **用户确认是发布前提** - 自动化测试通过 ≠ 用户体验 OK
