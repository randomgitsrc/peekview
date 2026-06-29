# PeekView 环境自检协议

> **用途**：任何新会话启动 Task 前，必须先完成此自检。所有项 PASS 才可进入 P1。
> **位置**：`AGENTS.md` 引用，Agent 启动时自动执行。

## 步骤 0：声明平台

Agent 在自己的运行环境中，直接声明平台（不需要试探）：

- **OpenCode**：有 `Task` 工具（可派发 subagent）、有 `Skill` 工具、有 `skill` 工具（小写，等同）
- **Claude Code**：有 `Skill` 工具、有 `Bash` 工具，无 `Task` 工具

记录 `平台: OpenCode` 或 `平台: Claude Code`，后续步骤根据此结果选方式。

## 步骤 1：工具链可用性

```bash
# 1a. 后端 venv + pytest
cd backend && .venv/bin/python -m pytest --version

# 1b. 前端 node_modules + vitest + vue-tsc
cd frontend-v3 && npx vue-tsc --version && ./node_modules/.bin/vitest --version

# 1c. ruff lint
cd backend && python3 -m ruff --version

# 1d. MCP node_modules
ls packages/mcp-server/node_modules/.package-lock.json 2>/dev/null && echo "OK" || echo "npm ci needed"

# 1e. 全局 skill 目录（playwright-vision / vision-analyzer 等）
ls ~/.config/opencode/skills/ 2>/dev/null || echo "no global skills"
ls .opencode/skills/ 2>/dev/null || echo "no project skills"
```

## 步骤 2：调试服务

```bash
# 2a. 停止旧实例
make debug-stop

# 2b. 构建前端（如 static/index.html 已存在且代码无改动，可跳过 build）
ls backend/peekview/static/index.html 2>/dev/null && echo "static exists, skip build" || make build-frontend

# 2c. 启动调试服务
make debug-start

# 2d. 验证 API 响应
curl -sf http://127.0.0.1:8888/api/v1/entries?per_page=1 | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'items' in d; print('OK')"

# 2e. 验证数据隔离（debug DB，非生产）
sqlite3 /tmp/peekview-debug/peekview.db "PRAGMA integrity_check"
```

## 步骤 3：版本一致性 + git 状态

```bash
# 3a. VERSIONS.json 与实际代码版本一致
cd backend && python3 -c "from peekview import __version__; print(__version__)" && \
cd /home/kity/oclab/peekview && python3 -c "import json; d=json.load(open('VERSIONS.json')); print(f'peekview={d[\"peekview\"]}, mcp={d[\"mcp_server\"]}')"

# 3b. git 工作目录状态
git status --porcelain | head -5
# 期望：无输出。如有未提交改动，报告但不阻塞（仅提醒）
```

## 步骤 4：Playwright CDP + 截图 + Vision 分析

### 4a. Chrome CDP 端口可达

```bash
curl -sf http://localhost:18800/json/version | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Chrome {d[\"Browser\"]}')"
```

4a FAIL → 跳到 4d。

### 4b. Playwright 截图

先加载 `playwright-vision` skill（获取规范和模板），再按规范写脚本执行：

```
Skill 工具调用：skill("playwright-vision")
```

按 skill 规范写截图脚本（hardTimer + lastStep + try/finally + process.exit(0)），保存到 `/tmp/env-check/capture.ts`：

```typescript
import { chromium } from 'playwright';
const HARD = 30_000;
let lastStep = 'init';
const hardTimer = setTimeout(() => {
  console.error(`HARD TIMEOUT at: ${lastStep}`);
  process.exit(2);
}, HARD);
(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:18800');
  const context = browser.contexts()[0] ?? await browser.newContext();
  const page = await context.newPage();
  try {
    lastStep = 'goto';
    await page.goto('http://127.0.0.1:8888/explore', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1000);
    lastStep = 'screenshot-desktop';
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: '/tmp/env-check/desktop.png' });
    lastStep = 'screenshot-mobile';
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/env-check/mobile.png' });
    console.log('✅ Playwright screenshot OK');
  } finally {
    await page.close();
    clearTimeout(hardTimer);
    process.exit(0);
  }
})();
main().catch((e) => { console.error(e); process.exit(1); });
```

```bash
mkdir -p /tmp/env-check
# NODE_PATH：优先 nvm 全局目录，其次 npm root -g
NODE_PATH=/home/kity/.nvm/versions/node/v24.15.0/lib/node_modules npx tsx /tmp/env-check/capture.ts
# 如果上面报 "Cannot find module 'playwright'"，尝试：
# NODE_PATH=$(npm root -g) npx tsx /tmp/env-check/capture.ts
```

### 4c. Vision 分析

**OpenCode**：vision-helper subagent
```
Task 工具调用：
  subagent_type: vision-helper
  prompt: "分析 /tmp/env-check/desktop.png。检查以下 3 点：1) 页面顶部有 PeekView logo 和导航 2) 搜索框可见 3) 有内容区域。全部满足回复 PASS，任一不满足回复 FAIL + 具体哪项失败。"
```

**Claude Code**：vision-analyze CLI
```bash
python3 ~/.claude/skills/vision-analyzer/scripts/vision-analyze.py \
  -i /tmp/env-check/desktop.png \
  -p "检查：1) 页面顶部有 PeekView logo 2) 搜索框可见 3) 有内容区域。全部满足输出 PASS，否则 FAIL"
```

### 4d. Vision 降级检查（仅 4a FAIL 时执行）

```bash
grep VISION_API_KEY ~/.env 2>/dev/null && echo "Vision config exists" || echo "MISSING"
```

| 4a | 4b | 4c | 结果 |
|----|----|----|------|
| ✅ | ✅ | ✅ | 完整视觉验收能力可用 |
| ✅ | ✅ | ❌ | Vision API 问题，检查 ~/.env 配置（VISION_API_KEY / VISION_API_BASE_URL / VISION_MODEL） |
| ✅ | ❌ | — | Playwright 问题，报告 FAIL |
| ❌ | — | — | CDP 不可用，检查 Chrome 是否在 Windows GPU 运行；P6 降级为 DOM 验证 |

## 步骤 5：移动端模拟能力（可选，涉及移动端 UI 的 Task 必检）

步骤 4b 的 mobile 截图已包含移动端模拟。验证截图存在即可：

```bash
ls -la /tmp/env-check/mobile.png
```

如需 CDP `Emulation.setDeviceMetricsOverride` 精细模拟（touch、userAgent），参考 playwright-vision skill 的 Mobile Emulation 章节。

## 自检结果处理

| 结果 | 动作 |
|------|------|
| 全部 ✅ | 继续进入 Task 的 P1 阶段 |
| 1-2 有 ❌ | 尝试自动修复（npm ci / make dev / make build-frontend 等），修复后重跑对应项 |
| 3 有 ❌ | 版本不一致：报告但不阻塞（提醒修复）。git 脏：提醒但不阻塞 |
| 4 ❌ | P6 降级为 DOM 验证（无截图），报告降级原因 |
| 修复后仍 ❌ | 停下报告 [CAPABILITY_GAP]，等用户介入 |

## 快速版

**条件**：刚在同一会话内完成过完整自检，或只做后端改动不需要视觉验证。

执行 1-3 即可，跳过步骤 4-5。在 P0-brief 中记录"环境自检：快速版（1-3）"。
