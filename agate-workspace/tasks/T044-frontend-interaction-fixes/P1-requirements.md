---
phase: P1
task_id: T044-frontend-interaction-fixes
type: problems
trace_id: T044-P1-20260701
status: draft
agent: analyst
created: 2026-07-01
parent: P0-brief.md
P1_simplified: true
risk_level: low
---

## 需求复述

1. **Ctrl+F 被 zen mode 劫持**：`shouldHandleZenShortcut()` 只检查 `event.key` 不检查修饰键，导致 Ctrl+F / Cmd+F 触发 zen mode 全屏切换而非浏览器搜索。修复：在函数开头过滤带修饰键的键盘事件。
2. **Explore 视图模式不持久化**：`viewMode` 是纯本地 ref，切换到列表模式后离开再回来恢复为卡片模式。修复：加 localStorage 持久化（key: `peekview-view-mode`），与 theme 持久化模式一致。

## 隐含需求识别

| # | 隐含需求 | 为什么必须 |
|---|---------|-----------|
| 1 | Ctrl+Shift+F（浏览器高级搜索）也需放行 | Ctrl+Shift+F 是 Chrome/Firefox 的"在页面中搜索"快捷键，若只过滤 ctrlKey 不过滤 ctrlKey+shiftKey 组合，仍可能被劫持 |
| 2 | localStorage 值校验：非法值 fallback 到 'grid' | localStorage 可被用户/扩展手动修改，若写入 'table' 等非法值，viewMode ref 会接受非法类型，可能导致渲染异常 |
| 3 | 首次访问无 localStorage 值时默认 'grid' | 与当前行为一致，无破坏性变更 |
| 4 | 现有 zen-shortcut 测试需补充修饰键用例 | makeKeyboardEvent() 当前不传修饰键参数，需扩展以支持 ctrlKey/metaKey/altKey 测试 |

**逐维度快速过**：
- 数据：无后端变更，纯前端 localStorage
- 前端：有交互变化（viewMode 持久化）
- 多端：MCP/CLI/API 不涉及，无需同步
- 边界：见上表 #1-3
- 兼容：不破坏现有行为

## BDD 验收条件

### 子问题 1：Ctrl+F 修饰键过滤

**BDD-1**: Ctrl+F 不触发 zen mode
```
Given 用户在 entry 详情页且不在 input/textarea 中
When  按下 Ctrl+F（或 macOS Cmd+F）
Then  shouldHandleZenShortcut 返回 false，浏览器搜索框正常弹出
```

**BDD-2**: 单独 F 键仍触发 zen mode
```
Given 用户在 entry 详情页且不在 input/textarea 中
When  按下单独 F 键（无修饰键）
Then  shouldHandleZenShortcut 返回 true，zen mode 全屏切换正常触发
```

**BDD-3**: Ctrl+Shift+F 不触发 zen mode
```
Given 用户在 entry 详情页
When  按下 Ctrl+Shift+F
Then  shouldHandleZenShortcut 返回 false
```

**BDD-4**: Alt+F 不触发 zen mode
```
Given 用户在 entry 详情页
When  按下 Alt+F
Then  shouldHandleZenShortcut 返回 false
```

**BDD-5**: Escape 键不受修饰键过滤影响
```
Given 用户在 zen mode 中
When  按下 Escape（无论是否带修饰键）
Then  shouldHandleZenShortcut 返回 true（Escape 始终退出 zen mode）
```
注：Escape 带修饰键的场景极少见，但若加修饰键过滤在 Escape 分支之前，需确保 Escape 不被误过滤。实现时应将修饰键过滤仅作用于 F 键分支，或确保 Escape 在修饰键检查之前返回 true。

**BDD-6**: F 键 + input 焦点仍不触发 zen mode（现有行为不变）
```
Given 焦点在 input 元素上
When  按下单独 F 键
Then  shouldHandleZenShortcut 返回 false
```

### 子问题 2：Explore 视图模式持久化

**BDD-7**: 切换视图模式后持久化到 localStorage
```
Given 用户在 Explore 页面，当前视图模式为 grid
When  点击列表模式按钮切换到 list
Then  localStorage.getItem('peekview-view-mode') 返回 'list'
```

**BDD-8**: 页面重新加载后恢复上次视图模式
```
Given localStorage 中 peekview-view-mode 值为 'list'
When  用户访问 Explore 页面
Then  视图模式显示为 list（非默认 grid）
```

**BDD-9**: 首次访问无 localStorage 值时默认 grid
```
Given localStorage 中无 peekview-view-mode 键
When  用户访问 Explore 页面
Then  视图模式显示为 grid
```

**BDD-10**: localStorage 值非法时 fallback 到 grid
```
Given localStorage 中 peekview-view-mode 值为 'table'（非法值）
When  用户访问 Explore 页面
Then  视图模式显示为 grid（fallback）
```

**BDD-11**: 切换回 grid 模式后 localStorage 更新
```
Given 用户在 Explore 页面，当前视图模式为 list
When  点击卡片模式按钮切换到 grid
Then  localStorage.getItem('peekview-view-mode') 返回 'grid'
```

## 待确认清单

无。两项修复方向明确，无歧义理解。

## 裁剪说明

```yaml
phases: [P1, P3, P4, P5, P6]
pruning:
  P2: 跳过 — 两项修复方案明确（P0-brief 已指定具体代码行和修复方式），无需设计阶段
  P7: 跳过 — 改动仅涉及 2 个文件（zen-shortcut.ts + EntryListView.vue），无跨文件一致性风险
  P8: 跳过 — 无版本发布需求，纯 bug 修复
```

## 范围声明

```yaml
packages: [frontend-v3]
domains: [frontend]
ui_affected: [Explore 页面视图切换, Entry 详情页 zen mode 快捷键]
```

## 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需截图验证 Ctrl+F 恢复和 viewMode 持久化
    available:
      - playwright-cdp skill
      - vision-analyst（agate 内置执行角色）
    status: available
  - need: vitest-unit-test
    why: P3/P5 需跑前端单测验证 zen-shortcut 修饰键过滤
    available:
      - frontend-v3 vitest
    status: available
```
