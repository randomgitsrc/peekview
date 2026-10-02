---
phase: P8
task_id: TPV0100
type: release
parent: P7-consistency.md
trace_id: TPV0100-P8-20261002
status: draft
created: 2026-10-02
agent: releaser
bump_type: minor
debt_check: reviewed
---

# P8 发布准备 — TPV0100 网页发布入口

> 本文件为**发布准备方案**。releaser **未执行** `make bump-version` / `git commit` / `git tag` / `make publish`，**未修改** `VERSIONS.json` / `CHANGELOG.md` / `backend/pyproject.toml` / `frontend-v3/package.json`。
> 版本 bump 同步 + CHANGELOG 更新 + commit + tag 由主 Agent 在 gate 通过后亲自执行。
> `[PROD_NOT_TOUCHED]`——全程只读仓库与 agate 工作区；未触碰生产 `:8080` 与 `~/.peekview/`（`ps` 显示的生产 pipx `peekview serve` 为 TPV0099 前已存在的用户服务，本任务未启停、未写入）。

---

## 1. 发布判定表

| 项 | 值 | 依据 |
|----|----|----|
| `bump_type` | **minor** | 交付性质 = **用户可见新功能**（登录用户 `/publish` 上传发布入口）。语义化版本：向后兼容的新增功能 → minor |
| 受影响包 | **`peekview`**（后端 + 前端同包发布） | P2 `packages: [peekview-frontend, docs]` 为**逻辑域**声明；仓库实际发布单元为 `peekview`（前端随包分发，见 AGENTS.md「两个包版本独立管理」）。前端新功能属 `peekview` 包的用户可见变更 |
| 当前 → 目标版本 | `peekview` **0.25.0 → 0.26.0** | `VERSIONS.json: peekview=0.25.0`（唯一版本源） |
| **不 bump** 的包 | **`mcp_server`**（保持 0.12.0） | 本任务**零 MCP 改动**：`git diff --stat v0.25.0..HEAD -- packages/` 为空（MCP 工具/客户端/配置均未改）；MCP 独立版本源 `VERSIONS.json: mcp_server=0.12.0` 不动 |
| 后端是否变更 | 后端源文件零改动 | `git diff --stat v0.25.0..HEAD -- backend/`（排除 `static/` 构建产物）为空；P7 一致性结论亦证后端零改动。仅静态产物 `backend/peekview/static/**` 随前端构建更新，属分发产物非源码 |
| 先例一致性 | 与 TPV0099 同判 | TPV0099（用户可见前端新功能）判 `minor`（`peekview 0.24.1 → 0.25.0`）；本任务同性质 → `minor`，版本递增 0.25.0 → 0.26.0 连续 |
| roadmap 回写 | 无需 | 无 `agate-workspace/roadmap/roadmap.md` → 无 RM 条目需回写状态 |

**交付内容**（`git diff --name-only v0.25.0..HEAD -- frontend-v3/` 实读，源码部分）：

- 新增页面：`frontend-v3/src/views/PublishView.vue`
- 新增组件：`FileDropZone.vue` / `PublishFileList.vue` / `PublishResultPanel.vue`
- 新增 composable：`usePublishValidation.ts` / `useFileEncoding.ts`
- 路由：`router.ts` 注册 `/publish`；入口两处：`UserMenu.vue` 下拉项 + `EntryListView.vue` 入口
- 类型/API：`api/types.ts`、`api/client.ts`（`getLimits` / `pageLink` / `rawLink`）
- 测试：`src/__tests__/tpv0100-publish.spec.ts`、`e2e/tpv0100-publish.spec.ts`
- 文档：`docs/specs/peekview-web-publish-20261001.md`

---

## 2. CHANGELOG 条目文本方案（**不实际改文件**）

主 Agent 在 bump 后执行：把 `[Unreleased]` 区块下方现有 `## [0.25.0] - 2026-09-29` 之上，插入新版本标题与条目；并将原 `## [Unreleased]` 保留为空（Keep a Changelog 惯例）。当前 `[Unreleased]` 为空，无旧条目需迁移。

**应写入文本**（中文，面向用户）：

```markdown
## [0.26.0] - 2026-10-02

### 新增

- 网页发布入口（TPV0100）：登录用户访问 `/publish` 可直接上传文件并发布 entry——拖拽或选择文件（`FileDropZone`）、发布前文件清单与编码选择（`PublishFileList` / `useFileEncoding`）、表单校验与体积/数量限额提示（`usePublishValidation`，限额来自服务端 `getLimits`）、发布结果面板展示分享链接与 raw 链接（`PublishResultPanel`，链接用当前访问源自拼）。入口两处：右上角用户菜单下拉新增「Publish」项、Explore 列表页工具栏新增发布按钮。发布成功后可复制 `/{slug}` 页面链接与 `/{slug}/raw` agent 读取链接
```

**版本标题日期**：`2026-10-02`（执行当日；若实际 bump 跨日则改为执行日）。

