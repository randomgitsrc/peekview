# Plan: 图片查看器 + Bug 修复

Spec: `docs/specs/spec-image-viewer.md`（已通过专家评审）

## Context

P2 二进制注入上线后验证发现：中文乱码（charset）、iframe 图片空白（损坏 base64）、缺少图片查看功能。详见 spec。

## Implementation Order

4 steps.

---

### Step 1: Bug 修复

1a. Blob charset UTF-8（`HtmlViewer.vue` 已改）
1b. 修正 E2E 测试中损坏的 base64 PNG → 实测验证后再替换
1c. 后端 pipx 重新安装（含 content_base64 字段）

---

### Step 2: ImageViewer 组件

新建 `src/components/ImageViewer.vue`
- base64 data URI 方式（不走 downloadFile URL，避免私有条目 401）
- 大文件保护（>10MB 手动触发）
- 点击切换适应窗口/原始尺寸
- 单元测试

详见 spec Step 2。

---

### Step 3: 接入 EntryDetailView

- 新增 isImage computed
- 模板新增 ImageViewer 分支
- 不改 entry.ts store

详见 spec Step 3。

---

### Step 4: 标准调试流程

`make debug` → E2E 通过 → 创建含正确 PNG 演示条目 → 浏览器验证

---

## Key Files

| File | Change |
|------|--------|
| `frontend-v3/src/components/HtmlViewer.vue` | Blob charset UTF-8 |
| `frontend-v3/src/components/ImageViewer.vue` | 新建 |
| `frontend-v3/src/views/EntryDetailView.vue` | 新增 isImage + ImageViewer |
| `frontend-v3/e2e/html-render.spec.ts` | 修正 base64 PNG |
| `frontend-v3/src/components/__tests__/ImageViewer.spec.ts` | 新建 |

## Verification

1. `npm run test` — 单元测试通过
2. `npm run build` — 构建成功
3. `make debug` — E2E 通过
4. 浏览器：iframe 图片有色块 + 点击图片 → ImageViewer + 无乱码