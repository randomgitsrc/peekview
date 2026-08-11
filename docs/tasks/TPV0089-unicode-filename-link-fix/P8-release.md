---
phase: P8
task_id: TPV0089-unicode-filename-link-fix
type: release
parent: P7-consistency.md
trace_id: TPV0089-P8-20260811
status: draft
created: 2026-08-11
agent: implementer
# ── v2.0 机器字段 ──
bump_type: patch
packages: [peekview]
---

# P8 发布准备 — TPV0089 非 ASCII 文件名本地资源链接解析修复

## 1. bump_type 判定

**bump_type: patch**

理由：本任务是 bug 修复（markdown 正文引用非 ASCII 文件名本地图片/附件时解析失败 → 404/加载失败），无新增用户可见功能、无破坏性变更、无 schema/API 变更。按语义化版本（AGENTS.md + CHANGELOG.md:6），bug 修复 → patch。

## 2. 版本变更确认（仅 peekview）

| 包 | 旧版本 | 新版本 | 变更来源 |
|----|--------|--------|----------|
| peekview | 0.18.2 | **0.18.3** | `VERSIONS.json` 唯一版本源（`make bump-version NEW_VERSION=0.18.3`） |
| mcp_server | 0.10.0 | 0.10.0（**不动**） | P2-design.md:12 `packages: [peekview]`；MCP 零改动（P2:32-33） |

- 版本源确认：`VERSIONS.json` 当前 `{"peekview": "0.18.2", "mcp_server": "0.10.0"}`（已核对，见上方读取）
- 改动范围确认：仅前端 `frontend-v3/src/utils/path-map.ts` 单文件（+23/-4，P4-implementation.md:18），随 peekview 静态资源发布
- `make bump-version` 会将版本同步到所有文件 + commit + tag（AGENTS.md 发布流程），**由主 Agent gate 后亲自执行**

## 3. CHANGELOG 更新计划（只起草，不落盘）

当前 `CHANGELOG.md:8` `[Unreleased]` 为空。主 Agent 在 `make bump-version` 后应将 `[Unreleased]` 标题替换为以下内容（保持 Keep a Changelog + 语义化版本格式，沿用既有 (Txxx) 任务引用风格）：

```markdown
## [0.18.3] - 2026-08-12

### 修复

- 修复 Markdown 正文中引用的本地图片/附件在文件名含非 ASCII 字符（中文/日文/带重音拉丁字符/空格等）时解析失败的问题：markdown-it 对引用做 percent-encode 后无法匹配未编码的 pathMap key，导致链接 404/图片加载失败。`resolvePath` 改为 raw 优先匹配 + 单次 decode 兜底（畸形转义 try/catch 降级为 null），ASCII 文件名行为零回归 (TPV0089)
```

执行步骤（主 Agent gate 后）：
1. `make bump-version NEW_VERSION=0.18.3` → 更新 VERSIONS.json + 同步所有文件 + commit + tag
2. 将 `[Unreleased]` 标题替换为上文 `[0.18.3]` 条目，`git add CHANGELOG.md && git commit --amend --no-edit`
3. `make pre-publish-quick` → `make publish`（PyPI，token 从 `~/.bash_env` 读）→ `git push && git push origin v0.18.3`
4. 升级生产（⚠️ 必须人工）：`pipx upgrade peekview && sudo systemctl restart peekview`

## 4. 临时资源清单（主 Agent READY 收尾检查参考）

| 资源 | 说明 | 清理动作 |
|------|------|----------|
| debug backend :8888 | P5/P6 使用，`make debug-quick`/`make debug-start` 启动 | `make debug-stop`（停止 + 清理 /tmp/peekview-debug/） |
| `/tmp/peekview-debug/` | 隔离数据目录（peekview.db + 23 entries，含 unicode-filenames fixture，非生产库） | 随 `make debug-stop` 清理 |
| CDP Chrome :18800 | P6 浏览器自动化连接（Windows Chrome，外部进程） | 无需本机清理，脚本已 `page.close()`；确认无残留 node 脚本进程 |
| `frontend-v3/dist/` 重建产物 | P5 执行 `make build-frontend` 生成（反映 P4 修复） | 保留（正常构建产物，发布流程所需） |
| `/tmp/mv-tpv0089.mjs` 等验证脚本 | P2 minimal_validation 的 Node 实证脚本（/tmp，非 repo） | 可删除，非 repo 内容 |
| P6 截图/日志 | 位于任务目录 `P6-evidence/`、`evidences/`、`vision-reports/` | 保留为验收证据，不清理 |
| 后端 venv / frontend node_modules | 开发依赖（既有，非本任务引入） | 保留 |

