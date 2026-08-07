---
phase: P6
task_id: T086-admin-settings-consolidation
type: acceptance
parent: P1-requirements.md
trace_id: T086-P6-20260807
status: draft
created: 2026-08-07
agent: verifier
---

# P6-acceptance — T086 admin/settings 信息架构收敛

## verification_env

- 验收环境：debug backend `http://127.0.0.1:8888`（`make debug-start` + `make debug-seed`），测试账号 alice（admin）/ bob（非 admin，member），密码 `testpass123`，与生产环境（`:8080`，`~/.peekview/`）完全隔离，本次验收全程未接触生产环境
- Playwright 通过 Chrome CDP（`127.0.0.1:18800`）驱动真实浏览器（Chrome/151），非 headless mock
- 与生产环境已知差异：debug 数据库仅 4 个测试用户（alice/bob/carol/dave，dave disabled），生产环境用户数量/内容不同，但不影响本任务验证的权限边界逻辑（逻辑与用户数量无关）
- 桌面 viewport：1280×800；移动 viewport：390×844（与 P1/P2/E2E 约定一致）

## 证据总览

- `P6-evidence/screenshots/`：15 张 Playwright 截图（md5 全部互不相同，见下方"截图去重核查"）
- `P6-evidence/logs/test-output.log`：Playwright 脚本执行的完整 DOM 断言输出（URL/元素存在性/文本内容）
- `P6-evidence/logs/bdd-16-17-verification.log`：BDD-16/17 验收时刻重新执行的 grep + vitest 输出
- `P6-vision-20260807.yaml`：vision-analyst 对 15 张截图的结构化视觉分析（purpose=acceptance）
- 验证脚本源码：`/tmp/claude-1000/-home-kity-oclab-peekview/8caaf313-6cb7-4686-90ec-3cf77f98b5d2/scratchpad/t086-p6-verify.ts`（Playwright + CDP，实跑非仅编写，输出见 test-output.log）

## 截图去重核查

对 `P6-evidence/screenshots/` 全部 15 个 png 执行 `md5sum *.png`，结果 15 个 md5 值互不相同，无重复。（验收过程中曾发现 BDD-11 的"落地页"截图与 BDD-1 的用户列表截图 md5 完全相同——因为 UserMenu 落地 user-manager tab 后的页面状态与直接访问 `/settings?tab=user-manager` 的页面状态在 DOM/像素层面确实完全一致，属于同素材良性重复，已按 dispatch-context 指引删除该冗余截图，BDD-11 改为仅用"打开菜单"截图 + DOM 断言日志佐证落地结果，不使用视觉相同的重复截图充数）

---

## BDD 逐条验收结果

### 功能对等：user-manager tab 内容与操作

- PASS BDD-1: admin 访问 /settings?tab=user-manager，页面显示用户列表（alice/bob/carol/dave 4 行），alice 显示 Admin 徽章，dave 显示 Disabled 徽章 + 时间戳，与原 /admin 页面一致 (screenshots/bdd-01-admin-userlist.png) (vision: P6-vision-20260807.yaml) (logs/test-output.log)
- PASS BDD-2: admin 对目标用户 bob 执行"重置密码"操作，弹出对话框，输入合法新密码后确认按钮从禁用变为可用状态（操作本身经取消未提交，验证的是交互链路而非破坏性状态变更） (screenshots/bdd-02-admin-reset-password-dialog.png) (vision: P6-vision-20260807.yaml) (logs/test-output.log)
- PASS BDD-3: admin 对自己（alice）尝试禁用操作，界面弹出 toast 提示"Cannot disable the last active admin"，操作未执行（列表中 alice 仍为 Admin 状态未变） (screenshots/bdd-03-self-protection-toast.png) (vision: P6-vision-20260807.yaml) (logs/test-output.log)

### 权限边界：tab 可见性与访问控制

