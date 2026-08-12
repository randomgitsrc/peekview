---
phase: P5
task_id: T017
task_name: theme-media-query-fix
type: test_results
trace_id: T017-P5-2026-06-21
created: 2026-06-21
status: pass
parent: docs/tasks/T017-theme-media-query-fix/P0-brief.md
---

# P5 技术验证报告：主题切换 @media 冲突修复

## 验证总结

| # | 验证项 | 命令 | 结果 |
|---|--------|------|------|
| 1 | 前端单元测试（store 层回归守护） | `cd frontend-v3 && npx vitest run src/composables/__tests__/theme.spec.ts` | ✅ 12/12 通过 |
| 2 | 前端构建（含 typecheck） | `cd frontend-v3 && npm run build` | ✅ built in 13.52s，无 typecheck 错误 |
| 3 | 真实 CSP 下 Playwright 主题场景验证 | `make debug-start` + Playwright `emulateMedia` | ✅ 3/3 场景通过（含核心 bug 场景） |
| 4 | Vision 截图确认 | vision-helper 分析 `/tmp/p5-sys-dark-light.png` | ✅ 整体 light 一致，无割裂 |
| 5 | 生产隔离检查 | 所有验证在 `/tmp/peekview-debug/` 进行 | ✅ 无 `[PROD_TOUCHED]` |

**结论：P5 通过。** gate_commands 全绿，核心 bug 场景（系统黑夜 + `data-theme=light` → 内容区 light）已闭环，可进入 P6 验收。

## 逐项验证结果

### 1. 前端单元测试

- **命令**：`cd frontend-v3 && npx vitest run src/composables/__tests__/theme.spec.ts`
- **结果**：12/12 通过
- **覆盖范围**：P3 声明的 5 个 TC（TC-01 ~ TC-05），其中部分含子用例，合计 12 个断言点
- **意义**：store 层（`getInitialTheme` / `setTheme` / `toggle`）逻辑正确，P4 patch CSS 未误改 store
- **门槛判定**：✅ 符合 P3 预期"全绿回归守护"

### 2. 前端构建（含 typecheck）

- **命令**：`cd frontend-v3 && npm run build`
- **结果**：`✓ built in 13.52s`，无 typecheck 错误，无 warning
- **意义**：patch 后的 `github-markdown.css` 可被 Vite 正确打包，前端构建产物可随主包发布
- **门槛判定**：✅ gate_command 通过

### 3. 真实 CSP 下 Playwright 主题场景验证（核心）

- **环境**：`make debug-start`（`127.0.0.1:8888`，真实 CSP `script-src 'self' 'unsafe-eval'`）
- **测试方法**：`page.emulateMedia({ colorScheme: 'dark' })` 模拟系统黑夜 + `localStorage` 设置 `data-theme`
- **观测点**：内容区（`.markdown-body`）背景色

| 场景 | data-theme | 系统偏好 | 内容区背景色 | 预期 | 结果 |
|------|-----------|---------|-------------|------|------|
| 1（核心 bug） | light | dark | `rgb(255,255,255)` | 白色 | ✅ |
| 2 | dark | dark | `rgb(13,17,23)` | 黑色 | ✅ |
| 3 | dark | light | `rgb(13,17,23)` | 黑色 | ✅ |

- **意义**：
  - 场景 1 直接复现用户报告的 bug 触发条件（系统黑夜 + 用户切 light），验证 patch 后 `@media (prefers-color-scheme: dark)` 不再越权覆盖 `.markdown-body`
  - 场景 2/3 验证 `data-theme=dark` 选择器命中正常，与系统偏好解耦
- **门槛判定**：✅ 核心 bug 场景闭环

### 4. Vision 截图确认

- **截图**：`/tmp/p5-sys-dark-light.png`（场景 1：系统黑夜 + light 模式）
- **vision 结论**：整体 light 主题一致，无割裂感
- **意义**：背景色数值之外，视觉层面确认代码块、图表等子组件未出现暗色残留（BDD-4/5 的预验）
- **门槛判定**：✅ bug 已闭环

### 5. 生产隔离检查

- 所有验证在 `/tmp/peekview-debug/`（`PEEKVIEW_DEBUG_MODE=1` 自动隔离目录）进行
- 未触碰 `~/.peekview/peekview.db`（生产数据库）
- 未触碰 `:8080` 正式服务
- **门槛判定**：✅ 无 `[PROD_TOUCHED]`

## BDD 覆盖对照

| BDD | P5 覆盖情况 | 说明 |
|-----|------------|------|
| BDD-1（系统黑夜 + light → light） | ✅ 场景 1 实跑 + vision 确认 | 核心 bug 场景，闭环 |
| BDD-2（系统白天 + dark → dark） | ✅ 场景 3 实跑 | 反向场景，闭环 |
| BDD-3（切换后即时跟随） | ⚠️ P5 未实跑切换动作 | 移交 P6：Playwright 实跑 toggle 动作 + 截图对比 |
| BDD-4（Shiki 跟随 data-theme） | ⚠️ P5 仅 vision 预验 | 移交 P6：含代码块 entry 的 vision 精细对比 |
| BDD-5（Mermaid/PlantUML 跟随） | ⚠️ P5 未覆盖 | 移交 P6：含图表 entry 的 vision 对比 |
| BDD-6（无 data-theme 默认 light） | ⚠️ P5 未覆盖 | 移交 P6：清空 data-theme 属性的兜底场景 |

**说明**：P5 的核心使命是"gate_commands 全绿 + 核心场景预验"，BDD-3/4/5/6 的完整实跑属 P6 验收职责。P5 已通过场景 1（BDD-1）证明 patch 技术路径正确，剩余 BDD 在 P6 用 Playwright 逐条实跑。

## 结论

**status: pass**

- ✅ gate_commands 全绿（vitest + build）
- ✅ 核心 bug 场景（系统黑夜 + light）技术路径已验证
- ✅ vision 确认无视觉割裂
- ✅ 生产隔离无触碰
- ⚠️ BDD-3/4/5/6 完整实跑移交 P6（按 P1 裁剪计划，P6 不可跳）

**可进入 P6 验收。**