**同步范围提示**（主 Agent 执行 `make bump-version NEW_VERSION=0.26.0` 自动完成，releaser 不改）：
- `VERSIONS.json` → `peekview: "0.26.0"`
- 由 `scripts/sync_versions.py` 同步：`backend/pyproject.toml`、`frontend-v3/package.json`、README badge 等版本引用
- CHANGELOG 标题与条目（见上，需人工 / bump 后补写，`bump-version` 不自动写 CHANGELOG 条目）

---

## 3. 发布检查命令（从 P2 packages 推导）

单包任务（`peekview`，前端域）。命令均取自 Makefile（P2 §gate_commands 实读，Makefile 为测试命令唯一真相源），主 Agent gate 需**逐条实跑 → 全部 exit 0**：

| # | 命令 | 用途 | 超时 |
|---|------|------|------|
| 1 | `make lint` | ruff（走 venv `.venv/bin/ruff`） | 300000 |
| 2 | `make typecheck` | `npx vue-tsc --noEmit`（CI 强制门禁） | 300000 |
| 3 | `make test-frontend` | `npx vitest run`（非 watch；TPV0100 新增 `src/__tests__/tpv0100-publish.spec.ts`） | 300000 |
| 4 | `make test-quick` | 后端 pytest（确认后端零改动未破坏，conftest autouse 隔离 tmp） | 300000 |
| 5 | `make build-frontend` | 构建前端 + 复制到 `backend/peekview/static/`（发布产物；`npm run build` = vue-tsc + vite build） | 300000 |
| 6 | `make debug-test`（或 `E2E_SPEC=e2e/tpv0100-publish.spec.ts make debug-test`） | E2E 验收（需 debug :8888 在跑；`BASE_URL` 防生产护栏） | 300000 |

**前置/约束**：
- `make publish`（PyPI 上传）由主 Agent 后续执行，**不由 releaser 触发**；发布 token 在 `~/.bash_env`。
- `mcp_server` 不 bump → 不跑 `make build-mcp` / `make test-mcp`（已验证 `packages/` 零 diff，关联性为零）。
- E2E 序号 6 依赖 debug backend `127.0.0.1:8888`；跑前确认实例状态（见 §5 临时资源清单）。
- 若 `make build-frontend` 后 `backend/peekview/static/**` 有构建产物变更，属预期分发产物，随 release commit 一并提交（`bump-version` 会 `git add -A`）。

---

## 4. `debt_check` 字段

`debt_check: reviewed`

已通读 `agate-workspace/debt/tech-debt.md`（截至 DEBT0017）。**与 TPV0100 直接相关的条目**：

| 条目 id | 标题（摘要） | status | 与 TPV0100 关系 |
|---------|-------------|--------|-----------------|
| **DEBT0014** | agate 内置 vitest formatter 环境变量传全量输出超 `MAX_ARG_STRLEN` → P3 假红灯 | open | **本任务已命中并规避**：TPV0100 P3 采用任务级 formatter（`{task_dir}/.agate/formatters/vitest-vite.sh`，临时文件传输出 + 识别 Vite `Failed to resolve import`），P2 v1.1 记录。不影响发布；债留上游 |
| DEBT0017 | `make bump-version` 的 `git add -A` 无提交前暂存面防护 | open | **对本次 release commit 有直接提示作用**：主 Agent 执行 bump-version 前必须过目 `git diff --cached --name-only`（`.agate-tmp/` 已 `git check-ignore` 覆盖，实测 ignored）；属流程注意，不阻断 |
| DEBT0013 | zen 隐藏集不含 archived/expired banner（TPV0099 遗留） | open | 与 `/publish` 入口无交互（发布产物页全屏语义），**不涉及本次范围** |
| DEBT0008 / DEBT0009 | E2E 副作用无 gate / seed 人工体验验收真空 | open | 管理类债；本任务 P6 已含 E2E 自建 fixture + 清理（见 P6-acceptance），**无新增欠账** |

**结论**：有 3 条（DEBT0014 / DEBT0017 / DEBT0013）与本任务存在间接关联，均为**上游/协议层或既有遗留**，无一条需在本任务修复或阻断发布。故记 `reviewed`（留痕），而非 `none`。**登记 DEBT 不豁免本任务**——上述 P5/P6 验收一个未少（P7 结论：BLOCKER 0 / DESIGN_GAP 已全配对）。

---

## 5. 临时资源清单（releaser → 主 Agent 交接）

> 主 Agent 用本清单执行 READY 收尾清理。**本任务（releaser）未新启服务**，以下为 TPV0100 全任务期（P4/P5/P6）遗留、需在收尾确认/清理的项。

### 5.1 运行中的进程/服务（**需停止**）

