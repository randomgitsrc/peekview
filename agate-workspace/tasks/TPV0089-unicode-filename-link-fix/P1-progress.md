# P1 Progress — TPV0089 unicode-filename-link-fix (analyst)

## 2026-08-11

- [x] 读取 P1-dispatch-context-analyst.md：目标=根因已定位（P0），把根因转需求基线；BDD 必须覆盖中文/日文/重音/空格/畸形转义/英文不回归 + P6 Playwright 实跑；`P1_simplified: true`
- [x] 读取 analyst.md 角色文件：隐含需求逐维度过 + BDD 可二值判定 + 拿不准标 [NEED_CONFIRM]
- [x] 读取 P0-brief.md：根因=path-map.ts resolvePath/normalizeRef 未 decode markdown-it 已 percent-encode 的 href/src；改动面单文件；零现成覆盖→P3 不可跳；两种修复候选（消费侧 decode vs 构建侧 encode）P2 必须选型；seed-data 大概率无非 ASCII fixture
- [x] 读取 AGENTS.md（系统上下文已含）：前端 URL 路径 `/:slug`；测试注意；铁律 6（测试 entry 只能走 debug HTTP API）
- [x] 读取 path-map.ts：确认 resolvePath 在 normalizeRef 之后直接查 pathMap（无 decode）；buildPathMap key 来自 File.path/filename 原始字符串；normalizeRef 兼作外部 URL/锚点过滤 + buildPathMap 内部复用（decode 若放 normalizeRef 会影响 key 构建侧 → 隐含需求）
- [x] 读取 useMarkdown.ts：resolvePath 4 处调用（image rule L299 / link_open rule L317 / rewriteHtmlRefs L117/L126）；markdown-it 对 image/link 的 attr 在 renderer rule 阶段已 encode（P0 已确认）；DOMPurify 后 rewriteHtmlRefs 处理 raw HTML refs
- [x] 读取 path-map.test.ts：现有 41 条用例全 ASCII（TC-BPM-* / TC-NR-* / TC-RP-*），确认零非 ASCII 覆盖
- [x] 补充调研：seed-data 22 个 entry 文件名无任何非 ASCII（grep 证实）；image-gallery 仅 meta.json 无真实图片文件 → P3/P6 需新增非 ASCII fixture，走 debug HTTP API 或新增 seed 目录
- [x] 隐含需求识别完成（数据/前端/多端/边界/兼容五维度）
- [ ] 写 P1-requirements.md（含 BDD）

## 关键决策记录

- 无 [NEED_CONFIRM]：根因、范围、验收方式全部由 P0/dispatch 确定
- [x] 写 P1-requirements.md：11 条 BDD（单元级 7 条 + E2E 级 4 条），隐含需求五维度识别，NO_NEED_CONFIRM，裁剪说明（P7 裁理由=单文件无跨端），capability 均 available
- [x] 自检通过：frontmatter 机器字段齐全（risk_level=medium/phases/packages=[peekview]/domains=[frontend]/requires_minimal_validation=true），11 条 BDD 锚点已落盘

## [rev1] analyst 修订轮
- 修订项 R1：BDD-8（原 BDD-7）Given 补充 "且映射到 fileId=3"。
- 修订项 R2：新增 BDD-7（字面 `%` 文件名 decode 链路，`a%2520b.png`→`a%20b.png`→命中，钉死 decode 恰好一次），并入 BDD-6 家族后顺延重编号 BDD-8~12。
- 措辞建议 1：前端段 raw HTML 引用改为 "无 `%` 序列恒等；畸形序列抛异常走回退兜底"。
- 措辞建议 2：P7 裁剪理由 "单文件改动" 改为 "单源文件改动"。
- 交叉引用同步：frontmatter browser-e2e why 与 P6 裁剪说明的 BDD-8/9/10/11 → BDD-9/10/11/12。
- 自检：BDD-1~12 连续无跳号；frontmatter 机器字段不变；无新增 [NEED_CONFIRM]。
