---
phase: P6
task_id: T081-resizable-sidebars
type: acceptance
parent: P5-test-results/unit.md
trace_id: T081-P6-20260804
status: draft
created: 2026-08-04
agent: verifier
---

# P6 验收报告：详情页侧边栏可拖拽调整宽度

## 验收环境

- debug backend: http://127.0.0.1:8888（/tmp/peekview-debug/ 隔离数据）
- Chrome 151 CDP: localhost:18800
- 验证脚本: /tmp/opencode/t081-p6-final.cjs（Playwright CDP + DOM dispatchEvent）
- 测试页面: k8s-deployment（3文件含README.md）、markdown-test（2文件含rich-markdown.md 52标题）、edge-case-data（6非markdown文件）、yaml-docker-compose（1文件）

## BDD 逐条验收

- PASS BDD-01: 拖拽 file-sidebar handle 向右50px，宽度从260px变为310px（delta=50，误差0px）（screenshots/bdd-01-drag-file-sidebar.png）(vision: vision-reports/bdd-01.yaml)
- PASS BDD-02: 拖拽 toc-sidebar handle 向左30px，宽度从240px变为270px（delta=30，误差0px）（screenshots/bdd-02-drag-toc-sidebar.png）
- PASS BDD-03: 拖拽超出最大宽度时 clamp 到500px（max=500）（screenshots/bdd-03-clamp-max.png）
- PASS BDD-04: 拖拽超出最小宽度时 clamp 到150px（min=150）（screenshots/bdd-04-clamp-min.png）
- PASS BDD-05: 拖拽后刷新页面，宽度从 localStorage 恢复为350px（screenshots/bdd-05-localstorage-restore.png）
- PASS BDD-06: localStorage 非法值"abc"回退到默认260px（test-output.log）
- PASS BDD-07: localStorage 超范围值"9999"回退到默认240px（screenshots/bdd-07-oor-fallback.png）
- PASS BDD-08: 视口800px时 resize handle display=none（screenshots/bdd-08-mobile-no-handle.png）
- PASS BDD-09: zen mode 后 handle 不可见（visible=false）（screenshots/bdd-09-zen-mode.png）
- PASS BDD-10: 单文件 entry 无 file-sidebar handle（handle=0）（screenshots/bdd-10-no-file-sidebar.png）
- PASS BDD-11: 非markdown多文件 entry 无 toc handle（toc-sidebar=0, handle=0）（screenshots/bdd-11-no-toc-sidebar.png）
- PASS BDD-12: 拖拽期间 body.resize-active=true, user-select=none（test-output.log）
- PASS BDD-13: 拖拽期间 content-area scrollTop 不变（0->0）（screenshots/bdd-13-no-scroll.png）
- PASS BDD-14: 双击 file-sidebar handle 重置为260px（350->260）（screenshots/bdd-14-dblclick-reset-file.png）
- PASS BDD-15: 双击 toc-sidebar handle 重置为240px（180->240）（screenshots/bdd-15-dblclick-reset-toc.png）
- PASS BDD-16: resize handle 可键盘聚焦，role=separator, tabIndex=0, focus-visible=true, outline=2px solid（screenshots/bdd-16-keyboard-focus.png）

## 证据说明

- BDD-06 和 BDD-12 为查询类 BDD（断言值是唯一证据），使用 test-output.log 作为证据而非截图
- BDD-06 验证：localStorage 设为"abc"后刷新页面，file-sidebar 宽度=260px（CSS变量默认值）
- BDD-12 验证：mousedown 事件触发后，document.body.className 包含"resize-active"，getComputedStyle(body).userSelect="none"
- 其余14条 BDD 均有独立截图证据，截图均 >1KB，md5 去重通过（bdd-06和bdd-12截图因视觉相同已改用日志证据）

## verification_env

- 调试环境使用 /tmp/peekview-debug/ 独立数据库，与生产环境(:8080)完全隔离
- Chrome 151 CDP 模式连接 Windows GPU Chrome，viewport 设为 1280x800
- DOM dispatchEvent 方式模拟拖拽（比 page.mouse 更可靠触发 Vue @mousedown 监听器）
- TOC 可见性需要手动点击 TOC toggle 按钮（isTocOpen 非自动开启）

[NO_NEED_CONFIRM]

[PROD_NOT_TOUCHED]
