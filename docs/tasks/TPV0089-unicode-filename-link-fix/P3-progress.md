# P3-progress — test-designer (TPV0089)

## [1] 输入文件读取完成
- P3-dispatch-context-test-designer.md：派发指引已读。产出 = P3-test-cases.md + path-map.test.ts 追加 + seed-data/unicode-filenames/ fixture。gate P3 命令 = `cd frontend-v3 && npx vitest run src/utils/path-map.test.ts`。
- test-designer.md 角色文件已读。
- P0-brief.md：根因 = resolvePath 未 decode markdown-it percent-encode 的引用；改动面集中 path-map.ts；P3 不可跳；env 约束 = 严禁触碰 :8080/~/.peekview/。
- P1-requirements.md：13 BDD，BDD-1~9 单元级 / BDD-10~13 E2E。
- P2-design.md：方案 A（消费侧 decode，raw 优先 + decode-once 兜底 + 守卫重跑 + matchRef 抽取），normalizeRef/buildPathMap 零改动。
- path-map.ts：现状已读。resolvePath 只有 raw exact→basename 查找，无 decode。
- path-map.test.ts：既有 TC-RP(10)/TC-NR(18)/TC-BPM(10) 基线已读，追加不得破坏。
- seed-data/：已确认现有 22 个子目录，无任何非 ASCII 文件名。seed-debug.py 用 BINARY_OVERRIDES 处理二进制（PNG），逐目录加载 meta.json + 内容文件。
- useMarkdown.ts:111-134,293-327：4 处 resolvePath 调用点已读（image rule L299 / link_open rule L317 / rewriteHtmlRefs L117/L126）。
- e2e 参考：render-regression.spec.ts（T085 结构）、png-verify.spec.ts、playwright.config.ts（CDP :18800，BASE_URL 默认 127.0.0.1:8888）。

## [2] 关键设计决定
- fixture 必须含真实 PNG。seed-debug.py 默认 read_text 会崩 → **必须给 seed-debug.py 的 BINARY_OVERRIDES 增加 unicode-filenames 条目**（这是让 fixture 可被 debug-seed 加载的必要支持改动，非实现改动）。
- fixture 的 markdown 文件命名为 README.md，保证排序后成为 files[0]（默认渲染文件）。
- 图片引用用 basename 相对路径（markdown-it 自动 percent-encode），空格文件名用尖括号包裹。

## [3] 产出完成 + 自跑红灯确认
- path-map.test.ts 追加 TC-UNI-01~13（BDD-1~9 1:1 + P1 守卫补充），未删既有 TC-RP/TC-NR/TC-BPM。
- `npx vitest run src/utils/path-map.test.ts` → **6 failed | 45 passed**。失败 = TC-UNI-01/02/03/04/05/08（BDD-1~5+7），均为 `expected null to be <fileId>`（被测模块无 decode），真红灯。BDD-6/8/9 与守卫用例绿灯（既有行为保护）。
- 编码串已用 node `encodeURIComponent` 逐条核对，与 P1/P2 完全一致，无"断言与数据矛盾"bug。
- frontend-v3/e2e/unicode-filename-link.spec.ts：BDD-10~13 共 6 个测试函数（桌面+移动），`npx playwright test --list` 列出 12 条（2 project），ESM 用 fileURLToPath 解析证据目录。
- `npx vue-tsc --noEmit` 通过（exit 0）。
- fixture scripts/seed-data/unicode-filenames/：meta.json + README.md + 5 PNG（32×32 实 PNG，file 校验）+ 2 txt。seed-debug.py BINARY_OVERRIDES 新增 unicode-filenames 条目（5 PNG base64 与磁盘字节一致，已核对）。seed-debug.py 语法 OK。
- 环境隔离：未触碰 :8080 / ~/.peekview/，未运行任何生产命令。

## [状态标记] [PROD_NOT_TOUCHED]
