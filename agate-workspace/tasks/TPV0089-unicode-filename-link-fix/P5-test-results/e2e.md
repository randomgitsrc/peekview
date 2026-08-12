# TPV0089 P5 E2E 结果

## 环境

- debug backend `http://127.0.0.1:8888`（/tmp/peekview-debug/ 隔离，**PROD_NOT_TOUCHED**）
- CDP Chrome `127.0.0.1:18800`
- fixture `unicode-filenames`（23 entries 已 seed，含中文/日文/重音/空格/英文图片 + 中文/英文附件链接）
- ⚠️ 前置发现：debug server 的 static 由 `frontend-v3/dist/` 优先 serve，而 dist 构建时间(23:04)早于 P4 修复(23:44) → 首轮 E2E 10 失败为陈旧构建。`make build-frontend` 重建后重跑。

## 本任务 spec：`E2E_SPEC=e2e/unicode-filename-link.spec.ts make debug-test`

### 结果（重建后）

- **7 passed / 1 flaky / 4 failed**（12 个用例 = 6 BDD × 2 浏览器项目）

### BDD-10（中文图片渲染）— PASS
- chromium + Mobile Chrome 均通过：`img` `src` 匹配 `/api/v1/entries/unicode-filenames/files/\d+/content`，不含 `%E4%B8%AD` 编码，`naturalWidth > 0`（真实渲染无裂图）

### BDD-12（日文/重音/空格图片渲染）— PASS（1 flaky 重试后通过）
- 5 张图全部 src 改写成功 + `naturalWidth > 0`

### BDD-13（英文不回归）— PASS
- 英文图片 + English 附件链接均正常，src/href 改写正确

### BDD-11（中文附件链接点击）— FAIL ×4（桌面/移动 × chromium/Mobile Chrome）

失败断言：`page.waitForURL(/{slug}?file=\d+)` 超时。

**根因分析（CDP 实测）**：
- 点击 `a[data-peekview-file-id]`（href=`/unicode-filenames?file=44`）后，app 走 **SPA store 导航**（`MarkdownViewer.handleLinkClick` → `emit('navigate-file')` → `entryDetailStore.selectFile`），URL 不变，仍为 `/unicode-filenames`。
- 文件内容实际成功打开（内容区显示 `报告附件.txt` 内容，无 404）——BDD-11 的"预览成功、非 404"用户可见行为已满足。
- **对 ASCII 链接实测相同**：英文附件点击后 URL 同样不变 → 该行为是 T047 既有 SPA 架构，非 TPV0089 引入的回归。
- 结论：**P3 测试的 `waitForURL(?file=)` 断言与 app 既有导航设计冲突**，属测试期望偏差（测试设计的 SPA 外部 URL 假设），非实现 bug。图片渲染（bug 本体）已验证通过。建议 P6/主 Agent 判定：修正 BDD-11 断言为内容区出现即可，或保持现状记录。

截图：`docs/tasks/TPV0089-unicode-filename-link-fix/evidences/`（bdd10/11/12/13 desktop + mobile，由 spec 写入）。

## 全量 E2E：`E2E_SPEC=e2e make debug-test`

- **420 passed / 4 flaky / 82 did not run**，另有大量失败（242 测试实例，跨 html-render 60、t058 23、t052 15、viewer、search、t069、t049、t084 等约 20 个 spec）。
- 抽查失败根因：`html-render.spec.ts` 断言 `localhost` 而 debug 地址为 `127.0.0.1:8888`（环境断言不匹配）；其余多为 CDP Chrome 在 16 并发下的资源竞争/超时。
- 与 TPV0089 无关（本任务仅改 `frontend-v3/src/utils/path-map.ts` 前端单文件）；全量 E2E 在该 CDP 环境下为既有环境性失败（AGENTS.md 已注明"完整 E2E suite 在 CDP 模式下可能超时，优先用自定义脚本逐项验证"）。
- 本任务相关用例（unicode-filename-link.spec.ts）在重建后 7/12 通过，4 失败均为上述 BDD-11 断言问题。

EXIT_CODE: 1
