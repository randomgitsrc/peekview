# Task: Toast.vue 单元测试

## 开始时间
- 2026-06-28

## 上下文确认
- [x] 读 `Toast.vue`（93 行：TransitionGroup v-for 渲染 messages，toast--${variant} class，.toast__close @click="remove"）
- [x] 读 `useToast.ts`（30 行：模块级 messages ref + show()（setTimeout 3000 自动 remove）+ remove()）
- [x] 读 `FileTree.spec.ts`（mount + flushPromises 风格）
- [x] 读 `vitest.config.ts`（globals=true, jsdom, @ alias）
- [x] 读 `DiagramBlock.spec.ts` fake timers 用法参考

## 契约
- 被测组件：`Toast.vue`，通过 `useToast()` composable 拿到模块级单例 `messages`/`show`/`remove`
- useToast 是模块级单例 → beforeEach 清空 `messages.value = []`
- 测试用 `mount`（非 shallowMount，需渲染 v-for 子项）
- fake timers 测 3 秒自动消失

## 步骤
- [x] 写 `Toast.spec.ts`（6 用例：空/数量/variant class/close remove/文本/auto-dismiss）
- [x] 跑单文件 vitest → GREEN（6/6 通过，49ms）
- [x] 跑全量 vitest → 无 regression（17 文件 199/199 通过；新增 6 用例：193→199）
- [x] git commit

## 结果
- 单文件：Toast.spec.ts 6/6 通过
- 全量：17 文件 199/199 通过（无 regression；stderr 为其他测试既有的 mermaid/svg-pan-zoom 预期错误日志）
- 实现：6 用例覆盖空消息/数量/variant class 映射/close 按钮 remove/文本渲染/show() 3 秒自动消失（fake timers）
- 用例：mount + 模块级单例 messages.value 清理（beforeEach）
