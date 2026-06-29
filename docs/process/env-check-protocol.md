# PeekView 环境自检协议

> **用途**：任何新会话启动 Task 前，必须先完成此自检。所有项 PASS 才可进入 P1。
> **位置**：`AGENTS.md` 引用，Agent 启动时自动执行。

## 自检清单

按顺序执行，每项输出 ✅ PASS 或 ❌ FAIL + 原因。

### 0. 平台检测

Agent 启动时不知道自己在哪个平台，通过试探工具可用性判断：

```bash
# 检测是否在 OpenCode 环境
# OpenCode 有 Task 工具（subagent），Claude Code 有 Skill 工具
# 两个平台都有 Bash/Read/Write/Edit，无法区分
# 可靠判断方式：尝试调用各自特有的工具，看是否报错
```

**判断方法**：

| 试探 | OpenCode | Claude Code |
|------|----------|-------------|
| 调用 `Task` 工具（subagent_type: vision-helper） | ✅ 有 Task 工具 | ❌ 无此工具 |

**判断逻辑**：
1. 尝试 `Task` 工具（subagent_type: vision-helper）→ 成功 → **OpenCode**
2. `Task` 工具不可用 → **Claude Code**

> 注意：两个平台都有 `Skill` 工具，不能靠 Skill 区分。唯一可靠区分是 `Task` 工具（OpenCode 独有）。

**Vision 分析方式选择**：
- **OpenCode**：优先用 vision-helper subagent（Task 工具），备选 vision-analyze CLI
- **Claude Code**：用 vision-analyze CLI

### 1. 工具链可用性

```bash
# 1a. 后端 venv + pytest
cd backend && .venv/bin/python -m pytest --version

# 1b. 前端 node_modules + vitest + vue-tsc
cd frontend-v3 && npx vue-tsc --version && ./node_modules/.bin/vitest --version

# 1c. ruff lint
cd backend && python3 -m ruff --version

# 1d. MCP node_modules
ls packages/mcp-server/node_modules/.package-lock.json 2>/dev/null && echo "OK" || echo "npm ci needed"
```

### 2. 调试服务

```bash
# 2a. 停止旧实例
make debug-stop

# 2b. 构建前端 + 启动
make build-frontend && make debug-start

# 2c. 验证 API 响应
curl -sf http://127.0.0.1:8888/api/v1/entries?per_page=1 | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'items' in d; print('OK')"

# 2d. 验证数据隔离（debug DB，非生产）
sqlite3 /tmp/peekview-debug/peekview.db "PRAGMA integrity_check"
```

### 3. 版本一致性 + git 状态

```bash
# 3a. VERSIONS.json 与实际代码版本一致
cd backend && python3 -c "from peekview import __version__; print(__version__)" && \
cd /home/kity/oclab/peekview && python3 -c "import json; d=json.load(open('VERSIONS.json')); print(f'peekview={d[\"peekview\"]}, mcp={d[\"mcp_server\"]}')"

# 3b. git 工作目录干净（无未提交的改动）
git status --porcelain | head -5
# 期望：无输出。如有未提交改动，报告但不阻塞（仅提醒）
```

### 4. Playwright CDP + 截图 + Vision 分析（合并验证）

这一步验证完整的 Playwright 截图 → Vision 分析链路。

#### 4a. Chrome CDP 端口可达

```bash
curl -sf http://localhost:18800/json/version | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Chrome {d[\"Browser\"]}')"
```

如果 4a FAIL：报告 ❌ FAIL + "Chrome CDP 不可用"，跳到 4d。

#### 4b. Playwright 截图

**方式 A：playwright-vision skill**（Claude Code / OpenCode 通用，推荐）

1. 调用 `Skill("playwright-vision")` 加载 skill（两个平台都有 Skill 工具）
2. 按 skill 模板写 CDP 截图脚本，保存到 `/tmp/env-check/capture.ts`：
   - 连接 `http://localhost:18800`（CDP）
   - 导航到 `http://127.0.0.1:8888/explore`
   - Desktop 截图保存到 `/tmp/env-check/desktop.png`
   - Mobile 截图（CDP Emulation）保存到 `/tmp/env-check/mobile.png`
