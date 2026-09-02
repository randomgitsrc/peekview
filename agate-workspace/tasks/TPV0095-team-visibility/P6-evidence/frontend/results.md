# P6 验收结果 — frontend UI 域（TPV0095 team-visibility）

> verifier V2 产出（P6 模式行为验收，frontend 域）。汇总 verifier 据此整合 P6-acceptance.md；gate 只读汇总文件。
> 验收环境：debug server :8888（隔离 /tmp/peekview-debug 语义，PEEKVIEW_DEBUG_MODE）已持住 + CDP Chrome :18800（connectOverCDP）。
> 用户 alice/bob/carol（testpass123）。team fixture 经 debug HTTP API 创建（铁律 6）。
> P1 frontmatter：ui_render_shape=layout；capability_requirements browser-vision status=available → UI PASS 附 vision YAML。
> 证据路径相对本目录（P6-evidence/frontend/）。
> 状态：`[PROD_NOT_TOUCHED]`（全程仅触 :8888 debug / :18800 CDP / workspace；未触 :8080 / ~/.peekview / pipx peekview）

## 实跑记录（2026-09-03）

1. **E2E spec a**（team-visibility.spec.ts，BDD-38~41/43）：`E2E_SPEC=e2e/team-visibility.spec.ts make debug-test` → **12/12 passed**（chromium 6 + Mobile Chrome 6，21.4s），exit 0（logs/e2e-speca.log）
2. **E2E spec b**（teams-page.spec.ts，BDD-42）：`E2E_SPEC=e2e/teams-page.spec.ts make debug-test` → **14/14 passed**（18.1s），exit 0；在 bob∈proj-a fixture（API 添加）下 rerun#2 仍 **14/14**（退出流真执行）（logs/e2e-specb.log, logs/e2e-specb-rerun2.log）
3. **BDD-44 CDP 实测**（bdd44-three-state.cjs）：team/private/public 三态 × desktop+mobile，DOM 断言 `.status-tag` 文案全 PASS（logs/bdd44-run.log ALL_OK: true）
4. **BDD-38~43 CDP 视觉捕获**（bdd-visual-capture.cjs）：确定性登录（clearCookies+表单），DOM/几何断言 SUMMARY 全 true（logs/bdd-visual-capture.log）
5. **BDD-42 成员退出确认流**（bdd42-leave.cjs）：退出确认 alertdialog + 确认后 joined 消失 LEAVE_FLOW_OK: true（logs/bdd42-leave.log）
6. **vision-engine 分析**：11 张关键截图 quick 分析 → vision-reports/bdd-38~44.yaml（blocker_count 全 0，见 logs/vision/raw-*.txt 原始输出）

## 逐条结果

