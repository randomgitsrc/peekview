---
phase: P7
task_id: T070
type: consistency
parent: P6-acceptance.md
trace_id: T070-P7-20260725
status: draft
created: 2026-07-25
agent: architect
---

## 方向 1：设计→实现（逐项对照 P2-design.md）

### 1. CWD guard 修复（P2 §1 方案 A）

| P2 设计项 | 实现位置 | 一致性 |
|-----------|----------|--------|
| 条件：`isCwdRoot && !trustAllPaths && allowedPaths.length === 0` → 拒绝 | publishFiles.ts:344 | ✅ 一致 |
| 错误信息含两个原因（cwd 为根目录 + 未配置 allowed_paths） | publishFiles.ts:348-354 | ✅ 一致 |
| 3 种解决方案（配 allowed_paths / trust_all_paths / -w 非根目录） | publishFiles.ts:351-353 | ✅ 一致 |
| 诊断命令提示 `peekview-mcp config verify` | publishFiles.ts:354 | ✅ 一致 |
| 其余情况（有 allowedPaths 或 trustAllPaths）→ 放行到后续路径检查 | publishFiles.ts:357+ | ✅ 一致 |

### 2. allowed_paths 容错（P2 §1 方案 A）

| P2 设计项 | 实现位置 | 一致性 |
|-----------|----------|--------|
| `typeof raw === 'string' ? raw.split(':').filter(...) : Array.isArray(raw) ? raw : []` | merge.ts:83-85 | ✅ 一致 |
| filter 空字符串 `p.length > 0` | merge.ts:84 | ✅ 一致 |
| 结果 `paths.map(expandHome)` | merge.ts:86 | ✅ 一致 |

### 3. /health 增强（P2 §1 方案 A）

| P2 设计项 | 实现位置 | 一致性 |
|-----------|----------|--------|
| config 对象追加 `cwd: process.cwd()` | server.ts:259 | ✅ 一致 |
| config 对象追加 `mode: config.mode` | server.ts:260 | ✅ 一致 |
| config 对象追加 `allowed_paths: config.mode === 'local' ? config.allowedPaths : []` | server.ts:261 | ✅ 一致 |
| 只追加字段，不修改/删除现有字段 | server.ts:234-262 | ✅ 一致（source/path/peekview_url/public_url/api_key_configured 均保留） |

### 4. config list 增强（P2 §1 方案 A）

| P2 设计项 | 实现位置 | 一致性 |
|-----------|----------|--------|
| 追加 `runtime:` 节 | cli/config.ts:179-191 | ✅ 一致 |
| 显示 cwd | cli/config.ts:182 | ✅ 一致 |
| 显示 mode | cli/config.ts:183 | ✅ 一致 |
| 显示 allowed_paths（env-merged 最终值） | cli/config.ts:184 | ✅ 一致 |
| 调 mergeConfig 获取最终生效值 | cli/config.ts:180 | ✅ 一致 |
| try/catch 防止缺少必填配置时阻断 | cli/config.ts:186-191 | ✅ 一致 |
| 现有字段格式不变 | cli/config.ts:146-177 | ✅ 一致（peekview/server/logging 节格式未变） |

### 5. config verify 增强（P2 §1 方案 A）

| P2 设计项 | 实现位置 | 一致性 |
|-----------|----------|--------|
| 末尾追加 allowed_paths 可读性检查 | cli/config.ts:513-530 | ✅ 一致 |
| 逐路径 `fs.access(R_OK)` | cli/config.ts:520 | ✅ 一致 |
| 可读标 ✅，不可读标 ❌ 并设 allOk=false | cli/config.ts:521-524 | ✅ 一致 |
| mergeConfig 失败时 try/catch 跳过 | cli/config.ts:528-530 | ✅ 一致 |

### 6. publish_files 工具描述增强（P2 §3）

| P2 设计项 | 实现位置 | 一致性 |
|-----------|----------|--------|
| Docker 场景提示 | publishFiles.ts:311 | ✅ 一致 |
| 诊断命令提示 | publishFiles.ts:312 | ✅ 一致 |
| namespace 提示 | publishFiles.ts:313 | ✅ 一致 |
| 精炼，不超过 3 行 | publishFiles.ts:311-313 | ✅ 一致（3 行） |

