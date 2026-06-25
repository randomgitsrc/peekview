---
phase: P3
task_id: T021
task_name: zen-mode
type: test-cases
parent: P2-design.md
trace_id: T021-P3-20260625
status: draft
created: 2026-06-25
---

# P3 测试用例清单 — T021 zen-mode

## 1. 纯函数单元测试（shouldHandleZenShortcut）

| TC# | BDD trace | 描述 | 输入 | 预期 |
|-----|-----------|------|------|------|
| TC-01 | BDD-01 | f 键 + body 焦点 → 应触发 | key='f', activeElement=body | true |
| TC-02 | BDD-01 | F 键（大写）+ body 焦点 → 应触发 | key='F', activeElement=body | true |
| TC-03 | BDD-04 | f 键 + input 焦点 → 不触发 | key='f', activeElement=INPUT | false |
| TC-04 | BDD-04 | f 键 + textarea 焦点 → 不触发 | key='f', activeElement=TEXTAREA | false |
| TC-05 | BDD-04 | f 键 + contenteditable 焦点 → 不触发 | key='f', activeElement.isContentEditable=true | false |
| TC-06 | BDD-04 | f 键 + contenteditable=true attr 焦点 → 不触发 | key='f', activeElement.getAttribute('contenteditable')='true' | false |
| TC-07 | BDD-01 | f 键 + button 焦点 → 应触发 | key='f', activeElement=BUTTON | true |
| TC-08 | BDD-10 | f 键 + alertdialog 内焦点 → 不触发 | key='f', activeElement inside [role="alertdialog"] | false |
| TC-09 | BDD-10 | f 键 + .confirm-overlay 内焦点 → 不触发 | key='f', activeElement inside .confirm-overlay | false |
| TC-10 | BDD-02 | Esc 键 → 应触发（无论焦点） | key='Escape', activeElement=INPUT | true |
| TC-11 | — | Esc 键 + body 焦点 → 应触发 | key='Escape', activeElement=body | true |
| TC-12 | — | 其他键 → 不触发 | key='a', activeElement=body | false |
| TC-13 | — | Enter 键 → 不触发 | key='Enter', activeElement=body | false |
| TC-14 | BDD-04 | f 键 + activeElement=null → 应触发 | key='f', activeElement=null | true |

## 2. 焦点重定向单元测试（redirectFocusIfHidden）

| TC# | BDD trace | 描述 | 初始焦点 | 预期 |
|-----|-----------|------|----------|------|
| TC-20 | B1 | 焦点在 .detail-header 内 → 重定向到 .content-area | header 内 button | document.activeElement === .content-area |
| TC-21 | B1 | 焦点在 .file-sidebar 内 → 重定向到 .content-area | sidebar 内 a | document.activeElement === .content-area |
| TC-22 | B1 | 焦点在 .content-area 内 → 不重定向 | .content-area 内 div | activeElement 不变 |
| TC-23 | B1 | 焦点在 body → 不重定向 | body | activeElement 不变 |

## 3. handleZenKeydown 集成测试（Vue 组件级）

| TC# | BDD trace | 描述 | 操作 | 预期 |
|-----|-----------|------|------|------|
| TC-30 | BDD-01 | 按 f → zenMode=true | keydown 'f' | zenMode=true, .zen-mode class added |
| TC-31 | BDD-02 | zen 状态下按 Esc → zenMode=false | keydown 'Esc' | zenMode=false, .zen-mode class removed |
| TC-32 | BDD-03 | zen 状态下再按 f → zenMode=false | keydown 'f' twice | zenMode toggles to false |
| TC-33 | — | 非 zen 状态下按 Esc → zenMode 不变 | keydown 'Esc' | zenMode remains false |
| TC-34 | B1 | 进入 zen 时焦点在 header → 重定向到 content-area | focus header btn, keydown 'f' | focus moves to .content-area |
| TC-35 | B2 | 进入 zen → aria-live 播报 | keydown 'f' | zenAriaText = 'Zen mode on...' |
| TC-36 | B2 | 退出 zen → aria-live 播报 | keydown 'Esc' | zenAriaText = 'Zen mode off.' |