**无开发安装**：本任务未执行 `pip install -e` 等任何安装动作（P0 铁律 4 遵守）。

## 5. 发布检查对照（P2 gate_commands ↔ P5/P6 实际结果）

| 命令 | P2 声明 | 实际结果 | 状态 |
|------|---------|----------|------|
| P3 | `npx vitest run src/utils/path-map.test.ts` | 51/51 passed（P5-test-results/unit.md） | ✅ |
| P5 | `make test-frontend` | 92 files / 1228 passed / 0 failed（unit.md） | ✅ |
| P5_typecheck | `make typecheck` | exit 0（typecheck.md） | ✅ |
| P5_e2e | `make debug-test` | unicode-filename-link.spec.ts 12 用例 P6 12/12（11+1 flaky retry，exit 0）（P6-acceptance.md:30） | ✅ |
| P6 验收 | 13/13 PASS，0 FAIL，vision blocker_count=0 | P6-acceptance.md frontmatter pass=13 fail=0 | ✅ |
| P7 一致性 | BLOCKER=0，DEVIATION=0，DESIGN_GAP=0 | P7-consistency.md:59-65 approved | ✅ |
| 后端 pytest（建议项） | `make test-quick` | 1061 passed / 4 failed（`test_cli_remote.py` xdist 环境性预存失败，单跑 17/17 全绿，已登记 known-failures.md，与本任务无关） | ⚠️ 预存失败 |

## 6. SCOPE_GAP 检查

- P2 `packages: [peekview]`（P2:12），本 dispatch-prompt 亦为 `[peekview]` —— 无遗漏。
- mcp_server 未声明且 P2 明确零改动（P2:32-33），不 bump。无 [SCOPE_GAP]。

## 7. [PROD_NOT_TOUCHED]

本任务全程未触碰 :8080 生产服务 / `~/.peekview/` / 生产数据库；P6 验收、P5 测试均在 debug backend（:8888，/tmp/peekview-debug/）隔离环境完成（P6:18、P7:67 均标记 [PROD_NOT_TOUCHED]）。

## 8. Lessons Learned

| 类别 | 教训 | 来源任务 | 日期 |
|------|------|----------|------|
| 流程 | 静态文件双路径下，debug server 优先 serve `frontend-v3/dist/`，P4 修源码后未 `make build-frontend` 会导致 E2E 全部失败（P5-test-results/e2e.md 首轮 10 失败根因）。改前端后必须先重建 dist 再跑 E2E | TPV0089 | 2026-08-12 |
| 架构 | markdown-it `mdurl.encode` 默认 keepEscaped=true 保留合法 `%` 转义，`a%20b.png` 不会二次编码——设计 BDD 时若按"库会把 `%` 编码成 `%25`"的前提会误导测试设计（P2 §7 前提勘误） | TPV0089 | 2026-08-11 |
| 测试 | `test_cli_remote.py` 在 xdist `-n auto`（16 核）下端口抢占导致连接失败，属环境性预存失败；单独运行全绿。全量 pytest 失败需先排除 xdist worker 数因素再归因代码 | TPV0089 | 2026-08-12 |

## 9. 主 Agent 后续动作

1. 验证 P8 gate：从 P2 packages 逐包跑发布检查命令（本任务仅 peekview，见 §5，均已全绿）+ 重跑 P5 gate + `git log v0.18.2..HEAD --oneline` 对照 CHANGELOG 无遗漏
2. 亲自执行 `make bump-version NEW_VERSION=0.18.3` + CHANGELOG 更新（§3 草案）+ commit + tag
3. 按 §4 临时资源清单执行 READY 收尾清理
4. 更新 `.state.yaml` phase → READY → DONE，`docs/tasks/active-tasks.md` 任务行状态
