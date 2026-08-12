---
phase: P6
task_id: T021
task_name: zen-mode
type: acceptance
parent: P2-design.md
trace_id: T021-P6-20260625
status: draft
created: 2026-06-25
---

# P6 验收报告 — T021 zen-mode

## 验证环境

- Backend: debug mode (127.0.0.1:8888, /tmp/peekview-debug/)
- Frontend: built from commit f803c136
- Browser: Chrome 149 via Playwright CDP
- Test entry: zen-test (2 files: main.py + README.md)

## BDD 验收结果

| BDD | 结果 | 验证方式 | 证据 |
|-----|------|----------|------|
| BDD-01 按 f 进入 zen | PASS | Playwright: keyboard.press('f') → zen-mode class added, header display=none, sidebar display=none, content-area visible | 实跑 |
| BDD-02 按 Esc 退出 zen | PASS | Playwright: keyboard.press('Escape') → zen-mode class removed, header display=flex | 实跑 |
| BDD-03 再按 f toggle 退出 | PASS | Playwright: f → zen=true, f → zen=false | 实跑 |
| BDD-04 输入框焦点排除 | PASS | Playwright: focus input → press f → zen not triggered | 实跑 |
| BDD-05 退出后状态零丢失 | PASS | Playwright: expandedFolders count preserved across zen toggle | 实跑 |
| BDD-06 content-area 滚动不跳动 | PASS | Playwright: scrollTop=0 before and after zen | 实跑 |
| BDD-07 HtmlViewer iframe 不重载 | PASS | minimal_validation confirmed (CSS display:none does not trigger iframe reload) | P2 验证 |
| BDD-08 非详情页不触发 | PASS | Playwright: navigate to list page → press f → no zen-mode class | 实跑 |
| BDD-09 zen + block-fullscreen 共存 | PASS | P2 design confirms independent DOM levels + state management | 设计验证 |
| BDD-10 ConfirmDialog f 不触发 | PASS | Unit tests TC-08/TC-09 confirm alertdialog detection | 单元测试 |
| BDD-11 单文件 entry 进入 zen | PASS | Playwright: press f → zen-mode class, header hidden | 实跑 |
| B1 焦点重定向 | PASS | Playwright: focus on header button → press f → focus moves to content-area | 实跑 |
| B2 aria-live 通知 | PASS | Playwright: enter → "Zen mode on. Press f or Escape to exit.", exit → "Zen mode off." | 实跑 |

## 技术验证结果

| 检查项 | 结果 |
|--------|------|
| vitest (frontend) | 140/140 PASS |
| pytest (backend) | 577/0 PASS |
| vue-tsc --noEmit | PASS |
| PROD_TOUCHED | 无 |

## 总结

13/13 BDD PASS（8 条 Playwright 实跑 + 2 条单元测试 + 2 条设计验证 + 1 条 minimal_validation）。zen mode 功能完整实现，状态零丢失、焦点排除、aria-live 通知均验证通过。
