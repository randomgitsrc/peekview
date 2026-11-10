# P5 技术验证 — E2E（Playwright 实跑）结果

- **任务**: TPV0102-explore-card-list-ux（`ui_affected: true` ⇒ E2E **必须真跑**）
- **阶段**: P5（技术验证）
- **执行者**: verifier subagent
- **日期**: 2026-11-11
- **目标环境**: debug backend `http://127.0.0.1:8888`（隔离数据目录，由主 Agent 后台 job 托底）
- **生产环境**: `:8080` —— 全程探活 **000**，未触碰 `[PROD_NOT_TOUCHED]`

## 服务探活记录（每个 E2E 步骤前）

| 时点 | 命令 | 结果 |
|---|---|---|
| 开工基线 | `curl -s -o /dev/null -w "%{http_code}" --max-time 3 :8888/health` | **200** |
| 命令 3 前 | 同上 | **200** |
| 命令 4 前 | 同上 | **200** |
| 收尾 | `:8080/health` | **000**（生产未起，未触碰） |

`/health` 响应体：`{"status":"ok","version":"0.26.1","checks":{"database":"ok","storage":"ok","disk_space_mb":4957}}`

> 全程未自行启动任何服务（遵 P5「环境准备职责边界」）。

---

## 命令 3 — `P5_e2e`（本任务 E2E 覆盖）

```
E2E_SPEC=e2e/tpv0102-explore-card-list-ux.spec.ts make debug-test
```

- **EXIT_CODE: 0**
- **结果: 61 passed, 3 skipped, 0 failed**（64 total；2 project = `chromium` 1280×800 + `Mobile Chrome` 390×844）
- **耗时**：测试本体 `39.4s`；外层总耗时 `174s`（含 `build` 静态产物新鲜度检查 + 安全守卫 + CDP 连接）
- **E2E 是否真跑**：**是**。非单元测试——日志显示 64 个 Playwright 用例逐条执行（`[1/64]` … `[64/64]`），使用 CDP Chrome `http://127.0.0.1:18800`
- **覆盖**：BDD-01/02/03/06/13/14/15/16/17/18/19/20/21/22/23/24/25/26/27/28/29/30 + 视觉契约 VC-1~VC-8（`vc01`~`vc08`）
- 与 P4 基线一致（`P4-review.md` T-13：design 两次复跑均为 61 passed / 0 failed）——**无本任务引入的 E2E 失败**

### 失败截图

**无**。`playwright.config.ts:16` 为 `screenshot: 'only-on-failure'`，本命令 **0 failed** ⇒ **不产生失败截图**。
本文件不伪造"截图已保存"；本任务 E2E 的通过证据为上述 runner 逐条执行日志与 `exit 0`（见 `.agate-tmp/p5/cmd3-e2e-tpv0102.log`）。
runner 打印的 `截图保存位置: /tmp/e2e-results/` 为脚本固定文案（`scripts/run-e2e-tests.sh:116`），与"本次是否真的产生截图"无关。

---

## 命令 4 — `P5_e2e_legacy`（既有 team-visibility 回归）

```
E2E_SPEC=e2e/team-visibility.spec.ts make debug-test
```

- **EXIT_CODE: 2**
- **结果: 6 passed, 2 failed**（8 total = 4 test × 2 project）
- **耗时**：`2.1m` 测试本体；外层 `262s`
- **failed 明细**（2 条 = 同一测试在两个 project 各失败一次）：
  - `[chromium] e2e/team-visibility.spec.ts:147:3 › BDD-40: team entry 卡片有 visibility-toggle，delete 保留`
  - `[Mobile Chrome] 同上`

### 失败点与归因（**已独立取证，非自述**）

```
Locator:  locator('.entry-card, .entry-list-row').filter({ hasText: 'team toggle 1794334946366' }).first()
Expected: 1
Received: 0
  > 157 |     await expect(teamCard).toHaveCount(1)
     14 × locator resolved to 0 elements
```

**根因：fixture 缺失——`proj-a` 团队在 debug seed 中不存在。** 三重独立证据：

1. **截图（最直接）**：`?team=proj-a` 页面渲染「团队不可用 / 你无权访问该团队，或该团队不存在。」+「清除过滤」——
   见 `evidence/bdd40-fixture/bdd40-chromium-first.png`（chromium）与 `bdd40-Mobile-Chrome-first.png`（mobile）
