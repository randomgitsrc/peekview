---
phase: P6
task_id: T023-page-basics
type: acceptance
parent: P1-requirements.md
status: done
created: 2026-06-28
---

# P6 验收 — T023 page-basics

## BDD 执行结果

| BDD | 描述 | 结果 | 验证方法 |
|-----|------|------|---------|
| BDD-1 | HomeView.vue 文件不存在，grep 无匹配 | PASS | P5 gate 已验 |
| BDD-2 | 多级路径 /a/b/c/d 显示 NotFoundView | PASS | Playwright |
| BDD-3 | /、/settings/apikeys、/:slug 正常加载 | PASS | Playwright |
| BDD-4 | 返回首页按钮导航到 / | PASS | Playwright |
| BDD-5 | vue-tsc + build 零错误 | PASS | P5 gate 已验 |

## 关键发现

### catch-all 路由与 /:slug 的优先级
`/:slug` 匹配所有单级路径（如 `/random-word`），这些走 EntryDetailView 的 "Entry not found"——这是 P0-brief 明确的范围声明（"不重定向访问不存在 slug 场景"）。catch-all `/:pathMatch(.*)*` 只捕获多级路径（如 `/a/b/c`）。已修正 BDD-2 的测试用例。

### router-link 在 Playwright CDP 模式下的 click
Playwright 的 `page.click()` 不能正确触发 Vue Router 的 `<router-link>` 导航。需要用 `page.evaluate(() => element.click())` 替代。非 router-link 问题，是 CDP 模式下的已知限制。

## 验证环境

- 调试服务：http://127.0.0.1:8888
- 测试 entry：eaylgh（通过 debug API 创建）
- Chrome CDP：127.0.0.1:18800
- 前端构建：v0.2.4 + T023 改动
