---
phase: P8
task_id: T075-structured-data-viewer
type: release
parent: P7-consistency.md
trace_id: T075-P8-20260801
status: draft
created: 2026-08-01
agent: implementer
---

# P8 发布准备 — T075 structured-data-viewer

## bump_type 判定

- **bump_type: minor**
- 理由：新增用户可见功能（结构化数据富渲染 + 统一切换机制 + 截断保护），非破坏性、向后兼容，符合语义化版本 minor 规则

## 版本号变更确认

| 包 | 当前版本 (VERSIONS.json) | 目标版本 | 是否 bump |
|----|--------------------------|----------|-----------|
| peekview (backend + frontend) | 0.13.1 | 0.14.0 | ✅ minor |
| mcp_server | 0.10.0 | — | ❌ 无改动不 bump |

- frontend 是内部构建（static 内嵌），版本源是 VERSIONS.json 的 peekview 字段，不独立 bump
- P2-design.md `packages:` 声明 = [backend, frontend]，与上述一致，MCP server 不在范围内

## CHANGELOG 更新确认

- [x] 新增 `## [0.14.0] - 2026-08-01` 段（原无 [Unreleased] 段，直接落版本段）
- [x] 记录 T075 改动：TableView（CSV/TSV 富渲染）、TreeView（JSON/YAML/XML 树视图）、源码/渲染统一切换机制、截断保护、.tsv 映射修复、解析失败降级、新增依赖 @tanstack/vue-table + js-yaml
- [x] 版本段置于 CHANGELOG 顶部（Keep a Changelog 规范），`[Unreleased]` 未创建（由后续任务建立）

## 发布检查命令（主 Agent P8 gate 执行，来自 P2-design.md gate_commands）

```bash
make test-quick                          # 后端 pytest 全绿（63 passed test_language.py）
cd frontend-v3 && npx vitest run --reporter=dot 2>&1 | tail -30   # 前端 1177 passed
cd frontend-v3 && npx vue-tsc --noEmit   # 类型检查 0 errors
cd frontend-v3 && npm run build          # Vite 构建
E2E_SPEC=e2e/structured-data-viewer.spec.ts make debug-test       # E2E 84/84
make lint                                # ruff
```

## 临时资源清单

本任务执行期间启动/创建的临时资源（主 Agent READY 收尾时按此清单清理）：

| 类别 | 资源 | 说明 |
|------|------|------|
| 临时服务 | debug backend :8888 | `make debug-start`（独立数据目录 /tmp/peekview-debug/），E2E/验收后需 `make debug-stop` 停止 |
| 临时数据 | debug 数据库 /tmp/peekview-debug/peekview.db | debug seed 数据（alice/bob/carol + 12 条目）+ T075 E2E 17 个测试 entry（t075-*），随 `make debug-stop` 清理 |
| 临时数据 | /tmp/peekview-debug/ 目录 | 由 debug-stop 移除 |
| 依赖安装 | frontend-v3 npm 依赖 @tanstack/vue-table@^8.21.3 + js-yaml@^4.3.1 + @types/js-yaml@^4.0.9 | 已提交 package.json/package-lock.json，属正式依赖非临时安装，无需卸载；`make dev` 同步 venv |
| 外部进程 | CDP Chrome :18800 | 常驻浏览器自动化服务，不属于本任务启动，无需清理 |

- 生产环境：未触碰（P6 验收 [PROD_NOT_TOUCHED]，仅访问 debug :8888 + CDP :18800）
- 环境状态标记：`[PROD_NOT_TOUCHED]` — 本任务仅读写任务产出文件 + CHANGELOG.md，未启动任何服务、未触碰生产 :8080 / ~/.peekview/

## Lessons Learned

1. **测试断言数字易在传递链中失真**（架构/流程）：P3 测试作者在 TableView.spec.ts 写下的三条断言（BDD-12 th===3 / BDD-18 'alice' 2 行 / BDD-20 第 3 页 100 行）数学上不可能成立，直到 P6 验收才发现。教训：跨阶段传递的量化断言（行数/列数/页数）必须用「生成器 + 可推导断言」而非手写魔数，或由 P6 提前对拍源数据。已通过 test-designer specfix 修正，P7 G1 闭环。
2. **e2e.spec.ts 单测副本 + 正式 spec 双源同步容易漂移**（流程）：P3-test-code/ 与 frontend-v3 实际位置两处副本，E2E 版 BDD-18/20 计数与单测版不同源修复。教训：测试文件双副本需建立 diff 检查（P7 已执行，逐文件 diff IDENTICAL），或后续任务改为单源生成。
3. **@types/js-yaml 为编译必需补充依赖**（流程）：js-yaml@4.3.1 无内置类型，P2§3.12 只声明运行时依赖，P4 实现时追加 @types/js-yaml@^4.0.9（vue-tsc TS6133 触发的链式发现）。教训：TS 项目的第三方依赖评估必须同时检查类型包，P2 阶段应纳入依赖声明。

## 未执行操作（主 Agent 负责）

- [ ] `make bump-version NEW_VERSION=0.14.0`（同步 VERSIONS.json + 所有文件 + commit + tag）— 主 Agent gate 通过后执行
- [ ] 将 [0.14.0] 提交 + 创建 tag v0.14.0
- [ ] 发布（make pre-publish-quick + make publish）按 release.md 标准流程
- [ ] CHANGELOG 后处理：bump 后 `[0.14.0]` 段保留，后续任务重新建立 `[Unreleased]` 段

## 门槛核对

- [x] P8-release.md 存在且含 bump_type: minor
- [x] CHANGELOG.md 新增 [0.14.0] 段（含 T075 改动：TableView/TreeView/切换机制/截断/tsv 修复/依赖）
- [x] 临时资源清单完整（debug 服务、seed 数据、npm 依赖）
- [x] Lessons Learned 3 条
- [x] 未执行 git commit / git tag / make bump-version