### 7. mcp-server/README.md 文档修正（P2 §2）

| P2 设计项 | 实现位置 | 一致性 |
|-----------|----------|--------|
| L96 namespace 语义修正：删除"容器路径自动翻译"，改为"Agent 侧短路径别名，volume mount 必须同路径" | README.md:96-100, 365-369 | ✅ 一致 |
| L169 allowed_paths 格式区分：YAML 数组 vs 环境变量冒号分隔 | README.md:169 | ✅ 一致 |
| Docker Compose 示例修正：`node:20-alpine` + `npm install -g` | README.md:425-448 | ✅ 一致 |
| 新增 Docker 场景指引节（cwd=/ 问题、网络选择、volume mount 同路径原则、完整 Compose 示例） | README.md:470-536 | ✅ 一致 |

### 8. README.md（根）文档修正（P2 §2）

| P2 设计项 | 实现位置 | 一致性 |
|-----------|----------|--------|
| MCP 接入节增加 OpenCode 配置示例 | README.md:48-58 | ✅ 一致 |
| MCP 接入节增加 Cursor 配置示例 | README.md:60-71 | ✅ 一致 |
| 新增 Docker 场景简版指引（链接到 mcp-server/README.md） | README.md:85-87 | ✅ 一致 |

### 9. backend/README.md 文档修正（P2 §2）

| P2 设计项 | 实现位置 | 一致性 |
|-----------|----------|--------|
| 新增 Docker 场景简版指引（链接到 mcp-server/README.md） | backend/README.md:222-224 | ✅ 一致 |

### P2 四字段对照

| 字段 | P2 声明 | 实际实现 | 一致性 |
|------|---------|----------|--------|
| packages | `["@peekview/mcp-server"]` | 改动仅在 packages/mcp-server/ + README.md + backend/README.md | ✅ 一致（README 属于包外文档，但 P2 影响域已列出） |
| domains | `[mcp, docs, security]` | 代码修复(mcp) + 文档修正(docs) + CWD guard(security) | ✅ 一致 |
| ui_affected | `false` | 无前端改动 | ✅ 一致 |
| gate_commands.P5 | `cd packages/mcp-server && npm run test:unit 2>&1 \| tail -40` | P5 使用此命令验证 | ✅ 一致 |

### P2 影响域"不改什么"对照

| 不改项 | 实际 | 一致性 |
|--------|------|--------|
| PeekView 后端代码 | 未改 | ✅ |
| PeekView 前端代码 | 未改 | ✅ |
| MCP Server transport/认证/client 层 | 未改 | ✅ |
| MCP Server 其他工具（create_entry/get_entry/list_entries/delete_entry） | 未改 | ✅ |
| Dockerfile | 未改 | ✅ |
| 配置文件格式（YAML 结构不变，只加容错） | 未改 | ✅ |

## 方向 2：实现→设计（对照代码变更，检查设计文档中是否有不再适用的要求）

### 逐项检查

1. **CWD guard 实现**：publishFiles.ts:342-357 实现与 P2 设计完全一致。无超出设计的实现。✅

2. **allowed_paths 容错**：merge.ts:81-87 实现与 P2 设计完全一致。无超出设计的实现。✅

3. **/health 增强**：server.ts:234-262 实现与 P2 设计一致。config 对象结构扩展了类型定义（增加了 cwd/mode/allowed_paths 字段到 TypeScript 类型），这是设计隐含的必要改动，P2 未显式列出但属于实现细节。✅

4. **config list 增强**：cli/config.ts:179-191 实现与 P2 设计一致。runtime 节格式与 P2 设计示例略有差异（P2 写 `allowed_paths:/data:/tmp (resolved, env-merged)`，实现写 `allowed_paths:/data:/tmp  (resolved, env-merged)`），空格差异不影响功能。✅

