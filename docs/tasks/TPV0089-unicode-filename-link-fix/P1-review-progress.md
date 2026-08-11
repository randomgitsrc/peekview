# P1-review progress — TPV0089

## [stage1] BDD 评审（11 条逐条）
- BDD-1: PASS 判定（`中文图片`→`%E4%B8%AD%E6%96%87%E5%9B%BE%E7%89%87` 核算正确）· 数据✓ 前端✓ 多端✗ 边界✗ 兼容✗
- BDD-2: PASS 判定（basename 形态）· 数据✓ 前端✓ 兼容✓
- BDD-3: PASS 判定（日文 `概要図`→`%E6%A6%82%E8%A6%81%E5%9B%B3` 核算正确）· 数据✓ 前端✓
- BDD-4: PASS 判定（`café`→`caf%C3%A9` 核算正确，UTF-8 非 Latin-1）· 数据✓ 前端✓
- BDD-5: PASS 判定（空格→`%20`）· 数据✓ 前端✓
- BDD-6: PASS 判定（畸形 `%` 抛 URIError 已运行时证实，回退原始匹配，无中间态）· 边界✓ 兼容✓
- BDD-7: ⚠️ 待修订（Given 欠指定，dispatch 重点项，详见 P1-review.md 修订项 R1）· 兼容✓
- BDD-8: PASS 判定（src 断言 + 截图无裂图）· 数据✓ 前端✓ 多端✓
- BDD-9: PASS 判定（跳转 `/{slug}?file={id}` 无 404）· 前端✓ 多端✓
- BDD-10: PASS 判定（非中文非 ASCII E2E 佐证）· 数据✓ 前端✓
- BDD-11: PASS 判定（英文 E2E 冒烟）· 兼容✓ 前端✓
- 编号格式 `#### BDD-NN:` 连续无跳号 ✓；每条单 GWT ✓

## [stage2] 隐含需求覆盖
- 数据维度：✓（无 schema 迁移；seed-data 无非 ASCII → `[SUGGEST]` fixture 合理）
- 前端维度：✓（4 处调用点、外部引用过滤语义、raw HTML 兼容）
- 多端维度：✓（backend/API/MCP 无改动声明，与 P0 根因一致）
- 边界维度：△ 部分覆盖（畸形转义✓ decode回退✓ key语义✓；但字面 `%` 文件名缺 BDD 锚点 → 修订项 R2）
- 兼容维度：✓（ASCII 恒等、相对路径+basename 双形态）

## [stage3] BDD 跨条一致性
- BDD-6 vs BDD-7 不矛盾（异常回退分支 vs ASCII 恒等分支，互斥）
- 保护优先级显式声明（decode 位置不得改写 key 语义，P2 排除）
- 编码值全部核算 + 运行时验证通过，无环境约束冲突
- 措辞矛盾（建议修订）："raw HTML 引用 decode 恒等变换" vs BDD-6（畸形 `%` 抛异常走回退）表面冲突

## [stage4] 裁剪评审
- 跳过 P7：可接受，但 "单文件改动" 措辞不准确——实际为 path-map.ts + path-map.test.ts + seed-data fixture ≥3 文件；建议改 "单源文件改动"，测试/fixture 是推论产物，P6 实跑天然校验
- P1_simplified ✓ / P2 不可裁 ✓ / P3 不可裁 ✓ / P5 ✓ / P6 不可裁 ✓ / P8 ✓（均与 P0 一致）
- risk_level: medium 匹配（影响面为所有含非 ASCII 文件名已发布 entry，生产真实影响，非假设）
- capability_requirements 三态：browser-e2e / browser-vision 均 available，无 `[CAPABILITY_GAP]` ✓

## [stage5] P1 纯净性 + 结论
- ✓ 未直接选定实现方案（候选名源自 P0 known_risks，选型+排除理由显式留给 P2）
- ✓ 无实现细节混入（try/catch/回退均为行为约束非代码位置）
- 轻微越界不阻断："单点修复自动覆盖全部调用链" 为 P0 已核实事实，非方案选择
- 结论：needs-revision。0 BLOCKER；修订项 R1（BDD-7 Given 补 fileId=3 映射）+ R2（字面 `%` 文件名 decode 链路 BDD `a%2520b`→`a%20b`）；措辞建议 2 条。修订后即可 approved。
