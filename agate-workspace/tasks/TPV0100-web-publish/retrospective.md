---
task_id: TPV0100
mechanism_issues:
  - "P6.5 judge verdict_evidence 路径形态无基准约定：judge 角色文件只说'引用须在清单内且指向真实存在'，未规定相对 P6-evidence/ 解析；judge 写了 P6-evidence/ 前缀导致 check-judge-verdict.py 判引用不存在"
  - "check-judge-verdict.py 的行首预判扫描覆盖 dispatch-context 内的格式示例/代码块：示例行 - PASS BDD-1: 被误判为验收结论预判"
  - "P3 测试设计未强制核对后端响应 schema：BDD-22 断言 raw 端点不存在的字段 owner_id，任何正确实现下必失败（红灯测试缺陷，直通 P4）"
execution_issues:
  - "主 Agent 在 P6.5 dispatch-context 写结论行格式示例时用了行首 - PASS/- FAIL，自触发预判扫描"
feedback_ready: true
---

# TPV0100 复盘 — 网页发布入口

## 一、事实基线

| 项 | 值 |
|----|----|
| 阶段链 | P0 → P1 → P2 → P3 → P4 → P5 → P6 → P6.5 → P7 → P8 → READY |
| 裁剪 | 无（全 8 阶段 + P6.5 全走） |
| 评审轮次 | P1 2 轮 / P2 2 轮 / P4 1 轮 / P6.5 1 轮 / P7 1 轮 |
| 重试 | P1 1 次（25→30 BDD）/ P2 1 次（72→91 分） |
| gate 失败 | 无 exit 1 级阻断；P6.5 首次 gate 因路径形态 exit 1（机械修正后通过） |
| 代码改动 | 16 文件（13 源 + 3 测试修订）；前端 `frontend-v3/**` + `DESIGN.md`；后端零改动 |
| 测试 | 前端 1364 passed / 后端 1173 passed / typecheck / E2E 40 passed |
| 版本 | peekview 0.25.0 → 0.26.0（minor）；mcp_server 不动 |
| 提交 | P1–P8 共 10 个 commit + 1 tag `v0.26.0` |

## 二、做得好的 + 可复用模式

- **单任务本地 vitest formatter**（`{task_dir}/.agate/formatters/vitest-vite.sh`）：内置 `vitest.sh` 两处缺陷（输出超 `MAX_ARG_STRLEN` + 不识别 Vite `Failed to resolve import`）在 P3 被识别并规避。→ 去向：**回馈 agate**（已登记 DEBT0014，本任务复验有效）
- **P4 实现前实做 minimal_validation**（P2 §minimal_validation 用 debug :8888 curl 实测 POST 契约/幂等 + JS 端口对齐后端 `is_binary_content` 8 样本）：使前端编码判定与后端逐分支一致，P6 BDD-8/30 一次过。→ 去向：项目资产（P2 方法论，已在 `docs/specs/` 落地）
- **主 Agent 亲自裁决并落地 2 处测试缺陷**（BDD-22 端点、UserMenu 类名）：不放过"红灯指向测试本身缺陷"的情况，先修测试再让实现对齐，避免把测试缺陷掩盖成"跳过"。→ 去向：回馈 agate（P4 卡应明确"P4 可因测试缺陷回改 P3 产出"的口径）
- **P6.5 judge 白名单信息隔离**：judge 未读 P6-acceptance.md 即独立重验 30 BDD，证据 md5 互异/引用对称机械通过。→ 去向：回馈 agate（机制有效，建议推广）

## 三、发现的问题

| # | 问题 | 归因层面 |
|---|------|---------|
| 1 | **P6.5 judge verdict_evidence 路径无基准**：judge 写 `P6-evidence/assert-bdd-1.json`，`check-judge-verdict.py:_evidence_md5_dedup` 用 `os.path.join(evidence_dir, ref)` 解析（evidence_dir 已是 `.../P6-evidence`）→ 双重前缀判"引用不存在" | 机制缺口 |
| 2 | **judge 角色文件未规定 vision-reports 等 P6-evidence/ 外证据的引用形式**：vision YAML 在任务根 `vision-reports/`，无法以 `P6-evidence/` 相对路径表达；本任务改用 `../vision-reports/` 才通过 | 机制缺口 |
| 3 | **check-judge-verdict.py 行首预判扫描未排除 dispatch-context 的格式示例/代码块**：主 Agent 在派发指引写 `- PASS BDD-1: {描述}` 示例行 → 被判"2 处行首验收结论预判" | 机制缺口 |
| 4 | **P3 测试设计缺"后端响应 schema 核对"强制项**：BDD-22 断言 `GET /entries/{slug}/raw` 的 `owner_id`，但 `EntryRawResponse`（`models.py:776-785`）不含该字段 → 红灯测试在任何正确实现下必失败，直到 P4 才暴露 | 机制缺口 |
| 5 | 主 Agent 在 P6.5 dispatch-context 格式示例用行首 `- PASS`，自触发扫描 | 执行错误 |

## 四、改进措施

1. **（协议）** judge 角色文件 + `check-judge-verdict.py` 文档补明确：`verdict_evidence` 条目相对 **`P6-evidence/`** 解析；P6-evidence/ 外证据（vision-reports 等）用 `../<dir>/<file>` 相对路径表达。
2. **（协议）** `check-judge-verdict.py` 的行首预判扫描对 dispatch-context 的 fenced code block 与格式示例节做排除（复用 AGATE_CARD + frontmatter 的双排除模式）。
3. **（协议）** P3 卡 / test-designer 角色补：测试断言后端响应字段前，须核对 `models.py` 对应响应模型字段集（防"断言不存在字段"的必败红灯）。
4. **（执行纪律）** 主 Agent 写 dispatch-context 的格式示例时，不得用行首 `- PASS`/`- FAIL`（改用无前缀或引用块）。
5. **（项目资产）** 任务本地 formatter 方案（`vitest-vite.sh`）暂留任务目录；若后续任务再遇内置 formatter 缺陷，考虑上提为项目级 `scripts/formatters/`。

## agate 反馈

- **机制缺口-1（judge 证据路径基准）**：`check-judge-verdict.py` 的 `_evidence_md5_dedup` 以 `P6-evidence/` 为基准 join，但 judge 角色文件未声明该基准 → judge 产出高概率带目录前缀而机械失败。建议：角色文件显式声明"相对 P6-evidence/ 解析"，或脚本容错剥离已知前缀。
- **机制缺口-2（P6-evidence 外证据形态）**：vision-reports/ 等目录在 P6-evidence/ 之外，无规定引用形式。建议补 `../` 相对路径约定并在角色文件举例。
- **机制缺口-3（行首预判扫描误报）**：`_check_prediction` 扫全文（排除 AGATE_CARD/frontmatter）但未排除代码块；dispatch-context 的格式示例天然含 `- PASS`/`- FAIL` 示例行。建议排除 fenced code block。
- **机制缺口-4（P3 schema 核对）**：P3 无"断言字段须存在于后端响应模型"的检查，导致必败红灯直通 P4。建议 P3 卡加该检查项（可比对 `models.py` 响应类字段集）。
