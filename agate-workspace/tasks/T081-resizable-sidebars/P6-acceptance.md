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

- PASS BDD-01: drag file-sidebar handle right 50px, width 260px->310px, delta=50 (screenshots/bdd-01-drag-file-sidebar.png) (vision: P6-evidence/vision-reports/bdd-01.yaml)
- PASS BDD-02: drag toc-sidebar handle left 30px, width 240px->270px, delta=30 (screenshots/bdd-02-drag-toc-sidebar.png) (vision: P6-evidence/vision-reports/bdd-02.yaml)
- PASS BDD-03: clamp to max 500px when dragged beyond (screenshots/bdd-03-clamp-max.png) (vision: P6-evidence/vision-reports/bdd-03.yaml)
- PASS BDD-04: clamp to min 150px when dragged beyond (screenshots/bdd-04-clamp-min.png) (vision: P6-evidence/vision-reports/bdd-04.yaml)
- PASS BDD-05: localStorage restore after reload, width=350px (screenshots/bdd-05-localstorage-restore.png) (vision: P6-evidence/vision-reports/bdd-05.yaml)
- PASS BDD-06: invalid localStorage "abc" fallback to default 260px (test-output.log)
- PASS BDD-07: out-of-range localStorage "9999" fallback to default 240px (screenshots/bdd-07-oor-fallback.png) (vision: P6-evidence/vision-reports/bdd-07.yaml)
- PASS BDD-08: viewport 800px resize handle display=none (screenshots/bdd-08-mobile-no-handle.png) (vision: P6-evidence/vision-reports/bdd-08.yaml)
- PASS BDD-09: zen mode hides handle, visible=false (screenshots/bdd-09-zen-mode.png) (vision: P6-evidence/vision-reports/bdd-09.yaml)
- PASS BDD-10: single-file entry no file-sidebar handle, handle=0 (screenshots/bdd-10-no-file-sidebar.png) (vision: P6-evidence/vision-reports/bdd-10.yaml)
- PASS BDD-11: non-markdown multi-file entry no toc handle, toc-sidebar=0 handle=0 (screenshots/bdd-11-no-toc-sidebar.png) (vision: P6-evidence/vision-reports/bdd-11.yaml)
- PASS BDD-12: drag body.resize-active=true user-select=none (test-output.log)
- PASS BDD-13: drag no scroll, scrollTop 0->0 (screenshots/bdd-13-no-scroll.png) (vision: P6-evidence/vision-reports/bdd-13.yaml)
- PASS BDD-14: dblclick reset file-sidebar 350->260px (screenshots/bdd-14-dblclick-reset-file.png) (vision: P6-evidence/vision-reports/bdd-14.yaml)
- PASS BDD-15: dblclick reset toc-sidebar 180->240px (screenshots/bdd-15-dblclick-reset-toc.png) (vision: P6-evidence/vision-reports/bdd-15.yaml)
- PASS BDD-16: keyboard focus role=separator tabIndex=0 focus-visible=true outline=2px (screenshots/bdd-16-keyboard-focus.png) (vision: P6-evidence/vision-reports/bdd-16.yaml)

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
