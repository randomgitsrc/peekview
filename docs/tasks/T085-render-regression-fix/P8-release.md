---
phase: P8
task_id: T085-render-regression-fix
type: release
parent: P7-consistency.md
trace_id: T085-P8-20260802
status: draft
created: 2026-08-02
agent: implementer
---

# P8 发布准备 — T085 详情页渲染回归修复

## 1. 版本 bump 判定

```yaml
bump_type: patch
current_version: 0.14.0
new_version: 0.14.1
package: peekview (frontend-v3)
```

**理由**：修复 5 个渲染缺陷（bug fix），不改 API 行为，不新增功能。P2 声明的 packages 为 `frontend-v3` + `frontend-v3-e2e`，均属前端包，不涉及 MCP Server 版本变更。

## 2. P2 packages 声明 vs 实际改动

**P2§packages**（行 178-181）：`frontend-v3`, `frontend-v3-e2e`

**实际改动文件**（P7 §3.1 确认）：

| 文件 | 改动 | P2 声明 |
|------|------|---------|
| `frontend-v3/src/composables/useEntryDetailComputed.ts` | 新增 isSvg computed + isRichRenderable 排除 SVG | ✅ |
| `frontend-v3/src/components/EntryDetailContent.vue` | 调度链 (isXml && !isSvg) + content-area overscroll-behavior | ✅ |
| `frontend-v3/src/views/EntryDetailView.vue` | 传递 isSvg prop | ✅ |
| `frontend-v3/src/styles/code.css` | .code-body 恢复 flex:1 + min-height:0 | ✅ |
| `frontend-v3/src/components/MarkdownViewer.vue` | .markdown-body scoped padding 恢复 | ✅ |
| `frontend-v3/src/styles/markdown.css` | 全局 padding 移动端 media query | ✅ |
| `frontend-v3/src/composables/useResponsiveLayout.ts` | setupScrollHide 边界保护 | ✅ |
| `frontend-v3/src/components/TableView.vue` | per-page 原生 select 改自定义下拉组件 | ✅ |
| `frontend-v3/src/components/EntryDetailHeader.vue` | .meta-tags-bar v-if→v-show（P5 fix 衍生） | ⚠️ P4 未声明，P7 WARNING 非阻塞 |
| `frontend-v3/e2e/render-regression.spec.ts` | T085 11 BDD E2E 验收（新增） | ✅ |
| `frontend-v3/e2e/structured-data-viewer.spec.ts` | BDD-19/20 改真实点击 | ✅ |
| `frontend-v3/src/components/__tests__/TableView.spec.ts` | 现有测试适配自定义下拉 | ✅ |
| `frontend-v3/src/components/__tests__/TableView.per-page.spec.ts` | per-page 自定义下拉单测 | ✅ |
| `frontend-v3/src/composables/__tests__/useEntryDetailComputed.svg.spec.ts` | SVG 调度链单测 | ✅ |
| `frontend-v3/src/composables/__tests__/useResponsiveLayout.boundary.spec.ts` | 边界保护单测 | ✅ |
| `frontend-v3/src/composables/__tests__/useResponsiveLayout.spec.ts` | 现有测试适配（P5 fix 衍生） | ⚠️ P4 未声明，P7 WARNING 非阻塞 |
| `backend/peekview/static/index.html` | 构建产物（make build-frontend 自动生成） | 非源码 |

**一致性判定**：P2 packages 与实际改动范围一致。2 个 WARNING（P4 改动清单遗漏 EntryDetailHeader.vue + useResponsiveLayout.spec.ts）均为 P5 fix 衍生，不超出 P2 方案，不阻碍发布。

## 3. MCP Server 版本

```yaml
mcp_bump: false
reason: T085 不涉及 MCP Server 改动（P0-brief §6 明确声明"不改 MCP Server"）
```

## 4. CHANGELOG 更新

CHANGELOG.md 新增 `[0.14.1]` 段（在 `[0.14.0]` 之前）：

```markdown
## [0.14.1] - 2026-08-02

### 修复

- SVG 文件恢复图片预览渲染（T084/T075 调度链回归修复）(T085)
- 源码视图竖向滚动恢复（.code-body flex:1 + min-height:0 恢复）(T085)
- Markdown 渲染视图边距恢复（scoped padding 32px/16px）(T085)
- 滚动到底端抖动修复（overscroll-behavior + 边界保护）(T085)
- TableView per-page 下拉框改自定义组件 + 真实点击验证（修复选不中）(T085)
```

**CHANGELOG 更新确认**：✅ 已写入 CHANGELOG.md

## 5. 发布检查命令

> releaser subagent 不执行 bump-version / git commit / git tag。以下命令供主 Agent gate 验证参考。

```bash
# P5 重跑（gate_commands.P5）
cd frontend-v3 && npx vitest run --reporter=dot 2>&1 | tail -30
cd frontend-v3 && npx vue-tsc --noEmit
cd frontend-v3 && npm run build

# E2E（P6 已验证 11/11 PASS）
E2E_SPEC=e2e/render-regression.spec.ts make debug-test

# 版本一致性检查
make check-version

# CHANGELOG 检查
make check-changelog
```

