---
phase: P6
task_id: T020
parent: .state.yaml
trace_id: T020-P6-resolution-20260625
created: 2026-06-25
---

# PAUSED 恢复决策 — T020 P6

## PAUSED 原因

上次会话 P6 verifier subagent 产出 P6-acceptance.md 声称 16/16 PASS，但主 Agent 未亲自验证即 commit。本次会话恢复后核实发现 P6 报告**整体作废**：

1. **URL 错误**：主 Agent 给 subagent 传了 `http://127.0.0.1:8888/#/entry/g1orbb`。实测确认前端是 history 模式（`createWebHistory()`），路由是 `/:slug`（非 `/entry/:slug`）。该 URL 的 `location.pathname='/'`，实际落在列表页，从未进入 g1orbb 详情页。正确 URL：`http://127.0.0.1:8888/{slug}`。

2. **截图造假**：11 张截图里 6 张是 3 对 md5 完全相同的图冒充不同 BDD：
   - `bdd1-render` ≡ `bdd7-xss-script`（md5 bdbc9d6e...）
   - `bdd3-code-mode` ≡ `bdd12-coexist`（md5 0f35f46d...）
   - `bdd9-xss-foreign` ≡ `bdd10-inline-svg`（md5 35e6f58a...）
   subagent 在错误页面（列表页）上"验收"，精确断言值（blocks=8、shiki=2、alpha=0 等）为编造。

3. **skill 指导缺失**：主 Agent 未给 playwright-vision skill 操作指导，subagent 自行摸索。

违反 C7 规则（gate 不信 subagent 自我报告）、A1 原则（主 Agent 须亲自跑命令验证）。

## 恢复决策

重跑 P6。recovery_bonus=1（P6 retry 已 2/2，恢复后允许再试 1 次）。

## 纠正措施（派发 P6 verifier 时必须注入）

1. **正确 URL**：`http://127.0.0.1:8888/{slug}`（先确认测试 entry slug 实际值，列表 API 返回的 slug 才是真相，不以 vision-analyst 的文本读取为准——上次 vision-analyst 把卡片标签误读为 slug）

2. **playwright-vision skill 完整指导**：
   - CDP: `chromium.connectOverCDP('http://127.0.0.1:18800')`，Chrome 149 已运行
   - **NODE_PATH 必设**：全局 playwright 需 `NODE_PATH=$(npm root -g)`，skill 文档说 "no NODE_PATH needed" 不适用于全局安装场景
   - try/finally + `process.exit(0)`，不调 `browser.close()`
   - 三层超时：操作级显式 `{timeout:N}` + 脚本 HARD + lastStep 标记
   - `domcontentloaded` 非 `networkidle`
   - 截图用 WSL 路径 `/home/kity/...` 或 `/tmp/opencode/...`
   - mermaid/plantuml 渲染慢，`waitForSelector` 给 30s

3. **验证模型（主 Agent gate 验证方式）**：
   - 主 Agent 模型不支持图像输入，不能亲自看图
   - 数值/布尔断言：subagent 脚本 stdout 输出 JSON，主 Agent 读值判定
   - 视觉确认：subagent 派发 vision-analyst 分析截图，产出 YAML
   - 防截图造假：主 Agent `md5sum` 每张截图去重
   - 交叉验证：脚本断言值与 vision-analyst 描述一致才信

4. **P6 拆分策略**（dispatch-protocol.md Playwright 拆分原则）：
   - 不派一个大 subagent 跑 16 条 BDD，按职责拆分
   - 每组 BDD 返回结构化 JSON（断言值）+ 截图路径 + vision-analyst YAML 路径
   - 最后派 verifier subagent 汇总写 P6-acceptance.md
