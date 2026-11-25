---
phase: P4
task_id: TPV0104
type: progress
trace_id: TPV0104-P4-20261125
prod_touched: false
---
2026-11-25T07:35:38+08:00 design-review: 已读 dispatch-context + design-review.md + P2 §UI 设计(540-720) + P4-implementation.md；git diff 覆盖 8 个前端文件 + 4 个新建；确认 :8888 在线 / :8080 不可达 / CDP 18800 在线 [PROD_NOT_TOUCHED]
2026-11-25T07:35:38+08:00 design-review: AI Slop 扫描（暗+亮双主题全 DOM 遍历 color/backgroundColor/backgroundImage）→ 渐变 0 / 紫 violet 0；新文案均为具体数值非泛化措辞 —— 通过
2026-11-25T07:35:38+08:00 design-review: TOC h1 非 active 实测 fontWeight=600 / color=rgb(233,238,244)=--c-text / marginTop=12px / x=1057 与 h2 同缩进；h2 为 fw400 / rgb(154,167,180) → 可区分（两向之一）
2026-11-25T07:35:38+08:00 design-review: TOC h1 active 实测（DOM 注入 .active + 等 400ms 过渡落定）color=rgb(77,141,255)=--accent-color / fw 仍 600 / marginTop 仍 12px —— R16 拆分规则生效，暗色亮色双向各验一次均成立（两向之二）
2026-11-25T07:35:38+08:00 design-review: 对比度实测 暗色 h1 15.26:1 / h2 7.26:1；亮色 h1 15.8:1 / h2 5.25:1 —— 全过 WCAG AA 4.5:1；与 P2 预测 15.26 一致
2026-11-25T07:35:48+08:00 design-review: 全屏按钮（桌面）可访问名称实测 aria-label=全屏阅读、title=null、无 disabled 属性/无 aria-disabled；全页仅靠 aria-label/文本匹配「全屏|fullscreen」的元素数 == 1（mermaid-charts 13 个 DiagramBlock 的 title="Fullscreen" 未污染计数，因其无 aria-label 且文本为 ⧉）
2026-11-25T07:35:48+08:00 design-review: 全屏按钮图标实测 SVG width/height=16 / 实际渲染 16x16，与兄弟 Copy(16)/More(16) 一致；transition=0.15s 与兄弟逐项相同（继承 .icon-btn 无自定义）；tooltip 1 个（桌面）hover opacity=1 正常显示
2026-11-25T07:35:48+08:00 design-review: 全屏按钮点击实测 /dsh-architecture → /dsh-architecture/f（默认文件不带 file=），符合 BDD-25；404 页 [data-testid=detail-fullscreen-btn] 计数 0 而 .actions-area 仍在（v-if 守卫有效，R14 未复发）
2026-11-25T07:35:48+08:00 design-review: 移动端全屏按钮实测 aria-label=全屏阅读 / title=null / tooltip 0 个（与底栏既有 4 按钮 tooltip=0 一致，M6 落地）；热区 44x44 达 DESIGN.md §9；:focus-visible 2px solid rgb(77,141,255) 与兄弟一致
2026-11-25T07:35:48+08:00 design-review: 移动 360px 实测（5 组素材 × 3 档 = 15 组）scrollWidth-edge=clientWidth、overflow=0、height=64、spacer 余 5.39px（与 P2 预测一致）；最坏形态含 wrap 按钮共 7 按钮仍 0 溢出；overflow-trigger 右缘 348<360 未被裁
2026-11-25T07:35:48+08:00 design-review: 移动端按钮热区实测除既有 overflow-trigger 38px（本任务未改、属既有偏差）外全部 ≥44px；新增全屏按钮 44x44 命中测试 elementFromPoint 命中自身；底栏底部遮挡实测 barTop=780 / lastKidBottom=748（无遮挡）
2026-11-25T07:35:59+08:00 design-review: 截断态表头实测（50001 行 CSV / maxRows 默认 50000）thead 37.5px、4 个 th 全部 .th-label 文字可见（id 12px/name 35px 等非零宽高、color rgb(233,238,244)）、.th-sort-btn 0 / .th-filter 0；非截断对照 thead 65.5px 且 sort 1+filter 1 —— 双分支落地正确、表头不塌陷
2026-11-25T07:35:59+08:00 design-review: 截断态表头垂直居中偏差实测 -0.25px（P2 预测值完全一致）；表头文字左内边距 xDelta=12px 与非截断态相同 → 无横向跳动；.th-label display 由 block(在按钮内)→inline(v-else)，行高 21→19px 属预期
2026-11-25T07:35:59+08:00 design-review: 截断 banner 实测文案「数据量过大，已显示前 50,000 行，共 50,001 行」含 shown 与 total 两数；360px 移动端换行 2 行、overflow=0、与 Download 按钮无重叠（msgRight 223 < btnLeft）
2026-11-25T07:35:59+08:00 design-review: /f 下两侧栏 DOM 实测（多文件 k8s-deployment，非单文件误导样本）普通态 .file-sidebar=1/.toc-sidebar=1 → /f 下均 == 0（tocItems 也为 0）；带 ?file=14 同样 0；.detail-header 保留 DOM 但 display:none（v-show 范式未破）；contentArea 宽度 780→1280
2026-11-25T07:35:59+08:00 design-review: 移动端 TOC 抽屉（390px）h1 fw600/rgb(233,238,244)、h2 fw400/rgb(154,167,180) —— 与桌面侧栏同源，视觉层级在抽屉内也成立（未被 scoped 样式遗漏）
2026-11-25T07:35:59+08:00 design-review: 多 h1 场景（3 个 h1 + 4 个 h2 + 1 个 h3）实测每个 h1 均 fw600/主文字色/marginTop 12px，与相邻 h2 的 4px 形成分组节奏；title→h1 间距 12px 与 h1→h2 间距 4px 构成可读层级
2026-11-25T07:35:59+08:00 design-review: 标题三档不截断实测 1024/1280/1440 .title-group scrollWidth==clientWidth（377/633/793）、truncated=false、body 无横向滚动；.actions-area 三档恒 422.69px（新增按钮未挤压标题）
2026-11-25T07:35:59+08:00 design-review: 键盘可达性实测 Tab 顺序 = logo → TOC → Source → Star → 全屏阅读 → Copy → More，新增按钮位置合理；:focus-visible 落定后 outline 2px solid rgb(77,141,255) offset 2px 与 Copy/Star/TOC 完全一致（过渡 150ms 需等落定再读，首帧读数为过渡中间值）
2026-11-25T07:36:08+08:00 design-review: 发现 F1（INTERACTION, low）——正常态 th-filter input 与 th-sort-btn 并排时 thead 高 65.5px，截断态去掉两者后降到 37.5px，虽不塌陷但表头行高在一次状态跃迁里变化 28px；属 P2 已接受项（R12 实测 thead −28px 为设计预期），登记为非阻断
2026-11-25T07:36:08+08:00 design-review: 发现 F2（INTERACTION, low）——底栏既有 overflow-trigger 热区 38x38 未达 DESIGN.md §9 的 44px；本任务未改该控件（layout.css 未在 diff 内），且 P2 只要求新增按钮达标 —— 属既有偏差，不在本任务范围，登记备查
2026-11-25T07:36:08+08:00 design-review: 发现 F3（VISUAL, low）——TocNav 有两处失效/冗余声明：.toc-level-2 { padding-left: 0 } 是 no-op（P2 已明示只需不新增 .toc-level-1 版本，并未要求删这条既有行）；不构成缺陷，仅记录供后续清理
2026-11-25T07:36:08+08:00 design-review: 清理临时 entry（slug 删除，非 CLI）
2026-11-25T07:39:16+08:00 design-review: 发现 F4（INTERACTION, 中，校验方法纠偏）——EntryDetailContent.vue:90/120 的 :activeId 恒为 null（git blame 落 T082-P4 59ab6f7e，本任务未改），全仓无 IntersectionObserver / scroll 监听驱动 TOC 高亮 → h1 的 active 态在生产 UI 不可达；P2 校验点 ⑦ 括注「等价于滚到文章开头让 scroll-spy 点亮它」不成立，P6 若按字面滚动验证会假阴性。正向/反向均改用 DOM 注入 .active（本轮即如此实测），结论不受影响
2026-11-25T07:39:16+08:00 design-review: 非阻断观察 O1——360px 下底栏 spacer 余量仅 5.39px（7 按钮含 wrap），左「浏览簇」与右「动作簇」的视觉分隔几近消失；P2 布局组 L1 已实测并接受该代价（换来 0 溢出），非实现偏差
2026-11-25T07:39:16+08:00 design-review: 非阻断观察 O2——截断态同时禁用排序 + 过滤且无「加载更多」，仅剩 Download 出口；属 P1 BDD-32 明令（避免 5 万行客户端排序），建议 P8 CHANGELOG 措辞点明该降级
2026-11-25T07:39:16+08:00 design-review: 清理确认——3 个临时 entry 已 DELETE（200），复查均 404，全库无 dr- 前缀残留；临时脚本与截图留在 .agate-tmp/dr/（未进仓库），未 commit、未改实现代码与测试
2026-11-25T07:39:16+08:00 design-review: 8 项 dispatch 实测判据全部核完，产出 P4-review-design.md；status=approved（4 项发现均为已接受项/既有偏差/校验方法纠偏，无一项要求 implementer 改代码）
2026-11-25T07:42:28+08:00 design-review: 补测 F4 相关——无效 ?file= 三种形态（999999 / abc / -1）均静默回退 README、.error-state=0、URL 归一为 /k8s-deployment（BDD-16/18 未回归）；同时确认 activeId=null 为既有 T082 事实而非本任务引入