- PASS BDD-4: admin 访问 /settings，桌面端 tab-nav 中可见"用户管理"选项，与 Profile/Security/API Keys 并列（4 个 tab 按钮），`[data-testid="tab-user-manager"]` count=1 (screenshots/bdd-04-admin-tabnav.png) (vision: P6-vision-20260807.yaml) (logs/test-output.log)
- PASS BDD-5: 非 admin（bob）访问 /settings，桌面端 tab-nav 仅显示 Profile/Security/API Keys 三项，无"用户管理"，`[data-testid="tab-user-manager"]` count=0（DOM 中不存在，非样式隐藏） (screenshots/bdd-05-nonadmin-tabnav.png) (vision: P6-vision-20260807.yaml) (logs/test-output.log)
- PASS BDD-6: 非 admin 直接访问 /settings?tab=user-manager，页面回退显示 Profile tab 内容（Username=bob/Role=Member 表单），`[data-testid="user-manager-content"]` count=0，Profile tab 按钮处于 active 状态 (screenshots/bdd-06-nonadmin-fallback-profile.png) (vision: P6-vision-20260807.yaml) (logs/test-output.log)
- PASS BDD-7: 未登录用户访问 /settings?tab=user-manager，被重定向到 `/`（复用既有 /settings 未登录守卫），落地页为 landing 页面 (screenshots/bdd-07-unauth-redirect.png) (vision: P6-vision-20260807.yaml) (logs/test-output.log)

### 路由删除：/admin 一律 404

- PASS BDD-8: admin 访问 /admin，页面显示 "Page not found" + 路径 "/admin"，URL 未被重定向（仍停留在 `/admin`），未渲染任何用户管理内容 (screenshots/bdd-08-admin-404.png) (vision: P6-vision-20260807.yaml) (logs/test-output.log)
- PASS BDD-9: 非 admin 访问 /admin，页面显示 404，URL 未被重定向到 /explore（与旧行为不同，符合新行为要求） (screenshots/bdd-09-nonadmin-404.png) (vision: P6-vision-20260807.yaml) (logs/test-output.log)
- PASS BDD-10: 未登录访问 /admin，页面显示 404，URL 未被重定向到 /（与旧行为不同，符合新行为要求） (screenshots/bdd-10-unauth-404.png) (vision: P6-vision-20260807.yaml) (logs/test-output.log)

### 入口发现

- PASS BDD-11: admin 打开 UserMenu 下拉菜单，存在可点击的 "Settings" 项（`data-testid="user-menu-settings-item"`），点击后 DOM 断言确认落地 URL 为 `/settings?tab=user-manager` 且 `.desktop-only [data-testid="user-manager-content"]` 可见（`visible=true`，见 test-output.log），落地页视觉内容与 BDD-1 截图完全一致（同一状态，已去重不重复截图） (screenshots/bdd-11a-admin-usermenu-open.png) (vision: P6-vision-20260807.yaml) (logs/test-output.log)
- PASS BDD-12: 非 admin 打开 UserMenu 下拉菜单，内容仅为 "SettingsLogout"（无"用户管理"文案），点击 Settings 后落地 `/settings?tab=apikeys`（非 user-manager），URL 不含 `tab=user-manager` (screenshots/bdd-12a-nonadmin-usermenu-open.png, screenshots/bdd-12b-nonadmin-landed-apikeys.png) (vision: P6-vision-20260807.yaml) (logs/test-output.log)

### 移动端呈现

- PASS BDD-13: admin 在 390×844 移动视口访问 /settings，堆叠布局中包含"用户管理"区块（标题 + 用户列表，含 alice/bob/carol/dave），`.mobile-stacked [data-testid="user-manager-content"]` count=1，内容与桌面端一致 (screenshots/bdd-13-admin-mobile-usermanager.png) (vision: P6-vision-20260807.yaml) (logs/test-output.log)
- PASS BDD-14: 非 admin 在 390×844 移动视口访问 /settings，堆叠布局仅含 Profile/Security/API Keys 三个区块，无"用户管理"区块，`.mobile-stacked [data-testid="user-manager-content"]` count=0（DOM 中不存在，非折叠隐藏） (screenshots/bdd-14-nonadmin-mobile-nousermanager.png) (vision: P6-vision-20260807.yaml) (logs/test-output.log)

