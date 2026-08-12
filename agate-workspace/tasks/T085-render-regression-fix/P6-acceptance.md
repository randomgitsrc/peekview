---
phase: P6
task_id: T085-render-regression-fix
type: acceptance
parent: P1-requirements.md
trace_id: T085-P6-20260802
status: draft
created: 2026-08-02
agent: verifier
---

# P6 验收报告 — T085 详情页渲染回归修复

## 验收环境

- debug backend: `http://127.0.0.1:8888`（独立数据目录 `/tmp/peekview-debug/`）
- CDP Chrome: `127.0.0.1:18800`（Chrome/151.0.7922.71）
- 测试数据: seed-data（svg-standalone, xml-maven-pom, markdown-test, python-entry-service, json-api-config）+ API 创建 t085-large-csv（150 行 CSV，用于 BDD-9/10/11）
- [PROD_NOT_TOUCHED]

## verification_env

```yaml
verification_env:
  debug_backend: "http://127.0.0.1:8888"
  chrome_cdp: "127.0.0.1:18800"
  viewport_desktop: "1280x800"
  viewport_mobile: "390x844"
  known_differences: "CDP Chrome 151 vs 生产 Chrome；debug DB 独立隔离"
```

## BDD 逐条验收

### BDD-1: SVG 文件默认渲染为图片预览

- PASS BDD-1: SVG 文件渲染为 ImageViewer 图片预览（img naturalWidth=800, hasImageViewer=true, hasTreeView=false），不显示树视图或源码 (screenshots/bdd-1-svg-preview.png) (vision: P6-evidence/vision-reports/bdd-vision-report.yaml)

**DOM 证据**: imgCount=1, svgImgCount=1, imgNaturalWidth=800, imgComplete=true, hasImageViewer=true, hasTreeView=false, hasCodeViewer=false
**Vision 证据**: SVG 暗色主题架构图成功渲染，图片正常加载无破损，无树视图节点

### BDD-2: 普通 XML 文件仍渲染为树视图（防回归）

- PASS BDD-2: XML 文件仍渲染为树视图（hasTreeView=true, treeNodeCount=59, imgCount=0），非图片预览、非纯源码 (screenshots/bdd-2-xml-tree.png) (vision: P6-evidence/vision-reports/bdd-vision-report.yaml)

**DOM 证据**: hasTreeView=true, treeNodeCount=59, imgCount=0, treeViewClass="tree-view"
**Vision 证据**: XML 显示为可展开/折叠树视图结构，有箭头图标和类型标签（object/string）

### BDD-3: SVG 文件不显示源码/渲染切换按钮

- PASS BDD-3: SVG 文件不显示 .toggle-btn 源码/渲染切换按钮（richToggleBtn=0, totalToggleBtn=0），有 ImageViewer 图片预览 (assert.log)

**DOM 证据**: richToggleBtn=0, totalToggleBtn=0, hasImageViewer=true, imgCount=1, ariaLabels=[]
**说明**: BDD-3 为查询类 BDD（断言无 toggle 按钮存在），DOM 断言为唯一证据，不要求截图/vision

### BDD-4: 富渲染格式源码视图可纵向滚动到底

- PASS BDD-4: JSON 切换到源码视图后可滚动到底（atBottom=true, lineCount=171, lastLineVisible=true） (screenshots/bdd-4-source-scroll-bottom.png) (vision: P6-evidence/vision-reports/bdd-vision-report.yaml)

**DOM 证据**: scrollHeight=3895, clientHeight=608, scrollTop=3287, atBottom=true, lineCount=171, lastLineVisible=true, lastLineBottom=671.8, containerBottom=705

### BDD-5: 普通文本 fallback 源码视图可纵向滚动到底（防回归）

- PASS BDD-5: Python 文件 fallback CodeViewer 可滚动到底（atBottom=true, lineCount=203） (screenshots/bdd-5-fallback-scroll-bottom.png) (vision: P6-evidence/vision-reports/bdd-vision-report.yaml)

**DOM 证据**: scrollHeight=4611, clientHeight=608, scrollTop=4003, atBottom=true, lineCount=203

### BDD-6: 桌面端 Markdown 渲染视图左右留白 ≥32px

- PASS BDD-6: 桌面端（1280px）Markdown 左右留白 85px/95px ≥ 32px (screenshots/bdd-6-desktop-markdown-padding.png) (vision: P6-evidence/vision-reports/bdd-vision-report.yaml)

