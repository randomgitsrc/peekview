---
phase: P1
task_id: T023-page-basics
type: requirements
parent: P0-brief.md
status: draft
domains: [frontend]
ui_affected: true
---

# P1 需求基线 — T023 page-basics

## 1. 需求复述

清理前端路由体系两个基础完整度问题：

1. **删除 `views/HomeView.vue`**（17 行僵尸文件，router.ts 未引用——grep 全仓 frontend-v3 确认无任何 `HomeView` 引用）
2. **新增 `views/NotFoundView.vue`**（友好 404 页面：提示"Page not found" + 显示请求 path + "返回首页"按钮 via `<router-link to="/">`）
3. **router.ts 追加 catch-all 路由** `path: '/:pathMatch(.*)*'`，name `not-found`，懒加载 NotFoundView

不动 `/` `/:slug` `/settings/apikeys` 三个现有路由，不引入新依赖，不涉及后端。

## 2. 隐含需求识别

### 2.1 路由匹配顺序（关键）
- catch-all 路由 `/:pathMatch(.*)*` **必须**放在 `routes` 数组末尾，否则会拦截 `/settings/apikeys` 等合理路径。
- 原因：vue-router 按数组顺序匹配，第一匹配生效。

### 2.2 路由级 404 vs API 级 404 的边界（关键）
- EntryDetailView（`/:slug`）已有 "Entry not found" 展示——这是 `/api/v1/entries/{slug}` 返回 404 时的处理，属于"找到了路由但资源不存在"。
- 新增的 NotFoundView 处理"完全匹配不到任何路由的 path"（如 `/random-nonexistent-path` 或 `/settings/nonexistent`）。
- 两者**不可混淆、不可互相替代**，P0-brief 已明确范围声明"不重定向访问不存在 slug 场景"。

### 2.3 现有过渡动画自动继承
- App.vue 已用 `<router-view v-slot>` + `<transition name="fade">` 包裹所有路由视图。
- NotFoundView 作为新路由自动享有该过渡效果，**无需额外配置**。

### 2.4 TypeScript 严格模式约束
- tsconfig.json：`strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`。
- NotFoundView.vue 必须类型正确、无未使用变量。若显示请求 path（`$route.params.pathMatch`），需正确声明类型。

### 2.5 无导入/测试残留攻击面
- grep 确认全仓无 `HomeView` 引用，文件删除无副作用。
- 现有 28 个测试文件均为组件/composable 单元测试，无路由级测试，无需更新。

### 2.6 构建流程不受影响
- `npm run build`（vite build）自动发现新视图文件（懒加载），无需额外配置。
- `npx vue-tsc --noEmit` 作为 CI 强制步骤，新文件必须通过类型检查。

### 2.7 数据维度
- 无数据变更（纯前端路由/组件变更）。

### 2.8 多端同步
- 无 MCP/CLI 端影响。

### 2.9 边界条件
- **空 pathMatch**：访问根路由 `/` 不应落到 catch-all（现有 `/` 路由已覆盖，catch-all 放最后可确保不干预）。
- **嵌套不存在路径**：如 `/a/b/c/d` 应正确匹配 catch-all。
- **带查询参数/哈希**：`/nonexistent?foo=bar` 或 `/nonexistent#section` 应正确被 catch-all 匹配（vue-router 默认处理）。

## 3. BDD 验收条件

### BDD-1：删除僵尸文件
```
Given 仓库中已确认 HomeView.vue 无任何引用
When  T023 实现完成后
Then  frontend-v3/src/views/HomeView.vue 文件不存在
  and grep "HomeView" 在 frontend-v3/ 目录下无匹配
```

### BDD-2：catch-all 路由显示 404 页
```
Given 用户在浏览器访问多级未匹配路由的路径
Note  单级路径（如 /single-word）被 /:slug 路由匹配，进入 EntryDetailView 的 "Entry not found"——这是预期行为（P0-brief 范围声明）。
When  访问 /a/b/c/d（多级不存在路径）
Then  页面显示 "Page not found" 提示文字
  and 页面显示请求的路径（如 /a/b/c/d）
  and 页面显示 "返回首页" 按钮（router-link → "/"）
```

### BDD-3：现有路由不受影响
```
Given 路由表已新增 catch-all
When  分别访问 /（EntryListView） /:slug（EntryDetailView） /settings/apikeys（ApiKeyListView）
Then  三个路由均正常加载（不出现 404 页）
```

### BDD-4：返回按钮工作
```
Given 用户在 NotFoundView 页面
When  点击 "返回首页" 按钮
Then  导航到 / 路径
  and 显示 EntryListView
```

### BDD-5：构建和类型检查零错误
```
Given T023 变更已完成
When  运行 npx vue-tsc --noEmit
Then  exit code 为 0，无类型错误

When  运行 npm run build
Then  exit code 为 0，构建成功
```

## 4. 裁剪说明

| 阶段 | 决策 | 理由 |
|------|------|------|
| P2 方案设计 | **跳过** | 方案极明确：删 1 个文件 + 加 1 个组件 + 1 条路由配置，无架构设计空间。P0-brief 已给出路由代码模板。 |
| P3 TDD 测试 | **跳过** | 满足跳过条件①：NotFoundView 为纯静态展示组件（无逻辑），路由 catch-all 为声明式配置，无可测试行为。符合 WORKFLOW "纯文档/配置类任务——没有可测试的行为"。 |
| P4 代码实现 | **保留** | 核心产出 |
| P5 技术验证 | **保留** | 需验证 `vue-tsc` + `npm run build`（BDD-5 的 P5 gate） |
| P6 验收 | **保留** | P0-brief 明确声明 "P6 端到端必做"。需 Playwright 验证 404 路由 + 返回按钮（BDD-2/3/4）。 |
| P7 一致性 | **跳过** | 单文件改动（1 删除 + 1 新增 + 1 路由行），无多文件一致性风险。 |
| P8 发布准备 | **跳过** | 纯前端改动，不影响后端/MCP 包版本。不涉及 bump-version/publish。 |

**裁剪风险自检**：
- 不涉及 schema 变更 ❌
- 不涉及安全改动 ❌
- 单端改动（仅 frontend）❌
- 不触发 WORKFLOW 裁剪风险维度任何一条 ✅

## 5. 范围声明

```yaml
packages: []
domains: [frontend]
ui_affected: true
```

## 6. 能力需求声明

```yaml
capability_requirements:
  - need: browser-vision
    why: P6 验收需 Playwright 验证 404 路由行为 + 返回按钮
    available:
      - playwright-cdp skill
    status: available
  - need: vue-type-check
    why: P5 gate 需 vue-tsc --noEmit 通过
    available:
      - npx vue-tsc（本地 npm 依赖）
    status: available
  - need: vite-build
    why: P5 gate 需 npm run build 通过
    available:
      - npm run build（本地 npm 依赖）
    status: available
```

## 7. 风险升级

无。本任务范围明确、无未决方向选择、所需能力均已具备。

- [NEED_CONFIRM]：无
- [SCOPE+]：无
- [CAPABILITY_GAP]：无
