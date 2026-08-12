---
phase: P3
task_id: T031-cold-open-performance
type: test-cases
parent: P2-design.md
trace_id: T031-P3-20260722
status: draft
created: 2026-07-22
agent: test-designer
test_code_dir: docs/tasks/T031-cold-open-performance/P3-test-code/
---

# P3 测试用例清单

## 单元测试（vitest，位于 frontend-v3/src/components/__tests__/）

| ID | BDD | 文件 | 用例 | 预期（红灯原因） |
|----|-----|------|------|-----------------|
| UT-1 | BDD-2 | t031-entry-card.spec.ts | card-body 应为 `<a>` 元素，href 指向 /{slug} | 当前是 div |
| UT-2 | BDD-2 | t031-entry-card.spec.ts | 不应有 role="button" 和 tabindex="0" | 当前有 |
| UT-3 | BDD-3 | t031-entry-card.spec.ts | meta-sep 应有 UI 字体栈 font-family | 当前无 font-family 覆盖 |
| UT-4 | BDD-7 | t031-entry-card.spec.ts | username 应为 span（非 router-link/a），有 role="link" | 当前是 router-link |
| UT-5 | BDD-7 | t031-entry-card.spec.ts | 点击 toggle 按钮不触发 navigate | 结构改为 <a> 后需 .prevent |
| UT-6 | BDD-2 | t031-entry-list-row.spec.ts | 根元素应为 `<a>`，href 指向 /{slug} | 当前是 div |
| UT-7 | BDD-2 | t031-entry-list-row.spec.ts | 不应有 role="button" 和 tabindex="0" | 当前有 |
| UT-8 | BDD-3 | t031-entry-list-row.spec.ts | meta-sep 应有 UI 字体栈 font-family | 当前无 |
| UT-9 | BDD-7 | t031-entry-list-row.spec.ts | username 应为 span（非 router-link/a） | 当前是 router-link |
| UT-10 | BDD-4 | t031-entry-list-view.spec.ts | 搜索框 placeholder 为英文 | 当前是中文 |
| UT-11 | BDD-6 | t031-entry-list-view.spec.ts | loading 态显示骨架屏元素（非 "Loading..." 文本） | 当前是纯文本 |
| UT-12 | BDD-5 | t031-landing-view.spec.ts | 两处按钮文案为 "Browse public"（非 "Explore"） | 当前是 "Explore" |
| UT-13 | BDD-1 | t031-entry-store.spec.ts | loadEntry 并发调用 getEntry 和 getFileContent | 当前串行 |
| UT-14 | BDD-6 | t031-entry-detail-view.spec.ts | 详情页 loading 态显示骨架屏（非 "Loading..."） | 当前是纯文本 |

## E2E 测试（Playwright CDP，位于 P3-test-code/）

| ID | BDD | 文件 | 用例 | 预期（红灯原因） |
|----|-----|------|------|-----------------|
| E2E-1 | BDD-2 | t031-e2e.ts | 卡片标题区域为 <a> 标签，有 href | 当前是 div |
| E2E-2 | BDD-2 | t031-e2e.ts | 右键点击卡片显示链接上下文菜单 | 当前无链接语义 |
| E2E-3 | BDD-6 | t031-e2e.ts | 列表页加载时显示骨架屏 | 当前是 "Loading..." |
| E2E-4 | BDD-7 | t031-e2e.ts | 点击 toggle 按钮不触发导航 | 改为 <a> 后需验证 |
| E2E-5 | BDD-1 | t031-e2e.ts | 详情页并行请求（Network 验证） | 当前串行 |
| E2E-6 | BDD-3 | t031-e2e.ts | 分隔符渲染无方块（截图验证） | 当前可能有问题 |
| E2E-7 | BDD-4 | t031-e2e.ts | 搜索框 placeholder 为英文 | 当前中文 |
| E2E-8 | BDD-5 | t031-e2e.ts | 首页按钮文案为 "Browse public" | 当前 "Explore" |

## 运行命令

```bash
# 单元测试
cd frontend-v3 && ./node_modules/.bin/vitest run src/components/__tests__/t031

# E2E（需 debug backend :8888 + CDP Chrome :18800）
NODE_PATH=/home/kity/.nvm/versions/node/v24.15.0/lib/node_modules npx tsx docs/tasks/T031-cold-open-performance/P3-test-code/t031-e2e.ts
```
