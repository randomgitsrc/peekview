# PeekView 环境自检协议

> **用途**：任何新会话启动 Task 前，必须先完成此自检。所有项 PASS 才可进入 P1。
> **位置**：`AGENTS.md` 引用，Agent 启动时自动执行。

## 自检清单

按顺序执行，每项输出 ✅ PASS 或 ❌ FAIL + 原因。

### 1. 工具链可用性

```bash
# 1a. 后端 venv + pytest
cd backend && .venv/bin/python -m pytest --version

# 1b. 前端 node_modules + vitest + vue-tsc
cd frontend-v3 && npx vue-tsc --version && ./node_modules/.bin/vitest --version

# 1c. ruff lint（不在 venv 时用 python3 -m）
cd backend && python3 -m ruff --version

# 1d. MCP 构建
ls packages/mcp-server/node_modules/.package-lock.json 2>/dev/null && echo "OK" || echo "npm ci needed"
```

### 2. 调试服务（make debug）

```bash
# 2a. 停止旧实例
make debug-stop

# 2b. 构建前端 + 启动
make build-frontend && make debug-start

# 2c. 验证服务响应
curl -sf http://127.0.0.1:8888/api/v1/entries?per_page=1 | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'items' in d; print('OK')"

# 2d. 验证数据隔离（debug DB，非生产）
sqlite3 /tmp/peekview-debug/peekview.db "PRAGMA integrity_check"
```

### 3. Playwright CDP 连接

```bash
# 3a. Chrome CDP 端口可达
curl -sf http://localhost:18800/json/version | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Chrome {d[\"Browser\"]}')" 
```

如果 3a FAIL：
- 检查 Chrome 是否在 Windows GPU 机器上运行
- 报告 ❌ FAIL + "Chrome CDP 不可用，P6 视觉验收无法执行"

### 4. Vision 分析能力

**4a. vision-helper subagent**（推荐）：
```
Task 工具调用：
  subagent_type: vision-helper
  prompt: "确认你能读取图片文件。回复 OK。"
```
如果返回包含 "OK" → ✅ PASS

**4b. 备选 CLI 验证**：
```bash
python3 ~/.claude/skills/vision-analyzer/scripts/vision-analyze.py -i /tmp/test.png -p "test" 2>&1 | head -1
```
需要先创建测试截图：用 Playwright 截任意页面到 /tmp/test.png

**4c. 配置检查**：
```bash
grep VISION_API_KEY ~/.env && echo "OK" || echo "MISSING"
```

如果 4a/4b/4c 全 FAIL → 报告 ❌ FAIL + "Vision 分析不可用，P6 视觉验收降级为 DOM 验证"

### 5. Playwright 截图端到端验证

用 Playwright 连接 CDP，截图 + vision 分析，完整链路验证：

```typescript
// 保存到 /tmp/env-check/capture.ts
import { chromium } from 'playwright';
const hardTimer = setTimeout(() => process.exit(1), 30000);
(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:18800');
  const context = browser.contexts()[0] || await browser.newContext();
  const page = await context.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('http://127.0.0.1:8888/explore', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/env-check/explore.png' });
    console.log('✅ Playwright 截图成功');
  } finally {
    await page.close();
    clearTimeout(hardTimer);
    process.exit(0);
  }
})();
```

```bash
mkdir -p /tmp/env-check
NODE_PATH=/home/kity/.nvm/versions/node/v24.15.0/lib/node_modules npx tsx /tmp/env-check/capture.ts
```

然后 vision-helper 分析截图：
```
Task 工具调用：
  subagent_type: vision-helper
  prompt: "分析 /tmp/env-check/explore.png，描述页面内容。如果能看到 PeekView 页面元素则回复 PASS，否则回复 FAIL。"
```

## 自检结果处理

| 结果 | 动作 |
|------|------|
| 全部 ✅ | 继续进入 Task 的 P1 阶段 |
| 1-4 有 ❌ | 尝试自动修复（npm ci / make dev 等），修复后重跑对应项 |
| 5 ❌ 但 1-4 ✅ | 降级：P6 用 DOM 验证代替视觉验证，报告降级原因 |
| 修复后仍 ❌ | 停下报告 [CAPABILITY_GAP]，等用户介入 |

## 快速版（跳过完整 E2E 验证）

如果只是快速检查环境可用性（不需要截图验证），执行 1-4 即可，跳过第 5 步。
