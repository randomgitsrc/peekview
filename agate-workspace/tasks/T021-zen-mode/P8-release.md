---
phase: P8
task_id: T021
task_name: zen-mode
type: release
parent: P6-acceptance.md
trace_id: T021-P8-20260625
status: draft
created: 2026-06-25
---

# P8 发布准备 — T021 zen-mode

## 包声明（P2）

| 包 | 旧版本 | 新版本 | 验证命令 | 结果 |
|---|--------|--------|----------|------|
| frontend-v3 | 0.1.66 | 0.1.67 | `cd frontend-v3 && npm run build` | ✅ PASS |

> P2 packages: [frontend-v3]，仅前端功能，无后端/MCP 变更。

## 版本 Bump

- 命令: `make bump-version NEW_VERSION=0.1.67`
- 更新文件:
  - `backend/peekview/__init__.py`: 0.1.66 → 0.1.67
  - `backend/pyproject.toml`: 0.1.66 → 0.1.67
  - `frontend-v3/package.json`: 0.1.66 → 0.1.67
  - `VERSIONS.json`: peekview 0.1.66 → 0.1.67
  - `README.md`, `CLAUDE.md`, `INDEX.md`, `docs/roadmap/improvement-backlog.md`: 版本号引用同步
- 前端自动构建 + 静态文件复制到 `backend/peekview/static/`
- Commit: `bb5a505a chore(release): bump to v0.1.67`
- Tag: `v0.1.67`

## CHANGELOG

[0.1.67] 条目已填写，包含：

### 新增
- T021: Zen mode — 按 `f` 键进入沉浸阅读模式，隐藏 header/sidebar/mobile-actions，content-area 占满视口；按 `f` 或 `Esc` 退出
- T021: 焦点重定向 — 进入 zen 时若焦点在被隐藏元素内，自动重定向到 `.content-area`（tabindex=-1）
- T021: aria-live 通知 — zen 状态切换时屏幕阅读器播报
- T021: 输入框焦点排除 — INPUT/TEXTAREA/contenteditable/模态对话框内按 `f` 不触发
- T021: CSS-only 隐藏策略 — `.zen-mode` class 控制 display:none，退出后状态零丢失

### 验证
- 前端 140/140 单元测试通过
- Playwright 实跑 BDD 13/13 全部通过

Amend commit 已完成（CHANGELOG 内容合入 bump commit）。

## 构建验证

| 检查项 | 结果 |
|--------|------|
| `npm run build` (vue-tsc + vite) | ✅ PASS (2202 modules, 8.71s) |
| 版本一致性 (__init__.py / pyproject.toml / package.json) | ✅ 全部 0.1.67 |
| CHANGELOG [0.1.67] 条目 | ✅ 已填写 |
| Git commit | ✅ bb5a505a (amended with CHANGELOG) |
| Git tag | ✅ v0.1.67 |

## 门槛检查

- [x] 版本 bump 完成（git diff 确认 version bump）
- [x] CHANGELOG.md 有 T021 条目
- [x] 构建通过

## Lessons Learned

1. **CSS-only 隐藏优于 v-if 切换**：zen mode 用 CSS class 控制 `display:none` 而非 `v-if`，天然保持 DOM 状态（FileTree 展开状态、滚动位置、iframe 不重载），避免了复杂的状态保存/恢复逻辑。未来类似"临时隐藏"需求应优先考虑 CSS-only 方案。
2. **焦点管理是可访问性的关键**：`display:none` 会导致焦点丢失到 body，需要主动重定向。`tabindex="-1"` + `element.focus()` 是 programmatic focus 的标准模式，不干扰 Tab 序列。
3. **aria-live 通知让状态变化可感知**：视觉隐藏对屏幕阅读器用户不可感知，`aria-live="polite"` + `.sr-only` span 是低成本的辅助功能增强。

## 临时资源清单

| 类型 | 资源 | 状态 |
|------|------|------|
| 临时服务 | 无 | — |
| 临时数据 | 无 | — |
| 开发安装 | 无 | — |

> 本次 P8 仅执行 bump-version + CHANGELOG 填写 + 构建验证，未启动任何临时服务或创建临时数据。
