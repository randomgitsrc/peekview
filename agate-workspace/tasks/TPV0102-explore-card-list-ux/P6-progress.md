# P6 验收进度（verifier subagent）

## 步骤 0 — 环境与输入就绪（2026-11-11）

- AGATE_ROOT = /home/kity/.agate/v0.83.2/agate（v0.83.1 角色文件为派发指定，行为规范一致）
- 读入：verifier.md（角色）、P6-dispatch-context-verifier.md（含 AGATE_CARD P6 全文）、P1-requirements.md（30 条 BDD）、known-failures.md（2 条预存失败）
- 探活：debug :8888/health = **200**；生产 :8080/health = **000**（未触碰）[PROD_NOT_TOUCHED]
- 记录前态：入口 `GET /api/v1/entries?per_page=100` → total=15（seed 基线，供 post-test 残留比对）
- 环境未自行启动任何服务（遵「环境准备职责边界」）

## 步骤 1 — 序列化契约组（BDD-07~12）实跑完成

- **BDD-07** PASS：pytest 遍历口径 4 passed/exit 0 + 端点实查 11 个端点、31 个时间字段全部以 Z 结尾（违规 0）。证据：`assert-bdd-07.log` / `bdd-07-endpoint-sample.json` / `bdd-07-endpoint-scan.json`
- **BDD-08** PASS：pytest 6 passed + 独立复算（Entry 5 字段 + User 3 字段全为 datetime、不以 Z 结尾，UtcSerializeMixin 不在任何表模型 MRO）
- **BDD-09** PASS：pytest 2 passed + 独立复算 16 叶模型 / 34 datetime 字段 python 模式全为 datetime
- **BDD-10** PASS：pytest 4 passed + CLI remote 实跑（`peekview get k8s-deployment --remote-url :8888 -j`，隔离 HOME）+ PeekClient.get_entry 解析出 utcoffset=0
- **BDD-11** PASS：pytest 3 passed + CLI 实跑 create/list/get `-j` 与 remote get `-j`，9+ 个时间字段全部带 Z
- **BDD-12** PASS：审计脚本对 debug DB 默认路径 exit 2（**验收沙箱 /tmp 为独立 tmpfs，看不到主 Agent 命名空间下的 /tmp/peekview-debug/**）；改经 debug backend API 导出全部 23 行（= admin/stats total 23）构造同 schema 副本，用**同一脚本** `--db` 复跑 → count=0 / checked=23 / exit 0；独立复算亦为 0

## 步骤 2 — 时间显示组（BDD-01~06）实跑完成

- 01/02/03/04/05/06 全 PASS（每次运行前 `:8888/health` = 200）

## 步骤 3 — 文件数三态 + 布局（BDD-13/14/15）实跑完成 → 全 PASS

## 步骤 4 — 可见性菜单 / 转换 / 空态 / 键盘组（BDD-16~30）实跑完成 → 全 PASS

- 16/17/18/19/20/21/22/23/24/25/26/27/28/29/30 全 PASS
- 采集过程中修正了 3 处**证据脚本自身缺陷**（非实现缺陷，如实记录）：
  1. `uiLogin` 曾用「Sign in 按钮是否可见」判断登录态 → domcontentloaded 时按钮未渲染，被误判为已登录，整批在匿名态跑。改为以页面级 `/api/v1/auth/me` 探针为权威判据（实测返回 200 才继续）
  2. `waitForURL('**/explore**')` 在已在 /explore 时立即返回 → 后续 goto 打断未完成的登录请求；改为等 `.login-dialog` 隐藏 + `/auth/me` 200 双确认
  3. BDD-27/28/29 曾用 `team_id === teamSlug` 断言 → API 的 `team_id` 是**数值 id**，slug 在 `team.slug`（P4 契约）；已改为 `teamSlugOf(e) = e.team?.slug`
  4. BDD-26 曾按 slug 文本定位卡片 → 卡片显示的是 **summary**；且 multi-format-demo 在第 2 页（首页 per_page=20）→ 改用 API summary + 站内搜索 `?q=<完整 summary>` 定位。**该修正后 BDD-26 首次真正跑通**
  5. BDD-13 曾因 localStorage 记忆视图模式无法回到卡片态 → 卡片/列表两态改用独立 context

