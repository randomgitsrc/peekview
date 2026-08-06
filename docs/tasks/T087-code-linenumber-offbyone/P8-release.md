---
phase: P8
task_id: T087-code-linenumber-offbyone
type: release
parent: P7-consistency.md
---

# P8-release — T087 代码块行号 off-by-one

[PROD_NOT_TOUCHED]

## 发布参数

```yaml
bump_type: patch
packages:
  - name: peekview
    type: backend-pipx（前端 static 资产随 backend 包发布）
    version_change: 0.17.0 → 0.17.1
  - name: mcp_server
    type: npm
    version_change: 不变（0.10.0，T087 无 MCP 改动）
```

### 版本变更确认

- **peekview**: 0.17.0 → 0.17.1（patch，bug fix）
  - 当前 `VERSIONS.json` peekview=0.17.0
  - bump 后 `VERSIONS.json` peekview=0.17.1
  - `make bump-version NEW_VERSION=0.17.1` 会同步 VERSIONS.json + backend/peekview/__init__.py + pyproject.toml + frontend-v3/package.json + package-lock.json 等所有文件（scripts/sync_versions.py）
- **mcp_server**: 0.10.0（不变）
  - T087 改动仅 `frontend-v3/src/composables/useShiki.ts`（P2§packages=frontend-v3，P7§3.1 确认 P2 packages = P4 改动文件 = P8 bump 范围，均限 frontend-v3）
  - MCP 无改动，不 bump MCP 版本

### 发布检查命令（P2 gate_commands，主 Agent 亲自执行）

| 检查项 | 命令 | 期望结果 |
|--------|------|---------|
| P5 重跑（vitest） | `cd frontend-v3 && ./node_modules/.bin/vitest run --reporter=dot 2>&1 \| tail -30` | exit 0, 1226 passed | 1 skipped, failed=0 |
| typecheck | `cd frontend-v3 && ./node_modules/.bin/vue-tsc --noEmit` | exit 0, errors=0 |
| lint（项目铁律#10） | `make lint` | exit 0（ruff，系统 python3） |

> P5 E2E viewer.spec.ts 预存失败（路由 #/entry/{slug} vs /{slug} + 硬编码 slug 失效）已登记 known-failures.md，非 T087 回归。T087 用专用 t087-verify.spec.ts 替代验证（6 测试全绿，已删除）。

## CHANGELOG 更新建议

当前 `CHANGELOG.md` [Unreleased] 区（line 8-12）内容：

```
## [Unreleased]

### 变更

- Explore 页 footer 文案：`Built for sharing code & docs` → `Built for sharing what agents ship`（原文案未覆盖数据查看器/图表等能力）
```

### 建议操作

**将 T087 修复移入 [0.17.1]，explore 文案 hotfix 一并移入 [0.17.1]。**

理由：
1. explore 文案 hotfix（commit 44df2aee）是未发布的用户可见改动，独立留在 [Unreleased] 会让下一个版本的 CHANGELOG 出现"孤儿条目"。
2. 两个改动都是小 patch 范畴（文案 + bug fix），合并到同一个 0.17.1 发布更合理。
3. [Unreleased] 移空后保留空节（符合 Keep a Changelog 规范，下个任务直接往里加）。

### 建议 CHANGELOG.md 变更（主 Agent 执行 bump-version 后操作）

将 [Unreleased] 区替换为空节，在 [0.17.0] 上方新增 [0.17.1] 节：

```markdown
## [Unreleased]

## [0.17.1] - 2026-08-07

### 修复

- 代码块行号 off-by-one：末尾换行导致行号比实际代码多一行。`useShiki.ts` 的 `highlight()` 和 `highlightCode()` 在调用 `codeToHtml` 和 `renderLineNumbers` 前对 `code` 做共享 `replace(/\n$/, '')` trim，使行号列与高亮列输入一致、逐行对齐 (T087)

### 变更

- Explore 页 footer 文案：`Built for sharing code & docs` → `Built for sharing what agents ship`（原文案未覆盖数据查看器/图表等能力）

## [0.17.0] - 2026-08-06
...
```

> 日期 2026-08-07 由主 Agent 按 bump 当天实际日期填写。
> commit 44df2aee 已在 git 历史中（explore hotfix），`git log v0.17.0..HEAD --oneline` 对照 CHANGELOG 时应包含该 commit——移入 [0.17.1] 可避免"git log 有 commit 但 CHANGELOG 无记录"的遗漏。

## git log 对照预检

`git log v0.17.0..HEAD --oneline`（v0.17.0 tag 对应 fb9b2802 之前的 commit）预期包含：

