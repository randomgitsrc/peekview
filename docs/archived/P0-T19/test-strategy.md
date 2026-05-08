# Task 19: 测试策略

## 测试分层

```
┌─────────────────────────────────────────────┐
│  E2E 测试 (Playwright + CDP)               │
│  - 完整用户流程验证                          │
│  - 截图视觉验证                             │
│  - 跨设备响应式测试                          │
├─────────────────────────────────────────────┤
│  集成测试 (Vitest + Vue Test Utils)          │
│  - 组件交互逻辑                              │
│  - API 调用测试                             │
├─────────────────────────────────────────────┤
│  单元测试 (Vitest)                           │
│  - 工具函数测试                             │
│  - 纯逻辑测试                               │
└─────────────────────────────────────────────┘
```

## 各问题测试策略

### P1: E2E 测试覆盖
- **测试类型**: E2E (自动化)
- **工具**: Playwright Python + connect_over_cdp
- **范围**: EntryListView, EntryDetailView, FileTree
- **标注**: 需截图验证

### P2: 交互功能测试
- **测试类型**: E2E (自动化)
- **工具**: Playwright
- **范围**: Copy, Download, ThemeToggle, Wrap buttons
- **标注**: 需验证剪贴板内容和下载文件

### P3: 桌面端测试
- **测试类型**: E2E 截图测试
- **工具**: Playwright (viewport: 1920x1080)
- **范围**: 所有页面在桌面端布局
- **标注**: 需手工验证截图

### P4: 移动端测试
- **测试类型**: E2E 截图测试
- **工具**: Playwright (viewport: 375x667)
- **范围**: 所有页面在移动端布局
- **标注**: 需手工验证截图

### P5: 视觉回归测试
- **测试类型**: 截图对比
- **工具**: Playwright screenshot + 基线对比
- **范围**: 关键页面基线
- **标注**: 截图存档到 evidences/

## 测试文件规划

```
frontend/e2e/
├── conftest.py              # Playwright fixtures
├── test_list_view.py        # EntryListView E2E
├── test_detail_view.py      # EntryDetailView E2E
├── test_interactions.py     # 交互功能 E2E
├── test_responsive.py       # 响应式测试 (desktop/mobile)
└── screenshots/             # 截图基线目录
    ├── desktop/
    └── mobile/
```

## UI 问题验证方式

所有 UI 相关问题必须：
1. 有截图证据
2. 手工确认截图正确
3. 截图存放到 P3-T19/evidences/

---

创建日期: 2026-04-25
