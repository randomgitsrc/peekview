
## P3 test-designer 执行日志 (T086-P3-20260807)

- [开始] 已读取 role 定义 + dispatch-context，开始按输入文件列表逐一读取
- [读完] P1-requirements.md：17 条 BDD 确认（BDD-1..BDD-17）。注意：admin.spec.ts 现有 test() 用的是旧编号体系（BDD-01/02/06/12/14/15/20/21，来自更早的全局任务），与本任务 P1 的 BDD-1..17（局部编号）不是同一套，需要在迁移时理清映射关系。
- [读完] P2-design.md：方案一（tab computed 化）确认。§3.5/3.6 给出 admin.spec.ts 和 t080 的具体迁移映射。§4 UI 测试标识清单已列出。gate_commands 已固化。
- [读完] P2-review.md：approved。核心要点：BDD-01 count() 断言需用 .desktop-only/.mobile-only 限定选择器（比照 raw-api.spec.ts:38）；可访问性缺口记为现状不修复。
- [读完] frontend-v3/e2e/admin.spec.ts：确认 8 个 test()，6 个在 viewport 循环内（BDD-01/02/06/12/20/21），2 个独立（BDD-14/15）。adminLogin() helper 定义在文件内部（本地函数），frontend-v3/e2e/helpers 目录不存在，无需读取外部 helper。
- [读完] frontend-v3/src/__tests__/t080-admin-route-guard.test.ts：确认 5 个 it()，自建 createGuardedRouter，mock @api/client 全字面量（无外部变量引用，符合 hoisting 安全写法，可参照）。
- [读完] frontend-v3/e2e/raw-api.spec.ts:38 先例：`.actions.desktop-only a[title*="Raw"]` 用 .desktop-only 限定选择器。
- [完成] t080-admin-route-guard.test.ts 原地重写完成。自跑 vitest：10 test（7 real + 3 skip DESIGN_GAP），3 真红灯（test_bdd_4/test_bdd_14b/test_bdd_13，均为 assertion 失败，因 user-manager tab 未实现），4 通过（非 admin 负向断言，逻辑上现状已满足，非假红灯）。开始改写 e2e/admin.spec.ts。
- [完成] e2e/admin.spec.ts 重写完成：8 个 legacy test 迁移（BDD-01/02/06/12/20/21 URL+.desktop-only/.mobile-only 限定选择器；BDD-14/15 语义重写为 404 断言）+ 新增 T086 BDD-07/08/11/12。npx playwright test --list 解析成功（36 条 = 18 用例 × 2 projects），无语法错误。
- [完成] npx vue-tsc --noEmit 通过（0 错误）。
- [完成] P3-test-cases.md 写入完成，含 BDD-1..17 全映射表、legacy 编号消歧说明、DESIGN_GAP 理由、自检结果、Advisory Note #1 落实说明。
- [PROD_NOT_TOUCHED] 全程只操作 frontend-v3 源码与本地 vitest/tsc/playwright --list，未启动任何 backend，未接触 :8080 或 ~/.peekview/。
- [完成] P3 任务结束。