## 4. E2E 测试（Playwright，P6 实跑）

| TC# | BDD trace | 描述 | viewport | 验证 |
|-----|-----------|------|----------|------|
| TC-50 | BDD-01 | 按 f 进入 zen → chrome 隐藏 | desktop 1280×800 | .detail-header/.file-sidebar/.toc-sidebar display:none; .content-area 可见 |
| TC-51 | BDD-02 | 按 Esc 退出 zen → chrome 恢复 | desktop 1280×800 | 所有元素恢复可见 |
| TC-52 | BDD-03 | 再按 f toggle 退出 | desktop 1280×800 | zen 退出，chrome 恢复 |
| TC-53 | BDD-04 | 输入框焦点排除 — input 内按 f | desktop 1280×800 | zen 不触发，f 字符输入 |
| TC-54 | BDD-05 | 退出后状态零丢失 | desktop 1280×800 | FileTree 展开状态/scrollTop 保持 |
| TC-55 | BDD-06 | content-area scrollTop 不跳动 | desktop 1280×800 | scrollTop 偏差 ≤ 2px |
| TC-56 | BDD-07 | HtmlViewer iframe 不重载 | desktop 1280×800 | iframe load 事件次数不变 |
| TC-57 | BDD-08 | 非详情页按 f 无反应 | desktop 1280×800 | 列表页按 f 无变化 |
| TC-58 | BDD-09 | zen + block-fullscreen 共存 | desktop 1280×800 | mermaid 放大 → 退出 → 仍 zen |
| TC-59 | BDD-10 | ConfirmDialog 打开时 f 不触发 | desktop 1280×800 | 对话框开 → 按 f → zen 不触发 |
| TC-60 | BDD-11 | 单文件 entry 进入 zen 无 JS 错误 | desktop 1280×800 | 按 f → header 隐藏，content-area 占满 |
| TC-61 | B1 | 进入 zen 焦点重定向 | desktop 1280×800 | 焦点在 header → 按 f → 焦点移到 content-area |
| TC-62 | B2 | aria-live 通知 | desktop 1280×800 | sr-only span 文本变化 |
| TC-63 | BDD-01 | 移动端 zen 不触发 | mobile 390×844 | 按 f 无变化（移动端无 f 键场景不适用，但验证无 JS 错误） |

## 5. BDD 覆盖矩阵

| BDD | 单元测试 | E2E 测试 |
|-----|----------|----------|
| BDD-01 按 f 进入 zen | TC-01, TC-02, TC-07 | TC-50 |
| BDD-02 按 Esc 退出 zen | TC-10, TC-11 | TC-51 |
| BDD-03 再按 f toggle 退出 | TC-32 | TC-52 |
| BDD-04 输入框焦点排除 | TC-03, TC-04, TC-05, TC-06 | TC-53 |
| BDD-05 退出后状态零丢失 | — (CSS-only, E2E 验证) | TC-54 |
| BDD-06 content-area 滚动不跳动 | — (CSS-only, E2E 验证) | TC-55 |
| BDD-07 HtmlViewer iframe 不重载 | — (E2E 验证) | TC-56 |
| BDD-08 非详情页不触发 | — (组件生命周期, E2E 验证) | TC-57 |
| BDD-09 zen + block-fullscreen 共存 | — (E2E 验证) | TC-58 |
| BDD-10 ConfirmDialog f 不触发 | TC-08, TC-09 | TC-59 |
| BDD-11 单文件 entry 进入 zen | — (E2E 验证) | TC-60 |
| B1 焦点重定向 | TC-20~TC-23, TC-34 | TC-61 |
| B2 aria-live 通知 | TC-35, TC-36 | TC-62 |
