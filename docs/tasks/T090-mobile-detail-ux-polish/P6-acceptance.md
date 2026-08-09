---
phase: P6
task_id: T090-mobile-detail-ux-polish
type: acceptance
parent: P1-requirements.md
trace_id: T090-P6-20260809
status: draft
created: 2026-08-09
agent: verifier
---

# P6-acceptance — T090 移动端详情页 UX 打磨

## 验收方法说明

不复用 P5 的 E2E 测试结论。独立编写 Playwright 脚本（`chromium.connectOverCDP('http://127.0.0.1:18800')` 连接真实 Chrome，非 P5 使用的 Playwright 自带浏览器），针对 debug backend（127.0.0.1:8888）上的真实测试数据 entry（`t090-long-markdown`/`t090-long-code`/`t090-md-multifile`/`t090-py-multifile`）逐条重跑 P1-requirements.md 的全部 12 条 BDD，独立产出截图与断言日志。

- 断言日志：`P6-evidence/assert-log.json`（12 条 BDD 的完整测量数据）
- 操作类截图：`P6-evidence/screenshots/`（16 个文件，md5 全部唯一）+ 镜像存放于 `evidences/`
- 查询类截图（BDD-1/2/3/11，供人工参考但不作为 gate 证据）：仅存 `evidences/`，不进入 `P6-evidence/screenshots/`（避免同页面同状态截图与相邻 BDD 产生假阳性 md5 重复告警——例如 BDD-3 的 via-down/via-up 两次截图按设计就应视觉一致，这正是该条断言本身要证明的东西）
- 视觉分析：`P6-vision-20260809T075648.yaml`（vision-engine skill 实跑 12 次，逐一针对 8 个操作类 BDD 的代表性截图，blocker_count=0）

## BDD 逐条验收结果

- PASS BDD-1: Markdown 视图移动端连续上滑，meta-tags-bar 相对视口的位置随 scrollTop 线性变化（6 个采样点，每步 60px scrollTop 对应 60px 位置位移，最大偏差 0px），未出现因 header 高度突变导致的一次性跳变 (P6-evidence/assert-log.json)
- PASS BDD-2: Code viewer（CodeViewer 渲染 .py 文件）移动端连续上滑，meta-tags-bar 位置变化模式与 BDD-1 markdown 场景完全一致（同样 6 采样点、最大偏差 0px），验证跳变消除方案与 viewer 类型无关 (P6-evidence/assert-log.json)
- PASS BDD-3: 分别通过"直接滚动到 scrollTop=300"与"先滚动到 700 再回滚到 300"两条路径到达同一文档位置，meta-tags-bar 的 className/display/opacity/maxHeight 四项计算样式完全相同（JSON 深度相等），且 className 不含 hidden 类名，证明可见性完全由文档流位置决定、不存在与滚动方向绑定的独立显示/隐藏开关 (P6-evidence/assert-log.json)
- PASS BDD-4: 正文滚动到顶部(scrollTop=0)/中间(9206)/底部(18412，即 maxScroll)三个位置，底部操作栏 boundingBox 的 x/y 坐标在三次采样中完全相等（x=0, y=780, 390x64），验证 `position:fixed` 使其屏幕坐标不受正文滚动影响 (P6-evidence/screenshots/bdd4_mobile_bar_top.png, P6-evidence/screenshots/bdd4_mobile_bar_mid.png, P6-evidence/screenshots/bdd4_mobile_bar_bottom.png, P6-evidence/assert-log.json) (vision: P6-vision-20260809T075648.yaml)
- PASS BDD-5: 模拟两种可视高度（844px=地址栏收起、700px=地址栏展开）下，底部操作栏均满足 `y>=0` 且 `y+height<=视口高度`（844 高度下 y=780/height=64；700 高度下 y=636/height=64），均未超出可视区域边界或被裁切 (P6-evidence/screenshots/bdd5_mobile_height_844.png, P6-evidence/screenshots/bdd5_mobile_height_700.png, P6-evidence/assert-log.json) (vision: P6-vision-20260809T075648.yaml)
- PASS BDD-6: 依次点击底部操作栏 file-tree（抽屉标题显示"Files ·"）、toc（抽屉标题显示"Table of Contents ·"）、source-toggle（aria-pressed 依次 false→true→false）、copy（剪贴板内容含"Heading 1"）、overflow（aria-expanded=true 且 role=menu 元素可见）五项功能，全部行为与设计一致 (P6-evidence/screenshots/bdd6_mobile_filetree_open.png, P6-evidence/screenshots/bdd6_mobile_toc_open.png, P6-evidence/screenshots/bdd6_mobile_source_toggle_on.png, P6-evidence/screenshots/bdd6_mobile_overflow_menu.png, P6-evidence/assert-log.json) (vision: P6-vision-20260809T075648.yaml)
- PASS BDD-7: 非 markdown/html 场景（.py 多文件 entry）下 wrap 按钮点击前 class 不含 "primary"，点击后 class 变为含 "primary"，且截图确认代码长注释行确实从单行溢出变为多行换行显示 (P6-evidence/screenshots/bdd7_mobile_wrap_before.png, P6-evidence/screenshots/bdd7_mobile_wrap_after.png, P6-evidence/assert-log.json) (vision: P6-vision-20260809T075648.yaml)
- PASS BDD-8: markdown-body 左侧留白 8px、右侧留白 8px（对称，误差 0px ≤ 2px 阈值），相对基线单侧 40px 缩减比例 80%（≥75% 门槛）。**根因说明**：首次自动化测量得到不对称结果（left=8px, right=18px），经排查确认是验证环境 artifact——CDP 连接的真实 Chrome 在移动设备模拟（`Emulation.setDeviceMetricsOverride` mobile:true）下，`.content-area` 渲染出真实占用布局宽度的滚动条（10px），而真实移动浏览器与 Playwright 自带浏览器的 `isMobile` 选项均使用不占布局空间的 overlay 滚动条；用 `page.addStyleTag` 注入 `::-webkit-scrollbar{display:none}` 隐藏该滚动条后复测，left=right=8px，与 P2 设计候选 3-A"归零后总量8px、缩减80%"的预期完全吻合，且与 P5 E2E（用 Playwright 自带浏览器，天然无此 artifact）测得的对称结果一致，确认为验证环境限制而非产品缺陷 (P6-evidence/screenshots/bdd8_mobile_markdown_margin.png, P6-evidence/assert-log.json) (vision: P6-vision-20260809T075648.yaml)
- PASS BDD-9: 375px 极小屏下，`document.documentElement.scrollWidth`=375（等于视口宽度，无横向溢出），markdown-body 边界 [8, 367] 完全落在 [0,375] 视口范围内，截图确认正文文字完整可见无截断 (P6-evidence/screenshots/bdd9_mobile_375_no_overflow.png, P6-evidence/assert-log.json) (vision: P6-vision-20260809T075648.yaml)
- PASS BDD-10: 桌面端 viewport 下 meta-tags-bar 元素计数为 0（未渲染），markdown-body 位置随正文滚动线性变化（3 采样点，最大偏差 0px），桌面端滚动行为与改动前一致 (P6-evidence/screenshots/bdd10_desktop_scroll.png, P6-evidence/assert-log.json) (vision: P6-vision-20260809T075648.yaml)
- PASS BDD-11: 桌面端 `.markdown-body` computed style 的 `padding` 值精确等于 `24px`（即 `--space-5`），与改动前完全相等，未产生任何数值偏移 (P6-evidence/assert-log.json)
- PASS BDD-12: 移动端视口（390x844）下确认底部操作栏存在且可见（正向对照，避免"选择器未实现导致 toHaveCount(0) 假阳性通过"），切换至桌面端视口（1280x800）后 `mobile-bottom-bar` 元素计数为 0，操作按钮保留在顶部 header 区域 (P6-evidence/screenshots/bdd12_mobile_bar_present.png, P6-evidence/screenshots/bdd12_desktop_bar_absent.png, P6-evidence/assert-log.json) (vision: P6-vision-20260809T075648.yaml)

