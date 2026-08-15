---
phase: P8
task_id: TPV0092-mcp-get-entry-fetch
type: release
parent: P7-consistency.md
trace_id: TPV0092-P8-20260815
status: draft
created: 2026-08-15
agent: implementer
# ── v2.0 机器字段 ──
bump_type: minor
debt_check: reviewed
---

# P8 发布准备 — TPV0092 MCP get_entry 直接读取任意 PeekView 链接

发布判定基于：P2-design.md §0/packages 声明 `[backend, packages/mcp-server]` + P7-consistency.md（BLOCKER=0，DESIGN_GAP 配对闭环，SCOPE+ 无）。

状态标记：`[PROD_NOT_TOUCHED]` — 全程只读 + 产出文件，未触碰 :8080 生产 / ~/.peekview/，未执行任何 git commit / tag / bump 命令。

## 1. bump 判定

```yaml
bump_type: minor
packages:
  - name: peekview
    old: 0.19.0
    new: 0.20.0
    bump: minor
    reason: 后端 raw 端点新增 ?share=/?purify= 可选 query 参数（向后兼容非破坏，缺省行为不变 BDD-24）
  - name: @peekview/mcp-server
    old: 0.10.0
    new: 0.11.0
    bump: minor
    reason: get_entry 扩展为任意 URL 读取 + 结构化 JSON 返回 + publish_files 追加 Raw URL（向后兼容，raw 参数可选）
```

- 双包均 minor：新增功能，非破坏性（raw 参数可选、publish_files 追加字段）。get_entry 返回结构变化为向后兼容扩展（裸 slug 语义保留，BDD-4），P0/P1 已确认接受。
- 版本源：`VERSIONS.json`（peekview 0.19.0 / mcp_server 0.10.0），`backend/peekview/__init__.py` `__version__ = "0.19.0"`、`packages/mcp-server/package.json` `"version": "0.10.0"` 均与版本源一致。

## 2. 双包版本变更确认

| 包 | 当前版本 | 目标版本 | 变更来源（git log） |
|----|----------|----------|---------------------|
| peekview | 0.19.0 | **0.20.0** | v0.19.0..HEAD 全部为 TPV0092 工作流 commit（P1-P7，12 个，无其他任务混入） |
| @peekview/mcp-server | 0.10.0 | **0.11.0** | 同上（本任务同时改 MCP，tag 需独立创建 `mcp-v0.11.0`） |

`git log v0.19.0..HEAD --oneline` 共 12 条：TPV0092 P1（eea42aa1）→ P7（4adbb28b），含 P6 基础设施 commit 11054c25（Makefile debug-extra + dev-server.sh PORT 参数化）。无 v0.19.0 之后的其他任务提交，CHANGELOG [Unreleased] 只挂 TPV0092 无遗漏风险。

## 3. 发布检查命令（主 Agent gate 亲自执行）

从 P2-design.md §5 与 project.md 读取，bump 后重跑：

| 命令 | 用途 | 预期 |
|------|------|------|
| `make test-quick` | 后端 pytest | 全绿（P5 基线 1091 passed，bump 不改代码应保持） |
| `make test-mcp-unit` | MCP 单元 | 全绿（268 passed） |
| `make typecheck && make lint` | 前端类型 + lint | 0 error（CI 强制） |
| `make pre-publish-quick` | 快速发版检查 | exit 0 |
| `make pre-publish-npm` | MCP 发版检查 | exit 0 |

## 4. CHANGELOG 更新建议（主 Agent bump 后执行）

当前 `CHANGELOG.md` 第 8-9 行 `## [Unreleased]` 为空。bump 后需将 [Unreleased] 移至两节（peekview `## [0.20.0]` + mcp-server `## [mcp-v0.11.0]`），建议内容：

```markdown
## [0.20.0] - 2026-08-15

### 新增

- 后端 raw 端点 `GET /api/v1/entries/{slug}/raw` 新增可选参数 `?share={token}`（私有 entry 一次访问即返回，不设 cookie，无效 token 404，BDD-21/22）与 `?purify=true`（base64 图片替换为占位符 `[image: alt (KB, base64)]`，BDD-23）；缺省行为与改动前完全一致（BDD-24）(TPV0092)
- 净化纯函数 `services/purify.py`：Markdown/HTML 形态 base64 图片 → 占位符，普通文本零误伤 (TPV0092)

## [mcp-v0.11.0] - 2026-08-15

### 新增

- `get_entry` 扩展：接受任意 PeekView 链接（页面链接 / raw 长链接 / raw 短链接 / 分享链接 / 裸 slug），匿名直读 raw 返回净化后结构化 JSON（slug/summary/tags/files + 可选 warning）；跨 host 读取不携带配置实例凭据；非 PeekView 响应/非白名单协议请求前拒绝（SSRF 防护）；可选 `file=` 参数取单个文件全量 (TPV0092)
- `publish_files` 返回文本追加 `Raw URL: {publicUrl}/api/v1/entries/{slug}/raw` (TPV0092)
```

## 5. debt_check