3. 执行：
```bash
mkdir -p /tmp/env-check
NODE_PATH=$(npm root -g) npx tsx /tmp/env-check/capture.ts
```

> ⚠️ 全局安装的 playwright 需要 `NODE_PATH=$(npm root -g)` 前缀，否则 tsx 找不到模块。
> 如果前端项目有本地 playwright（`frontend-v3/node_modules/playwright`），也可从该目录执行：`cd frontend-v3 && npx tsx /tmp/env-check/capture.ts`

**方式 B：手写脚本**（skill 不可用时的备选）

```typescript
// 保存到 /tmp/env-check/capture.ts
import { chromium } from 'playwright';
const hardTimer = setTimeout(() => process.exit(1), 30000);
(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:18800');
  const context = browser.contexts()[0] || await browser.newContext();
  const page = await context.newPage();
  try {
    // Desktop
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('http://127.0.0.1:8888/explore', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/env-check/desktop.png' });

    // Mobile
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
```

```bash
mkdir -p /tmp/env-check
NODE_PATH=$(npm root -g) npx tsx /tmp/env-check/capture.ts
```

#### 4c. Vision 分析

**方式 A：vision-analyze CLI**（Claude Code / 通用）

```bash
~/.claude/skills/vision-analyzer/scripts/vision-analyze.py \
  -i /tmp/env-check/desktop.png \
  -p "描述页面内容。能看到 PeekView 页面元素则输出 PASS，否则输出 FAIL"
```

验证输出含有效 YAML 且 `summary` 字段非空。

**方式 B：vision-helper subagent**（OpenCode 专用）

```
Task 工具调用：
  subagent_type: vision-helper
  prompt: "分析 /tmp/env-check/desktop.png，描述页面内容。能看到 PeekView 页面元素（header、内容区）则回复 PASS，否则回复 FAIL + 原因。"
```

#### 4d. Vision 降级检查（仅 4a FAIL 时执行）

```bash
grep VISION_API_KEY ~/.env 2>/dev/null && echo "Vision config exists" || echo "MISSING"
```

| 4a | 4b | 4c | 结果 |
|----|----|----|------|
| ✅ | ✅ | ✅ | 完整视觉验收能力可用 |
| ✅ | ✅ | ❌ | Vision API 问题，检查 ~/.env 配置（VISION_API_KEY / VISION_API_BASE_URL / VISION_MODEL） |
| ✅ | ❌ | — | Playwright 问题，报告 FAIL |
| ❌ | — | — | CDP 不可用，检查 Chrome 是否在 Windows GPU 运行；P6 降级为 DOM 验证 |

### 5. 移动端模拟能力（可选，涉及移动端 UI 的 Task 必检）

```typescript
// 追加到 capture.ts 或单独脚本
// 用 CDP Emulation.setDeviceMetricsOverride 模拟移动端
const client = await page.context().newCDPSession(page);
await client.send('Emulation.setDeviceMetricsOverride', {
  width: 390, height: 844, deviceScaleFactor: 3, mobile: true
});
```

如果步骤 4b 的 mobile 截图成功生成，此步自动 PASS。

## 自检结果处理

| 结果 | 动作 |
|------|------|
| 全部 ✅ | 继续进入 Task 的 P1 阶段 |
| 1-2 有 ❌ | 尝试自动修复（npm ci / make dev 等），修复后重跑对应项 |
| 3 有 ❌ | 版本不一致：报告但不阻塞（提醒修复）。git 脏：提醒但不阻塞 |
| 4 ❌ | P6 降级为 DOM 验证（无截图），报告降级原因 |
| 修复后仍 ❌ | 停下报告 [CAPABILITY_GAP]，等用户介入 |

## 快速版

**条件**：刚在同一会话内完成过完整自检，或只做后端改动不需要视觉验证。

执行 1-3 即可，跳过步骤 4-5。在 P0-brief 中记录"环境自检：快速版（1-3）"。
