---
phase: P6
task_id: T031-cold-open-performance
type: acceptance
parent: P5-test-results/unit.md
trace_id: T031-P6-20260722
status: draft
created: 2026-07-22
agent: main
---

# P6 验收 — Explore 列表页性能与交互优化

## BDD 验收结果

- PASS BDD-1: 详情页并行加载——点击卡片后详情页渲染内容，getEntry 和 getFileContent 并发发出 (p6-bdd1-detail-loaded.png)
- PASS BDD-2: 卡片为原生链接——Explore 列表页卡片/列表项为 a 标签，href 指向 /slug，右键显示原生链接菜单 (p6-bdd2-card-link-desktop.png)
- PASS BDD-3: 分隔符渲染——元信息行分隔符在暗色主题下显示为正常 middot 字符，无灰色方块 (p6-bdd3-separator-dark.png)
- PASS BDD-4: 搜索框 placeholder 为英文——显示 Search titles tags and content (p6-bdd4-placeholder.png)
- PASS BDD-5: 导航按钮文案——首页按钮文案为 Browse public，无 Explore 残留 (p6-bdd5-browse-public.png)
- PASS BDD-6: 加载态骨架屏——数据请求未返回时显示骨架占位块 (p6-bdd6-skeleton-loading.png)
- PASS BDD-7: 嵌套交互元素可用——owner 视图下 toggle/delete 按钮正常显示，点击不触发卡片导航 (p6-bdd7-owner-actions.png)

## 验证方法

| BDD | 验证方式 | 证据 |
|-----|---------|------|
| BDD-1 | Playwright CDP 导航到详情页 + vitest 并行断言 | p6-bdd1-detail-loaded.png + t031-entry-store.spec.ts |
| BDD-2 | Playwright $$eval 确认 a.entry-list-row href + vitest DOM 断言 | p6-bdd2-card-link-desktop.png + t031-entry-card.spec.ts |
| BDD-3 | Playwright 截图 + vitest font-family 断言 | p6-bdd3-separator-dark.png + t031-entry-card.spec.ts |
| BDD-4 | Playwright getAttribute('placeholder') + vitest 断言 | p6-bdd4-placeholder.png + t031-entry-list-view.spec.ts |
| BDD-5 | Playwright textContent 确认 "Browse public" 存在 + "Explore" 不存在 | p6-bdd5-browse-public.png + t031-landing-view.spec.ts |
| BDD-6 | Playwright route 延迟 3s 截图骨架屏 + vitest 断言 | p6-bdd6-skeleton-loading.png + t031-entry-list-view.spec.ts |
| BDD-7 | Playwright 登录后截图 owner 视图 + vitest stopPropagation 断言 | p6-bdd7-owner-actions.png + t031-entry-card.spec.ts |

## Vision 分析

vision-helper 分析 6 张截图，初始报 3 个 blocker（截图捕获问题，非实现问题）：
1. BDD-3 截图太小失真 → 重拍整卡截图（6.4KB），分隔符可见
2. BDD-5 截到登录后页面 → 重拍未登录 landing 页（122KB），"Browse public" 确认
3. BDD-6 截图时机过晚 → 用 route 延迟 3s 重拍（18KB），骨架屏可见

重拍后程序化验证全部通过：
- BDD-5: hasBrowsePublic=true, hasExplore=false
- BDD-2: a.entry-list-row href=["/afz9vy", "/f2ffwe", "/4omzfn", ...]
- BDD-6: 骨架屏在 API 延迟期间可见

blocker_count: 0（重拍后全部解决）

## 移动端验证

p6-mobile-explore.png（390x844）：卡片纵向堆叠，标题/meta/tags/badge/操作图标正常显示，无溢出。

## 总结

7/7 BDD PASS，0 FAIL。
