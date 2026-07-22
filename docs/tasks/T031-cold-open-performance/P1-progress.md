## 2026-07-22 P1 analyst progress

### P0-brief.md 已读
- 5 个子项：并行加载、卡片改 <a>、`·` 分隔符、搜索 placeholder 中文、Explore 按钮文案
- 排除项：summary 预览(T066)、标签过滤(backlog)、详情页孤岛(T067)
- pruning: 保守，P2/P6 不可裁

### entry.ts 已读
- loadEntry(): await getEntry → await selectFile(files[0]) → await getFileContent — 串行 3 次网络请求
- selectFile() 内部 await api.getFileContent — 确认串行链

### EntryDetailView.vue 已读
- onMounted: await entryStore.loadEntry(slug) — 整个串行链在 mount 时阻塞
- loading 状态只有一个 "Loading..." 文本，无骨架屏

### EntryListView.vue 已读
- 搜索 placeholder: "搜索标题、标签和文件内容..." (中文)
- navigateToEntry: router.push(`/${entry.slug}`) — 纯 JS 导航
- loading 状态: 纯文本 "Loading..."，无骨架屏
- footer 也有 `·` 分隔符

### EntryCard.vue 已读
- card-body: div role="button" @click emit navigate — 非 <a> 标签
- meta-sep: `<span class="meta-sep"> · </span>` — U+00B7 字符
- 嵌套交互: card-actions 有 toggle/delete 按钮，meta-username 有 router-link @click.stop

### EntryListRow.vue 已读
- 整行 div role="button" @click emit navigate — 非 <a> 标签
- 同样有 `·` 分隔符和嵌套 router-link

### LandingView.vue 已读
- "Explore" 按钮出现 2 处: hero-cta (line 45) 和 cta-band (line 167)
- 均为 router-link to="/explore"

### 隐含需求识别
1. <a> 改造需处理嵌套交互元素（card-actions 按钮、meta-username router-link）的事件冒泡和 a11y
2. 并行加载需保持 loading 状态一致性（entry 加载失败时不应继续请求 file content）
3. 骨架屏需同时覆盖 grid 和 list 两种视图模式
4. `·` 修复需覆盖 EntryCard、EntryListRow、EntryListView footer 三处
5. 搜索 placeholder 改英文需确认措辞（与后端搜索范围一致）
6. "Explore" 改文案需同时改 LandingView 两处
7. <a> 改造后需保留键盘可访问性（Enter/Space 触发导航）
8. 并行加载改造不能破坏 share token 流程（loadEntry 接受 shareToken 参数）
