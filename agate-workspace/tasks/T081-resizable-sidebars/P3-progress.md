## test-designer 启动

### 输入文件读取

1. **P0-brief.md** — 已读。env_constraints: debug_env=make debug-quick (:8888), test_framework=vitest 1.6.1 + Playwright CDP。风险：scoped 硬编码宽度双源冲突、mousemove 性能、user-select 禁用、双击 reset。
2. **P1-requirements.md** — 已读。16 条 BDD（BDD-01 到 BDD-16）。覆盖：拖拽改变宽度(01-02)、clamp 边界(03-04)、localStorage 持久化(05-07)、移动端不显示(08)、zen mode(09)、条件渲染联动(10-11)、拖拽约束(12-13)、双击 reset(14-15)、键盘可访问(16)。
3. **P2-design.md** — 已读。方案 A：独立 composable useSidebarResize.ts + CSS 变量驱动。composable 接口：loadWidth/saveWidth/startDrag/onDoubleClick/cleanup。clamp 值：file-sidebar 160-260-500, toc-sidebar 150-240-400。gate_commands.P3: vitest run useSidebarResize.spec.ts。
4. **useResponsiveLayout.spec.ts** — 已读。BDD 命名模式：describe('BDD-NN: ...') + it('test_bdd_NN_...')。DOM mock 模式：document.createElement + dispatchEvent。
5. **useViewMode.ts** — 已读。localStorage 模式：load/save 函数 + 值校验。STORAGE_KEY='peekview-view-mode'。
6. **useResponsiveLayout.ts** — 已读。rAF 节流模式：cancelAnimationFrame + requestAnimationFrame。事件监听器注册/清理。

### 约束确认

- composable 单测覆盖 BDD-01~07 + BDD-12~16（交互逻辑）
- BDD-08~11（CSS 响应式/条件渲染）需 E2E 覆盖
- 红灯原因：useSidebarResize.ts 不存在 → import 失败
- 测试命名：test_bdd_NN_description
- vitest jsdom 环境，有 localStorage


### 产出文件

1. **P3-test-cases.md** — 212 行，含 test_code_dir 声明，16 条 BDD 全覆盖（12 composable 单测 + 4 E2E）
2. **useSidebarResize.spec.ts** — 298 行，12 个 test_bdd_NN 测试用例 + 2 个辅助测试（cleanup + saveWidth）

### 自检结果

- 红灯确认：`Error: Failed to resolve import "../useSidebarResize"` — B 类红灯（项目内 import 失败，模块不存在）
- 每条 BDD 有对应测试用例（1:1 映射）
- 测试命名格式：`test_bdd_NN_description`
- composable 接口契约已在 test-cases.md 中声明，供 P4 implementer 参照
- E2E 用例（BDD-08~11）在 test-cases.md 中声明路径和预期，需 P4/P6 阶段创建

### 红灯分类

- **B 类红灯**（exit 0）：被测模块 `useSidebarResize.ts` 不存在 → import 失败 → 全部测试无法执行
- 非测试代码语法错误（已通过 vitest 解析阶段，失败在 import resolution）
- 非第三方依赖失败（项目内部模块）

[PROD_NOT_TOUCHED]