## 步骤 5 — post-test 环境残留检查（强制）

- 写入 `P6-evidence/residue-check.log`（含 10 节：生产探活 / debug 探活 / entry 全量扫描 / slug 清单 / 残留模式匹配 / team 扫描 / user 扫描 / 清理动作 / 复检 / 结论）
- **entry 侧零残留**（23 条全为 seed，`e2e-`/`bdd*`/`vc0*`/`noteam*` 命中 0）
- **发现并清理**：7 个 `noteam<ts>` E2E 注册用户（BDD-17 造"无团队用户"时 register，spec 无注销钩子）+ 1 个 `probe-team-xyz`（verifier 手动探测 API 响应形态时创建）→ 全部 204，复检恢复到 seed 的 4 用户 / 2 团队
- 生产 `:8080` 全程 **000**，`[PROD_NOT_TOUCHED]`

## 步骤 6 — 证据格式预检（verifier 自查，非 gate）

按 verifier.md「gate 格式预检」三步全部执行并通过：

| 脚本 | 退出码 | 输出要点 |
|---|---|---|
| `check-p6-format.py --fix` 后 `--check` | **0** | 格式合规（30 条 `- PASS BDD-NN` 行，无 FAIL 行，无非法总结行） |
| `check-gate.py P6` | **2**（WARNING 级，非 1） | `GATE P6: 结构化 results 判据 D1–D10 通过`——D1 bdd 集合 = P1 的 `01..30`、D2 全 PASS、D3 证据可解析且未被 gitignore 忽略、D4 证据全部被引用、D6 无 EXIT_CODE≠0 矛盾、D8 截图条目全带 vision |
| `check-p6-evidence.py` | **0** | 30 条 BDD / 证据目录非空 / md5 去重通过（47 张截图全唯一）/ 4 组 avg-hash 雷同已附人工复核记录放行 |
| `check-p6-provenance.py` | **0** | 审计 2（dispatch-context 无预判）/ 审计 3（PASS 数 ≥ P1 BDD 数）/ 审计 7（无复用声明）全通过 |

**预检过程中修掉的两类自制障碍（非功能缺陷）**：
1. 项目 `.gitignore:87` 的 `*.log` 宽规则会吞掉证据日志（check-gate D3 报「证据须入库」）→ 证据日志统一移入 `P6-evidence/logs/`（命中 `.gitignore:94` 的 `!agate-workspace/tasks/**/P6-evidence/logs/*` 例外），报告内所有 log 引用同步加 `logs/` 前缀。
2. 雷同截图（4 组 avg-hash 相同）触发 check-p6-evidence 降级拦截 → 为 7 条涉事 BDD 追加**元素级局部截图**（8 张），并在 `P6-acceptance.md` §3.2 写「雷同截图复核」记录（md5 + PIL 像素差分 + bbox + 人工目视结论）。

## 步骤 7 — 只读纪律核验

```
$ git status --porcelain
 M agate-workspace/tasks/TPV0102-explore-card-list-ux/orchestrator-log.md   ← 主 Agent 的日志，非我改动
?? agate-workspace/tasks/TPV0102-explore-card-list-ux/P6-acceptance.md      ← 产出
?? agate-workspace/tasks/TPV0102-explore-card-list-ux/P6-dispatch-context-verifier.md  ← 主 Agent 产出
?? agate-workspace/tasks/TPV0102-explore-card-list-ux/P6-evidence/          ← 产出
?? agate-workspace/tasks/TPV0102-explore-card-list-ux/P6-progress.md        ← 产出
?? agate-workspace/tasks/TPV0102-explore-card-list-ux/vision-reports/       ← 产出
```

- `git status --porcelain -- backend/ frontend-v3/ scripts/` → **空**（未修改任何被验收的代码/测试）
- 未运行任何写类 agate 工具；未执行 checkout/restore/reset/stash/clean/add/commit
- 临时产物全在 `.agate-tmp/p6/`（未提交，已被 `.gitignore` 覆盖）
- 收尾时清掉了自己的 2 个越界调试截图（仓库根的 `p6dbg.png`/`p6dbg2.png`）与 3 张探针截图（`P6-evidence/screenshots/probe20*.png`），确保证据目录无未引用文件
