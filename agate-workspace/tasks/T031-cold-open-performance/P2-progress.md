# P2 Progress — architect

## 输入文件读取

1. **P2-dispatch-context-architect.md** ✓ — 目标：产出 P2-design.md；约束：纯前端、Promise.all 并行、`<a>` 嵌套交互元素处理、骨架屏双视图、`·` 三处修复、Explore 文案两处、minimal_validation 必须做
2. **architect.md 角色定义** ✓ — 多方案≥2、四字段、files_to_read、minimal_validation、gate_commands 用 Makefile target
3. **P0-brief.md** ✓ — 5 个子项、env_constraints: debug 127.0.0.1:8888、ui_affected: true
4. **P1-requirements.md** ✓ — 7 条 BDD、8 条隐含需求、domains:[frontend]、risk:medium、requires_minimal_validation:true
5. **EntryCard.vue** ✓ — 当前结构：div.entry-card > div.card-actions(buttons, @click.stop) + div.card-body(role=button, @click navigate)。card-body 内有 router-link.meta-username(@click.stop) + span.meta-sep(` · `)。改 `<a>` 需重构 DOM 层级。
6. **EntryListRow.vue** ✓ — 类似结构：div.entry-list-row(role=button, @click navigate) > div.entry-content(router-link.meta-username @click.stop + span.meta-sep ` · `) + div.entry-right(buttons @click.stop)
7. **entry.ts store** ✓ — loadEntry 串行链：await getEntry → selectFile(files[0]) → 内部 await getFileContent。改并行需 Promise.all([getEntry, getFileContent])，但 getFileContent 依赖 entry.slug 和 file.id（来自 getEntry 响应）→ 不能完全并行！需要 entry 响应后才知道 file id。
   - 关键发现：getFileContent 需要 entry.slug + file.id，这些来自 getEntry 响应。真正能并行的是：getEntry 完成后，selectFile 内部的 getFileContent 可以立即发出（当前已是如此）。实际瓶颈是 loadEntry 中 `await selectFile(entry.files[0])` 是串行的——但 selectFile 本身已经是 getEntry 之后才能调用的。
   - 重新分析：当前链是 getEntry → (设置 currentEntry) → selectFile → getFileContent。真正的串行等待是 getEntry 完成后才开始 getFileContent。但 getFileContent 需要 slug 和 fileId，确实依赖 getEntry。所以"并行"的含义是：getEntry 返回后立即并发请求 fileContent，而不是等 selectFile 的各种状态设置完。实际上当前代码已经是 getEntry 后立即 selectFile→getFileContent，没有额外等待。
   - 再看：P0 说"串行加载链 getEntry → selectFile → getFileContent"。实际上 selectFile 只是设置 activeFile 然后请求 content，没有额外网络请求。所以真正的网络请求只有两个：getEntry 和 getFileContent，且 getFileContent 依赖 getEntry 的结果（需要 slug 和 fileId）。
   - 但是！列表页已经有 entry 数据（包括 files 数组）。从列表页点击卡片时，我们已经知道 slug 和 files[0].id！可以在导航到详情页时，同时发出 getEntry 和 getFileContent 请求。这就是并行的机会。
8. **EntryListView.vue** ✓ — 加载态：`<div v-if="loading" class="loading-state"><span>Loading...</span></div>`（纯文本）。footer 有 `<span class="separator">·</span>`。搜索 placeholder="搜索标题、标签和文件内容..."。navigateToEntry 用 router.push(`/${entry.slug}`)。
9. **EntryDetailView.vue** ✓ — onMounted: await entryStore.loadEntry(props.slug, shareToken)。loading 态是 `<span>Loading...</span>`。meta-dot 是 CSS 空 span（不受 `·` 字体问题影响）。
10. **LandingView.vue** ✓ — hero-cta: `<router-link to="/explore" class="btn btn-primary">Explore</router-link>`（L45）；cta-band: 同样 `Explore`（L167）。两处需改。

## 关键设计发现

- **并行加载的真正机会**：列表页 entries 数据已含 files 数组（有 file id）。点击卡片导航时，可以把 slug + firstFileId 传给详情页，详情页同时发 getEntry 和 getFileContent(slug, fileId)。
- **`<a>` 改造**：HTML 规范禁止 `<a>` 内嵌套 `<button>` 和 `<a>`。当前 EntryCard 的 card-actions 和 meta-username 都在 card-body 内。方案：将 `<a>` 只包裹标题区域（card-title），或整卡用 `<a>` 但把 buttons/username 移到 `<a>` 外部（绝对定位覆盖）。
- **骨架屏**：需替换 EntryListView 的 "Loading..." 和 EntryDetailView 的 "Loading..."，覆盖 grid/list 双模式。

11. **router.ts** ✓ — 路由：`/:slug` → EntryDetailView（props: true）。详情页通过 props.slug 获取 slug。
12. **DESIGN.md** ✓ — Card: surface bg, border-strong, radius 14px, hover accent+lift。List item: padding 16px, border-bottom, hover surface-lower。无骨架屏规范（需自定义）。
13. **api/client.ts** ✓ — getFileContent(slug, fileId) 需要 slug + fileId。getEntry(slug, shareToken?) 返回 Entry（含 files 数组）。

## Minimal Validation 结果

用 Playwright CDP + page.setContent() 验证：
1. **`<a>` > `<button>`**：button 留在 `<a>` 内部（DOM 合法嵌套）。btn1Parent="A", btn1InsideLink=true。
2. **button 有 stopPropagation+preventDefault**：`<a>` 导航被阻止。navigated=false。
3. **button 无 stopPropagation**：点击 button 会冒泡触发 `<a>` 导航。navigated=true, url=example.com/page3。
4. **嵌套 `<a>` inside `<a>`**：HTML parser 打断结构——inner `<a>` 变成 outer `<a>` 的 sibling（parent=BODY）。**不可行**。
5. **右键点击 button 区域**：btn1.closest('a') 找到 link → 浏览器显示链接上下文菜单。

**结论**：
- 整卡 `<a>` 方案可行，但 buttons 必须 `@click.stop.prevent`
- username 不能用 `<a>`/`<router-link>` 嵌套在卡片 `<a>` 内（parser 会打断），需改为 `<span>` + click handler + `@click.stop.prevent`
- 右键菜单在 button 区域也显示链接菜单（可接受，button 区域很小且 hover 才显示）