5. **config verify 增强**：cli/config.ts:513-530 实现与 P2 设计一致。P2 设计中 `console.log` 用 emoji ✅/❌，实现也用 ✅/❌。✅

6. **publish_files 工具描述**：publishFiles.ts:311-313 实现与 P2 §3 设计完全一致（3 行文本逐字匹配）。✅

7. **mcp-server/README.md**：实现覆盖了 P2 §2 列出的所有修正项。额外增加了 Docker 场景指引的完整节（P2 设计已列出此节的内容要求），无超出设计的实现。✅

8. **README.md（根）**：实现覆盖了 P2 §2 列出的 OpenCode/Cursor 示例 + Docker 简版指引。✅

9. **backend/README.md**：实现覆盖了 P2 §2 列出的 Docker 简版指引。✅

### 僵尸需求检查

- P1 BDD-1~24 全部在 P6 中 PASS，无遗漏 BDD 条目
- P2 设计中无已否决方案的残留 AC
- 无已废弃的约束

### 实现超出设计但合理的检查

- 无 [EXTENSION] 项。所有实现严格在 P2 设计范围内。

## DESIGN_GAP 配对

P4-implementation.md 中无 [DESIGN_GAP:] 声明。无需配对。

[DESIGN_GAP_REVIEWED: 无 DESIGN_GAP 需配对 — P4 未声明任何 DESIGN_GAP]

## SCOPE+ 闭环

全阶段无 [SCOPE+] 声明。P1-requirements.md 含 [NO_NEED_CONFIRM]，无待确认项。

SCOPE+ 闭环状态：✅ 无 SCOPE+ 增补，无需闭环。

## 跨文件一致性

### P2§packages vs P8 bump 范围

P2 声明 `packages: ["@peekview/mcp-server"]`。P8 需 bump `@peekview/mcp-server` 版本。✅ 一致。

### P1 BDD 数量 vs P6 验收数量

P1 定义 BDD-1~24（24 条）。P6 验收 PASS: 24 / FAIL: 0。✅ 数量匹配。

逐条映射验证：
- BDD-1~5（CWD Guard）→ P6 PASS BDD-1~5 ✅
- BDD-6（错误信息区分）→ P6 PASS BDD-6 ✅
- BDD-7~9（allowed_paths 容错）→ P6 PASS BDD-7~9 ✅
- BDD-10~12（config list 增强）→ P6 PASS BDD-10~12 ✅
- BDD-13~14（config verify 增强）→ P6 PASS BDD-13~14 ✅
- BDD-15~17（/health 增强）→ P6 PASS BDD-15~17 ✅
- BDD-18~22（文档修正）→ P6 PASS BDD-18~22 ✅
- BDD-23~24（工具描述增强）→ P6 PASS BDD-23~24 ✅

### P4 实现路径 vs P2 方案设计

P4 实现了 P2 方案 A 的全部 7 项改动，未采用方案 B。✅ 一致。

### P6 BDD 二值规则

P6 验收结果全部为 PASS 或 FAIL，无中间态（无"调整/跳过/覆盖"）。✅ 合规。

## 未决项清零

| 文件 | NEED_CONFIRM | BLOCKER | DEVIATION-CRITICAL |
|------|-------------|---------|-------------------|
| P1-requirements.md | [NO_NEED_CONFIRM] ✅ | 无 ✅ | 无 ✅ |
| P4-implementation.md | 无 ✅ | 无 ✅ | 无 ✅ |
| P6-acceptance.md | [NO_NEED_CONFIRM] ✅ | 无 ✅ | 无 ✅ |
| P4-review.md | 无 ✅ | 无 ✅ | 无 ✅ |

全阶段无残留未决项。✅

## 一致性结论

**双向一致性检查通过。** 设计→实现：9 项改动全部一致，无偏差。实现→设计：无超出设计的实现，无僵尸需求，无废弃约束。DESIGN_GAP 无需配对（P4 未声明）。SCOPE+ 无需闭环（无增补）。跨文件一致性：BDD 数量匹配（24/24），packages 声明一致，P6 二值规则合规。未决项清零。

BLOCKER: 0
DEVIATION-CRITICAL: 0
