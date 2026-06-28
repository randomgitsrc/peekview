# P4 实施进度 — T023 page-basics

## 产出清单

| # | 文件 | 操作 | 状态 |
|---|------|------|------|
| 1 | `frontend-v3/src/views/HomeView.vue` | 删除 | ✅ |
| 2 | `frontend-v3/src/views/NotFoundView.vue` | 新增 | ✅ |
| 3 | `frontend-v3/src/router.ts` | 修改（追加 catch-all 路由第 4 项） | ✅ |

## 改动摘要

### 1. 删除 HomeView.vue
17 行僵尸文件，grep 确认无引用，直接删除。

### 2. NotFoundView.vue（49 行，< 50 行限制）
- 显示 "Page not found" 标题
- 显示当前请求路径（`route.path`，等宽字体）
- "返回首页" router-link（→ `/`），带 hover 样式
- 居中布局，使用项目 CSS 变量（`--space-*`, `--font-*`, `--accent-*` 等）
- 类型安全：`useRoute()` typed import，无未使用变量
- 自动继承 App.vue 的 `<transition name="fade">` 过渡效果

### 3. router.ts catch-all
- `path: '/:pathMatch(.*)*'` 放在 routes 数组末尾（第 4 项）
- `name: 'not-found'`
- 懒加载 `NotFoundView.vue`
- 不影响前 3 个路由（`/` → EntryListView, `/:slug` → EntryDetailView, `/settings/apikeys` → ApiKeyListView）

## 验证状态

| Gate | 命令 | 结果 |
|------|------|------|
| 无 HomeView 引用 | `grep -r "HomeView" frontend-v3/src/` | ✅ NO_MATCHES_FOUND |
| TypeScript 类型检查 | `npx vue-tsc --noEmit` | ✅ exit 0 |
| Vite 构建 | `npm run build` | ✅ 11.90s, NotFoundView chunk 产出 (0.50 kB js + 0.75 kB css) |
| 单测全量通过 | `./node_modules/.bin/vitest run` | ✅ 28 files / 370 tests passed |
