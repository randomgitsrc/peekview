---
phase: P2
task_id: T004
status: approved
---

# P2 设计评审：CAP_CUSTOM_WASM_URL 时序竞态治本

## 评审结论：approved

## 1. BDD 条件覆盖检查

| AC | P2 覆盖 | 评价 |
|----|---------|------|
| AC-1: CAP_CUSTOM_WASM_URL 在 cap.js 初始化前设置 | ✅ | 时序证明成立。已验证：`@cap.js/widget` 仅在 `LoginDialog.vue:116` 静态导入，而 LoginDialog 在 `EntryListView.vue:161` 中静态导入，EntryListView 在 `router.ts:8` 中**懒加载**。因此 cap.js 不在 main.ts 的初始 import 图中，main.ts 模块体执行时 cap.js 尚未加载 |
| AC-2: 开发/生产环境一致性 | ✅ | 两种模式均通过 main.ts 统一赋值，消除 index.html 内联脚本的时序不确定性 |
| AC-3: 生产构建后 WASM 路径可访问 | ✅ | 标记"不涉及"合理，构建流程不变（public/wasm/ → dist/wasm/ → static/wasm/） |
| AC-4: CDN fallback 被 CSP 正确拦截 | ✅ | 标记"不涉及"合理，CSP 策略不变，防御性验证属 P5 范畴 |
| AC-5: 缓存场景 | ✅ | 标记"不涉及"合理。旧缓存 index.html 仍有内联脚本（无害），新版本通过 main.ts 设置。P1 已识别此为部署/缓存策略问题，非代码 bug |

**结论**：所有 BDD 条件均已覆盖。

## 2. packages/domains/ui_affected 声明检查

```yaml
packages: [peekview]
domains: [frontend, security]
ui_affected: false
```

- `packages: [peekview]` — 正确。仅修改前端源码（属于 peekview 包的前端部分），后端代码无变更
- `domains: [frontend, security]` — 正确。frontend：main.ts/index.html 变更；security：CSP 行为验证
- `ui_affected: false` — 正确。无 UI 布局/视觉变更，仅调整初始化时序

**与 P1 范围声明一致**，无遗漏。

## 3. 方案可行性评审

### 3.1 时序证明验证

已通过代码走查验证关键链路：

```
router.ts:8   → component: () => import('./views/EntryListView.vue')  [懒加载]
EntryListView.vue:161 → import LoginDialog from '@/components/LoginDialog.vue'  [静态]
LoginDialog.vue:116   → import '@cap.js/widget'  [静态]
```

**结论**：`@cap.js/widget` 不在 main.ts 的初始 import 图中。ES 模块语义保证 main.ts 的静态 import 先解析执行，然后 main.ts 模块体执行（设置 CAP_CUSTOM_WASM_URL），最后才可能触发懒加载 chunk。时序证明成立。

### 3.2 风险识别评估

| 风险 | P2 缓解措施 | 评价 |
|------|-------------|------|
| ES 模块提升导致 import 先于赋值 | cap.js 不在 main.ts 静态 import 图中 | ✅ 已验证 |
| Vite 预构建改变加载顺序 | main.ts 赋值不依赖 index.html 脚本顺序 | ✅ 合理 |
| 未来有人将 LoginDialog 改为静态导入 | 添加注释说明 | ✅ 可接受（P1 已裁剪 P7，风险低） |

### 3.3 否决方案合理性

四个否决方案均有合理否决理由，无遗漏的可行替代方案。

### 3.4 小问题（不阻塞通过）

- AC-5 说明中提到"旧版本仍能通过 CDN fallback"，但 CDN fallback 会被 CSP 拦截。P2 注释补充了"cap.js 有 JS fallback solver"，这点成立，但建议 P4 实现时在注释中明确 cap.js 的 fallback solver 机制，避免后续维护者误解。

## 4. 总评

方案精准定位根因（时序竞态），改动范围最小（2 文件），时序证明经代码走查验证成立，BDD 覆盖完整，风险识别充分。**批准进入 P3**。
