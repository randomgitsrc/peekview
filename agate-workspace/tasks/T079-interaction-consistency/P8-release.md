---
phase: P8
task_id: T079-interaction-consistency
type: release
parent: P7-consistency.md
trace_id: T079-P8-20260731
status: draft
created: 2026-07-31
agent: releaser
---

# P8 Release — T079: 交互一致性修复

## 环境隔离声明

[PROD_NOT_TOUCHED] 本发布准备为文档产出 + CHANGELOG 更新，不涉及后端、数据库、生产服务。

## bump_type

```
bump_type: minor
```

### 判定依据

- 加功能（AuthButton + UserMenu 共享组件 + BaseTag 可点击 + 移除 Explore）→ minor
- 不改公共 API（纯前端组件重构）
- 无破坏性变更
- 符合语义化版本 minor 语义

## P2 packages 声明

```yaml
packages:
  - frontend-v3
```

单包任务。frontend-v3 不是独立 npm 包，无独立版本 bump。版本 bump 走 peekview 主包（`VERSIONS.json` 的 `peekview` 字段）。

## 版本号变更确认

| 包 | 旧版本 | 新版本 | 版本文件 | 状态 |
|----|--------|--------|----------|------|
| peekview | 0.12.3 | 0.13.0 | VERSIONS.json `peekview` 字段 | 待主 Agent 执行 `make bump-version NEW_VERSION=0.13.0` |

> releaser subagent 不执行 bump-version / git commit / git tag。版本号变更由主 Agent 在 gate 验证通过后亲自执行。

## CHANGELOG 更新确认

CHANGELOG.md `[Unreleased]` 区域已更新，包含以下内容：

### 新增
- AuthButton 共享组件：按 DESIGN.md §6 自动选择 variant（marketing=primary, functional desktop=secondary, functional mobile=ghost）(T079)
- UserMenu 共享组件：统一 Settings + Logout 菜单 + admin badge (T079)
- Detail 页 tag 改用 BaseTag 可点击组件 (T079)

### 修复
- 登录按钮 variant 不一致：Landing/Explore/Detail 三页统一 (T079)
- 用户菜单内容不一致：Explore 有 API Keys + Logout，Landing 只有 Logout → 统一 Settings + Logout (T079)
- Detail 页冗余 Explore 按钮移除（logo 已覆盖导航）(T079)

## 发布检查命令

| 检查项 | 命令 | 来源 | 状态 |
|--------|------|------|------|
| 前端构建 | `make build-frontend` | P2 gate_commands + AGENTS.md | 待主 Agent 执行 |
| 前端单测 | `make test-frontend` | P2 gate_commands P5 | 待主 Agent 执行 |
| 类型检查 | `make typecheck` | P2 实现完成标志 #6 | 待主 Agent 执行 |
| P5 重跑 | `make test-frontend` | P2 gate_commands P5 | 待主 Agent 执行 |

> releaser subagent 不执行发布检查命令。主 Agent gate 验证时亲自执行。

## 临时资源清单

- 无临时服务/进程
- 无临时数据
- 无开发安装

## SCOPE_GAP 检查

P2 声明 packages 含 `frontend-v3`，dispatch context 已覆盖全部改动文件（AuthButton.vue、UserMenu.vue、LandingView.vue、EntryListView.vue、EntryDetailHeader.vue、AuthButton.spec.ts、UserMenu.spec.ts）。无 SCOPE_GAP。

## Lessons Learned

1. **测试环境 matchMedia 缺失需 prop fallback**：P2 设计指定 AuthButton 统一使用 matchMedia 检测 mobile，但 jsdom 测试环境无 matchMedia。实现中添加 `mobileOverride` prop 作为 fallback。教训：设计涉及 Web API 时，需在 P2 阶段确认测试环境兼容性，或在设计中标明测试 mock 策略。（来源：T079，2026-07-31）
2. **vitest vi.mock hoisting 陷阱**：UserMenu.spec.ts 在函数内部使用 vi.mock 导致 hoisting 引用闭包变量失败。教训：vi.mock 总是被提升到文件顶部，不能引用函数参数闭包变量；应使用 vi.hoisted() 或模块级可变对象。（来源：T079，2026-07-31）
3. **跨任务测试债务不阻塞当前任务**：t067 测试断言旧行为与 T079 BDD 矛盾，P7 确认为预期回归，P6 使用 T079 专用测试文件验收。教训：重构任务应创建专用测试文件，旧测试的更新可作为独立后续任务跟踪。（来源：T079，2026-07-31）

## 交接信息

- bump_type: minor
- 新版本号: 0.13.0
- CHANGELOG 已更新（[Unreleased] 区域含 T079 改动）
- 主 Agent 需执行：`make bump-version NEW_VERSION=0.13.0` → 填 CHANGELOG 日期 → `make pre-publish-quick` → commit + tag
- 无临时资源需清理