```yaml
debt_check: reviewed
items:
  - id: DEBT0004
    status: open
    task_id: TPV0092-mcp-get-entry-fetch
    note: 净化正则双实现（后端 purify.py + MCP purify.ts 兜底）可能漂移。本任务已登记且 P3 双端共用同一净化测试样例（closure_criteria 1 达成）；closure_criteria 2（老后端全部支持 ?purify= 后移除 MCP 兜底）待未来后端版本统一后处理，不阻断本次发布
  - id: DEBT0005
    status: open
    task_id: TPV0092-mcp-get-entry-fetch
    note: 前端移动端 FileTree e2e 3 例预存失败（非 TPV0092 引入，spec 自 v0.7.0 未改，P4 commit 未触碰 frontend-v3/）。已登记由前端任务跟进，不阻断本次后端/MCP 发布
```

结论：两笔债均为 `open`，本任务已按要求登记（DEBT0004 为 P2 创建、DEBT0005 为 P6 创建），均不威胁本次验收声明，不阻断发布。

## 6. 临时资源清单（主 Agent READY 收尾清理用）

本任务执行期间启动的临时服务/进程/数据/开发安装：

| 资源 | 状态 | 清理方式 |
|------|------|----------|
| debug backend :8888 | 运行中（PID 4180772，ps 已确认） | `make debug-stop` |
| extra 实例 :8889 | 运行中（PID 4179921，ps 已确认） | `make debug-extra-stop PORT=8889`（或 `make debug-stop` 不覆盖时手动 kill） |
| /tmp/peekview-debug/ | 调试数据目录（:8888） | 随 `make debug-stop` 清理 |
| /tmp/peekview-debug-8889/ + .log/.pid | 调试数据目录（:8889） | 随 `make debug-extra-stop` 清理；残留手工 `rm -rf` |
| /tmp/peekview-debug2/ | P6 跨 host 早期实例数据目录 | 手工 `rm -rf`（已无进程占用） |
| t094-p6-* entries + API key pv_QLpdLuMqffSan5nYMqhDOhA8D9851mGR | debug DB 内测试数据 | 随 /tmp/peekview-debug* 数据目录清理 |
| /tmp/pv8888-token.txt | alice token 临时文件 | 手工 `rm` |
| /tmp/peekview-debug*.log / /tmp/peekview-debug*.pid | 服务日志/pid | 随对应 stop 目标清理 |
| Chrome CDP :18800 | 外部常驻（Windows Chrome），非本任务启动 | **不清理** |

## 7. 主 Agent 发布步骤（P8 gate 通过后执行，releaser 不执行）

```bash
# 1. 双包 bump（注意顺序：先 peekview 再 mcp，两个 tag 独立）
make bump-version NEW_VERSION=0.20.0        # → tag v0.20.0
make bump-mcp-version NEW_MCP_VERSION=0.11.0 # → tag mcp-v0.11.0

# 2. 填 CHANGELOG（本文件 §4 建议内容），然后
git add CHANGELOG.md && git commit --amend --no-edit   # 对最后一个 bump commit

# 3. bump 后重跑 §3 检查命令 + P5 gate（make test-quick && make test-mcp-unit）
# 4. make pre-publish-quick + make pre-publish-npm 通过后
make publish && make publish-npm

# 5. 推送
git push && git push origin v0.20.0 && git push origin mcp-v0.11.0

# 6. 生产升级（⚠️ 必须人工）：pipx upgrade peekview && sudo systemctl restart peekview
```

## 8. Lessons Learned

1. **基础设施改动要随阶段 commit 及时纳入**（流程）：P6 新增的 Makefile `debug-extra` + dev-server.sh PORT 参数化在 P6 commit 41ad3182 时漏提，P7 才补 commit 11054c25。多实例跨 host 测试能力（:8889）在本任务反复用到，参数化固化为 make target 后复用成本大幅下降——基础设施改造应尽早固化，避免 P7 补位。来源：TPV0092，2026-08-15。
2. **双实现单点归位 + 兜底测试锚点**（架构）：净化主实现单点在后端 `?purify=`，MCP `purify.ts` 仅在老后端（不支持 ?purify=）触发。双端正则跨语言（Python/TS）漂移风险以 P3 共用同一组净化测试样例为契约锚点（DEBT0004 closure_criteria 1 达成）。单点归位 + 共用测试锚点是"双实现兜底"类设计最有效的收敛手段。来源：TPV0092，2026-08-15。
3. **安全边界：匿名字面不携带凭据 + 响应结构校验**（安全）：URL 形态读取一律匿名 fetch（无 Authorization，仅 `X-PeekView-Source: mcp`），凭据根本不进入外部请求；SSRF 防护用"协议白名单（http 仅 localhost）+ 响应结构校验（slug/summary/files 非空）"，非 PeekView 响应体不进错误消息。此模式对"Agent 读取任意链接"类能力可复用。来源：TPV0092，2026-08-15。

## 9. 门槛自检

- [x] P8-release.md 存在且非空
- [x] 含 bump_type: minor
- [x] 含 debt_check: reviewed（DEBT0004/0005）
- [x] 双包版本变更确认（0.19.0→0.20.0 + 0.10.0→0.11.0）
- [x] CHANGELOG 更新建议
- [x] 临时资源清单
- [x] `[PROD_NOT_TOUCHED]`