### 测试资产迁移（元 BDD）

- PASS BDD-15: `e2e/admin.spec.ts` 全部既有场景在新路径下通过。引用 P5-test-results/e2e.md：`E2E_SPEC=e2e/admin.spec.ts make debug-test` 全量重跑（retry2 轮次）exit code 0，`35 passed` + `1 flaky`（重试后计入 passed）+ `0 failed`，覆盖 desktop+mobile 两个 viewport 共 36 条用例，含 T086 BDD-07/08/09/10/11/12（对应本文件 P1 编号 BDD-7/8/9/10/11/12）全部真正执行并通过（非级联跳过） (../P5-test-results/e2e.md)
- PASS BDD-16: `t080-admin-route-guard.test.ts` 迁移为测试 tab 级守卫。验收时刻重新执行 `npx vitest run src/__tests__/t080-admin-route-guard.test.ts`：`7 passed | 3 skipped (10)`，7 个真实断言（test_bdd_4/test_bdd_5/test_bdd_14/test_bdd_14b/test_bdd_13/test_t086_bdd_14/test_bdd_17）全部通过，3 个 skip 为已记录并经 P4/P7 复核的 `[DESIGN_GAP_REVIEWED]`（路由级 loading 时序场景已由 `t069-auth-guard.test.ts` 覆盖），文件内无任何断言依赖已删除的 `/admin` 路由级 `requiresAdmin` 守卫（已人工审阅全文件源码确认） (logs/bdd-16-17-verification.log)

### 遗留引用回归检查

- PASS BDD-17: 验收时刻重新执行 `grep -rn "'/admin'" frontend-v3/src --include='*.vue' --include='*.ts' | grep -v router.ts | grep -v api/client.ts`，输出为空（无遗留跳转引用）；`find frontend-v3/src -iname "AdminView.vue"` 确认文件已删除；`t080-admin-route-guard.test.ts` 内置的 `test_bdd_17` 用例（同一 grep 逻辑的程序化版本）在上条 BDD-16 的 vitest 重跑中已包含并通过 (logs/bdd-16-17-verification.log)

---

## 证据质量预检 WARNING 说明

`check-p6-evidence.sh` 对 4 张截图报出"像素方差 < 50，疑似纯色/占位图"WARNING（`bdd-09-nonadmin-404.png`=31、`bdd-10-unauth-404.png`=25、`bdd-01-admin-userlist.png`=48、`bdd-08-admin-404.png`=44），均已人工用 Read 工具逐张打开确认为真实内容截图，非充数占位图：
- `bdd-08/09/10-*-404.png`：NotFoundView 页面本身设计即为大面积浅色背景 + 居中小块文字（"Page not found" / "/admin" / "返回首页"按钮），像素方差天然偏低，属该页面视觉设计的正常结果，非截图脚本 bug
- `bdd-01-admin-userlist.png`：用户列表页背景以浅色卡片为主，方差 48 接近阈值 50 但仍在数值上被判定，人工核查该图确实完整显示 4 行用户数据（alice/bob/carol/dave 及对应徽章），非空白/纯色图
该 WARNING 为非阻断级别（exit 2），已如实记录，不代表证据无效

## Vision 分析摘要

见 `P6-vision-20260807.yaml`（vision-analyst 产出，purpose=acceptance，覆盖上述 15 张截图对应的 14 条 BDD 条件）。`summary.blocker_count` 必须为 0，详见文件。

## [PROD_NOT_TOUCHED]

全程针对 `http://127.0.0.1:8888`（debug backend），未触碰 `:8080` 或 `~/.peekview/`。BDD-3 的自我保护测试尝试禁用 alice 但被后端拒绝（"Cannot disable the last active admin"），未产生任何实际数据变更；BDD-2 的重置密码对话框在填写合法密码后点击"取消"，未提交请求，bob 密码未变更。验收结束后执行 `make debug-stop`，`/tmp/peekview-debug/` 已清理。

**Summary**: 17/17 PASS, 0 FAIL
