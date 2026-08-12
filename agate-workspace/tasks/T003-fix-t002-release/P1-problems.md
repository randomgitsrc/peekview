---
phase: P1
task_id: T003-fix-t002-release
parent: T002 发布准备未完成
trace_id: T003-P1-20260612
---

# P1 问题定义 — T002 发布准备收尾

## 任务背景

T002（数据库迁移机制修复）的代码实现和测试已全部通过，CHANGELOG 已更新至 v0.1.53。但发布准备流程未完成：P7 gate（`make pre-publish-quick`）从未执行，文档中版本引用未同步，PyPI 仍为 v0.1.52。本任务完成 T002 的剩余发布准备步骤。

## 当前状态

| 检查项 | 状态 | 详情 |
|--------|------|------|
| `__init__.py` `__version__` | 0.1.53 | 已修复（复盘后手动同步） |
| `pyproject.toml` `version` | 0.1.53 | T002 P7 已更新 |
| CHANGELOG.md v0.1.53 条目 | 存在 | 含数据库迁移修复说明 |
| `make pre-publish-quick` | 未执行 | P7 gate 缺失，发布就绪性未验证 |
| INDEX.md 版本引用 | v0.1.52 | 未同步 |
| CLAUDE.md 版本引用 | v0.1.52 | 未同步 |
| PyPI 最新版本 | v0.1.52 | 未发布 v0.1.53 |

---

## 问题 P1-1：P7 gate 未执行（发布就绪性未验证）

- **症状**：`make pre-publish-quick` 从未在 T002 完成后执行。无法确认 lint + test 在最新代码上通过。
- **根因**：T002 P7 subagent 只写了 CHANGELOG 和 bump 了 pyproject.toml，主 Agent 未按 P7 gate 定义执行 `make pre-publish-quick` 验证。postmortem A3 指出 P7 gate 当年定义是"P7-release.md 存在"而非跑命令。
- **影响**：无法保证 v0.1.53 代码就绪可发布——可能存在 lint 失败或回归测试失败。
- **验收标准**：
  - **Given** backend/ 目录在 v0.1.53 状态
  - **When** 执行 `make pre-publish-quick`
  - **Then** exit 0（lint 通过 + pytest 全绿）

---

## 问题 P1-2：文档版本引用未同步

- **症状**：INDEX.md（第 4 行）和 CLAUDE.md（第 10 行）仍引用 v0.1.52，与 pyproject.toml 中的 0.1.53 不一致。
- **根因**：`make bump-version` 流程只更新了 `__init__.py` 和 `pyproject.toml`，未覆盖 INDEX.md 和 CLAUDE.md 中的版本字符串。`release.md` 发布流程未将这些文件纳入版本同步检查清单。
- **影响**：开发者/Agent 阅读项目索引和约定文件时获得过期版本号，造成混淆。
- **验收标准**：
  - **Given** v0.1.53 为当前版本
  - **When** 搜索 `INDEX.md` 和 `CLAUDE.md` 中的版本号
  - **Then** 两文件中的版本引用均为 `0.1.53`

---

## 问题 P1-3：未发布到 PyPI

- **症状**：`pip install peekview` 安装的是 v0.1.52，v0.1.53 的数据库迁移修复对最终用户不可用。
- **根因**：T002 P7 完成但 `make publish` 从未执行。postmortem A3 确认 P7 应定义为"发布准备"而非"已发布"，发布由人手动触发。
- **影响**：用户运行 `peekview serve` 时可能遇到 CLI 与 Server 的迁移锁竞争问题（T002 要修复的问题）。
- **验收标准**：
  - **Given** P1-1 和 P1-2 已解决（pre-publish-quick 通过 + 文档同步）
  - **When** 人手动执行 `make publish`
  - **Then** PyPI 上 peekview 最新版本为 0.1.53，`pip install peekview==0.1.53` 成功

---

## 阶段声明

任务规模：小（发布准备收尾，改动 < 10 行 + 跑命令）。裁剪流程：

| 阶段 | 名称 | 说明 |
|------|------|------|
| P1 | 问题定义 | 本文件 |
| P4 | 实现 | 更新 INDEX.md/CLAUDE.md 版本号 + 执行 `make pre-publish-quick` 并修复发现的问题 |
| P5 | 验证 | 确认 pre-publish-quick exit 0、文档 grep 无 v0.1.52 残留、人手动 `make publish` 后 PyPI 更新 |

跳过 P2（无需方案设计）、P3（无需 TDD）、P6（改动范围极小，手动检查即可）。
