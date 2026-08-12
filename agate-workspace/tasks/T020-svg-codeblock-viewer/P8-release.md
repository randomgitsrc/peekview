---
phase: P8
task_id: T020
parent: P2-design.md
trace_id: T020-P8-20260625
role: implementer
created: 2026-06-25
---

# P8 发布准备 — T020 svg-codeblock-viewer

## 1. 版本号

| 包 | 旧版本 | 新版本 | bump 类型 |
|----|--------|--------|----------|
| peekview (PyPI) | 0.1.65 | **0.1.66** | patch（新功能，与历史一致） |
| frontend-v3 | 0.1.65 | **0.1.66** | 同步（不独立发版，构建产物进 backend/peekview/static/） |

bump 命令：
```bash
make bump-version NEW_VERSION=0.1.66
```
同步更新 `backend/peekview/__init__.py` / `backend/pyproject.toml` / `frontend-v3/package.json`（EntryListView 版本号从 package.json 自动注入，无需手改）。

## 2. packages 声明（对照 P2-design.md）

```yaml
packages:
  - frontend-v3          # 唯一改动包
  # 发版映射：frontend-v3 构建产物进 static/，由 peekview(PyPI) 包发布
  # P8 需 bump peekview 版本 + CHANGELOG（frontend-v3 不独立发版）
```

- **改动包**：frontend-v3（markdown 渲染层 + Shiki 语言加载 + mime 单测）
- **发布载体**：peekview（PyPI）—— frontend-v3 构建产物 `dist/*` 复制到 `backend/peekview/static/` 随 backend 包发布
- **多包发布**：否（单包）。MCP Server 不涉及（T020 未改 `packages/mcp-server/`，MCP 版本独立管理，本任务不 bump）

## 3. 变更提取（git log v0.1.65..HEAD）

T020 相关 commit（按时间倒序）：

| commit | 说明 | 阶段 |
|--------|------|------|
| 391d5fe6 | wf(T020-P7): 一致性检查通过 — 无 BLOCKER，2处NOTE | P7 |
| f290d748 | wf(T020-P6): 验收通过 — 16/16 BDD PASS | P6 |
| a2945978 | wf(T020-P6): PAUSED — 结果存疑，需新会话重验 | P6 |
| 002fdfd4 | wf(T020-P5): 验证通过 — 104 tests green + build + typecheck | P5 |
| c700351c | **feat(T020): svg 代码块一体化查看工具栏 — 渲染+toggle+复制+PNG透明+全屏** | P4 |
| ca593b28 | wf(T020-P3): TDD 红灯通过 — 12 failed 0 error | P3 |
| 98bb9ffd | wf(T020-P3): PAUSED | P3 |
| 61236292 | wf(T020-P3): PAUSED | P3 |
| 0a7ab969 | wf(T020-P2): 方案设计通过 | P2 |
| 1c011bed | wf(T020-P1): 需求基线通过 — 16 BDD | P1 |
| 0b062f2f | wf(T020-P0): 任务简报 | P0 |

功能 commit：`c700351c`（用户可见变更从这里来）。

> 注：`0caeb0ff` 是 T021 的 P0 简报，不属于 T020，不计入本次 CHANGELOG。

## 4. CHANGELOG 条目

以下内容**可直接粘贴**到 `CHANGELOG.md` 的 `## [Unreleased]` 之后、`## [0.1.65]` 之前（替换 `## [Unreleased]` 标题）：

```markdown
## [0.1.66] - 2026-06-25

### 新增

- T020: ` ```svg ` 代码块一体化查看工具栏 — markdown 中 ` ```svg ` 围栏代码块渲染为带工具栏的矢量图容器，对齐现有 mermaid/plantuml 体验
- T020: 图/码 toggle — 默认图形视图，可切换查看 Shiki 高亮的 SVG 源码（xml grammar，effectiveLang=xml 非 text）
- T020: 工具栏操作 — Copy Code（原始源码入剪贴板 + "✓ Copied!" 2s 反馈）、Download PNG（透明背景，不调 fillRect，canvas 默认 alpha=0）、Fullscreen modal（svg-pan-zoom 滚轮缩放 + 拖拽平移）
- T020: SvgDiagram.vue 新组件 — pan-zoom + fullscreen modal + 透明 PNG 导出（独立 exportSvgToPng，不复用 mermaid 白底逻辑）
- T020: useShiki.ts 注册 xml grammar（static import `shiki/langs/xml.mjs` + commonLangs 追加），svg 代码块 code-mode 走 Shiki 高亮

### 修复

- T020: 修复 `mime.spec.ts` 过时测试 — `guessMimeType('icon.svg')` 期望从 null 改为 `'image/svg+xml'`（自 e8069c6b 起实际返回此值，测试未跟上）

### 安全

- T020: ` ```svg ` 代码块内容单独 `DOMPurify.sanitize`（配置与全局末尾相同但调用独立，作用域隔离）— 剥除 `<script>`/`on*`/`<foreignObject>`/`javascript:` 引用，保留合法图形元素；不改全局 DOMPurify 配置，内联 `<svg>` 与独立 `.svg` 文件管线行为不变