**Summary**: PASS: 12, FAIL: 0

## 覆盖范围核对

- 跨 viewer 覆盖：markdown（t090-long-markdown, t090-md-multifile）+ code/CodeViewer（t090-long-code, t090-py-multifile）两种 viewer 类型均已验证，与 P1 范围收窄声明一致
- 跨视口覆盖：mobile 390x844（BDD-1~8）、extra-small 375x812（BDD-9）、desktop 1280x800（BDD-10~12）
- [BASELINE_CHANGE] DESIGN.md L219 对应的行为反转（scroll-hide → 嵌入文档流）已通过 BDD-3 验证，且 BDD-1/BDD-2 的跳变消除验证与之互为佐证
- 未覆盖项（P1 已显式声明不新增自动化验证，非本轮遗漏）：iOS 真实虚拟键盘弹出与 safe-area 联动（P1 边界风险收口第4项，标记为已知限制/后续人工真机验证跟踪项，`capability_requirements.ios-real-device-keyboard-interaction` status=supplementable）；空 tags/无 owner 占位；横屏跨 640px 阈值过渡态。三项均为 P1 阶段已收口的范围外声明，本次验收不做二次质疑

## 验证环境已知限制

- **CDP mobile emulation 滚动条 artifact**：`Emulation.setDeviceMetricsOverride(mobile:true)` 在真实桌面 Chrome 上不会像真实移动浏览器那样自动切换为 overlay 滚动条，导致宽度类测量（如 BDD-8）在未处理时产生 10px 误差。已通过注入 CSS 隐藏滚动条规避，详见 BDD-8 小节根因说明。此限制仅影响本次验证方法本身，不代表产品在真实移动设备上的实际渲染存在该问题（真实移动 Safari/Chrome 均使用 overlay 滚动条）
- **Playwright `setViewportSize` 与手动 CDP override 混用冲突**：验证脚本早期版本混用 `page.setViewportSize()` 与手动 `cdp.send('Emulation.setDeviceMetricsOverride')`，导致 Playwright 内部视口状态跟踪覆盖手动 override，产生截图尺寸错位（已在脚本中修复为全程统一走手动 CDP override，不再调用 `page.setViewportSize`）。此为纯验证脚本问题，与被测产品代码无关
- iOS 真机虚拟键盘交互不在本次自动化验证范围内（见上节"覆盖范围核对"）

## 三个预检脚本结果

见对话中主 Agent 汇报（本文件由 verifier 自跑并在返回前确保三者 exit 0）。