| commit | 内容 | CHANGELOG 归属 |
|--------|------|---------------|
| 88850d6b | wf(T087-P6) | 流程 commit，不进 CHANGELOG |
| 46781ef7 | wf(T087-P5) | 流程 commit，不进 CHANGELOG |
| e5a98bd6 | wf(T087-P4) | **T087 实现**，进 [0.17.1] 修复条目 |
| d5fe475c | wf(T087-P3) | 流程 commit，不进 CHANGELOG |
| ec334bfe | wf(T087-P2) | 流程 commit，不进 CHANGELOG |
| 9cd1568b | wf(T087-P1) | 流程 commit，不进 CHANGELOG |
| 44df2aee | fix(copy) explore 文案 | **explore hotfix**，进 [0.17.1] 变更条目 |

> 主 Agent gate 验证 `git log v0.17.0..HEAD --oneline` 对照 CHANGELOG 无遗漏时，流程 commit（wf(...) 前缀）不进 CHANGELOG 是正常的——它们是 agate 阶段产物，非用户可见改动。需进 CHANGELOG 的是 e5a98bd6（T087 实现）+ 44df2aee（explore hotfix）两条。

## 临时资源清单

本任务执行期间启动/创建的临时资源及当前状态：

| 资源 | 类型 | 状态 | 清理方式 |
|------|------|------|---------|
| debug backend :8888 | 临时服务 | 已停止（P5 完成后 `make debug-stop`） | 无需额外清理 |
| /tmp/peekview-debug/ | 临时数据目录 | 已清理（`make debug-stop` 自动清理） | `ls -d /tmp/peekview-debug` 确认不存在 |
| frontend-v3/e2e/t087-verify.spec.ts | 临时 E2E spec | 已删除 | `ls frontend-v3/e2e/t087-verify.spec.ts` 确认不存在 |
| static 重建（make build-frontend） | 前端静态资产 | 已重建（P5/P6 期间） | assets 不进 git，CI 重建，无需清理 |
| 开发安装（editable install / 全局包） | 无 | 未进行 | T087 未做任何 pip install / npm install -g |

### 主 Agent READY 收尾检查项

- [ ] `ps aux \| grep 8888` 确认无 debug server 残留（已确认：no debug server on 8888）
- [ ] `ls -d /tmp/peekview-debug` 确认已清理（已确认：不存在）
- [ ] `git status` 确认工作区干净（bump-version + CHANGELOG commit 后）
- [ ] `git tag` 确认 v0.17.1 已创建
- [ ] 生产环境无残留：T087 全程走 debug backend :8888 + vitest（不依赖后端），未触 :8080 生产与 ~/.peekview/

## P2 packages 与 P8 bump 范围一致性

P2-design.md §声明字段 packages（line 13-14）：`frontend-v3`，domains：`frontend`。

P7-consistency.md §3.1 确认：P2§packages = P4§改动文件（仅 `frontend-v3/src/composables/useShiki.ts`）= P8 bump 范围，均限 frontend-v3。

frontend-v3 属 backend pipx 包的 static 资产（`backend/peekview/static/`），`make bump-version` 同步 VERSIONS.json + 所有版本文件，pipx upgrade 时 static 随包落地。MCP（packages/mcp-server）独立版本线，T087 无改动，不 bump。

**无 SCOPE_GAP**：P2 声明 packages=frontend-v3，P8 处理 peekview 主包（含 frontend static），未遗漏 MCP（MCP 无改动）。

## Lessons Learned

1. **off-by-one bug 的根因是双输入未共享 trim**：Shiki `codeToHtml` 和 `split('\n')` 都不处理末尾换行（都多一个尾部空行，数量对齐）。只改 `renderLineNumbers` 内部 split 会引入行号 N-1 vs `.line` N 错位——必须让 trim 后的 code 同时喂给 `codeToHtml` 和 `renderLineNumbers`（调用方共享 trim），而非只改一列。（T087，2026-08-07，架构）
2. **P1 实测验证库行为是方案设计的前提**：P1 analyst 直接实测 Shiki 1.x `codeToHtml` 行为，确认"两列都多尾部空行"这一关键事实，使 P2 能否决"只改 renderLineNumbers"的错误方向。方案设计依赖第三方库行为时，实测 > 文档 > 假设。（T087，2026-08-07，测试）
3. **预存 E2E 失败用专用 spec 替代验证**：viewer.spec.ts 预存失败（路由变更 + 硬编码 slug）远早于 T087，登记 known-failures.md 后用任务专用 spec（正确路由 + 动态创建 entry）替代验证，避免被预存失败阻塞验收。（T087，2026-08-07，流程）

## 自检

- [x] bump_type 字段存在：patch
- [x] 版本号变更确认：peekview 0.17.0 → 0.17.1（MCP 不变 0.10.0）
- [x] CHANGELOG 更新建议：[Unreleased] T087 + explore hotfix → [0.17.1]
- [x] 临时资源清单：4 项（debug server 已停 / /tmp 已清理 / t087-verify.spec.ts 已删 / static 已重建）
- [x] P2 packages = P8 bump 范围（frontend-v3，无 SCOPE_GAP）
- [x] 未执行 git commit/tag（主 Agent 亲自做）
- [x] 未执行 bump-version（主 Agent 亲自做）
- [x] [PROD_NOT_TOUCHED]