### 验证

- 前端 104/104 单元测试通过（含 SvgBlock.spec.ts 新增组件测试）
- 前端构建 + vue-tsc typecheck 全绿
- Playwright 实跑 BDD 16/16 全部通过：渲染矢量图、图/码 toggle（Shiki 高亮）、Copy Code、透明 PNG（对角像素 alpha=0）、Fullscreen 缩放、XSS（script/on*/foreignObject/javascript: 剥除）、三管线共存（mermaid+plantuml+svg 互不干扰）、主题切换重挂载、尺寸回退
```

## 5. gate_commands（从 P2-design.md 读取）

```yaml
gate_commands:
  P5: "cd frontend-v3 && ./node_modules/.bin/vitest run --reporter=dot 2>&1 | tail -20"
  P5_build: "cd frontend-v3 && npm run build 2>&1 | tail -10"
  P5_typecheck: "cd frontend-v3 && npx vue-tsc --noEmit 2>&1 | tail -20"
  P6: "playwright-cdp skill 实跑 BDD-1..BDD-16，逐条截图取证"
```

P5/P6 均已通过（P5: 002fdfd4；P6: f290d748）。发布前重跑 P5 三命令确认无回归即可（P6 不重跑，已验收）。

## 6. 发布检查清单

### 6.1 版本号一致性

- [ ] `make bump-version NEW_VERSION=0.1.66` 执行
- [ ] `backend/peekview/__init__.py` → `__version__ = "0.1.66"`
- [ ] `backend/pyproject.toml` → `version = "0.1.66"`
- [ ] `frontend-v3/package.json` → `"version": "0.1.66"`
- [ ] `make check-version` 一致性检查通过

### 6.2 CHANGELOG / 文档

- [ ] `CHANGELOG.md` 粘贴 §4 条目（替换 `## [Unreleased]`）
- [ ] `INDEX.md` 版本号引用更新（如有）
- [ ] `make check-doc-sync` 通过
- [ ] `make update-docs`（如有可自动生成项）

### 6.3 构建与测试（重跑 gate 确认无回归）

- [ ] `cd frontend-v3 && ./node_modules/.bin/vitest run --reporter=dot` — 全绿
- [ ] `cd frontend-v3 && npm run build` — 成功（含 vue-tsc）
- [ ] `cd frontend-v3 && npx vue-tsc --noEmit` — 无错误
- [ ] `make build-frontend` — 成功（dist/* 复制到 backend/peekview/static/）

### 6.4 预发布检查

- [ ] `make pre-publish-quick`（或 `make pre-publish` 完整检查）通过
- [ ] `make check-changelog` 通过

### 6.5 发布执行（由用户决定时机）

- [ ] `make publish` — 发布到 PyPI
- [ ] `pip index versions peekview` — 确认 PyPI 出现 0.1.66
- [ ] `git tag -a v0.1.66 -m "Release v0.1.66" && git push origin v0.1.66`
- [ ] `pipx upgrade peekview && peekview --version` — 确认 0.1.66
- [ ] **⚠️ 用户手动** `sudo systemctl restart peekview`（禁止自动化，见 release.md §5.5）
- [ ] `curl -s http://127.0.0.1:8080/health` — 确认 version=0.1.66
- [ ] 生产数据库无测试数据污染（`curl -s http://127.0.0.1:8080/api/v1/entries | jq '.total'`）

### 6.6 MCP Server（本任务不涉及）

- T020 未改 `packages/mcp-server/`，**不 bump** MCP 版本，不发布 npm。
- 主线 `bump-version` 不会碰 MCP package.json（doc-sync 脚本已移除 MCP 同步条目）。

## 7. 完成标志

- [x] P2 声明的每个 package 都有 CHANGELOG 更新 + 版本 bump 建议（frontend-v3 → 随 peekview 0.1.66 发布）
- [x] commit message 列出变动文件（c700351c 已含 feat 描述）
- [x] gate_commands 从 P2 读取并记录
- [x] 无 SCOPE_GAP（prompt 覆盖 P2 声明的 frontend-v3，无遗漏包）

## 8. Lessons Learned

1. **[安全]** SVG 代码块单独 `DOMPurify.sanitize` 而非依赖全局末尾 sanitize — mount point 是空 div，Vue 组件 v-html 注入的内容不经全局 sanitize 作用域。作用域隔离确保改 svg 分支不影响内联 `<svg>` 管线（BDD-10/14）。（来源：T020 / 2026-06-25）
2. **[架构]** 主题切换触发 v-html 整体替换 DOM 会销毁旧 Vue 组件实例 — 镜像 mermaid 的 `dataset.rendered` 清理 + 跳过机制 + 组件 `svg-refresh` 事件监听是必须的，否则 pan-zoom 实例残留失效。（来源：T020 / 2026-06-25）
3. **[流程]** P2 设计阶段对 DOMPurify 配置做"最小验证"（实跑探针 6 项）后再定方案，避免凭直觉加 `FORBID_TAGS` 导致波及内联 svg 管线 — 设计阶段实跑验证配置够用是减少返工的关键。（来源：T020 / 2026-06-25）
