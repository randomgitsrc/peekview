# 文档重构与归档评审

> 评审日期：2026-06-11
> 评审对象：HEAD~4..HEAD（5个提交）
> 评审团：标准化评审 + 技术评审
> 前置评审：`expert-review-current-state-2026-06-10.md`、`gstack-review-mcp-version-desync.md`

---

## 评审结论

本轮 5 个提交对项目文档体系进行了大幅重构：EXPERTS.md 按产品/评审双会话重写、新增两阶段会话启动模板、归档 28 个过时文档、更新版本号。**核心问题是版本号同步不彻底**——`d873f85a` 声称更新版本号，但仅修改了 OPENCODE.md 和 product_session.md，review_session.md、EXPERTS.md、INDEX.md、CLAUDE.md 中的版本号仍停留在旧值。此外，CLAUDE.md 自 `b89bedbe`（MCP v0.8.3 bump）以来始终未更新 MCP 版本声明。

结论：**需修改后重审**。阻塞项为 4 处版本号不一致，均为纯文档修改，工作量 < 10 分钟。

---

## 一、版本号一致性

### 发现 1（🔴 高危）：`review_session.md` 版本号陈旧

**位置**：`docs/converse/review_session.md:11-12`

**现象**：
```
- **版本**：Backend v0.1.45 | MCP v0.8.2
- **阶段**：MCP local/remote 双模实现中
```
实际版本为 Backend v0.1.52 / MCP v0.8.3，阶段为「稳定维护中」。

**机理分析**：review_session.md 在 commit `1292463c` 创建时写入 v0.1.45/v0.8.2，后续 commit `d873f85a` 批量更新版本号时遗漏了此文件。product_session.md 在同一 commit 中被更新，说明这是手动逐个文件更新时的遗漏。

**影响**：评审专家启动时会看到错误的项目状态信息，误认为项目仍处于 MCP 双模开发阶段，可能导致评审焦点偏移。

**整改建议**：
```markdown
- **版本**：Backend v0.1.52 | MCP v0.8.3
- **阶段**：稳定维护中
```

**验证方式**：
- [ ] `grep -n "v0.1.45\|v0.8.2" docs/converse/review_session.md` 应无输出

---

### 发现 2（🔴 高危）：`EXPERTS.md` 产品经理节版本号陈旧

**位置**：`EXPERTS.md:35-36`

**现象**：
```
- 版本：Backend v0.1.45 | MCP v0.8.2
- 阶段：MCP local/remote 双模实现中
```
与 review_session.md 问题完全相同——commit `d873f85a` 批量更新时遗漏。

**整改建议**：同上，更新为 v0.1.52 / v0.8.3 / 稳定维护中。

**验证方式**：
- [ ] `grep -n "v0.1.45\|v0.8.2" EXPERTS.md` 应在该位置以外无输出（评审组长节中的 v0.8.2 为示例版本号，无需修改）

---

### 发现 3（🟡 中危）：`CLAUDE.md` MCP 版本声明滞后

**位置**：`CLAUDE.md:9-10,156-157,166`

**现象**：CLAUDE.md 共 4 处声明 MCP 版本为 v0.8.2，但实际 MCP Server 已在 `b89bedbe` bump 至 v0.8.3。注意这是独立于本轮变更的预存问题——v0.8.3 bump 发生在 commit `b89bedbe`，早于本轮变更；但 `d873f85a` 更新 CLAUDE.md 时（只改了归档路径）也未顺手修正。

**具体行号**：
| 行 | 当前 | 应为 |
|----|------|------|
| 9 | `MCP Server v0.8.2 (Streamable HTTP transport) has been released to npm` | `v0.8.3` |
| 10 | `MCP Server v0.8.2` | `v0.8.3` |
| 156 | `### MCP Server Architecture (v0.8.2)` | `(v0.8.3)` |
| 166 | `MCP Server v0.8.2 requires` | `v0.8.3` |

**整改建议**：将 CLAUDE.md 中所有 `v0.8.2` 替换为 `v0.8.3`（共4处）。

**验证方式**：
- [ ] `grep -n "v0.8.2" CLAUDE.md` 应无输出
- [ ] `grep -n "v0.8.3" CLAUDE.md` 应有 4 处匹配

---

### 发现 4（🟡 中危）：`INDEX.md` MCP 版本滞后

**位置**：`INDEX.md:4`

**现象**：
```
> 当前版本：v0.1.52（Backend/Frontend）| MCP Server v0.8.1
```
MCP 应为 v0.8.3。INDEX.md 是项目入口文档，版本错误影响最大。

**整改建议**：`MCP Server v0.8.1` → `MCP Server v0.8.3`

**验证方式**：
- [ ] `grep "v0.8.1" INDEX.md` 应无输出

---

## 二、归档正确性

### 通过项

| 检查项 | 结论 |
|--------|------|
| 11 个 plans 从 `docs/plans/` → `docs/archived/plans/` | ✅ 通过，纯 git mv |
| 17 个 specs 从 `docs/specs/` → `docs/archived/specs/` | ✅ 通过，已存在于 archived 的为删除 |
| `docs/specs/spec-remote-cli.md` 删除 | ✅ 通过，`docs/archived/specs/` 已有副本 |
| `docs/specs/spec-user-auth.md` 删除 | ✅ 通过，`docs/archived/specs/` 已有副本 |
| `docs/specs/spec-mcp-file-path-design.md` 删除 | ✅ 通过，归档后微调了4行（路径引用） |
| CLAUDE.md 引用路径更新（`docs/specs/` → `docs/archived/specs/`） | ✅ 通过 |
| `docs/active-tasks.md` 快速入口路径更新 | ✅ 通过 |
| `INDEX.md` 文档清单中 docs/specs/ → docs/archived/specs/ 路径更新 | ✅ 通过 |

