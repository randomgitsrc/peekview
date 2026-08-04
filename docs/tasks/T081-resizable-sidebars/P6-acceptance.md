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

# P6 验收结果：详情页侧边栏可拖拽调整宽度

[NO_NEED_CONFIRM]

## BDD 逐条验收

- PASS BDD-01: 拖拽 file-sidebar handle 改变左栏宽度，260px→310px(screenshots/bdd-01-drag-file.png) (vision: P6-evidence/vision-reports/bdd-01.yaml)
- PASS BDD-02: 拖拽 toc-sidebar handle 改变右栏宽度，240px→280px(screenshots/bdd-02-drag-toc.png) (vision: P6-evidence/vision-reports/bdd-02.yaml)
- PASS BDD-03: 拖拽超出最大宽度时 clamp 到上限，500px (max=500)(screenshots/bdd-03-clamp-max.png) (vision: P6-evidence/vision-reports/bdd-03.yaml)
- PASS BDD-04: 拖拽超出最小宽度时 clamp 到下限，160px (min=160)(screenshots/bdd-04-clamp-min.png) (vision: P6-evidence/vision-reports/bdd-04.yaml)
- PASS BDD-05: 刷新后从 localStorage 恢复宽度，350px(screenshots/bdd-05-restore.png) (vision: P6-evidence/vision-reports/bdd-05.yaml)
- PASS BDD-06: localStorage 非法值回退默认，260px (default)(test-output.log)
- PASS BDD-07: localStorage 超范围值回退默认，260px (default)(test-output.log)
- PASS BDD-08: 视口 <1024px 时不显示 handle，display=none(screenshots/bdd-08-mobile.png) (vision: P6-evidence/vision-reports/bdd-08.yaml)
- PASS BDD-09: zen mode 隐藏 handle，visible=false(screenshots/bdd-09-zen.png) (vision: P6-evidence/vision-reports/bdd-09.yaml)
- PASS BDD-10: 单文件 entry 无 file-sidebar handle，handle=false(test-output.log)
- PASS BDD-11: 非 Markdown entry 无 toc-sidebar handle，handle=false(test-output.log)
- PASS BDD-12: 拖拽期间 body 有 resize-active class，user-select: none(screenshots/bdd-12-userselect.png) (vision: P6-evidence/vision-reports/bdd-12.yaml)
- PASS BDD-13: 拖拽期间不触发内容区滚动，before=0 during=0(test-output.log)
- PASS BDD-14: 双击 file handle 重置为默认宽度，360→260px(test-output.log)
- PASS BDD-15: 双击 toc handle 重置为默认宽度，290→240px(test-output.log)
- PASS BDD-16: resize handle 可通过键盘聚焦，focused=true tabIndex=0 role=separator(screenshots/bdd-16-keyboard.png) (vision: P6-evidence/vision-reports/bdd-16.yaml)

**Summary**: 16/16 PASS, 0 FAIL

## 环境隔离

[PROD_NOT_TOUCHED]

所有验证在 debug 环境（:8888，隔离数据 /tmp/peekview-debug/）执行，未触碰生产环境。