**DOM 证据**: leftPadding=85px, rightPadding=95px（need ≥32px）
**CSS 证据**: .markdown-body padding=24px + content-area padding=16px = 总计 85px/95px（含 max-width:900px margin:auto 居中）
**Vision 证据**: 内容有清晰左右留白，未触碰容器边缘，内部 padding 约 24-32px

### BDD-7: 移动端 Markdown 渲染视图左右留白 ≥16px

- PASS BDD-7: 移动端（390px）Markdown 左右留白 24px/34px ≥ 16px (screenshots/bdd-7-mobile-markdown-padding.png) (vision: P6-evidence/vision-reports/bdd-vision-report.yaml)

**DOM 证据**: leftPadding=24px, rightPadding=34px（need ≥16px）
**CSS 证据**: .markdown-body padding=16px + content-area padding=8px = 总计 24px/34px
**Vision 证据**: 内容有清晰左右留白，未触碰屏幕边缘，总视觉内边距约 40px

### BDD-8: 滚动到底端后继续滚动不触发头部元信息状态翻转

- PASS BDD-8: 底端 10 次滚轮事件期间 metaTagsHidden 状态无翻转（jitter toggles=0） (screenshots/bdd-8-scroll-bottom.png) (vision: P6-evidence/vision-reports/bdd-vision-report.yaml)

**DOM 证据**: scrollContainer=MAIN.content-area（scrollHeight=16137, clientHeight=608），滚到底端后 10 次 wheel(0,100) 事件，metaTagsHidden 状态 [true,true,true,true,true,true,true,true,true,true]，翻转次数=0

### BDD-9: 真实点击可选中每页行数并回到第 1 页

- PASS BDD-9: 真实点击 per-page trigger 弹出 listbox → 点击 50 → triggerText="50/page▾", rowCount=50, activePage="1" (screenshots/bdd-9-perpage-open.png) (vision: P6-evidence/vision-reports/bdd-vision-report.yaml)

**DOM 证据**: 初始 triggerText="100/page▾" rowCount=100 → 点击 trigger → listbox visible=true → option[50] visible=true → 点击 50 → triggerText="50/page▾" rowCount=50 activePageText="1"
**说明**: 禁用 selectOption()，走真实 click() 流程

### BDD-10: 每页行数控件触达目标达标

- PASS BDD-10: per-page trigger 触达目标 minSize=44px ≥ 44px（width=364px, height=44px, minHeight="44px"） (assert.log)

**DOM 证据**: width=364px, height=44px, minHeight="44px", minSize=44px（need ≥44px）
**说明**: BDD-10 为查询类 BDD（DOM 测量触达目标尺寸），断言值为唯一证据，不要求截图/vision

### BDD-11: 每页行数控件支持键盘操作

- PASS BDD-11: 键盘 Tab→option[50] → ArrowDown 2x → Enter，triggerText 从 "100/page▾" 变为 "50/page▾"，listbox 关闭 (screenshots/bdd-11-keyboard-perpage.png) (vision: P6-evidence/vision-reports/bdd-vision-report.yaml)

**DOM 证据**: Tab 后 activeElement=LI[role=option][data-value=50] → ArrowDown → Enter → triggerText="50/page▾" rowCount=50 listboxGone=true

## 验收汇总

| BDD | 状态 | 证据类型 |
|-----|------|---------|
| BDD-1 | PASS | DOM + screenshot + vision |
| BDD-2 | PASS | DOM + screenshot + vision |
| BDD-3 | PASS | DOM 断言（查询类） |
| BDD-4 | PASS | DOM + screenshot + vision |
| BDD-5 | PASS | DOM + screenshot + vision |
| BDD-6 | PASS | DOM + screenshot + vision |
| BDD-7 | PASS | DOM + screenshot + vision |
| BDD-8 | PASS | DOM + screenshot + vision |
| BDD-9 | PASS | DOM + screenshot + vision |
| BDD-10 | PASS | DOM 断言（查询类） |
| BDD-11 | PASS | DOM + screenshot + vision |

**11/11 PASS, 0 FAIL**

## Vision blocker 汇总

- blocker_count: 0
- 9 条 BDD 有 vision 分析（BDD-1/2/4/5/6/7/8/9/11），全部 pass=true, blocker=false
- 2 条 BDD 为查询类（BDD-3/10），DOM 断言为唯一证据，不要求 vision

[NO_NEED_CONFIRM]
