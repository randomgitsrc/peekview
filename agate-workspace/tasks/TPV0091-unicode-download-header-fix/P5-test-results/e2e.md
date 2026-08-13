# P5 E2E 结果 — TPV0091-unicode-preview-download.spec.ts

passed 12

## 汇总（最终版，重跑后）

| 指标 | 值 |
|------|-----|
| 命令 | `E2E_SPEC=e2e/tpv0091-unicode-preview-download.spec.ts make debug-test` |
| 结果 | **12/12 passed**（2 个项目 × 6 用例 = 12 次运行，零失败零 flaky） |
| exit code | **0** |
| 项目 | `chromium`（Desktop Chrome）+ `Mobile Chrome`（Pixel 5，均 CDP） |
| 时长 | ~6s（修复后） |
| 截图 | `docs/tasks/TPV0091-unicode-download-header-fix/evidences/`（desktop bdd1/2/3/8 + mobile bdd1） |

## 逐用例结果（最终）

| 用例 | chromium | Mobile Chrome | 备注 |
|------|----------|---------------|------|
| test_bdd_1_chinese_image_preview_renders | ✅ PASS | ✅ PASS | 中文图片预览 |
| test_bdd_2_japanese_image_preview_renders | ✅ PASS | ✅ PASS | 日文图片预览 |
| test_bdd_3_latin1_space_ascii_images_no_regression | ✅ PASS | ✅ PASS | café/report final/arch |
| test_bdd_5_unicode_download_suggested_filename | ✅ PASS | ✅ PASS | suggestedFilename == 中文原名 |
| test_bdd_8_markdown_inline_images_render | ✅ PASS | ✅ PASS | 5 图内联渲染（expect.poll 加固） |
| test_bdd_1_mobile_chinese_image_preview_renders | ✅ PASS | ✅ PASS | 移动端 drawer 预览 |

## 首轮失败与处置（主 Agent 决策后重跑）

首轮 4 failed + 2 flaky，逐项处置：

### 1. BDD-5 下载（首轮 FAIL）— 环境问题：debug 后端跑旧代码
- 现象：`page.goto` 报 "Download is starting" / download 事件超时
- 根因 1（环境）：debug :8888 后端进程启动于 P4 commit 之前，uvicorn 无 `--reload` → 跑的是旧代码（download 端点仍 500）。处置：`make debug-stop && make debug-start && make debug-seed` 重启加载新代码；curl 实测 41/43 → 200 + `filename*=UTF-8''` 正确编码
- 根因 2（spec）：`page.goto` 到 attachment 响应 Playwright 会抛 "Download is starting"。处置：改用 `page.evaluate` 创建临时 `<a>` 点击触发下载事件

### 2. BDD-1 移动端（首轮 FAIL）— spec 设计缺陷：未适配 drawer 布局
- 现象：`.file-tree` 侧栏在移动端 display:none
- 根因：移动端文件树在 `EntryDetailMobileBar` 的 drawer（`mobile-bar-filetree-btn` 打开），非桌面侧栏
- 处置：`openFileTreeAndClick` 改用 `viewport.width >= 1024` 判定 desktop/mobile 分支（desktop 点侧栏，mobile 开 drawer 再点）
- 产品本身无回归（CDP 探针实测正确路径正常）

### 3. BDD-8 内联图（首轮 FLAKY）— 图片解码时序
- 处置：`naturalWidth > 0` 断言改用 `expect.poll(..., { timeout: 10000 })` 重试

## 环境前提核验

- `make debug-test` 内置 e2e-safety-check.sh 通过
- 前置 build-frontend 一次（P4 改了 client.ts 后 static 产物过期，make debug-test 拦截触发刷新）
- debug :8888 重启过（加载 P4 新代码），随后 seed 恢复 unicode-filenames

## 结论

**12/12 PASS。** BDD-1/2/3/5/8 全部满足。首轮失败均为环境（stale backend）或 spec 适配（drawer/下载触发方式），非产品代码回归；修复后全绿。
