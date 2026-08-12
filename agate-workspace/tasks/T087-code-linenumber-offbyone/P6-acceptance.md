---
phase: P6
task_id: T087-code-linenumber-offbyone
type: acceptance
parent: P5-test-results/unit.md
---

# P6 验收报告 — T087 代码块行号 off-by-one

[PROD_NOT_TOUCHED]

## 验收环境

- debug backend: http://127.0.0.1:8888（PEEKVIEW_DEBUG_MODE=1，复用 P5 已有证据，未重新跑 E2E）
- 生产 :8080 未运行，生产 DB ~/.peekview/peekview.db 未触碰
- 截图来源：P5-test-results/evidence/ 复制到 P6-evidence/screenshots/（6 张，md5 互不相同）
- 单测来源：P5-test-results/unit.md（vitest 1226 passed | 1 skipped, failed=0）
- E2E 来源：P5-test-results/e2e.md（T087 专用 spec 6 passed）

## verification_env

ui_affected: true。验收环境与生产环境差异：debug backend 用 PEEKVIEW_DEBUG_MODE=1 隔离到 /tmp/peekview-debug/，captcha 自动禁用；前端构建产物由 P5 重建（make build-frontend），含 trimmedCode 修复。生产环境前端构建在 P8 发布时由 bump-version + pipx upgrade 落地。

## BDD 逐条验收

- PASS BDD-1: 末尾换行 "a\nb\n" 扩展为 Python 3 行 → 行号 3 == .line 3 对齐，无尾部空行号 (screenshots/t087-tc001.png) (vision: vision-reports/bdd-1.yaml)
- PASS BDD-2: 无末尾换行 "a\nb" 扩展为 Python 3 行 → 行号 3 == .line 3 对齐 (screenshots/t087-tc002.png) (vision: vision-reports/bdd-2.yaml)
- PASS BDD-3: 单行无换行 "a" → 行号 1 == .line 1 对齐 (P6-evidence/vitest-assertions.md)
- PASS BDD-4: 空文件 "" 纯函数层 1==1 对齐，组件层 !props.content 短路不渲染 (P6-evidence/vitest-assertions.md)
- PASS BDD-5: 仅换行符 "\n" → trim 后 "" → 行号 1 == .line 1 对齐 (screenshots/t087-tc003.png) (vision: vision-reports/bdd-5.yaml)
- PASS BDD-6: 中间空行+末尾换行 "a\n\n" → 行号 2 == .line 2 对齐，中间空行保留为第 2 行 (screenshots/t087-tc004.png) (vision: vision-reports/bdd-6.yaml)
- PASS BDD-7: Markdown 代码块 ```python ... ``` → 行号 2 == .line 2 对齐 (screenshots/t087-tc005.png) (vision: vision-reports/bdd-7.yaml)
- PASS BDD-8: Markdown 多代码块不回归，vitest 全量 1226 passed 含 useMarkdown 测试无 failed (P6-evidence/vitest-assertions.md)
- PASS BDD-9: wrap 模式下行号与高亮逐行对齐，行号 3 == .line 3 (screenshots/t087-tc006.png) (vision: vision-reports/bdd-9.yaml)
- PASS BDD-10: 源码视图切换走 CodeViewer → highlight() 路径，与 BDD-1 同代码路径，行号 2 == .line 2 对齐 (P6-evidence/vitest-assertions.md)

## 证据清单

### 截图（P6-evidence/screenshots/，6 张，md5 去重通过）
- t087-tc001.png (20407 bytes, md5 189562ee) — BDD-1 末尾换行 3+3
- t087-tc002.png (19429 bytes, md5 d4be7f6d) — BDD-2 无末尾换行 3+3
- t087-tc003.png (15045 bytes, md5 0113a8c8) — BDD-5 仅换行符 1+1
- t087-tc004.png (15386 bytes, md5 39db592b) — BDD-6 中间空行 2+2
- t087-tc005.png (19631 bytes, md5 bfc18724) — BDD-7 Markdown 代码块 2+2
- t087-tc006.png (24744 bytes, md5 83afe07b) — BDD-9 wrap 模式 3+3

### 断言文件（P6-evidence/）
- vitest-assertions.md — BDD-3/4/8/10 单测断言记录（vitest 1226 passed | 1 skipped, failed=0）

### vision 报告（vision-reports/，6 份，blocker_count 全部 = 0）
- bdd-1.yaml — 末尾换行 3+3 对齐，无尾部空行号/空 .line
- bdd-2.yaml — 无末尾换行 3+3 对齐
- bdd-5.yaml — 仅换行符 1+1 对齐
- bdd-6.yaml — 中间空行 2+2 对齐，中间空行保留
- bdd-7.yaml — Markdown 代码块 2+2 对齐
- bdd-9.yaml — wrap 模式 3+3 对齐

## P5 证据复用说明

BDD-1/2/5/6/7/9（UI 类）：复用 P5-test-results/e2e.md 的 6 张 CDP Chrome 截图 + E2E PASS 记录（T087 专用 spec 6 passed，exit 0）。截图复制到 P6-evidence/screenshots/ 并用 vision-engine 重新分析，blocker_count=0。

BDD-3/4/8/10（非 UI 类，断言记录）：复用 P5-test-results/unit.md 的 vitest 全量结果（1226 passed | 1 skipped, failed=0）+ useShiki.linenumber.spec.ts 9 passed 断言。断言摘录到 P6-evidence/vitest-assertions.md。

## 预存失败（与 T087 无关）

viewer.spec.ts 全部失败（路由不匹配 + 硬编码 slug 失效），已登记 known-failures.md。P5 用 T087 专用 spec（正确路由 /{slug} + 动态创建 entry）替代验证，6 测试全绿。不影响 T087 验收。

**Summary**: 10/10 PASS, 0 FAIL
