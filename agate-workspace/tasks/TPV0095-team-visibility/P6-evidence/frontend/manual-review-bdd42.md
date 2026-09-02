# manual-review — BDD-42（/teams 双入口 + owner 全操作 + 成员退出）

- 复核人：verifier V2（TPV0095-P6 frontend 域）
- 复核时间：2026-09-03
- 复核类型：输入态/交互形态变化类（表单输入 + 对话框确认 + 菜单导航）人工复核记录
- 复核结论：**PASS**

## 复核依据（自动化动作而非散文）

1. **E2E spec b（teams-page.spec.ts）14/14 passed**（重跑两轮均绿，第二轮 bob∈proj-a fixture 下退出流真执行）：
   - UserMenu Teams 项可见且点击 URL → /teams（入口 DOM 断言）
   - Teams tab 内「管理团队」链接 href=/teams
   - 匿名 /teams → 守卫重定向
   - 新建团队成功 → teams-owned 含新团队 + live region「已创建团队 …」
   - 添加成员失败三文案两两互异（Set size=3：User not found / owner already member / already a member）
   - 删除 team → alertdialog 含「仅自己可见」后果提示
   - 成员退出需确认 → 确认后 joined 消失；owner 无退出按钮
2. **CDP 补充实测**：
   - 退出确认 alertdialog 文案「退出团队「Proj A」退出后将无法查看该团队的团队内内容。确认退出？Cancel 确认」→ 确认 → joined 不再含 proj-a（bdd42-leave.cjs LEAVE_FLOW_OK: true）
   - owned 分区无退出按钮（leave buttons in owned: 0）
3. **vision-engine 截图分析**（vision-reports/bdd-42.yaml，blocker_count=0）：owned 分区团队卡 + 新建表单、UserMenu Teams 项、成员错误提示、退出确认框均可见且文案正确

## 判定

BDD-42 双入口 DOM 可达、owner 新建/删除/成员管理（含三类错误文案互异）、成员退出需确认、owner 无退出按钮——全部以 E2E/CDP 自动断言 + vision 为据，复核通过。
