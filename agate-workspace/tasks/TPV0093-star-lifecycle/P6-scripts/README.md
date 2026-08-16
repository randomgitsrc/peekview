# TPV0093 P6 验收脚本说明（verifier 交付，主 Agent 执行）

> ⚠️ **verifier 只写脚本，不执行长命令。以下命令由主 Agent 在 P6 gate 前执行。**
> 执行输出即验收证据：backend 断言落 `P6-evidence/backend/`，截图落 `P6-evidence/screenshots/`。

## 前置（必须）

1. **重启 debug backend 到 P4 代码**：当前 :8888 进程（PID 681874）是旧代码，DB 无
   `entry_stars`/`entry_tombstones`/`archive_delete_at`，脚本预检会直接失败。
   运行 `make debug-quick`（build-fast + start + seed）即可。
2. 确认 DB 出现新表：`sqlite3 /tmp/peekview-debug/peekview.db "SELECT name FROM sqlite_master WHERE name IN ('entry_stars','entry_tombstones')"`
3. Chrome CDP :18800 在线。
4. **严禁指向 :8080 生产**——脚本有 BASE 硬拦截。

## 执行顺序

### 1. Backend 验证（BDD-1/2/3/4/5 + 7/8/9/10 + 11/12/13 + 15/16/17/28 + 27）

```bash
bash agate-workspace/tasks/TPV0093-star-lifecycle/P6-evidence/scripts/verify-backend.sh
```

- 依赖：debug :8888 + seed 用户 alice/bob/carol（testpass123）+ `.venv`（跑定向 pytest）
- 产出：`P6-evidence/backend/bdd-*.json` + `backend-results.log` + `pytest-lifecycle.log` + `pytest-migration.log`
- 结束打印 `GATE_EXIT: 0/1`

### 2. Frontend 验证（BDD-6/14/18/19/20/21/22/23/24/25/26）

```bash
cd frontend-v3
NODE_PATH=/home/kity/.nvm/versions/node/v24.15.0/lib/node_modules \
  npx tsx ../agate-workspace/tasks/TPV0093-star-lifecycle/P6-evidence/scripts/verify-ui.ts
```

- 依赖：debug :8888 + Chrome CDP :18800；脚本自带 API 数据准备（建 entry / 星标 / 归档 / 墓碑）
- 产出：`P6-evidence/screenshots/bdd-*.png`（操作类 BDD 截图互不相同，含时间戳后缀）+ `P6-evidence/backend/ui-results.json`
- 退出码：FAIL>0 → 1

## 证据 → P6-acceptance.md

主 Agent 执行后，按脚本输出把每条 BDD 结果回填到 P6-acceptance.md：

- backend PASS 行证据：`(P6-evidence/backend/bdd-NN.json)` 或 `(P6-evidence/backend/pytest-lifecycle.log)`
- frontend PASS 行证据：`(P6-evidence/screenshots/bdd-NN-*.png)` + `(P6-evidence/backend/ui-results.json)`
- UI 类 PASS 须附 `(vision: vision-reports/bdd-NN.yaml)`（vision-analyst 补）

## 覆盖矩阵

| 脚本 | BDD |
|------|-----|
| verify-backend.sh | 1,2,3,4,5,7,8,9,10,11,12,13,15,16,17,27,28 |
| verify-ui.ts | 6,14,18,19,20,21,22,23,24,25,26 |

（28 条全覆盖，BDD-24/25/26 后端侧另有 sqlite 墓碑断言支撑）
