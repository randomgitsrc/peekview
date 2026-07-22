## P3 test-designer 进度

### 输入文件已读取
- [x] P0-brief.md — env_constraints: debug_env=make debug-restart, ui_affected=true, depends_on T065
- [x] P1-requirements.md — 12 条 BDD (BDD-1 到 BDD-12)
- [x] P2-design.md — 方案 A (品牌字标内嵌 header)，详细设计 2.1-2.10
- [x] dispatch-context — vitest+jsdom, mock authStore, 命名 t067-*.spec.ts

### 关键发现
- EntryDetailView.vue 当前无品牌字标、无 Sign in、无 Explore 入口
- authState computed: loading → authenticated → anonymous
- LandingView.vue line 20: btn btn-ghost btn-sm → 需改 BaseButton primary
- LandingView.vue line 446: @media max-width:380px .btn-ghost { display:none }
- 移动端 reads 计数 (line 223): `totalCount ?? 0 reads` → 需改为条件复数
- 移动端底栏 (line 237): `Files <badge>N</badge>` → 需改为 `<badge>N</badge> files`
- zen mode 当前只隐藏 .detail-header，移动端 sticky-header/bottom-bar 未隐藏

### 测试代码完成
- [x] 28 个测试用例覆盖 12 条 BDD
- [x] 23 RED / 5 GREEN
- [x] BDD-2/11/12 防假绿灯设计：先验证基线存在再验证目标不可见
- [x] 移动端模拟：Object.defineProperty(window, 'innerWidth')
- [x] mockIsMultiFile 支持多文件场景测试

### vitest 确认
- 0 A 类错误（无 SyntaxError/import 失败）
- 23 B 类错误（断言失败 = 真红灯）
- 5 GREEN（已有功能：桌面端 reads 格式、tooltip）

### 产出文件
1. docs/tasks/T067-detail-page-framework/P3-test-cases.md
2. frontend-v3/src/components/__tests__/t067-detail-framework.spec.ts
