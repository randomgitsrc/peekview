# 双模式最终方案 v0.7.0 — 实施前二轮专家评审

> 评审框架：gstack（Staff Engineer + /cso + 后端契约核查）
> 日期：2026-06-09
> 评审对象：docs/plans/mcp-dual-mode-final-v0.7.md
> 前置评审：docs/reviews/gstack-review-dual-mode-final.md（自评审，已修正 5 项）
> 评审方式：核查方案与现有 MCP Server / 后端代码的实际契合度

---

## 评审结论

方案核心决策（local 只暴露 publish_files）论证充分，自评审已修正的 5 项技术问题（realpath 顺序、glob 兼容、createTools 签名、language 自动检测、二进制跳过）经核查均正确。

二轮评审核查方案与**实际代码**的契合度，发现 2 个事实性偏差和 1 个语义对齐问题，均不影响方案决策，但实现时必须修正。

---

## 核查通过的项（自评审已正确处理）

| 项 | 核查结果 |
|----|----------|
| 后端 `detect_language` 存在 | ✅ `language.py:266`，`_collect_files` 在处理 content 时无条件用 `detect_language(filename)` 覆盖（entry_service.py:710），publish_files 不传 language 完全可行 |
| Node engines >=18 | ✅ `package.json` 确认，`fs.glob`（Node22+）不可用，自实现 matchPattern 正确 |
| `translateError` 可复用 | ✅ `utils.ts:4` 存在 |
| realpath ENOENT 流程 | ✅ 已改为 stat → realpath，正确 |
| 后端文件限制 | ✅ `max_entry_files`、`max_file_size` 存在于 config.py |

---

## 发现的问题（实现时必须修正）

### 问题 1（事实偏差）：createTools 调用方位置写错

**方案 Step 4** 写："`src/server.ts`：调用 `createTools(client, config)` 的地方同步更新"。

**实际：** `createTools` 的唯一调用方在 **`src/index.ts:75`**（`const tools = createTools(client, config.publicUrl)`），不在 `server.ts`。

**影响：** 实现时改错文件会导致编译失败。
**修正：** Step 4 调用方改为 `src/index.ts:75`。

---

### 问题 2（语义对齐）：后端 `path` 字段语义在两处文档不一致

**现象：**
- 后端 `models.py:242`：`path: Relative path within entry (e.g., "src/main.py")` —— 完整相对路径
- MCP `createEntry.ts:57`：`Optional subdirectory path (e.g., "src")` —— 仅子目录

两处对 `path` 的定义不同（完整相对路径 vs 子目录）。

**对 publish_files 的影响：** publish_files 扫描目录后，每个文件需要构造 `path` 传给后端。例如扫描 `/project/src/main.py`（allowed base `/project`），应传 `path="src/main.py"` 还是 `path="src"` + `filename="main.py"`？

**修正：** 实现 publish_files 前，先用一个多文件 + 子目录的 create_entry 请求验证后端 `path` 的实际处理方式（看 `storage.write_file` 怎么用 path + filename 拼盘符路径），以此为准构造 publish_files 的 path。**这是实现 Step 3 的前置验证项。**

---

### 问题 3（边界补充）：目录扫描的符号链接需要防环

**方案 §五** 路径校验对单个文件用 realpath 解析符号链接。但**目录递归扫描**时，如果目录内有指向父目录的符号链接（如 `node_modules/.bin` 链回根），递归会无限循环。

方案的目录跳过清单含 `node_modules` 等，能挡掉大部分，但自定义符号链接环仍可能触发。

**修正：** 目录扫描时记录已访问的 realpath 集合，遇到已访问的真实路径就跳过（防环）。在 Step 3 实现中补充。

---

## 评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 决策合理性 | 9/10 | local 只暴露 publish_files 论证充分，与代码现实一致 |
| 技术可行性 | 8/10 | 自评审 5 项已修正；二轮发现调用方位置、path 语义需对齐 |
| 安全模型 | 8/10 | 三层防护合理；补充目录扫描防环 |
| 与代码契合度 | 7/10 | path 语义需先验证，调用方位置写错 |

---

## 进入实现的前置条件

1. Step 4 调用方位置改为 `src/index.ts:75`（不是 server.ts）
2. Step 3 实现前先验证后端 `path` 字段实际处理方式（完整相对路径 vs 子目录）
3. Step 3 目录扫描补充符号链接防环（已访问 realpath 集合）

以上 3 项在实现中直接处理，不阻塞方案，无需再改方案文档。

---

*二轮评审完成：2026-06-09*
