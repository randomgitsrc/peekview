---
phase: P4
task_id: TPV0104
type: progress
trace_id: TPV0104-P4-20261125
prod_touched: false
---
2026-11-25T06:20:51+08:00 data-viewers: 已读 dispatch-context + implementer.md + P2 落点表(:100-124) + 3 个 tpv0104 红灯用例
2026-11-25T06:22:54+08:00 data-viewers: useCsvParser 重写为单次状态机（计数/构造解耦、不 break、headerSeen 前置）+ CsvParseResult.constructedRows 必填 — 完成
2026-11-25T06:24:40+08:00 data-viewers: TableView(3 shallowRef/文案/双分支) + file-bytes.ts 新建 + HtmlViewer(file prop) + TreeView(size prop) 完成；tests_filter 4 files/70P + tpv0104 3 files/22P 全绿
2026-11-25T06:27:09+08:00 data-viewers: tests_filter 70P/0F + tpv0104 本批 22P/0F 全绿；make typecheck exit 0；全量前端 21F（基线 31F，本批 -10，剩余全部属 detail-outline/detail-navigation/backend 批）；无回归
2026-11-25T06:36:31+08:00 backend-render-budget: html_render_service 完成（_MAX_INJECT_IDS 50→40、2MiB/8MiB 预算常量、REASONS 六元闭集、select_inject_ids+InjectSelection、build_skip_report_html 转义 <、_process_css_refs 关键字可选 owners/consumed_out 透传含递归、inject_resources 七处埋点+skipped_out 出参）
2026-11-25T06:36:31+08:00 backend-render-budget: api/files.py 完成（render_html_file 预算编排六类 reason + _build_sibling_data None 补记 binary_too_large + 报表块追加到 body 尾，CSP/响应头一字未改）
2026-11-25T06:36:31+08:00 backend-render-budget: entry_service.py 完成（_files_of_entry_query 单点 order_by coalesce(path,filename),id；6 处 select(File) 收敛——get_entry/update_entry/_find_by_idempotency_key/get_entry_with_share/get_entry_by_api_key/get_entry_files）
2026-11-25T06:39:43+08:00 backend-render-budget: docs/architecture/html-preview-security-modes.md 新建（两档定义 + 当前默认交互式 Demo + connect-src 仍允许 https 属独立决策）—— BDD-45 四要素 grep 全 PASS
2026-11-25T06:39:43+08:00 backend-render-budget: 发现并修正 P3 夹具缺陷 _render_url 对 list 插值（test_html_render.py:62，TPV0104 段外）→ 按前端 join(',') 约定序列化；修后本批 89P/0F
2026-11-25T06:39:43+08:00 backend-render-budget: 全量 backend 唯一失败=预存 test_cli_remote::test_config_set_remote_api_key（沙箱只读 ~/.peekview/），零回归；= inject_resources( 13 / _process_css_refs( 8
2026-11-25T06:41:23+08:00 backend-render-budget: BDD-45 前端 vitest 断言实测 6 passed（tpv0104-migration-and-docs.test.ts）；本批完成，P4-implementation.md 已按批次分章追加（frontmatter 补 implementation_dirs: [frontend-v3/src, backend]）
2026-11-25T06:40:20+08:00 detail-outline: 已收到主 Agent 范围更正——本批收窄为 A 组 4 文件（useMarkdown/useEntryDetailComputed/MarkdownViewer/TocNav），B/C 组移交 detail-navigation；B/C 改法写入 P4-implementation.md 供参考
2026-11-25T06:41:00+08:00 detail-outline: 基线复核 tpv0104-markdown-headings = 4F/2P（确认红灯）；useMarkdown.ts:332 的 level>=2&&<=4 与 text=nextToken.content 是根因
2026-11-25T06:41:44+08:00 detail-outline: useMarkdown.ts 完成——inlinePlainText() 新增（text/code_inline 取 content、image 取子树、softbreak→空格）+ heading_open 层级 1–4 + slugify 后 usedHeadingIds Map 去重（base/-1/-2）+ text 用纯文本 + attrSet('id') 与 headings.push 同一处；tpv0104-markdown-headings 6P/0F 转绿
2026-11-25T06:42:43+08:00 detail-outline: useEntryDetailComputed.ts 完成——extractHeadings 整段删除（/^(#{1,6})/ 逐行正则归零）、tocHeadings 改 ref<TocHeading[]> + setTocHeadings(list) + watch(activeFile.id) 清空、导出名 tocHeadings 不变；两既有 computed spec 12P/0F 无回归
2026-11-25T06:52:00+08:00 detail-navigation: 已读 dispatch-context 全文（A/B/C0/C）+ implementer.md + P1 §3.2-3.4 BDD 原文 + P3 用例映射；基线实测 tpv0104-default-file 12F/249P
2026-11-25T06:53:30+08:00 detail-navigation: A 组完成——utils/default-file.ts 新建（effectivePath/根判定/排序键/id 兜底 + normalizeFileQuery 纯函数）；stores/entryDetail.ts loadEntry 改 resolveDefaultFile 且 content 只在与 targetFile 同 id 时复用；EntryCard/EntryListRow 死代码删除（router.push('/'+slug)）
2026-11-25T06:57:10+08:00 detail-navigation: B 组完成——EntryDetailView 首次加载读 route.query.file（parseFileId + Number.isInteger 校验）、删 firstFileId 白名单化（syncUrl 内 delete firstFileId）、页内切换 watch(activeFile.id) 走 normalizeFileQuery + router.replace 合并 route.query、suppressUrlSync 守卫；utils/__tests__/default-file.spec.ts 新建 8 用例（normalizeFileQuery 4 + resolver 4）
2026-11-25T07:04:00+08:00 detail-navigation: C0 完成——EntryDetailContent 删 :headings/:select-heading、改 @headings="$emit('toc-headings',$event)"（emits 加 'toc-headings'）；EntryDetailView 加 @toc-headings="setTocHeadings" + 解构 setTocHeadings；桌面 TOC 默认展开改 watch(tocHeadings,...,{flush:'post'}) + userToggledToc 守卫（t031/t067 的 extractHeadings mock 换成 setTocHeadings）
2026-11-25T07:05:30+08:00 detail-navigation: C 完成——Header 加 activeFile prop + 'fullscreen' emit + .actions-area icon-btn(Maximize/16/aria-label/守卫 currentEntry&&activeFile)；MobileBar 同型按钮 + gap space-2→space-1；View 两端接线 + handleFullscreen（复用 normalizeFileQuery）；Content 两个 aside v-if 加 && !zenMode；HtmlViewer :file / TreeView :size 接线
2026-11-25T07:06:40+08:00 detail-navigation: 因 t082 既有行数契约（EntryDetailView<300、entryDetail.ts<150）把 URL 同步 + TOC 自动展开抽到 composables/useEntryDetailUrlSync.ts，View 295 行 / store 145 行，契约保持不放宽

## 重试 #1（fix1）— 2026-11-25 08:22
- 已读 dispatch-context-fix1 + P4-review.md §7/§2/§3（3C+2M+4MINOR 清单已明确）
- 待读源码：api/files.py、services/html_render_service.py、frontend-v3/src/composables/useCsvParser.ts
- C1 DONE: api/files.py:389 cost = len(data.content.encode("utf-8"))，与 record.size 同口径（二进制仍计入 base64 长度，符合 P2 D6）[PROD_NOT_TOUCHED]
- C2 DONE: _append_inject_report 改用 re.finditer(r'</body\s*>', html, re.IGNORECASE) 取 matches[-1].start()，在【原串】上取下标；保留 rfind『最后一个』语义（评审建议的 re.search 取首个会把 §3-4 已知隐患从『插错位』放大成『真回归』）。单元级实测 7 形态（İstanbul/İİİ/大写BODY/</body >/多 body/无 body）全部 len 守恒、块存在、闭标签完整 [PROD_NOT_TOUCHED]
- C3 DONE(代码): inject_resources 新增关键字可选 file_ids: dict[int,int] (id(sibling)->File.id)，not_injectable 项补 file_id；render_html_file 建 sibling_file_ids 旁路 map 传入。skipped_out 与 file_ids 同时缺失时 raise ValueError 防漏传 [PROD_NOT_TOUCHED]
- M1 DECISION: 选方案 C 单独（inject Query max_length=4096）。实测证明方案 B 必然撞 P2 冻结不变式 requested-inlined==len(skipped)：K=100 时 len(skipped)=100/101 vs 500，两种落法都不成立；A 需 P2 授权。C 把『无界』转成『绝对上限 ~180KB/响应』(4KB 请求) [PROD_NOT_TOUCHED]
- M2 DONE: owners 拆 text_owners / binary_owners 两命名空间（_process_css_refs 两处 _mark 拆 _mark_text/_mark_binary，签名同风格关键字可选）；四处 consumed.add(id(owners[..])) 改指对应命名空间。消除 text/binary 同名键互相覆盖
- MINOR DONE: ①删 parse_inject_ids（全仓零调用，已确认改后 grep 无残留）②_BINARY_SIZE_LIMIT 单源（api/files.py 改为 import，删本地重复定义）③REASONS 改 frozenset 并在 build_skip_report_html 单出口做 unknown-reason 校验（生产侧真正消费；测试侧 test_html_render.py:684 那份未动）④useCsvParser.ts:64-65 删 commit() 后的冗余 row/field 重置
- 自查: batch pytest tests/test_html_render.py+test_entry_service.py+test_entry_file_order.py = 89 passed / 0 failed；make lint exit 0；'= inject_resources(' 13（测试文件）/ '_process_css_refs(' 8（测试文件）不变
- 三个 CRITICAL + M1 自测（进程内临时 app，与 P4-review §1 同源）：C1 PASS（12x中文CSS: inlined=4/skipped=8 total_budget，响应 7.67MiB<=8MiB，修复前 23.0MiB/2.88x）；C2 PASS（İstanbul: '</body>' 完整=True、报表块在 </body> 前=True）；C3 PASS（count_limit=3 + not_injectable=1 共存，缺 file_id 条目=0，重放 P3 BDD-38③=True）；M1 PASS（inject 4899B->422 / 2099B->200）
- M2 自测 PASS（评审单元形态：报表 skipped=id22，事实文本已注入=True/二进制=False，宣称 inlined={11}）
- M2 更正：评审「HTTP 近亲」根因实为**存储层同名覆盖**（磁盘仅 1 个文件 data/default/1/app.css，DB 留 2 行内容全被后者覆盖），非 owners 缺陷；报表 inlined=1 是准确的。未修，已标 [SCOPE+]
- 全量后端: 1199 passed / 3 skipped / 0 failed（+ test_cli_remote 22 = 1221，与基线同）；前端 1514P/4S/0F；make lint exit 0；make typecheck exit 0
- CSP/响应头零改；_MAX_INJECT_TOTAL_BYTES=8MiB / _MAX_INJECT_IDS=40 / REASONS 六元 未变；SiblingFileData 未加字段；P3 断言零改；未 commit
- P4-implementation.md 已追加「重试 #1」章节（含 M1 决策理由、C2 偏离说明、M2 更正、2 条偏差申报）