| 资源 | 证据 | 处理 |
|------|------|------|
| debug backend（uvicorn `:8888`，`backend/.venv/bin/python`） | `ss -ltn` 显示 `127.0.0.1:8888` LISTEN；`ps` PID `2559650` 启动于 13:39 | `make debug-stop`（**不要**用 kill）；确认 `ss -ltn \| grep 8888` 无输出 |
| 生产 pipx `peekview serve`（`:8080`，PID `1583302`） | `ps` 显示，启动于 9月29 | ⚠️ **用户正式服务，严禁触碰/停止**（AGENTS 铁律 2） |
| 用户 MCP `peekview-mcp serve`（PID `319`） | `ps` 显示，9月23 启动 | ⚠️ 用户常驻，不动 |
| Chrome CDP `:18800`（截图用，TPV0100 vision-reports 使用） | P6 vision-reports 存在（`vision-reports/bdd-29.yaml`）；当前 `ss` 未见 18800 监听（可能已停） | 如仍存活由用户环境管理；截图脚本已 `page.close()` + `process.exit(0)`，未 `browser.close()` |

### 5.2 临时文件/数据（**需清理**）

| 资源 | 状态 | 处理 |
|------|------|------|
| `/tmp/peekview-debug/`（debug 数据目录 + DB） | 存在 | `make debug-stop` 自动清理；或手动 `rm -rf /tmp/peekview-debug/` |
| `/tmp/peekview-debug.pid` / `/tmp/peekview-debug.log` | 存在 | 随 `debug-stop` 清理；确认残留则手动删 |
| `/tmp/e2e-results/`（E2E 输出） | 存在 | 手动 `rm -rf /tmp/e2e-results/` |
| `<项目根>/.agate-tmp/`（canonical 临时产物目录） | 存在，含 `debug-seed.log`/`debug-start.log`/`debug-stop.log`/`idem.json`/`pv-cookies.txt`/`validate_binary.mjs` | **已被 `.gitignore` 忽略**（`git check-ignore -q .agate-tmp` 通过 → ignored）。⚠️ 含 `pv-cookies.txt`（可能明文凭证）→ 收尾先删该目录内容：`rm -rf .agate-tmp/*`；自查 `ls -A .agate-tmp` 应为空。文件名不含测试收集模式 |
| `backend/peekview/static/**`（构建产物） | `make build-frontend` 产出 | 非临时——属发布分发产物，随 release commit 保留 |
| debug 用户/entry 数据（alice/bob/carol，testpass123） | 均在 `/tmp/peekview-debug/` 内 | 随 debug 数据目录一并清理；**未写入生产 `~/.peekview/`** |

### 5.3 开发安装/系统污染核查

| 项 | 状态 |
|----|------|
| venv 开发安装（`backend/.venv`） | 存在，属 `make dev` 正常隔离环境，**不影响 pipx**；无需卸载 |
| 系统 Python 污染 | **无**——未执行 `pip3 install --break-system-packages`；pipx `peekview`（`/home/kity/.local/bin/peekview`）完好 |
| 前端 `node_modules` | 存在，属常规开发依赖，保留 |
| 生产数据/API 写入 | **无**（`[PROD_NOT_TOUCHED]`）；未用 CLI `peekview create` 建测试 entry；测试 entry 仅经 debug `:8888` HTTP API |

### 5.4 收尾检查命令（主 Agent 实跑，不可凭记忆打勾）

```bash
# 服务已停 + 端口释放
ps aux | grep -E "uvicorn.*8888" | grep -v grep    # 期望：空
ss -ltn | grep -E ":8888" && echo "STILL LISTENING" || echo "8888 released"
# 临时数据已删
ls -d /tmp/peekview-debug /tmp/peekview-debug.pid /tmp/e2e-results 2>/dev/null || echo "tmp cleaned"
ls -A .agate-tmp 2>/dev/null || echo "agate-tmp empty/absent"
# 工作区干净（bump + commit + tag 之后）
git status --short
git tag --list | tail -1
```

---

## 6. 主 Agent 后续执行清单（releaser **不执行**）

1. P8 gate 通过（`check-gate.py P8 $TASK_DIR`）
2. **提交前暂存面审查**（DEBT0017 提示）：`git diff --cached --name-only` 过目不无意外路径
3. `make bump-version NEW_VERSION=0.26.0`（Step 4 `git add -A` + commit + tag `v0.26.0`）
4. 填 CHANGELOG（§2 文本），`git add CHANGELOG.md && git commit --amend --no-edit`
5. 按 gate 规则：P5 验证复用/重跑（`check-p6-provenance.py --audit7-only`），注意 CHECK 7 时序（先 tag 后重跑）
6. READY 收尾：按 §5 清理临时资源 + `git add agate-workspace/tasks/TPV0100-web-publish/`（phase 保持 READY）
7. `make publish`（PyPI，token 在 `~/.bash_env`）+ `git push && git push origin v0.26.0`
8. 生产升级（**必须人工**）：`pipx upgrade peekview && sudo systemctl restart peekview`

> 无 RM 条目需回写（无 `agate-workspace/roadmap/roadmap.md`）。