- PASS BDD-38: explore 顶栏 5 互斥 tab（All/Mine/Teams/Archived/Starred）；Teams 激活高亮且 All 不高亮；URL 反映 ?view=teams（E2E spec a 2 用例 DOM+URL 断言通过；CDP tabs 状态 [{tab-teams active=true, tab-all active=false}]，URL=http://127.0.0.1:8888/explore?view=teams）(screenshots/bdd38-teams-tab-desktop.png, screenshots/bdd38-teams-view-url-desktop.png) (vision: vision-reports/bdd-38.yaml)
- PASS BDD-39: team entry 卡片/行显示「仅团队可见 · {teamName}」badge 且不叠加 private badge——E2E spec a 断言 badge-team 文案含「仅团队可见」+ 无 .badge-private；CDP grid card {teamBadge:"仅团队可见 · PV6-…", privBadges:0} + list row {privBadges:0}(screenshots/bdd39-team-badge-grid-desktop.png, screenshots/bdd39-team-badge-list-desktop.png, screenshots/tpv0095-bdd39-team-badge.png) (vision: vision-reports/bdd-39.yaml)
- PASS BDD-40: team entry 卡片隐藏 visibility-toggle（count=0），delete 保留；store 层守卫——E2E spec a 断言 toggle count=0 + delete 可见；CDP 全视图 toggle count=0 且 card hasDelete=true；单测 tpv0095-entry-list-store-team.spec.ts 覆盖 store 守卫（P5 frontend 1338 passed）(screenshots/bdd39-team-badge-list-desktop.png) (vision: vision-reports/bdd-40.yaml)
- PASS BDD-41: ?team= 不存在/无权限 slug → 统一「团队不可用」态 + 清除过滤 CTA，清除后 URL team 参数消失——E2E spec a 断言 team-unavailable + clear CTA + URL 恢复；CDP unav text「团队不可用/你无权访问该团队，或该团队不存在。清除过滤」clearVisible=true、清除后 URL=?view=teams(screenshots/bdd41-team-unavailable-desktop.png, screenshots/tpv0095-bdd41-team-unavailable.png) (vision: vision-reports/bdd-41.yaml)
- PASS BDD-42: /teams 双入口（UserMenu Teams 项 + Teams tab「管理团队」链接→/teams）+ owner 新建/删除(确认框含「仅自己可见」)/添加成员(三错误文案互异)/成员退出(确认后消失) + owner 无退出按钮——E2E spec b 14/14（UserMenu 可达 /teams、manage-link href=/teams、新建入 owned+live region、删除 alertdialog 含「仅自己可见」、成员错误三文案 Set size=3、成员退出+owner 无退出）；CDP 补充：退出 alertdialog「退出团队「Proj A」退出后将无法查看该团队的团队内内容。确认退出？」→ 确认 → joined 消失；错误三文案 ["User not found: no-such-user-xyz-999","The team owner is already a member","alice is already a member"] unique=3；owned leave buttons=0(manual-review: manual-review-bdd42.md)(screenshots/bdd42-teams-owned-desktop.png, screenshots/bdd42-user-menu-teams.png, screenshots/bdd42-member-error-1-desktop.png, screenshots/bdd42-member-errors-desktop.png, screenshots/bdd42-leave-confirm-desktop.png, screenshots/bdd42-after-leave-desktop.png, screenshots/tpv0095-bdd42-create-team.png, screenshots/tpv0095-bdd42-delete-confirm.png, screenshots/tpv0095-bdd42-member-error-copies.png) (vision: vision-reports/bdd-42.yaml)
- PASS BDD-43: 移动端（390×844）5-tab 单行可横向滚动（overflow-x=auto）无换行堆叠；tab 触达高 ≥44px（heights [44,44,44,44,44]）；aria-selected 全存在；键盘 tablist + 方向键（ArrowRight: tab-all→tab-mine→tab-teams 焦点+激活跟随）——E2E spec a（Mobile Chrome project）断言 overflowX auto/scroll + 每 tab ≥44px + aria-selected；CDP mobile 补充同断言 + 键盘实测 KEYBOARD_OK: true(manual-review: manual-review-bdd43.md)(screenshots/bdd43-mobile-tablist.png, screenshots/tpv0095-bdd43-mobile-tabs.png) (vision: vision-reports/bdd-43.yaml) (logs/bdd43-keyboard.log)
- PASS BDD-44: detail 状态标签三态可区分——team entry 显示「仅团队可见 · Proj A」（不显示 Private）；private 仍 "Private"；public 仍 "Public"——CDP 三态 × desktop+mobile DOM 断言 .status-tag 文案全 OK；vision 三张截图分别读得 仅团队可见 · Proj A / Private / Public(manual-review: manual-review-bdd44.md)(screenshots/bdd44-team-desktop.png, screenshots/bdd44-private-desktop.png, screenshots/bdd44-public-desktop.png, screenshots/bdd44-team-mobile.png, screenshots/bdd44-private-mobile.png, screenshots/bdd44-public-mobile.png) (vision: vision-reports/bdd-44.yaml)

## 人工复核记录（输入态/交互形态变化类 BDD-42/43/44）

复核人：verifier V2（TPV0095-P6）；复核时间：2026-09-03；结论：PASS。
判定依据 = P2-design §5.5/§5.6/§5.8「输入态变化类用例的 P6 复核落为明确自动化动作」——
BDD-42 添加成员三错误、新建、删除确认、退出确认均在 teams-page.spec.ts（E2E spec b 14/14）+ CDP 逐态脚本（logs/bdd42-leave.log、logs/bdd-visual-capture.log）断言 + 截图；BDD-43 移动端滚动与触达高度为 CDP 几何断言（overflow-x/heights/aria-selected）+ E2E Mobile Chrome；BDD-44 三态为 CDP DOM 文案断言 + vision 截图双证。无人工散文复核的缺口。

## Summary

**Summary**: PASS: 7（BDD-38~44 各 1），FAIL: 0。证据：screenshots 24 张（md5 全唯一）+ vision-reports 7 YAML（blocker_count=0）+ logs + test-output.log。

EXIT_CODE: 0