**P5 已知结果**（P5-test-results/frontend-unit.md）：
- vitest: 1198 passed / 1 skipped / 0 failed — exit 0
- vue-tsc: 0 errors — exit 0
- build: success — exit 0
- E2E: P6 验收 11/11 PASS（CDP 实跑 + vision）

## 6. 版本号变更确认

| 文件 | 当前版本 | 目标版本 | 状态 |
|------|---------|---------|------|
| `VERSIONS.json` → peekview | 0.14.0 | 0.14.1 | 待主 Agent 执行 `make bump-version NEW_VERSION=0.14.1` |
| `backend/peekview/__init__.py` | 0.14.0 | 0.14.1 | 同上（bump-version 自动同步） |
| `backend/pyproject.toml` | 0.14.0 | 0.14.1 | 同上 |
| `frontend-v3/package.json` | 0.14.0 | 0.14.1 | 同上 |

**注意**：releaser subagent 不执行 `make bump-version`——主 Agent 在 P8 gate 通过后亲自执行。

## 7. 临时资源清单

> 供主 Agent READY 收尾检查参考。

```yaml
临时服务:
  - debug backend :8888（make debug-quick 启动，独立数据目录 /tmp/peekview-debug/）
  - CDP Chrome :18800（P6 验收期间使用，Windows GPU 远程 Chrome）

临时数据:
  - /tmp/peekview-debug/peekview.db（调试数据库，含 seed-data + t085-large-csv 测试 entry）
  - /tmp/peekview-debug/（文件存储目录）

开发安装:
  - 无（T085 纯前端改动，未新增 editable install 或全局包安装）

生产环境:
  - [PROD_NOT_TOUCHED]
```

## 8. git log 对照（v0.14.0..HEAD）

```
9521d85c T085 P7: 一致性检查通过
be75f22e T085 P6: BDD 验收 11/11 PASS
397d4147 T085 P5: 技术验证 vitest 1198 passed + E2E 推 P6
19316ad4 T085 P4: 代码实现 + design-review approved
7de9efc3 T085 P3: TDD 测试设计 11 BDD 红灯
4359a972 T085 P2: 方案设计 + plan-design-review approved
83285e03 T085 P1: 需求基线 11 BDD + review approved
3590f6f0 T085 P0: 新增 P5 — TableView per-page 下拉框问题
69943f32 docs: AGENTS.md 调试流程去掉写死的 seed 条目数
3f0725de docs: 更新调试流程文档（debug-quick + seed-data 20 entry）
747e785c T085 P0 立项: 详情页渲染回归修复 + make debug-quick + seed-data 丰富
ddbe9781 refactor: seed-debug 改为从 seed-data/ 目录加载样例文件
96406aff T075 DONE: structured-data-viewer v0.14.0 发布完成
```

CHANGELOG 5 条修复条目与 git log 的 T085 P4 代码实现 commit（19316ad4）对应。P0-P3 为 agate 流程产出（文档），P5-P7 为验证产出，不含代码改动。bump-version 后主 Agent 的 commit + tag 将覆盖版本文件变更。

## 9. Lessons Learned

1. **E2E selectOption 绕过真实交互**（测试类别）：Playwright `selectOption()` 程序化设置 select 值绕过真实点击，导致原生 select 在 CDP Chrome 下"选不中"的缺陷在 53 BDD 验收中未暴露。教训：涉及 UI 交互组件的验收必须用真实 `click()` 流程（点击→弹出→点击选项），不可用程序化方法绕过。（来源：T085，2026-08-02）

2. **调度链双维度混用易回归**（架构类别）：前端调度链同时用 language（isXml/isCsv）和 mime（isImage）两个维度判断渲染分支，新增 isXml computed 时未考虑 SVG 同时满足 isXml 和 isImage，导致 SVG 被 isXml 截获。教训：新增 computed 时必须检查与已有 computed 的交叉关系，尤其是不同判断维度（language vs mime）的重叠区。（来源：T085，2026-08-02）

3. **T084 滚动架构重构的隐性回归**（流程类别）：T084 移除 .code-body 的 flex:1/min-height:0 和 MarkdownViewer 的 scoped padding 时，53 BDD 验收未覆盖"源码视图滚动到底"和"Markdown 边距测量"两个场景，导致回归未被捕获。教训：架构重构移除 CSS 属性时，必须识别该属性的所有依赖路径（fallback 路径、切换路径、移动端路径）并补充 BDD。（来源：T085，2026-08-02）

## 10. SCOPE_GAP 检查

对照 P2-design.md packages 声明（`frontend-v3`, `frontend-v3-e2e`）与本次 dispatch-context：dispatch-context 要求处理 frontend-v3 的 CHANGELOG + 版本 bump，无遗漏。MCP Server 无改动，不需 bump。无 [SCOPE_GAP]。

## 11. DESIGN_GAP 检查

P7 已确认：P4 的 1 条 DESIGN_GAP 已 REVIEWED（旧测试断言已移除的 select.per-page-select，按 P2 改动清单更新为真实点击流程）。P5 的 1 条 DESIGN_GAP 为误诊（测试数据实际是 300 行 CSV，非 150 行）。无未决 DESIGN_GAP。

---

status: ready

releaser subagent 产出完成。P8-release.md + CHANGELOG.md [0.14.1] 段已就绪。待主 Agent 执行 P8 gate 验证 → `make bump-version NEW_VERSION=0.14.1` → commit + tag。