### 潜在问题

### 发现 5（🟢 低危）：INDEX.md 文档清单删除后链接断裂

**位置**：`INDEX.md:116-122`

**现象**：INDEX.md 的「规格文档」表中的链接已更新为 `docs/archived/specs/`。但 `docs/converse/` 下新增的 `product_session.md` 和 `review_session.md` 未在 INDEX.md 文档清单中出现。

**影响**：无功能影响，但 INDEX.md 作为「项目文档完整索引」不完整。

**建议**：在 INDEX.md 中新增「会话模板」条目，指向 `docs/converse/product_session.md` 和 `docs/converse/review_session.md`。

---

## 三、文档重构质量

### 通过项

| 检查项 | 结论 |
|--------|------|
| 角色职责划分（产品/评审双会话） | ✅ 清晰 |
| 各角色包含输入/输出格式模板 | ✅ 实用 |
| 评审报告模板包含位置/现象/机理分析/整改建议/验证方式 | ✅ 完善 |
| 评审铁律（只读、落盘、提交） | ✅ 明确 |
| opencode 可用工具集成（peeklink_*） | ✅ 有效 |
| product_session.md 版本号当前 | ✅ v0.1.52 / v0.8.3 |
| OPENCODE.md 版本号已更新 | ✅ |

### 问题

### 发现 6（🟢 低危）：`EXPERTS.md` 保留已被删除的角色

**位置**：`EXPERTS.md` 原文件中的「配置管理员+文档管理员」角色

**现象**：重构前 EXPERTS.md 含「配置管理员+文档管理员」角色（包含版本检查、CHANGELOG 同步、Git 规范等）。重构后该角色被移除，其职责被分散到「文档工程师」和「标准化评审」中。但 `check-changelog` 命令在新的「标准化评审」角色中引用，而其定义在 Makefile 中需要确认是否存在。

**机制分析**：角色拆分合理——产品会话的「文档工程师」管文档编写，评审会话的「标准化评审」管文档审计。但职责交接不应导致工具引用断裂。

**验证**：
- [ ] `make check-changelog` 是否可用
- [ ] `make doc-checklist` 是否可用

---

## 四、CLAUDE.md 修改审查

### 发现 7（🟢 低危）：CLAUDE.md 「Essential Documentation」三行路径变更

**位置**：`CLAUDE.md:233-236`

**变更**：
```diff
-- **Auth Spec:** `docs/specs/spec-user-auth.md`
-- **Remote CLI Spec:** `docs/specs/spec-remote-cli.md`
-- **MCP Dual Mode Plan:** `docs/plans/mcp-dual-mode-final-v0.7.md`
+- **Auth Spec:** `docs/archived/specs/spec-user-auth.md`
+- **Remote CLI Spec:** `docs/archived/specs/spec-remote-cli.md`
+- **MCP Dual Mode Plan:** `docs/archived/plans/mcp-dual-mode-final-v0.7.md`
```

**分析**：路径更新正确，与归档操作一致。但文档目标已全部实现（Auth v0.1.25, Remote CLI v0.1.25, MCP Dual Mode v0.7.0），标记为"归档"但保留在 Essential Documentation 中略显矛盾——用户可能会困惑为何归档文档仍是"必读"。

**建议**：将这些条目从 "Essential Documentation" 移到 "Archived References" 小节，或保持现状并加注"（已实现，仅供参考）"。

---

## 评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 版本号一致性 | 5/10 | 4 处版本号滞后（review_session, EXPERTS, CLAUDE, INDEX） |
| 归档正确性 | 9/10 | 28个文件归档逻辑正确，路径引用已更新 |
| 会话模板质量 | 9/10 | 结构清晰，职责明确，模板实用，版本号是唯一瑕疵 |
| 文档同步完整性 | 6/10 | 批量更新遗漏3个文件，INDEX 缺新文件入口 |
| 整体 | 7/10 | 重构质量高，但版本号同步是这类变更的基础要求 |

## 待办

### 阻塞项（合并前必须修）
- [ ] `docs/converse/review_session.md:11` — v0.1.45→v0.1.52, v0.8.2→v0.8.3, 阶段→稳定维护中
- [ ] `EXPERTS.md:35-36` — v0.1.45→v0.1.52, v0.8.2→v0.8.3, 阶段→稳定维护中
- [ ] `INDEX.md:4` — v0.8.1→v0.8.3
- [ ] `CLAUDE.md` — 4 处 v0.8.2→v0.8.3

### 建议项
- [ ] `INDEX.md` 新增 `docs/converse/` 下的会话模板入口
- [ ] CLAUDE.md Essential Documentation 标注归档文档"（已实现，仅供参考）"

---

## 附录：版本号分布热图

```
                    v0.1.45  v0.1.52  v0.8.1  v0.8.2  v0.8.3
backend/__init__.py    ─        ✅       ─       ─       ─
pyproject.toml         ─        ✅       ─       ─       ─
mcp/package.json       ─        ─       ─       ─       ✅
CLAUDE.md              ─        ✅      ─       ❌       ─
OPENCODE.md            ─        ✅      ─       ─       ✅
product_session.md     ─        ✅      ─       ─       ✅
review_session.md      ❌        ─      ─       ❌       ─
EXPERTS.md (PM)        ❌        ─      ─       ❌       ─
INDEX.md               ─        ✅      ❌       ─       ─
improvement-backlog    ─        ✅      ─       ─       ✅
active-tasks.md        ─        ✅      ─       ─       ✅
```