2. **API 侧**：
   - `GET /api/v1/teams`（alice）→ `{"owned":[{"slug":"frontend-team","name":"frontend-team","member_count":1}],"joined":[]}` —— **无 `proj-a`**
   - `POST /api/v1/entries` `team_id=proj-a` → **HTTP 422** `{"code":"PARAMETER_VALIDATION_ERROR","message":"Team not found or not accessible"}`
   - 对照组 `team_id=frontend-team` → **HTTP 201**（后端与造数链路本身正常，仅 `proj-a` 缺）
3. **代码/数据侧**：`grep -rn "proj-a" scripts/seed-data/` → **0 命中**；seed 实际团队为 `frontend-team`（`scripts/seed-data/markdown-test/meta.json:11`、`mermaid-charts/meta.json:10`）

**归属**：`P4-review.md` T-14 / 派发单「已知的合法失败 #2」——既有 spec 的 fixture 缺失，**非 TPV0102 缺陷**。

> **诚实化附注**（一并写入 `known-failures.md`）：TPV0102 `P2-design §6.4` 第 1 项把该断言由 `count = 0`（且整段包在 `if ((await teamCard.count()) > 0) { … }` 守卫内）翻转为**前置** `await expect(teamCard).toHaveCount(1)` 并**拆掉守卫**。
> 因此该 fixture 缺口由"被守卫掩盖的假绿"变为"真红"——**红的根因是 fixture，"变红"是本任务有意诚实化的结果**。
> 两条失败均停在"卡片不存在"的前置断言，**从未走到** `visibility-toggle` 数量断言 ⇒ 不能据此判定 toggle 行为有误。

### 失败截图（已留存）

`test-results/` 会被下次 run 清空，故已复制到 `evidence/bdd40-fixture/`：

| 文件 | 大小 | 说明 |
|---|---|---|
| `evidence/bdd40-fixture/bdd40-chromium-first.png` | 37 KB | chromium 首跑失败帧（1280×720） |
| `evidence/bdd40-fixture/bdd40-chromium-retry1.png` | 37 KB | chromium retry#1 失败帧 |
| `evidence/bdd40-fixture/bdd40-Mobile-Chrome-first.png` | 115 KB | Mobile Chrome 首跑失败帧 |
| `evidence/bdd40-fixture/bdd40-Mobile-Chrome-retry1.png` | 115 KB | Mobile Chrome retry#1 |
| `evidence/bdd40-fixture/bdd40-Mobile-Chrome-retry2.png` | 115 KB | Mobile Chrome retry#2 |

截图内容一致显示「团队不可用 / 你无权访问该团队，或该团队不存在。」——与根因判定吻合（同一失败态的多次重试帧，非不同缺陷）。

---

## 环境隔离核验

| 检查 | 结果 |
|---|---|
| `BASE_URL` 非生产 | ✓ runner Safety Check 通过（`:8888` ≠ `:8080`） |
| 生产条目数（runner 记录） | ℹ 283（测试前后对比逻辑在 runner 内；本次日志未打印污染告警） |
| 生产端口探活 | **000**，全程未触达 |
| `~/.peekview/` | 全程未写（该目录为只读挂载，物理层面亦无法写入） |
| debug DB 路径独立复核 | ⚠️ **未能独立复核**：`lsof -t -i :8888` 在本调用命名空间内取不到 PID（服务挂在主 Agent 后台 job 的另一命名空间），故 runner 的 `✓ Service using debug database: /tmp/peekview-debug/peekview.db` 分支未打印。**如实记录为"未复核"，非失败** |

---

## 结论

- 两条 E2E 命令均**真跑**（非只跑单元测试）。
- **本任务 E2E：61 passed / 0 failed / exit 0** —— `ui_affected: true` 的 E2E 验证完整。
- 既有 legacy spec 的 2 failed 已用截图 + API + seed 扫描三重取证，归因为 **fixture 缺失（`proj-a` 不存在）**，登记 `known-failures.md` 第 2 条，**不计入 TPV0102 引入的失败**。
- 未修改任何 spec 或代码使其变绿（只读纪律）。

EXIT_CODE: 2
