# P2 Progress — TPV0089-unicode-filename-link-fix (architect)

## 输入文件读取进度

- [x] P0-brief.md — 根因定位、两候选方案、known_risks（零测试覆盖 / decode 防御 / 验收数据依赖）
- [x] P1-requirements.md — 12 BDD（BDD-6 畸形转义 try/catch、BDD-7 decode 恰好一次、BDD-8 英文不回归）、隐含需求（外部引用过滤守卫、key 语义不改写、seed-data 无 fixture）
- [x] P1-review.md — approved；R1/R2 落地，BDD-7 新增，Node 运行时已复核 encode/decode 链路
- [x] AGENTS.md — 项目约定（make debug 隔离、vue-tsc、vitest）
- [x] frontend-v3/src/utils/path-map.ts — normalizeRef/buildPathMap/resolvePath 三函数结构
- [x] frontend-v3/src/composables/useMarkdown.ts — resolvePath 4 处调用点（L299/L317 渲染器、L117/L126 rewriteHtmlRefs）
- [x] frontend-v3/src/utils/path-map.test.ts — TC-RP/TC-NR/TC-BPM 现有用例

## 关键实证（minimal_validation 核心发现）

- [x] 读 useEntryDetailComputed.ts:40 — pathMap 只被 useMarkdown 消费，无第二条 key 消费方
- [x] markdown-it normalizeLink（mdurl.encode v2.0.0）在 **parse 期**就完成编码（link.mjs L45 / image.mjs L40），resolvePath 收到的是已编码字符串
- [x] **BDD-7 前提勘误**：mdurl.encode 默认 keepEscaped=true，**不会**把 `a%20b.png` 编成 `a%2520b.png`（合法转义保留原样）；真正编码空格的是 `a b.png → a%20b.png`。BDD-7 测试语义仍有效（验证 decode 恰好一次），但 When 的编码形式与实际 markdown-it 输出不符 → P3 需保留测试、修正理由文本
- [x] 中文/日文/重音/空格/韩文经 mdurl.encode → decodeURIComponent 单次还原全部 PASS（mv-tpv0089.mjs）
- [x] 畸形 `%`（`100%done`）decodeURIComponent 抛 URIError → 需 try/catch（BDD-6）
- [x] 外部引用编码形式（`%23anchor`/`https%3A%2F%2F`）decode 后命中守卫正则 → 守卫语义天然保留（pathMap 不含外部 key，decode 结果必 miss）
- [x] 字面% 文件名与空格文件名歧义：源码 `a%20b.png` 两种解读，raw 优先匹配字面% 文件（最精确解读）

## P2 完成

- [x] P2-design.md 落盘（196 行）：candidate_count=2（消费侧 decode vs 构建侧 encode，选 A 排除 B 理由充分）、四字段齐全、P5_e2e 已声明、minimal_validation 实证（含 BDD-7 前提勘误 + 外部守卫 + 畸形 %）、files_to_read 已产出、BDD-6/7 防御要求显式覆盖
- [x] [SCOPE+] 标记：建议增补 BDD-7'（字面 % 文件名 raw 命中回归保护）

[PROD_NOT_TOUCHED] 纯文档修订，未运行服务、未触碰生产环境
